// Простая миграция: применяет все .sql из server/migrations по алфавиту.
// Идемпотентно — миграции пишем через CREATE IF NOT EXISTS / ALTER IF NOT EXISTS.

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sql } from './db.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'migrations');

async function run() {
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  console.log(`[migrate] found ${files.length} migration(s)`);
  for (const f of files) {
    const fp = join(migrationsDir, f);
    const text = await readFile(fp, 'utf-8');
    console.log(`[migrate] applying ${f}…`);
    await sql.unsafe(text);
  }
  console.log('[migrate] done');
  await sql.end();
}

run().catch((e) => {
  console.error('[migrate] failed:', e);
  process.exit(1);
});
