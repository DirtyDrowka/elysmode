<script setup lang="ts">
import { ref, computed } from 'vue';

const props = withDefaults(
  defineProps<{
    as?: 'button' | 'div';
    scaleTo?: number;
    shimmer?: number;
    shimmerSize?: number;
    noScale?: boolean;
    disabled?: boolean;
  }>(),
  {
    as: 'button',
    scaleTo: 1.025,
    shimmer: 0.25,
    shimmerSize: 270,
    noScale: false,
    disabled: false,
  }
);

const emit = defineEmits<{ press: [] }>();

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
  if (props.disabled) return;
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
    emit('press');
  }
}

function onCancel() {
  pressed.value = false;
}

const wrapperStyle = computed(() => ({
  transform: !props.noScale && pressed.value ? `scale(${props.scaleTo})` : 'scale(1)',
}));

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
    class="pressable"
    :style="wrapperStyle"
    :disabled="as === 'button' ? disabled : undefined"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onCancel"
  >
    <slot />
    <span class="pressable-shimmer" :style="shimmerStyle" aria-hidden="true" />
  </component>
</template>

<style scoped>
.pressable {
  position: relative;
  cursor: pointer;
  transition: transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
  -webkit-tap-highlight-color: transparent;
  font-family: inherit;
  color: inherit;
}
.pressable[disabled] {
  cursor: default;
}
.pressable-shimmer {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  mix-blend-mode: plus-lighter;
  z-index: 2;
}
</style>
