import type { CodexTransport, CodexTransportInput } from '@anima/model-providers';
import { API_BASE, readStoredAccount } from './cloud.js';

/**
 * Elección de proveedor de IA del usuario. `mock` (determinista, sin costos)
 * es siempre la base; `codex` usa la cuenta de Codex (ChatGPT) del usuario y
 * `claude` la suscripción de Claude de la máquina, ambos a través del puente
 * local de la API. Las credenciales las gestiona cada CLI en su máquina:
 * aquí solo se guarda la preferencia.
 *
 * Las llamadas al puente viajan con el token de sesión cuando hay identidad:
 * así cada usuario conecta y usa su propia cuenta de Codex. Sin identidad,
 * el puente responde con la sesión invitada de la máquina. La sesión de
 * Claude es siempre la de la máquina: es la suscripción personal del dueño.
 */

function aiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const account = readStoredAccount();
  return account ? { ...extra, authorization: `Bearer ${account.token}` } : extra;
}
export type AiChoice = 'mock' | 'codex' | 'claude';
/** Los proveedores reales que atiende el puente /ai de la API local. */
export type RemoteAiProvider = 'codex' | 'claude';

const AI_CHOICE_KEY = 'anima:ai:choice';
const CODEX_SETTINGS_KEY = 'anima:ai:codex-settings';
const CLAUDE_SETTINGS_KEY = 'anima:ai:claude-settings';

export const CODEX_MODEL_SUGGESTIONS = [
  'gpt-5.6',
  'gpt-5.6-terra',
  'gpt-5.4',
  'gpt-5.3-codex-spark',
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

export function readAiChoice(): AiChoice {
  const raw = localStorage.getItem(AI_CHOICE_KEY);
  return raw === 'codex' || raw === 'claude' ? raw : 'mock';
}

export function storeAiChoice(choice: AiChoice): void {
  if (choice === 'mock') localStorage.removeItem(AI_CHOICE_KEY);
  else localStorage.setItem(AI_CHOICE_KEY, choice);
}

export interface AiStatus {
  installed: boolean;
  loggedIn: boolean;
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
