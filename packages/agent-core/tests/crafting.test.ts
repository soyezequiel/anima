import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { allEntities, buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { CAMPFIRE_RECIPE, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * El cuidador pide construir. La mascota entiende, y si le falta un
 * ingrediente lo dice con nombre y cantidad en vez de fallar en silencio o
 * prometer algo que no puede.
 */

/** Modelo de prueba que interpreta lenguaje a guion. */
class FakeLanguageModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
  readonly seen: ModelRequest[] = [];

  constructor(private scripted: Partial<Record<ModelRequest['kind'], ModelResponse>>) {
    super();
  }

  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    const canned = this.scripted[request.kind];
    if (canned) return Promise.resolve(canned);
    return super.complete(request);
  }
}

function coldWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 9, height: 5, seed: 1 }, { recipes: [CAMPFIRE_RECIPE] });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 40, max: 50, decayPerTick: 0.05 },
    health: { current: 10, max: 10 },
    temperature: { current: 20, max: 50, lossPerTick: 0.1 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  return { world, petId };
}

function give(world: WorldState, petId: EntityId, kind: string, times = 1): void {
  for (let i = 0; i < times; i++) {
    const item = spawn(world, kind, { portable: {} });
    world.entities[petId]!.components.inventory!.items.push(item.id);
  }
}

function makeAgent(
  world: WorldState,
  petId: EntityId,
  provider: ConstructorParameters<typeof AnimaAgent>[0]['provider'],
) {
  const agent = new AnimaAgent({
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
  return { agent, perception: () => buildPerception(world, petId) };
}

const CRAFT_COMMAND: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'campfire' },
};

async function say(
  agent: AnimaAgent,
  perception: ReturnType<typeof buildPerception>,
  text: string,
): Promise<string | null> {
  agent.receiveUserMessage(text);
  const intent = await agent.think(perception);
  return intent && intent.type === 'speak' ? intent.text : null;
}

describe('«construí una fogata con esos troncos»', () => {
  it('sin el pedernal: dice exactamente qué le falta, no que no sabe', async () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    const provider = new FakeLanguageModel({ 'interpret.command': CRAFT_COMMAND });
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), 'construí una fogata con esos troncos');

    expect(reply).toContain('me falta');
    expect(reply).toContain('pedernal');
    // Entiende la orden: no la rechaza por incomprensible ni por imposible.
    expect(reply).toContain('construir');
    const refused = agent.events.ofType('user.request.refused');
    expect(refused).toHaveLength(1);
    expect(refused[0]?.data.classification).toBe('cannot');
  });

  it('si ve el ingrediente que falta, lo dice en vez de prometer traerlo', async () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    spawn(world, 'flint', { position: { x: 3, y: 2 }, portable: {} });
    const provider = new FakeLanguageModel({ 'interpret.command': CRAFT_COMMAND });
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), 'construí una fogata');

    expect(reply).toContain('Veo');
    expect(reply).toContain('pedernal');
  });

  it('con todo en la mano: acepta y el mundo construye la fogata de verdad', async () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    give(world, petId, 'flint');
    const provider = new FakeLanguageModel({ 'interpret.command': CRAFT_COMMAND });
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), 'construí una fogata');
    expect(reply).toBe('Voy a construir una fogata.');

    // El agente pide la intención y el mundo la resuelve.
    for (let i = 0; i < 6 && !allEntities(world).some((e) => e.kind === 'campfire'); i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent) {
        const events = stepWorld(world, [{ actorId: petId, intent }]);
        agent.observe(events);
      }
    }
    expect(allEntities(world).some((e) => e.kind === 'campfire')).toBe(true);
  });

  it('lo que el mundo no sabe construir no se acepta', async () => {
    const { world, petId } = coldWorld();
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'castillo' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), 'construí un castillo');

    expect(reply).toContain('No sé cómo construir');
  });

  it('las recetas del mundo viajan al modelo: sin eso no podría elegir craft-item', async () => {
    const { world, petId } = coldWorld();
    const provider = new FakeLanguageModel({ 'interpret.command': CRAFT_COMMAND });
    const { agent, perception } = makeAgent(world, petId, provider);

    await say(agent, perception(), 'construí una fogata');

    const request = provider.seen.find((r) => r.kind === 'interpret.command');
    expect(request).toMatchObject({
      recipes: [{ id: 'campfire', ingredients: '2x log + 1x flint' }],
    });
  });
});

describe('el parser determinista también entiende construir', () => {
  it('el mock reconoce la orden sin consultar al modelo', async () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    const provider = new MockModelProvider();
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), 'construí una fogata con esos troncos');

    expect(reply).toContain('me falta');
    expect(reply).toContain('pedernal');
    expect(provider.callCount('interpret.command')).toBe(0);
  });

  it('«traé un tronco» sigue siendo buscar, no construir', async () => {
    const { world, petId } = coldWorld();
    spawn(world, 'log', { position: { x: 3, y: 2 }, portable: {} });
    const provider = new MockModelProvider();
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), 'traé un tronco');

    expect(reply).toContain('Voy a buscar');
  });
});
