import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { verifyEvent } from 'nostr-tools';
import type { Event } from 'nostr-tools';

/**
 * Autenticación por prueba de control de clave (contrato BAL, estilo NIP-42):
 * 1. El servidor emite un desafío aleatorio de un solo uso con expiración corta.
 * 2. El cliente firma un evento kind 22242 con el desafío exacto en un tag.
 * 3. El servidor verifica tipo, desafío, frescura, firma y unicidad; consume
 *    el desafío y deriva la pubkey del evento verificado — nunca de la URL,
 *    del cuerpo ni de un getPublicKey() sin firma.
 */

export const AUTH_EVENT_KIND = 22242;
export const CHALLENGE_TTL_SECONDS = 120;
export const EVENT_FRESHNESS_SECONDS = 120;
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface AuthDeps {
  db: DatabaseSync;
  now?: () => number; // epoch en segundos (inyectable en pruebas)
}

function nowSeconds(deps: AuthDeps): number {
  return deps.now ? deps.now() : Math.floor(Date.now() / 1000);
}

export function createChallenge(deps: AuthDeps): { challenge: string; expiresAt: number } {
  const challenge = randomBytes(32).toString('hex');
  const now = nowSeconds(deps);
  const expiresAt = now + CHALLENGE_TTL_SECONDS;
  deps.db
    .prepare('INSERT INTO challenges (challenge, created_at, expires_at, used) VALUES (?, ?, ?, 0)')
    .run(challenge, now, expiresAt);
  return { challenge, expiresAt };
}

export type VerifyResult =
  | { ok: true; token: string; pubkey: string; expiresAt: number }
  | { ok: false; reason: string };

export function verifyChallengeEvent(deps: AuthDeps, event: unknown): VerifyResult {
  const now = nowSeconds(deps);
  const candidate = event as Event;
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    typeof candidate.kind !== 'number' ||
    !Array.isArray(candidate.tags) ||
    typeof candidate.created_at !== 'number'
  ) {
    return { ok: false, reason: 'evento malformado' };
  }
  if (candidate.kind !== AUTH_EVENT_KIND) {
    return { ok: false, reason: `kind inesperado: ${candidate.kind}` };
  }
  if (Math.abs(now - candidate.created_at) > EVENT_FRESHNESS_SECONDS) {
    return { ok: false, reason: 'evento fuera de la ventana de frescura' };
  }
  const challengeTag = candidate.tags.find((t) => t[0] === 'challenge');
  const challenge = challengeTag?.[1];
  if (!challenge) {
    return { ok: false, reason: 'sin tag challenge' };
  }
  const row = deps.db
    .prepare('SELECT challenge, expires_at, used FROM challenges WHERE challenge = ?')
    .get(challenge) as { challenge: string; expires_at: number; used: number } | undefined;
  if (!row) return { ok: false, reason: 'desafío desconocido' };
  if (row.used !== 0) return { ok: false, reason: 'desafío ya utilizado' };
  if (row.expires_at < now) return { ok: false, reason: 'desafío expirado' };

  if (!verifyEvent(candidate)) {
    return { ok: false, reason: 'firma inválida' };
  }

  // Consumo de un solo uso, y la identidad sale del evento verificado.
  deps.db.prepare('UPDATE challenges SET used = 1 WHERE challenge = ?').run(challenge);
  const pubkey = candidate.pubkey;
  deps.db
    .prepare('INSERT OR IGNORE INTO users (pubkey, created_at) VALUES (?, ?)')
    .run(pubkey, new Date(now * 1000).toISOString());

  const token = randomBytes(32).toString('hex');
  const expiresAt = now + TOKEN_TTL_SECONDS;
  deps.db
    .prepare('INSERT INTO tokens (token, pubkey, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, pubkey, now, expiresAt);
  return { ok: true, token, pubkey, expiresAt };
}

export function pubkeyForToken(deps: AuthDeps, token: string): string | null {
  const row = deps.db
    .prepare('SELECT pubkey, expires_at FROM tokens WHERE token = ?')
    .get(token) as { pubkey: string; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < nowSeconds(deps)) return null;
  return row.pubkey;
}

export function revokeToken(deps: AuthDeps, token: string): void {
  deps.db.prepare('DELETE FROM tokens WHERE token = ?').run(token);
}

/** Limpieza ocasional de desafíos y tokens vencidos. */
export function pruneExpired(deps: AuthDeps): void {
  const now = nowSeconds(deps);
  deps.db.prepare('DELETE FROM challenges WHERE expires_at < ?').run(now);
  deps.db.prepare('DELETE FROM tokens WHERE expires_at < ?').run(now);
}
