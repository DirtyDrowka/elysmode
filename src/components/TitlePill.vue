<script setup lang="ts">
import LiquidGlass from './LiquidGlass.vue';
withDefaults(defineProps<{ title?: string }>(), { title: 'elys mode' });
</script>

<template>
  <div class="title-pill-slot">
    <LiquidGlass as="div" class="title-pill">
      <span>{{ title }}</span>
    </LiquidGlass>
  </div>
</template>

<style scoped>
/* Внешний slot центрирует pill через flex — не используем translateX,
   чтобы LiquidGlass мог свободно ставить scale при press. */
.title-pill-slot {
  position: absolute;
  top: calc(14px + env(safe-area-inset-top, 0px));
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.title-pill {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  padding: 7px 18px;
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: rgba(255, 255, 255, 0.95);
  max-width: calc(100% - 100px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
