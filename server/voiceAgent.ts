// Voice agent — отдельная нейронка которая для нового персонажа подбирает
// подходящий voice_id из библиотеки ElevenLabs.
//
// Логика:
// 1. LLM по описанию персонажа выбирает gender + age (фильтры запроса)
// 2. Тянем 100 voices из ElevenLabs (sort=trending, language=ru, 30d notice,
//    exclude custom rates / live moderated)
// 3. Рандомим 20 из них
// 4. LLM выбирает 1 наиболее подходящий voice_id
//
// Поля accent/use_case/search/quality НЕ передаём — по требованию «всегда any».

import { searchVoices, type VoiceResult } from './elevenlabs.ts';
import { httpRequest } from './httpRequest.ts';

const OPENROUTER_KEY = process.env.VITE_OPENROUTER_KEY ?? '';
const OR_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const AGENT_MODEL = 'deepseek/deepseek-v4-flash';

// Fallback voice (Sarah, female young) — если всё совсем упало
const FALLBACK_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

interface CharacterInfo {
  id: string;
  name: string;
  personality: string;
  appearance: string;
}

interface FilterChoice {
  gender: 'male' | 'female' | 'neutral';
  age: 'young' | 'middle_aged' | 'old';
}

async function callLLM(
  messages: Array<{ role: string; content: string }>,
  opts: { maxTokens?: number; reasoning?: boolean } = {}
): Promise<string> {
  if (!OPENROUTER_KEY) return '';
  const body: Record<string, unknown> = {
    model: AGENT_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: opts.maxTokens ?? 80,
    provider: { ignore: ['AtlasCloud'] },
  };
  // reasoning: low если попросили; явно выключаем если не попросили
  // (иначе провайдеры типа Baidu включают reasoning по умолчанию и съедают
  // все output-токены — content приходит null, finish_reason="length")
  body.reasoning = opts.reasoning ? { effort: 'low' } : { enabled: false };
  try {
    const res = await httpRequest(OR_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'elys mode voice-agent',
      },
      body: JSON.stringify(body),
      timeoutMs: 30_000,
    });
    if (res.status >= 400) {
      console.warn(`[voice-agent] LLM ${res.status}:`, res.bodyText.slice(0, 200));
      return '';
    }
    const json = JSON.parse(res.bodyText);
    return String(json?.choices?.[0]?.message?.content ?? '').trim();
  } catch (e) {
    console.warn('[voice-agent] LLM call failed:', e);
    return '';
  }
}

async function pickFilters(c: CharacterInfo): Promise<FilterChoice> {
  const sys =
    'Ты выбираешь ФИЛЬТРЫ голоса по описанию персонажа. ' +
    'Ответ строго в формате JSON: {"gender":"male|female|neutral","age":"young|middle_aged|old"}. ' +
    'Без markdown, без пояснений — только JSON.';
  const usr = `Персонаж:\nИмя: ${c.name}\nХарактер: ${c.personality}\nВнешность: ${c.appearance.slice(0, 400)}\n\nВыбери gender и age.`;

  const raw = await callLLM(
    [
      { role: 'system', content: sys },
      { role: 'user', content: usr },
    ],
    { reasoning: false, maxTokens: 80 }
  );

  // вытаскиваем JSON
  const m = raw.match(/\{[\s\S]*?\}/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      const g = parsed.gender;
      const a = parsed.age;
      if (
        ['male', 'female', 'neutral'].includes(g) &&
        ['young', 'middle_aged', 'old'].includes(a)
      ) {
        return { gender: g, age: a };
      }
    } catch {
      /* noop */
    }
  }
  // fallback дефолт
  return { gender: 'female', age: 'young' };
}

async function pickVoice(
  c: CharacterInfo,
  candidates: VoiceResult[]
): Promise<string> {
  if (candidates.length === 0) return FALLBACK_VOICE_ID;
  if (candidates.length === 1) return candidates[0].voice_id;

  const list = candidates
    .map(
      (v, i) =>
        `${i + 1}. voice_id="${v.voice_id}" — ${v.name} | ${v.descriptive ?? ''} | ${v.accent ?? ''} | ${(v.description ?? '').slice(0, 150)}`
    )
    .join('\n');

  const sys =
    'Ты выбираешь ОДИН voice_id из списка кандидатов, наиболее подходящий персонажу. ' +
    'Учитывай тембр, возраст, характер. ' +
    'Ответ — ТОЛЬКО строка voice_id (например abc123XYZ), без кавычек, без пояснений, без markdown.';
  const usr = `Персонаж:\nИмя: ${c.name}\nХарактер: ${c.personality}\nОписание: ${c.appearance.slice(0, 400)}\n\nКандидаты:\n${list}\n\nВыбери лучший voice_id (целиком, без кавычек).`;

  const raw = await callLLM(
    [
      { role: 'system', content: sys },
      { role: 'user', content: usr },
    ],
    { reasoning: false, maxTokens: 60 }
  );

  // 1. Ищем voice_id напрямую в ответе
  for (const v of candidates) {
    if (raw.includes(v.voice_id)) {
      console.log(`[voice-agent] picked ${v.voice_id} (${v.name}) for ${c.id}`);
      return v.voice_id;
    }
  }
  // 2. Если LLM вернул номер из списка ("3", "12.", "номер 7" и т.п.)
  const numMatch = raw.match(/\d+/);
  if (numMatch) {
    const idx = parseInt(numMatch[0], 10) - 1;
    if (idx >= 0 && idx < candidates.length) {
      const v = candidates[idx];
      console.log(`[voice-agent] picked #${idx + 1} ${v.voice_id} (${v.name}) for ${c.id}`);
      return v.voice_id;
    }
  }
  console.warn(
    `[voice-agent] LLM ответил "${raw.slice(0, 100)}" — не парсится, берём первый из кандидатов`
  );
  return candidates[0].voice_id;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function selectVoiceForCharacter(
  c: CharacterInfo
): Promise<string> {
  // 1. LLM выбирает gender + age
  const filters = await pickFilters(c);
  console.log(`[voice-agent] filters for ${c.id}:`, filters);

  // 2. Тянем кандидатов (100 штук с sort=trending, language=ru, 30d notice)
  let pool: VoiceResult[] = [];
  try {
    pool = await searchVoices({
      gender: filters.gender,
      age: filters.age,
      language: 'ru',
      page_size: 100,
    });
  } catch (e) {
    console.warn('[voice-agent] searchVoices failed:', e);
    return FALLBACK_VOICE_ID;
  }
  console.log(`[voice-agent] pool size: ${pool.length}`);
  if (pool.length === 0) return FALLBACK_VOICE_ID;

  // 3. Random 20 из всего pool (Notice period 30d уже применён через API)
  const sample = shuffle(pool).slice(0, 20);

  // 5. LLM выбирает 1
  return pickVoice(c, sample);
}
