import type { EventLog } from '@anima/shared';
import type { ModelProvider, ModelResponse } from '@anima/model-providers';
import type {
  CriterionSource,
  EvaluationCriterion,
  SkillDefinition,
  SkillLibrary,
} from '@anima/skill-runtime';
import { describeCriterion, validateSkillProgram } from '@anima/skill-runtime';
import type {
  EvaluationCaseHook,
  EvaluationReport,
  NamedScenario,
  RegressionStore,
} from '@anima/skill-evaluator';
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
  /**
   * Quién escribió la vara (ADR 0030). `motive`: la derivó el motor de una
   * necesidad del cuerpo, sin trampa posible. `caretaker`: la propuso un modelo
   * a partir de un pedido y la confirmó el cuidador. Un contrato de motivo no
   * puede traer criterios de un modelo, y uno de pedido no se promueve sin que
   * una persona lo haya mirado.
   */
  criterionSource: CriterionSource;
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
  /** Oyente de los mundos imaginados: la UI dibuja los "sueños" con esto. */
  onCase?: EvaluationCaseHook;
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
    'library' | 'regressions' | 'scenarios' | 'seeds' | 'maxTicksPerCase' | 'now' | 'onCase'
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
    ...(config.onCase ? { onCase: config.onCase } : {}),
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

/** Una versión ya evaluada, con su programa y su informe: la memoria del ciclo. */
interface EvaluatedVersion {
  skillId: string;
  version: number;
  program: unknown;
  rationale: string;
  report: EvaluationReport;
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
    data: {
      name: contract.name,
      purpose: contract.purpose,
      motivation: contract.motivation,
      // Cuántas versiones puede costar el ciclo: la UI lo usa para decir
      // "intento 2 de 8" mientras el cuidador espera.
      maxVersions: config.maxVersions,
    },
  });

  const reports: EvaluationReport[] = [];
  // El diseñador tiene que conocer la vara con la que lo van a medir;
  // que la conozca no lo hace juez: el evaluador la aplica aparte.
  const criteria = contract.successCriteria.map(describeCriterion);
  const attemptHistory: EvaluatedVersion[] = [];
  /** Programa canónico -> versión que lo probó: repetir no es corregir. */
  const triedPrograms = new Map<string, number>();
  /** La mejor versión hasta ahora: la base sobre la que se corrige. */
  let best: EvaluatedVersion | null = null;
  /**
   * Propuesta inválida o repetida: vuelve al modelo sin gastar el intento.
   * Lleva el motivo, porque la consulta de vuelta tiene que decir la verdad:
   * una forma que no se pudo leer no es una estrategia que no alcanzó.
   */
  let retryFeedback: {
    program: unknown;
    observations: string[];
    reason: 'invalid-program' | 'repeated-program';
  } | null = null;
  let invalidRetries = 0;
  let repeatedRetries = 0;

  for (let attempt = 1; attempt <= config.maxVersions; ) {
    const response: ModelResponse =
      best === null && retryFeedback === null
        ? await config.provider.complete({
            kind: 'skill.propose',
            skillName: contract.name,
            problem: contract.purpose,
            context,
            successCriteria: criteria,
          })
        : await config.provider.complete({
            kind: 'skill.revise',
            skillName: contract.name,
            problem: contract.purpose,
            // Sin feedback pendiente, lo que hay es una versión que se midió
            // en simulación y no alcanzó. Con feedback, ni se llegó a medir.
            reason: retryFeedback ? retryFeedback.reason : 'evaluation-failed',
            successCriteria: criteria,
            context,
            // Con feedback pendiente se corrige ESA propuesta (su error de forma
            // o su repetición); si no, se parte de la mejor versión medida, no
            // de la última: una revisión que empeoró no se vuelve la base.
            previousProgram: retryFeedback ? retryFeedback.program : best?.program,
            failureObservations: retryFeedback
              ? retryFeedback.observations
              : (best?.report.failureObservations ?? []),
            ...(best && !retryFeedback
              ? {
                  baseVersion: best.version,
                  caseResults: best.report.cases.map((c) => ({
                    scenario: c.scenario,
                    seed: c.seed,
                    verdict: c.verdict,
                    observations: c.observations,
                  })),
                }
              : {}),
            ...(attemptHistory.length > 0
              ? {
                  history: attemptHistory.map((v) => ({
                    version: v.version,
                    rationale: v.rationale,
                    successRate: v.report.successRate,
                    failureObservations: v.report.failureObservations,
                  })),
                }
              : {}),
            attempt,
            maxAttempts: config.maxVersions,
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
      // Un programa inválido no costó simulación: no consume el intento.
      // El error de validación vuelve al modelo como retroalimentación.
      // El tope cuenta errores CONSECUTIVOS: lo que mata el ciclo es insistir
      // con una forma que no se puede leer, no haberse equivocado tres veces
      // sueltas a lo largo de ocho versiones. Sin el reseteo, un tropiezo de
      // forma en la v2, otro en la v5 y otro en la v7 cerraban un ciclo que
      // venía corrigiendo bien.
      invalidRetries += 1;
      if (invalidRetries > 2) break;
      retryFeedback = {
        program: response.program,
        observations: [`programa-invalido: ${validated.error}`],
        reason: 'invalid-program',
      };
      continue;
    }

    // Una propuesta idéntica a CUALQUIER versión ya probada no aporta nada,
    // pero tampoco costó simulación: vuelve como retroalimentación en lugar
    // de matar el ciclo, hasta que insistir demuestre que no va a corregir.
    const canonical = JSON.stringify(validated.value);
    const repeatedVersion = triedPrograms.get(canonical);
    if (repeatedVersion !== undefined) {
      events.emit({
        type: 'skill.rejected',
        tick,
        data: {
          name: contract.name,
          attempt,
          reason: `propuesta idéntica a la v${repeatedVersion} ya probada`,
        },
      });
      repeatedRetries += 1;
      if (repeatedRetries > 2) break;
      retryFeedback = {
        program: validated.value,
        observations: [
          `propuesta-repetida: es idéntica a la v${repeatedVersion}, que ya falló. Cambia de enfoque: no repitas ninguna versión de la historia.`,
        ],
        reason: 'repeated-program',
      };
      continue;
    }
    // La propuesta se pudo leer y es nueva: la racha de tropiezos se corta acá.
    retryFeedback = null;
    invalidRetries = 0;
    repeatedRetries = 0;

    const skill = config.library.addExperimental(
      {
        name: contract.name,
        description: contract.purpose,
        motivation: contract.motivation,
        program: validated.value,
        expectedOutcome: contract.expectedOutcome,
        successCriteria: contract.successCriteria,
        criterionSource: contract.criterionSource,
        createdAt: config.now(),
      },
      best?.skillId,
    );
    triedPrograms.set(canonical, skill.version);
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
      // La vara de promoción es la mejor versión: superar solo a la última
      // permitiría promover una v3 peor que la v2.
      best?.report,
    );
    reports.push(report);
    if (promoted) {
      return { stableSkill: skill, versionsTried: attempt, reports };
    }
    const evaluated: EvaluatedVersion = {
      skillId: skill.id,
      version: skill.version,
      program: validated.value,
      rationale: response.rationale,
      report,
    };
    attemptHistory.push(evaluated);
    // Empate incluido: la versión más reciente incorporó más retroalimentación.
    if (!best || report.successRate >= best.report.successRate) best = evaluated;
    attempt += 1;
  }

  return { stableSkill: null, versionsTried: reports.length, reports };
}
