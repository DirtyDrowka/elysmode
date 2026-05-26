<script setup lang="ts">
import LiquidGlass from './LiquidGlass.vue';

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <LiquidGlass
    as="button"
    class="close-btn"
    :scale-to="1.1"
    aria-label="Закрыть"
    @press="emit('close')"
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6L18 18M18 6L6 18" />
    </svg>
  </LiquidGlass>
</template>

<style scoped>
/* Позиция задаётся снаружи через .floating-close (см. DialoguePanel). */
.close-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.95);
}
</style>
