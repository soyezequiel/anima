import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import type { AiThoughtEvent } from '../src/ai.js';
import { createCodexBridge } from '../src/ai.js';
import { CodexAppServer, CodexAppServerTurnError } from '../src/codex-app-server.js';

/**
 * La sesión persistente contra `codex app-server` (ADR 0044). Estas pruebas
 * hablan el protocolo JSON-RPC con un proceso fingido: fijan el handshake,
 * el hilo efímero por consulta, el turno con schema/modelo/nivel, el
 * pensamiento en vivo y — sobre todo — que el puente degrade a `codex exec`
 * cuando el transporte falla, porque el protocolo es experimental y exec
 * sigue siendo la verdad.
 */

type JsonRpcMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
};

class FakeAppServerProcess extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  readonly received: JsonRpcMessage[] = [];
  killed = false;
  readonly stdin = {
    write: (chunk: string): boolean => {
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const message = JSON.parse(trimmed) as JsonRpcMessage;
        this.received.push(message);
        // Microtarea: como el proceso real, nunca contesta en la misma pila.
        queueMicrotask(() => this.handler(message, this));
      }
      return true;
    },
    end: (): void => undefined,
  };

  constructor(private readonly handler: (msg: JsonRpcMessage, fake: FakeAppServerProcess) => void) {
    super();
  }

  reply(message: Record<string, unknown>): void {
    this.stdout.emit('data', Buffer.from(`${JSON.stringify(message)}\n`));
  }

  kill(): boolean {
    this.killed = true;
    return true;
  }

  asChildProcess(): ChildProcess {
    return this as unknown as ChildProcess;
  }
}

/** Protocolo feliz: contesta el handshake y deja el turno en manos del test. */
function basicHandler(
  onTurn: (msg: JsonRpcMessage, fake: FakeAppServerProcess) => void,
): (msg: JsonRpcMessage, fake: FakeAppServerProcess) => void {
  return (msg, fake) => {
    if (msg.method === 'initialize') fake.reply({ id: msg.id, result: {} });
    if (msg.method === 'thread/start') {
      fake.reply({ id: msg.id, result: { thread: { id: 'hilo-1' } } });
    }
    if (msg.method === 'turn/start') onTurn(msg, fake);
  };
}

describe('CodexAppServer (sesión persistente, ADR 0044)', () => {
  it('corre el turno completo: hilo efímero, schema, pensamiento en vivo y respuesta', async () => {
    let fake!: FakeAppServerProcess;
    const server = new CodexAppServer({
      spawnProcess: () => {
        fake = new FakeAppServerProcess(
          basicHandler((msg, current) => {
            current.reply({ id: msg.id, result: {} });
            current.reply({
              method: 'item/completed',
              params: {
                threadId: 'hilo-1',
                item: { type: 'reasoning', summary: ['pensando el plan'] },
              },
            });
            current.reply({
              method: 'item/completed',
              params: { threadId: 'hilo-1', item: { type: 'agentMessage', text: '{"ok":true}' } },
            });
            current.reply({
              method: 'turn/completed',
              params: { threadId: 'hilo-1', turn: { status: 'completed', error: null } },
            });
          }),
        );
        return fake.asChildProcess();
      },
    });

    const events: AiThoughtEvent[] = [];
    const text = await server.complete(
      {
        prompt: 'pensá algo',
        schema: { type: 'object' },
        model: 'gpt-5.6-terra',
        reasoningEffort: 'low',
      },
      (event) => events.push(event),
    );

    expect(text).toBe('{"ok":true}');
    expect(events).toEqual([
      { type: 'reasoning', text: 'pensando el plan' },
      { type: 'answer', text: '{"ok":true}' },
    ]);

    // El hilo nació efímero y de solo lectura, y el turno llevó todo consigo.
    const threadStart = fake.received.find((m) => m.method === 'thread/start')!;
    expect(threadStart.params).toMatchObject({ ephemeral: true, sandbox: 'read-only' });
    const turnStart = fake.received.find((m) => m.method === 'turn/start')!;
    expect(turnStart.params).toMatchObject({
      threadId: 'hilo-1',
      model: 'gpt-5.6-terra',
      effort: 'low',
      outputSchema: { type: 'object' },
      summary: 'detailed',
      input: [{ type: 'text', text: 'pensá algo' }],
    });
    // Y al terminar, el hilo se borra: el proceso no acumula hilos vivos.
    expect(fake.received.some((m) => m.method === 'thread/delete')).toBe(true);
    server.dispose();
  });

  it('reusa el proceso entre consultas: un solo spawn, un hilo nuevo por consulta', async () => {
    let spawns = 0;
    let fake!: FakeAppServerProcess;
    let thread = 0;
    const server = new CodexAppServer({
      spawnProcess: () => {
        spawns += 1;
        fake = new FakeAppServerProcess((msg, current) => {
          if (msg.method === 'initialize') current.reply({ id: msg.id, result: {} });
          if (msg.method === 'thread/start') {
            thread += 1;
            current.reply({ id: msg.id, result: { thread: { id: `hilo-${thread}` } } });
          }
          if (msg.method === 'turn/start') {
            const threadId = msg.params?.threadId as string;
            current.reply({ id: msg.id, result: {} });
            current.reply({
              method: 'item/completed',
              params: { threadId, item: { type: 'agentMessage', text: `respuesta ${threadId}` } },
            });
            current.reply({
              method: 'turn/completed',
              params: { threadId, turn: { status: 'completed', error: null } },
            });
          }
        });
        return fake.asChildProcess();
      },
    });

    await expect(server.complete({ prompt: 'uno' })).resolves.toBe('respuesta hilo-1');
    await expect(server.complete({ prompt: 'dos' })).resolves.toBe('respuesta hilo-2');
    expect(spawns).toBe(1);
    server.dispose();
  });

  it('un turno que el backend rechaza es un error de turno, no de transporte', async () => {
    const server = new CodexAppServer({
      spawnProcess: () =>
        new FakeAppServerProcess(
          basicHandler((msg, current) => {
            current.reply({ id: msg.id, result: {} });
            current.reply({
              method: 'turn/completed',
              params: {
                threadId: 'hilo-1',
                turn: { status: 'errored', error: { message: 'cuota agotada' } },
              },
            });
          }),
        ).asChildProcess(),
    });

    await expect(server.complete({ prompt: 'hola' })).rejects.toThrowError(CodexAppServerTurnError);
    server.dispose();
  });
});

