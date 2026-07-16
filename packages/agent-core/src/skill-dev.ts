import type { EventLog } from '@anima/shared';
import type { ModelProvider } from '@anima/model-providers';
import type { EvaluationCriterion, SkillDefinition, SkillLibrary } from '@anima/skill-runtime';
import { describeCriterion, validateSkillProgram } from '@anima/skill-runtime';
import type { EvaluationReport, NamedScenario, RegressionStore } from '@anima/skill-evaluator';
import { applyEvaluation, evaluateSkill } from '@anima/skill-evaluator';
import type { AgentEvent } from './events.js';

/**
 * Ciclo cerrado de desarrollo de habilidades:
 * contrato -> candidata -> pruebas -> métricas -> análisis -> corrección ->
 * promoción. El generador (el modelo) propone; el evaluador (determinista e
 * independiente) decide. Los fallos quedan como regresiones reproducibles.
 */

export interface SkillContract {
  name: string;
  purpose: string;
  motivation: string;
  expectedOutcome: string;
  successCriteria: EvaluationCriterion[];
}

export interface SkillDevConfig {
  provider: ModelProvider;
  library: SkillLibrary;
  regressions: RegressionStore;
  scenarios: NamedScenario[];
  seeds: number[];
  maxTicksPerCase: number;
  /** Cuántas versiones puede intentar antes de rendirse (propuesta + revisiones). */
  maxVersions: number;
  now: () => string;
}

export interface SkillDevOutcome {
  stableSkill: SkillDefinition | null;
  versionsTried: number;
  reports: EvaluationReport[];
}

/**
 * Evalúa una candidata en mundos aislados y aplica el veredicto sobre la
 * biblioteca, emitiendo los eventos de prueba. Lo usan tanto el ciclo de
 * desarrollo como la adopción de habilidades heredadas de un legado.
 */
export function evaluateAndApply(
  skill: SkillDefinition,
  config: Pick<
    SkillDevConfig,
    'library' | 'regressions' | 'scenarios' | 'seeds' | 'maxTicksPerCase' | 'now'
  >,
  events: EventLog<AgentEvent>,
  tick: number,
  baseline?: EvaluationReport,
): { report: EvaluationReport; promoted: boolean } {
  events.emit({
    type: 'skill.test.started',
    tick,
    data: {
      skillId: skill.id,
      version: skill.version,
      scenarios: config.scenarios.map((s) => s.name),
      seeds: config.seeds,
      regressions: config.regressions.forSkill(skill.name).length,
    },
  });
  const report = evaluateSkill(skill, {
    scenarios: config.scenarios,
    seeds: config.seeds,
    regressions: config.regressions.forSkill(skill.name),
    maxTicks: config.maxTicksPerCase,
    library: config.library,
  });
  const decisionOptions: Parameters<typeof applyEvaluation>[4] = { now: config.now };
  if (baseline) decisionOptions.baseline = baseline;
  const decision = applyEvaluation(skill, report, config.library, config.regressions, decisionOptions);

  if (decision.verdict === 'promoted') {
    events.emit({
      type: 'skill.test.passed',
      tick,
      data: { skillId: skill.id, version: skill.version, successRate: report.successRate },
    });
    events.emit({
      type: 'skill.promoted',
      tick,
      data: { skillId: skill.id, name: skill.name, version: skill.version, reasons: decision.reasons },
    });
    return { report, promoted: true };
  }
  events.emit({
    type: 'skill.test.failed',
    tick,
    data: {
      skillId: skill.id,
      version: skill.version,
      successRate: report.successRate,
      observations: report.failureObservations,
      regressionsAdded: decision.regressionsAdded,
    },
  });
  return { report, promoted: false };
}

export async function developSkill(
  contract: SkillContract,
  context: string[],
  config: SkillDevConfig,
  events: EventLog<AgentEvent>,
  tick: number,
): Promise<SkillDevOutcome> {
  events.emit({
    type: 'skill.requested',
    tick,
    data: { name: contract.name, purpose: contract.purpose, motivation: contract.motivation },
  });

  const reports: EvaluationReport[] = [];
  let parentId: string | undefined;
  let previousProgram: unknown = null;
  let lastReport: EvaluationReport | null = null;
  let validationFeedback: string[] | null = null;
  let invalidRetries = 0;
  let firstCall = true;

  for (let attempt = 1; attempt <= config.maxVersions; ) {
    const response = firstCall
      ? await config.provider.complete({
          kind: 'skill.propose',
          skillName: contract.name,
          problem: contract.purpose,
          context,
          // El diseñador tiene que conocer la vara con la que lo van a medir;
          // que la conozca no lo hace juez: el evaluador la aplica aparte.
          successCriteria: contract.successCriteria.map(describeCriterion),
        })
      : await config.provider.complete({
          kind: 'skill.revise',
          skillName: contract.name,
          previousProgram,
          failureObservations: validationFeedback ?? lastReport?.failureObservations ?? [],
          attempt,
        });
    firstCall = false;
    if (response.kind !== 'skill.program') break;

    // Nada de lo que proponga el modelo se ejecuta sin validación.
    const validated = validateSkillProgram(response.program);
    if (!validated.ok) {
      events.emit({
        type: 'skill.rejected',
        tick,
        data: { name: contract.name, attempt, reason: `programa inválido: ${validated.error}` },
      });
      // Un programa inválido no costó simulación: no consume el intento.
      // El error de validación vuelve al modelo como retroalimentación.
      invalidRetries += 1;
      if (invalidRetries > 2) break;
      previousProgram = response.program;
      validationFeedback = [`programa-invalido: ${validated.error}`];
      continue;
    }
    validationFeedback = null;

    // Si la "nueva" versión es idéntica a la anterior, no aporta nada.
    if (previousProgram && JSON.stringify(previousProgram) === JSON.stringify(validated.value)) {
      events.emit({
        type: 'skill.rejected',
        tick,
        data: { name: contract.name, attempt, reason: 'propuesta idéntica a la versión fallida' },
      });
      break;
    }

    const skill = config.library.addExperimental(
      {
        name: contract.name,
        description: contract.purpose,
        motivation: contract.motivation,
        program: validated.value,
        expectedOutcome: contract.expectedOutcome,
        successCriteria: contract.successCriteria,
        createdAt: config.now(),
      },
      parentId,
    );
    events.emit({
      type: 'skill.created',
      tick,
      data: { skillId: skill.id, name: skill.name, version: skill.version, rationale: response.rationale },
    });

    const { report, promoted } = evaluateAndApply(
      skill,
      config,
      events,
      tick,
      lastReport ?? undefined,
    );
    reports.push(report);
    if (promoted) {
      return { stableSkill: skill, versionsTried: attempt, reports };
    }
    parentId = skill.id;
    previousProgram = validated.value;
    lastReport = report;
    attempt += 1;
  }

  return { stableSkill: null, versionsTried: reports.length, reports };
}
