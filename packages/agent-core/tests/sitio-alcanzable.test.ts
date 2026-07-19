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
 * El sitio de una obra tiene que ser ALCANZABLE, no solo estar libre.
 *
 * El caso real: le pidieron una cocina. Juntó el fogón y las tres encimeras —esa
 * parte funcionó—, eligió un sitio despejado a tres celdas… del otro lado de un
 * muro. El caminante es greedy y ciego a obstáculos (ADR 0005, a propósito), así
 * que generó «izquierda, izquierda, izquierda» y el muro rebotó los tres pasos.
 * Nadie miró si habían funcionado: el programa siguió, marcó el ancla DONDE
 * QUEDÓ TRABADA y colocó el fogón sobre una veta y la encimera sobre el muro.
 * Dos `cell-occupied` y un «la acción no produjo el resultado esperado».
 *
 * Son dos fallas encadenadas y este archivo cubre las dos:
 *
 * 1. El `approach` se emitía como `moveStep` pelados, sin comprobar que hubieran
 *    funcionado — con `walkOps` al lado, que existe justamente para eso. La
 *    invariante que el comentario declaraba («el ancla es el LUGAR de la obra, no
 *    donde ella estaba cuando se le ocurrió empezar») no la garantizaba nadie.
 * 2. El sitio se elegía por distancia Manhattan, sin preguntarse si el camino que
 *    de verdad se iba a caminar llegaba hasta ahí.
 */

const COCINA: Blueprint = {
  id: 'cocina',
  placements: [
    { kind: 'fogon', offset: { x: 0, y: -1 } },
    { kind: 'encimera', offset: { x: -1, y: 0 } },
    { kind: 'encimera', offset: { x: 1, y: 0 } },
    { kind: 'encimera', offset: { x: 0, y: 1 } },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'cocina' },
};

/**
 * Un muro parte el mapa en dos. Ella queda del lado derecho, emparedada entre
 * rocas: acá no entra la cocina. El único claro está a la izquierda, y para
 * llegar hay que bajar hasta el hueco del muro y volver a subir — un rodeo que
 * el caminante greedy no sabe hacer.
 */
function mundoPartido(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 13, height: 7, seed: 3 }, { blueprints: [COCINA] });
  const petId = spawn(world, 'pet', {
    position: { x: 6, y: 1 },
    collider: { solid: true },
    energy: { current: 50, max: 50, decayPerTick: 0.001 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 20 },
  }).id;

  const roca = (x: number, y: number) =>
    spawn(world, 'rock', { position: { x, y }, collider: { solid: true }, hardness: { value: 9 } });

  // El muro divisorio, con un solo paso a la altura y=4.
  for (let y = 0; y < 7; y++) if (y !== 4) roca(5, y);
  // Su lado, tapado: ningún claro donde la cocina entre.
  for (let x = 6; x < 13; x++) {
    for (let y = 0; y < 7; y++) {
      if (x === 6 && y === 1) continue; // donde está parada
      roca(x, y);
    }
  }

  // Ya tiene las cuatro piezas en la mano: lo que se prueba es COLOCARLAS.
  for (const kind of ['fogon', 'encimera', 'encimera', 'encimera']) {
    const e = spawn(world, kind, { portable: {} });
    delete e.components.position;
    world.entities[petId]!.components.inventory!.items.push(e.id);
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

async function correr(w: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number) {
  const rechazos: { action: string; reason: string }[] = [];
  const dijo: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    if (intent?.type === 'speak') dijo.push(intent.text);
    const events = stepWorld(w, intent ? [{ actorId: petId, intent }] : []);
    for (const e of events) {
      if (e.type === 'action.resolved' && e.data.success === false) {
        rechazos.push({ action: String(e.data.action), reason: String(e.data.reason) });
      }
    }
    agent.observe(events);
  }
  return { rechazos, dijo };
}

describe('el sitio de una obra tiene que ser alcanzable', () => {
  /**
   * La regresión exacta. No se le exige construir la cocina —del otro lado del
   * muro puede no llegar nunca—, se le exige NO tirar bloques sobre celdas que
   * está viendo ocupadas. Colocar sobre una veta no es un intento fallido: es
   * haber marcado el ancla en el lugar equivocado.
   */
  it('nunca intenta colocar un bloque en una celda ocupada', async () => {
    const { world: w, petId } = mundoPartido();
    const agent = makeAgent(petId);

    agent.receiveUserMessage('crea una cocina');
    const { rechazos } = await correr(w, petId, agent, 120);

    const ocupadas = rechazos.filter((r) => r.action === 'place' && r.reason === 'cell-occupied');
    expect(ocupadas).toEqual([]);
  });

  /**
   * Y no se calla. Sin sitio al que llegar, la obra no se planta en el primer
   * lugar que toque: lo dice. Antes esto salía como «la acción no produjo el
   * resultado esperado» —el mensaje que aparece cuando nadie sabe qué pasó—
   * después de tirar los bloques contra las piedras.
   */
  it('dice que no tiene dónde levantarla, en vez de intentarlo contra una piedra', async () => {
    const { world: w, petId } = mundoPartido();
    const agent = makeAgent(petId);

    agent.receiveUserMessage('crea una cocina');
    const { dijo } = await correr(w, petId, agent, 120);

    expect(dijo.some((t) => t.includes('lugar despejado'))).toBe(true);
    expect(dijo.some((t) => t.includes('no produjo el resultado esperado'))).toBe(false);
  });

  /**
   * La otra mitad: si el camino no llega, el ancla no se marca igual. Sin esto,
   * el ancla queda donde el muro la frenó y la obra entera se planta corrida.
   */
  it('no planta la obra donde quedó trabada, sino en el sitio que eligió', async () => {
    const { world: w, petId } = mundoPartido();
    const agent = makeAgent(petId);

    agent.receiveUserMessage('crea una cocina');
    await correr(w, petId, agent, 120);

    const plan = agent.plannedStructures(buildPerception(w, petId))[0];
    if (!plan) return; // la abandonó honestamente: tampoco plantó nada mal
    const solidas = new Set(
      Object.values(w.entities)
        .filter((e) => e.components.collider?.solid === true && e.components.position)
        .map((e) => `${e.components.position!.x},${e.components.position!.y}`),
    );
    for (const cell of plan.cells) {
      expect(solidas.has(`${cell.x},${cell.y}`)).toBe(false);
    }
  });
});
