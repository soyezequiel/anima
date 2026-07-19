import type {
  Blueprint,
  Decomposition,
  GlyphRegistry,
  Interaction,
  Recipe,
  WorldState,
} from '@anima/sim-core';
import type { SkillDefinition, SkillLibrary } from '@anima/skill-runtime';
import type { KeyValueStore } from './kv.js';
import { readJson, writeJson } from './kv.js';

/**
 * El catálogo del cuidador (ADR 0076): lo aprendido, guardado FUERA de toda
 * partida.
 *
 * Hasta acá todo lo que el mundo sabía vivía dentro del guardado de una
 * partida: reiniciar con otra semilla empezaba de cero, y lo único que
 * cruzaba de un mundo a otro era el legado de una mascota muerta (ADR 0047).
 * Eso hacía que experimentar costara caro — probar otra semilla significaba
 * tirar todo lo inventado.
 *
 * El catálogo es la biblioteca del cuidador, no la memoria de la mascota. Esa
 * distinción manda sobre las tres decisiones de abajo.
 */

/**
 * Lo aprendido, junto. Es exactamente el conjunto de las cinco puertas de
 * invención más las habilidades: lo mismo que el ADR 0075 permite podar, que
 * no es casualidad — se guarda lo mismo que se puede tirar.
 */
export interface CatalogData {
  recipes: Recipe[];
  interactions: Interaction[];
  blueprints: Blueprint[];
  decompositions: Decomposition[];
  glyphs: GlyphRegistry;
  skills: SkillDefinition[];
}

/**
 * Una clave por tipo, y no una sola con todo.
 *
 * El backend corta en 1 MB por valor, que es el techo que ya aprieta al
 * guardado de partida. Repartirlo en seis deja seis márgenes en vez de uno, y
 * además hace que quitar una receta reescriba solo las recetas: la biblioteca
 * de habilidades no se toca por podar un objeto.
 *
 * Tampoco es una clave POR ELEMENTO (`catalog:recipe:<id>`), que era la otra
 * opción: leer el catálogo entero costaría una petición por receta, y el
 * arranque de la sesión pasaría de una ráfaga de seis a una de cincuenta.
 */
const KEYS = {
  recipes: 'catalog:recipes',
  interactions: 'catalog:interactions',
  blueprints: 'catalog:blueprints',
  decompositions: 'catalog:decompositions',
  glyphs: 'catalog:glyphs',
  skills: 'catalog:skills',
} as const;

export function emptyCatalog(): CatalogData {
  return {
    recipes: [],
    interactions: [],
    blueprints: [],
    decompositions: [],
    glyphs: {},
    skills: [],
  };
}

export function catalogSize(catalog: CatalogData): number {
  return (
    catalog.recipes.length +
    catalog.interactions.length +
    catalog.blueprints.length +
    catalog.decompositions.length +
    Object.keys(catalog.glyphs).length +
    catalog.skills.length
  );
}

/**
 * Lee el catálogo. Una clave ilegible o ausente se lee como vacía y no como
 * error: el catálogo es una comodidad, y una partida tiene que poder arrancar
 * aunque esté roto. Lo que no puede pasar es que un catálogo corrupto impida
 * jugar.
 */
export async function loadCatalog(store: KeyValueStore): Promise<CatalogData> {
  const [recipes, interactions, blueprints, decompositions, glyphs, skills] = await Promise.all([
    readJson<Recipe[]>(store, KEYS.recipes),
    readJson<Interaction[]>(store, KEYS.interactions),
    readJson<Blueprint[]>(store, KEYS.blueprints),
    readJson<Decomposition[]>(store, KEYS.decompositions),
    readJson<GlyphRegistry>(store, KEYS.glyphs),
    readJson<SkillDefinition[]>(store, KEYS.skills),
  ]);
  return {
    recipes: recipes ?? [],
    interactions: interactions ?? [],
    blueprints: blueprints ?? [],
    decompositions: decompositions ?? [],
    glyphs: glyphs ?? {},
    skills: skills ?? [],
  };
}

