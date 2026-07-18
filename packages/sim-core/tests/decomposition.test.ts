import { describe, expect, it } from 'vitest';
import type { Entity, WorldState } from '../src/index.js';
import {
  allEntities,
  createWorld,
  decompositionFor,
  restoreSnapshot,
  spawn,
  stepWorld,
  takeSnapshot,
  validateDecomposition,
} from '../src/index.js';

/**
 * La cuarta puerta (ADR 0027): en qué se deshace la MATERIA BASE al romperse.
 * Lo crafteado ya lo sabe el mundo (los ingredientes que costó, guardados como
 * `drops`); un pedernal sembrado no tiene receta de la cual derivarlo, así que
 * la regla la inventa la IA Dios en runtime y el mundo la guarda.
 */

function buildWorld(): { world: WorldState; pet: Entity } {
  const world = createWorld({ width: 7, height: 5, seed: 1 });
  const pet = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Test', perceptionRange: 10 },
  });
  return { world, pet };
}

function giveHammer(world: WorldState, pet: Entity): Entity {
  const hammer = spawn(world, 'hammer', {
    portable: {},
    tool: { power: 8 },
    durability: { current: 20, max: 20 },
  });
  pet.components.inventory!.items.push(hammer.id);
  return hammer;
}

/** Un pedernal como el que siembra el escenario: rompible y sin `drops`. */
function spawnFlint(world: WorldState): Entity {
  return spawn(world, 'flint', {
    position: { x: 2, y: 2 },
    portable: {},
    hardness: { value: 3 },
    durability: { current: 3, max: 3 },
  });
}

const FLINT_SHARDS = {
  id: 'romper-flint',
  targetKind: 'flint',
  drops: [
    { kind: 'esquirla', components: { portable: {} } },
    { kind: 'esquirla', components: { portable: {} } },
  ],
};

describe('la puerta de las descomposiciones', () => {
  it('acepta una descomposición bien formada y la guarda como regla del mundo', () => {
    const { world, pet } = buildWorld();

    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeDecomposition', decomposition: FLINT_SHARDS } },
    ]);

    expect(events.some((e) => e.type === 'decomposition.learned')).toBe(true);
    expect(decompositionFor(world.decompositions, 'flint')?.drops).toHaveLength(2);
  });

  it('no puede fabricar lo protegido: romper algo no inventa comida', () => {
    const result = validateDecomposition({
      id: 'romper-flint',
      targetKind: 'flint',
      drops: [{ kind: 'food', components: { portable: {} } }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('no puede dejar "food"');
  });

  it('no puede dejar varios de sí mismo: eso sería una fábrica de materia', () => {
    const result = validateDecomposition({
      id: 'romper-flint',
      targetKind: 'flint',
      drops: [
        { kind: 'flint', components: { portable: {} } },
        { kind: 'flint', components: { portable: {} } },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('varios de sí mismo');
  });

  it('una sola descomposición por tipo: no hay dos respuestas para lo mismo', () => {
    const { world, pet } = buildWorld();
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeDecomposition', decomposition: FLINT_SHARDS } },
    ]);
    const events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: {
          type: 'proposeDecomposition',
          decomposition: { ...FLINT_SHARDS, id: 'otra-forma' },
        },
      },
    ]);
    expect(events.some((e) => e.type === 'decomposition.rejected')).toBe(true);
    expect(world.decompositions).toHaveLength(1);
  });
});

describe('romper materia base con una descomposición aprendida', () => {
  it('el pedernal deja sus fragmentos en vez de desaparecer', () => {
    const { world, pet } = buildWorld();
    const hammer = giveHammer(world, pet);
    const flint = spawnFlint(world);
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeDecomposition', decomposition: FLINT_SHARDS } },
    ]);

    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: hammer.id, targetId: flint.id } },
    ]);

    expect(events.some((e) => e.type === 'entity.destroyed')).toBe(true);
    const shards = allEntities(world).filter((e) => e.kind === 'esquirla');
    expect(shards).toHaveLength(2);
    // El primero cae donde estaba el pedernal, ya libre.
    expect(shards[0]?.components.position).toEqual({ x: 2, y: 2 });
    expect(shards.every((s) => s.components.portable)).toBe(true);
    // Los fragmentos quedaron registrados con su origen.
    const spawned = events.filter((e) => e.type === 'entity.spawned');
    expect(spawned).toHaveLength(2);
    expect(spawned[0]?.data.sourceId).toBe(flint.id);
  });

  it('sin descomposición aprendida sigue sin dejar nada: la regla es lo que cambia, no el motor', () => {
    const { world, pet } = buildWorld();
    const hammer = giveHammer(world, pet);
    const flint = spawnFlint(world);

    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: hammer.id, targetId: flint.id } },
    ]);

    expect(events.some((e) => e.type === 'entity.destroyed')).toBe(true);
    expect(events.some((e) => e.type === 'entity.spawned')).toBe(false);
  });

  it('el `drops` propio de la entidad manda sobre la regla del tipo', () => {
    const { world, pet } = buildWorld();
    const hammer = giveHammer(world, pet);
    // Este pedernal concreto ya sabe qué deja: no le toca la regla general.
    const flint = spawn(world, 'flint', {
      position: { x: 2, y: 2 },
      hardness: { value: 3 },
      durability: { current: 3, max: 3 },
      drops: [{ kind: 'polvo', components: { portable: {} } }],
    });
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeDecomposition', decomposition: FLINT_SHARDS } },
    ]);

    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'useItem', itemId: hammer.id, targetId: flint.id } },
    ]);

    expect(allEntities(world).filter((e) => e.kind === 'polvo')).toHaveLength(1);
    expect(allEntities(world).filter((e) => e.kind === 'esquirla')).toHaveLength(0);
  });

  it('la regla viaja en el snapshot: un mundo restaurado rompe igual', () => {
    const { world, pet } = buildWorld();
    stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeDecomposition', decomposition: FLINT_SHARDS } },
    ]);

    const restored = restoreSnapshot(takeSnapshot(world));
    expect(decompositionFor(restored.decompositions, 'flint')?.drops).toHaveLength(2);
  });

  it('un guardado anterior a las descomposiciones restaura sin ninguna', () => {
    const { world } = buildWorld();
    const snapshot = takeSnapshot(world);
    delete (snapshot.state as { decompositions?: unknown }).decompositions;

    expect(restoreSnapshot(snapshot).decompositions).toEqual([]);
  });
});
