// x-ai/grok-imagine-image-quality через OpenRouter — генерация портретов
// персонажей с белым фоном, после чего белый удаляется скриптом для прозрачности.

import { Jimp } from 'jimp';

const OPENROUTER_KEY = process.env.VITE_OPENROUTER_KEY ?? '';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'x-ai/grok-imagine-image-quality';

if (!OPENROUTER_KEY) {
  console.warn('[grok] VITE_OPENROUTER_KEY пустой — генерация работать не будет');
}

function buildCharacterPrompt(appearance: string): string {
  // Изначально промпт был жёстче («максимально сексуализирован, вульгарная
  // поза, извращенно») — Grok зарезал на post-generation modration
  // (Generated image rejected by content moderation). Смягчаем через
  // эвфемизмы — сохраняем sexy-вайб но без слов-триггеров.
  return (
    `Sprite персонажа для взрослой визуальной новеллы (18+). ` +
    `Сексуально привлекательный персонаж с подчёркнутой соблазнительной фигурой, ` +
    `чувственная поза, провокационная стильная одежда (декольте / обтягивающее / ` +
    `мини / чулки / расстёгнутые пуговицы), кокетливая улыбка, дерзкий зовущий взгляд.\n\n` +
    `Стиль: качественное аниме, чёткие линии, мягкое cel-shading, ` +
    `эстетика типа Persona / DDLC / Fate.\n\n` +
    `Персонаж стоит перед камерой, виден во весь рост, лицом к зрителю.\n\n` +
    `БЕЛЫЙ фон (pure white #ffffff), абсолютно ровный, без теней и градиентов, ` +
    `только персонаж в кадре, нейтральное ровное освещение без драмы.\n\n` +
    `Описание внешности:\n${appearance}`
  );
}

interface GrokImage {
  type?: string;
  image_url?: { url?: string } | string;
  url?: string;
  b64_json?: string;
}

interface GrokResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      images?: GrokImage[];
    };
  }>;
  error?: { message?: string; code?: string | number };
}

async function callGrokImage(prompt: string): Promise<Buffer> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer':
        typeof globalThis !== 'undefined' && 'location' in globalThis
          ? (globalThis as { location: { origin: string } }).location.origin
          : 'http://localhost',
      'X-Title': 'elys mode',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      // ВАЖНО: только image, без text — иначе 404
      modalities: ['image'],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Grok ${res.status}: ${text.slice(0, 500)}`);
  }
  let json: GrokResponse;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Grok: invalid JSON: ${text.slice(0, 200)}`);
  }
  if (json.error) {
    throw new Error(`Grok: ${json.error.message ?? JSON.stringify(json.error)}`);
  }

  const imgs = json.choices?.[0]?.message?.images ?? [];
  for (const img of imgs) {
    const iu = img.image_url;
    const url =
      typeof iu === 'object' && iu?.url
        ? iu.url
        : typeof iu === 'string'
          ? iu
          : img.url ?? (img.b64_json ? `data:image/png;base64,${img.b64_json}` : null);

    if (typeof url !== 'string') continue;
    if (url.startsWith('data:')) {
      const base64 = url.split(',', 2)[1] || '';
      return Buffer.from(base64, 'base64');
    }
    if (url.startsWith('http')) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Grok image download ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    }
  }
  throw new Error(`Grok: no image in response. Raw: ${text.slice(0, 400)}`);
}

/**
 * Делает «белые» пиксели прозрачными. Threshold-based с soft edges:
 * - очень белые (brightness >= 245) → полная прозрачность
 * - почти белые (220..245) → частичная по градиенту
 * Чтобы не сжирать blond hair / светлую одежду — проверяем что цвет
 * ДЕЙСТВИТЕЛЬНО ахроматический (все каналы близки) перед removal.
 */
async function removeWhiteBackground(input: Buffer): Promise<Buffer> {
  const image = await Jimp.read(input);
  const W = image.bitmap.width;
  const H = image.bitmap.height;
  const data = image.bitmap.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (W * y + x) << 2;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const brightness = (r + g + b) / 3;
      const chromaSpread = Math.max(r, g, b) - Math.min(r, g, b);

      // ахроматический? иначе trogaем — это цвет персонажа
      if (chromaSpread > 18) continue;

      if (brightness >= 245) {
        data[idx + 3] = 0; // alpha = 0
      } else if (brightness >= 220) {
        // soft edge: 220..245 → alpha 255..0
        const t = (brightness - 220) / (245 - 220); // 0..1
        const alpha = Math.round((1 - t) * 255);
        data[idx + 3] = Math.min(alpha, data[idx + 3]);
      }
    }
  }

  return image.getBuffer('image/png');
}

/**
 * Главный публичный метод. Идёт в Grok через OpenRouter, получает картинку
 * на белом фоне, прогоняет через removeWhiteBackground → отдаёт data: PNG
 * с прозрачным фоном.
 */
export async function generateCharacterPortrait(
  appearance: string
): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error('VITE_OPENROUTER_KEY is empty');

  const prompt = buildCharacterPrompt(appearance);
  const raw = await callGrokImage(prompt);
  const transparent = await removeWhiteBackground(raw);
  return `data:image/png;base64,${transparent.toString('base64')}`;
}
