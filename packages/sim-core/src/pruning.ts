import type { EntityId, EntityKind } from './components.js';
import { PROTECTED_KINDS } from './recipe-validation.js';
import { recipeProductKinds } from './recipes.js';
import type { WorldState } from './world.js';
import { removeEntity } from './world.js';

/**
 * Poda: quitarle al mundo algo que ya sabe. Es la operación inversa de las
 * cinco puertas de invención (ADR 0027 / 0031 / 0032) y la única que existe:
 * hasta acá el mundo solo sabía agregar, y lo que entraba se quedaba para
 * siempre porque nadie había escrito cómo se saca.
 *
 * El problema de sacar no es sacar — es que **nada de esto vive solo**. Una
 * receta se apoya en el tipo que produce otra, un plano coloca bloques que
 * alguien tiene que saber construir, una interacción habla de un tipo que
 * quizá deje de existir. Borrar de a uno, sin mirar, deja un mundo que se
 * contradice: recetas que piden materia que ya nadie hace, planos que colocan
 * un bloque que no existe.
 *
 * Por eso la poda se hace en dos tiempos y ese es todo el diseño:
 *
 * 1. `planPrune` MIRA y no toca nada. Devuelve el arrastre completo — todo lo
 *    que se cae junto — para que el cuidador lo vea antes de decidir.
 * 2. `applyPrune` ejecuta ese plan, ya mirado.
 *
 * El plan es dato puro y serializable. Se puede mostrar, contar y descartar
 * sin haber tocado el mundo, que es exactamente lo que hace falta para pedir
 * una confirmación honesta: «esto se lleva puestas 3 recetas y 12 objetos del
 * mapa» es una frase que solo se puede decir habiendo calculado el arrastre.
 */

export type PruneRef =
  /** Un tipo de objeto entero: deja de existir en el mundo y en las reglas. */
  | { type: 'kind'; id: EntityKind }
  | { type: 'recipe'; id: string }
  | { type: 'interaction'; id: string }
  | { type: 'blueprint'; id: string }
  | { type: 'decomposition'; id: string };

/**
 * Todo lo que se cae si se poda `root`, ya cerrado transitivamente. Las listas
 * van ordenadas para que dos planes iguales se vean iguales: el cuidador
 * compara lo que le muestran, no un orden de iteración.
 */
export interface PrunePlan {
  root: PruneRef;
  kinds: EntityKind[];
  recipes: string[];
  interactions: string[];
  blueprints: string[];
  decompositions: string[];
  /** Tipos que pierden su dibujo (ADR 0063): siempre los mismos que `kinds`. */
  glyphs: EntityKind[];
  /** Ejemplares que desaparecen del mapa y de las mochilas. */
  entities: EntityId[];
  /**
   * Por qué no se puede podar esto. Presente = el plan no se ejecuta. Un plan
   * bloqueado igual se devuelve (con las listas vacías) en vez de tirar: la UI
   * necesita el motivo para decirlo, no un error que atajar.
   */
  blocked?: string;
}

function emptyPlan(root: PruneRef, blocked?: string): PrunePlan {
  return {
    root,
    kinds: [],
    recipes: [],
    interactions: [],
    blueprints: [],
    decompositions: [],
    glyphs: [],
    entities: [],
    ...(blocked !== undefined ? { blocked } : {}),
  };
}

/**
 * Qué se lleva puesto podar `root`, sin tocar el mundo.
 *
 * **El único que arrastra es el tipo.** Podar una receta, una interacción, un
 * plano o una descomposición se lleva solo eso: son reglas hoja, nadie se
 * apoya en ellas. Quitar la receta de la tabla no borra las tablas que ya
 * están hechas — deja de saber hacer más, que es lo que se pidió.
 *
 * Podar un TIPO es otra cosa: el tipo es de lo que hablan todas las demás
 * reglas, así que su caída se propaga a todo lo que lo nombra —
 *
 * - las recetas que lo producen (ya no hay qué producir) y las que lo piden de
 *   ingrediente (ya no hay con qué);
 * - las interacciones que lo apuntan, que exigen llevarlo o que lo producen;
 * - los planos que colocan uno de esos bloques;
 * - las descomposiciones de ese tipo y las que lo dejaban al romperse;
 * - su dibujo y todos sus ejemplares vivos.
 *
 * Lo que NO se propaga, a propósito: el producto de una receta que cayó
 * sobrevive como tipo. Sus ejemplares siguen en el mundo y siguen sirviendo
 * para lo que servían — lo único que se perdió es saber hacer más. Encadenar
 * hasta ahí vaciaría medio mundo por quitar un ingrediente, que es justo lo
 * que la confirmación tiene que poder prometer que no pasa.
 *
 * Un plano o una descomposición que nombra el tipo caído se va ENTERO, aunque
 * nombre otras cosas además. Recortarle la parte afectada sería editarlo, y
 * editar a espaldas del cuidador es peor que borrar a la vista: un plano al
 * que le falta una pared ya no es el plano que aprobó.
 */
