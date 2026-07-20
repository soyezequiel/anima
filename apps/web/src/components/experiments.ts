import type { ExperimentView } from '../session/view.js';

/**
 * El registro de ensayos, ordenado por lo que cuenta.
 *
 * El ciclo de una habilidad emite nueve tipos de evento, y el panel los
 * imprimía todos al mismo nivel: una sola habilidad ocupaba nueve renglones y
 * tres habilidades eran cincuenta líneas de texto corrido donde los dos
 * desenlaces que importan —promovida, rechazada— pesaban igual que «contrato
 * propuesto».
 *
 * Los eventos ya venían con `skillName` y `version`. Agrupar por ahí es lo que
 * convierte el log en una historia: qué habilidad, cuántos intentos, cómo
 * terminó cada uno. Los siete pasos de trámite siguen estando, adentro del
 * intento al que pertenecen.
 */

/** Los eventos que son un veredicto y no un trámite del camino. */
const VERDICT_KINDS = new Set([
  'promoted',
  'rejected',
  'provisional',
  'plateau',
  'test-failed',
  'test-passed',
]);

export interface AttemptGroup {
  /** El número de intento, o `null` en lo que ocurrió antes de haber uno. */
  version: number | null;
  /** Cómo terminó, si terminó. `null` mientras sigue en curso. */
  verdict: ExperimentView | null;
  /** Los pasos del ciclo que no son el veredicto, en orden. */
  steps: ExperimentView[];
  firstTick: number;
  lastTick: number;
}

export interface SkillTrial {
  skillName: string;
  attempts: AttemptGroup[];
  /**
   * Cómo le fue a la habilidad entera. Es el veredicto del último intento,
   * salvo que alguno haya sido promovido: aprender algo no se deshace porque
   * después se haya intentado mejorarlo y no saliera.
   */
  outcome: 'promoted' | 'provisional' | 'rejected' | 'running';
  firstTick: number;
  lastTick: number;
}

/**
 * Junta los eventos en habilidades y, dentro de cada una, en intentos.
 *
 * El orden de aparición manda en los dos niveles: el registro es una historia
 * y una historia no se ordena alfabéticamente. Los eventos sin `version`
 * —la necesidad detectada, antes de que exista candidata— caen en su propio
 * grupo al frente, que es donde ocurrieron.
 */
export function groupExperiments(experiments: ExperimentView[]): SkillTrial[] {
  const bySkill = new Map<string, ExperimentView[]>();
  for (const event of experiments) {
    const list = bySkill.get(event.skillName) ?? [];
    list.push(event);
    bySkill.set(event.skillName, list);
  }

  return [...bySkill.entries()].map(([skillName, events]) => {
    const attempts = groupAttempts(events);
    return {
      skillName,
      attempts,
      outcome: outcomeOf(attempts),
      firstTick: events[0]!.tick,
      lastTick: events[events.length - 1]!.tick,
    };
  });
}

function groupAttempts(events: ExperimentView[]): AttemptGroup[] {
  const byVersion = new Map<number | null, ExperimentView[]>();
  for (const event of events) {
    const list = byVersion.get(event.version) ?? [];
    list.push(event);
    byVersion.set(event.version, list);
  }

  return [...byVersion.entries()].map(([version, list]) => {
    // El último veredicto y no el primero: dentro de un intento puede haber un
    // `test-passed` seguido de `promoted`, y lo que cuenta es en qué terminó.
    const verdicts = list.filter((e) => VERDICT_KINDS.has(e.kind));
    const verdict = verdicts[verdicts.length - 1] ?? null;
    return {
      version,
      verdict,
      steps: list.filter((e) => e !== verdict),
      firstTick: list[0]!.tick,
      lastTick: list[list.length - 1]!.tick,
    };
  });
}

function outcomeOf(attempts: AttemptGroup[]): SkillTrial['outcome'] {
  const verdicts = attempts.map((a) => a.verdict?.kind).filter(Boolean);
  if (verdicts.includes('promoted')) return 'promoted';
  if (verdicts.includes('provisional')) return 'provisional';
  const last = attempts[attempts.length - 1];
  if (!last || last.verdict === null) return 'running';
  // `test-passed` sin promoción todavía es un intento en marcha: pasó las
  // pruebas pero nadie lo incorporó aún.
  return last.verdict.kind === 'test-passed' ? 'running' : 'rejected';
}
