import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { allEntities, buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { CAMPFIRE_RECIPE, MVP_SCENARIOS, withoutChance } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * IA Dios (ADR 0024): el cuidador describe un objeto en lenguaje natural y la
 * mascota lo traduce a una receta. La misma puerta que juzga sus inventos
 * juzga la traducción, nada entra al mundo sin confirmación, y sin un modelo
 * que entienda lenguaje el flujo degrada a una explicación honesta.
 */

/** Modelo de prueba que interpreta lenguaje a guion (mutable entre turnos). */
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

function quietWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld(
    { width: 9, height: 5, seed: 1 },
    { recipes: [withoutChance(CAMPFIRE_RECIPE)] },
  );
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 40, max: 50, decayPerTick: 0.05 },
    health: { current: 10, max: 10 },
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

async function say(
  agent: AnimaAgent,
  perception: ReturnType<typeof buildPerception>,
  text: string,
): Promise<string | null> {
  agent.receiveUserMessage(text);
  const intent = await agent.think(perception);
  return intent && intent.type === 'speak' ? intent.text : null;
}

const GLORB_DESCRIPTION = 'un glorb es un mineral azul que da calor';

const DESCRIBE_COMMAND: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'describe-entity', description: GLORB_DESCRIPTION },
};

const GLORB_RECIPE: ModelResponse = {
  kind: 'recipe',
  recipe: {
    id: 'glorb',
    output: {
      kind: 'glorb',
      components: { heatSource: { warmthPerTick: 0.5, range: 2 }, portable: {} },
    },
    ingredients: [{ kind: 'flint', count: 1 }],
  },
  rationale: '"da calor" se traduce a heatSource; el pedernal es lo más mineral que veo.',
};

describe('«un glorb es un mineral azul que da calor»', () => {
  it('descripción válida: previsualiza, pide confirmación y recién entonces entra al mundo', async () => {
    const { world, petId } = quietWorld();
    give(world, petId, 'flint');
    const script: Partial<Record<ModelRequest['kind'], ModelResponse>> = {
      'interpret.command': DESCRIBE_COMMAND,
      'entity.describe': GLORB_RECIPE,
    };
    const provider = new FakeLanguageModel(script);
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), GLORB_DESCRIPTION);

    // Previsualiza y pregunta: nada entró al mundo todavía.
    expect(reply).toContain('¿Lo hago parte de mi mundo?');
    const previews = agent.events.ofType('recipe.preview');
    expect(previews).toHaveLength(1);
    expect(previews[0]?.data).toMatchObject({
      recipeId: 'glorb',
      outputKind: 'glorb',
      ingredients: [{ kind: 'flint', count: 1 }],
    });
    expect(previews[0]?.data.components).toMatchObject({ heatSource: { warmthPerTick: 0.5 } });
    expect(world.recipes.some((r) => r.id === 'glorb')).toBe(false);

    // La confirmación la lleva al mundo por proposeRecipe: la puerta revalida.
    agent.receiveUserMessage('sí');
    const intent = await agent.think(perception());
    expect(intent).toMatchObject({ type: 'proposeRecipe' });
    agent.observe(stepWorld(world, [{ actorId: petId, intent: intent! }]));
    expect(world.recipes.some((r) => r.id === 'glorb')).toBe(true);

    // Y lo dice en el chat, con la invitación a pedirlo.
    const closing = await agent.think(perception());
    expect(closing).toMatchObject({ type: 'speak' });
    if (closing?.type === 'speak') expect(closing.text).toContain('Ya sé construir un glorb');

    // Construible de inmediato: «hacé un glorb» usa la receta recién entrada.
    script['interpret.command'] = {
      kind: 'command.interpretation',
      command: { action: 'craft-item', recipeId: 'glorb' },
    };
    const accept = await say(agent, perception(), 'hacé un glorb');
    expect(accept).toContain('Voy a construir un glorb');
    for (let i = 0; i < 10 && !allEntities(world).some((e) => e.kind === 'glorb'); i++) {
      const next = await agent.think(perception());
      if (next) agent.observe(stepWorld(world, [{ actorId: petId, intent: next }]));
    }
    expect(allEntities(world).some((e) => e.kind === 'glorb')).toBe(true);
  });

  it('descripción imposible (mineral comestible): la puerta la rechaza con el motivo', async () => {
    const { world, petId } = quietWorld();
    give(world, petId, 'flint');
    const provider = new FakeLanguageModel({
      'interpret.command': DESCRIBE_COMMAND,
      'entity.describe': {
        kind: 'recipe',
        recipe: {
          id: 'glorb',
          output: { kind: 'glorb', components: { edible: {}, nutrition: { value: 30 } } },
          ingredients: [{ kind: 'flint', count: 1 }],
        },
        rationale: 'un mineral que se come',
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), 'un glorb es un mineral que se come');

    // La negativa es del mundo, con su motivo: describirla no la vuelve
    // posible — el cuidador no puede crear comida más que la mascota.
    expect(reply).toContain('mi mundo no lo acepta');
    expect(agent.events.ofType('recipe.preview')).toHaveLength(0);
    expect(world.recipes.some((r) => r.id === 'glorb')).toBe(false);
  });

  it('sin modelo que entienda (mock): degrada a una explicación honesta', async () => {
    const { world, petId } = quietWorld();
    // Interpreta a guion, pero entity.describe cae al mock, que no finge.
    const provider = new FakeLanguageModel({ 'interpret.command': DESCRIBE_COMMAND });
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), GLORB_DESCRIPTION);

    expect(reply).toContain('no pude traducir tu descripción');
    expect(reply).toContain('el proveedor simulado no traduce descripciones');
    expect(agent.events.ofType('recipe.preview')).toHaveLength(0);
    expect(world.recipes.some((r) => r.id === 'glorb')).toBe(false);
  });

  it('si contesta que no, la idea no entra al mundo', async () => {
    const { world, petId } = quietWorld();
    give(world, petId, 'flint');
    const provider = new FakeLanguageModel({
      'interpret.command': DESCRIBE_COMMAND,
      'entity.describe': GLORB_RECIPE,
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    await say(agent, perception(), GLORB_DESCRIPTION);

    const reply = await say(agent, perception(), 'no, mejor no');

    expect(reply).toContain('queda en una idea');
    for (let i = 0; i < 3; i++) {
      const intent = await agent.think(perception());
      expect(intent?.type).not.toBe('proposeRecipe');
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }
    expect(world.recipes.some((r) => r.id === 'glorb')).toBe(false);
  });

  it('cambiar de tema descarta la vista previa: un «sí» viejo no confirma nada', async () => {
    const { world, petId } = quietWorld();
    give(world, petId, 'flint');
    const script: Partial<Record<ModelRequest['kind'], ModelResponse>> = {
      'interpret.command': DESCRIBE_COMMAND,
      'entity.describe': GLORB_RECIPE,
    };
    const provider = new FakeLanguageModel(script);
    const { agent, perception } = makeAgent(world, petId, provider);
    await say(agent, perception(), GLORB_DESCRIPTION);

    // El siguiente mensaje habla de otra cosa: la vista previa muere ahí.
    script['interpret.command'] = {
      kind: 'command.interpretation',
      command: { action: 'not-command' },
    };
    await say(agent, perception(), '¿cómo estás?');

    // El «sí» tardío ya no tiene nada pendiente que confirmar.
    agent.receiveUserMessage('sí');
    for (let i = 0; i < 3; i++) {
      const intent = await agent.think(perception());
      expect(intent?.type).not.toBe('proposeRecipe');
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }
    expect(world.recipes.some((r) => r.id === 'glorb')).toBe(false);
  });
});
