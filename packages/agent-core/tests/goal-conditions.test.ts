import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import type { Perception } from '@anima/sim-core';
import { buildPerception, getEntity, spawn } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { openField } from '@anima/test-scenarios';
import {
  AnimaAgent,
  conditionForUserRequest,
  evaluateGoalCondition,
  GoalManager,
  runAgentInWorld,
  type GoalCondition,
} from '../src/index.js';

function perception(overrides: Partial<Perception> = {}): Perception {
  return {
    tick: 1,
    timeOfDay: 'day',
    self: {
      id: 'anima',
      position: { x: 1, y: 1 },
      heldItems: [],
      inventoryCapacity: 6,
    },
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

describe('condiciones declarativas de objetivos', () => {
  it('combina AND, OR y NOT con lógica ternaria determinista', () => {
    const condition: GoalCondition = {
      type: 'all',
      conditions: [
        {
          type: 'any',
          conditions: [
            { type: 'holding', entity: { id: 'log-requested' } },
            { type: 'holding', entity: { id: 'hammer-requested' } },
          ],
        },
        {
          type: 'not',
          condition: { type: 'entity-present', entity: { id: 'wolf' }, present: true },
        },
      ],
    };
    const snapshot = perception({
      self: {
        id: 'anima',
        position: { x: 1, y: 1 },
        inventoryCapacity: 6,
        heldItems: [{ id: 'log-requested', kind: 'log', held: true }],
      },
    });
    const context = { perception: snapshot, absentEntityIds: new Set(['wolf']) };

    expect(evaluateGoalCondition(condition, context)).toEqual({ status: 'met', diagnostics: [] });
    expect(evaluateGoalCondition(condition, context)).toEqual(
      evaluateGoalCondition(condition, context),
    );
  });

  it('“traé el tronco” exige sostener el individuo solicitado', () => {
    const condition = conditionForUserRequest(
      { kind: 'fetch-item', targetKind: 'log', targetEntityId: 'wanted', raw: 'traelo' },
      perception(),
    );
    const wrong = perception({
      self: {
        id: 'anima',
        position: { x: 1, y: 1 },
        inventoryCapacity: 6,
        heldItems: [{ id: 'other', kind: 'log', held: true }],
      },
    });
    const right = perception({
      self: {
        ...wrong.self,
        heldItems: [{ id: 'wanted', kind: 'log', held: true }],
      },
    });

    expect(evaluateGoalCondition(condition, { perception: wrong }).status).toBe('unmet');
    expect(evaluateGoalCondition(condition, { perception: right }).status).toBe('met');
  });

  it('expresa cruzar y dejar un objeto junto a otro sin conocer sus tipos', () => {
    const crossed: GoalCondition = {
      type: 'self-spatial',
      grounding: {
        relation: 'opposite-side',
        referenceKind: 'crystal-ridge',
        referenceEntityIds: ['ridge-1'],
        referencePositions: [{ x: 3, y: 1 }],
        destination: { x: 4, y: 1 },
        axis: 'x',
        origin: 3,
        startingSide: -1,
      },
    };
    const placed = conditionForUserRequest(
      {
        kind: 'place-item',
        targetKind: 'tool-x',
        targetEntityId: 'tool-1',
        onKind: 'heat-x',
        placement: 'near',
        raw: 'dejalo junto',
      },
      perception(),
    );
    const snapshot = perception({
      self: { id: 'anima', position: { x: 4, y: 1 }, heldItems: [], inventoryCapacity: 6 },
      visibleEntities: [
        { id: 'tool-1', kind: 'tool-x', position: { x: 5, y: 5 } },
        { id: 'fire-1', kind: 'heat-x', position: { x: 6, y: 5 } },
      ],
    });

    expect(evaluateGoalCondition(crossed, { perception: snapshot }).status).toBe('met');
    expect(evaluateGoalCondition(placed, { perception: snapshot }).status).toBe('met');
  });

  it('no confunde una ausencia fuera de percepción con una destrucción', () => {
    const condition: GoalCondition = {
      type: 'entity-present',
      entity: { id: 'wall-7' },
      present: false,
    };
    expect(evaluateGoalCondition(condition, { perception: perception() }).status).toBe('unknown');
    expect(
      evaluateGoalCondition(condition, {
        perception: perception(),
        absentEntityIds: new Set(['wall-7']),
      }).status,
    ).toBe('met');
  });

  it('persiste la condición y el modo de mantenimiento dentro del objetivo', () => {
    const goals = new GoalManager();
    const condition: GoalCondition = {
      type: 'not',
      condition: {
        type: 'self-distance-to-entity',
        entity: { id: 'wolf-1' },
        metric: 'manhattan',
        comparison: 'at-most',
        value: 3,
      },
    };
    goals.create(
      {
        description: 'mantenerse lejos',
        source: 'user-request',
        priority: 1,
        urgency: 0.8,
        expectedValue: 1,
        preconditions: [],
        mode: 'maintenance',
        successCondition: condition,
      },
      4,
    );
    const restored = new GoalManager();
    restored.loadFrom(goals.serialize());

    expect(restored.all()[0]?.mode).toBe('maintenance');
    expect(restored.all()[0]?.successCondition).toEqual(condition);
    expect(restored.all()[0]?.status).toBe('active');
  });

  it('si la DSL termina sin alcanzar el estado, diagnostica y replantea sin mentir', async () => {
    const bundle = openField.build(91);
    const agent = new AnimaAgent({
      petId: bundle.petId,
      petName: 'Anima',
      provider: new MockModelProvider(),
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: [],
      evaluationSeeds: [1],
      guidanceEnabled: false,
    });
    const goal = agent.goals.create(
      {
        description: 'estado deliberadamente inalcanzado',
        source: 'user-request',
        priority: 1,
        urgency: 0.8,
        expectedValue: 1,
        preconditions: [],
        successCondition: { type: 'self-at', position: { x: 999, y: 999 } },
        userRequest: { kind: 'move-direction', directions: ['right'], raw: 'andá a la derecha' },
      },
      0,
    );

    await runAgentInWorld(bundle.world, agent, { maxTicks: 30 });

    expect(agent.goals.get(goal.id)?.status).toBe('suspended');
    expect(agent.events.ofType('goal.completed')).toHaveLength(0);
    expect(agent.events.ofType('goal.outcome.unmet').length).toBeGreaterThan(0);
    expect(agent.events.ofType('strategy.failed').at(-1)?.data.reason).toContain(
      'condición-no-cumplida',
    );
  });

  it('deja el individuo pedido realmente junto al referente', async () => {
    const bundle = openField.build(92);
    const pet = getEntity(bundle.world, bundle.petId)!;
    const origin = pet.components.position!;
    const hammer = spawn(bundle.world, 'tool-x', {
      position: { x: origin.x + 1, y: origin.y },
      portable: {},
    });
    const fire = spawn(bundle.world, 'heat-x', {
      position: { x: origin.x + 3, y: origin.y },
      heatSource: { warmthPerTick: 1, range: 2 },
    });
    const agent = new AnimaAgent({
      petId: bundle.petId,
      petName: 'Anima',
      provider: new MockModelProvider(),
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: [],
      evaluationSeeds: [1],
      guidanceEnabled: false,
    });
    const request = {
      kind: 'place-item' as const,
      targetKind: hammer.kind,
      targetEntityId: hammer.id,
      onKind: fire.kind,
      placement: 'near' as const,
      raw: 'dejá el martillo junto a la fogata',
    };
    const goal = agent.goals.create(
      {
        description: request.raw,
        source: 'user-request',
        priority: 1,
        urgency: 0.8,
        expectedValue: 1,
        preconditions: [],
        successCondition: conditionForUserRequest(
          request,
          buildPerception(bundle.world, bundle.petId),
        ),
        userRequest: request,
      },
      0,
    );

    await runAgentInWorld(bundle.world, agent, {
      maxTicks: 30,
      stopWhen: (_world, current) => current.goals.get(goal.id)?.status === 'completed',
    });

    const hammerPosition = getEntity(bundle.world, hammer.id)?.components.position;
    const firePosition = getEntity(bundle.world, fire.id)?.components.position;
    expect(agent.goals.get(goal.id)?.status).toBe('completed');
    expect(hammerPosition).toBeDefined();
    expect(firePosition).toBeDefined();
    expect(
      Math.max(
        Math.abs(hammerPosition!.x - firePosition!.x),
        Math.abs(hammerPosition!.y - firePosition!.y),
      ),
    ).toBe(1);
  });
});
