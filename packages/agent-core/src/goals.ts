import type { Direction } from '@anima/sim-core';
import type { EvaluationCriterion } from '@anima/skill-runtime';

export type GoalSource =
  | 'internal-signal'
  | 'curiosity'
  | 'danger'
  | 'user-request'
  | 'promise'
  | 'contradiction'
  /** Aprender una conducta que el cuidador pidió y todavía no sabe hacer. */
  | 'learning';

export type GoalStatus = 'active' | 'suspended' | 'completed' | 'failed';

export interface GoalUserRequest {
  kind:
    | 'destroy-entity'
    | 'fetch-item'
    | 'consume-item'
    | 'wait-here'
    | 'move-direction'
    | 'run-skill'
    | 'craft-item'
    | 'interact-entity';
  targetKind?: string;
  /** El verbo pedido (interact-entity): "juntar", "subirse-encima". */
  verb?: string;
  /** Cuántas unidades pidió (fetch-item): "conseguí los 2 troncos" son 2. */
  amount?: number;
  directions?: Direction[];
  skillName?: string;
  recipeId?: string;
  raw: string;
}

/**
 * Lo que hay que aprender y cuándo contará como aprendido. Vive en el objetivo
 * (no en una variable suelta) para que sobreviva a un guardado, se vea en la
 * UI y pueda reintentarse: aprender es una empresa de la mascota, no un efecto
 * secundario de un mensaje de chat.
 */
export interface LearningContract {
  name: string;
  purpose: string;
  expectedOutcome: string;
  successCriteria: EvaluationCriterion[];
  /** Lo que el cuidador pidió, tal cual lo dijo. */
  raw: string;
  /** Lo que la mascota sabía y veía al empezar: insumo para el diseño. */
  context: string[];
}

/** Los objetivos son estructuras, nunca texto libre suelto. */
export interface Goal {
  id: string;
  description: string;
  source: GoalSource;
  priority: number;
  urgency: number;
  expectedValue: number;
  status: GoalStatus;
  createdAtTick: number;
  preconditions: string[];
  successCriteria: string[];
  failureCriteria: string[];
  parentGoalId?: string;
  suspendedReason?: string;
  /** Condición (texto estructurado breve) que permitiría reactivarlo. */
  reactivateWhen?: string;
  /** Petición estructurada que permite ejecutar y restaurar objetivos del usuario. */
  userRequest?: GoalUserRequest;
  /** Contrato a satisfacer cuando el objetivo es aprender una habilidad nueva. */
  learning?: LearningContract;
}

export type NewGoal = Omit<Goal, 'id' | 'status' | 'createdAtTick'>;

export interface GoalManagerData {
  goals: Goal[];
  counter: number;
}

export class GoalManager {
  private goals: Goal[] = [];
  private counter = 0;

  serialize(): GoalManagerData {
    return structuredClone({ goals: this.goals, counter: this.counter });
  }

  loadFrom(data: GoalManagerData): void {
    const clone = structuredClone(data);
    this.goals = clone.goals;
    this.counter = clone.counter;
  }

  create(input: NewGoal, tick: number): Goal {
    this.counter += 1;
    const goal: Goal = {
      ...input,
      id: `goal-${this.counter}`,
      status: 'active',
      createdAtTick: tick,
    };
    this.goals.push(goal);
    return goal;
  }

  /** Objetivo activo con mayor score (prioridad + urgencia). Determinista. */
  selectActive(): Goal | undefined {
    return this.goals
      .filter((g) => g.status === 'active')
      .sort(
        (a, b) =>
          b.priority + b.urgency - (a.priority + a.urgency) ||
          Number(a.id.slice(5)) - Number(b.id.slice(5)),
      )[0];
  }

  byDescription(description: string): Goal | undefined {
    return this.goals.find((g) => g.description === description && g.status !== 'failed');
  }

  /** Objetivo aún abierto (activo o suspendido) con esa descripción. */
  findOpen(description: string): Goal | undefined {
    return this.goals.find(
      (g) => g.description === description && (g.status === 'active' || g.status === 'suspended'),
    );
  }

  get(id: string): Goal | undefined {
    return this.goals.find((g) => g.id === id);
  }

  complete(id: string): void {
    const goal = this.get(id);
    if (goal) goal.status = 'completed';
  }

  fail(id: string): void {
    const goal = this.get(id);
    if (goal) goal.status = 'failed';
  }

  suspend(id: string, reason: string, reactivateWhen: string): void {
    const goal = this.get(id);
    if (goal) {
      goal.status = 'suspended';
      goal.suspendedReason = reason;
      goal.reactivateWhen = reactivateWhen;
    }
  }

  reactivate(id: string): void {
    const goal = this.get(id);
    if (goal && goal.status === 'suspended') {
      goal.status = 'active';
      delete goal.suspendedReason;
    }
  }

  all(): Goal[] {
    return [...this.goals];
  }
}
