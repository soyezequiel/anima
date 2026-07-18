import { z } from 'zod';
import type { Result } from '@anima/shared';
import { err, ok } from '@anima/shared';
import type { SkillProgram } from './dsl.js';

/**
 * `provisional` es "lo mejor que tengo mientras sigo puliendo" (ADR 0050).
 *
 * El evaluador exige 100% para promover, y con razón: una habilidad estable se
 * ejecuta después sin pensar, y una poco confiable es una trampa silenciosa.
 * Pero tirar a la basura un programa que funciona 19 de cada 20 veces mientras
 * el frío que esa habilidad resuelve la está matando es peor: una generación
 * murió congelada justo después de alcanzar por fin la versión perfecta.
 *
 * Una provisional no baja la vara de lo estable — sigue sin ser estable, y el
 * ciclo sigue corrigiéndola. Solo deja de tratar "no perfecta" como
 * "inservible": se usa cuando no hay nada mejor.
 */
export type SkillStatus = 'experimental' | 'provisional' | 'stable' | 'deprecated' | 'archived';

export interface SkillPrecondition {
  description: string;
}

/**
 * Criterios que el evaluador sabe medir por sí mismo, sin preguntarle a nadie.
 * Definen qué significa "logrado" para una habilidad. Los primeros son sobre
 * recursos (la necesidad original de la mascota); los de conducta permiten
 * juzgar habilidades que no consisten en obtener nada — un baile, una ronda,
 * una retirada — que es lo que el cuidador suele querer enseñar.
 */
export type EvaluationCriterionType =
  | 'energyIncreased'
  | 'temperatureIncreased'
  | 'craftedKind'
  | 'consumedKind'
  | 'reachedAdjacentKind'
  | 'holdingKind'
  | 'minMoves'
  | 'returnedToStart'
  | 'netDisplacementAtLeast'
  | 'visitedDistinctCells'
  | 'noDamageTaken'
  | 'maxTicks'
  | 'maxIntents';

export interface EvaluationCriterion {
  /** Criterios entendidos por el evaluador (ver skill-evaluator). */
  type: EvaluationCriterionType;
  kind?: string;
  value?: number;
}

/**
 * De dónde viene la vara con la que se juzga una habilidad (ADR 0030). No es
 * un adorno: es lo que impide que la mascota se apruebe su propio examen.
 *
 * - `motive`: el criterio lo deriva el motor de un estado medido de la criatura
 *   (tener frío, tener hambre). Un motivo tiene firma objetiva en el mundo, así
 *   que la condición de satisfacción se escribe sola y no admite trampa.
 * - `caretaker`: el criterio nació de un pedido —palabras, sin firma en el
 *   mundo—, así que lo propuso un modelo y lo confirmó el cuidador. Un pedido
 *   sin confirmar no promueve nada: `holdingKind: martillo` es un logro válido,
 *   pero puede no ser *ese* logro.
 *
 * Ausente en un artefacto quiere decir "anterior a este ADR": se re-confirma
 * antes de volver a promoverse.
 */
export type CriterionSource = 'motive' | 'caretaker';

/**
 * Un criterio propuesto por un modelo es tan poco confiable como un programa:
 * sin esta puerta, una habilidad podría "aprobarse" contra un contrato vacío
 * o incoherente. Cada forma exige exactamente los campos que el evaluador
 * necesita para medirla.
 */
const criterionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('energyIncreased') }).strict(),
  z.object({ type: z.literal('temperatureIncreased') }).strict(),
  z.object({ type: z.literal('craftedKind'), kind: z.string().min(1) }).strict(),
  z.object({ type: z.literal('consumedKind'), kind: z.string().min(1) }).strict(),
  z.object({ type: z.literal('reachedAdjacentKind'), kind: z.string().min(1) }).strict(),
  z.object({ type: z.literal('holdingKind'), kind: z.string().min(1) }).strict(),
  z.object({ type: z.literal('minMoves'), value: z.number().int().min(1).max(200) }).strict(),
  z.object({ type: z.literal('returnedToStart') }).strict(),
  z
    .object({ type: z.literal('netDisplacementAtLeast'), value: z.number().int().min(1).max(50) })
    .strict(),
  z
    .object({ type: z.literal('visitedDistinctCells'), value: z.number().int().min(2).max(100) })
    .strict(),
  z.object({ type: z.literal('noDamageTaken') }).strict(),
  z.object({ type: z.literal('maxTicks'), value: z.number().int().min(1).max(1000) }).strict(),
  z.object({ type: z.literal('maxIntents'), value: z.number().int().min(1).max(1000) }).strict(),
]);

const successCriteriaSchema = z.array(criterionSchema).min(1).max(4);

/**
 * Valida los criterios de éxito de un contrato de fuente no confiable. Es la
 * puerta equivalente a `validateSkillProgram`, pero del lado del contrato: el
 * programa dice qué hace la mascota, el contrato dice cuándo cuenta como
 * logrado, y ninguno de los dos puede venir crudo de un modelo.
 */
