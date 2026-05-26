<script setup lang="ts">
import { computed, ref, onBeforeUnmount, watch, watchEffect } from 'vue';
import type { Character, DisplayBlock } from '../novel/blocks';
import { MAIN_HERO_ID } from '../novel/blocks';
import { toTaggedLetters, type TaggedLetter } from '../novel/textTags';
import LiquidGlass from './LiquidGlass.vue';
import BackButton from './BackButton.vue';
import CloseButton from './CloseButton.vue';

const props = defineProps<{
  block: DisplayBlock | undefined;
  displayedText: string;
  isTyping: boolean;
  isLoading: boolean;
  error?: string | null;
  /** Текущий говорящий персонаж (null для нарратора / мыслей / ГГ-вслух / loading) */
  character?: Character | null;
  /** Все известные персонажи — нужны чтобы резолвить цвет в <char id="..."> теге */
  characters?: Record<string, Character>;
  /** Видна ли кнопка «назад» (есть куда вернуться) */
  canGoBack?: boolean;
}>();

const emit = defineEmits<{
  choose: [index: number];
  advance: [];
  retry: [];
  back: [];
  close: [];
}>();

type State =
  | 'narrator'
  | 'thought'
  | 'speech'
  | 'choices'
  | 'chosen'
  | 'loading'
  | 'error';

const state = computed<State>(() => {
  if (props.error) return 'error';
  if (!props.block || props.isLoading) return 'loading';
  switch (props.block.type) {
    case 'narrator':
      return 'narrator';
    case 'thought':
      return 'thought';
    case 'speech':
      return 'speech';
    case 'choices':
      // если выбор уже сделан — показываем read-only «ты выбрал»
      return props.block.chosenIdx !== undefined ? 'chosen' : 'choices';
  }
});

// displayState задержан относительно state на время leave-анимации
// предыдущего контейнера. При уходе из choices: items сразу начинают leave
// (через visibleChoices от state), а смена на narrator/speech/etc откладывается
// на 220ms — capsule mount'ится после того как choices опустеют.
const displayState = ref(state.value);
const LEAVE_DELAY_MS = 220;
let switchTimer: ReturnType<typeof setTimeout> | null = null;
watch(state, (next) => {
  if (switchTimer) {
    clearTimeout(switchTimer);
    switchTimer = null;
  }
  // Уходим из choices в другой state → ждём пока items проиграют leave.
  if (displayState.value === 'choices' && next !== 'choices') {
    switchTimer = setTimeout(() => {
      displayState.value = next;
      switchTimer = null;
    }, LEAVE_DELAY_MS);
    return;
  }
  // Все остальные переходы — синхронно.
  displayState.value = next;
});
onBeforeUnmount(() => {
  if (switchTimer) clearTimeout(switchTimer);
});

const chosenLabel = computed(() => {
  const b = props.block;
  if (!b || b.type !== 'choices' || b.chosenIdx === undefined) return '';
  return b.options[b.chosenIdx]?.label ?? '';
});

const chosenCost = computed(() => {
  const b = props.block;
  if (!b || b.type !== 'choices' || b.chosenIdx === undefined) return undefined;
  return b.chosenCost;
});

const speaker = computed(() => {
  const b = props.block;
  if (!b || b.type !== 'speech') return '';
  const rawId =
    b.character_id ??
    (b as unknown as { speaker?: string }).speaker ??
    '';
  if (rawId === MAIN_HERO_ID) return 'Я';
  return (props.character?.name ?? rawId).toUpperCase();
});

const speakerColor = computed<string | null>(() => {
  const b = props.block;
  if (!b || b.type !== 'speech') return null;
  if (b.character_id === MAIN_HERO_ID) return null;
  return props.character?.color ?? null;
});

const accentVars = computed<Record<string, string>>(() => {
  const c = speakerColor.value;
  const out: Record<string, string> = {};
  if (c) {
    out['--accent'] = c;
    out['--accent-glow'] = hexToRgba(c, 0.35);
  }
  return out;
});

/** Текст и класс лейбла капсулы — реактивно по displayState (синхронно с
 *  капсулой) чтобы не мигало во время leave-задержки. */
