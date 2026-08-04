import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyProxy from '@fastify/http-proxy';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AiBridge, AiBridgeFactory } from './ai.js';
import { createCodexBridgeFactory, isCodexModel, isCodexReasoningEffort } from './ai.js';
import { createClaudeBridge, isClaudeReasoningEffort } from './claude.js';
import { createDb } from './db.js';
import {
  createChallenge,
  pruneExpired,
  pubkeyForToken,
  revokeToken,
  verifyChallengeEvent,
} from './auth.js';
import type { AuthDeps } from './auth.js';

const MAX_VALUE_BYTES = 1_000_000;

export interface ServerOptions {
  dbPath: string;
  now?: () => number;
  /** Fábrica de puentes de Codex por identidad (inyectable en pruebas). */
  ai?: AiBridgeFactory;
  /** Raíz donde viven los CODEX_HOME por usuario (default: data/codex). */
  codexDir?: string;
  /** Puente de Claude de la máquina (inyectable en pruebas). */
  claudeAi?: AiBridge;
  /**
   * ¿Esta instancia deja usar los CLI instalados en SU máquina? Por omisión
   * NO, y ese default es la decisión (ADR 0089).
   *
   * Un puente CLI gasta la cuenta de quien hospeda, no la del visitante: da
   * igual que sea el `~/.codex` del invitado o la suscripción de Claude de la
   * máquina — el que paga es siempre el mismo. Mientras esto vivió en una
   * laptop era el dueño usando lo suyo; con la instancia publicada pasó a ser
   * una canilla abierta a Internet.
   *
   * Encendido (`ANIMA_CLI_LOCAL=1`) vuelve todo a lo de antes, que es lo que
   * corresponde cuando la instancia corre en la máquina del dueño. Apagado, el
   * que quiera mente real trae su propia API OpenAI-compatible desde el
   * navegador y no pasa por acá.
   */
  cliLocal?: boolean;
  /**
   * Directorio con la web ya construida (`apps/web/dist`). Presente, este
   * servidor también la sirve, y entonces API y web comparten origen. Ausente
   * (desarrollo), la web la sirve Vite y este servidor es solo la API.
   */
  staticDir?: string;
  /**
   * Ánima II construida (`ii/apps/juego/dist`), servida bajo `/v2/`. El juego
   * tiene que estar construido con esa misma base, si no pide sus assets a la
   * raíz y se los contesta Ánima I.
   */
  v2Dir?: string;
  /**
   * Raíz del depósito de sprites de Ánima II (`http://anima-ii:5190`). Se
   * publica en `/v2/deposito`, porque el navegador del visitante no puede
   * alcanzar el `localhost` de la máquina donde corre el depósito.
   */
  v2Deposito?: string;
}

/**
 * El cliente pega siempre a `/api/...` (ver `API_BASE` en la web) porque en
 * desarrollo el proxy de Vite le quita ese prefijo antes de llegar acá. Para
 * que el mismo cliente funcione cuando este servidor sirve la web, el prefijo
 * se declara alias de la raíz: `/api/me` y `/me` son la misma ruta.
 *
 * Va como `rewriteUrl` y no como hook porque tiene que ocurrir antes del
 * router: un `onRequest` corre cuando la ruta ya se eligió (o ya se falló).
 */
export function stripApiPrefix(url: string): string {
  if (url === '/api') return '/';
  if (!url.startsWith('/api/')) return url;
  return url.slice('/api'.length);
}

/**
 * Backend mínimo de Ánima. Identifica usuarios por su clave pública Nostr
 * (la clave privada jamás llega aquí) y guarda su estado como pares
 * clave-valor. Las skills que viajan dentro del guardado son datos: este
 * servidor no las interpreta ni las ejecuta jamás.
 */
