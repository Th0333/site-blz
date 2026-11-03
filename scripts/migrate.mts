/** Aplica as migrações no PostgreSQL de DATABASE_URL. Uso: npm run db:migrate */
import "dotenv/config";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL não definida — o PGlite local aplica as migrações automaticamente ao iniciar.");
  process.exit(0);
}
const pool = new Pool({ connectionString: url, ssl: /sslmode=/.test(url) ? undefined : /supabase|neon/.test(url) ? { rejectUnauthorized: false } : undefined });
await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
console.log("Migrações aplicadas.");
await pool.end();
