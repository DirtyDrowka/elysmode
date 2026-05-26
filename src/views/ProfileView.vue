<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import LiquidGlass from '../components/LiquidGlass.vue';
import TitlePill from '../components/TitlePill.vue';
import TextField from '../components/TextField.vue';
import VoicePicker from '../components/VoicePicker.vue';
import { getProfile, saveProfile, setProfileImage } from '../services/profile';
import { useUserProfile } from '../composables/useUserProfile';
import { generateCharacterImage } from '../services/openrouter';

const userProfile = useUserProfile();

const PLACEHOLDER_URL = '/sprites/placeholder.webp';

// Цветовая палитра — 24 пресета (по hue от lime через зелёный/циан/синий/
// фиолетовый/розовый/красный/оранжевый/жёлтый, + нейтрали). Первый — accent.
const COLOR_PRESETS = [
  '#d4ff00', // accent lime
  '#a3e635', // зелёный лайм
  '#34d399', // изумрудный
  '#10b981', // тёмный изумрудный
  '#14b8a6', // бирюзовый
  '#06b6d4', // циан
  '#3ec1ff', // голубой
  '#38bdf8', // небесный
  '#6366f1', // индиго
  '#a78bfa', // фиолетовый
  '#c084fc', // сиреневый
  '#e879f9', // фуксия
  '#f0abfc', // розовый-фуксия
  '#ff4d6d', // розовый
  '#f43f5e', // красно-розовый
  '#ef4444', // красный
  '#fb923c', // оранжевый
  '#f59e0b', // амбер
  '#fcd34d', // жёлтый
  '#eab308', // тёмный жёлтый
  '#a8a29e', // тёплый серый
  '#71717a', // серый
  '#1f2937', // угольный
  '#f8fafc', // белый
];

// ─── форма ──────────────────────────────────────────────────────────────
const name = ref('');
const gender = ref<'male' | 'female' | null>(null);
const voiceId = ref<string | null>(null);
const color = ref<string>(COLOR_PRESETS[0]);
const personality = ref('');
const appearance = ref('');

// Возраст НЕ хранится в БД — это локальный параметр UI исключительно для
// фильтрации голосов ElevenLabs в VoicePicker'е. Сохраняем в localStorage,
// чтобы при следующем открытии вкладки сразу был тот же фильтр и тот же
// набор голосов фетчился по нему. Дефолт — «young».
type Age = 'young' | 'middle_aged' | 'old';
const AGE_LS_KEY = 'elysmode_profile_age';

function readSavedAge(): Age {
  if (typeof localStorage === 'undefined') return 'young';
  const v = localStorage.getItem(AGE_LS_KEY);
  return v === 'young' || v === 'middle_aged' || v === 'old' ? v : 'young';
}

const age = ref<Age>(readSavedAge());

// Сохраняем выбор сразу при смене — VoicePicker увидит новое значение
// через props.age и сделает refetch.
watch(age, (v) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(AGE_LS_KEY, v);
});

// imageUrl null → шиммер-плейсхолдер
const imageUrl = ref<string | null>(null);

// Snapshot последнего сохранённого состояния — нужен для двух вещей:
// 1) понять что изменилась внешность → надо перегенерировать портрет;
// 2) показывать кнопку «Сохранить» только если есть несохранённые изменения.
interface ProfileSnapshot {
  name: string;
  gender: 'male' | 'female' | null;
  voiceId: string | null;
  color: string;
  personality: string;
  appearance: string;
}
const savedSnapshot = ref<ProfileSnapshot | null>(null);

// Состояния
const loading = ref(true); // первичная загрузка профиля
const saving = ref(false); // POST /api/profile в полёте
const generating = ref(false); // /api/generate/character + setProfileImage в полёте
const errorMsg = ref<string | null>(null);

