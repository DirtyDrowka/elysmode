// API клиент для user-профиля (свой персонаж игрока).
//
// Профиль хранится в той же таблице characters с character_type='user',
// id='self'. Один профиль на пользователя.

import { api } from './api';
import type { Character } from '../novel/blocks';
import { dtoToCharacter, type CharacterDto } from './characters';

export interface ProfileInput {
  name: string;
  gender: 'male' | 'female' | null;
  color: string;
  personality: string;
  appearance: string;
  voiceId?: string | null;
  imageUrl?: string | null;
}

/** Получить профиль текущего пользователя. null если ещё не создан. */
export async function getProfile(): Promise<Character | null> {
  const r = await api<{ profile: CharacterDto | null }>('/api/profile');
  return r.profile ? dtoToCharacter(r.profile) : null;
}

/** Создать или обновить профиль. Бэк сам подберёт voice_id при первом
 *  создании. Картинку отдельно — её фронт генерит через openrouter.generateCharacterImage
 *  и потом отправляет в setProfileImage. */
export async function saveProfile(input: ProfileInput): Promise<Character> {
  const r = await api<{ profile: CharacterDto }>('/api/profile', {
    method: 'POST',
    body: {
      name: input.name,
      gender: input.gender,
      color: input.color,
      personality: input.personality,
      appearance: input.appearance,
      voice_id: input.voiceId ?? null,
      image_url: input.imageUrl ?? null,
    },
  });
  return dtoToCharacter(r.profile);
}

/** Положить готовый image_url в профиль (после async-генерации портрета). */
export async function setProfileImage(imageUrl: string): Promise<void> {
  await api('/api/profile/image', {
    method: 'PUT',
    body: { image_url: imageUrl },
  });
}
