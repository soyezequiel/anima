import { describe, expect, it } from 'vitest';
import { expandRecipeCost, recipeProducing, validateRecipe } from '../src/index.js';
import type { Recipe } from '../src/index.js';

/**
 * El árbol de crafteo (ADR 0031): lo complejo se hace de lo simple, y su costo
 * no se declara — se deriva. Estas pruebas cuidan las dos mitades: que la
 * cuenta salga sola, y que la puerta no deje entrar un árbol que no toca el
 * suelo.
 *
 * La corrida real que las motivó: el cuidador pidió una ciudad y la mascota
 * contestó que le faltaban «3 troncos y 4 pedernales». Una ciudad salía lo
 * mismo que una fogata porque nadie había dicho nunca que fuera más.
 */

/** Un objeto simple hecho de materia: la hoja del árbol. */
const tabla: Recipe = {
  id: 'tabla',
  outcomes: [{ weight: 1, output: { kind: 'tabla', components: { portable: {} } } }],
  ingredients: [{ kind: 'log', count: 1 }],
};

/** Hecha de lo anterior: el eslabón del medio. */
const pared: Recipe = {
  id: 'pared',
  outcomes: [
    { weight: 1, output: { kind: 'pared', components: { portable: {}, collider: { solid: true } } } },
  ],
  ingredients: [{ kind: 'tabla', count: 2 }],
};

/** Y lo que se hace de lo del medio: el tronco del árbol. */
const casa: Recipe = {
  id: 'casa',
  outcomes: [
    { weight: 1, output: { kind: 'casa', components: { collider: { solid: true } } } },
  ],
  ingredients: [{ kind: 'pared', count: 4 }],
};

const TREE = [tabla, pared, casa];

describe('el costo se deriva, no se declara', () => {
  it('una casa cuesta lo que cuestan sus paredes: 8 troncos, y nadie lo escribió', () => {
    const cost = expandRecipeCost(casa, TREE);
    expect(cost.truncated).toBe(false);
    // 4 paredes × 2 tablas × 1 tronco. El número no está en ninguna receta:
    // sale de multiplicar la cadena. Una fogata son 2 troncos, y ahora eso
    // significa algo — la casa cuesta cuatro veces más porque tiene partes.
    expect([...cost.base]).toEqual([['log', 8]]);
  });

  it('los pasos salen de las hojas al tronco: el orden en que hay que construir', () => {
    const cost = expandRecipeCost(casa, TREE);
    expect(cost.steps).toEqual([
      { recipeId: 'tabla', times: 8 },
      { recipeId: 'pared', times: 4 },
      { recipeId: 'casa', times: 1 },
    ]);
  });

  it('sin recetas abajo, los ingredientes SON la materia base: la receta de siempre', () => {
    const cost = expandRecipeCost(pared, [pared]);
    expect(cost.base.get('tabla')).toBe(2);
    expect(cost.steps).toEqual([{ recipeId: 'pared', times: 1 }]);
  });

  it('un árbol que se muerde la cola no toca el suelo y se corta', () => {
    const troncoDeTabla: Recipe = {
      id: 'tronco-de-tabla',
      outcomes: [{ weight: 1, output: { kind: 'log', components: { portable: {} } } }],
      ingredients: [{ kind: 'tabla', count: 2 }],
    };
    expect(expandRecipeCost(casa, [...TREE, troncoDeTabla]).truncated).toBe(true);
  });

  it('recipeProducing mira el producto esperado, no el id', () => {
    expect(recipeProducing(TREE, 'pared')?.id).toBe('pared');
    expect(recipeProducing(TREE, 'unicornio')).toBeUndefined();
  });
});

describe('la puerta: un árbol tiene que tocar el suelo', () => {
  const materia = new Set(['log']);

  const reject = (recipe: unknown, existing: Recipe[] = [], obtainable = materia): string => {
    const result = validateRecipe(recipe, existing, obtainable);
    expect(result.ok).toBe(false);
    return result.ok ? '' : result.error;
  };

  it('acepta una receta que se apoya en otra: para eso existe el árbol', () => {
    const result = validateRecipe(
      { id: 'pared', output: pared.outcomes[0]!.output, ingredients: pared.ingredients },
      [tabla],
      materia,
    );
    expect(result.ok).toBe(true);
  });

  it('rechaza lo hecho de algo que nadie hace ni existe: sería una receta muerta', () => {
    // "casa = 4 paredes" en un mundo sin paredes y sin la receta de la pared.
    expect(
      reject({ id: 'casa', output: casa.outcomes[0]!.output, ingredients: casa.ingredients }, [
        tabla,
      ]),
    ).toContain('no sé de dónde sacar "pared"');
  });

  it('rechaza usar de ingrediente lo que no puede levantar', () => {
    const pesada: Recipe = {
      id: 'pared-pesada',
      outcomes: [
        { weight: 1, output: { kind: 'pared', components: { collider: { solid: true } } } },
      ],
      ingredients: [{ kind: 'log', count: 2 }],
    };
    // Sabe hacer paredes, pero no se pueden alzar: los ingredientes salen del
    // inventario, así que la casa es inconstruible por más que la receta exista.
    expect(
      reject(
        { id: 'casa', output: casa.outcomes[0]!.output, ingredients: casa.ingredients },
        [pesada],
      ),
    ).toContain('no puedo levantarlo');
  });

  it('rechaza el ciclo: la tabla del tronco y el tronco de la tabla', () => {
    // Cada ingrediente existe por separado —el tronco es materia del mundo—,
    // así que esto solo se ve mirando el árbol entero.
    expect(
      reject(
        {
          id: 'tronco-de-tabla',
          output: { kind: 'log', components: { portable: {} } },
          ingredients: [{ kind: 'tabla', count: 2 }],
        },
        [tabla],
      ),
    ).toContain('no baja hasta materia que exista');
  });

  it('una cosa se hace de una sola manera: el árbol no puede tener dos lecturas', () => {
    expect(
      reject(
        {
          id: 'otra-tabla',
          output: { kind: 'tabla', components: { portable: {}, hardness: { value: 1 } } },
          ingredients: [{ kind: 'log', count: 2 }],
        },
        [tabla],
      ),
    ).toContain('ya sé hacer "tabla"');
  });
});
