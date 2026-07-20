import { describe, expect, it } from 'vitest';
import type { Goal } from '../src/goals.js';
import { inventionCreditKey } from '../src/invention.js';

/**
 * Tener ideas se paga por PROBLEMA, no por vida — lo dice `ProgressController`
 * desde siempre. Pero el problema se identificaba con el ID DEL OBJETIVO, y eso
 * no es lo mismo.
 *
 * Una necesidad del cuerpo va y vuelve. Al recuperarse, el objetivo del frío se
 * COMPLETA (`closeSatisfiedNeeds`), y el próximo bajón crea uno nuevo con id
 * nuevo. Cada ciclo frío→calor→frío regalaba tres inventos frescos.
 *
 * Eso es lo que convirtió tres recetas en diez en el mapa del cauce: campfire,
 * torch, shelter son la misma idea intentada de nuevo, tres veces, porque entre
 * una y otra ella entró en calor un rato.
 *
 * Un encargo del cuidador sí es un problema por vez.
 */

function goal(partial: Partial<Goal>): Goal {
  return {
    id: 'goal-1',
    description: 'algo',
    source: 'internal-signal',
    priority: 1,
    urgency: 0,
    expectedValue: 1,
    status: 'active',
    createdAtTick: 0,
    preconditions: [],
    successCriteria: [],
    failureCriteria: [],
    ...partial,
  } as Goal;
}

describe('el crédito de inventar es del problema, no del objetivo', () => {
  it('dos episodios de la misma necesidad comparten crédito', () => {
    // El mismo frío, dos veces: entre medio entró en calor y el objetivo se
    // cerró. Es el mismo problema, y el crédito ya gastado sigue gastado.
    const primero = goal({ id: 'goal-3', description: 'recuperar el calor del cuerpo' });
    const segundo = goal({ id: 'goal-9', description: 'recuperar el calor del cuerpo' });

    expect(inventionCreditKey(primero)).toBe(inventionCreditKey(segundo));
  });

  it('necesidades distintas no se roban el crédito entre sí', () => {
    // Que el frío la haya derrotado no dice nada sobre el hambre.
    const frio = goal({ id: 'goal-3', description: 'recuperar el calor del cuerpo' });
    const hambre = goal({ id: 'goal-4', description: 'recuperar la energía' });

    expect(inventionCreditKey(frio)).not.toBe(inventionCreditKey(hambre));
  });

  it('cada encargo del cuidador es su propio problema, aunque pida lo mismo', () => {
    // Dos veces "hacé un puente" son dos problemas: el mundo cambió entre uno y
    // otro, y el segundo merece sus propios intentos.
    const primero = goal({ id: 'goal-1', source: 'user-request', description: 'hacé un puente' });
    const segundo = goal({ id: 'goal-7', source: 'user-request', description: 'hacé un puente' });

    expect(inventionCreditKey(primero)).not.toBe(inventionCreditKey(segundo));
    expect(inventionCreditKey(primero)).toBe('goal-1');
  });
});
