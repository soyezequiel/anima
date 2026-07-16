import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * Ánima inventa objetos que su mundo no sabía construir. Lo que hace que esto
 * no sea un agujero es que proponer no es poder: el mundo valida cada idea, y
 * un rechazo enseña. Es el mismo trato que con las habilidades — el que
 * propone nunca es el que aprueba.
 */

function coldWorldWithLogs(logs = 2): { world: WorldState; petId: EntityId } {
  // Mundo frío, sin fuego y sin ninguna receta: no sabe construir nada.
  const world = createWorld({ width: 9, height: 5, seed: 1 });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    temperature: { current: 10, max: 50, lossPerTick: 0.1 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  for (let i = 0; i < logs; i++) {
    const log = spawn(world, 'log', { portable: {} });
    world.entities[petId]!.components.inventory!.items.push(log.id);
  }
  return { world, petId };
}

function makeAgent(petId: EntityId) {
  const provider = new MockModelProvider();
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
    now: () => '2026-07-16T00:00:00Z',
  });
  return { agent, provider };
}

/** Corre el loop hasta que pase algo o se agoten los ticks. */
async function run(world: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(world, petId));
    if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
  }
}

describe('Ánima inventa recetas', () => {
  it('con frío y materiales, se le ocurre algo: propone al mundo', async () => {
    const { world, petId } = coldWorldWithLogs();
    const { agent } = makeAgent(petId);

    await run(world, petId, agent, 4);

    expect(agent.events.ofType('recipe.proposed').length).toBeGreaterThan(0);
  });

  it('su primera idea es un atajo, y el mundo la rechaza con el motivo', async () => {
    const { world, petId } = coldWorldWithLogs();
    const { agent } = makeAgent(petId);

    await run(world, petId, agent, 4);

    // El mock propone "convertir un tronco en comida": el atajo que resolvería
    // todo declarándolo resuelto. El mundo no lo permite.
    const rejected = agent.events.ofType('recipe.rejected');
    expect(rejected.length).toBeGreaterThan(0);
    expect(String(rejected[0]?.data.reason)).toContain('Receta inválida');
    // El atajo no entró al mundo — ni entonces ni después, aunque más tarde se
    // le ocurriera algo válido. Ninguna receta suya fabrica comida.
    expect(world.recipes.some((r) => r.id === 'bocado')).toBe(false);
    expect(world.recipes.some((r) => r.output.components.edible !== undefined)).toBe(false);
  });

  it('aprende del rechazo: corrige en vez de insistir, y el mundo acepta', async () => {
    const { world, petId } = coldWorldWithLogs();
    const { agent } = makeAgent(petId);

    await run(world, petId, agent, 8);

    // Segunda idea: quemar madera para dar calor. Eso sí es posible.
    const learned = agent.events.ofType('recipe.learned');
    expect(learned.length).toBe(1);
    expect(learned[0]?.data.outputKind).toBe('hoguera-simple');
    expect(world.recipes.map((r) => r.id)).toEqual(['hoguera-simple']);
  });

  it('lo inventado es real: se puede construir y de verdad da calor', async () => {
    const { world, petId } = coldWorldWithLogs();
    const { agent } = makeAgent(petId);
    const pet = world.entities[petId]!;

    await run(world, petId, agent, 8);
    expect(world.recipes).toHaveLength(1);

    // Construye con su propia receta y se acerca.
    stepWorld(world, [{ actorId: petId, intent: { type: 'craft', recipeId: 'hoguera-simple' } }]);
    const fire = Object.values(world.entities).find((e) => e.kind === 'hoguera-simple');
    expect(fire).toBeDefined();

    const before = pet.components.temperature!.current;
    pet.components.position = { x: fire!.components.position!.x - 2, y: fire!.components.position!.y };
    stepWorld(world, [{ actorId: petId, intent: { type: 'wait' } }]);
    expect(pet.components.temperature!.current).toBeGreaterThan(before);
  });

  it('lo aceptado pasa a ser conocimiento suyo', async () => {
    const { world, petId } = coldWorldWithLogs();
    const { agent } = makeAgent(petId);

    await run(world, petId, agent, 8);

    expect(agent.memory.factList().some((f) => f.statement.includes('puedo construir'))).toBe(true);
  });

  it('sin materiales no inventa nada: falta el recurso, no la idea', async () => {
    const { world, petId } = coldWorldWithLogs(0);
    const { agent, provider } = makeAgent(petId);

    await run(world, petId, agent, 4);

    expect(provider.callCount('recipe.propose')).toBe(0);
    expect(agent.events.ofType('recipe.proposed')).toHaveLength(0);
  });

  it('inventar tiene tope: no propone para siempre', async () => {
    const { world, petId } = coldWorldWithLogs();
    const { agent, provider } = makeAgent(petId);
    // Un mundo que rechaza todo: el proveedor insiste con el atajo imposible.
    provider.complete = ((request: { kind: string }) =>
      request.kind === 'recipe.propose'
        ? Promise.resolve({
            kind: 'recipe',
            recipe: { id: 'x', output: { kind: 'food', components: { edible: {} } }, ingredients: [{ kind: 'log', count: 1 }] },
            rationale: 'comida',
          })
        : Promise.reject(new Error('no'))) as typeof provider.complete;

    await run(world, petId, agent, 20);

    expect(provider.callCount('recipe.propose')).toBeLessThanOrEqual(3);
  });
});
