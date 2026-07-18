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
 * ADR 0065. Un encargo sin material sale a buscarlo, no lo espera.
 *
 * Partida real: escuela a la que le faltaba UN muro. La mascota estaba parada
 * en la esquina (0,0), el objetivo suspendido «hasta que aparezca un tronco», y
 * había dos troncos en el mapa —a (11,2) y (8,5)—, fuera de su vista.
 *
 * El material existía, ella sabía qué necesitaba, y se quedó quieta: revivir
 * exigía VERLO desde donde estaba. Nunca iba a verlo sin moverse, y no se movía
 * porque el objetivo estaba dormido.
 */

const HUT: Blueprint = {
  id: 'choza',
  placements: [
    { kind: 'muro', offset: { x: -1, y: 0 } },
    { kind: 'muro', offset: { x: 1, y: 0 } },
  ],
};

const WALL_RECIPE = {
  id: 'muro',
  ingredients: [{ kind: 'log', count: 1 }],
  outcomes: [
    {
      weight: 1,
      output: { kind: 'muro', components: { portable: {}, collider: { solid: true } } },
    },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'choza' },
};

/**
 * Mundo largo y angosto SIN un solo tronco: se rinde de verdad. La madera
 * llega después, lejos y fuera de su vista — que es la forma exacta de la
 * partida real, donde el material apareció mientras ella ya estaba dormida.
 */
function emptyWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld(
    { width: 24, height: 3, seed: 9 },
    { recipes: [WALL_RECIPE], blueprints: [HUT] },
  );
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 1 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    // Vista corta: la madera del fondo no existe para ella hasta caminar.
    agent: { name: 'Anima', perceptionRange: 5 },
  }).id;
  return { world, petId };
}

/** La madera aparece en la otra punta, donde no puede verla desde su rincón. */
function dropWoodFarAway(world: WorldState): void {
  for (let i = 0; i < 3; i++) {
    spawn(world, 'log', { position: { x: 20 + i, y: 1 }, portable: {} });
  }
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

describe('un encargo sin material sale a buscarlo (ADR 0065)', () => {
  /** Vive hasta que el encargo se rinde por falta de materia, y lo devuelve. */
  async function suspendUntilGivenUp(
    world: WorldState,
    petId: EntityId,
    agent: AnimaAgent,
  ): Promise<void> {
    for (let i = 0; i < 300; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
      const encargo = agent.goals.all().find((g) => g.userRequest?.kind === 'craft-item');
      if (encargo?.status === 'suspended') return;
    }
  }

  it('el material que aparece lejos deja de ser invisible: va, lo trae y termina', async () => {
    const { world, petId } = emptyWorld();
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;
    agent.receiveUserMessage('construí una choza');

    // Primero se rinde de verdad: no hay un solo tronco en el mapa.
    await suspendUntilGivenUp(world, petId, agent);
    const encargo = agent.goals.all().find((g) => g.userRequest?.kind === 'craft-item');
    expect(encargo?.status).toBe('suspended');

    // Y AHORA aparece la madera, en la otra punta y fuera de su vista.
    dropWoodFarAway(world);
    expect(
      buildPerception(world, petId).visibleEntities.some((e) => e.kind === 'log'),
    ).toBe(false);

    const enPie = () =>
      Object.values(world.entities).filter((e) => e.kind === 'muro' && e.components.position).length;
    let lejosQueLlego = pet.components.position!.x;
    for (let i = 0; i < 900 && enPie() < 2; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
      lejosQueLlego = Math.max(lejosQueLlego, pet.components.position!.x);
    }

    // Cruzó el mapa a buscarla —se mide lo más lejos que LLEGÓ, no dónde
    // terminó: vuelve al sitio de la obra a colocar—...
    expect(lejosQueLlego).toBeGreaterThan(15);
    // ...y la obra quedó completa, sin que nadie se la trajera a la mano.
    expect(enPie()).toBe(2);
  });

  it('el reintento queda registrado con su motivo', async () => {
    const { world, petId } = emptyWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');
    await suspendUntilGivenUp(world, petId, agent);
    dropWoodFarAway(world);

    for (let i = 0; i < 400; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    // Que despierte no es un accidente: el motivo lo dice. Cualquiera de los
    // dos caminos nuevos sirve —recordar dónde había, o volver a salir a
    // buscar—; lo que no puede pasar es que el único sea verlo aparecer.
    const motivos = agent.events.ofType('goal.reactivated').map((e) => String(e.data.reason));
    expect(
      motivos.some(
        (m) => m.includes('vuelve a salir a buscar') || m.includes('recordó dónde había'),
      ),
    ).toBe(true);
  });
});

/**
 * ADR 0066. Recargar la página no puede huerfanar un encargo dormido.
 *
 * `suspensionMaterials` —qué materia espera cada encargo suspendido— vivía solo
 * en memoria. Al restaurar un guardado la lista llegaba vacía, y sin lista
 * NINGÚN camino podía despertarlo: ni ver el material, ni recordarlo, ni salir
 * a buscarlo. La escuela del cuidador quedó así, parada en una esquina.
 */
describe('un encargo dormido sobrevive a la recarga (ADR 0066)', () => {
  async function suspendUntilGivenUp(
    world: WorldState,
    petId: EntityId,
    agent: AnimaAgent,
  ): Promise<void> {
    for (let i = 0; i < 300; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
      const encargo = agent.goals.all().find((g) => g.userRequest?.kind === 'craft-item');
      if (encargo?.status === 'suspended') return;
    }
  }

  it('lo que esperaba viaja en el guardado', async () => {
    const { world, petId } = emptyWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');
    await suspendUntilGivenUp(world, petId, agent);

    const guardado = agent.exportState();
    expect(guardado.suspensionMaterials?.length).toBeGreaterThan(0);
    expect(guardado.suspensionMaterials?.[0]?.kinds).toContain('log');
  });

  it('restaurado, sigue despertando y termina la obra', async () => {
    const { world, petId } = emptyWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');
    await suspendUntilGivenUp(world, petId, agent);

    // La recarga: otro agente que arranca del guardado.
    const otro = makeAgent(petId);
    otro.importState(agent.exportState());
    dropWoodFarAway(world);

    const enPie = () =>
      Object.values(world.entities).filter((e) => e.kind === 'muro' && e.components.position).length;
    for (let i = 0; i < 900 && enPie() < 2; i++) {
      const intent = await otro.think(buildPerception(world, petId));
      otro.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }
    expect(enPie()).toBe(2);
  });

  it('un guardado viejo, sin la lista, la rehace en vez de quedarse huérfano', async () => {
    const { world, petId } = emptyWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');
    await suspendUntilGivenUp(world, petId, agent);

    // Exactamente lo que traía una partida guardada antes de este arreglo.
    const viejo = agent.exportState();
    delete viejo.suspensionMaterials;
    const otro = makeAgent(petId);
    otro.importState(viejo);
    dropWoodFarAway(world);

    const enPie = () =>
      Object.values(world.entities).filter((e) => e.kind === 'muro' && e.components.position).length;
    for (let i = 0; i < 900 && enPie() < 2; i++) {
      const intent = await otro.think(buildPerception(world, petId));
      otro.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }
    expect(enPie()).toBe(2);
  });
});
