import type {
  EvaluationCaseHook,
  EvaluationCaseTrace,
  EvaluationReport,
  EvaluationRequest,
  EvaluatorPort,
  NamedScenario,
  RegressionCase,
} from '@anima/skill-evaluator';
import { cachingEvaluator, inProcessEvaluator } from '@anima/skill-evaluator';
import type { SkillDefinition } from '@anima/skill-runtime';

/**
 * El puerto de evaluación del navegador: los mundos imaginados corren en un
 * worker y la pestaña sigue viva.
 *
 * Lo que se gana no es velocidad —el trabajo es el mismo— sino que la interfaz
 * siga respondiendo mientras ocurre. Ánima dice «me pongo a practicar en mi
 * imaginación, puede llevarme un rato»; hasta ahora, ese rato era una pestaña
 * congelada en la que no se podía ni leer esa frase.
 *
 * Tres capas, cada una con su motivo:
 *  - el worker, para no bloquear;
 *  - la caché por huella del artefacto, porque revisar repite propuestas y
 *    volver a correr cuarenta mundos para el número que ya estaba escrito es
 *    tiempo de vida de la mascota tirado;
 *  - y la caída al proceso principal si el worker no está disponible, porque
 *    quedarse sin evaluar es peor que evaluar despacio: sin veredicto no hay
 *    promoción, y sin promoción la garantía se pierde.
 */

export interface EvalWorkerRequest {
  id: number;
  skill: SkillDefinition;
  scenarioNames: string[];
  seeds: number[];
  regressions: RegressionCase[];
  maxTicks: number;
}

export type EvalWorkerResponse =
  /**
   * Un mundo imaginado, apenas se termina de correr. Viaja suelto y no dentro
   * del informe final porque la UI los DIBUJA mientras ella piensa: llegar todos
   * juntos al final los volvería un resumen, y lo que el cuidador ve hoy es el
   * sueño ocurriendo.
   */
  | { id: number; ok: true; trace: EvaluationCaseTrace }
  | { id: number; ok: true; report: EvaluationReport }
  | { id: number; ok: false; error: string };

/** Cuánto se espera un veredicto antes de resolverlo acá mismo. */
const WORKER_TIMEOUT_MS = 120_000;

class WorkerEvaluator implements EvaluatorPort {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (report: EvaluationReport) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();

  constructor(
    private readonly fallback: EvaluatorPort,
    private readonly onCase?: EvaluationCaseHook,
  ) {}

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') return null;
    try {
      const worker = new Worker(new URL('./eval-worker.ts', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (event: MessageEvent<EvalWorkerResponse>) => {
        const entry = this.pending.get(event.data.id);
        if (!entry) return;
        // Una traza no cierra nada: es un sueño más que la UI puede dibujar
        // mientras el resto sigue corriendo.
        if (event.data.ok && 'trace' in event.data) {
          this.onCase?.(event.data.trace);
          return;
        }
        this.pending.delete(event.data.id);
        clearTimeout(entry.timer);
        if (event.data.ok) entry.resolve(event.data.report);
        else entry.reject(new Error(event.data.error));
      });
      // Un worker que muere deja a todos esperando para siempre. Se los despierta
      // con el fallo y el que sigue reabre el worker: una caída no puede dejar a
      // la mascota sin manera de aprender por el resto de su vida.
      worker.addEventListener('error', () => this.failAll('el worker de evaluación falló'));
      this.worker = worker;
      return worker;
    } catch {
      return null;
    }
  }

  private failAll(message: string): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(message));
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  cancel(): void {
    this.failAll('evaluación cancelada');
  }

  async evaluate(request: EvaluationRequest): Promise<EvaluationReport> {
    const worker = this.ensureWorker();
    if (!worker) return this.fallback.evaluate(request);
    const id = this.nextId++;
    try {
      return await new Promise<EvaluationReport>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error('el worker de evaluación no respondió a tiempo'));
        }, WORKER_TIMEOUT_MS);
        this.pending.set(id, { resolve, reject, timer });
        const message: EvalWorkerRequest = {
          id,
          skill: request.skill,
          scenarioNames: request.scenarioNames,
          seeds: request.seeds,
          regressions: request.regressions,
          maxTicks: request.maxTicks,
        };
        worker.postMessage(message);
      });
    } catch {
      // Sin veredicto no hay promoción, y sin promoción la garantía se pierde:
      // antes que quedarse sin medir, se mide acá aunque cueste una pausa.
      return this.fallback.evaluate(request);
    }
  }
}

/**
 * El puerto que usa la sesión. `scenarios` es la caída al proceso principal:
 * las mismas funciones de escenario que ya tiene cargadas.
 */
export function createBrowserEvaluator(
  scenarios: NamedScenario[],
  onCase?: EvaluationCaseHook,
): EvaluatorPort {
  return cachingEvaluator(
    new WorkerEvaluator(
      inProcessEvaluator(scenarios, onCase ? { onCase } : {}),
      onCase,
    ),
  );
}
