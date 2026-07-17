import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AiBridge, AiStatus, AiThoughtEvent, RunResult } from './ai.js';
import { isCodexModel } from './ai.js';

/**
 * Puente hacia el CLI de Claude Code instalado en la máquina del usuario.
 *
 * Mismo trato que el puente de Codex: las credenciales (la suscripción de
 * Claude) las gestiona el propio CLI y este código jamás las lee ni las
 * expone. Solo orquesta consultar el estado (`claude auth status`), iniciar
 * el login capturando la URL de autorización, cerrar la sesión y ejecutar
 * consultas no interactivas (`claude -p`) efímeras en un directorio temporal
 * vacío, en modo seguro y sin herramientas.
 *
 * A diferencia de Codex no hay un hogar por identidad: la sesión de Claude es
 * la de la máquina (el ~/.claude del dueño), porque es su suscripción
 * personal la que piensa. Si algún día Ánima diera servicio a terceros, esto
 * tendría que volverse por-identidad como Codex — o mejor, API con key.
 */

export const CLAUDE_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ClaudeReasoningEffort = (typeof CLAUDE_REASONING_EFFORTS)[number];

export function isClaudeReasoningEffort(value: unknown): value is ClaudeReasoningEffort {
  return CLAUDE_REASONING_EFFORTS.includes(value as ClaudeReasoningEffort);
}

/** El mismo whitelist de nombres que Codex: el CLI corre mediante un shell. */
export const isClaudeModel = isCodexModel;

const STATUS_CACHE_MS = 15_000;
const LOGIN_URL_TIMEOUT_MS = 20_000;
const COMPLETE_TIMEOUT_MS = 240_000;

export type ClaudeExec = (
  args: string[],
  options: {
    stdin?: string;
    timeoutMs: number;
    cwd?: string;
    /** Recibe stdout a medida que llega (para el modo `stream-json` en vivo). */
    onStdout?: (chunk: string) => void;
  },
) => Promise<RunResult>;

/**
 * Entorno limpio para el CLI hijo: siempre autentica con la sesión guardada
 * del CLI (la suscripción del dueño), nunca con credenciales heredadas.
 *
 * Sin esto, levantar la API desde una terminal dentro de una sesión de
 * Claude Code contamina al hijo con ANTHROPIC_BASE_URL y el token OAuth del
 * anfitrión, y las consultas mueren con un 401 desconcertante (verificado).
 */
export function cleanClaudeEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(base)) {
    if (key.startsWith('CLAUDE_CODE_')) continue;
    if (
      key === 'CLAUDECODE' ||
      key === 'CLAUDE_EFFORT' ||
      key === 'ANTHROPIC_BASE_URL' ||
      key === 'ANTHROPIC_AUTH_TOKEN' ||
      key === 'ANTHROPIC_API_KEY'
    ) {
      continue;
    }
    env[key] = value;
  }
  return env;
}

