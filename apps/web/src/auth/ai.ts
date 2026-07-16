import type { CodexTransport } from '@anima/model-providers';
import { API_BASE } from './cloud.js';

/**
 * Elección de proveedor de IA del usuario. `mock` (determinista, sin costos)
 * es siempre la base; `codex` usa la cuenta de Codex (ChatGPT) del usuario a
 * través del puente local de la API. Las credenciales las gestiona el CLI de
 * Codex en su máquina: aquí solo se guarda la preferencia.
 */
export type AiChoice = 'mock' | 'codex';

const AI_CHOICE_KEY = 'anima:ai:choice';

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
    const res = await fetch(`${API_BASE}/ai/status`);
    if (!res.ok) return null;
    return (await res.json()) as AiStatus;
  } catch {
    return null; // API apagada: la app sigue en modo invitado + mock.
  }
}

/** Inicia el login de Codex y devuelve la URL de autorización para abrirla. */
export async function startCodexLogin(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/ai/login`, { method: 'POST' });
    if (!res.ok) return null;
    return ((await res.json()) as { authUrl: string }).authUrl;
  } catch {
    return null;
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
    const res = await fetch(`${API_BASE}/ai/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: input.kind, prompt: input.prompt, schema: input.schema }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `puente de IA: ${res.status}`);
    }
    return ((await res.json()) as { text: string }).text;
  };
}
