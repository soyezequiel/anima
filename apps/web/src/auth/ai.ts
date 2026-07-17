import type { CodexTransport, CodexTransportInput } from '@anima/model-providers';
import { API_BASE, readStoredAccount } from './cloud.js';

/**
 * Elección de proveedor de IA del usuario. `mock` (determinista, sin costos)
 * es siempre la base; `codex` usa la cuenta de Codex (ChatGPT) del usuario a
 * través del puente local de la API. Las credenciales las gestiona el CLI de
 * Codex en su máquina: aquí solo se guarda la preferencia.
 *
 * Las llamadas al puente viajan con el token de sesión cuando hay identidad:
 * así cada usuario conecta y usa su propia cuenta de Codex. Sin identidad,
 * el puente responde con la sesión invitada de la máquina.
 */

function aiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const account = readStoredAccount();
  return account ? { ...extra, authorization: `Bearer ${account.token}` } : extra;
}
export type AiChoice = 'mock' | 'codex';

const AI_CHOICE_KEY = 'anima:ai:choice';
const CODEX_SETTINGS_KEY = 'anima:ai:codex-settings';

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

export function readAiChoice(): AiChoice {
  return localStorage.getItem(AI_CHOICE_KEY) === 'codex' ? 'codex' : 'mock';
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

export async function fetchAiStatus(): Promise<AiStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/ai/status`, { headers: aiHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as AiStatus;
  } catch {
    return null; // API apagada: la app sigue en modo invitado + mock.
  }
}

/** Inicia el login de Codex y devuelve la URL de autorización para abrirla. */
export async function startCodexLogin(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/ai/login`, { method: 'POST', headers: aiHeaders() });
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

/** Cierra la sesión de Codex de la identidad actual (o del invitado). */
export async function codexLogout(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/ai/logout`, { method: 'POST', headers: aiHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

export async function waitForCodexLogin(timeoutMs = 180_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await fetchAiStatus();
    if (status?.loggedIn) return true;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  return false;
}

/** Transporte HTTP hacia el puente /ai/complete de la API local. */
export function codexHttpTransport(): CodexTransport {
  return async (input) => {
    // Se lee en cada consulta para aplicar cambios sin reconstruir la sesión.
    const settings = readCodexSettings();
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
      const streamed = await tryStreamingComplete(body, input.onEvent);
      if (streamed !== null) return streamed;
    }
    const res = await fetch(`${API_BASE}/ai/complete`, {
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

/**
 * Consulta por /ai/complete/stream leyendo los eventos SSE a medida que
 * llegan. Devuelve el texto final, o null si el stream no llegó a abrirse
 * (para que el llamador reintente por la ruta clásica). Un error DENTRO del
 * stream ya abierto sí es un fallo de la consulta: viaja como excepción.
 */
async function tryStreamingComplete(
  body: string,
  onEvent: NonNullable<CodexTransportInput['onEvent']>,
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/ai/complete/stream`, {
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
