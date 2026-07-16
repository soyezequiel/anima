import type { SkillProgram } from './dsl.js';

export type SkillStatus = 'experimental' | 'stable' | 'deprecated' | 'archived';

export interface SkillPrecondition {
  description: string;
}

export interface EvaluationCriterion {
  /** Criterios entendidos por el evaluador (ver skill-evaluator). */
  type: 'energyIncreased' | 'consumedKind' | 'reachedAdjacentKind' | 'maxTicks' | 'maxIntents';
  kind?: string;
  value?: number;
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
  preconditions?: SkillPrecondition[];
  safetyInvariants?: SafetyInvariant[];
  dependencies?: SkillDependency[];
  createdAt: string;
}

/**
 * Biblioteca versionada de habilidades. Guarda cada versión como una entrada
 * inmutable; la promoción y el archivado solo cambian el estado.
 */
export class SkillLibrary {
  private skills = new Map<string, SkillDefinition>();
  private counter = 0;

  addExperimental(input: NewSkillInput, parentVersionId?: string): SkillDefinition {
    const parent = parentVersionId ? this.skills.get(parentVersionId) : undefined;
    const version = parent ? parent.version + 1 : 1;
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

  markRejected(id: string, failure: KnownFailure): void {
    const skill = this.skills.get(id);
    if (!skill) throw new Error(`Skill desconocida: ${id}`);
    skill.status = 'archived';
    skill.knownFailures.push(failure);
  }

  recordUse(id: string, success: boolean, at: string): void {
    const skill = this.skills.get(id);
    if (!skill) return;
    skill.metrics.totalRuns += 1;
    if (success) skill.metrics.successfulRuns += 1;
    skill.lastUsedAt = at;
  }
}
