import { chebyshev, manhattan, type Vec2 } from '@anima/shared';
import type { PerceivedEntity, Perception, TimeOfDay } from '@anima/sim-core';
import type { GoalMode, GoalUserRequest, SpatialGrounding } from './goals.js';
import { spatialGoalSatisfied } from './spatial-goals.js';

/** Referencia estable o ligada durante la ejecucion de un objetivo. */
export interface GoalEntityRef {
  id?: string;
  kind?: string;
  binding?: string;
}

/**
 * Algebra cerrada de estados observables. No contiene texto libre ni un
 * predicado "el programa termino": cada hoja se puede comprobar contra una
 * foto del mundo o evidencia emitida por el propio motor.
 */
export type GoalCondition =
  | { type: 'all'; conditions: GoalCondition[] }
  | { type: 'any'; conditions: GoalCondition[] }
  | { type: 'not'; condition: GoalCondition }
  | { type: 'constant'; value: boolean; reason: string }
  | { type: 'self-at'; position: Vec2 }
  | {
      type: 'self-distance-from';
      position: Vec2;
      metric: 'manhattan' | 'chebyshev';
      comparison: 'at-least' | 'at-most';
      value: number;
    }
  | {
      type: 'self-distance-to-entity';
      entity: GoalEntityRef;
      metric: 'manhattan' | 'chebyshev';
      comparison: 'at-least' | 'at-most';
      value: number;
    }
  | { type: 'self-spatial'; grounding: SpatialGrounding }
  | { type: 'holding'; entity: GoalEntityRef; count?: number }
  | {
      type: 'entity-distance';
      entity: GoalEntityRef;
      target: GoalEntityRef;
      metric: 'manhattan' | 'chebyshev';
      atMost: number;
    }
  | { type: 'entity-present'; entity: GoalEntityRef; present: boolean }
  | {
      type: 'self-stat';
      stat: 'energy' | 'health' | 'temperature';
      comparison: 'at-least' | 'at-most';
      value: number;
      normalized?: boolean;
    }
  | { type: 'blueprint-complete'; blueprintId: string }
  | { type: 'stable-skill-exists'; name: string }
  | { type: 'world-fact'; fact: string }
  | { type: 'counter'; counter: string; comparison: 'at-least' | 'at-most'; value: number }
  /** Qué hora del día es en el mundo. La mide el reloj, no una corazonada. */
  | { type: 'time-of-day'; phase: TimeOfDay }
  /**
   * El tick absoluto del mundo cruzó un umbral. Es la primitiva de los plazos:
   * "vence en el tick N". Como el tick es determinista y persiste, un plazo
   * sobrevive a guardar y restaurar sin ningún temporizador externo.
   */
  | { type: 'world-tick'; comparison: 'at-least' | 'at-most'; tick: number }
  /**
   * Cuántos ticks pasaron desde que el objetivo se ACTIVÓ (no desde que se
   * creó): así una duración pedida ("quedate diez segundos") se cuenta desde
   * que la mascota realmente empezó, incluso si el objetivo estuvo suspendido
   * esperando su condición de inicio. `unknown` mientras no haya arrancado.
   */
  | { type: 'elapsed'; comparison: 'at-least' | 'at-most'; ticks: number };

export interface GoalConditionContext {
  perception: Perception;
  bindings?: Readonly<Record<string, string>>;
  /** Identidades cuya desaparicion fue confirmada por el motor. */
  absentEntityIds?: ReadonlySet<string>;
  /** Hechos acotados al objetivo, producidos por eventos del mundo. */
  facts?: ReadonlySet<string>;
  counters?: Readonly<Record<string, number>>;
  /**
   * En qué tick se activó el objetivo, para medir duraciones con `elapsed`. El
   * tick actual y la hora del día NO viven acá: se leen de la percepción, que
   * siempre los trae, así una condición temporal nunca queda "sin reloj".
   */
  activatedAtTick?: number;
  blueprintComplete?(blueprintId: string): boolean | undefined;
  stableSkillExists?(name: string): boolean;
}

