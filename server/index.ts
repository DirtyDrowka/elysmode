// Force IPv4 first: undici (Node fetch) пытается одновременно v4 и v6,
// и если v6 «висит» — весь запрос фейлит timeout. Telegram api.telegram.org
// и ElevenLabs api.elevenlabs.io как раз так страдают.
import { setDefaultResultOrder } from 'node:dns';
setDefaultResultOrder('ipv4first');

// VPN/Kakadu иногда моргает и любой outgoing fetch внезапно кидает ECONNRESET.
// Если эта promise rejection где-то не была обёрнута в try — Node по
// дефолту валит процесс (unhandledRejection → uncaught → exit). Просто
// логируем и продолжаем — клиент сам ретайнет.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException:', err);
});

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import type { Context, Next } from 'hono';

import { sql } from './db.ts';
import {
  isDevAuthEnabled,
  signSession,
  verifySession,
  verifyTelegramAuth,
  type JwtPayload,
  type TelegramAuthPayload,
} from './auth.ts';
import {
  fetchBotInfo,
  getBotInfo,
  sendMessage,
  startPolling,
} from './telegram.ts';
import {
  confirmFromBot,
  consumeVerified,
  createPending,
  getPending,
} from './verifications.ts';
import {
  searchVoices,
  synthesizeSpeech,
  type VoiceSearchFilters,
} from './elevenlabs.ts';
import { selectVoiceForCharacter } from './voiceAgent.ts';
import {
  generateCharacterPortrait,
  generateBackgroundImage,
} from './recraftOpenrouter.ts';

const PORT = Number(process.env.PORT ?? 3001);

const app = new Hono();

// CORS: на проде фронт и бэк на разных доменах (bidons.elys.mom / molochko.elys.mom).
// CORS_ORIGIN — список через запятую, или "*" для всех. По дефолту — для dev — "*".
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      if (CORS_ORIGINS.includes('*')) return '*';
      if (origin && CORS_ORIGINS.includes(origin)) return origin;
      return CORS_ORIGINS[0] ?? '*';
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

// ─── auth middleware ────────────────────────────────────────────────────
async function requireAuth(c: Context, next: Next) {
  const h = c.req.header('authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return c.json({ error: 'no token' }, 401);
  const payload = verifySession(token);
  if (!payload) return c.json({ error: 'invalid token' }, 401);
  c.set('user', payload);
  await next();
}

// ─── helpers ────────────────────────────────────────────────────────────
async function upsertUser(u: {
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}) {
  await sql`
    INSERT INTO users (telegram_id, username, first_name, last_name, photo_url)
    VALUES (${u.telegram_id}, ${u.username ?? null}, ${u.first_name ?? null},
            ${u.last_name ?? null}, ${u.photo_url ?? null})
    ON CONFLICT (telegram_id) DO UPDATE SET
      username   = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name  = EXCLUDED.last_name,
      photo_url  = EXCLUDED.photo_url,
      updated_at = NOW()
  `;
}

// ─── routes ─────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ ok: true }));

/** DEV-only: моментальный логин фейковым юзером. Активен только если
 *  в env стоит ALLOW_DEV_AUTH=1 (на проде не задаётся). Используется для
 *  локального тестирования фич, не требующих реального Telegram. */
app.post('/api/auth/dev', async (c) => {
  if (!isDevAuthEnabled()) return c.json({ error: 'disabled' }, 404);
  const DEV_USER = {
    telegram_id: 99999001,
    username: 'dev_user',
    first_name: 'Dev',
    last_name: 'User',
  };
  await upsertUser(DEV_USER);
  const token = signSession({
    telegram_id: DEV_USER.telegram_id,
    username: DEV_USER.username,
  });
  return c.json({
    token,
    user: { ...DEV_USER, photo_url: null },
  });
});

/** Инфо о боте — frontend строит ссылку из username'а. */
app.get('/api/auth/bot', async (c) => {
  let bot = getBotInfo();
  if (!bot) {
    await ensureBotReady();
    bot = getBotInfo();
  }
  if (!bot) return c.json({ available: false }, 503);
  return c.json({ available: true, username: bot.username, first_name: bot.first_name });
});

/** Инициировать вход через бота. Возвращает sessionId + ссылку на бота. */
app.post('/api/auth/init', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { username?: string };
  const username = (body.username ?? '').trim().replace(/^@/, '');
  if (!username) return c.json({ error: 'username required' }, 400);
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    return c.json({ error: 'invalid username format' }, 400);
  }
  let bot = getBotInfo();
  if (!bot) {
    await ensureBotReady();
    bot = getBotInfo();
  }
  if (!bot) return c.json({ error: 'bot not ready' }, 503);
  const p = createPending(username);
  return c.json({
    sessionId: p.sessionId,
    botLink: `https://t.me/${bot.username}?start=${p.sessionId}`,
    botUsername: bot.username,
  });
});

