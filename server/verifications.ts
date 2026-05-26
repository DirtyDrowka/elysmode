// In-memory pending для bot-confirm flow. Перезапуск сервера сбрасывает —
// юзер просто инициирует новую сессию.

import { randomUUID } from 'node:crypto';

const TTL_MS = 10 * 60 * 1000; // 10 минут

export type VerificationStatus = 'awaiting_bot' | 'verified' | 'consumed';

export interface Pending {
  sessionId: string;
  /** Username который ввёл юзер в приложении (для UI и валидации) */
  requestedUsername: string;
  /** Юзер который реально нажал /start с этим sessionId */
  telegramId?: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  status: VerificationStatus;
  expiresAt: number;
}

const PENDING = new Map<string, Pending>();

export function generateSessionId(): string {
  return randomUUID();
}

export function createPending(requestedUsername: string): Pending {
  const sessionId = generateSessionId();
  const p: Pending = {
    sessionId,
    requestedUsername,
    status: 'awaiting_bot',
    expiresAt: Date.now() + TTL_MS,
  };
  PENDING.set(sessionId, p);
  return p;
}

export function getPending(sessionId: string): Pending | null {
  const p = PENDING.get(sessionId);
  if (!p) return null;
  if (p.expiresAt < Date.now()) {
    PENDING.delete(sessionId);
    return null;
  }
  return p;
}

export interface BotConfirmationResult {
  ok: boolean;
  reason?: 'expired' | 'already_used' | 'wrong_user';
  pending?: Pending;
}

/** Вызывается из bot polling'а при получении /start <sessionId>.
 *  Сразу помечает сессию как verified (без кода) — фронт следующий polling
 *  получит токен и залогинится. */
export function confirmFromBot(
  sessionId: string,
  from: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }
): BotConfirmationResult {
  const p = PENDING.get(sessionId);
  if (!p) return { ok: false, reason: 'expired' };
  if (p.expiresAt < Date.now()) {
    PENDING.delete(sessionId);
    return { ok: false, reason: 'expired' };
  }
  if (p.status === 'consumed') {
    return { ok: false, reason: 'already_used' };
  }

  // Если username был задан и у tg-юзера он тоже есть — проверяем совпадение.
  if (from.username && p.requestedUsername) {
    if (from.username.toLowerCase() !== p.requestedUsername.toLowerCase()) {
      return { ok: false, reason: 'wrong_user', pending: p };
    }
  }

  p.telegramId = from.id;
  p.telegramUsername = from.username;
  p.telegramFirstName = from.first_name;
  p.telegramLastName = from.last_name;
  p.status = 'verified';
  return { ok: true, pending: p };
}

/** Забирает verified сессию (одноразово, помечает consumed).
 *  Возвращает данные или null если не verified / просрочена. */
export function consumeVerified(sessionId: string): Pending | null {
  const p = PENDING.get(sessionId);
  if (!p) return null;
  if (p.expiresAt < Date.now()) {
    PENDING.delete(sessionId);
    return null;
  }
  if (p.status !== 'verified') return null;
  p.status = 'consumed';
  PENDING.delete(sessionId);
  return p;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of PENDING.entries()) {
    if (v.expiresAt < now) PENDING.delete(k);
  }
}, 60_000).unref?.();