/** Есть ли несохранённые изменения по сравнению со snapshot'ом. */
const hasChanges = computed(() => {
  // новый профиль (snapshot пусто) — кнопка появляется как только введено имя
  if (!savedSnapshot.value) return name.value.trim().length > 0;
  const s = savedSnapshot.value;
  // age НЕ участвует — это UI-фильтр для VoicePicker'а, не сохраняемое поле
  return (
    s.name !== name.value.trim() ||
    s.gender !== gender.value ||
    s.voiceId !== voiceId.value ||
    s.color !== color.value ||
    s.personality !== personality.value.trim() ||
    s.appearance !== appearance.value.trim()
  );
});

const canSave = computed(
  () => hasChanges.value && !saving.value && !loading.value
);

// Картинка которую реально показываем + ставим shimmer если плейсхолдер.
const displayedImage = computed(() => {
  const isReal = !!imageUrl.value && !generating.value;
  return {
    src: isReal ? (imageUrl.value as string) : PLACEHOLDER_URL,
    placeholder: !isReal,
  };
});

onMounted(async () => {
  try {
    const p = await getProfile();
    if (p) {
      name.value = p.name;
      gender.value = (p.gender as 'male' | 'female' | null) ?? null;
      voiceId.value = p.voiceId;
      color.value = p.color || COLOR_PRESETS[0];
      personality.value = p.personality;
      appearance.value = p.appearance;
      imageUrl.value = p.imageUrl;
      savedSnapshot.value = {
        name: p.name,
        gender: (p.gender as 'male' | 'female' | null) ?? null,
        voiceId: p.voiceId,
        color: p.color || COLOR_PRESETS[0],
        personality: p.personality,
        appearance: p.appearance,
      };
    }
  } catch (e) {
    console.error('[profile] load failed:', e);
    errorMsg.value = 'Не удалось загрузить профиль';
  } finally {
    loading.value = false;
  }
});

async function onSave() {
  if (!canSave.value) return;
  errorMsg.value = null;
  saving.value = true;
  try {
    const prevAppearance = savedSnapshot.value?.appearance.trim() ?? '';
    const needsRegen =
      !imageUrl.value || appearance.value.trim() !== prevAppearance;

    // Если перерисовываем — сразу гасим imageUrl чтобы пользователь видел
    // шиммер на loading-tyan, а не старую картинку.
    if (needsRegen) imageUrl.value = null;

    const saved = await saveProfile({
      name: name.value.trim(),
      gender: gender.value,
      voiceId: voiceId.value,
      color: color.value,
      personality: personality.value.trim(),
      appearance: appearance.value.trim(),
      imageUrl: needsRegen ? null : imageUrl.value,
    });

    // если бэк подобрал voice_id сам (когда юзер ничего не выбрал) — синхронимся
    if (saved.voiceId) voiceId.value = saved.voiceId;

    // обновляем snapshot после успешного save — кнопка скроется
    savedSnapshot.value = {
      name: saved.name,
      gender: (saved.gender as 'male' | 'female' | null) ?? null,
      voiceId: saved.voiceId,
      color: saved.color,
      personality: saved.personality,
      appearance: saved.appearance,
    };
    // и сразу пере-фетчим singleton — следующая генерация увидит новое описание
    void userProfile.refresh();

    if (!needsRegen && saved.imageUrl) {
      imageUrl.value = saved.imageUrl;
    }

    if (needsRegen) {
      // Запускаем генерацию ФОНОМ — пользователь видит shimmer, может
      // ходить по другим вкладкам. Когда придёт — обновим.
      void runGeneration(saved.appearance);
    }
  } catch (e) {
    console.error('[profile] save failed:', e);
    errorMsg.value = 'Не удалось сохранить';
  } finally {
    saving.value = false;
  }
}

function onGenderPress(info: { x: number; y: number }) {
  // pos.x в процентах 0..100 — левая половина = female, правая = male
  gender.value = info.x < 50 ? 'female' : 'male';
}

function onAgePress(info: { x: number; y: number }) {
  // 3 секции — делим 0..100 на трети
  if (info.x < 33.33) age.value = 'young';
  else if (info.x < 66.66) age.value = 'middle_aged';
  else age.value = 'old';
}

