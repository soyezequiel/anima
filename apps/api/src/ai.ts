import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodexAppServer, CodexAppServerTurnError } from './codex-app-server.js';
import type { CodexAppServerLike } from './codex-app-server.js';

/**
 * Puente hacia el CLI de Codex instalado en la máquina del usuario.
 *
 * Las credenciales de la cuenta de Codex (ChatGPT) las gestiona el propio
 * CLI: este puente nunca las lee, ni las guarda, ni las expone. Solo
 * orquesta cuatro cosas: consultar el estado de sesión, iniciar el flujo
 * de login (capturando la URL de autorización para que el frontend la abra),
 * cerrar la sesión y ejecutar consultas no interactivas (`codex exec`) en
 * sandbox de solo lectura, efímeras y ancladas a un directorio temporal vacío.
 *
 * Cada identidad autenticada (pubkey Nostr) tiene su propio CODEX_HOME, de
 * modo que cada usuario conecta su propia cuenta de Codex. Sin identidad
 * (modo invitado) se usa el ~/.codex clásico de la máquina.
 */

export interface AiStatus {
  installed: boolean;
  loggedIn: boolean;
  detail: string | null;
}

export const CODEX_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const;
export type CodexReasoningEffort = (typeof CODEX_REASONING_EFFORTS)[number];

export function isCodexReasoningEffort(value: unknown): value is CodexReasoningEffort {
  return CODEX_REASONING_EFFORTS.includes(value as CodexReasoningEffort);
}

/** Whitelist deliberada: el CLI de Windows se ejecuta mediante un shell. */
export function isCodexModel(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/.test(value);
}

/** Una ventana de límite de uso de la cuenta (p. ej. 5 horas o semanal). */
export interface AiLimitWindow {
  /** Porcentaje ya consumido de la ventana (0-100). */
  usedPercent: number;
  /** Duración de la ventana en minutos (10080 = semanal), si se conoce. */
  windowDurationMins: number | null;
  /** Momento del reinicio como timestamp Unix en segundos, si se conoce. */
  resetsAt: number | null;
}

export interface AiLimits {
  planType: string | null;
  primary: AiLimitWindow | null;
  secondary: AiLimitWindow | null;
}

/**
 * Un paso del pensamiento en vivo de una consulta: los titulares de
 * razonamiento que `codex exec --json` va soltando y el mensaje final.
 * El texto llega tal cual lo emite el CLI; quien lo muestra decide el formato.
 */
export type AiThoughtEvent = { type: 'reasoning'; text: string } | { type: 'answer'; text: string };

export interface AiBridge {
  status(): Promise<AiStatus>;
  startLogin(): Promise<{ authUrl: string } | { error: string }>;
  /**
   * Completa un login cuyo flujo pide pegar un código de autorización (el
   * `claude auth login` sin TTY no tiene callback local). Los puentes cuyo
   * flujo termina solo (Codex, con su callback en localhost) no lo definen.
   */
  submitLoginCode?(code: string): Promise<{ ok: true } | { error: string }>;
  logout(): Promise<void>;
  limits(): Promise<AiLimits>;
  /**
   * Con `onEvent`, la consulta corre con `--json` y va contando su
   * pensamiento a medida que el CLI lo emite; sin él, se comporta igual que
   * siempre. La respuesta final sale en ambos casos por el valor de retorno.
   */
  complete(
    input: {
      prompt: string;
      schema?: unknown;
      model?: string;
      /** Cada puente valida contra su propia lista de niveles. */
      reasoningEffort?: string;
    },
    onEvent?: (event: AiThoughtEvent) => void,
  ): Promise<string>;
}

/** Entrega el puente correspondiente a una identidad (null = invitado). */
export type AiBridgeFactory = (pubkey: string | null) => AiBridge;

const STATUS_CACHE_MS = 15_000;
const LOGIN_URL_TIMEOUT_MS = 20_000;
const COMPLETE_TIMEOUT_MS = 240_000;
const LIMITS_TIMEOUT_MS = 20_000;

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  failedToStart: boolean;
}

export type CodexExec = (
  args: string[],
  options: {
    stdin?: string;
    timeoutMs: number;
    env?: NodeJS.ProcessEnv;
    /** Recibe stdout a medida que llega (para el modo `--json` en vivo). */
    onStdout?: (chunk: string) => void;
  },
) => Promise<RunResult>;

