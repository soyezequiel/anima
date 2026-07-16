import type { WorldState } from './world.js';
import { allEntities, inBounds } from './world.js';

export interface InvariantViolation {
  invariant: string;
  detail: string;
}

/**
 * Invariantes estructurales del mundo. El evaluador de skills las verifica en
 * cada tick de los mundos de prueba: ninguna habilidad puede violarlas, y si
 * el motor las viola es un bug del motor, nunca un "aprendizaje" del agente.
 */
export function checkInvariants(world: WorldState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const solidTiles = new Map<string, string>();

  for (const entity of allEntities(world)) {
    const pos = entity.components.position;
    if (pos) {
      if (!inBounds(world, pos)) {
        violations.push({
          invariant: 'position-in-bounds',
          detail: `${entity.id} (${entity.kind}) en (${pos.x},${pos.y}) fuera del mapa`,
        });
      }
      if (entity.components.collider?.solid) {
        const key = `${pos.x},${pos.y}`;
        const existing = solidTiles.get(key);
        if (existing) {
          violations.push({
            invariant: 'no-solid-overlap',
            detail: `${entity.id} y ${existing} comparten la celda sólida (${pos.x},${pos.y})`,
          });
        }
        solidTiles.set(key, entity.id);
      }
    }

    const inventory = entity.components.inventory;
    if (inventory) {
      for (const itemId of inventory.items) {
        const item = world.entities[itemId];
        if (!item) {
          violations.push({
            invariant: 'inventory-items-exist',
            detail: `${entity.id} contiene ${itemId}, que no existe`,
          });
        } else if (item.components.position) {
          violations.push({
            invariant: 'held-items-have-no-position',
            detail: `${itemId} está en el inventario de ${entity.id} y también en el mapa`,
          });
        }
      }
    }

    const energy = entity.components.energy;
    if (energy && (energy.current < 0 || energy.current > energy.max)) {
      violations.push({
        invariant: 'energy-in-range',
        detail: `${entity.id} tiene energía ${energy.current} fuera de [0, ${energy.max}]`,
      });
    }
  }
  return violations;
}
