import { beforeAll, describe, expect, it } from 'vitest';
import { getEntity, spawn } from '@anima/sim-core';
import type { WorldState } from '@anima/sim-core';
import { SkillLibrary } from '@anima/skill-runtime';
import { RegressionStore } from '@anima/skill-evaluator';
import {
  MockModelProvider,
  ScriptedModelProvider,
  UnconfiguredModelProvider,
} from '@anima/model-providers';
import { foodBehindWall, MVP_SCENARIOS, openField } from '@anima/test-scenarios';
import {
  AnimaAgent,
  GOAL_RESTORE_ENERGY,
  runAgentInWorld,
  SKILL_REACH_BLOCKED_FOOD,
} from '../src/index.js';

function makeAgent(overrides: Partial<ConstructorParameters<typeof AnimaAgent>[0]> = {}) {
  const provider = new MockModelProvider();
  const library = new SkillLibrary();
  const regressions = new RegressionStore();
  const agent = new AnimaAgent({
    petId: 'e1',
    petName: 'Anima',
    provider,
    library,
    regressions,
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11, 22, 33],
    guidanceEnabled: true,
    now: () => '2026-07-16T00:00:00Z',
    ...overrides,
  });
  return { agent, provider, library, regressions };
}

describe('historia completa del MVP (headless, sin IA externa)', () => {
  const { agent, provider, library } = makeAgent();
  let world: WorldState;
  let result: Awaited<ReturnType<typeof runAgentInWorld>>;

  beforeAll(async () => {
    const bundle = foodBehindWall.build(5);
    world = bundle.world;
    expect(bundle.petId).toBe('e1');
    result = await runAgentInWorld(world, agent, {
      maxTicks: 300,
      stopWhen: (_w, a) => a.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed',
    });
  });

  it('formula hipótesis y objetivo a partir de la señal de energía', () => {
    const types = agent.events.events.map((e) => e.type);
    expect(types).toContain('guidance.shown');
    expect(types).toContain('hypothesis.updated');
    expect(types).toContain('goal.created');
    expect(agent.goals.byDescription(GOAL_RESTORE_ENERGY)).toBeDefined();
  });

  it('intenta la vía directa, falla y prohíbe repetirla sin cambios', () => {
    const failed = agent.events.ofType('strategy.failed');
    expect(failed.some((e) => e.data.strategy === 'direct-approach')).toBe(true);
    const forbidden = agent.events.ofType('strategy.forbidden');
    expect(forbidden.some((e) => e.data.strategy === 'direct-approach')).toBe(true);
    expect(agent.progress.isForbidden('goal-1', 'direct-approach')).toBe(true);
  });

  it('crea una skill: la v1 defectuosa se rechaza y la v2 se promueve', () => {
    const types = agent.events.events.map((e) => e.type);
    expect(types).toContain('skill.requested');
    expect(types).toContain('skill.test.failed');
    expect(types).toContain('skill.promoted');
    expect(types.indexOf('skill.test.failed')).toBeLessThan(types.indexOf('skill.promoted'));

    const stable = library.findStable(SKILL_REACH_BLOCKED_FOOD);
    expect(stable?.version).toBe(2);
    // La v1 quedó archivada con sus fallos conocidos.
    const versions = library.versionsOf(SKILL_REACH_BLOCKED_FOOD);
    expect(versions[0]?.status).toBe('archived');
    expect(versions[0]?.knownFailures.length).toBeGreaterThan(0);
  });

  it('alcanza el alimento, recupera energía y completa el objetivo', () => {
    expect(result.worldEvents.some((e) => e.type === 'entity.destroyed')).toBe(true);
    expect(result.worldEvents.some((e) => e.type === 'item.consumed')).toBe(true);
    expect(agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status).toBe('completed');
    const pet = getEntity(world, 'e1');
    expect(pet?.components.energy?.current).toBeGreaterThan(20);
  });

  it('recuerda el descubrimiento y puede explicarlo', () => {
    const facts = agent.memory.factList().map((f) => f.statement);
    expect(facts).toContain('consumir alimento recupera energía');
    expect(facts.some((f) => f.includes('branch') && f.includes('no puede'))).toBe(true);
    const explanation = agent.explainLearning();
    expect(explanation).toContain('habilidad');
    expect(explanation.length).toBeLessThan(500);
  });

  it('reutiliza la skill estable sin volver a consultar al modelo', async () => {
    const proposeCalls = provider.callCount('skill.propose');
    const reviseCalls = provider.callCount('skill.revise');
    const interpretCalls = provider.callCount('interpret.signal');
    expect(proposeCalls).toBe(1);
    expect(reviseCalls).toBe(1);
    expect(interpretCalls).toBe(1);

    // Vuelve a tener hambre: aparece comida nueva, la energía cae.
    const pet = getEntity(world, 'e1')!;
    pet.components.energy!.current = 12;
    spawn(world, 'food', {
      position: { x: 7, y: 1 },
      portable: {},
      edible: {},
      nutrition: { value: 30 },
    });

    const second = await runAgentInWorld(world, agent, {
      maxTicks: 120,
      stopWhen: (_w, a) =>
        a.goals
          .all()
          .filter((g) => g.description === GOAL_RESTORE_ENERGY && g.status === 'completed')
          .length >= 2,
    });
    expect(second.worldEvents.some((e) => e.type === 'item.consumed')).toBe(true);
    // Cero consultas cognitivas nuevas: el conocimiento quedó incorporado.
    expect(provider.callCount('skill.propose')).toBe(proposeCalls);
    expect(provider.callCount('skill.revise')).toBe(reviseCalls);
    expect(provider.callCount('interpret.signal')).toBe(interpretCalls);
    // Y no duplica la hipótesis ya confirmada.
    expect(
      agent.memory.hypothesisList().filter((h) => h.statement.includes('energía')),
    ).toHaveLength(1);
    const stable = library.findStable(SKILL_REACH_BLOCKED_FOOD)!;
    expect(stable.metrics.totalRuns).toBeGreaterThan(0);

    // El resumen de aprendizaje se anuncia una sola vez, aunque vuelva a comer.
    const afterSecondMeal = await runAgentInWorld(world, agent, { maxTicks: 2 });
    const spoken = [...result.worldEvents, ...second.worldEvents, ...afterSecondMeal.worldEvents]
      .filter((event) => event.type === 'agent.spoke')
      .map((event) => String(event.data.text));
    expect(spoken.filter((text) => text.startsWith('Aprendí que'))).toHaveLength(1);
  });
});

