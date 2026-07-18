import Fastify from 'fastify';
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
}

/**
 * Backend mínimo de Ánima. Identifica usuarios por su clave pública Nostr
 * (la clave privada jamás llega aquí) y guarda su estado como pares
 * clave-valor. Las skills que viajan dentro del guardado son datos: este
 * servidor no las interpreta ni las ejecuta jamás.
 */
export function buildServer(options: ServerOptions): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: MAX_VALUE_BYTES + 4096 });
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
  // Las credenciales las gestiona cada CLI en la máquina del usuario; aquí
  // solo viajan estado, la URL de autorización y texto de prompts.
  // Con Codex cada identidad autenticada usa su propio puente (su propia
  // cuenta); sin token se usa el puente invitado de la máquina. El puente de
  // Claude es único: es la suscripción personal del dueño de la máquina.
  // Un token presente pero inválido es 401: jamás degrada en silencio.
  const aiForUser =
    options.ai ?? createCodexBridgeFactory({ root: options.codexDir ?? 'data/codex' });
  const claudeAi = options.claudeAi ?? createClaudeBridge();

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

  const aiBridge = (request: FastifyRequest, reply: FastifyReply): AiBridge | null => {
    const provider = aiProviderOf(request, reply);
    if (!provider) return null;
    const header = request.headers.authorization;
    if (!header) return provider === 'claude' ? claudeAi : aiForUser(null);
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const pubkey = token ? pubkeyForToken(deps, token) : null;
    if (!pubkey) {
      void reply.code(401).send({ error: 'token inválido o expirado' });
      return null;
    }
    return provider === 'claude' ? claudeAi : aiForUser(pubkey);
  };

  app.get('/ai/status', (request, reply) => {
    const ai = aiBridge(request, reply);
    if (!ai) return reply;
    return ai.status();
  });

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

  return app;
}
