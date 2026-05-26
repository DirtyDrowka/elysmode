// API клиент для per-user коллекции персонажей.

import { api } from './api';
import type { Character } from '../novel/blocks';

/** То что приходит с бэка — snake_case. */
export interface CharacterDto {
  id: string;
  name: string;
  color: string;
  personality: string;
  appearance: string;
  image_url: string | null;
  voice_id: string | null;
}

export function dtoToCharacter(d: CharacterDto): Character {
  return {
    id: d.id,
    name: d.name,
    color: d.color,
    personality: d.personality,
    appearance: d.appearance,
    imageUrl: d.image_url,
    voiceId: d.voice_id,
  };
}

export async function listCharacters(): Promise<Character[]> {
  const r = await api<{ characters: CharacterDto[] }>('/api/characters');
  return r.characters.map(dtoToCharacter);
}

export async function upsertCharacter(c: Character): Promise<Character> {
  const r = await api<{ character: CharacterDto }>('/api/characters', {
    method: 'POST',
    body: {
      id: c.id,
      name: c.name,
      color: c.color,
      personality: c.personality,
      appearance: c.appearance,
      image_url: c.imageUrl,
      voice_id: c.voiceId,
    },
  });
  return dtoToCharacter(r.character);
}

export async function putCharacterImage(id: string, imageUrl: string): Promise<void> {
  await api(`/api/characters/${encodeURIComponent(id)}/image`, {
    method: 'PUT',
    body: { image_url: imageUrl },
  });
}
