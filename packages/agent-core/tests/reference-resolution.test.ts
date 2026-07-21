import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

function makeWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 9, height: 5, seed: 41 });
  const petId = spawn(world, 'pet', {
    position: { x: 4, y: 2 },
    collider: { solid: true },
    energy: { current: 49, max: 50, decayPerTick: 0.001 },
    health: { current: 10, max: 10 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 10 },
  }).id;
  return { world, petId };
}

function makeAgent(petId: EntityId, response: ModelResponse): AnimaAgent {
  return makeAgentWithResponses(petId, [response]);
}

function makeAgentWithResponses(petId: EntityId, responses: ModelResponse[]): AnimaAgent {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider: new ScriptedModelProvider(responses, { interpretsLanguage: true }),
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-21T00:00:00Z',
  });
}

async function run(world: WorldState, petId: EntityId, agent: AnimaAgent): Promise<void> {
  for (let i = 0; i < 120; i++) {
    const intent = await agent.think(buildPerception(world, petId));
    agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    if (!agent.goals.all().some((goal) => goal.status === 'active')) return;
  }
}

describe('resolución de referencias a entidades', () => {
  it('ancla una descripción espacial a una identidad y recoge exactamente esa', async () => {
    const { world, petId } = makeWorld();
    const left = spawn(world, 'log', { position: { x: 1, y: 2 }, portable: {} });
    spawn(world, 'rock', { position: { x: 4, y: 1 }, collider: { solid: true } });
    const right = spawn(world, 'log', { position: { x: 7, y: 2 }, portable: {} });
    const response: ModelResponse = {
      kind: 'command.interpretation',
      command: {
        action: 'fetch-item',
        targetKind: 'log',
        targetSelector: {
          kind: 'log',
          definiteness: 'specific',
          reference: 'none',
          relation: 'right-of',
          anchorKind: 'rock',
        },
      },
    };
    const agent = makeAgent(petId, response);
    agent.receiveUserMessage('traé el tronco a la derecha de la roca');

    await run(world, petId, agent);

    const held = world.entities[petId]!.components.inventory!.items;
    expect(held).toContain(right.id);
    expect(held).not.toContain(left.id);
    expect(agent.goals.all()[0]?.userRequest?.targetEntityId).toBe(right.id);
  });

  it('si una referencia definida empata, pregunta en vez de elegir al azar', async () => {
    const { world, petId } = makeWorld();
    spawn(world, 'log', { position: { x: 2, y: 2 }, portable: {} });
    spawn(world, 'log', { position: { x: 6, y: 2 }, portable: {} });
    const response: ModelResponse = {
      kind: 'command.interpretation',
      command: {
        action: 'fetch-item',
        targetKind: 'log',
        targetSelector: {
          kind: 'log',
          definiteness: 'specific',
          reference: 'none',
          relation: 'none',
        },
      },
    };
    const agent = makeAgent(petId, response);
    agent.receiveUserMessage('traé el tronco');

    const reply = await agent.think(buildPerception(world, petId));

    expect(agent.goals.all()).toHaveLength(0);
    expect(reply).toMatchObject({ type: 'speak' });
    expect(reply?.type === 'speak' ? reply.text : '').toContain('necesito que me indiques cuál');
  });

  it('el estado persistido conserva la identidad discursiva', async () => {
    const { world, petId } = makeWorld();
    const log = spawn(world, 'log', { position: { x: 5, y: 2 }, portable: {} });
    const response: ModelResponse = {
      kind: 'command.interpretation',
      command: { action: 'fetch-item', targetKind: 'log' },
    };
    const agent = makeAgent(petId, response);
    agent.receiveUserMessage('traé un tronco');
    await run(world, petId, agent);

    expect(agent.exportState().references?.lastUsed[0]).toBe(log.id);
    const restored = makeAgent(petId, response);
    restored.importState(agent.exportState());
    expect(restored.exportState().references).toEqual(agent.exportState().references);
  });

  it('“el otro” excluye el individuo recién manipulado', async () => {
    const { world, petId } = makeWorld();
    const first = spawn(world, 'log', { position: { x: 5, y: 2 }, portable: {} });
    const second = spawn(world, 'log', { position: { x: 7, y: 2 }, portable: {} });
    const generic: ModelResponse = {
      kind: 'command.interpretation',
      command: { action: 'fetch-item', targetKind: 'log' },
    };
    const other: ModelResponse = {
      kind: 'command.interpretation',
      command: {
        action: 'fetch-item',
        targetKind: 'log',
        targetSelector: {
          kind: 'log',
          definiteness: 'specific',
          reference: 'other',
          relation: 'none',
        },
      },
    };
    const agent = makeAgentWithResponses(petId, [generic, other]);

    agent.receiveUserMessage('traé un tronco');
    await run(world, petId, agent);
    agent.receiveUserMessage('ahora traé el otro tronco');
    await run(world, petId, agent);

    expect(world.entities[petId]!.components.inventory!.items).toEqual(
      expect.arrayContaining([first.id, second.id]),
    );
  });
});