/** Polling статуса pending-сессии. На 'verified' (юзер нажал /start в боте)
 *  СРАЗУ создаём user в БД, подписываем JWT и возвращаем {token, user} —
 *  фронт залогинится без ввода кода. */
app.get('/api/auth/status/:sessionId', async (c) => {
  const id = c.req.param('sessionId');
  const p = getPending(id);
  if (!p) return c.json({ status: 'expired' }, 404);
  if (p.status === 'awaiting_bot') return c.json({ status: 'awaiting_bot' });

  if (p.status === 'verified') {
    const consumed = consumeVerified(id);
    if (!consumed || !consumed.telegramId) {
      return c.json({ status: 'expired' }, 404);
    }
    await upsertUser({
      telegram_id: consumed.telegramId,
      username: consumed.telegramUsername,
      first_name: consumed.telegramFirstName,
      last_name: consumed.telegramLastName,
    });
    const token = signSession({
      telegram_id: consumed.telegramId,
      username: consumed.telegramUsername,
    });
    return c.json({
      status: 'consumed',
      token,
      user: {
        telegram_id: consumed.telegramId,
        username: consumed.telegramUsername,
        first_name: consumed.telegramFirstName,
        last_name: consumed.telegramLastName,
      },
    });
  }

  // consumed (уже забрали в предыдущем poll)
  return c.json({ status: 'consumed' });
});

/** Авторизация через Telegram Login Widget. */
app.post('/api/auth/telegram', async (c) => {
  const body = (await c.req.json()) as TelegramAuthPayload;
  if (!body?.id || !body?.hash || !body?.auth_date) {
    return c.json({ error: 'bad payload' }, 400);
  }
  if (!verifyTelegramAuth(body)) {
    return c.json({ error: 'invalid telegram signature' }, 401);
  }
  await upsertUser({
    telegram_id: body.id,
    username: body.username,
    first_name: body.first_name,
    last_name: body.last_name,
    photo_url: body.photo_url,
  });
  const token = signSession({ telegram_id: body.id, username: body.username });
  return c.json({
    token,
    user: {
      telegram_id: body.id,
      username: body.username,
      first_name: body.first_name,
      last_name: body.last_name,
      photo_url: body.photo_url,
    },
  });
});

/** Текущий пользователь по сессии. */
app.get('/api/me', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  const [row] = await sql<
    Array<{
      telegram_id: bigint;
      username: string | null;
      first_name: string | null;
      last_name: string | null;
      photo_url: string | null;
    }>
  >`
    SELECT telegram_id, username, first_name, last_name, photo_url
    FROM users WHERE telegram_id = ${u.telegram_id}
  `;
  if (!row) return c.json({ error: 'user gone' }, 404);
  return c.json({
    user: {
      telegram_id: Number(row.telegram_id),
      username: row.username,
      first_name: row.first_name,
      last_name: row.last_name,
      photo_url: row.photo_url,
    },
  });
});

