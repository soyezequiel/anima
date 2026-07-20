import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * Esperar algo que ya tenés delante no es esperar: es girar en el lugar.
 *
 * El caso real, en el cauce ancho. Un encargo se quedó sin material y se
 * suspendió «hasta que aparezca piedra, tronco o fibra». Las tres estaban ahí,
 * tiradas en la orilla, a la vista — nunca se habían ido. Así que la condición
 * para despertarla ya era cierta en el momento de dormirse: se despertaba,
 * fallaba por lo mismo, se volvía a dormir, y otra vez.
 *
 * Medido: 100 suspensiones y 100 reactivaciones en 100 ticks, sin UNA sola
 * acción en el medio. El encargo no avanzaba y el reloj sí.
 *
 * La regla que faltaba es la que ya usaban las señales del cuerpo: el alivio
 * tiene que ser algo que NO estaba a la vista cuando se rindió.
 */

class ScriptedModel extends MockModelProvider {
  override readonly interpretsLanguage = true;
  constructor(private scripted: Partial<Record<ModelRequest['kind'], ModelResponse>>) {
    super();
  }
  override complete(request: ModelRequest): Promise<ModelResponse> {
    const canned = this.scripted[request.kind];
    if (canned) return Promise.resolve(canned);
    return super.complete(request);
  }
}

/**
 * La forma exacta del bucle: la pieza que falta se fabrica con DOS materiales,
 * uno se agota y el otro sobra a la vista.
 *
 * Eso es lo que engañaba a la condición de despertar. «Lo que me falta» se
 * expande a la materia base —tronco y piedra— y basta con ver UNA de las dos
 * para que cuente como «apareció el material». Las piedras nunca se movieron de
 * ahí, así que la despertaban en cada tick para volver a fallar por los troncos
 * que sí se habían acabado.
 */
function worldShortOfMaterial(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 10, height: 7, seed: 5 });
  const petId = spawn(world, 'pet', {
    position: { x: 5, y: 3 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.001 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  world.recipes.push({
    id: 'muro',
    outcomes: [
      { weight: 1, output: { kind: 'muro', components: { portable: {}, collider: { solid: true } } } },
    ],
    ingredients: [
      { kind: 'tronco', count: 1 },
      { kind: 'piedra', count: 1 },
    ],
  });
  world.blueprints.push({
    id: 'corral',
    placements: [
      { kind: 'muro', offset: { x: -1, y: -1 } },
      { kind: 'muro', offset: { x: 0, y: -1 } },
      { kind: 'muro', offset: { x: 1, y: -1 } },
      { kind: 'muro', offset: { x: -1, y: 1 } },
      { kind: 'muro', offset: { x: 0, y: 1 } },
      { kind: 'muro', offset: { x: 1, y: 1 } },
    ],
  });
  // Dos troncos para seis muros: se agotan enseguida.
  spawn(world, 'tronco', { position: { x: 4, y: 3 }, portable: {} });
  spawn(world, 'tronco', { position: { x: 6, y: 3 }, portable: {} });
  // Y piedras de sobra, que se quedan ahí para siempre a la vista. Son las que
  // la despertaban: ver una piedra no acerca ni un poco el muro que falta.
  for (const at of [
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
    { x: 6, y: 1 },
    { x: 7, y: 1 },
    { x: 3, y: 5 },
    { x: 4, y: 5 },
    { x: 5, y: 5 },
  ]) {
    spawn(world, 'piedra', { position: at, portable: {} });
  }
  return { world, petId };
}

function makeAgent(petId: EntityId, provider: MockModelProvider) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-19T00:00:00Z',
  });
}

describe('un encargo sin material espera, pero no gira en el lugar', () => {
  it('no se suspende y reactiva cada tick con lo que ya tenía a la vista', async () => {
    const { world, petId } = worldShortOfMaterial();
    const provider = new ScriptedModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'corral' },
      },
    });
    const agent = makeAgent(petId, provider);
    agent.receiveUserMessage('construí un corral');

    for (let i = 0; i < 400; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // Que se suspenda está bien: le falta material de verdad. Lo que no puede
    // pasar es que se despierte una y otra vez por lo mismo que la durmió.
    const reactivaciones = agent.events
      .ofType('goal.reactivated')
      .filter((e) => String(e.data.reason) === 'apareció el material que faltaba');
    expect(reactivaciones.length).toBeLessThanOrEqual(2);
  });

  it('pero si aparece material NUEVO, se despierta', async () => {
    const { world, petId } = worldShortOfMaterial();
    const provider = new ScriptedModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'corral' },
      },
    });
    const agent = makeAgent(petId, provider);
    agent.receiveUserMessage('construí un corral');

    for (let i = 0; i < 200; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }
    const dormidaEn = agent.events.ofType('goal.reactivated').length;

    // El cuidador le acerca lo que le faltaba: eso SÍ es una novedad.
    for (const at of [
      { x: 4, y: 2 },
      { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 6, y: 4 },
    ]) {
      spawn(world, 'tronco', { position: at, portable: {} });
    }
    for (let i = 0; i < 60; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    expect(agent.events.ofType('goal.reactivated').length).toBeGreaterThan(dormidaEn);
  });
});
