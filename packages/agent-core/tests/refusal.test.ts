import { describe, expect, it } from 'vitest';
import type { Perception, Recipe } from '@anima/sim-core';
import { MemoryStore } from '@anima/memory';
import type { Goal } from '../src/index.js';
import { evaluateUserRequest, isContinuationMessage, parseUserMessage } from '../src/index.js';

function perceptionWith(
  overrides: Partial<Perception['self']> = {},
  visible: Perception['visibleEntities'] = [],
): Perception {
  return {
    tick: 10,
    self: {
      id: 'e1',
      position: { x: 1, y: 1 },
      energy: { current: 30, max: 50 },
      heldItems: [],
      ...overrides,
    },
    visibleEntities: visible,
    recipes: [],
    interactions: [],
  };
}

const idleGoal: Goal = {
  id: 'goal-1',
  description: 'recuperar energía',
  source: 'internal-signal',
  priority: 0.9,
  urgency: 0.8,
  expectedValue: 1,
  status: 'active',
  createdAtTick: 0,
  preconditions: [],
  successCriteria: [],
  failureCriteria: [],
};

describe('negativas y autonomía', () => {
  /** Una herramienta a la vista: sin ella la negativa sería "no puedo". */
  const hammer = { id: 'e8', kind: 'hammer', position: { x: 1, y: 2 }, toolPower: 8 };

  it('will_not: se niega a destruir lo que cree necesitar, con alternativa', () => {
    const decision = evaluateUserRequest(
      { kind: 'destroy-entity', targetKind: 'food', raw: 'destruye la comida' },
      // Ve la comida y tiene con qué: puede. La negativa es de valores, que es
      // lo único que un will_not debe significar (ADR 0019).
      perceptionWith({}, [
        { id: 'e9', kind: 'food', position: { x: 2, y: 2 }, edible: true },
        hammer,
      ]),
      new MemoryStore(),
      undefined,
    );
    expect(decision.classification).toBe('will_not');
    expect(decision.reason).toContain('necesito');
    expect(decision.alternative).toBeDefined();
  });

  it('will_not usa conocimiento aprendido (el árbol produce alimento)', () => {
    const memory = new MemoryStore();
    memory.addFact('el tree produce alimento que recupera energía', 5);
    const decision = evaluateUserRequest(
      { kind: 'destroy-entity', targetKind: 'tree', raw: 'destruye el árbol' },
      perceptionWith({}, [
        { id: 'e9', kind: 'tree', position: { x: 2, y: 2 }, solid: true },
        hammer,
      ]),
      memory,
      undefined,
    );
    expect(decision.classification).toBe('will_not');
  });

  it('los hechos van antes que los valores: sin ver el árbol, no hay nada que querer', () => {
    // Antes devolvía "no quiero" sin haber mirado si lo veía: un will_not que
    // no significaba "puedo pero no quiero" dejaba entrar al juicio de valores
    // a autorizar imposibles.
    const decision = evaluateUserRequest(
      { kind: 'destroy-entity', targetKind: 'tree', raw: 'tala el árbol' },
      perceptionWith({}, [hammer]),
      new MemoryStore(),
      undefined,
    );
    expect(decision.classification).toBe('needs_information');
  });

  it('sin herramienta la negativa es "no puedo", no "no quiero"', () => {
    const decision = evaluateUserRequest(
      { kind: 'destroy-entity', targetKind: 'tree', raw: 'tala el árbol' },
      perceptionWith({}, [{ id: 'e9', kind: 'tree', position: { x: 2, y: 2 }, solid: true }]),
      new MemoryStore(),
      undefined,
    );
    expect(decision.classification).toBe('cannot');
  });

  it('cannot: sin herramientas no puede destruir un muro', () => {
    const decision = evaluateUserRequest(
      { kind: 'destroy-entity', targetKind: 'wall', raw: 'rompe el muro' },
      perceptionWith({}, [
        { id: 'e5', kind: 'wall', position: { x: 3, y: 1 }, solid: true, hardness: 5 },
      ]),
      new MemoryStore(),
      undefined,
    );
    expect(decision.classification).toBe('cannot');
    expect(decision.alternative).toContain('herramienta');
  });

  it('not_now: con energía crítica pospone peticiones no relacionadas', () => {
    const decision = evaluateUserRequest(
      { kind: 'fetch-item', targetKind: 'branch', raw: 'trae una rama' },
      perceptionWith({ energy: { current: 5, max: 50 } }, [
        { id: 'e4', kind: 'branch', position: { x: 2, y: 1 }, portable: true, toolPower: 1 },
      ]),
      new MemoryStore(),
      idleGoal,
    );
    expect(decision.classification).toBe('not_now');
    expect(decision.alternative).toBeDefined();
  });

  it('lo que no ve, lo va a buscar: acepta anunciando que recorre el mapa', () => {
    // Antes esto era needs_information («No sé dónde encontrar martillo»):
    // devolverle al cuidador el trabajo de señalar con el dedo. Ahora los
    // programas de pedidos exploran hasta ver lo que buscan, así que la
    // respuesta honesta es aceptar y salir a mirar.
    const decision = evaluateUserRequest(
      { kind: 'fetch-item', targetKind: 'hammer', raw: 'trae un martillo' },
      perceptionWith(),
      new MemoryStore(),
      undefined,
    );
    expect(decision.classification).toBe('accepted');
    expect(decision.reason).toContain('recorrer el mapa');
  });

  it('accepted: acepta lo que puede y quiere hacer', () => {
    const decision = evaluateUserRequest(
      { kind: 'wait-here', raw: 'espera aquí' },
      perceptionWith(),
      new MemoryStore(),
      undefined,
    );
    expect(decision.classification).toBe('accepted');
  });
});

