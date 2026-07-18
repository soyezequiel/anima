import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { Blueprint, EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, GoalManager } from '../src/index.js';

/**
 * ADR 0053. Un encargo se descompone en sub-objetivos visibles: un «conseguir
 * N× tal cosa» por materia y un remate («levantar la obra»). Son objetivos de
 * verdad —persisten, cambian de estado, cierran en cascada con el padre— pero
 * NO compiten en la fila: quien trabaja es el programa del padre, y los pasos
 * son el mapa de ese trabajo, cumplidos por la misma cuenta del mundo con la
 * que el encargo se suspende y retoma.
 */

const HUT: Blueprint = {
  id: 'choza',
  placements: [
    { kind: 'wall', offset: { x: 1, y: 0 } },
    { kind: 'wall', offset: { x: 2, y: 0 } },
    { kind: 'wall', offset: { x: 1, y: 1 } },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'choza' },
};

function hutWorld(options: { loose?: number } = {}): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 14, height: 9, seed: 5 }, { blueprints: [HUT] });
  const petId = spawn(world, 'pet', {
    position: { x: 2, y: 4 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 14 },
  }).id;
  for (let i = 0; i < (options.loose ?? 3); i++) {
    spawn(world, 'wall', {
      position: { x: 5 + i, y: 7 },
      portable: {},
      hardness: { value: 1 },
      durability: { current: 4, max: 4 },
    });
  }
  return { world, petId };
}

function makeAgent(petId: EntityId) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider: new ScriptedModelProvider([INTERPRET_BUILD], { interpretsLanguage: true }),
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-18T00:00:00Z',
  });
}

async function run(w: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
  }
}

describe('el encargo se descompone en pasos visibles (ADR 0053)', () => {
  it('al ponerse a trabajar planta hijos: juntar cada materia y el remate', async () => {
    const { world, petId } = hutWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');
    await run(world, petId, agent, 6);

    const parent = agent.goals.all().find((g) => g.userRequest?.kind === 'craft-item');
    expect(parent).toBeDefined();
    const children = agent.goals.childrenOf(parent!.id);
    expect(children).toHaveLength(2);

    const gather = children.find((c) => c.step?.kind === 'gather');
    expect(gather?.step).toMatchObject({ kind: 'gather', targetKind: 'wall', need: 3 });
    expect(gather?.description).toContain('conseguir');
    expect(gather?.parentGoalId).toBe(parent!.id);

    const assemble = children.find((c) => c.step?.kind === 'assemble');
    expect(assemble?.description).toContain('levantar');
  });

  it('los hijos no compiten en la fila: selectActive nunca devuelve un paso', async () => {
    const { world, petId } = hutWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');
    await run(world, petId, agent, 6);

    // Aunque los pasos están activos, el elegido es siempre un objetivo raíz.
    const chosen = agent.goals.selectActive();
    expect(chosen).toBeDefined();
    expect(chosen!.parentGoalId).toBeUndefined();
  });

  it('un paso de juntar se tacha solo cuando esa materia deja de faltar', async () => {
    const { world, petId } = hutWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');

    // Se la deja trabajar hasta que el paso de juntar cierre (juntó o colocó).
    let gather;
    for (let i = 0; i < 160; i++) {
      await run(world, petId, agent, 1);
      gather = agent.goals
        .all()
        .find((g) => g.step?.kind === 'gather' && g.step.targetKind === 'wall');
      if (gather?.status === 'completed') break;
    }
    expect(gather?.status).toBe('completed');
    // El cierre del paso quedó contado como SU evento, no como goal.completed:
    // quien escucha el cierre de encargos enteros no ve los pasos intermedios.
    const stepEvents = agent.events.ofType('goal.step.completed');
    expect(stepEvents.some((e) => e.data.goalId === gather!.id)).toBe(true);
  });

  it('terminar el padre arrastra el remate: la obra hecha no deja pasos abiertos', async () => {
    const { world, petId } = hutWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');

    let parent;
    for (let i = 0; i < 200; i++) {
      await run(world, petId, agent, 1);
      parent = agent.goals.all().find((g) => g.userRequest?.kind === 'craft-item');
      if (parent?.status === 'completed') break;
    }
    expect(parent?.status).toBe('completed');
    for (const child of agent.goals.childrenOf(parent!.id)) {
      expect(child.status).toBe('completed');
    }
  });

  it('cada reanudación repone pasos sin duplicar los que ya están', async () => {
    const { world, petId } = hutWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');
    // Correr de sobra: el programa arranca y se reanuda varias veces en el
    // camino (juntar, volver al sitio, colocar). Los pasos no se multiplican.
    await run(world, petId, agent, 120);

    const parent = agent.goals.all().find((g) => g.userRequest?.kind === 'craft-item');
    const children = agent.goals.childrenOf(parent!.id);
    expect(children.filter((c) => c.step?.kind === 'gather')).toHaveLength(1);
    expect(children.filter((c) => c.step?.kind === 'assemble')).toHaveLength(1);
  });

  it('el fracaso del padre no deja hijos huérfanos fingiendo estar en marcha', () => {
    const goals = new GoalManager();
    const base = {
      source: 'user-request' as const,
      priority: 1,
      urgency: 0.7,
      expectedValue: 0.6,
      preconditions: [],
      successCriteria: [],
      failureCriteria: [],
    };
    const parent = goals.create({ ...base, description: 'petición: construí una choza' }, 1);
    const child = goals.create(
      {
        ...base,
        description: 'conseguir 3 muros',
        parentGoalId: parent.id,
        step: { kind: 'gather', targetKind: 'wall', need: 3 },
      },
      1,
    );
    goals.fail(parent.id);
    expect(goals.get(child.id)?.status).toBe('failed');
  });
});
