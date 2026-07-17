/**
 * Controlador externo de progreso: no depende de que el modelo "se dé
 * cuenta" de que está en un bucle. Registra intentos por estrategia y aplica
 * el protocolo de bloqueo de forma determinista.
 */

export interface StrategyRecord {
  strategy: string;
  attempts: number;
  failures: number;
  lastOutcome: 'success' | 'failure';
  /** Razón del último fallo (p. ej. "no-candidates:foods"). */
  lastReason?: string;
  forbidden: boolean;
}

export type EscalationStep = 'try-strategy' | 'create-skill' | 'ask-help' | 'suspend';

const FORBID_AFTER_FAILURES = 2;

export interface ProgressData {
  records: { goalId: string; strategies: StrategyRecord[] }[];
  skillDevAttempts: { goalId: string; attempts: number }[];
  /** Intentos de inventar una receta, por objetivo. Puede faltar: es posterior. */
  recipeAttempts?: { goalId: string; attempts: number }[];
  helpRequested: string[];
}

export class ProgressController {
  private records = new Map<string, Map<string, StrategyRecord>>();
  private skillDevAttempts = new Map<string, number>();
  private recipeAttempts = new Map<string, number>();
  private helpRequested = new Set<string>();

  serialize(): ProgressData {
    return structuredClone({
      records: [...this.records.entries()].map(([goalId, strategies]) => ({
        goalId,
        strategies: [...strategies.values()],
      })),
      skillDevAttempts: [...this.skillDevAttempts.entries()].map(([goalId, attempts]) => ({
        goalId,
        attempts,
      })),
      recipeAttempts: [...this.recipeAttempts.entries()].map(([goalId, attempts]) => ({
        goalId,
        attempts,
      })),
      helpRequested: [...this.helpRequested],
    });
  }

  loadFrom(data: ProgressData): void {
    const clone = structuredClone(data);
    this.records = new Map(
      clone.records.map((r) => [r.goalId, new Map(r.strategies.map((s) => [s.strategy, s]))]),
    );
    this.skillDevAttempts = new Map(clone.skillDevAttempts.map((a) => [a.goalId, a.attempts]));
    // Un guardado anterior al crédito por objetivo no trae el campo: se lee
    // como lo que era, cero intentos gastados.
    this.recipeAttempts = new Map(
      (clone.recipeAttempts ?? []).map((a) => [a.goalId, a.attempts]),
    );
    this.helpRequested = new Set(clone.helpRequested);
  }

  private forGoal(goalId: string): Map<string, StrategyRecord> {
    let map = this.records.get(goalId);
    if (!map) {
      map = new Map();
      this.records.set(goalId, map);
    }
    return map;
  }

  record(goalId: string, strategy: string, success: boolean, reason?: string): StrategyRecord {
    const map = this.forGoal(goalId);
    const record = map.get(strategy) ?? {
      strategy,
      attempts: 0,
      failures: 0,
      lastOutcome: 'failure' as const,
      forbidden: false,
    };
    record.attempts += 1;
    if (success) {
      record.lastOutcome = 'success';
      record.forbidden = false;
      record.failures = 0;
      delete record.lastReason;
    } else {
      record.failures += 1;
      record.lastOutcome = 'failure';
      if (reason !== undefined) record.lastReason = reason;
      // Prohibido repetir la misma estrategia sin modificaciones.
      if (record.failures >= FORBID_AFTER_FAILURES) record.forbidden = true;
    }
    map.set(strategy, record);
    return record;
  }

  /**
   * true si todas las estrategias fallidas lo hicieron por falta del recurso
   * (no por falta de capacidad): crear una habilidad nueva no ayudaría.
   */
  blockedByMissingResource(goalId: string): boolean {
    const tried = this.strategiesTried(goalId).filter((s) => s.forbidden);
    return (
      tried.length > 0 && tried.every((s) => s.lastReason?.includes('no-candidates') ?? false)
    );
  }

  isForbidden(goalId: string, strategy: string): boolean {
    return this.forGoal(goalId).get(strategy)?.forbidden ?? false;
  }

  strategiesTried(goalId: string): StrategyRecord[] {
    return [...this.forGoal(goalId).values()];
  }

  recordSkillDevAttempt(goalId: string): number {
    const next = (this.skillDevAttempts.get(goalId) ?? 0) + 1;
    this.skillDevAttempts.set(goalId, next);
    return next;
  }

  /**
   * Tener ideas se paga por PROBLEMA, no por vida. Un tope global convertía el
   * tercer invento fallido en una condena: quedaba muda para siempre, aunque
   * lo que le pasara después fuera otra cosa completamente distinta. Que este
   * problema la haya derrotado no dice nada sobre el próximo.
   */
  recordRecipeAttempt(goalId: string): number {
    const next = (this.recipeAttempts.get(goalId) ?? 0) + 1;
    this.recipeAttempts.set(goalId, next);
    return next;
  }

  recipeAttemptsFor(goalId: string): number {
    return this.recipeAttempts.get(goalId) ?? 0;
  }

  markHelpRequested(goalId: string): void {
    this.helpRequested.add(goalId);
  }

  helpRequestedFor(goalId: string): boolean {
    return this.helpRequested.has(goalId);
  }

  /**
   * Al reactivar un objetivo (nueva información o cambio del entorno), las
   * estrategias vuelven a estar disponibles: las condiciones cambiaron.
   * Los intentos de desarrollo de skills se conservan.
   */
  resetGoal(goalId: string): void {
    this.records.delete(goalId);
    this.helpRequested.delete(goalId);
  }

  /**
   * Protocolo de bloqueo cuando no queda ninguna estrategia viable:
   * crear/mejorar una habilidad -> pedir ayuda -> suspender el objetivo.
   */
  escalate(goalId: string, options: { maxSkillDevAttempts: number }): EscalationStep {
    if ((this.skillDevAttempts.get(goalId) ?? 0) < options.maxSkillDevAttempts) {
      return 'create-skill';
    }
    if (!this.helpRequested.has(goalId)) return 'ask-help';
    return 'suspend';
  }
}
