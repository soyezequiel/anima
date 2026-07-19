import { describe, expect, it } from 'vitest';
import type { ModelResponse } from '@anima/model-providers';
import { ScriptedModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import { buildPerception, createWorld, spawn, stepWorld } from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { COLD_SCENARIOS, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * No se repite sola (ADR 0073).
 *
 * El caso real: se abrió paso tres veces seguidas y anunció las tres con la
 * misma oración palabra por palabra. La mitad de todo lo que había escrito en la
 * partida era ese anuncio repetido, y hay que leer los tres para descubrir que
 * son uno solo. El costo no era solo del chat: cada copia entraba también en su
 * memoria de conversación y viajaba al modelo como contexto del próximo diálogo.
 *
 * Lo que NO se toca: repetirse contestando. Si el cuidador pregunta dos veces lo
 * mismo, la segunda respuesta tiene que salir aunque sea idéntica — tragársela
 * se lee como que se colgó, que es peor que repetirse.
 */

const INTERPRET: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'not-command' },
};

function mundo(): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 10, height: 7, seed: 4 });
  const petId = spawn(world, 'pet', {
    position: { x: 4, y: 3 },
    collider: { solid: true },
    energy: { current: 50, max: 50, decayPerTick: 0.001 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 12 },
  }).id;
  return { world, petId };
}

function makeAgent(petId: EntityId) {
  return new AnimaAgent({
    petId,
    petName: 'Anima',
    // Varias respuestas: atender un mensaje del cuidador consume una consulta,
    // y el tercer caso justamente le habla en el medio.
    provider: new ScriptedModelProvider([INTERPRET, INTERPRET, INTERPRET, INTERPRET], {
      interpretsLanguage: true,
    }),
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-18T00:00:00Z',
  });
}

/** Lo que dijo en `ticks` pasos. */
async function correr(w: WorldState, petId: EntityId, agent: AnimaAgent, ticks: number) {
  const dijo: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    if (intent?.type === 'speak') dijo.push(intent.text);
    agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
  }
  return dijo;
}

/** El atajo al mecanismo: `reply` es privado y es justo lo que se prueba. */
function decir(agent: AnimaAgent, text: string): void {
  (agent as unknown as { reply(t: string): void }).reply(text);
}

describe('no se repite sola (ADR 0073)', () => {
  it('el mismo anuncio dos veces seguidas se dice una sola vez', async () => {
    const { world: w, petId } = mundo();
    const agent = makeAgent(petId);

    decir(agent, 'Voy a abrirme paso por el muro.');
    decir(agent, 'Voy a abrirme paso por el muro.');
    decir(agent, 'Voy a abrirme paso por el muro.');
    const dijo = await correr(w, petId, agent, 6);

    expect(dijo.filter((t) => t === 'Voy a abrirme paso por el muro.')).toHaveLength(1);
  });

  it('pero dos anuncios distintos salen los dos', async () => {
    const { world: w, petId } = mundo();
    const agent = makeAgent(petId);

    decir(agent, 'Voy a abrirme paso por el muro.');
    decir(agent, 'Voy a abrirme paso por la roca.');
    const dijo = await correr(w, petId, agent, 6);

    expect(dijo).toContain('Voy a abrirme paso por el muro.');
    expect(dijo).toContain('Voy a abrirme paso por la roca.');
  });

  /**
   * Este mira la cola de habla en vez de hacer correr el mundo: atender un
   * mensaje del cuidador arrastra sus propias consultas al modelo, y el modelo
   * no es lo que se prueba acá. Lo que se prueba es que hablarle limpia la
   * marca de «esto ya lo dije».
   */
  it('y lo mismo dicho DESPUÉS de que el cuidador habla vuelve a salir', () => {
    const { petId } = mundo();
    const agent = makeAgent(petId);
    const cola = (agent as unknown as { pendingSpeech: string[] }).pendingSpeech;
    const frase = 'Tengo frío y no veo nada que dé calor.';

    decir(agent, frase);
    decir(agent, frase); // sola: se traga la segunda
    expect(cola.filter((t) => t === frase)).toHaveLength(1);

    // El cuidador pregunta: contestar lo mismo es contestar, no repetirse.
    // Tragarse esta se leería como que se colgó, que es peor que repetirse.
    agent.receiveUserMessage('¿cómo estás?');
    decir(agent, frase);
    expect(cola.filter((t) => t === frase)).toHaveLength(2);
  });
});
