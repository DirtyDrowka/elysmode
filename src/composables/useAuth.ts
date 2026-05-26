// Глобальный auth-state: текущий юзер + токен. Один инстанс на всё приложение.

import { ref, computed } from 'vue';
import { api, getToken, setToken } from '../services/api';

export interface User {
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
}

const user = ref<User | null>(null);
const ready = ref(false); // first me-check выполнен
const inflight = ref(false);

interface AuthResponse {
  token: string;
  user: User;
}

interface MeResponse {
  user: User;
}

async function fetchMe() {
  if (!getToken()) {
    user.value = null;
    ready.value = true;
    return;
  }
  inflight.value = true;
  try {
    const r = await api<MeResponse | null>('/api/me', { optionalAuth: true });
    if (r && r.user) user.value = r.user;
    else {
      // токен инвалидный — снести
      setToken(null);
      user.value = null;
    }
  } catch {
    setToken(null);
    user.value = null;
  } finally {
    inflight.value = false;
    ready.value = true;
  }
}

interface BotInitResponse {
  sessionId: string;
  botLink: string;
  botUsername: string;
}

async function initBotLogin(username: string): Promise<BotInitResponse> {
  inflight.value = true;
  try {
    return await api<BotInitResponse>('/api/auth/init', {
      method: 'POST',
      body: { username },
    });
  } finally {
    inflight.value = false;
  }
}

async function pollBotStatus(
  sessionId: string
): Promise<'awaiting_bot' | 'consumed' | 'expired'> {
  try {
    const r = await api<
      { status: string; token?: string; user?: User } | null
    >(`/api/auth/status/${sessionId}`, { optionalAuth: true });
    if (!r) return 'expired';
    // verified — бэк сразу отдал токен и user, авторизуемся
    if (r.status === 'consumed' && r.token && r.user) {
      setToken(r.token);
      user.value = r.user;
      return 'consumed';
    }
    if (r.status === 'consumed') return 'consumed';
    if (r.status === 'awaiting_bot') return 'awaiting_bot';
    return 'expired';
  } catch {
    return 'expired';
  }
}

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

async function loginTelegram(payload: TelegramAuthData) {
  inflight.value = true;
  try {
    const r = await api<AuthResponse>('/api/auth/telegram', {
      method: 'POST',
      body: payload,
    });
    setToken(r.token);
    user.value = r.user;
  } finally {
    inflight.value = false;
  }
}

function logout() {
  setToken(null);
  user.value = null;
}

let initialized = false;
function ensureInit() {
  if (initialized) return;
  initialized = true;
  void fetchMe();
}

export function useAuth() {
  ensureInit();
  return {
    user: computed(() => user.value),
    isAuthenticated: computed(() => user.value !== null),
    ready: computed(() => ready.value),
    inflight: computed(() => inflight.value),
    loginTelegram,
    initBotLogin,
    pollBotStatus,
    logout,
    refetch: fetchMe,
  };
}
