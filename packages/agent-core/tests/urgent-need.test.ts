import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, GOAL_RESTORE_WARMTH } from '../src/index.js';

/**
 * ADR 0048. El caso observado: con el calor en 6 de 50 y a punto de morir, lo
 * que estaba haciendo era juntar troncos porque el cuidador se los había
 * pedido. Las prioridades estaban bien —el frío puntúa más que un encargo—
 * pero nunca llegaban a compararse: `think` continuaba la actividad ANTES de
 * re-elegir objetivo, así que quien agarraba el turno se lo quedaba.
 */

function world({ temperature }: { temperature: number }): {
  world: WorldState;
  petId: EntityId;
} {
  const w = createWorld({ width: 14, height: 7, seed: 5 });
  const petId = spawn(w, 'pet', {
    position: { x: 1, y: 3 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    temperature: { current: temperature, max: 50, lossPerTick: 0.05 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 14 },
  }).id;
  // El tronco, bien lejos: el viaje es lo que da tiempo a que el cuerpo mande.
  spawn(w, 'log', { position: { x: 12, y: 3 }, portable: {} });
  // Y algo que da calor, para que el objetivo de frío tenga a dónde ir.
  spawn(w, 'campfire', {
    position: { x: 2, y: 5 },
    heatSource: { warmthPerTick: 2, range: 2 },
    hazard: { damagePerTick: 1 },
  });
  return { world: w, petId };
}

function makeAgent(petId: EntityId) {
  // El mock alcanza: el parser determinista entiende "traé un tronco" y el
  // resto de las consultas (diseñar abrigo) tienen respuesta por defecto.
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
    now: () => '2026-07-18T00:00:00Z',
  });
  return { agent, provider };
}

async function run(
  w: WorldState,
  petId: EntityId,
  agent: AnimaAgent,
  ticks: number,
): Promise<string[]> {
  const said: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    if (intent?.type === 'speak') said.push(intent.text);
    agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
  }
  return said;
}

describe('el cuerpo en rojo le saca el turno al encargo (ADR 0048)', () => {
  it('con el calor crítico suelta el encargo y atiende el frío', async () => {
    // Fiel a lo observado: el encargo arranca con el cuerpo BIEN y el frío
    // llega después. Empezar ya en rojo no reproduce nada — ahí el objetivo de
    // frío gana la elección y el encargo nunca llega a ser una actividad.
    const { world: w, petId } = world({ temperature: 45 });
    const { agent } = makeAgent(petId);
    const body = w.entities[petId]!;

    agent.receiveUserMessage('traé un tronco');
    await run(w, petId, agent, 8); // sale a buscar el tronco lejano

    // El cuerpo entra en rojo y SIGUE en rojo: se sostiene a mano porque, si se
    // la deja recuperarse, el encargo vuelve solo (que es lo correcto, y lo
    // mide la otra prueba) y acá no quedaría nada que observar.
    const said: string[] = [];
    for (let i = 0; i < 20; i++) {
      body.components.temperature!.current = 5; // 10%: por debajo del crítico
      const intent = await agent.think(buildPerception(w, petId));
      if (intent?.type === 'speak') said.push(intent.text);
      agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
    }

    // Soltó el encargo, y lo dijo en vez de abandonarlo en silencio.
    expect(said.some((t) => t.includes('Dejo esto un momento'))).toBe(true);
    const errand = agent.goals
      .all()
      .find((g) => g.source === 'user-request' && g.userRequest?.kind === 'fetch-item');
    expect(errand?.status).toBe('suspended');
    expect(errand?.suspendedReason).toBe('lo dejé a medias por una urgencia del cuerpo');
    // Y lo que persigue ahora es el cuerpo.
    expect(agent.goals.byDescription(GOAL_RESTORE_WARMTH)?.status).toBe('active');
  });

  it('con el calor apenas bajo pero no crítico, termina lo que empezó', async () => {
    // 15 de 50 = 30%: hay objetivo de frío (umbral 35%) pero no es rojo, así
    // que interrumpir cada obra por cada bajón la dejaría sin terminar nada.
    const { world: w, petId } = world({ temperature: 15 });
    const { agent } = makeAgent(petId);

    agent.receiveUserMessage('traé un tronco');
    const said = await run(w, petId, agent, 60);

    expect(said.some((t) => t.includes('Dejo esto un momento'))).toBe(false);
    const errand = agent.goals
      .all()
      .find((g) => g.source === 'user-request' && g.userRequest?.kind === 'fetch-item');
    expect(errand?.status).not.toBe('suspended');
  });

  it('el encargo interrumpido vuelve solo cuando el cuerpo sale del rojo', async () => {
    const { world: w, petId } = world({ temperature: 45 });
    const { agent } = makeAgent(petId);
    const pet = w.entities[petId]!;

    agent.receiveUserMessage('traé un tronco');
    await run(w, petId, agent, 8);

    // En rojo sostenido: se suspende y se queda suspendido.
    for (let i = 0; i < 10; i++) {
      pet.components.temperature!.current = 5;
      const intent = await agent.think(buildPerception(w, petId));
      agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
    }
    const errand = agent.goals
      .all()
      .find((g) => g.source === 'user-request' && g.userRequest?.kind === 'fetch-item');
    expect(errand?.status).toBe('suspended');

    // Se calentó (por el fuego o porque alguien la abrigó): el cuerpo sale del
    // rojo y el encargo tiene que volver sin que el cuidador lo repita.
    pet.components.temperature!.current = 40;
    await run(w, petId, agent, 20);

    expect(agent.goals.get(errand!.id)?.status).toBe('active');
    expect(
      agent.events
        .ofType('goal.reactivated')
        .some((e) => e.data.reason === 'pasó la urgencia del cuerpo'),
    ).toBe(true);
  });

  it('una necesidad del cuerpo no se interrumpe a sí misma', async () => {
    // Sin encargo: lo que corre es el objetivo de frío. Que el calor esté en
    // rojo no puede hacer que suelte justo la actividad que la va a salvar.
    const { world: w, petId } = world({ temperature: 5 });
    const { agent } = makeAgent(petId);

    const said = await run(w, petId, agent, 60);

    expect(said.some((t) => t.includes('Dejo esto un momento'))).toBe(false);
    // Y se acercó al fuego: la actividad del cuerpo siguió su curso.
    expect(pet(w, petId).components.temperature!.current).toBeGreaterThan(5);
  });
});

function pet(w: WorldState, petId: EntityId) {
  return w.entities[petId]!;
}