/** Получить сохранённый диалог + всех персонажей пользователя одним запросом. */
app.get('/api/dialog', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  const [row] = await sql<
    Array<{ state: Record<string, unknown>; updated_at: Date }>
  >`
    SELECT state, updated_at FROM dialogs
    WHERE owner_telegram_id = ${u.telegram_id}
  `;
  const characters = await sql<
    Array<{
      id: string;
      name: string;
      color: string;
      personality: string;
      appearance: string;
      image_url: string | null;
      voice_id: string | null;
    }>
  >`
    SELECT id, name, color, personality, appearance, image_url, voice_id
    FROM characters
    WHERE owner_telegram_id = ${u.telegram_id}
  `;
  return c.json({
    state: row?.state ?? null,
    updated_at: row?.updated_at ?? null,
    characters,
  });
});

/** Сохранить (UPSERT) диалог. */
app.put('/api/dialog', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  const body = (await c.req.json()) as { state?: Record<string, unknown> };
  if (!body?.state || typeof body.state !== 'object') {
    return c.json({ error: 'state required' }, 400);
  }
  await sql`
    INSERT INTO dialogs (owner_telegram_id, state, updated_at)
    VALUES (${u.telegram_id}, ${sql.json(body.state)}, NOW())
    ON CONFLICT (owner_telegram_id) DO UPDATE SET
      state = EXCLUDED.state,
      updated_at = NOW()
  `;
  return c.json({ ok: true });
});

/** Сбросить диалог (например для "начать заново"). */
app.delete('/api/dialog', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  await sql`DELETE FROM dialogs WHERE owner_telegram_id = ${u.telegram_id}`;
  return c.json({ ok: true });
});

// ─── library (глобальная коллекция персонажей и локаций) ───────────────
//
// Library — это заранее засиженный набор, который модель не может расширять,
// только ВЫБИРАТЬ. Эндпоинт публичный (без auth) — данные не приватные.

app.get('/api/library', async (c) => {
  const characters = await sql<
    Array<{
      id: string;
      name: string;
      age: number | null;
      role: string | null;
      color: string;
      personality: string;
      appearance: string;
      image_url: string | null;
      voice_id: string | null;
    }>
  >`
    SELECT id, name, age, role, color, personality, appearance, image_url, voice_id
    FROM library_characters
    ORDER BY name
  `;
  const locations = await sql<
    Array<{
      id: string;
      name: string;
      description: string;
      image_url: string | null;
    }>
  >`
    SELECT id, name, description, image_url
    FROM library_locations
    ORDER BY name
  `;
  return c.json({ characters, locations });
});

// ─── voice (ElevenLabs) ─────────────────────────────────────────────────

/** Поиск голосов в shared library ElevenLabs по фильтрам. */
app.post('/api/voice/search', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as VoiceSearchFilters;
  try {
    const voices = await searchVoices(body);
    return c.json({ voices });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error('[api] voice search failed:', msg);
    return c.json({ error: msg }, 500);
  }
});

/** Синтез реплики персонажа через eleven_v3. Бэкенд сам ищет voice_id
 *  по character_id из per-user characters. Возвращает data: URL audio/mpeg. */
