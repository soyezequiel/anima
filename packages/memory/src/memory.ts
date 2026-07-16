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
}

const CONFIRM_CONFIDENCE = 0.8;
const CONFIRM_MIN_EVIDENCE = 2;
const DISCARD_CONFIDENCE = 0.2;
const ARCHIVE_IMPORTANCE = 0.3;
const ARCHIVE_AGE_TICKS = 2000;
const WORKING_RESULTS_LIMIT = 8;
const WORKING_CONVERSATION_LIMIT = 12;

function evidenceConfidence(positive: number, negative: number): number {
  // Estimación suavizada tipo Laplace: evita saltar a 0 o 1 con poca evidencia.
  return (positive + 1) / (positive + negative + 2);
}

export class MemoryStore {
  readonly working: WorkingMemoryState = { recentResults: [], conversation: [] };
  private episodes: EpisodicMemory[] = [];
  private facts: SemanticFact[] = [];
  private hypotheses: Hypothesis[] = [];
  private counter = 0;

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
