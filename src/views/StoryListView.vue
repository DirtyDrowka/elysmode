<script setup lang="ts">
import LiquidGlass from '../components/LiquidGlass.vue';

defineProps<{
  /** Существующие истории пользователя — массив карточек */
  stories: Array<{
    id: string;
    title: string;
    summary: string;
    /** Сколько выборов уже сделал игрок в этой истории */
    choiceCount: number;
  }>;
}>();

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
function choicesLabel(n: number): string {
  return `${n} ${plural(n, ['выбор', 'выбора', 'выборов'])}`;
}

const emit = defineEmits<{
  new: [];
  open: [id: string];
}>();
</script>

<template>
  <!-- Список историй — скроллится. Зелёная «Новая история» НЕ здесь:
       она отдельным футером поверх (см. ниже), чтобы всегда быть на виду. -->
  <div class="story-list-wrap">
    <div class="story-list">
      <LiquidGlass
        v-for="s in stories"
        :key="s.id"
        as="button"
        class="story-card story-card--existing"
        :scale-to="1.02"
        @press="emit('open', s.id)"
      >
        <div class="story-title">{{ s.title || 'Без названия' }}</div>
        <div v-if="s.summary" class="story-summary">{{ s.summary }}</div>
        <div class="story-meta">
          <span class="story-meta-pill">{{ choicesLabel(s.choiceCount) }}</span>
        </div>
      </LiquidGlass>
    </div>
  </div>

  <!-- Закреплённый футер над TabBar с зелёной кнопкой «Новая история».
       Появляется/исчезает с теми же liquid-glass pop-анимациями. -->
  <Transition name="liquid-glass" appear>
    <LiquidGlass
      as="button"
      class="new-story-btn"
      :scale-to="1.04"
      @press="emit('new')"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span>Новая история</span>
    </LiquidGlass>
  </Transition>
</template>

<style scoped>
.story-list-wrap {
  position: absolute;
  inset: 0;
  padding: calc(60px + env(safe-area-inset-top, 0px)) 14px
    /* нижний padding = высота nav-bar + высота new-story-btn + зазоры,
       чтобы скролл не залезал под футер */
    calc(90px + env(safe-area-inset-bottom, 4px) + 70px);
  box-sizing: border-box;
  overflow-y: auto;
  background: radial-gradient(120% 80% at 50% 35%, #161821 0%, #000 78%);
}

.story-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.story-card {
  width: 100%;
  border-radius: 22px;
  padding: 22px;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  box-sizing: border-box;
}

.story-card--existing {
  min-height: 88px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #fff;
}

.story-title {
  font-family: var(--font-sans);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: #fff;
}
.story-summary {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.62);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.story-meta {
  margin-top: 4px;
  display: flex;
  gap: 8px;
}
.story-meta-pill {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--accent);
  background: rgba(212, 255, 0, 0.1);
  border: 1px solid rgba(212, 255, 0, 0.28);
  padding: 4px 10px;
  border-radius: 999px;
}

/* ─── Футер с зелёной кнопкой «Новая история» ──────────────────────── */
.new-story-btn {
  /* Точно над TabBar: bottom = высота tab-bar + safe-area + зазор */
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: calc(78px + env(safe-area-inset-bottom, 4px) + 10px);
  z-index: 11;

  /* Зелёный — переопределяем CSS-переменные LiquidGlass под accent */
  --glass-bg: rgba(212, 255, 0, 0.92);
  --glass-border: rgba(255, 255, 255, 0.4);
  --glass-highlight: rgba(255, 255, 255, 0.65);
  --glass-blur: none;
  --glass-shadow:
    var(--glass-inset),
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(0, 0, 0, 0.15),
    0 14px 40px rgba(212, 255, 0, 0.45),
    0 4px 12px rgba(212, 255, 0, 0.35);

  padding: 18px 22px;
  border-radius: var(--radius-pill, 999px);
  color: #000;
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transform-origin: center bottom;
}
</style>