const labelText = computed(() => {
  switch (displayState.value) {
    case 'error': return 'ОШИБКА';
    case 'loading': return 'ГЕНЕРАЦИЯ';
    case 'narrator': return 'НАРРАТОР';
    case 'thought': return 'ТЫ ДУМАЕШЬ';
    case 'speech': return speaker.value;
    case 'chosen': return 'ТЫ ВЫБРАЛ';
    default: return '';
  }
});
const labelClass = computed(() => {
  switch (displayState.value) {
    case 'error': return 'error-label';
    case 'loading': return 'loading-label';
    case 'narrator': return 'narrator-label';
    case 'thought': return 'thought-label';
    case 'speech': return 'speaker-label';
    case 'chosen': return 'chosen-label';
    default: return '';
  }
});

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
}

/** Сырой текст с тегами для парсинга */
const rawText = computed(() => {
  const b = props.block;
  if (!b) return '';
  if (b.type === 'narrator' || b.type === 'thought' || b.type === 'speech') return b.text;
  return '';
});

interface PartLetter extends TaggedLetter {
  visible: boolean;
  /** Цвет для <char> тега, резолвится из characters map */
  color?: string;
  /** CSS class для tag-эффекта */
  tagClass?: string;
}

interface TextPart {
  kind: 'word' | 'gap';
  letters: PartLetter[];
}

const textParts = computed<TextPart[]>(() => {
  const raw = rawText.value;
  const visibleLen = props.displayedText.length;
  const lettersRaw = toTaggedLetters(raw);

  // обогащаем: visible, цвет для char, CSS-класс тега
  const letters: PartLetter[] = lettersRaw.map((l) => {
    const seg = l.seg;
    let tagClass: string | undefined;
    let color: string | undefined;
    if (seg) {
      switch (seg.kind) {
        case 'aggressive': tagClass = 'tag-aggressive'; break;
        case 'lewd':       tagClass = 'tag-lewd'; break;
        case 'info':       tagClass = 'tag-info'; break;
        case 'char': {
          tagClass = 'tag-char';
          const id = seg.charId;
          if (id && props.characters) {
            const ch = props.characters[id];
            if (ch?.color) color = ch.color;
          }
          break;
        }
      }
    }
    return {
      ...l,
      visible: l.cleanIdx < visibleLen,
      tagClass,
      color,
    };
  });

  // группировка в word/gap (по пробельности)
  const parts: TextPart[] = [];
  let i = 0;
  while (i < letters.length) {
    const isGap = /\s/.test(letters[i].ch);
    const start = i;
    while (i < letters.length && /\s/.test(letters[i].ch) === isGap) i++;
    parts.push({
      kind: isGap ? 'gap' : 'word',
      letters: letters.slice(start, i),
    });
  }
  return parts;
});

const caretAtEnd = computed(() => props.displayedText.length === 0);

const choicesBlock = computed(() =>
  props.block?.type === 'choices' ? props.block : null
);

/** Опции, которые сейчас должны быть видны на экране. Пусто когда state
 *  не 'choices' — тогда TransitionGroup проиграет leave для каждой кнопки
 *  индивидуально, а не unmount контейнер целиком без анимации. */
const visibleChoices = computed(() => {
  if (state.value !== 'choices') return [];
  return choicesBlock.value?.options ?? [];
});

/** Стили inline для буквы: var(--li) для волновых анимаций + цвет для char */
function letterStyle(l: PartLetter): Record<string, string> {
  const out: Record<string, string> = {
    '--li': String(l.letterInSegIdx),
  };
  if (l.color) out['--char-color'] = l.color;
  return out;
}

// ─── Высота контента → позиция кнопок (плавное перетекание) ─────────────
// Два независимых observer'а: один для капсулы (она пересоздаётся через
// Transition), второй для choices-обёртки (всегда mounted).
const capsuleHeight = ref(180);
const choicesHeight = ref(0);

let capsuleRO: ResizeObserver | null = null;
let capsuleObserved: HTMLElement | null = null;
const choicesEl = ref<HTMLElement | null>(null);
let choicesRO: ResizeObserver | null = null;

