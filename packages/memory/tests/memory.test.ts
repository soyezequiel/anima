import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/index.js';

describe('memoria episódica', () => {
  it('consolida episodios repetidos en una sola entrada con ocurrencias', () => {
    const memory = new MemoryStore();
    memory.recordEpisode({ kind: 'failure', summary: 'choqué contra el muro', tick: 10 });
    memory.recordEpisode({ kind: 'failure', summary: 'choqué contra el muro', tick: 12 });
    memory.recordEpisode({ kind: 'failure', summary: 'choqué contra el muro', tick: 14 });
    const episodes = memory.episodeList();
    expect(episodes).toHaveLength(1);
    expect(episodes[0]?.occurrences).toBe(3);
    expect(episodes[0]?.lastTick).toBe(14);
  });

  it('archiva episodios viejos y poco importantes al consolidar', () => {
    const memory = new MemoryStore();
    memory.recordEpisode({ kind: 'ambient', summary: 'vi una pared', tick: 1, importance: 0.1 });
    memory.recordEpisode({ kind: 'discovery', summary: 'la comida da energía', tick: 1, importance: 0.9 });
    const report = memory.consolidate(5000);
    expect(report.episodesArchived).toBe(1);
    expect(memory.episodeList().map((e) => e.kind)).toEqual(['discovery']);
    expect(memory.episodeList({ includeArchived: true })).toHaveLength(2);
  });
});

describe('hipótesis y conocimiento', () => {
  it('actualiza la confianza con evidencia y confirma al consolidar', () => {
    const memory = new MemoryStore();
    const hypothesis = memory.addHypothesis('consumir alimento recupera energía', 1);
    memory.addEvidence(hypothesis.id, true, 2);
    memory.addEvidence(hypothesis.id, true, 3);
    memory.addEvidence(hypothesis.id, true, 4);
    expect(hypothesis.confidence).toBeGreaterThan(0.75);

    const report = memory.consolidate(5);
    expect(report.hypothesesConfirmed).toContain('consumir alimento recupera energía');
    expect(memory.factList().map((f) => f.statement)).toContain(
      'consumir alimento recupera energía',
    );
    expect(hypothesis.resolved).toBe('confirmed');
  });

  it('la evidencia negativa baja la confianza y puede descartar la hipótesis', () => {
    const memory = new MemoryStore();
    const hypothesis = memory.addHypothesis('las ramas rompen muros', 1);
    memory.addEvidence(hypothesis.id, false, 2);
    memory.addEvidence(hypothesis.id, false, 3);
    memory.addEvidence(hypothesis.id, false, 4);
    memory.addEvidence(hypothesis.id, false, 5);
    memory.addEvidence(hypothesis.id, false, 6);
    memory.consolidate(7);
    expect(hypothesis.resolved).toBe('discarded');
    expect(memory.factList().map((f) => f.statement)).not.toContain('las ramas rompen muros');
  });

  it('un hecho contradicho repetidamente queda invalidado', () => {
    const memory = new MemoryStore();
    const fact = memory.addFact('el muro es indestructible', 1);
    for (let i = 0; i < 8; i++) memory.contradictFact(fact.id, i + 2);
    expect(fact.invalidated).toBe(true);
    expect(memory.factList()).toHaveLength(0);
    expect(memory.consolidate(20).factsInvalidated).toContain('el muro es indestructible');
  });
});

describe('recuperación', () => {
  it('recupera lo relevante con límite, no toda la memoria', () => {
    const memory = new MemoryStore();
    for (let i = 0; i < 20; i++) {
      memory.recordEpisode({ kind: 'misc', summary: `evento irrelevante número ${i}`, tick: i });
    }
    for (let i = 0; i < 10; i++) {
      memory.recordEpisode({ kind: 'food', summary: `encontré alimento en el lugar ${i}`, tick: 100 + i });
    }
    memory.addFact('el alimento recupera energía', 200);
    memory.addFact('los muros son duros', 201);

    const result = memory.retrieve('alimento energía', 5);
    expect(result.episodes.length).toBeLessThanOrEqual(5);
    expect(result.episodes.every((e) => e.summary.includes('alimento'))).toBe(true);
    expect(result.facts.map((f) => f.statement)).toContain('el alimento recupera energía');
    expect(result.facts.map((f) => f.statement)).not.toContain('los muros son duros');
  });
});

describe('memoria de trabajo', () => {
  it('mantiene tamaños acotados', () => {
    const memory = new MemoryStore();
    for (let i = 0; i < 30; i++) memory.noteResult(`resultado ${i}`);
    for (let i = 0; i < 30; i++) memory.noteConversation('user', `mensaje ${i}`, i);
    expect(memory.working.recentResults.length).toBeLessThanOrEqual(8);
    expect(memory.working.conversation.length).toBeLessThanOrEqual(12);
    expect(memory.working.recentResults.at(-1)).toBe('resultado 29');
  });
});