// индекс активной age-секции для CSS-класса thumb'а
const ageIndex = computed(() => {
  if (age.value === 'middle_aged') return 1;
  if (age.value === 'old') return 2;
  return 0; // young или null
});

async function runGeneration(promptText: string) {
  generating.value = true;
  try {
    const url = await generateCharacterImage(promptText);
    await setProfileImage(url);
    imageUrl.value = url;
  } catch (e) {
    console.error('[profile] image gen failed:', e);
    errorMsg.value = 'Не удалось сгенерировать портрет — попробуй ещё раз';
  } finally {
    generating.value = false;
  }
}

// ─── pinch-zoom + rotate на спрайте ─────────────────────────────────────
// Двумя пальцами — масштаб и поворот. Пока активно: scroll body заблокирован,
// overlay поверх всего блюрит и затемняет. Отпустил палец — пружинистый
// возврат к scale=1, rotation=0.
const scale = ref(1);
const rotation = ref(0); // в градусах
const translateX = ref(0); // px
const translateY = ref(0); // px
const isGesturing = ref(false);

let startDistance = 0;
let startAngle = 0;
let startScale = 1;
let startRotation = 0;
let startMidX = 0;
let startMidY = 0;
let startTranslateX = 0;
let startTranslateY = 0;
let prevBodyOverflow = '';

function onCharTouchStart(e: TouchEvent) {
  if (e.touches.length < 2) return;
  const [t1, t2] = [e.touches[0], e.touches[1]];
  startDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  startAngle = Math.atan2(t1.clientY - t2.clientY, t1.clientX - t2.clientX);
  startMidX = (t1.clientX + t2.clientX) / 2;
  startMidY = (t1.clientY + t2.clientY) / 2;
  startScale = scale.value;
  startRotation = rotation.value;
  startTranslateX = translateX.value;
  startTranslateY = translateY.value;
  isGesturing.value = true;
  // блокируем скролл всего документа на время жеста
  prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
}

function onCharTouchMove(e: TouchEvent) {
  if (!isGesturing.value || e.touches.length < 2) return;
  e.preventDefault();
  const [t1, t2] = [e.touches[0], e.touches[1]];

  // расстояние → scale
  const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  const rawScale = startScale * (d / startDistance || 1);
  scale.value = Math.max(0.4, Math.min(4, rawScale));

  // угол → rotation
  const a = Math.atan2(t1.clientY - t2.clientY, t1.clientX - t2.clientX);
  rotation.value = startRotation + (a - startAngle) * (180 / Math.PI);

  // midpoint → translation: спрайт следует за центром между пальцами
  const midX = (t1.clientX + t2.clientX) / 2;
  const midY = (t1.clientY + t2.clientY) / 2;
  translateX.value = startTranslateX + (midX - startMidX);
  translateY.value = startTranslateY + (midY - startMidY);
}

function onCharTouchEnd(e: TouchEvent) {
  // когда остаётся < 2 пальцев — заканчиваем жест и пружиним назад
  if (e.touches.length >= 2) return;
  if (!isGesturing.value) return;
  isGesturing.value = false;
  scale.value = 1;
  rotation.value = 0;
  translateX.value = 0;
  translateY.value = 0;
  document.body.style.overflow = prevBodyOverflow;
}

// translate ПЕРВЫЙ в transform-цепочке: так пиксельный сдвиг от пальцев не
// зависит от scale — палец двинулся на 10px, спрайт тоже на 10px.
const charTransform = computed(() => ({
  transform:
    `translate(${translateX.value}px, ${translateY.value}px) ` +
    `scale(${scale.value}) rotate(${rotation.value}deg)`,
  transition: isGesturing.value
    ? 'none'
    : 'transform 480ms cubic-bezier(0.34, 1.5, 0.5, 1)',
}));

// На случай размонтирования во время жеста — снимаем body lock
onBeforeUnmount(() => {
  if (isGesturing.value) document.body.style.overflow = prevBodyOverflow;
});
</script>

