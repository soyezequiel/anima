import { describe, expect, it } from 'vitest';
import { MockModelProvider, ScriptedModelProvider } from '@anima/model-providers';
import type { EntityId, Perception, WorldState } from '@anima/sim-core';
import { buildPerception, spawn } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { openField } from '@anima/test-scenarios';
import {
  AnimaAgent,
  compileTemporalGoal,
  conditionForTrigger,
  describeTrigger,
  evaluateGoalCondition,
  runAgentInWorld,
  temporalIsTerminal,
  type GoalCondition,
  type GoalTemporal,
  type Trigger,
} from '../src/index.js';

function perception(overrides: Partial<Perception> = {}): Perception {
  return {
    tick: 0,
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

function makeAgent(configureWorld: (world: WorldState) => void = () => {}): {
  world: WorldState;
  petId: EntityId;
  agent: AnimaAgent;
} {
  const bundle = openField.build(31);
  configureWorld(bundle.world);
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
  return { world: bundle.world, petId: bundle.petId, agent };
}

function giveLogs(world: WorldState, petId: EntityId, count: number): void {
  const pet = world.entities[petId]!;
  for (let i = 0; i < count; i++) {
    const log = spawn(world, 'log', { portable: {} });
    pet.components.inventory!.items.push(log.id);
  }
}

describe('condiciones temporales: hojas nuevas del álgebra', () => {
  it('mide la hora del día que trae la percepción', () => {
    const day: GoalCondition = { type: 'time-of-day', phase: 'day' };
    expect(evaluateGoalCondition(day, { perception: perception({ timeOfDay: 'day' }) }).status).toBe(
      'met',
    );
    expect(
      evaluateGoalCondition(day, { perception: perception({ timeOfDay: 'night' }) }).status,
    ).toBe('unmet');
  });

  it('un plazo se mide contra el tick absoluto del mundo (de la percepción)', () => {
    const deadline: GoalCondition = { type: 'world-tick', comparison: 'at-least', tick: 10 };
    expect(evaluateGoalCondition(deadline, { perception: perception({ tick: 9 }) }).status).toBe(
      'unmet',
    );
    expect(evaluateGoalCondition(deadline, { perception: perception({ tick: 10 }) }).status).toBe(
      'met',
    );
  });

  it('una duración se cuenta desde la activación, y es unknown antes de arrancar', () => {
    const lasted: GoalCondition = { type: 'elapsed', comparison: 'at-least', ticks: 5 };
    expect(
      evaluateGoalCondition(lasted, { perception: perception({ tick: 8 }), activatedAtTick: 3 })
        .status,
    ).toBe('met');
    expect(
      evaluateGoalCondition(lasted, { perception: perception({ tick: 7 }), activatedAtTick: 3 })
        .status,
    ).toBe('unmet');
    // Sin ancla de activación no arrancó: unknown, nunca "ya pasaron 0".
    expect(evaluateGoalCondition(lasted, { perception: perception({ tick: 8 }) }).status).toBe(
      'unknown',
    );
  });
});

describe('disparadores: vocabulario cerrado y verificable', () => {
  it('traduce cada disparador a su condición observable', () => {
    expect(conditionForTrigger({ kind: 'time-of-day', phase: 'day' })).toEqual({
      type: 'time-of-day',
      phase: 'day',
    });
    expect(conditionForTrigger({ kind: 'entity-appears', entityKind: 'wolf' })).toEqual({
      type: 'entity-present',
      entity: { kind: 'wolf' },
      present: true,
    });
    expect(conditionForTrigger({ kind: 'entity-gone', entityKind: 'wolf' })).toEqual({
      type: 'entity-present',
      entity: { kind: 'wolf' },
      present: false,
    });
    expect(conditionForTrigger({ kind: 'holding', itemKind: 'log', count: 2 })).toEqual({
      type: 'holding',
      entity: { kind: 'log' },
      count: 2,
    });
  });

  it('da una frase legible de por qué algo espera', () => {
    expect(describeTrigger({ kind: 'time-of-day', phase: 'day' })).toContain('día');
    expect(describeTrigger({ kind: 'holding', itemKind: 'log', count: 2 })).toContain('log');
  });
});

describe('compilación de la envoltura temporal', () => {
  const base: GoalCondition = { type: 'holding', entity: { kind: 'log' } };

  it('sin envoltura, el estado meta pasa tal cual', () => {
    const compiled = compileTemporalGoal({
      kind: 'fetch-item',
      baseSuccess: base,
      temporal: undefined,
      perception: perception(),
      acceptedAtTick: 0,
    });
    expect(compiled.successCondition).toEqual(base);
    expect(compiled.activation).toBeUndefined();
    expect(compiled.failureCondition).toBeUndefined();
  });

  it('"esperá hasta que amanezca": el fin de la espera ES la condición temporal', () => {
    const temporal: GoalTemporal = { until: { kind: 'time-of-day', phase: 'day' } };
    const compiled = compileTemporalGoal({
      kind: 'wait-here',
      baseSuccess: base,
      temporal,
      perception: perception({ self: { id: 'a', position: { x: 2, y: 3 }, heldItems: [], inventoryCapacity: 6 } }),
      acceptedAtTick: 0,
    });
    expect(compiled.mode).toBe('achievement');
    expect(compiled.successCondition).toEqual({
      type: 'all',
      conditions: [
        { type: 'self-at', position: { x: 2, y: 3 } },
        { type: 'time-of-day', phase: 'day' },
      ],
    });
  });

  it('"quedate diez segundos": una duración ancla la posición y cuenta ticks', () => {
    const temporal: GoalTemporal = { durationTicks: 40 };
    const compiled = compileTemporalGoal({
      kind: 'wait-here',
      baseSuccess: base,
      temporal,
      perception: perception(),
      acceptedAtTick: 5,
    });
    expect(temporalIsTerminal(temporal)).toBe(true);
    expect(compiled.successCondition).toEqual({
      type: 'all',
      conditions: [
        { type: 'self-at', position: { x: 1, y: 1 } },
        { type: 'elapsed', comparison: 'at-least', ticks: 40 },
      ],
    });
  });

  it('"cuando tengas dos troncos": startWhen produce la condición de inicio, no el fin', () => {
    const temporal: GoalTemporal = { startWhen: { kind: 'holding', itemKind: 'log', count: 2 } };
    const compiled = compileTemporalGoal({
      kind: 'craft-item',
      baseSuccess: base,
      temporal,
      perception: perception(),
      acceptedAtTick: 0,
    });
    expect(compiled.activation).toEqual({ type: 'holding', entity: { kind: 'log' }, count: 2 });
    expect(compiled.successCondition).toEqual(base); // el fin sigue siendo cumplir el encargo
    expect(compiled.mode).toBeUndefined();
  });

  it('un plazo se compila a una condición de fracaso sobre el tick absoluto', () => {
    const temporal: GoalTemporal = { deadlineTicks: 20 };
    const compiled = compileTemporalGoal({
      kind: 'fetch-item',
      baseSuccess: base,
      temporal,
      perception: perception(),
      acceptedAtTick: 7,
    });
    expect(compiled.failureCondition).toEqual({
      type: 'world-tick',
      comparison: 'at-least',
      tick: 27,
    });
  });
});

describe('ciclo de vida de objetivos temporales (mundo real, por ticks)', () => {
  it('un objetivo con condición de inicio duerme y despierta cuando el mundo la cumple', async () => {
    const { world, petId, agent } = makeAgent();
    const startWhen: Trigger = { kind: 'holding', itemKind: 'log', count: 2 };
    const decision = await agent.decideOnRequest(
      { kind: 'wait-here', raw: 'cuando tengas dos troncos, quedate quieta', temporal: { startWhen } },
      buildPerception(world, petId),
    );
    expect(decision.classification).toBe('accepted');
    const goalId = decision.goalId!;
    expect(agent.goals.get(goalId)?.status).toBe('suspended');

    // Sin troncos, sigue dormido por más que pasen los ticks.
    await runAgentInWorld(world, agent, { maxTicks: 4 });
    expect(agent.goals.get(goalId)?.status).toBe('suspended');
    expect(agent.goals.get(goalId)?.activatedAtTick).toBeUndefined();

    // Aparecen los dos troncos: al próximo tick el objetivo despierta.
    giveLogs(world, petId, 2);
    await runAgentInWorld(world, agent, { maxTicks: 1 });
    const woken = agent.goals.get(goalId)!;
    expect(woken.status).toBe('active');
    expect(woken.activatedAtTick).toBe(world.tick - 1);
  });

  it('una condición que nunca ocurre deja el objetivo dormido para siempre', async () => {
    const { world, petId, agent } = makeAgent();
    const decision = await agent.decideOnRequest(
      {
        kind: 'wait-here',
        raw: 'si aparece un dragón, escondete',
        temporal: { startWhen: { kind: 'entity-appears', entityKind: 'dragon' } },
      },
      buildPerception(world, petId),
    );
    const goalId = decision.goalId!;
    await runAgentInWorld(world, agent, { maxTicks: 30 });
    expect(agent.goals.get(goalId)?.status).toBe('suspended');
  });

  it('un plazo que vence hace fracasar al objetivo, aunque nunca haya arrancado', async () => {
    const { world, petId, agent } = makeAgent();
    const decision = await agent.decideOnRequest(
      {
        kind: 'wait-here',
        raw: 'si aparece un dragón escondete, pero solo por un rato',
        temporal: {
          startWhen: { kind: 'entity-appears', entityKind: 'dragon' },
          deadlineTicks: 5,
        },
      },
      buildPerception(world, petId),
    );
    const goalId = decision.goalId!;
    expect(agent.goals.get(goalId)?.status).toBe('suspended');
    await runAgentInWorld(world, agent, { maxTicks: 8 });
    expect(agent.goals.get(goalId)?.status).toBe('failed');
    const failed = agent.events.ofType('goal.failed').map((event) => event.data.goalId);
    expect(failed).toContain(goalId);
  });

  it('la espera sobrevive a guardar y restaurar: despierta tras recargar', async () => {
    const first = makeAgent();
    const decision = await first.agent.decideOnRequest(
      {
        kind: 'wait-here',
        raw: 'cuando tengas dos troncos, quedate quieta',
        temporal: { startWhen: { kind: 'holding', itemKind: 'log', count: 2 } },
      },
      buildPerception(first.world, first.petId),
    );
    const goalId = decision.goalId!;
    expect(first.agent.goals.get(goalId)?.status).toBe('suspended');

    // Se guarda a mitad de la espera y se restaura en un agente nuevo.
    const saved = first.agent.exportState();
    const revived = new AnimaAgent({
      petId: first.petId,
      petName: 'Anima',
      provider: new MockModelProvider(),
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: [],
      evaluationSeeds: [1],
      guidanceEnabled: false,
    });
    revived.importState(saved);
    const restoredGoal = revived.goals.get(goalId)!;
    expect(restoredGoal.status).toBe('suspended');
    expect(restoredGoal.activation).toBeDefined();
    expect(restoredGoal.userRequest?.temporal?.startWhen).toEqual({
      kind: 'holding',
      itemKind: 'log',
      count: 2,
    });

    // El mundo restaurado provee los troncos: el objetivo despierta como si nada.
    giveLogs(first.world, first.petId, 2);
    await runAgentInWorld(first.world, revived, { maxTicks: 1 });
    expect(revived.goals.get(goalId)?.status).toBe('active');
  });

  it('"esperá hasta que amanezca": se cierra cuando el reloj marca el día', async () => {
    // Arranca de noche; amanece en el tick 3.
    const { world, petId, agent } = makeAgent((w) => {
      w.clock = { dayTicks: 60, nightTicks: 3, offset: 60 };
    });
    expect(buildPerception(world, petId).timeOfDay).toBe('night');
    const decision = await agent.decideOnRequest(
      {
        kind: 'wait-here',
        raw: 'esperá hasta que amanezca',
        temporal: { until: { kind: 'time-of-day', phase: 'day' } },
      },
      buildPerception(world, petId),
    );
    const goalId = decision.goalId!;
    await runAgentInWorld(world, agent, {
      maxTicks: 30,
      stopWhen: (_w, a) => a.goals.get(goalId)?.status === 'completed',
    });
    expect(agent.goals.get(goalId)?.status).toBe('completed');
  });
});

describe('el modelo interpreta la envoltura y NO la pisa el parser determinista', () => {
  // Un proveedor que interpreta lenguaje (interpretsLanguage: true), como Codex
  // o Claude, guionado para devolver una interpretación CON envoltura temporal.
  // Es exactamente el camino que sigue un mensaje de chat real: cuando el modelo
  // interpreta, el parser determinista NO corre como fast-path (solo es red de
  // seguridad ante un fallo del modelo), así que la envoltura del modelo tiene
  // que llegar intacta al objetivo.
  function agentWithScriptedModel(command: unknown): {
    world: WorldState;
    petId: EntityId;
    agent: AnimaAgent;
  } {
    const bundle = openField.build(31);
    const provider = new ScriptedModelProvider(
      [{ kind: 'command.interpretation', command } as never],
      { interpretsLanguage: true },
    );
    const agent = new AnimaAgent({
      petId: bundle.petId,
      petName: 'Anima',
      provider,
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: [],
      evaluationSeeds: [1],
      guidanceEnabled: false,
    });
    return { world: bundle.world, petId: bundle.petId, agent };
  }

  it('un "until" del modelo llega al objetivo como condición de fin', async () => {
    const { world, agent } = agentWithScriptedModel({
      action: 'wait-here',
      temporal: { until: { kind: 'time-of-day', phase: 'day' } },
    });
    agent.receiveUserMessage('esperá acá hasta que amanezca');
    await runAgentInWorld(world, agent, {
      maxTicks: 3,
      stopWhen: (_w, a) => a.goals.all().some((g) => g.source === 'user-request'),
    });
    const goal = agent.goals.all().find((g) => g.source === 'user-request')!;
    expect(goal).toBeDefined();
    expect(goal.userRequest?.kind).toBe('wait-here');
    // La envoltura del modelo sobrevivió el camino entero (no la pisó una
    // interpretación plana): el objetivo se cierra al amanecer, no a los 6 ticks.
    expect(goal.userRequest?.temporal?.until).toEqual({ kind: 'time-of-day', phase: 'day' });
    expect(JSON.stringify(goal.successCondition)).toContain('time-of-day');
  });

  it('un "startWhen" del modelo suspende el objetivo con su condición de inicio', async () => {
    const { world, agent } = agentWithScriptedModel({
      action: 'wait-here',
      temporal: { startWhen: { kind: 'holding', itemKind: 'log', count: 2 } },
    });
    agent.receiveUserMessage('cuando tengas dos troncos, quedate quieta');
    await runAgentInWorld(world, agent, {
      maxTicks: 3,
      stopWhen: (_w, a) => a.goals.all().some((g) => g.source === 'user-request'),
    });
    const goal = agent.goals.all().find((g) => g.source === 'user-request')!;
    expect(goal.userRequest?.temporal?.startWhen).toEqual({
      kind: 'holding',
      itemKind: 'log',
      count: 2,
    });
    expect(goal.status).toBe('suspended');
    expect(goal.activation).toEqual({ type: 'holding', entity: { kind: 'log' }, count: 2 });
  });

  it('las duraciones del modelo llegan en segundos y se guardan como ticks', async () => {
    const { world, agent } = agentWithScriptedModel({
      action: 'wait-here',
      temporal: { durationSeconds: 10 },
    });
    agent.receiveUserMessage('quedate acá diez segundos');
    await runAgentInWorld(world, agent, {
      maxTicks: 3,
      stopWhen: (_w, a) => a.goals.all().some((g) => g.source === 'user-request'),
    });
    const goal = agent.goals.all().find((g) => g.source === 'user-request')!;
    // 10 s → 10 × TICKS_PER_SECOND (4) = 40 ticks, contados desde la activación.
    expect(goal.userRequest?.temporal?.durationTicks).toBe(40);
    expect(JSON.stringify(goal.successCondition)).toContain('elapsed');
  });
});
