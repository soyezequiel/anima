import type { SkillOp, SkillProgram } from '@anima/skill-runtime';
import type { CausalCondition, CausalEffect } from '../causal-planner.js';
import type { GoalCondition } from '../goal-conditions.js';
import type { CapabilityBlock, CapabilityRisk } from './capability.js';

/**
 * Un plan es efímero. Existe para resolver el objetivo de AHORA, se compone de
 * capacidades del registro, se ejecuta paso a paso, se invalida cuando la
 * percepción lo desmiente y se tira cuando el objetivo se cierra.
 *
 * Es deliberadamente lo opuesto a una `SkillDefinition`: una habilidad es un
 * artefacto que sobrevive, que se versiona, que pasó por cuarenta mundos
 * imaginados y que se guarda en la biblioteca. Un plan no se guarda por haber
 * funcionado una vez — que algo salga bien no lo convierte en conocimiento, y
 * confundir las dos cosas es lo que hacía que la primera acción útil tuviera
 * que esperar a que naciera una skill.
 *
 * Que sea efímero también quiere decir que no se persiste: al restaurar una
 * partida, el objetivo sigue vivo y el plan se vuelve a armar con percepción
 * fresca, que es más correcto que revivir un plan hecho para un mundo que ya
 * no está.
 */

export type PlanStepStatus =
  | 'pending'
  /** Ejecutándose ahora: su programa está en el intérprete. */
  | 'running'
  /** El mundo confirmó el efecto esperado. */
  | 'done'
  /** El programa terminó pero el mundo no muestra el efecto. */
  | 'unverified'
  /** No se pudo ni compilar ni ejecutar. */
  | 'failed'
  /** Ya estaba hecho al llegar: no hizo falta gastar un tick. */
  | 'skipped';

export interface PlanStep {
  id: string;
  capabilityId: string;
  args: Record<string, unknown>;
  /** Frase en primera persona para el chat: «voy a buscar un tronco». */
  purpose: string;
  /** La DSL en la que se ejecuta. Vacío mientras el paso esté bloqueado. */
  program: SkillProgram;
  /**
   * El predicado del mundo que dice si el paso de verdad ocurrió, o `null` si
   * este paso no tiene uno propio y su veredicto lo da la meta.
   */
  expect: GoalCondition | null;
  preconditions: CausalCondition[];
  effects: CausalEffect[];
  cost: number;
  risk: CapabilityRisk;
  status: PlanStepStatus;
  /** Cuántas veces se intentó este paso en este plan. */
  attempts: number;
  /** Por qué no salió, cuando no salió. */
  block?: CapabilityBlock;
  /** Diagnóstico del mundo al verificar: lo que el motor midió, no una excusa. */
  diagnostics?: string[];
}

/**
 * Los topes de un plan. Un plan sin presupuesto es un bucle con buena
 * intención: la mascota podía quedarse recorriendo el mismo circuito para
 * siempre porque nada contaba cuántas veces ya lo había recorrido.
 */
export interface PlanBudget {
  /** Cuántas veces puede reintentarse UN paso antes de darlo por fallado. */
  maxAttemptsPerStep: number;
  /** Cuántas veces puede recalcularse el plan entero para el mismo objetivo. */
  maxReplans: number;
  /** Tope de ticks de mundo que puede consumir el plan completo. */
  maxTicks: number;
}

export const DEFAULT_PLAN_BUDGET: PlanBudget = {
  maxAttemptsPerStep: 2,
  maxReplans: 3,
  maxTicks: 600,
};

/** De dónde salió el plan. Se registra porque cambia cuánto se le cree. */
export type PlanSource =
  /** Composición determinista de capacidades a partir de la petición. */
  | 'deterministic'
  /** Cadena hallada por el planificador causal sobre el modelo del mundo. */
  | 'causal'
  /** Una habilidad estable ejecutada como macro. */
  | 'macro';

export interface Plan {
  id: string;
  goalId: string;
  source: PlanSource;
  createdAtTick: number;
  /** Cuántas veces se recalculó para este objetivo. Cuenta contra el presupuesto. */
  revision: number;
  steps: PlanStep[];
  /** El paso en curso. Igual a `steps.length` cuando el plan terminó. */
  cursor: number;
  budget: PlanBudget;
  /** Tick en el que empezó a ejecutarse el paso actual, para medir el tope. */
  startedAtTick: number;
}

export interface NewPlan {
  goalId: string;
  source: PlanSource;
  steps: PlanStep[];
  tick: number;
  budget?: Partial<PlanBudget>;
  revision?: number;
}

let planCounter = 0;

export function createPlan(input: NewPlan): Plan {
  planCounter += 1;
  return {
    id: `plan-${planCounter}`,
    goalId: input.goalId,
    source: input.source,
    createdAtTick: input.tick,
    revision: input.revision ?? 1,
    steps: input.steps,
    cursor: 0,
    budget: { ...DEFAULT_PLAN_BUDGET, ...input.budget },
    startedAtTick: input.tick,
  };
}

/** Solo para pruebas: vuelve los ids de plan a un punto conocido. */
export function resetPlanCounter(): void {
  planCounter = 0;
}

export function currentStep(plan: Plan): PlanStep | undefined {
  return plan.steps[plan.cursor];
}

export function planFinished(plan: Plan): boolean {
  return plan.cursor >= plan.steps.length;
}

/** Un plan sirvió si todos sus pasos quedaron hechos (o ya estaban hechos). */
export function planSucceeded(plan: Plan): boolean {
  return plan.steps.every((step) => step.status === 'done' || step.status === 'skipped');
}

/**
 * El plan entero como un solo programa de la DSL.
 *
 * Es el puente de compatibilidad: todo lo que hoy espera un `SkillProgram`
 * —el evaluador, las regresiones, `runSkillProgram`, las pruebas existentes—
 * lo sigue recibiendo. La diferencia es que ahora hay ADEMÁS una estructura
 * por pasos, con su expectativa y su veredicto, que la ejecución monitorizada
 * puede recorrer de a uno.
 */
export function planProgram(plan: Plan): SkillProgram {
  const ops: SkillOp[] = [];
  for (const step of plan.steps) ops.push(...step.program);
  return ops.length > 0 ? ops : [{ op: 'wait', ticks: 1 }];
}

/**
 * Lo que se le cuenta al cuidador de un plan, en dos o tres líneas.
 *
 * Corto a propósito: el chat es para saber qué está haciendo, no para leer un
 * volcado de operaciones. Los pasos ya hechos no se repiten — a nadie le sirve
 * que le recuerden cada tick lo que ya vio.
 */
export function describePlan(plan: Plan, limit = 3): string {
  const pending = plan.steps.filter(
    (step) => step.status === 'pending' || step.status === 'running',
  );
  if (pending.length === 0) return 'Ya está: no me queda ningún paso.';
  const head = pending.slice(0, limit).map((step) => step.purpose);
  const rest = pending.length - head.length;
  return rest > 0 ? `${head.join('; ')}; y ${rest} paso(s) más.` : head.join('; ') + '.';
}

/**
 * El plan dejó de valer: se marca su cola como pendiente y el llamador vuelve
 * a planificar con percepción fresca. No se borra lo ya hecho — los pasos
 * cumplidos son historia del mundo, no del plan, y rehacerlos sería recoger
 * dos veces el mismo tronco.
 */
export function invalidatePlan(plan: Plan): void {
  for (let index = plan.cursor; index < plan.steps.length; index += 1) {
    const step = plan.steps[index]!;
    if (step.status === 'running') step.status = 'pending';
  }
}