function runCodex(
  args: string[],
  options: {
    stdin?: string;
    timeoutMs: number;
    env?: NodeJS.ProcessEnv;
    onStdout?: (chunk: string) => void;
  },
): Promise<RunResult> {
  return new Promise((resolve) => {
    // En Windows el binario global es un shim .cmd: requiere shell. Los
    // argumentos son constantes nuestras o rutas temporales generadas aquí.
    const quoted = args.map((a) => (/[\s]/.test(a) ? `"${a}"` : a)).join(' ');
    const child = spawn(`codex ${quoted}`, {
      shell: true,
      windowsHide: true,
      ...(options.env ? { env: options.env } : {}),
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result: RunResult): void => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ code: null, stdout, stderr: `${stderr}\n[timeout]`, failedToStart: false });
    }, options.timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      options.onStdout?.(text);
    });
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', () => {
      clearTimeout(timer);
      finish({ code: null, stdout, stderr, failedToStart: true });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ code, stdout, stderr, failedToStart: false });
    });
    if (options.stdin !== undefined) {
      child.stdin?.write(options.stdin);
    }
    child.stdin?.end();
  });
}

/**
 * Traduce una línea del JSONL de `codex exec --json` a un evento de
 * pensamiento, o null si la línea no cuenta nada que valga la pena mostrar
 * (turn.started, uso de tokens, ruido ajeno al protocolo).
 *
 * Forma observada en codex-cli 0.144.5: los titulares de razonamiento llegan
 * como items `reasoning` (solo si la config pide el resumen) y la respuesta
 * final como un item `agent_message`, todos completos — el CLI no emite
 * deltas por token.
 */
export function readThoughtEvent(line: string): AiThoughtEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const event = parsed as { type?: unknown; item?: unknown };
  if (event.type !== 'item.completed') return null;
  const item = event.item as { type?: unknown; text?: unknown } | undefined;
  if (typeof item?.text !== 'string' || item.text.length === 0) return null;
  if (item.type === 'reasoning') return { type: 'reasoning', text: item.text };
  if (item.type === 'agent_message') return { type: 'answer', text: item.text };
  return null;
}

/** Acumula trozos de stdout y emite un evento por cada línea JSONL completa. */
export function createThoughtStreamParser(
  onEvent: (event: AiThoughtEvent) => void,
): (chunk: string) => void {
  let buffer = '';
  return (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        const event = readThoughtEvent(line);
        if (event) onEvent(event);
      }
      newline = buffer.indexOf('\n');
    }
  };
}

/**
 * Ranura compartida del login interactivo: `codex login` abre un servidor de
 * callback en localhost:1455, así que solo puede haber un login en curso por
 * máquina, sin importar cuántos usuarios tenga la API.
 */
export interface CodexLoginSlot {
  child: ChildProcess | null;
  owner: string | null;
}

export function createCodexLoginSlot(): CodexLoginSlot {
  return { child: null, owner: null };
}

export interface CodexBridgeOptions {
  model?: string;
  /** CODEX_HOME de esta identidad; ausente = ~/.codex clásico de la máquina. */
  home?: string;
  /** Identifica al dueño en la ranura de login compartida. */
  owner?: string;
  loginSlot?: CodexLoginSlot;
  /** Solo para pruebas: sustituye la ejecución real de `codex exec`. */
  exec?: CodexExec;
  /**
   * Sesión persistente `codex app-server` (ADR 0044). `false` la desactiva;
   * una instancia inyectada sirve para las pruebas. Ausente: se crea la real,
   * salvo que también se haya inyectado `exec` (una prueba de exec no quiere
   * un proceso de verdad por detrás).
   */
  appServer?: CodexAppServerLike | false;
}

function parseLimitWindow(raw: unknown): AiLimitWindow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const window = raw as { usedPercent?: unknown; windowDurationMins?: unknown; resetsAt?: unknown };
  if (typeof window.usedPercent !== 'number') return null;
  return {
    usedPercent: window.usedPercent,
    windowDurationMins:
      typeof window.windowDurationMins === 'number' ? window.windowDurationMins : null,
    resetsAt: typeof window.resetsAt === 'number' ? window.resetsAt : null,
  };
}

