import type { CodexTransport, CodexTransportInput } from '@anima/model-providers';
import { createOpenAiTransport } from '@anima/model-providers';
import { API_BASE, readStoredAccount } from './cloud.js';

/**
 * ═══ CON QUÉ PIENSA LA MASCOTA, Y QUIÉN LO PAGA ════════════════════════════
 *
 * Cuatro opciones, y la diferencia que importa entre ellas no es técnica: es de
 * quién es la cuenta.
 *
 *   · **`mock`** — el simulado, determinista y gratis. La base.
 *   · **`openai`** — una API OpenAI-compatible que trae el que juega: su URL,
 *     su llave, su modelo. **El navegador la llama directo**, así que la llave
 *     nunca toca nuestro backend (ADR 0089).
 *   · **`codex` y `claude`** — los CLI instalados en la máquina del SERVIDOR, a
 *     través del puente `/ai`. Gastan la cuenta de quien hospeda, y por eso
 *     una instancia publicada no los ofrece: contesta 503 y estos dos quedan
 *     para cuando Ánima corre en la máquina de uno.
 *
 * Acá solo se guarda la preferencia y los ajustes; ninguna credencial de Codex
 * ni de Claude pasa por este archivo — de esas se ocupa cada CLI en su máquina.
 * La llave de `openai` sí vive acá, en el `localStorage` de este navegador, y
 * no sale de él salvo hacia el proveedor que el usuario eligió.
 */

function aiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const account = readStoredAccount();
  return account ? { ...extra, authorization: `Bearer ${account.token}` } : extra;
}
export type AiChoice = 'mock' | 'codex' | 'claude' | 'openai';
/** Los proveedores reales que atiende el puente /ai de la API local. */
export type RemoteAiProvider = 'codex' | 'claude';

const AI_CHOICE_KEY = 'anima:ai:choice';
const CODEX_SETTINGS_KEY = 'anima:ai:codex-settings';
const CLAUDE_SETTINGS_KEY = 'anima:ai:claude-settings';
const OPENAI_SETTINGS_KEY = 'anima:ai:openai-settings';

/**
 * Slugs que el CLI de Codex publica en su catálogo (`models_cache.json` del
 * CODEX_HOME). Son sugerencias, no una verdad: la cuenta manda, y un plan
 * puede no ofrecer alguno. Nombres de familia sin sufijo (`gpt-5.6` a secas)
 * NO existen para el backend — pedirlos devuelve 400 «no soportado con una
 * cuenta ChatGPT», así que no se ofrecen.
 */
export const CODEX_MODEL_SUGGESTIONS = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
] as const;

export const CODEX_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const;

export type CodexReasoningEffort = (typeof CODEX_REASONING_EFFORTS)[number];

export interface CodexSettings {
  /** Vacío deja que Codex elija el modelo configurado por defecto. */
  model: string;
  /** Vacío deja que el puente use su nivel predeterminado. */
  reasoningEffort: CodexReasoningEffort | '';
}

const DEFAULT_CODEX_SETTINGS: CodexSettings = { model: '', reasoningEffort: '' };

export function readCodexSettings(): CodexSettings {
  try {
    const raw = localStorage.getItem(CODEX_SETTINGS_KEY);
    if (!raw) return DEFAULT_CODEX_SETTINGS;
    const parsed = JSON.parse(raw) as { model?: unknown; reasoningEffort?: unknown };
    const model = typeof parsed.model === 'string' ? parsed.model : '';
    const reasoningEffort = CODEX_REASONING_EFFORTS.includes(
      parsed.reasoningEffort as CodexReasoningEffort,
    )
      ? (parsed.reasoningEffort as CodexReasoningEffort)
      : '';
    return { model, reasoningEffort };
  } catch {
    return DEFAULT_CODEX_SETTINGS;
  }
}

export function storeCodexSettings(settings: CodexSettings): void {
  const normalized: CodexSettings = {
    model: settings.model.trim(),
    reasoningEffort: CODEX_REASONING_EFFORTS.includes(
      settings.reasoningEffort as CodexReasoningEffort,
    )
      ? settings.reasoningEffort
      : '',
  };
  if (!normalized.model && !normalized.reasoningEffort) {
    localStorage.removeItem(CODEX_SETTINGS_KEY);
    return;
  }
  localStorage.setItem(CODEX_SETTINGS_KEY, JSON.stringify(normalized));
}

