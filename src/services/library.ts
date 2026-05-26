// Глобальная библиотека персонажей и локаций. Грузится один раз на старте
// сессии; модель ВЫБИРАЕТ из неё по id, а не создаёт.

import { api } from './api';

export interface LibraryCharacter {
  id: string;
  name: string;
  age: number | null;
  role: string | null;
  color: string;
  personality: string;
  appearance: string;
  imageUrl: string | null;
  voiceId: string | null;
}

export interface LibraryLocation {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
}

export interface Library {
  characters: Record<string, LibraryCharacter>;
  locations: Record<string, LibraryLocation>;
}

interface LibraryDto {
  characters: Array<{
    id: string;
    name: string;
    age: number | null;
    role: string | null;
    color: string;
    personality: string;
    appearance: string;
    image_url: string | null;
    voice_id: string | null;
  }>;
  locations: Array<{
    id: string;
    name: string;
    description: string;
    image_url: string | null;
  }>;
}

export async function fetchLibrary(): Promise<Library> {
  const r = await api<LibraryDto>('/api/library', { optionalAuth: true });
  const characters: Record<string, LibraryCharacter> = {};
  for (const c of r.characters) {
    characters[c.id] = {
      id: c.id,
      name: c.name,
      age: c.age,
      role: c.role,
      color: c.color,
      personality: c.personality,
      appearance: c.appearance,
      imageUrl: c.image_url,
      voiceId: c.voice_id,
    };
  }
  const locations: Record<string, LibraryLocation> = {};
  for (const l of r.locations) {
    locations[l.id] = {
      id: l.id,
      name: l.name,
      description: l.description,
      imageUrl: l.image_url,
    };
  }
  return { characters, locations };
}