describe('diálogo y órdenes del usuario', () => {
  it('responde saludos mediante el proveedor de diálogo', async () => {
    const { agent, provider } = makeAgent();
    const bundle = openField.build(9);
    const result = await runAgentInWorld(bundle.world, agent, {
      maxTicks: 3,
      userMessagesAt: { 0: 'hola' },
    });

    expect(provider.callCount('dialogue')).toBe(1);
    expect(
      result.worldEvents.some(
        (event) => event.type === 'agent.spoke' && String(event.data.text).includes('¡Hola!'),
      ),
    ).toBe(true);
  });

  it('expone el error real cuando falla el proveedor de diálogo', async () => {
    const provider = new UnconfiguredModelProvider();
    const { agent } = makeAgent({ provider });
    const bundle = openField.build(91);
    getEntity(bundle.world, agent.petId)!.components.energy!.current = 40;
    const result = await runAgentInWorld(bundle.world, agent, {
      maxTicks: 2,
      userMessagesAt: { 0: 'hola' },
    });

    expect(
      result.worldEvents.some(
        (event) =>
          event.type === 'agent.spoke' &&
          String(event.data.text).includes('No hay un modelo real configurado'),
      ),
    ).toBe(true);
    expect(agent.events.ofType('provider.error')[0]?.data).toMatchObject({
      provider: 'unconfigured',
      operation: 'interpret.command',
      message: expect.stringContaining('No hay un modelo real configurado'),
    });
  });

  it('ejecuta una orden con redacción libre interpretada por el modelo', async () => {
    const provider = new ScriptedModelProvider([
      {
        kind: 'command.interpretation',
        command: { action: 'consume-item', targetKind: 'food' },
      },
    ]);
    const { agent } = makeAgent({ provider });
    const bundle = openField.build(92);
    getEntity(bundle.world, agent.petId)!.components.energy!.current = 40;

    const result = await runAgentInWorld(bundle.world, agent, {
      maxTicks: 100,
      userMessagesAt: { 0: '¿serías tan amable de ingerir la fruta que ves?' },
      stopWhen: (_world, currentAgent) =>
        currentAgent.goals
          .all()
          .some((goal) => goal.source === 'user-request' && goal.status === 'completed'),
    });

    expect(provider.callCount('interpret.command')).toBe(1);
    expect(provider.callCount('dialogue')).toBe(0);
    expect(result.worldEvents.some((event) => event.type === 'item.consumed')).toBe(true);
  });

  it('explica el límite si el modelo interpreta una acción aún no ejecutable', async () => {
    const provider = new ScriptedModelProvider([
      {
        kind: 'command.interpretation',
        command: { action: 'unsupported', summary: 'construir una casa con la rama' },
      },
    ]);
    const { agent } = makeAgent({ provider });
    const bundle = openField.build(93);
    getEntity(bundle.world, agent.petId)!.components.energy!.current = 40;

    const result = await runAgentInWorld(bundle.world, agent, {
      maxTicks: 3,
      userMessagesAt: { 0: 'armate un refugio usando ese palo' },
    });

    expect(
      result.worldEvents.some(
        (event) =>
          event.type === 'agent.spoke' &&
          String(event.data.text).includes('construir una casa con la rama'),
      ),
    ).toBe(true);
    expect(agent.goals.all().some((goal) => goal.source === 'user-request')).toBe(false);
    expect(agent.events.ofType('user.request.refused')[0]?.data).toMatchObject({
      classification: 'cannot',
    });
  });

  it('ejecuta una orden natural de comer en el mundo', async () => {
    const { agent } = makeAgent();
    const bundle = openField.build(10);
    const result = await runAgentInWorld(bundle.world, agent, {
      maxTicks: 100,
      userMessagesAt: { 0: 'come esa manzana' },
      stopWhen: (_world, currentAgent) =>
        currentAgent.goals
          .all()
          .some((goal) => goal.source === 'user-request' && goal.status === 'completed'),
    });

    expect(result.worldEvents.some((event) => event.type === 'item.consumed')).toBe(true);
    expect(
      agent.goals
        .all()
        .some((goal) => goal.source === 'user-request' && goal.status === 'completed'),
    ).toBe(true);
  });

  it('mantiene la última orden tras restaurar y resuelve "hacelo igual"', async () => {
    const { agent, provider } = makeAgent();
    const bundle = foodBehindWall.build(12);
    getEntity(bundle.world, agent.petId)!.components.energy!.current = 40;

    await runAgentInWorld(bundle.world, agent, {
      maxTicks: 2,
      userMessagesAt: { 0: 'intenta talar el árbol con el hammer' },
    });
    const legacySave = agent.exportState();
    delete legacySave.lastUserRequest;
    agent.importState(legacySave);
    agent.receiveUserMessage('hacelo igual');
    await runAgentInWorld(bundle.world, agent, { maxTicks: 2 });

    const refusals = agent.events.ofType('user.request.refused');
    expect(refusals).toHaveLength(2);
    expect(refusals.map((event) => event.data.request)).toEqual([
      expect.objectContaining({ kind: 'destroy-entity', targetKind: 'tree' }),
      expect.objectContaining({ kind: 'destroy-entity', targetKind: 'tree', raw: 'hacelo igual' }),
    ]);
    expect(provider.callCount('dialogue')).toBe(0);
  });
});

