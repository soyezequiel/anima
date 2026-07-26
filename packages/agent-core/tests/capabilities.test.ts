import { describe, expect, it } from 'vitest';
import type { Perception, Recipe } from '@anima/sim-core';
import { SkillLibrary } from '@anima/skill-runtime';
import { validateSkillProgram } from '@anima/skill-runtime';
import {
  createCapabilityRegistry,
  createPlan,
  describePlan,
  evaluateGoalCondition,
  invalidatePlan,
  planProgram,
  policyFor,
  resetPlanCounter,
  type CapabilityContext,
  type CapabilityDeps,
  type PlanStep,
} from '../src/index.js';

const CAMPFIRE: Recipe = {
  id: 'campfire',
  ingredients: [
    { kind: 'log', count: 2 },
    { kind: 'flint', count: 1 },
  ],
  outcomes: [
    {
      weight: 1,
      output: { kind: 'campfire', components: { heatSource: { warmthPerTick: 6, range: 2 } } },
    },
  ],
};

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

function deps(overrides: Partial<CapabilityDeps> = {}): CapabilityDeps {
  return {
    library: new SkillLibrary(),
    findInteraction: () => undefined,
    rememberedWalk: () => undefined,
    rememberedWalkForEntity: () => undefined,
    harvestSource: () => undefined,
    structureSite: () => null,
    ...overrides,
  };
}

function context(overrides: Partial<Perception> = {}, depsOverrides: Partial<CapabilityDeps> = {}): CapabilityContext {
  return { perception: perception(overrides), deps: deps(depsOverrides) };
}

describe('registro de capacidades', () => {
  it('expone un catálogo estable y describible, sin duplicados', () => {
    const registry = createCapabilityRegistry();
    const ids = registry.ids();
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('item.pickup');
    expect(ids).toContain('craft.recipe');
    // El prompt del intérprete se genera del código: si nace una capacidad,
    // aparece sola; si se borra, deja de ofrecerse el mismo día.
    const described = registry.describeForPrompt();
    for (const id of ids) expect(described).toContain(id);
  });

  it('rechaza registrar dos veces el mismo id', () => {
    const registry = createCapabilityRegistry();
    expect(() => registry.register(registry.get('item.pickup')!)).toThrow(/duplicada/);
  });

  it('una capacidad que no existe no se puede ejecutar', () => {
    const registry = createCapabilityRegistry();
    const built = registry.buildStep('volar.hasta', {}, context(), 'step-1');
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.error.reason).toBe('unknown-in-world');
  });
});

