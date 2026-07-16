import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AiBridge } from '../src/ai.js';
import { buildServer } from '../src/server.js';

let app: FastifyInstance;
const calls: { prompt: string; schema?: unknown }[] = [];

const fakeBridge: AiBridge = {
  status: () => Promise.resolve({ installed: true, loggedIn: true, detail: 'Logged in using ChatGPT' }),
  startLogin: () => Promise.resolve({ authUrl: 'https://auth.openai.com/oauth/authorize?x=1' }),
  complete: (input) => {
    calls.push(input);
    if (input.prompt.includes('explota')) return Promise.reject(new Error('codex exec falló'));
    return Promise.resolve('{"text":"hola"}');
  },
};

beforeAll(async () => {
  app = buildServer({ dbPath: ':memory:', ai: fakeBridge });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('puente de IA', () => {
  it('expone el estado de la sesión de Codex', async () => {
    const res = await app.inject({ method: 'GET', url: '/ai/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ installed: true, loggedIn: true });
  });

  it('inicia el login y devuelve la URL de autorización', async () => {
    const res = await app.inject({ method: 'POST', url: '/ai/login' });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { authUrl: string }).authUrl).toContain('https://auth.openai.com/');
  });

  it('completa un prompt reenviando el esquema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ai/complete',
      payload: { prompt: 'di hola', schema: { type: 'object' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ text: '{"text":"hola"}' });
    expect(calls.at(-1)).toEqual({ prompt: 'di hola', schema: { type: 'object' } });
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
