import { describe, expect, it } from 'vitest';
import type { Perception } from '@anima/sim-core';
import { SkillLibrary } from '@anima/skill-runtime';
import {
  createCapabilityRegistry,
  createPlan,
  PlanExecutor,
  resetPlanCounter,
  type CapabilityDeps,
  type Plan,
  type PlanExecutorEvent,
  type PlanStep,
} from '../src/index.js';

/**
 * Hacer, mirar, comparar, corregir.
 *
 * Lo que estas pruebas fijan no es que el programa termine —eso ya se sabía
 * comprobar— sino que TERMINAR NO ES HABER HECHO. Un paso que corre entero y
 * deja el mundo igual tiene que verse como lo que es.
 */

function perception(overrides: Partial<Perception> = {}): Perception {
  return {
    tick: 1,
    timeOfDay: 'day',
    self: { id: 'anima', position: { x: 1, y: 1 }, heldItems: [], inventoryCapacity: 6 },
    visibleEntities: [],
    recipes: [],
    interactions: [],
    blueprints: [],
    decompositions: [],
    drawnKinds: [],
    illustratedWorks: [],
    ...overrides,
  };
}

function deps(): CapabilityDeps {
  return {
    library: new SkillLibrary(),
    findInteraction: () => undefined,
    rememberedWalk: () => undefined,
    rememberedWalkForEntity: () => undefined,
    harvestSource: () => undefined,
    structureSite: () => null,
  };
}

/** Un paso que corre un tick y no cambia nada, con la expectativa que se le dé. */
function inertStep(id: string, expect_: PlanStep['expect']): PlanStep {
  return {
    id,
    capabilityId: 'item.pickup',
    args: { kind: 'log' },
    purpose: 'recojo un tronco',
    program: [{ op: 'wait', ticks: 1 }],
    expect: expect_,
    preconditions: [],
    effects: [],
    cost: 1,
    risk: 'reversible',
    status: 'pending',
    attempts: 0,
  };
}

/** Un paso que se rinde diciendo por qué. */
function abortingStep(id: string, reason: string): PlanStep {
  return { ...inertStep(id, null), id, program: [{ op: 'abort', reason }] };
}

function planOf(steps: PlanStep[], budget?: Partial<Plan['budget']>): Plan {
  resetPlanCounter();
  return createPlan({
    goalId: 'goal-1',
    source: 'deterministic',
    steps,
    tick: 1,
    ...(budget ? { budget } : {}),
  });
}

const HOLDING_A_LOG: PlanStep['expect'] = { type: 'holding', entity: { kind: 'log' }, count: 1 };

function run(
  executor: PlanExecutor,
  perceptions: Perception[],
): { outcome: string; reason?: string } {
  for (const current of perceptions) {
    const output = executor.next(current);
    if (output.kind === 'done') {
      return {
        outcome: output.result.outcome,
        ...(output.result.reason !== undefined ? { reason: output.result.reason } : {}),
      };
    }
  }
  return { outcome: 'sin-resolver' };
}

