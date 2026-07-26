import type { SimEvent } from '@anima/sim-core';
import type { Perception } from '@anima/sim-core';
import type {
  GpsPlaces,
  SkillExecutionResult,
  SkillLibrary,
  SkillStepOutput,
  SpatialMemory,
} from '@anima/skill-runtime';
import { SkillExecution } from '@anima/skill-runtime';
import type { GoalConditionContext } from '../goal-conditions.js';
import { evaluateGoalCondition } from '../goal-conditions.js';
import type { CapabilityContext } from './capability.js';
import type { CapabilityDeps } from './deps.js';
import type { Plan, PlanStep } from './plan.js';
import { currentStep, planFinished } from './plan.js';
import type { CapabilityRegistry } from './registry.js';

/**
 * Ejecución monitorizada de un plan: hacer, mirar, comparar, corregir.
 *
 * Hasta acá la ejecución era ciega en el medio. Se compilaba un programa
 * entero, se lo dejaba correr, y lo único que volvía era «terminó» o «abortó
 * con tal motivo». Entre esos dos extremos —la rama `lastActionFailed` metida
 * dentro del programa, que solo ve la ÚLTIMA acción, y la condición de la meta,
 * que solo se mira al final— no había nada. Un paso podía completarse sin haber
 * ocurrido y el plan seguía adelante como si nada, hasta que veinte ticks
 * después la meta no se cumplía y ya no se sabía cuál de los pasos había
 * mentido.
 *
 * Acá cada paso se juzga por separado, contra la percepción FRESCA de después,
 * usando el predicado que su capacidad declaró. Tres desenlaces:
 *
 *  - el mundo muestra el efecto → el paso queda hecho y sigue el siguiente;
 *  - no lo muestra y queda presupuesto → se replanifica desde lo que se ve
 *    ahora, que puede ser un mundo bastante distinto del que se planificó;
 *  - no lo muestra y no queda presupuesto → el plan fracasa DICIENDO qué paso
 *    falló y qué midió el mundo, en vez de anunciar un «listo» que no pasó.
 *
 * El mundo sigue siendo la única autoridad: acá no se toca estado, se lee un
 * veredicto y se decide qué hacer con él.
 */

export interface PlanExecutorOptions {
  library?: SkillLibrary;
  spatial?: SpatialMemory;
  places?: GpsPlaces;
  /**
   * Con qué contexto se evalúan las expectativas. Lo aporta el agente porque
   * incluye cosas que solo él sabe: qué identidades confirmó ausentes, qué
   * hechos emitió el motor para este objetivo, si una obra está completa.
   */
  verifyContext(perception: Perception): GoalConditionContext;
  /**
   * Cómo se arma un plan nuevo con percepción fresca. Devolver `null` significa
   * «no hay por dónde»: el plan fracasa en vez de reintentar en el vacío.
   */
  replan(perception: Perception, reason: string): Plan | null;
  /** Telemetría: qué le pasó a cada paso. La UI y el chat leen esto. */
  onEvent?(event: PlanExecutorEvent): void;
  /**
   * El catálogo y las dependencias, para preguntarle a la capacidad de un paso
   * si su fracaso se arregla mirando de nuevo. Sin esto, ningún aborto se
   * reintenta: es el comportamiento conservador de siempre.
   */
  registry?: CapabilityRegistry;
  deps?: CapabilityDeps;
}

export type PlanExecutorEvent =
  | { type: 'step.started'; step: PlanStep }
  | { type: 'step.skipped'; step: PlanStep }
  | { type: 'step.verified'; step: PlanStep }
  | { type: 'step.unverified'; step: PlanStep; diagnostics: string[] }
  | { type: 'plan.replanned'; reason: string; revision: number }
  | { type: 'plan.settled'; outcome: SkillExecutionResult['outcome']; reason?: string };

/**
 * Cuántas veces puede avanzar de paso dentro de un mismo tick. Los pasos que ya
 * estaban hechos no cuestan tick —comprobarlos es leer la percepción—, así que
 * sin tope un plan entero de pasos cumplidos giraría en un solo tick. Con tope,
 * a lo sumo se saltean unos cuantos y el resto espera al siguiente.
 */
const MAX_STEP_ADVANCES_PER_TICK = 8;

