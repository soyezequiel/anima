import type { Perception } from '@anima/sim-core';
import type { SkillProgram } from '@anima/skill-runtime';
import { SKILL_REACH_BLOCKED_FOOD } from '../names.js';
import type { GoalUserRequest } from '../goals.js';
import { planCausalRequest } from '../causal-world-model.js';
import { causalPlanToSteps } from '../causal-program.js';
import type { CapabilityBlock, CapabilityContext } from './capability.js';
import type { CapabilityDeps } from './deps.js';
import { accumulateGains, contextWithGains } from './gains.js';
import type { Plan, PlanSource, PlanStep } from './plan.js';
import { createPlan } from './plan.js';
import type { CapabilityRegistry } from './registry.js';

/**
 * De la petición del cuidador al PLAN que la cumple.
 *
 * Es el sucesor del `switch` que emitía un chorro de operaciones: la misma
 * composición determinista, sin modelo de por medio, pero con estructura. Cada
 * paso sabe qué capacidad ejecuta, con qué argumentos, qué promete y cómo se
 * comprueba. Lo que antes era un programa opaco de cien operaciones —del que
 * solo se sabía «terminó» o «abortó»— ahora es una lista de intenciones
 * verificables una por una.
 *
 * Sigue sin haber un modelo acá. Un LLM puede traducir la frase del cuidador a
 * una `GoalUserRequest`; de ahí en adelante todo es código, y lo que se ejecuta
 * son capacidades registradas.
 */

export interface PlanRequestOptions {
  /** De qué objetivo es este plan. */
  goalId: string;
  /** Recuerdos espaciales que el planificador causal puede tomar como hipótesis. */
  rememberedEntities?: readonly { id: string; kind: string; portable?: boolean }[];
  /** Ticks del mundo, para fechar el plan. */
  tick: number;
  /** Cuántas veces se replanificó ya para este objetivo. */
  revision?: number;
}

/**
 * Un paso que no se pudo armar. Conserva la palabra exacta con la que el
 * sistema venía nombrando cada callejón —`sin-sitio`, `no-conozco-esa-
 * habilidad`— porque esos motivos ya viajan al chat y a las regresiones: es el
 * vocabulario con el que Ánima explica por qué no pudo, y cambiarlo sería
 * romper lo que el cuidador ya aprendió a leer.
 */
function blockedStep(id: string, reason: string, block: CapabilityBlock): PlanStep {
  return {
    id,
    capabilityId: 'blocked',
    args: { reason },
    purpose: `no puedo seguir: ${reason}`,
    program: [{ op: 'abort', reason }],
    expect: { type: 'constant', value: false, reason },
    preconditions: [],
    effects: [],
    cost: 0,
    risk: 'reversible',
    status: 'pending',
    attempts: 0,
    block,
  };
}

interface StepSpec {
  capabilityId: string;
  args: Record<string, unknown>;
  /** Con qué palabra se declara el fracaso si esta capacidad no se puede armar. */
  blockedReason: string;
}

/** Construye los pasos, y al primer bloqueo devuelve el aborto con su motivo. */
function buildSteps(
  registry: CapabilityRegistry,
  specs: StepSpec[],
  context: CapabilityContext,
): PlanStep[] {
  const steps: PlanStep[] = [];
  // Lo que los pasos anteriores ya prometieron: sin esto, dos pasos iguales del
  // mismo plan capturan la misma línea de base y el segundo nace cumplido.
  const gains = new Map<string, number>();
  for (const [index, spec] of specs.entries()) {
    const built = registry.buildStep(
      spec.capabilityId,
      spec.args,
      contextWithGains(context, gains),
      `step-${index}`,
    );
    if (!built.ok) return [...steps, blockedStep(`step-${index}`, spec.blockedReason, built.error)];
    accumulateGains(gains, built.value);
    steps.push(built.value);
  }
  return steps;
}

/**
 * Qué capacidades cumplen esta petición, en orden.
 *
 * Devuelve especificaciones y no pasos ya armados para que la decisión —qué
 * hacer— quede separada de la compilación —cómo se escribe en la DSL—. Es lo
 * que permite que el mismo pedido se replanifique con percepción fresca sin
 * volver a decidir de cero.
 */