function makeRO(setter: (h: number) => void): ResizeObserver | null {
  if (typeof ResizeObserver === 'undefined') return null;
  return new ResizeObserver((entries) => {
    for (const entry of entries) {
      const h = (entry.target as HTMLElement).offsetHeight;
      if (h > 0) setter(h);
    }
  });
}

/** Function-ref на текущую (mounted) капсулу. */
function setCapsuleRef(el: unknown) {
  let next: HTMLElement | null = null;
  if (el instanceof HTMLElement) next = el;
  else if (el && typeof el === 'object') {
    const maybe = (el as { $el?: unknown }).$el;
    if (maybe instanceof HTMLElement) next = maybe;
  }
  if (next === capsuleObserved) return;
  if (capsuleRO && capsuleObserved) capsuleRO.unobserve(capsuleObserved);
  capsuleObserved = next;
  if (!next) return;
  if (!capsuleRO) capsuleRO = makeRO((h) => (capsuleHeight.value = h));
  capsuleRO?.observe(next);
}

watchEffect(() => {
  const el = choicesEl.value;
  if (!el) return;
  if (!choicesRO) choicesRO = makeRO((h) => (choicesHeight.value = h));
  if (!choicesRO) return; // ResizeObserver не поддерживается
  choicesRO.disconnect();
  choicesRO.observe(el);
});

onBeforeUnmount(() => {
  capsuleRO?.disconnect();
  choicesRO?.disconnect();
  capsuleRO = null;
  choicesRO = null;
  capsuleObserved = null;
});

const contentHeight = computed(() =>
  displayState.value === 'choices' ? choicesHeight.value : capsuleHeight.value
);
const panelStyle = computed(() => ({
  '--content-height': `${contentHeight.value || 180}px`,
}));
</script>

