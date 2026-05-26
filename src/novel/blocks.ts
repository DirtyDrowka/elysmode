// Блоки динамической визуальной новеллы — то, что нейросеть отдаёт через tool calls.

export interface NarratorBlock {
  type: 'narrator';
  text: string;
}

export interface ThoughtBlock {
  type: 'thought'; // main_hero — внутренние мысли ГГ
  text: string;
}

export interface SpeechBlock {
  type: 'speech';
  /** id из create_character ИЛИ строка "main_hero" если ГГ говорит вслух */
  character_id: string;
  text: string;
  /** Сгенерированный голосовой файл (data: URL audio/mpeg). null = ещё генерится,
   *  undefined = ещё не пнули генерацию, string = готов */
  audio_url?: string | null;
}

export interface ChoiceOption {
  label: string;
  /** Стоимость в гемах: 9 / 19 / 49 для платных пошлых/романтичных путей */
  cost?: number;
}

export interface ChoicesBlock {
  type: 'choices';
  options: ChoiceOption[];
  /** Индекс выбранной опции — undefined пока выбор не сделан.
   *  Если есть — choices рендерится в read-only режиме (без кнопок). */
  chosenIdx?: number;
  /** Стоимость выбранной опции (если была платной) — для отображения */
  chosenCost?: number;
}

/** Директива редактирования текущей сцены: локация (фон) + персонажи в кадре.
 *  - location_description: null = локацию не менять (остаётся прежняя).
 *    Строка = новая локация, перегенерим фон.
 *  - character_ids: всегда полный новый состав. Engine сам делает diff:
 *    kept → сдвигаются, removed → исчезают, added → появляются. До 3 NPC. */
export interface EditSceneBlock {
  type: 'edit_scene';
  location_description: string | null;
  character_ids: string[];
}

/** Директива регистрации нового персонажа. Эмить ПЕРЕД первой репликой. */
export interface CreateCharacterBlock {
  type: 'create_character';
  id: string;          // короткий slug на латинице
  name: string;        // отображаемое имя (русское)
  color: string;       // акцент в #hex
  personality: string; // характер (для модели, не для UI)
  appearance: string;  // описание внешности (для генератора картинок)
}

/** Директива установки названия истории. Эмить САМЫМ ПЕРВЫМ tool_call'ом
 *  в самой первой сцене. Обновляется один раз. */
export interface SetTitleBlock {
  type: 'set_title';
  title: string;
}

/** Директива обновления сводки сюжета. Эмить ПЕРЕД каждым choices.
 *  Короткая сводка (2-3 предложения) для отображения в списке сохранений. */
export interface SetSummaryBlock {
  type: 'set_summary';
  summary: string;
}

/** Блоки, которые ПОКАЗЫВАЕМ пользователю в капсуле. */
export type DisplayBlock = NarratorBlock | ThoughtBlock | SpeechBlock | ChoicesBlock;

/** Всё что приходит от модели (включая директивы). */
export type ChainBlock =
  | DisplayBlock
  | EditSceneBlock
  | CreateCharacterBlock
  | SetTitleBlock
  | SetSummaryBlock;

/** Запись в истории — одна завершённая сцена + выбор игрока. */
export interface HistoryEntry {
  blocks: ChainBlock[];
  chosenLabel: string;
  chosenCost?: number;
}

/** Состояние сгенерированной локации. */
export interface LocationState {
  description: string;
  imageUrl: string | null;
  error?: string;
}

/** Состояние созданного персонажа. */
export interface Character {
  id: string;
  name: string;
  color: string;
  personality: string;
  appearance: string;
  /** 'male' | 'female' | null — заполняется в user-профиле, у synthetic
   *  обычно null (определяется voice-agent'ом из текста). */
  gender?: 'male' | 'female' | null;
  /** Сгенерированный портрет с прозрачным фоном; null пока грузится */
  imageUrl: string | null;
  /** Voice ID из ElevenLabs shared-voices library */
  voiceId: string | null;
  /** 'synthetic' — создан LLM при прохождении новеллы (default);
   *  'user' — профиль самого игрока. */
  characterType?: 'synthetic' | 'user';
  error?: string;
}

/** Специальный id для главного героя. */
export const MAIN_HERO_ID = 'main_hero';
