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
 * ADR 0049. La obra tiene un SITIO, elegido antes de empezar y libre de cosas.
 *
 * Antes el ancla era «donde esté parada al arrancar»: la obra se replantaba en
 * cada reanudación, y la cuenta de lo que faltaba miraba solo el inventario. Se
 * la vio con 4 muros en la mano y 2 ya colocados diciendo «no pude reunir 1
 * muro» —cuando le sobraban— y repitiéndolo cada cincuenta ticks para siempre:
 * el programa exigía tener las 5 piezas en la mano a la vez, que con capacidad
 * 6 y un martillo encima es imposible.
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

function siteWorld(options: { loose?: number; clutter?: boolean } = {}): {
  world: WorldState;
  petId: EntityId;
} {
  const world = createWorld({ width: 14, height: 9, seed: 2 }, { blueprints: [HUT] });
  const petId = spawn(world, 'pet', {
    position: { x: 2, y: 4 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 14 },
  }).id;
  for (let i = 0; i < (options.loose ?? 3); i++) {
    spawn(world, 'wall', {
      position: { x: 4 + i, y: 7 },
      portable: {},
      hardness: { value: 1 },
      durability: { current: 4, max: 4 },
    });
  }
  if (options.clutter) {
    // Rocas justo alrededor de la mascota: el sitio de al lado no sirve y hay
    // que buscar un claro más lejos.
    for (const pos of [
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ]) {
      spawn(world, 'rock', { position: pos, collider: { solid: true }, hardness: { value: 9 } });
    }
  }
  return { world, petId };
}

function makeAgent(petId: EntityId) {
  const provider = new ScriptedModelProvider([INTERPRET_BUILD], { interpretsLanguage: true });
  const agent = new AnimaAgent({
    petId,
    petName: 'Anima',
    provider,
    library: new SkillLibrary(),
    regressions: new RegressionStore(),
    evaluationScenarios: MVP_SCENARIOS,
    warmthScenarios: COLD_SCENARIOS,
    evaluationSeeds: [11],
    guidanceEnabled: false,
    now: () => '2026-07-18T00:00:00Z',
  });
  return { agent };
}

async function run(
  w: WorldState,
  petId: EntityId,
  agent: AnimaAgent,
  ticks: number,
): Promise<string[]> {
  const said: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const intent = await agent.think(buildPerception(w, petId));
    if (intent?.type === 'speak') said.push(intent.text);
    agent.observe(stepWorld(w, intent ? [{ actorId: petId, intent }] : []));
  }
  return said;
}