app.post('/api/voice/synth', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  const body = (await c.req.json().catch(() => ({}))) as {
    character_id?: string;
    text?: string;
  };
  if (!body.character_id || !body.text) {
    return c.json({ error: 'character_id+text required' }, 400);
  }
  const [row] = await sql<Array<{ voice_id: string | null }>>`
    SELECT voice_id FROM characters
    WHERE owner_telegram_id = ${u.telegram_id} AND id = ${body.character_id}
  `;
  if (!row?.voice_id) {
    return c.json({ error: 'character has no voice_id yet' }, 404);
  }
  try {
    const audio_url = await synthesizeSpeech(row.voice_id, body.text);
    return c.json({ audio_url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error('[api] voice synth failed:', msg);
    return c.json({ error: msg }, 500);
  }
});

// ─── characters (per-user collection) ──────────────────────────────────

/** Список всех synthetic-персонажей пользователя.
 *  User-профиль НЕ возвращается этим эндпоинтом — он отдельно через /api/profile,
 *  иначе движок новеллы может запутаться и подцепить его как обычного NPC. */
app.get('/api/characters', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  const rows = await sql<
    Array<{
      id: string;
      name: string;
      color: string;
      personality: string;
      appearance: string;
      gender: string | null;
      image_url: string | null;
      voice_id: string | null;
      character_type: 'synthetic' | 'user';
    }>
  >`
    SELECT id, name, color, personality, appearance, gender, image_url, voice_id, character_type
    FROM characters
    WHERE owner_telegram_id = ${u.telegram_id}
      AND character_type = 'synthetic'
    ORDER BY created_at
  `;
  return c.json({ characters: rows });
});

/** UPSERT синтетического персонажа. Вызывается фронтом при create_character
 *  блоке во время прохождения новеллы. Если у персонажа ещё нет voice_id —
 *  синхронно запускает voice-agent для подбора голоса. */
app.post('/api/characters', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  const body = (await c.req.json()) as {
    id?: string;
    name?: string;
    color?: string;
    personality?: string;
    appearance?: string;
    gender?: string | null;
    image_url?: string | null;
    voice_id?: string | null;
  };
  if (!body.id || !body.name) return c.json({ error: 'id+name required' }, 400);
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(body.id)) {
    return c.json({ error: 'invalid id format' }, 400);
  }

  const [existing] = await sql<Array<{ voice_id: string | null }>>`
    SELECT voice_id FROM characters
    WHERE owner_telegram_id = ${u.telegram_id}
      AND id = ${body.id}
      AND character_type = 'synthetic'
  `;

  let voiceId: string | null = body.voice_id ?? existing?.voice_id ?? null;
  if (!voiceId) {
    try {
      voiceId = await selectVoiceForCharacter({
        id: body.id,
        name: body.name,
        personality: body.personality ?? '',
        appearance: body.appearance ?? '',
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[api] voice agent failed:', e);
    }
  }

  await sql`
    INSERT INTO characters
      (owner_telegram_id, id, name, color, personality, appearance,
       gender, image_url, voice_id, character_type, updated_at)
    VALUES (
      ${u.telegram_id},
      ${body.id},
      ${body.name},
      ${body.color ?? '#d4ff00'},
      ${body.personality ?? ''},
      ${body.appearance ?? ''},
      ${body.gender ?? null},
      ${body.image_url ?? null},
      ${voiceId},
      'synthetic',
      NOW()
    )
    ON CONFLICT (owner_telegram_id, id) DO UPDATE SET
      name        = EXCLUDED.name,
      color       = EXCLUDED.color,
      personality = EXCLUDED.personality,
      appearance  = EXCLUDED.appearance,
      gender      = COALESCE(EXCLUDED.gender, characters.gender),
      image_url   = COALESCE(EXCLUDED.image_url, characters.image_url),
      voice_id    = COALESCE(EXCLUDED.voice_id, characters.voice_id),
      updated_at  = NOW()
  `;

  return c.json({
    character: {
      id: body.id,
      name: body.name,
      color: body.color ?? '#d4ff00',
      personality: body.personality ?? '',
      appearance: body.appearance ?? '',
      gender: body.gender ?? null,
      image_url: body.image_url ?? null,
      voice_id: voiceId,
      character_type: 'synthetic',
    },
  });
});

// ─── user profile (свой персонаж игрока) ─────────────────────────────────
// Profile — отдельная сущность с фиксированным id='self', хранится в той же
// таблице characters с character_type='user'. Один профиль на пользователя
// (уникальность поддерживается partial unique index'ом).

const PROFILE_ID = 'self';

