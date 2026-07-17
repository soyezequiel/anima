import { addVec2, isAdjacent } from '@anima/shared';
import type { ActionIntent, ActorIntent } from './actions.js';
import { DIRECTION_DELTAS } from './actions.js';
import type { Entity, EntityId } from './components.js';
import type { SimEvent } from './events.js';
import { simEvent } from './events.js';
import { matchesInteractionTarget } from './interactions.js';
import { validateInteraction } from './interaction-validation.js';
import { PROTECTED_KINDS, validateRecipe } from './recipe-validation.js';
import { validateBlueprint } from './blueprint-validation.js';
import {
  findRecipe,
  missingIngredients,
  recipeProduct,
  rollOutcome,
  rollQuality,
  scaleByQuality,
} from './recipes.js';
import type { WorldState } from './world.js';
import { allEntities, entitiesAt, getEntity, inBounds, isBlocked, isInInventory, obtainableKinds, removeEntity, spawn } from './world.js';

/** Umbral (fracción del máximo) bajo el cual se emite `energy.low` al cruzarlo. */
export const LOW_ENERGY_FRACTION = 0.35;

/** Umbral (fracción del máximo) bajo el cual se emite `temperature.low` al cruzarlo. */
export const LOW_TEMPERATURE_FRACTION = 0.35;

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
  runTemperatureSystem(world, events);
  runHazardSystem(world, events);
  runFoodSourceSystem(world, events);
  runItemSourceSystem(world, events);
  return events;
}

/**
 * El mundo es frío: el calor corporal decae cada tick salvo cerca de una
 * fuente de calor. Solo afecta a los agentes que tienen el componente
 * `temperature`; los escenarios sin frío quedan intactos.
 */
