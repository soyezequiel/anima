import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

export interface AiBridge {
  status(): Promise<AiStatus>;
  startLogin(): Promise<{ authUrl: string } | { error: string }>;
  logout(): Promise<void>;
  complete(input: {
    prompt: string;
    schema?: unknown;
    model?: string;
    reasoningEffort?: CodexReasoningEffort;
  }): Promise<string>;
}

/** Entrega el puente correspondiente a una identidad (null = invitado). */
export type AiBridgeFactory = (pubkey: string | null) => AiBridge;

const STATUS_CACHE_MS = 15_000;
const LOGIN_URL_TIMEOUT_MS = 20_000;
const COMPLETE_TIMEOUT_MS = 240_000;

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  failedToStart: boolean;
}

function runCodex(
  args: string[],
  options: { stdin?: string; timeoutMs: number; env?: NodeJS.ProcessEnv },
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

    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
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
}

export function createCodexBridge(options: CodexBridgeOptions = {}): AiBridge {
  let cachedStatus: { at: number; value: AiStatus } | null = null;
  const owner = options.owner ?? 'guest';
  const loginSlot = options.loginSlot ?? createCodexLoginSlot();
  // Las credenciales de cada identidad viven en su propio CODEX_HOME; el CLI
  // de Codex gestiona ahí auth.json y config sin que este código los lea.
  const env = options.home ? { ...process.env, CODEX_HOME: options.home } : undefined;
  // Modelo explícito (ANIMA_CODEX_MODEL): útil cuando el modelo por defecto
  // de la cuenta requiere un CLI más nuevo que el instalado.
  const defaultModel = options.model ?? process.env.ANIMA_CODEX_MODEL;
  const defaultEffort = process.env.ANIMA_CODEX_EFFORT ?? 'low';

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

    async logout() {
      cachedStatus = null;
      if (loginSlot.child && loginSlot.owner === owner) {
        loginSlot.child.kill();
        loginSlot.child = null;
        loginSlot.owner = null;
      }
      await runCodex(['logout'], { timeoutMs: 15_000, ...(env ? { env } : {}) });
    },

    async complete(input) {
      const model = input.model ?? defaultModel;
      const effort = input.reasoningEffort ?? defaultEffort;
      if (model !== undefined && !isCodexModel(model)) {
        throw new Error('modelo Codex inválido');
      }
      if (!isCodexReasoningEffort(effort)) {
        throw new Error('nivel de razonamiento Codex inválido');
      }
      const workdir = await mkdtemp(join(tmpdir(), 'anima-codex-'));
      const outFile = join(workdir, 'last-message.txt');
      const schemaFile = join(workdir, 'schema.json');
      try {
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
        if (model) args.push('--model', model);
        // Prompts cortos y respuestas JSON: el esfuerzo de razonamiento bajo
        // alcanza y cuida la cuota del usuario (ANIMA_CODEX_EFFORT lo cambia).
        args.push('-c', `model_reasoning_effort=${effort}`);
        if (input.schema !== undefined) {
          await writeFile(schemaFile, JSON.stringify(input.schema), 'utf8');
          args.push('--output-schema', schemaFile);
        }
        args.push('-'); // el prompt entra por stdin
        const result = await runCodex(args, {
          stdin: input.prompt,
          timeoutMs: COMPLETE_TIMEOUT_MS,
          ...(env ? { env } : {}),
        });
        if (result.failedToStart) {
          throw new Error('codex CLI no encontrado');
        }
        if (result.code !== 0) {
          throw new Error(
            `codex exec terminó con código ${String(result.code)}: ${result.stderr.slice(-400)}`,
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
