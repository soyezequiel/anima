import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AiBridge, AiBridgeFactory, RunResult } from '../src/ai.js';
import type { ClaudeExec } from '../src/claude.js';
import {
  claudeErrorDetail,
  createClaudeBridge,
  isClaudeReasoningEffort,
  isUnknownClaudeModelError,
  readClaudeResultLine,
  readClaudeThoughtEvents,
} from '../src/claude.js';
import { buildServer } from '../src/server.js';

const ok = (stdout: string): RunResult => ({ code: 0, stdout, stderr: '', failedToStart: false });

const resultLine = (text: string): string =>
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text });

describe('puente de Claude: estado', () => {
  it('parsea el JSON de `claude auth status`', async () => {
    const seen: string[][] = [];
    const exec: ClaudeExec = (args) => {
      seen.push(args);
      return Promise.resolve(
        ok('{"loggedIn":true,"email":"ana@ejemplo.com","subscriptionType":"pro"}'),
      );
    };
    const bridge = createClaudeBridge({ exec });
    const status = await bridge.status();
    expect(status).toEqual({
      installed: true,
      loggedIn: true,
      detail: 'ana@ejemplo.com (pro)',
    });
    expect(seen[0]).toEqual(['auth', 'status', '--json']);
  });

  it('distingue CLI ausente de sesión cerrada', async () => {
    const missing = createClaudeBridge({
      exec: () =>
        Promise.resolve({ code: null, stdout: '', stderr: '', failedToStart: true }),
    });
    expect(await missing.status()).toMatchObject({ installed: false, loggedIn: false });

    const loggedOut = createClaudeBridge({
      exec: () => Promise.resolve(ok('{"loggedIn":false}')),
    });
    expect(await loggedOut.status()).toMatchObject({ installed: true, loggedIn: false });
  });

  it('no informa límites: el CLI no los expone', async () => {
    const bridge = createClaudeBridge({ exec: () => Promise.resolve(ok('')) });
    await expect(bridge.limits()).rejects.toThrow(/no informa límites/);
  });
});

