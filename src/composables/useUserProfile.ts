// Глобальный singleton с профилем игрока (user-character). Загружается
// лениво один раз, при логауте — сбрасывается. dynamicEngine использует
// его для подстановки описания ГГ в system prompt.

import { ref, computed } from 'vue';
import type { Character } from '../novel/blocks';
import { getProfile } from '../services/profile';

const profile = ref<Character | null>(null);
const loaded = ref(false);
let inflight: Promise<void> | null = null;

async function load(): Promise<void> {
  try {
    profile.value = await getProfile();
  } catch (e) {
    console.warn('[useUserProfile] load failed:', e);
    profile.value = null;
  } finally {
    loaded.value = true;
  }
}

function ensureLoaded(): Promise<void> {
  if (loaded.value) return Promise.resolve();
  if (inflight) return inflight;
  inflight = load().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Сбросить кеш — например после save в ProfileView, чтобы новелла увидела
 *  свежее описание ГГ при следующей генерации. */
function refresh() {
  loaded.value = false;
  inflight = null;
  return ensureLoaded();
}

function reset() {
  profile.value = null;
  loaded.value = false;
  inflight = null;
}

/** Собрать текстовое описание ГГ для system prompt'а LLM. Если профиля
 *  нет — отдаём дефолтный шаблон. */
function describeHero(p: Character | null): string {
  if (!p) return 'Мужчина, повествование от первого лица.';
  const parts: string[] = [];
  parts.push(`Имя: ${p.name}.`);
  if (p.gender) {
    parts.push(`Пол: ${p.gender === 'female' ? 'женский' : 'мужской'}.`);
  }
  if (p.personality.trim()) {
    parts.push(`Характер: ${p.personality.trim()}.`);
  }
  if (p.appearance.trim()) {
    parts.push(`Внешность: ${p.appearance.trim()}.`);
  }
  parts.push('Повествование от первого лица.');
  return parts.join(' ');
}

export function useUserProfile() {
  // Триггерим загрузку при первом обращении.
  void ensureLoaded();
  return {
    profile: computed(() => profile.value),
    loaded: computed(() => loaded.value),
    heroDescription: computed(() => describeHero(profile.value)),
    ensureLoaded,
    refresh,
    reset,
  };
}
