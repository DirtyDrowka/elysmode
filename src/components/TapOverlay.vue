<script setup lang="ts">
defineProps<{ enabled: boolean }>();
const emit = defineEmits<{ tap: [] }>();
</script>

<template>
  <div
    class="tap-overlay"
    :class="{ disabled: !enabled }"
    @pointerdown="emit('tap')"
  />
</template>

<style scoped>
.tap-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: auto;
  background: transparent;
}
.tap-overlay.disabled {
  pointer-events: none;
}
</style>
