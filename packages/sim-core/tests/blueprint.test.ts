import { describe, expect, it } from 'vitest';
import {
  deserializeSnapshot,
  serializeSnapshot,
  takeSnapshot,
  restoreSnapshot,
  stepWorld,
  validateBlueprint,
} from '../src/index.js';
import type { Blueprint, Recipe } from '../src/index.js';
import { buildTestWorld } from './helpers.js';

/**
 * Un plano es una obra, no un objeto (ADR 0032). La puerta que lo juzga es
 * hermana de `validateRecipe`: no dice si la casa es linda, dice si es una obra
 * posible.
 */

/** La receta de la pared, para que el plano tenga de dónde sacar sus bloques. */
const paredRecipe: Recipe = {
  id: 'pared',
  outcomes: [
    {
      weight: 1,
      output: { kind: 'pared', components: { portable: {}, collider: { solid: true } } },
    },
  ],
  ingredients: [{ kind: 'log', count: 1 }],
};

const validCasa = {
  id: 'casa',
  placements: [
    { kind: 'pared', offset: { x: 0, y: -1 } },
    { kind: 'pared', offset: { x: -1, y: 0 } },
    { kind: 'pared', offset: { x: 1, y: 0 } },
  ],
};

const materia = new Set(['log']);

const rejectBp = (
  raw: unknown,
  existing: Blueprint[] = [],
  recipes: Recipe[] = [paredRecipe],
): string => {
  const result = validateBlueprint(raw, existing, recipes, materia);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.error;
};

describe('validateBlueprint: una obra posible', () => {
  it('acepta un plano cuyos bloques sabe fabricar', () => {
    const result = validateBlueprint(validCasa, [], [paredRecipe], materia);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.placements).toHaveLength(3);
  });

  it('rechaza un bloque que no existe ni se sabe hacer: plano muerto', () => {
    expect(
      rejectBp(
        { id: 'casa', placements: [{ kind: 'cristal', offset: { x: 1, y: 0 } }] },
        [],
        [],
      ),
    ).toContain('no sé de dónde sacar "cristal"');
  });

  it('rechaza colocar lo que no se puede levantar', () => {
    const pesada: Recipe = {
      id: 'pared-pesada',
      outcomes: [{ weight: 1, output: { kind: 'pared', components: { collider: { solid: true } } } }],
      ingredients: [{ kind: 'log', count: 1 }],
    };
    expect(rejectBp(validCasa, [], [pesada])).toContain('no puedo levantarlo');
  });

  it('rechaza un bloque encima de sí misma: quedaría fuera del mundo', () => {
    expect(
      rejectBp({ id: 'casa', placements: [{ kind: 'pared', offset: { x: 0, y: 0 } }] }),
    ).toContain('su propio lugar');
  });

  it('rechaza dos bloques en la misma celda', () => {
    expect(
      rejectBp({
        id: 'casa',
        placements: [
          { kind: 'pared', offset: { x: 1, y: 0 } },
          { kind: 'pared', offset: { x: 1, y: 0 } },
        ],
      }),
    ).toContain('misma celda');
  });

  it('rechaza colocar un tipo protegido', () => {
    expect(
      rejectBp({ id: 'trampa', placements: [{ kind: 'food', offset: { x: 1, y: 0 } }] }),
    ).toContain('no se puede colocar "food"');
  });

  it('rechaza un offset fuera del alcance del brazo (el esquema acota a ±1)', () => {
    expect(
      rejectBp({ id: 'casa', placements: [{ kind: 'pared', offset: { x: 2, y: 0 } }] }),
    ).toContain('Plano inválido');
  });

  it('no pisa un plano existente', () => {
    const casa: Blueprint = { id: 'casa', placements: validCasa.placements };
    expect(rejectBp(validCasa, [casa])).toContain('ya existe');
  });

  it('acepta una obra más grande de lo que la mascota puede cargar (se levanta en tandas)', () => {
    // Desde el ADR 0034 las manos ya no son el techo: una casa de 7 paredes con
    // capacidad 6 se construye por tandas volviendo al ancla, así que la puerta
    // la deja pasar. El único límite de tamaño es el footprint (3×3 → 8 bloques).
    const grande = {
      id: 'casa',
      placements: [
        { kind: 'pared', offset: { x: -1, y: -1 } },
        { kind: 'pared', offset: { x: 0, y: -1 } },
        { kind: 'pared', offset: { x: 1, y: -1 } },
        { kind: 'pared', offset: { x: -1, y: 0 } },
        { kind: 'pared', offset: { x: 1, y: 0 } },
        { kind: 'pared', offset: { x: -1, y: 1 } },
        { kind: 'pared', offset: { x: 0, y: 1 } },
      ],
    };
    expect(validateBlueprint(grande, [], [paredRecipe], materia).ok).toBe(true);
  });
});

describe('el mundo es quien decide un plano', () => {
  it('un plano válido propuesto entra al mundo y viaja en el snapshot', () => {
    const { world, pet } = buildTestWorld();
    world.recipes.push(paredRecipe);
    // Un tronco suelto para que "pared" sea materia conseguible del mundo.
    world.entities['log1'] = { id: 'log1', kind: 'log', components: { position: { x: 3, y: 3 }, portable: {} } };

    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeBlueprint', blueprint: validCasa } },
    ]);
    expect(events.find((e) => e.type === 'blueprint.learned')?.data.blueprintId).toBe('casa');
    expect(world.blueprints.map((b) => b.id)).toEqual(['casa']);

    // Un mundo restaurado conoce la misma obra.
    const restored = restoreSnapshot(deserializeSnapshot(serializeSnapshot(takeSnapshot(world))));
    expect(restored.blueprints.map((b) => b.id)).toEqual(['casa']);
  });

  it('el mundo acepta una obra más grande que los brazos: se levanta en tandas (ADR 0034)', () => {
    const { world, pet } = buildTestWorld(); // capacity 4
    world.recipes.push(paredRecipe);
    world.entities['log1'] = { id: 'log1', kind: 'log', components: { position: { x: 3, y: 3 }, portable: {} } };
    const cinco = {
      id: 'casa',
      placements: [
        { kind: 'pared', offset: { x: -1, y: -1 } },
        { kind: 'pared', offset: { x: 0, y: -1 } },
        { kind: 'pared', offset: { x: 1, y: -1 } },
        { kind: 'pared', offset: { x: -1, y: 0 } },
        { kind: 'pared', offset: { x: 1, y: 0 } },
      ],
    };
    const events = stepWorld(world, [
      { actorId: pet.id, intent: { type: 'proposeBlueprint', blueprint: cinco } },
    ]);
    // Cinco bloques con capacidad 4 ya NO es un rechazo: las manos dejaron de ser
    // el techo. El plano entra al mundo.
    expect(events.some((e) => e.type === 'blueprint.rejected')).toBe(false);
    expect(world.blueprints.map((b) => b.id)).toContain('casa');
  });

  it('un plano imposible NO entra, y el rechazo dice por qué', () => {
    const { world, pet } = buildTestWorld();
    const events = stepWorld(world, [
      {
        actorId: pet.id,
        intent: {
          type: 'proposeBlueprint',
          blueprint: { id: 'casa', placements: [{ kind: 'cristal', offset: { x: 1, y: 0 } }] },
        },
      },
    ]);
    expect(events.some((e) => e.type === 'blueprint.rejected')).toBe(true);
    expect(world.blueprints).toHaveLength(0);
  });
});
