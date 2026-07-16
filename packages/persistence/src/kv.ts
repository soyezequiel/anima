/**
 * Almacenamiento clave-valor mínimo y asíncrono. La interfaz es lo único que
 * el resto del sistema conoce: en el navegador la implementa localStorage,
 * en pruebas la memoria, y en el futuro el backend (Fase 8) u otro medio.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export class MemoryKeyValueStore implements KeyValueStore {
  private data = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.data.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.data.delete(key);
    return Promise.resolve();
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.data.keys()]);
  }
}

interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

/** Adaptador sobre localStorage (o cualquier Storage compatible). */
export class WebStorageKeyValueStore implements KeyValueStore {
  constructor(
    private storage: WebStorageLike,
    private prefix = 'anima:',
  ) {}

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.storage.getItem(this.prefix + key));
  }

  set(key: string, value: string): Promise<void> {
    this.storage.setItem(this.prefix + key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.storage.removeItem(this.prefix + key);
    return Promise.resolve();
  }

  keys(): Promise<string[]> {
    const result: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key !== null && key.startsWith(this.prefix)) {
        result.push(key.slice(this.prefix.length));
      }
    }
    return Promise.resolve(result);
  }
}

export async function writeJson(store: KeyValueStore, key: string, value: unknown): Promise<void> {
  await store.set(key, JSON.stringify(value));
}

export async function readJson<T>(store: KeyValueStore, key: string): Promise<T | null> {
  const raw = await store.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