<template>
  <TitlePill title="Профиль" />

  <div class="profile-wrap">
    <!-- Картинка персонажа: 3/5 экрана, по центру.
         2-palmer touch → pinch-zoom + rotate с overlay. -->
    <div class="char-area">
      <div
        class="char-frame"
        :class="{
          'char-frame--placeholder': displayedImage.placeholder,
          'char-frame--gesturing': isGesturing,
        }"
        :style="charTransform"
        @touchstart.passive="onCharTouchStart"
        @touchmove="onCharTouchMove"
        @touchend="onCharTouchEnd"
        @touchcancel="onCharTouchEnd"
      >
        <img
          :src="displayedImage.src"
          alt="character"
          class="char-img"
          draggable="false"
        />
        <div
          v-if="displayedImage.placeholder"
          class="shimmer"
          aria-hidden="true"
        />
      </div>
    </div>

    <!-- Форма -->
    <div class="form">
      <!-- Имя -->
      <TextField
        v-model="name"
        label="Имя"
        placeholder="Как тебя зовут"
        :maxlength="48"
      />

      <!-- Пол: liquid-glass капсула с плавающим thumb'ом. -->
      <div class="field">
        <span class="field-label">Пол</span>
        <LiquidGlass
          as="div"
          class="seg"
          :scale-to="1.02"
          @press="onGenderPress"
        >
          <LiquidGlass
            as="div"
            class="seg-thumb seg-thumb--2"
            :class="`seg-thumb--g${gender === 'male' ? '1' : '0'}`"
            :interactive="false"
            aria-hidden="true"
          />
          <span class="seg-label" :class="{ active: gender === 'female' }">Жен</span>
          <span class="seg-label" :class="{ active: gender === 'male' }">Муж</span>
        </LiquidGlass>
      </div>

      <!-- Возраст: тот же сегментед, 3 опции. -->
      <div class="field">
        <span class="field-label">Возраст</span>
        <LiquidGlass
          as="div"
          class="seg"
          :scale-to="1.02"
          @press="onAgePress"
        >
          <LiquidGlass
            as="div"
            class="seg-thumb seg-thumb--3"
            :class="`seg-thumb--a${ageIndex}`"
            :interactive="false"
            aria-hidden="true"
          />
          <span class="seg-label" :class="{ active: age === 'young' }">Молодой</span>
          <span class="seg-label" :class="{ active: age === 'middle_aged' }">Средний</span>
          <span class="seg-label" :class="{ active: age === 'old' }">Старый</span>
        </LiquidGlass>
      </div>

      <!-- Голос: top-10 голосов с ElevenLabs по gender+age. -->
      <div class="field">
        <span class="field-label">Голос</span>
        <VoicePicker
          v-model="voiceId"
          :gender="gender"
          :age="age"
        />
      </div>

      <!-- Цвет: каждый swatch в своей liquid-glass капсуле -->
      <div class="field">
        <span class="field-label">Цвет</span>
        <div class="color-row">
          <LiquidGlass
            v-for="c in COLOR_PRESETS"
            :key="c"
            as="button"
            class="color-cap"
            :class="{ 'color-cap--active': color === c }"
            :scale-to="1.08"
            @press="color = c"
            :aria-label="`color ${c}`"
          >
            <span class="color-dot" :style="{ background: c }" />
          </LiquidGlass>
        </div>
      </div>

      <!-- Характер -->
      <TextField
        v-model="personality"
        label="Характер"
        placeholder="Спокойный, любопытный, циничный…"
        multiline
        :rows="3"
        :maxlength="400"
      />

      <!-- Внешность -->
      <TextField
        v-model="appearance"
        label="Внешность"
        placeholder="Тёмные волосы до плеч, серая толстовка…"
        multiline
        :rows="4"
        :maxlength="600"
      />

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>
  </div>

  <!-- Закреплённая кнопка Сохранить — поверх TabBar.
       Появляется только при наличии несохранённых изменений; на enter/leave
       стандартная liquid-glass поп-анимация. -->
  <Transition name="liquid-glass">
    <LiquidGlass
      v-if="hasChanges"
      as="button"
      class="save-btn"
      :scale-to="1.04"
      @press="onSave"
    >
      <span v-if="saving">Сохраняю…</span>
      <span v-else-if="generating">Сохранено · Генерирую портрет…</span>
      <span v-else>Сохранить</span>
    </LiquidGlass>
  </Transition>

  <!-- Edge-fades: градиентное размытие + затемнение сверху и снизу.
       Заходит за safe-area-inset (за дедзоны статусбара / home-indicator).
       Делает плавный fade прокручиваемого контента. pointer-events:none. -->
  <div class="page-fade page-fade--top" aria-hidden="true" />
  <div class="page-fade page-fade--bottom" aria-hidden="true" />

  <!-- Overlay для затемнения + блюра пока активен pinch-zoom жест.
       fixed inset:0 — перекрывает всё включая TabBar. pointer-events:none —
       не мешает дальнейшим touch-событиям на спрайте, который выше по z. -->
  <div class="gesture-overlay" :class="{ active: isGesturing }" aria-hidden="true" />