function specsForRequest(request: GoalUserRequest, context: CapabilityContext): StepSpec[] {
  const perception = context.perception;
  const targetKind = request.targetKind;

  switch (request.kind) {
    case 'wait-here':
      return [{ capabilityId: 'wait.here', args: { ticks: 6 }, blockedReason: 'no-pude-esperar' }];

    case 'craft-item': {
      // ¿Objeto u obra? Si lo pedido es un plano (ADR 0032), se levanta como
      // obra. El plano manda sobre la receta si existieran los dos con el mismo
      // nombre — una casa es un lugar, no una cosa.
      if (request.recipeId && perception.blueprints.some((b) => b.id === request.recipeId)) {
        return [
          { capabilityId: 'build.blueprint', args: { blueprintId: request.recipeId }, blockedReason: 'sin-sitio' },
        ];
      }
      if (request.recipeId && perception.recipes.some((r) => r.id === request.recipeId)) {
        return [
          { capabilityId: 'craft.recipe', args: { recipeId: request.recipeId }, blockedReason: 'no-sé-qué-construir' },
        ];
      }
      return [{ capabilityId: 'craft.recipe', args: { recipeId: request.recipeId ?? '' }, blockedReason: 'no-sé-qué-construir' }];
    }

    case 'run-skill':
      return [
        {
          capabilityId: 'skill.run',
          args: { skillName: request.skillName ?? '' },
          blockedReason: 'no-conozco-esa-habilidad',
        },
      ];

    case 'move-direction':
      return [
        {
          capabilityId: 'move.direction',
          args: { directions: request.directions ?? [] },
          blockedReason: 'dirección-no-especificada',
        },
      ];

    case 'spatial-relation':
      return [
        {
          capabilityId: 'spatial.relate',
          args: { grounding: request.spatial },
          blockedReason: 'relación-espacial-sin-ubicar',
        },
      ];

    case 'fetch-item':
      return [
        {
          capabilityId: 'item.pickup',
          args: {
            ...(targetKind ? { kind: targetKind } : {}),
            ...(request.targetEntityId ? { entityId: request.targetEntityId } : {}),
            amount: request.amount ?? 1,
          },
          blockedReason: 'no-pude-recogerlo',
        },
      ];

    case 'consume-item': {
      // Una habilidad estable para llegar a comida bloqueada es una MACRO sobre
      // lo mismo que hace la capacidad: si existe y está probada, se prefiere.
      if (targetKind === 'food' && context.deps.library.findStable(SKILL_REACH_BLOCKED_FOOD)) {
        return [
          {
            capabilityId: 'skill.run',
            args: { skillName: SKILL_REACH_BLOCKED_FOOD },
            blockedReason: 'no-pude-comerlo',
          },
        ];
      }
      return [
        {
          capabilityId: 'item.consume',
          args: {
            ...(targetKind ? { kind: targetKind } : {}),
            ...(request.targetEntityId ? { entityId: request.targetEntityId } : {}),
          },
          blockedReason: 'no-pude-comerlo',
        },
      ];
    }

    case 'place-item': {
      // ¿Y si lo que hay que poner resultó ser una OBRA? Para una obra, PONERLA
      // es levantarla en el lugar correcto — y el sitio ya escucha el `onKind`
      // de este mismo paso. Buscar una entidad con ese nombre sería perseguir un
      // fantasma que nadie va a fabricar.
      if (targetKind && perception.blueprints.some((b) => b.id === targetKind)) {
        return [
          { capabilityId: 'build.blueprint', args: { blueprintId: targetKind }, blockedReason: 'sin-sitio' },
        ];
      }
      return [
        {
          capabilityId: 'item.place-at',
          args: {
            kind: targetKind ?? '',
            onKind: request.onKind ?? '',
            ...(request.placement ? { placement: request.placement } : {}),
          },
          blockedReason: 'no-sé-qué-poner-ni-dónde',
        },
      ];
    }

    case 'interact-entity':
      return [
        {
          capabilityId: 'world.interact',
          args: {
            ...(request.verb ? { verb: request.verb } : {}),
            ...(targetKind ? { kind: targetKind } : {}),
            ...(request.targetEntityId ? { entityId: request.targetEntityId } : {}),
          },
          blockedReason: 'sin-interaccion',
        },
      ];

    case 'destroy-entity':
      return [
        {
          capabilityId: 'entity.harvest',
          args: {
            ...(targetKind ? { kind: targetKind } : {}),
            ...(request.targetEntityId ? { entityId: request.targetEntityId } : {}),
          },
          blockedReason: 'objetivo-resistió',
        },
      ];
  }
}

/**
 * El plan efímero para una petición. Primero se intenta la cadena causal —que
 * puede descubrir que para tener un tronco hay que fabricar un hacha y talar un
 * árbol— y si no hay una demostrable, se cae a la composición determinista, que
 * es contingente y sigue pudiendo explorar.
 */
export function planForUserRequest(
  request: GoalUserRequest,
  perception: Perception,
  deps: CapabilityDeps,
  registry: CapabilityRegistry,
  options: PlanRequestOptions,
): Plan {
  const context: CapabilityContext = { perception, deps };
  let source: PlanSource = 'deterministic';
  let steps: PlanStep[] | null = null;

  // Adquisición causal general: si el recurso no está suelto, el modelo del
  // mundo puede haber derivado una cadena de recetas, herramienta,
  // transformación o interacción. Solo se compila una cadena validada.
  if (request.kind === 'fetch-item' && !request.targetEntityId) {
    const causal = planCausalRequest(request, perception, {
      ...(options.rememberedEntities ? { rememberedEntities: options.rememberedEntities } : {}),
    });
    if (causal.supported && causal.result.ok) {
      const compiled = causalPlanToSteps(causal.result.plan, registry, context);
      if (compiled && compiled.length > 0) {
        steps = compiled;
        source = 'causal';
      }
    }
  }

  if (!steps) steps = buildSteps(registry, specsForRequest(request, context), context);

  return createPlan({
    goalId: options.goalId,
    source,
    steps,
    tick: options.tick,
    ...(options.revision !== undefined ? { revision: options.revision } : {}),
  });
}

/**
 * El plan de una petición, aplanado a un solo programa.
 *
 * Puente de compatibilidad para todo lo que todavía espera un `SkillProgram`.
 * Que exista no es deuda: el evaluador, las regresiones y `runSkillProgram`
 * trabajan con programas, y un plan tiene que poder mirarse como uno.
 */
export function programForPlan(plan: Plan): SkillProgram {
  const ops = plan.steps.flatMap((step) => step.program);
  return ops.length > 0 ? ops : [{ op: 'wait', ticks: 1 }];
}
