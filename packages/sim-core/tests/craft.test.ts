import { describe, expect, it } from 'vitest';
import type { Entity, MissingIngredient, Recipe, WorldState } from '../src/index.js';
import {
  allEntities,
  createWorld,
  missingIngredients,
  removeEntity,
  restoreSnapshot,
  spawn,
  stepWorld,
  takeSnapshot,
} from '../src/index.js';

/**
 * Una receta de un solo desenlace: determinista a propósito, para que estas
 * pruebas midan la mecánica (qué se gasta, qué falta, dónde cae) sin que la
 * tirada les meta ruido. Lo no determinista se prueba aparte, abajo.
 */
const CAMPFIRE: Recipe = {
  id: 'campfire',
  outcomes: [
    {
      weight: 1,
      output: {
        kind: 'campfire',
        components: { heatSource: { warmthPerTick: 3, range: 2 }, hazard: { damagePerTick: 1 } },
      },
    },
  ],
  ingredients: [
    { kind: 'log', count: 2 },
    { kind: 'flint', count: 1 },
  ],
};

interface CraftWorld {
  world: WorldState;
  pet: Entity;
}

function buildCraftWorld(recipes: Recipe[] = [CAMPFIRE], seed = 1): CraftWorld {
  const world = createWorld({ width: 7, height: 5, seed }, { recipes });
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

/**
 * Un fuego con suerte: tres de cada cuatro veces prende, y cuando prende sale
 * entre la mitad y una vez y media de lo declarado. El intento fallido perdona
 * el pedernal.
 */
const CHANCY_FIRE: Recipe = {
  id: 'campfire',
  outcomes: [
    {
      weight: 3,
      output: {
        kind: 'campfire',
        components: { heatSource: { warmthPerTick: 0.3, range: 2 }, hazard: { damagePerTick: 1 } },
      },
      quality: { min: 0.5, max: 1.5 },
    },
    { weight: 1, spares: [{ kind: 'flint', count: 1 }] },
  ],
  ingredients: [
    { kind: 'log', count: 2 },
    { kind: 'flint', count: 1 },
  ],
};

/**
 * Craftea `times` veces seguidas con la mano siempre llena, y devuelve qué
 * salió de cada intento. Despeja lo construido entre intento e intento porque
 * el mundo de prueba es chico y si no se llena de fogatas.
 */
function craftRun(world: WorldState, pet: Entity, times: number): string[] {
  const results: string[] = [];
  for (let i = 0; i < times; i++) {
    give(world, pet, 'log', 2);
    give(world, pet, 'flint');
    const events = stepWorld(world, craft(pet.id));
    const crafted = events.find((e) => e.type === 'item.crafted');
    results.push(crafted ? `ok:${String(crafted.data.quality)}` : 'fallo');
    for (const item of allEntities(world)) {
      if (item.kind === 'campfire' || item.kind === 'flint') removeEntity(world, item.id);
    }
    pet.components.inventory!.items = [];
  }
  return results;
}

describe('craftear no es aplicar una fórmula', () => {
  it('la misma receta con lo mismo en la mano no siempre da lo mismo', () => {
    const { world, pet } = buildCraftWorld([CHANCY_FIRE]);

    const results = craftRun(world, pet, 40);

    // Salió de todo: fogatas y humo.
    expect(results.some((r) => r === 'fallo')).toBe(true);
    expect(results.some((r) => r.startsWith('ok:'))).toBe(true);
    // Y ni siquiera las que salieron salieron iguales.
    expect(new Set(results.filter((r) => r.startsWith('ok:'))).size).toBeGreaterThan(1);
  });

  it('la misma semilla repite la corrida clavada: el mundo varía, no es aleatorio', () => {
    const a = buildCraftWorld([CHANCY_FIRE], 7);
    const b = buildCraftWorld([CHANCY_FIRE], 7);

    expect(craftRun(a.world, a.pet, 20)).toEqual(craftRun(b.world, b.pet, 20));
  });

  it('semillas distintas cuentan historias distintas', () => {
    const a = buildCraftWorld([CHANCY_FIRE], 7);
    const b = buildCraftWorld([CHANCY_FIRE], 8);

    expect(craftRun(a.world, a.pet, 20)).not.toEqual(craftRun(b.world, b.pet, 20));
  });

  it('el estado del dado viaja en el snapshot: restaurar no reabre la suerte', () => {
    const original = buildCraftWorld([CHANCY_FIRE], 3);
    // Gastar unas tiradas primero: si el dado no viajara, el restaurado
    // empezaría de cero y la secuencia se bifurcaría acá.
    craftRun(original.world, original.pet, 5);

    const restored = restoreSnapshot(takeSnapshot(original.world));
    const restoredPet = restored.entities[original.pet.id]!;

    expect(craftRun(restored, restoredPet, 10)).toEqual(
      craftRun(original.world, original.pet, 10),
    );
  });

  it('el desenlace fallido gasta la madera, perdona el pedernal y no deja nada', () => {
    // Una receta que solo puede fallar: sin tirada que valga, el fallo es el
    // único desenlace y la prueba no depende de la suerte.
    const dud: Recipe = {
      id: 'campfire',
      outcomes: [{ weight: 1, spares: [{ kind: 'flint', count: 1 }] }],
      ingredients: [
        { kind: 'log', count: 2 },
        { kind: 'flint', count: 1 },
      ],
    };
    const { world, pet } = buildCraftWorld([dud]);
    give(world, pet, 'log', 2);
    give(world, pet, 'flint');

    const events = stepWorld(world, craft(pet.id));

    const resolved = events.find((e) => e.type === 'action.resolved');
    expect(resolved?.data.success).toBe(false);
    expect(resolved?.data.reason).toBe('attempt-failed');
    expect(events.some((e) => e.type === 'craft.failed')).toBe(true);
    expect(allEntities(world).some((e) => e.kind === 'campfire')).toBe(false);
    // La madera se echó a perder; la piedra sigue en la mano, así que puede
    // volver a intentarlo apenas consiga troncos.
    const held = pet.components.inventory!.items.map((id) => world.entities[id]!.kind);
    expect(held).toEqual(['flint']);
  });

  it('sin lugar donde ponerla no llega a tirar el dado', () => {
    const { world, pet } = buildCraftWorld([CHANCY_FIRE]);
    give(world, pet, 'log', 2);
    give(world, pet, 'flint');
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
    const before = world.rng.state;

    const events = stepWorld(world, craft(pet.id));

    expect(events.find((e) => e.type === 'action.resolved')?.data.reason).toBe('no-space');
    // El dado quedó donde estaba: un intento que no ocurrió no gasta suerte.
    expect(world.rng.state).toBe(before);
    expect(pet.components.inventory!.items).toHaveLength(3);
  });
});

describe('la calidad gradúa qué tan bueno sale, no qué es', () => {
  const flimsy: Recipe = {
    id: 'chair',
    outcomes: [
      {
        weight: 1,
        // min === max: la tirada de calidad es exacta y la prueba mide el
        // escalado, no la suerte.
        quality: { min: 0.5, max: 0.5 },
        output: {
          kind: 'chair',
          components: {
            collider: { solid: true },
            hardness: { value: 3 },
            durability: { current: 8, max: 8 },
            heatSource: { warmthPerTick: 0.3, range: 2 },
            hazard: { damagePerTick: 1 },
            drops: [{ kind: 'log', components: { portable: {} } }],
          },
        },
      },
    ],
    ingredients: [{ kind: 'log', count: 2 }],
  };

  it('escala lo graduable y deja intacto lo que no es cuestión de calidad', () => {
    const { world, pet } = buildCraftWorld([flimsy]);
    give(world, pet, 'log', 2);

    stepWorld(world, craft(pet.id, 'chair'));

    const chair = allEntities(world).find((e) => e.kind === 'chair')!;
    // Gradúa: aguanta la mitad, es la mitad de dura, calienta la mitad.
    expect(chair.components.durability).toEqual({ current: 4, max: 4 });
    expect(chair.components.hardness).toEqual({ value: 1.5 });
    expect(chair.components.heatSource?.warmthPerTick).toBe(0.15);
    // No gradúa: el alcance es la forma del objeto, el daño no mejora al
    // empeorar, y la materia que deja no la decide la suerte (ADR 0008).
    expect(chair.components.heatSource?.range).toBe(2);
    expect(chair.components.hazard).toEqual({ damagePerTick: 1 });
    expect(chair.components.drops).toEqual([{ kind: 'log', components: { portable: {} } }]);
  });

  it('lo recién construido nace entero: la calidad decide cuánto aguanta, no cuán usado viene', () => {
    const { world, pet } = buildCraftWorld([flimsy]);
    give(world, pet, 'log', 2);

    stepWorld(world, craft(pet.id, 'chair'));

    const durability = allEntities(world).find((e) => e.kind === 'chair')!.components.durability!;
    expect(durability.current).toBe(durability.max);
  });

  it('la receta original no se toca: lo escalado es el producto, no la regla', () => {
    const { world, pet } = buildCraftWorld([flimsy]);
    give(world, pet, 'log', 2);

    stepWorld(world, craft(pet.id, 'chair'));

    expect(world.recipes[0]!.outcomes[0]!.output!.components.durability).toEqual({
      current: 8,
      max: 8,
    });
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
