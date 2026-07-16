import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { writeFile } from 'node:fs/promises';
import type { AiBridge, AiBridgeFactory, AiLimits } from '../src/ai.js';
import {
  codexErrorDetail,
  codexHomeFor,
  createCodexBridge,
  createCodexBridgeFactory,
  isUnsupportedEffortError,
  parseRateLimitsResponse,
} from '../src/ai.js';
import { buildServer } from '../src/server.js';

let app: FastifyInstance;
const calls: Parameters<AiBridge['complete']>[0][] = [];
const bridgeUsers: (string | null)[] = [];
const logouts: (string | null)[] = [];

const fakeLimits: AiLimits = {
  planType: 'plus',
  primary: { usedPercent: 48, windowDurationMins: 10_080, resetsAt: 1_784_822_466 },
  secondary: null,
};

function fakeBridge(pubkey: string | null): AiBridge {
  return {
    status: () =>
      Promise.resolve({ installed: true, loggedIn: true, detail: 'Logged in using ChatGPT' }),
    startLogin: () => Promise.resolve({ authUrl: 'https://auth.openai.com/oauth/authorize?x=1' }),
    logout: () => {
      logouts.push(pubkey);
      return Promise.resolve();
    },
    limits: () =>
      pubkey === null
        ? Promise.resolve(fakeLimits)
        : Promise.reject(new Error('codex app-server: sin sesión')),
    complete: (input) => {
      calls.push(input);
      if (input.prompt.includes('explota')) return Promise.reject(new Error('codex exec falló'));
      return Promise.resolve('{"text":"hola"}');
    },
  };
}

const fakeFactory: AiBridgeFactory = (pubkey) => {
  bridgeUsers.push(pubkey);
  return fakeBridge(pubkey);
};

const secret = generateSecretKey();
const pubkey = getPublicKey(secret);

async function loginToken(): Promise<string> {
  const challengeRes = await app.inject({ method: 'POST', url: '/auth/challenge' });
  const { challenge } = challengeRes.json() as { challenge: string };
  const event = finalizeEvent(
    {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['challenge', challenge]],
      content: '',
    },
    secret,
  );
  const verifyRes = await app.inject({ method: 'POST', url: '/auth/verify', payload: { event } });
  expect(verifyRes.statusCode).toBe(200);
  return (verifyRes.json() as { token: string }).token;
}

