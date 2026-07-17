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
  // Sin tirada: acá se mide si entiende el pedido y junta lo que falta, no si
  // el fuego prendió — eso se prueba en sim-core.
  const world = createWorld(
    { width: 9, height: 5, seed: 1 },
    { recipes: [withoutChance(CAMPFIRE_RECIPE)] },
  );
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

  it('si ve el ingrediente que falta, lo junta y construye sin otra orden', async () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    spawn(world, 'flint', { position: { x: 3, y: 2 }, portable: {} });
    const provider = new FakeLanguageModel({ 'interpret.command': CRAFT_COMMAND });
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), 'construí una fogata');

    // Ya no es una negativa: juntar es parte de construir. Dice qué falta y
    // que lo va a buscar ella.
    expect(reply).toContain('me falta 1 pedernal');
    expect(reply).toContain('lo junto y la construyo');
    expect(agent.events.ofType('user.request.refused')).toHaveLength(0);

    // Y lo cumple entera: recoge el pedernal y la fogata aparece en el mundo.
    for (let i = 0; i < 30 && !allEntities(world).some((e) => e.kind === 'campfire'); i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }
    expect(allEntities(world).some((e) => e.kind === 'campfire')).toBe(true);
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

  it('lo que todavía no sabe construir no se rechaza: se le ocurre algo', async () => {
    const { world, petId } = coldWorld();
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'castillo' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), 'construí un castillo');

    // No saber la receta no es no poder: puede proponerla y dejar que el mundo
    // la juzgue. La negativa vieja ("solo puedo construir lo que mi mundo
    // permite") era mentira desde que existe `proposeRecipe` (ADR 0018).
    expect(reply).toContain('Todavía no sé construir un castillo');
    expect(reply).toContain('se me ocurre algo');
  });

  it('pedirle lo que no sabe le pide una idea, con el nombre que usó el cuidador', async () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'castillo' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    await say(agent, perception(), 'construí un castillo');

    for (let i = 0; i < 3; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // No hace falta que tenga frío para tener una idea: alcanza con que le
    // pidan algo que no sabe. Ese disparador no existía.
    const proposal = provider.seen.find((r) => r.kind === 'recipe.propose');
    expect(proposal).toBeDefined();
    // Y la idea lleva el nombre que le pidieron: si la bautizara distinto, la
    // petición nunca encontraría su receta.
    expect(proposal).toMatchObject({ wantedId: 'castillo' });
    expect(String((proposal as { problem: string }).problem)).toContain('castillo');
  });

  it('si se queda sin material construyendo lo que inventó, dice qué le falta', async () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    give(world, petId, 'branch', 1);
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'casa' },
      },
      // La casa que inventó en una corrida real: 2 troncos y 4 ramas. En el
      // mundo hay una sola rama, así que junta lo que puede y se queda a mitad.
      'recipe.propose': {
        kind: 'recipe',
        recipe: {
          id: 'casa',
          output: {
            kind: 'casa',
            components: { collider: { solid: true }, durability: { current: 20, max: 20 } },
          },
          ingredients: [
            { kind: 'log', count: 2 },
            { kind: 'branch', count: 4 },
          ],
        },
        rationale: 'Troncos y ramas: lo más parecido a una casa que permiten estos materiales.',
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    await say(agent, perception(), 'construí una casa');

    const said: string[] = [];
    // Margen amplio: ahora un pedido del cuidador sale a RECORRER el mapa
    // buscando el ingrediente que no ve antes de dar el "no hay" por cierto.
    for (let i = 0; i < 140; i++) {
      const intent = await agent.think(perception());
      if (!intent) continue;
      if (intent.type === 'speak') said.push(intent.text);
      agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // Sabe qué le falta y cuánto: el mundo se lo dice. Decir «no encuentro el
    // objeto» sería tirar a la basura lo único que el cuidador puede usar para
    // ayudarla — y con una receta que ella inventó, nadie más sabe qué lleva.
    const failure = said.find((text) => text.startsWith('No pude completar eso'));
    expect(failure).toBeDefined();
    expect(failure).toContain('me faltan');
    expect(failure).toContain('ramas');
    expect(failure).not.toContain('no encuentro el objeto');
  });

  it('de la idea a la cosa: propone, el mundo la valida y termina construyéndola', async () => {
    const { world, petId } = coldWorld();
    give(world, petId, 'log', 2);
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'castillo' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    await say(agent, perception(), 'construí un castillo');

    for (let i = 0; i < 25 && !allEntities(world).some((e) => e.kind === 'castillo'); i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // El mock propone primero el atajo (un castillo comestible) y el mundo lo
    // rechaza; corrige, el mundo acepta, y entonces sí lo construye. El arco
    // entero del eje 3 movido por una frase del cuidador.
    expect(agent.events.ofType('recipe.rejected').length).toBeGreaterThan(0);
    expect(world.recipes.some((r) => r.id === 'castillo')).toBe(true);
    expect(allEntities(world).some((e) => e.kind === 'castillo')).toBe(true);
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

describe('juntar ingredientes pidiendo de a uno', () => {
  it('«traé un tronco» dos veces junta DOS troncos, no el mismo', async () => {
    const { world, petId } = coldWorld();
    spawn(world, 'log', { position: { x: 3, y: 2 }, portable: {} });
    spawn(world, 'log', { position: { x: 1, y: 4 }, portable: {} });
    const provider = new MockModelProvider();
    const { agent } = makeAgent(world, petId, provider);

    const heldLogs = () =>
      world.entities[petId]!.components.inventory!.items.filter(
        (id) => world.entities[id]!.kind === 'log',
      ).length;

    for (const expected of [1, 2]) {
      agent.receiveUserMessage('trae un tronco');
      for (let i = 0; i < 30 && heldLogs() < expected; i++) {
        const intent = await agent.think(buildPerception(world, petId));
        if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
      }
      // Sin held:false, la segunda búsqueda devolvía el tronco que ya llevaba
      // (nearest lo ordena a distancia 0) y "cumplía" sin traer nada.
      expect(heldLogs()).toBe(expected);
    }
  });
});

describe('lo que no está codeado intenta aprenderse, no se rechaza de plano', () => {
  const unsupported = (summary: string): ModelResponse => ({
    kind: 'command.interpretation',
    command: { action: 'unsupported', summary },
  });

  it('una orden fuera del catálogo abre el ciclo de aprendizaje', async () => {
    const { world, petId } = coldWorld();
    const provider = new FakeLanguageModel({
      'interpret.command': unsupported('saltar el muro'),
    });
    const { agent, perception } = makeAgent(world, petId, provider);

    const reply = await say(agent, perception(), 'saltá el muro');

    // Intentó derivar un contrato de aprendizaje (el proveedor de prueba no
    // sabe derivarlos, así que pide más detalle en vez de negarse en seco).
    expect(provider.callCount('skill.contract')).toBe(1);
    expect(reply).toContain('no consigo imaginar en qué se notaría');
    // Y lo pedido no se pierde: queda recordado como deseo no cumplido.
    expect(
      agent.memory.episodeList().some((episode) => episode.kind === 'unmet-request'),
    ).toBe(true);
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

  it('entiende las formas de pedirlo que un hispanohablante usa de verdad', async () => {
    // "crea una fogata" caía en charla: el parser conocía "construir" y
    // "armar" pero no "crear" — el verbo que usó el dueño la primera vez.
    for (const order of [
      'crea una fogata',
      'creá una fogata',
      'hacé una fogata',
      'armá una hoguera',
      'prendé un fuego',
      'fabricá una silla',
    ]) {
      const { world, petId } = coldWorld();
      const { agent, perception } = makeAgent(world, petId, new MockModelProvider());
      const reply = await say(agent, perception(), order);
      expect(reply, `«${order}» no se entendió`).toContain('construir');
    }
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