</template>

<style scoped>
.profile-wrap {
  position: absolute;
  inset: 0;
  padding: calc(60px + env(safe-area-inset-top, 0px)) 14px
    calc(90px + env(safe-area-inset-bottom, 4px) + 70px);
  box-sizing: border-box;
  overflow-y: auto;
  background: #000;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ─── Картинка персонажа: 3/5 экрана ────────────────────────────────── */
.char-area {
  /* 3/5 от высоты viewport, минус место под title (~60px) */
  height: 55vh;
  min-height: 280px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative;
}

.char-frame {
  position: relative;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transform-origin: center center;
  will-change: transform;
  /* блокируем default-жесты браузера на этой области, чтобы наш
     pinch-zoom не конкурировал с системным zoom страницы */
  touch-action: none;
  z-index: 1;
}
/* во время жеста sprite поднимается выше overlay (z-index 12) */
.char-frame--gesturing {
  z-index: 20;
}

.char-img {
  display: block;
  height: 100%;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  object-position: bottom center;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

/* shimmer-блик, маскированный альфой плейсхолдера — копия из CharacterLayer */
.shimmer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  -webkit-mask-image: v-bind('`url("${PLACEHOLDER_URL}")`');
          mask-image: v-bind('`url("${PLACEHOLDER_URL}")`');
  -webkit-mask-size: contain;
          mask-size: contain;
  -webkit-mask-position: bottom center;
          mask-position: bottom center;
  -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
  background-repeat: no-repeat;
  background-image: linear-gradient(
    115deg,
    transparent 0%,
    transparent 46%,
    rgba(255, 255, 255, 0.10) 48%,
    rgba(255, 255, 255, 0.22) 50%,
    rgba(255, 255, 255, 0.10) 52%,
    transparent 54%,
    transparent 100%
  );
  background-size: 220% 100%;
  background-position: 200% 0;
  animation: shimmer-sweep 6s linear infinite;
  mix-blend-mode: screen;
  will-change: background-position;
}
@keyframes shimmer-sweep {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}

/* ─── Форма ─────────────────────────────────────────────────────────── */
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  /* единый отступ со всеми лейблами: начало от точки скругления капсул ниже */
  padding-left: 22px;
}

/* Liquid-glass segmented control — пол.
   .seg — внешняя капсула (LiquidGlass), .seg-thumb — внутренняя такая же
   плавающая капсула. Никаких --glass-* override'ов — берём как есть. */
.seg {
  position: relative;
  display: flex;
  padding: 4px;
  border-radius: 999px;
  height: 50px;
  box-sizing: border-box;
}

.seg-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  height: calc(100% - 8px);
  border-radius: 999px;
  z-index: 1;
  transition: transform 360ms cubic-bezier(0.4, 0.0, 0.2, 1);
  will-change: transform;
  pointer-events: none;
}
/* 2-position thumb (пол) */
.seg-thumb--2 { width: calc((100% - 8px) / 2); }
.seg-thumb--g0 { transform: translateX(0%); }
.seg-thumb--g1 { transform: translateX(100%); }

