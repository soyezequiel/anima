import type { SkillProgram } from '@anima/skill-runtime';
import type { CapabilityContext } from './capabilities/capability.js';
import type { PlanStep } from './capabilities/plan.js';
import { accumulateGains, contextWithGains } from './capabilities/gains.js';
import type { CapabilityRegistry } from './capabilities/registry.js';
import type { CausalPlan } from './causal-planner.js';

function stringMeta(step: CausalPlan['steps'][number], key: string): string | undefined {
  const value = step.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * De qué capacidad es cada clase de acción causal.
 *
 * El planificador razona sobre fluentes —`inventory:log`, `present:tree-3`— y
 * no sabe nada de la DSL: sus pasos llevan una etiqueta y unos datos opacos, y
 * esta tabla los devuelve al mundo de lo ejecutable. Antes esa traducción era
 * un `if` por clase que escribía operaciones a mano; ahora nombra capacidades
 * del registro, así que un paso causal y un paso pedido por el cuidador se
 * ejecutan, se verifican y se recuperan por el mismo camino.
 */
function specFor(
  step: CausalPlan['steps'][number],
): { capabilityId: string; args: Record<string, unknown> } | null | 'skip' {
  const kind = stringMeta(step, 'kind');

  // Recoger/cosechar/interactuar navegan justo antes del acto. Omitir esta
  // proyección abstracta evita recorrer dos veces sin perder la condición.
  if (kind === 'navigate' || kind === 'explore') return 'skip';

  if (kind === 'pickup') {
    const itemKind = stringMeta(step, 'itemKind');
    return itemKind ? { capabilityId: 'item.pickup', args: { kind: itemKind, portable: true } } : null;
  }

  if (kind === 'craft') {
    const recipeId = stringMeta(step, 'recipeId');
    // `gather: false` porque los ingredientes ya son pasos propios de esta
    // cadena: juntarlos otra vez acá recorrería el mapa dos veces por lo mismo.
    return recipeId ? { capabilityId: 'craft.recipe', args: { recipeId, gather: false } } : null;
  }

  if (kind === 'harvest') {
    const sourceKind = stringMeta(step, 'sourceKind');
    const toolKind = stringMeta(step, 'toolKind');
    if (!sourceKind || !toolKind) return null;
    const hitsValue = step.metadata?.hits;
    const hits = typeof hitsValue === 'number' ? Math.max(1, Math.min(50, hitsValue)) : 20;
    return { capabilityId: 'entity.harvest-with-tool', args: { sourceKind, toolKind, hits } };
  }

  if (kind === 'interact') {
    const interactionId = stringMeta(step, 'interactionId');
    const targetId = stringMeta(step, 'targetId');
    return interactionId && targetId
      ? { capabilityId: 'world.interact', args: { interactionId, entityId: targetId } }
      : null;
  }

  return null;
}

/**
 * Compila una cadena causal a pasos de plan verificables.
 *
 * Devuelve `null` si aparece una clase que esta capa aún no sabe ejecutar, o si
 * alguna capacidad no puede armarse con el mundo de ahora: nunca rellena un
 * hueco con una acción parecida ni deja que el texto de un modelo sea código.
 */
export function causalPlanToSteps(
  plan: CausalPlan,
  registry: CapabilityRegistry,
  context: CapabilityContext,
): PlanStep[] | null {
  const steps: PlanStep[] = [];
  // Una cadena causal encadena varios «recogé un tronco»: cada uno tiene que
  // pedir UNO MÁS que el anterior, o el segundo nace cumplido y se saltea.
  const gains = new Map<string, number>();
  for (const [index, causalStep] of plan.steps.entries()) {
    const spec = specFor(causalStep);
    if (spec === 'skip') continue;
    if (spec === null) return null;
    const built = registry.buildStep(
      spec.capabilityId,
      spec.args,
      contextWithGains(context, gains),
      `causal-${index}`,
    );
    if (!built.ok) return null;
    accumulateGains(gains, built.value);
    steps.push(built.value);
  }
  return steps;
}

/**
 * La misma compilación, aplanada a un programa. Se conserva porque el evaluador
 * y las pruebas de la cadena causal trabajan con programas, no con planes.
 */
export function causalPlanToSkillProgram(
  plan: CausalPlan,
  registry: CapabilityRegistry,
  context: CapabilityContext,
): SkillProgram | null {
  const steps = causalPlanToSteps(plan, registry, context);
  if (!steps) return null;
  const ops = steps.flatMap((step) => step.program);
  return ops.length > 0 ? ops : [{ op: 'wait', ticks: 1 }];
}
