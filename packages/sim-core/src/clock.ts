import type { WorldState } from './world.js';

/**
 * Cuántos ticks del mundo equivalen a un segundo de reloj a velocidad normal.
 * El mundo se rige por ticks, no por milisegundos: un pedido dicho en segundos
 * ("quedate diez segundos") se traduce a ticks con esta constante para que el
 * plazo lo cuente el reloj determinista y no un temporizador externo. El valor
 * acompaña al ritmo base de la presentación (`BASE_TICKS_PER_SECOND`).
 */
export const TICKS_PER_SECOND = 4;

/** Convierte segundos a ticks del mundo, redondeando al tick más cercano. */
export function secondsToTicks(seconds: number): number {
  return Math.max(0, Math.round(seconds * TICKS_PER_SECOND));
}

export type TimeOfDay = 'day' | 'night';

/**
 * El ciclo de día y noche del mundo, contado en ticks. Es configuración del
 * mundo, no estado mutable aparte: viaja en los snapshots y la hora se DERIVA
 * de `world.tick`, así que dos sesiones con la misma semilla ven el mismo cielo
 * y un guardado restaura la hora exacta sin persistir nada más. Un mundo sin
 * `clock` es de día siempre — los escenarios anteriores a esto quedan intactos,
 * y la ausencia de ciclo no es "medianoche" sino un mundo sin noche.
 */
export interface WorldClock {
  /** Ticks de luz en un ciclo. */
  dayTicks: number;
  /** Ticks de oscuridad en un ciclo. */
  nightTicks: number;
  /** Desfase inicial dentro del ciclo, para arrancar de noche o al atardecer. */
  offset?: number;
}

/** Largo del ciclo completo (día + noche), nunca cero. */
export function cycleLength(clock: WorldClock): number {
  return Math.max(1, Math.max(0, clock.dayTicks) + Math.max(0, clock.nightTicks));
}

/** Posición dentro del ciclo, en `[0, cycleLength)`, estable ante ticks grandes. */
export function phaseTick(clock: WorldClock, tick: number): number {
  const length = cycleLength(clock);
  return (((tick + (clock.offset ?? 0)) % length) + length) % length;
}

/**
 * Qué hora del día es, derivada de forma determinista del tick. Sin reloj el
 * mundo es de día. La primera mitad del ciclo (`dayTicks`) es día; el resto,
 * noche. "Amanecer" no es un instante propio: es el tick en que se vuelve `day`
 * tras haber sido `night`, y quien espera el amanecer lo hace esperando `day`.
 */
export function timeOfDay(world: Pick<WorldState, 'tick' | 'clock'>): TimeOfDay {
  const clock = world.clock;
  if (!clock) return 'day';
  return phaseTick(clock, world.tick) < Math.max(0, clock.dayTicks) ? 'day' : 'night';
}
