import type { Vec2 } from '@anima/shared';

export type EntityId = string;

/** Tipos de entidad conocidos por el MVP. El motor no restringe el catálogo. */
export type EntityKind = string;

/**
 * Componentes del mundo. Todos son datos serializables sin métodos:
 * la lógica vive en los sistemas de `step.ts`.
 */
export interface Components {
  position?: Vec2;
  collider?: { solid: boolean };
  /** Marca que la entidad puede recogerse. */
  portable?: Record<string, never>;
  energy?: { current: number; max: number; decayPerTick: number };
  health?: { current: number; max: number };
  strength?: { value: number };
  /** Resistencia al daño: el daño solo ocurre si el poder efectivo la supera. */
  hardness?: { value: number };
  durability?: { current: number; max: number };
  nutrition?: { value: number };
  inventory?: { items: EntityId[]; capacity: number };
  tool?: { power: number };
  /** Marca que la entidad puede consumirse (junto con nutrition). */
  edible?: Record<string, never>;
  agent?: { name: string; perceptionRange: number };
  dead?: { atTick: number; cause: string };
  /** Produce alimento periódicamente en una celda libre adyacente. */
  foodSource?: { intervalTicks: number; nutrition: number; nextSpawnAtTick: number };
}

export interface Entity {
  id: EntityId;
  kind: EntityKind;
  components: Components;
}
