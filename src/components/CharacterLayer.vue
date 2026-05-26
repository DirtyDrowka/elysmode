<script setup lang="ts">
import { computed } from 'vue';
import type { Character } from '../novel/blocks';

const props = defineProps<{
  /** Текущий говорящий персонаж. null → ничего не показываем */
  character: Character | null;
}>();

const PLACEHOLDER_URL = '/sprites/placeholder.webp';

// Что реально рендерим. Если персонаж есть, но imageUrl ещё не пришёл —
// плейсхолдер с shimmer-бликом. Когда придёт реальная картинка — мягко
// подменится через Transition (key включает фазу).
const displayed = computed(() => {
  const c = props.character;
  if (!c) return null;
  const isReal = !!c.imageUrl;
  return {
    id: c.id,
    name: c.name,
    src: isReal ? (c.imageUrl as string) : PLACEHOLDER_URL,
    key: `${c.id}-${isReal ? 'real' : 'ph'}`,
    placeholder: !isReal,
  };
});
</script>

<template>
  <Transition name="char">
    <div
      v-if="displayed"
      :key="displayed.key"
      class="character-wrap"
      :class="{ 'character-wrap--placeholder': displayed.placeholder }"
    >
      <img
        :src="displayed.src"
        :alt="displayed.name"
        class="character-img"
        draggable="false"
      />
      <!-- shimmer-блик поверх плейсхолдера, маскируется альфой картинки -->
      <div v-if="displayed.placeholder" class="shimmer" aria-hidden="true" />
    </div>
  </Transition>
</template>

<style scoped>
.character-wrap {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 78%;
  width: auto;
  /* контейнер тянется по img */
  pointer-events: none;
  user-select: none;
  z-index: 1;
  will-change: transform, opacity;
}

.character-img {
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

/* плейсхолдер показываем как есть, без приглушения — только shimmer-блик
   указывает что грузится */
.character-wrap--placeholder .character-img {
  /* без opacity/filter — пользователь хочет полностью непрозрачный силуэт */
}

/* shimmer ограничен альфой плейсхолдера через mask — блик проявляется
   только по силуэту, не по прозрачному фону. */
.shimmer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* маска по альфе картинки */
  -webkit-mask-image: v-bind('`url("${PLACEHOLDER_URL}")`');
          mask-image: v-bind('`url("${PLACEHOLDER_URL}")`');
  -webkit-mask-size: contain;
          mask-size: contain;
  -webkit-mask-position: bottom center;
          mask-position: bottom center;
  -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
  /* широкий тонкий линейный блик, прозрачнее чем на фоне (силуэт тёмный
     и блик ярче читается). no-repeat + linear-easing = бесшовно */
  background-repeat: no-repeat;
  background-image: linear-gradient(
    115deg,
    transparent 0%,
    transparent 46%,
    rgba(255, 255, 255, 0.10) 48%,
    rgba(255, 255, 255, 0.22) 50%,
    rgba(255, 255, 255, 0.10) 52%,
    transparent 54%,
    transparent 100%
  );
  background-size: 220% 100%;
  background-position: 200% 0;
  animation: shimmer-sweep 6s linear infinite;
  mix-blend-mode: screen;
  will-change: background-position;
}
@keyframes shimmer-sweep {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}

/* ─── enter: справа налево + bounce на влёте ─── */
.char-enter-active {
  transition:
    transform 520ms cubic-bezier(0.34, 1.5, 0.5, 1),
    opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.char-enter-from {
  opacity: 0;
  transform: translateX(calc(-50% + 80px));
}
.char-enter-to {
  opacity: 1;
  transform: translateX(-50%);
}

/* ─── leave: налево с разгоном, плавный fade ─── */
.char-leave-active {
  transition:
    transform 440ms cubic-bezier(0.55, 0, 0.85, 0.4),
    opacity 360ms cubic-bezier(0.55, 0, 0.85, 0.4);
}
.char-leave-from {
  opacity: 1;
  transform: translateX(-50%);
}
.char-leave-to {
  opacity: 0;
  transform: translateX(calc(-50% - 80px));
}
</style>