export class PlanExecutor {
  private plan: Plan;
  private exec: SkillExecution | null = null;
  private settled: SkillExecutionResult | null = null;
  private ticksUsed = 0;
  private replans = 0;
  /** Cuántos pasos terminaron sin que el mundo mostrara su efecto. */
  private unverified = 0;

  constructor(
    plan: Plan,
    private readonly actorId: string,
    private readonly options: PlanExecutorOptions,
  ) {
    this.plan = plan;
  }

  /** El plan que está corriendo ahora mismo (puede no ser con el que nació). */
  currentPlan(): Plan {
    return this.plan;
  }

  /**
   * Cuántos pasos terminaron sin que el mundo mostrara su efecto. Un plan que
   * llega al final con esto en cero de verdad hizo lo que dijo; con esto en
   * más de cero, «terminé» es una afirmación sobre el programa y no sobre el
   * mundo, y quien lo cuente tiene que saberlo.
   */
  unverifiedSteps(): number {
    return this.unverified;
  }

  cancel(reason: string): void {
    this.exec?.cancel(reason);
    if (!this.settled) this.finish('aborted', reason);
  }

  observe(events: SimEvent[]): void {
    this.exec?.observe(events);
  }

  next(perception: Perception): SkillStepOutput {
    if (this.settled) return { kind: 'done', result: this.settled };

    this.ticksUsed += 1;
    if (this.ticksUsed > this.plan.budget.maxTicks) {
      return { kind: 'done', result: this.finish('limit-exceeded', 'presupuesto-del-plan') };
    }

    for (let advances = 0; advances < MAX_STEP_ADVANCES_PER_TICK; advances += 1) {
      if (planFinished(this.plan)) {
        return { kind: 'done', result: this.finish('completed') };
      }
      const step = currentStep(this.plan)!;

      // Todavía no arrancó: ¿hace falta? Un paso cuyo efecto ya es cierto se
      // saltea sin gastar un tick. Es lo que hace que retomar un encargo a
      // medias no vuelva a recoger lo que ya está en la mano.
      if (this.exec === null) {
        const already = this.evaluate(step, perception);
        if (already.status === 'met') {
          step.status = 'skipped';
          this.emit({ type: 'step.skipped', step });
          this.plan.cursor += 1;
          continue;
        }
        // Un paso que no se pudo ni compilar no se ejecuta: aborta con el
        // motivo con el que se bloqueó, que es el que el cuidador va a leer.
        if (step.block) {
          step.status = 'failed';
          return {
            kind: 'done',
            result: this.finish('aborted', String(step.args.reason ?? step.block.reason)),
          };
        }
        step.status = 'running';
        step.attempts += 1;
        this.emit({ type: 'step.started', step });
        this.exec = new SkillExecution(step.program, this.actorId, {
          ...(this.options.library ? { library: this.options.library } : {}),
          ...(this.options.spatial ? { spatial: this.options.spatial } : {}),
          ...(this.options.places ? { places: this.options.places } : {}),
        });
      }

      const output = this.exec.next(perception);
      if (output.kind === 'intent') return output;
      this.exec = null;

      // El paso se rindió DICIENDO por qué. Hay dos clases de «no salió»:
      //
      // Una dice que el mundo se movió —el tronco al que iba ya no está—, y eso
      // se arregla mirando de nuevo. Quién lo sabe es la capacidad, que declara
      // `retriable`: llevarle al cuidador un «no pude» con dos troncos nuevos a
      // la vista sería rendirse antes de mirar.
      //
      // La otra es un diagnóstico físico: el objetivo es inmune, la herramienta
      // no hace mella, no hay sitio. Volver a mirar no cambia nada, y el agente
      // tiene maquinaria para atenderlo que replanificar se comería. Ese fallo
      // llega intacto, como siempre.
      if (output.result.outcome !== 'completed') {
        const reason = output.result.reason;
        if (this.canRetry(step, reason, perception)) {
          const fresh = this.options.replan(perception, reason ?? 'el-mundo-cambió');
          if (fresh) {
            this.replans += 1;
            fresh.revision = this.plan.revision + 1;
            this.plan = fresh;
            this.emit({ type: 'plan.replanned', reason: reason ?? 'el-mundo-cambió', revision: fresh.revision });
            continue;
          }
        }
        step.status = 'failed';
        return { kind: 'done', result: this.finish(output.result.outcome, reason) };
      }

      // El programa dijo que terminó. Lo que importa es qué muestra el mundo:
      // un `completed` sin efecto es exactamente la falsa finalización que esto
      // existe para atrapar.
      const verdict = this.evaluate(step, perception);
      if (verdict.status === 'met' || step.expect === null) {
        step.status = 'done';
        delete step.diagnostics;
        this.emit({ type: 'step.verified', step });
        this.plan.cursor += 1;
        continue;
      }

      step.diagnostics = verdict.diagnostics;
      this.emit({ type: 'step.unverified', step, diagnostics: step.diagnostics });

      // ¿Queda con qué volver a intentarlo? Replanificar es mirar de nuevo: el
      // mundo cambió mientras ella trabajaba, y el plan de hace veinte ticks
      // puede estar hablando de un tronco que ya no está.
      const reason = verdict.diagnostics[0] ?? 'efecto-no-observado';
      if (
        step.attempts < this.plan.budget.maxAttemptsPerStep &&
        this.replans < this.plan.budget.maxReplans
      ) {
        const fresh = this.options.replan(perception, reason);
        if (fresh) {
          this.replans += 1;
          fresh.revision = this.plan.revision + 1;
          this.plan = fresh;
          this.emit({ type: 'plan.replanned', reason, revision: fresh.revision });
          continue;
        }
      }

      // Sin presupuesto para volver a mirar, el paso queda anotado como lo que
      // fue —terminó sin mostrarse— y el plan sigue. Quien decide si el encargo
      // se cumplió es la condición del objetivo contra el mundo, no este paso:
      // dar el encargo por fracasado desde acá le sacaría la última palabra al
      // único que la tiene, que es el motor.
      step.status = 'unverified';
      this.unverified += 1;
      this.plan.cursor += 1;
    }

    // Se acabaron los avances de este tick sin llegar a emitir una intención:
    // el mundo no espera, y el próximo tick sigue donde quedó.
    return { kind: 'intent', intent: { type: 'wait' } };
  }