export function buildServer(options: ServerOptions): FastifyInstance {
  const app = Fastify({
    logger: false,
    bodyLimit: MAX_VALUE_BYTES + 4096,
    rewriteUrl: (request) => stripApiPrefix(request.url ?? '/'),
  });
  const db = createDb(options.dbPath);
  const deps: AuthDeps = { db, ...(options.now ? { now: options.now } : {}) };

  app.addHook('onClose', () => {
    db.close();
  });

  const requireAuth = (
    request: FastifyRequest,
    reply: FastifyReply,
  ): { pubkey: string; token: string } | null => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const pubkey = token ? pubkeyForToken(deps, token) : null;
    if (!token || !pubkey) {
      void reply.code(401).send({ error: 'token inválido o expirado' });
      return null;
    }
    return { pubkey, token };
  };

  app.get('/health', () => ({ ok: true }));

  // ---- puente de IA (Codex / Claude) ---------------------------------------
  // Las credenciales las gestiona cada CLI en la máquina donde corre esto; aquí
  // solo viajan estado, la URL de autorización y texto de prompts.
  //
  // Y esa frase esconde a quién le sale la plata: el CLI corre en la máquina
  // del SERVIDOR, así que la cuenta es la de quien hospeda. Por eso los dos
  // puentes existen solo si el dueño los enciende (`cliLocal`); en una
  // instancia publicada no se construyen, y `null` no es una degradación
  // silenciosa — las rutas lo dicen con todas las letras.
  //
  // Un puente inyectado gana sobre el flag: quien lo pasa lo puso a propósito
  // (las pruebas, y el día que aparezca otro puente que no sea un CLI local).
  const cliLocal = options.cliLocal ?? false;
  const aiForUser: AiBridgeFactory | null =
    options.ai ??
    (cliLocal ? createCodexBridgeFactory({ root: options.codexDir ?? 'data/codex' }) : null);
  const claudeAi: AiBridge | null = options.claudeAi ?? (cliLocal ? createClaudeBridge() : null);

  // El proveedor viaja en la query (?provider=claude) en todas las rutas /ai;
  // ausente significa Codex, que fue el primero y sigue siendo el default.
  const aiProviderOf = (
    request: FastifyRequest,
    reply: FastifyReply,
  ): 'codex' | 'claude' | null => {
    const raw = (request.query as { provider?: unknown } | null)?.provider;
    if (raw === undefined || raw === 'codex') return 'codex';
    if (raw === 'claude') return 'claude';
    void reply.code(400).send({ error: 'proveedor de IA desconocido' });
    return null;
  };

  /**
   * Lo que se le contesta a quien pide un puente que esta instancia no presta.
   *
   * Es 503 y no 403: no le falta permiso a nadie: acá no hay nada que dar. Y el
   * mensaje nombra la salida, porque un error que solo dice «no» manda a
   * revisar una configuración del servidor cuando lo que falta está del lado
   * del visitante y lo puede poner en dos minutos.
   */
  const SIN_PUENTE_LOCAL =
    'esta instancia no presta cuentas de IA: enchufá tu propia API OpenAI-compatible en Ajustes';

  /**
   * La identidad de quien pide, o `null` si viene sin token. Un token presente
   * pero inválido no es «invitado»: es 401, y devuelve `false` para que el
   * llamador corte sin volver a contestar.
   */
  const identidadDe = (request: FastifyRequest, reply: FastifyReply): string | null | false => {
    const header = request.headers.authorization;
    if (!header) return null;
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const pubkey = token ? pubkeyForToken(deps, token) : null;
    if (!pubkey) {
      void reply.code(401).send({ error: 'token inválido o expirado' });
      return false;
    }
    return pubkey;
  };

  const aiBridge = (request: FastifyRequest, reply: FastifyReply): AiBridge | null => {
    const provider = aiProviderOf(request, reply);
    if (!provider) return null;
    // El 503 va ANTES de mirar el token: sin puente da igual quién pregunte, y
    // pedirle identidad a alguien para después decirle que no hay nada sería
    // hacerlo autenticarse contra una puerta tapiada.
    if (provider === 'claude' ? claudeAi === null : aiForUser === null) {
      void reply.code(503).send({ error: SIN_PUENTE_LOCAL });
      return null;
    }
    const pubkey = identidadDe(request, reply);
    if (pubkey === false) return null;
    // Claude es la suscripción de la máquina: una sola, la misma para todos.
    // Codex reparte por identidad — cada pubkey su CODEX_HOME, su propia cuenta.
    if (provider === 'claude') return claudeAi;
    return aiForUser === null ? null : aiForUser(pubkey);
  };

  /**
   * El estado es la única ruta /ai que contesta 200 sin puente, y a propósito:
   * la web la consulta en cada arranque para saber con qué piensa la mascota.
   * Un 503 ahí sería un error rojo en la consola de todo el que abra la página
   * para decirle algo que no es un fallo — que esta instancia no presta cuenta.
   *
   * `installed: false` es la verdad desde donde mira quien pregunta: no hay CLI
   * que vos puedas usar acá. Que en el disco del servidor exista uno es un dato
   * del dueño, no del visitante.
   */
  app.get('/ai/status', (request, reply) => {
    const provider = aiProviderOf(request, reply);
    if (!provider) return reply;
    const puente = provider === 'claude' ? claudeAi : aiForUser;
    if (puente === null) {
      return { installed: false, loggedIn: false, available: false, detail: SIN_PUENTE_LOCAL };
    }
    const ai = aiBridge(request, reply);
    if (!ai) return reply;
    return ai.status();
  });

  // El portón `rejectIfManaged` se fue con la cuenta prestada (ADR 0089): un
  // puente que existe es ahora, siempre, un CLI de esta máquina que el dueño
  // encendió a mano. Conectarlo y desconectarlo vuelven a ser suyos porque el
  // único que llega hasta acá es él.
  app.post('/ai/login', async (request, reply) => {
    const ai = aiBridge(request, reply);
    if (!ai) return reply;
    const result = await ai.startLogin();
    if ('error' in result) return reply.code(502).send(result);
    return result;
  });

  // Completa un login que pide pegar el código de autorización (Claude).
  app.post('/ai/login/code', async (request, reply) => {
    const ai = aiBridge(request, reply);
    if (!ai) return reply;
    if (!ai.submitLoginCode) {
      return reply.code(400).send({ error: 'este proveedor completa el login solo' });
    }
    const body = request.body as { code?: unknown } | null;
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!code || code.length > 4096) {
      return reply.code(400).send({ error: 'se espera { code: string }' });
    }
    const result = await ai.submitLoginCode(code);
    if ('error' in result) return reply.code(502).send(result);
    return result;
  });

  app.get('/ai/limits', async (request, reply) => {
    const ai = aiBridge(request, reply);
    if (!ai) return reply;
    try {
      return await ai.limits();
    } catch (error) {
      return reply
        .code(502)
        .send({ error: error instanceof Error ? error.message : 'fallo consultando límites' });
    }
  });

  app.post('/ai/logout', async (request, reply) => {
    const ai = aiBridge(request, reply);
    if (!ai) return reply;
    await ai.logout();
    return reply.code(204).send();
  });

  // Validación compartida de /ai/complete y /ai/complete/stream: responde el
  // 400 y devuelve null si el cuerpo no sirve.
  const parseCompleteBody = (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Parameters<AiBridge['complete']>[0] | null => {
    const provider = aiProviderOf(request, reply);
    if (!provider) return null;
    const body = request.body as {
      prompt?: unknown;
      schema?: unknown;
      model?: unknown;
      reasoningEffort?: unknown;
    } | null;
    if (typeof body?.prompt !== 'string' || body.prompt.length === 0) {
      void reply.code(400).send({ error: 'se espera { prompt: string }' });
      return null;
    }
    // El whitelist de nombres de modelo es el mismo; los niveles de
    // razonamiento son distintos por proveedor (Codex: minimal..xhigh;
    // Claude: low..max) y se validan con la lista del proveedor pedido.
    if (body.model !== undefined && !isCodexModel(body.model)) {
      void reply.code(400).send({ error: 'modelo de IA inválido' });
      return null;
    }
    const validEffort = provider === 'claude' ? isClaudeReasoningEffort : isCodexReasoningEffort;
    if (body.reasoningEffort !== undefined && !validEffort(body.reasoningEffort)) {
      void reply.code(400).send({ error: 'nivel de razonamiento inválido' });
      return null;
    }
    const completeInput: Parameters<AiBridge['complete']>[0] = { prompt: body.prompt };
    if (body.schema !== undefined) completeInput.schema = body.schema;
    if (body.model !== undefined) completeInput.model = body.model;
    if (body.reasoningEffort !== undefined) {
      completeInput.reasoningEffort = body.reasoningEffort;
    }
    return completeInput;
  };

  // Duración de cada consulta al puente (ADR 0039): el servidor no conoce el
  // `kind` (solo viaja el prompt), pero el tamaño del prompt y los ms bastan
  // para correlacionar con los eventos `ai.timing` del navegador.
  const logCompleteTiming = (
    request: FastifyRequest,
    input: Parameters<AiBridge['complete']>[0],
    startedAt: number,
    ok: boolean,
  ): void => {
    request.log.info(
      {
        durationMs: Math.round(performance.now() - startedAt),
        promptChars: input.prompt.length,
        ok,
      },
      'ai.complete',
    );
  };

  app.post('/ai/complete', async (request, reply) => {
    const ai = aiBridge(request, reply);
    if (!ai) return reply;
    const completeInput = parseCompleteBody(request, reply);
    if (!completeInput) return reply;
    const startedAt = performance.now();
    try {
      const text = await ai.complete(completeInput);
      logCompleteTiming(request, completeInput, startedAt, true);
      return { text };
    } catch (error) {
      logCompleteTiming(request, completeInput, startedAt, false);
      return reply
        .code(502)
        .send({ error: error instanceof Error ? error.message : 'fallo del puente de IA' });
    }
  });

  // La misma consulta, pero contando el pensamiento en vivo: cada evento del
  // puente (titulares de razonamiento, respuesta) viaja como SSE en cuanto
  // llega, y el cierre es siempre un `done` con el texto final o un `error`.
  // Los errores viajan dentro del stream porque el 200 ya salió al abrirlo.
  app.post('/ai/complete/stream', async (request, reply) => {
    const ai = aiBridge(request, reply);
    if (!ai) return reply;
    const completeInput = parseCompleteBody(request, reply);
    if (!completeInput) return reply;
    // SSE artesanal: la respuesta deja de ser de Fastify y pasa a ser nuestra.
    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    const send = (event: Record<string, unknown>): void => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const startedAt = performance.now();
    try {
      const text = await ai.complete(completeInput, (event) => send({ ...event }));
      logCompleteTiming(request, completeInput, startedAt, true);
      send({ type: 'done', text });
    } catch (error) {
      logCompleteTiming(request, completeInput, startedAt, false);
      send({
        type: 'error',
        error: error instanceof Error ? error.message : 'fallo del puente de IA',
      });
    }
    reply.raw.end();
  });

  app.post('/auth/challenge', () => {
    pruneExpired(deps);
    return createChallenge(deps);
  });

  app.post('/auth/verify', (request, reply) => {
    const body = request.body as { event?: unknown } | null;
    const result = verifyChallengeEvent(deps, body?.event);
    if (!result.ok) {
      return reply.code(401).send({ error: result.reason });
    }
    return { token: result.token, pubkey: result.pubkey, expiresAt: result.expiresAt };
  });

  app.get('/me', (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return reply;
    return { pubkey: auth.pubkey };
  });

  app.post('/auth/logout', (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return reply;
    revokeToken(deps, auth.token);
    return reply.code(204).send();
  });

  app.get('/data', (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return reply;
    const rows = db
      .prepare('SELECT key FROM user_data WHERE pubkey = ? ORDER BY key')
      .all(auth.pubkey) as { key: string }[];
    return { keys: rows.map((r) => r.key) };
  });

  app.get('/data/:key', (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return reply;
    const { key } = request.params as { key: string };
    const row = db
      .prepare('SELECT value, updated_at FROM user_data WHERE pubkey = ? AND key = ?')
      .get(auth.pubkey, key) as { value: string; updated_at: string } | undefined;
    if (!row) return reply.code(404).send({ error: 'clave inexistente' });
    return { key, value: row.value, updatedAt: row.updated_at };
  });

  app.put('/data/:key', (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return reply;
    const { key } = request.params as { key: string };
    const body = request.body as { value?: unknown } | null;
    if (typeof body?.value !== 'string') {
      return reply.code(400).send({ error: 'se espera { value: string }' });
    }
    if (Buffer.byteLength(body.value, 'utf8') > MAX_VALUE_BYTES) {
      return reply.code(413).send({ error: 'valor demasiado grande' });
    }
    db.prepare(
      `INSERT INTO user_data (pubkey, key, value, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(pubkey, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).run(auth.pubkey, key, body.value, new Date().toISOString());
    return reply.code(204).send();
  });

  app.delete('/data/:key', (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return reply;
    const { key } = request.params as { key: string };
    db.prepare('DELETE FROM user_data WHERE pubkey = ? AND key = ?').run(auth.pubkey, key);
    return reply.code(204).send();
  });

  // ---- Ánima II bajo /v2 ---------------------------------------------------
  // Las dos versiones comparten dominio, y el que reparte es este servidor: ya
  // era la puerta expuesta, así que sumar un nginx habría sido una pieza más
  // para el mismo trabajo. Las dos opciones son opcionales e independientes:
  // sin ellas, este archivo se comporta exactamente como antes de que Ánima II
  // existiera.
  //
  // El depósito va PRIMERO que el estático: `/v2/deposito/...` tiene que ser
  // del depósito y no un archivo que no existe en el dist del juego.
  if (options.v2Deposito) {
    void app.register(fastifyProxy, {
      upstream: options.v2Deposito,
      prefix: '/v2/deposito',
      // El depósito declara sus rutas en la raíz (`/leer`, `/forjar`,
      // `/sprites`): el prefijo es cosa de la puerta, no suya.
      rewritePrefix: '',
      websocket: false,
    });
  }
  if (options.v2Dir) {
    // `/v2` a secas redirige a `/v2/`, y no es cosmética: las rutas relativas
    // del juego cuelgan del directorio, así que sin la barra caerían un nivel
    // más arriba — o sea, en Ánima I. Va explícito porque el `redirect` del
    // plugin vale para los directorios de adentro, no para el prefijo mismo:
    // `/v2` sin barra no llega siquiera a matchear su ruta.
    app.get('/v2', (_request, reply) => reply.redirect('/v2/', 301));
    void app.register(fastifyStatic, {
      root: options.v2Dir,
      prefix: '/v2/',
      // Segunda instancia: sin esto choca con los decoradores de la primera.
      decorateReply: false,
      redirect: true,
    });
  }

  // La web construida, servida por el mismo origen que la API (modo empaquetado).
  // Va al final a propósito: `@fastify/static` monta un comodín `/*` y las rutas
  // declaradas arriba tienen que seguir ganándole.
  if (options.staticDir) {
    void app.register(fastifyStatic, {
      root: options.staticDir,
      ...(options.v2Dir ? { decorateReply: false } : {}),
    });
  }

  return app;
}
