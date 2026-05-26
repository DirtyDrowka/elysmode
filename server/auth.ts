// Telegram Login Widget верификация + JWT сессии.
// https://core.telegram.org/widgets/login#checking-authorization

import { createHash, createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';

const BOT_TOKEN = process.env.TG_BOT_TOKEN ?? '';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const SESSION_TTL = '30d';
const AUTH_MAX_AGE_S = 60 * 60 * 24; // 24h — окно валидности auth_date

if (!BOT_TOKEN) {
  console.warn('[auth] TG_BOT_TOKEN empty — реальная Telegram-авторизация работать не будет');
}

export interface TelegramAuthPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface JwtPayload {
  telegram_id: number;
  username?: string;
}

/**
 * Проверяет hash из Telegram Login Widget.
 * Алгоритм: data_check_string = sorted(key=value) joined by \n (без hash);
 * secret_key = SHA256(bot_token); valid_hash = HMAC-SHA256(data_check, secret_key).
 */
export function verifyTelegramAuth(p: TelegramAuthPayload): boolean {
  if (!BOT_TOKEN) return false;

  const { hash, ...rest } = p;
  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = createHash('sha256').update(BOT_TOKEN).digest();
  const computed = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computed !== hash) return false;

  // auth_date свежий (защита от replay)
  const ageS = Math.floor(Date.now() / 1000) - p.auth_date;
  if (ageS > AUTH_MAX_AGE_S) return false;

  return true;
}

export function signSession(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TTL });
}

export function verifySession(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function isDevAuthEnabled(): boolean {
  return process.env.ALLOW_DEV_AUTH === '1';
}