function runClaude(
  args: string[],
  options: {
    stdin?: string;
    timeoutMs: number;
    cwd?: string;
    onStdout?: (chunk: string) => void;
  },
): Promise<RunResult> {
  return new Promise((resolve) => {
    // En Windows el binario global puede ser un shim .cmd: requiere shell.
    // Los argumentos son constantes nuestras o valores ya validados aquí.
    const quoted = args.map((a) => (/[\s]/.test(a) ? `"${a}"` : a)).join(' ');
    const child = spawn(`claude ${quoted}`, {
      shell: true,
      windowsHide: true,
      env: cleanClaudeEnv(),
      ...(options.cwd ? { cwd: options.cwd } : {}),
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
 * Traduce una línea del JSONL de `claude -p --output-format stream-json` a
 * eventos de pensamiento. Una misma línea `assistant` puede traer varios
 * bloques (thinking y texto), por eso devuelve una lista.
 */
export function readClaudeThoughtEvents(line: string): AiThoughtEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  const event = parsed as { type?: unknown; message?: unknown };
  if (event.type !== 'assistant') return [];
  const message = event.message as { content?: unknown } | undefined;
  if (!Array.isArray(message?.content)) return [];
  const events: AiThoughtEvent[] = [];
  for (const raw of message.content) {
    const block = raw as { type?: unknown; thinking?: unknown; text?: unknown };
    if (block.type === 'thinking' && typeof block.thinking === 'string' && block.thinking) {
      events.push({ type: 'reasoning', text: block.thinking });
    } else if (block.type === 'text' && typeof block.text === 'string' && block.text) {
      events.push({ type: 'answer', text: block.text });
    }
  }
  return events;
}

/**
 * Extrae el cierre del stream (la línea `result`): el texto final o el error.
 * Devuelve null si la línea no es el cierre.
 */
export function readClaudeResultLine(
  line: string,
): { text: string; isError: boolean } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const event = parsed as { type?: unknown; result?: unknown; is_error?: unknown };
  if (event.type !== 'result') return null;
  return {
    text: typeof event.result === 'string' ? event.result : '',
    isError: event.is_error === true,
  };
}

/** Acumula stdout y procesa cada línea JSONL completa del stream de Claude. */
export function createClaudeStreamParser(onLine: (line: string) => void): (chunk: string) => void {
  let buffer = '';
  return (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onLine(line);
      newline = buffer.indexOf('\n');
    }
  };
}

/**
 * Detecta que la cuenta no ofrece el modelo pedido (nombre viejo, plan sin
 * acceso). Se reintenta con el modelo por defecto de la cuenta en vez de
 * dejar el error crudo, igual que hace el puente de Codex.
 */
export function isUnknownClaudeModelError(detail: string): boolean {
  return /not_found_error|model.{0,60}(not found|not_found|does not exist|no existe|invalid|no access|not available)/i.test(
    detail,
  );
}

/** Extrae un mensaje humano del stderr/salida de un `claude -p` fallido. */
export function claudeErrorDetail(result: RunResult): string {
  // El JSON de cierre (modo json o stream-json) suele traer el error legible.
  const lines = `${result.stdout}\n${result.stderr}`.split('\n');
  for (const line of lines.reverse()) {
    const closing = readClaudeResultLine(line.trim());
    if (closing && closing.text) return closing.text.slice(0, 400);
  }
  const stderr = result.stderr.trim();
  if (stderr) return stderr.slice(-400);
  return result.stdout.trim().slice(-400) || 'sin detalle';
}

export interface ClaudeBridgeOptions {
  /** Modelo por defecto cuando el navegador no manda uno. */
  model?: string;
  /** Nivel de razonamiento por defecto cuando el navegador no manda uno. */
  reasoningEffort?: ClaudeReasoningEffort;
  /** Solo para pruebas: sustituye la ejecución real del CLI. */
  exec?: ClaudeExec;
}

export function createClaudeBridge(options: ClaudeBridgeOptions = {}): AiBridge {
  let cachedStatus: { at: number; value: AiStatus } | null = null;
  let loginChild: ChildProcess | null = null;
  // Modelos que la cuenta ya rechazó: se cae al predeterminado sin volver a
  // pagar el intento fallido en cada consulta de la sesión.
  const unsupportedModels = new Set<string>();
  const execClaude = options.exec ?? runClaude;
  // Sonnet con esfuerzo bajo por defecto: prompts cortos y respuestas JSON;
  // cuida la cuota de la suscripción. El navegador puede pedir otra cosa.
  const defaultModel = options.model ?? process.env.ANIMA_CLAUDE_MODEL ?? 'claude-sonnet-5';
  const envEffort = process.env.ANIMA_CLAUDE_EFFORT;
  const defaultEffort =
    options.reasoningEffort ?? (isClaudeReasoningEffort(envEffort) ? envEffort : 'low');

  return {
    async status() {
      if (cachedStatus && Date.now() - cachedStatus.at < STATUS_CACHE_MS) {
        return cachedStatus.value;
      }
      const result = await execClaude(['auth', 'status', '--json'], { timeoutMs: 15_000 });
      let value: AiStatus;
      if (result.failedToStart) {
        value = { installed: false, loggedIn: false, detail: 'claude CLI no encontrado' };
      } else {
        // `claude auth status` responde JSON; ante ruido se busca el objeto.
        interface AuthStatusJson {
          loggedIn?: unknown;
          email?: unknown;
          subscriptionType?: unknown;
        }
        let parsed: AuthStatusJson | null = null;
        const start = result.stdout.indexOf('{');
        if (start >= 0) {
          try {
            parsed = JSON.parse(result.stdout.slice(start)) as AuthStatusJson;
          } catch {
            parsed = null;
          }
        }
        if (parsed?.loggedIn === true) {
          const who = typeof parsed.email === 'string' ? parsed.email : 'cuenta conectada';
          const plan = typeof parsed.subscriptionType === 'string' ? parsed.subscriptionType : '';
          value = {
            installed: true,
            loggedIn: true,
            detail: plan ? `${who} (${plan})` : who,
          };
        } else {
          value = { installed: true, loggedIn: false, detail: 'sin sesión de Claude' };
        }
      }
      cachedStatus = { at: Date.now(), value };
      return value;
    },

    startLogin() {
      return new Promise((resolve) => {
        cachedStatus = null;
        if (loginChild) {
          loginChild.kill();
          loginChild = null;
        }
        const child = spawn('claude auth login --claudeai', {
          shell: true,
          windowsHide: true,
          env: cleanClaudeEnv(),
        });
        loginChild = child;
        let output = '';
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            child.kill();
            resolve({
              error:
                'claude auth login no entregó una URL de autorización a tiempo; ' +
                'podés iniciar sesión ejecutando «claude /login» en una terminal',
            });
          }
        }, LOGIN_URL_TIMEOUT_MS);

        const inspect = (): void => {
          // La URL real es de claude.com (verificado con el CLI 2.1.212);
          // se admiten también los dominios hermanos por si el CLI cambia.
          const match = /https:\/\/(?:[\w-]+\.)*(?:claude\.(?:ai|com)|anthropic\.com)\S+/.exec(
            output,
          );
          if (match && !resolved) {
            resolved = true;
            clearTimeout(timer);
            // El proceso sigue vivo esperando el código de autorización que
            // el usuario pega desde la página (submitLoginCode).
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
            resolve({ error: 'claude CLI no encontrado' });
          }
        });
        child.on('close', () => {
          cachedStatus = null;
          if (loginChild === child) loginChild = null;
        });
      });
    },

    /**
     * El `claude auth login` sin TTY no levanta callback local: la página de
     * autorización muestra un código y el CLI espera que se lo peguen. Aquí
     * el código que el usuario pegó en la UI viaja al stdin del proceso que
     * startLogin dejó esperando, y el éxito se comprueba contra el estado.
     */
    submitLoginCode(code: string) {
      return new Promise<{ ok: true } | { error: string }>((resolve) => {
        const child = loginChild;
        if (!child || child.exitCode !== null) {
          resolve({ error: 'no hay un login de Claude en curso; volvé a encender Claude' });
          return;
        }
        const timer = setTimeout(() => {
          finish({ error: 'el CLI no confirmó el código a tiempo' });
        }, 30_000);
        let settled = false;
        const finish = (result: { ok: true } | { error: string }): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cachedStatus = null;
          resolve(result);
        };
        child.on('close', () => {
          // El proceso cierra al aceptar el código (o al rechazarlo); el
          // veredicto de verdad lo da el estado de sesión fresco, no el caché.
          cachedStatus = null;
          void this.status().then((status) => {
            finish(
              status.loggedIn
                ? { ok: true }
                : { error: 'el código no completó la autorización; probá de nuevo' },
            );
          });
        });
        child.stdin?.write(`${code}\n`);
      });
    },

    limits() {
      // El CLI de Claude no expone las ventanas de uso de la suscripción por
      // ningún comando no interactivo (solo /usage dentro de la sesión). Antes
      // que inventar números, se dice la verdad y la UI no muestra el panel.
      return Promise.reject(new Error('el CLI de Claude no informa límites de uso'));
    },

    async logout() {
      cachedStatus = null;
      if (loginChild) {
        loginChild.kill();
        loginChild = null;
      }
      await execClaude(['auth', 'logout'], { timeoutMs: 15_000 });
    },

    async complete(input, onEvent) {
      const requestedModel = input.model ?? defaultModel;
      const requestedEffort = input.reasoningEffort ?? defaultEffort;
      if (!isClaudeModel(requestedModel)) {
        throw new Error('modelo Claude inválido');
      }
      if (!isClaudeReasoningEffort(requestedEffort)) {
        throw new Error('nivel de razonamiento Claude inválido');
      }
      const model = unsupportedModels.has(requestedModel) ? undefined : requestedModel;
      // El prompt ya pide JSON; el esquema viaja dentro del prompt porque el
      // CLI de Claude no tiene un --output-schema como Codex. El cliente
      // valida y parsea la respuesta igual que con cualquier proveedor.
      const prompt =
        input.schema === undefined
          ? input.prompt
          : `${input.prompt}\n\nTu respuesta completa debe ser ÚNICAMENTE un objeto JSON válido, sin cercas de código ni texto adicional, que cumpla exactamente este JSON Schema:\n${JSON.stringify(input.schema)}`;
      // Directorio temporal vacío: la consulta no debe ver ningún proyecto.
      const workdir = await mkdtemp(join(tmpdir(), 'anima-claude-'));
      try {
        const run = async (
          withModel: string | undefined,
        ): Promise<{ result: RunResult; text: string | null; streamedError: string | null }> => {
          const args = [
            '--print',
            '--output-format',
            onEvent !== undefined ? 'stream-json' : 'json',
            // Modo seguro: sin CLAUDE.md, plugins, hooks ni MCP de la máquina.
            // La consulta es puro prompt→respuesta, sin herramientas y sin
            // dejar sesión guardada.
            '--safe-mode',
            '--no-session-persistence',
            '--tools',
            '""',
            '--effort',
            requestedEffort,
          ];
          if (withModel !== undefined) args.push('--model', withModel);
          let text: string | null = null;
          let streamedError: string | null = null;
          // stream-json exige --verbose en modo --print.
          if (onEvent !== undefined) args.push('--verbose');
          const parser =
            onEvent !== undefined
              ? createClaudeStreamParser((line) => {
                  for (const event of readClaudeThoughtEvents(line)) onEvent(event);
                  const closing = readClaudeResultLine(line);
                  if (closing) {
                    if (closing.isError) streamedError = closing.text || 'consulta fallida';
                    else text = closing.text;
                  }
                })
              : undefined;
          const result = await execClaude(args, {
            stdin: prompt,
            timeoutMs: COMPLETE_TIMEOUT_MS,
            cwd: workdir,
            ...(parser ? { onStdout: parser } : {}),
          });
          if (onEvent === undefined && result.code === 0) {
            const start = result.stdout.indexOf('{');
            if (start >= 0) {
              const closing = readClaudeResultLine(result.stdout.slice(start).trim());
              if (closing) {
                if (closing.isError) streamedError = closing.text || 'consulta fallida';
                else text = closing.text;
              }
            }
          }
          return { result, text, streamedError };
        };

        let attempt = await run(model);
        const failureDetail =
          attempt.streamedError ?? (attempt.result.code !== 0 ? claudeErrorDetail(attempt.result) : null);
        if (
          failureDetail !== null &&
          !attempt.result.failedToStart &&
          model !== undefined &&
          isUnknownClaudeModelError(failureDetail)
        ) {
          // La cuenta no ofrece ese modelo: se recuerda y se reintenta con el
          // predeterminado de la cuenta, como hace el puente de Codex.
          unsupportedModels.add(model);
          attempt = await run(undefined);
        }
        if (attempt.result.failedToStart) {
          throw new Error('claude CLI no encontrado');
        }
        if (attempt.streamedError !== null) {
          throw new Error(`claude respondió con error: ${attempt.streamedError.slice(0, 400)}`);
        }
        if (attempt.result.code !== 0) {
          throw new Error(
            `claude -p terminó con código ${String(attempt.result.code)}: ${claudeErrorDetail(attempt.result)}`,
          );
        }
        if (attempt.text === null || !attempt.text.trim()) {
          throw new Error('claude -p no produjo respuesta');
        }
        return attempt.text;
      } finally {
        void rm(workdir, { recursive: true, force: true }).catch(() => undefined);
      }
    },
  };
}
