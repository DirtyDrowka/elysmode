// Frontend клиент для ElevenLabs (через наш backend, ключ не светим в браузер).

import { api } from './api';

export interface VoiceSearchFilters {
  gender?: 'male' | 'female' | 'neutral';
  age?: 'young' | 'middle_aged' | 'old';
  language?: string;
  search?: string;
  use_case?: string;
}

export interface VoiceResult {
  voice_id: string;
  name: string;
  description: string;
  preview_url: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  language: string | null;
  descriptive: string | null;
  use_case: string | null;
}

export async function searchVoices(
  filters: VoiceSearchFilters
): Promise<VoiceResult[]> {
  const r = await api<{ voices: VoiceResult[] }>('/api/voice/search', {
    method: 'POST',
    body: filters,
  });
  return r.voices;
}

export async function synthesizeSpeech(
  characterId: string,
  text: string
): Promise<string> {
  const r = await api<{ audio_url: string }>('/api/voice/synth', {
    method: 'POST',
    body: { character_id: characterId, text },
  });
  return r.audio_url;
}
