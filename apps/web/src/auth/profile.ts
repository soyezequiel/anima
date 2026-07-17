import { npubEncode } from 'nostr-tools/nip19';
import { SimplePool } from 'nostr-tools/pool';

/**
 * Perfil público de Nostr (evento kind 0). No lo guarda el servidor de Ánima:
 * vive en los relés, así que se busca desde el navegador y se cachea. La
 * identidad sigue siendo la pubkey; el nombre y la foto son solo presentación.
 */
export interface NostrProfile {
  name: string | null;
  picture: string | null;
}

/**
 * Relés de solo lectura para el perfil. purplepag.es está dedicado a metadatos
 * (kind 0), así que suele tener el perfil aunque el usuario publique en otro
 * lado; los demás cubren el caso de que no esté replicado ahí.
 */
const PROFILE_RELAYS = [
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
];

const CACHE_KEY = 'anima:nostr:profile';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;
const MAX_NAME_LENGTH = 32;

interface CachedProfile {
  pubkey: string;
  fetchedAt: number;
  profile: NostrProfile;
}

/** La npub completa (bech32) para copiar o inspeccionar. */
export function npubOf(pubkey: string): string {
  try {
    return npubEncode(pubkey);
  } catch {
    return pubkey; // pubkey malformada: mejor mostrar el hex que romperse.
  }
}

/** Fallback del chip mientras no haya perfil: npub reconocible pero corta. */
export function shortNpub(pubkey: string): string {
  const npub = npubOf(pubkey);
  if (!npub.startsWith('npub1')) return `${pubkey.slice(0, 8)}…`;
  return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
}

/**
 * El contenido del kind 0 lo escribe el usuario: nada de lo que trae es
 * confiable. El nombre se recorta y la foto solo se acepta por http(s) para
 * que una URL `javascript:` o `data:` no llegue nunca al <img>.
 */
function parseProfile(content: string): NostrProfile | null {
  try {
    const meta = JSON.parse(content) as Record<string, unknown>;
    const named = [meta['display_name'], meta['name']].find(
      (value) => typeof value === 'string' && value.trim() !== '',
    );
    const name = typeof named === 'string' ? named.trim().slice(0, MAX_NAME_LENGTH) : null;
    const raw = meta['picture'];
    const picture = typeof raw === 'string' && /^https?:\/\//i.test(raw.trim()) ? raw.trim() : null;
    return name || picture ? { name, picture } : null;
  } catch {
    return null;
  }
}

/** Perfil ya conocido: evita que el chip parpadee de npub a nombre en cada carga. */
export function readCachedProfile(pubkey: string): NostrProfile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedProfile;
    if (cached.pubkey !== pubkey) return null;
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
    return cached.profile;
  } catch {
    return null;
  }
}

function cacheProfile(pubkey: string, profile: NostrProfile): void {
  try {
    const entry: CachedProfile = { pubkey, fetchedAt: Date.now(), profile };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Sin storage el perfil se vuelve a pedir; no es motivo para fallar.
  }
}

export function forgetCachedProfile(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ídem: el TTL y la comparación de pubkey ya evitan mostrar a otro.
  }
}

/**
 * Busca el kind 0 en los relés. Nunca lanza ni bloquea la UI: sin relés (o sin
 * perfil publicado) devuelve null y el chip se queda con la npub. El timeout
 * propio cubre el caso de que ningún relé llegue a cerrar la suscripción.
 */
export async function fetchProfile(pubkey: string): Promise<NostrProfile | null> {
  const pool = new SimplePool();
  try {
    const event = await Promise.race([
      pool.get(PROFILE_RELAYS, { kinds: [0], authors: [pubkey] }, { maxWait: FETCH_TIMEOUT_MS }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FETCH_TIMEOUT_MS)),
    ]);
    const profile = event ? parseProfile(event.content) : null;
    if (profile) cacheProfile(pubkey, profile);
    return profile;
  } catch {
    return null;
  } finally {
    pool.destroy();
  }
}
