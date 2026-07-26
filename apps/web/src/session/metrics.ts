import type { AgentEvent } from '@anima/agent-core';

/**
 * Lo que hay que poder medir para saber si esto se siente fluido.
 *
 * Las quejas sobre un agente son casi siempre temporales —«tarda», «se
 * cuelga», «no hace nada»— y hasta ahora no había con qué contestarlas más
 * que mirando. Estas son las cuentas que distinguen las tres:
 *
 *  - TIEMPO HASTA LA PRIMERA ACCIÓN ÚTIL: cuántos ticks pasan entre que el
 *    cuidador pide algo y el mundo acepta la primera acción del cuerpo que lo
 *    empuja. Es la métrica del producto: todo lo demás puede estar bien y si
 *    esto es alto, se siente muerta.
 *  - CUÁNTO SE VA EN CADA COSA: interpretar, contratar, evaluar. Sin
 *    separarlas, «tarda» no dice si el problema es el proveedor o los mundos
 *    imaginados, que se arreglan de maneras opuestas.
 *  - TAREAS LARGAS: bloques que congelan la pestaña. Es la comprobación
 *    directa de que sacar la evaluación a un worker sirvió.
 *  - REUSO REAL: cuántas veces se ejecutó una habilidad aprendida contra
 *    cuántos planes efímeros. Es lo que dice si las habilidades valen lo que
 *    cuestan, en vez de suponerlo.
 *
 * Todo en memoria y por sesión: son números para mirar mientras se desarrolla,
 * no telemetría que viaje a ningún lado.
 */

export interface DurationStat {
  count: number;
  totalMs: number;
  maxMs: number;
}

export interface SessionMetricsView {
  /** Ticks desde el pedido hasta la primera acción útil, por encargo resuelto. */
  ticksToFirstAction: number[];
  medianTicksToFirstAction: number | null;
  durations: Record<string, DurationStat>;
  /** Bloques del hilo principal por encima del umbral, en ms. */
  longTasks: number[];
  plansStarted: number;
  planStepsVerified: number;
  planStepsUnverified: number;
  replans: number;
  /** Ejecuciones de una habilidad aprendida (macro) sobre el total de planes. */
  skillRuns: number;
  skillReuseRatio: number | null;
  /** Pedidos que ninguna capacidad cubría. */
  missingCapabilities: number;
}

/** A partir de cuánto un bloque del hilo principal cuenta como «se colgó». */
export const LONG_TASK_MS = 50;

export class SessionMetrics {
  private readonly ticksToFirstAction: number[] = [];
  private readonly durations = new Map<string, DurationStat>();
  private readonly longTasks: number[] = [];
  /** Encargos esperando su primera acción: goalId → tick en que se pidió. */
  private readonly awaitingFirstAction = new Map<string, number>();
  private plansStarted = 0;
  private planStepsVerified = 0;
  private planStepsUnverified = 0;
  private replans = 0;
  private skillRuns = 0;
  private missingCapabilities = 0;

  /** Un encargo aceptado empieza a contar desde ya. */
  noteRequestAccepted(goalId: string, tick: number): void {
    if (!this.awaitingFirstAction.has(goalId)) this.awaitingFirstAction.set(goalId, tick);
  }

  /**
   * El mundo aceptó una acción del cuerpo para este encargo. Solo la PRIMERA
   * cuenta: lo que se mide es cuánto tardó en arrancar, no cuánto duró.
   */
  noteUsefulAction(goalId: string, tick: number): void {
    const startedAt = this.awaitingFirstAction.get(goalId);
    if (startedAt === undefined) return;
    this.awaitingFirstAction.delete(goalId);
    this.ticksToFirstAction.push(Math.max(0, tick - startedAt));
  }

  noteDuration(label: string, ms: number): void {
    const stat = this.durations.get(label) ?? { count: 0, totalMs: 0, maxMs: 0 };
    stat.count += 1;
    stat.totalMs += ms;
    stat.maxMs = Math.max(stat.maxMs, ms);
    this.durations.set(label, stat);
    if (ms >= LONG_TASK_MS) this.longTasks.push(Math.round(ms));
  }

  /** Lo que los eventos del agente ya cuentan, sin instrumentar nada aparte. */
  ingest(event: AgentEvent): void {
    if (event.type === 'strategy.selected') this.plansStarted += 1;
    else if (event.type === 'plan.step.verified') this.planStepsVerified += 1;
    else if (event.type === 'plan.step.unverified') this.planStepsUnverified += 1;
    else if (event.type === 'plan.replanned') this.replans += 1;
    else if (event.type === 'capability.missing') this.missingCapabilities += 1;
    else if (event.type === 'skill.used') this.skillRuns += 1;
  }

  view(): SessionMetricsView {
    const sorted = [...this.ticksToFirstAction].sort((a, b) => a - b);
    const median =
      sorted.length === 0
        ? null
        : sorted.length % 2 === 1
          ? sorted[(sorted.length - 1) / 2]!
          : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
    return {
      ticksToFirstAction: [...this.ticksToFirstAction],
      medianTicksToFirstAction: median,
      durations: Object.fromEntries([...this.durations].map(([key, stat]) => [key, { ...stat }])),
      longTasks: [...this.longTasks],
      plansStarted: this.plansStarted,
      planStepsVerified: this.planStepsVerified,
      planStepsUnverified: this.planStepsUnverified,
      replans: this.replans,
      skillRuns: this.skillRuns,
      // Cuántos de los trabajos que emprendió fueron una habilidad ya aprendida
      // y cuántos un plan armado en el momento. Es el número que dice si las
      // habilidades se ganan su costo: aprender es caro, y una que se ejecuta
      // una sola vez fue un plan efímero con ceremonia de artefacto.
      skillReuseRatio: this.plansStarted === 0 ? null : this.skillRuns / this.plansStarted,
      missingCapabilities: this.missingCapabilities,
    };
  }

  reset(): void {
    this.ticksToFirstAction.length = 0;
    this.durations.clear();
    this.longTasks.length = 0;
    this.awaitingFirstAction.clear();
    this.plansStarted = 0;
    this.planStepsVerified = 0;
    this.planStepsUnverified = 0;
    this.replans = 0;
    this.skillRuns = 0;
    this.missingCapabilities = 0;
  }
}
