import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * «No sé qué construir» no es un fracaso: es que la idea todavía no existe.
 *
 * El caso real, en el cauce ancho. El juez vetó el puente con una instrucción
 * de cómo rehacerlo —«un puente es un lugar, no una cosa»— y diez ticks después
 * el encargo estaba MUERTO con «no sé qué construir». Quedó parada 490 ticks
 * con el motivo de su fracaso guardado en la memoria y sin nadie que lo leyera,
 * hasta que le vino el hambre.
 *
 * Lo que duele es que en otras corridas, con el mismo veto, sí volvía a
 * proponer y cruzaba. La diferencia no era la idea: era quién llegaba primero
 * al objetivo, el ciclo de invención o el programa que solo podía abortar.
 *
 * Un encargo que nombra algo que todavía no sabe hacer espera; no se cierra.
 */

class ScriptedModel extends MockModelProvider {
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

function world(): { world: WorldState; petId: EntityId } {
  const w = createWorld({ width: 10, height: 7, seed: 2 });
  const petId = spawn(w, 'pet', {
    position: { x: 4, y: 3 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.001 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  spawn(w, 'tronco', { position: { x: 3, y: 3 }, portable: {} });
  spawn(w, 'tronco', { position: { x: 5, y: 3 }, portable: {} });
  return { world: w, petId };
}

function makeAgent(petId: EntityId, provider: MockModelProvider) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-19T00:00:00Z',
  });
}

describe('un encargo que todavía no sabe hacer espera, no se cierra', () => {
  it('pedir algo sin receta ni plano lo deja pendiente, no fracasado', async () => {
    const { world: w, petId } = world();
    // El modelo interpreta la orden pero nunca llega a haber receta: es el
    // estado exacto de después de un veto, cuando la forma vieja ya no vale y
    // la nueva todavía no existe.
    const provider = new ScriptedModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'puente' },
      },
    });
    const agent = makeAgent(petId, provider);
    agent.receiveUserMessage('construí un puente');

    for (let i = 0; i < 40; i++) {
      // El mundo avanza SIEMPRE, haya intención o no: un encargo dormido no
      // detiene el reloj, y el plazo para volver a pensarlo se mide en ticks.
      const intent = await agent.think(buildPerception(w, petId));
      agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
    }

    const encargo = agent
      .exportState()
      .goals.goals.find((g) => g.userRequest?.kind === 'craft-item');
    expect(encargo).toBeDefined();
    // Lo que importa: NO está cerrado. Un encargo vivo se puede retomar; uno
    // fracasado se lo tiene que volver a pedir el cuidador.
    expect(encargo?.status).not.toBe('failed');
    expect(encargo?.status).toBe('suspended');
  });

  it('y lo vuelve a pensar al rato, en vez de quedarse dormido para siempre', async () => {
    const { world: w, petId } = world();
    const provider = new ScriptedModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'puente' },
      },
    });
    const agent = makeAgent(petId, provider);
    agent.receiveUserMessage('construí un puente');

    // Más allá del plazo de reintento: si no vuelve a pensarlo, cambiar morir
    // por dormir no habría arreglado nada.
    for (let i = 0; i < 220; i++) {
      // El mundo avanza SIEMPRE, haya intención o no: un encargo dormido no
      // detiene el reloj, y el plazo para volver a pensarlo se mide en ticks.
      const intent = await agent.think(buildPerception(w, petId));
      agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
    }

    const revive = agent.events
      .ofType('goal.reactivated')
      .filter((e) => String(e.data.reason) === 'vuelve a pensar cómo hacerlo');
    expect(revive.length).toBeGreaterThan(0);
  });
});