export type GoalConditionStatus = 'met' | 'unmet' | 'unknown';

export interface GoalConditionEvaluation {
  status: GoalConditionStatus;
  diagnostics: string[];
}

function result(status: GoalConditionStatus, diagnostic?: string): GoalConditionEvaluation {
  return { status, diagnostics: diagnostic ? [diagnostic] : [] };
}

function resolvedId(ref: GoalEntityRef, context: GoalConditionContext): string | undefined {
  return ref.id ?? (ref.binding ? context.bindings?.[ref.binding] : undefined);
}

function entitiesFor(ref: GoalEntityRef, context: GoalConditionContext): PerceivedEntity[] {
  const id = resolvedId(ref, context);
  if (ref.binding && !id) return [];
  return [...context.perception.self.heldItems, ...context.perception.visibleEntities].filter(
    (entity) => (!id || entity.id === id) && (!ref.kind || entity.kind === ref.kind),
  );
}

function refLabel(ref: GoalEntityRef, context: GoalConditionContext): string {
  return resolvedId(ref, context) ?? ref.kind ?? ref.binding ?? 'entidad';
}

function combineAll(evaluations: GoalConditionEvaluation[]): GoalConditionEvaluation {
  if (evaluations.some((evaluation) => evaluation.status === 'unmet')) {
    return {
      status: 'unmet',
      diagnostics: evaluations.flatMap((evaluation) =>
        evaluation.status === 'unmet' ? evaluation.diagnostics : [],
      ),
    };
  }
  if (evaluations.some((evaluation) => evaluation.status === 'unknown')) {
    return {
      status: 'unknown',
      diagnostics: evaluations.flatMap((evaluation) =>
        evaluation.status === 'unknown' ? evaluation.diagnostics : [],
      ),
    };
  }
  return result('met');
}

function combineAny(evaluations: GoalConditionEvaluation[]): GoalConditionEvaluation {
  if (evaluations.some((evaluation) => evaluation.status === 'met')) return result('met');
  if (evaluations.some((evaluation) => evaluation.status === 'unknown')) {
    return {
      status: 'unknown',
      diagnostics: evaluations.flatMap((evaluation) => evaluation.diagnostics),
    };
  }
  return {
    status: 'unmet',
    diagnostics: evaluations.flatMap((evaluation) => evaluation.diagnostics),
  };
}