<template>
  <div class="panel-root" :style="panelStyle">
    <div v-if="displayState === 'choices'" class="choice-backdrop" />

    <!-- Кнопки на уровне panel-root — НЕ пересоздаются между state-блоками.
         Их bottom вычисляется через --content-height с CSS transition,
         поэтому они плавно скользят, а не перескакивают. -->
    <CloseButton class="floating-close" @close="emit('close')" />
    <BackButton
      class="floating-back"
      :disabled="!canGoBack"
      @back="emit('back')"
    />

    <!-- ОСНОВНОЙ WRAP: все state кроме choices.
         Только сама капсула меняется в Transition с независимым pivot. -->
    <div
      v-if="displayState !== 'choices'"
      class="capsule-wrap"
      :style="displayState === 'speech' ? accentVars : undefined"
    >
      <div class="label" :class="labelClass">{{ labelText }}</div>

      <!-- appear — анимировать enter и при первом mount контейнера
           (когда возвращаемся из choices, capsule-wrap создаётся заново,
           и без appear капсула просто появлялась без pop-анимации) -->
      <Transition name="liquid-glass" mode="out-in" appear>
        <!-- ОШИБКА -->
        <LiquidGlass
          v-if="displayState === 'error'"
          key="error"
          :ref="setCapsuleRef"
          as="button"
          class="capsule error-capsule"
          @press="emit('retry')"
        >
          <p class="text error-text">
            {{ error }}
            <br><br>
            <span class="error-retry">Тап чтобы попробовать ещё раз</span>
          </p>
        </LiquidGlass>

        <!-- LOADING -->
        <LiquidGlass
          v-else-if="displayState === 'loading'"
          key="loading"
          :ref="setCapsuleRef"
          as="div"
          class="capsule loading-capsule"
          :interactive="false"
        >
          <div class="shimmer-line w-full" />
          <div class="shimmer-line w-90" />
          <div class="shimmer-line w-70" />
        </LiquidGlass>

        <!-- НАРРАТОР -->
        <LiquidGlass
          v-else-if="displayState === 'narrator'"
          key="narrator"
          :ref="setCapsuleRef"
          as="div"
          class="capsule"
          @press="emit('advance')"
        >
          <p class="text narrator-text">
            <span v-if="caretAtEnd" class="caret" aria-hidden="true" />
            <template v-for="(part, pi) in textParts" :key="pi">
              <span v-if="part.kind === 'word'" class="word">
                <template v-for="l in part.letters" :key="l.cleanIdx">
                  <span class="letter" :class="[{ visible: l.visible }, l.tagClass]" :style="letterStyle(l)">{{ l.ch }}</span>
                  <span v-if="l.cleanIdx + 1 === props.displayedText.length" class="caret" aria-hidden="true" />
                </template>
              </span>
              <template v-else>
                <template v-for="l in part.letters" :key="l.cleanIdx">{{ l.ch }}<span v-if="l.cleanIdx + 1 === props.displayedText.length" class="caret" aria-hidden="true" /></template>
              </template>
            </template>
          </p>
        </LiquidGlass>

        <!-- МЫСЛИ ГГ -->
        <LiquidGlass
          v-else-if="displayState === 'thought'"
          key="thought"
          :ref="setCapsuleRef"
          as="div"
          class="capsule"
          @press="emit('advance')"
        >
          <p class="text thought-text">
            <span v-if="caretAtEnd" class="caret" aria-hidden="true" />
            <template v-for="(part, pi) in textParts" :key="pi">
              <span v-if="part.kind === 'word'" class="word">
                <template v-for="l in part.letters" :key="l.cleanIdx">
                  <span class="letter" :class="[{ visible: l.visible }, l.tagClass]" :style="letterStyle(l)">{{ l.ch }}</span>
                  <span v-if="l.cleanIdx + 1 === props.displayedText.length" class="caret" aria-hidden="true" />
                </template>
              </span>
              <template v-else>
                <template v-for="l in part.letters" :key="l.cleanIdx">{{ l.ch }}<span v-if="l.cleanIdx + 1 === props.displayedText.length" class="caret" aria-hidden="true" /></template>
              </template>
            </template>
          </p>
        </LiquidGlass>

        <!-- РЕПЛИКА ПЕРСОНАЖА -->
        <LiquidGlass
          v-else-if="displayState === 'speech'"
          key="speech"
          :ref="setCapsuleRef"
          as="div"
          class="capsule"
          @press="emit('advance')"
        >
          <p class="text character-text">
            <span v-if="caretAtEnd" class="caret caret-lg" aria-hidden="true" />
            <template v-for="(part, pi) in textParts" :key="pi">
              <span v-if="part.kind === 'word'" class="word">
                <template v-for="l in part.letters" :key="l.cleanIdx">
                  <span class="letter" :class="[{ visible: l.visible }, l.tagClass]" :style="letterStyle(l)">{{ l.ch }}</span>
                  <span v-if="l.cleanIdx + 1 === props.displayedText.length" class="caret caret-lg" aria-hidden="true" />
                </template>
              </span>
              <template v-else>
                <template v-for="l in part.letters" :key="l.cleanIdx">{{ l.ch }}<span v-if="l.cleanIdx + 1 === props.displayedText.length" class="caret caret-lg" aria-hidden="true" /></template>
              </template>
            </template>
          </p>
        </LiquidGlass>

        <!-- ВЫБОР УЖЕ СДЕЛАН -->
        <LiquidGlass
          v-else-if="displayState === 'chosen'"
          key="chosen"
          :ref="setCapsuleRef"
          as="div"
          class="capsule chosen-capsule"
          @press="emit('advance')"
        >
          <p class="chosen-text">
            <span class="chosen-arrow">→</span>
            {{ chosenLabel }}
            <span v-if="chosenCost !== undefined" class="chosen-cost">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="var(--accent)" aria-hidden="true">
                <path d="M3 5.5l3-3.5h4l3 3.5-5 8.5-5-8.5z" stroke="var(--accent)" stroke-width="0.6" stroke-linejoin="round" />
              </svg>
              {{ chosenCost }}
            </span>
          </p>
        </LiquidGlass>
      </Transition>
    </div>

    <!-- ВЫБОР: контейнер всегда mounted (для leave-stagger вариантов).
         Высоту измеряем на внутреннем div-обёртке (она точно охватывает
         все варианты + gap). -->
    <div class="choices">
      <div ref="choicesEl" class="choices-measure">
      <TransitionGroup name="liquid-glass" tag="div" class="choices-list">
        <LiquidGlass
          v-for="(o, i) in visibleChoices"
          :key="`opt-${i}`"
          as="button"
          class="choice-btn"
          :class="o.cost !== undefined ? 'paid' : 'free'"
          :scale-to="1.03"
          :style="{ '--lg-stagger': i * 80 + 'ms' }"
          @press="emit('choose', i)"
        >
          <span class="choice-label">{{ o.label }}</span>
          <span v-if="o.cost !== undefined" class="cost">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="#000" aria-hidden="true">
              <path d="M3 5.5l3-3.5h4l3 3.5-5 8.5-5-8.5z" stroke="#000" stroke-width="0.6" stroke-linejoin="round" />
              <path d="M3 5.5h10M6 2l2 3.5 2-3.5M8 5.5L8 14" stroke="rgba(0,0,0,0.28)" stroke-width="0.5" fill="none" />
            </svg>
            {{ o.cost }}
          </span>
        </LiquidGlass>
      </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-root {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}

