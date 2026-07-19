import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider } from '@anima/model-providers';
import type { EntityId, WorldState } from '@anima/sim-core';
import {
  allEntities,
  buildPerception,
  canStandAt,
  createWorld,
  perceivedGround,
  spawn,
  stepWorld,
} from '@anima/sim-core';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent } from '../src/index.js';

/**
 * Una obra SÍ se planta sobre el agua, si lo que va encima es un piso.
 *
 * El caso real: el mapa del vado, un río de borde a borde y la comida del otro
 * lado. Ánima inventó las piezas del puente, las fabricó, y armó el puente en
 * el pasto a cinco celdas del agua. No le faltó nada: el elector de sitios daba
 * por intransitable toda celda mojada, sin mirar que la pieza que iba encima
 * era exactamente lo que la vuelve transitable.
 *
 * El motor nunca tuvo el problema (`resolvePlace` no cuenta el agua como
 * ocupante, y `impedimentAt` deja pisar lo que trae `footing`). La regla estaba
 * escrita de nuevo, peor, del lado del que planifica.
 */

class FakeLanguageModel extends MockModelProvider {
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
 * La forma del vado: un río de una celda de ancho partiendo el mundo en dos.
 *
 * `narrowBank` deja la orilla de acá reducida a dos columnas de tierra (x=4 y
 * x=5) contra un farallón, y la para pegada al agua. Sirve para aislar el veto:
 * el único sitio donde la obra entra es el que apoya el tablón en el río.
 *
 * En campo abierto, en cambio, ella arranca LEJOS del agua (x=2), así que el
 * sitio más cercano es tierra firme y elegir el río solo puede venir de haber
 * leído el encargo. Las dos mitades se miden por separado a propósito.
 */
function riverWorld(narrowBank = false): { world: WorldState; petId: EntityId } {
  const world = createWorld({ width: 13, height: 9, seed: 5 });
  const petId = spawn(world, 'pet', {
    position: narrowBank ? { x: 5, y: 4 } : { x: 2, y: 4 },
    collider: { solid: true },
    energy: { current: 50, max: 50, decayPerTick: 0.001 },
    health: { current: 10, max: 10 },
    strength: { value: 2 },
    inventory: { items: [], capacity: 6 },
    agent: { name: 'Anima', perceptionRange: 14 },
  }).id;
  for (let y = 0; y < 9; y++) spawn(world, 'agua', { position: { x: 6, y }, water: {} });
  if (narrowBank) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x <= 3; x++) {
        spawn(world, 'farallon', { position: { x, y }, collider: { solid: true } });
      }
    }
  }
  for (const at of [
    { x: 4, y: 0 },
    { x: 5, y: 0 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
    { x: 4, y: 7 },
    { x: 5, y: 7 },
    { x: 4, y: 8 },
    { x: 5, y: 8 },
  ]) {
    spawn(world, 'log', { position: at, portable: {} });
  }
  return { world, petId };
}

/** El puente como obra: un tablón que se pisa, anclado por un pilote en tierra. */
function teachBridge(world: WorldState): void {
  world.recipes.push({
    id: 'tablon',
    outcomes: [
      {
        weight: 1,
        output: { kind: 'tablon', components: { portable: {}, footing: {} } },
      },
    ],
    ingredients: [{ kind: 'log', count: 1 }],
  });
  world.recipes.push({
    id: 'pilote',
    outcomes: [
      {
        weight: 1,
        output: { kind: 'pilote', components: { portable: {}, collider: { solid: true } } },
      },
    ],
    ingredients: [{ kind: 'log', count: 1 }],
  });
  // El ancla va en tierra (donde ella puede pararse) y el tablón, una celda a
  // la derecha: justo sobre el río. Es la forma que el mapa pide.
  world.blueprints.push({
    id: 'puente',
    placements: [
      { kind: 'tablon', offset: { x: 1, y: 0 } },
      { kind: 'pilote', offset: { x: -1, y: 0 } },
    ],
  });
}

