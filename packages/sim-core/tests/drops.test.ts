import { describe, expect, it } from 'vitest';
import type { Entity, WorldState } from '../src/index.js';
import { allEntities, spawn, stepWorld } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

function giveHammer(world: WorldState, pet: Entity): Entity {
  const hammer = spawn(world, 'hammer', {
    portable: {},
    tool: { power: 8 },
    durability: { current: 20, max: 20 },
  });
  pet.components.inventory!.items.push(hammer.id);
  return hammer;
}

function spawnTree(world: WorldState, x: number, y: number): Entity {
  return spawn(world, 'tree', {
    position: { x, y },
    collider: { solid: true },
    hardness: { value: 5 },
    durability: { current: 10, max: 10 },
    drops: [
      { kind: 'log', components: { portable: {} } },
      { kind: 'log', components: { portable: {} } },
    ],
  });
}

describe('drops al destruir', () => {
  it('talar el árbol deja troncos donde estaba y alrededor', () => {
    const { world, pet } = buildTestWorld(); // mascota en (1,2)
    const hammer = giveHammer(world, pet);
    const tree = spawnTree(world, 2, 2);

    // poder efectivo 8+2=10, dureza 5 => daño 5 por golpe; durabilidad 10 => 2 golpes.
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: hammer.id, targetId: tree.id } },
    ]);
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: hammer.id, targetId: tree.id } },
    ]);

    expect(events.some((e) => e.type === 'entity.destroyed')).toBe(true);
    const logs = allEntities(world).filter((e) => e.kind === 'log');
    expect(logs).toHaveLength(2);
    // El primer tronco cae en la celda del árbol, ya libre.
    expect(logs[0]?.components.position).toEqual({ x: 2, y: 2 });
    expect(logs.every((l) => l.components.portable)).toBe(true);
    // Los spawns quedaron registrados como eventos con su origen.
    const spawns = events.filter((e) => e.type === 'entity.spawned');
    expect(spawns).toHaveLength(2);
    expect(spawns[0]?.data.sourceId).toBe(tree.id);
  });

  it('cada drop es una copia independiente aunque el arquetipo se comparta', () => {
    const { world, pet } = buildTestWorld();
    const hammer = giveHammer(world, pet);
    const shared = { portable: {} };
    const target = spawn(world, 'crate', {
      position: { x: 2, y: 2 },
      hardness: { value: 0 },
      durability: { current: 1, max: 1 },
      drops: [
        { kind: 'thing', components: shared },
        { kind: 'thing', components: shared },
      ],
    });
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: hammer.id, targetId: target.id } },
    ]);
    const things = allEntities(world).filter((e) => e.kind === 'thing');
    expect(things).toHaveLength(2);
    expect(things[0]!.components).not.toBe(things[1]!.components);
    expect(things[0]!.components.position).not.toEqual(things[1]!.components.position);
  });

  it('sin componente drops, destruir no deja nada (comportamiento previo intacto)', () => {
    const { world, pet } = buildTestWorld();
    const hammer = giveHammer(world, pet);
    const wall = spawn(world, 'wall', {
      position: { x: 2, y: 2 },
      collider: { solid: true },
      hardness: { value: 5 },
      durability: { current: 5, max: 5 },
    });
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: hammer.id, targetId: wall.id } },
    ]);
    expect(events.some((e) => e.type === 'entity.destroyed')).toBe(true);
    expect(events.some((e) => e.type === 'entity.spawned')).toBe(false);
  });
});
