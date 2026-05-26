<script setup lang="ts">
// Единственный liquid-glass компонент. Все glass-объекты в приложении
// наследуют его (через <LiquidGlass>) и получают:
//   • одинаковый фон, блюр, бордер, тени (через CSS-переменные)
//   • механику press: scale-up + радиальный блик в точке нажатия + emit
//
// Переопределить цвет/тени можно через CSS-переменные на родителе:
//   --glass-bg, --glass-border, --glass-highlight, --glass-shadow.
// Это используется например для paid-кнопки (accent зелёный).
//
// Если нужен только стиль БЕЗ интерактивности (loading-капсула, title-pill) —
// передай :interactive="false". scale/shimmer/emit отключатся.

import { ref, computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Какой тег рендерить: button по умолчанию (можно div для не-кнопок) */
    as?: 'button' | 'div';
    /** Насколько увеличить при нажатии. 1.025 = +2.5% */
    scaleTo?: number;
    /** Альфа блика 0..1 */
    shimmer?: number;
    /** Радиус блика в пикселях */
    shimmerSize?: number;
    /** Если false — только стиль, без press-механики */
    interactive?: boolean;
    disabled?: boolean;
  }>(),
  {
    as: 'button',
    scaleTo: 1.04,
    shimmer: 0.25,
    shimmerSize: 270,
    interactive: true,
    disabled: false,
  }
);

/** press emit: координаты точки нажатия в процентах (0..100) от размеров
 *  элемента. Старые callers без payload продолжают работать. */
const emit = defineEmits<{ press: [info: { x: number; y: number }] }>();

const pressed = ref(false);
const pos = ref({ x: 50, y: 50 });

function updatePos(e: PointerEvent, rect: DOMRect) {
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  pos.value = {
    x: Math.max(0, Math.min(100, (cx / rect.width) * 100)),
    y: Math.max(0, Math.min(100, (cy / rect.height) * 100)),
  };
}

function onDown(e: PointerEvent) {
  if (!props.interactive || props.disabled) return;
  const target = e.currentTarget as HTMLElement;
  updatePos(e, target.getBoundingClientRect());
  pressed.value = true;
  target.setPointerCapture?.(e.pointerId);
}

function onMove(e: PointerEvent) {
  if (!pressed.value) return;
  const target = e.currentTarget as HTMLElement;
  updatePos(e, target.getBoundingClientRect());
}

function onUp(e: PointerEvent) {
  const wasPressed = pressed.value;
  pressed.value = false;
  const target = e.currentTarget as HTMLElement;
  target.releasePointerCapture?.(e.pointerId);
  if (wasPressed && !props.disabled && e.type === 'pointerup') {
    emit('press', { x: pos.value.x, y: pos.value.y });
  }
}

function onCancel() {
  pressed.value = false;
}

const wrapperStyle = computed(() => {
  // для статичных glass-объектов не трогаем transform — он может
  // использоваться для layout (translateX и т.п.)
  if (!props.interactive) return {};
  return {
    transform: pressed.value ? `scale(${props.scaleTo})` : 'scale(1)',
  };
});

const shimmerStyle = computed(() => ({
  background: `radial-gradient(circle ${props.shimmerSize}px at ${pos.value.x}% ${pos.value.y}%, rgba(255,255,255,${props.shimmer}) 0%, rgba(255,255,255,0) 65%)`,
  opacity: pressed.value ? 1 : 0,
  transition: pressed.value
    ? 'opacity 120ms ease, background 0s'
    : 'opacity 350ms ease',
}));
</script>

<template>
  <component
    :is="as"
    class="liquid-glass"
    :class="{
      'liquid-glass--static': !interactive,
      'liquid-glass--disabled': disabled,
    }"
    :style="wrapperStyle"
    :disabled="as === 'button' ? disabled : undefined"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onCancel"
  >
    <span class="lg-highlight" aria-hidden="true" />
    <slot />
    <span
      v-if="interactive"
      class="lg-shimmer"
      :style="shimmerStyle"
      aria-hidden="true"
    />
  </component>
</template>

<style scoped>
.liquid-glass {
  position: relative;
  background: var(--glass-bg);
  -webkit-backdrop-filter: var(--glass-blur);
          backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  cursor: pointer;
  isolation: isolate;
  will-change: backdrop-filter, transform;
  transition: transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
  -webkit-tap-highlight-color: transparent;
}
.liquid-glass--static {
  cursor: default;
}
/* Disabled: не реагирует на pointer, более тёмный и блёклый. */
.liquid-glass[disabled],
.liquid-glass--disabled {
  cursor: default;
  opacity: 0.4;
  filter: saturate(0.5);
  pointer-events: none;
}

/* верхний highlight-блик (тонкая светлая линия сверху) */
.lg-highlight {
  position: absolute;
  top: 0;
  left: 14px;
  right: 14px;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--glass-highlight),
    transparent
  );
  border-radius: 999px;
  pointer-events: none;
  z-index: 1;
}

/* радиальный блик при нажатии */
.lg-shimmer {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  mix-blend-mode: plus-lighter;
  z-index: 2;
}
</style>