export function planPrune(world: WorldState, root: PruneRef): PrunePlan {
  if (root.type === 'kind') {
    // La materia con la que está hecho el juego no se poda. Sin `pet` no hay
    // a quién cuidar; sin `food` ni `tree` el mundo deja de tener con qué
    // resolver el hambre, que es el problema del que sale todo lo demás.
    if (PROTECTED_KINDS.has(root.id)) {
      return emptyPlan(root, `"${root.id}" es materia del mundo: sin eso no hay partida`);
    }
    return planKindPrune(world, root);
  }

  const exists =
    root.type === 'recipe'
      ? world.recipes.some((r) => r.id === root.id)
      : root.type === 'interaction'
        ? world.interactions.some((i) => i.id === root.id)
        : root.type === 'blueprint'
          ? world.blueprints.some((b) => b.id === root.id)
          : world.decompositions.some((d) => d.id === root.id);
  if (!exists) return emptyPlan(root, `este mundo no conoce "${root.id}"`);

  const plan = emptyPlan(root);
  if (root.type === 'recipe') plan.recipes = [root.id];
  else if (root.type === 'interaction') plan.interactions = [root.id];
  else if (root.type === 'blueprint') plan.blueprints = [root.id];
  else plan.decompositions = [root.id];
  return plan;
}

function planKindPrune(world: WorldState, root: { type: 'kind'; id: EntityKind }): PrunePlan {
  const kind = root.id;

  const recipes = world.recipes
    .filter(
      (recipe) =>
        recipeProductKinds(recipe).includes(kind) ||
        recipe.ingredients.some((ingredient) => ingredient.kind === kind),
    )
    .map((recipe) => recipe.id);

  const interactions = world.interactions
    .filter(
      (interaction) =>
        interaction.target.kind === kind ||
        interaction.requires?.heldKind === kind ||
        interaction.effects.some((effect) => effect.kind === kind),
    )
    .map((interaction) => interaction.id);

  const blueprints = world.blueprints
    .filter((blueprint) => blueprint.placements.some((placement) => placement.kind === kind))
    .map((blueprint) => blueprint.id);

  const decompositions = world.decompositions
    .filter(
      (decomposition) =>
        decomposition.targetKind === kind ||
        decomposition.drops.some((drop) => drop.kind === kind),
    )
    .map((decomposition) => decomposition.id);

  const entities = Object.values(world.entities)
    .filter((entity) => entity.kind === kind)
    .map((entity) => entity.id);

  return {
    root,
    kinds: [kind],
    recipes: recipes.sort(),
    interactions: interactions.sort(),
    blueprints: blueprints.sort(),
    decompositions: decompositions.sort(),
    glyphs: world.glyphs[kind] ? [kind] : [],
    entities: entities.sort(),
  };
}

/** Cuántas cosas se lleva un plan. 0 = no hay nada que podar. */
export function prunePlanSize(plan: PrunePlan): number {
  return (
    plan.kinds.length +
    plan.recipes.length +
    plan.interactions.length +
    plan.blueprints.length +
    plan.decompositions.length +
    plan.entities.length
  );
}

/**
 * Ejecuta un plan ya mirado. No lo recalcula: aplica exactamente lo que se le
 * mostró al cuidador. Si el mundo cambió entre el plan y la confirmación, lo
 * que sobrevivió se queda — mejor podar de menos que podar algo que nadie vio
 * en la lista.
 *
 * Los ejemplares se sacan también de las mochilas: `inventory.items` guarda
 * ids, y un id que ya no resuelve a nada es un objeto fantasma que la mascota
 * cree llevar. Es la única referencia entre entidades que existe, así que es
 * la única que hay que barrer.
 */
export function applyPrune(world: WorldState, plan: PrunePlan): void {
  if (plan.blocked !== undefined) return;

  const doomed = new Set(plan.entities);
  for (const id of plan.entities) removeEntity(world, id);
  if (doomed.size > 0) {
    for (const entity of Object.values(world.entities)) {
      const inventory = entity.components.inventory;
      if (!inventory) continue;
      const kept = inventory.items.filter((item) => !doomed.has(item));
      if (kept.length !== inventory.items.length) inventory.items = kept;
    }
  }

  const gone = {
    recipes: new Set(plan.recipes),
    interactions: new Set(plan.interactions),
    blueprints: new Set(plan.blueprints),
    decompositions: new Set(plan.decompositions),
  };
  world.recipes = world.recipes.filter((r) => !gone.recipes.has(r.id));
  world.interactions = world.interactions.filter((i) => !gone.interactions.has(i.id));
  world.blueprints = world.blueprints.filter((b) => !gone.blueprints.has(b.id));
  world.decompositions = world.decompositions.filter((d) => !gone.decompositions.has(d.id));
  for (const kind of plan.glyphs) delete world.glyphs[kind];
}
