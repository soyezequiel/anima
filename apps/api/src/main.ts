import { buildServer } from './server.js';

const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.ANIMA_DB ?? 'data/anima.sqlite';

if (dbPath !== ':memory:') {
  const { mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(dbPath), { recursive: true });
}

const codexDir = process.env.ANIMA_CODEX_DIR ?? 'data/codex';

const app = buildServer({ dbPath, codexDir });
await app.listen({ port, host: '127.0.0.1' });
console.log(`Ánima API escuchando en http://127.0.0.1:${port} (db: ${dbPath})`);
