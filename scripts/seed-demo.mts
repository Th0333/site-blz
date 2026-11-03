/**
 * Carrega conteúdo de DEMONSTRAÇÃO (marcado como tal). Uso: npm run seed:demo
 * Com PGlite local, pare o servidor de desenvolvimento antes de rodar.
 */
import "dotenv/config";
import { seedDemo } from "../src/server/demo";
import { closeDb } from "../src/db";

const r = await seedDemo(null);
console.log(r.created ? "Conteúdo de demonstração criado." : "Já existe conteúdo de demonstração — nada foi alterado.");
await closeDb();