describe('puente de Claude: consultas', () => {
  it('ejecuta `claude -p` con modelo y nivel por defecto (sonnet, bajo)', async () => {
    const seen: { args: string[]; stdin?: string }[] = [];
    const exec: ClaudeExec = (args, options) => {
      seen.push({ args, ...(options.stdin !== undefined ? { stdin: options.stdin } : {}) });
      return Promise.resolve(ok(resultLine('{"text":"hola"}')));
    };
    const bridge = createClaudeBridge({ exec });
    const text = await bridge.complete({ prompt: 'saluda', schema: { type: 'object' } });
    expect(text).toBe('{"text":"hola"}');
    const call = seen[0]!;
    expect(call.args).toContain('--print');
    expect(call.args).toContain('--safe-mode');
    expect(call.args.join(' ')).toContain('--output-format json');
    expect(call.args.join(' ')).toContain('--effort low');
    expect(call.args.join(' ')).toContain('--model claude-sonnet-5');
    // El prompt entra por stdin y lleva el esquema pegado: el CLI de Claude
    // no tiene un --output-schema como Codex.
    expect(call.stdin).toContain('saluda');
    expect(call.stdin).toContain('"type":"object"');
  });

  it('respeta modelo y nivel pedidos por el navegador', async () => {
    const seen: string[][] = [];
    const exec: ClaudeExec = (args) => {
      seen.push(args);
      return Promise.resolve(ok(resultLine('ok')));
    };
    const bridge = createClaudeBridge({ exec });
    await bridge.complete({ prompt: 'p', model: 'claude-opus-4-8', reasoningEffort: 'max' });
    expect(seen[0]!.join(' ')).toContain('--model claude-opus-4-8');
    expect(seen[0]!.join(' ')).toContain('--effort max');
  });

  it('rechaza niveles de razonamiento ajenos a Claude', async () => {
    const bridge = createClaudeBridge({ exec: () => Promise.resolve(ok(resultLine('x'))) });
    await expect(
      bridge.complete({ prompt: 'p', reasoningEffort: 'minimal' }),
    ).rejects.toThrow(/nivel de razonamiento Claude inválido/);
    expect(isClaudeReasoningEffort('max')).toBe(true);
    expect(isClaudeReasoningEffort('minimal')).toBe(false);
  });

  it('cae al modelo predeterminado cuando la cuenta no ofrece el pedido, y lo recuerda', async () => {
    const seen: string[][] = [];
    const exec: ClaudeExec = (args) => {
      seen.push(args);
      if (args.join(' ').includes('--model claude-vieja')) {
        return Promise.resolve(
          ok(
            JSON.stringify({
              type: 'result',
              subtype: 'error',
              is_error: true,
              result: 'API error: 404 not_found_error: model claude-vieja not found',
            }),
          ),
        );
      }
      return Promise.resolve(ok(resultLine('respuesta')));
    };
    const bridge = createClaudeBridge({ exec });
    const text = await bridge.complete({ prompt: 'p', model: 'claude-vieja' });
    expect(text).toBe('respuesta');
    expect(seen).toHaveLength(2);
    expect(seen[1]!.join(' ')).not.toContain('--model');

    // La segunda consulta ya no paga el intento fallido.
    await bridge.complete({ prompt: 'p', model: 'claude-vieja' });
    expect(seen).toHaveLength(3);
    expect(seen[2]!.join(' ')).not.toContain('--model');
  });

  it('en modo vivo emite razonamiento y respuesta a medida que llegan', async () => {
    const exec: ClaudeExec = (args, options) => {
      expect(args.join(' ')).toContain('--output-format stream-json');
      expect(args).toContain('--verbose');
      options.onStdout?.(
        `${JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'thinking', thinking: 'pienso el saludo' }] },
        })}\n`,
      );
      options.onStdout?.(
        `${JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'text', text: '{"text":"hola"}' }] },
        })}\n${resultLine('{"text":"hola"}')}\n`,
      );
      return Promise.resolve(ok(''));
    };
    const bridge = createClaudeBridge({ exec });
    const events: { type: string; text: string }[] = [];
    const text = await bridge.complete({ prompt: 'saluda' }, (event) => events.push(event));
    expect(text).toBe('{"text":"hola"}');
    expect(events).toEqual([
      { type: 'reasoning', text: 'pienso el saludo' },
      { type: 'answer', text: '{"text":"hola"}' },
    ]);
  });

  it('traduce un cierre con error a una excepción legible', async () => {
    const exec: ClaudeExec = () =>
      Promise.resolve(
        ok(
          JSON.stringify({
            type: 'result',
            subtype: 'error',
            is_error: true,
            result: 'Credit balance too low',
          }),
        ),
      );
    const bridge = createClaudeBridge({ exec });
    await expect(bridge.complete({ prompt: 'p' })).rejects.toThrow(/Credit balance too low/);
  });
});

describe('puente de Claude: lectura del stream', () => {
  it('lee bloques thinking y text de una línea assistant', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'thinking', thinking: 'hmm' },
          { type: 'text', text: 'hola' },
        ],
      },
    });
    expect(readClaudeThoughtEvents(line)).toEqual([
      { type: 'reasoning', text: 'hmm' },
      { type: 'answer', text: 'hola' },
    ]);
    expect(readClaudeThoughtEvents('{"type":"system"}')).toEqual([]);
    expect(readClaudeThoughtEvents('no es json')).toEqual([]);
  });

  it('lee el cierre result con y sin error', () => {
    expect(readClaudeResultLine(resultLine('fin'))).toEqual({ text: 'fin', isError: false });
    expect(
      readClaudeResultLine(JSON.stringify({ type: 'result', is_error: true, result: 'ay' })),
    ).toEqual({ text: 'ay', isError: true });
    expect(readClaudeResultLine('{"type":"assistant"}')).toBeNull();
  });

  it('detecta el error de modelo desconocido y extrae detalle humano', () => {
    expect(isUnknownClaudeModelError('404 not_found_error: model x not found')).toBe(true);
    expect(isUnknownClaudeModelError('model claude-x does not exist')).toBe(true);
    expect(isUnknownClaudeModelError('rate limit exceeded')).toBe(false);
    expect(
      claudeErrorDetail({
        code: 1,
        stdout: '',
        stderr: 'algo se rompió',
        failedToStart: false,
      }),
    ).toBe('algo se rompió');
  });
});

