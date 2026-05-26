-- Пользователи. PK — telegram_id. Регистрация при первой авторизации.
CREATE TABLE IF NOT EXISTS users (
  telegram_id   BIGINT PRIMARY KEY,
  username      TEXT,
  first_name    TEXT,
  last_name     TEXT,
  photo_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Диалог = текущая визуальная новелла пользователя. Один на юзера (MVP).
-- В state кладём сериализованное состояние engine: chain, history,
-- locations, currentIdx и т.д.
CREATE TABLE IF NOT EXISTS dialogs (
  owner_telegram_id  BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  state              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
