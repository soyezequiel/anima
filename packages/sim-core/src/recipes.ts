import type { RngState } from '@anima/shared';
import { nextFloat } from '@anima/shared';
import type { Components, EntityKind } from './components.js';

/**
 * Receta: una regla del mundo, no una idea del agente. Declara qué consume y
 * qué desenlaces admite. Es dato puro y vive en el WorldState, así que viaja
 * en los snapshots: un mundo restaurado craftea exactamente igual.
 */
export interface RecipeIngredient {
  kind: EntityKind;
  count: number;
}

/**
 * Un desenlace posible de una receta. Construir no es aplicar una fórmula: es
 * intentar algo, y el intento puede salir mejor, peor, o directamente no salir.
 *
 * La receta declara todos los desenlaces que el mundo admite y cuánto pesa
 * cada uno; cuál toca lo decide el mundo con SU generador (`world.rng`), nunca
 * `Math.random()`. Por eso dos crafteos seguidos de la misma receta pueden dar
 * cosas distintas y la misma semilla los repite igual: el mundo dejó de ser un
 * guion sin dejar de ser reproducible.
 */
export interface RecipeOutcome {
  /** Peso relativo dentro de la receta. La probabilidad es weight / Σ pesos. */
  weight: number;
  /**
   * El arquetipo que aparece, completo, como los `drops`. Ausente: el intento
   * no produce nada — la receta salió mal.
   */
  output?: { kind: EntityKind; components: Components };
  /**
   * Qué tan bueno sale: un factor muestreado en [min, max] que escala los
   * componentes graduables del producto. Ausente equivale a 1 — sale
   * exactamente como lo declara el arquetipo.
   */
  quality?: { min: number; max: number };
  /**
   * Lo que este desenlace NO gasta, aunque la receta lo pida. El fuego que no
   * prende quema el tronco pero deja el pedernal: un fallo que se lleva todo
   * no se puede reintentar, y entonces no es un fallo sino un castigo.
   */
  spares?: RecipeIngredient[];
}

