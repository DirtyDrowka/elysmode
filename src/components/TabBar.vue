<script setup lang="ts">
import LiquidGlass from './LiquidGlass.vue';

type TabKey = 'home' | 'catalog' | 'read' | 'saved' | 'profile';

interface Tab {
  key: TabKey;
  icon: TabKey;
  label: string;
}

withDefaults(defineProps<{ active?: TabKey }>(), { active: 'read' });
const emit = defineEmits<{ select: [key: TabKey] }>();

const tabs: Tab[] = [
  { key: 'home', icon: 'home', label: 'Главная' },
  { key: 'catalog', icon: 'catalog', label: 'Каталог' },
  { key: 'read', icon: 'read', label: 'Читаю' },
  { key: 'saved', icon: 'saved', label: 'Сохранения' },
  { key: 'profile', icon: 'profile', label: 'Профиль' },
];
</script>

<template>
  <!-- Nav-bar — liquid-glass контейнер без interactivity: иначе он
       перехватывает pointer через setPointerCapture() на корневом div'е
       и на iOS/Android клики на дочерние button.tab не доходят. -->
  <LiquidGlass as="div" class="tab-bar" :interactive="false">
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      class="tab"
      :class="{ active: t.key === active }"
      @click="emit('select', t.key)"
    >
      <span v-if="t.key === active" class="tab-glow" aria-hidden="true" />

      <span class="tab-icon">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          :stroke-width="t.key === active ? 2 : 1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <template v-if="t.icon === 'home'">
            <path d="M3.5 11.5L12 4l8.5 7.5" />
            <path d="M5.5 10.5V20h13v-9.5" />
          </template>
          <template v-else-if="t.icon === 'catalog'">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
          </template>
          <template v-else-if="t.icon === 'read'">
            <path d="M12 6c-1.5-1.2-4-2-7-2v15c3 0 5.5.8 7 2" />
            <path d="M12 6c1.5-1.2 4-2 7-2v15c-3 0-5.5.8-7 2" />
            <path d="M12 6v15" />
          </template>
          <template v-else-if="t.icon === 'saved'">
            <path d="M6 4h12v17l-6-4-6 4V4z" />
          </template>
          <template v-else-if="t.icon === 'profile'">
            <circle cx="12" cy="9" r="3.8" />
            <path d="M4.5 20.5a7.5 7.5 0 0115 0" />
          </template>
        </svg>
      </span>

      <span class="tab-label">{{ t.label }}</span>
    </button>
  </LiquidGlass>
</template>

<style scoped>
.tab-bar {
  position: absolute;
  bottom: calc(4px + env(safe-area-inset-bottom, 4px));
  left: 10px;
  right: 10px;
  z-index: 11;
  border-radius: 34px;
  padding: 8px 4px 10px;
  display: flex;
  align-items: flex-start;
}

.tab {
  flex: 1 1 0;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: -0.1px;
  border-radius: 14px;
  color: rgba(255, 255, 255, 0.55);
  padding: 4px 2px 0;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  transition: color 200ms ease;
}
.tab.active {
  font-weight: 600;
  color: var(--accent);
}
.tab.active .tab-icon {
  color: var(--accent);
}
.tab-icon {
  position: relative;
  z-index: 1;
  line-height: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: color 200ms ease;
}
.tab-label {
  position: relative;
  z-index: 1;
  white-space: nowrap;
}
.tab-glow {
  position: absolute;
  top: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: radial-gradient(
    circle,
    rgba(212, 255, 0, 0.28) 0%,
    rgba(212, 255, 0, 0) 70%
  );
  z-index: 0;
  pointer-events: none;
}
</style>