beforeAll(async () => {
  app = buildServer({ dbPath: ':memory:', ai: fakeFactory });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('puente de IA', () => {
  it('expone el estado de la sesión de Codex (invitado sin token)', async () => {
    const res = await app.inject({ method: 'GET', url: '/ai/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ installed: true, loggedIn: true });
    expect(bridgeUsers.at(-1)).toBeNull();
  });

  it('con token de sesión usa el puente de esa identidad', async () => {
    const token = await loginToken();
    const res = await app.inject({
      method: 'GET',
      url: '/ai/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(bridgeUsers.at(-1)).toBe(pubkey);

    const login = await app.inject({
      method: 'POST',
      url: '/ai/login',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(login.statusCode).toBe(200);
    expect(bridgeUsers.at(-1)).toBe(pubkey);
  });

  it('informa los límites de uso de la cuenta y traduce fallos a 502', async () => {
    const guest = await app.inject({ method: 'GET', url: '/ai/limits' });
    expect(guest.statusCode).toBe(200);
    expect(guest.json()).toEqual(fakeLimits);
    expect(bridgeUsers.at(-1)).toBeNull();

    // El puente de esta identidad no tiene sesión: el fallo viaja como 502.
    const token = await loginToken();
    const authed = await app.inject({
      method: 'GET',
      url: '/ai/limits',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(authed.statusCode).toBe(502);
    expect((authed.json() as { error: string }).error).toContain('sin sesión');
    expect(bridgeUsers.at(-1)).toBe(pubkey);
  });

  it('un token inválido es 401, no degrada a invitado', async () => {
    for (const [method, url] of [
      ['GET', '/ai/status'],
      ['GET', '/ai/limits'],
      ['POST', '/ai/login'],
      ['POST', '/ai/logout'],
      ['POST', '/ai/complete'],
    ] as const) {
      const before = bridgeUsers.length;
      const res = await app.inject({
        method,
        url,
        headers: { authorization: 'Bearer token-falso' },
        ...(url === '/ai/complete' ? { payload: { prompt: 'hola' } } : {}),
      });
      expect(res.statusCode).toBe(401);
      expect(bridgeUsers.length).toBe(before);
    }
  });

  it('cierra la sesión de Codex de la identidad actual', async () => {
    const token = await loginToken();
    const res = await app.inject({
      method: 'POST',
      url: '/ai/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
    expect(logouts.at(-1)).toBe(pubkey);

    const guest = await app.inject({ method: 'POST', url: '/ai/logout' });
    expect(guest.statusCode).toBe(204);
    expect(logouts.at(-1)).toBeNull();
  });

  it('inicia el login y devuelve la URL de autorización', async () => {
    const res = await app.inject({ method: 'POST', url: '/ai/login' });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { authUrl: string }).authUrl).toContain('https://auth.openai.com/');
  });

  it('completa un prompt reenviando el esquema y los ajustes de Codex', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ai/complete',
      payload: {
        prompt: 'di hola',
        schema: { type: 'object' },
        model: 'gpt-5.6-terra',
        reasoningEffort: 'high',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ text: '{"text":"hola"}' });
    expect(calls.at(-1)).toEqual({
      prompt: 'di hola',
      schema: { type: 'object' },
      model: 'gpt-5.6-terra',
      reasoningEffort: 'high',
    });
  });

  it('rechaza modelos y niveles inválidos antes de invocar el CLI', async () => {
    const callsBefore = calls.length;
    const unsafeModel = await app.inject({
      method: 'POST',
      url: '/ai/complete',
      payload: { prompt: 'hola', model: 'gpt-5.6 & whoami' },
    });
    expect(unsafeModel.statusCode).toBe(400);
    expect((unsafeModel.json() as { error: string }).error).toContain('modelo');

    const invalidEffort = await app.inject({
      method: 'POST',
      url: '/ai/complete',
      payload: { prompt: 'hola', reasoningEffort: 'maximum' },
    });
    expect(invalidEffort.statusCode).toBe(400);
    expect((invalidEffort.json() as { error: string }).error).toContain('razonamiento');
    expect(calls).toHaveLength(callsBefore);
  });

  it('valida el cuerpo y traduce fallos del puente a 502', async () => {
    const bad = await app.inject({ method: 'POST', url: '/ai/complete', payload: { prompt: 42 } });
    expect(bad.statusCode).toBe(400);

    const boom = await app.inject({
      method: 'POST',
      url: '/ai/complete',
      payload: { prompt: 'explota' },
    });
    expect(boom.statusCode).toBe(502);
    expect((boom.json() as { error: string }).error).toContain('codex exec falló');
  });
});

describe('parseRateLimitsResponse', () => {
  it('normaliza la respuesta real del app-server de Codex', () => {
    // Forma observada en codex-cli 0.144.5 (account/rateLimits/read).
    const result = {
      rateLimits: {
        limitId: 'codex',
        limitName: null,
        primary: { usedPercent: 48, windowDurationMins: 10080, resetsAt: 1784822466 },
        secondary: null,
        credits: { hasCredits: false, unlimited: false, balance: '0' },
        individualLimit: null,
        planType: 'plus',
        rateLimitReachedType: null,
      },
      rateLimitsByLimitId: {},
      rateLimitResetCredits: { availableCount: 0, credits: [] },
    };
    expect(parseRateLimitsResponse(result)).toEqual({
      planType: 'plus',
      primary: { usedPercent: 48, windowDurationMins: 10080, resetsAt: 1784822466 },
      secondary: null,
    });
  });

  it('tolera ventanas parciales y rechaza respuestas sin límites', () => {
    expect(parseRateLimitsResponse({ rateLimits: { primary: { usedPercent: 3 } } })).toEqual({
      planType: null,
      primary: { usedPercent: 3, windowDurationMins: null, resetsAt: null },
      secondary: null,
    });
    expect(() => parseRateLimitsResponse({})).toThrow(/límites/);
    expect(() => parseRateLimitsResponse(null)).toThrow(/límites/);
  });
});

// Forma observada en vivo: el backend rechaza `minimal` con el modelo
// premium de la cuenta y codex exec vuelca dos bloques JSON en stderr.
const unsupportedEffortStderr = `stream error: { "type": "invalid_request_error", "code": "unsupported_value", "message": "Unsupported value: 'minimal' is not supported with the 'gpt-5.6-terra-premium-1p-codexswic-external' model.", "param": "reasoning.effort" }, "status": 400 } ERROR: { "type": "error", "error": { "type": "invalid_request_error", "code": "unsupported_value", "message": "Unsupported value: 'minimal' is not supported with the 'gpt-5.6-terra-premium-1p-codexswic-external' model.", "param": "reasoning.effort" }, "status": 400 }`;

describe('errores de codex exec', () => {
  it('reconoce el rechazo del nivel de razonamiento', () => {
    expect(isUnsupportedEffortError(unsupportedEffortStderr)).toBe(true);
    expect(isUnsupportedEffortError('ERROR: stream disconnected before completion')).toBe(false);
    expect(
      isUnsupportedEffortError(
        '{"code":"unsupported_value","message":"bad country","param":"region"}',
      ),
    ).toBe(false);
  });

  it('extrae el mensaje humano del volcado JSON', () => {
    expect(codexErrorDetail(unsupportedEffortStderr)).toBe(
      "Unsupported value: 'minimal' is not supported with the 'gpt-5.6-terra-premium-1p-codexswic-external' model.",
    );
    expect(codexErrorDetail('sin json reconocible')).toBe('sin json reconocible');
  });

  it('reintenta sin nivel cuando el modelo lo rechaza y recuerda la combinación', async () => {
    const execArgs: string[][] = [];
    const bridge = createCodexBridge({
      exec: async (args) => {
        execArgs.push(args);
        if (args.some((arg) => arg.includes('model_reasoning_effort=minimal'))) {
          return { code: 1, stdout: '', stderr: unsupportedEffortStderr, failedToStart: false };
        }
        const outFile = args[args.indexOf('--output-last-message') + 1]!;
        await writeFile(outFile, '{"text":"ok"}', 'utf8');
        return { code: 0, stdout: '', stderr: '', failedToStart: false };
      },
    });
    const input = { prompt: 'hola', model: 'gpt-5.6-terra', reasoningEffort: 'minimal' } as const;
    await expect(bridge.complete(input)).resolves.toBe('{"text":"ok"}');
    expect(execArgs).toHaveLength(2);
    expect(execArgs[1]!.join(' ')).not.toContain('model_reasoning_effort');

    // La combinación queda recordada: la siguiente consulta no paga el
    // intento fallido y sale directamente sin forzar el nivel.
    await expect(bridge.complete(input)).resolves.toBe('{"text":"ok"}');
    expect(execArgs).toHaveLength(3);
    expect(execArgs[2]!.join(' ')).not.toContain('model_reasoning_effort');
  });

  it('un fallo definitivo llega con el mensaje limpio, no el JSON crudo', async () => {
    const bridge = createCodexBridge({
      exec: () =>
        Promise.resolve({
          code: 1,
          stdout: '',
          stderr: unsupportedEffortStderr,
          failedToStart: false,
        }),
    });
    await expect(bridge.complete({ prompt: 'hola' })).rejects.toThrow(
      /código 1: Unsupported value: 'minimal'/,
    );
  });
});

describe('fábrica de puentes por identidad', () => {
  it('asigna un CODEX_HOME por pubkey y rechaza pubkeys que no son 64 hex', () => {
    const home = codexHomeFor('data/codex', pubkey);
    expect(home).toBe(join('data/codex', pubkey));
    expect(() => codexHomeFor('data/codex', '../escape')).toThrow(/pubkey/);
    expect(() => codexHomeFor('data/codex', 'abc')).toThrow(/pubkey/);
  });

  it('cachea un puente por identidad y otro para el invitado', () => {
    const root = mkdtempSync(join(tmpdir(), 'anima-codex-test-'));
    try {
      const factory = createCodexBridgeFactory({ root });
      const alice = getPublicKey(generateSecretKey());
      expect(factory(alice)).toBe(factory(alice));
      expect(factory(null)).toBe(factory(null));
      expect(factory(alice)).not.toBe(factory(null));
      expect(factory(alice)).not.toBe(factory(getPublicKey(generateSecretKey())));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
