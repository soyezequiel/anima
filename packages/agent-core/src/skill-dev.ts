import type { EventLog } from '@anima/shared';
import type { ModelProvider } from '@anima/model-providers';
import type {
  EvaluationCriterion,
  SkillDefinition,
  SkillLibrary,
  SkillProgram,
} from '@anima/skill-runtime';
import { validateSkillProgram } from '@anima/skill-runtime';
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
  let previousProgram: SkillProgram | null = null;
  let lastReport: EvaluationReport | null = null;

  for (let attempt = 1; attempt <= config.maxVersions; attempt++) {
    const response =
      attempt === 1
        ? await config.provider.complete({
            kind: 'skill.propose',
            skillName: contract.name,
            problem: contract.purpose,
            context,
          })
        : await config.provider.complete({
            kind: 'skill.revise',
            skillName: contract.name,
            previousProgram,
            failureObservations: lastReport?.failureObservations ?? [],
            attempt,
          });
    if (response.kind !== 'skill.program') break;

    // Nada de lo que proponga el modelo se ejecuta sin validación.
    const validated = validateSkillProgram(response.program);
    if (!validated.ok) {
      events.emit({
        type: 'skill.rejected',
        tick,
        data: { name: contract.name, attempt, reason: `programa inválido: ${validated.error}` },
      });
      continue;
    }

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
    reports.push(report);

    const decisionOptions: Parameters<typeof applyEvaluation>[4] = { now: config.now };
    if (lastReport) decisionOptions.baseline = lastReport;
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
      return { stableSkill: skill, versionsTried: attempt, reports };
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
    parentId = skill.id;
    previousProgram = validated.value;
    lastReport = report;
  }

  return { stableSkill: null, versionsTried: reports.length, reports };
}
