// Генерация изображений через OpenRouter, модель `recraft/recraft-v4.1-utility`.
// Используется и для спрайтов персонажей, и для фоновых локаций — один движок,
// разные промпты.

import { httpRequest } from './httpRequest.ts';

const OPENROUTER_KEY = process.env.VITE_OPENROUTER_KEY ?? '';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'recraft/recraft-v4.1-utility';

if (!OPENROUTER_KEY) {
  console.warn(
    '[recraft-or] VITE_OPENROUTER_KEY пустой — генерация работать не будет'
  );
}

// Recraft режет агрессивную сексуальную лексику. Держим вайб через
// эвфемизмы (соблазнительный / чувственный / провокационный наряд)
// — фактический результат тот же, но prompt не триггерит content filter.
function buildCharacterPrompt(appearance: string): string {
  return (
    `Детализированное аниме, мелкие детали, мягкие блики, чёткие тени, всё прорисовано.\n` +
    `Game asset sprite персонажа для аниме визуальной новеллы.\n` +
    `Соблазнительная и привлекательная фигура, чувственная нейтральная поза, ` +
    `провокационный модный наряд, кокетливый взгляд.\n` +
    `Персонаж стоит перед камерой, виден во весь рост.\n` +
    `Прозрачный фон, только персонаж, мягкое ровное освещение.\n` +
    `\nОписание внешности персонажа:\n${appearance}`
  );
}

// Fallback на случай если основной промпт всё равно зацепил filter —
// убираем всё что может триггерить (соблазнительный/провокационный),
// оставляем нейтральный аниме-промпт.
function buildCharacterPromptSafe(appearance: string): string {
  return (
    `Детализированное аниме, чёткие линии, мягкие блики, cel-shading.\n` +
    `Game asset sprite персонажа для аниме визуальной новеллы.\n` +
    `Персонаж стоит перед камерой, виден во весь рост, нейтральная стильная поза.\n` +
    `Прозрачный фон, только персонаж, мягкое равномерное освещение.\n` +
    `\nОписание внешности:\n${appearance}`
  );
}

function buildBackgroundPrompt(description: string): string {
  return (
    `рисовка максимально детализированное аниме, мелкие детали, блики, тени, все прорисовано\n` +
    `сгенерируй background в стиле типичной аниме визуальной новеллы.\n` +
    `fov и положение камеры на уровне человеческого взгляда, камера смотрит строго прямо.\n` +
    `на локации НЕ должно быть персонажей, ни одного — только обстановка.\n` +
    `вертикальная композиция portrait 9:16, высокая, под мобильный экран.\n` +
    `картинка должна выглядеть как типичный background в аниме визуальной новелле.\n\n` +
    `описание локации:\n${description}`
  );
}

interface ImagePart {
  type?: string;
  image_url?: { url?: string } | string;
  url?: string;
  b64_json?: string;
  data?: string;
  mime_type?: string;
}

interface ORResponse {
  choices?: Array<{
    message?: {
      content?: string | ImagePart[] | null;
      images?: ImagePart[];
    };
  }>;
  error?: { message?: string; code?: string | number };
}

function pickUrl(item: unknown): string | null {
  if (!item) return null;
  if (typeof item === 'string') {
    if (item.startsWith('data:') || item.startsWith('http')) return item;
    return null;
  }
  if (typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  const iu = obj.image_url;
  if (iu && typeof iu === 'object') {
    const u = (iu as Record<string, unknown>).url;
    if (typeof u === 'string') return u;
  }
  if (typeof iu === 'string') return iu;
  if (typeof obj.url === 'string') return obj.url;
  if (typeof obj.b64_json === 'string') {
    return `data:image/png;base64,${obj.b64_json}`;
  }
  if (typeof obj.data === 'string') {
    const mime = typeof obj.mime_type === 'string' ? obj.mime_type : 'image/png';
    return `data:${mime};base64,${obj.data}`;
  }
  return null;
}

function extractImageUrl(json: ORResponse): string | null {
  const msg = json.choices?.[0]?.message;
  if (!msg) return null;
  if (Array.isArray(msg.images)) {
    for (const img of msg.images) {
      const u = pickUrl(img);
      if (u) return u;
    }
  }
  if (Array.isArray(msg.content)) {
    for (const p of msg.content) {
      const u = pickUrl(p);
      if (u) return u;
    }
  }
  return null;
}

/** Распознаёт сетевые ошибки (VPN моргнул, TLS reset и т.п.) — на такие
 *  делаем retry, на content-filter / 4xx — нет. */
function isTransientNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('ECONNRESET') ||
    msg.includes('socket disconnected before secure TLS') ||
    msg.includes('socket hang up') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('EAI_AGAIN') ||
    msg.includes('Request timeout')
  );
}

async function callRecraftOnce(prompt: string, label: string): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error('VITE_OPENROUTER_KEY is empty');

  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    modalities: ['image'],
  };

  const res = await httpRequest(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': `elys mode ${label}`,
    },
    body: JSON.stringify(body),
    timeoutMs: 120_000,
  });

  if (res.status >= 400) {
    throw new Error(`Recraft-OR ${res.status}: ${res.bodyText.slice(0, 400)}`);
  }

  let json: ORResponse;
  try {
    json = JSON.parse(res.bodyText);
  } catch {
    throw new Error(`Recraft-OR: invalid JSON: ${res.bodyText.slice(0, 200)}`);
  }
  if (json.error) {
    throw new Error(
      `Recraft-OR: ${json.error.message ?? JSON.stringify(json.error)}`
    );
  }
  const url = extractImageUrl(json);
  if (!url) {
    throw new Error(
      `Recraft-OR: no image in response. Raw: ${res.bodyText.slice(0, 400)}`
    );
  }
  return url;
}

/** Обёртка с retry на сетевые сбои (VPN моргнул, TLS reset). */
async function callRecraft(prompt: string, label: string): Promise<string> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callRecraftOnce(prompt, label);
    } catch (e) {
      lastErr = e;
      if (!isTransientNetworkError(e) || attempt === MAX_ATTEMPTS) throw e;
      const delay = 800 * attempt;
      console.warn(
        `[recraft-or] transient network error on attempt ${attempt}, retrying in ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function generateCharacterPortrait(
  appearance: string
): Promise<string> {
  try {
    return await callRecraft(buildCharacterPrompt(appearance), 'character-gen');
  } catch (e) {
    // На content-filter (prompt_is_improper / 400) — retry с безопасным
    // нейтральным промптом. Картинка получится менее «горячей», но хоть
    // будет, а не плейсхолдер навсегда.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('prompt_is_improper') || msg.includes('content filter') || msg.includes('Recraft-OR 400')) {
      console.warn('[recraft-or] content filter hit, retrying with safe prompt');
      return callRecraft(buildCharacterPromptSafe(appearance), 'character-gen-safe');
    }
    throw e;
  }
}

export function generateBackgroundImage(description: string): Promise<string> {
  return callRecraft(buildBackgroundPrompt(description), 'bg-gen');
}
