import { describe, expect, it } from 'vitest';
import { MAX_INVENTED_RECIPES, spawn, stepWorld, validateRecipe } from '../src/index.js';
import type { Recipe } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

/**
 * Inventar recetas es el poder más peligroso que se le puede dar a la mascota:
 * si pudiera declarar cualquier física, resolvería cualquier problema
 * declarándolo resuelto. Estas pruebas son intentos de romper el mundo.
 */

const validChair: Recipe = {
  id: 'chair',
  output: {
    kind: 'chair',
    components: {
      collider: { solid: true },
      hardness: { value: 2 },
      durability: { current: 6, max: 6 },
      drops: [{ kind: 'log', components: { portable: {} } }],
    },
  },
  ingredients: [{ kind: 'log', count: 2 }],
};

const reject = (recipe: unknown, existing: Recipe[] = []): string => {
  const result = validateRecipe(recipe, existing);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.error;
};

describe('validateRecipe: lo que sí pasa', () => {
  it('una receta coherente se acepta y vuelve tipada', () => {
    const result = validateRecipe(validChair);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.id).toBe('chair');
  });

  it('acepta una fuente de calor: inventar el fuego es legítimo', () => {
    const result = validateRecipe({
      id: 'brasero',
      output: {
        kind: 'brasero',
        components: { heatSource: { warmthPerTick: 0.5, range: 2 }, hazard: { damagePerTick: 1 } },
      },
      ingredients: [{ kind: 'log', count: 2 }],
    });
    expect(result.ok).toBe(true);
  });
});

describe('validateRecipe: no inventa recursos, solo capacidades', () => {
  it('no puede inventar comida', () => {
    expect(
      reject({
        id: 'pastel',
        output: { kind: 'pastel', components: { edible: {}, nutrition: { value: 30 } } },
        ingredients: [{ kind: 'log', count: 1 }],
      }),
    ).toContain('Receta inválida');
  });

  it('no puede inventar una máquina que produzca comida', () => {
    expect(
      reject({
        id: 'huerta',
        output: {
          kind: 'huerta',
          components: { foodSource: { intervalTicks: 1, nutrition: 30, nextSpawnAtTick: 0 } },
        },
        ingredients: [{ kind: 'log', count: 1 }],
      }),
    ).toContain('Receta inválida');
  });

  it('no puede fabricar los tipos protegidos, ni siquiera con otro nombre de receta', () => {
    for (const kind of ['food', 'tree', 'pet']) {
      expect(
        reject({
          id: `hacer-${kind}`,
          output: { kind, components: { portable: {} } },
          ingredients: [{ kind: 'log', count: 1 }],
        }),
      ).toContain('no se puede fabricar');
    }
  });

  it('no puede crear una criatura', () => {
    expect(
      reject({
        id: 'amigo',
        output: { kind: 'amigo', components: { agent: { name: 'x', perceptionRange: 5 } } },
        ingredients: [{ kind: 'log', count: 1 }],
      }),
    ).toContain('Receta inválida');
  });
});

describe('validateRecipe: no crea materia', () => {
  it('algo no puede ser ingrediente de sí mismo', () => {
    expect(
      reject({
        id: 'mas-troncos',
        output: { kind: 'log', components: { portable: {} } },
        ingredients: [{ kind: 'log', count: 1 }],
      }),
    ).toContain('no puede ser ingrediente de sí mismo');
  });

  it('no puede dejar al romperse más de lo que costó', () => {
    expect(
      reject({
        id: 'multiplicador',
        output: {
          kind: 'multiplicador',
          components: {
            durability: { current: 1, max: 1 },
            drops: [
              { kind: 'log', components: { portable: {} } },
              { kind: 'log', components: { portable: {} } },
              { kind: 'log', components: { portable: {} } },
            ],
          },
        },
        ingredients: [{ kind: 'log', count: 1 }],
      }),
    ).toContain('crearía materia');
  });

  it('no puede dejar caer tipos protegidos al romperse', () => {
    expect(
      reject({
        id: 'pinata',
        output: {
          kind: 'pinata',
          components: {
            durability: { current: 1, max: 1 },
            drops: [{ kind: 'food', components: { portable: {} } }],
          },
        },
        ingredients: [{ kind: 'log', count: 1 }],
      }),
    ).toContain('no puede dejar "food"');
  });

  it('sin ingredientes no hay receta: nada sale de la nada', () => {
    expect(
      reject({
        id: 'de-la-nada',
        output: { kind: 'cosa', components: { portable: {} } },
        ingredients: [],
      }),
    ).toContain('Receta inválida');
  });
});

