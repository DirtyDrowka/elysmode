// Динамический движок: цепочка блоков, последние 10 сцен в памяти,
// генерация через OpenRouter. Фоны генерятся отдельно через image-модель,
// портреты — через бекенд (Recraft via OpenRouter).

import { ref, reactive, computed, watch, onScopeDispose } from 'vue';
import type {
  ChainBlock,
  Character,
  DisplayBlock,
  HistoryEntry,
  LocationState,
} from './blocks';
import { MAIN_HERO_ID } from './blocks';
import {
  streamChain,
  generateBackground,
  generateCharacterImage,
  type Message,
} from '../services/openrouter';
import { buildSystemPrompt } from './systemPrompt';
import { api } from '../services/api';
import {
  upsertCharacter,
  putCharacterImage,
  type CharacterDto,
  dtoToCharacter,
} from '../services/characters';
import { synthesizeSpeech } from '../services/voice';
import { stripTags, stripAllTags } from './textTags';

const TYPE_SPEED_MS = 25;
const MAX_HISTORY = 10;
const SAVE_DEBOUNCE_MS = 800;

interface DialogSnapshot {
  chain: DisplayBlock[];
  blockLocations: (string | null)[];
  /** Массив id NPC в кадре на момент пуша каждого display-блока.
   *  Берётся из последнего edit_scene. Может быть [] (никого нет). */
  blockSceneCharacterIds: string[][];
  rawChain: ChainBlock[];
  history: HistoryEntry[];
  locations: Record<string, LocationState>;
  activeLocationId: string | null;
  currentIdx: number;
  title: string;
  summary: string;
}

function getBlockText(b: DisplayBlock | undefined): string {
  if (!b) return '';
  if (b.type === 'narrator' || b.type === 'thought' || b.type === 'speech') {
    // Длина для typewriter — без визуальных <> и аудио [] тегов.
    // Аудио-теги [laugh], [sigh] и т.п. невидимы юзеру, идут в TTS.
    return stripAllTags(b.text);
  }
  return ''; // choices
}