interface ProfileRow {
  id: string;
  name: string;
  color: string;
  personality: string;
  appearance: string;
  gender: string | null;
  image_url: string | null;
  voice_id: string | null;
  character_type: 'user';
}

/** Получить профиль текущего пользователя или null если ещё не создан. */
app.get('/api/profile', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  const [row] = await sql<Array<ProfileRow>>`
    SELECT id, name, color, personality, appearance,
           gender, image_url, voice_id, character_type
    FROM characters
    WHERE owner_telegram_id = ${u.telegram_id}
      AND character_type = 'user'
    LIMIT 1
  `;
  return c.json({ profile: row ?? null });
});

/** UPSERT профиля. Если frontend передал voice_id — используем как есть
 *  (юзер выбрал голос вручную). Если voice_id не передан и его ещё нет —
 *  fallback'ом запускаем voiceAgent. */
app.post('/api/profile', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  const body = (await c.req.json()) as {
    name?: string;
    color?: string;
    personality?: string;
    appearance?: string;
    gender?: string | null;
    voice_id?: string | null;
    image_url?: string | null;
  };
  if (!body.name) return c.json({ error: 'name required' }, 400);

  const [existing] = await sql<
    Array<{ voice_id: string | null; appearance: string | null }>
  >`
    SELECT voice_id, appearance FROM characters
    WHERE owner_telegram_id = ${u.telegram_id}
      AND character_type = 'user'
  `;

  // Приоритет: явный body.voice_id → существующий → voiceAgent fallback
  let voiceId: string | null =
    body.voice_id ?? existing?.voice_id ?? null;
  if (!voiceId) {
    try {
      voiceId = await selectVoiceForCharacter({
        id: PROFILE_ID,
        name: body.name,
        personality: body.personality ?? '',
        appearance: body.appearance ?? '',
      });
    } catch (e) {
      console.error('[api] profile voice agent failed:', e);
    }
  }

  await sql`
    INSERT INTO characters
      (owner_telegram_id, id, name, color, personality, appearance,
       gender, image_url, voice_id, character_type, updated_at)
    VALUES (
      ${u.telegram_id},
      ${PROFILE_ID},
      ${body.name},
      ${body.color ?? '#d4ff00'},
      ${body.personality ?? ''},
      ${body.appearance ?? ''},
      ${body.gender ?? null},
      ${body.image_url ?? null},
      ${voiceId},
      'user',
      NOW()
    )
    ON CONFLICT (owner_telegram_id, id) DO UPDATE SET
      name        = EXCLUDED.name,
      color       = EXCLUDED.color,
      personality = EXCLUDED.personality,
      appearance  = EXCLUDED.appearance,
      gender      = EXCLUDED.gender,
      image_url   = EXCLUDED.image_url,
      voice_id    = COALESCE(EXCLUDED.voice_id, characters.voice_id),
      updated_at  = NOW()
  `;

  return c.json({
    profile: {
      id: PROFILE_ID,
      name: body.name,
      color: body.color ?? '#d4ff00',
      personality: body.personality ?? '',
      appearance: body.appearance ?? '',
      gender: body.gender ?? null,
      image_url: body.image_url ?? null,
      voice_id: voiceId,
      character_type: 'user',
    },
  });
});

/** Обновить ТОЛЬКО image_url профиля — для async-генерации портрета. */
app.put('/api/profile/image', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  const body = (await c.req.json()) as { image_url?: string };
  if (!body.image_url) return c.json({ error: 'image_url required' }, 400);
  const result = await sql`
    UPDATE characters
    SET image_url = ${body.image_url}, updated_at = NOW()
    WHERE owner_telegram_id = ${u.telegram_id}
      AND character_type = 'user'
  `;
  if (result.count === 0) return c.json({ error: 'profile not found' }, 404);
  return c.json({ ok: true });
});