.choice-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  pointer-events: auto;
}

.capsule-wrap {
  position: absolute;
  bottom: calc(84px + env(safe-area-inset-bottom, 4px));
  left: 14px;
  right: 14px;
  pointer-events: auto;
}

/* ─── floating back/close — позиция от высоты контента ─────────────── */
/* --content-height обновляется через ResizeObserver на capsule-wrap/choices.
   bottom: базовый отступ (84+safe) + высота контента + зазор. CSS transition
   даёт плавное скольжение когда высота меняется. */
.floating-back {
  position: absolute;
  right: 18px;
  bottom: calc(
    84px + env(safe-area-inset-bottom, 4px) + var(--content-height, 180px) + 12px
  );
  z-index: 6;
  pointer-events: auto;
  transition: bottom 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.floating-close {
  position: absolute;
  right: 18px;
  bottom: calc(
    84px + env(safe-area-inset-bottom, 4px) + var(--content-height, 180px) + 12px + 44px + 8px
  );
  z-index: 7;
  pointer-events: auto;
  transition: bottom 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.label {
  margin-bottom: 12px;
  margin-left: 16px;
}
.narrator-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.55);
}
.thought-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 2px;
  color: rgba(180, 220, 255, 0.65);
}
.loading-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.4);
}
.chosen-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 2px;
  color: rgba(212, 255, 0, 0.65);
}
.error-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 2px;
  color: rgba(255, 120, 120, 0.85);
}
.speaker-label {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1.8px;
  color: var(--accent);
  text-shadow: 0 0 14px var(--accent-glow);
}

.capsule {
  padding: 22px;
  border-radius: var(--radius-capsule);
  box-sizing: border-box;
  transition: transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.text {
  margin: 0;
  letter-spacing: -0.25px;
  font-weight: 400;
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}
.narrator-text {
  font-size: 17px;
  line-height: 1.5;
  font-style: italic;
}
.thought-text {
  font-size: 17px;
  line-height: 1.5;
  font-style: italic;
  color: rgba(220, 235, 255, 0.95);
}
.character-text {
  font-size: 18.5px;
  line-height: 1.4;
  letter-spacing: -0.4px;
  color: #fff;
}

.error-capsule {
  cursor: pointer;
}
.error-text {
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 200, 200, 0.92);
  word-break: break-word;
}
.error-retry {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
}

.word {
  white-space: nowrap;
}

