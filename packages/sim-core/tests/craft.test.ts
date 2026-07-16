import { describe, expect, it } from 'vitest';
import type { Entity, MissingIngredient, Recipe, WorldState } from '../src/index.js';
import { allEntities, createWorld, missingIngredients, spawn, stepWorld } from '../src/index.js';

const CAMPFIRE: Recipe = {
  id: 'campfire',
  output: {
    kind: 'campfire',
    components: { heatSource: { warmthPerTick: 3, range: 2 }, hazard: { damagePerTick: 1 } },
  },
  ingredients: [
    { kind: 'log', count: 2 },
    { kind: 'flint', count: 1 },
  ],
};

interface CraftWorld {
  world: WorldState;
  pet: Entity;
}

function buildCraftWorld(recipes: Recipe[] = [CAMPFIRE]): CraftWorld {
  const world = createWorld({ width: 7, height: 5, seed: 1 }, { recipes });
  const pet = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 20, max: 50, decayPerTick: 0.1 },
    health: { current: 10, max: 10 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Test', perceptionRange: 10 },
  });
  return { world, pet };
}

function give(world: WorldState, pet: Entity, kind: string, times = 1): void {
  for (let i = 0; i < times; i++) {
    const item = spawn(world, kind, { portable: {} });
    pet.components.inventory!.items.push(item.id);
  }
}

const craft = (petId: string, recipeId = 'campfire') => [
  { actorId: petId, intent: { type: 'craft' as const, recipeId } },
];

describe('craftear', () => {
  it('con todos los ingredientes: los consume y coloca lo construido', () => {
    const { world, pet } = buildCraftWorld();
    give(world, pet, 'log', 2);
    give(world, pet, 'flint');

    const events = stepWorld(world, craft(pet.id));

    const crafted = events.find((e) => e.type === 'item.crafted');
    expect(crafted?.data.itemKind).toBe('campfire');
    expect(crafted?.data.recipeId).toBe('campfire');
    // Los ingredientes se gastaron: el inventario quedó vacío.
    expect(pet.components.inventory!.items).toHaveLength(0);
    expect(allEntities(world).filter((e) => e.kind === 'log')).toHaveLength(0);
    // La fogata existe en el mundo, con los componentes de la receta.
    const campfire = allEntities(world).find((e) => e.kind === 'campfire');
    expect(campfire?.components.heatSource).toEqual({ warmthPerTick: 3, range: 2 });
    expect(campfire?.components.position).toBeDefined();
  });

  it('sin un ingrediente: falla diciendo exactamente qué falta y cuánto', () => {
    const { world, pet } = buildCraftWorld();
    give(world, pet, 'log', 2); // tiene troncos, le falta con qué encenderla

    const events = stepWorld(world, craft(pet.id));

    const failed = events.find((e) => e.type === 'action.resolved');
    expect(failed?.data.success).toBe(false);
    expect(failed?.data.reason).toBe('missing-ingredients');
    expect(failed?.data.missing).toEqual([{ kind: 'flint', need: 1, have: 0 }]);
    // No se gastó nada: un intento fallido no destruye los troncos.
    expect(pet.components.inventory!.items).toHaveLength(2);
    expect(allEntities(world).some((e) => e.kind === 'campfire')).toBe(false);
  });

  it('con cantidad insuficiente: informa cuánto hay y cuánto hace falta', () => {
    const { world, pet } = buildCraftWorld();
    give(world, pet, 'log', 1);
    give(world, pet, 'flint');

    const events = stepWorld(world, craft(pet.id));

    const failed = events.find((e) => e.type === 'action.resolved');
    expect(failed?.data.missing).toEqual([{ kind: 'log', need: 2, have: 1 }]);
  });

  it('una receta que este mundo no admite no se puede craftear', () => {
    const { world, pet } = buildCraftWorld([]);
    give(world, pet, 'log', 2);
    give(world, pet, 'flint');

    const events = stepWorld(world, craft(pet.id));

    const failed = events.find((e) => e.type === 'action.resolved');
    expect(failed?.data.success).toBe(false);
    expect(failed?.data.reason).toBe('unknown-recipe');
  });

  it('consume solo lo que la receta pide, y deja el resto', () => {
    const { world, pet } = buildCraftWorld();
    give(world, pet, 'log', 3); // uno de sobra
    give(world, pet, 'flint');

    stepWorld(world, craft(pet.id));

    const leftovers = pet.components.inventory!.items.map((id) => world.entities[id]!.kind);
    expect(leftovers).toEqual(['log']);
  });

  it('sin lugar donde ponerla, falla sin gastar ingredientes', () => {
    const { world, pet } = buildCraftWorld();
    give(world, pet, 'log', 2);
    give(world, pet, 'flint');
    // Tapiar cada celda alrededor de la mascota (y la suya propia ya la ocupa ella).
    for (const offset of [
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: 1, y: 1 },
    ]) {
      spawn(world, 'wall', { position: { x: 1 + offset.x, y: 2 + offset.y } });
    }

    const events = stepWorld(world, craft(pet.id));

    const failed = events.find((e) => e.type === 'action.resolved');
    expect(failed?.data.reason).toBe('no-space');
    expect(pet.components.inventory!.items).toHaveLength(3);
  });

  it('las recetas viajan en el mundo: dos mundos con la misma semilla craftean igual', () => {
    const a = buildCraftWorld();
    const b = buildCraftWorld();
    give(a.world, a.pet, 'log', 2);
    give(a.world, a.pet, 'flint');
    give(b.world, b.pet, 'log', 2);
    give(b.world, b.pet, 'flint');

    stepWorld(a.world, craft(a.pet.id));
    stepWorld(b.world, craft(b.pet.id));

    expect(a.world.entities).toEqual(b.world.entities);
  });
});

describe('missingIngredients', () => {
  it('no falta nada cuando sobra de todo', () => {
    const have = new Map([
      ['log', 5],
      ['flint', 2],
    ]);
    expect(missingIngredients(CAMPFIRE, have)).toEqual([]);
  });

  it('lista cada faltante con su déficit', () => {
    const have = new Map([['log', 1]]);
    const missing: MissingIngredient[] = [
      { kind: 'log', need: 2, have: 1 },
      { kind: 'flint', need: 1, have: 0 },
    ];
    expect(missingIngredients(CAMPFIRE, have)).toEqual(missing);
  });
});
