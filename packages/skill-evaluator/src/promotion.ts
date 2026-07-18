import type { SkillDefinition, SkillLibrary } from '@anima/skill-runtime';
import type { EvaluationReport } from './evaluate.js';
import type { RegressionStore } from './regressions.js';

export interface PromotionPolicy {
  /** Tasa de éxito mínima sobre todos los casos (incluidas regresiones). */
  successThreshold: number;
  /**
   * Desde qué tasa una versión rechazada se guarda como PROVISIONAL (ADR
   * 0050): no es lo bastante buena para ser estable, pero es lo mejor que
   * tiene, y quedarse quieta con una solución en la mano es peor que usarla.
   * 0.6 es "funciona en la mayoría de los mundos", no "funcionó una vez".
   */
  provisionalThreshold: number;
}

export const DEFAULT_PROMOTION_POLICY: PromotionPolicy = {
  successThreshold: 1,
  provisionalThreshold: 0.6,
};

export interface PromotionDecision {
  verdict: 'promoted' | 'rejected';
  reasons: string[];
  regressionsAdded: number;
  /** La rechazada quedó utilizable mientras no haya estable (ADR 0050). */
  provisional?: boolean;
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

  const conclusive = report.cases.length - report.inconclusiveCases;
  if (conclusive === 0) {
    // Sin un solo caso que dijera algo no hay nada que promover: no es que
    // haya fallado, es que no llegamos a saber. Distinguirlo importa, porque
    // «0%» mandaría al modelo a corregir una skill que quizá está bien.
    reasons.push(
      `sin evidencia concluyente: los ${report.cases.length} casos quedaron a merced del mundo`,
    );
  } else if (report.successRate < policy.successThreshold) {
    reasons.push(
      `tasa de éxito ${(report.successRate * 100).toFixed(0)}% (${conclusive} casos concluyentes) < umbral ${(policy.successThreshold * 100).toFixed(0)}%`,
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
    // Solo lo que falló de verdad se convierte en prueba. Archivar un caso
    // inconcluyente ataría a todas las versiones futuras a superar una tirada
    // perdida — una regresión que no prueba nada y no se puede aprobar.
    const failedCases = report.cases.filter((c) => c.verdict === 'failed');
    let regressionsAdded = 0;
    for (const failedCase of failedCases) {
      regressions.add({
        skillName: skill.name,
        scenarioName: failedCase.scenario,
        seed: failedCase.seed,
        description: `v${skill.version} falló: ${failedCase.observations.join(', ') || failedCase.runOutcome}`,
        createdAt: options.now(),
      });
      regressionsAdded += 1;
    }
    // No llegó a la vara, pero puede ser lo mejor que tiene (ADR 0050). Se
    // guarda como provisional —usable solo mientras no haya estable— si:
    //  - de verdad se midió (sin casos concluyentes no sabemos nada);
    //  - funcionó en la mayoría de los mundos, no apenas en alguno;
    //  - y NO viola invariantes del mundo. Eso último no se negocia: una
    //    habilidad que rompe reglas no es "imperfecta", es inadmisible, y
    //    usarla por urgencia sería exactamente el atajo que el evaluador
    //    independiente existe para impedir.
    const usable =
      conclusive > 0 &&
      report.invariantViolations === 0 &&
      report.successRate >= policy.provisionalThreshold;
    library.markRejected(
      skill.id,
      {
        id: `fail-${skill.id}`,
        scenarioName: failedCases[0]?.scenario ?? 'desconocido',
        seed: failedCases[0]?.seed ?? -1,
        description: report.failureObservations.join('; '),
        observedAtVersion: skill.version,
      },
      usable,
    );
    if (usable) {
      reasons.push(
        `queda como provisional: la uso si no tengo nada mejor, y sigo corrigiéndola`,
      );
    }
    return { verdict: 'rejected', reasons, regressionsAdded, provisional: usable };
  }

  library.markPromoted(skill.id);
  reasons.push(
    `supera los ${conclusive} casos concluyentes, incluidas ${report.cases.filter((c) => c.fromRegression).length} regresiones` +
      (report.inconclusiveCases > 0
        ? ` (${report.inconclusiveCases} sin veredicto: el mundo no dio)`
        : ''),
  );
  if (options.baseline) {
    reasons.push(`no empeora a la versión anterior`);
  }
  return { verdict: 'promoted', reasons, regressionsAdded: 0 };
}