/* 3-position thumb (возраст) */
.seg-thumb--3 { width: calc((100% - 8px) / 3); }
.seg-thumb--a0 { transform: translateX(0%); }
.seg-thumb--a1 { transform: translateX(100%); }
.seg-thumb--a2 { transform: translateX(200%); }

.seg-label {
  position: relative;
  z-index: 2;
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.55);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  height: 100%;
  pointer-events: none; /* клики ловит корневой LiquidGlass */
  transition: color 220ms ease;
  user-select: none;
}
.seg-label.active {
  color: #fff;
  font-weight: 700;
}

/* Цвет — каждый swatch обёрнут в liquid-glass капсулу */
.color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 4px 2px;
}
.color-cap {
  width: 44px;
  height: 44px;
  padding: 5px; /* внутренний отступ между капсулой и цветом */
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 220ms ease;
}
.color-cap--active {
  /* подсветка вокруг активной капсулы */
  box-shadow:
    var(--glass-shadow),
    0 0 0 2px rgba(255, 255, 255, 0.5),
    0 0 14px rgba(255, 255, 255, 0.18);
}
.color-dot {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  pointer-events: none;
}

.error {
  color: #ff6b6b;
  font-family: var(--font-sans);
  font-size: 13px;
  margin: 0;
  padding: 0 4px;
}

/* ─── Кнопка Сохранить (стиль new-story-btn) ────────────────────────── */
.save-btn {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: calc(78px + env(safe-area-inset-bottom, 4px) + 10px);
  z-index: 11;

  /* Зелёная капля стекла: альфа понижена чтобы под фон проступал
     backdrop-blur — liquid-glass всегда блюрит то, что за ним. */
  --glass-bg: rgba(212, 255, 0, 0.7);
  --glass-border: rgba(255, 255, 255, 0.4);
  --glass-highlight: rgba(255, 255, 255, 0.65);
  --glass-blur: blur(40px) saturate(180%);
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
/* ─── Edge fades сверху и снизу ──────────────────────────────────────
   Полоса с blur+тёмным градиентом. Заходит за safe-area (статусбар / home
   indicator), чтобы при скролле контент плавно «утопал» в дедзоне, а не
   обрывался резкой границей. pointer-events:none — клики проходят насквозь. */
.page-fade {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 10;
  -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
}
.page-fade--top {
  /* фейд + чуть за дедзону наверх (отрицательный top на размер safe-area) */
  top: calc(-1 * env(safe-area-inset-top, 0px));
  height: calc(74px + env(safe-area-inset-top, 0px));
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.85) 0%,
    rgba(0, 0, 0, 0.55) 55%,
    rgba(0, 0, 0, 0) 100%
  );
  /* mask: чтобы сам блюр-эффект тоже плавно затухал к низу полосы */
  -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 55%, transparent 100%);
          mask-image: linear-gradient(180deg, #000 0%, #000 55%, transparent 100%);
}
.page-fade--bottom {
  /* заходит за home-indicator снизу */
  bottom: calc(-1 * env(safe-area-inset-bottom, 0px));
  height: calc(140px + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.85) 0%,
    rgba(0, 0, 0, 0.55) 55%,
    rgba(0, 0, 0, 0) 100%
  );
  -webkit-mask-image: linear-gradient(0deg, #000 0%, #000 55%, transparent 100%);
          mask-image: linear-gradient(0deg, #000 0%, #000 55%, transparent 100%);
}

/* ─── Overlay при pinch-жесте ───────────────────────────────────────── */
/* fixed inset:0 — перекрывает phone-frame целиком, включая TabBar и
   нижнюю кнопку. pointer-events:none — клики/тапы не блокируем (хотя
   во время жеста body.overflow=hidden + touch-action:none на спрайте
   фактически блокируют всё лишнее). */
.gesture-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.55);
  -webkit-backdrop-filter: blur(14px);
          backdrop-filter: blur(14px);
  opacity: 0;
  z-index: 12;
  transition: opacity 280ms ease;
}
.gesture-overlay.active {
  opacity: 1;
}
</style>
