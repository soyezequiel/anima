import { describe, expect, it } from 'vitest';
import { checkInvariants, stepWorld } from '../src/index.js';
import { buildTestWorld, spawnFood, spawnWall } from './helpers.js';

describe('invariantes', () => {
  it('un mundo válido no tiene violaciones tras varios pasos', () => {
    const { world, pet } = buildTestWorld();
    spawnWall(world, 3, 2);
    const food = spawnFood(world, 1, 1);
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'pickup', targetId: food.id } }]);
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'move', dir: 'right' } }]);
    expect(checkInvariants(world)).toEqual([]);
  });

  it('detecta solapamiento de sólidos y posiciones fuera del mapa', () => {
    const { world } = buildTestWorld();
    spawnWall(world, 1, 2); // misma celda que la mascota (sólida)
    spawnWall(world, 99, 99);
    const violations = checkInvariants(world);
    expect(violations.map((v) => v.invariant)).toContain('no-solid-overlap');
    expect(violations.map((v) => v.invariant)).toContain('position-in-bounds');
  });

  it('detecta items de inventario inconsistentes', () => {
    const { world, pet } = buildTestWorld();
    pet.components.inventory?.items.push('e999');
    expect(checkInvariants(world).map((v) => v.invariant)).toContain('inventory-items-exist');
  });
});
