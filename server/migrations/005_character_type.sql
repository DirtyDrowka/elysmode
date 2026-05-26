-- character_type разделяет персонажей на два класса:
--   'synthetic' — созданные нейронкой в процессе генерации новеллы (default)
--   'user'      — профиль самого игрока, редактируется через вкладку Профиль
--
-- gender — отдельная колонка, заполняется при создании user-профиля и
-- учитывается voice-agent'ом при подборе голоса.
--
-- Решение про owner_telegram_id: формально оставляем NOT NULL, потому что
-- даже synthetic-персонажи физически принадлежат сессии конкретного игрока
-- (storage isolation). На уровне API/UI «синтетика принадлежит истории,
-- а не пользователю» — это семантика, а не constraint.

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS character_type TEXT NOT NULL DEFAULT 'synthetic';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'characters_character_type_check'
      AND conrelid = 'characters'::regclass
  ) THEN
    ALTER TABLE characters
      ADD CONSTRAINT characters_character_type_check
      CHECK (character_type IN ('synthetic', 'user'));
  END IF;
END $$;

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS gender TEXT;

-- Один user-профиль на пользователя. Для synthetic ограничения нет.
CREATE UNIQUE INDEX IF NOT EXISTS characters_user_profile_uniq
  ON characters (owner_telegram_id)
  WHERE character_type = 'user';
