import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Puente hacia el CLI de Codex instalado en la máquina del usuario.
 *
 * Las credenciales de la cuenta de Codex (ChatGPT) las gestiona el propio
 * CLI en ~/.codex: este puente nunca las lee, ni las guarda, ni las expone.
 * Solo orquesta tres cosas: consultar el estado de sesión, iniciar el flujo
 * de login (capturando la URL de autorización para que el frontend la abra)
 * y ejecutar consultas no interactivas (`codex exec`) en sandbox de solo
 * lectura, efímeras y ancladas a un directorio temporal vacío.
 */

export interface AiStatus {
  installed: boolean;
  loggedIn: boolean;
  detail: string | null;
}

export interface AiBridge {
  status(): Promise<AiStatus>;
  startLogin(): Promise<{ authUrl: string } | { error: string }>;
  complete(input: { prompt: string; schema?: unknown }): Promise<string>;
}

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
  options: { stdin?: string; timeoutMs: number },
): Promise<RunResult> {
  return new Promise((resolve) => {
    // En Windows el binario global es un shim .cmd: requiere shell. Los
    // argumentos son constantes nuestras o rutas temporales generadas aquí.
    const quoted = args.map((a) => (/[\s]/.test(a) ? `"${a}"` : a)).join(' ');
    const child = spawn(`codex ${quoted}`, { shell: true, windowsHide: true });
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

export function createCodexBridge(options: { model?: string } = {}): AiBridge {
  let cachedStatus: { at: number; value: AiStatus } | null = null;
  let loginChild: ChildProcess | null = null;
  // Modelo explícito (ANIMA_CODEX_MODEL): útil cuando el modelo por defecto
  // de la cuenta requiere un CLI más nuevo que el instalado.
  const model = options.model ?? process.env.ANIMA_CODEX_MODEL;

  return {
    async status() {
      if (cachedStatus && Date.now() - cachedStatus.at < STATUS_CACHE_MS) {
        return cachedStatus.value;
      }
      const result = await runCodex(['login', 'status'], { timeoutMs: 15_000 });
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
        if (loginChild) {
          loginChild.kill();
          loginChild = null;
        }
        const child = spawn('codex login', { shell: true, windowsHide: true });
        loginChild = child;
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
          if (loginChild === child) loginChild = null;
        });
      });
    },

    async complete(input) {
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
        const effort = process.env.ANIMA_CODEX_EFFORT ?? 'low';
        args.push('-c', `model_reasoning_effort=${effort}`);
        if (input.schema !== undefined) {
          await writeFile(schemaFile, JSON.stringify(input.schema), 'utf8');
          args.push('--output-schema', schemaFile);
        }
        args.push('-'); // el prompt entra por stdin
        const result = await runCodex(args, {
          stdin: input.prompt,
          timeoutMs: COMPLETE_TIMEOUT_MS,
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
