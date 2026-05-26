-- Глобальная коллекция персонажей пользователя. История ссылается на них
-- по id (composite PK: owner_telegram_id + id-slug от модели).

CREATE TABLE IF NOT EXISTS characters (
  owner_telegram_id  BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  id                 TEXT NOT NULL,
  name               TEXT NOT NULL,
  color              TEXT NOT NULL DEFAULT '#d4ff00',
  personality        TEXT NOT NULL DEFAULT '',
  appearance         TEXT NOT NULL DEFAULT '',
  image_url          TEXT,  -- может быть NULL пока генерится
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_telegram_id, id)
);

CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(owner_telegram_id);