/** Evaluacion total, pura y determinista de una condicion. */
export function evaluateGoalCondition(
  condition: GoalCondition,
  context: GoalConditionContext,
): GoalConditionEvaluation {
  switch (condition.type) {
    case 'all':
      return combineAll(condition.conditions.map((child) => evaluateGoalCondition(child, context)));
    case 'any':
      return combineAny(condition.conditions.map((child) => evaluateGoalCondition(child, context)));
    case 'not': {
      const inner = evaluateGoalCondition(condition.condition, context);
      return inner.status === 'unknown'
        ? inner
        : { status: inner.status === 'met' ? 'unmet' : 'met', diagnostics: inner.diagnostics };
    }
    case 'constant':
      return result(
        condition.value ? 'met' : 'unmet',
        condition.value ? undefined : condition.reason,
      );
    case 'self-at': {
      const position = context.perception.self.position;
      const met = position.x === condition.position.x && position.y === condition.position.y;
      return result(
        met ? 'met' : 'unmet',
        met
          ? undefined
          : `posicion:${position.x},${position.y};esperada:${condition.position.x},${condition.position.y}`,
      );
    }
    case 'self-distance-from': {
      const distance =
        condition.metric === 'manhattan'
          ? manhattan(context.perception.self.position, condition.position)
          : chebyshev(context.perception.self.position, condition.position);
      const met =
        condition.comparison === 'at-least'
          ? distance >= condition.value
          : distance <= condition.value;
      return result(met ? 'met' : 'unmet', met ? undefined : `desplazamiento:${distance}`);
    }
    case 'self-distance-to-entity': {
      const targets = entitiesFor(condition.entity, context).filter((entity) => entity.position);
      if (targets.length === 0) {
        return result('unknown', `sin-posicion:${refLabel(condition.entity, context)}`);
      }
      const distance = Math.min(
        ...targets.map((target) =>
          condition.metric === 'manhattan'
            ? manhattan(context.perception.self.position, target.position!)
            : chebyshev(context.perception.self.position, target.position!),
        ),
      );
      const met =
        condition.comparison === 'at-least'
          ? distance >= condition.value
          : distance <= condition.value;
      return result(
        met ? 'met' : 'unmet',
        met
          ? undefined
          : `distancia:${distance};esperada:${condition.comparison}:${condition.value}`,
      );
    }
    case 'self-spatial':
      return result(
        spatialGoalSatisfied(condition.grounding, context.perception.self.position)
          ? 'met'
          : 'unmet',
        `relacion-espacial:${condition.grounding.relation}`,
      );
    case 'holding': {
      const count = entitiesFor(condition.entity, context).filter(
        (entity) => entity.held === true,
      ).length;
      const expected = condition.count ?? 1;
      return result(
        count >= expected ? 'met' : 'unmet',
        count >= expected
          ? undefined
          : `sostiene:${refLabel(condition.entity, context)}:${count}/${expected}`,
      );
    }
    case 'entity-distance': {
      const entities = entitiesFor(condition.entity, context).filter((entity) => entity.position);
      const targets = entitiesFor(condition.target, context).filter((entity) => entity.position);
      if (entities.length === 0 || targets.length === 0) {
        return result(
          'unknown',
          `sin-posicion:${refLabel(entities.length ? condition.target : condition.entity, context)}`,
        );
      }
      const distance = Math.min(
        ...entities.flatMap((entity) =>
          targets.map((target) =>
            condition.metric === 'manhattan'
              ? manhattan(entity.position!, target.position!)
              : chebyshev(entity.position!, target.position!),
          ),
        ),
      );
      return result(
        distance <= condition.atMost ? 'met' : 'unmet',
        distance <= condition.atMost
          ? undefined
          : `distancia:${distance};maxima:${condition.atMost}`,
      );
    }
    case 'entity-present': {
      const id = resolvedId(condition.entity, context);
      const visible = entitiesFor(condition.entity, context).length > 0;
      const confirmedAbsent = id !== undefined && context.absentEntityIds?.has(id) === true;
      if (condition.present) {
        if (visible) return result('met');
        if (confirmedAbsent)
          return result('unmet', `entidad-ausente:${refLabel(condition.entity, context)}`);
        return result('unknown', `entidad-no-observable:${refLabel(condition.entity, context)}`);
      }
      if (confirmedAbsent) return result('met');
      if (visible)
        return result('unmet', `entidad-presente:${refLabel(condition.entity, context)}`);
      return result('unknown', `ausencia-no-confirmada:${refLabel(condition.entity, context)}`);
    }
    case 'self-stat': {
      const stat = context.perception.self[condition.stat];
      if (!stat) return result('unknown', `sin-medicion:${condition.stat}`);
      const value = condition.normalized ? stat.current / stat.max : stat.current;
      const met =
        condition.comparison === 'at-least' ? value >= condition.value : value <= condition.value;
      return result(met ? 'met' : 'unmet', met ? undefined : `${condition.stat}:${value}`);
    }
    case 'blueprint-complete': {
      const complete = context.blueprintComplete?.(condition.blueprintId);
      return complete === undefined
        ? result('unknown', `plano-sin-anclar:${condition.blueprintId}`)
        : result(
            complete ? 'met' : 'unmet',
            complete ? undefined : `obra-incompleta:${condition.blueprintId}`,
          );
    }
    case 'stable-skill-exists': {
      const exists = context.stableSkillExists?.(condition.name);
      return exists === undefined
        ? result('unknown', `biblioteca-no-disponible:${condition.name}`)
        : result(
            exists ? 'met' : 'unmet',
            exists ? undefined : `habilidad-no-estable:${condition.name}`,
          );
    }
    case 'world-fact':
      return result(
        context.facts?.has(condition.fact) === true ? 'met' : 'unmet',
        context.facts?.has(condition.fact) === true
          ? undefined
          : `hecho-no-observado:${condition.fact}`,
      );
    case 'counter': {
      const value = context.counters?.[condition.counter] ?? 0;
      const met =
        condition.comparison === 'at-least' ? value >= condition.value : value <= condition.value;
      return result(met ? 'met' : 'unmet', met ? undefined : `${condition.counter}:${value}`);
    }
    case 'time-of-day': {
      const met = context.perception.timeOfDay === condition.phase;
      return result(met ? 'met' : 'unmet', met ? undefined : `hora:${context.perception.timeOfDay}`);
    }
    case 'world-tick': {
      const tick = context.perception.tick;
      const met = condition.comparison === 'at-least' ? tick >= condition.tick : tick <= condition.tick;
      return result(met ? 'met' : 'unmet', met ? undefined : `tick:${tick}/${condition.tick}`);
    }
    case 'elapsed': {
      if (context.activatedAtTick === undefined) return result('unknown', 'sin-arrancar');
      const elapsed = context.perception.tick - context.activatedAtTick;
      const met =
        condition.comparison === 'at-least'
          ? elapsed >= condition.ticks
          : elapsed <= condition.ticks;
      return result(
        met ? 'met' : 'unmet',
        met ? undefined : `transcurrido:${elapsed}/${condition.ticks}`,
      );
    }
  }
}

