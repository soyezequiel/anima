import type { SkillOp, SkillProgram } from '@anima/skill-runtime';
import type { CausalPlan } from './causal-planner.js';

function stringMeta(
  step: CausalPlan['steps'][number],
  key: string,
): string | undefined {
  const value = step.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Compila acciones causales fundamentadas en primitivas de la DSL. Devuelve
 * `null` si aparece una clase que esta capa aún no sabe ejecutar: nunca rellena
 * un hueco con una acción parecida ni deja que el texto del modelo sea código.
 */
export function causalPlanToSkillProgram(plan: CausalPlan): SkillProgram | null {
  const program: SkillOp[] = [];
  for (const [index, step] of plan.steps.entries()) {
    const kind = stringMeta(step, 'kind');
    if (kind === 'navigate' || kind === 'explore') {
      // Recoger/cosechar/interactuar usan GPS justo antes del acto. Omitir esta
      // proyección abstracta evita recorrer dos veces sin perder la condición.
      continue;
    }
    if (kind === 'pickup') {
      const itemKind = stringMeta(step, 'itemKind');
      if (!itemKind) return null;
      const candidates = `causal-items-${index}`;
      const target = `causal-item-${index}`;
      program.push(
        {
          op: 'explore',
          maxSteps: 50,
          until: { type: 'sees', query: { kind: itemKind, held: false, portable: true } },
        },
        {
          op: 'findEntities',
          query: { kind: itemKind, held: false, portable: true },
          store: candidates,
        },
        { op: 'selectTarget', from: candidates, strategy: 'nearest', store: target },
        { op: 'moveToward', target, maxSteps: 40 },
        { op: 'pickup', target },
        {
          op: 'branch',
          if: { type: 'lastActionFailed' },
          then: [{ op: 'abort', reason: `causal-precondition:pickup-${itemKind}` }],
        },
      );
      continue;
    }
    if (kind === 'craft') {
      const recipeId = stringMeta(step, 'recipeId');
      if (!recipeId) return null;
      program.push(
        { op: 'craft', recipeId },
        {
          op: 'branch',
          if: { type: 'lastActionFailed' },
          then: [{ op: 'abort', reason: `causal-effect:craft-${recipeId}` }],
        },
      );
      continue;
    }
    if (kind === 'harvest') {
      const sourceKind = stringMeta(step, 'sourceKind');
      const toolKind = stringMeta(step, 'toolKind');
      const hitsValue = step.metadata?.hits;
      const hits = typeof hitsValue === 'number' ? Math.max(1, Math.min(50, hitsValue)) : 20;
      if (!sourceKind || !toolKind) return null;
      const tools = `causal-tools-${index}`;
      const tool = `causal-tool-${index}`;
      const source = `causal-source-${index}`;
      program.push(
        {
          op: 'findEntities',
          query: { kind: toolKind, held: true, tool: true },
          store: tools,
        },
        { op: 'selectTarget', from: tools, strategy: 'strongestTool', store: tool },
        { op: 'gpsTo', kind: sourceKind, maxSteps: 50, store: source },
        {
          op: 'repeatWithLimit',
          max: hits,
          until: { type: 'entityGone', ref: source },
          body: [
            { op: 'useItem', item: tool, target: source },
            {
              op: 'branch',
              if: { type: 'lastStrikeIneffective' },
              then: [{ op: 'abort', reason: 'causal-precondition:tool-insuficiente' }],
            },
            {
              op: 'branch',
              if: { type: 'lastActionUnaffected' },
              then: [{ op: 'abort', reason: 'causal-effect:objetivo-inmune' }],
            },
          ],
        },
        {
          op: 'branch',
          if: { type: 'not', cond: { type: 'entityGone', ref: source } },
          then: [{ op: 'abort', reason: 'causal-effect:transformacion-no-ocurrio' }],
        },
      );
      continue;
    }
    if (kind === 'interact') {
      const interactionId = stringMeta(step, 'interactionId');
      const targetId = stringMeta(step, 'targetId');
      if (!interactionId || !targetId) return null;
      const targets = `causal-interaction-targets-${index}`;
      const target = `causal-interaction-target-${index}`;
      program.push(
        { op: 'findEntities', query: { id: targetId }, store: targets },
        { op: 'selectTarget', from: targets, strategy: 'nearest', store: target },
        { op: 'moveToward', target, maxSteps: 40 },
        { op: 'interact', interactionId, target },
        {
          op: 'branch',
          if: { type: 'lastActionFailed' },
          then: [{ op: 'abort', reason: `causal-effect:interaction-${interactionId}` }],
        },
      );
      continue;
    }
    return null;
  }
  return program.length > 0 ? program : [{ op: 'wait', ticks: 1 }];
}