export const CLAUDE_MODEL_SUGGESTIONS = [
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-haiku-4-5',
  'claude-fable-5',
] as const;

export const CLAUDE_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export type ClaudeReasoningEffort = (typeof CLAUDE_REASONING_EFFORTS)[number];

export interface ClaudeSettings {
  /** Vacío deja que el puente use el modelo predeterminado de la cuenta. */
  model: string;
  /** Vacío deja que el puente use su nivel predeterminado. */
  reasoningEffort: ClaudeReasoningEffort | '';
}

/**
 * Sonnet con esfuerzo bajo: la configuración de fábrica. Alcanza para los
 * prompts cortos de la mascota y cuida la cuota de la suscripción. Lo que el
 * usuario cambie queda guardado en este navegador y manda sobre esto.
 */
export const DEFAULT_CLAUDE_SETTINGS: ClaudeSettings = {
  model: 'claude-sonnet-5',
  reasoningEffort: 'low',
};

export function readClaudeSettings(): ClaudeSettings {
  try {
    const raw = localStorage.getItem(CLAUDE_SETTINGS_KEY);
    // Sin nada guardado rigen los defaults; lo guardado se respeta tal cual,
    // incluso el vacío («Automático»): elegirlo también es una elección.
    if (!raw) return DEFAULT_CLAUDE_SETTINGS;
    const parsed = JSON.parse(raw) as { model?: unknown; reasoningEffort?: unknown };
    const model = typeof parsed.model === 'string' ? parsed.model : DEFAULT_CLAUDE_SETTINGS.model;
    const reasoningEffort = CLAUDE_REASONING_EFFORTS.includes(
      parsed.reasoningEffort as ClaudeReasoningEffort,
    )
      ? (parsed.reasoningEffort as ClaudeReasoningEffort)
      : '';
    return { model, reasoningEffort };
  } catch {
    return DEFAULT_CLAUDE_SETTINGS;
  }
}

export function storeClaudeSettings(settings: ClaudeSettings): void {
  const normalized: ClaudeSettings = {
    model: settings.model.trim(),
    reasoningEffort: CLAUDE_REASONING_EFFORTS.includes(
      settings.reasoningEffort as ClaudeReasoningEffort,
    )
      ? settings.reasoningEffort
      : '',
  };
  localStorage.setItem(CLAUDE_SETTINGS_KEY, JSON.stringify(normalized));
}

/**
 * ═══ LA API QUE TRAE EL QUE JUEGA ══════════════════════════════════════════
 *
 * Tres campos y ninguno tiene default útil: sin los tres no hay nada que
 * llamar. `baseUrl` admite pegarse con `/v1` o sin él (lo arregla
 * `normalizarBaseUrl` del transporte); `model` es el nombre exacto que use ese
 * proveedor, que no es el mismo en OpenAI que en Groq que en un Ollama.
 */
export interface OpenAiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const DEFAULT_OPENAI_SETTINGS: OpenAiSettings = { baseUrl: '', apiKey: '', model: '' };

/**
 * Sugerencias para el desplegable de la URL. No es una lista cerrada —el campo
 * se escribe a mano— pero cuatro nombres conocidos ahorran ir a buscar la ruta
 * a la documentación, que es donde se pierde el que recién empieza.
 *
 * Los cuatro mandan cabeceras CORS, que es la condición para que el navegador
 * pueda llamarlos directo. Uno que no las mande va a fallar como si estuviera
 * caído, y el error del transporte nombra esa posibilidad.
 */
export const OPENAI_BASE_URL_SUGGESTIONS = [
  { url: 'https://api.openai.com/v1', nombre: 'OpenAI' },
  { url: 'https://openrouter.ai/api/v1', nombre: 'OpenRouter' },
  { url: 'https://api.groq.com/openai/v1', nombre: 'Groq' },
  { url: 'http://localhost:11434/v1', nombre: 'Ollama (en tu máquina)' },
] as const;

export function readOpenAiSettings(): OpenAiSettings {
  try {
    const raw = localStorage.getItem(OPENAI_SETTINGS_KEY);
    if (!raw) return DEFAULT_OPENAI_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
    };
  } catch {
    return DEFAULT_OPENAI_SETTINGS;
  }
}

