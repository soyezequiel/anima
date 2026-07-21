import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/index.js';

const world = (description: string) => ({ kind: 'world' as const, description });
const perception = (description: string) => ({ kind: 'perception' as const, description });

describe('metacognicion general', () => {
  it('distingue desconocimiento de saber que una afirmacion es falsa', () => {
    const memory = new MemoryStore();
    memory.declareUnknown({
      content: 'hay agua detras del muro',
      atTick: 4,
      missingData: ['que hay detras del muro'],
    });
    memory.recordKnowledge({
      content: 'la piedra es comestible',
      status: 'refuted',
      source: world('el mundo rechazo el intento de comerla'),
      confidence: 0.99,
      acquiredAtTick: 5,
    });

    const unknown = memory.assessKnowledge({ content: 'hay agua detras del muro', atTick: 5 });
    const falseClaim = memory.assessKnowledge({ content: 'la piedra es comestible', atTick: 5 });

    expect(unknown.verdict).toBe('unknown');
    expect(unknown.missingData).toEqual(['que hay detras del muro']);
    expect(unknown.resolutionOptions.map((option) => option.kind)).toEqual([
      'ask',
      'observe',
      'experiment',
    ]);
    expect(falseClaim.verdict).toBe('refuted');
    expect(falseClaim.explanation).toContain('es falso');
  });

  it('explica alcance, fuente, evidencia y confianza del conocimiento', () => {
    const memory = new MemoryStore();
    const record = memory.recordKnowledge({
      topic: 'portable',
      content: 'la rama se puede llevar',
      status: 'observed',
      source: perception('la rama estaba al alcance'),
      evidence: [
        {
          supports: true,
          description: 'pude recoger e17',
          source: world('accion item.pickedUp'),
          atTick: 12,
        },
      ],
      confidence: 1,
      acquiredAtTick: 12,
      scope: { kind: 'type', typeId: 'branch' },
    });

    expect(record.scope).toEqual({ kind: 'type', typeId: 'branch' });
    expect(memory.explainKnowledge(record)).toContain('pude recoger e17');
    expect(
      memory.assessKnowledge({
        topic: 'portable',
        scope: { kind: 'type', typeId: 'branch' },
        atTick: 12,
      }).verdict,
    ).toBe('supported');
  });

  it('revisa una creencia cuando una observacion del mundo la contradice', () => {
    const memory = new MemoryStore();
    memory.recordKnowledge({
      content: 'el puente sigue entero',
      status: 'learned',
      source: { kind: 'experience', description: 'lo cruce antes' },
      confidence: 0.8,
      acquiredAtTick: 10,
      scope: { kind: 'entity', entityId: 'bridge-1' },
    });
    const revised = memory.recordKnowledge({
      content: 'el puente sigue entero',
      status: 'refuted',
      source: world('el puente fue destruido'),
      confidence: 1,
      acquiredAtTick: 20,
      scope: { kind: 'entity', entityId: 'bridge-1' },
    });

    expect(revised.status).toBe('refuted');
    expect(revised.revisions.at(-1)?.previousStatus).toBe('learned');
    expect(revised.evidence.some((item) => item.supports === false)).toBe(true);
  });

  it('marca como desactualizado un dato caduco y pide una observacion nueva', () => {
    const memory = new MemoryStore();
    memory.recordKnowledge({
      topic: 'position',
      content: 'la comida e8 esta en (3,4)',
      status: 'observed',
      source: perception('vista directa'),
      confidence: 1,
      acquiredAtTick: 10,
      expiresAtTick: 15,
      scope: { kind: 'entity', entityId: 'e8' },
    });

    const current = memory.assessKnowledge({
      topic: 'position',
      scope: { kind: 'entity', entityId: 'e8' },
      atTick: 15,
    });
    const stale = memory.assessKnowledge({
      topic: 'position',
      scope: { kind: 'entity', entityId: 'e8' },
      atTick: 16,
    });

    expect(current.verdict).toBe('supported');
    expect(stale.verdict).toBe('stale');
    expect(stale.missingData).toContain('una observacion actual de la comida e8 esta en (3,4)');
  });

  it('nunca promociona la salida de un modelo a hecho', () => {
    const memory = new MemoryStore();
    const record = memory.recordKnowledge({
      content: 'las nubes anuncian comida',
      status: 'learned',
      source: { kind: 'model', description: 'una respuesta plausible del LLM' },
      confidence: 0.95,
      acquiredAtTick: 1,
    });

    expect(record.status).toBe('hypothetical');
    expect(memory.assessKnowledge({ content: record.content }).verdict).toBe('hypothetical');
    expect(memory.explainKnowledge(record)).toContain('evidencia aun es insuficiente');
  });

  it('persiste el registro y migra guardados anteriores', () => {
    const memory = new MemoryStore();
    memory.addFact('el fuego da calor', 3);
    const data = memory.serialize();
    const restored = new MemoryStore();
    restored.loadFrom(data);
    expect(restored.knowledgeList()).toEqual(memory.knowledgeList());

    const legacy = structuredClone(data);
    delete legacy.knowledge;
    const migrated = new MemoryStore();
    migrated.loadFrom(legacy);
    expect(migrated.assessKnowledge({ content: 'el fuego da calor' }).verdict).toBe('supported');
  });
});
