-- Голос персонажа из библиотеки ElevenLabs.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS voice_id TEXT;
