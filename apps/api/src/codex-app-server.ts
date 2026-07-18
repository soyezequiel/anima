import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { AiThoughtEvent } from './ai.js';

/**
 * Sesión persistente contra `codex app-server` (ADR 0044): un solo proceso
 * vivo por puente (por CODEX_HOME) al que cada consulta le abre un hilo
 * efímero y le corre un turno por JSON-RPC (stdio). Es el mismo protocolo
 * que usa la extensión oficial y que este backend ya usaba para leer los
 * límites de uso.
 *
 * Lo que se elimina es el arranque en frío: `codex exec` pagaba proceso
 * nuevo + directorio temporal + init de sesión por CADA pensamiento. Acá el
 * proceso se paga una vez; el hilo (`thread/start`, efímero, en sandbox de
 * solo lectura) es una llamada local que no toca la red ni consume cuota.
 *
 * El protocolo del app-server es experimental (v0.144.5): por eso el puente
 * lo trata como atajo y no como verdad — cualquier fallo de transporte
 * degrada la consulta a `codex exec`, que sigue siendo el camino probado.
 */

const INIT_TIMEOUT_MS = 20_000;
const THREAD_START_TIMEOUT_MS = 20_000;

/**
 * Un turno que falló por lo que el backend dijo (modelo no soportado, cuota,
 * contenido) y no por el transporte: el proceso sigue sano y no hay que
 * descartarlo. El puente decide qué hacer con el mensaje.
 */
export class CodexAppServerTurnError extends Error {}

export interface CodexAppServerCompleteInput {
  prompt: string;
  schema?: unknown;
  model?: string;
  reasoningEffort?: string;
}

/** Lo que el puente necesita de la sesión (real o de prueba). */
export interface CodexAppServerLike {
  complete(
    input: CodexAppServerCompleteInput,
    onEvent?: (event: AiThoughtEvent) => void,
  ): Promise<string>;
  dispose(): void;
}

export interface CodexAppServerOptions {
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** Solo para pruebas: sustituye el spawn real del proceso. */
  spawnProcess?: () => ChildProcess;
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type NotificationHandler = (method: string, params: Record<string, unknown>) => void;

function errorMessageOf(raw: unknown): string {
  if (typeof raw === 'object' && raw !== null) {
    const candidate = (raw as { message?: unknown }).message;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  if (typeof raw === 'string' && raw.trim()) return raw;
  return JSON.stringify(raw ?? 'error');
}

export class CodexAppServer implements CodexAppServerLike {
  private child: ChildProcess | null = null;
  private ready: Promise<void> | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly listeners = new Set<NotificationHandler>();
  private buffer = '';
  private readonly timeoutMs: number;

  constructor(private readonly options: CodexAppServerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 240_000;
  }

  dispose(): void {
    const child = this.child;
    this.child = null;
    this.ready = null;
    this.buffer = '';
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('codex app-server descartado'));
    }
    this.pending.clear();
    this.listeners.clear();
    child?.kill();
  }

  /** Arranca el proceso y completa el handshake, una sola vez por vida. */
  private ensureReady(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        this.dispose();
        reject(error);
      };
      const child = this.options.spawnProcess
        ? this.options.spawnProcess()
        : // Sin persistencia de historial: los hilos de Ánima son consultas
          // autocontenidas, no conversaciones que valga la pena guardar.
          spawn('codex app-server -c history.persistence=none', {
            shell: true,
            windowsHide: true,
            ...(this.options.env ? { env: this.options.env } : {}),
          });
      this.child = child;
      child.on('error', () => fail(new Error('codex CLI no encontrado')));
      child.on('close', () => {
        // Un cierre con consultas en vuelo las rechaza a todas: el puente
        // caerá a exec y el próximo uso decidirá si reintentar el proceso.
        const error = new Error('codex app-server terminó inesperadamente');
        fail(error);
        this.dispose();
      });
      child.stdout?.on('data', (chunk: Buffer) => this.onStdout(chunk.toString()));