describe('contratos de capacidad', () => {
  it('todo paso construido compila a un programa estructuralmente válido', () => {
    const registry = createCapabilityRegistry();
    const ctx = context({ recipes: [CAMPFIRE] });
    const cases: { id: string; args: Record<string, unknown> }[] = [
      { id: 'explore.until-sees', args: { kind: 'log' } },
      { id: 'item.pickup', args: { kind: 'log', amount: 2 } },
      { id: 'item.consume', args: { kind: 'food' } },
      { id: 'item.place-at', args: { kind: 'plank', onKind: 'water' } },
      { id: 'entity.harvest', args: { kind: 'tree' } },
      { id: 'craft.recipe', args: { recipeId: 'campfire' } },
      { id: 'move.direction', args: { directions: ['up', 'right'] } },
      { id: 'wait.here', args: { ticks: 4 } },
    ];
    for (const testCase of cases) {
      const built = registry.buildStep(testCase.id, testCase.args, ctx, `step-${testCase.id}`);
      expect(built.ok, `${testCase.id}: ${built.ok ? '' : JSON.stringify(built.error)}`).toBe(true);
      if (!built.ok) continue;
      expect(validateSkillProgram(built.value.program).ok).toBe(true);
      expect(built.value.purpose.length).toBeGreaterThan(0);
      expect(built.value.status).toBe('pending');
    }
  });

  it('los argumentos de un modelo se validan antes de compilar nada', () => {
    const registry = createCapabilityRegistry();
    const ctx = context();
    expect(registry.buildStep('item.pickup', {}, ctx, 's').ok).toBe(false);
    expect(registry.buildStep('move.direction', { directions: ['norte'] }, ctx, 's').ok).toBe(false);
    // Una receta que el mundo no admite no se puede pedir: el grounding es
    // contra el mundo real, no contra lo que el modelo imagina.
    const noRecipe = registry.buildStep('craft.recipe', { recipeId: 'nave-espacial' }, ctx, 's');
    expect(noRecipe.ok).toBe(false);
    if (!noRecipe.ok) expect(noRecipe.error.reason).toBe('bad-arguments');
  });

  it('un pedido de cantidad se verifica contra la línea de base, no contra cero', () => {
    const registry = createCapabilityRegistry();
    // Ya lleva un tronco: «traé dos» tiene que terminar con TRES en la mano.
    const before = perception({
      self: {
        id: 'anima',
        position: { x: 1, y: 1 },
        heldItems: [{ id: 'log-0', kind: 'log', held: true, distance: 0 }],
        inventoryCapacity: 6,
      },
    });
    const built = registry.buildStep('item.pickup', { kind: 'log', amount: 2 }, { perception: before, deps: deps() }, 's');
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.expect).toEqual({ type: 'holding', entity: { kind: 'log' }, count: 3 });

    // Con solo dos en la mano el paso NO está cumplido: es exactamente la
    // falsa finalización que la verificación existe para atrapar.
    const withTwo = perception({
      self: {
        id: 'anima',
        position: { x: 1, y: 1 },
        heldItems: [
          { id: 'log-0', kind: 'log', held: true, distance: 0 },
          { id: 'log-1', kind: 'log', held: true, distance: 0 },
        ],
        inventoryCapacity: 6,
      },
    });
    expect(evaluateGoalCondition(built.value.expect!, { perception: withTwo }).status).toBe('unmet');
  });

  it('una obra sin sitio no arranca, y lo dice como bloqueo y no como fracaso', () => {
    const registry = createCapabilityRegistry();
    const blueprint = { id: 'casa', placements: [], footprint: { width: 1, height: 1 } };
    const ctx = context({ blueprints: [blueprint as never] }, { structureSite: () => null });
    const built = registry.buildStep('build.blueprint', { blueprintId: 'casa' }, ctx, 's');
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.error.reason).toBe('no-place');
  });

  it('la política de riesgo distingue lo reversible de lo irreversible', () => {
    const registry = createCapabilityRegistry();
    expect(policyFor(registry.get('move.direction')!).requiresConfirmation).toBe(false);
    expect(policyFor(registry.get('move.direction')!).canaryOnSnapshot).toBe(false);
    expect(policyFor(registry.get('craft.recipe')!).canaryOnSnapshot).toBe(true);
    expect(policyFor(registry.get('entity.harvest')!).requiresConfirmation).toBe(true);
    // Nada se salta la validación estructural, cueste lo que cueste.
    for (const capability of registry.all()) {
      expect(policyFor(capability).structural).toBe(true);
      expect(policyFor(capability).verifyAgainstWorld).toBe(true);
    }
  });
});

describe('el plan es efímero y distinto de una habilidad', () => {
  it('concatena sus pasos en un programa ejecutable y los describe en corto', () => {
    resetPlanCounter();
    const registry = createCapabilityRegistry();
    const ctx = context({ recipes: [CAMPFIRE] });
    const steps: PlanStep[] = [];
    for (const spec of [
      { id: 'item.pickup', args: { kind: 'log', amount: 2 } },
      { id: 'item.pickup', args: { kind: 'flint' } },
      { id: 'craft.recipe', args: { recipeId: 'campfire' } },
    ]) {
      const built = registry.buildStep(spec.id, spec.args, ctx, `step-${steps.length}`);
      expect(built.ok).toBe(true);
      if (built.ok) steps.push(built.value);
    }
    const plan = createPlan({ goalId: 'goal-1', source: 'deterministic', steps, tick: 3 });
    expect(plan.id).toBe('plan-1');
    expect(plan.cursor).toBe(0);
    expect(validateSkillProgram(planProgram(plan)).ok).toBe(true);
    // Lo que ve el cuidador: tres frases en primera persona, no un volcado.
    const described = describePlan(plan);
    expect(described).toContain('junto');
    expect(described).toContain('fabrico');
    expect(described.split(';').length).toBeLessThanOrEqual(3);
  });

  it('invalidar un plan no deshace lo ya hecho', () => {
    resetPlanCounter();
    const registry = createCapabilityRegistry();
    const ctx = context();
    const first = registry.buildStep('item.pickup', { kind: 'log' }, ctx, 'a');
    const second = registry.buildStep('item.pickup', { kind: 'flint' }, ctx, 'b');
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    first.value.status = 'done';
    second.value.status = 'running';
    const plan = createPlan({
      goalId: 'goal-1',
      source: 'deterministic',
      steps: [first.value, second.value],
      tick: 1,
    });
    plan.cursor = 1;
    invalidatePlan(plan);
    expect(plan.steps[0]!.status).toBe('done');
    expect(plan.steps[1]!.status).toBe('pending');
  });
});