function runTemperatureSystem(world: WorldState, events: SimEvent[]): void {
  // Lo que va en un inventario no tiene posición propia: irradia desde quien
  // lo lleva. Sin esto, una antorcha —cuyo único sentido es llevarla— dejaba
  // de calentar justo al recogerla.
  const heldPositions = new Map<string, { x: number; y: number }>();
  for (const carrier of allEntities(world)) {
    const carrierPos = carrier.components.position;
    if (!carrierPos || !carrier.components.inventory) continue;
    for (const itemId of carrier.components.inventory.items) {
      heldPositions.set(itemId, carrierPos);
    }
  }
  const heatSources = allEntities(world)
    .filter((e) => e.components.heatSource)
    .map((e) => ({
      heat: e.components.heatSource!,
      position: e.components.position ?? heldPositions.get(e.id) ?? null,
    }))
    .filter((source): source is { heat: { warmthPerTick: number; range: number }; position: { x: number; y: number } } =>
      source.position !== null,
    );
  // Un refugio no irradia nada: solo detiene la sangría. No viaja en
  // inventarios (nadie se lleva puesta una choza), así que exige posición.
  const shelters = allEntities(world)
    .filter((e) => e.components.shelter && e.components.position)
    .map((e) => ({ range: e.components.shelter!.range, position: e.components.position! }));
  for (const entity of allEntities(world)) {
    const temperature = entity.components.temperature;
    const pos = entity.components.position;
    if (!temperature || !pos || !entity.components.agent || entity.components.dead) continue;

    const warmth = heatSources.reduce((total, source) => {
      const distance = Math.max(
        Math.abs(source.position.x - pos.x),
        Math.abs(source.position.y - pos.y),
      );
      return distance <= source.heat.range ? total + source.heat.warmthPerTick : total;
    }, 0);
    const sheltered = shelters.some(
      (s) =>
        Math.max(Math.abs(s.position.x - pos.x), Math.abs(s.position.y - pos.y)) <= s.range,
    );

    const before = temperature.current;
    temperature.current = Math.min(
      temperature.max,
      Math.max(0, temperature.current - (sheltered ? 0 : temperature.lossPerTick) + warmth),
    );

    const lowThreshold = temperature.max * LOW_TEMPERATURE_FRACTION;
    if (before > lowThreshold && temperature.current <= lowThreshold) {
      events.push(
        simEvent('temperature.low', world.tick, {
          id: entity.id,
          current: temperature.current,
          max: temperature.max,
        }),
      );
    }
    if (before > 0 && temperature.current === 0) {
      events.push(simEvent('temperature.depleted', world.tick, { id: entity.id }));
    }

    if (temperature.current === 0 && entity.components.health) {
      const health = entity.components.health;
      health.current = Math.max(0, health.current - 1);
      if (health.current === 0 && !entity.components.dead) {
        entity.components.dead = { atTick: world.tick, cause: 'hypothermia' };
        events.push(simEvent('pet.died', world.tick, { id: entity.id, cause: 'hypothermia' }));
      }
    }
  }
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

/** La primera celda adyacente libre, en el orden determinista de siempre. */
function freeAdjacentCell(world: WorldState, pos: { x: number; y: number }) {
  return SPAWN_OFFSETS.map((o) => ({ x: pos.x + o.x, y: pos.y + o.y })).find(
    (c) => inBounds(world, c) && entitiesAt(world, c).length === 0,
  );
}

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

    const cell = freeAdjacentCell(world, pos);
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

/**
 * El productor periódico genérico: mismo ritmo y misma prudencia que la fuente
 * de alimento, pero de lo que declare el arquetipo. La saturación es por tipo
 * —mientras la rama anterior siga tirada al lado del árbol, no cae otra—, así
 * que recoger es lo que hace que vuelva a producir.
 */
function runItemSourceSystem(world: WorldState, events: SimEvent[]): void {
  for (const entity of allEntities(world)) {
    const source = entity.components.itemSource;
    const pos = entity.components.position;
    if (!source || !pos || world.tick < source.nextSpawnAtTick) continue;

    const nearbySame = allEntities(world).some(
      (e) =>
        e.kind === source.output.kind &&
        e.components.position &&
        Math.max(
          Math.abs(e.components.position.x - pos.x),
          Math.abs(e.components.position.y - pos.y),
        ) <= 2,
    );
    source.nextSpawnAtTick = world.tick + source.intervalTicks;
    if (nearbySame) continue;

    const cell = freeAdjacentCell(world, pos);
    if (!cell) continue;
    const produced = spawn(world, source.output.kind, {
      ...structuredClone(source.output.components),
      position: cell,
    });
    events.push(
      simEvent('entity.spawned', world.tick, {
        id: produced.id,
        kind: produced.kind,
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
    case 'place':
      resolvePlace(world, actor, intent, events);
      return;
    case 'consume':
      resolveConsume(world, actor, intent, events);
      return;
    case 'useItem':
      resolveUseItem(world, actor, intent, events);
      return;
    case 'craft':
      resolveCraft(world, actor, intent, events);
      return;
    case 'proposeRecipe':
      resolveProposeRecipe(world, actor, intent, events);
      return;
    case 'proposeInteraction':
      resolveProposeInteraction(world, actor, intent, events);
      return;
    case 'proposeBlueprint':
      resolveProposeBlueprint(world, actor, intent, events);
      return;
    case 'interact':
      resolveInteract(world, actor, intent, events);
      return;
  }
}

/**
 * La mascota propone una interacción; el mundo la valida y decide, igual que
 * con las recetas. El juicio de coherencia (la IA Dios, ADR 0027) ocurre antes
 * y en el agente, pero no cuenta aquí: no existe camino a `world.interactions`
 * que se salte esta puerta.
 */
function resolveProposeInteraction(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'proposeInteraction' }>,
  events: SimEvent[],
): void {
  const validated = validateInteraction(intent.interaction, world.interactions);
  if (!validated.ok) {
    events.push(
      simEvent('interaction.rejected', world.tick, {
        actorId: actor.id,
        reason: validated.error,
      }),
    );
    resolved(world, events, actor.id, intent, false, { reason: validated.error });
    return;
  }
  world.interactions.push(validated.value);
  events.push(
    simEvent('interaction.learned', world.tick, {
      actorId: actor.id,
      interactionId: validated.value.id,
      description: validated.value.description,
      stance: validated.value.stance,
    }),
  );
  resolved(world, events, actor.id, intent, true, { interactionId: validated.value.id });
}

/**
 * Ejecutar una interacción que el mundo ya admite. El mundo comprueba TODO de
 * nuevo — postura, objetivo, lo que hay que llevar — porque la interacción es
 * una regla, no un permiso: saberla no exime de estar donde hay que estar.
 */
function resolveInteract(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'interact' }>,
  events: SimEvent[],
): void {
  const interaction = world.interactions.find((i) => i.id === intent.interactionId);
  if (!interaction) {
    resolved(world, events, actor.id, intent, false, {
      reason: 'unknown-interaction',
      interactionId: intent.interactionId,
    });
    return;
  }
  const target = getEntity(world, intent.targetId);
  if (!target) {
    resolved(world, events, actor.id, intent, false, { reason: 'target-unavailable' });
    return;
  }
  if (!matchesInteractionTarget(target, interaction.target)) {
    resolved(world, events, actor.id, intent, false, {
      reason: 'target-mismatch',
      interactionId: interaction.id,
      targetKind: target.kind,
    });
    return;
  }

  const actorPos = actor.components.position;
  const targetPos = target.components.position;
  if (interaction.stance === 'held') {
    if (!isInInventory(world, actor.id, target.id)) {
      resolved(world, events, actor.id, intent, false, { reason: 'not-holding-target' });
      return;
    }
  } else if (interaction.stance === 'beside') {
    if (!actorPos || !targetPos || !isAdjacent(actorPos, targetPos)) {
      resolved(world, events, actor.id, intent, false, { reason: 'out-of-reach' });
      return;
    }
  } else {
    // on-top / underneath: terminar en la celda del objeto. Llegar a una celda
    // adyacente alcanza, porque subirse (o meterse debajo) ES parte del acto:
    // el movimiento nunca deja PISAR un sólido — nadie atraviesa una silla
    // caminando —, pero treparse a ella es exactamente lo que esta postura
    // significa. Sin esto, on-top sobre cualquier sólido sería imposible por
    // definición y "subite a la silla" (el ejemplo del ADR 0027) no existiría.
    // Para el motor encima/debajo son la misma condición; la diferencia es de
    // dibujo y el evento la conserva.
    if (!actorPos || !targetPos || !isAdjacent(actorPos, targetPos)) {
      resolved(world, events, actor.id, intent, false, { reason: 'not-on-target' });
      return;
    }
    // El agua no sostiene a nadie: no hay postura que valga sobre ella.
    if (target.components.water) {
      resolved(world, events, actor.id, intent, false, { reason: 'target-not-mountable' });
      return;
    }
    actor.components.position = { x: targetPos.x, y: targetPos.y };
  }

  let heldRequired: Entity | null = null;
  if (interaction.requires) {
    const heldId = (actor.components.inventory?.items ?? []).find(
      (id) => getEntity(world, id)?.kind === interaction.requires!.heldKind,
    );
    heldRequired = heldId ? getEntity(world, heldId) ?? null : null;
    if (!heldRequired) {
      resolved(world, events, actor.id, intent, false, {
        reason: 'missing-required-item',
        requiredKind: interaction.requires.heldKind,
      });
      return;
    }
  }

  // Guardia de ejecución que la puerta no puede dar: la puerta ve tipos y
  // rasgos declarados, pero recién aquí se sabe QUÉ entidad es. Los cuerpos
  // vivos, el agua (terreno) y lo protegido (los mismos PROTECTED_KINDS de
  // las recetas: el recurso no se transforma) quedan intactos.
  const transformsTarget = interaction.effects.some((e) => e.type === 'transform-target');
  if (
    transformsTarget &&
    (target.components.agent || target.components.water || PROTECTED_KINDS.has(target.kind))
  ) {
    resolved(world, events, actor.id, intent, false, {
      reason: 'target-immutable',
      targetKind: target.kind,
    });
    return;
  }

  const transformed: { id: EntityId; from: string; to: string }[] = [];
  for (const effect of interaction.effects) {
    const subject = effect.type === 'transform-target' ? target : heldRequired;
    if (!subject) continue;
    const fromKind = subject.kind;
    const keepPosition = subject.components.position;
    subject.kind = effect.kind ?? subject.kind;
    subject.components = {
      ...structuredClone(effect.components),
      ...(keepPosition ? { position: keepPosition } : {}),
    };
    transformed.push({ id: subject.id, from: fromKind, to: subject.kind });
  }

  events.push(
    simEvent('interaction.performed', world.tick, {
      actorId: actor.id,
      interactionId: interaction.id,
      targetId: target.id,
      targetKind: target.kind,
      stance: interaction.stance,
      transformed,
    }),
  );
  resolved(world, events, actor.id, intent, true, {
    interactionId: interaction.id,
    targetId: target.id,
  });
}

/**
 * La mascota propone una receta; el mundo la valida y decide. Que se le ocurra
 * no la vuelve posible: la física es del mundo, y aquí es donde se comprueba
 * que la idea no invente materia, comida ni poderes que no existen. Un rechazo
 * lleva el motivo, para que la mascota pueda corregir en vez de adivinar.
 *
 * La materia sale del mundo, no de la propuesta (ADR 0031): quien decide si un
 * ingrediente existe es quien tiene las entidades a la vista, y ese es el
 * mundo. Por eso `obtainableKinds` se calcula aquí y no lo manda el agente —
 * si lo mandara, bastaría con mentir en la lista para inventar materia.
 */
function resolveProposeRecipe(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'proposeRecipe' }>,
  events: SimEvent[],
): void {
  const validated = validateRecipe(intent.recipe, world.recipes, obtainableKinds(world));
  if (!validated.ok) {
    events.push(
      simEvent('recipe.rejected', world.tick, {
        actorId: actor.id,
        reason: validated.error,
      }),
    );
    resolved(world, events, actor.id, intent, false, { reason: validated.error });
    return;
  }
  world.recipes.push(validated.value);
  events.push(
    simEvent('recipe.learned', world.tick, {
      actorId: actor.id,
      recipeId: validated.value.id,
      outputKind: recipeProduct(validated.value)?.kind,
      ingredients: validated.value.ingredients,
    }),
  );
  resolved(world, events, actor.id, intent, true, { recipeId: validated.value.id });
}

/**
 * La mascota propone un plano; el mundo valida y decide (ADR 0032). Idéntico a
 * las recetas: la materia se mira desde acá, no desde la propuesta, y la puerta
 * también conoce las recetas del mundo para saber qué bloques se pueden
 * fabricar. No hay camino a `world.blueprints` que se salte esta puerta.
 */
function resolveProposeBlueprint(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'proposeBlueprint' }>,
  events: SimEvent[],
): void {
  const validated = validateBlueprint(
    intent.blueprint,
    world.blueprints,
    world.recipes,
    obtainableKinds(world),
    // Lo que puede cargar: una obra se junta entera antes de colocarse, así que
    // el inventario es el techo real del tamaño de la obra (ADR 0032).
    actor.components.inventory?.capacity,
  );
  if (!validated.ok) {
    events.push(
      simEvent('blueprint.rejected', world.tick, { actorId: actor.id, reason: validated.error }),
    );
    resolved(world, events, actor.id, intent, false, { reason: validated.error });
    return;
  }
  world.blueprints.push(validated.value);
  events.push(
    simEvent('blueprint.learned', world.tick, {
      actorId: actor.id,
      blueprintId: validated.value.id,
      blocks: validated.value.placements.length,
    }),
  );
  resolved(world, events, actor.id, intent, true, { blueprintId: validated.value.id });
}

