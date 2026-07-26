import type { EvaluationReport, NamedScenario } from '@anima/skill-evaluator';
import { evaluateSkill } from '@anima/skill-evaluator';
import { COLD_SCENARIOS, MVP_SCENARIOS, PRACTICE_SCENARIOS } from '@anima/test-scenarios';
import type { EvalWorkerRequest, EvalWorkerResponse } from './eval-port.js';

/**
 * Los mundos imaginados, en su propio hilo.
 *
 * Acá corre el evaluador entero, sin cambios: los mismos escenarios, las mismas
 * semillas, el mismo veredicto determinista. Lo único que cambia es el hilo. La
 * garantía que importaba —que evaluar sea aislado y no toque el mundo real— se
 * refuerza, no se debilita: en un worker ni siquiera existe el mundo real que
 * podría tocarse.
 *
 * Los escenarios viajan POR NOMBRE porque una función no cruza un `postMessage`.
 * Este archivo es el único que sabe qué nombre corresponde a qué mundo, y si
 * llega uno que no conoce, no lo inventa: lo omite y el informe sale con los que
 * sí pudo correr.
 */

const SCENARIOS: NamedScenario[] = [...MVP_SCENARIOS, ...PRACTICE_SCENARIOS, ...COLD_SCENARIOS];
const byName = new Map(SCENARIOS.map((scenario) => [scenario.name, scenario]));

self.addEventListener('message', (event: MessageEvent<EvalWorkerRequest>) => {
  const request = event.data;
  const respond = (response: EvalWorkerResponse): void => {
    (self as unknown as Worker).postMessage(response);
  };
  try {
    const scenarios = request.scenarioNames
      .map((name) => byName.get(name))
      .filter((scenario): scenario is NamedScenario => scenario !== undefined);
    const report: EvaluationReport = evaluateSkill(request.skill, {
      scenarios,
      seeds: request.seeds,
      regressions: request.regressions,
      maxTicks: request.maxTicks,
      // Cada mundo imaginado vuelve apenas termina: la UI los dibuja mientras
      // ella piensa, y esperar al informe final los volvería un resumen.
      onCase: (trace) => respond({ id: request.id, ok: true, trace }),
    });
    respond({ id: request.id, ok: true, report });
  } catch (error) {
    respond({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
