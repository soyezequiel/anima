import type { Result } from '@anima/shared';
import {
  countedKindLabel,
  err,
  kindAfterOf,
  kindAfterTo,
  kindLabel,
  kindWithArticle,
  ok,
} from '@anima/shared';
import type { Direction, Perception } from '@anima/sim-core';
import { recipeProductKinds } from '@anima/sim-core';
import type { EntityQuery, SkillOp, SkillProgram } from '@anima/skill-runtime';
import type { CausalCondition, CausalEffect } from '../causal-planner.js';
import { causalFluent } from '../causal-world-model.js';
import type { GoalCondition, GoalEntityRef } from '../goal-conditions.js';
import type { SpatialGrounding, SpatialRelation } from '../goals.js';
import { buildStructureProgram, gatherAndCraftProgram, heldCounts } from '../programs.js';
import { spatialRequestProgram } from '../spatial-goals.js';
import type {
  Capability,
  CapabilityCompilation,
  CapabilityContext,
  CapabilityRecovery,
} from './capability.js';
import { CapabilityRegistry } from './registry.js';

/**
 * El catálogo concreto: las operaciones que Ánima ya sabía hacer, expuestas
 * ahora con un contrato uniforme.
 *
 * Ninguna de estas capacidades inventa conducta. Cada una envuelve la misma
 * secuencia de DSL que el compilador de peticiones venía emitiendo dentro de
 * su `switch`, más lo que faltaba: precondiciones y efectos en el lenguaje del
 * planificador, y un predicado del mundo con el que juzgar si el paso ocurrió.
 * La lógica del simulador no se duplica en ningún lado — el motor sigue siendo
 * quien decide qué pasa.
 */

// ---------------------------------------------------------------------------
// Utilidades compartidas
// ---------------------------------------------------------------------------

/**
 * Buscar antes de rendirse: si lo que el paso nombra no está a la vista,
 * recorrer el mapa hasta verlo en vez de abortar con «no encuentro el objeto».
 * Si ya lo ve (o lo lleva), la exploración no cuesta ni un tick: el `until` se
 * evalúa antes del primer paso.
 */
function searchFor(query: EntityQuery): SkillOp {
  return { op: 'explore', maxSteps: 50, until: { type: 'sees', query } };
}

function heldOf(perception: Perception, kind: string): number {
  return perception.self.heldItems.filter((item) => item.kind === kind).length;
}

function entityRef(args: { kind?: string; entityId?: string }): GoalEntityRef {
  return {
    ...(args.entityId ? { id: args.entityId } : {}),
    ...(args.kind ? { kind: args.kind } : {}),
  };
}

function targetQuery(args: { kind?: string; entityId?: string }, extra: Partial<EntityQuery> = {}): EntityQuery {
  return {
    ...(args.entityId ? { id: args.entityId } : {}),
    ...(args.kind ? { kind: args.kind } : {}),
    ...extra,
  };
}

function readKind(raw: unknown, field: string): Result<string> {
  const value = (raw as Record<string, unknown> | null | undefined)?.[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return err(`${field} tiene que ser un nombre interno no vacío`);
  }
  return ok(value.trim());
}

