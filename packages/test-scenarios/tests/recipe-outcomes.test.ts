import { describe, expect, it } from 'vitest';
import type { Entity, Recipe, WorldState } from '@anima/sim-core';
import { allEntities, createWorld, removeEntity, spawn, stepWorld } from '@anima/sim-core';
import { BARRICADE_RECIPE, CAMPFIRE_RECIPE, CHAIR_RECIPE, TORCH_RECIPE } from '../src/index.js';

/**
 * Los dos oficios del mundo fallan distinto, y acá se mide que sea cierto sobre
 * las recetas de verdad —no sobre un fixture—: encender es azaroso y la
 * carpintería no. Es la diferencia que hace que la tirada signifique algo en
 * vez de ser ruido parejo encima de todo.
 */

function workshop(recipe: Recipe): { world: WorldState; pet: Entity } {
  const world = createWorld({ width: 9, height: 7, seed: 4 }, { recipes: [recipe] });
  const pet = spawn(world, 'pet', {
    position: { x: 4, y: 3 },
    collider: { solid: true },
    health: { current: 10, max: 10 },
    inventory: { items: [], capacity: 8 },
    agent: { name: 'Anima', perceptionRange: 8 },
  });
  return { world, pet };
}

/** Construye `times` veces con la mano llena y devuelve qué salió cada vez. */
function attempts(recipe: Recipe, times: number): { made: number; failed: number; kinds: number } {
  const { world, pet } = workshop(recipe);
  const products = new Set<string>();
  let made = 0;
  let failed = 0;
  for (let i = 0; i < times; i++) {
    for (const ingredient of recipe.ingredients) {
      for (let n = 0; n < ingredient.count; n++) {
        const item = spawn(world, ingredient.kind, { portable: {} });
        pet.components.inventory!.items.push(item.id);
      }
    }
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'craft', recipeId: recipe.id } },
    ]);
    const crafted = events.find((e) => e.type === 'item.crafted');
    if (crafted) {
      made += 1;
      products.add(JSON.stringify(crafted.data.quality));
    } else {
      failed += 1;
    }
    // Despejar entre intentos: el taller es chico y se llenaría de fogatas.
    for (const entity of allEntities(world)) {
      if (entity.id !== pet.id && entity.components.position) removeEntity(world, entity.id);
    }
    pet.components.inventory!.items = [];
  }
  return { made, failed, kinds: products.size };
}

describe('encender es azaroso', () => {
  it('la fogata a veces no prende, y cuando prende no siempre sale igual', () => {
    const { made, failed, kinds } = attempts(CAMPFIRE_RECIPE, 60);

    expect(failed).toBeGreaterThan(0);
    expect(made).toBeGreaterThan(0);
    // Ni siquiera las que prendieron salieron iguales entre sí.
    expect(kinds).toBeGreaterThan(1);
  });

  it('la antorcha también puede no prender: es el mismo oficio', () => {
    expect(attempts(TORCH_RECIPE, 60).failed).toBeGreaterThan(0);
  });
});

describe('dar forma siempre sale, pero nunca igual', () => {
  it('la silla nunca falla: la madera ya está ahí, no hay nada que pueda no ocurrir', () => {
    const { made, failed, kinds } = attempts(CHAIR_RECIPE, 40);

    expect(failed).toBe(0);
    expect(made).toBe(40);
    // Sale siempre, pero sale distinta: es despareja, no fallida.
    expect(kinds).toBeGreaterThan(1);
  });

  it('la muralla tampoco falla: el barro ya está amasado', () => {
    expect(attempts(BARRICADE_RECIPE, 40).failed).toBe(0);
  });

  it('una silla renga aguanta menos que una firme: la calidad se paga en durabilidad', () => {
    const { world, pet } = workshop(CHAIR_RECIPE);
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      for (let n = 0; n < 2; n++) {
        const log = spawn(world, 'log', { portable: {} });
        pet.components.inventory!.items.push(log.id);
      }
      stepWorld(world, [{ actorId: pet.id, intent: { type: 'craft', recipeId: 'chair' } }]);
      for (const entity of allEntities(world)) {
        if (entity.kind !== 'chair') continue;
        seen.add(entity.components.durability!.max);
        removeEntity(world, entity.id);
      }
      pet.components.inventory!.items = [];
    }

    // La silla de catálogo aguanta 6. Salieron mejores y peores.
    expect(seen.size).toBeGreaterThan(1);
    expect(Math.min(...seen)).toBeLessThan(6);
    expect(Math.max(...seen)).toBeGreaterThanOrEqual(6);
  });
});

describe('el pedernal sobrevive al intento fallido', () => {
  it('la fogata que no prendió se lleva la leña y deja la piedra: se puede insistir', () => {
    const { world, pet } = workshop(CAMPFIRE_RECIPE);
    let sawFailure = false;

    for (let i = 0; i < 60 && !sawFailure; i++) {
      pet.components.inventory!.items = [];
      for (const kind of ['log', 'log', 'flint']) {
        const item = spawn(world, kind, { portable: {} });
        pet.components.inventory!.items.push(item.id);
      }
      const events = stepWorld(world, [
        { actorId: pet.id, intent: { type: 'craft', recipeId: 'campfire' } },
      ]);
      if (events.some((e) => e.type === 'craft.failed')) {
        sawFailure = true;
        const held = pet.components.inventory!.items.map((id) => world.entities[id]!.kind);
        expect(held).toEqual(['flint']);
      }
      for (const entity of allEntities(world)) {
        if (entity.kind === 'campfire') removeEntity(world, entity.id);
      }
    }

    expect(sawFailure).toBe(true);
  });
});