describe('rutas /ai con proveedor claude', () => {
  let app: FastifyInstance;
  const codexCalls: string[] = [];
  const claudeCalls: Parameters<AiBridge['complete']>[0][] = [];

  const fakeCodexFactory: AiBridgeFactory = () => ({
    status: () => {
      codexCalls.push('status');
      return Promise.resolve({ installed: true, loggedIn: true, detail: 'codex' });
    },
    startLogin: () => Promise.resolve({ authUrl: 'https://auth.openai.com/x' }),
    logout: () => Promise.resolve(),
    limits: () => Promise.reject(new Error('sin límites')),
    complete: () => Promise.resolve('codex dixit'),
  });

  const fakeClaude: AiBridge = {
    status: () =>
      Promise.resolve({ installed: true, loggedIn: true, detail: 'ana@ejemplo.com (pro)' }),
    startLogin: () => Promise.resolve({ authUrl: 'https://claude.ai/oauth/x' }),
    logout: () => Promise.resolve(),
    limits: () => Promise.reject(new Error('el CLI de Claude no informa límites de uso')),
    complete: (input) => {
      claudeCalls.push(input);
      return Promise.resolve('{"text":"desde claude"}');
    },
  };

  beforeAll(async () => {
    app = buildServer({ dbPath: ':memory:', ai: fakeCodexFactory, claudeAi: fakeClaude });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('?provider=claude enruta al puente de Claude; sin provider sigue Codex', async () => {
    const claude = await app.inject({ method: 'GET', url: '/ai/status?provider=claude' });
    expect(claude.statusCode).toBe(200);
    expect(claude.json()).toMatchObject({ detail: 'ana@ejemplo.com (pro)' });

    const codex = await app.inject({ method: 'GET', url: '/ai/status' });
    expect(codex.statusCode).toBe(200);
    expect(codex.json()).toMatchObject({ detail: 'codex' });

    const unknown = await app.inject({ method: 'GET', url: '/ai/status?provider=gemini' });
    expect(unknown.statusCode).toBe(400);
  });

  it('acepta niveles de Claude que Codex no tiene, y viceversa los rechaza', async () => {
    const max = await app.inject({
      method: 'POST',
      url: '/ai/complete?provider=claude',
      payload: { prompt: 'hola', reasoningEffort: 'max' },
    });
    expect(max.statusCode).toBe(200);
    expect(max.json()).toEqual({ text: '{"text":"desde claude"}' });
    expect(claudeCalls.at(-1)).toMatchObject({ reasoningEffort: 'max' });

    const minimal = await app.inject({
      method: 'POST',
      url: '/ai/complete?provider=claude',
      payload: { prompt: 'hola', reasoningEffort: 'minimal' },
    });
    expect(minimal.statusCode).toBe(400);

    const codexMax = await app.inject({
      method: 'POST',
      url: '/ai/complete',
      payload: { prompt: 'hola', reasoningEffort: 'max' },
    });
    expect(codexMax.statusCode).toBe(400);
  });

  it('los límites de Claude responden 502 honesto', async () => {
    const res = await app.inject({ method: 'GET', url: '/ai/limits?provider=claude' });
    expect(res.statusCode).toBe(502);
    expect((res.json() as { error: string }).error).toMatch(/no informa límites/);
  });
});
