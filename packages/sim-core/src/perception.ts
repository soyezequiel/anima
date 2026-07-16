import type { Vec2 } from '@anima/shared';
import { chebyshev, manhattan } from '@anima/shared';
import type { Entity, EntityId } from './components.js';
import type { WorldState } from './world.js';
import { allEntities, getEntity } from './world.js';

/**
 * Vista parcial de una entidad, tal como el agente puede percibirla.
 * No expone el estado interno del motor: solo propiedades observables.
 */
export interface PerceivedEntity {
  id: EntityId;
  kind: string;
  position?: Vec2;
  /** Distancia Manhattan desde el observador (pasos en grilla de 4 direcciones). */
  distance?: number;
  edible?: boolean;
  portable?: boolean;
  solid?: boolean;
  toolPower?: number;
  hardness?: number;
  /** true si el observador la lleva en su inventario. */
  held?: boolean;
}

export interface Perception {
  tick: number;
  self: {
    id: EntityId;
    position: Vec2;
    energy?: { current: number; max: number };
    health?: { current: number; max: number };
    heldItems: PerceivedEntity[];
  };
  visibleEntities: PerceivedEntity[];
}

function perceiveEntity(entity: Entity, observerPos: Vec2 | null, held: boolean): PerceivedEntity {
  const perceived: PerceivedEntity = { id: entity.id, kind: entity.kind };
  const pos = entity.components.position;
  if (pos) {
    perceived.position = { ...pos };
    if (observerPos) perceived.distance = manhattan(observerPos, pos);
  }
  if (entity.components.edible) perceived.edible = true;
  if (entity.components.portable) perceived.portable = true;
  if (entity.components.collider?.solid) perceived.solid = true;
  if (entity.components.tool) perceived.toolPower = entity.components.tool.power;
  if (entity.components.hardness) perceived.hardness = entity.components.hardness.value;
  if (held) perceived.held = true;
  return perceived;
}

/**
 * Construye la percepción limitada de un agente. El agente nunca recibe el
 * WorldState completo: solo esta vista, restringida por su rango sensorial.
 */
export function buildPerception(world: WorldState, agentId: EntityId): Perception {
  const agent = getEntity(world, agentId);
  const pos = agent?.components.position;
  if (!agent || !pos) {
    throw new Error(`No se puede percibir: el agente ${agentId} no existe o no tiene posición`);
  }
  const range = agent.components.agent?.perceptionRange ?? 5;
  const heldIds = new Set(agent.components.inventory?.items ?? []);

  const visibleEntities: PerceivedEntity[] = [];
  const heldItems: PerceivedEntity[] = [];
  for (const entity of allEntities(world)) {
    if (entity.id === agentId) continue;
    if (heldIds.has(entity.id)) {
      heldItems.push(perceiveEntity(entity, null, true));
      continue;
    }
    const entityPos = entity.components.position;
    if (entityPos && chebyshev(pos, entityPos) <= range) {
      visibleEntities.push(perceiveEntity(entity, pos, false));
    }
  }

  const self: Perception['self'] = { id: agentId, position: { ...pos }, heldItems };
  if (agent.components.energy) {
    self.energy = { current: agent.components.energy.current, max: agent.components.energy.max };
  }
  if (agent.components.health) {
    self.health = { current: agent.components.health.current, max: agent.components.health.max };
  }
  return { tick: world.tick, self, visibleEntities };
}
