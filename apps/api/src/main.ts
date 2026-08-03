import { createCodexBridge, createManagedBridge } from './ai.js';
import type { AiBridgeFactory } from './ai.js';
import { buildServer } from './server.js';

const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.ANIMA_DB ?? 'data/anima.sqlite';

if (dbPath !== ':memory:') {
  const { mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(dbPath), { recursive: true });
}

const codexDir = process.env.ANIMA_CODEX_DIR ?? 'data/codex';

/**
 * Fuera del contenedor el servidor sigue atado al loopback: es la API personal
 * de una máquina, no un servicio expuesto. Dentro, `127.0.0.1` la dejaría
 * incomunicada (nadie fuera del contenedor puede alcanzar su loopback), así
 * que el host se declara por entorno y el compose pone `0.0.0.0`.
 */
const host = process.env.ANIMA_HOST ?? '127.0.0.1';

/** Con la web construida al lado, este servidor la sirve y comparten origen. */
const staticDir = process.env.ANIMA_WEB_DIR;

/**
 * Una sola cuenta de Codex para todos (`ANIMA_CODEX_SHARED=1`): el dueño de la
 * instancia presta su sesión a quien entre, tenga identidad Nostr o no. Sin el
 * flag vale lo de siempre — cada pubkey conecta su propia cuenta y el invitado
 * usa el `~/.codex` de la máquina.
 *
 * El flag no toca las credenciales: solo decide a qué CODEX_HOME apunta el
 * puente. El compartido es el del proceso (variable `CODEX_HOME`).
 *
 * Y como es uno solo, va administrado: se presta para pensar, pero conectarlo
 * y desconectarlo son del dueño de la instancia. Sin eso, cualquiera que abra
 * la página podría cerrar la sesión de todos con un botón.
 */
const codexShared = process.env.ANIMA_CODEX_SHARED === '1';
const sharedAi: AiBridgeFactory | undefined = codexShared
  ? (() => {
      const bridge = createManagedBridge(createCodexBridge({}));
      return () => bridge;
    })()
  : undefined;

const app = buildServer({
  dbPath,
  codexDir,
  ...(staticDir ? { staticDir } : {}),
  ...(sharedAi ? { ai: sharedAi } : {}),
});
await app.listen({ port, host });
console.log(
  `Ánima API escuchando en http://${host}:${String(port)} (db: ${dbPath}` +
    `${staticDir ? `, web: ${staticDir}` : ''}${codexShared ? ', Codex compartido' : ''})`,
);
