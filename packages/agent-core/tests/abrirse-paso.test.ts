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
 * ADR 0066. «No hay» y «hay pero no llego» no son lo mismo.
 *
 * Partida real, mapa de 13×7: una columna de muro de (5,0) a (5,6) —sin una
 * sola abertura— partía el mundo en dos. Ella de un lado; TODA la madera del
 * mundo (dos troncos y tres árboles) del otro.
 *
 * Podía reintentar y explorar para siempre: de su lado no había nada que
 * encontrar. Y como el fallo se leía como «falta materia», nunca intentaba lo
 * único que resolvía el problema — romper la pared, que además ya sabía hacer.
 */

const HUT: Blueprint = {
  id: 'choza',
  placements: [
    { kind: 'muro-aula', offset: { x: 0, y: -1 } },
    { kind: 'muro-aula', offset: { x: 0, y: 1 } },
  ],
};

const WALL_RECIPE = {
  id: 'muro-aula',
  ingredients: [{ kind: 'log', count: 1 }],
  outcomes: [
    {
      weight: 1,
      output: { kind: 'muro-aula', components: { portable: {}, collider: { solid: true } } },
    },
  ],
};

const INTERPRET_BUILD: ModelResponse = {
  kind: 'command.interpretation',
  command: { action: 'craft-item', recipeId: 'choza' },
};

