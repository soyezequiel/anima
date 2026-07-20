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
 * Una obra es una obra, no una por objetivo.
 *
 * «Fabricá un puente y ponelo sobre el agua» se parte en dos encargos
 * encadenados (ADR 0078), pero el puente es UNO. El sitio de la obra estaba
 * indexado por objetivo, así que cada encargo abría su propia ancla y se
 * repartían los tablones: en el mapa del cauce se la vio con medio puente en
 * (5,4) y medio en (5,5), sin terminar ninguno de los dos.
 *
 * El sitio es del PLANO, no del encargo que lo pide.
 */

const BRIDGE: Blueprint = {
  id: 'puente',
  placements: [
    { kind: 'tablon', offset: { x: 0, y: 0 } },
    { kind: 'tablon', offset: { x: 1, y: 0 } },
    { kind: 'tablon', offset: { x: 2, y: 0 } },
  ],
};

/** Los dos pasos del encargo, encadenados: el mismo puente en los dos. */
const BUILD_AND_PLACE: ModelResponse = {
  kind: 'command.interpretation',
  command: {
    action: 'sequence',
    steps: [
      { action: 'craft-item', recipeId: 'puente' },
      { action: 'place-item', targetKind: 'puente', onKind: 'water' },
    ],
  },
};

function bridgeWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 14, height: 9, seed: 3 }, { blueprints: [BRIDGE] });
  const petId = spawn(world, 'pet', {
    position: { x: 2, y: 4 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 14 },
  }).id;
  // Un hilo de agua para que el «ponelo sobre el agua» tenga a qué apuntar.
  for (let y = 2; y < 7; y++) {
    spawn(world, 'water', { position: { x: 8, y }, water: {} });
  }
  // Tablones sueltos, suficientes para un puente y no para dos.
  for (let i = 0; i < 3; i++) {
    spawn(world, 'tablon', {
      position: { x: 4 + i, y: 7 },
      portable: {},
      footing: {},
      hardness: { value: 1 },
      durability: { current: 4, max: 4 },
    });
  }
  return { world, petId };
}

function makeAgent(petId: EntityId): AnimaAgent {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    provider: new ScriptedModelProvider([BUILD_AND_PLACE], { interpretsLanguage: true }),
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-20T00:00:00Z',
  });
}

async function run(w: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
  }
}

describe('una obra es una obra, no una por objetivo', () => {
  it('los dos encargos encadenados levantan el mismo puente, en un solo sitio', async () => {
    const { world: w, petId } = bridgeWorld();
    const agent = makeAgent(petId);

    agent.receiveUserMessage('fabricá un puente y ponelo sobre el agua');

    // Se muestrea a lo largo de toda la obra: el reparto aparecía al pasar de
    // un encargo al siguiente, no al empezar. Mirar solo el final lo perdía.
    const anclas = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await run(w, petId, agent, 5);
      for (const site of agent.exportState().structureSites ?? []) {
        if (site.blueprintId !== BRIDGE.id) continue;
        anclas.add(`${site.anchor.x},${site.anchor.y}`);
      }
      // Nunca hay dos obras del mismo plano abiertas a la vez.
      const delPuente = agent
        .plannedStructures(buildPerception(w, petId))
        .filter((p) => p.blueprintId === BRIDGE.id);
      expect(delPuente.length).toBeLessThanOrEqual(1);
    }

    // Y a lo largo de todo el encargo hubo UN solo sitio: el puente no se
    // repartió entre dos anclas.
    expect(anclas.size).toBe(1);
  });

  it('los tablones puestos quedan todos en la misma obra', async () => {
    const { world: w, petId } = bridgeWorld();
    const agent = makeAgent(petId);

    agent.receiveUserMessage('fabricá un puente y ponelo sobre el agua');
    await run(w, petId, agent, 200);

    const puestos = Object.values(w.entities).filter(
      (e) => e.kind === 'tablon' && e.components.position && !e.components.portable,
    );
    if (puestos.length === 0) return; // no llegó a colocar: nada que repartir

    // Todo lo colocado cae dentro del único plano abierto. Con un ancla por
    // objetivo, los tablones quedaban repartidos entre dos siluetas y ninguna
    // de las dos se completaba nunca.
    const plan = agent
      .plannedStructures(buildPerception(w, petId))
      .find((p) => p.blueprintId === BRIDGE.id);
    if (!plan) return; // la terminó: ya no hay silueta que comparar
    const celdas = new Set(plan.cells.map((c) => `${c.x},${c.y}`));
    for (const tablon of puestos) {
      const pos = tablon.components.position!;
      expect(celdas.has(`${pos.x},${pos.y}`)).toBe(true);
    }
  });
});