describe('conversación intercalada con acción', () => {
  it('responde una petición del usuario sin abandonar su objetivo', async () => {
    const { agent } = makeAgent();
    const bundle = foodBehindWall.build(5);
    const result = await runAgentInWorld(bundle.world, agent, {
      maxTicks: 300,
      userMessagesAt: { 3: 'espera un momento' },
      stopWhen: (_w, a) => a.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'completed',
    });
    expect(agent.events.ofType('user.request.accepted').length).toBeGreaterThan(0);
    expect(result.worldEvents.some((e) => e.type === 'agent.spoke')).toBe(true);
    // El objetivo principal se mantuvo y se completó igualmente.
    expect(agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status).toBe('completed');
  });
});

describe('bloqueo sin salida', () => {
  it('agota estrategias, pide ayuda y suspende el objetivo', async () => {
    const noTools = {
      name: 'no-tools',
      build(seed: number) {
        const bundle = foodBehindWall.build(seed);
        for (const entity of Object.values(bundle.world.entities)) {
          if (entity.kind === 'branch' || entity.kind === 'hammer') {
            delete bundle.world.entities[entity.id];
          }
        }
        return bundle;
      },
    };
    const { agent, library } = makeAgent({ evaluationScenarios: [noTools] });
    const bundle = noTools.build(5);
    await runAgentInWorld(bundle.world, agent, {
      maxTicks: 200,
      stopWhen: (_w, a) => a.goals.byDescription(GOAL_RESTORE_ENERGY)?.status === 'suspended',
    });
    const types = agent.events.events.map((e) => e.type);
    expect(types).toContain('help.requested');
    expect(types).toContain('goal.suspended');
    expect(agent.goals.byDescription(GOAL_RESTORE_ENERGY)?.status).toBe('suspended');
    // Ninguna versión se promovió.
    expect(library.findStable(SKILL_REACH_BLOCKED_FOOD)).toBeUndefined();
  });
});