  /**
   * El veredicto del mundo sobre un paso. Sin predicado propio, `unknown`: ni
   * se saltea por creerlo hecho ni se lo da por fallado — se ejecuta, y lo que
   * diga el programa es lo que hay.
   */
  /** ¿Queda presupuesto Y la capacidad dice que mirar de nuevo sirve? */
  private canRetry(step: PlanStep, reason: string | undefined, perception: Perception): boolean {
    if (step.attempts >= this.plan.budget.maxAttemptsPerStep) return false;
    if (this.replans >= this.plan.budget.maxReplans) return false;
    const registry = this.options.registry;
    const deps = this.options.deps;
    if (!registry || !deps) return false;
    const context: CapabilityContext = { perception, deps };
    return registry.isRetriable(step, reason, context);
  }

  private evaluate(step: PlanStep, perception: Perception) {
    if (!step.expect) return { status: 'unknown' as const, diagnostics: [] as string[] };
    return evaluateGoalCondition(step.expect, this.options.verifyContext(perception));
  }

  private finish(outcome: SkillExecutionResult['outcome'], reason?: string): SkillExecutionResult {
    this.settled = {
      outcome,
      ...(reason !== undefined ? { reason } : {}),
      intentsEmitted: this.ticksUsed,
      pureOpsExecuted: 0,
    };
    this.emit({ type: 'plan.settled', outcome, ...(reason !== undefined ? { reason } : {}) });
    return this.settled;
  }

  private emit(event: PlanExecutorEvent): void {
    this.options.onEvent?.(event);
  }
}

/**
 * Lo que el agente necesita de quien ejecuta una actividad. `SkillExecution` y
 * `PlanExecutor` lo cumplen igual: el primero corre un programa suelto (las
 * urgencias del cuerpo todavía lo hacen), el segundo un plan verificado paso a
 * paso. Que compartan interfaz es lo que permitió mover la ejecución de los
 * encargos al camino monitorizado sin reescribir el ciclo del agente.
 */
export interface ActivityRunner {
  next(perception: Perception): SkillStepOutput;
  observe(events: SimEvent[]): void;
  cancel(reason: string): void;
}
