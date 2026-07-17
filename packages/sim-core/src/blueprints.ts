import type { Vec2 } from '@anima/shared';
import type { EntityKind } from './components.js';

/**
 * Plano: una obra, no un objeto (ADR 0032). Declara QUÉ bloques van y DÓNDE,
 * cada uno como un desplazamiento respecto de un ancla. Es dato puro, hermano
 * de `Recipe` e `Interaction`: vive en `WorldState.blueprints`, viaja en los
 * snapshots, y una vez aprendido no se reinventa.
 *
 * Un plano no produce ninguna entidad: construirlo es colocar sus bloques. La
 * casa no es una cosa que aparece — es lo que queda cuando las paredes están
 * puestas donde el plano dice.
 */
export interface BlueprintPlacement {
  kind: EntityKind;
  /** Desde el ancla (donde la mascota queda parada al construir). Nunca (0,0). */
  offset: Vec2;
}

export interface Blueprint {
  id: string;
  placements: BlueprintPlacement[];
}

export function findBlueprint(blueprints: Blueprint[], id: string): Blueprint | undefined {
  return blueprints.find((b) => b.id === id);
}

/**
 * Cuántos bloques de cada tipo pide un plano. Lo que la mascota tiene que
 * juntar antes de empezar a colocar — fuente de verdad única, como
 * `missingIngredients` para las recetas.
 */
export function blueprintCounts(blueprint: Blueprint): Map<EntityKind, number> {
  const counts = new Map<EntityKind, number>();
  for (const placement of blueprint.placements) {
    counts.set(placement.kind, (counts.get(placement.kind) ?? 0) + 1);
  }
  return counts;
}