describe('la obra tiene un sitio, elegido y libre (ADR 0049)', () => {
  it('no planta la obra sobre nada que pueda ver, y siempre dentro del mapa', async () => {
    const { world: w, petId } = siteWorld({ clutter: true });
    const { agent } = makeAgent(petId);

    agent.receiveUserMessage('construí una choza');
    await run(w, petId, agent, 20);

    const perception = buildPerception(w, petId);
    const planned = agent.plannedStructures(perception);
    expect(planned).toHaveLength(1);
    // La garantía es sobre lo que VE: la vista exige línea despejada (ADR
    // 0025), así que una roca detrás de otra no está en el mapa que miró. Al
    // acercarse aparece y el sitio se revalida — lo que no puede pasar es
    // plantarla encima de algo que tiene delante de los ojos.
    const visiblesOcupadas = new Set(
      perception.visibleEntities
        .filter((e) => e.solid === true && e.position)
        .map((e) => `${e.position!.x},${e.position!.y}`),
    );
    for (const cell of planned[0]!.cells) {
      expect(visiblesOcupadas.has(`${cell.x},${cell.y}`)).toBe(false);
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThan(14);
      expect(cell.y).toBeLessThan(9);
    }
  });

  it('el sitio no se muda mientras la obra está abierta', async () => {
    const { world: w, petId } = siteWorld();
    const { agent } = makeAgent(petId);

    agent.receiveUserMessage('construí una choza');
    // Se muestrea mientras camina y construye. No se puede mirar un tick fijo:
    // según lo que tarde en juntar, a esa altura la obra puede estar terminada
    // y entonces ya no hay plano que comparar.
    const muestras: string[] = [];
    for (let i = 0; i < 12; i++) {
      await run(w, petId, agent, 5);
      const plan = agent.plannedStructures(buildPerception(w, petId))[0];
      if (plan) muestras.push(plan.cells.map((c) => `${c.x},${c.y}`).sort().join('|'));
    }

    expect(muestras.length).toBeGreaterThan(1);
    // Todas las muestras describen el MISMO sitio: la obra no se mudó de lugar
    // mientras iba y venía a buscar material.
    expect(new Set(muestras).size).toBe(1);
  });

  it('lo ya colocado deja de pedirse: la obra avanza en vez de trabarse', async () => {
    const { world: w, petId } = siteWorld();
    const { agent } = makeAgent(petId);

    agent.receiveUserMessage('construí una choza');
    const said = await run(w, petId, agent, 200);

    const planned = agent.plannedStructures(buildPerception(w, petId));
    // O la terminó (no queda plano abierto) o al menos puso algo: lo que NO
    // puede pasar es quedarse en cero pidiendo las tres piezas para siempre.
    const puestos = planned[0]?.cells.filter((c) => c.done).length ?? HUT.placements.length;
    expect(puestos).toBeGreaterThan(0);
    // Y si dijo que le faltaba algo, nunca pidió más de lo que el plano pide.
    const falta = said.find((t) => t.includes('no pude reunir'));
    if (falta) expect(falta).not.toContain('3 muros');
  });

  it('con la mochila llena coloca lo que lleva para hacerse lugar', async () => {
    // El caso reportado: 4 muros + pizarrón + martillo = 6 de 6, y le falta un
    // muro más. Ir a buscarlo es imposible porque no entra. Antes juntaba la
    // tanda entera ANTES de colocar, así que no colocaba nada y repetía "no
    // pude reunir 1 muro" para siempre. Colocar lo que lleva libera ranuras.
    const w = createWorld({ width: 14, height: 9, seed: 2 }, { blueprints: [HUT] });
    const petId = spawn(w, 'pet', {
      position: { x: 6, y: 4 },
      collider: { solid: true },
      energy: { current: 48, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      strength: { value: 2 },
      inventory: { items: [], capacity: 3 },
      agent: { name: 'Anima', perceptionRange: 14 },
    }).id;
    // Manos llenas: dos muros de los tres que pide la choza, más el martillo.
    for (const comps of [
      { portable: {}, tool: { power: 8 }, durability: { current: 20, max: 20 } },
      { portable: {}, hardness: { value: 1 }, durability: { current: 4, max: 4 } },
      { portable: {}, hardness: { value: 1 }, durability: { current: 4, max: 4 } },
    ] as const) {
      const kind = 'tool' in comps ? 'hammer' : 'wall';
      const e = spawn(w, kind, comps as never);
      delete e.components.position;
      w.entities[petId]!.components.inventory!.items.push(e.id);
    }
    // El tercer muro, tirado lejos: solo lo alcanza si primero hace lugar.
    spawn(w, 'wall', {
      position: { x: 10, y: 7 },
      portable: {},
      hardness: { value: 1 },
      durability: { current: 4, max: 4 },
    });

    const { agent } = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');
    await run(w, petId, agent, 250);

    const puestos = Object.values(w.entities).filter(
      (e) => e.kind === 'wall' && e.components.position && !e.components.portable,
    ).length;
    const plan = agent.plannedStructures(buildPerception(w, petId))[0];
    const hechas = plan?.cells.filter((c) => c.done).length ?? HUT.placements.length;
    // Lo que importa: descargó y avanzó. Antes quedaba en cero para siempre.
    expect(hechas).toBeGreaterThanOrEqual(2);
    expect(puestos + hechas).toBeGreaterThan(0);
  });

  it('la vista del plan distingue lo puesto de lo pendiente', async () => {
    const { world: w, petId } = siteWorld();
    const { agent } = makeAgent(petId);

    agent.receiveUserMessage('construí una choza');
    await run(w, petId, agent, 200);

    const planned = agent.plannedStructures(buildPerception(w, petId));
    if (planned.length === 0) return; // la terminó: no queda nada que dibujar
    for (const cell of planned[0]!.cells) {
      const real = Object.values(w.entities).some(
        (e) =>
          e.kind === cell.kind &&
          e.components.position?.x === cell.x &&
          e.components.position.y === cell.y,
      );
      // `done` no es decorativo: dice si en esa celda hay de verdad un bloque.
      expect(cell.done).toBe(real);
    }
  });
});
