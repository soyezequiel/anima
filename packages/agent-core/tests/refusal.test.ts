import { describe, expect, it } from 'vitest';
import type { Perception } from '@anima/sim-core';
import { MemoryStore } from '@anima/memory';
import type { Goal } from '../src/index.js';
import { evaluateUserRequest, parseUserMessage } from '../src/index.js';

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
  it('will_not: se niega a destruir lo que cree necesitar, con alternativa', () => {
    const decision = evaluateUserRequest(
      { kind: 'destroy-entity', targetKind: 'food', raw: 'destruye la comida' },
      perceptionWith(),
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
      perceptionWith({}, [{ id: 'e9', kind: 'tree', position: { x: 2, y: 2 }, solid: true }]),
      memory,
      undefined,
    );
    expect(decision.classification).toBe('will_not');
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

  it('needs_information: no sabe dónde encontrar lo que le piden', () => {
    const decision = evaluateUserRequest(
      { kind: 'fetch-item', targetKind: 'hammer', raw: 'trae un martillo' },
      perceptionWith(),
      new MemoryStore(),
      undefined,
    );
    expect(decision.classification).toBe('needs_information');
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
