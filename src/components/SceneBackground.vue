<script setup lang="ts">
import { computed } from 'vue';
import type { BackgroundRef } from '../novel/types';
import { resolveBackground } from '../novel/assets';

const props = defineProps<{
  background: BackgroundRef;
  /** Сгенерированный URL фоновой картинки. Если есть — рисуем поверх дефолта. */
  imageUrl?: string | null;
}>();

const presetStyle = computed(() => ({
  background: resolveBackground(props.background),
}));
const presetKey = computed(
  () => `${props.background.kind}:${props.background.value}`
);
const imageKey = computed(() => props.imageUrl ?? '');
</script>

<template>
  <div class="scene-root">
    <!-- дефолтная подложка (градиент + полоски) показывается всегда снизу,
         чтобы во время генерации первой локации экран не был чёрным -->
    <Transition name="fade" mode="out-in">
      <div :key="presetKey" class="scene-bg" :style="presetStyle">
        <svg v-if="!imageUrl" class="stripes" aria-hidden="true">
          <defs>
            <pattern
              id="vn-bg-stripes"
              width="22"
              height="22"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(40)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="22"
                stroke="rgba(255,255,255,0.035)"
                stroke-width="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#vn-bg-stripes)" />
        </svg>
        <!-- shimmer: диагональный блик пробегает раз в ~3.5с пока ждём реальный bg -->
        <div v-if="!imageUrl" class="shimmer" aria-hidden="true" />
      </div>
    </Transition>

    <!-- сгенерированная картинка локации, поверх дефолта -->
    <Transition name="fade-bg">
      <img
        v-if="imageUrl"
        :key="imageKey"
        :src="imageUrl"
        class="scene-image"
        alt=""
        draggable="false"
      />
    </Transition>

    <!-- виньетка всегда сверху для атмосферы -->
    <div class="vignette" />
  </div>
</template>

<style scoped>
.scene-root {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}
.scene-bg {
  position: absolute;
  inset: 0;
  will-change: opacity;
}
.stripes {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.55;
}
.scene-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 50% 30%,
    transparent 40%,
    rgba(0, 0, 0, 0.65) 100%
  );
  pointer-events: none;
}

/* ─── shimmer (loading-блик) ─────────────────────────────────────── */
/* Очень широкий тонкий блик едет справа налево бесконечно линейно.
   background-repeat:no-repeat → нет тайлинга. Цикл 6с, движение
   плавное без пауз — между бликами блик уходит за экран и едет дальше.
   Прозрачность низкая — блик чувствуется но не давит. */
.shimmer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-repeat: no-repeat;
  background-image: linear-gradient(
    115deg,
    transparent 0%,
    transparent 46%,
    rgba(255, 255, 255, 0.025) 48%,
    rgba(255, 255, 255, 0.055) 50%,
    rgba(255, 255, 255, 0.025) 52%,
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

.fade-bg-enter-active,
.fade-bg-leave-active {
  transition: opacity 500ms cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-bg-enter-from,
.fade-bg-leave-to {
  opacity: 0;
}
</style>
