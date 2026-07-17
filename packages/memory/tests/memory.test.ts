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

describe('compactación (ADR 0033)', () => {
  it('bajo el umbral no toca nada', () => {
    const memory = new MemoryStore();
    for (let i = 0; i < 10; i++) {
      memory.recordEpisode({ kind: 'deed', summary: `hice la cosa ${i}`, tick: i, importance: 0.5 });
    }
    const report = memory.compact(5000);
    expect(report.episodesCompacted).toBe(0);
    expect(memory.episodeList()).toHaveLength(10);
  });

  it('sobre el umbral fusiona los viejos en un resumen que conserva el conteo', () => {
    const memory = new MemoryStore();
    // 70 episodios viejos de baja importancia, algunos repetidos (occurrences).
    for (let i = 0; i < 70; i++) {
      memory.recordEpisode({ kind: 'deed', summary: `hice la cosa ${i}`, tick: i, importance: 0.5 });
    }
    memory.recordEpisode({ kind: 'deed', summary: 'hice la cosa 0', tick: 100, importance: 0.5 });
    const totalBefore = memory
      .episodeList()
      .reduce((sum, e) => sum + e.occurrences, 0);

    const report = memory.compact(10_000);
    expect(report.episodesCompacted).toBeGreaterThan(0);
    expect(report.summariesCreated).toBe(1);

    const active = memory.episodeList();
    expect(active.length).toBeLessThanOrEqual(61); // vuelve bajo el umbral (+resumen)
    const summary = active.find((e) => e.data.compacted === true);
    expect(summary).toBeDefined();
    // El conteo agregado no se pierde: activos = resumen + los no fusionados.
    const totalAfter = active.reduce((sum, e) => sum + e.occurrences, 0);
    expect(totalAfter).toBe(totalBefore);
    expect(Array.isArray(summary?.data.samples)).toBe(true);
    // Los originales quedan archivados, no borrados.
    expect(memory.episodeList({ includeArchived: true }).length).toBeGreaterThan(active.length);
  });

  it('no fusiona el vínculo, lo importante ni lo reciente', () => {
    const memory = new MemoryStore();
    for (let i = 0; i < 70; i++) {
      memory.recordEpisode({ kind: 'deed', summary: `hice la cosa ${i}`, tick: i, importance: 0.5 });
    }
    memory.recordEpisode({ kind: 'teaching', summary: 'me enseñó a pescar', tick: 1, importance: 0.5 });
    memory.recordEpisode({ kind: 'teaching', summary: 'me enseñó a nadar', tick: 2, importance: 0.5 });
    memory.recordEpisode({ kind: 'deed', summary: 'gran hazaña', tick: 3, importance: 0.9 });
    memory.recordEpisode({ kind: 'deed', summary: 'recién hecho', tick: 9900, importance: 0.5 });

    memory.compact(10_000);
    const summaries = memory.episodeList().map((e) => e.summary);
    expect(summaries).toContain('me enseñó a pescar');
    expect(summaries).toContain('me enseñó a nadar');
    expect(summaries).toContain('gran hazaña');
    expect(summaries).toContain('recién hecho');
  });

  it('es determinista: la misma historia produce la misma memoria compactada', () => {
    const build = (): MemoryStore => {
      const memory = new MemoryStore();
      for (let i = 0; i < 70; i++) {
        memory.recordEpisode({
          kind: i % 2 === 0 ? 'deed' : 'failure',
          summary: `episodio ${i}`,
          tick: i,
          importance: 0.4,
        });
      }
      memory.compact(10_000);
      return memory;
    };
    expect(build().serialize()).toEqual(build().serialize());
  });

  it('sobrevive al viaje serialize/loadFrom', () => {
    const memory = new MemoryStore();
    for (let i = 0; i < 70; i++) {
      memory.recordEpisode({ kind: 'deed', summary: `hice la cosa ${i}`, tick: i, importance: 0.5 });
    }
    memory.compact(10_000);
    const restored = new MemoryStore();
    restored.loadFrom(memory.serialize());
    expect(restored.serialize()).toEqual(memory.serialize());
    expect(restored.episodeList().some((e) => e.data.compacted === true)).toBe(true);
  });

  it('consolidate también compacta cuando desborda', () => {
    const memory = new MemoryStore();
    for (let i = 0; i < 70; i++) {
      memory.recordEpisode({ kind: 'deed', summary: `hice la cosa ${i}`, tick: i, importance: 0.5 });
    }
    const report = memory.consolidate(10_000);
    expect(report.episodesCompacted).toBeGreaterThan(0);
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
