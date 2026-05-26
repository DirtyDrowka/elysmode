// OpenRouter API client. Sequential tool calling loop — DeepSeek (и многие
// другие) отдают по ОДНОМУ tool_call за запрос, даже с parallel_tool_calls:true.
// Поэтому: POST → 1 tool_call → шлём обратно assistant + tool_result → POST
// → следующий tool_call → ... пока модель не эмитит choices.

import type { ChainBlock } from '../novel/blocks';
import { TOOLS } from '../novel/systemPrompt';
import { api } from './api';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = import.meta.env.VITE_OPENROUTER_KEY as string;
const MODEL =
  (import.meta.env.VITE_OPENROUTER_MODEL as string) || 'deepseek/deepseek-v4-flash';

const MAX_ITERATIONS = 8;
// После FORCE_CHOICES_AFTER итераций без choices — принудительно требуем
// choices через tool_choice. Иначе flash-модель может крутиться вечно.
const FORCE_CHOICES_AFTER = 4;

if (!API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[openrouter] VITE_OPENROUTER_KEY is empty — calls will fail');
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ChatResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason?: string | null;
  }>;
  provider?: string;
  error?: { message?: string; code?: string | number };
}

/**
 * Sequential генерация цепочки блоков. На каждой итерации шлём всё что было,
 * получаем 1-N tool_calls, эмитим, добавляем в conversation, повторяем.
 * Прерываемся когда увидели `choices` или когда модель перестала вызывать tool'ы.
 */
