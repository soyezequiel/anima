import { describe, expect, it } from 'vitest';
import type { ActorIntent, Entity, WorldState } from '@anima/sim-core';
import { allEntities, checkInvariants, getEntity, stepWorld } from '@anima/sim-core';
import { CAMPFIRE_RECIPE, coldNightUnlit, withoutChance } from '../src/index.js';

/**
 * La historia del crafteo a nivel motor: talar el árbol, juntar los troncos y
 * el pedernal, construir la fogata y dejar de congelarse. El agente todavía no
 * sabe hacerlo solo (eso es el chunk B); acá se prueba que el mundo lo permite
 * y que ninguno de los pasos está regalado.
 */
describe('escenario cold-night-unlit', () => {
  const act = (petId: string, intent: ActorIntent['intent']): ActorIntent[] => [
    { actorId: petId, intent },
  ];

  const kindsIn = (world: WorldState, pet: Entity): string[] =>
    pet.components.inventory!.items.map((id) => world.entities[id]!.kind);

  /** Camina hasta quedar adyacente al objetivo (sin skills: a mano). */
  function walkNextTo(world: WorldState, pet: Entity, target: Entity): void {
    for (let i = 0; i < 40; i++) {
      const from = pet.components.position!;
      const to = target.components.position!;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (Math.abs(dx) + Math.abs(dy) <= 1) return;
      const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      stepWorld(world, act(pet.id, { type: 'move', dir }));
    }
  }

  it('el mundo no regala la fogata: hay que construirla', () => {
    const { world } = coldNightUnlit.build(1);
    expect(allEntities(world).some((e) => e.kind === 'campfire')).toBe(false);
    expect(world.recipes.map((r) => r.id)).toEqual(['campfire']);
  });

  it('sin hacer nada, la mascota muere de frío', () => {
    const { world, petId } = coldNightUnlit.build(1);
    for (let i = 0; i < 600 && !getEntity(world, petId)?.components.dead; i++) {
      stepWorld(world, act(petId, { type: 'wait' }));
    }
    expect(getEntity(world, petId)?.components.dead?.cause).toBe('hypothermia');
  });

  it('talar, juntar y craftear: la fogata existe y el frío se revierte', () => {
    const { world, petId } = coldNightUnlit.build(1);
    const pet = getEntity(world, petId)!;
    // Sin la tirada: que el mundo PERMITA la cadena entera —talar, juntar,
    // construir, calentarse— es una pregunta distinta de si la chispa agarró
    // esta vez. Mezclarlas haría que esta historia se cuente o no según la
    // suerte de la semilla, y que rompa el día que otro sistema consuma el
    // dado antes que ella. Que prender pueda no salir se prueba en sim-core.
    world.recipes = [withoutChance(CAMPFIRE_RECIPE)];

    // 1. Buscar el martillo: sin él, el árbol no cae.
    const hammer = allEntities(world).find((e) => e.kind === 'hammer')!;
    walkNextTo(world, pet, hammer);
    stepWorld(world, act(petId, { type: 'pickup', targetId: hammer.id }));
    expect(kindsIn(world, pet)).toContain('hammer');

    // 2. Talar el árbol hasta que caiga y deje troncos.
    const tree = allEntities(world).find((e) => e.kind === 'tree')!;
    walkNextTo(world, pet, tree);
    for (let i = 0; i < 10 && getEntity(world, tree.id); i++) {
      stepWorld(world, act(petId, { type: 'useItem', itemId: hammer.id, targetId: tree.id }));
    }
    expect(getEntity(world, tree.id)).toBeUndefined();
    const logs = allEntities(world).filter((e) => e.kind === 'log');
    expect(logs.length).toBeGreaterThanOrEqual(2);

    // 3. Recoger dos troncos y el pedernal.
    for (const log of logs.slice(0, 2)) {
      walkNextTo(world, pet, log);
      stepWorld(world, act(petId, { type: 'pickup', targetId: log.id }));
    }
    const flint = allEntities(world).find((e) => e.kind === 'flint')!;
    walkNextTo(world, pet, flint);
    stepWorld(world, act(petId, { type: 'pickup', targetId: flint.id }));
    expect(kindsIn(world, pet).filter((k) => k === 'log')).toHaveLength(2);
    expect(kindsIn(world, pet)).toContain('flint');

    // 4. Construir.
    const events = stepWorld(world, act(petId, { type: 'craft', recipeId: 'campfire' }));
    expect(events.find((e) => e.type === 'item.crafted')?.data.itemKind).toBe('campfire');

    // 5. Junto a la fogata (a distancia 2), el calor sube en vez de bajar.
    const campfire = allEntities(world).find((e) => e.kind === 'campfire')!;
    const fire = campfire.components.position!;
    pet.components.position = { x: fire.x - 2, y: fire.y };
    const before = pet.components.temperature!.current;
    stepWorld(world, act(petId, { type: 'wait' }));
    expect(pet.components.temperature!.current).toBeGreaterThan(before);

    expect(checkInvariants(world)).toEqual([]);
  });

  it('sin pedernal, el mundo se niega y dice qué falta', () => {
    const { world, petId } = coldNightUnlit.build(1);
    const pet = getEntity(world, petId)!;
    // Dos troncos en la mano, ningún pedernal: el caso del chat.
    const events = stepWorld(world, act(petId, { type: 'craft', recipeId: 'campfire' }));
    const resolvedEvent = events.find((e) => e.type === 'action.resolved');
    expect(resolvedEvent?.data.success).toBe(false);
    expect(resolvedEvent?.data.missing).toEqual([
      { kind: 'log', need: 2, have: 0 },
      { kind: 'flint', need: 1, have: 0 },
    ]);
    expect(pet.components.inventory!.items).toHaveLength(0);
  });

  it('el pedernal cambia de sitio con la semilla: no se puede memorizar', () => {
    const positions = [1, 2, 3, 4, 5].map((seed) => {
      const { world } = coldNightUnlit.build(seed);
      const flint = allEntities(world).find((e) => e.kind === 'flint')!;
      return JSON.stringify(flint.components.position);
    });
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it('el mismo seed produce el mismo mundo', () => {
    expect(coldNightUnlit.build(7).world.entities).toEqual(coldNightUnlit.build(7).world.entities);
  });
});