function movedPosition(start: Vec2, request: GoalUserRequest): Vec2 {
  const position = { ...start };
  for (const direction of request.directions ?? []) {
    if (direction === 'up') position.y -= 1;
    if (direction === 'down') position.y += 1;
    if (direction === 'left') position.x -= 1;
    if (direction === 'right') position.x += 1;
  }
  return position;
}

/**
 * Traduccion determinista de una intencion ya interpretada a su estado meta.
 * No inspecciona la frase original ni conoce tipos de objeto privilegiados.
 */
export function conditionForUserRequest(
  request: GoalUserRequest,
  perception: Perception,
): GoalCondition {
  const target: GoalEntityRef = request.targetEntityId
    ? { id: request.targetEntityId, ...(request.targetKind ? { kind: request.targetKind } : {}) }
    : { binding: 'target', ...(request.targetKind ? { kind: request.targetKind } : {}) };
  switch (request.kind) {
    case 'fetch-item':
      return request.amount && request.amount > 1
        ? {
            type: 'holding',
            entity: request.targetKind ? { kind: request.targetKind } : {},
            count:
              perception.self.heldItems.filter((item) => item.kind === request.targetKind).length +
              request.amount,
          }
        : request.targetEntityId
          ? { type: 'holding', entity: target }
          : {
              type: 'holding',
              entity: request.targetKind ? { kind: request.targetKind } : {},
              count:
                perception.self.heldItems.filter((item) => item.kind === request.targetKind)
                  .length + 1,
            };
    case 'destroy-entity':
    case 'consume-item':
      return { type: 'entity-present', entity: target, present: false };
    case 'place-item':
      return {
        type: 'entity-distance',
        entity: target,
        target: request.onKind ? { kind: request.onKind } : {},
        metric: 'chebyshev',
        atMost: request.placement === 'near' ? 1 : 0,
      };
    case 'move-direction':
      return { type: 'self-at', position: movedPosition(perception.self.position, request) };
    case 'wait-here':
      return {
        type: 'all',
        conditions: [
          { type: 'self-at', position: { ...perception.self.position } },
          { type: 'counter', counter: 'ticks', comparison: 'at-least', value: 6 },
        ],
      };
    case 'spatial-relation':
      if (!request.spatial) {
        return { type: 'constant', value: false, reason: 'relacion-espacial-sin-anclar' };
      }
      if (request.maintenance && request.spatial.relation === 'far-from') {
        return {
          type: 'all',
          conditions: request.spatial.referenceEntityIds.map((id) => ({
            type: 'self-distance-to-entity',
            entity: { id, kind: request.spatial!.referenceKind },
            metric: 'manhattan',
            comparison: 'at-least',
            value: request.spatial!.minimumDistance ?? 1,
          })),
        };
      }
      return { type: 'self-spatial', grounding: request.spatial };
    case 'craft-item': {
      const recipeId = request.recipeId ?? '';
      if (perception.blueprints.some((blueprint) => blueprint.id === recipeId)) {
        return { type: 'blueprint-complete', blueprintId: recipeId };
      }
      return {
        type: 'entity-present',
        entity: { binding: 'product', kind: recipeId },
        present: true,
      };
    }
    case 'interact-entity':
      return {
        type: 'world-fact',
        fact: `interaction:${request.verb ?? ''}:${request.targetKind ?? ''}`,
      };
    case 'run-skill':
      return { type: 'stable-skill-exists', name: request.skillName ?? '' };
  }
}

