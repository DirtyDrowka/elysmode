// Тонкая обёртка вокруг fetch для общения с нашим бэкендом. Прокидывает
// JWT из useAuth.

const TOKEN_KEY = 'elysmode_token';

// На проде фронт и бэк на разных доменах (bidons.elys.mom / molochko.elys.mom).
// VITE_API_BASE_URL подставляется при build (см. Dockerfile.frontend).
// На dev'е пусто — fetch идёт относительно текущего origin → Vite proxy → backend.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null) {
  if (typeof localStorage === 'undefined') return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Если true — НЕ кидаем ошибку на 401, возвращаем null. */
  optionalAuth?: boolean;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

export async function api<T = unknown>(
  path: string,
  opts: ApiOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Если API_BASE пуст — fetch по относительному пути (dev/single-domain).
  const url = API_BASE && path.startsWith('/') ? `${API_BASE}${path}` : path;
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && opts.optionalAuth) return null as T;
    throw new ApiError(res.status, body);
  }
  return body as T;
}
