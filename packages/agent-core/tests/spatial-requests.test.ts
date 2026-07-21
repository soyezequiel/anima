import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

const CROSS_RIDGE: ModelResponse = {
  kind: 'command.interpretation',
  command: {
    action: 'spatial-relation',
    relation: 'opposite-side',
    targetKind: 'crystal-ridge',
  },
};

function worldWithRidge(options: { gap: boolean; hammer: boolean }): {
  world: WorldState;
  petId: EntityId;
} {
  const world = createWorld({ width: 8, height: 5, seed: 17 });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 49, max: 50, decayPerTick: 0.001 },
    health: { current: 10, max: 10 },
    strength: { value: 3 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 10 },
  }).id;
  for (let y = 0; y < 5; y++) {
    if (options.gap && y === 2) continue;
    spawn(world, 'crystal-ridge', {
      position: { x: 3, y },
      collider: { solid: true },
      hardness: { value: 2 },
      durability: { current: 5, max: 5 },
    });
  }
  if (options.hammer) {
    spawn(world, 'hammer', { position: { x: 2, y: 2 }, portable: {}, tool: { power: 8 } });
  }
  return { world, petId };
}

function makeAgent(
  petId: EntityId,
  response: ModelResponse = CROSS_RIDGE,
): { agent: AnimaAgent; provider: ScriptedModelProvider } {
  const provider = new ScriptedModelProvider([response], { interpretsLanguage: true });
  const agent = new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-21T00:00:00Z',
  });
  return { agent, provider };
}

async function run(
  world: WorldState,
  petId: EntityId,
  agent: AnimaAgent,
  ticks = 200,
): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(world, petId));
    agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    const open = agent.goals
      .all()
      .some((goal) => goal.source === 'user-request' && goal.status === 'active');
    if (!open) return;
  }
}

describe('pedidos espaciales relativos', () => {
  it('cruza por una abertura y completa solo cuando termina del lado opuesto', async () => {
    const { world, petId } = worldWithRidge({ gap: true, hammer: false });
    const { agent, provider } = makeAgent(petId);
    agent.receiveUserMessage('cruzá la cresta de cristal');

    await run(world, petId, agent);

    expect(world.entities[petId]!.components.position!.x).toBeGreaterThan(3);
    expect(agent.goals.all().find((goal) => goal.source === 'user-request')).toMatchObject({
      status: 'completed',
      userRequest: {
        kind: 'spatial-relation',
        relation: 'opposite-side',
        spatial: { axis: 'x', startingSide: -1 },
      },
    });
    expect(provider.callCount('skill.contract')).toBe(0);
  });

  it('si no hay rodeo abre un hueco, cruza y recién entonces completa', async () => {
    const { world, petId } = worldWithRidge({ gap: false, hammer: true });
    const { agent } = makeAgent(petId);
    agent.receiveUserMessage('pasá al otro lado de la cresta');
    const initialBlocks = Object.values(world.entities).filter(
      (entity) => entity.kind === 'crystal-ridge' && entity.components.position,
    ).length;

    await run(world, petId, agent, 300);

    const remainingBlocks = Object.values(world.entities).filter(
      (entity) => entity.kind === 'crystal-ridge' && entity.components.position,
    ).length;
    expect(remainingBlocks).toBeLessThan(initialBlocks);
    expect(world.entities[petId]!.components.position!.x).toBeGreaterThan(3);
    expect(agent.events.ofType('goal.completed')).toHaveLength(1);
  });

  it('sin ruta ni herramienta no finge haber cruzado', async () => {
    const { world, petId } = worldWithRidge({ gap: false, hammer: false });
    const { agent } = makeAgent(petId);
    agent.receiveUserMessage('cruzá la cresta');

    await run(world, petId, agent);

    expect(world.entities[petId]!.components.position!.x).toBeLessThan(3);
    expect(agent.goals.all().find((goal) => goal.source === 'user-request')?.status).toBe('failed');
    expect(agent.events.ofType('goal.completed')).toHaveLength(0);
  });

  it.each([
    ['near', 'acercate a la fogata'],
    ['far-from', 'alejate de la fogata'],
  ] as const)(
    'resuelve también la relación %s contra cualquier referencia',
    async (relation, text) => {
      const world = createWorld({ width: 8, height: 5, seed: 21 });
      const petId = spawn(world, 'pet', {
        position: { x: 1, y: 2 },
        collider: { solid: true },
        energy: { current: 49, max: 50, decayPerTick: 0.001 },
        health: { current: 10, max: 10 },
        strength: { value: 3 },
        inventory: { items: [], capacity: 6 },
        agent: { name: 'Anima', perceptionRange: 10 },
      }).id;
      spawn(world, 'campfire', {
        position: { x: 3, y: 2 },
        heatSource: { warmthPerTick: 1, range: 2 },
      });
      const response: ModelResponse = {
        kind: 'command.interpretation',
        command: { action: 'spatial-relation', relation, targetKind: 'campfire' },
      };
      const { agent } = makeAgent(petId, response);
      agent.receiveUserMessage(text);

      await run(world, petId, agent);

      const goal = agent.goals.all().find((candidate) => candidate.source === 'user-request');
      expect(goal?.status).toBe('completed');
      const final = world.entities[petId]!.components.position!;
      const distance = Math.abs(final.x - 3) + Math.abs(final.y - 2);
      if (relation === 'near') expect(distance).toBeLessThanOrEqual(1);
      else expect(distance).toBeGreaterThanOrEqual(goal!.userRequest!.spatial!.minimumDistance!);
    },
  );

  it('pide una referencia cuando hay dos candidatas igual de salientes', async () => {
    const world = createWorld({ width: 7, height: 5, seed: 23 });
    const petId = spawn(world, 'pet', {
      position: { x: 3, y: 2 },
      collider: { solid: true },
      energy: { current: 49, max: 50, decayPerTick: 0.001 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Anima', perceptionRange: 10 },
    }).id;
    spawn(world, 'campfire', {
      position: { x: 1, y: 2 },
      heatSource: { warmthPerTick: 1, range: 2 },
    });
    spawn(world, 'campfire', {
      position: { x: 5, y: 2 },
      heatSource: { warmthPerTick: 1, range: 2 },
    });
    const response: ModelResponse = {
      kind: 'command.interpretation',
      command: { action: 'spatial-relation', relation: 'near', targetKind: 'campfire' },
    };
    const { agent } = makeAgent(petId, response);
    agent.receiveUserMessage('acercate a la fogata');

    await agent.think(buildPerception(world, petId));

    expect(agent.goals.all().filter((goal) => goal.source === 'user-request')).toHaveLength(0);
  });
});
