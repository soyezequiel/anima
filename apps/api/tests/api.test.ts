import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { AUTH_EVENT_KIND } from '../src/auth.js';
import { buildServer } from '../src/server.js';

let app: FastifyInstance;
const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);

beforeAll(async () => {
  app = buildServer({ dbPath: ':memory:' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function getChallenge(): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/auth/challenge' });
  expect(res.statusCode).toBe(200);
  return (res.json() as { challenge: string }).challenge;
}

function signedAuthEvent(challenge: string, overrides: Partial<{ kind: number; created_at: number }> = {}) {
  return finalizeEvent(
    {
      kind: overrides.kind ?? AUTH_EVENT_KIND,
      created_at: overrides.created_at ?? Math.floor(Date.now() / 1000),
      tags: [['challenge', challenge]],
      content: '',
    },
    secretKey,
  );
}

async function login(): Promise<string> {
  const challenge = await getChallenge();
  const res = await app.inject({
    method: 'POST',
    url: '/auth/verify',
    payload: { event: signedAuthEvent(challenge) },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json() as { token: string; pubkey: string };
  expect(body.pubkey).toBe(pubkey);
  return body.token;
}

describe('autenticación por desafío firmado', () => {
  it('acepta un evento kind 22242 válido y deriva la pubkey del evento', async () => {
    const token = await login();
    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ pubkey });
  });

  it('rechaza reutilizar un desafío (un solo uso)', async () => {
    const challenge = await getChallenge();
    const event = signedAuthEvent(challenge);
    const first = await app.inject({ method: 'POST', url: '/auth/verify', payload: { event } });
    expect(first.statusCode).toBe(200);
    const replay = await app.inject({ method: 'POST', url: '/auth/verify', payload: { event } });
    expect(replay.statusCode).toBe(401);
    expect((replay.json() as { error: string }).error).toContain('utilizado');
  });

  it('rechaza kind inesperado, desafío desconocido, evento viejo y firma inválida', async () => {
    const challenge = await getChallenge();

    const wrongKind = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { event: signedAuthEvent(challenge, { kind: 1 }) },
    });
    expect(wrongKind.statusCode).toBe(401);

    const unknown = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { event: signedAuthEvent('deadbeef'.repeat(8)) },
    });
    expect(unknown.statusCode).toBe(401);

    const stale = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: {
        event: signedAuthEvent(challenge, { created_at: Math.floor(Date.now() / 1000) - 3600 }),
      },
    });
    expect(stale.statusCode).toBe(401);

    const valid = signedAuthEvent(challenge);
    const tampered = { ...valid, content: 'alterado' };
    const badSig = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { event: tampered },
    });
    expect(badSig.statusCode).toBe(401);
  });

  it('una pubkey no basta: sin token no hay acceso', async () => {
    const anon = await app.inject({ method: 'GET', url: '/me' });
    expect(anon.statusCode).toBe(401);
    const bogus = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer 0000' },
    });
    expect(bogus.statusCode).toBe(401);
  });

  it('logout revoca el token', async () => {
    const token = await login();
    const out = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(out.statusCode).toBe(204);
    const after = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(after.statusCode).toBe(401);
  });
});

describe('almacenamiento clave-valor por usuario', () => {
  it('guarda, lee, lista y borra valores del usuario autenticado', async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const put = await app.inject({
      method: 'PUT',
      url: '/data/save',
      headers,
      payload: { value: JSON.stringify({ mundo: 1 }) },
    });
    expect(put.statusCode).toBe(204);

    const get = await app.inject({ method: 'GET', url: '/data/save', headers });
    expect(get.statusCode).toBe(200);
    expect((get.json() as { value: string }).value).toBe(JSON.stringify({ mundo: 1 }));

    const list = await app.inject({ method: 'GET', url: '/data', headers });
    expect((list.json() as { keys: string[] }).keys).toEqual(['save']);

    const del = await app.inject({ method: 'DELETE', url: '/data/save', headers });
    expect(del.statusCode).toBe(204);
    const missing = await app.inject({ method: 'GET', url: '/data/save', headers });
    expect(missing.statusCode).toBe(404);
  });

  it('los datos de un usuario no son visibles para otro', async () => {
    const tokenA = await login();
    await app.inject({
      method: 'PUT',
      url: '/data/privado',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { value: 'secreto-de-a' },
    });

    const otherKey = generateSecretKey();
    const challenge = await getChallenge();
    const event = finalizeEvent(
      {
        kind: AUTH_EVENT_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['challenge', challenge]],
        content: '',
      },
      otherKey,
    );
    const login2 = await app.inject({ method: 'POST', url: '/auth/verify', payload: { event } });
    const tokenB = (login2.json() as { token: string }).token;

    const stolen = await app.inject({
      method: 'GET',
      url: '/data/privado',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(stolen.statusCode).toBe(404);
  });

  it('valida el cuerpo y el tamaño', async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };
    const bad = await app.inject({
      method: 'PUT',
      url: '/data/x',
      headers,
      payload: { value: 42 },
    });
    expect(bad.statusCode).toBe(400);
  });
});