function readOptionalId(raw: unknown, field: string): string | undefined {
  const value = (raw as Record<string, unknown> | null | undefined)?.[field];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readCount(raw: unknown, field: string, fallback: number, max: number): number {
  const value = (raw as Record<string, unknown> | null | undefined)?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

function objectOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function compiled(program: SkillProgram): CapabilityCompilation {
  return { ok: true, program };
}

/** Los pasos recordados hasta una identidad ya resuelta, como ops de la DSL. */
function rememberedApproach(context: CapabilityContext, entityId?: string): SkillOp[] {
  if (!entityId) return [];
  const walk = context.deps.rememberedWalkForEntity(entityId) ?? [];
  return walk.map((dir): SkillOp => ({ op: 'moveStep', dir }));
}

// ---------------------------------------------------------------------------
// explore.until-sees
// ---------------------------------------------------------------------------

interface ExploreArgs {
  kind: string;
  maxSteps: number;
}

const exploreUntilSees: Capability<ExploreArgs> = {
  id: 'explore.until-sees',
  summary: 'recorrer el mapa hasta ver algo de un tipo dado',
  risk: 'reversible',
  params: [
    { name: 'kind', type: 'kind', required: true, description: 'nombre interno de lo que busca' },
    { name: 'maxSteps', type: 'count', required: false, description: 'tope de pasos (50 por defecto)' },
  ],
  ground(raw) {
    const kind = readKind(raw, 'kind');
    if (!kind.ok) return kind;
    return ok({ kind: kind.value, maxSteps: readCount(raw, 'maxSteps', 50, 50) });
  },
  cost: (args) => Math.min(args.maxSteps, 12),
  preconditions: () => [],
  effects: (args): CausalEffect[] => [
    // Explorar no garantiza encontrar: el mundo puede no tener ninguno. La
    // hipótesis es honesta y el planner ya sabe cobrarle su riesgo.
    { fluent: causalFluent.loose(args.kind), operation: 'increase', value: 1, knowledge: 'hypothetical' },
  ],
  compile: (args) => compiled([{ op: 'explore', maxSteps: args.maxSteps, until: { type: 'sees', query: { kind: args.kind } } }]),
  verify: (args): GoalCondition => ({ type: 'entity-present', entity: { kind: args.kind }, present: true }),
  describe: (args) => `salgo a buscar ${kindWithArticle(args.kind)}`,
};

// ---------------------------------------------------------------------------
// item.pickup
// ---------------------------------------------------------------------------

interface PickupArgs {
  kind?: string;
  entityId?: string;
  amount: number;
  /**
   * Exigir que lo buscado sea levantable. Lo pide la ruta causal, donde el
   * paso nació de un fluente `loose:` que por definición habla de materia
   * suelta: sin el filtro, la búsqueda podría elegir un ejemplar fijo del
   * mismo tipo y el plan moriría contra una piedra que nadie iba a levantar.
   * La ruta del cuidador no lo pide: si te piden traer algo que no se levanta,
   * es más honesto ir hasta ahí y que el mundo diga que no.
   */
  portable?: boolean;
}

const MAX_PICKUP_AMOUNT = 8;

const itemPickup: Capability<PickupArgs> = {
  id: 'item.pickup',
  summary: 'buscar, alcanzar y levantar uno o varios objetos de un tipo',
  risk: 'reversible',
  params: [
    { name: 'kind', type: 'kind', required: false, description: 'nombre interno de lo que hay que traer' },
    { name: 'entityId', type: 'entity-id', required: false, description: 'identidad concreta ya resuelta' },
    { name: 'amount', type: 'count', required: false, description: 'cuántas unidades (1 por defecto)' },
    { name: 'portable', type: 'flag', required: false, description: 'exigir que sea levantable' },
  ],
  ground(raw) {
    const args = objectOf(raw);
    const entityId = readOptionalId(args, 'entityId');
    const kindValue = typeof args.kind === 'string' ? args.kind.trim() : '';
    if (!entityId && kindValue.length === 0) {
      return err('item.pickup necesita kind o entityId');
    }
    return ok({
      ...(kindValue ? { kind: kindValue } : {}),
      ...(entityId ? { entityId } : {}),
      amount: readCount(args, 'amount', 1, MAX_PICKUP_AMOUNT),
      ...(args.portable === true ? { portable: true } : {}),
    });
  },
  cost: (args) => 2 * args.amount,
  preconditions: (args): CausalCondition[] =>
    args.kind ? [{ fluent: causalFluent.loose(args.kind), comparison: 'at-least', value: 1 }] : [],
  effects: (args): CausalEffect[] =>
    args.kind
      ? [
          { fluent: causalFluent.loose(args.kind), operation: 'decrease', value: args.amount, knowledge: 'known' },
          { fluent: causalFluent.inventory(args.kind), operation: 'increase', value: args.amount, knowledge: 'known' },
        ]
      : [],
  compile(args, context) {
    // Ya lo lleva encima: el paso está hecho y no cuesta un tick.
    if (args.entityId && context.perception.self.heldItems.some((item) => item.id === args.entityId)) {
      return compiled([{ op: 'wait', ticks: 1 }]);
    }
    const query = targetQuery(args, {
      held: false,
      ...(args.portable ? { portable: true } : {}),
    });
    // held:false: «traé un tronco» pide OTRO tronco. Sin el filtro, `nearest`
    // devuelve el que ya lleva (distancia 0) y el paso termina «cumplido» sin
    // traer nada — pedir dos ingredientes iguales sería imposible.
    const fetchOne: SkillOp[] = [
      ...rememberedApproach(context, args.entityId),
      searchFor(query),
      { op: 'findEntities', query, store: 'requestedItems' },
      { op: 'selectTarget', from: 'requestedItems', strategy: 'nearest', store: 'requestedItem' },
      {
        op: 'branch',
        if: { type: 'not', cond: { type: 'holding', target: 'requestedItem' } },
        then: [
          { op: 'moveToward', target: 'requestedItem', maxSteps: 40 },
          { op: 'branch', if: { type: 'lastMoveBlocked' }, then: [{ op: 'abort', reason: 'camino-bloqueado' }] },
          { op: 'pickup', target: 'requestedItem' },
          { op: 'branch', if: { type: 'lastActionFailed' }, then: [{ op: 'abort', reason: 'no-pude-recogerlo' }] },
        ],
      },
    ];
    return compiled(
      args.amount > 1 ? [{ op: 'repeatWithLimit', max: args.amount, body: fetchOne }] : fetchOne,
    );
  },
  verify(args, context): GoalCondition {
    if (args.entityId) return { type: 'holding', entity: entityRef(args) };
    const kind = args.kind!;
    // La línea de base se captura AHORA —«uno más de los que ya tenía»— más lo
    // que los pasos anteriores de este mismo plan ya prometieron traer. Sin ese
    // segundo sumando, el segundo «recogé un tronco» de un plan nace cumplido:
    // se la vio traer uno, saltear el otro por «ya sostengo uno» y llegar al
    // final con la mitad de lo que le pidieron.
    const planned = context.plannedGains?.get(kind) ?? 0;
    return {
      type: 'holding',
      entity: { kind },
      count: heldOf(context.perception, kind) + planned + args.amount,
    };
  },
  /**
   * Lo que falla al ir a buscar algo casi siempre es que el algo se movió: se
   * lo llevaron, cayó al agua, apareció otro más cerca. El camino, igual: lo
   * que estaba despejado se cerró. Las dos cosas se arreglan mirando de nuevo,
   * y llevarle al cuidador un «no pude recogerlo» con dos troncos nuevos a la
   * vista sería rendirse antes de mirar.
   */
  retriable: (reason) =>
    reason === 'no-pude-recogerlo' || reason === 'camino-bloqueado' || reason === 'no-candidates',
  recover(args, block) {
    // Lo que ninguna receta produce se saca del mundo a golpes. No es rendirse:
    // es que la materia base no viene suelta, viene dentro de otra cosa.
    if (block.reason !== 'missing-material' || !args.kind) return [];
    return [
      {
        capabilityId: 'entity.harvest',
        args: { kind: args.kind },
        rationale: `no hay ${kindLabel(args.kind)} suelto: hay que sacarlo rompiendo algo`,
      },
    ];
  },
  describe(args) {
    if (args.amount > 1 && args.kind) return `junto ${countedKindLabel(args.kind, args.amount)}`;
    return `recojo ${args.kind ? kindWithArticle(args.kind) : 'eso'}`;
  },
};

// ---------------------------------------------------------------------------
// item.consume
// ---------------------------------------------------------------------------

interface ConsumeArgs {
  kind?: string;
  entityId?: string;
}

const itemConsume: Capability<ConsumeArgs> = {
  id: 'item.consume',
  summary: 'alcanzar algo comestible y comerlo',
  risk: 'irreversible',
  params: [
    { name: 'kind', type: 'kind', required: false, description: 'nombre interno de lo que hay que comer' },
    { name: 'entityId', type: 'entity-id', required: false, description: 'identidad concreta ya resuelta' },
  ],
  ground(raw) {
    const args = objectOf(raw);
    const entityId = readOptionalId(args, 'entityId');
    const kindValue = typeof args.kind === 'string' ? args.kind.trim() : '';
    if (!entityId && kindValue.length === 0) return err('item.consume necesita kind o entityId');
    return ok({ ...(kindValue ? { kind: kindValue } : {}), ...(entityId ? { entityId } : {}) });
  },
  cost: () => 3,
  preconditions: (args): CausalCondition[] =>
    args.entityId
      ? [{ fluent: causalFluent.present(args.entityId), comparison: 'at-least', value: 1 }]
      : [],
  effects: (args): CausalEffect[] =>
    args.entityId
      ? [{ fluent: causalFluent.present(args.entityId), operation: 'set', value: 0, knowledge: 'known' }]
      : [],
  compile(args, context) {
    const query = targetQuery(args);
    return compiled([
      ...rememberedApproach(context, args.entityId),
      searchFor(query),
      { op: 'findEntities', query, store: 'requestedFoods' },
      { op: 'selectTarget', from: 'requestedFoods', strategy: 'nearest', store: 'requestedFood' },
      {
        op: 'branch',
        if: { type: 'not', cond: { type: 'holding', target: 'requestedFood' } },
        then: [
          { op: 'moveToward', target: 'requestedFood', maxSteps: 40 },
          { op: 'branch', if: { type: 'lastMoveBlocked' }, then: [{ op: 'abort', reason: 'camino-bloqueado' }] },
        ],
      },
      { op: 'consume', target: 'requestedFood' },
      { op: 'branch', if: { type: 'lastActionFailed' }, then: [{ op: 'abort', reason: 'no-pude-comerlo' }] },
    ]);
  },
  // Con la identidad resuelta, que ESE ejemplar ya no esté es prueba. Por tipo
  // no: con tres manzanas delante, «ya no hay manzanas» no es lo que se pidió.
  verify: (args): GoalCondition | null =>
    args.entityId ? { type: 'entity-present', entity: entityRef(args), present: false } : null,
  describe: (args) => `como ${args.kind ? kindWithArticle(args.kind) : 'eso'}`,
};

// ---------------------------------------------------------------------------
// item.place-at
// ---------------------------------------------------------------------------

interface PlaceArgs {
  kind: string;
  onKind: string;
  placement: 'at' | 'near';
}

const itemPlaceAt: Capability<PlaceArgs> = {
  id: 'item.place-at',
  summary: 'llevar un objeto y dejarlo sobre (o junto a) un lugar nombrado por lo que hay ahí',
  risk: 'reversible',
  params: [
    { name: 'kind', type: 'kind', required: true, description: 'el objeto que hay que poner' },
    { name: 'onKind', type: 'kind', required: true, description: 'lo que hay en el lugar de destino' },
    { name: 'placement', type: 'placement', required: false, description: '"at" (misma celda) o "near" (al lado)' },
  ],
  ground(raw) {
    const kind = readKind(raw, 'kind');
    if (!kind.ok) return kind;
    const onKind = readKind(raw, 'onKind');
    if (!onKind.ok) return onKind;
    const placementRaw = objectOf(raw).placement;
    return ok({
      kind: kind.value,
      onKind: onKind.value,
      placement: placementRaw === 'near' ? ('near' as const) : ('at' as const),
    });
  },
  cost: () => 6,
  preconditions: (args): CausalCondition[] => [
    { fluent: causalFluent.loose(args.kind), comparison: 'at-least', value: 1 },
  ],
  effects: () => [],
  compile(args) {
    const query: EntityQuery = { kind: args.kind };
    // La celda es la del sitio, no un offset desde donde ella esté parada: sin
    // `markTarget` esto no se puede escribir, y «ponelo sobre el agua»
    // terminaba desviado a inventar una interacción para un verbo que el mundo
    // ya sabía hacer.
    const placement: SkillOp[] =
      args.placement === 'near'
        ? [{ op: 'drop', target: 'block' }]
        : [
            { op: 'markTarget', from: 'spot', store: 'spotCell' },
            { op: 'placeAt', kind: args.kind, target: 'spotCell' },
          ];
    return compiled([
      searchFor(query),
      { op: 'findEntities', query, store: 'toPlace' },
      { op: 'selectTarget', from: 'toPlace', strategy: 'nearest', store: 'block' },
      {
        op: 'branch',
        if: { type: 'not', cond: { type: 'holding', target: 'block' } },
        then: [
          { op: 'moveToward', target: 'block', maxSteps: 40 },
          { op: 'pickup', target: 'block' },
          { op: 'branch', if: { type: 'lastActionFailed' }, then: [{ op: 'abort', reason: 'no-pude-recogerlo' }] },
        ],
      },
      searchFor({ kind: args.onKind }),
      { op: 'findEntities', query: { kind: args.onKind }, store: 'spots' },
      { op: 'selectTarget', from: 'spots', strategy: 'nearest', store: 'spot' },
      // Al lado, no encima: para colocar hay que llegar con el brazo, y la
      // celda de destino puede ser justamente la que no se puede pisar.
      { op: 'moveToward', target: 'spot', maxSteps: 40, stopAtDistance: 1 },
      ...placement,
      { op: 'branch', if: { type: 'lastActionFailed' }, then: [{ op: 'abort', reason: 'no-pude-colocarlo' }] },
    ]);
  },
  verify: (args): GoalCondition => ({
    type: 'entity-distance',
    entity: { kind: args.kind },
    target: { kind: args.onKind },
    metric: 'chebyshev',
    atMost: args.placement === 'near' ? 1 : 0,
  }),
  describe: (args) =>
    args.placement === 'near'
      ? `dejo ${kindWithArticle(args.kind)} junto a ${kindWithArticle(args.onKind)}`
      : `pongo ${kindWithArticle(args.kind)} sobre ${kindWithArticle(args.onKind)}`,
};

// ---------------------------------------------------------------------------
// entity.harvest — romper algo con la mejor herramienta que tenga
// ---------------------------------------------------------------------------

interface HarvestArgs {
  kind?: string;
  entityId?: string;
}

const entityHarvest: Capability<HarvestArgs> = {
  id: 'entity.harvest',
  summary: 'conseguir la mejor herramienta y romper un objeto hasta que ceda',
  risk: 'irreversible',
  params: [
    { name: 'kind', type: 'kind', required: false, description: 'nombre interno de lo que hay que romper' },
    { name: 'entityId', type: 'entity-id', required: false, description: 'identidad concreta ya resuelta' },
  ],
  ground(raw) {
    const args = objectOf(raw);
    const entityId = readOptionalId(args, 'entityId');
    const kindValue = typeof args.kind === 'string' ? args.kind.trim() : '';
    if (!entityId && kindValue.length === 0) return err('entity.harvest necesita kind o entityId');
    return ok({ ...(kindValue ? { kind: kindValue } : {}), ...(entityId ? { entityId } : {}) });
  },
  cost: () => 12,
  preconditions: (args): CausalCondition[] =>
    args.entityId
      ? [{ fluent: causalFluent.present(args.entityId), comparison: 'at-least', value: 1 }]
      : [],
  effects: (args): CausalEffect[] =>
    args.entityId
      ? [{ fluent: causalFluent.present(args.entityId), operation: 'set', value: 0, knowledge: 'known' }]
      : [],
  compile(args, context) {
    const query = targetQuery(args);
    return compiled([
      // La herramienta primero: buscar el objetivo después la deja fresca en la
      // percepción (recoger la herramienta pudo llevarla lejos de él).
      searchFor({ tool: true }),
      { op: 'findEntities', query: { tool: true }, store: 'availableTools' },
      { op: 'selectTarget', from: 'availableTools', strategy: 'strongestTool', store: 'bestTool' },
      {
        op: 'branch',
        if: { type: 'not', cond: { type: 'holding', target: 'bestTool' } },
        then: [
          { op: 'moveToward', target: 'bestTool', maxSteps: 40 },
          { op: 'pickup', target: 'bestTool' },
          {
            op: 'branch',
            if: { type: 'lastActionFailed' },
            then: [{ op: 'abort', reason: 'no-pude-recoger-la-herramienta' }],
          },
        ],
      },
      ...rememberedApproach(context, args.entityId),
      searchFor(query),
      { op: 'findEntities', query, store: 'requestedTargets' },
      { op: 'selectTarget', from: 'requestedTargets', strategy: 'nearest', store: 'requestedTarget' },
      { op: 'moveToward', target: 'requestedTarget', maxSteps: 40 },
      { op: 'branch', if: { type: 'lastMoveBlocked' }, then: [{ op: 'abort', reason: 'camino-bloqueado' }] },
      {
        op: 'repeatWithLimit',
        max: 20,
        until: { type: 'entityGone', ref: 'requestedTarget' },
        body: [
          { op: 'useItem', item: 'bestTool', target: 'requestedTarget' },
          // Golpear no es insistir a ciegas: si el golpe no cambió nada, un
          // solo intento ya lo prueba.
          {
            op: 'branch',
            if: { type: 'lastActionUnaffected' },
            then: [{ op: 'abort', reason: 'objetivo-inmune' }],
          },
          {
            op: 'branch',
            if: { type: 'lastStrikeIneffective' },
            then: [{ op: 'abort', reason: 'objetivo-muy-duro' }],
          },
        ],
      },
      {
        op: 'branch',
        if: { type: 'not', cond: { type: 'entityGone', ref: 'requestedTarget' } },
        then: [{ op: 'abort', reason: 'objetivo-resistió' }],
      },
    ]);
  },
  // Igual que al comer: por tipo, «ya no hay árboles» con un bosque delante
  // sería pedir la tala del bosque. El ejemplar que cayó lo ligó el motor y la
  // condición del objetivo sabe cuál fue.
  verify: (args): GoalCondition | null =>
    args.entityId ? { type: 'entity-present', entity: entityRef(args), present: false } : null,
  describe: (args) => `rompo ${args.kind ? kindWithArticle(args.kind) : 'eso'}`,
};

// ---------------------------------------------------------------------------
// entity.harvest-with-tool — romper con la herramienta que ya lleva
// ---------------------------------------------------------------------------

interface HarvestWithToolArgs {
  sourceKind: string;
  toolKind: string;
  hits: number;
}

/**
 * La misma cosecha, pero cuando la herramienta ya está resuelta.
 *
 * Es una capacidad distinta y no una variante con bandera porque sus
 * precondiciones son otras: `entity.harvest` sale a conseguir con qué golpear,
 * y esta da por hecho que lo tiene. La usa el planificador causal, donde
 * conseguir la herramienta ya es un paso propio de la cadena y repetirlo acá
 * mandaría a la mascota a buscar un hacha que lleva en la mano.
 */
const entityHarvestWithTool: Capability<HarvestWithToolArgs> = {
  id: 'entity.harvest-with-tool',
  summary: 'romper algo de un tipo con la herramienta que ya lleva encima',
  risk: 'irreversible',
  params: [
    { name: 'sourceKind', type: 'kind', required: true, description: 'lo que hay que romper' },
    { name: 'toolKind', type: 'kind', required: true, description: 'la herramienta que ya lleva' },
    { name: 'hits', type: 'count', required: false, description: 'cuántos golpes calcula que hacen falta' },
  ],
  ground(raw) {
    const sourceKind = readKind(raw, 'sourceKind');
    if (!sourceKind.ok) return sourceKind;
    const toolKind = readKind(raw, 'toolKind');
    if (!toolKind.ok) return toolKind;
    return ok({ sourceKind: sourceKind.value, toolKind: toolKind.value, hits: readCount(raw, 'hits', 20, 50) });
  },
  cost: (args) => args.hits + 1,
  preconditions: (args): CausalCondition[] => [
    { fluent: causalFluent.inventory(args.toolKind), comparison: 'at-least', value: 1 },
  ],
  effects: () => [],
  compile: (args) =>
    compiled([
      { op: 'findEntities', query: { kind: args.toolKind, held: true, tool: true }, store: 'harvestTools' },
      { op: 'selectTarget', from: 'harvestTools', strategy: 'strongestTool', store: 'harvestTool' },
      { op: 'gpsTo', kind: args.sourceKind, maxSteps: 50, store: 'harvestSource' },
      {
        op: 'repeatWithLimit',
        max: args.hits,
        until: { type: 'entityGone', ref: 'harvestSource' },
        body: [
          { op: 'useItem', item: 'harvestTool', target: 'harvestSource' },
          { op: 'branch', if: { type: 'lastStrikeIneffective' }, then: [{ op: 'abort', reason: 'objetivo-muy-duro' }] },
          { op: 'branch', if: { type: 'lastActionUnaffected' }, then: [{ op: 'abort', reason: 'objetivo-inmune' }] },
        ],
      },
      {
        op: 'branch',
        if: { type: 'not', cond: { type: 'entityGone', ref: 'harvestSource' } },
        then: [{ op: 'abort', reason: 'objetivo-resistió' }],
      },
    ]),
  // El ejemplar que se rompió lo eligió el GPS en tiempo de ejecución, y no hay
  // predicado por tipo que distinga «rompí uno» de «no queda ninguno».
  verify: (): GoalCondition | null => null,
  describe: (args) => `rompo ${kindWithArticle(args.sourceKind)} con ${kindWithArticle(args.toolKind)}`,
};

// ---------------------------------------------------------------------------
// craft.recipe
// ---------------------------------------------------------------------------

interface CraftArgs {
  recipeId: string;
  /**
   * Juntar lo que falte como parte del paso. Es lo natural cuando el pedido
   * llega del cuidador («hacé una fogata» incluye ir por los troncos), y es
   * justo lo que NO hay que hacer cuando el paso viene de una cadena causal:
   * ahí los ingredientes ya son pasos propios del plan, y volver a juntarlos
   * acá recorrería el mapa dos veces por lo mismo.
   */
  gather: boolean;
}

const craftRecipe: Capability<CraftArgs> = {
  id: 'craft.recipe',
  summary: 'reunir los ingredientes que falten y fabricar según una receta del mundo',
  risk: 'consuming',
  params: [
    { name: 'recipeId', type: 'recipe-id', required: true, description: 'id exacto de una receta que el mundo admite' },
    { name: 'gather', type: 'flag', required: false, description: 'juntar los ingredientes que falten (sí por defecto)' },
  ],
  ground(raw, context) {
    const recipeId = readKind(raw, 'recipeId');
    if (!recipeId.ok) return recipeId;
    if (!context.perception.recipes.some((recipe) => recipe.id === recipeId.value)) {
      return err(`el mundo no conoce la receta "${recipeId.value}"`);
    }
    return ok({ recipeId: recipeId.value, gather: objectOf(raw).gather !== false });
  },
  cost: () => 10,
  preconditions(args, context): CausalCondition[] {
    const recipe = context.perception.recipes.find((candidate) => candidate.id === args.recipeId);
    return (recipe?.ingredients ?? []).map((ingredient) => ({
      fluent: causalFluent.inventory(ingredient.kind),
      comparison: 'at-least' as const,
      value: ingredient.count,
    }));
  },
  effects(args, context): CausalEffect[] {
    const recipe = context.perception.recipes.find((candidate) => candidate.id === args.recipeId);
    if (!recipe) return [];
    const product = recipeProductKinds(recipe)[0];
    return product
      ? [{ fluent: causalFluent.loose(product), operation: 'increase', value: 1, knowledge: 'known' }]
      : [];
  },
  compile(args, context) {
    const recipe = context.perception.recipes.find((candidate) => candidate.id === args.recipeId);
    if (!recipe) {
      return { ok: false, block: { reason: 'unknown-in-world', detail: `sin receta: ${args.recipeId}` } };
    }
    if (!args.gather) {
      return compiled([
        { op: 'craft', recipeId: args.recipeId },
        { op: 'branch', if: { type: 'lastActionFailed' }, then: [{ op: 'abort', reason: 'no-pude-fabricarlo' }] },
      ]);
    }
    // Juntar lo que falte es parte de construir. Si ya lleva todo encima, la
    // recolección se salta sola y el mundo revalida los ingredientes por su
    // cuenta. Con el árbol a la vista (ADR 0031), las piezas que sabe hacer son
    // un paso más de la obra; y la materia base que no sale de ninguna receta,
    // del mundo a golpes.
    return compiled(
      gatherAndCraftProgram(recipe, {
        held: heldCounts(context.perception),
        searchFirst: true,
        recipes: context.perception.recipes,
        rememberedWalk: context.deps.rememberedWalk,
        harvestSource: context.deps.harvestSource,
      }),
    );
  },
  verify(args, context): GoalCondition | null {
    const recipe = context.perception.recipes.find((candidate) => candidate.id === args.recipeId);
    const product = recipe ? recipeProductKinds(recipe)[0] : undefined;
    if (!product) return null;
    // El ejemplar que nació lo LIGA el motor al resolver la fabricación, y esa
    // ligadura es la única prueba que no se confunde con lo que ya había.
    //
    // Contarlo en la mano no sirve: lo fabricado cae al suelo si las manos
    // están llenas, y una fogata no se levanta nunca. Contarlo por tipo tampoco:
    // con una tabla ya tirada en el pasto, «hay una tabla» era cierto antes de
    // empezar. Mientras nada se ligó, la condición vale `unknown` — ni se da
    // por hecho el paso ni se lo da por fallado: se ejecuta.
    return { type: 'entity-present', entity: { binding: 'product', kind: product }, present: true };
  },
  describe: (args) => `fabrico ${kindWithArticle(args.recipeId)}`,
};

// ---------------------------------------------------------------------------
// build.blueprint
// ---------------------------------------------------------------------------

interface BuildArgs {
  blueprintId: string;
}

const buildBlueprint: Capability<BuildArgs> = {
  id: 'build.blueprint',
  summary: 'elegir sitio, juntar los bloques y levantar una obra según su plano',
  risk: 'consuming',
  params: [
    { name: 'blueprintId', type: 'blueprint-id', required: true, description: 'id exacto de un plano que el mundo admite' },
  ],
  ground(raw, context) {
    const blueprintId = readKind(raw, 'blueprintId');
    if (!blueprintId.ok) return blueprintId;
    if (!context.perception.blueprints.some((blueprint) => blueprint.id === blueprintId.value)) {
      return err(`el mundo no conoce el plano "${blueprintId.value}"`);
    }
    return ok({ blueprintId: blueprintId.value });
  },
  cost: () => 40,
  preconditions: () => [],
  effects: () => [],
  compile(args, context) {
    const blueprint = context.perception.blueprints.find((b) => b.id === args.blueprintId);
    if (!blueprint) {
      return { ok: false, block: { reason: 'unknown-in-world', detail: `sin plano: ${args.blueprintId}` } };
    }
    // Dónde va la obra lo decide el agente (tiene el sitio guardado) y no el
    // generador: plantarla donde esté parada la mudaba en cada reanudación y
    // podía pedir celdas ocupadas (ADR 0049). Sin sitio no se levanta nada
    // (ADR 0071): no tener dónde construir es una respuesta legítima.
    const site = context.deps.structureSite(blueprint);
    if (!site) {
      return { ok: false, block: { reason: 'no-place', detail: `sin sitio para ${args.blueprintId}` } };
    }
    return compiled(
      buildStructureProgram(blueprint, {
        held: heldCounts(context.perception),
        recipes: context.perception.recipes,
        rememberedWalk: context.deps.rememberedWalk,
        harvestSource: context.deps.harvestSource,
        capacity: context.perception.self.inventoryCapacity,
        approach: site.approach,
        pending: site.pending,
      }),
    );
  },
  verify: (args): GoalCondition => ({ type: 'blueprint-complete', blueprintId: args.blueprintId }),
  describe: (args) => `levanto ${kindWithArticle(args.blueprintId)}`,
};

// ---------------------------------------------------------------------------
// world.interact
// ---------------------------------------------------------------------------

interface InteractArgs {
  /** El verbo que dijo el cuidador. Se resuelve contra lo que ya aprendió. */
  verb?: string;
  /** O la interacción ya elegida, cuando quien planificó ya la identificó. */
  interactionId?: string;
  kind?: string;
  entityId?: string;
}

/** La interacción que este paso va a ejecutar, venga por verbo o por id. */
function resolveInteraction(args: InteractArgs, context: CapabilityContext) {
  if (args.interactionId) {
    return context.perception.interactions.find((candidate) => candidate.id === args.interactionId);
  }
  if (!args.verb || !args.kind) return undefined;
  // Reuso primero: si ya está en world.interactions no cuesta ni una consulta.
  return context.deps.findInteraction(args.verb, args.kind, context.perception);
}

const worldInteract: Capability<InteractArgs> = {
  id: 'world.interact',
  summary: 'ejecutar sobre un objeto una interacción que el mundo ya admite',
  risk: 'consuming',
  params: [
    { name: 'verb', type: 'text', required: false, description: 'el verbo pedido, en infinitivo con guiones' },
    { name: 'interactionId', type: 'interaction-id', required: false, description: 'la interacción ya elegida' },
    { name: 'kind', type: 'kind', required: false, description: 'nombre interno de lo que recibe la acción' },
    { name: 'entityId', type: 'entity-id', required: false, description: 'identidad concreta ya resuelta' },
  ],
  ground(raw) {
    const args = objectOf(raw);
    const verb = readOptionalId(args, 'verb');
    const interactionId = readOptionalId(args, 'interactionId');
    const kind = readOptionalId(args, 'kind');
    const entityId = readOptionalId(args, 'entityId');
    if (!verb && !interactionId) return err('world.interact necesita verb o interactionId');
    if (!kind && !entityId) return err('world.interact necesita kind o entityId');
    if (verb && !kind) return err('world.interact por verbo necesita el tipo del objetivo');
    return ok({
      ...(verb ? { verb } : {}),
      ...(interactionId ? { interactionId } : {}),
      ...(kind ? { kind } : {}),
      ...(entityId ? { entityId } : {}),
    });
  },
  cost: () => 5,
  preconditions: () => [],
  effects: () => [],
  compile(args, context) {
    // Sin interacción no hay programa — o el juez la vetó, o el crédito de
    // inventar se agotó sin que el mundo aceptara ninguna (ADR 0027).
    const interaction = resolveInteraction(args, context);
    if (!interaction) {
      return {
        ok: false,
        block: {
          reason: 'unknown-in-world',
          detail: `sin interacción para "${args.verb ?? args.interactionId}" sobre ${args.kind ?? args.entityId}`,
        },
      };
    }
    const query = targetQuery(args);
    const ops: SkillOp[] = [];
    // Lo que exige llevar se junta primero, como los ingredientes de una
    // receta: ir a interactuar sin el balde es ir a fallar.
    if (interaction.requires) {
      const requiredQuery: EntityQuery = { kind: interaction.requires.heldKind };
      ops.push(
        searchFor(requiredQuery),
        { op: 'findEntities', query: requiredQuery, store: 'requiredItems' },
        { op: 'selectTarget', from: 'requiredItems', strategy: 'nearest', store: 'requiredItem' },
        {
          op: 'branch',
          if: { type: 'not', cond: { type: 'holding', target: 'requiredItem' } },
          then: [
            { op: 'moveToward', target: 'requiredItem', maxSteps: 40 },
            { op: 'pickup', target: 'requiredItem' },
            { op: 'branch', if: { type: 'lastActionFailed' }, then: [{ op: 'abort', reason: 'no-pude-recogerlo' }] },
          ],
        },
      );
    }
    ops.push(
      ...rememberedApproach(context, args.entityId),
      searchFor(query),
      { op: 'findEntities', query, store: 'interactTargets' },
      { op: 'selectTarget', from: 'interactTargets', strategy: 'nearest', store: 'interactTarget' },
    );
    if (interaction.stance === 'held') {
      // El objetivo tiene que ir en la mano: recogerlo es parte del pedido.
      ops.push({
        op: 'branch',
        if: { type: 'not', cond: { type: 'holding', target: 'interactTarget' } },
        then: [
          { op: 'moveToward', target: 'interactTarget', maxSteps: 40 },
          { op: 'pickup', target: 'interactTarget' },
          { op: 'branch', if: { type: 'lastActionFailed' }, then: [{ op: 'abort', reason: 'no-pude-recogerlo' }] },
        ],
      });
    } else {
      ops.push(
        // Adyacente alcanza para TODAS las posturas: en encima/debajo el propio
        // acto de interactuar sube a la mascota a la celda del objeto.
        { op: 'moveToward', target: 'interactTarget', maxSteps: 40, stopAtDistance: 1 },
        { op: 'branch', if: { type: 'lastMoveBlocked' }, then: [{ op: 'abort', reason: 'camino-bloqueado' }] },
      );
    }
    ops.push(
      { op: 'interact', interactionId: interaction.id, target: 'interactTarget' },
      { op: 'branch', if: { type: 'lastActionFailed' }, then: [{ op: 'abort', reason: 'no-pude-interactuar' }] },
    );
    return compiled(ops);
  },
  // El veredicto de una interacción lo emite el motor al resolverla, como un
  // hecho acotado al objetivo. Acá no hay predicado por tipo que sirva: lo que
  // se transformó puede ser indistinguible de lo que ya había.
  verify: (): GoalCondition | null => null,
  describe(args, context) {
    const verb = (args.verb ?? resolveInteraction(args, context)?.description ?? 'hacer eso').replace(/-/g, ' ');
    return args.kind ? `${verb} con ${kindWithArticle(args.kind)}` : verb;
  },
};

// ---------------------------------------------------------------------------
// move.direction
// ---------------------------------------------------------------------------

interface MoveArgs {
  directions: Direction[];
}

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

const moveDirection: Capability<MoveArgs> = {
  id: 'move.direction',
  summary: 'dar una serie de pasos en las direcciones pedidas',
  risk: 'reversible',
  params: [
    { name: 'directions', type: 'direction-list', required: true, description: 'up/down/left/right en el orden pedido' },
  ],
  ground(raw) {
    const value = objectOf(raw).directions;
    if (!Array.isArray(value) || value.length === 0) return err('move.direction necesita al menos una dirección');
    const directions = value.filter((dir): dir is Direction => DIRECTIONS.includes(dir as Direction));
    if (directions.length !== value.length) return err('direcciones inválidas: solo up/down/left/right');
    if (directions.length > 20) return err('demasiadas direcciones (máximo 20)');
    return ok({ directions });
  },
  cost: (args) => args.directions.length,
  preconditions: () => [],
  effects: () => [],
  compile(args) {
    const program: SkillOp[] = [];
    for (const dir of args.directions) {
      program.push(
        { op: 'moveStep', dir },
        { op: 'branch', if: { type: 'lastActionFailed' }, then: [{ op: 'abort', reason: 'camino-bloqueado' }] },
      );
    }
    return compiled(program);
  },
  verify(args, context): GoalCondition {
    const position = { ...context.perception.self.position };
    for (const dir of args.directions) {
      if (dir === 'up') position.y -= 1;
      if (dir === 'down') position.y += 1;
      if (dir === 'left') position.x -= 1;
      if (dir === 'right') position.x += 1;
    }
    return { type: 'self-at', position };
  },
  describe(args) {
    const labels = { up: 'hacia arriba', down: 'hacia abajo', left: 'a la izquierda', right: 'a la derecha' } as const;
    return `me muevo ${args.directions.map((dir) => labels[dir]).join(' y ')}`;
  },
};

// ---------------------------------------------------------------------------
// spatial.relate
// ---------------------------------------------------------------------------

interface SpatialArgs {
  grounding: SpatialGrounding;
}

const RELATIONS: SpatialRelation[] = ['opposite-side', 'near', 'far-from'];

const spatialRelate: Capability<SpatialArgs> = {
  id: 'spatial.relate',
  summary: 'terminar en una relación geométrica con algo: cruzar al otro lado, acercarse, alejarse',
  risk: 'reversible',
  params: [
    { name: 'grounding', type: 'spatial-grounding', required: true, description: 'la geometría ya anclada al mundo' },
  ],
  ground(raw) {
    const grounding = objectOf(raw).grounding as SpatialGrounding | undefined;
    if (!grounding || !RELATIONS.includes(grounding.relation)) {
      return err('spatial.relate necesita una geometría anclada con una relación conocida');
    }
    if (!grounding.destination || typeof grounding.destination.x !== 'number') {
      return err('la geometría no tiene destino');
    }
    return ok({ grounding });
  },
  cost: () => 15,
  preconditions: () => [],
  effects: () => [],
  compile: (args) => compiled(spatialRequestProgram(args.grounding)),
  verify: (args): GoalCondition => ({ type: 'self-spatial', grounding: args.grounding }),
  describe(args) {
    const of = kindAfterOf(args.grounding.referenceKind);
    if (args.grounding.relation === 'opposite-side') return `cruzo al otro lado ${of}`;
    return args.grounding.relation === 'near'
      ? `me acerco ${kindAfterTo(args.grounding.referenceKind)}`
      : `me alejo ${of}`;
  },
};

// ---------------------------------------------------------------------------
// wait.here
// ---------------------------------------------------------------------------

interface WaitArgs {
  ticks: number;
}

const waitHere: Capability<WaitArgs> = {
  id: 'wait.here',
  summary: 'quedarse quieta donde está durante un rato',
  risk: 'reversible',
  params: [{ name: 'ticks', type: 'count', required: false, description: 'cuántos ticks esperar (6 por defecto)' }],
  ground: (raw) => ok({ ticks: readCount(raw, 'ticks', 6, 50) }),
  cost: (args) => args.ticks,
  preconditions: () => [],
  effects: () => [],
  compile: (args) => compiled([{ op: 'wait', ticks: args.ticks }]),
  // Esperar no cambia el mundo: no hay nada que comprobar en él. Lo que dice si
  // esperó lo bastante es la condición del objetivo, que cuenta sus ticks.
  verify: (): GoalCondition | null => null,
  describe: () => 'espero acá',
};

// ---------------------------------------------------------------------------
// skill.run — una habilidad estable ejecutada como macro
// ---------------------------------------------------------------------------

interface RunSkillArgs {
  skillName: string;
}

const skillRun: Capability<RunSkillArgs> = {
  id: 'skill.run',
  summary: 'ejecutar una conducta que ya aprendió y quedó probada',
  risk: 'consuming',
  params: [
    { name: 'skillName', type: 'skill-name', required: true, description: 'nombre exacto de una habilidad estable' },
  ],
  ground(raw, context) {
    const name = readKind(raw, 'skillName');
    if (!name.ok) return name;
    if (!context.deps.library.findStable(name.value)) {
      return err(`no tengo ninguna habilidad estable llamada "${name.value}"`);
    }
    return ok({ skillName: name.value });
  },
  cost: () => 20,
  preconditions: () => [],
  effects: () => [],
  compile(args, context) {
    // Solo se ejecuta lo que pasó por el evaluador: una habilidad que ya no
    // está estable (deprecada por una versión peor, archivada) no se corre por
    // inercia.
    const stable = context.deps.library.findStable(args.skillName);
    if (!stable) {
      return { ok: false, block: { reason: 'unknown-in-world', detail: `habilidad no estable: ${args.skillName}` } };
    }
    return compiled([{ op: 'runSkill', skillId: stable.id }]);
  },
  // Que la habilidad exista ya era cierto antes de correrla: como predicado de
  // efecto no dice nada. La vara de una macro son los criterios con los que se
  // la promovió, y esos ya viajan en la condición del objetivo.
  verify: (): GoalCondition | null => null,
  describe: (args) => `hago "${args.skillName}"`,
};

// ---------------------------------------------------------------------------

/**
 * El registro que usa el agente. Es una función y no una constante porque cada
 * mascota debería poder tener el suyo: el catálogo es del individuo, no del
 * módulo, y compartir una instancia mutable entre partidas fue exactamente el
 * tipo de acoplamiento que el resto del proyecto evita.
 */
export function createCapabilityRegistry(): CapabilityRegistry {
  return new CapabilityRegistry()
    .register(exploreUntilSees)
    .register(itemPickup)
    .register(itemConsume)
    .register(itemPlaceAt)
    .register(entityHarvest)
    .register(entityHarvestWithTool)
    .register(craftRecipe)
    .register(buildBlueprint)
    .register(worldInteract)
    .register(moveDirection)
    .register(spatialRelate)
    .register(waitHere)
    .register(skillRun);
}

export type { CapabilityRecovery };