describe('createCodexBridge + app-server (degradación a exec)', () => {
  const okExec = async (
    args: string[],
  ): Promise<{
    code: number;
    stdout: string;
    stderr: string;
    failedToStart: boolean;
  }> => {
    const outFile = args[args.indexOf('--output-last-message') + 1]!;
    await writeFile(outFile, '{"text":"desde exec"}', 'utf8');
    return { code: 0, stdout: '', stderr: '', failedToStart: false };
  };

  it('la consulta sale por la sesión persistente cuando está sana', async () => {
    let execCalls = 0;
    const bridge = createCodexBridge({
      exec: async (args) => {
        execCalls += 1;
        return okExec(args);
      },
      appServer: {
        complete: () => Promise.resolve('{"text":"desde app-server"}'),
        dispose: () => undefined,
      },
    });
    await expect(bridge.complete({ prompt: 'hola' })).resolves.toBe('{"text":"desde app-server"}');
    expect(execCalls).toBe(0);
  });

  it('un fallo de transporte descarta la sesión y el puente sigue con exec', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let appServerCalls = 0;
    let disposed = 0;
    const bridge = createCodexBridge({
      exec: okExec,
      appServer: {
        complete: () => {
          appServerCalls += 1;
          return Promise.reject(new Error('el proceso murió'));
        },
        dispose: () => {
          disposed += 1;
        },
      },
    });
    await expect(bridge.complete({ prompt: 'hola' })).resolves.toBe('{"text":"desde exec"}');
    expect(disposed).toBe(1);
    // La sesión quedó fuera de juego: la próxima consulta ni la intenta.
    await expect(bridge.complete({ prompt: 'hola' })).resolves.toBe('{"text":"desde exec"}');
    expect(appServerCalls).toBe(1);
    warn.mockRestore();
  });

  it('un error de turno NO descarta la sesión: cae a exec solo esta vez', async () => {
    let appServerCalls = 0;
    let disposed = 0;
    const bridge = createCodexBridge({
      exec: okExec,
      appServer: {
        complete: () => {
          appServerCalls += 1;
          return Promise.reject(new CodexAppServerTurnError('modelo no disponible'));
        },
        dispose: () => {
          disposed += 1;
        },
      },
    });
    await expect(bridge.complete({ prompt: 'hola' })).resolves.toBe('{"text":"desde exec"}');
    await expect(bridge.complete({ prompt: 'hola' })).resolves.toBe('{"text":"desde exec"}');
    // La sesión sigue viva y se intenta en cada consulta.
    expect(appServerCalls).toBe(2);
    expect(disposed).toBe(0);
  });
});
