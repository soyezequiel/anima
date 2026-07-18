import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, GOAL_RESTORE_WARMTH } from '../src/index.js';

/**
 * ADR 0054. Lo que no ve, lo busca.
 *
 * La generación 3 murió de frío PARADA. Repitió «Tengo frío y no veo nada que
 * dé calor. ¿Puedes ayudarme?» tres veces, se suspendió «sin estrategias
 * viables tras pedir ayuda», y esperó hasta morir — con un refugio en el mapa,
 * detrás de un muro. La vista exige línea despejada (ADR 0025), así que ese
 * refugio no existía para ella; y todas sus estrategias arrancaban con
 * `findEntities` sobre lo visible. Nunca dio un paso para mirar.
 *
 * Estas pruebas fijan las dos mitades del arreglo: que salga a buscar, y que
 * salir a buscar no le robe el turno a pedir ayuda.
 */

/** Un mundo largo con el refugio al fondo, fuera de la vista al arrancar. */
function worldWithHiddenShelter(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 22, height: 3, seed: 4 });
  const petId = spawn(world, 'pet', {
    position: { x: 1, y: 1 },
    collider: { solid: true },
    energy: { current: 45, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    temperature: { current: 10, max: 50, lossPerTick: 0.1 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    // Vista corta: el refugio del fondo está fuera de alcance hasta caminar.
    agent: { name: 'Anima', perceptionRange: 4 },
  }).id;
  spawn(world, 'shelter', { position: { x: 20, y: 1 }, shelter: { range: 1 } });
  return { world, petId };
}

function makeAgent(petId: EntityId) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider: new MockModelProvider(),
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-18T00:00:00Z',
  });
}

describe('lo que no ve, lo busca (ADR 0054)', () => {
  it('sale a caminar en vez de morirse parada, y encuentra el refugio que no veía', async () => {
    const { world, petId } = worldWithHiddenShelter();
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;

    // Al arrancar el refugio no existe para ella: está fuera de la vista.
    const start = buildPerception(world, petId);
    expect(start.visibleEntities.some((e) => e.shelter === true)).toBe(false);
    const startX = pet.components.position!.x;

    for (let i = 0; i < 220; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, [{ actorId: petId, intent: intent ?? { type: 'wait' } }]));
      if (buildPerception(world, petId).visibleEntities.some((e) => e.shelter === true)) break;
    }

    // Caminó de verdad, y el refugio dejó de ser invisible.
    expect(pet.components.position!.x).toBeGreaterThan(startX);
    expect(buildPerception(world, petId).visibleEntities.some((e) => e.shelter === true)).toBe(true);
    // Y caminó POR ESTO, no de casualidad: la estrategia que corrió es una de
    // las de buscar. Sin esta comprobación el test pasaría por cualquier paso
    // que diera por otro motivo.
    const strategies = agent.events.ofType('strategy.selected').map((e) => String(e.data.strategy));
    expect(strategies.some((s) => s === 'buscar-calor' || s === 'buscar-refugio')).toBe(true);
  });

  it('buscar no le roba el turno a pedir ayuda: primero avisa, después camina', async () => {
    const { world, petId } = worldWithHiddenShelter();
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;
    const startX = pet.components.position!.x;

    let helpTick: number | null = null;
    for (let i = 0; i < 220; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, [{ actorId: petId, intent: intent ?? { type: 'wait' } }]));
      if (helpTick === null && agent.events.ofType('help.requested').length > 0) helpTick = i;
      if (helpTick !== null) break;
    }

    // El aviso llega, y llega ANTES de haberse ido a recorrer el mapa: el
    // cuidador tiene que enterarse temprano, no cuando ya cruzó el mundo.
    expect(helpTick).not.toBeNull();
    expect(pet.components.position!.x - startX).toBeLessThan(10);
  });

  it('si busca y tampoco encuentra, se rinde: buscar no es un bucle eterno', async () => {
    // Mundo pelado: ni calor, ni techo, ni con qué hacerlos. Buscar es honesto
    // pero infructuoso, y tiene que terminar en la misma suspensión de siempre.
    const world = createWorld({ width: 10, height: 5, seed: 7 });
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
    const agent = makeAgent(petId);

    let suspended = false;
    for (let i = 0; i < 300 && !suspended; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, [{ actorId: petId, intent: intent ?? { type: 'wait' } }]));
      suspended = agent.goals.byDescription(GOAL_RESTORE_WARMTH)?.status === 'suspended';
    }
    expect(suspended).toBe(true);
  });
});
