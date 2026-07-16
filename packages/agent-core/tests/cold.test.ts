import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { CAMPFIRE_RECIPE, COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, GOAL_RESTORE_WARMTH, SKILL_GET_WARM } from '../src/index.js';

/**
 * El frío es una necesidad del cuerpo, no una conversación: nace sola, se
 * interpreta como el hambre y mueve a la mascota sin que nadie se lo pida.
 */

class RecordingModel extends MockModelProvider {
  readonly seen: ModelRequest[] = [];
  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    if (request.kind === 'interpret.signal' && request.signal === 'temperature-low') {
      return Promise.resolve({
        kind: 'interpretation',
        hypothesis: 'acercarse al fuego devuelve el calor',
        confidence: 0.6,
      });
    }
    return super.complete(request);
  }
}

interface ColdOptions {
  temperature?: number;
  fire?: boolean;
  recipes?: boolean;
}

function coldWorld(options: ColdOptions = {}): { world: WorldState; petId: EntityId } {
  const world = createWorld(
    { width: 9, height: 5, seed: 1 },
    options.recipes === false ? {} : { recipes: [CAMPFIRE_RECIPE] },
  );
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 2 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    temperature: { current: options.temperature ?? 10, max: 50, lossPerTick: 0.1 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  if (options.fire) {
    spawn(world, 'campfire', {
      position: { x: 6, y: 2 },
      heatSource: { warmthPerTick: 2, range: 2 },
      hazard: { damagePerTick: 1 },
    });
  }
  return { world, petId };
}

function makeAgent(
  world: WorldState,
  petId: EntityId,
  provider = new RecordingModel(),
  warmthScenarios?: typeof COLD_SCENARIOS,
) {
  const agent = new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    ...(warmthScenarios ? { warmthScenarios } : {}),
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-16T00:00:00Z',
  });
  return { agent, provider, perception: () => buildPerception(world, petId) };
}

