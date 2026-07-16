import { addVec2, isAdjacent } from '@anima/shared';
import type { ActionIntent, ActorIntent } from './actions.js';
import { DIRECTION_DELTAS } from './actions.js';
import type { Entity, EntityId } from './components.js';
import type { SimEvent } from './events.js';
import { simEvent } from './events.js';
import type { WorldState } from './world.js';
import { allEntities, entitiesAt, getEntity, inBounds, isBlocked, isInInventory, removeEntity, spawn } from './world.js';

/** Umbral (fracción del máximo) bajo el cual se emite `energy.low` al cruzarlo. */
export const LOW_ENERGY_FRACTION = 0.35;

/**
 * Avanza el mundo exactamente un paso fijo de simulación.
 * Determinista: mismo estado + mismas intenciones => mismos eventos y estado.
 * Las intenciones se procesan ordenadas por id de actor.
 */
export function stepWorld(world: WorldState, intents: ActorIntent[]): SimEvent[] {
  world.tick += 1;
  const events: SimEvent[] = [];

  const ordered = [...intents].sort(
    (a, b) => Number(a.actorId.slice(1)) - Number(b.actorId.slice(1)),
  );
  for (const { actorId, intent } of ordered) {
    events.push(simEvent('action.requested', world.tick, { actorId, intent }));
    resolveAction(world, actorId, intent, events);
  }

  runEnergySystem(world, events);
  runHazardSystem(world, events);
  runFoodSourceSystem(world, events);
  return events;
}

/**
 * Los peligros del mundo (espinas, fuego) dañan a los agentes adyacentes.
 * La salud puede agotarse sin pasar por el hambre: la causa de muerte es
 * distinta y el informe de legado la refleja.
 */
function runHazardSystem(world: WorldState, events: SimEvent[]): void {
  const hazards = allEntities(world).filter(
    (e) => e.components.hazard && e.components.position,
  );
  if (hazards.length === 0) return;
  for (const entity of allEntities(world)) {
    const health = entity.components.health;
    const pos = entity.components.position;
    if (!health || !pos || !entity.components.agent || entity.components.dead) continue;
    for (const hazard of hazards) {
      const hazardPos = hazard.components.position!;
      if (
        Math.max(Math.abs(hazardPos.x - pos.x), Math.abs(hazardPos.y - pos.y)) > 1 ||
        health.current <= 0
      ) {
        continue;
      }
      const damage = hazard.components.hazard!.damagePerTick;
      health.current = Math.max(0, health.current - damage);
      events.push(
        simEvent('entity.damaged', world.tick, {
          id: entity.id,
          targetKind: entity.kind,
          byId: hazard.id,
          itemKind: hazard.kind,
          damage,
          remainingHealth: health.current,
        }),
      );
      if (health.current === 0 && !entity.components.dead) {
        entity.components.dead = { atTick: world.tick, cause: 'injuries' };
        events.push(simEvent('pet.died', world.tick, { id: entity.id, cause: 'injuries' }));
      }
    }
  }
}

/** Orden determinista de celdas adyacentes candidatas para brotar alimento. */
const SPAWN_OFFSETS = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
];

function runFoodSourceSystem(world: WorldState, events: SimEvent[]): void {
  for (const entity of allEntities(world)) {
    const source = entity.components.foodSource;
    const pos = entity.components.position;
    if (!source || !pos || world.tick < source.nextSpawnAtTick) continue;

    // No acumula: si ya hay alimento cerca de la fuente, espera.
    const nearbyFood = allEntities(world).some(
      (e) =>
        e.components.edible &&
        e.components.position &&
        Math.max(
          Math.abs(e.components.position.x - pos.x),
          Math.abs(e.components.position.y - pos.y),
        ) <= 2,
    );
    source.nextSpawnAtTick = world.tick + source.intervalTicks;
    if (nearbyFood) continue;

    const cell = SPAWN_OFFSETS.map((o) => ({ x: pos.x + o.x, y: pos.y + o.y })).find(
      (c) => inBounds(world, c) && entitiesAt(world, c).length === 0,
    );
    if (!cell) continue;
    const food = spawn(world, 'food', {
      position: cell,
      portable: {},
      edible: {},
      nutrition: { value: source.nutrition },
    });
    events.push(
      simEvent('entity.spawned', world.tick, {
        id: food.id,
        kind: 'food',
        sourceId: entity.id,
        at: cell,
      }),
    );
  }
}