describe('validateRecipe: no inventa poderes que su mundo no tiene', () => {
  it('no puede inventar una herramienta mejor que el martillo', () => {
    expect(
      reject({
        id: 'super-martillo',
        output: { kind: 'super-martillo', components: { tool: { power: 100 }, portable: {} } },
        ingredients: [{ kind: 'log', count: 1 }],
      }),
    ).toContain('Receta inválida');
  });

  it('no puede inventar un peligro desmedido', () => {
    expect(
      reject({
        id: 'trampa',
        output: { kind: 'trampa', components: { hazard: { damagePerTick: 999 } } },
        ingredients: [{ kind: 'log', count: 1 }],
      }),
    ).toContain('Receta inválida');
  });

  it('rechaza componentes que no existen o campos de más', () => {
    expect(
      reject({
        id: 'magia',
        output: { kind: 'magia', components: { volar: { alto: true } } },
        ingredients: [{ kind: 'log', count: 1 }],
      }),
    ).toContain('Receta inválida');
  });
});

describe('validateRecipe: higiene', () => {
  it('lo que no hace nada no es un objeto, es decoración', () => {
    expect(
      reject({
        id: 'adorno',
        output: { kind: 'adorno', components: {} },
        ingredients: [{ kind: 'log', count: 1 }],
      }),
    ).toContain('no haría absolutamente nada');
  });

  it('no puede pisar una receta existente', () => {
    expect(reject(validChair, [validChair])).toContain('ya existe');
  });

  it('inventar no puede ser spam: hay un tope por mundo', () => {
    const many = Array.from({ length: MAX_INVENTED_RECIPES }, (_, i) => ({
      ...validChair,
      id: `receta-${i}`,
    }));
    expect(reject({ ...validChair, id: 'una-mas' }, many)).toContain('no admite más recetas');
  });
});

describe('el mundo es quien decide', () => {
  it('una receta válida propuesta entra al mundo y queda usable', () => {
    const { world, pet } = buildTestWorld();
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeRecipe', recipe: validChair } },
    ]);

    expect(events.find((e) => e.type === 'recipe.learned')?.data.recipeId).toBe('chair');
    expect(world.recipes.map((r) => r.id)).toEqual(['chair']);

    // Y se puede construir de verdad con ella.
    for (let i = 0; i < 2; i++) {
      const log = spawn(world, 'log', { portable: {} });
      pet.components.inventory!.items.push(log.id);
    }
    const crafted = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'craft', recipeId: 'chair' } },
    ]);
    expect(crafted.some((e) => e.type === 'item.crafted')).toBe(true);
  });

  it('una receta inventada NO entra al mundo, y el rechazo dice por qué', () => {
    const { world, pet } = buildTestWorld();
    const events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: {
          type: 'proposeRecipe',
          recipe: {
            id: 'pastel',
            output: { kind: 'pastel', components: { edible: {}, nutrition: { value: 99 } } },
            ingredients: [{ kind: 'log', count: 1 }],
          },
        },
      },
    ]);

    const rejected = events.find((e) => e.type === 'recipe.rejected');
    expect(rejected).toBeDefined();
    expect(String(rejected?.data.reason)).toContain('Receta inválida');
    expect(world.recipes).toEqual([]);
  });

  it('proponer basura no rompe el mundo', () => {
    const { world, pet } = buildTestWorld();
    for (const recipe of [null, 'una silla', 42, {}, { id: 'x' }]) {
      const events = stepWorld(world, [{ actorId: pet.id, intent: { type: 'proposeRecipe', recipe } }]);
      expect(events.some((e) => e.type === 'recipe.rejected')).toBe(true);
    }
    expect(world.recipes).toEqual([]);
  });
});
