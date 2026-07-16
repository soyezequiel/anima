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
  /** Daña a los agentes adyacentes cada tick (espinas, fuego, etc.). */
  hazard?: { damagePerTick: number };
  /**
   * Calor corporal de un agente. Baja cada tick (el mundo es frío) salvo que
   * haya una fuente de calor en rango; en cero, la salud decae como con el
   * hambre pero con causa de muerte propia.
   */
  temperature?: { current: number; max: number; lossPerTick: number };
  /** Irradia calor a los agentes dentro del rango (distancia Chebyshev). */
  heatSource?: { warmthPerTick: number; range: number };
  /**
   * Qué deja la entidad al ser destruida (talar un árbol => troncos).
   * Declarativo: cada entrada es un arquetipo completo, listo para spawn.
   */
  drops?: Array<{ kind: EntityKind; components: Components }>;
}

export interface Entity {
  id: EntityId;
  kind: EntityKind;
  components: Components;
}
