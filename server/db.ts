import postgres from 'postgres';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://elysmode:elysmode@localhost:5432/elysmode';

export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  // postgres.js парсит JSONB сам — сохраняем как объекты
  types: {
    bigint: postgres.BigInt,
  },
});

export type Sql = typeof sql;