/** Normaliza la respuesta `account/rateLimits/read` del app-server de Codex. */
export function parseRateLimitsResponse(result: unknown): AiLimits {
  const snapshot =
    typeof result === 'object' && result !== null
      ? ((result as { rateLimits?: unknown }).rateLimits ?? null)
      : null;
  if (typeof snapshot !== 'object' || snapshot === null) {
    throw new Error('codex app-server no informó límites');
  }
  const raw = snapshot as { planType?: unknown; primary?: unknown; secondary?: unknown };
  return {
    planType: typeof raw.planType === 'string' ? raw.planType : null,
    primary: parseLimitWindow(raw.primary),
    secondary: parseLimitWindow(raw.secondary),
  };
}

/**
 * Detecta el 400 `unsupported_value` que devuelve el backend cuando el
 * modelo activo no acepta el nivel de razonamiento pedido (p. ej. `minimal`
 * con los modelos premium). Ese caso se resuelve reintentando sin forzar el
 * nivel, en lugar de dejar el error crudo al usuario.
 */
export function isUnsupportedEffortError(stderr: string): boolean {
  return (
    /unsupported_value/i.test(stderr) &&
    /reasoning\.effort|model_reasoning_effort|reasoning effort/i.test(stderr)
  );
}

/**
 * Detecta que la cuenta no ofrece el modelo pedido: nombres sugeridos en la UI
 * pasan el filtro de formato de `isCodexModel` pero pueden no existir para ese
 * plan (o exigir un CLI más nuevo). Antes que dejar el error crudo, se reintenta
 * con el modelo por defecto de la cuenta («Automático»). El fallo de nivel de
 * razonamiento tiene su propio reintento; aquí se lo excluye para no pisarlo.
 */
export function isUnsupportedModelError(stderr: string): boolean {
  if (isUnsupportedEffortError(stderr)) return false;
  return (
    /model[_\s-]?not[_\s-]?found|unsupported[_\s-]?model|unknown model|modelo desconocido/i.test(
      stderr,
    ) ||
    /\bmodel\b[^.]{0,80}?(does not exist|no existe|not available|no disponible|do(?:es)? not have access|no access|sin acceso|is invalid|invalid model|modelo inv[aá]lido)/i.test(
      stderr,
    )
  );
}

/** Extrae el mensaje humano del JSON de error que emite `codex exec`. */
export function codexErrorDetail(stderr: string): string {
  // El último "message" es el del bloque ERROR final, el definitivo.
  const matches = [...stderr.matchAll(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
  const raw = matches.at(-1)?.[1];
  if (raw) {
    try {
      return JSON.parse(`"${raw}"`) as string;
    } catch {
      return raw;
    }
  }
  return stderr.slice(-400);
}

/**
 * Consulta los límites de uso de la cuenta por el protocolo JSON-RPC (por
 * stdio) de `codex app-server`, el mismo que usa la extensión oficial:
 * initialize → initialized → account/rateLimits/read. No consume cuota.
 */
function readRateLimits(env?: NodeJS.ProcessEnv): Promise<AiLimits> {
  return new Promise((resolve, reject) => {
    const child = spawn('codex app-server', {
      shell: true,
      windowsHide: true,
      ...(env ? { env } : {}),
    });
    let buffer = '';
    let stderr = '';
    let settled = false;
    const finish = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      outcome();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new Error('codex app-server no respondió a tiempo')));
    }, LIMITS_TIMEOUT_MS);

    child.on('error', () => finish(() => reject(new Error('codex CLI no encontrado'))));
    child.on('close', () =>
      finish(() =>
        reject(new Error(`codex app-server terminó sin responder: ${stderr.slice(-200)}`)),
      ),
    );
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      let newline = buffer.indexOf('\n');
      while (newline >= 0 && !settled) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line) continue;
        let message: { id?: unknown; result?: unknown; error?: { message?: unknown } };
        try {
          message = JSON.parse(line) as typeof message;
        } catch {
          continue; // líneas de log u otras notificaciones
        }
        if (message.id === 1) {
          // Handshake completado: ya se pueden pedir los límites.
          child.stdin?.write(
            '{"method":"initialized"}\n{"id":2,"method":"account/rateLimits/read"}\n',
          );
        } else if (message.id === 2) {
          if (message.error) {
            const detail =
              typeof message.error.message === 'string' ? message.error.message : 'error';
            finish(() => reject(new Error(`codex app-server: ${detail}`)));
          } else {
            try {
              const limits = parseRateLimitsResponse(message.result);
              finish(() => resolve(limits));
            } catch (error) {
              finish(() => reject(error instanceof Error ? error : new Error('límites ilegibles')));
            }
          }
        }
      }
    });
    child.stdin?.write(
      `${JSON.stringify({
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'anima', title: 'Ánima', version: '0.1.0' } },
      })}\n`,
    );
  });
}

