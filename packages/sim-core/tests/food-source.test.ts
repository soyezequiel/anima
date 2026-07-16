import { describe, expect, it } from 'vitest';
import { findByKind, spawn, stepWorld } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

function addTree(world: ReturnType<typeof buildTestWorld>['world'], interval: number) {
  return spawn(world, 'tree', {
    position: { x: 5, y: 2 },
    collider: { solid: true },
    foodSource: { intervalTicks: interval, nutrition: 20, nextSpawnAtTick: 3 },
  });
}

describe('fuente de alimento', () => {
  it('produce alimento en una celda libre adyacente al vencer el intervalo', () => {
    const { world, pet } = buildTestWorld();
    addTree(world, 10);
    let spawned = 0;
    for (let i = 0; i < 3; i++) {
      const events = stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
      spawned += events.filter((e) => e.type === 'entity.spawned').length;
    }
    expect(spawned).toBe(1);
    const food = findByKind(world, 'food');
    expect(food).toHaveLength(1);
    expect(food[0]?.components.edible).toBeDefined();
    // Adyacente al árbol.
    const pos = food[0]!.components.position!;
    expect(Math.max(Math.abs(pos.x - 5), Math.abs(pos.y - 2))).toBeLessThanOrEqual(1);
  });

  it('no acumula alimento mientras el anterior siga cerca', () => {
    const { world, pet } = buildTestWorld();
    addTree(world, 5);
    for (let i = 0; i < 30; i++) {
      stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    }
    expect(findByKind(world, 'food')).toHaveLength(1);
  });

  it('vuelve a producir cuando el alimento anterior desaparece', () => {
    const { world, pet } = buildTestWorld();
    addTree(world, 5);
    for (let i = 0; i < 6; i++) stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    const first = findByKind(world, 'food')[0]!;
    // La mascota se acerca y lo consume (lo teletransportamos para abreviar).
    world.entities[pet.id]!.components.position = { ...first.components.position! };
    delete first.components.position;
    world.entities[pet.id]!.components.inventory!.items.push(first.id);
    stepWorld(world, [{ actorId: pet.id, intent: { type: 'consume', targetId: first.id } }]);
    expect(findByKind(world, 'food')).toHaveLength(0);
    for (let i = 0; i < 6; i++) stepWorld(world, [{ actorId: pet.id, intent: { type: 'wait' } }]);
    expect(findByKind(world, 'food')).toHaveLength(1);
  });
});
