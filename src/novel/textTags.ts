// Inline-теги в тексте narrator / main_hero / speech.
// Поддерживаемые: <aggressive>, <lewd>, <info>, <char id="...">.
// Не вложенные — для простоты парсера и потому что это визуальные эффекты.
//
// Поток: model выдаёт текст с тегами → engine стримит → typewriter работает
// по stripTags-длине (чистый текст) → DialoguePanel парсит теги → рендерит
// letter-by-letter с CSS-классами эффектов → TTS получает stripTags(text).

export type TagKind = 'aggressive' | 'lewd' | 'info' | 'char';

export interface SegmentMeta {
  kind: TagKind;
  /** Только для kind='char' — id из create_character */
  charId?: string;
}

export interface Segment {
  /** 'plain' = без тега */
  kind: 'plain' | TagKind;
  text: string;
  charId?: string;
}

// Принимаем одинарные/двойные кавычки и опциональные пробелы.
// id обязателен только для char.
const TAG_RE =
  /<(aggressive|lewd|info|char)(?:\s+id=["']([^"']*)["'])?>([\s\S]*?)<\/\1>/g;

/** Разбирает текст в массив сегментов. Невалидные теги остаются как plain. */
export function parseTags(text: string): Segment[] {
  if (!text) return [];
  const segments: Segment[] = [];
  let lastEnd = 0;
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(text)) !== null) {
    if (m.index > lastEnd) {
      segments.push({ kind: 'plain', text: text.slice(lastEnd, m.index) });
    }
    const kind = m[1] as TagKind;
    const charId = m[2] ?? undefined;
    const inner = m[3] ?? '';
    if (kind === 'char') {
      segments.push({ kind: 'char', text: inner, charId });
    } else {
      segments.push({ kind, text: inner });
    }
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < text.length) {
    segments.push({ kind: 'plain', text: text.slice(lastEnd) });
  }
  return segments;
}

/** Чистый текст без визуальных <> тегов. Аудио-теги [tag] остаются —
 *  они идут в ElevenLabs TTS как cue для интонации. */
export function stripTags(text: string): string {
  if (!text) return '';
  return parseTags(text)
    .map((s) => s.text)
    .join('');
}

// Audio-теги для TTS (eleven_v3): [laugh], [sigh], [angry], [whisper] и т.п.
// На экран НЕ выводятся (пропускаются typewriter'ом), идут только в синтез.
const AUDIO_TAG_RE = /\[[^\[\]\n]{1,40}\]/g;

/** Убирает аудио-теги [tag] из текста. */
export function stripAudioTags(text: string): string {
  if (!text) return '';
  return text.replace(AUDIO_TAG_RE, '');
}

/** Убирает и визуальные <>, и аудио [] теги. Используется для длины
 *  typewriter — пользователь видит только сами слова. */
export function stripAllTags(text: string): string {
  return stripAudioTags(stripTags(text));
}

/** Каждая буква + её метаданные. Используется в DialoguePanel для рендера. */
export interface TaggedLetter {
  ch: string;
  /** Индекс в "чистом" тексте без тегов — для сравнения с displayedText.length */
  cleanIdx: number;
  /** Метаданные тега (undefined = plain) */
  seg?: SegmentMeta;
  /** Индекс буквы внутри своего сегмента — для волновых эффектов (lewd) */
  letterInSegIdx: number;
}

/** Развернуть raw-text в плоский массив букв с tag-метой.
 *  Аудио-теги [tag] полностью пропускаются — они не должны печататься. */
export function toTaggedLetters(rawText: string): TaggedLetter[] {
  const segments = parseTags(rawText);
  const letters: TaggedLetter[] = [];
  let cleanIdx = 0;
  for (const seg of segments) {
    // удаляем audio-теги внутри текста сегмента
    const cleaned = stripAudioTags(seg.text);
    const arr = Array.from(cleaned);
    let i = 0;
    for (const ch of arr) {
      letters.push({
        ch,
        cleanIdx: cleanIdx++,
        seg:
          seg.kind === 'plain'
            ? undefined
            : seg.kind === 'char'
              ? { kind: 'char', charId: seg.charId }
              : { kind: seg.kind },
        letterInSegIdx: i++,
      });
    }
  }
  return letters;
}