function resolved(
  world: WorldState,
  events: SimEvent[],
  actorId: EntityId,
  intent: ActionIntent,
  success: boolean,
  extra: Record<string, unknown> = {},
): void {
  events.push(
    simEvent('action.resolved', world.tick, { actorId, action: intent.type, success, ...extra }),
  );
}

function resolveAction(
  world: WorldState,
  actorId: EntityId,
  intent: ActionIntent,
  events: SimEvent[],
): void {
  const actor = getEntity(world, actorId);
  if (!actor || actor.components.dead) {
    resolved(world, events, actorId, intent, false, { reason: 'actor-unavailable' });
    return;
  }

  switch (intent.type) {
    case 'wait':
      resolved(world, events, actorId, intent, true);
      return;
    case 'speak':
      events.push(simEvent('agent.spoke', world.tick, { actorId, text: intent.text }));
      resolved(world, events, actorId, intent, true);
      return;
    case 'move':
      resolveMove(world, actor, intent, events);
      return;
    case 'pickup':
      resolvePickup(world, actor, intent, events);
      return;
    case 'drop':
      resolveDrop(world, actor, intent, events);
      return;
    case 'consume':
      resolveConsume(world, actor, intent, events);
      return;
    case 'useItem':
      resolveUseItem(world, actor, intent, events);
      return;
  }
}

function resolveMove(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'move' }>,
  events: SimEvent[],
): void {
  const from = actor.components.position;
  if (!from) {
    resolved(world, events, actor.id, intent, false, { reason: 'no-position' });
    return;
  }
  const to = addVec2(from, DIRECTION_DELTAS[intent.dir]);
  const blocker = isBlocked(world, to, actor.id);
  if (blocker) {
    resolved(world, events, actor.id, intent, false, {
      reason: 'blocked',
      to,
      blockerId: blocker === 'bounds' ? 'bounds' : blocker.id,
      blockerKind: blocker === 'bounds' ? 'bounds' : blocker.kind,
    });
    return;
  }
  actor.components.position = to;
  events.push(simEvent('entity.moved', world.tick, { id: actor.id, from, to }));
  resolved(world, events, actor.id, intent, true, { to });
}

function resolvePickup(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'pickup' }>,
  events: SimEvent[],
): void {
  const target = getEntity(world, intent.targetId);
  const inventory = actor.components.inventory;
  const actorPos = actor.components.position;
  if (!target || !target.components.position || !actorPos) {
    resolved(world, events, actor.id, intent, false, { reason: 'target-unavailable' });
    return;
  }
  if (!inventory) {
    resolved(world, events, actor.id, intent, false, { reason: 'no-inventory' });
    return;
  }
  if (!target.components.portable) {
    resolved(world, events, actor.id, intent, false, { reason: 'not-portable' });
    return;
  }
  if (!isAdjacent(actorPos, target.components.position)) {
    resolved(world, events, actor.id, intent, false, { reason: 'out-of-reach' });
    return;
  }
  if (inventory.items.length >= inventory.capacity) {
    resolved(world, events, actor.id, intent, false, { reason: 'inventory-full' });
    return;
  }
  delete target.components.position;
  inventory.items.push(target.id);
  events.push(simEvent('item.pickedUp', world.tick, { actorId: actor.id, itemId: target.id }));
  resolved(world, events, actor.id, intent, true, { itemId: target.id });
}

function resolveDrop(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'drop' }>,
  events: SimEvent[],
): void {
  const inventory = actor.components.inventory;
  const actorPos = actor.components.position;
  const item = getEntity(world, intent.itemId);
  if (!inventory || !actorPos || !item || !isInInventory(world, actor.id, intent.itemId)) {
    resolved(world, events, actor.id, intent, false, { reason: 'not-held' });
    return;
  }
  inventory.items.splice(inventory.items.indexOf(intent.itemId), 1);
  item.components.position = { ...actorPos };
  events.push(simEvent('item.dropped', world.tick, { actorId: actor.id, itemId: item.id }));
  resolved(world, events, actor.id, intent, true, { itemId: item.id });
}

