// ElevenLabs API — поиск голосов в shared-voices library + синтез через eleven_v3.
// ВАЖНО: ElevenLabs гео-блочит РФ (302 → help docs). Если backend хостится в РФ —
// нужен VPN/прокси, иначе API недоступен.
// Используем native node:https через httpRequest — undici fetch имеет
// проблемы с api.elevenlabs.io на некоторых сетях.

import { httpRequest } from './httpRequest.ts';

const KEY = process.env.ELEVENLABS_API_KEY ?? '';
const BASE = 'https://api.elevenlabs.io/v1';
const TTS_MODEL = 'eleven_v3';

if (!KEY) {
  console.warn('[elevenlabs] ELEVENLABS_API_KEY пустой — голоса работать не будут');
}

export interface VoiceSearchFilters {
  gender: 'male' | 'female' | 'neutral'; // обязателен — ЛЛМ выбирает
  age?: 'young' | 'middle_aged' | 'old';
  language?: string; // дефолт "ru"
  search?: string; // редко нужен (по нашим правилам — пусто)
  use_case?: string;
  page_size?: number;
}

export interface VoiceResult {
  voice_id: string;
  name: string;
  description: string;
  preview_url: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  language: string | null;
  descriptive: string | null;
  use_case: string | null;
  date_unix: number;
  rate: number;
  live_moderation_enabled: boolean;
}

interface SharedVoiceRaw {
  voice_id: string;
  name?: string;
  description?: string;
  preview_url?: string;
  gender?: string;
  age?: string;
  accent?: string;
  language?: string;
  descriptive?: string;
  use_case?: string;
  date_unix?: number;
  rate?: number;
  live_moderation_enabled?: boolean;
}

export async function searchVoices(
  f: VoiceSearchFilters
): Promise<VoiceResult[]> {
  if (!KEY) throw new Error('ELEVENLABS_API_KEY is empty');

  // Базовые фильтры по требованию: gender + age + language=ru (default).
  // accent / search / use_case — НЕ передаём (хотим все варианты).
  // Notice period 30 + exclude custom rates / live mod — пытаемся через query,
  // но если параметры не поддержаны API — отфильтруем локально.
  const q = new URLSearchParams();
  q.set('gender', f.gender);
  if (f.age) q.set('age', f.age);
  q.set('language', f.language ?? 'ru');
  q.set('sort', 'trending'); // по требованию: сортировка trending
  q.set('min_notice_period_days', '30');
  q.set('include_custom_rates', 'false');
  q.set('include_live_moderated', 'false');
  q.set('page_size', String(Math.min(f.page_size ?? 100, 100)));

  const res = await httpRequest(`${BASE}/shared-voices?${q.toString()}`, {
    headers: { 'xi-api-key': KEY, Accept: 'application/json' },
  });

  if (res.status === 302) {
    throw new Error(
      'ElevenLabs blocked your region (302). Включи VPN/прокси на сервере.'
    );
  }
  if (res.status >= 400) {
    throw new Error(
      `ElevenLabs voices ${res.status}: ${res.bodyText.slice(0, 300)}`
    );
  }

  let json: { voices?: SharedVoiceRaw[] };
  try {
    json = JSON.parse(res.bodyText);
  } catch {
    throw new Error(
      `ElevenLabs voices: invalid JSON: ${res.bodyText.slice(0, 200)}`
    );
  }

  const voices = json.voices ?? [];
  return voices.map<VoiceResult>((v) => ({
    voice_id: v.voice_id,
    name: v.name ?? '',
    description: v.description ?? '',
    preview_url: v.preview_url ?? null,
    gender: v.gender ?? null,
    age: v.age ?? null,
    accent: v.accent ?? null,
    language: v.language ?? null,
    descriptive: v.descriptive ?? null,
    use_case: v.use_case ?? null,
    date_unix: v.date_unix ?? 0,
    rate: v.rate ?? 1,
    live_moderation_enabled: v.live_moderation_enabled ?? false,
  }));
}

/**
 * Синтез речи через eleven_v3. Возвращает MP3 bytes в base64 data: URL.
 */
// Per-voice mutex. ElevenLabs автоматически добавляет голос в библиотеку
// аккаунта при первом синтезе, и если шлём 2+ параллельных запроса с одним
// voice_id — кидает 409 "already_running". Сериализуем по voice_id.
const voiceLocks = new Map<string, Promise<unknown>>();

async function withVoiceLock<T>(voiceId: string, fn: () => Promise<T>): Promise<T> {
  const prev = voiceLocks.get(voiceId) ?? Promise.resolve();
  // .then(fn, fn) — выполняем fn независимо от того, прошла предыдущая или упала
  const next = prev.then(fn, fn);
  voiceLocks.set(
    voiceId,
    next.finally(() => {
      if (voiceLocks.get(voiceId) === next) voiceLocks.delete(voiceId);
    })
  );
  return next;
}

async function doSynth(voiceId: string, text: string): Promise<string> {
  const res = await httpRequest(
    `${BASE}/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
      timeoutMs: 60_000,
    }
  );

  if (res.status === 302) {
    throw new Error(
      'ElevenLabs blocked your region (302). Включи VPN/прокси на сервере.'
    );
  }
  if (res.status >= 400) {
    const err = new Error(
      `ElevenLabs synth ${res.status}: ${res.bodyText.slice(0, 300)}`
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const mime =
    (typeof res.headers['content-type'] === 'string'
      ? res.headers['content-type']
      : (res.headers['content-type'] as string[] | undefined)?.[0]) ??
    'audio/mpeg';
  return `data:${mime};base64,${res.bodyBytes.toString('base64')}`;
}

export async function synthesizeSpeech(
  voiceId: string,
  text: string
): Promise<string> {
  if (!KEY) throw new Error('ELEVENLABS_API_KEY is empty');

  return withVoiceLock(voiceId, async () => {
    // 1 retry на 409 "already_running" (на случай если внешняя гонка
    // прошла мимо нашего мьютекса — например, второй инстанс бэка)
    try {
      return await doSynth(voiceId, text);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        await new Promise((r) => setTimeout(r, 1500));
        return doSynth(voiceId, text);
      }
      throw e;
    }
  });
}
