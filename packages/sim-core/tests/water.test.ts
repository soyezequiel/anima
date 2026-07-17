import { describe, expect, it } from 'vitest';
import { findByKind, isBlocked, spawn, stepWorld } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

/**
 * El agua es terreno, no obstáculo sólido: se ve por encima (no tapa la línea
 * de visión) pero nadie sabe nadar, así que caminar adentro falla con su
 * propio motivo. Sin sed y sin nado, a propósito (ADR 0026): da forma a los
 * caminos, no agrega necesidades.
 */

function addWater(world: ReturnType<typeof buildTestWorld>['world'], x: number, y: number) {
  return spawn(world, 'water', { position: { x, y }, water: {} });
}

describe('agua', () => {
  it('moverse al agua falla con motivo "water" y la mascota no avanza', () => {
    const { world, pet } = buildTestWorld(); // mascota en (1,2)
    const pond = addWater(world, 2, 2);
    const events = stepWorld(world, [{ actorId: pet.id, intent: { type: 'move', dir: 'right' } }]);
    const resolution = events.find((e) => e.type === 'action.resolved');
    expect(resolution?.data.success).toBe(false);
    expect(resolution?.data.reason).toBe('water');
    expect(resolution?.data.blockerId).toBe(pond.id);
    expect(pet.components.position).toEqual({ x: 1, y: 2 });
  });

  it('no es sólida: no bloquea como un muro ni tapa la vista', () => {
    const { world } = buildTestWorld();
    addWater(world, 2, 2);
    // isBlocked es la regla de los sólidos (y de la línea de visión): el agua
    // no participa — su regla es propia y solo frena al caminante.
    expect(isBlocked(world, { x: 2, y: 2 })).toBeNull();
  });

  it('nada brota sobre el agua: una celda mojada cuenta como ocupada', () => {
    const { world, pet } = buildTestWorld();
    spawn(world, 'tree', {
      position: { x: 5, y: 2 },
      collider: { solid: true },
      foodSource: { intervalTicks: 5, nutrition: 10, nextSpawnAtTick: 3 },
    });
    // La primera celda candidata del orden determinista (arriba) es agua.
    addWater(world, 5, 1);
    for (let i = 0; i < 6; i++) stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    const food = findByKind(world, 'food');
    expect(food).toHaveLength(1);
    expect(food[0]!.components.position).not.toEqual({ x: 5, y: 1 });
  });
});
