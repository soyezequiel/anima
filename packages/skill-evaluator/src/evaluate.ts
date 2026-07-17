import { equalsVec2, isAdjacent, manhattan } from '@anima/shared';
import type { EntityId, WorldState } from '@anima/sim-core';
import { findByKind, findRecipe, getEntity, restoreSnapshot } from '@anima/sim-core';
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

/**
 * El veredicto de un caso aislado. `inconclusive` existe porque el mundo tira
 * dados (ADR 0020) y una habilidad no puede responder por lo que el mundo no
 * le dio (ADR 0008): sin esa categoría, la suerte se lee como capacidad. No
 * entra al denominador (ADR 0030).
 */
export type CaseVerdict = 'passed' | 'failed' | 'inconclusive';

export interface EvaluationCaseResult {
  scenario: string;
  seed: number;
  fromRegression: boolean;
  verdict: CaseVerdict;
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
  /** Sobre los casos concluyentes: lo inconcluyente no suma ni resta. */
  successRate: number;
  /** Cuántos casos quedaron a merced del mundo. Contexto de `successRate`. */
  inconclusiveCases: number;
  invariantViolations: number;
  /**
   * Observaciones agregadas de los casos **fallidos**: insumo para la revisión.
   * Lo inconcluyente queda afuera a propósito — pedirle al modelo que corrija
   * una tirada perdida es pedirle que arregle la suerte (ADR 0030).
   */
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

/** Movimientos que el mundo aceptó de verdad: los bloqueados no cuentan. */
function successfulMoves(report: SkillRunReport): number {
  return report.events.filter(
    (e) => e.type === 'action.resolved' && e.data.action === 'move' && e.data.success === true,
  ).length;
}

function distinctCells(report: SkillRunReport): number {
  return new Set(report.path.map((p) => `${p.x},${p.y}`)).size;
}

function checkCriterion(
  criterion: EvaluationCriterion,
  report: SkillRunReport,
  world: WorldState,
  petId: EntityId,
): boolean {
  const first = report.path[0];
  const last = report.path[report.path.length - 1];
  switch (criterion.type) {
    case 'energyIncreased':
      return report.energyDelta > 0;
    case 'temperatureIncreased':
      return report.temperatureDelta > 0;
    case 'craftedKind':
      return report.events.some(
        (e) => e.type === 'item.crafted' && e.data.itemKind === criterion.kind,
      );
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
    case 'holdingKind': {
      const carried = getEntity(world, petId)?.components.inventory?.items ?? [];
      return carried.some((id) => getEntity(world, id)?.kind === criterion.kind);
    }
    case 'minMoves':
      return successfulMoves(report) >= (criterion.value ?? 1);
    case 'returnedToStart':
      return first !== undefined && last !== undefined && equalsVec2(first, last);
    case 'netDisplacementAtLeast':
      return (
        first !== undefined && last !== undefined && manhattan(first, last) >= (criterion.value ?? 1)
      );
    case 'visitedDistinctCells':
      return distinctCells(report) >= (criterion.value ?? 2);
    case 'noDamageTaken':
      return report.damageTaken <= 0;
    case 'maxTicks':
      return report.ticks <= (criterion.value ?? Infinity);
    case 'maxIntents':
      return report.intents <= (criterion.value ?? Infinity);
  }
}

/**
 * ¿El intento se lo llevó el dado, sin dejarle con qué reintentar?
 *
 * El mundo ya separa las dos cosas: `resolveCraft` marca `attempt-failed`
 * cuando la chispa no agarró teniendo todo lo necesario —distinto de
 * `missing-ingredients`— justamente «para que reintentar sea distinguible de
 * rendirse» (ADR 0020).
 *
 * Perder la tirada solo excusa a la habilidad si además la dejó sin material.
 * Si le sobraba pedernal y paró igual, se rindió: y rendirse es suyo, porque
 * el ADR 0020 se ocupó de que un fallo se lleve el material pero nunca la
 * posibilidad de volver a intentarlo.
 */
function lostToTheDice(report: SkillRunReport, world: WorldState, petId: EntityId): boolean {
  const lostRolls = report.events.filter(
    (e) =>
      e.type === 'action.resolved' &&
      e.data.action === 'craft' &&
      e.data.success === false &&
      e.data.reason === 'attempt-failed',
  );
  if (lostRolls.length === 0) return false;

  const held = new Map<string, number>();
  for (const itemId of getEntity(world, petId)?.components.inventory?.items ?? []) {
    const kind = getEntity(world, itemId)?.kind;
    if (kind) held.set(kind, (held.get(kind) ?? 0) + 1);
  }
  // Basta con que UNA de las recetas que perdió siga siendo reintentable para
  // que el caso vuelva a ser suyo: tenía con qué y decidió no hacerlo.
  return lostRolls.every((roll) => {
    const recipe = findRecipe(world.recipes, String(roll.data.recipeId ?? ''));
    if (!recipe) return true;
    return recipe.ingredients.some((i) => (held.get(i.kind) ?? 0) < i.count);
  });
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
  // Construir falla por falta de ingredientes mucho más que por otra cosa:
  // decir cuáles convierte el fallo en una instrucción para la revisión.
  const failedCrafts = report.events.filter(
    (e) => e.type === 'action.resolved' && e.data.action === 'craft' && e.data.success === false,
  );
  for (const craft of failedCrafts) {
    const missing = craft.data.missing;
    if (Array.isArray(missing)) {
      const detail = missing
        .map((m) => `${String((m as { kind: string }).kind)}x${String((m as { need: number }).need)}`)
        .join(',');
      observations.push(`craft-missing:${detail}`);
    } else {
      observations.push(`craft-failed:${String(craft.data.reason ?? '')}`);
    }
  }
  if (report.outcome === 'timeout') observations.push('timeout');
  if (report.outcome === 'limit-exceeded') observations.push(`limit-exceeded:${report.reason ?? ''}`);
  if (report.outcome === 'aborted') observations.push(`aborted:${report.reason ?? ''}`);
  for (const criterion of criteriaFailed) observations.push(`criteria-failed:${criterion}`);

  // Un criterio de conducta incumplido no le dice al modelo cuánto le faltó:
  // sin la medición, la revisión sería a ciegas.
  if (criteriaFailed.includes('temperatureIncreased')) {
    observations.push(`temperature-delta:${report.temperatureDelta.toFixed(2)}`);
    if (report.damageTaken > 0) observations.push(`damage-taken:${report.damageTaken}`);
  }
  const behavioral = ['minMoves', 'returnedToStart', 'netDisplacementAtLeast', 'visitedDistinctCells'];
  if (criteriaFailed.some((c) => behavioral.includes(c))) {
    const first = report.path[0];
    const last = report.path[report.path.length - 1];
    observations.push(`moves-made:${successfulMoves(report)}`);
    observations.push(`distinct-cells:${distinctCells(report)}`);
    if (first && last) {
      observations.push(`net-displacement:${manhattan(first, last)}`);
      observations.push(`start:${first.x},${first.y} end:${last.x},${last.y}`);
    }
  }
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

  // Violar un invariante nunca es mala suerte: rompió el mundo, y eso es suyo
  // caiga como caiga el dado.
  const verdict: CaseVerdict = passed
    ? 'passed'
    : !violated && lostToTheDice(report, world, petId)
      ? 'inconclusive'
      : 'failed';

  return {
    scenario: scenario.name,
    seed,
    fromRegression,
    verdict,
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

  // El denominador son los casos que dijeron algo. Un mundo que no dio no es
  // evidencia ni a favor ni en contra (ADR 0030).
  const conclusive = cases.filter((c) => c.verdict !== 'inconclusive');
  const passedCases = conclusive.filter((c) => c.verdict === 'passed');
  const successTicks = passedCases.map((c) => c.metrics.ticks);
  return {
    skillId: skill.id,
    skillName: skill.name,
    version: skill.version,
    cases,
    successRate: conclusive.length === 0 ? 0 : passedCases.length / conclusive.length,
    inconclusiveCases: cases.length - conclusive.length,
    invariantViolations: cases.reduce((sum, c) => sum + c.metrics.invariantViolations, 0),
    failureObservations: [
      ...new Set(cases.filter((c) => c.verdict === 'failed').flatMap((c) => c.observations)),
    ],
    avgTicksOnSuccess:
      successTicks.length === 0
        ? null
        : successTicks.reduce((a, b) => a + b, 0) / successTicks.length,
  };
}
