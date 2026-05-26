<script setup lang="ts">
// Слой персонажей на сцене. Принимает массив (до 3 NPC, без ГГ).
// Позиции рассчитываются по количеству + индексу.
// Анимации (волной):
//   1. Убираемые — leave (~360ms)
//   2. Остающиеся — двигаются на новые позиции (transition: left ~400ms,
//      с задержкой чтобы дать leave закончиться)
//   3. Новые — enter (~520ms, с задержкой ещё больше)
//
// TransitionGroup управляет mount/unmount через :key, position transition
// через CSS на самом img.

import { computed } from 'vue';
import type { Character } from '../novel/blocks';

const props = defineProps<{
  /** Персонажи в кадре, в порядке слева→направо */
  characters: Character[];
}>();

const PLACEHOLDER_URL = '/sprites/placeholder.webp';

interface SceneItem {
  character: Character;
  /** Позиция центра по горизонтали в процентах */
  x: number;
  /** index в кадре (0 / 1 / 2) — для летнего delay-эффекта */
  idx: number;
  placeholder: boolean;
}

/** Раскладка: 1 в центре, 2 = 30%/70%, 3 = 20%/50%/80% */
function positionsForCount(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [50];
  if (n === 2) return [30, 70];
  return [20, 50, 80];
}

const items = computed<SceneItem[]>(() => {
  const cs = props.characters.slice(0, 3); // safety cap
  const xs = positionsForCount(cs.length);
  return cs.map((c, i) => ({
    character: c,
    x: xs[i] ?? 50,
    idx: i,
    placeholder: !c.imageUrl,
  }));
});

function srcFor(it: SceneItem): string {
  return it.placeholder ? PLACEHOLDER_URL : (it.character.imageUrl as string);
}
</script>

<template>
  <div class="scene-characters">
    <TransitionGroup name="char" tag="div" class="scene-characters-inner">
      <div
        v-for="it in items"
        :key="it.character.id"
        class="char-slot"
        :class="{ 'char-slot--placeholder': it.placeholder }"
        :style="{ left: it.x + '%' }"
      >
        <img
          :src="srcFor(it)"
          :alt="it.character.name"
          class="char-img"
          draggable="false"
        />
        <!-- shimmer-блик поверх плейсхолдера, маска по альфе плейсхолдера -->
        <div v-if="it.placeholder" class="char-shimmer" aria-hidden="true" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.scene-characters,
.scene-characters-inner {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.char-slot {
  position: absolute;
  bottom: 0;
  left: 50%;
  height: 78%;
  /* translateX(-50%) центрирует относительно своей позиции left:X% */
  transform: translateX(-50%);
  /* Плавное движение по горизонтали когда меняется left% (когда состав
     меняется и персонажи "сдвигаются"). Delay даёт leave-анимациям
     закончиться раньше чем kept-элементы начнут двигаться. */
  transition:
    left 420ms cubic-bezier(0.34, 1.2, 0.5, 1) 280ms,
    transform 420ms cubic-bezier(0.34, 1.2, 0.5, 1) 280ms;
  will-change: left, transform;
}

.char-img {
  display: block;
  height: 100%;
  width: auto;
  max-width: 100vw;
  object-fit: contain;
  object-position: bottom center;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

/* Плейсхолдер — приглушённый, по нему идёт shimmer */
.char-slot--placeholder .char-img {
  opacity: 0.55;
  filter: grayscale(0.2);
}

.char-shimmer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  -webkit-mask-image: url('/sprites/placeholder.webp');
          mask-image: url('/sprites/placeholder.webp');
  -webkit-mask-size: contain;
          mask-size: contain;
  -webkit-mask-position: bottom center;
          mask-position: bottom center;
  -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
  background-repeat: no-repeat;
  background-image: linear-gradient(
    115deg,
    transparent 0%,
    transparent 46%,
    rgba(255, 255, 255, 0.1) 48%,
    rgba(255, 255, 255, 0.22) 50%,
    rgba(255, 255, 255, 0.1) 52%,
    transparent 54%,
    transparent 100%
  );
  background-size: 220% 100%;
  background-position: 200% 0;
  animation: char-shimmer-sweep 6s linear infinite;
  mix-blend-mode: screen;
}
@keyframes char-shimmer-sweep {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}

/* ─── enter: новые персонажи появляются с задержкой 540ms (чтобы leave и
       kept-rearrange успели завершиться). Pop scale + opacity. */
.char-enter-active {
  transition:
    opacity 320ms cubic-bezier(0.2, 0.8, 0.2, 1) 540ms,
    transform 460ms cubic-bezier(0.34, 1.4, 0.5, 1) 540ms;
}
.char-enter-from {
  opacity: 0;
  transform: translateX(-50%) scale(0.7) translateY(20px);
}
.char-enter-to {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}

/* ─── leave: уходящие первыми. */
.char-leave-active {
  transition:
    opacity 280ms cubic-bezier(0.55, 0, 0.85, 0.4),
    transform 320ms cubic-bezier(0.55, 0, 0.85, 0.4);
}
.char-leave-from {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}
.char-leave-to {
  opacity: 0;
  transform: translateX(-50%) scale(0.6) translateY(30px);
}
</style>
