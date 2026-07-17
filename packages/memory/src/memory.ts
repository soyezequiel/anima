/**
 * Memoria de la mascota en capas: trabajo, episódica, semántica, hipótesis y
 * archivo. No guarda razonamiento interno crudo: solo estructuras auditables.
 */

export interface EpisodicMemory {
  id: string;
  kind: string;
  summary: string;
  tick: number;
  lastTick: number;
  occurrences: number;
  importance: number;
  data: Record<string, unknown>;
  archived: boolean;
}

export interface SemanticFact {
  id: string;
  statement: string;
  confidence: number;
  positiveEvidence: number;
  negativeEvidence: number;
  updatedAtTick: number;
  invalidated: boolean;
}

export interface Hypothesis {
  id: string;
  statement: string;
  confidence: number;
  positiveEvidence: number;
  negativeEvidence: number;
  updatedAtTick: number;
  /** Condiciones bajo las que parece válida (texto breve, opcional). */
  validWhen?: string;
  resolved: 'pending' | 'confirmed' | 'discarded';
}

export interface WorkingMemoryState {
  currentGoalId?: string;
  planSummary?: string;
  recentResults: string[];
  conversation: { from: 'user' | 'pet'; text: string; tick: number }[];
}

export interface ConsolidationReport {
  episodesMerged: number;
  episodesArchived: number;
  hypothesesConfirmed: string[];
  factsInvalidated: string[];
  /** Episodios fusionados en resúmenes por la compactación (ADR 0033). */
  episodesCompacted: number;
}

/** Resultado de una pasada de compactación (ADR 0033). */
export interface CompactionReport {
  episodesCompacted: number;
  summariesCreated: number;
}

const CONFIRM_CONFIDENCE = 0.8;
const CONFIRM_MIN_EVIDENCE = 2;
const DISCARD_CONFIDENCE = 0.2;
const ARCHIVE_IMPORTANCE = 0.3;
const ARCHIVE_AGE_TICKS = 2000;
const WORKING_RESULTS_LIMIT = 8;
const WORKING_CONVERSATION_LIMIT = 12;
// Compactación (ADR 0033): la memoria episódica no puede crecer sin techo en
// una vida larga. Cuando los episodios activos superan el umbral, los viejos y
// poco importantes se fusionan en un resumen por kind que conserva el conteo
// agregado. Determinista a propósito: el modelo nunca escribe memoria.
const COMPACT_MAX_ACTIVE = 60;
const COMPACT_MIN_AGE_TICKS = 500; // lo reciente no se fusiona: todavía es conversable
const COMPACT_MAX_IMPORTANCE = 0.7; // lo importante no se fusiona
const COMPACT_SAMPLE_LIMIT = 3;
// Los recuerdos del vínculo con el cuidador no se resumen jamás: son pocos,
// valiosos, y la voz de la mascota los cita textuales ("vos me enseñaste...").
const PRESERVE_KINDS = new Set([
  'caretaker',
  'teaching',
  'promise-kept',
  'caretaker-help',
  'legacy-traits',
  'skill-learned',
]);

function evidenceConfidence(positive: number, negative: number): number {
  // Estimación suavizada tipo Laplace: evita saltar a 0 o 1 con poca evidencia.
  return (positive + 1) / (positive + negative + 2);
}

/** Estado serializable completo de la memoria (para persistencia). */
export interface MemoryData {
  episodes: EpisodicMemory[];
  facts: SemanticFact[];
  hypotheses: Hypothesis[];
  counter: number;
  working: WorkingMemoryState;
}

export class MemoryStore {
  readonly working: WorkingMemoryState = { recentResults: [], conversation: [] };
  private episodes: EpisodicMemory[] = [];
  private facts: SemanticFact[] = [];
  private hypotheses: Hypothesis[] = [];
  private counter = 0;

  serialize(): MemoryData {
    return structuredClone({
      episodes: this.episodes,
      facts: this.facts,
      hypotheses: this.hypotheses,
      counter: this.counter,
      working: this.working,
    });
  }