function makeAgent(world: WorldState, petId: EntityId, provider: MockModelProvider) {
  const agent = new AnimaAgent({
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
  return { agent, perception: () => buildPerception(world, petId) };
}

describe('el agua no veta un sitio si lo que va encima es un piso', () => {
  it('planta el tablón SOBRE el río, y el río queda pisable', async () => {
    const { world, petId } = riverWorld(true);
    teachBridge(world);
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'puente' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    agent.receiveUserMessage('construí un puente');

    for (let i = 0; i < 260; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // Lo que importa no es que haya un tablón: es DÓNDE quedó. Antes de esto
    // la obra entera se plantaba en tierra firme y el río seguía intacto.
    const tablones = allEntities(world).filter(
      (e) => e.kind === 'tablon' && e.components.position,
    );
    expect(tablones.length).toBeGreaterThan(0);
    const sobreElRio = tablones.filter((t) => t.components.position!.x === 6);
    expect(sobreElRio.length).toBeGreaterThan(0);

    // Y el efecto, que es lo único que de verdad cuenta: esa celda del río
    // ahora se pisa. Se mide con la función del motor, no con la del agente.
    const cruce = sobreElRio[0]!.components.position!;
    expect(canStandAt(world, cruce)).toBe(true);
  });

  it('una pieza que NO se pisa sigue sin poder plantarse en el agua', async () => {
    const { world, petId } = riverWorld(true);
    teachBridge(world);
    // El mismo plano, pero al revés: al agua manda el pilote, que es sólido y
    // no ofrece dónde pisar. Un puente así no abre ningún paso, y el sitio
    // tiene que seguir vetado — el arreglo abre la puerta al piso, no al agua.
    world.blueprints.length = 0;
    world.blueprints.push({
      id: 'puente',
      placements: [
        { kind: 'pilote', offset: { x: 1, y: 0 } },
        { kind: 'tablon', offset: { x: -1, y: 0 } },
      ],
    });
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'puente' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    agent.receiveUserMessage('construí un puente');

    for (let i = 0; i < 260; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    const enElRio = allEntities(world).filter(
      (e) => e.kind === 'pilote' && e.components.position?.x === 6,
    );
    expect(enElRio.length).toBe(0);
  });
});

describe('el sitio de la obra escucha dónde le pidieron dejarla', () => {
  it('en campo abierto elige el río, no el claro que tiene a los pies', async () => {
    // Sin farallón: la orilla entera está libre y el sitio MÁS CERCANO es el
    // suelo donde ella está parada. Es la corrida real del vado — armó el
    // puente en el pasto, a cinco celdas del agua, y el encargo decía "sobre
    // el agua" en su propio plan.
    const { world, petId } = riverWorld();
    teachBridge(world);
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: {
          action: 'sequence',
          steps: [
            { action: 'craft-item', recipeId: 'puente' },
            { action: 'place-item', targetKind: 'puente', onKind: 'agua' },
          ],
        },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    agent.receiveUserMessage('fabricá un puente, ponelo sobre el agua y cruzá');

    for (let i = 0; i < 260; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    const enElRio = allEntities(world).filter(
      (e) => e.kind === 'tablon' && e.components.position?.x === 6,
    );
    expect(enElRio.length).toBeGreaterThan(0);
    expect(canStandAt(world, enElRio[0]!.components.position!)).toBe(true);
  });

  it('sin destino en el encargo sigue eligiendo lo más cercano', async () => {
    // El sesgo es del ENCARGO, no una atracción por el agua: pedir la obra a
    // secas tiene que seguir plantándola donde está, que es lo barato.
    const { world, petId } = riverWorld();
    teachBridge(world);
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'puente' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    agent.receiveUserMessage('construí un puente');

    for (let i = 0; i < 260; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    const enElRio = allEntities(world).filter(
      (e) => e.kind === 'tablon' && e.components.position?.x === 6,
    );
    expect(enElRio.length).toBe(0);
  });
});

describe('el paso que coloca sobrevive a que le cambien la forma', () => {
  it('«ponelo sobre el agua» no sale a buscar un objeto que dejó de existir', async () => {
    // La corrida real, entera. El encargo se tradujo cuando el puente todavía
    // era una cosa: fabricarlo y ponerlo. Después el juez dijo que un puente es
    // una obra y ella lo rehízo en piezas — y este segundo paso se quedó
    // buscando una entidad "puente" que ya nadie iba a fabricar.
    const { world, petId } = riverWorld();
    teachBridge(world);
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: {
          action: 'sequence',
          steps: [
            { action: 'craft-item', recipeId: 'puente' },
            { action: 'place-item', targetKind: 'puente', onKind: 'agua' },
          ],
        },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    agent.receiveUserMessage('fabricá un puente, ponelo sobre el agua y cruzá');

    for (let i = 0; i < 320; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    // Nunca existió una entidad "puente": el puente es la obra (ADR 0032).
    expect(allEntities(world).some((e) => e.kind === 'puente')).toBe(false);
    // El paso de colocar no murió buscándola: ni un `no-candidates:toPlace`.
    const abortos = agent.events
      .ofType('strategy.failed')
      .map((e) => String((e.data as { reason?: unknown }).reason ?? ''));
    expect(abortos.filter((r) => r.includes('toPlace'))).toEqual([]);
    // Y la obra terminó donde el encargo dijo.
    const enElRio = allEntities(world).filter(
      (e) => e.kind === 'tablon' && e.components.position?.x === 6,
    );
    expect(enElRio.length).toBeGreaterThan(0);
  });
});

describe('lo que se levanta sabe que es parte de una obra', () => {
  it('cada pieza colocada queda marcada con su lugar en el plano', async () => {
    const { world, petId } = riverWorld();
    teachBridge(world);
    const provider = new FakeLanguageModel({
      'interpret.command': {
        kind: 'command.interpretation',
        command: { action: 'craft-item', recipeId: 'puente' },
      },
    });
    const { agent, perception } = makeAgent(world, petId, provider);
    agent.receiveUserMessage('construí un puente');

    for (let i = 0; i < 260; i++) {
      const intent = await agent.think(perception());
      if (intent) agent.observe(stepWorld(world, [{ actorId: petId, intent }]));
    }

    const puestas = allEntities(world).filter(
      (e) => e.components.position && e.components.partOfWork,
    );
    expect(puestas.length).toBeGreaterThan(0);
    for (const pieza of puestas) {
      expect(pieza.components.partOfWork?.blueprintId).toBe('puente');
      // Y el lugar que dice ocupar es un lugar que el plano tiene.
      const cabe = world.blueprints[0]!.placements.some(
        (p) =>
          p.kind === pieza.kind &&
          p.offset.x === pieza.components.partOfWork?.offset.x &&
          p.offset.y === pieza.components.partOfWork?.offset.y,
      );
      expect(cabe).toBe(true);
    }
    // Lo que sigue suelto en el piso no pertenece a nada: la marca es de lo
    // que se PUSO en la obra, no del tipo.
    const sueltas = allEntities(world).filter(
      (e) => e.kind === 'log' && e.components.position && e.components.portable,
    );
    for (const suelta of sueltas) expect(suelta.components.partOfWork).toBeUndefined();
  });
});

describe('el terreno que se ve se lee con la precedencia del motor', () => {
  it('un piso puesto sobre el agua deja de contar como agua', () => {
    const { world, petId } = riverWorld();
    const antes = perceivedGround(buildPerception(world, petId).visibleEntities);
    expect(antes.water.has('6,4')).toBe(true);

    spawn(world, 'tablon', { position: { x: 6, y: 4 }, footing: {} });
    const despues = perceivedGround(buildPerception(world, petId).visibleEntities);
    expect(despues.water.has('6,4')).toBe(false);
    expect(despues.blocked.has('6,4')).toBe(false);
    // Y coincide con lo que el motor aplica al mover, que es el punto entero.
    expect(canStandAt(world, { x: 6, y: 4 })).toBe(true);
  });

  it('lo sólido bloquea, y un piso encima lo cancela igual que en el motor', () => {
    const { world, petId } = riverWorld();
    spawn(world, 'roca', { position: { x: 4, y: 4 }, collider: { solid: true } });
    const antes = perceivedGround(buildPerception(world, petId).visibleEntities);
    expect(antes.blocked.has('4,4')).toBe(true);
    expect(canStandAt(world, { x: 4, y: 4 })).toBe(false);

    spawn(world, 'tablon', { position: { x: 4, y: 4 }, footing: {} });
    const despues = perceivedGround(buildPerception(world, petId).visibleEntities);
    expect(despues.blocked.has('4,4')).toBe(false);
    expect(canStandAt(world, { x: 4, y: 4 })).toBe(true);
  });
});