.letter {
  display: inline-block;
  opacity: 0;
  transform: translateY(4px) scale(0.78);
  transform-origin: 50% 70%;
  will-change: transform, opacity;
}
.letter.visible {
  animation: vn-letter-pop 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.caret {
  display: inline-block;
  width: 8px;
  height: 17px;
  margin-left: 4px;
  background: var(--accent);
  vertical-align: -2px;
  border-radius: 1px;
  box-shadow: 0 0 10px var(--accent-glow);
  animation: vn-blink 1.1s infinite;
}
.caret.caret-lg {
  width: 9px;
  height: 18px;
  vertical-align: -3px;
  box-shadow: 0 0 12px var(--accent-glow);
}

/* ═══════════════════════════════════════════════════════════════
   INLINE TAG EFFECTS
   <aggressive> — красный bold + локальное дрожание каждой буквы
   <lewd>       — розовый bold + волна слева направо
   <info>       — жёлтый bold + glow, без letter-level анимации
   <char id>    — цвет персонажа (через --char-color, ставится inline)
   ═══════════════════════════════════════════════════════════════ */

/* AGGRESSIVE */
.letter.tag-aggressive {
  color: #ff3b30;
  font-weight: 800;
  text-shadow: 0 0 6px rgba(255, 59, 48, 0.45);
}
.letter.tag-aggressive.visible {
  animation:
    vn-letter-pop 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
    vn-tremble 0.16s infinite both;
  animation-delay:
    0ms,
    calc(280ms + var(--li, 0) * 23ms);
}
@keyframes vn-tremble {
  0%   { transform: translate(0, 0) rotate(0); }
  25%  { transform: translate(-0.6px, -0.4px) rotate(-1.2deg); }
  50%  { transform: translate(0.6px, 0.4px) rotate(1.2deg); }
  75%  { transform: translate(-0.4px, 0.5px) rotate(-0.6deg); }
  100% { transform: translate(0.4px, -0.5px) rotate(0.6deg); }
}

/* LEWD */
.letter.tag-lewd {
  color: #ff5fb1;
  font-weight: 800;
  text-shadow: 0 0 8px rgba(255, 95, 177, 0.55);
}
.letter.tag-lewd.visible {
  transform-origin: 50% 100%;
  animation:
    vn-letter-pop 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
    vn-wave 1.6s ease-in-out infinite both;
  animation-delay:
    0ms,
    calc(280ms + var(--li, 0) * 90ms);
}
@keyframes vn-wave {
  0%, 60%, 100% { transform: scale(1) translateY(0); }
  20%           { transform: scale(1.30) translateY(-3px); }
  35%           { transform: scale(1.10) translateY(-1px); }
}

/* INFO */
.letter.tag-info {
  color: #ffd60a;
  font-weight: 800;
  text-shadow: 0 0 8px rgba(255, 214, 10, 0.5);
  letter-spacing: 0.2px;
}

/* CHAR (цвет передаётся через --char-color inline-стилем) */
.letter.tag-char {
  color: var(--char-color, currentColor);
  font-weight: 700;
  text-shadow: 0 0 6px color-mix(in srgb, var(--char-color, #fff) 35%, transparent);
}

/* ─── chosen (read-only выбор при перемотке назад) ─────────── */
.chosen-capsule {
  cursor: pointer;
  padding: 16px 22px;
}
.chosen-text {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  gap: 10px;
}
.chosen-arrow {
  color: var(--accent);
  font-weight: 700;
  font-size: 18px;
  text-shadow: 0 0 8px var(--accent-glow);
  flex-shrink: 0;
}
.chosen-cost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  flex-shrink: 0;
}

/* ─── loading shimmer ─────────────────────────────────────────── */
.loading-capsule {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 90px;
}
.shimmer-line {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.16) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
  animation: vn-shimmer 1.4s linear infinite;
}
.w-full { width: 100%; }
.w-90 { width: 90%; }
.w-70 { width: 70%; }

@keyframes vn-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ─── choices ──────────────────────────────────────────────────── */
.choices {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: calc(84px + env(safe-area-inset-bottom, 4px));
  z-index: 2;
  pointer-events: auto;
}
.choices-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.choice-btn {
  width: 100%;
  padding: 18px 22px;
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-size: 15.5px;
  letter-spacing: -0.3px;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  border: none;
}
.choice-btn.free {
  color: #fff;
  font-weight: 500;
}
/* Paid-кнопка — тот же LiquidGlass, переопределяет CSS-переменные на accent. */
.choice-btn.paid {
  --glass-bg: rgba(212, 255, 0, 0.92);
  --glass-border: rgba(255, 255, 255, 0.4);
  --glass-highlight: rgba(255, 255, 255, 0.65);
  --glass-shadow:
    var(--glass-inset),
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(0, 0, 0, 0.15),
    0 14px 40px rgba(212, 255, 0, 0.45),
    0 4px 12px rgba(212, 255, 0, 0.35);
  color: #000;
  font-weight: 600;
}
.choice-label {
  flex: 1;
  position: relative;
  z-index: 1;
}
.cost {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  color: #000;
  flex: 0 0 auto;
  position: relative;
  z-index: 1;
}
</style>