describe('construir juntando lo que falta', () => {
  const CHAIR: Recipe = {
    id: 'chair',
    outcomes: [{ weight: 1, output: { kind: 'chair', components: { collider: { solid: true } } } }],
    ingredients: [{ kind: 'log', count: 2 }],
  };
  const order = { kind: 'craft-item', recipeId: 'chair', raw: 'construí una silla' } as const;

  it('con los materiales a la vista acepta: los junta y construye', () => {
    const perception: Perception = {
      ...perceptionWith({}, [
        { id: 'e5', kind: 'log', position: { x: 2, y: 1 }, portable: true },
        { id: 'e6', kind: 'log', position: { x: 3, y: 2 }, portable: true },
      ]),
      recipes: [CHAIR],
    };
    const decision = evaluateUserRequest(order, perception, new MemoryStore(), undefined);
    expect(decision.classification).toBe('accepted');
    expect(decision.reason).toContain('me faltan 2 troncos');
    expect(decision.alternative).toContain('los junto y la construyo');
  });

  it('sin los materiales a la vista la negativa sigue siendo honesta', () => {
    const perception: Perception = { ...perceptionWith({}, []), recipes: [CHAIR] };
    const decision = evaluateUserRequest(order, perception, new MemoryStore(), undefined);
    expect(decision.classification).toBe('cannot');
    expect(decision.alternative).toBe('Si me consigues 2 troncos, la construyo.');
  });

  it('si lo visible no alcanza, dice que no alcanza (no promete de más)', () => {
    const perception: Perception = {
      ...perceptionWith({}, [{ id: 'e5', kind: 'log', position: { x: 2, y: 1 }, portable: true }]),
      recipes: [CHAIR],
    };
    const decision = evaluateUserRequest(order, perception, new MemoryStore(), undefined);
    expect(decision.classification).toBe('cannot');
    expect(decision.alternative).toContain('no alcanza para todo');
  });
});

describe('cantidades y continuación', () => {
  it('extrae cuántas unidades pide una orden de buscar', () => {
    expect(parseUserMessage('trae 2 troncos')).toMatchObject({
      kind: 'fetch-item',
      targetKind: 'log',
      amount: 2,
    });
    expect(parseUserMessage('conseguí los dos troncos')).toMatchObject({
      kind: 'fetch-item',
      targetKind: 'log',
      amount: 2,
    });
    // Sin cantidad explícita no se inventa una.
    const single = parseUserMessage('trae un tronco');
    expect(single).toMatchObject({ kind: 'fetch-item', targetKind: 'log' });
    expect('amount' in single).toBe(false);
    // "conseguilos" es buscar aunque no diga qué: el contexto lo completa.
    expect(parseUserMessage('conseguilos')).toMatchObject({
      kind: 'fetch-item',
      targetKind: 'unknown',
    });
  });

  it('reconoce "continua" y variantes sin confundirlas con órdenes', () => {
    expect(isContinuationMessage('continua')).toBe(true);
    expect(isContinuationMessage('continuá')).toBe(true);
    expect(isContinuationMessage('seguí')).toBe(true);
    expect(isContinuationMessage('dale')).toBe(true);
    expect(isContinuationMessage('hacelo igual')).toBe(true);
    expect(isContinuationMessage('otra vez!')).toBe(true);
    // Contienen palabras de continuación pero son otra cosa.
    expect(isContinuationMessage('sigue derecho hacia arriba')).toBe(false);
    expect(isContinuationMessage('y la silla?')).toBe(false);
    expect(isContinuationMessage('continua buscando troncos por el bosque')).toBe(false);
  });
});

describe('parser mínimo de mensajes', () => {
  it('clasifica peticiones y explicaciones', () => {
    expect(parseUserMessage('destruye el muro').kind).toBe('destroy-entity');
    expect(parseUserMessage('trae comida').kind).toBe('fetch-item');
    expect(parseUserMessage('tala el árbol').kind).toBe('destroy-entity');
    expect(parseUserMessage('quiero que tales el árbol')).toMatchObject({
      kind: 'destroy-entity',
      targetKind: 'tree',
    });
    expect(parseUserMessage('intenta talar el árbol con el hammer')).toMatchObject({
      kind: 'destroy-entity',
      targetKind: 'tree',
    });
    expect(parseUserMessage('come esa manzana').kind).toBe('consume-item');
    expect(parseUserMessage('come')).toMatchObject({
      kind: 'consume-item',
      targetKind: 'unknown',
    });
    expect(parseUserMessage('espera aquí').kind).toBe('wait-here');
    expect(parseUserMessage('andate arriba a la izquierda')).toMatchObject({
      kind: 'move-direction',
      directions: ['up', 'left'],
    });
    expect(parseUserMessage('movete arriba a la izquierda')).toMatchObject({
      kind: 'move-direction',
      directions: ['up', 'left'],
    });
    expect(parseUserMessage('caminá para la derecha')).toMatchObject({
      kind: 'move-direction',
      directions: ['right'],
    });
    expect(parseUserMessage('comer alimento da energía').kind).toBe('explanation');
    expect(parseUserMessage('cuando comes alimento recuperas energía').kind).toBe('explanation');
    expect(parseUserMessage('hola').kind).toBe('unknown');
    expect(parseUserMessage('xyzzy').kind).toBe('unknown');
  });
});
