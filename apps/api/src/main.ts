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
 * Ánima II colgada de `/v2`: el juego construido y el depósito de sprites al
 * que le habla. Las dos son opcionales y sueltas — sin ellas este proceso es
 * Ánima I y nada más.
 */
const v2Dir = process.env.ANIMA_V2_DIR;
const v2Deposito = process.env.ANIMA_V2_DEPOSITO;

/**
 * ═══ LA CANILLA, Y POR QUÉ VIENE CERRADA (ADR 0089) ════════════════════════
 *
 * `ANIMA_CLI_LOCAL=1` habilita los puentes hacia los CLI instalados en ESTA
 * máquina: Codex y Claude. Sin el flag no se construye ninguno, y `/ai/*`
 * contesta que esta instancia no presta cuentas.
 *
 * El default es cerrado porque el CLI corre del lado del servidor: la cuenta es
 * siempre la de quien hospeda, la pida un invitado anónimo o una pubkey
 * verificada. En una laptop eso era el dueño usando lo suyo; publicada detrás
 * de un túnel es cualquiera con la URL gastando su cuota.
 *
 * Antes acá vivía `ANIMA_CODEX_SHARED=1`, que hacía exactamente lo contrario:
 * prestar una cuenta a todos, a propósito. Se fue completa — no alcanzaba con
 * apagarla, porque el modo «cada uno la suya» tenía la misma fuga por abajo (el
 * invitado sin identidad caía al `~/.codex` de la máquina igual).
 *
 * Quien quiera mente real sin ser el dueño trae su propia API OpenAI-compatible
 * y la llama desde el navegador: esa llave nunca pasa por este proceso.
 */
const cliLocal = process.env.ANIMA_CLI_LOCAL === '1';

const app = buildServer({
  dbPath,
  codexDir,
  cliLocal,
  ...(staticDir ? { staticDir } : {}),
  ...(v2Dir ? { v2Dir } : {}),
  ...(v2Deposito ? { v2Deposito } : {}),
});
await app.listen({ port, host });
console.log(
  `Ánima API escuchando en http://${host}:${String(port)} (db: ${dbPath}` +
    `${staticDir ? `, web: ${staticDir}` : ''}${v2Dir ? ', Ánima II en /v2' : ''}` +
    `${v2Deposito ? ` (depósito: ${v2Deposito})` : ''}` +
    `${cliLocal ? ', CLI locales habilitados' : ', sin puentes CLI (cada uno trae su API)'})`,
);