function resolveConsume(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'consume' }>,
  events: SimEvent[],
): void {
  const target = getEntity(world, intent.targetId);
  const energy = actor.components.energy;
  const actorPos = actor.components.position;
  if (!target || !energy) {
    resolved(world, events, actor.id, intent, false, { reason: 'target-unavailable' });
    return;
  }
  if (!target.components.edible || !target.components.nutrition) {
    resolved(world, events, actor.id, intent, false, { reason: 'not-edible' });
    return;
  }
  const held = isInInventory(world, actor.id, target.id);
  const reachable =
    held ||
    (target.components.position &&
      actorPos &&
      isAdjacent(actorPos, target.components.position));
  if (!reachable) {
    resolved(world, events, actor.id, intent, false, { reason: 'out-of-reach' });
    return;
  }
  const nutrition = target.components.nutrition.value;
  const before = energy.current;
  energy.current = Math.min(energy.max, energy.current + nutrition);
  removeEntity(world, target.id);
  events.push(
    simEvent('item.consumed', world.tick, {
      actorId: actor.id,
      itemId: target.id,
      itemKind: target.kind,
      nutrition,
      energyBefore: before,
      energyAfter: energy.current,
    }),
  );
  resolved(world, events, actor.id, intent, true, { itemId: target.id });
}

function resolveUseItem(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'useItem' }>,
  events: SimEvent[],
): void {
  const item = getEntity(world, intent.itemId);
  const target = getEntity(world, intent.targetId);
  const actorPos = actor.components.position;
  if (!item || !target || !actorPos || !isInInventory(world, actor.id, intent.itemId)) {
    resolved(world, events, actor.id, intent, false, { reason: 'item-not-held' });
    return;
  }
  const tool = item.components.tool;
  if (!tool) {
    resolved(world, events, actor.id, intent, false, { reason: 'not-a-tool' });
    return;
  }
  const itemDurability = item.components.durability;
  if (itemDurability && itemDurability.current <= 0) {
    resolved(world, events, actor.id, intent, false, { reason: 'tool-broken' });
    return;
  }
  const targetPos = target.components.position;
  if (!targetPos || !isAdjacent(actorPos, targetPos)) {
    resolved(world, events, actor.id, intent, false, { reason: 'out-of-reach' });
    return;
  }
  const targetDurability = target.components.durability;
  if (!targetDurability) {
    resolved(world, events, actor.id, intent, false, { reason: 'target-unaffected' });
    return;
  }

  // Regla explícita del mundo: el poder efectivo debe superar la dureza.
  const strength = actor.components.strength?.value ?? 0;
  const hardness = target.components.hardness?.value ?? 0;
  const effectivePower = strength + tool.power;
  const damage = Math.max(0, effectivePower - hardness);

  targetDurability.current = Math.max(0, targetDurability.current - damage);
  events.push(
    simEvent('entity.damaged', world.tick, {
      id: target.id,
      targetKind: target.kind,
      byId: actor.id,
      itemId: item.id,
      itemKind: item.kind,
      effectivePower,
      hardness,
      damage,
      remainingDurability: targetDurability.current,
    }),
  );
  if (targetDurability.current <= 0) {
    removeEntity(world, target.id);
    events.push(
      simEvent('entity.destroyed', world.tick, { id: target.id, kind: target.kind, byId: actor.id }),
    );
  }

  // La herramienta se desgasta con cada uso, aunque no cause daño.
  if (itemDurability) {
    itemDurability.current = Math.max(0, itemDurability.current - 1);
    if (itemDurability.current <= 0) {
      removeEntity(world, item.id);
      events.push(simEvent('tool.broke', world.tick, { itemId: item.id, itemKind: item.kind }));
    }
  }
  resolved(world, events, actor.id, intent, true, { damage, destroyed: targetDurability.current <= 0 });
}

function runEnergySystem(world: WorldState, events: SimEvent[]): void {
  for (const entity of Object.values(world.entities)) {
    const energy = entity.components.energy;
    if (!energy || !entity.components.agent || entity.components.dead) continue;

    const before = energy.current;
    energy.current = Math.max(0, energy.current - energy.decayPerTick);

    const lowThreshold = energy.max * LOW_ENERGY_FRACTION;
    if (before > lowThreshold && energy.current <= lowThreshold) {
      events.push(
        simEvent('energy.low', world.tick, {
          id: entity.id,
          current: energy.current,
          max: energy.max,
        }),
      );
    }
    if (before > 0 && energy.current === 0) {
      events.push(simEvent('energy.depleted', world.tick, { id: entity.id }));
    }

    if (energy.current === 0 && entity.components.health) {
      const health = entity.components.health;
      health.current = Math.max(0, health.current - 1);
      if (health.current === 0 && !entity.components.dead) {
        entity.components.dead = { atTick: world.tick, cause: 'starvation' };
        events.push(
          simEvent('pet.died', world.tick, { id: entity.id, cause: 'starvation' }),
        );
      }
    }
  }
}
