import type { RngState, Vec2 } from '@anima/shared';
import { createRng } from '@anima/shared';
import type { Components, Entity, EntityId, EntityKind } from './components.js';
import type { Blueprint } from './blueprints.js';
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
}

export function createWorld(
  config: WorldConfig,
  options: { recipes?: Recipe[]; interactions?: Interaction[]; blueprints?: Blueprint[] } = {},
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

export function isInInventory(world: WorldState, ownerId: EntityId, itemId: EntityId): boolean {
  return getEntity(world, ownerId)?.components.inventory?.items.includes(itemId) ?? false;
}