/**
 * Un disparador observable: la primitiva mínima de "cuándo". Es el mismo
 * vocabulario cerrado que el resto de las condiciones —cada forma se mide
 * contra una foto del mundo, nunca contra la frase original—, acotado a lo que
 * una expresión temporal necesita nombrar: una hora del día, la aparición o la
 * ausencia de algo, tener cierta cantidad de algo, un umbral del cuerpo. El LLM
 * elige el disparador; el mundo lo verifica.
 */
export type Trigger =
  | { kind: 'time-of-day'; phase: TimeOfDay }
  | { kind: 'entity-appears'; entityKind: string }
  | { kind: 'entity-gone'; entityKind: string }
  | { kind: 'holding'; itemKind: string; count: number }
  | {
      kind: 'stat';
      stat: 'energy' | 'health' | 'temperature';
      comparison: 'at-least' | 'at-most';
      value: number;
      normalized?: boolean;
    };

/** Frase breve y legible de un disparador, para mostrar por qué algo espera. */
export function describeTrigger(trigger: Trigger): string {
  switch (trigger.kind) {
    case 'time-of-day':
      return trigger.phase === 'day' ? 'sea de día' : 'sea de noche';
    case 'entity-appears':
      return `aparezca ${trigger.entityKind}`;
    case 'entity-gone':
      return `ya no esté ${trigger.entityKind}`;
    case 'holding':
      return `tenga ${trigger.count} ${trigger.itemKind}`;
    case 'stat':
      return `${trigger.stat} ${trigger.comparison === 'at-least' ? '≥' : '≤'} ${trigger.value}`;
  }
}

/** Traduce un disparador a la condición observable que lo verifica. */
export function conditionForTrigger(trigger: Trigger): GoalCondition {
  switch (trigger.kind) {
    case 'time-of-day':
      return { type: 'time-of-day', phase: trigger.phase };
    case 'entity-appears':
      return { type: 'entity-present', entity: { kind: trigger.entityKind }, present: true };
    case 'entity-gone':
      return { type: 'entity-present', entity: { kind: trigger.entityKind }, present: false };
    case 'holding':
      return {
        type: 'holding',
        entity: { kind: trigger.itemKind },
        count: Math.max(1, Math.round(trigger.count)),
      };
    case 'stat':
      return {
        type: 'self-stat',
        stat: trigger.stat,
        comparison: trigger.comparison,
        value: trigger.value,
        ...(trigger.normalized ? { normalized: true } : {}),
      };
  }
}

/**
 * La envoltura temporal de un pedido: las relaciones "cuando / hasta / durante
 * / antes de tal plazo" que el cuidador puede poner sobre CUALQUIER encargo,
 * sin depender de qué encargo sea. Es dato estructurado (no la frase) para que
 * persista, se vea en la UI y la verifique el reloj determinista.
 */
