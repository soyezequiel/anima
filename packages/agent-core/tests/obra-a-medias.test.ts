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
 * ADR 0059. Terminar el programa no es terminar la obra.
 *
 * Colocar cada bloque está protegido por «solo si de verdad lo tengo en la
 * mano» (ADR 0034): si faltó material, la celda se saltea en vez de abortar la
 * obra entera. Bien pensado para no tirar el trabajo hecho — pero entonces el
 * programa llega al final SIN abortar, y el éxito de un encargo se medía
 * justamente así: «¿terminó sin abortar?».
 *
 * Resultado: decía «Listo» con media escuela en pie, cerraba el objetivo (y sus
 * pasos, en cascada), y el cuidador veía un encargo cumplido que no lo estaba.
 */

const SCHOOL: Blueprint = {
  id: 'escuela',
  placements: [
    { kind: 'muro', offset: { x: -1, y: 0 } },
    { kind: 'muro', offset: { x: 1, y: 0 } },
    { kind: 'muro', offset: { x: 0, y: -1 } },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'escuela' },
};

/** Un solo muro suelto en todo el mapa, y el plano pide tres. */
function scarceWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 12, height: 7, seed: 8 }, { blueprints: [SCHOOL] });
  const petId = spawn(world, 'pet', {
    position: { x: 2, y: 3 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  spawn(world, 'muro', {
    position: { x: 5, y: 5 },
    portable: {},
    collider: { solid: true },
    hardness: { value: 1 },
    durability: { current: 4, max: 4 },
  });
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

describe('una obra a medias no es un encargo cumplido (ADR 0059)', () => {
  /**
   * El caso de la partida real: material de sobra, pero una celda que no se
   * puede ocupar. Colocar ahí falla en silencio —la celda se saltea— el
   * programa llega al final y el encargo se declaraba cumplido con la obra
   * agujereada. Las dos celdas que quedaron vacías en la escuela del cuidador
   * eran justo del borde de arriba.
   */
  it('si una celda no se puede ocupar, la obra queda a medias y NO se da por cumplida', async () => {
    const world = createWorld({ width: 12, height: 7, seed: 8 }, { blueprints: [SCHOOL] });
    const petId = spawn(world, 'pet', {
      position: { x: 5, y: 4 },
      collider: { solid: true },
      energy: { current: 48, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      strength: { value: 2 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Anima', perceptionRange: 12 },
    }).id;
    // Los tres bloques que el plano pide, sueltos y a mano: juntar nunca falla.
    for (let i = 0; i < 3; i++) {
      spawn(world, 'muro', {
        position: { x: 3 + i, y: 6 },
        portable: {},
        collider: { solid: true },
        hardness: { value: 1 },
        durability: { current: 4, max: 4 },
      });
    }
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una escuela');

    const dicho: string[] = [];
    let saboteada: { x: number; y: number } | null = null;
    for (let i = 0; i < 300; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') dicho.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
      // Apenas elige el sitio, una roca cae sobre una de sus celdas. Ya no
      // puede ocuparla — y el plano no se replantea porque ya empezó.
      const plan = agent.plannedStructures(buildPerception(world, petId))[0];
      if (!saboteada && plan) {
        const celda = plan.cells[0]!;
        saboteada = { x: celda.x, y: celda.y };
        spawn(world, 'rock', {
          position: saboteada,
          collider: { solid: true },
          hardness: { value: 40 },
          durability: { current: 999, max: 999 },
        });
      }
    }
    expect(saboteada).not.toBeNull();

    // Se mide contra el MUNDO y no contra el plan: el plan desaparece apenas
    // el objetivo se cierra, así que preguntarle ahí diría "no falta nada"
    // justo en el caso que queremos detectar.
    const hayMuroEnLaCelda = Object.values(world.entities).some(
      (e) =>
        e.kind === 'muro' &&
        e.components.position?.x === saboteada!.x &&
        e.components.position?.y === saboteada!.y,
    );
    expect(hayMuroEnLaCelda).toBe(false);

    const encargo = agent.goals.all().find((g) => g.userRequest?.kind === 'craft-item');
    expect(encargo).toBeDefined();
    // Falta una celda del plano: el encargo no puede estar cumplido, ni haber
    // anunciado un final que no ocurrió.
    expect(encargo!.status).not.toBe('completed');
    expect(dicho.some((t) => t === 'Listo.')).toBe(false);
  });

  it('con material para un solo bloque, el encargo NO se da por cumplido', async () => {
    const { world, petId } = scarceWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una escuela');

    const dicho: string[] = [];
    for (let i = 0; i < 250; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') dicho.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    const encargo = agent.goals.all().find((g) => g.userRequest?.kind === 'craft-item');
    expect(encargo).toBeDefined();
    // Con un muro para tres celdas, la obra no puede estar completa...
    const planned = agent.plannedStructures(buildPerception(world, petId));
    const faltan = planned[0]?.cells.filter((c) => !c.done).length ?? 0;
    expect(faltan).toBeGreaterThan(0);
    // ...así que el encargo NO puede estar cumplido.
    expect(encargo!.status).not.toBe('completed');
    // Ni sus pasos, que se cerraban en cascada con él.
    for (const paso of agent.goals.childrenOf(encargo!.id)) {
      expect(paso.status).not.toBe('completed');
    }
    // Y no anunció un final que no ocurrió.
    expect(dicho.some((t) => t === 'Listo.')).toBe(false);
  });

  it('queda esperando material, no fallada: puede retomarse sola', async () => {
    const { world, petId } = scarceWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una escuela');

    let encargo;
    for (let i = 0; i < 250; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
      encargo = agent.goals.all().find((g) => g.userRequest?.kind === 'craft-item');
      if (encargo?.status === 'suspended') break;
    }

    // Suspendida, no fallada: fallar la cerraría para siempre y conseguir el
    // material después no retomaría nada (ADR 0046).
    expect(encargo?.status).toBe('suspended');
    expect(encargo?.reactivateWhen).toContain('muro');
  });

  it('cuando la obra SÍ se termina, se cumple y lo dice', async () => {
    const { world, petId } = scarceWorld();
    // Los tres muros que el plano pide: ahora sí alcanza.
    for (let i = 0; i < 2; i++) {
      spawn(world, 'muro', {
        position: { x: 6 + i, y: 5 },
        portable: {},
        collider: { solid: true },
        hardness: { value: 1 },
        durability: { current: 4, max: 4 },
      });
    }
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una escuela');

    let encargo;
    for (let i = 0; i < 400; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
      encargo = agent.goals.all().find((g) => g.userRequest?.kind === 'craft-item');
      if (encargo?.status === 'completed') break;
    }

    expect(encargo?.status).toBe('completed');
    // Y de verdad: las tres celdas ocupadas.
    const planned = agent.plannedStructures(buildPerception(world, petId));
    expect(planned[0]?.cells.filter((c) => !c.done).length ?? 0).toBe(0);
  });
});
