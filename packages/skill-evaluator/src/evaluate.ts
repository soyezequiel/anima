import { isAdjacent } from '@anima/shared';
import type { EntityId, WorldState } from '@anima/sim-core';
import { findByKind, getEntity, restoreSnapshot } from '@anima/sim-core';
import type {
  EvaluationCriterion,
  SkillDefinition,
  SkillLibrary,
  SkillRunReport,
} from '@anima/skill-runtime';
import { runSkillProgram } from '@anima/skill-runtime';
import type { RegressionCase } from './regressions.js';

/**
 * El evaluador es independiente del generador de habilidades: ejecuta el
 * programa en mundos aislados y deterministas, mide y decide. El modelo que
 * propuso la habilidad no participa en este veredicto.
 */

export interface NamedScenario {
  name: string;
  build: (seed: number) => { world: WorldState; petId: EntityId };
}

export interface EvaluationCaseResult {
  scenario: string;
  seed: number;
  fromRegression: boolean;
  passed: boolean;
  runOutcome: SkillRunReport['outcome'];
  runReason?: string;
  criteriaFailed: string[];
  metrics: {
    ticks: number;
    intents: number;
    energyDelta: number;
    damageTaken: number;
    invariantViolations: number;
  };
  observations: string[];
}

export interface EvaluationReport {
  skillId: string;
  skillName: string;
  version: number;
  cases: EvaluationCaseResult[];
  successRate: number;
  invariantViolations: number;
  /** Observaciones agregadas de los casos fallidos: insumo para la revisión. */
  failureObservations: string[];
  avgTicksOnSuccess: number | null;
}

export interface EvaluateOptions {
  scenarios: NamedScenario[];
  seeds: number[];
  /** Casos de regresión adicionales (fallos históricos que deben superarse). */
  regressions?: RegressionCase[];
  maxTicks?: number;
  library?: SkillLibrary;
}

function checkCriterion(
  criterion: EvaluationCriterion,
  report: SkillRunReport,
  world: WorldState,
  petId: EntityId,
): boolean {
  switch (criterion.type) {
    case 'energyIncreased':
      return report.energyDelta > 0;
    case 'consumedKind':
      return report.events.some(
        (e) => e.type === 'item.consumed' && e.data.itemKind === criterion.kind,
      );
    case 'reachedAdjacentKind': {
      const pet = getEntity(world, petId);
      const petPos = pet?.components.position;
      if (!petPos) return false;
      const consumed = report.events.some(
        (e) => e.type === 'item.consumed' && e.data.itemKind === criterion.kind,
      );
      if (consumed) return true;
      return findByKind(world, criterion.kind ?? '').some(
        (e) => e.components.position && isAdjacent(petPos, e.components.position),
      );
    }
    case 'maxTicks':
      return report.ticks <= (criterion.value ?? Infinity);
    case 'maxIntents':
      return report.intents <= (criterion.value ?? Infinity);
  }
}

function deriveObservations(report: SkillRunReport, criteriaFailed: string[]): string[] {
  const observations: string[] = [];
  const zeroDamage = report.events.filter(
    (e) => e.type === 'entity.damaged' && e.data.damage === 0,
  );
  if (zeroDamage.length > 0) {
    const kinds = [...new Set(zeroDamage.map((e) => `${String(e.data.itemKind)}->${String(e.data.targetKind)}`))];
    observations.push(`no-damage-dealt:${kinds.join(',')}`);
  }
  const blockedMoves = report.events.filter(
    (e) => e.type === 'action.resolved' && e.data.success === false && e.data.reason === 'blocked',
  );
  if (blockedMoves.length > 0) observations.push(`path-blocked:${blockedMoves.length}`);
  if (report.outcome === 'timeout') observations.push('timeout');
  if (report.outcome === 'limit-exceeded') observations.push(`limit-exceeded:${report.reason ?? ''}`);
  if (report.outcome === 'aborted') observations.push(`aborted:${report.reason ?? ''}`);
  for (const criterion of criteriaFailed) observations.push(`criteria-failed:${criterion}`);
  return observations;
}

/** Ejecuta un caso aislado (escenario + semilla) y evalúa los criterios del contrato. */
function runCase(
  skill: SkillDefinition,
  scenario: NamedScenario,
  seed: number,
  fromRegression: boolean,
  options: EvaluateOptions,
): EvaluationCaseResult {
  // Mundo fresco y aislado: nada de lo que pase aquí toca el mundo real.
  const { world, petId } = scenario.build(seed);
  const runOptions: Parameters<typeof runSkillProgram>[3] = {
    maxTicks: options.maxTicks ?? 200,
    checkInvariantsEachTick: true,
  };
  if (options.library) runOptions.library = options.library;
  const report = runSkillProgram(world, petId, skill.program, runOptions);

  const criteriaFailed = skill.successCriteria
    .filter((c) => !checkCriterion(c, report, world, petId))
    .map((c) => (c.kind ? `${c.type}:${c.kind}` : c.type));
  const violated = report.invariantViolations.length > 0;
  const passed = criteriaFailed.length === 0 && !violated && report.outcome === 'completed';

  return {
    scenario: scenario.name,
    seed,
    fromRegression,
    passed,
    runOutcome: report.outcome,
    ...(report.reason !== undefined ? { runReason: report.reason } : {}),
    criteriaFailed,
    metrics: {
      ticks: report.ticks,
      intents: report.intents,
      energyDelta: report.energyDelta,
      damageTaken: report.damageTaken,
      invariantViolations: report.invariantViolations.length,
    },
    observations: passed ? [] : deriveObservations(report, criteriaFailed),
  };
}

export function evaluateSkill(skill: SkillDefinition, options: EvaluateOptions): EvaluationReport {
  const scenarioByName = new Map(options.scenarios.map((s) => [s.name, s]));
  const cases: EvaluationCaseResult[] = [];
  const seen = new Set<string>();

  for (const scenario of options.scenarios) {
    for (const seed of options.seeds) {
      seen.add(`${scenario.name}:${seed}`);
      cases.push(runCase(skill, scenario, seed, false, options));
    }
  }
  for (const regression of options.regressions ?? []) {
    const key = `${regression.scenarioName}:${regression.seed}`;
    if (seen.has(key)) continue;
    // Caso de mundo real: el mundo viene embebido como snapshot, tal cual
    // estaba cuando la skill falló en uso real.
    if (regression.snapshot && regression.petId) {
      const snapshot = regression.snapshot;
      const petId = regression.petId;
      const scenario: NamedScenario = {
        name: regression.scenarioName,
        build: () => ({ world: restoreSnapshot(snapshot), petId }),
      };
      seen.add(key);
      cases.push(runCase(skill, scenario, regression.seed, true, options));
      continue;
    }
    const scenario = scenarioByName.get(regression.scenarioName);
    if (!scenario) continue;
    seen.add(key);
    cases.push(runCase(skill, scenario, regression.seed, true, options));
  }

  const passedCases = cases.filter((c) => c.passed);
  const successTicks = passedCases.map((c) => c.metrics.ticks);
  return {
    skillId: skill.id,
    skillName: skill.name,
    version: skill.version,
    cases,
    successRate: cases.length === 0 ? 0 : passedCases.length / cases.length,
    invariantViolations: cases.reduce((sum, c) => sum + c.metrics.invariantViolations, 0),
    failureObservations: [...new Set(cases.flatMap((c) => c.observations))],
    avgTicksOnSuccess:
      successTicks.length === 0
        ? null
        : successTicks.reduce((a, b) => a + b, 0) / successTicks.length,
  };
}
