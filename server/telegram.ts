// Тонкая обёртка над Bot API + long polling getUpdates.

const BOT_TOKEN = process.env.TG_BOT_TOKEN ?? '';
const API_BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  date: number;
  text?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

export interface BotInfo {
  id: number;
  username: string;
  first_name: string;
}

let botInfo: BotInfo | null = null;

async function tg<T = unknown>(
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  if (!API_BASE) throw new Error('TG_BOT_TOKEN is empty');
  const res = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const text = await res.text();
  let json: { ok: boolean; result?: T; description?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`TG ${method}: invalid JSON: ${text.slice(0, 200)}`);
  }
  if (!json.ok) {
    throw new Error(`TG ${method} failed: ${json.description ?? text.slice(0, 200)}`);
  }
  return json.result as T;
}

export async function fetchBotInfo(): Promise<BotInfo | null> {
  if (!API_BASE) {
    console.warn('[tg] TG_BOT_TOKEN empty — bot disabled');
    return null;
  }
  try {
    botInfo = await tg<BotInfo>('getMe');
    console.log(`[tg] bot ready: @${botInfo.username} (id ${botInfo.id})`);
    return botInfo;
  } catch (e) {
    console.error('[tg] getMe failed:', e);
    return null;
  }
}

export function getBotInfo(): BotInfo | null {
  return botInfo;
}

export async function sendMessage(
  chatId: number,
  text: string,
  parseMode?: 'HTML' | 'MarkdownV2'
): Promise<void> {
  await tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

// ─── long polling ───────────────────────────────────────────────────────

let pollOffset = 0;
let polling = false;

export function startPolling(onUpdate: (u: TgUpdate) => Promise<void> | void): void {
  if (polling || !API_BASE) return;
  polling = true;
  void (async () => {
    try {
      // если бот был на webhook, getUpdates вернёт 409 — снимаем
      await tg('deleteWebhook', { drop_pending_updates: false }).catch(() => {});
    } catch {
      /* noop */
    }
    while (polling) {
      try {
        const updates = await tg<TgUpdate[]>('getUpdates', {
          offset: pollOffset,
          timeout: 30,
          allowed_updates: ['message'],
        });
        for (const u of updates) {
          pollOffset = u.update_id + 1;
          try {
            await onUpdate(u);
          } catch (e) {
            console.error('[tg] onUpdate failed:', e);
          }
        }
      } catch (e) {
        console.error('[tg] poll error:', e);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();
}

export function stopPolling() {
  polling = false;
}