export async function saveCatalog(store: KeyValueStore, catalog: CatalogData): Promise<void> {
  await Promise.all([
    writeJson(store, KEYS.recipes, catalog.recipes),
    writeJson(store, KEYS.interactions, catalog.interactions),
    writeJson(store, KEYS.blueprints, catalog.blueprints),
    writeJson(store, KEYS.decompositions, catalog.decompositions),
    writeJson(store, KEYS.glyphs, catalog.glyphs),
    writeJson(store, KEYS.skills, catalog.skills),
  ]);
}

export async function clearCatalog(store: KeyValueStore): Promise<void> {
  await Promise.all(Object.values(KEYS).map((key) => store.delete(key)));
}

/** Une por id; lo que llega pisa a lo que estaba. */
function mergeById<T extends { id: string }>(existing: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, structuredClone(item));
  return [...byId.values()];
}

export interface CollectCatalogInput {
  world: WorldState;
  library: SkillLibrary;
  /**
   * Los ids de las recetas que trae el código (`MVP_RECIPES`). Se excluyen: el
   * catálogo guarda lo APRENDIDO, y una receta de fábrica ya la pone el
   * escenario en cada mundo nuevo. Guardarla sería congelar hoy una regla que
   * el juego puede cambiar mañana, y las partidas nuevas seguirían arrastrando
   * la versión vieja sin que nadie lo haya pedido.
   *
   * Llega como parámetro y no importado porque `MVP_RECIPES` vive en
   * `@anima/test-scenarios` y este paquete no lo conoce — la misma razón por
   * la que `buildClaudeReport` recibe `baseRecipeIds`.
   */
  baseRecipeIds: readonly string[];
}

/**
 * Lo que este mundo aportaría al catálogo.
 *
 * **Solo las habilidades estables.** Es el mismo corte que hace el legado
 * (`buildLegacyReport`), y por el mismo motivo: una habilidad que todavía no
 * pasó sus pruebas no es conocimiento, es un intento. Propagar intentos a
 * todos los mundos futuros llenaría el catálogo de ruido que nunca funcionó.
 */
export function collectCatalog(input: CollectCatalogInput): CatalogData {
  const base = new Set(input.baseRecipeIds);
  return {
    recipes: input.world.recipes.filter((recipe) => !base.has(recipe.id)),
    interactions: input.world.interactions,
    blueprints: input.world.blueprints,
    decompositions: input.world.decompositions,
    glyphs: input.world.glyphs,
    skills: input.library.all().filter((skill) => skill.status === 'stable'),
  };
}

/**
 * Suma lo que este mundo aprendió a lo que ya había. Nunca quita: sacar del
 * catálogo es un acto explícito del cuidador (`forgetFromCatalog`), no un
 * efecto de haber jugado en un mundo que no tenía algo.
 *
 * Sin esta regla, abrir una partida vieja —anterior a un invento— y guardar
 * borraría del catálogo lo que otra partida había aportado.
 */
export function mergeCatalog(existing: CatalogData, incoming: CatalogData): CatalogData {
  return {
    recipes: mergeById(existing.recipes, incoming.recipes),
    interactions: mergeById(existing.interactions, incoming.interactions),
    blueprints: mergeById(existing.blueprints, incoming.blueprints),
    decompositions: mergeById(existing.decompositions, incoming.decompositions),
    // El dibujo más nuevo gana: si Ánima volvió a dibujar un tipo, esa es su
    // cara ahora.
    glyphs: { ...existing.glyphs, ...structuredClone(incoming.glyphs) },
    // Las habilidades se unen por NOMBRE y no por id: dos mundos que aprenden
    // "abrigarse" por su cuenta producen ids distintos para la misma conducta,
    // y guardar las dos dejaría al mundo siguiente adoptando duplicados que
    // compiten entre sí. Gana la de mejor tasa medida, y a igualdad la versión
    // más alta — el mismo criterio que `findProvisional` usa para elegir.
    skills: mergeSkillsByName(existing.skills, incoming.skills),
  };
}