/** El mapa del cuidador: tapiada de un lado, la madera del otro. */
function walledWorld(): { world: WorldState; petId: EntityId } {
  const world = createWorld(
    { width: 13, height: 7, seed: 5 },
    { recipes: [WALL_RECIPE], blueprints: [HUT] },
  );
  const petId = spawn(world, 'pet', {
    position: { x: 2, y: 3 },
    collider: { solid: true },
    energy: { current: 48, max: 50, decayPerTick: 0.01 },
    health: { current: 10, max: 10 },
    strength: { value: 3 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 13 },
  }).id;
  // Un martillo de su lado: tiene con qué, si se le ocurre.
  spawn(world, 'hammer', { position: { x: 3, y: 3 }, portable: {}, tool: { power: 8 } });
  // La columna sin abertura.
  for (let y = 0; y < 7; y++) {
    spawn(world, 'wall', {
      position: { x: 5, y },
      collider: { solid: true },
      hardness: { value: 2 },
      durability: { current: 6, max: 6 },
    });
  }
  // Toda la madera, del otro lado.
  spawn(world, 'log', { position: { x: 11, y: 2 }, portable: {} });
  spawn(world, 'log', { position: { x: 8, y: 5 }, portable: {} });
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

describe('cuando lo que falta es camino, se abre paso (ADR 0066)', () => {
  it('rompe la pared que la encierra y termina la obra con la madera del otro lado', async () => {
    const { world, petId } = walledWorld();
    const agent = makeAgent(petId);
    const pet = world.entities[petId]!;
    agent.receiveUserMessage('construí una choza');

    const murosDePiedra = () =>
      Object.values(world.entities).filter((e) => e.kind === 'wall' && e.components.position).length;
    const obraEnPie = () =>
      Object.values(world.entities).filter(
        (e) => e.kind === 'muro-aula' && e.components.position,
      ).length;

    // Se mide lo más lejos que LLEGÓ, no dónde terminó: vuelve al sitio de la
    // obra a colocar, así que su posición final no dice nada del viaje.
    let lejosQueLlego = pet.components.position!.x;
    for (let i = 0; i < 1200 && obraEnPie() < 2; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
      lejosQueLlego = Math.max(lejosQueLlego, pet.components.position!.x);
    }

    // Abrió un hueco en la columna...
    expect(murosDePiedra()).toBeLessThan(7);
    // ...cruzó al otro lado a buscar la madera...
    expect(lejosQueLlego).toBeGreaterThan(5);
    // ...y la obra quedó levantada.
    expect(obraEnPie()).toBe(2);
  });

  it('lo dice antes de hacerlo: romper algo no es una decisión silenciosa', async () => {
    const { world, petId } = walledWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');

    const dicho: string[] = [];
    for (let i = 0; i < 400; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') dicho.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    expect(dicho.some((t) => t.includes('abrirme paso'))).toBe(true);
  });

  it('no se abre paso rompiendo su propia obra', async () => {
    const { world, petId } = walledWorld();
    const agent = makeAgent(petId);
    // Un bloque de SU plano, sólido y a mano: el candidato más blando y cercano
    // si no estuviera protegido.
    spawn(world, 'muro-aula', {
      position: { x: 2, y: 2 },
      collider: { solid: true },
      hardness: { value: 1 },
      durability: { current: 4, max: 4 },
    });
    agent.receiveUserMessage('construí una choza');

    const dicho: string[] = [];
    for (let i = 0; i < 400; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') dicho.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    // Se abre paso, pero nunca por lo que ella misma levanta.
    expect(dicho.some((t) => t.includes('abrirme paso por el muro aula'))).toBe(false);
  });
});

/**
 * ADR 0067. Abrirse paso tiene un tope, y lo imposible se dice.
 *
 * Partida real: una COCINA cuyas piezas pedían `tabla-de-ramas`, y la tabla
 * pedía RAMAS. En ese mundo el árbol da troncos, el arbusto fibra, la roca
 * piedra — nada da ramas. Gastadas las tres iniciales, la cocina quedó
 * imposible para siempre. Y ella siguió rompiendo paredes en serie «buscando
 * una encimera»: un bloque que se FABRICA, que jamás iba a estar tirado detrás
 * de un muro.
 */
describe('lo que no se puede, se dice y se deja de romper (ADR 0067)', () => {
  const TABLA = {
    id: 'tabla',
    ingredients: [{ kind: 'branch', count: 2 }],
    outcomes: [{ weight: 1, output: { kind: 'tabla', components: { portable: {} } } }],
  };
  const MESADA: Blueprint = {
    id: 'cocina',
    placements: [{ kind: 'tabla', offset: { x: 0, y: -1 } }],
  };
  const PEDIR_COCINA: ModelResponse = {
    kind: 'command.interpretation',
    command: { action: 'craft-item', recipeId: 'cocina' },
  };

  /**
   * Agente propio: el `makeAgent` de arriba guiona la interpretación de una
   * CHOZA, y con él estos casos construían otra cosa —y pasaban sin probar
   * nada—. La interpretación guionada tiene que ser la del encargo bajo prueba.
   */
  function makeKitchenAgent(petId: EntityId) {
    return new AnimaAgent({
      petId,
      petName: 'Anima',
      provider: new ScriptedModelProvider([PEDIR_COCINA], { interpretsLanguage: true }),
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      warmthScenarios: COLD_SCENARIOS,
      evaluationSeeds: [11],
      guidanceEnabled: false,
      now: () => '2026-07-18T00:00:00Z',
    });
  }

  /** Mundo sin ramas y sin nada que las deje: la cocina es imposible. */
  function kitchenWorld(): { world: WorldState; petId: EntityId } {
    const world = createWorld(
      { width: 13, height: 7, seed: 5 },
      { recipes: [TABLA], blueprints: [MESADA] },
    );
    const petId = spawn(world, 'pet', {
      position: { x: 2, y: 3 },
      collider: { solid: true },
      energy: { current: 48, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      strength: { value: 3 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Anima', perceptionRange: 13 },
    }).id;
    spawn(world, 'hammer', { position: { x: 3, y: 3 }, portable: {}, tool: { power: 8 } });
    for (let y = 0; y < 7; y++) {
      spawn(world, 'wall', {
        position: { x: 5, y },
        collider: { solid: true },
        hardness: { value: 1 },
        durability: { current: 4, max: 4 },
      });
    }
    return { world, petId };
  }

  it('no rompe el mundo sin fin: las aperturas tienen tope', async () => {
    const { world, petId } = kitchenWorld();
    const agent = makeKitchenAgent(petId);
    agent.receiveUserMessage('creá una cocina');

    for (let i = 0; i < 2000; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    const aperturas = agent.events
      .ofType('strategy.selected')
      .filter((e) => String(e.data.strategy).startsWith('abrir-paso'));
    // Unas pocas para intentar cruzar; nunca una demolición en serie.
    expect(aperturas.length).toBeLessThanOrEqual(3);
  });

  it('busca la materia BASE, no los bloques que ella misma fabrica', async () => {
    const { world, petId } = kitchenWorld();
    const agent = makeKitchenAgent(petId);
    agent.receiveUserMessage('creá una cocina');

    const dicho: string[] = [];
    for (let i = 0; i < 600; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') dicho.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    const aperturas = dicho.filter((t) => t.includes('abrirme paso'));
    // Si sale a buscar, busca RAMAS —lo que de verdad podría estar del otro
    // lado— y no «una tabla», que no aparece tirada porque se fabrica.
    for (const t of aperturas) expect(t).not.toContain('tabla');
  });

  it('no se queja: PIDE la materia base, con cantidad, y promete retomarlo', async () => {
    const { world, petId } = kitchenWorld();
    const agent = makeKitchenAgent(petId);
    agent.receiveUserMessage('creá una cocina');

    const dicho: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') dicho.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    const aviso = dicho.find((t) => t.includes('¿me conseguís'));
    expect(aviso).toBeDefined();
    // Pide la materia BASE con cantidad —lo único que el cuidador puede
    // traerle— y no la pieza intermedia, que no se consigue sino que se hace.
    expect(aviso).toMatch(/¿me conseguís .*\d+ ramas?/);
    expect(aviso).not.toContain('tablas');
    // Y sigue siendo un «queda pendiente», no un fracaso.
    expect(aviso).toContain('Lo retomo apenas lo tenga');
    // El pedido no se repite en cada reintento: sería ruido.
    expect(dicho.filter((t) => t.includes('¿me conseguís'))).toHaveLength(1);
  });
});

/**
 * ADR 0068. Lo que no puede conseguir, lo PIDE.
 *
 * Antes contaba el problema y se quedaba esperando. Contar no es pedir, y el
 * cuidador no tenía qué hacer con «me faltan 3 encimeras»: las encimeras no se
 * consiguen, se fabrican. Lo que él puede traer es la materia base — y con
 * cantidad, para saber cuánta.
 */
describe('lo que no puede conseguir, lo pide (ADR 0068)', () => {
  it('pide solo lo imposible, no lo que puede juntar sola', async () => {
    // Cocina de ramas (nada las da) + fibra (el arbusto sí la da). Pedir las
    // dos sería pedir de más: la fibra la consigue ella.
    const TABLA = {
      id: 'tabla',
      ingredients: [
        { kind: 'branch', count: 2 },
        { kind: 'fiber', count: 1 },
      ],
      outcomes: [{ weight: 1, output: { kind: 'tabla', components: { portable: {} } } }],
    };
    const COCINA: Blueprint = { id: 'cocina', placements: [{ kind: 'tabla', offset: { x: 0, y: -1 } }] };
    const world = createWorld(
      { width: 11, height: 7, seed: 3 },
      { recipes: [TABLA], blueprints: [COCINA] },
    );
    const petId = spawn(world, 'pet', {
      position: { x: 2, y: 3 },
      collider: { solid: true },
      energy: { current: 48, max: 50, decayPerTick: 0.01 },
      health: { current: 10, max: 10 },
      strength: { value: 3 },
      inventory: { items: [], capacity: 6 },
      agent: { name: 'Anima', perceptionRange: 11 },
    }).id;
    // Un arbusto a la vista: la fibra tiene de dónde salir. Ramas, ninguna.
    spawn(world, 'bush', {
      position: { x: 4, y: 3 },
      hardness: { value: 1 },
      durability: { current: 3, max: 3 },
      drops: [{ kind: 'fiber', components: { portable: {} } }],
    });
    const agent = new AnimaAgent({
      petId,
      petName: 'Anima',
      provider: new ScriptedModelProvider(
        [{ kind: 'command.interpretation', command: { action: 'craft-item', recipeId: 'cocina' } }],
        { interpretsLanguage: true },
      ),
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      warmthScenarios: COLD_SCENARIOS,
      evaluationSeeds: [11],
      guidanceEnabled: false,
      now: () => '2026-07-18T00:00:00Z',
    });
    agent.receiveUserMessage('creá una cocina');

    const dicho: string[] = [];
    for (let i = 0; i < 1500; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      if (intent?.type === 'speak') dicho.push(intent.text);
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    const pedido = dicho.find((t) => t.includes('¿me conseguís'));
    expect(pedido).toBeDefined();
    expect(pedido).toContain('ramas');
    // La fibra NO se pide: sale de un arbusto que ella ve y puede romper.
    expect(pedido).not.toContain('fibra');
    expect(agent.events.ofType('help.requested').length).toBeGreaterThan(0);
  });

  it('el tope de aperturas sobrevive a la recarga', async () => {
    // El mundo tapiado de siempre, pero pidiendo la choza: lo que importa acá
    // es que se abra paso al menos una vez y que la cuenta viaje al guardado.
    const { world, petId } = walledWorld();
    const agent = makeAgent(petId);
    agent.receiveUserMessage('construí una choza');
    for (let i = 0; i < 400; i++) {
      const intent = await agent.think(buildPerception(world, petId));
      agent.observe(stepWorld(world, intent ? [{ actorId: petId, intent }] : []));
    }

    // Un tope que se olvida al recargar no es un tope: cinco recargas serían
    // cinco veces el presupuesto de demolición.
    const guardado = agent.exportState();
    expect(guardado.pathOpenings?.[0]?.count).toBeGreaterThan(0);
    const otro = makeAgent(petId);
    otro.importState(guardado);
    expect(otro.exportState().pathOpenings).toEqual(guardado.pathOpenings);
  });
});
