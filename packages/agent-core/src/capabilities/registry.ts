import type { Result } from '@anima/shared';
import { err, ok } from '@anima/shared';
import { validateSkillProgram } from '@anima/skill-runtime';
import type { Capability, CapabilityBlock, CapabilityContext } from './capability.js';
import type { PlanStep } from './plan.js';

/**
 * El catálogo único de lo que Ánima sabe hacer.
 *
 * Todo lo que quiera actuar —el compilador determinista de peticiones, el
 * planificador causal, una macro heredada de una skill— pasa por acá. Que sea
 * uno solo es el punto: es la lista contra la que el intérprete de chat hace
 * grounding («esto que me pedís, ¿existe?»), la que genera la parte del prompt
 * que enumera acciones, y la que garantiza que no se pueda ejecutar algo que
 * nadie registró. Una capacidad que no está en el registro no existe, y decir
 * «no sé hacer eso» con la lista en la mano es distinto de decirlo por
 * omisión.
 */
export class CapabilityRegistry {
  private readonly byId = new Map<string, Capability<never>>();

  register<A>(capability: Capability<A>): this {
    if (this.byId.has(capability.id)) {
      throw new Error(`capacidad duplicada: ${capability.id}`);
    }
    this.byId.set(capability.id, capability as unknown as Capability<never>);
    return this;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): Capability<never> | undefined {
    return this.byId.get(id);
  }

  /** Todas, en orden estable por id: el catálogo no depende del orden de registro. */
  all(): Capability<never>[] {
    return [...this.byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  ids(): string[] {
    return this.all().map((capability) => capability.id);
  }

  /**
   * El catálogo tal como se lo mostramos a un modelo. Se genera del código
   * para que no pueda mentir: si una capacidad se borra, deja de ofrecerse el
   * mismo día, y si nace una, aparece sin que nadie tenga que acordarse de
   * editar un prompt.
   */
  describeForPrompt(): string {
    return this.all()
      .map((capability) => {
        const params = capability.params
          .map((param) => `${param.name}${param.required ? '' : '?'}: ${param.type}`)
          .join(', ');
        return `- ${capability.id}(${params}): ${capability.summary}`;
      })
      .join('\n');
  }

  /**
   * De un id y argumentos crudos a un paso de plan listo para ejecutar.
   *
   * Es la única puerta: valida los argumentos, compila a la DSL, revalida el
   * programa con el mismo validador estructural que usa cualquier artefacto de
   * origen no confiable, y adjunta la expectativa con la que después se lo va
   * a juzgar. Un paso que sale de acá ya no puede ser un programa ilegal ni
   * puede carecer de forma de comprobarse.
   */
  buildStep(
    capabilityId: string,
    rawArgs: unknown,
    context: CapabilityContext,
    stepId: string,
  ): Result<PlanStep, CapabilityBlock> {
    const capability = this.byId.get(capabilityId);
    if (!capability) {
      return err({
        reason: 'unknown-in-world',
        detail: `no existe la capacidad "${capabilityId}"`,
      } satisfies CapabilityBlock);
    }
    const grounded = capability.ground(rawArgs, context);
    if (!grounded.ok) {
      return err({ reason: 'bad-arguments', detail: grounded.error } satisfies CapabilityBlock);
    }
    const args = grounded.value;
    const compiled = capability.compile(args, context);
    if (!compiled.ok) return err(compiled.block);

    // La forma se comprueba siempre: una capacidad es código nuestro, sí, pero
    // sus argumentos pueden no serlo, y una operación mal escrita tiene que
    // morir acá y no en medio de un tick. Lo que NO se le cobra son los topes
    // de entrada pensados para lo que escribe un modelo — el alcance de una
    // obra sale de un plano que el mundo ya aceptó, y acotarlo otra vez acá
    // solo prohibiría tender un puente largo.
    const validated = validateSkillProgram(compiled.program, undefined, { origin: 'trusted' });
    if (!validated.ok) {
      return err({
        reason: 'bad-arguments',
        detail: `${capabilityId} compiló un programa inválido: ${validated.error}`,
      } satisfies CapabilityBlock);
    }

    return ok({
      id: stepId,
      capabilityId,
      args: args as Record<string, unknown>,
      purpose: capability.describe(args, context),
      program: validated.value,
      expect: capability.verify(args, context),
      preconditions: capability.preconditions(args, context),
      effects: capability.effects(args, context),
      cost: capability.cost(args, context),
      risk: capability.risk,
      status: 'pending',
      attempts: 0,
    });
  }

  /**
   * ¿El fracaso de este paso se arregla replanificando? Lo decide su capacidad;
   * quien no lo declara, no se reintenta.
   */
  isRetriable(step: PlanStep, reason: string | undefined, context: CapabilityContext): boolean {
    const capability = this.byId.get(step.capabilityId);
    return capability?.retriable?.(reason, step.args as never, context) ?? false;
  }

  /** Qué probar cuando un paso se bloqueó, según lo que su capacidad ofrezca. */
  recoveriesFor(step: PlanStep, block: CapabilityBlock, context: CapabilityContext) {
    const capability = this.byId.get(step.capabilityId);
    if (!capability?.recover) return [];
    return capability.recover(step.args as never, block, context);
  }
}
