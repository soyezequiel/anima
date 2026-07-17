import type { RngState, Vec2 } from '@anima/shared';
import { createRng } from '@anima/shared';
import type { Components, Entity, EntityId, EntityKind } from './components.js';
import type { Interaction } from './interactions.js';
import type { Recipe } from './recipes.js';

export interface WorldConfig {
  width: number;
  height: number;
  seed: number;
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
}

export function createWorld(
  config: WorldConfig,
  options: { recipes?: Recipe[]; interactions?: Interaction[] } = {},
): WorldState {
  return {
    tick: 0,
    config,
    rng: createRng(config.seed),
    nextId: 1,
    entities: {},
    recipes: options.recipes ? structuredClone(options.recipes) : [],
    interactions: options.interactions ? structuredClone(options.interactions) : [],
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