export interface Recipe {
  id: string;
  /**
   * Los desenlaces que la receta admite. Nunca vacío. Uno solo, con peso 1 y
   * sin `quality`, es una receta determinista: la forma vieja del mundo sigue
   * siendo expresable, ahora como el caso particular que era.
   */
  outcomes: RecipeOutcome[];
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

/**
 * Lo que la receta produce cuando sale como se espera: el desenlace que más
 * pesa de los que producen algo. Es lo que la mascota nombra al hablar de ella
 * ("voy a construir una fogata") — una intención, no una promesa: el mundo
 * puede darle cualquiera de los otros.
 */
export function recipeProduct(
  recipe: Recipe,
): { kind: EntityKind; components: Components } | undefined {
  let best: RecipeOutcome | undefined;
  for (const outcome of recipe.outcomes) {
    if (!outcome.output) continue;
    if (!best || outcome.weight > best.weight) best = outcome;
  }
  return best?.output;
}

/** Todo lo que la receta puede llegar a producir, sin repetir. */
export function recipeProductKinds(recipe: Recipe): EntityKind[] {
  return [...new Set(recipe.outcomes.flatMap((o) => (o.output ? [o.output.kind] : [])))];
}

/** true si algún desenlace produce algo con este componente. */
export function recipeProduces(recipe: Recipe, component: keyof Components): boolean {
  return recipe.outcomes.some((o) => o.output?.components[component] !== undefined);
}

/**
 * Cuántas capas admite un árbol de crafteo. Una casa hecha de paredes hechas
 * de tablas hechas de troncos son tres: cuatro es margen, y el tope existe
 * para que un árbol enfermo (un ciclo, una idea de veinte pisos) se corte con
 * un motivo en vez de colgar al que lo recorra.
 */
export const MAX_RECIPE_DEPTH = 4;

/**
 * Qué receta hace este tipo de objeto, mirando su producto esperado (el
 * desenlace que más pesa): lo que la mascota INTENTA construir es lo que
 * cuenta al planificar, no lo que puede llegar a salirle mal.
 *
 * La puerta garantiza un solo productor por tipo (ADR 0031), así que "la"
 * receta que hace una tabla es una sola y el árbol tiene una única lectura.
 */
export function recipeProducing(
  recipes: readonly Recipe[],
  kind: EntityKind,
): Recipe | undefined {
  return recipes.find((recipe) => recipeProduct(recipe)?.kind === kind);
}

/** Lo que cuesta una receta cuando se la sigue hasta abajo (ADR 0031). */
export interface RecipeCost {
  /** Materia base: lo que hay que juntar del mundo, ya sumado por tipo. */
  base: Map<EntityKind, number>;
  /**
   * Cuántas veces hay que ejecutar cada receta, de las hojas al tronco: el
   * orden en que hay que construir. La última es la que se pidió.
   */
  steps: Array<{ recipeId: string; times: number }>;
  /** El árbol no toca el suelo: tiene un ciclo o demasiadas capas. */
  truncated: boolean;
}

/**
 * Sigue una receta hasta la materia base y suma. Es el corazón del ADR 0031:
 * **el costo de lo complejo no se declara, se deriva**. Nadie escribe lo que
 * cuesta una casa — cuesta lo que cuestan sus paredes, que cuestan lo que
 * cuestan sus tablas. Una idea barata no puede serlo por decreto.
 *
 * Fuente de verdad única, como `missingIngredients`: el mundo la usa para
 * decidir si una idea toca el suelo y la mascota para explicar qué le falta,
 * así que nunca puede decir "necesito 16 troncos" y que el mundo opine otra
 * cosa.
 *
 * Un ingrediente que ninguna receta produce es materia base y ahí termina la
 * rama: el árbol se apoya en lo que el mundo tiene, no en lo que se imagina.
 */
export function expandRecipeCost(
  recipe: Recipe,
  recipes: readonly Recipe[],
  options: { times?: number } = {},
): RecipeCost {
  const base = new Map<EntityKind, number>();
  const steps: Array<{ recipeId: string; times: number }> = [];
  let truncated = false;

  const addStep = (recipeId: string, times: number): void => {
    const found = steps.find((step) => step.recipeId === recipeId);
    if (found) found.times += times;
    else steps.push({ recipeId, times });
  };

  const walk = (current: Recipe, times: number, path: string[]): void => {
    // Un ciclo (la tabla se hace del tronco y el tronco de la tabla) no tiene
    // materia base abajo: no hay nada que sumar, solo que dejar de girar.
    if (path.includes(current.id) || path.length >= MAX_RECIPE_DEPTH) {
      truncated = true;
      return;
    }
    for (const ingredient of current.ingredients) {
      const need = ingredient.count * times;
      const sub = recipeProducing(recipes, ingredient.kind);
      if (!sub) {
        base.set(ingredient.kind, (base.get(ingredient.kind) ?? 0) + need);
        continue;
      }
      walk(sub, need, [...path, current.id]);
    }
    // Después de sus partes: las hojas primero, que es el orden en que hay que
    // construirlas.
    addStep(current.id, times);
  };

  walk(recipe, options.times ?? 1, []);
  return { base, steps, truncated };
}

/**
 * Tira el dado del mundo y devuelve el desenlace que tocó. Muta `rng`: la
 * secuencia avanza, así que el segundo intento no repite al primero.
 */
export function rollOutcome(recipe: Recipe, rng: RngState): RecipeOutcome | undefined {
  const weights = recipe.outcomes.map((o) => Math.max(0, o.weight));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return undefined;
  let roll = nextFloat(rng) * total;
  for (const [index, outcome] of recipe.outcomes.entries()) {
    roll -= weights[index]!;
    if (roll < 0) return outcome;
  }
  // Solo alcanzable por error de redondeo con `roll` pegado al total.
  return recipe.outcomes[recipe.outcomes.length - 1];
}

/** Dos decimales: el mundo no necesita más y el snapshot queda legible. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Muestrea qué tan bueno salió. Muta `rng` solo si el desenlace gradúa.
 *
 * Redondea al centésimo para que el número que viaja al evento, al snapshot y
 * a los componentes del producto sea el mismo y se pueda leer. Cien escalones
 * de calidad son más de los que el mundo puede distinguir.
 */
export function rollQuality(outcome: RecipeOutcome, rng: RngState): number {
  if (!outcome.quality) return 1;
  const { min, max } = outcome.quality;
  if (max <= min) return round2(min);
  return round2(min + nextFloat(rng) * (max - min));
}

/**
 * Escala los componentes graduables del producto por la calidad de la tirada.
 *
 * Gradúa solo los que miden QUÉ TAN BUENO es un objeto sin cambiar QUÉ ES, y
 * lo que queda afuera importa tanto como lo que entra:
 *
 * - `collider`/`portable` son marcas: no existe el medio sólido.
 * - `hazard` queda afuera a propósito — escalarlo haría que "mejor" quisiera
 *   decir "más peligroso", y la calidad de una fogata no es cuánto quema.
 * - `heatSource.range` es la forma del objeto, no su calidad: un fuego tibio
 *   sigue alcanzando igual de lejos, solo calienta menos.
 * - `drops` son materia, y la materia no la decide la suerte (ADR 0008).
 */
export function scaleByQuality(components: Components, factor: number): Components {
  const scaled = structuredClone(components);
  if (scaled.durability) {
    // Lo recién construido nace entero: la calidad decide cuánto aguanta, no
    // cuán usado viene.
    const max = Math.max(1, Math.round(scaled.durability.max * factor));
    scaled.durability = { current: max, max };
  }
  if (scaled.heatSource) {
    scaled.heatSource = {
      ...scaled.heatSource,
      warmthPerTick: round2(scaled.heatSource.warmthPerTick * factor),
    };
  }
  if (scaled.tool) {
    scaled.tool = { ...scaled.tool, power: round2(scaled.tool.power * factor) };
  }
  if (scaled.hardness) {
    scaled.hardness = { ...scaled.hardness, value: round2(scaled.hardness.value * factor) };
  }
  return scaled;
}

/** La forma que tenían las recetas antes de los desenlaces: un `output` fijo. */
interface StoredRecipe {
  id: string;
  outcomes?: RecipeOutcome[];
  output?: { kind: EntityKind; components: Components };
  ingredients: RecipeIngredient[];
}

/**
 * Normaliza una receta que puede venir de antes de los desenlaces. Un mundo
 * guardado con `output` único se lee como una receta de un solo desenlace, que
 * es exactamente lo que era: sin esto, un legado viejo dejaría de craftear.
 */
export function normalizeRecipe(stored: StoredRecipe): Recipe {
  if (stored.outcomes && stored.outcomes.length > 0) {
    return { id: stored.id, outcomes: stored.outcomes, ingredients: stored.ingredients };
  }
  return {
    id: stored.id,
    outcomes: stored.output ? [{ weight: 1, output: stored.output }] : [],
    ingredients: stored.ingredients,
  };
}
