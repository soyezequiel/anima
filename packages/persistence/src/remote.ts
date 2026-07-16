import type { KeyValueStore } from './kv.js';

/**
 * KeyValueStore respaldado por la API de Ánima. El token es una credencial
 * de sesión emitida por el backend tras verificar un desafío firmado; nunca
 * contiene ni deriva la clave privada Nostr del usuario.
 */
export class RemoteKeyValueStore implements KeyValueStore {
  constructor(
    private baseUrl: string,
    private token: string,
    // Envuelto para no capturar `fetch` sin su `this` (los navegadores lanzan
    // "Illegal invocation" si fetch se invoca desligado de globalThis).
    private fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  // Sin content-type en peticiones sin cuerpo: Fastify rechaza con 400 un
  // application/json vacío.
  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.token}` };
  }

  private url(key: string): string {
    return `${this.baseUrl}/data/${encodeURIComponent(key)}`;
  }

  async get(key: string): Promise<string | null> {
    const res = await this.fetchImpl(this.url(key), { headers: this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${key}: ${res.status}`);
    const body = (await res.json()) as { value: string };
    return body.value;
  }

  async set(key: string, value: string): Promise<void> {
    const res = await this.fetchImpl(this.url(key), {
      method: 'PUT',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) throw new Error(`PUT ${key}: ${res.status}`);
  }

  async delete(key: string): Promise<void> {
    const res = await this.fetchImpl(this.url(key), {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 404) throw new Error(`DELETE ${key}: ${res.status}`);
  }

  async keys(): Promise<string[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/data`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GET keys: ${res.status}`);
    const body = (await res.json()) as { keys: string[] };
    return body.keys;
  }
}
