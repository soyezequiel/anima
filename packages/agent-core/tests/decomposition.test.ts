import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { Decomposition, EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * La cuarta puerta de punta a punta: el cuidador pide romper algo cuya
 * descomposición nadie definió, Ánima imagina en qué se deshace, la física la
 * filtra, la IA Dios juzga que sea materia honesta, el mundo la guarda — y al
 * romperlo quedan los fragmentos en vez de nada.
 *
 * Es la respuesta al agujero que lo motivó: picar un pedernal lo hacía
 * desaparecer, y a la pregunta "¿dónde están las partes?" no había respuesta.
 */

const SHARDS: Decomposition = {
  id: 'romper-flint',
  targetKind: 'flint',
  drops: [
    { kind: 'esquirla', components: { portable: {} } },
    { kind: 'esquirla', components: { portable: {} } },
  ],
};

const INTERPRET_BREAK: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'destroy-entity', targetKind: 'flint' },
};

function quarryWorld(options: { decompositions?: Decomposition[] } = {}): {
  world: WorldState;
  petId: EntityId;
} {
  const world = createWorld({ width: 9, height: 5, seed: 1 }, options);
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  spawn(world, 'hammer', {
    position: { x: 2, y: 2 },
    portable: {},
    tool: { power: 8 },
    durability: { current: 20, max: 20 },
  });
  // Dos pedernales: romper uno no es quedarse sin ninguno, así que la negativa
  // por escasez (ADR 0019) no se mete en medio de lo que esta prueba mide.
  for (const pos of [
    { x: 5, y: 2 },
    { x: 6, y: 4 },
  ]) {
    spawn(world, 'flint', {
      position: pos,
      portable: {},
      hardness: { value: 3 },
      durability: { current: 3, max: 3 },
    });
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
    now: () => '2026-07-17T00:00:00Z',
  });
  return { agent, provider };
}

async function run(world: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(world, petId));
    agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
  }
}

describe('descomposiciones inventadas, de punta a punta', () => {
  it('imagina en qué se deshace, la Dios aprueba, y al romperlo quedan los fragmentos', async () => {
    const { world, petId } = quarryWorld();
    const { agent, provider } = makeAgent(petId, [
      INTERPRET_BREAK,
      { kind: 'decomposition', decomposition: structuredClone(SHARDS), rationale: 'la piedra lasquea' },
      { kind: 'judgement', willing: true, reason: 'picar piedra deja esquirlas' },
    ]);

    agent.receiveUserMessage('rompé el pedernal');
    await run(world, petId, agent, 60);

    // La regla quedó en el mundo.
    expect(world.decompositions.map((d) => d.targetKind)).toEqual(['flint']);
    expect(agent.events.ofType('decomposition.learned').length).toBeGreaterThan(0);
    // Y lo que importa: la materia no desapareció.
    const shards = Object.values(world.entities).filter((e) => e.kind === 'esquirla');
    expect(shards).toHaveLength(2);
    expect(shards.every((s) => s.components.portable)).toBe(true);
    // Imaginarlo costó exactamente una propuesta y un juicio.
    expect(provider.callCount('decomposition.propose')).toBe(1);
    expect(provider.callCount('decomposition.judge')).toBe(1);
  });

  it('reuso: una descomposición ya aprendida no se vuelve a imaginar', async () => {
    const { world, petId } = quarryWorld({ decompositions: [structuredClone(SHARDS)] });
    const { agent, provider } = makeAgent(petId, [INTERPRET_BREAK]);

    agent.receiveUserMessage('rompé el pedernal');
    await run(world, petId, agent, 60);

    expect(
      Object.values(world.entities).filter((e) => e.kind === 'esquirla').length,
    ).toBeGreaterThan(0);
    // Saberla es física suya: usarla no cuesta ni una consulta.
    expect(provider.callCount('decomposition.propose')).toBe(0);
    expect(provider.callCount('decomposition.judge')).toBe(0);
  });

  it('el veto de la Dios no impide romper: solo significa que no queda nada', async () => {
    const { world, petId } = quarryWorld();
    const { agent } = makeAgent(petId, [
      INTERPRET_BREAK,
      {
        kind: 'decomposition',
        decomposition: { ...structuredClone(SHARDS), drops: [{ kind: 'log', components: { portable: {} } }] },
        rationale: 'quizá deje madera',
      },
      { kind: 'judgement', willing: false, reason: 'de una piedra no sale madera' },
    ]);

    agent.receiveUserMessage('rompé el pedernal');
    await run(world, petId, agent, 60);

    // Nada entró al mundo y no salió madera de una piedra...
    expect(world.decompositions).toHaveLength(0);
    expect(Object.values(world.entities).some((e) => e.kind === 'log')).toBe(false);
    // ...pero el pedernal se rompió igual: un veto de materia no es una
    // prohibición del acto. Quedaba uno de los dos.
    expect(Object.values(world.entities).filter((e) => e.kind === 'flint')).toHaveLength(1);
  });
});