function buildMessages(
  history: HistoryEntry[],
  characters: Record<string, Character>,
  storyTitle: string,
  activeLocation: string | null,
  activeSceneCharacters: string[]
): Message[] {
  const charList = Object.values(characters);
  let charsBlock = '';
  if (charList.length > 0) {
    charsBlock = '\n\nУже созданные персонажи (НЕ дублируй create_character — используй их id):\n';
    for (const c of charList) {
      charsBlock += `- id="${c.id}", имя="${c.name}", цвет=${c.color}, характер: ${c.personality}\n`;
    }
  }

  // Все статичные данные (ГГ + персонажи истории + текущая сцена) теперь
  // живут в самом system prompt'е через buildSystemPrompt(...).
  // В user остаётся только заголовок с названием (напоминание не повторять
  // set_title) и контекст предыдущих сцен / стартовая инструкция.
  const titleHeader = storyTitle
    ? `Название истории: «${storyTitle}» (set_title больше НЕ вызывай — он установлен один раз)\n\n`
    : '';

  let userContent: string;

  if (history.length === 0) {
    userContent =
      'Начни новую визуальную новеллу. Придумай интересную атмосферную завязку. ' +
      'Главный герой — мужчина, повествование от первого лица. ' +
      'Сцена должна сразу втягивать. ' +
      'СНАЧАЛА set_title (один раз), потом create_character (если кто-то в первой сцене), потом edit_scene с location_description и character_ids этих персонажей. Только потом narrator/speech/thought. ' +
      'Не забывай теги: <aggressive>, <lewd>, <info>, <char id="..."> для визуала + ' +
      '[laugh], [sigh], [angry], [seductive], [whisper] для голоса.' +
      charsBlock;
  } else {
    let ctx = 'Контекст предыдущих сцен (последние сверху вниз):\n\n';
    for (let i = 0; i < history.length; i++) {
      const e = history[i];
      ctx += `[Сцена ${i + 1}]\n`;
      for (const b of e.blocks) {
        if (b.type === 'edit_scene') {
          const inScene = b.character_ids.length > 0
            ? ` (в кадре: ${b.character_ids.join(', ')})`
            : ' (в кадре пусто)';
          ctx += `(сцена: ${b.location_description}${inScene})\n`;
        } else if (b.type === 'set_title' || b.type === 'set_summary') {
          continue;
        } else if (b.type === 'create_character')
          ctx += `(создан персонаж ${b.id}: ${b.name})\n`;
        else if (b.type === 'narrator') ctx += `Нарратор: ${b.text}\n`;
        else if (b.type === 'thought') ctx += `Мысль ГГ: ${b.text}\n`;
        else if (b.type === 'speech') {
          const name =
            b.character_id === MAIN_HERO_ID
              ? 'ГГ'
              : (characters[b.character_id]?.name ?? b.character_id);
          ctx += `${name}: «${b.text}»\n`;
        } else if (b.type === 'choices') {
          const opts = b.options
            .map((o) => `«${o.label}»${o.cost ? ` [${o.cost}💎]` : ''}`)
            .join(' / ');
          ctx += `Варианты: ${opts}\n`;
        }
      }
      const costStr = e.chosenCost ? ` (платно, ${e.chosenCost} гемов)` : '';
      ctx += `→ Игрок выбрал: «${e.chosenLabel}»${costStr}\n\n`;
    }
    ctx +=
      'Сгенерируй следующую сцену, развивая сюжет именно от последнего выбора игрока. ' +
      'Сохраняй преемственность персонажей. ' +
      'edit_scene эмить когда меняется фон ИЛИ состав персонажей в кадре. ' +
      'Новых персонажей регистрируй через create_character ПЕРЕД их добавлением в edit_scene. ' +
      'НЕ ЗАБУДЬ ПРО ТЕГИ: <aggressive>, <lewd>, <info>, <char id="..."> ' +
      'обязательно используй где есть повод.' +
      charsBlock;
    userContent = ctx;
  }

  const systemPrompt = buildSystemPrompt({
    heroDescription: 'Мужчина, повествование от первого лица.',
    characters,
    locationDescription: activeLocation,
    sceneCharacterIds: activeSceneCharacters,
  });

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: titleHeader + userContent },
  ];
}

