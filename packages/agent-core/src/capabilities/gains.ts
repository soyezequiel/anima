import { causalFluent } from '../causal-world-model.js';
import type { CapabilityContext } from './capability.js';
import type { PlanStep } from './plan.js';

/**
 * Lo que un plan ya prometió, paso a paso.
 *
 * Cada capacidad declara sus efectos en el lenguaje del planificador causal, y
 * eso alcanza: para saber cuánto de cada tipo va a tener en la mano al llegar al
 * paso N basta con sumar lo que declararon los pasos anteriores. No hay una
 * segunda contabilidad que mantener sincronizada con la primera, que es
 * exactamente la clase de duplicación que se vuelve mentira con el tiempo.
 *
 * Sigue sin ser una promesa del mundo: es lo que el plan ESPERA. Si no ocurre,
 * la verificación del paso lo dice y se replanifica. Sirve para no armar un
 * plan que se contradice a sí mismo, no para dar nada por hecho.
 */

const INVENTORY_PREFIX = causalFluent.inventory('');

export function accumulateGains(gains: Map<string, number>, step: PlanStep): void {
  for (const effect of step.effects) {
    if (!effect.fluent.startsWith(INVENTORY_PREFIX)) continue;
    const kind = effect.fluent.slice(INVENTORY_PREFIX.length);
    if (kind.length === 0) continue;
    const delta =
      effect.operation === 'increase'
        ? effect.value
        : effect.operation === 'decrease'
          ? -effect.value
          : 0;
    gains.set(kind, (gains.get(kind) ?? 0) + delta);
  }
}

/** El contexto de un paso, con lo que los anteriores ya prometieron. */
export function contextWithGains(
  context: CapabilityContext,
  gains: ReadonlyMap<string, number>,
): CapabilityContext {
  return gains.size > 0 ? { ...context, plannedGains: gains } : context;
}
