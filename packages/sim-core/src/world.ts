import type { RngState, Vec2 } from '@anima/shared';
import { createRng } from '@anima/shared';
import type { Components, Entity, EntityId, EntityKind } from './components.js';
import type { Blueprint } from './blueprints.js';
import type { Decomposition } from './decompositions.js';
import type { GlyphRegistry } from './glyphs.js';
import type { Interaction } from './interactions.js';
import type { Recipe } from './recipes.js';

export interface WorldConfig {
  width: number;
  height: number;
  seed: number;
}

/**
 * La materia que este mundo tiene: de dónde puede salir, realmente, un objeto
 * de cada tipo. Es la base sobre la que la puerta decide si una idea toca el
 * suelo (ADR 0031) — un ingrediente que no está acá ni lo produce una receta
 * es un ingrediente imaginario, y una receta hecha de ingredientes imaginarios
 * es una receta muerta.
 *
 * Cuenta lo que existe (en el suelo o en unas manos), lo que las cosas sueltan
 * al romperse y lo que producen solas: un tronco que todavía está adentro de un
 * árbol es materia que el mundo tiene, aunque haya que ir a talarlo. Los
 * productos de las recetas NO entran acá: esto es la materia del mundo, y saber
 * hacer algo es otra cosa — la puerta las suma por separado a propósito.
 */
export function obtainableKinds(world: WorldState): Set<EntityKind> {
  const kinds = new Set<EntityKind>();
  const addArchetype = (
    kind: EntityKind,
    components: Components,
    depth: number,
  ): void => {
    kinds.add(kind);
    // Lo que una cosa suelta puede soltar a su vez (la barricada deja troncos):
    // se sigue, pero con tope — un arquetipo inventado no puede hacer girar
    // este recorrido.
    if (depth >= 3) return;
    for (const drop of components.drops ?? []) {
      addArchetype(drop.kind, drop.components, depth + 1);
    }
    if (components.itemSource) {
      addArchetype(
        components.itemSource.output.kind,
        components.itemSource.output.components,
        depth + 1,
      );
    }
    if (components.foodSource) kinds.add('food');
  };
  for (const entity of Object.values(world.entities)) {
    addArchetype(entity.kind, entity.components, 0);
  }
  // Lo que las cosas dejan al romperse por una regla aprendida es materia igual
  // de real que la que sueltan por su arquetipo: los fragmentos de un pedernal
  // que la IA Dios definió pueden ser ingrediente de una idea futura.
  for (const decomposition of world.decompositions) {
    for (const drop of decomposition.drops) {
      addArchetype(drop.kind, drop.components, 1);
    }
  }
  return kinds;
}

/**
 * Estado completo del mundo. Es un objeto plano serializable: los snapshots
 * y la reproducción determinista dependen de que aquí no haya funciones,
 * clases ni referencias externas.
 */
export interface WorldState {
  tick: number;
  config: WorldConfig;
  rng: RngState;
  nextId: number;
  entities: Record<EntityId, Entity>;
  /**
   * Las recetas que este mundo admite. Son estado, no constantes del código:
   * así viajan en los snapshots y un mundo restaurado craftea igual.
   */
  recipes: Recipe[];
  /**
   * Las interacciones que este mundo admite (ADR 0027). Mismo trato que las
   * recetas: estado del mundo, viajan en los snapshots, y una vez aprendidas
   * no hay que inventarlas de nuevo.
   */
  interactions: Interaction[];
  /**
   * Los planos que este mundo admite (ADR 0032). Mismo trato que recetas e
   * interacciones: estado del mundo, viajan en los snapshots, y una obra
   * aprendida no se vuelve a inventar. Un plano no es una entidad — es cómo
   * disponer bloques para que, juntos, sean una casa.
   */
  blueprints: Blueprint[];
  /**
   * En qué se deshace cada tipo al ser destruido (la cuarta puerta, ADR 0027).
   * Mismo trato que recetas, interacciones y planos: estado del mundo, viaja en
   * los snapshots, y una descomposición aprendida no se vuelve a inventar. La
   * materia no desaparece al romperse: se transforma en lo que esta regla dice.
   */
  decompositions: Decomposition[];
  /**
   * Cómo se ve cada tipo que nadie dibujó a mano (la quinta puerta). Mismo
   * trato que las otras cuatro: estado del mundo, viaja en los snapshots, y un
   * tipo ya dibujado no se vuelve a dibujar.
   *
   * A diferencia de las otras, esta puerta no decide nada de la física — un
   * dibujo no cambia lo que una cosa puede hacer. Vive igual en el mundo
   * porque es lo que hace que sobreviva al guardado y que dos sesiones vean lo
   * mismo: si viviera en la pantalla, cada recarga reinventaría el aspecto.
   */
  glyphs: GlyphRegistry;
}

