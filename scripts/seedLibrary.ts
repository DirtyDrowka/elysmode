// Сидер библиотеки персонажей и локаций. Идемпотентен — ON CONFLICT DO NOTHING.
// Если у персонажа нет voice_id — подбирает через voice-agent.

import { sql } from '../server/db.ts';
import { selectVoiceForCharacter } from '../server/voiceAgent.ts';

interface SeedChar {
  id: string;
  name: string;
  age: number;
  role: string;
  color: string;
  personality: string;
  appearance: string;
  image_url: string;
}

interface SeedLoc {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
}

const CHARACTERS: SeedChar[] = [
  {
    id: 'alina',
    name: 'Алина',
    age: 24,
    role: 'Секретарша руководителя',
    color: '#e91e63',
    personality:
      'Идеальная офисная секретарша на людях: педантичная, исполнительная, безупречно вежливая, знает все документы наизусть. ' +
      'Наедине с боссом — игривая и провокационная, любит подколоть с двусмысленным подтекстом, прекрасно осознаёт свою привлекательность и умело ей пользуется. ' +
      'Умная, читает между строк, всё подмечает. Любит крепкий чай с лимоном и поздние переработки наедине с шефом.',
    appearance:
      'Девушка 24 лет, стройная фигура с песочными часами, тонкая талия, пышная грудь. ' +
      'Длинные тёмные волосы до плеч с лёгкой волной. Очки в тонкой чёрной оправе. ' +
      'Узкое чёрное платье-футляр чуть выше колена с глубоким V-вырезом, поверх приталенный чёрный пиджак с расстёгнутыми верхними пуговицами. ' +
      'Чёрные полупрозрачные колготки, чёрные туфли на каблуке-шпильке. ' +
      'Рука кокетливо у дужки очков, лёгкий взгляд поверх оправы, едва заметная улыбка. Аниме-стиль.',
    image_url: '/sprites/alina.png',
  },
  {
    id: 'viktoria',
    name: 'Виктория',
    age: 36,
    role: 'Старший научный сотрудник лаборатории Nexus',
    color: '#0ea5e9',
    personality:
      'Учёная с серьёзным научным стажем — кандидат наук, ведёт собственное направление исследований. ' +
      'Холодная, рассудительная, профессиональная. Говорит короткими сухими фразами, оперирует фактами, не любит лирику. ' +
      'Ценит интеллект и точность, презирает дилетантство. Скептик к лишним эмоциям, может осадить одним взглядом. ' +
      'Под маской ледяного профессионализма — давно подавленная чувственность и интерес к тем кто способен с ней спорить на равных. ' +
      'Если оттает — становится опасно интересной, но это надо заслужить. Любит крепкий кофе без сахара и тишину.',
    appearance:
      'Женщина 36 лет, выглядит моложе своих лет — стройная, в отличной форме, грудь подчёркнута приталенным силуэтом халата. ' +
      'Длинные тёмные каштановые волосы собраны в высокий хвост. Холодные серо-голубые глаза, профессиональный взгляд без эмоций. ' +
      'Белый медицинский халат до колен с логотипом "Nexus" на нагрудном кармане, халат приталенный, расстёгнут — подчёркивает фигуру. ' +
      'Под халатом чёрная блузка с парой расстёгнутых верхних пуговиц, едва заметное декольте. ' +
      'Чёрные узкие брюки, чёрный кожаный ремень с серебряной пряжкой, чёрные туфли на низком каблуке. ' +
      'Поза прямая, уверенная, одна рука небрежно в кармане халата. Аниме-стиль, реалистичные пропорции.',
    image_url: '/sprites/viktoria.png',
  },
];

const LOCATIONS: SeedLoc[] = [
  {
    id: 'office',
    name: 'Кабинет руководителя',
    description:
      'Современный угловой кабинет на верхнем этаже бизнес-центра. Панорамные окна с видом на ночной город в огнях. ' +
      'Тёмное дерево, кожаное кресло руководителя, массивный дорогой стол с ноутбуком и бумагами. ' +
      'Мягкое тёплое освещение настольной лампы, лёгкий полумрак, дорогая атмосфера статуса и власти.',
    image_url: null,
  },
];

async function seedCharacter(c: SeedChar) {
  // 1. Upsert без voice_id
  await sql`
    INSERT INTO library_characters (id, name, age, role, color, personality, appearance, image_url)
    VALUES (${c.id}, ${c.name}, ${c.age}, ${c.role}, ${c.color},
            ${c.personality}, ${c.appearance}, ${c.image_url})
    ON CONFLICT (id) DO UPDATE SET
      name        = EXCLUDED.name,
      age         = EXCLUDED.age,
      role        = EXCLUDED.role,
      color       = EXCLUDED.color,
      personality = EXCLUDED.personality,
      appearance  = EXCLUDED.appearance,
      image_url   = EXCLUDED.image_url,
      updated_at  = NOW()
  `;
  console.log(`[seed] char "${c.id}" (${c.name}) upserted`);

  // 2. voice_id — только если ещё не подобран
  const [row] = await sql<{ voice_id: string | null }[]>`
    SELECT voice_id FROM library_characters WHERE id = ${c.id}
  `;
  if (row?.voice_id) {
    console.log(`[seed] char "${c.id}" already has voice_id=${row.voice_id} — skip`);
    return;
  }
  console.log(`[seed] picking voice for "${c.id}"…`);
  const voiceId = await selectVoiceForCharacter({
    id: c.id,
    name: c.name,
    personality: c.personality,
    appearance: c.appearance,
  });
  await sql`UPDATE library_characters SET voice_id = ${voiceId}, updated_at = NOW() WHERE id = ${c.id}`;
  console.log(`[seed] char "${c.id}" voice_id = ${voiceId}`);
}

async function seedLocation(l: SeedLoc) {
  await sql`
    INSERT INTO library_locations (id, name, description, image_url)
    VALUES (${l.id}, ${l.name}, ${l.description}, ${l.image_url})
    ON CONFLICT (id) DO UPDATE SET
      name        = EXCLUDED.name,
      description = EXCLUDED.description,
      -- image_url НЕ перезаписываем при наличии — чтобы случайно не стереть готовый
      image_url   = COALESCE(library_locations.image_url, EXCLUDED.image_url),
      updated_at  = NOW()
  `;
  console.log(`[seed] loc "${l.id}" (${l.name}) upserted`);
}

async function run() {
  for (const c of CHARACTERS) await seedCharacter(c);
  for (const l of LOCATIONS) await seedLocation(l);
  console.log('[seed] done');
  await sql.end();
}

run().catch((e) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});
