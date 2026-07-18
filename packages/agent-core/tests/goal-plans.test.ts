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
 * ADR 0052. Lo que cada objetivo necesita, en datos y no en frase.
 *
 * La cuenta ya existía —es la que la hace suspenderse y retomar sola— pero solo
 * salía convertida en una oración para el cuidador. La pantalla no podía
 * dibujar un tronco ni decir cuántos: mostraba «esperando material» y ahí
 * terminaba. Estas pruebas fijan que lo que se dibuja sea EXACTAMENTE lo que el
 * agente calcula, incluida la diferencia entre «hay uno a la vista» (va sola) y
 * «no lo ve» (alguien tiene que ayudarla).
 */

const HUT: Blueprint = {
  id: 'choza',
  placements: [
    { kind: 'wall', offset: { x: 1, y: 0 } },
    { kind: 'wall', offset: { x: 2, y: 0 } },
    { kind: 'wall', offset: { x: 1, y: 1 } },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'choza' },
};

function hutWorld(options: { loose?: number; quarry?: boolean } = {}): {
  world: WorldState;
  petId: EntityId;
} {
  const world = createWorld({ width: 14, height: 9, seed: 5 }, { blueprints: [HUT] });
  const petId = spawn(world, 'pet', {
    position: { x: 2, y: 4 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 14 },
  }).id;
  for (let i = 0; i < (options.loose ?? 0); i++) {
    spawn(world, 'wall', {
      position: { x: 5 + i, y: 7 },
      portable: {},
      hardness: { value: 1 },
      durability: { current: 4, max: 4 },
    });
  }
  if (options.quarry) {
    // Una cantera: no hay muros sueltos, pero se sacan rompiéndola.
    spawn(world, 'quarry', {
      position: { x: 9, y: 4 },
      hardness: { value: 2 },
      durability: { current: 6, max: 6 },
      drops: [{ kind: 'wall', components: { portable: {} } }],
    });
  }
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

async function run(w: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
  }
}

describe('lo que le falta a cada objetivo, en datos (ADR 0052)', () => {
  it('nombra el tipo y el número de lo que hay que conseguir', async () => {
    const { world, petId } = hutWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');
    await run(world, petId, agent, 6);

    const plan = agent.goalPlans(buildPerception(world, petId)).find((p) => p.needs.length > 0);
    expect(plan).toBeDefined();
    const wall = plan!.needs.find((n) => n.kind === 'wall');
    // Tres celdas de muro en el plano y ninguna en la mano: faltan tres.
    expect(wall).toMatchObject({ kind: 'wall', need: 3, have: 0 });
    // Sin muros sueltos ni cantera: no puede conseguirlo sola de ninguna forma,
    // y eso es justo lo que el cuidador necesita ver.
    expect(wall!.visible).toBe(false);
    expect(wall!.from).toBeUndefined();
  });

  it('distingue lo que tiene a la vista de lo que hay que romper para sacar', async () => {
    const conSueltos = hutWorld({ loose: 3 });
    const suelto = makeAgent(conSueltos.petId);
    suelto.receiveUserMessage('construí una choza');
    await run(conSueltos.world, conSueltos.petId, suelto, 3);
    const visto = suelto
      .goalPlans(buildPerception(conSueltos.world, conSueltos.petId))
      .flatMap((p) => p.needs)
      .find((n) => n.kind === 'wall');
    expect(visto?.visible).toBe(true);
    // Lo ve tirado: no hace falta contarle de dónde más podría sacarlo.
    expect(visto?.from).toBeUndefined();

    const conCantera = hutWorld({ quarry: true });
    const cantera = makeAgent(conCantera.petId);
    cantera.receiveUserMessage('construí una choza');
    await run(conCantera.world, conCantera.petId, cantera, 3);
    const cosecha = cantera
      .goalPlans(buildPerception(conCantera.world, conCantera.petId))
      .flatMap((p) => p.needs)
      .find((n) => n.kind === 'wall');
    expect(cosecha?.visible).toBe(false);
    // No hay muros sueltos, pero sí de dónde sacarlos: puede ir sola igual.
    expect(cosecha?.from).toBe('quarry');
  });

  it('lo ya levantado deja de pedirse, y el avance de la obra se puede contar', async () => {
    const { world, petId } = hutWorld({ loose: 3 });
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');

    // Se la deja trabajar hasta que ponga al menos un bloque.
    let progreso: { placed: number; total: number } | undefined;
    for (let i = 0; i < 120 && (progreso?.placed ?? 0) === 0; i++) {
      await run(world, petId, agent, 1);
      progreso = agent.goalPlans(buildPerception(world, petId))[0]?.structure;
    }

    expect(progreso).toMatchObject({ total: 3 });
    expect(progreso!.placed).toBeGreaterThan(0);
    // La cuenta de lo que falta descuenta lo puesto: pedir tres muros con uno
    // ya levantado mandaría al cuidador a buscar de más.
    const wall = agent
      .goalPlans(buildPerception(world, petId))
      .flatMap((p) => p.needs)
      .find((n) => n.kind === 'wall');
    expect(wall?.need ?? 0).toBe(3 - progreso!.placed);
  });

  it('un objetivo que no espera materia no inventa faltantes', async () => {
    const { world, petId } = hutWorld({ loose: 3 });
    const agent = makeAgent(petId);
    // Sin encargo: los objetivos que tenga son de su cuerpo, no de materia.
    await run(world, petId, agent, 4);
    for (const plan of agent.goalPlans(buildPerception(world, petId))) {
      expect(plan.needs).toEqual([]);
    }
  });
});
