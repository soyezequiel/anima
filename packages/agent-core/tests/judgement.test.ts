import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * "¿Puedo?" lo decide el mundo; "¿quiero?" lo piensa ella. La frontera entre
 * las dos cosas es lo que estas pruebas defienden: el modelo puede levantar
 * una negativa de valores, y jamás una de física.
 */

class JudgingModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
  readonly seen: ModelRequest[] = [];

  constructor(private judgement: { willing: boolean; reason: string }) {
    super();
  }

  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    if (request.kind === 'judge.destruction') {
      return Promise.resolve({ kind: 'judgement', ...this.judgement });
    }
    if (request.kind === 'interpret.command') {
      return Promise.resolve({
        kind: 'command.interpretation',
        command: { action: 'destroy-entity', targetKind: 'tree' },
      });
    }
    return super.complete(request);
  }
}

interface WorldOptions {
  trees?: number;
  energy?: number;
  hammer?: boolean;
}

function forestWorld(options: WorldOptions = {}): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 9, height: 5, seed: 1 });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: options.energy ?? 40, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 4 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  for (let i = 0; i < (options.trees ?? 2); i++) {
    spawn(world, 'tree', {
      position: { x: 6 + i, y: 4 },
      collider: { solid: true },
      hardness: { value: 5 },
      durability: { current: 15, max: 15 },
    });
  }
  if (options.hammer !== false) {
    spawn(world, 'hammer', { position: { x: 2, y: 2 }, portable: {}, tool: { power: 8 } });
  }
  return { world, petId };
}

function makeAgent(petId: EntityId, provider: ConstructorParameters<typeof AnimaAgent>[0]['provider']) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-16T00:00:00Z',
  });
}

async function say(agent: AnimaAgent, world: WorldState, petId: EntityId, text: string) {
  agent.receiveUserMessage(text);
  const intent = await agent.think(buildPerception(world, petId));
  return intent && intent.type === 'speak' ? intent.text : null;
}

describe('el juicio de valores lo piensa ella', () => {
  it('con otros árboles puede aceptar: talar uno ya no es matarse de hambre', async () => {
    const { world, petId } = forestWorld({ trees: 3 });
    const provider = new JudgingModel({
      willing: true,
      reason: 'Veo tres árboles: puedo talar uno y todavía me quedan dos.',
    });
    const agent = makeAgent(petId, provider);

    const reply = await say(agent, world, petId, 'tala el árbol');

    expect(reply).toBe('Veo tres árboles: puedo talar uno y todavía me quedan dos.');
    expect(agent.events.ofType('user.request.accepted')).toHaveLength(1);
  });

  it('puede mantener la negativa, con su motivo y no con el de la tabla', async () => {
    const { world, petId } = forestWorld({ trees: 1, energy: 8 });
    const provider = new JudgingModel({
      willing: false,
      reason: 'Es el único árbol que veo y tengo hambre: si lo talo me quedo sin nada.',
    });
    const agent = makeAgent(petId, provider);

    const reply = await say(agent, world, petId, 'tala el árbol');

    expect(reply).toContain('el único árbol');
    expect(agent.events.ofType('user.request.refused')).toHaveLength(1);
  });

  it('juzga con hechos verificables, no con opiniones: cuenta lo que ve', async () => {
    const { world, petId } = forestWorld({ trees: 3 });
    const provider = new JudgingModel({ willing: true, reason: 'ok' });
    const agent = makeAgent(petId, provider);

    await say(agent, world, petId, 'tala el árbol');

    const judged = provider.seen.find((r) => r.kind === 'judge.destruction');
    expect(judged).toBeDefined();
    const facts = (judged as { facts: string[] }).facts;
    expect(facts.some((f) => f.includes('veo 3 tree distintos'))).toBe(true);
    expect(facts.some((f) => f.includes('mi energía es 40 de 50'))).toBe(true);
  });

  it('con un solo árbol se lo dice: el hecho que cambia la decisión', async () => {
    const { world, petId } = forestWorld({ trees: 1 });
    const provider = new JudgingModel({ willing: false, reason: 'no' });
    const agent = makeAgent(petId, provider);

    await say(agent, world, petId, 'tala el árbol');

    const judged = provider.seen.find((r) => r.kind === 'judge.destruction');
    const facts = (judged as { facts: string[] }).facts;
    expect(facts.some((f) => f.includes('solo veo 1 tree'))).toBe(true);
  });
});

describe('la frontera: el modelo nunca autoriza un imposible', () => {
  it('sin herramienta es "cannot", y no se le pregunta al modelo', async () => {
    // Física, no valores: no hay nada que opinar sobre un hecho.
    const { world, petId } = forestWorld({ trees: 3, hammer: false });
    const provider = new JudgingModel({ willing: true, reason: 'dale, talo' });
    const agent = makeAgent(petId, provider);

    const reply = await say(agent, world, petId, 'tala el árbol');

    expect(reply).toContain('No tengo ninguna herramienta');
    expect(provider.seen.some((r) => r.kind === 'judge.destruction')).toBe(false);
  });

  it('lo que no ve no se juzga: primero hay que saber dónde está', async () => {
    const world = createWorld({ width: 9, height: 5, seed: 1 });
    const petId = spawn(world, 'pet', {
      position: { x: 1, y: 2 },
      energy: { current: 40, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      inventory: { items: [], capacity: 4 },
      agent: { name: 'Anima', perceptionRange: 12 },
    }).id;
    spawn(world, 'hammer', { position: { x: 2, y: 2 }, portable: {}, tool: { power: 8 } });
    const provider = new JudgingModel({ willing: true, reason: 'dale' });
    const agent = makeAgent(petId, provider);

    const reply = await say(agent, world, petId, 'tala el árbol');

    expect(reply).toContain('No veo ningún árbol');
    expect(provider.seen.some((r) => r.kind === 'judge.destruction')).toBe(false);
  });

  it('si el juicio falla, la negativa determinista se mantiene: ante la duda, no destruye', async () => {
    const { world, petId } = forestWorld({ trees: 3 });
    const provider = new JudgingModel({ willing: true, reason: 'ok' });
    provider.complete = ((request: ModelRequest) =>
      request.kind === 'judge.destruction'
        ? Promise.reject(new Error('cuota agotada'))
        : Promise.resolve({
            kind: 'command.interpretation',
            command: { action: 'destroy-entity', targetKind: 'tree' },
          })) as typeof provider.complete;
    const agent = makeAgent(petId, provider);

    const reply = await say(agent, world, petId, 'tala el árbol');

    expect(reply).toContain('No quiero destruir');
    const errors = agent.events.ofType('provider.error');
    expect(errors[0]?.data.recoveredWith).toBe('refusal');
  });
});

describe('sin modelo, la regla determinista de siempre', () => {
  it('el mock no juzga: se niega como antes, sin consultar nada', async () => {
    const { world, petId } = forestWorld({ trees: 3 });
    const provider = new MockModelProvider();
    const agent = makeAgent(petId, provider);

    const reply = await say(agent, world, petId, 'tala el árbol');

    expect(reply).toContain('No quiero destruir');
    expect(provider.callCount('judge.destruction')).toBe(0);
  });
});
