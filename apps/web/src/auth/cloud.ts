import type { KeyValueStore } from '@anima/persistence';
import { RemoteKeyValueStore, WebStorageKeyValueStore } from '@anima/persistence';
import { balLogin, captureBalContext } from './bal.js';

export const API_BASE = '/api';
const ACCOUNT_KEY = 'anima:cloud:account';
const SYNC_KEYS = ['save', 'legacies'];

export type SignerMethod = 'bal' | 'nip07';

/** Firmante mínimo que Ánima necesita: identidad + firma de eventos. */
export interface AnimaSigner {
  getPublicKey(): Promise<string>;
  signEvent(template: {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
  }): Promise<unknown>;
}

export interface CloudAccount {
  token: string;
  pubkey: string;
  method: SignerMethod;
}

export function readStoredAccount(): CloudAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as CloudAccount) : null;
  } catch {
    return null;
  }
}

function storeAccount(account: CloudAccount | null): void {
  if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  else localStorage.removeItem(ACCOUNT_KEY);
}

/** Verifica contra el servidor que el token siga vigente y a quién pertenece. */
async function verifiedSubject(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return ((await res.json()) as { pubkey: string }).pubkey;
  } catch {
    return null;
  }
}

/**
 * Prueba de control de clave: desafío fresco de un solo uso, firmado como
 * evento kind 22242. Un getPublicKey() sin firma nunca autentica.
 */
export async function loginWithSigner(
  signer: AnimaSigner,
  method: SignerMethod,
): Promise<CloudAccount> {
  const challengeRes = await fetch(`${API_BASE}/auth/challenge`, { method: 'POST' });
  if (!challengeRes.ok) throw new Error('no se pudo obtener el desafío');
  const { challenge } = (await challengeRes.json()) as { challenge: string };

  const event = await signer.signEvent({
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['challenge', challenge]],
    content: '',
  });
  const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event }),
  });
  if (!verifyRes.ok) throw new Error('el servidor rechazó la firma');
  const { token, pubkey } = (await verifyRes.json()) as { token: string; pubkey: string };
  const account: CloudAccount = { token, pubkey, method };
  storeAccount(account);
  return account;
}

/** Firmante NIP-07 (extensión del navegador), el login "normal" sin launcher. */
export function nip07Signer(): AnimaSigner | null {
  const nostr = (window as { nostr?: AnimaSigner }).nostr;
  return nostr ?? null;
}

/** Olvida la sesión local (usado cuando el launcher revoca la identidad). */
export function forgetAccount(): void {
  storeAccount(null);
}

export async function logoutCloud(account: CloudAccount): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${account.token}` },
    });
  } catch {
    // Sin red igualmente olvidamos la sesión local.
  }
  storeAccount(null);
  if (account.method === 'bal') {
    await balLogin.logout({ forgetLauncher: true });
  }
}

export interface CloudBoot {
  account: CloudAccount | null;
  store: KeyValueStore | null;
}

function localStore(): KeyValueStore {
  return new WebStorageKeyValueStore(localStorage);
}

/** Primer login: el progreso de invitado se copia a la nube una sola vez. */
async function migrateGuestData(remote: KeyValueStore): Promise<void> {
  const remoteKeys = await remote.keys();
  if (remoteKeys.length > 0) return;
  const local = localStore();
  for (const key of SYNC_KEYS) {
    const value = await local.get(key);
    if (value !== null) await remote.set(key, value);
  }
}

/**
 * Arranque de identidad, siguiendo el contrato BAL:
 * 1. Capturar contexto del launcher antes de limpiar la URL.
 * 2. Si hay contexto, conectar y obtener la pubkey UNA vez.
 * 3. Comparar con el sujeto verificado de la sesión guardada antes de tocar
 *    nada: misma pubkey reutiliza el token (el servidor lo re-verifica);
 *    distinta pubkey limpia el estado de cuenta anterior.
 * 4. Sin token válido, autenticar con desafío firmado.
 * 5. Si BAL falla o no hay contexto, conservar la cuenta actual (verificada)
 *    o quedar en modo invitado; el login NIP-07 queda disponible en la UI.
 */
export async function initCloud(onLauncherLogout: () => void): Promise<CloudBoot> {
  const { hasContext } = captureBalContext();
  const stored = readStoredAccount();

  if (hasContext) {
    const signer = await balLogin.connect(onLauncherLogout);
    if (signer) {
      const pubkey = await signer.getPublicKey();
      if (stored && stored.pubkey !== pubkey) {
        // Identidad distinta: el estado de la cuenta anterior no se reutiliza.
        storeAccount(null);
      }
      const reusable =
        stored && stored.pubkey === pubkey && (await verifiedSubject(stored.token)) === pubkey
          ? stored
          : null;
      const account = reusable ?? (await loginWithSigner(signer, 'bal'));
      return await bootWithAccount(account);
    }
    // BAL rechazado o fallido: no borra la cuenta existente.
  }

  if (stored) {
    const subject = await verifiedSubject(stored.token);
    if (subject === stored.pubkey) return await bootWithAccount(stored);
    storeAccount(null);
  }
  return { account: null, store: null };
}

async function bootWithAccount(account: CloudAccount): Promise<CloudBoot> {
  const remote = new RemoteKeyValueStore(API_BASE, account.token);
  await migrateGuestData(remote);
  return { account, store: remote };
}
