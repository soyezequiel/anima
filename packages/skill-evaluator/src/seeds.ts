import { createRng, nextInt } from '@anima/shared';

/**
 * Cuántos mundos hacen falta para que el umbral signifique algo.
 *
 * Con 3 semillas fijas el veredicto era una propiedad de esos tres números: una
 * skill que acierta el 83% —la v1 defectuosa del ADR 0006, la que el ciclo
 * entero existe para atrapar— pasa 3 de 3 con probabilidad 0.83³ = 57%. El
 * umbral del 100% no filtraba: sorteaba. Con 20, 0.83²⁰ = 2.4% (ADR 0030).
 */
export const DEFAULT_EVALUATION_SEED_COUNT = 20;

/**
 * Deriva la grilla de mundos de evaluación de la semilla de la partida.
 *
 * Derivarla —en vez de tirar de `world.rng`— es deliberado: evaluar es pensar,
 * y pensar no puede correrle la secuencia del dado al mundo. Si el evaluador
 * consumiera `world.rng`, el futuro de la partida dependería de cuánto pensó
 * la mascota. Este stream es suyo y no toca nada; el mismo mundo da siempre la
 * misma grilla, así que los snapshots y las regresiones siguen clavados.
 */
export function sampleSeeds(
  worldSeed: number,
  count: number = DEFAULT_EVALUATION_SEED_COUNT,
): number[] {
  // Constantes de dispersión: alejan este stream del terreno de los escenarios
  // (`seed * 7919 + 17` y compañía) para que la grilla no se correlacione con
  // los mundos que va a construir.
  const rng = createRng((worldSeed * 2246822519 + 374761393) >>> 0);
  const seeds: number[] = [];
  while (seeds.length < count) {
    const seed = nextInt(rng, 1, 0x7fffffff);
    // Mundos repetidos serían evidencia contada dos veces.
    if (!seeds.includes(seed)) seeds.push(seed);
  }
  return seeds;
}
