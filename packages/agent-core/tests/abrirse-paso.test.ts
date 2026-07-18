import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { Blueprint, EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * ADR 0066. «No hay» y «hay pero no llego» no son lo mismo.
 *
 * Partida real, mapa de 13×7: una columna de muro de (5,0) a (5,6) —sin una
 * sola abertura— partía el mundo en dos. Ella de un lado; TODA la madera del
 * mundo (dos troncos y tres árboles) del otro.
 *
 * Podía reintentar y explorar para siempre: de su lado no había nada que
 * encontrar. Y como el fallo se leía como «falta materia», nunca intentaba lo
 * único que resolvía el problema — romper la pared, que además ya sabía hacer.
 */

const HUT: Blueprint = {
  id: 'choza',
  placements: [
    { kind: 'muro-aula', offset: { x: 0, y: -1 } },
    { kind: 'muro-aula', offset: { x: 0, y: 1 } },
  ],
};

const WALL_RECIPE = {
  id: 'muro-aula',
  ingredients: [{ kind: 'log', count: 1 }],
  outcomes: [
    {
      weight: 1,
      output: { kind: 'muro-aula', components: { portable: {}, collider: { solid: true } } },
    },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'choza' },
};

/** El mapa del cuidador: tapiada de un lado, la madera del otro. */
function walledWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld(
    { width: 13, height: 7, seed: 5 },
    { recipes: [WALL_RECIPE], blueprints: [HUT] },
  );
  const petId = spawn(world, 'pet', {
    position: { x: 2, y: 3 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 3 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 13 },
  }).id;
  // Un martillo de su lado: tiene con qué, si se le ocurre.
  spawn(world, 'hammer', { position: { x: 3, y: 3 }, portable: {}, tool: { power: 8 } });
  // La columna sin abertura.
  for (let y = 0; y < 7; y++) {
    spawn(world, 'wall', {
      position: { x: 5, y },
      collider: { solid: true },
      hardness: { value: 2 },
      durability: { current: 6, max: 6 },
    });
  }
  // Toda la madera, del otro lado.
  spawn(world, 'log', { position: { x: 11, y: 2 }, portable: {} });
  spawn(world, 'log', { position: { x: 8, y: 5 }, portable: {} });
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

describe('cuando lo que falta es camino, se abre paso (ADR 0066)', () => {
  it('rompe la pared que la encierra y termina la obra con la madera del otro lado', async () => {
    const { world, petId } = walledWorld();
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;
    agent.receiveUserMessage('construí una choza');

    const murosDePiedra = () =>
      Object.values(world.entities).filter((e) => e.kind === 'wall' && e.components.position).length;
    const obraEnPie = () =>
      Object.values(world.entities).filter(
        (e) => e.kind === 'muro-aula' && e.components.position,
      ).length;

    // Se mide lo más lejos que LLEGÓ, no dónde terminó: vuelve al sitio de la
    // obra a colocar, así que su posición final no dice nada del viaje.
    let lejosQueLlego = pet.components.position!.x;
    for (let i = 0; i < 1200 && obraEnPie() < 2; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
      lejosQueLlego = Math.max(lejosQueLlego, pet.components.position!.x);
    }

    // Abrió un hueco en la columna...
    expect(murosDePiedra()).toBeLessThan(7);
    // ...cruzó al otro lado a buscar la madera...
    expect(lejosQueLlego).toBeGreaterThan(5);
    // ...y la obra quedó levantada.
    expect(obraEnPie()).toBe(2);
  });

  it('lo dice antes de hacerlo: romper algo no es una decisión silenciosa', async () => {
    const { world, petId } = walledWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');

    const dicho: string[] = [];
    for (let i = 0; i < 400; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') dicho.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    expect(dicho.some((t) => t.includes('abrirme paso'))).toBe(true);
  });

  it('no se abre paso rompiendo su propia obra', async () => {
    const { world, petId } = walledWorld();
    const agent = makeAgent(petId);
    // Un bloque de SU plano, sólido y a mano: el candidato más blando y cercano
    // si no estuviera protegido.
    spawn(world, 'muro-aula', {
      position: { x: 2, y: 2 },
      collider: { solid: true },
      hardness: { value: 1 },
      durability: { current: 4, max: 4 },
    });
    agent.receiveUserMessage('construí una choza');

    const dicho: string[] = [];
    for (let i = 0; i < 400; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') dicho.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    // Se abre paso, pero nunca por lo que ella misma levanta.
    expect(dicho.some((t) => t.includes('abrirme paso por el muro aula'))).toBe(false);
  });
});