export interface GoalTemporal {
  /** Condición de inicio: hasta cumplirse, el objetivo espera suspendido. */
  startWhen?: Trigger;
  /** "Hasta que X": la condición que da por terminado el objetivo. */
  until?: Trigger;
  /** Duración en ticks que debe sostenerse desde que el objetivo arranca. */
  durationTicks?: number;
  /** Plazo en ticks desde que se acepta; vencido, el objetivo fracasa. */
  deadlineTicks?: number;
}

/** true si esta envoltura le da al objetivo un final propio (fin o duración). */
export function temporalIsTerminal(temporal: GoalTemporal | undefined): boolean {
  return (
    temporal !== undefined &&
    (temporal.until !== undefined ||
      (temporal.durationTicks !== undefined && temporal.durationTicks > 0))
  );
}

export interface CompiledTemporalGoal {
  successCondition: GoalCondition;
  failureCondition?: GoalCondition;
  /** Condición de inicio ya traducida; su presencia suspende el objetivo. */
  activation?: GoalCondition;
  /** El modo que corresponde: un fin o una duración lo vuelven `achievement`. */
  mode?: GoalMode;
}

/**
 * Compone la envoltura temporal con el estado meta "de fondo" de un encargo.
 * Determinista y pura: no mira la frase ni el reloj real, recibe el tick de
 * aceptación como dato. Reglas:
 *
 * - `startWhen` NO toca la finalización: solo produce la condición de inicio.
 * - `until` / `durationTicks` le dan al objetivo un final propio. En un pedido
 *   sin trabajo (esperar) ESE es el final; en uno con trabajo, abren una
 *   segunda vía de cierre además de cumplir el encargo.
 * - `deadlineTicks` se vuelve una condición de fracaso sobre el tick absoluto.
 */
export function compileTemporalGoal(input: {
  kind: GoalUserRequest['kind'];
  baseSuccess: GoalCondition;
  temporal: GoalTemporal | undefined;
  perception: Perception;
  acceptedAtTick: number;
}): CompiledTemporalGoal {
  const { temporal } = input;
  if (!temporal) return { successCondition: input.baseSuccess };

  const terminal: GoalCondition[] = [];
  if (temporal.until) terminal.push(conditionForTrigger(temporal.until));
  if (temporal.durationTicks !== undefined && temporal.durationTicks > 0) {
    terminal.push({ type: 'elapsed', comparison: 'at-least', ticks: temporal.durationTicks });
  }

  let successCondition: GoalCondition;
  if (terminal.length === 0) {
    successCondition = input.baseSuccess;
  } else if (input.kind === 'wait-here') {
    // Esperar no tiene trabajo propio: su fin ES la envoltura temporal. Quedarse
    // anclado sigue siendo parte de "esperar acá", así que se ancla la posición.
    successCondition = {
      type: 'all',
      conditions: [
        { type: 'self-at', position: { ...input.perception.self.position } },
        ...terminal,
      ],
    };
  } else {
    // Con trabajo de por medio: se cierra al cumplir el encargo O al llegar la
    // condición temporal, lo que ocurra primero.
    successCondition = {
      type: 'any',
      conditions: [
        input.baseSuccess,
        terminal.length === 1 ? terminal[0]! : { type: 'all', conditions: terminal },
      ],
    };
  }

  const compiled: CompiledTemporalGoal = { successCondition };
  if (temporal.deadlineTicks !== undefined && temporal.deadlineTicks > 0) {
    compiled.failureCondition = {
      type: 'world-tick',
      comparison: 'at-least',
      tick: input.acceptedAtTick + temporal.deadlineTicks,
    };
  }
  if (temporal.startWhen) compiled.activation = conditionForTrigger(temporal.startWhen);
  if (temporalIsTerminal(temporal)) compiled.mode = 'achievement';
  return compiled;
}
