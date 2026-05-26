<script setup lang="ts">
import LiquidGlass from './LiquidGlass.vue';

defineProps<{
  /** Неактивна (currentIdx=0, некуда возвращаться) — приглушённый вид,
   *  нажатия игнорируются. Сама кнопка ВСЕГДА видна. */
  disabled?: boolean;
}>();

const emit = defineEmits<{ back: [] }>();
</script>

<template>
  <LiquidGlass
    as="button"
    class="back-btn"
    :scale-to="1.1"
    :disabled="!!disabled"
    aria-label="Назад"
    @press="emit('back')"
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
      <path d="M15 18L9 12l6-6" />
    </svg>
  </LiquidGlass>
</template>

<style scoped>
/* Позиция задаётся снаружи через .floating-back (см. DialoguePanel).
   Сам компонент только определяет размер и форму. */
.back-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.95);
}
</style>