  loadFrom(data: MemoryData): void {
    const clone = structuredClone(data);
    this.episodes = clone.episodes;
    this.facts = clone.facts;
    this.hypotheses = clone.hypotheses;
    this.counter = clone.counter;
    this.working.recentResults = clone.working.recentResults;
    this.working.conversation = clone.working.conversation;
    if (clone.working.currentGoalId !== undefined) {
      this.working.currentGoalId = clone.working.currentGoalId;
    } else {
      delete this.working.currentGoalId;
    }
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  // ---- memoria de trabajo -------------------------------------------------

  noteResult(summary: string): void {
    this.working.recentResults.push(summary);
    if (this.working.recentResults.length > WORKING_RESULTS_LIMIT) {
      this.working.recentResults.shift();
    }
  }

  noteConversation(from: 'user' | 'pet', text: string, tick: number): void {
    this.working.conversation.push({ from, text, tick });
    if (this.working.conversation.length > WORKING_CONVERSATION_LIMIT) {
      this.working.conversation.shift();
    }
  }

  // ---- episódica ----------------------------------------------------------

  recordEpisode(input: {
    kind: string;
    summary: string;
    tick: number;
    importance?: number;
    data?: Record<string, unknown>;
  }): EpisodicMemory {
    const existing = this.episodes.find(
      (e) => !e.archived && e.kind === input.kind && e.summary === input.summary,
    );
    if (existing) {
      existing.occurrences += 1;
      existing.lastTick = input.tick;
      return existing;
    }
    const episode: EpisodicMemory = {
      id: this.nextId('ep'),
      kind: input.kind,
      summary: input.summary,
      tick: input.tick,
      lastTick: input.tick,
      occurrences: 1,
      importance: input.importance ?? 0.5,
      data: input.data ?? {},
      archived: false,
    };
    this.episodes.push(episode);
    return episode;
  }

  episodeList(options: { includeArchived?: boolean } = {}): EpisodicMemory[] {
    return this.episodes.filter((e) => options.includeArchived || !e.archived);
  }

  // ---- hipótesis ----------------------------------------------------------

  addHypothesis(statement: string, tick: number, initialConfidence = 0.5): Hypothesis {
    const existing = this.hypotheses.find(
      (h) => h.statement === statement && h.resolved === 'pending',
    );
    if (existing) return existing;
    const hypothesis: Hypothesis = {
      id: this.nextId('hyp'),
      statement,
      confidence: initialConfidence,
      positiveEvidence: 0,
      negativeEvidence: 0,
      updatedAtTick: tick,
      resolved: 'pending',
    };
    this.hypotheses.push(hypothesis);
    return hypothesis;
  }

  addEvidence(hypothesisId: string, supports: boolean, tick: number): Hypothesis | undefined {
    const hypothesis = this.hypotheses.find((h) => h.id === hypothesisId);
    if (!hypothesis) return undefined;
    if (supports) hypothesis.positiveEvidence += 1;
    else hypothesis.negativeEvidence += 1;
    hypothesis.confidence = evidenceConfidence(
      hypothesis.positiveEvidence,
      hypothesis.negativeEvidence,
    );
    hypothesis.updatedAtTick = tick;
    return hypothesis;
  }

  hypothesisList(): Hypothesis[] {
    return [...this.hypotheses];
  }

  // ---- semántica ----------------------------------------------------------

  addFact(statement: string, tick: number, confidence = 0.9): SemanticFact {
    const existing = this.facts.find((f) => f.statement === statement && !f.invalidated);
    if (existing) {
      existing.positiveEvidence += 1;
      existing.confidence = evidenceConfidence(existing.positiveEvidence, existing.negativeEvidence);
      existing.updatedAtTick = tick;
      return existing;
    }
    const fact: SemanticFact = {
      id: this.nextId('fact'),
      statement,
      confidence,
      positiveEvidence: 1,
      negativeEvidence: 0,
      updatedAtTick: tick,
      invalidated: false,
    };
    this.facts.push(fact);
    return fact;
  }

  contradictFact(factId: string, tick: number): SemanticFact | undefined {
    const fact = this.facts.find((f) => f.id === factId);
    if (!fact) return undefined;
    fact.negativeEvidence += 1;
    fact.confidence = evidenceConfidence(fact.positiveEvidence, fact.negativeEvidence);
    fact.updatedAtTick = tick;
    if (fact.confidence < DISCARD_CONFIDENCE) fact.invalidated = true;
    return fact;
  }

  factList(options: { includeInvalidated?: boolean } = {}): SemanticFact[] {
    return this.facts.filter((f) => options.includeInvalidated || !f.invalidated);
  }

  // ---- consolidación ------------------------------------------------------

  consolidate(tick: number): ConsolidationReport {
    const report: ConsolidationReport = {
      episodesMerged: 0,
      episodesArchived: 0,
      hypothesesConfirmed: [],
      factsInvalidated: [],
      episodesCompacted: 0,
    };

    // Hipótesis con suficiente evidencia se convierten en conocimiento.
    for (const hypothesis of this.hypotheses) {
      if (hypothesis.resolved !== 'pending') continue;
      if (
        hypothesis.confidence >= CONFIRM_CONFIDENCE &&
        hypothesis.positiveEvidence >= CONFIRM_MIN_EVIDENCE
      ) {
        hypothesis.resolved = 'confirmed';
        this.addFact(hypothesis.statement, tick, hypothesis.confidence);
        report.hypothesesConfirmed.push(hypothesis.statement);
      } else if (
        hypothesis.confidence <= DISCARD_CONFIDENCE &&
        hypothesis.negativeEvidence >= CONFIRM_MIN_EVIDENCE
      ) {
        hypothesis.resolved = 'discarded';
      }
    }

    // Los hechos contradichos quedan invalidados (ya marcado en contradictFact).
    report.factsInvalidated = this.facts.filter((f) => f.invalidated).map((f) => f.statement);

    // Episodios viejos y poco importantes van al archivo.
    for (const episode of this.episodes) {
      if (episode.archived) continue;
      if (episode.importance < ARCHIVE_IMPORTANCE && tick - episode.lastTick > ARCHIVE_AGE_TICKS) {
        episode.archived = true;
        report.episodesArchived += 1;
      }
    }

    // Los episodios repetidos ya se fusionan al registrarse; aquí se informa.
    report.episodesMerged = this.episodes.filter((e) => e.occurrences > 1).length;

    // Y si aun así la memoria activa desborda, se compacta (ADR 0033).
    report.episodesCompacted = this.compact(tick).episodesCompacted;
    return report;
  }

  /**
   * Compactación determinista (ADR 0033): fusiona episodios viejos y poco
   * importantes en un resumen por kind que conserva el conteo agregado. Nada
   * se borra — los originales quedan archivados y auditables en el save. Los
   * recuerdos del vínculo (PRESERVE_KINDS) no se tocan nunca.
   */
  compact(tick: number): CompactionReport {
    const report: CompactionReport = { episodesCompacted: 0, summariesCreated: 0 };
    const active = (): EpisodicMemory[] => this.episodes.filter((e) => !e.archived);
    if (active().length <= COMPACT_MAX_ACTIVE) return report;

    // Candidatos: fuera del vínculo, de baja importancia y con edad suficiente.
    // Orden estable (lastTick asc, luego id) para que la misma historia
    // produzca siempre la misma memoria compactada.
    const candidates = active()
      .filter(
        (e) =>
          !PRESERVE_KINDS.has(e.kind) &&
          e.importance < COMPACT_MAX_IMPORTANCE &&
          tick - e.lastTick > COMPACT_MIN_AGE_TICKS &&
          e.data.compacted !== true,
      )
      .sort((a, b) => a.lastTick - b.lastTick || a.id.localeCompare(b.id));

    const byKind = new Map<string, EpisodicMemory[]>();
    for (const episode of candidates) {
      const group = byKind.get(episode.kind) ?? [];
      group.push(episode);
      byKind.set(episode.kind, group);
    }

    // Kinds en orden alfabético: el orden de fusión también es parte del
    // determinismo. Se detiene apenas la memoria vuelve bajo el umbral.
    for (const kind of [...byKind.keys()].sort()) {
      if (active().length <= COMPACT_MAX_ACTIVE) break;
      const group = byKind.get(kind)!;
      if (group.length < 2) continue;

      const totalOccurrences = group.reduce((sum, e) => sum + e.occurrences, 0);
      const samples = [...group]
        .sort((a, b) => b.occurrences - a.occurrences || a.id.localeCompare(b.id))
        .slice(0, COMPACT_SAMPLE_LIMIT)
        .map((e) => (e.occurrences > 1 ? `${e.summary} (×${e.occurrences})` : e.summary));
      for (const episode of group) episode.archived = true;
      report.episodesCompacted += group.length;

      // El resumen es un episodio más del mismo kind: quien lea la memoria lo
      // encuentra donde esperaría los originales, con el conteo agregado.
      const existing = this.episodes.find(
        (e) => !e.archived && e.kind === kind && e.data.compacted === true,
      );
      if (existing) {
        const distinct = (typeof existing.data.distinct === 'number' ? existing.data.distinct : 0) + group.length;
        existing.occurrences += totalOccurrences;
        existing.summary = `resumen de ${kind}: ${distinct} recuerdos distintos`;
        existing.lastTick = Math.max(existing.lastTick, ...group.map((e) => e.lastTick));
        existing.tick = Math.min(existing.tick, ...group.map((e) => e.tick));
        existing.data.distinct = distinct;
        existing.data.samples = samples;
      } else {
        const summary: EpisodicMemory = {
          id: this.nextId('ep'),
          kind,
          summary: `resumen de ${kind}: ${group.length} recuerdos distintos`,
          tick: Math.min(...group.map((e) => e.tick)),
          lastTick: Math.max(...group.map((e) => e.lastTick)),
          occurrences: totalOccurrences,
          importance: 0.4,
          data: { compacted: true, distinct: group.length, samples },
          archived: false,
        };
        this.episodes.push(summary);
        report.summariesCreated += 1;
      }
    }
    return report;
  }

  // ---- recuperación -------------------------------------------------------

  /**
   * Recupera recuerdos relevantes por coincidencia simple de términos.
   * Devuelve como máximo `limit` resultados: nunca "toda la memoria".
   */
  retrieve(query: string, limit = 5): { episodes: EpisodicMemory[]; facts: SemanticFact[] } {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const score = (text: string): number =>
      terms.reduce((sum, term) => (text.toLowerCase().includes(term) ? sum + 1 : sum), 0);

    const episodes = this.episodes
      .filter((e) => !e.archived)
      .map((e) => ({ e, s: score(`${e.kind} ${e.summary}`) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.e.lastTick - a.e.lastTick)
      .slice(0, limit)
      .map((x) => x.e);
    const facts = this.facts
      .filter((f) => !f.invalidated)
      .map((f) => ({ f, s: score(f.statement) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.f.confidence - a.f.confidence)
      .slice(0, limit)
      .map((x) => x.f);
    return { episodes, facts };
  }
}