describe('el frío como motivo', () => {
  it('con el calor bajo nace el objetivo, sin que nadie se lo pida', async () => {
    const { world, petId } = coldWorld({ fire: true });
    const { agent, perception } = makeAgent(world, petId);

    await agent.think(perception());

    const goal = agent.goals.byDescription(GOAL_RESTORE_WARMTH);
    expect(goal?.status).toBe('active');
    expect(goal?.source).toBe('internal-signal');
  });

  it('interpreta la señal del frío como interpreta la del hambre', async () => {
    const { world, petId } = coldWorld({ fire: true });
    const { agent, provider, perception } = makeAgent(world, petId);

    await agent.think(perception());

    expect(provider.seen.some((r) => r.kind === 'interpret.signal' && r.signal === 'temperature-low')).toBe(true);
    expect(agent.memory.hypothesisList().some((h) => h.statement.includes('calor'))).toBe(true);
  });

  it('con calor suficiente no hay objetivo ni consulta: no molesta al modelo', async () => {
    const { world, petId } = coldWorld({ temperature: 45, fire: true });
    const { agent, provider, perception } = makeAgent(world, petId);

    await agent.think(perception());

    expect(agent.goals.byDescription(GOAL_RESTORE_WARMTH)).toBeUndefined();
    expect(provider.seen.some((r) => r.kind === 'interpret.signal')).toBe(false);
  });

  it('quien no siente frío no tiene objetivo (los mundos sin frío no cambian)', async () => {
    const { world, petId } = coldWorld({ fire: true });
    delete world.entities[petId]!.components.temperature;
    const { agent, perception } = makeAgent(world, petId);

    await agent.think(perception());

    expect(agent.goals.byDescription(GOAL_RESTORE_WARMTH)).toBeUndefined();
  });

  it('va hacia el fuego, se detiene a distancia 2 y se calienta sin quemarse', async () => {
    const { world, petId } = coldWorld({ fire: true });
    const { agent } = makeAgent(world, petId);
    const pet = world.entities[petId]!;
    const startTemperature = pet.components.temperature!.current;

    for (let i = 0; i < 40; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (!intent) break;
      agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // Se calentó...
    expect(pet.components.temperature!.current).toBeGreaterThan(startTemperature);
    // ...y no se quemó: paró a distancia 2, fuera del alcance del daño.
    expect(pet.components.health!.current).toBe(10);
    const distance = Math.max(Math.abs(pet.components.position!.x - 6), Math.abs(pet.components.position!.y - 2));
    expect(distance).toBe(2);
  });

  it('sin nada que dé calor ni forma de construirlo, pide ayuda en vez de fabricar skills inútiles', async () => {
    const { world, petId } = coldWorld({ fire: false, recipes: false });
    const { agent } = makeAgent(world, petId);

    let asked: string | null = null;
    for (let i = 0; i < 12 && asked === null; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak' && intent.text.includes('frío')) asked = intent.text;
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    expect(asked).toContain('¿Puedes ayudarme?');
    expect(agent.events.ofType('help.requested').length).toBeGreaterThan(0);
  });

  it('sin mundos fríos donde probar, pide ayuda en vez de aprender contra una vara imposible', async () => {
    // Puede construir fuego (tiene la receta), pero nadie le dio dónde
    // practicarlo: `temperatureIncreased` sería inalcanzable en un mundo
    // templado y la habilidad se rechazaría siempre.
    const { world, petId } = coldWorld({ fire: false });
    const { agent } = makeAgent(world, petId); // sin warmthScenarios

    for (let i = 0; i < 12; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    expect(agent.events.ofType('help.requested').length).toBeGreaterThan(0);
    expect(agent.events.ofType('skill.requested')).toHaveLength(0);
  });

  it('con materiales a la vista, junta, construye y se calienta sola', async () => {
    const { world, petId } = coldWorld({ fire: false });
    spawn(world, 'log', { position: { x: 2, y: 3 }, portable: {} });
    spawn(world, 'log', { position: { x: 3, y: 1 }, portable: {} });
    spawn(world, 'flint', { position: { x: 2, y: 1 }, portable: {} });
    const { agent } = makeAgent(world, petId, new RecordingModel(), COLD_SCENARIOS);
    const pet = world.entities[petId]!;

    for (let i = 0; i < 40 && !pet.components.dead; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, [{ actorId: petId, intent: intent ?? { type: 'wait' } }]));
    }

    // Construyó el fuego con sus propias manos: sin modelo, sin usuario.
    const fire = Object.values(world.entities).find((e) => e.kind === 'campfire');
    expect(fire).toBeDefined();
    // El reflejo la apartó: viva, a distancia segura, y calentándose.
    expect(pet.components.dead).toBeUndefined();
    expect(pet.components.health!.current).toBeGreaterThanOrEqual(9);
    const distance = Math.max(
      Math.abs(pet.components.position!.x - fire!.components.position!.x),
      Math.abs(pet.components.position!.y - fire!.components.position!.y),
    );
    expect(distance).toBeGreaterThan(1);
    expect(pet.components.temperature!.current).toBeGreaterThan(10);
  });

  it('el ciclo de aprendizaje se abre cuando falta CAPACIDAD, no recurso', async () => {
    // Fuego visible pero amurallado: acercarse falla por camino-bloqueado
    // (capacidad — una skill podría romper el muro), no por no-candidates.
    const { world, petId } = coldWorld({ fire: true });
    for (let y = 0; y < 5; y++) {
      spawn(world, 'wall', {
        position: { x: 4, y },
        collider: { solid: true },
        hardness: { value: 5 },
        durability: { current: 10, max: 10 },
      });
    }
    const { agent } = makeAgent(world, petId, new RecordingModel(), COLD_SCENARIOS);

    for (let i = 0; i < 24; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // El mock no sabe diseñar abrigo, así que fallará; lo que importa es que
    // lo intentó con el contrato correcto en vez de rendirse.
    const requested = agent.events.ofType('skill.requested');
    expect(requested.length).toBeGreaterThan(0);
    expect(requested[0]?.data.name).toBe(SKILL_GET_WARM);
  });
});
