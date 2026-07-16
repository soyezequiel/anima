import type { Components, EntityKind } from './components.js';

/**
 * Receta: una regla del mundo, no una idea del agente. Declara qué consume y
 * qué arquetipo produce. Es dato puro y vive en el WorldState, así que viaja
 * en los snapshots: un mundo restaurado craftea exactamente igual.
 */
export interface RecipeIngredient {
  kind: EntityKind;
  count: number;
}

export interface Recipe {
  id: string;
  /** Lo que aparece al craftear. Arquetipo completo, como los `drops`. */
  output: { kind: EntityKind; components: Components };
  ingredients: RecipeIngredient[];
}

/** Un ingrediente que falta, con cuánto hace falta y cuánto hay. */
export interface MissingIngredient {
  kind: EntityKind;
  need: number;
  have: number;
}

export function findRecipe(recipes: Recipe[], id: string): Recipe | undefined {
  return recipes.find((r) => r.id === id);
}

/**
 * Qué le falta a un inventario para una receta. Fuente de verdad única: el
 * mundo la usa para decidir y el agente para explicar, así que la mascota
 * nunca puede decir "me falta X" y que el mundo opine distinto.
 */
export function missingIngredients(
  recipe: Recipe,
  haveByKind: ReadonlyMap<EntityKind, number>,
): MissingIngredient[] {
  const missing: MissingIngredient[] = [];
  for (const ingredient of recipe.ingredients) {
    const have = haveByKind.get(ingredient.kind) ?? 0;
    if (have < ingredient.count) {
      missing.push({ kind: ingredient.kind, need: ingredient.count, have });
    }
  }
  return missing;
}