export function storeOpenAiSettings(settings: OpenAiSettings): void {
  localStorage.setItem(
    OPENAI_SETTINGS_KEY,
    JSON.stringify({
      baseUrl: settings.baseUrl.trim(),
      apiKey: settings.apiKey.trim(),
      model: settings.model.trim(),
    }),
  );
}

/** Borra la llave del navegador. Es lo que hace «Olvidar mi API». */
export function forgetOpenAiSettings(): void {
  localStorage.removeItem(OPENAI_SETTINGS_KEY);
}

/** ¿Están los tres campos? Sin esto no hay a quién llamar. */
export function openAiSettingsComplete(s: OpenAiSettings): boolean {
  return s.baseUrl.trim() !== '' && s.apiKey.trim() !== '' && s.model.trim() !== '';
}

/**
 * El transporte hacia la API del usuario, o `null` si falta algún campo.
 *
 * Devuelve `null` en vez de tirar porque el arranque lo consulta antes de saber
 * si hay algo configurado: que no haya API es el caso normal de una visita
 * nueva, no un error.
 */
export function openAiTransport(): CodexTransport | null {
  const settings = readOpenAiSettings();
  if (!openAiSettingsComplete(settings)) return null;
  return createOpenAiTransport({
    baseUrl: settings.baseUrl.trim(),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
  });
}

/**
 * Lo que el usuario eligió, o `null` si todavía no eligió nada.
 *
 * La diferencia entre «no elegí» y «elegí el simulado» no existía: apagar
 * Codex borraba la clave, así que las dos cosas se leían igual. Empezó a
 * importar cuando una instancia puede tener su propio default (ver `main.tsx`):
 * sin distinguirlas, apagar la mente real duraba hasta la próxima recarga.
 */
export function readStoredAiChoice(): AiChoice | null {
  const raw = localStorage.getItem(AI_CHOICE_KEY);
  return raw === 'codex' || raw === 'claude' || raw === 'mock' || raw === 'openai' ? raw : null;
}

export function readAiChoice(): AiChoice {
  return readStoredAiChoice() ?? 'mock';
}

export function storeAiChoice(choice: AiChoice): void {
  localStorage.setItem(AI_CHOICE_KEY, choice);
}

/**
 * Deja la elección sin decidir, para que vuelva a regir el default de la
 * instancia. Es lo que corresponde cuando la sesión se cayó sola —no fue una
 * decisión de nadie— y distinto de apagarla a mano, que sí queda guardado.
 */
export function forgetAiChoice(): void {
  localStorage.removeItem(AI_CHOICE_KEY);
}

export interface AiStatus {
  installed: boolean;
  loggedIn: boolean;
  /**
   * Por qué está como está. Con una instancia que no presta cuentas (ADR 0089)
   * trae el texto que manda a configurar la API propia, así que no es solo
   * diagnóstico: es la única pista de que hay otro camino.
   */
  detail: string | null;
}

export async function fetchAiStatus(provider: RemoteAiProvider = 'codex'): Promise<AiStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/ai/status?provider=${provider}`, {
      headers: aiHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as AiStatus;
  } catch {
    return null; // API apagada: la app sigue en modo invitado + mock.
  }
}

/** Inicia el login del proveedor y devuelve la URL de autorización para abrirla. */
export async function startAiLogin(provider: RemoteAiProvider = 'codex'): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/ai/login?provider=${provider}`, {
      method: 'POST',
      headers: aiHeaders(),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { authUrl: string }).authUrl;
  } catch {
    return null;
  }
}

/** Una ventana de límite de uso de la cuenta (p. ej. 5 horas o semanal). */
export interface AiLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  /** Timestamp Unix en segundos. */
  resetsAt: number | null;
}

export interface AiLimits {
  planType: string | null;
  primary: AiLimitWindow | null;
  secondary: AiLimitWindow | null;
}

