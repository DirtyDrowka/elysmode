<script setup lang="ts">
// Универсальное поле ввода: input или textarea (если multiline).
// Серое минималистичное, без border, без outline, со скрытым скроллбаром
// у textarea (нативный браузерный убран и на webkit, и на firefox).

import { computed, useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
    placeholder?: string;
    maxlength?: number;
    multiline?: boolean;
    rows?: number;
    disabled?: boolean;
  }>(),
  { multiline: false, rows: 3, disabled: false }
);

const emit = defineEmits<{ 'update:modelValue': [v: string] }>();

const attrs = useAttrs();

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}

const tag = computed(() => (props.multiline ? 'textarea' : 'input'));
</script>

<template>
  <label class="tf">
    <span v-if="label" class="tf-label">{{ label }}</span>
    <component
      :is="tag"
      :value="modelValue"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :rows="multiline ? rows : undefined"
      :disabled="disabled"
      :type="multiline ? undefined : 'text'"
      v-bind="attrs"
      class="tf-input"
      :class="{ 'tf-input--multiline': multiline }"
      @input="onInput"
    />
  </label>
</template>

<style scoped>
.tf {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tf-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  /* лейбл стартует от точки скругления капсулы (= её border-radius) */
  padding-left: 22px;
}

.tf-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  outline: none;
  color: #fff;
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.4;
  padding: 14px 18px;
  border-radius: 22px;
  -webkit-appearance: none;
  appearance: none;
  transition: background 200ms ease;
}
.tf-input::placeholder {
  color: rgba(255, 255, 255, 0.32);
}
.tf-input:focus {
  background: rgba(255, 255, 255, 0.11);
}
.tf-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tf-input--multiline {
  min-height: 72px;
  resize: none;
  /* отключаем нативный скроллбар */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge legacy */
}
.tf-input--multiline::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none; /* Webkit (Chrome/Safari) */
}
</style>
