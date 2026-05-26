// Recraft API — нативная генерация портретов персонажей + removeBackground
// для честного transparent PNG. Ключ только на сервере (не клиент).

const RECRAFT_API_KEY = process.env.RECRAFT_API_KEY ?? '';
const BASE = 'https://external.api.recraft.ai/v1';

if (!RECRAFT_API_KEY) {
  console.warn('[recraft] RECRAFT_API_KEY пустой — character image gen работать не будет');
}

const MAX_APPEARANCE_LEN = 400;

function buildCharacterPrompt(appearance: string): string {
  // Recraft режет prompt по 1000 символов. Держим фикс-часть ~500, на
  // appearance оставляем до ~400. Если модель прислала больше — обрезаем.
  // NB про content filter: эвфемизмы вместо прямого «sexualized / vulgar».
  const ap = appearance.length > MAX_APPEARANCE_LEN
    ? appearance.slice(0, MAX_APPEARANCE_LEN)
    : appearance;
  return (
    `Japanese anime visual novel character sprite, modern VN style ` +
    `(Persona 5, Steins;Gate, DDLC, Fate). Sharp clean anime lineart, ` +
    `soft cel-shading, expressive anime eyes, glossy anime hair, refined ` +
    `facial features, studio quality. NOT cartoon, NOT chibi, NOT western. ` +
    `Full body, standing, facing camera, alluring confident pose, attractive ` +
    `feminine figure with stylish form-fitting outfit. ` +
    `ONE character only, isolated on transparent background, no scene, ` +
    `neutral even lighting.\n\nCharacter: ${ap}`
  );
}

interface GenResponse {
  data?: Array<{ url?: string; b64_json?: string; image_id?: string }>;
  image?: { url?: string };
}

/**
 * Шаг 1 — text-to-image через Recraft V3 (РАСТРОВАЯ модель).
 * Возвращает URL (24h ссылка от Recraft).
 *
 * model: recraftv3 — последний РАСТРОВЫЙ движок (НЕ vector, у которых style
 *   начинается на vector_illustration_*). removeBackground работает только
 *   на растре, поэтому raster — обязательное условие нашего пайплайна.
 * style: digital_illustration — категория для иллюстраций (растровая).
 * substyle: 2d_art_poster_2 — sexy/постерный sub-style, хорошо подходит
 *   под анимешные sprites визуальной новеллы.
 */
async function recraftGenerate(prompt: string): Promise<string> {
  const res = await fetch(`${BASE}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RECRAFT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      // realistic_image даёт более сложную «фотореалистично-аниме» эстетику
      // ближе к современному VN sprite. digital_illustration substyles типа
      // 2d_art_poster_2 склонны к мультяшности — нам не подходит.
      style: 'realistic_image',
      substyle: 'studio_portrait',
      model: 'recraftv3',
      size: '1024x1707', // 9:16 portrait approx
      response_format: 'url',
      n: 1,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Recraft generate ${res.status}: ${text.slice(0, 400)}`);
  }
  let json: GenResponse;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Recraft generate: invalid JSON: ${text.slice(0, 200)}`);
  }
  const url = json.data?.[0]?.url ?? json.image?.url;
  if (!url) {
    throw new Error(`Recraft generate: no image url. Raw: ${text.slice(0, 300)}`);
  }
  return url;
}

/**
 * Шаг 2 — удаление фона. Принимает byte stream сгенерированной картинки,
 * возвращает URL прозрачного PNG.
 */
async function recraftRemoveBackground(imageBytes: ArrayBuffer): Promise<string> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([imageBytes], { type: 'image/png' }),
    'character.png'
  );

  const res = await fetch(`${BASE}/images/removeBackground`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RECRAFT_API_KEY}`,
      // НЕ ставим Content-Type — fetch выставит multipart с boundary сам
    },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Recraft removeBg ${res.status}: ${text.slice(0, 400)}`);
  }
  let json: GenResponse;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Recraft removeBg: invalid JSON: ${text.slice(0, 200)}`);
  }
  const url = json.data?.[0]?.url ?? json.image?.url;
  if (!url) {
    throw new Error(
      `Recraft removeBg: no image url. Raw: ${text.slice(0, 300)}`
    );
  }
  return url;
}

/**
 * Главный публичный метод: даёт appearance — получает data: URL с прозрачным
 * фоном (готово для <img src>).
 */
export async function generateCharacterPortrait(
  appearance: string
): Promise<string> {
  if (!RECRAFT_API_KEY) {
    throw new Error('RECRAFT_API_KEY is empty on server');
  }

  // 1) генерим
  const genUrl = await recraftGenerate(buildCharacterPrompt(appearance));

  // 2) тянем байты
  const imgRes = await fetch(genUrl);
  if (!imgRes.ok) {
    throw new Error(`Recraft download ${imgRes.status} for ${genUrl}`);
  }
  const bytes = await imgRes.arrayBuffer();

  // 3) убираем фон
  const transparentUrl = await recraftRemoveBackground(bytes);

  // 4) тянем итоговый файл и упаковываем в data URL — чтобы не зависеть
  //    от 24-часовой эфемерной ссылки Recraft. MIME берём из Content-Type
  //    (Recraft реально возвращает WebP с alpha, а не PNG).
  const finalRes = await fetch(transparentUrl);
  if (!finalRes.ok) {
    throw new Error(`Recraft final download ${finalRes.status}`);
  }
  const mime = finalRes.headers.get('content-type') ?? 'image/png';
  const finalBytes = Buffer.from(await finalRes.arrayBuffer());
  return `data:${mime};base64,${finalBytes.toString('base64')}`;
}
