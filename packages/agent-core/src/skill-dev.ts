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
  /**
   * Corte por meseta (ADR 0051). Cada consulta al modelo cuesta ~un minuto de
   * reloj mientras el cuerpo sigue gastándose; si ya hay una versión que
   * funciona en la mayoría de los mundos (`keepMin`, alineado con el umbral
   * provisional del ADR 0050) y `patience` versiones seguidas no mejoraron
   * nada, las consultas restantes son plata tirada: se corta, queda la
   * provisional, y el objetivo puede reabrir el ciclo con la historia entera.
   */
  plateau?: { patience: number; keepMin: number };
}

const DEFAULT_PLATEAU = { patience: 2, keepMin: 0.6 };

export interface SkillDevOutcome {
  stableSkill: SkillDefinition | null;
  versionsTried: number;
  reports: EvaluationReport[];
  /**
   * El ciclo cortó por meseta (ADR 0051): había una versión decente en la mano
   * y varias consultas seguidas no la mejoraron. No es un fracaso distinto —
   * queda la provisional (ADR 0050) y el objetivo puede reabrir el ciclo — pero
   * decir por qué se detuvo es parte de no disimular la espera (ADR 0045).
   */
  stoppedEarly?: 'plateau';
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
  // No alcanzó la vara, pero es lo mejor que tiene y la puede usar mientras
  // sigue corrigiéndola (ADR 0050). Se anuncia aparte del fallo: son dos cosas
  // distintas —«no llegó» y «igual me sirve»— y contarlas juntas haría que
  // parezca aprobada.
  if (decision.provisional) {
    events.emit({
      type: 'skill.provisional',
      tick,
      data: {
        skillId: skill.id,
        name: skill.name,
        version: skill.version,
        successRate: report.successRate,
      },
    });
  }
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
  const plateau = config.plateau ?? DEFAULT_PLATEAU;
  /** Versiones medidas seguidas que no superaron a la mejor: la meseta. */
  let sinceImprovement = 0;

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

    // Una consulta puede traer DOS estrategias (ADR 0051): la principal y una
    // alternativa. El viaje al modelo se paga una vez; medir es local y gratis.
    // Cada candidata medida consume un intento — el presupuesto no cambia, los
    // viajes sí.
    const candidates = [
      { program: response.program, rationale: response.rationale, primary: true },
      ...(response.alternate
        ? [{ program: response.alternate.program, rationale: response.alternate.rationale, primary: false }]
        : []),
    ];

    // Qué le pasó a la PRINCIPAL si no se pudo medir: es la que gobierna la
    // retroalimentación de forma/repetición. La alternativa es un regalo — si
    // viene rota o repetida se descarta sin costo ni ceremonia.
    let primaryInvalid: string | null = null;
    let primaryRepeated: { version: number; program: unknown } | null = null;
    let measured = 0;
    let promotedSkill: SkillDefinition | null = null;

    for (const candidate of candidates) {
      if (attempt > config.maxVersions) break;

      // Nada de lo que proponga el modelo se ejecuta sin validación.
      const validated = validateSkillProgram(candidate.program);
      if (!validated.ok) {
        if (candidate.primary) {
          events.emit({
            type: 'skill.rejected',
            tick,
            data: { name: contract.name, attempt, reason: `programa inválido: ${validated.error}` },
          });
          primaryInvalid = validated.error;
        }
        continue;
      }

      // Una propuesta idéntica a CUALQUIER versión ya probada no aporta nada.
      const canonical = JSON.stringify(validated.value);
      const repeatedVersion = triedPrograms.get(canonical);
      if (repeatedVersion !== undefined) {
        if (candidate.primary) {
          events.emit({
            type: 'skill.rejected',
            tick,
            data: {
              name: contract.name,
              attempt,
              reason: `propuesta idéntica a la v${repeatedVersion} ya probada`,
            },
          });
          primaryRepeated = { version: repeatedVersion, program: validated.value };
        }
        continue;
      }

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
        data: { skillId: skill.id, name: skill.name, version: skill.version, rationale: candidate.rationale },
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
      measured += 1;
      if (promoted) {
        promotedSkill = skill;
        break;
      }
      const evaluated: EvaluatedVersion = {
        skillId: skill.id,
        version: skill.version,
        program: validated.value,
        rationale: candidate.rationale,
        report,
      };
      attemptHistory.push(evaluated);
      // La meseta cuenta mejoras ESTRICTAS: empatar a la mejor no es avanzar.
      const previousBest = best?.report.successRate ?? -1;
      sinceImprovement = report.successRate > previousBest ? 0 : sinceImprovement + 1;
      // Empate incluido: la versión más reciente incorporó más retroalimentación.
      if (!best || report.successRate >= best.report.successRate) best = evaluated;
      attempt += 1;
    }

    if (promotedSkill) {
      return { stableSkill: promotedSkill, versionsTried: attempt, reports };
    }

    if (measured > 0) {
      // Al menos una candidata se midió: la racha de tropiezos se corta acá.
      retryFeedback = null;
      invalidRetries = 0;
      repeatedRetries = 0;
      // Corte por meseta (ADR 0051): con una versión que ya vale como
      // provisional en la mano y varias versiones sin mejorar, cada consulta
      // extra es ~un minuto de mundo que se gasta sin comprar nada. Se corta;
      // la provisional queda (ADR 0050) y reabrir el ciclo sigue disponible.
      if (
        best !== null &&
        best.report.successRate >= plateau.keepMin &&
        sinceImprovement >= plateau.patience
      ) {
        events.emit({
          type: 'skill.dev.plateau',
          tick,
          data: {
            name: contract.name,
            bestRate: best.report.successRate,
            versionsTried: reports.length,
          },
        });
        return { stableSkill: null, versionsTried: reports.length, reports, stoppedEarly: 'plateau' };
      }
      continue;
    }

    // Nada se pudo medir en esta consulta: gobierna lo que le pasó a la
    // principal. Un programa inválido no costó simulación y no consume el
    // intento; el error vuelve al modelo. El tope cuenta rachas CONSECUTIVAS:
    // lo que mata el ciclo es insistir con una forma ilegible, no tres
    // tropiezos sueltos a lo largo de ocho versiones.
    if (primaryInvalid !== null) {
      invalidRetries += 1;
      if (invalidRetries > 2) break;
      retryFeedback = {
        program: response.program,
        observations: [`programa-invalido: ${primaryInvalid}`],
        reason: 'invalid-program',
      };
      continue;
    }
    if (primaryRepeated !== null) {
      repeatedRetries += 1;
      if (repeatedRetries > 2) break;
      retryFeedback = {
        program: primaryRepeated.program,
        observations: [
          `propuesta-repetida: es idéntica a la v${primaryRepeated.version}, que ya falló. Cambia de enfoque: no repitas ninguna versión de la historia.`,
        ],
        reason: 'repeated-program',
      };
      continue;
    }
    // Principal medible pero sin presupuesto (el tope cayó a mitad de la
    // consulta): no hay nada más que hacer.
    break;
  }

  return { stableSkill: null, versionsTried: reports.length, reports };
}