/** Límites de uso de la cuenta de Codex conectada (no consume cuota). */
export async function fetchAiLimits(): Promise<AiLimits | null> {
  try {
    const res = await fetch(`${API_BASE}/ai/limits`, { headers: aiHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as AiLimits;
  } catch {
    return null;
  }
}

/**
 * Entrega el código de autorización que la página de login mostró (el flujo
 * de Claude sin TTY no tiene callback local: el código se pega a mano).
 */
export async function submitAiLoginCode(
  provider: RemoteAiProvider,
  code: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/ai/login/code?provider=${provider}`, {
      method: 'POST',
      headers: aiHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `puente de IA: ${res.status}` };
    }
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: 'la API local no responde' };
  }
}

/** Cierra la sesión del proveedor para la identidad actual (o el invitado). */
export async function aiLogout(provider: RemoteAiProvider = 'codex'): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/ai/logout?provider=${provider}`, {
      method: 'POST',
      headers: aiHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function waitForAiLogin(
  provider: RemoteAiProvider = 'codex',
  timeoutMs = 180_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await fetchAiStatus(provider);
    if (status?.loggedIn) return true;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  return false;
}

/**
 * Transporte HTTP hacia el puente /ai/complete de la API local. El proveedor
 * decide qué ajustes del navegador viajan (modelo y nivel de razonamiento de
 * Codex o de Claude) y a qué CLI enruta la API.
 */
function aiHttpTransport(provider: RemoteAiProvider): CodexTransport {
  return async (input) => {
    // Se leen en cada consulta para aplicar cambios sin reconstruir la sesión.
    const settings = provider === 'claude' ? readClaudeSettings() : readCodexSettings();
    const body = JSON.stringify({
      kind: input.kind,
      prompt: input.prompt,
      schema: input.schema,
      ...(settings.model ? { model: settings.model } : {}),
      ...(settings.reasoningEffort ? { reasoningEffort: settings.reasoningEffort } : {}),
    });
    // Con oyente del pensamiento, la consulta va por el endpoint SSE; si esa
    // ruta no existe (API vieja) o falla al abrir, se cae al endpoint clásico
    // para que pensar nunca dependa de poder mirar cómo se piensa.
    if (input.onEvent) {
      const streamed = await tryStreamingComplete(provider, body, input.onEvent);
      if (streamed !== null) return streamed;
    }
    const res = await fetch(`${API_BASE}/ai/complete?provider=${provider}`, {
      method: 'POST',
      headers: aiHeaders({ 'content-type': 'application/json' }),
      body,
    });
    if (!res.ok) {
      const resBody = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(resBody?.error ?? `puente de IA: ${res.status}`);
    }
    return ((await res.json()) as { text: string }).text;
  };
}

export function codexHttpTransport(): CodexTransport {
  return aiHttpTransport('codex');
}

export function claudeHttpTransport(): CodexTransport {
  return aiHttpTransport('claude');
}

/**
 * Consulta por /ai/complete/stream leyendo los eventos SSE a medida que
 * llegan. Devuelve el texto final, o null si el stream no llegó a abrirse
 * (para que el llamador reintente por la ruta clásica). Un error DENTRO del
 * stream ya abierto sí es un fallo de la consulta: viaja como excepción.
 */
async function tryStreamingComplete(
  provider: RemoteAiProvider,
  body: string,
  onEvent: NonNullable<CodexTransportInput['onEvent']>,
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/ai/complete/stream?provider=${provider}`, {
      method: 'POST',
      headers: aiHeaders({ 'content-type': 'application/json' }),
      body,
    });
  } catch {
    return null;
  }
  if (!res.ok || !res.body) {
    // 400/401 significan lo mismo por la ruta clásica: dejar que ella
    // produzca el error definitivo mantiene un solo camino de fallo.
    return null;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalText: string | null = null;
  let streamError: string | null = null;
  const handleLine = (line: string): void => {
    if (!line.startsWith('data:')) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line.slice('data:'.length).trim());
    } catch {
      return;
    }
    const event = parsed as { type?: unknown; text?: unknown; error?: unknown };
    if (event.type === 'reasoning' && typeof event.text === 'string') {
      onEvent({ type: 'reasoning', text: event.text });
    } else if (event.type === 'answer' && typeof event.text === 'string') {
      onEvent({ type: 'answer', text: event.text });
    } else if (event.type === 'done' && typeof event.text === 'string') {
      finalText = event.text;
    } else if (event.type === 'error') {
      streamError = typeof event.error === 'string' ? event.error : 'fallo del puente de IA';
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf('\n\n');
    while (separator >= 0) {
      handleLine(buffer.slice(0, separator).trim());
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf('\n\n');
    }
  }
  if (streamError !== null) throw new Error(streamError);
  if (finalText === null) throw new Error('el puente de IA cortó el stream sin respuesta');
  return finalText;
}