      const timer = setTimeout(
        () => fail(new Error('codex app-server no respondió al handshake')),
        INIT_TIMEOUT_MS,
      );
      this.request('initialize', {
        clientInfo: { name: 'anima', title: 'Ánima', version: '0.1.0' },
      })
        .then(() => {
          clearTimeout(timer);
          this.send({ method: 'initialized' });
          if (!settled) {
            settled = true;
            resolve();
          }
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          fail(error instanceof Error ? error : new Error(String(error)));
        });
    });
    return this.ready;
  }

  private send(message: Record<string, unknown>): void {
    this.child?.stdin?.write(`${JSON.stringify(message)}\n`);
  }

  private request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = INIT_TIMEOUT_MS,
  ): Promise<unknown> {
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`codex app-server no respondió a ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      newline = this.buffer.indexOf('\n');
      if (!line) continue;
      let message: {
        id?: unknown;
        result?: unknown;
        error?: unknown;
        method?: unknown;
        params?: unknown;
      };
      try {
        message = JSON.parse(line) as typeof message;
      } catch {
        continue; // Ruido ajeno al protocolo (logs).
      }
      if (typeof message.id === 'number' && this.pending.has(message.id)) {
        const request = this.pending.get(message.id)!;
        this.pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error !== undefined && message.error !== null) {
          request.reject(new CodexAppServerTurnError(errorMessageOf(message.error)));
        } else {
          request.resolve(message.result);
        }
        continue;
      }
      if (typeof message.method === 'string') {
        const params = (message.params ?? {}) as Record<string, unknown>;
        for (const listener of this.listeners) listener(message.method, params);
      }
    }
  }

  async complete(
    input: CodexAppServerCompleteInput,
    onEvent?: (event: AiThoughtEvent) => void,
  ): Promise<string> {
    await this.ensureReady();

    // Un hilo nuevo por consulta: los prompts de Ánima son autocontenidos y
    // reusar un hilo acumularía contexto ajeno a la consulta. Efímero y en
    // sandbox de solo lectura, como siempre fue `codex exec`.
    const started = (await this.request(
      'thread/start',
      {
        ephemeral: true,
        cwd: tmpdir(),
        sandbox: 'read-only',
        approvalPolicy: 'never',
      },
      THREAD_START_TIMEOUT_MS,
    )) as { thread?: { id?: unknown } } | null;
    const threadId = started?.thread?.id;
    if (typeof threadId !== 'string' || !threadId) {
      throw new Error('codex app-server no devolvió un hilo');
    }

    try {
      return await new Promise<string>((resolve, reject) => {
        let finalText = '';
        let turnErrorDetail: string | null = null;
        const cleanup = (): void => {
          clearTimeout(timer);
          this.listeners.delete(listener);
        };
        const timer = setTimeout(() => {
          cleanup();
          // Que el turno colgado no siga gastando: se interrumpe y se cae a
          // exec. Un timeout es lentitud del modelo, no un proceso roto.
          this.send({ id: this.nextId++, method: 'turn/interrupt', params: { threadId } });
          reject(new CodexAppServerTurnError('codex app-server agotó el tiempo del turno'));
        }, this.timeoutMs);

        const listener: NotificationHandler = (method, params) => {
          if (params.threadId !== threadId) return;
          if (method === 'item/completed') {
            const item = params.item as
              { type?: unknown; text?: unknown; summary?: unknown } | undefined;
            if (item?.type === 'agentMessage' && typeof item.text === 'string' && item.text) {
              finalText = item.text;
              onEvent?.({ type: 'answer', text: item.text });
            } else if (item?.type === 'reasoning' && onEvent && Array.isArray(item.summary)) {
              for (const text of item.summary) {
                if (typeof text === 'string' && text) onEvent({ type: 'reasoning', text });
              }
            }
            return;
          }
          if (method === 'error') {
            turnErrorDetail = errorMessageOf(params.error ?? params);
            return;
          }
          if (method === 'turn/completed') {
            cleanup();
            const turn = params.turn as { status?: unknown; error?: unknown } | undefined;
            const failed =
              (turn?.error !== undefined && turn?.error !== null) || turn?.status === 'errored';
            if (failed) {
              reject(
                new CodexAppServerTurnError(
                  errorMessageOf(turn?.error ?? turnErrorDetail ?? 'el turno falló'),
                ),
              );
            } else if (!finalText.trim()) {
              reject(new CodexAppServerTurnError('codex app-server no produjo respuesta'));
            } else {
              resolve(finalText);
            }
          }
        };
        this.listeners.add(listener);

        this.request(
          'turn/start',
          {
            threadId,
            input: [{ type: 'text', text: input.prompt }],
            ...(input.model !== undefined ? { model: input.model } : {}),
            ...(input.reasoningEffort !== undefined ? { effort: input.reasoningEffort } : {}),
            ...(input.schema !== undefined ? { outputSchema: input.schema } : {}),
            // Sin resumen de razonamiento el backend calla los items
            // `reasoning` aunque el modelo razone (mismo hallazgo que en
            // `codex exec --json`, verificado en 0.144.5).
            ...(onEvent ? { summary: 'detailed' } : {}),
          },
          this.timeoutMs,
        ).catch((error: unknown) => {
          cleanup();
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      });
    } finally {
      // El hilo efímero ya no sirve: se borra para que el proceso no acumule
      // hilos vivos. Mejor esfuerzo — si falla, el proceso lo limpia al morir.
      this.send({ id: this.nextId++, method: 'thread/delete', params: { threadId } });
    }
  }
}
