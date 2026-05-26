-- Глобальная библиотека персонажей и локаций.
-- В отличие от characters / dialogs (per-user), эти таблицы общие — модель
-- ВЫБИРАЕТ из них персонажа/локацию по id, а не создаёт.
-- Картинки лежат в public/ как статика, в image_url храним относительный путь
-- (/sprites/alina.png, /locations/office.png).

CREATE TABLE IF NOT EXISTS library_characters (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  age          INTEGER,
  role         TEXT,                -- кто по жизни: "секретарша", "одноклассница"
  color        TEXT NOT NULL DEFAULT '#d4ff00',
  personality  TEXT NOT NULL DEFAULT '',
  appearance   TEXT NOT NULL DEFAULT '',
  image_url    TEXT,                -- /sprites/<id>.png
  voice_id     TEXT,                -- ElevenLabs voice (подбирается voice-agent'ом при сидинге)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS library_locations (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  image_url    TEXT,                -- /locations/<id>.png; NULL пока не сгенерили
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
