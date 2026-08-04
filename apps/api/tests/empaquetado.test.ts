import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer, stripApiPrefix } from '../src/server.js';

/**
 * El modo empaquetado (un solo proceso sirviendo API y web) tiene que dejar la
 * web tal cual está: el cliente pega a `/api/...` porque en desarrollo el proxy
 * de Vite le quita ese prefijo. Acá se comprueba que el servidor hace lo mismo
 * y que servir archivos no le come las rutas a la API.
 */

describe('el prefijo /api es alias de la raíz', () => {
  it('lo saca cuando está y no toca nada más', () => {
    expect(stripApiPrefix('/api/health')).toBe('/health');
    expect(stripApiPrefix('/api')).toBe('/');
    expect(stripApiPrefix('/api/data/x?y=1')).toBe('/data/x?y=1');
    expect(stripApiPrefix('/health')).toBe('/health');
    // Una ruta que apenas empieza igual no es el prefijo.
    expect(stripApiPrefix('/apifoo')).toBe('/apifoo');
  });
});

describe('servidor empaquetado', () => {
  let app: FastifyInstance;
  let webDir: string;

  beforeAll(async () => {
    webDir = mkdtempSync(join(tmpdir(), 'anima-web-'));
    writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>Ánima</title>', 'utf8');
    app = buildServer({ dbPath: ':memory:', staticDir: webDir });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(webDir, { recursive: true, force: true });
  });

  it('atiende la API por las dos puertas', async () => {
    const directa = await app.inject({ method: 'GET', url: '/health' });
    const conPrefijo = await app.inject({ method: 'GET', url: '/api/health' });
    expect(directa.statusCode).toBe(200);
    expect(conPrefijo.statusCode).toBe(200);
    expect(conPrefijo.json()).toEqual({ ok: true });
  });

  it('sirve la web en la raíz sin pisar las rutas de la API', async () => {
    const raiz = await app.inject({ method: 'GET', url: '/' });
    expect(raiz.statusCode).toBe(200);
    expect(raiz.body).toContain('Ánima');
    // El comodín de los archivos no le ganó a una ruta declarada.
    const api = await app.inject({ method: 'GET', url: '/data' });
    expect(api.statusCode).toBe(401);
  });

  it('las dos versiones conviven sin comerse las rutas', async () => {
    // Un depósito de mentira: alcanza con que conteste para saber que la
    // puerta lo encontró y le sacó el prefijo.
    const pedidos: string[] = [];
    const deposito = createServer((req, res) => {
      pedidos.push(req.url ?? '');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ desde: 'el depósito', url: req.url }));
    });
    await new Promise<void>((listo) => deposito.listen(0, '127.0.0.1', listo));
    const puerto = (deposito.address() as AddressInfo).port;

    const v2Dir = mkdtempSync(join(tmpdir(), 'anima-v2-'));
    writeFileSync(join(v2Dir, 'index.html'), '<!doctype html><title>Ánima II</title>', 'utf8');
    const puerta = buildServer({
      dbPath: ':memory:',
      staticDir: webDir,
      v2Dir,
      v2Deposito: `http://127.0.0.1:${String(puerto)}`,
    });
    await puerta.ready();

    try {
      // Cada versión sirve la suya.
      const uno = await puerta.inject({ method: 'GET', url: '/' });
      const dos = await puerta.inject({ method: 'GET', url: '/v2/' });
      expect(uno.body).toContain('Ánima');
      expect(uno.body).not.toContain('Ánima II');
      expect(dos.body).toContain('Ánima II');

      // `/v2` sin barra redirige: las rutas del juego cuelgan del directorio.
      const sinBarra = await puerta.inject({ method: 'GET', url: '/v2' });
      expect([301, 302]).toContain(sinBarra.statusCode);

      // El depósito gana sobre el estático, y le llega la ruta SIN el prefijo.
      const leer = await puerta.inject({ method: 'GET', url: '/v2/deposito/sprites' });
      expect(leer.statusCode).toBe(200);
      expect(pedidos).toContain('/sprites');

      // Y la API de Ánima I sigue siendo suya.
      expect((await puerta.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    } finally {
      await puerta.close();
      await new Promise<void>((listo) => deposito.close(() => listo()));
      rmSync(v2Dir, { recursive: true, force: true });
    }
  });

  it('sin web construida se comporta como la API de siempre', async () => {
    const soloApi = buildServer({ dbPath: ':memory:' });
    await soloApi.ready();
    try {
      const raiz = await soloApi.inject({ method: 'GET', url: '/' });
      expect(raiz.statusCode).toBe(404);
      const salud = await soloApi.inject({ method: 'GET', url: '/api/health' });
      expect(salud.statusCode).toBe(200);
    } finally {
      await soloApi.close();
    }
  });
});
