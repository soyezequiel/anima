import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * La tercera vía de conseguir materia: cosechar.
 *
 * Un tronco no sale de ninguna receta — sale de talar un árbol. El compositor
 * de programas solo sabía BUSCAR lo suelto y FABRICAR lo que tiene receta, así
 * que un encargo cuya materia base se saca del mundo a golpes abortaba con
 * «no hay troncos» rodeada de árboles. En tres partidas seguidas el cuidador
 * tuvo que decir la misma frase: "talá un árbol para conseguir troncos".
 */

const PLANK_RECIPE = {
  id: 'tabla',
  ingredients: [{ kind: 'log', count: 1 }],
  outcomes: [{ weight: 1, output: { kind: 'tabla', components: { portable: {} } } }],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'tabla' },
};

/** Bosque sin un solo tronco suelto: la única madera está EN los árboles. */
function forestWorld(options: { trees?: number; looseLog?: boolean } = {}): {
  world: WorldState;
  petId: EntityId;
} {
  const world = createWorld({ width: 12, height: 7, seed: 3 }, { recipes: [PLANK_RECIPE] });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 3 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  spawn(world, 'hammer', {
    position: { x: 2, y: 3 },
    portable: {},
    tool: { power: 8 },
    durability: { current: 40, max: 40 },
  });
  for (let i = 0; i < (options.trees ?? 2); i++) {
    spawn(world, 'tree', {
      position: { x: 5 + i * 2, y: 3 },
      hardness: { value: 2 },
      durability: { current: 4, max: 4 },
      drops: [{ kind: 'log', components: { portable: {} } }],
    });
  }
  if (options.looseLog) {
    spawn(world, 'log', { position: { x: 3, y: 3 }, portable: {} });
  }
  return { world, petId };
}

function makeAgent(petId: EntityId, responses: ModelResponse[]) {
  const provider = new ScriptedModelProvider(responses, { interpretsLanguage: true });
  const agent = new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-18T00:00:00Z',
  });
  return { agent, provider };
}

async function run(
  world: WorldState,
  petId: EntityId,
  agent: AnimaAgent,
  ticks: number,
): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(world, petId));
    agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
  }
}

describe('cosechar: romper algo que deja caer lo que falta', () => {
  it('la percepción dice QUÉ deja caer cada cosa, no solo que deja algo', () => {
    const { world, petId } = forestWorld();
    const perception = buildPerception(world, petId);
    const tree = perception.visibleEntities.find((e) => e.kind === 'tree');

    expect(tree?.leavesRemains).toBe(true);
    // Sin esto no se puede planificar: "me faltan troncos" y "este árbol deja
    // troncos" son la misma frase separada por el dato que faltaba exponer.
    expect(tree?.dropKinds).toEqual(['log']);
  });

  it('sin troncos sueltos, tala un árbol y construye la tabla sin que se lo pidan', async () => {
    const { world, petId } = forestWorld();
    const { agent } = makeAgent(petId, [INTERPRET_BUILD]);

    agent.receiveUserMessage('construí una tabla');
    // La cadena es larga: herramienta, camino al árbol, golpes, recoger lo que
    // cayó y recién ahí construir.
    await run(world, petId, agent, 400);

    // Taló: hay un árbol menos que al empezar.
    const trees = Object.values(world.entities).filter((e) => e.kind === 'tree');
    expect(trees.length).toBeLessThan(2);
    // Y llegó al final: la tabla existe. Antes abortaba con "no hay troncos"
    // teniendo el bosque delante.
    expect(Object.values(world.entities).some((e) => e.kind === 'tabla')).toBe(true);
  });

  it('con un tronco suelto a la vista no tala: lo barato primero', async () => {
    const { world, petId } = forestWorld({ looseLog: true });
    const { agent } = makeAgent(petId, [INTERPRET_BUILD]);

    agent.receiveUserMessage('construí una tabla');
    await run(world, petId, agent, 120);

    expect(Object.values(world.entities).some((e) => e.kind === 'tabla')).toBe(true);
    // Los dos árboles siguen en pie: recoger lo que ya está tirado cuesta menos
    // golpes, y los golpes son ticks que el hambre y el frío corren en contra.
    expect(Object.values(world.entities).filter((e) => e.kind === 'tree')).toHaveLength(2);
  });

  it('sin nada que lo deje caer, no inventa una cosecha imposible', async () => {
    // Un mundo sin árboles: la respuesta honesta sigue siendo que no hay.
    const { world, petId } = forestWorld({ trees: 0 });
    const { agent } = makeAgent(petId, [INTERPRET_BUILD]);

    const said: string[] = [];
    agent.receiveUserMessage('construí una tabla');
    for (let i = 0; i < 120; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') said.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    expect(Object.values(world.entities).some((e) => e.kind === 'tabla')).toBe(false);
    expect(said.some((t) => t.includes('tronco'))).toBe(true);
  });
});
