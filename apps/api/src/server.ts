import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AiBridge, AiBridgeFactory } from './ai.js';
import { createCodexBridgeFactory, isCodexModel, isCodexReasoningEffort } from './ai.js';
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

  // ---- puente de IA (Codex) -------------------------------------------------
  // Las credenciales de Codex las gestiona el CLI en la máquina del usuario;
  // aquí solo viajan estado, la URL de autorización y texto de prompts.
  // Cada identidad autenticada usa su propio puente (su propia cuenta de
  // Codex); sin token se usa el puente invitado de la máquina. Un token
  // presente pero inválido es 401: jamás degrada en silencio a invitado.
  const aiForUser =
    options.ai ?? createCodexBridgeFactory({ root: options.codexDir ?? 'data/codex' });

  const aiBridge = (request: FastifyRequest, reply: FastifyReply): AiBridge | null => {
    const header = request.headers.authorization;
    if (!header) return aiForUser(null);
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const pubkey = token ? pubkeyForToken(deps, token) : null;
    if (!pubkey) {
      void reply.code(401).send({ error: 'token inválido o expirado' });
      return null;
    }
    return aiForUser(pubkey);
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

  app.post('/ai/complete', async (request, reply) => {
    const ai = aiBridge(request, reply);
    if (!ai) return reply;
    const body = request.body as {
      prompt?: unknown;
      schema?: unknown;
      model?: unknown;
      reasoningEffort?: unknown;
    } | null;
    if (typeof body?.prompt !== 'string' || body.prompt.length === 0) {
      return reply.code(400).send({ error: 'se espera { prompt: string }' });
    }
    if (body.model !== undefined && !isCodexModel(body.model)) {
      return reply.code(400).send({ error: 'modelo Codex inválido' });
    }
    if (body.reasoningEffort !== undefined && !isCodexReasoningEffort(body.reasoningEffort)) {
      return reply.code(400).send({ error: 'nivel de razonamiento Codex inválido' });
    }
    try {
      const completeInput: Parameters<AiBridge['complete']>[0] = { prompt: body.prompt };
      if (body.schema !== undefined) completeInput.schema = body.schema;
      if (body.model !== undefined) completeInput.model = body.model;
      if (body.reasoningEffort !== undefined) {
        completeInput.reasoningEffort = body.reasoningEffort;
      }
      const text = await ai.complete(completeInput);
      return { text };
    } catch (error) {
      return reply
        .code(502)
        .send({ error: error instanceof Error ? error.message : 'fallo del puente de IA' });
    }
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
