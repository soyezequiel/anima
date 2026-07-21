import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { EntityId, Interaction, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * Interacciones inventadas de punta a punta (ADR 0027): el cuidador pide algo
 * que las primitivas no cubren, Ánima propone la interacción, la física la
 * filtra, la IA Dios juzga la lógica, el mundo la guarda — y desde entonces se
 * REUSA sin gastar ni una consulta. Un veto del Dios también se recuerda: lo
 * vetado no se vuelve a inventar.
 */

const SCOOP: Interaction = {
  id: 'juntar-water',
  description: 'juntar agua con un balde',
  stance: 'beside',
  target: { wet: true },
  requires: { heldKind: 'balde' },
  effects: [{ type: 'transform-held', kind: 'balde-con-agua', components: { portable: {} } }],
};

const INTERPRET_SCOOP: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'interact-entity', verb: 'juntar', targetKind: 'water' },
};

function pondWorld(options: { interactions?: Interaction[] } = {}): {
  world: WorldState;
  petId: EntityId;
  bucketId: EntityId;
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
  spawn(world, 'water', { position: { x: 4, y: 2 }, water: {} });
  const bucketId = spawn(world, 'balde', { position: { x: 2, y: 2 }, portable: {} }).id;
  return { world, petId, bucketId };
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

describe('interacciones inventadas, de punta a punta', () => {
  it('propone, la Dios aprueba, el mundo guarda, y ella la ejecuta', async () => {
    const { world, petId, bucketId } = pondWorld();
    const { agent, provider } = makeAgent(petId, [
      INTERPRET_SCOOP,
      { kind: 'interaction', interaction: structuredClone(SCOOP), rationale: 'el balde contiene' },
      { kind: 'judgement', willing: true, reason: 'un balde puede contener agua' },
    ]);

    agent.receiveUserMessage('juntá agua con el balde');
    await run(world, petId, agent, 40);

    // La regla quedó en el mundo, con el nombre con el que se la va a pedir.
    expect(world.interactions.map((i) => i.id)).toEqual(['juntar-water']);
    expect(agent.events.ofType('interaction.learned').length).toBeGreaterThan(0);
    // Y la ejecutó: el balde volvió lleno, el estanque sigue donde estaba.
    expect(world.entities[bucketId]!.kind).toBe('balde-con-agua');
    expect(Object.values(world.entities).some((e) => e.kind === 'water')).toBe(true);
    // Crear costó exactamente una propuesta y un juicio.
    expect(provider.callCount('interaction.propose')).toBe(1);
    expect(provider.callCount('interaction.judge')).toBe(1);
  });

  it('reuso: una interacción ya aprendida no se inventa de nuevo', async () => {
    const { world, petId, bucketId } = pondWorld({ interactions: [structuredClone(SCOOP)] });
    const { agent, provider } = makeAgent(petId, [INTERPRET_SCOOP]);

    agent.receiveUserMessage('juntá agua con el balde');
    await run(world, petId, agent, 40);

    expect(world.entities[bucketId]!.kind).toBe('balde-con-agua');
    // Ni proponer ni juzgar: saberla es física suya, y usarla es gratis.
    expect(provider.callCount('interaction.propose')).toBe(0);
    expect(provider.callCount('interaction.judge')).toBe(0);
  });

  it('el veto de la IA Dios frena la idea, se explica y se recuerda', async () => {
    const { world, petId } = pondWorld();
    // Sin balde a la vista: la idea tramposa es llevarse el agua igual.
    const cheat: Interaction = {
      id: 'juntar-water',
      description: 'llevar agua en las manos',
      stance: 'beside',
      target: { wet: true },
      requires: { heldKind: 'balde' },
      effects: [{ type: 'transform-held', kind: 'agua-suelta', components: { portable: {} } }],
    };
    const { agent, provider } = makeAgent(petId, [
      INTERPRET_SCOOP,
      { kind: 'interaction', interaction: cheat, rationale: 'me la llevo y ya' },
      {
        kind: 'judgement',
        willing: false,
        reason: 'el agua se escurre: necesitás algo que la contenga',
      },
      // Segundo pedido: solo la interpretación. Si intentara volver a proponer,
      // la cola vacía haría fallar la consulta y el test lo delataría.
      INTERPRET_SCOOP,
    ]);

    agent.receiveUserMessage('juntá agua con el balde');
    await run(world, petId, agent, 20);

    // Nada entró al mundo, el motivo se dijo y quedó como hipótesis: el modelo
    // no puede convertir su propio veto en un hecho.
    expect(world.interactions).toHaveLength(0);
    const judged = agent.events.ofType('interaction.judged');
    expect(judged.some((e) => e.data.willing === false)).toBe(true);
    expect(
      agent.memory
        .hypothesisList()
        .some((h) => h.statement.startsWith('mi mundo no permite juntar-water')),
    ).toBe(true);

    // Pedirlo de nuevo no re-inventa lo vetado: ni una consulta más.
    agent.receiveUserMessage('juntá agua con el balde');
    await run(world, petId, agent, 20);
    expect(provider.callCount('interaction.propose')).toBe(1);
    expect(world.interactions).toHaveLength(0);
  });

  it('acostarse en la cama: on-top sobre un sólido funciona de punta a punta', async () => {
    // El caso real que motivó el arreglo: la cama inventada salió con
    // collider.solid, y "acostate en la cama" moría porque pisar un sólido es
    // imposible caminando. Ahora la postura se ejecuta llegando AL LADO y el
    // acto de interactuar la sube.
    const world = createWorld({ width: 9, height: 5, seed: 1 });
    const petId = spawn(world, 'pet', {
      position: { x: 1, y: 2 },
      collider: { solid: true },
      energy: { current: 48, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      strength: { value: 2 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Anima', perceptionRange: 12 },
    }).id;
    const bed = spawn(world, 'cama', {
      position: { x: 6, y: 2 },
      collider: { solid: true },
      hardness: { value: 3 },
      durability: { current: 12, max: 12 },
    });
    const lie: Interaction = {
      id: 'acostarse-cama',
      description: 'acostarse encima de la cama',
      stance: 'on-top',
      target: { kind: 'cama' },
      effects: [],
    };
    const { agent } = makeAgent(petId, [
      {
        kind: 'command.interpretation',
        command: { action: 'interact-entity', verb: 'acostarse', targetKind: 'cama' },
      },
      { kind: 'interaction', interaction: lie, rationale: 'una cama es para acostarse' },
      { kind: 'judgement', willing: true, reason: 'acostarse encima de una cama tiene lógica' },
    ]);

    agent.receiveUserMessage('acostate en la cama');
    await run(world, petId, agent, 40);

    expect(world.interactions.map((i) => i.id)).toEqual(['acostarse-cama']);
    // Terminó ENCIMA de la cama, aunque sea sólida.
    const pet = world.entities[petId]!;
    expect(pet.components.position).toEqual({ x: 6, y: 2 });
    expect(world.entities[bed.id]).toBeDefined();
    expect(agent.events.ofType('goal.completed').length).toBeGreaterThan(0);
  });

  it('la puerta local filtra antes del juez: lo imposible no llega al Dios', async () => {
    const { world, petId } = pondWorld();
    const impossible = {
      id: 'juntar-water',
      description: 'volver comestible el agua',
      stance: 'beside',
      target: { wet: true },
      effects: [{ type: 'transform-target', kind: 'food', components: {} }],
    };
    const { agent, provider } = makeAgent(petId, [
      INTERPRET_SCOOP,
      { kind: 'interaction', interaction: impossible, rationale: 'comida infinita' },
    ]);

    agent.receiveUserMessage('juntá agua con el balde');
    await run(world, petId, agent, 12);

    // La física la rechazó localmente: el juicio nunca ocurrió.
    expect(provider.callCount('interaction.judge')).toBe(0);
    expect(world.interactions).toHaveLength(0);
    const rejected = agent.events.ofType('interaction.rejected');
    expect(rejected.length).toBeGreaterThan(0);
  });
});