export function createWorld(
  config: WorldConfig,
  options: {
    recipes?: Recipe[];
    interactions?: Interaction[];
    blueprints?: Blueprint[];
    decompositions?: Decomposition[];
    glyphs?: GlyphRegistry;
  } = {},
): WorldState {
  return {
    tick: 0,
    config,
    rng: createRng(config.seed),
    nextId: 1,
    entities: {},
    recipes: options.recipes ? structuredClone(options.recipes) : [],
    interactions: options.interactions ? structuredClone(options.interactions) : [],
    blueprints: options.blueprints ? structuredClone(options.blueprints) : [],
    decompositions: options.decompositions ? structuredClone(options.decompositions) : [],
    glyphs: options.glyphs ? structuredClone(options.glyphs) : {},
  };
}

export function spawn(world: WorldState, kind: EntityKind, components: Components): Entity {
  const id = `e${world.nextId++}`;
  const entity: Entity = { id, kind, components };
  world.entities[id] = entity;
  return entity;
}

export function getEntity(world: WorldState, id: EntityId): Entity | undefined {
  return world.entities[id];
}

export function removeEntity(world: WorldState, id: EntityId): void {
  delete world.entities[id];
  // Si estaba en algún inventario, se retira también.
  for (const entity of Object.values(world.entities)) {
    const inv = entity.components.inventory;
    if (inv) {
      const index = inv.items.indexOf(id);
      if (index >= 0) inv.items.splice(index, 1);
    }
  }
}

/** Entidades ordenadas por id numérico para iteración determinista. */
export function allEntities(world: WorldState): Entity[] {
  return Object.values(world.entities).sort(
    (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)),
  );
}

export function findByKind(world: WorldState, kind: EntityKind): Entity[] {
  return allEntities(world).filter((e) => e.kind === kind);
}

export function entitiesAt(world: WorldState, pos: Vec2): Entity[] {
  return allEntities(world).filter(
    (e) => e.components.position?.x === pos.x && e.components.position?.y === pos.y,
  );
}

export function inBounds(world: WorldState, pos: Vec2): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < world.config.width && pos.y < world.config.height;
}

/** Una celda está bloqueada si está fuera del mapa o la ocupa un sólido. */
export function isBlocked(world: WorldState, pos: Vec2, ignoreId?: EntityId): Entity | 'bounds' | null {
  if (!inBounds(world, pos)) return 'bounds';
  for (const entity of entitiesAt(world, pos)) {
    if (entity.id !== ignoreId && entity.components.collider?.solid) return entity;
  }
  return null;
}

/**
 * Por qué un cuerpo no puede pararse en una celda, o `null` si puede.
 *
 * Es la ÚNICA fuente de verdad sobre qué es caminable: la usa el resolutor de
 * `move` y cualquiera que necesite razonar sobre caminos (comprobar que una
 * misión abrió un paso, dibujar una ruta). Tenerla escrita dos veces sería
 * tener dos físicas: una que el mundo aplica y otra que alguien cree.
 */
export type Impediment =
  | { reason: 'blocked'; blocker: Entity | 'bounds' }
  | { reason: 'water'; blocker: Entity };

export function impedimentAt(
  world: WorldState,
  pos: Vec2,
  ignoreId?: EntityId,
): Impediment | null {
  if (!inBounds(world, pos)) return { reason: 'blocked', blocker: 'bounds' };
  const cell = entitiesAt(world, pos).filter((e) => e.id !== ignoreId);
  // Lo que ofrece dónde pisar manda sobre todo lo demás de la celda: un piso
  // puesto encima del agua se pisa, y el piso mismo no es un muro.
  if (cell.some((e) => e.components.footing)) return null;
  const solid = cell.find((e) => e.components.collider?.solid);
  if (solid) return { reason: 'blocked', blocker: solid };
  // El agua no es sólida —no tapa la vista— pero nadie sabe nadar: caminar
  // adentro falla con motivo propio, distinguible de un muro.
  const wet = cell.find((e) => e.components.water);
  if (wet) return { reason: 'water', blocker: wet };
  return null;
}

/** true si un cuerpo puede ocupar esa celda. Complemento de `impedimentAt`. */
export function canStandAt(world: WorldState, pos: Vec2, ignoreId?: EntityId): boolean {
  return impedimentAt(world, pos, ignoreId) === null;
}

export function isInInventory(world: WorldState, ownerId: EntityId, itemId: EntityId): boolean {
  return getEntity(world, ownerId)?.components.inventory?.items.includes(itemId) ?? false;
}