describe('ejecución monitorizada', () => {
  it('un paso cuyo efecto ya es cierto se saltea sin gastar un tick', () => {
    const events: PlanExecutorEvent[] = [];
    const holding = perception({
      self: {
        id: 'anima',
        position: { x: 1, y: 1 },
        heldItems: [{ id: 'log-0', kind: 'log', held: true, distance: 0 }],
        inventoryCapacity: 6,
      },
    });
    const executor = new PlanExecutor(planOf([inertStep('s1', HOLDING_A_LOG)]), 'anima', {
      verifyContext: (p) => ({ perception: p }),
      replan: () => null,
      onEvent: (event) => events.push(event),
    });

    // Un solo `next` y ya está: no emitió ninguna intención al mundo.
    const output = executor.next(holding);
    expect(output.kind).toBe('done');
    if (output.kind === 'done') expect(output.result.outcome).toBe('completed');
    expect(events.map((e) => e.type)).toEqual(['step.skipped', 'plan.settled']);
  });

  it('un programa que termina sin que el mundo lo muestre NO cuenta como hecho', () => {
    const events: PlanExecutorEvent[] = [];
    const executor = new PlanExecutor(planOf([inertStep('s1', HOLDING_A_LOG)]), 'anima', {
      verifyContext: (p) => ({ perception: p }),
      // Sin por dónde replanificar: se ve el desenlace crudo.
      replan: () => null,
      onEvent: (event) => events.push(event),
    });

    // El `wait` corre, el programa completa, y las manos siguen vacías.
    const result = run(executor, Array.from({ length: 6 }, () => perception()));
    expect(result.outcome).toBe('completed');
    expect(events.map((e) => e.type)).toContain('step.unverified');
    expect(executor.unverifiedSteps()).toBe(1);
    // El diagnóstico es lo que MIDIÓ el mundo, no una excusa redactada.
    const unverified = events.find((e) => e.type === 'step.unverified');
    expect(unverified?.type === 'step.unverified' && unverified.diagnostics[0]).toMatch(/sostiene/);
  });

  it('con presupuesto, un efecto que no ocurrió dispara replanificación con percepción fresca', () => {
    const events: PlanExecutorEvent[] = [];
    let replans = 0;
    const executor = new PlanExecutor(planOf([inertStep('s1', HOLDING_A_LOG)]), 'anima', {
      verifyContext: (p) => ({ perception: p }),
      replan: () => {
        replans += 1;
        // El plan nuevo se arma con lo que se ve AHORA. Acá devuelve otro paso
        // igualmente inerte para poder contar cuántas veces vuelve a mirar.
        return planOf([inertStep(`retry-${replans}`, HOLDING_A_LOG)]);
      },
      onEvent: (event) => events.push(event),
    });

    run(executor, Array.from({ length: 40 }, () => perception()));
    // El presupuesto de replanificación existe y se respeta: no gira para siempre.
    expect(replans).toBe(3);
    expect(events.filter((e) => e.type === 'plan.replanned')).toHaveLength(3);
    const revisions = events
      .filter((e): e is Extract<PlanExecutorEvent, { type: 'plan.replanned' }> => e.type === 'plan.replanned')
      .map((e) => e.revision);
    expect(revisions).toEqual([2, 3, 4]);
  });

  it('un paso que se rinde diciendo por qué llega intacto: no se replanifica encima de un diagnóstico', () => {
    const events: PlanExecutorEvent[] = [];
    let replanned = false;
    const executor = new PlanExecutor(planOf([abortingStep('s1', 'camino-bloqueado')]), 'anima', {
      verifyContext: (p) => ({ perception: p }),
      replan: () => {
        replanned = true;
        return planOf([inertStep('otro', null)]);
      },
      onEvent: (event) => events.push(event),
    });

    const result = run(executor, Array.from({ length: 5 }, () => perception()));
    // El motivo es el mismo que el agente ya sabe atender (suspender, pedir
    // ayuda, fabricar una herramienta más fuerte). Comérselo con un replan
    // sería quitarle esa decisión.
    expect(result).toEqual({ outcome: 'aborted', reason: 'camino-bloqueado' });
    expect(replanned).toBe(false);
  });

  it('el plan tiene tope de ticks: no se queda dando vueltas para siempre', () => {
    const longStep: PlanStep = {
      ...inertStep('s1', HOLDING_A_LOG),
      program: [{ op: 'repeatWithLimit', max: 50, body: [{ op: 'wait', ticks: 1 }] }],
    };
    const executor = new PlanExecutor(planOf([longStep], { maxTicks: 4 }), 'anima', {
      verifyContext: (p) => ({ perception: p }),
      replan: () => null,
    });
    const result = run(executor, Array.from({ length: 20 }, () => perception()));
    expect(result).toEqual({ outcome: 'limit-exceeded', reason: 'presupuesto-del-plan' });
  });

  it('un paso sin predicado propio se ejecuta y vale lo que diga su programa', () => {
    const events: PlanExecutorEvent[] = [];
    const executor = new PlanExecutor(planOf([inertStep('s1', null)]), 'anima', {
      verifyContext: (p) => ({ perception: p }),
      replan: () => null,
      onEvent: (event) => events.push(event),
    });
    const result = run(executor, Array.from({ length: 5 }, () => perception()));
    expect(result.outcome).toBe('completed');
    // Ni se saltea (no se lo da por hecho) ni se marca sin verificar.
    expect(events.map((e) => e.type)).toEqual(['step.started', 'step.verified', 'plan.settled']);
    expect(executor.unverifiedSteps()).toBe(0);
  });

  it('un paso que no se pudo ni compilar aborta con el motivo con el que se bloqueó', () => {
    const registry = createCapabilityRegistry();
    const blocked = registry.buildStep(
      'craft.recipe',
      { recipeId: 'nave-espacial' },
      { perception: perception(), deps: deps() },
      's1',
    );
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;

    const step: PlanStep = {
      ...inertStep('s1', null),
      capabilityId: 'blocked',
      args: { reason: 'no-sé-qué-construir' },
      program: [{ op: 'abort', reason: 'no-sé-qué-construir' }],
      block: blocked.error,
    };
    const executor = new PlanExecutor(planOf([step]), 'anima', {
      verifyContext: (p) => ({ perception: p }),
      replan: () => null,
    });
    expect(run(executor, [perception()])).toEqual({
      outcome: 'aborted',
      reason: 'no-sé-qué-construir',
    });
  });
});
