import { hashValue } from '@anima/shared';
import type { SkillDefinition } from '@anima/skill-runtime';
import type { EvaluationReport, EvaluateOptions } from './evaluate.js';
import { evaluateSkill } from './evaluate.js';
import type { RegressionCase } from './regressions.js';

/**
 * Dónde corre la evaluación.
 *
 * Evaluar una habilidad es correr cuarenta mundos completos de hasta doscientos
 * ticks cada uno, por cada versión candidata, hasta ocho versiones. Eso es
 * medio millón de pasos de simulación en un solo bloque síncrono. Corriendo en
 * el hilo de la interfaz, la pestaña se congela: no se dibuja, no se escucha un
 * click, y el chat se queda mudo justo cuando la mascota está diciendo que se
 * pone a pensar.
 *
 * El trabajo en sí está bien —es determinista, aislado y no toca el mundo real,
 * que es exactamente lo que lo hace confiable—; lo que está mal es DÓNDE corre.
 * Este puerto lo vuelve inyectable: en pruebas y en Node se resuelve en el acto,
 * y en el navegador lo atiende un worker sin que el evaluador se entere.
 *
 * El contrato es asíncrono para todos, incluso para quien resuelve en el acto:
 * un puerto que a veces bloquea y a veces no es un puerto que nadie puede usar
 * con confianza.
 */

/** Lo que hay que evaluar, en datos que cruzan un límite de hilo. */
export interface EvaluationRequest {
  skill: SkillDefinition;
  /** Los escenarios POR NOMBRE: una función no cruza a un worker. */
  scenarioNames: string[];
  seeds: number[];
  /** Los mundos reservados: se miden, pero no se le muestran al diseñador. */
  holdoutSeeds?: number[];
  regressions: RegressionCase[];
  maxTicks: number;
  /** El mundo real de ahora, serializado: cruza a un worker sin problema. */
  currentWorld?: EvaluateOptions['currentWorld'];
}

export interface EvaluatorPort {
  evaluate(request: EvaluationRequest): Promise<EvaluationReport>;
  /** Abandonar lo que esté en vuelo (la mascota murió, el cuidador reinició). */
  cancel?(): void;
}

/**
 * La huella de una evaluación: el artefacto, el contrato y el banco de pruebas.
 *
 * Cambiar cualquiera de los tres cambia el veredicto, así que los tres entran.
 * Lo que NO entra es el reloj: dos evaluaciones idénticas tienen que dar el
 * mismo resultado siempre —el evaluador es determinista a propósito— y si no lo
 * dieran, cachear sería el menor de los problemas.
 */
export function evaluationCacheKey(request: EvaluationRequest): string {
  return hashValue({
      program: request.skill.program,
      criteria: request.skill.successCriteria,
      scenarios: [...request.scenarioNames].sort(),
      seeds: [...request.seeds].sort((a, b) => a - b),
      holdout: [...(request.holdoutSeeds ?? [])].sort((a, b) => a - b),
      // El mundo actual cambia tick a tick: si entra al banco, entra a la
      // huella. Sin esto, la caché devolvería el veredicto de un mundo que ya
      // no existe, que es justo lo que la reserva vino a impedir.
      world: request.currentWorld?.snapshot ?? null,
      maxTicks: request.maxTicks,
      regressions: [...request.regressions]
        .map((regression) => `${regression.scenarioName}:${regression.seed}:${regression.petId ?? ''}`)
        .sort(),
  });
}

/**
 * El puerto que resuelve en el acto, con los escenarios que le den.
 *
 * Es el de siempre, con la misma semántica: sirve para Node, para las pruebas y
 * como red de seguridad si el worker no está disponible. Bloquea, y por eso no
 * es el que usa la interfaz.
 */
export function inProcessEvaluator(
  scenarios: EvaluateOptions['scenarios'],
  hooks: Pick<EvaluateOptions, 'library' | 'onCase'> = {},
): EvaluatorPort {
  const byName = new Map(scenarios.map((scenario) => [scenario.name, scenario]));
  return {
    async evaluate(request) {
      const selected = request.scenarioNames
        .map((name) => byName.get(name))
        .filter((scenario): scenario is NonNullable<typeof scenario> => scenario !== undefined);
      return evaluateSkill(request.skill, {
        scenarios: selected,
        seeds: request.seeds,
        ...(request.holdoutSeeds ? { holdoutSeeds: request.holdoutSeeds } : {}),
        regressions: request.regressions,
        maxTicks: request.maxTicks,
        ...(request.currentWorld ? { currentWorld: request.currentWorld } : {}),
        ...(hooks.library ? { library: hooks.library } : {}),
        ...(hooks.onCase ? { onCase: hooks.onCase } : {}),
      });
    },
  };
}

/**
 * Un puerto que no vuelve a medir lo que ya midió.
 *
 * Revisar una habilidad es un ciclo de propuesta y corrección, y los modelos
 * repiten: una v4 puede volver al programa de la v2 palabra por palabra. Sin
 * caché, eso son cuarenta mundos corridos para llegar al número que ya estaba
 * escrito. La clave incluye el programa, el criterio, los escenarios y las
 * semillas, así que un cambio en cualquiera de ellos vuelve a medir de verdad.
 */
export function cachingEvaluator(inner: EvaluatorPort, capacity = 32): EvaluatorPort {
  const cache = new Map<string, EvaluationReport>();
  return {
    async evaluate(request) {
      const key = evaluationCacheKey(request);
      const hit = cache.get(key);
      if (hit) {
        // Se devuelve una copia: un informe cacheado es una lectura del pasado,
        // y quien lo reciba no debería poder alterar lo que verá el siguiente.
        return structuredClone(hit);
      }
      const report = await inner.evaluate(request);
      if (cache.size >= capacity) {
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
      }
      cache.set(key, structuredClone(report));
      return report;
    },
    ...(inner.cancel ? { cancel: () => inner.cancel!() } : {}),
  };
}