export async function* streamChain(
  initialMessages: Message[]
): AsyncGenerator<ChainBlock, void, void> {
  const conversation: Message[] = [...initialMessages];
  let iterations = 0;
  // дедуп: последний "ключ" блока (type + первые N символов текста) —
  // если модель эмитит то же что и раньше, не пушим в чейн и шлём дальше.
  const emittedKeys = new Set<string>();
  function blockKey(b: ChainBlock): string {
    if (b.type === 'narrator' || b.type === 'thought') return `${b.type}:${b.text.slice(0, 40)}`;
    if (b.type === 'speech') return `speech:${b.character_id}:${b.text.slice(0, 40)}`;
    if (b.type === 'edit_scene') {
      const loc = b.location_description ? b.location_description.slice(0, 30) : '_keep_';
      return `scene:${loc}:${b.character_ids.join(',')}`;
    }
    if (b.type === 'create_character') return `char:${b.id}`;
    if (b.type === 'choices') return 'choices';
    if (b.type === 'set_title') return 'set_title';
    if (b.type === 'set_summary') return `summary:${b.summary.slice(0, 40)}`;
    return 'unknown';
  }

  while (iterations++ < MAX_ITERATIONS) {
    const forceChoices = iterations > FORCE_CHOICES_AFTER;
    console.log(
      `[openrouter] iteration ${iterations}, sending ${conversation.length} msgs${forceChoices ? ' [FORCING choices]' : ''}`
    );
    const t0 = performance.now();
    // VPN/Kakadu иногда моргает в момент TLS — fetch кидает «Failed to fetch».
    // Делаем до 3 попыток с экспоненциальной задержкой.
    let res: Response | null = null;
    let lastFetchErr: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer':
          typeof window !== 'undefined'
            ? window.location.origin
            : 'http://localhost',
        'X-Title': 'elys mode',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: conversation,
        tools: TOOLS,
        // После N итераций без choices — форсим именно choices (закрытие сцены).
        // Это спасает от бесконечного цикла narrator/thought.
        tool_choice: forceChoices
          ? { type: 'function', function: { name: 'choices' } }
          : 'required',
        parallel_tool_calls: true,
        temperature: 0.9,
        reasoning: { effort: 'low' },
        provider: {
          ignore: ['AtlasCloud'],
        },
      }),
    });
        break; // успех — выходим из retry-цикла
      } catch (e) {
        lastFetchErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        // «Failed to fetch» / ECONNRESET / network error — попробуем снова
        const isNet = msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ECONNRESET');
        if (!isNet || attempt === 3) throw e;
        const delay = 800 * attempt;
        console.warn(`[openrouter] network fail on attempt ${attempt}, retry in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    if (!res) throw lastFetchErr ?? new Error('OpenRouter fetch failed');

    const text = await res.text();
    const dt = Math.round(performance.now() - t0);
    console.log(`[openrouter] iteration ${iterations} done in ${dt}ms, status=${res.status}`);
    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
    }

    let json: ChatResponse;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`OpenRouter: invalid JSON: ${text.slice(0, 200)}`);
    }
    if (json.error) {
      throw new Error(
        `OpenRouter: ${json.error.message ?? JSON.stringify(json.error)}`
      );
    }

    const message = json.choices?.[0]?.message;
    const toolCalls = message?.tool_calls ?? [];
    console.log(
      `[openrouter] iteration ${iterations}: ${toolCalls.length} tool_calls, finish=${json.choices?.[0]?.finish_reason}, provider=${json.provider}`
    );
    if (message?.content) {
      console.log(
        `[openrouter] iteration ${iterations}: content="${String(message.content).slice(0, 100)}"`
      );
    }

    if (toolCalls.length === 0) {
      console.warn('[openrouter] no tool calls — exiting chain');
      return;
    }

    let sawChoices = false;
    let emittedNew = false;

    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        continue;
      }
      const block = toolCallToBlock(tc.function.name, args);
      if (!block) continue;
      const k = blockKey(block);
      if (emittedKeys.has(k)) {
        console.warn(`[openrouter] dropping duplicate block: ${k}`);
        continue;
      }
      emittedKeys.add(k);
      emittedNew = true;
      yield block;
      if (block.type === 'choices') {
        sawChoices = true;
        // Сцена закрыта choices — игнорируем всё что модель эмитнула после.
        // Иначе 2-3 choices подряд (бывает на flash/grok).
        break;
      }
    }

    if (sawChoices) return;

    // Если за всю итерацию модель эмитнула только дубликаты и
    // ничего нового — выходим, не крутимся вечно.
    if (!emittedNew) {
      console.warn('[openrouter] only duplicates emitted — exiting chain');
      return;
    }

    // Дополняем conversation. В tool_result отдаём НЕ "ok", а краткое
    // подтверждение что именно эмитнули — иначе модель не "помнит" свой
    // вывод и в следующей итерации повторяет тот же блок.
    conversation.push({
      role: 'assistant',
      content: message?.content ?? null,
      tool_calls: toolCalls,
    } as Message);
    for (const tc of toolCalls) {
      conversation.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: `emitted ${tc.function.name}: ${tc.function.arguments.slice(0, 200)}`,
      });
    }
  }
}

function toolCallToBlock(
  name: string,
  args: Record<string, unknown>
): ChainBlock | null {
  switch (name) {
    case 'narrator': {
      const text = typeof args.text === 'string' ? args.text : null;
      if (!text) return null;
      return { type: 'narrator', text };
    }
    case 'main_hero': {
      const text = typeof args.text === 'string' ? args.text : null;
      if (!text) return null;
      return { type: 'thought', text };
    }
    case 'speech': {
      // главное поле — character_id; принимаем и legacy `speaker`
      const idRaw =
        typeof args.character_id === 'string'
          ? args.character_id
          : typeof args.speaker === 'string'
            ? args.speaker
            : null;
      const text = typeof args.text === 'string' ? args.text : null;
      if (!idRaw || !text) return null;
      return { type: 'speech', character_id: idRaw, text };
    }
    case 'create_character': {
      const id = typeof args.id === 'string' ? args.id.trim() : null;
      const name = typeof args.name === 'string' ? args.name : null;
      const color =
        typeof args.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(args.color)
          ? args.color
          : '#d4ff00';
      const personality =
        typeof args.personality === 'string' ? args.personality : '';
      const appearance =
        typeof args.appearance === 'string' ? args.appearance : '';
      if (!id || !name) return null;
      return {
        type: 'create_character',
        id,
        name,
        color,
        personality,
        appearance,
      };
    }
    case 'choices': {
      const optsRaw = Array.isArray(args.options) ? args.options : null;
      if (!optsRaw) return null;
      const options: Array<{ label: string; cost?: number }> = [];
      for (const o of optsRaw) {
        if (!o || typeof o !== 'object') continue;
        const obj = o as Record<string, unknown>;
        const label = typeof obj.label === 'string' ? obj.label : null;
        if (!label) continue;
        const cost =
          typeof obj.cost === 'number' && [9, 19, 49].includes(obj.cost)
            ? obj.cost
            : undefined;
        const opt: { label: string; cost?: number } = { label };
        if (cost !== undefined) opt.cost = cost;
        options.push(opt);
      }
      if (options.length === 0) return null;
      return { type: 'choices', options };
    }
    case 'edit_scene': {
      // location_description: строка → новая локация; null/undefined/пусто → не меняем
      const locRaw = args.location_description;
      let loc: string | null = null;
      if (typeof locRaw === 'string' && locRaw.trim()) loc = locRaw.trim();
      // character_ids: всегда массив (макс 3)
      const idsRaw = Array.isArray(args.character_ids) ? args.character_ids : [];
      const ids: string[] = [];
      for (const raw of idsRaw) {
        if (typeof raw === 'string' && raw.trim()) ids.push(raw.trim());
        if (ids.length >= 3) break;
      }
      return { type: 'edit_scene', location_description: loc, character_ids: ids };
    }
    case 'set_title': {
      const title = typeof args.title === 'string' ? args.title.trim() : null;
      if (!title) return null;
      return { type: 'set_title', title };
    }
    case 'set_summary': {
      const summary = typeof args.summary === 'string' ? args.summary.trim() : null;
      if (!summary) return null;
      return { type: 'set_summary', summary };
    }
    default:
      return null;
  }
}

// ───────────────────────────────────────────────────────────────────────
// Image generation (через наш backend → Recraft via OpenRouter)
// ───────────────────────────────────────────────────────────────────────

/** Фоновая локация. Бэк дёргает recraft/recraft-v4.1-utility. */
export async function generateBackground(description: string): Promise<string> {
  const r = await api<{ image_url: string }>('/api/generate/background', {
    method: 'POST',
    body: { description },
  });
  return r.image_url;
}

/** Портрет персонажа. Бэк дёргает тот же recraft. */
export async function generateCharacterImage(appearance: string): Promise<string> {
  const r = await api<{ image_url: string }>('/api/generate/character', {
    method: 'POST',
    body: { appearance },
  });
  return r.image_url;
}
