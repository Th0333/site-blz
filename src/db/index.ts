import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };

type Holder = { db?: Promise<DB>; close?: () => Promise<void> };
const g = globalThis as unknown as { __estudioDb?: Holder };
const holder: Holder = (g.__estudioDb ??= {});

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/**
 * Banco de dados da aplicação.
 * - Com DATABASE_URL: PostgreSQL real (Supabase, Neon, RDS...) via node-postgres.
 * - Sem DATABASE_URL (apenas desenvolvimento): PostgreSQL embarcado (PGlite)
 *   persistido em disco em PGLITE_DIR (padrão ./.data/pglite).
 */
export function getDb(): Promise<DB> {
  holder.db ??= open().catch((err) => {
    holder.db = undefined;
    throw err;
  });
  return holder.db;
}

async function open(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      ssl: /sslmode=require|supabase|neon/.test(url) ? { rejectUnauthorized: false } : undefined,
    });
    holder.close = () => pool.end();
    return drizzle(pool, { schema }) as unknown as DB;
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PGLITE_IN_PRODUCTION !== "1") {
    throw new Error("DATABASE_URL não configurada. Configure um PostgreSQL para produção.");
  }
  return openPglite(process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite"));
}

/** Abre um PGlite (disco ou memória) e aplica as migrações. Usado em dev e nos testes. */
export async function openPglite(dataDir?: string): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) {
    const fs = await import("node:fs");
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const client = await PGlite.create({ dataDir, extensions: { btree_gist } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  holder.close = () => client.close();
  return db as unknown as DB;
}

export async function closeDb() {
  await holder.close?.();
  holder.db = undefined;
  holder.close = undefined;
}

/** Injeta um banco já aberto (testes automatizados). */
export function setDbForTests(db: DB) {
  holder.db = Promise.resolve(db);
}