/** Обновить ТОЛЬКО image_url — для асинхронной догенерации портрета. */
app.put('/api/characters/:id/image', requireAuth, async (c) => {
  const u = c.get('user') as JwtPayload;
  const id = c.req.param('id');
  const body = (await c.req.json()) as { image_url?: string };
  if (!body.image_url) return c.json({ error: 'image_url required' }, 400);
  const result = await sql`
    UPDATE characters
    SET image_url = ${body.image_url}, updated_at = NOW()
    WHERE owner_telegram_id = ${u.telegram_id} AND id = ${id}
  `;
  if (result.count === 0) return c.json({ error: 'character not found' }, 404);
  return c.json({ ok: true });
});

/** Генерация портрета персонажа через Recraft на OpenRouter.
 *  Возвращает image_url (data: URL или https). */
app.post('/api/generate/character', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { appearance?: string };
  if (!body.appearance || typeof body.appearance !== 'string') {
    return c.json({ error: 'appearance required' }, 400);
  }
  try {
    const url = await generateCharacterPortrait(body.appearance);
    return c.json({ image_url: url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error('[api] character gen failed:', msg);
    return c.json({ error: msg }, 500);
  }
});

/** Генерация фоновой локации через тот же Recraft. */
app.post('/api/generate/background', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { description?: string };
  if (!body.description || typeof body.description !== 'string') {
    return c.json({ error: 'description required' }, 400);
  }
  try {
    const url = await generateBackgroundImage(body.description);
    return c.json({ image_url: url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error('[api] bg gen failed:', msg);
    return c.json({ error: msg }, 500);
  }
});

// ─── bot ────────────────────────────────────────────────────────────────
let bootInflight: Promise<void> | null = null;

/** Ленивая инициализация бота — можно вызывать сколько угодно раз. Если
 *  getMe упал из-за моргнувшего VPN — следующий вызов попробует ещё. */
async function ensureBotReady(): Promise<void> {
  if (getBotInfo()) return;
  if (bootInflight) return bootInflight;
  bootInflight = bootBot().finally(() => {
    bootInflight = null;
  });
  return bootInflight;
}

async function bootBot() {
  const info = await fetchBotInfo();
  if (!info) {
    console.warn('[bot] disabled — no token or getMe failed');
    return;
  }
  startPolling(async (u) => {
    const msg = u.message;
    if (!msg?.text || !msg.from) return;
    if (!msg.text.startsWith('/start')) return;

    const parts = msg.text.split(/\s+/);
    const payload = parts[1] ?? '';

    // /start без payload — приветствие
    if (!payload) {
      await sendMessage(
        msg.chat.id,
        'Привет! Чтобы войти в elys mode — открой персональную ссылку из приложения. Если ссылки нет — введи свой username в форме входа и тебе выдадут ссылку и код.'
      );
      return;
    }

    const result = confirmFromBot(payload, {
      id: msg.from.id,
      username: msg.from.username,
      first_name: msg.from.first_name,
      last_name: msg.from.last_name,
    });

    if (!result.ok) {
      if (result.reason === 'expired') {
        await sendMessage(
          msg.chat.id,
          'Ссылка устарела. Попроси новую в приложении.'
        );
      } else if (result.reason === 'already_used') {
        await sendMessage(msg.chat.id, 'Эта ссылка уже использована.');
      } else if (result.reason === 'wrong_user') {
        await sendMessage(
          msg.chat.id,
          `Эта ссылка предназначена для @${result.pending?.requestedUsername}, а ты — @${msg.from.username ?? '???'}. Зайди в приложение под своим username и используй СВОЮ ссылку.`
        );
      }
      return;
    }

    await sendMessage(
      msg.chat.id,
      `✓ Вход в elys mode подтверждён. Возвращайся в приложение — оно само залогинит тебя.`
    );
  });
}

void bootBot();

// ─── start ──────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`[server] listening on http://0.0.0.0:${info.port}`);
});
