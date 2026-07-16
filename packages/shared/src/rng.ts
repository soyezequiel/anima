/**
 * PRNG determinista (mulberry32). El estado es un entero de 32 bits que puede
 * serializarse dentro de un snapshot y restaurarse sin perder la secuencia.
 */
export interface RngState {
  state: number;
}

export function createRng(seed: number): RngState {
  return { state: seed >>> 0 };
}

/** Avanza el estado y devuelve un número en [0, 1). Muta `rng`. */
export function nextFloat(rng: RngState): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Entero uniforme en [min, max] inclusive. Muta `rng`. */
export function nextInt(rng: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}