export function validateSuccessCriteria(raw: unknown): Result<EvaluationCriterion[]> {
  const parsed = successCriteriaSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      `Criterios inválidos: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
    );
  }
  const types = parsed.data.map((c) => c.type);
  if (new Set(types).size !== types.length) {
    return err('Criterios inválidos: hay criterios repetidos');
  }
  // Un contrato que solo acota el costo no define ningún logro: cualquier
  // programa que no haga nada lo cumpliría.
  if (types.every((type) => type === 'maxTicks' || type === 'maxIntents')) {
    return err('Criterios inválidos: ninguno describe un logro observable');
  }
  return ok(parsed.data);
}

/** El contrato en palabras: para el diseñador, para la UI y para el cuidador. */
export function describeCriterion(criterion: EvaluationCriterion): string {
  switch (criterion.type) {
    case 'energyIncreased':
      return 'su energía termina más alta';
    case 'temperatureIncreased':
      return 'su calor corporal termina más alto';
    case 'craftedKind':
      return `construye un objeto de tipo ${criterion.kind}`;
    case 'consumedKind':
      return `consume un objeto de tipo ${criterion.kind}`;
    case 'reachedAdjacentKind':
      return `termina junto a un objeto de tipo ${criterion.kind}`;
    case 'holdingKind':
      return `termina llevando un objeto de tipo ${criterion.kind}`;
    case 'minMoves':
      return `hace al menos ${criterion.value} movimientos efectivos`;
    case 'returnedToStart':
      return 'termina en la misma casilla donde empezó';
    case 'netDisplacementAtLeast':
      return `termina a ${criterion.value} casillas o más de donde empezó`;
    case 'visitedDistinctCells':
      return `pisa al menos ${criterion.value} casillas distintas`;
    case 'noDamageTaken':
      return 'no recibe daño';
    case 'maxTicks':
      return `no tarda más de ${criterion.value} ticks`;
    case 'maxIntents':
      return `no usa más de ${criterion.value} acciones`;
  }
}

export interface SafetyInvariant {
  description: string;
}

export interface SkillDependency {
  skillId: string;
}

export interface SkillMetrics {
  totalRuns: number;
  successfulRuns: number;
  /** Última tasa de éxito medida por el evaluador (0..1). */
  lastEvaluationSuccessRate?: number;
}

export interface KnownFailure {
  id: string;
  scenarioName: string;
  seed: number;
  description: string;
  observedAtVersion: number;
}

/**
 * Contrato completo de una habilidad. Una habilidad no está "aprendida"
 * porque exista: solo cuenta cuando su historial de evaluación la respalda.
 */
export interface SkillDefinition {
  id: string;
  name: string;
  version: number;
  status: SkillStatus;
  description: string;
  /** Por qué se creó: la necesidad detectada, registrada por el agente. */
  motivation: string;

  inputsSchema: unknown;
  preconditions: SkillPrecondition[];
  program: SkillProgram;

  expectedOutcome: string;
  successCriteria: EvaluationCriterion[];
  /** Quién escribió la vara (ADR 0030). Ausente = artefacto anterior al ADR. */
  criterionSource?: CriterionSource;
  safetyInvariants: SafetyInvariant[];

  dependencies: SkillDependency[];
  parentVersionId?: string;

  metrics: SkillMetrics;
  knownFailures: KnownFailure[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface NewSkillInput {
  name: string;
  description: string;
  motivation: string;
  program: SkillProgram;
  expectedOutcome: string;
  successCriteria: EvaluationCriterion[];
  criterionSource?: CriterionSource;
  preconditions?: SkillPrecondition[];
  safetyInvariants?: SafetyInvariant[];
  dependencies?: SkillDependency[];
  createdAt: string;
}

/**
 * Biblioteca versionada de habilidades. Guarda cada versión como una entrada
 * inmutable; la promoción y el archivado solo cambian el estado.
 */
/** Estado serializable de la biblioteca (para persistencia y artefactos). */
export interface SkillLibraryData {
  skills: SkillDefinition[];
  counter: number;
}

export class SkillLibrary {
  private skills = new Map<string, SkillDefinition>();
  private counter = 0;

  serialize(): SkillLibraryData {
    return structuredClone({ skills: [...this.skills.values()], counter: this.counter });
  }

  loadFrom(data: SkillLibraryData): void {
    const clone = structuredClone(data);
    this.skills = new Map(clone.skills.map((s) => [s.id, s]));
    this.counter = clone.counter;
  }

  addExperimental(input: NewSkillInput, parentVersionId?: string): SkillDefinition {
    const parent = parentVersionId ? this.skills.get(parentVersionId) : undefined;
    // La versión es única y monótona por nombre, no `padre + 1`: el ciclo de
    // revisión puede ramificar desde la mejor versión (no la última), y dos
    // hijas de la misma base no pueden llamarse igual.
    const priorVersions = [...this.skills.values()]
      .filter((s) => s.name === input.name)
      .map((s) => s.version);
    const version = priorVersions.length === 0 ? 1 : Math.max(...priorVersions) + 1;
    this.counter += 1;
    const skill: SkillDefinition = {
      id: `skill-${this.counter}`,
      name: input.name,
      version,
      status: 'experimental',
      description: input.description,
      motivation: input.motivation,
      inputsSchema: null,
      preconditions: input.preconditions ?? [],
      program: input.program,
      expectedOutcome: input.expectedOutcome,
      successCriteria: input.successCriteria,
      // El origen de la vara viaja con la habilidad y se hereda de la versión
      // padre si esta revisión no lo declara: revisar el programa no cambia
      // quién escribió el criterio.
      ...(input.criterionSource !== undefined
        ? { criterionSource: input.criterionSource }
        : parent?.criterionSource !== undefined
          ? { criterionSource: parent.criterionSource }
          : {}),
      safetyInvariants: input.safetyInvariants ?? [
        { description: 'No violar invariantes estructurales del mundo' },
      ],
      dependencies: input.dependencies ?? [],
      ...(parentVersionId !== undefined ? { parentVersionId } : {}),
      metrics: { totalRuns: 0, successfulRuns: 0 },
      knownFailures: parent ? [...parent.knownFailures] : [],
      createdAt: input.createdAt,
    };
    this.skills.set(skill.id, skill);
    return skill;
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  all(): SkillDefinition[] {
    return [...this.skills.values()];
  }

  /** Versión estable más reciente de una habilidad por nombre. */
  findStable(name: string): SkillDefinition | undefined {
    return this.all()
      .filter((s) => s.name === name && s.status === 'stable')
      .sort((a, b) => b.version - a.version)[0];
  }

  /**
   * La mejor provisional de una habilidad: medida, imperfecta y utilizable
   * mientras no haya estable (ADR 0050). Se elige por tasa de éxito, no por
   * versión: una v5 que empeoró no le gana a la v3 que iba mejor.
   */
  findProvisional(name: string): SkillDefinition | undefined {
    return this.all()
      .filter((s) => s.name === name && s.status === 'provisional')
      .sort(
        (a, b) =>
          (b.metrics.lastEvaluationSuccessRate ?? 0) - (a.metrics.lastEvaluationSuccessRate ?? 0) ||
          b.version - a.version,
      )[0];
  }

  /**
   * Lo que puede ejecutar YA: la estable si existe, y si no, la mejor
   * provisional. El orden importa y no es negociable — una provisional nunca le
   * gana a una probada.
   */
  findUsable(name: string): SkillDefinition | undefined {
    return this.findStable(name) ?? this.findProvisional(name);
  }

  versionsOf(name: string): SkillDefinition[] {
    return this.all()
      .filter((s) => s.name === name)
      .sort((a, b) => a.version - b.version);
  }

  markPromoted(id: string): void {
    const skill = this.skills.get(id);
    if (!skill) throw new Error(`Skill desconocida: ${id}`);
    // Las versiones estables anteriores del mismo nombre quedan deprecadas.
    for (const other of this.all()) {
      if (other.name === skill.name && other.id !== id && other.status === 'stable') {
        other.status = 'deprecated';
      }
    }
    skill.status = 'stable';
  }

  /**
   * Rechazada, pero guardable como lo mejor que tiene (ADR 0050): `usable`
   * distingue "no llegó a la vara" de "no sirve". Las provisionales anteriores
   * del mismo nombre se archivan — se guarda una sola, la de turno.
   */
  markRejected(id: string, failure: KnownFailure, usable = false): void {
    const skill = this.skills.get(id);
    if (!skill) throw new Error(`Skill desconocida: ${id}`);
    skill.knownFailures.push(failure);
    if (!usable) {
      skill.status = 'archived';
      return;
    }
    // "Lo mejor que tengo" es lo mejor MEDIDO, no lo último intentado: una v2
    // que empeoró no destrona a la v1 que iba mejor. Sin esta comparación,
    // seguir puliendo podía dejarla peor armada que antes de empezar.
    const rate = skill.metrics.lastEvaluationSuccessRate ?? 0;
    const incumbent = this.findProvisional(skill.name);
    if (incumbent && incumbent.id !== skill.id) {
      if ((incumbent.metrics.lastEvaluationSuccessRate ?? 0) >= rate) {
        skill.status = 'archived';
        return;
      }
      incumbent.status = 'archived';
    }
    skill.status = 'provisional';
  }

  recordUse(id: string, success: boolean, at: string): void {
    const skill = this.skills.get(id);
    if (!skill) return;
    skill.metrics.totalRuns += 1;
    if (success) skill.metrics.successfulRuns += 1;
    skill.lastUsedAt = at;
  }
}
