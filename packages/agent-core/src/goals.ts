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

/**
 * Una relación espacial pedida por el cuidador. El vocabulario es chico a
 * propósito: son relaciones que el motor puede medir, no frases que haya que
 * volver a interpretar al terminar.
 */
export type SpatialRelation = 'opposite-side' | 'near' | 'far-from';

/**
 * Geometría resuelta cuando se acepta el pedido. Se congela porque "el otro
 * lado" depende de dónde estaba la mascota al oírlo; recalcularlo mientras se
 * mueve haría que la meta huyera con ella.
 */
export interface SpatialGrounding {
  relation: SpatialRelation;
  referenceKind: string;
  referenceEntityIds: string[];
  referencePositions: { x: number; y: number }[];
  destination: { x: number; y: number };
  /** Solo `opposite-side`: eje normal, centro y lado del que partió. */
  axis?: 'x' | 'y';
  origin?: number;
  startingSide?: -1 | 1;
  /** Solo `far-from`: distancia Manhattan mínima que cuenta como alejarse. */
  minimumDistance?: number;
}

export interface GoalUserRequest {
  kind:
    | 'destroy-entity'
    | 'fetch-item'
    | 'consume-item'
    | 'wait-here'
    | 'move-direction'
    | 'run-skill'
    | 'craft-item'
    | 'place-item'
    | 'spatial-relation'
    | 'interact-entity';
  targetKind?: string;
  /** `place-item`: sobre qué hay que ponerlo. */
  onKind?: string;
  /** El verbo pedido (interact-entity): "juntar", "subirse-encima". */
  verb?: string;
  /** Cuántas unidades pidió (fetch-item): "conseguí los 2 troncos" son 2. */
  amount?: number;
  directions?: Direction[];
  skillName?: string;
  recipeId?: string;
  /** Pedido espacial y su geometría ya anclada en el mundo. */
  relation?: SpatialRelation;
  spatial?: SpatialGrounding;
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

/**
 * El paso concreto que un sub-objetivo representa (ADR 0053). Es dato y no
 * texto para que el agente pueda darlo por cumplido con la misma cuenta con la
 * que se suspende y retoma (`neededCountsFor`), sin re-parsear su descripción.
 */
export type GoalStep =
  /** Reunir tanta materia de tal tipo. `need` es el total del plan original. */
  | { kind: 'gather'; targetKind: string; need: number }
  /** El remate: levantar la obra o armar el objeto con lo reunido. */
  | { kind: 'assemble' };

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
  /** De quién es paso este objetivo: lo vuelve hijo, fuera de la fila. */
  parentGoalId?: string;
  /** Qué paso del padre es, cuando es un hijo (ADR 0053). */
  step?: GoalStep;
  /**
   * Este objetivo espera a que otro se cierre. Es lo que hace que un encargo
   * dicho en varias partes ("fabricá una tabla, ponela sobre el agua y cruzá")
   * se haga EN ESE ORDEN, en vez de que las tres partes compitan por prioridad
   * y ella empiece por la última.
   *
   * No es lo mismo que `parentGoalId`: un hijo es un paso interno que trabaja
   * el programa del padre, y esto son encargos hermanos, cada uno con su propio
   * trabajo, puestos en fila. Espera a que se CIERRE, no a que triunfe: si la
   * primera parte fracasa, la siguiente igual se intenta — el cuidador pidió
   * tres cosas, no una condicionada a otra.
   */
  afterGoalId?: string;
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

  /**
   * Objetivo activo con mayor score (prioridad + urgencia). Determinista.
   * Los hijos no entran en la fila (ADR 0053): son pasos del padre, no
   * competidores — quien trabaja es el programa del padre, y un hijo elegido
   * como objetivo propio intentaría perseguirse sin tener petición que cumplir.
   */
  selectActive(): Goal | undefined {
    return this.goals
      .filter(
        (g) =>
          g.status === 'active' &&
          g.parentGoalId === undefined &&
          // Su turno todavía no llegó: lo que tiene que pasar antes sigue
          // abierto. Un predecesor que ya no existe no bloquea a nadie.
          !this.isWaitingForPredecessor(g),
      )
      .sort(
        (a, b) =>
          b.priority + b.urgency - (a.priority + a.urgency) ||
          Number(a.id.slice(5)) - Number(b.id.slice(5)),
      )[0];
  }

  /**
   * true si este objetivo espera a otro que sigue abierto. Un predecesor
   * suspendido cuenta como abierto: el orden que pidió el cuidador vale
   * también cuando la parte anterior está esperando material.
   */
  private isWaitingForPredecessor(goal: Goal): boolean {
    if (goal.afterGoalId === undefined) return false;
    const previous = this.goals.find((g) => g.id === goal.afterGoalId);
    if (!previous) return false;
    return previous.status === 'active' || previous.status === 'suspended';
  }

  /** Los objetivos que esperan su turno detrás de otro, para poder mostrarlos. */
  waitingFor(goalId: string): Goal[] {
    return this.goals.filter(
      (g) => g.afterGoalId === goalId && (g.status === 'active' || g.status === 'suspended'),
    );
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

  /** Los hijos todavía abiertos de un objetivo, en orden de creación. */
  childrenOf(id: string): Goal[] {
    return this.goals.filter((g) => g.parentGoalId === id);
  }

  /**
   * Terminar el padre arrastra a los hijos (ADR 0053): la obra hecha da por
   * hechos sus pasos, y un pedido que fracasa no deja pasos huérfanos
   * fingiendo que siguen en marcha. Solo el cierre cascada — suspender no,
   * porque un paso no está "esperando" nada propio: espera lo que el padre.
   */
  complete(id: string): void {
    const goal = this.get(id);
    if (!goal) return;
    goal.status = 'completed';
    for (const child of this.childrenOf(id)) {
      if (child.status === 'active' || child.status === 'suspended') child.status = 'completed';
    }
  }

  fail(id: string): void {
    const goal = this.get(id);
    if (!goal) return;
    goal.status = 'failed';
    for (const child of this.childrenOf(id)) {
      if (child.status === 'active' || child.status === 'suspended') child.status = 'failed';
    }
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
