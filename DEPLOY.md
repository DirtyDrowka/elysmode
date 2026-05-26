# elys mode — деплой

Стек:
- **Frontend** — Vue 3 + Vite, билдится в nginx-образ (порт 5173 внутри контейнера)
- **Backend** — Hono + tsx (Node 22), порт 3000
- **DB** — PostgreSQL 16
- **Cloudflare Tunnel** — наружу через `cloudflared`, без открытия портов

Роутинг (настраивается в CF Dashboard на стороне tunnel'a):
- `bidons.elys.mom` → `frontend:5173`
- `molochko.elys.mom` → `backend:3000`

---

## 1. GitHub repo + GHCR

1. Создать репозиторий на GitHub (private или public, без разницы).
2. Запушить туда этот код.
3. В Settings → Secrets and variables → Actions:
   - **Secrets**:
     - `VITE_OPENROUTER_KEY` — ключ OpenRouter (зашьётся в bundle фронта при build)
   - **Variables**:
     - `VITE_OPENROUTER_MODEL` (опционально) — `x-ai/grok-4.3` или `deepseek/deepseek-v4-flash`
     - `VITE_API_BASE_URL` — `https://molochko.elys.mom`
4. Push в `main` запустит workflow `.github/workflows/build.yml`. Соберёт два образа в GHCR:
   - `ghcr.io/<owner>/elysmode-backend:latest`
   - `ghcr.io/<owner>/elysmode-frontend:latest`
5. Перейти на ghcr.io → packages → у каждого образа Settings → Change visibility → **Public** (или дать Dockploy серверу доступ pull'ить через token).

## 2. Cloudflare Tunnel

Тоннель уже создан на стороне CF (есть token). В CF Dashboard → Zero Trust → Networks → Tunnels → твой tunnel → **Public Hostname**:

| Subdomain | Domain | Service |
|---|---|---|
| `bidons` | `elys.mom` | `http://frontend:5173` |
| `molochko` | `elys.mom` | `http://backend:3000` |

Сервис указывается с **именем docker-сервиса** (не IP) — `cloudflared` контейнер в той же docker network резолвит их через docker DNS.

## 3. Dockploy

1. Открыть `http://5.75.254.123:3000/`.
2. New Project → **Compose**.
3. Compose Source: либо вставить `docker-compose.yml` руками, либо подключить GitHub repo (тогда Dockploy сам подтянет файл из репо).
4. **Environment variables** (Project → Environment):

```ini
# GHCR
GHCR_OWNER=<your-github-username>

# Postgres
POSTGRES_USER=elysmode
POSTGRES_PASSWORD=<длинный-рандомный-пароль>
POSTGRES_DB=elysmode

# JWT (сгенерить:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
JWT_SECRET=<32-байтовый-секрет>

# Telegram bot
TG_BOT_TOKEN=<от @BotFather>

# ElevenLabs
ELEVENLABS_API_KEY=sk_...

# OpenRouter (нужен и backend'у)
VITE_OPENROUTER_KEY=sk-or-v1-...
VITE_OPENROUTER_MODEL=x-ai/grok-4.3

# Cloudflare Tunnel
CF_TUNNEL_TOKEN=eyJhIjoiZTQ2MDg4Nzk5NTUwZjBiMzQ4ZDE3ZjA2YTZjNzhhN2IiLCJ0IjoiMmI5ZTEwNTQtYTkyMS00NzhmLWExYjktZTA4ODVlMzcwOTkzIiwicyI6Ik1HRmhOR0poWTJVdE0yUmlPQzAwTXpSakxUZzBPRE10TjJJNE5HSTJPR05qWVRaayJ9

# CORS — фронт-домен
FRONTEND_ORIGIN=https://bidons.elys.mom

# Proxy если сервер в РФ (ElevenLabs и OpenRouter гео-блокируют РФ)
# HTTPS_PROXY=http://user:pass@proxy.example.com:8080
# HTTP_PROXY=http://user:pass@proxy.example.com:8080
# NO_PROXY=postgres,localhost,127.0.0.1
```

5. Если GHCR-образы **private** — в Dockploy добавить **Registry credentials**:
   - registry: `ghcr.io`
   - username: твой GitHub username
   - password: PAT с правами `read:packages`

6. Deploy.

## 4. PostgreSQL — что развёрнуто

PostgreSQL поднимается **автоматически** в составе compose:
- Образ `postgres:16-alpine`
- Volume `postgres_data` хранит данные между перезапусками
- Backend ждёт `healthy` и подключается по DNS `postgres:5432`
- Миграции из `server/migrations/*.sql` накатываются автоматически при старте backend'а (см. `CMD` в `Dockerfile.backend` — там `npx tsx server/migrate.ts && npx tsx server/index.ts`). Миграции идемпотентны (`CREATE IF NOT EXISTS`).

Если нужно зайти руками:
```bash
# из хоста сервера
docker exec -it <postgres-container-name> psql -U elysmode -d elysmode
# или из контейнера backend:
docker exec -it <backend-container-name> sh
```

## 5. Особенности

### Гео-блок ElevenLabs и OpenRouter
Сервер `5.75.254.123` судя по подсети — Hetzner (Германия) → блокировки нет, должно работать без прокси.

Если сервер окажется в РФ — выставить `HTTPS_PROXY` / `HTTP_PROXY` через любой исходящий SOCKS5/HTTP прокси-клиент (V2Ray, Xray и т.п.).

### Telegram-бот
Работает через long-polling (не webhook). Сервер должен иметь исходящий доступ к `api.telegram.org` (в РФ — заблокировано, нужен прокси).

### Авто-обновления
Push в `main` → GHCR пересобрался → в Dockploy включить **«Auto Deploy»** (или нажать redeploy руками) — образы подтянутся и контейнеры рестартанут. Если включено auto-deploy через GitHub webhook — будет автоматически.

### Логи и диагностика
В Dockploy → Project → Containers → `backend` → Logs. Там видно:
- `[server] listening on http://0.0.0.0:3000` — бэк стартанул
- `[tg] bot ready: @<name>` — TG-бот подключился (если упало — нужен прокси)
- `[voice-agent] picked ...` — рабочие вызовы

### Что сделать после деплоя
1. Открыть `https://bidons.elys.mom` — должна загрузиться SPA
2. Ввести Telegram username → ссылка на бота → /start → авто-логин
3. На карточке «Новая история» → начать первую генерацию → должны появиться title, бэкграунд, персонажи и реплики с озвучкой

### Если что-то не работает
| Симптом | Что смотреть |
|---|---|
| `502/connection refused` на API | контейнер backend упал → логи. Скорее всего нет связи к OpenRouter/ElevenLabs |
| Пустые карточки персонажей | recraft через OpenRouter не ответил — гео-блок или кончился лимит на ключе |
| Звук не играет | iOS требует первый тап — это норма. Если и после тапа нет — voice synth упал, смотри `/api/voice/synth` |
| Бот не отвечает | `api.telegram.org` недоступен → нужен прокси |

---

## Локальный запуск (dev)

```bash
npm install
docker compose -f docker-compose.dev.yml up -d  # только postgres
npx tsx --env-file=.env server/migrate.ts
npm run dev  # vite + tsx watch одновременно
```

Открыть `http://localhost:5173/`.
