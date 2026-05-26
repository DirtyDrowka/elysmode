// Word-wrap по одному правилу:
// если очередное слово не помещается на текущей строке — оно целиком уходит
// на следующую (предшествующий пробел заменяется на \n, длина сохраняется).

import { ref, watch, onScopeDispose, type Ref } from 'vue';

let sharedCtx: CanvasRenderingContext2D | null = null;
function getCtx(): CanvasRenderingContext2D {
  if (!sharedCtx) {
    sharedCtx = document.createElement('canvas').getContext('2d')!;
  }
  return sharedCtx;
}

export interface FontSnapshot {
  font: string;
  letterSpacing: string;
}

function readFontFrom(el: HTMLElement): FontSnapshot {
  const cs = getComputedStyle(el);
  // font-variant дропаем — computed style иногда сериализует невалидно для canvas
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return { font, letterSpacing: cs.letterSpacing };
}

function applyFont(ctx: CanvasRenderingContext2D, snap: FontSnapshot) {
  ctx.font = snap.font;
  // letter-spacing считаем сами, а canvas-овский сбрасываем —
  // он есть не везде, а где есть — даёт двойной учёт
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  }
}

/**
 * Правило: слово, которое не влезает в текущую строку, целиком печатается
 * с новой строки. Пробел перед таким словом → \n.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSnap: FontSnapshot
): string {
  if (!text || maxWidth <= 0) return text;
  const ctx = getCtx();
  applyFont(ctx, fontSnap);
  const ls = parseFloat(fontSnap.letterSpacing) || 0;

  function widthOf(s: string): number {
    if (!s) return 0;
    return ctx.measureText(s).width + Math.max(0, s.length - 1) * ls;
  }

  const tokens = text.match(/\S+|\s+/g);
  if (!tokens) return text;

  let result = '';
  let lineStart = 0; // позиция начала текущей строки в result

  for (const token of tokens) {
    const isWord = /\S/.test(token);

    if (!isWord) {
      result += token;
      continue;
    }

    const currentLine = result.slice(lineStart);

    // строка пустая — слову некуда переноситься, печатаем как есть
    if (currentLine.trim() === '') {
      result += token;
      continue;
    }

    // слово помещается на текущей строке — добавляем
    if (widthOf(currentLine + token) <= maxWidth) {
      result += token;
      continue;
    }

    // не помещается — последний whitespace в result → \n, слово на новой строке
    if (/\s$/.test(result)) {
      result = result.slice(0, -1) + '\n' + token;
      lineStart = result.length - token.length;
    } else {
      // защита: пробела перед словом нет (стык-в-стык, маловероятно при нашей
      // токенизации) — просто допечатываем как есть
      result += token;
    }
  }

  return result;
}

export interface WrapOptions {
  initialWidth?: number;
  /** Шрифт для первичного просчёта до того как смонтируется DOM-элемент */
  initialFont?: FontSnapshot | null;
}

/**
 * Реактивная обёртка: даёшь fullText + ref на DOM-элемент (с него снимаем
 * шрифт и ширину через ResizeObserver), получаешь brokenText. Перевычисляется
 * при смене текста, ширины контейнера и загрузке шрифтов.
 */
export function useWrappedText(
  fullText: Ref<string>,
  measureEl: Ref<HTMLElement | null>,
  options: WrapOptions = {}
) {
  const initialWidth = options.initialWidth ?? 0;
  let lastFont: FontSnapshot | null = options.initialFont ?? null;

  const brokenText = ref<string>(fullText.value);
  const availWidth = ref<number>(initialWidth);
  const fontsReadyTick = ref<number>(0);

  // Синхронный первичный wrap для самого первого рендера (DOM ещё нет)
  if (initialWidth > 0 && lastFont) {
    brokenText.value = wrapText(fullText.value, initialWidth, lastFont);
  }

  if (typeof document !== 'undefined' && 'fonts' in document) {
    document.fonts.ready.then(() => {
      fontsReadyTick.value++;
    });
  }

  let ro: ResizeObserver | null = null;

  function recompute() {
    const w = availWidth.value;
    if (w <= 0) {
      brokenText.value = fullText.value;
      return;
    }
    const el = measureEl.value;
    if (el) lastFont = readFontFrom(el);
    if (!lastFont) {
      brokenText.value = fullText.value;
      return;
    }
    brokenText.value = wrapText(fullText.value, w, lastFont);
  }

  watch(
    measureEl,
    (el) => {
      ro?.disconnect();
      ro = null;
      if (!el) {
        availWidth.value = 0;
        return;
      }
      availWidth.value = el.clientWidth;
      ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width ?? 0;
        if (w > 0) availWidth.value = w;
      });
      ro.observe(el);
    },
    { flush: 'post' }
  );

  watch([fullText, availWidth, measureEl, fontsReadyTick], recompute, {
    flush: 'post',
    immediate: true,
  });

  onScopeDispose(() => {
    ro?.disconnect();
    ro = null;
  });

  return { brokenText };
}
