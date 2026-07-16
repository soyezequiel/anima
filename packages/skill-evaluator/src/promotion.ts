import type { SkillDefinition, SkillLibrary } from '@anima/skill-runtime';
import type { EvaluationReport } from './evaluate.js';
import type { RegressionStore } from './regressions.js';

export interface PromotionPolicy {
  /** Tasa de éxito mínima sobre todos los casos (incluidas regresiones). */
  successThreshold: number;
}

export const DEFAULT_PROMOTION_POLICY: PromotionPolicy = {
  successThreshold: 1,
};

export interface PromotionDecision {
  verdict: 'promoted' | 'rejected';
  reasons: string[];
  regressionsAdded: number;
}

/**
 * Aplica el veredicto del evaluador sobre la biblioteca:
 * - Si pasa el umbral, no viola invariantes y no empeora a la versión
 *   anterior, la habilidad se promueve a estable.
 * - Si falla, se archiva y cada caso fallido se conserva como regresión
 *   reproducible que las versiones futuras deberán superar.
 */
export function applyEvaluation(
  skill: SkillDefinition,
  report: EvaluationReport,
  library: SkillLibrary,
  regressions: RegressionStore,
  options: { policy?: PromotionPolicy; baseline?: EvaluationReport; now: () => string },
): PromotionDecision {
  const policy = options.policy ?? DEFAULT_PROMOTION_POLICY;
  const reasons: string[] = [];

  skill.metrics.lastEvaluationSuccessRate = report.successRate;

  if (report.successRate < policy.successThreshold) {
    reasons.push(
      `tasa de éxito ${(report.successRate * 100).toFixed(0)}% < umbral ${(policy.successThreshold * 100).toFixed(0)}%`,
    );
  }
  if (report.invariantViolations > 0) {
    reasons.push(`viola invariantes del mundo (${report.invariantViolations})`);
  }
  if (options.baseline && report.successRate < options.baseline.successRate) {
    reasons.push(
      `empeora a la versión anterior (${(options.baseline.successRate * 100).toFixed(0)}% -> ${(report.successRate * 100).toFixed(0)}%)`,
    );
  }

  if (reasons.length > 0) {
    let regressionsAdded = 0;
    for (const failedCase of report.cases.filter((c) => !c.passed)) {
      regressions.add({
        skillName: skill.name,
        scenarioName: failedCase.scenario,
        seed: failedCase.seed,
        description: `v${skill.version} falló: ${failedCase.observations.join(', ') || failedCase.runOutcome}`,
        createdAt: options.now(),
      });
      regressionsAdded += 1;
    }
    library.markRejected(skill.id, {
      id: `fail-${skill.id}`,
      scenarioName: report.cases.find((c) => !c.passed)?.scenario ?? 'desconocido',
      seed: report.cases.find((c) => !c.passed)?.seed ?? -1,
      description: report.failureObservations.join('; '),
      observedAtVersion: skill.version,
    });
    return { verdict: 'rejected', reasons, regressionsAdded };
  }

  library.markPromoted(skill.id);
  reasons.push(
    `supera todos los casos (${report.cases.length}) incluidas ${report.cases.filter((c) => c.fromRegression).length} regresiones`,
  );
  if (options.baseline) {
    reasons.push(`no empeora a la versión anterior`);
  }
  return { verdict: 'promoted', reasons, regressionsAdded: 0 };
}