export function createCodexBridge(options: CodexBridgeOptions = {}): AiBridge {
  let cachedStatus: { at: number; value: AiStatus } | null = null;
  // Combinaciones modelo|nivel ya rechazadas por el backend: se omite el
  // nivel en vez de pagar un intento fallido en cada consulta.
  const unsupportedEfforts = new Set<string>();
  // Modelos que la cuenta no ofrece: se dejan de pedir y se cae a «Automático»
  // sin volver a pagar el intento fallido en cada consulta de la sesión.
  const unsupportedModels = new Set<string>();
  const execCodex = options.exec ?? runCodex;
  const owner = options.owner ?? 'guest';
  const loginSlot = options.loginSlot ?? createCodexLoginSlot();
  // Las credenciales de cada identidad viven en su propio CODEX_HOME; el CLI
  // de Codex gestiona ahí auth.json y config sin que este código los lea.
  const env = options.home ? { ...process.env, CODEX_HOME: options.home } : undefined;
  // Modelo explícito (ANIMA_CODEX_MODEL): útil cuando el modelo por defecto
  // de la cuenta requiere un CLI más nuevo que el instalado.
  const defaultModel = options.model ?? process.env.ANIMA_CODEX_MODEL;
  const defaultEffort = process.env.ANIMA_CODEX_EFFORT ?? 'low';
  // La sesión persistente que mata el arranque en frío (ADR 0044). Es un
  // atajo, no la verdad: si su transporte falla, se descarta y el puente
  // vuelve a `codex exec` por el resto de su vida (un reinicio la reintenta).
  let appServer: CodexAppServerLike | null =
    options.appServer === false
      ? null
      : (options.appServer ??
        (options.exec
          ? null
          : new CodexAppServer({
              timeoutMs: COMPLETE_TIMEOUT_MS,
              ...(env ? { env } : {}),
            })));

  return {
    async status() {
      if (cachedStatus && Date.now() - cachedStatus.at < STATUS_CACHE_MS) {
        return cachedStatus.value;
      }
      const result = await runCodex(['login', 'status'], {
        timeoutMs: 15_000,
        ...(env ? { env } : {}),
      });
      const text = `${result.stdout}\n${result.stderr}`;
      const value: AiStatus = result.failedToStart
        ? { installed: false, loggedIn: false, detail: 'codex CLI no encontrado' }
        : /logged in/i.test(text) && !/not logged in/i.test(text)
          ? { installed: true, loggedIn: true, detail: text.trim().split('\n')[0] ?? null }
          : { installed: true, loggedIn: false, detail: 'sin sesión de Codex' };
      cachedStatus = { at: Date.now(), value };
      return value;
    },

    startLogin() {
      return new Promise((resolve) => {
        cachedStatus = null;
        if (loginSlot.child && loginSlot.owner !== owner) {
          // Otro usuario está a mitad de su autorización: no se la matamos.
          resolve({ error: 'otra cuenta está completando su autorización; intenta en un momento' });
          return;
        }
        if (loginSlot.child) {
          loginSlot.child.kill();
          loginSlot.child = null;
          loginSlot.owner = null;
        }
        const child = spawn('codex login', {
          shell: true,
          windowsHide: true,
          ...(env ? { env } : {}),
        });
        loginSlot.child = child;
        loginSlot.owner = owner;
        let output = '';
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            child.kill();
            resolve({ error: 'codex login no entregó una URL de autorización a tiempo' });
          }
        }, LOGIN_URL_TIMEOUT_MS);

        const inspect = (): void => {
          const match = /https:\/\/auth\.openai\.com\S+/.exec(output);
          if (match && !resolved) {
            resolved = true;
            clearTimeout(timer);
            // El proceso sigue vivo esperando el callback en localhost:1455.
            resolve({ authUrl: match[0] });
          }
        };
        child.stdout?.on('data', (chunk: Buffer) => {
          output += chunk.toString();
          inspect();
        });
        child.stderr?.on('data', (chunk: Buffer) => {
          output += chunk.toString();
          inspect();
        });
        child.on('error', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve({ error: 'codex CLI no encontrado' });
          }
        });
        child.on('close', () => {
          cachedStatus = null;
          if (loginSlot.child === child) {
            loginSlot.child = null;
            loginSlot.owner = null;
          }
        });
      });
    },

    limits() {
      return readRateLimits(env);
    },

    async logout() {
      cachedStatus = null;
      // El proceso persistente carga las credenciales al arrancar: tras un
      // logout (y el login que suele seguirlo) tiene que renacer con las
      // nuevas. dispose() no lo rompe — el próximo complete lo respawnea.
      appServer?.dispose();
      if (loginSlot.child && loginSlot.owner === owner) {
        loginSlot.child.kill();
        loginSlot.child = null;
        loginSlot.owner = null;
      }
      await runCodex(['logout'], { timeoutMs: 15_000, ...(env ? { env } : {}) });
    },

    async complete(input, onEvent) {
      const requestedModel = input.model ?? defaultModel;
      const requestedEffort = input.reasoningEffort ?? defaultEffort;
      if (requestedModel !== undefined && !isCodexModel(requestedModel)) {
        throw new Error('modelo Codex inválido');
      }
      if (!isCodexReasoningEffort(requestedEffort)) {
        throw new Error('nivel de razonamiento Codex inválido');
      }
      // Si ya sabemos que la cuenta no ofrece este modelo, no lo pedimos: se usa
      // el predeterminado («Automático») desde la primera consulta.
      const model =
        requestedModel !== undefined && !unsupportedModels.has(requestedModel)
          ? requestedModel
          : undefined;
      // Si ya sabemos que este modelo rechaza el nivel pedido, ni lo forzamos.
      const comboKey = `${model ?? ''}|${requestedEffort}`;
      const effort = unsupportedEfforts.has(comboKey) ? undefined : requestedEffort;

      // Primero la sesión persistente (ADR 0044): sin proceso nuevo ni
      // directorio temporal, la consulta empieza donde importa — el modelo.
      if (appServer) {
        try {
          return await appServer.complete(
            {
              prompt: input.prompt,
              ...(input.schema !== undefined ? { schema: input.schema } : {}),
              ...(model !== undefined ? { model } : {}),
              ...(effort !== undefined ? { reasoningEffort: effort } : {}),
            },
            onEvent,
          );
        } catch (error) {
          if (error instanceof CodexAppServerTurnError) {
            // El backend rechazó el turno (modelo, nivel, cuota, timeout del
            // modelo): el proceso sigue sano. La consulta cae a exec, que ya
            // sabe reintentar y recordar combinaciones no soportadas.
          } else {
            // Fallo de transporte o protocolo: la sesión se descarta y este
            // puente sigue con exec. El protocolo del app-server es
            // experimental; exec es la verdad de siempre.
            appServer.dispose();
            appServer = null;
            console.warn(
              `[anima-ai] codex app-server fuera de juego; sigo con codex exec: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }

      const workdir = await mkdtemp(join(tmpdir(), 'anima-codex-'));
      const outFile = join(workdir, 'last-message.txt');
      const schemaFile = join(workdir, 'schema.json');
      try {
        if (input.schema !== undefined) {
          await writeFile(schemaFile, JSON.stringify(input.schema), 'utf8');
        }
        const run = (
          withModel: string | undefined,
          withEffort: CodexReasoningEffort | undefined,
        ): Promise<RunResult> => {
          const args = [
            'exec',
            '--skip-git-repo-check',
            '--ephemeral',
            '--sandbox',
            'read-only',
            '--color',
            'never',
            '--cd',
            workdir,
            '--output-last-message',
            outFile,
          ];
          if (withModel) args.push('--model', withModel);
          // Prompts cortos y respuestas JSON: el esfuerzo de razonamiento bajo
          // alcanza y cuida la cuota del usuario (ANIMA_CODEX_EFFORT lo cambia).
          // Sin nivel explícito, decide el predeterminado del modelo.
          if (withEffort !== undefined) args.push('-c', `model_reasoning_effort=${withEffort}`);
          if (input.schema !== undefined) args.push('--output-schema', schemaFile);
          if (onEvent !== undefined) {
            // Modo en vivo: eventos JSONL por stdout. Sin el resumen de
            // razonamiento el CLI se calla los items `reasoning` aunque el
            // modelo razone (verificado en 0.144.5); la respuesta final sigue
            // saliendo por el archivo, igual que sin `--json`.
            args.push('--json');
            args.push('-c', 'model_reasoning_summary=detailed');
            args.push('-c', 'show_raw_agent_reasoning=true');
          }
          args.push('-'); // el prompt entra por stdin
          return execCodex(args, {
            stdin: input.prompt,
            timeoutMs: COMPLETE_TIMEOUT_MS,
            // El parser vive dentro de run(): un reintento (nivel de
            // razonamiento rechazado) arranca con el búfer limpio.
            ...(onEvent ? { onStdout: createThoughtStreamParser(onEvent) } : {}),
            ...(env ? { env } : {}),
          });
        };
        let currentModel = model;
        let currentEffort = effort;
        let result = await run(currentModel, currentEffort);
        if (
          result.code !== 0 &&
          !result.failedToStart &&
          currentEffort !== undefined &&
          isUnsupportedEffortError(result.stderr)
        ) {
          // El modelo de la cuenta no acepta ese nivel: se recuerda la
          // combinación y se reintenta con el nivel propio del modelo.
          unsupportedEfforts.add(comboKey);
          currentEffort = undefined;
          result = await run(currentModel, currentEffort);
        }
        if (
          result.code !== 0 &&
          !result.failedToStart &&
          currentModel !== undefined &&
          isUnsupportedModelError(result.stderr)
        ) {
          // La cuenta no ofrece ese modelo: se recuerda para no volver a pedirlo
          // y se reintenta con el predeterminado de la cuenta («Automático»).
          unsupportedModels.add(currentModel);
          currentModel = undefined;
          result = await run(currentModel, currentEffort);
        }
        if (result.failedToStart) {
          throw new Error('codex CLI no encontrado');
        }
        if (result.code !== 0) {
          throw new Error(
            `codex exec terminó con código ${String(result.code)}: ${codexErrorDetail(result.stderr)}`,
          );
        }
        const text = await readFile(outFile, 'utf8').catch(() => '');
        if (!text.trim()) {
          throw new Error('codex exec no produjo respuesta');
        }
        return text;
      } finally {
        void rm(workdir, { recursive: true, force: true }).catch(() => undefined);
      }
    },
  };
}

/** Las pubkeys Nostr verificadas son siempre 64 hex; cualquier otra cosa no
 * llega a convertirse en nombre de directorio. */
export function codexHomeFor(root: string, pubkey: string): string {
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
    throw new Error('pubkey inválida para el puente de IA');
  }
  return join(root, pubkey.toLowerCase());
}

/**
 * Fábrica de puentes por identidad: cada pubkey autenticada obtiene un
 * CODEX_HOME propio bajo `root` (su propia cuenta de Codex); el invitado
 * (pubkey null) usa el ~/.codex clásico de la máquina. La ranura de login es
 * compartida porque el callback de `codex login` ocupa un puerto fijo.
 */
export function createCodexBridgeFactory(options: {
  root: string;
  model?: string;
}): AiBridgeFactory {
  const bridges = new Map<string, AiBridge>();
  const loginSlot = createCodexLoginSlot();
  return (pubkey) => {
    const key = pubkey ? pubkey.toLowerCase() : 'guest';
    const existing = bridges.get(key);
    if (existing) return existing;
    const bridgeOptions: CodexBridgeOptions = { owner: key, loginSlot };
    if (options.model !== undefined) bridgeOptions.model = options.model;
    if (pubkey !== null) {
      const home = codexHomeFor(options.root, pubkey);
      mkdirSync(home, { recursive: true });
      bridgeOptions.home = home;
    }
    const bridge = createCodexBridge(bridgeOptions);
    bridges.set(key, bridge);
    return bridge;
  };
}