function mergeSkillsByName(
  existing: readonly SkillDefinition[],
  incoming: readonly SkillDefinition[],
): SkillDefinition[] {
  const best = new Map<string, SkillDefinition>();
  for (const skill of [...existing, ...incoming]) {
    const current = best.get(skill.name);
    if (!current || betterSkill(skill, current)) best.set(skill.name, structuredClone(skill));
  }
  return [...best.values()];
}

function betterSkill(candidate: SkillDefinition, incumbent: SkillDefinition): boolean {
  const a = candidate.metrics.lastEvaluationSuccessRate ?? 0;
  const b = incumbent.metrics.lastEvaluationSuccessRate ?? 0;
  if (a !== b) return a > b;
  return candidate.version > incumbent.version;
}

/** Qué quitar del catálogo. Los ids son los del plan de poda (ADR 0075). */
export interface ForgetFromCatalogInput {
  recipes?: readonly string[];
  interactions?: readonly string[];
  blueprints?: readonly string[];
  decompositions?: readonly string[];
  glyphs?: readonly string[];
  /** Por NOMBRE, que es la unidad en la que se olvida una habilidad. */
  skillNames?: readonly string[];
}

/**
 * Saca del catálogo lo que el cuidador podó. Sin esto la poda duraría hasta el
 * próximo mundo: el catálogo lo volvería a sembrar, que es exactamente el
 * mismo error que ya cometió `adoptNewWorldRules` con las recetas de fábrica.
 */
export function forgetFromCatalog(
  catalog: CatalogData,
  input: ForgetFromCatalogInput,
): CatalogData {
  const gone = {
    recipes: new Set(input.recipes ?? []),
    interactions: new Set(input.interactions ?? []),
    blueprints: new Set(input.blueprints ?? []),
    decompositions: new Set(input.decompositions ?? []),
    glyphs: new Set(input.glyphs ?? []),
    skills: new Set(input.skillNames ?? []),
  };
  return {
    recipes: catalog.recipes.filter((r) => !gone.recipes.has(r.id)),
    interactions: catalog.interactions.filter((i) => !gone.interactions.has(i.id)),
    blueprints: catalog.blueprints.filter((b) => !gone.blueprints.has(b.id)),
    decompositions: catalog.decompositions.filter((d) => !gone.decompositions.has(d.id)),
    glyphs: Object.fromEntries(
      Object.entries(catalog.glyphs).filter(([kind]) => !gone.glyphs.has(kind)),
    ),
    skills: catalog.skills.filter((s) => !gone.skills.has(s.name)),
  };
}

/**
 * Vuelca el catálogo sobre un mundo recién creado. Merge por id y nunca
 * reemplazo, igual que `adoptNewWorldRules` e `inheritWorldRules`: lo que el
 * escenario ya puso manda, y el catálogo solo agrega lo que falta.
 *
 * No toca las habilidades: esas no se copian, se adoptan y se vuelven a rendir
 * (`agent.adoptCatalogSkills`). Una conducta estable en otro mundo es una
 * candidata en este, no una certeza.
 */
export function seedWorldFromCatalog(world: WorldState, catalog: CatalogData): void {
  const known = {
    recipes: new Set(world.recipes.map((r) => r.id)),
    interactions: new Set(world.interactions.map((i) => i.id)),
    blueprints: new Set(world.blueprints.map((b) => b.id)),
    decompositions: new Set(world.decompositions.map((d) => d.id)),
  };
  for (const recipe of catalog.recipes) {
    if (!known.recipes.has(recipe.id)) world.recipes.push(structuredClone(recipe));
  }
  for (const interaction of catalog.interactions) {
    if (!known.interactions.has(interaction.id)) {
      world.interactions.push(structuredClone(interaction));
    }
  }
  for (const blueprint of catalog.blueprints) {
    if (!known.blueprints.has(blueprint.id)) world.blueprints.push(structuredClone(blueprint));
  }
  for (const decomposition of catalog.decompositions) {
    if (!known.decompositions.has(decomposition.id)) {
      world.decompositions.push(structuredClone(decomposition));
    }
  }
  for (const [kind, glyph] of Object.entries(catalog.glyphs)) {
    if (world.glyphs[kind] === undefined) world.glyphs[kind] = structuredClone(glyph);
  }
}
