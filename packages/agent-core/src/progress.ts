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
  forbidden: boolean;
}

export type EscalationStep = 'try-strategy' | 'create-skill' | 'ask-help' | 'suspend';

const FORBID_AFTER_FAILURES = 2;

export class ProgressController {
  private records = new Map<string, Map<string, StrategyRecord>>();
  private skillDevAttempts = new Map<string, number>();
  private helpRequested = new Set<string>();

  private forGoal(goalId: string): Map<string, StrategyRecord> {
    let map = this.records.get(goalId);
    if (!map) {
      map = new Map();
      this.records.set(goalId, map);
    }
    return map;
  }

  record(goalId: string, strategy: string, success: boolean): StrategyRecord {
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
    } else {
      record.failures += 1;
      record.lastOutcome = 'failure';
      // Prohibido repetir la misma estrategia sin modificaciones.
      if (record.failures >= FORBID_AFTER_FAILURES) record.forbidden = true;
    }
    map.set(strategy, record);
    return record;
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

  markHelpRequested(goalId: string): void {
    this.helpRequested.add(goalId);
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