/**
 * Craftear: el mundo comprueba los ingredientes, tira su dado, y de ahí sale
 * lo que salga. Nadie fabrica nada por creer que puede — si falta algo, el
 * fallo dice exactamente qué falta y en qué cantidad.
 *
 * Tener los ingredientes da derecho al INTENTO, no al producto: la receta
 * declara sus desenlaces y `world.rng` elige entre ellos, así que la misma
 * receta con lo mismo en la mano puede dar una fogata redonda, una pobre, o
 * humo. Que sea el rng del mundo —y no `Math.random()`— es lo que mantiene en
 * pie el principio 1: el snapshot lleva el estado del dado, así que la corrida
 * se reproduce clavada aunque deje de ser predecible.
 */
function resolveCraft(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'craft' }>,
  events: SimEvent[],
): void {
  const recipe = findRecipe(world.recipes, intent.recipeId);
  if (!recipe) {
    resolved(world, events, actor.id, intent, false, {
      reason: 'unknown-recipe',
      recipeId: intent.recipeId,
    });
    return;
  }
  const inventory = actor.components.inventory;
  const actorPos = actor.components.position;
  if (!inventory || !actorPos) {
    resolved(world, events, actor.id, intent, false, { reason: 'no-inventory' });
    return;
  }

  // Qué tiene a mano, por tipo, en orden determinista.
  const heldByKind = new Map<string, EntityId[]>();
  for (const itemId of inventory.items) {
    const item = getEntity(world, itemId);
    if (!item) continue;
    const list = heldByKind.get(item.kind) ?? [];
    list.push(itemId);
    heldByKind.set(item.kind, list);
  }
  const counts = new Map([...heldByKind].map(([kind, ids]) => [kind, ids.length]));
  const missing = missingIngredients(recipe, counts);
  if (missing.length > 0) {
    resolved(world, events, actor.id, intent, false, {
      reason: 'missing-ingredients',
      recipeId: recipe.id,
      missing,
    });
    return;
  }

  // El espacio se mira ANTES de tirar: si no hay dónde poner lo construido, el
  // intento no llega a ocurrir, y no debe gastar ni ingredientes ni tirada.
  const cell = [actorPos, ...SPAWN_OFFSETS.map((o) => addVec2(actorPos, o))].find(
    (c) => inBounds(world, c) && entitiesAt(world, c).length === 0,
  );
  if (!cell && recipe.outcomes.some((o) => o.output !== undefined)) {
    resolved(world, events, actor.id, intent, false, { reason: 'no-space', recipeId: recipe.id });
    return;
  }

  const outcome = rollOutcome(recipe, world.rng);
  if (!outcome) {
    resolved(world, events, actor.id, intent, false, { reason: 'no-outcomes', recipeId: recipe.id });
    return;
  }
  const quality = rollQuality(outcome, world.rng);

  // Lo que el desenlace perdona no se gasta: un intento fallido puede dejar el
  // pedernal intacto y llevarse solo la madera.
  const spared = new Map<string, number>();
  for (const spare of outcome.spares ?? []) {
    spared.set(spare.kind, (spared.get(spare.kind) ?? 0) + spare.count);
  }
  const consumed: EntityId[] = [];
  for (const ingredient of recipe.ingredients) {
    const take = Math.max(0, ingredient.count - (spared.get(ingredient.kind) ?? 0));
    for (const itemId of (heldByKind.get(ingredient.kind) ?? []).slice(0, take)) {
      consumed.push(itemId);
      removeEntity(world, itemId);
    }
  }

  if (!outcome.output) {
    events.push(
      simEvent('craft.failed', world.tick, {
        actorId: actor.id,
        recipeId: recipe.id,
        consumed,
      }),
    );
    // Falló el intento, no la receta: tiene los ingredientes y la sabe hacer.
    // El motivo lo dice para que reintentar sea distinguible de rendirse.
    resolved(world, events, actor.id, intent, false, {
      reason: 'attempt-failed',
      recipeId: recipe.id,
      consumed,
    });
    return;
  }

  // `cell` existe: el desenlace produce algo, así que el chequeo de espacio de
  // arriba ya se hizo cargo.
  const product = spawn(world, outcome.output.kind, {
    ...scaleByQuality(outcome.output.components, quality),
    position: cell!,
  });
  events.push(
    simEvent('item.crafted', world.tick, {
      actorId: actor.id,
      recipeId: recipe.id,
      itemId: product.id,
      itemKind: product.kind,
      quality,
      consumed,
      at: cell,
    }),
  );
  resolved(world, events, actor.id, intent, true, {
    recipeId: recipe.id,
    itemId: product.id,
    quality,
  });
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
  // El agua no es sólida —no tapa la vista— pero nadie sabe nadar: caminar
  // adentro falla con su propio motivo, distinguible de un muro.
  const wet = entitiesAt(world, to).find((e) => e.components.water);
  if (wet) {
    resolved(world, events, actor.id, intent, false, {
      reason: 'water',
      to,
      blockerId: wet.id,
      blockerKind: wet.kind,
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

/**
 * Colocar un bloque en una celda elegida (ADR 0032). Es `drop` con puntería, y
 * las tres condiciones que exige son las que hacen que una obra se pueda
 * levantar sin trampas: la celda tiene que estar dentro del mapa, vacía, y al
 * alcance del brazo (adyacente). No hay teletransporte de materia — un bloque
 * se pone donde la mascota llega, no donde se le antoja.
 */
function resolvePlace(
  world: WorldState,
  actor: Entity,
  intent: Extract<ActionIntent, { type: 'place' }>,
  events: SimEvent[],
): void {
  const inventory = actor.components.inventory;
  const actorPos = actor.components.position;
  const item = getEntity(world, intent.itemId);
  if (!inventory || !actorPos || !item || !isInInventory(world, actor.id, intent.itemId)) {
    resolved(world, events, actor.id, intent, false, { reason: 'not-held' });
    return;
  }
  if (!inBounds(world, intent.at)) {
    resolved(world, events, actor.id, intent, false, { reason: 'out-of-bounds' });
    return;
  }
  if (!isAdjacent(actorPos, intent.at)) {
    resolved(world, events, actor.id, intent, false, { reason: 'out-of-reach' });
    return;
  }
  if (entitiesAt(world, intent.at).length > 0) {
    resolved(world, events, actor.id, intent, false, { reason: 'cell-occupied' });
    return;
  }
  inventory.items.splice(inventory.items.indexOf(intent.itemId), 1);
  item.components.position = { ...intent.at };
  events.push(
    simEvent('item.placed', world.tick, {
      actorId: actor.id,
      itemId: item.id,
      itemKind: item.kind,
      at: { ...intent.at },
    }),
  );
  resolved(world, events, actor.id, intent, true, { itemId: item.id, at: { ...intent.at } });
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
    const dropOrigin = target.components.position ? { ...target.components.position } : null;
    const drops = target.components.drops ?? [];
    removeEntity(world, target.id);
    events.push(
      simEvent('entity.destroyed', world.tick, { id: target.id, kind: target.kind, byId: actor.id }),
    );
    // Lo que la entidad deja al ser destruida aparece donde estaba (ya libre)
    // y en las celdas libres adyacentes, en orden determinista.
    if (dropOrigin) {
      const cells = [dropOrigin, ...SPAWN_OFFSETS.map((o) => addVec2(dropOrigin, o))].filter(
        (c) => inBounds(world, c) && entitiesAt(world, c).length === 0,
      );
      for (const [i, drop] of drops.entries()) {
        const cell = cells[i];
        if (!cell) break;
        const spawned = spawn(world, drop.kind, {
          ...structuredClone(drop.components),
          position: cell,
        });
        events.push(
          simEvent('entity.spawned', world.tick, {
            id: spawned.id,
            kind: spawned.kind,
            sourceId: target.id,
            at: cell,
          }),
        );
      }
    }
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