let locCounter = 0;
function makeLocationId(): string {
  return `loc-${++locCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function useDynamicEngine() {
  // Видимая цепочка (без change_location). chain[i] показывается пользователю.
  const chain = ref<DisplayBlock[]>([]);
  // Параллельный массив: какая локация была активна когда chain[i] эмитнулся
  const blockLocations = ref<(string | null)[]>([]);
  // Параллельный массив: id NPC в кадре на каждом display block.
  // Обновляется через edit_scene. Пустой массив = никого на сцене.
  const blockSceneCharacterIds = ref<string[][]>([]);
  let activeSceneCharacterIds: string[] = [];
  // Полная reactive-карта всех локаций (description + imageUrl)
  const locations = reactive<Record<string, LocationState>>({});
  // Reactive-карта всех созданных персонажей (id → Character)
  const characters = reactive<Record<string, Character>>({});
  // Live <audio> элемент для проигрывания текущей реплики
  const audioEl: HTMLAudioElement | null =
    typeof Audio !== 'undefined' ? new Audio() : null;
  // raw history для контекста модели (включает change_location, create_character)
  const rawChain = ref<ChainBlock[]>([]);

  const currentIdx = ref(0);
  const displayedText = ref('');
  const isTyping = ref(false);
  const isGenerating = ref(false);
  const error = ref<string | null>(null);
  const history = ref<HistoryEntry[]>([]);
  /** Заголовок истории, сетится моделью через set_title в первой сцене */
  const title = ref<string>('');
  /** Краткая сводка сюжета, обновляется моделью через set_summary перед choices */
  const summary = ref<string>('');

  // Активная локация в момент стриминга. Сохраняется между генерациями
  // — если следующая сцена не эмитнула change_location, остаёмся в той же.
  const activeLocationId = ref<string | null>(null);

  let timerId: ReturnType<typeof setTimeout> | null = null;

  const currentBlock = computed<DisplayBlock | undefined>(
    () => chain.value[currentIdx.value]
  );
  // Активный choices = блок с выбором, который ещё НЕ сделан. После выбора
  // (chosenIdx есть) — это read-only «ты выбрал», обычный продвигаемый блок.
  const isChoice = computed(() => {
    const b = currentBlock.value;
    return b?.type === 'choices' && b.chosenIdx === undefined;
  });

  /** Возвращает Character или stub с imageUrl=null если character ещё не
   *  зарегистрирован — UI покажет плейсхолдер. */
  function getCharOrStub(id: string): Character {
    const existing = characters[id];
    if (existing) return existing;
    return {
      id,
      name: id,
      color: '#d4ff00',
      personality: '',
      appearance: '',
      imageUrl: null,
      voiceId: null,
    };
  }

  /** Персонажи которые СЕЙЧАС в кадре (до 3 NPC). Берутся из последнего
   *  edit_scene, привязанного к текущему display block через parallel array. */
  const sceneCharacters = computed<Character[]>(() => {
    const ids = blockSceneCharacterIds.value[currentIdx.value] ?? [];
    return ids.map(getCharOrStub);
  });

  /** Текущий говорящий NPC (для подсветки имени, цвета акцента в speech-капсуле). */
  const currentCharacter = computed<Character | null>(() => {
    const b = currentBlock.value;
    if (!b || b.type !== 'speech') return null;
    if (b.character_id === MAIN_HERO_ID) return null;
    return getCharOrStub(b.character_id);
  });

  // Bg больше НЕ блокирует typewriter — пользователь сразу видит текст,
  // фон догружается параллельно. До его готовности рендерится либо
  // дефолтный preset, либо последний загруженный bg (см. displayedBgUrl).
  const isWaitingForBg = computed(() => false);

  // Портрет НЕ блокирует typewriter. Если персонажа ещё нет (не дошёл
  // create_character) или imageUrl=null — рендерим плейсхолдер, как только
  // приедет — подменяется. Реактивно через CharacterLayer.
  const isWaitingForCharacter = computed(() => false);

  // Готов ли голос текущей реплики (NPC).
  const isWaitingForVoice = computed(() => {
    const b = currentBlock.value;
    if (!b || b.type !== 'speech') return false;
    if (b.character_id === MAIN_HERO_ID) return false; // ГГ не озвучивается
    return b.audio_url === null;
  });

  const isLoading = computed(
    () =>
      !currentBlock.value ||
      isWaitingForBg.value ||
      isWaitingForCharacter.value ||
      isWaitingForVoice.value
  );

  // Bg который СЕЙЧАС показываем. Идём от currentIdx назад в поисках первого
  // блока с готовым изображением.
  const displayedBgUrl = computed<string | null>(() => {
    for (let i = currentIdx.value; i >= 0; i--) {
      const locId = blockLocations.value[i];
      if (!locId) continue;
      const loc = locations[locId];
      if (loc?.imageUrl) return loc.imageUrl;
    }
    return null;
  });

  function cancelTimer() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function startTypewriter() {
    cancelTimer();
    const block = currentBlock.value;
    if (!block) {
      displayedText.value = '';
      isTyping.value = false;
      return;
    }
    const full = getBlockText(block);
    displayedText.value = '';
    if (full.length === 0) {
      isTyping.value = false;
      return;
    }
    isTyping.value = true;
    let i = 0;
    const tick = () => {
      i++;
      displayedText.value = full.slice(0, i);
      if (i < full.length) {
        timerId = setTimeout(tick, TYPE_SPEED_MS);
      } else {
        isTyping.value = false;
        timerId = null;
      }
    };
    timerId = setTimeout(tick, TYPE_SPEED_MS);
  }

  function stopAudio() {
    if (!audioEl) return;
    audioEl.pause();
    audioEl.removeAttribute('src');
    audioEl.load();
  }

  // Браузер блочит autoplay до первого user gesture. Делаем unlock
  // в tap() — muted silence-play на короткое время разрешает все
  // последующие audio.play() в этой сессии.
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked || !audioEl) return;
    audioUnlocked = true;
    // тишина 0.05с в data URI
    const SILENCE =
      'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjQ1LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAA';
    try {
      audioEl.muted = true;
      audioEl.src = SILENCE;
      void audioEl
        .play()
        .then(() => {
          audioEl.pause();
          audioEl.muted = false;
          audioEl.removeAttribute('src');
          audioEl.load();
        })
        .catch(() => {
          audioEl.muted = false;
        });
    } catch {
      audioEl.muted = false;
    }
  }

  function playSpeechAudio() {
    if (!audioEl) return;
    const b = currentBlock.value;
    if (!b || b.type !== 'speech' || !b.audio_url) return;
    audioEl.src = b.audio_url;
    audioEl.currentTime = 0;
    void audioEl.play().catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[engine] audio play failed:', e);
    });
  }

  watch(
    [currentBlock, isWaitingForBg, isWaitingForCharacter, isWaitingForVoice],
    (
      [newBlock, waitingBg, waitingChar, waitingVoice],
      [oldBlock, oldWaitingBg, oldWaitingChar, oldWaitingVoice]
    ) => {
      if (!newBlock || waitingBg || waitingChar || waitingVoice) {
        cancelTimer();
        displayedText.value = '';
        isTyping.value = false;
        stopAudio();
        return;
      }
      if (
        newBlock !== oldBlock ||
        oldWaitingBg ||
        oldWaitingChar ||
        oldWaitingVoice
      ) {
        if (newBlock !== oldBlock) stopAudio();
        startTypewriter();
        if (
          newBlock.type === 'speech' &&
          newBlock.character_id !== MAIN_HERO_ID
        ) {
          playSpeechAudio();
        }
      }
    }
  );

  async function fetchLocationBg(id: string, description: string) {
    try {
      const url = await generateBackground(description);
      const cur = locations[id];
      if (cur) {
        locations[id] = { ...cur, imageUrl: url };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error('[engine] bg generation failed:', msg);
      const cur = locations[id];
      if (cur) {
        locations[id] = { ...cur, error: msg };
      }
    }
  }

  async function fetchCharacterImg(id: string, appearance: string) {
    try {
      const url = await generateCharacterImage(appearance);
      const cur = characters[id];
      if (cur) characters[id] = { ...cur, imageUrl: url };
      try {
        await putCharacterImage(id, url);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[engine] put character image failed:', e);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error('[engine] character image failed:', msg);
      const cur = characters[id];
      if (cur) characters[id] = { ...cur, error: msg };
    }
  }

  async function persistCharacter(c: Character) {
    try {
      const updated = await upsertCharacter(c);
      const cur = characters[c.id];
      if (cur) {
        characters[c.id] = { ...cur, voiceId: updated.voiceId };
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[engine] upsert character failed:', e);
    }
  }

  /** Ждёт пока voice-agent (бэк) сохранит voice_id для персонажа.
   *  Возвращает true если дождались, false по таймауту. */
  function waitForVoiceId(characterId: string, timeoutMs = 30_000): Promise<boolean> {
    if (characters[characterId]?.voiceId) return Promise.resolve(true);
    return new Promise((resolve) => {
      let done = false;
      const stop = watch(
        () => characters[characterId]?.voiceId,
        (v) => {
          if (v && !done) {
            done = true;
            stop();
            resolve(true);
          }
        }
      );
      setTimeout(() => {
        if (!done) {
          done = true;
          stop();
          resolve(false);
        }
      }, timeoutMs);
    });
  }

  async function fetchSpeechAudio(chainIdx: number) {
    const block = chain.value[chainIdx];
    if (!block || block.type !== 'speech') return;
    if (block.character_id === MAIN_HERO_ID) return;
    if (block.audio_url !== undefined) return;

    chain.value[chainIdx] = { ...block, audio_url: null };

    // Ждём пока voice-agent не сохранит voice_id для этого персонажа.
    // Гонка: speech-блок может прилететь раньше чем POST /api/characters
    // успел добежать до voice-agent (тот думает 3-5 секунд).
    const got = await waitForVoiceId(block.character_id);
    if (!got) {
      // не дождались — снимаем audio_url чтобы UI не висел вечно
      const cur = chain.value[chainIdx];
      if (cur && cur.type === 'speech') {
        const next: typeof cur = { ...cur };
        delete next.audio_url;
        chain.value[chainIdx] = next;
      }
      return;
    }

    try {
      // Голос читает чистый текст, без визуальных тегов
      const url = await synthesizeSpeech(block.character_id, stripTags(block.text));
      const cur = chain.value[chainIdx];
      if (cur && cur.type === 'speech') {
        chain.value[chainIdx] = { ...cur, audio_url: url };
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[engine] speech synth failed:', e);
      const cur = chain.value[chainIdx];
      if (cur && cur.type === 'speech') {
        const next: typeof cur = { ...cur };
        delete next.audio_url;
        chain.value[chainIdx] = next;
      }
    }
  }

  async function generate() {
    if (isGenerating.value) return;
    isGenerating.value = true;
    error.value = null;
    try {
      // Текущая сцена для контекста модели
      const activeLocDesc = activeLocationId.value
        ? (locations[activeLocationId.value]?.description ?? null)
        : null;
      const messages = buildMessages(
        history.value,
        characters,
        title.value,
        activeLocDesc,
        activeSceneCharacterIds.slice()
      );
      console.log('[engine] generate() start, history len:', history.value.length);
      for await (const block of streamChain(messages)) {
        console.log('[engine] block emitted:', block.type, 'in' in block ? '' : block);
        rawChain.value.push(block);

        if (block.type === 'set_title') {
          if (!title.value) title.value = block.title;
        } else if (block.type === 'set_summary') {
          summary.value = block.summary;
        } else if (block.type === 'edit_scene') {
          // Локация: только если передана не-null — иначе остаётся прежняя
          if (block.location_description) {
            const id = makeLocationId();
            locations[id] = {
              description: block.location_description,
              imageUrl: null,
            };
            activeLocationId.value = id;
            void fetchLocationBg(id, block.location_description);
          }
          // Состав NPC — всегда обновляем по новому массиву (diff делает UI)
          activeSceneCharacterIds = block.character_ids.slice();
        } else if (block.type === 'create_character') {
          if (!characters[block.id]) {
            const newChar: Character = {
              id: block.id,
              name: block.name,
              color: block.color,
              personality: block.personality,
              appearance: block.appearance,
              imageUrl: null,
              voiceId: null,
            };
            characters[block.id] = newChar;
            void (async () => {
              await persistCharacter(newChar);
              await fetchCharacterImg(block.id, block.appearance);
            })();
          }
        } else {
          chain.value.push(block);
          blockLocations.value.push(activeLocationId.value);
          // Копируем актуальный состав сцены — каждый блок имеет свой snapshot
          blockSceneCharacterIds.value.push(activeSceneCharacterIds.slice());
          if (block.type === 'speech' && block.character_id !== MAIN_HERO_ID) {
            const blockIdx = chain.value.length - 1;
            void fetchSpeechAudio(blockIdx);
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error.value = msg;
      console.error('[engine] generation failed:', msg);
    } finally {
      console.log('[engine] generate() done, chain len:', chain.value.length);
      isGenerating.value = false;
    }
  }

  function tap() {
    // первый тап = user gesture → разлочим autoplay для audio
    unlockAudio();
    // На loading-блоке (currentBlock undefined) тап игнорируем —
    // продвигаться некуда пока модель не догенерит следующий.
    const block = currentBlock.value;
    if (block) {
      // Активный choices (без выбора) блокирует tap — ждём selectChoice.
      // Но если выбор УЖЕ сделан (chosenIdx есть) — это «ты выбрал»
      // при перемотке назад, его можно скипать как обычный блок.
      if (block.type === 'choices' && block.chosenIdx === undefined) return;
      if (isTyping.value) {
        cancelTimer();
        displayedText.value = getBlockText(block);
        isTyping.value = false;
        return;
      }
    }
    // Разрешаем переход даже если блок ещё не готов (NPC speech без voice,
    // или вообще пусто пока модель пишет следующий) — пользователь увидит
    // loading-капсулу пока новый блок не приедет.
    const nextIdx = currentIdx.value + 1;
    if (nextIdx < chain.value.length || isGenerating.value) {
      currentIdx.value = nextIdx;
    }
  }

  function selectChoice(idx: number) {
    const block = currentBlock.value;
    if (!block || block.type !== 'choices') return;
    if (block.chosenIdx !== undefined) return; // выбор уже сделан, нельзя поменять
    const opt = block.options[idx];
    if (!opt) return;

    // Мутируем сам choices-блок — теперь он read-only с chosenIdx.
    const choiceIdx = currentIdx.value;
    const updated: typeof block = {
      ...block,
      chosenIdx: idx,
      chosenCost: opt.cost,
    };
    chain.value[choiceIdx] = updated;
    // в rawChain тоже обновляем (для history-контекста модели)
    const rawIdx = rawChain.value.findIndex(
      (b) => b.type === 'choices' && b === block
    );
    if (rawIdx >= 0) rawChain.value[rawIdx] = updated;

    // Историю-сводку для модели обновляем
    history.value.push({
      blocks: rawChain.value.slice(),
      chosenLabel: opt.label,
      chosenCost: opt.cost,
    });
    while (history.value.length > MAX_HISTORY) history.value.shift();

    // НЕ сбрасываем chain — продолжаем добавлять новые блоки в конец.
    // Пользователь может вернуться к старым сценам через goBack.
    stopAudio();
    // Авто-продвижение на следующий слайд после выбора —
    // он будет loading-капсулой пока модель догенерит первый блок.
    currentIdx.value = choiceIdx + 1;
    generate();
  }

  /** Назад на один слайд (если есть куда). */
  function goBack() {
    if (currentIdx.value <= 0) return;
    stopAudio();
    currentIdx.value = currentIdx.value - 1;
  }

  /** Полный сброс: новая история с нуля. Чистит локальный state и
   *  запускает новую генерацию. Старая dialog в БД будет перезаписана
   *  при следующем save (snapshot). */
  function startNewStory() {
    stopAudio();
    cancelTimer();
    chain.value = [];
    blockLocations.value = [];
    blockSceneCharacterIds.value = [];
    rawChain.value = [];
    history.value = [];
    for (const k of Object.keys(locations)) delete locations[k];
    for (const k of Object.keys(characters)) delete characters[k];
    activeLocationId.value = null;
    activeSceneCharacterIds = [];
    currentIdx.value = 0;
    displayedText.value = '';
    isTyping.value = false;
    title.value = '';
    summary.value = '';
    error.value = null;
    void generate();
  }

  function retry() {
    if (isGenerating.value) return;
    generate();
  }

  // ─── persistence ────────────────────────────────────────────────────
  function snapshot(): DialogSnapshot {
    return {
      chain: JSON.parse(JSON.stringify(chain.value)),
      blockLocations: blockLocations.value.slice(),
      blockSceneCharacterIds: blockSceneCharacterIds.value.map((a) => a.slice()),
      rawChain: JSON.parse(JSON.stringify(rawChain.value)),
      history: JSON.parse(JSON.stringify(history.value)),
      locations: JSON.parse(JSON.stringify(locations)),
      activeLocationId: activeLocationId.value,
      currentIdx: currentIdx.value,
      title: title.value,
      summary: summary.value,
    };
  }

  function hydrate(s: Partial<DialogSnapshot>) {
    chain.value = Array.isArray(s.chain) ? (s.chain as DisplayBlock[]) : [];
    blockLocations.value = Array.isArray(s.blockLocations)
      ? (s.blockLocations as (string | null)[])
      : [];
    rawChain.value = Array.isArray(s.rawChain) ? (s.rawChain as ChainBlock[]) : [];

    // blockSceneCharacterIds — если в snapshot нет, восстанавливаем из rawChain:
    // проходим, отслеживая последний edit_scene; на каждый display block
    // пушим копию текущего состава.
    if (Array.isArray(s.blockSceneCharacterIds)) {
      blockSceneCharacterIds.value = (s.blockSceneCharacterIds as string[][]).map(
        (a) => a.slice()
      );
    } else {
      const ids: string[][] = [];
      let activeIds: string[] = [];
      for (const b of rawChain.value) {
        if (b.type === 'edit_scene') {
          activeIds = b.character_ids.slice();
          continue;
        }
        if (b.type === 'create_character' || b.type === 'set_title' || b.type === 'set_summary') {
          continue;
        }
        ids.push(activeIds.slice());
      }
      blockSceneCharacterIds.value = ids;
    }
    activeSceneCharacterIds =
      blockSceneCharacterIds.value[blockSceneCharacterIds.value.length - 1]?.slice() ?? [];
    history.value = Array.isArray(s.history) ? (s.history as HistoryEntry[]) : [];

    for (const k of Object.keys(locations)) delete locations[k];
    if (s.locations && typeof s.locations === 'object') {
      Object.assign(locations, s.locations);
    }

    activeLocationId.value =
      typeof s.activeLocationId === 'string' ? s.activeLocationId : null;
    currentIdx.value = typeof s.currentIdx === 'number' ? s.currentIdx : 0;
    title.value = typeof s.title === 'string' ? s.title : '';
    summary.value = typeof s.summary === 'string' ? s.summary : '';
    displayedText.value = '';
    isTyping.value = false;

    for (const [id, loc] of Object.entries(locations)) {
      if (!loc.imageUrl && !loc.error) {
        void fetchLocationBg(id, loc.description);
      }
    }
    for (const [id, ch] of Object.entries(characters)) {
      if (!ch.imageUrl && !ch.error) {
        void fetchCharacterImg(id, ch.appearance);
      }
    }
    for (let i = 0; i < chain.value.length; i++) {
      const b = chain.value[i];
      if (
        b?.type === 'speech' &&
        b.character_id !== MAIN_HERO_ID &&
        b.audio_url === undefined
      ) {
        void fetchSpeechAudio(i);
      }
    }
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void api('/api/dialog', {
        method: 'PUT',
        body: { state: snapshot() },
      }).catch((e: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('[engine] save failed:', e);
      });
    }, SAVE_DEBOUNCE_MS);
  }

  const persistenceReady = ref(false);
  watch(
    [
      chain,
      currentIdx,
      history,
      blockLocations,
      blockSceneCharacterIds,
      rawChain,
      activeLocationId,
      () => locations,
      title,
      summary,
    ],
    () => {
      if (!persistenceReady.value) return;
      scheduleSave();
    },
    { deep: true }
  );

  async function boot() {
    try {
      const r = await api<{
        state: Partial<DialogSnapshot> | null;
        characters: CharacterDto[];
      }>('/api/dialog', { optionalAuth: true });

      if (r?.characters && Array.isArray(r.characters)) {
        for (const k of Object.keys(characters)) delete characters[k];
        for (const dto of r.characters) {
          characters[dto.id] = dtoToCharacter(dto);
        }
      }

      if (r?.state && Array.isArray(r.state.chain) && r.state.chain.length > 0) {
        hydrate(r.state);
        persistenceReady.value = true;
        return;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[engine] load snapshot failed:', e);
    }
    // НЕ запускаем генерацию автоматически — стартовая вкладка всегда
    // «Выбор истории», пользователь сам жмёт «Новая история» или открывает
    // существующую.
    persistenceReady.value = true;
  }

  onScopeDispose(() => {
    cancelTimer();
    if (saveTimer) clearTimeout(saveTimer);
    stopAudio();
  });

  boot();

  return {
    chain,
    currentBlock,
    currentCharacter,
    displayedText,
    isTyping,
    isGenerating,
    isLoading,
    isChoice,
    error,
    history,
    locations,
    characters,
    displayedBgUrl,
    sceneCharacters,
    currentIdx,
    title,
    summary,
    tap,
    selectChoice,
    goBack,
    retry,
    startNewStory,
  };
}

export type DynamicEngine = ReturnType<typeof useDynamicEngine>;
