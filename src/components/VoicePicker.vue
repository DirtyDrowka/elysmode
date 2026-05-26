<script setup lang="ts">
// Список из 10 голосов ElevenLabs, отфильтрованных по gender+age.
// Каждый голос — отдельная liquid-glass карточка с play-кнопкой превью
// (preview_url с ElevenLabs CDN) и описанием. Тап по карточке — выбор.

import { computed, onBeforeUnmount, ref, watch } from 'vue';
import LiquidGlass from './LiquidGlass.vue';
import { searchVoices, type VoiceResult } from '../services/voice';

const props = defineProps<{
  modelValue: string | null;
  gender: 'male' | 'female' | null;
  age: 'young' | 'middle_aged' | 'old' | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: string | null] }>();

const voices = ref<VoiceResult[]>([]);
const loading = ref(false);
const errorMsg = ref<string | null>(null);

// текущий play
const playingId = ref<string | null>(null);
const audioEl: HTMLAudioElement | null =
  typeof Audio !== 'undefined' ? new Audio() : null;

if (audioEl) {
  audioEl.addEventListener('ended', () => (playingId.value = null));
  audioEl.addEventListener('pause', () => {
    // pause без ended — пользователь нажал stop или начал новый
    if (audioEl.currentTime === 0 || audioEl.ended) {
      playingId.value = null;
    }
  });
}

// Загружаем при изменении пола или возраста
const filterKey = computed(() => `${props.gender ?? '-'}|${props.age ?? '-'}`);

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchVoices() {
  if (!props.gender) {
    voices.value = [];
    return;
  }
  loading.value = true;
  errorMsg.value = null;
  stopPreview();
  try {
    const pool = await searchVoices({
      gender: props.gender,
      age: props.age ?? undefined,
      language: 'ru',
    });

    // Уже выбранный голос (если он попадает в pool текущего фильтра) —
    // закрепляем первым в списке, а остальные 9 берём рандомно из 99.
    const selected = pool.find((v) => v.voice_id === props.modelValue) ?? null;
    const rest = pool.filter((v) => v.voice_id !== props.modelValue);
    const shuffled = shuffle(rest).slice(0, selected ? 9 : 10);
    voices.value = selected ? [selected, ...shuffled] : shuffled;
  } catch (e) {
    console.error('[voice-picker] fetch failed:', e);
    errorMsg.value = 'Не удалось загрузить голоса';
    voices.value = [];
  } finally {
    loading.value = false;
  }
}

watch(filterKey, fetchVoices, { immediate: true });

function stopPreview() {
  if (!audioEl) return;
  audioEl.pause();
  audioEl.currentTime = 0;
  playingId.value = null;
}

function togglePreview(v: VoiceResult, ev: Event) {
  ev.stopPropagation();
  if (!audioEl || !v.preview_url) return;
  if (playingId.value === v.voice_id) {
    stopPreview();
    return;
  }
  audioEl.src = v.preview_url;
  playingId.value = v.voice_id;
  void audioEl.play().catch((err) => {
    console.warn('[voice-picker] play failed:', err);
    playingId.value = null;
  });
}

function selectVoice(v: VoiceResult) {
  emit('update:modelValue', v.voice_id);
}

// короткая подпись справа от плэй-кнопки
function shortDescription(v: VoiceResult): string {
  const bits: string[] = [];
  if (v.descriptive) bits.push(v.descriptive);
  if (v.accent) bits.push(v.accent);
  if (v.use_case) bits.push(v.use_case);
  if (bits.length === 0 && v.description) {
    return v.description.length > 70
      ? v.description.slice(0, 70) + '…'
      : v.description;
  }
  return bits.join(' · ');
}

onBeforeUnmount(stopPreview);
</script>

<template>
  <div class="vp">
    <p v-if="!gender" class="vp-empty">Выбери пол — появятся голоса</p>
    <p v-else-if="loading" class="vp-empty">Загружаю голоса…</p>
    <p v-else-if="errorMsg" class="vp-error">{{ errorMsg }}</p>
    <p v-else-if="voices.length === 0" class="vp-empty">Ничего не нашлось</p>

    <LiquidGlass
      v-for="v in voices"
      :key="v.voice_id"
      as="div"
      class="vp-card"
      :class="{ 'vp-card--active': modelValue === v.voice_id }"
      :scale-to="1.01"
      @press="selectVoice(v)"
    >
      <!-- play button — отдельный stopPropagation, чтобы не выбирался голос -->
      <button
        type="button"
        class="vp-play"
        :class="{ 'vp-play--playing': playingId === v.voice_id }"
        :disabled="!v.preview_url"
        @click.stop="togglePreview(v, $event)"
        :aria-label="playingId === v.voice_id ? 'Pause' : 'Play'"
      >
        <svg
          v-if="playingId !== v.voice_id"
          width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg
          v-else
          width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
          aria-hidden="true"
        >
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      </button>

      <div class="vp-meta">
        <div class="vp-name">{{ v.name }}</div>
        <div class="vp-desc">{{ shortDescription(v) }}</div>
      </div>
    </LiquidGlass>
  </div>
</template>

<style scoped>
.vp {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vp-empty,
.vp-error {
  font-family: var(--font-sans);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  padding: 12px 22px;
  margin: 0;
}
.vp-error { color: #ff6b6b; }

.vp-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 999px;
  min-height: 56px;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 240ms ease, color 240ms ease;
}

/* Выбранная карточка — accent-зелёная, контент чёрный.
   Переопределяем CSS-переменные LiquidGlass'а на акцентные. */
.vp-card--active {
  --glass-bg: rgba(212, 255, 0, 0.7);
  --glass-border: rgba(255, 255, 255, 0.4);
  --glass-highlight: rgba(255, 255, 255, 0.65);
  --glass-shadow:
    var(--glass-inset),
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(0, 0, 0, 0.15),
    0 8px 24px rgba(212, 255, 0, 0.35),
    0 2px 8px rgba(212, 255, 0, 0.25);
  color: #000;
}

.vp-play {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
  transition: background 180ms ease, color 180ms ease, transform 160ms ease;
}
.vp-play:hover {
  background: rgba(255, 255, 255, 0.2);
}
.vp-play:active {
  transform: scale(0.94);
}
.vp-play:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.vp-play--playing {
  background: var(--accent);
  color: #000;
}
/* На выбранной (accent) карточке play-кнопка инвертируется в тёмную */
.vp-card--active .vp-play {
  background: rgba(0, 0, 0, 0.2);
  color: #000;
}
.vp-card--active .vp-play--playing {
  background: #000;
  color: var(--accent);
}

.vp-meta {
  flex: 1 1 auto;
  min-width: 0;
}
.vp-name {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vp-desc {
  font-family: var(--font-sans);
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.3;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* На активной карточке имя и описание тоже тёмные */
.vp-card--active .vp-name {
  color: #000;
}
.vp-card--active .vp-desc {
  color: rgba(0, 0, 0, 0.65);
}
</style>
