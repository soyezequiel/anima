/**
 * Planificador causal independiente del lenguaje y de los nombres del mundo.
 *
 * Un fluente es una cantidad con procedencia epistemológica. Las acciones son
 * datos: declaran precondiciones, efectos, costo, riesgo y quién garantiza la
 * causalidad. El buscador nunca llama a un modelo ni ejecuta física.
 */

export type CausalKnowledge = 'known' | 'hypothetical' | 'unknown';
export type CausalAuthority = 'world' | 'code' | 'memory' | 'model';

export interface CausalFact {
  fluent: string;
  value: number;
  knowledge: CausalKnowledge;
  authority: CausalAuthority;
}

export interface CausalCondition {
  fluent: string;
  comparison: 'at-least' | 'at-most' | 'equal';
  value: number;
}

export interface CausalEffect {
  fluent: string;
  operation: 'increase' | 'decrease' | 'set';
  value: number;
  knowledge: Exclude<CausalKnowledge, 'unknown'>;
}

export interface CausalAction {
  id: string;
  description: string;
  authority: CausalAuthority;
  /** Una acción de modelo/memoria nunca puede presentarse como ley física. */
  knowledge: Exclude<CausalKnowledge, 'unknown'>;
  preconditions: CausalCondition[];
  effects: CausalEffect[];
  cost: number;
  /** 0 = determinista/segura; 1 = desenlace extremadamente incierto o dañino. */
  risk: number;
  /** Dato opaco para que una capa ejecutora traduzca el paso a intenciones. */
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface CausalGoal {
  conditions: CausalCondition[];
}

export interface CausalState {
  facts: ReadonlyMap<string, CausalFact>;
}

export interface PlannerLimits {
  maxDepth: number;
  maxExpandedStates: number;
  maxPlanCost: number;
  maxRisk: number;
  riskWeight: number;
  allowHypothetical: boolean;
}

export interface CausalPlan {
  steps: CausalAction[];
  totalCost: number;
  totalRisk: number;
  confidence: Exclude<CausalKnowledge, 'unknown'>;
  finalState: CausalState;
  expandedStates: number;
}

export type CausalPlanResult =
  | { ok: true; plan: CausalPlan }
  | {
      ok: false;
      reason: 'invalid-model' | 'no-plan' | 'limit-reached';
      diagnostics: string[];
      expandedStates: number;
    };

export interface PlanValidationIssue {
  step: number;
  actionId: string;
  kind: 'false-precondition' | 'untrusted-action' | 'missing-effect' | 'goal-unmet';
  detail: string;
}

export interface PlanValidation {
  valid: boolean;
  finalState: CausalState;
  issues: PlanValidationIssue[];
}

const DEFAULT_LIMITS: PlannerLimits = {
  maxDepth: 24,
  maxExpandedStates: 4_000,
  maxPlanCost: 200,
  maxRisk: 3,
  riskWeight: 10,
  allowHypothetical: false,
};

const KNOWLEDGE_RANK: Record<CausalKnowledge, number> = {
  unknown: 0,
  hypothetical: 1,
  known: 2,
};

export function causalState(facts: readonly CausalFact[]): CausalState {
  const merged = new Map<string, CausalFact>();
  for (const fact of facts) {
    if (!Number.isFinite(fact.value)) continue;
    const previous = merged.get(fact.fluent);
    if (!previous || KNOWLEDGE_RANK[fact.knowledge] >= KNOWLEDGE_RANK[previous.knowledge]) {
      merged.set(fact.fluent, { ...fact });
    }
  }
  return { facts: merged };
}

export function factValue(state: CausalState, fluent: string): CausalFact {
  return (
    state.facts.get(fluent) ?? {
      fluent,
      value: 0,
      knowledge: 'unknown',
      authority: 'memory',
    }
  );
}

function compare(value: number, condition: CausalCondition): boolean {
  if (condition.comparison === 'at-least') return value >= condition.value;
  if (condition.comparison === 'at-most') return value <= condition.value;
  return value === condition.value;
}

export function conditionSatisfied(
  state: CausalState,
  condition: CausalCondition,
  allowHypothetical = false,
): boolean {
  const fact = factValue(state, condition.fluent);
  if (fact.knowledge === 'unknown') return false;
  if (fact.knowledge === 'hypothetical' && !allowHypothetical) return false;
  return compare(fact.value, condition);
}

export function goalSatisfied(
  state: CausalState,
  goal: CausalGoal,
  allowHypothetical = false,
): boolean {
  return goal.conditions.every((condition) =>
    conditionSatisfied(state, condition, allowHypothetical),
  );
}

/**
 * Puerta de entrada para acciones. En particular, un LLM puede sugerir una
 * relación, pero no etiquetarla como física conocida. Para volverse `known`
 * debe reaparecer desde el mundo/código después de su validación determinista.
 */
export function validateCausalAction(action: CausalAction): string[] {
  const errors: string[] = [];
  if (action.id.trim().length === 0) errors.push('id vacío');
  if (action.effects.length === 0) errors.push(`${action.id}: no declara efectos`);
  if (!Number.isFinite(action.cost) || action.cost < 0) {
    errors.push(`${action.id}: costo inválido`);
  }
  if (!Number.isFinite(action.risk) || action.risk < 0 || action.risk > 1) {
    errors.push(`${action.id}: riesgo fuera de 0..1`);
  }
  if (action.authority === 'model' && action.knowledge === 'known') {
    errors.push(`${action.id}: un modelo no puede afirmar causalidad física conocida`);
  }
  if (action.knowledge === 'known' && action.effects.some((effect) => effect.knowledge !== 'known')) {
    errors.push(`${action.id}: una acción conocida no puede ocultar efectos hipotéticos`);
  }
  for (const effect of action.effects) {
    if (!Number.isFinite(effect.value) || effect.value < 0) {
      errors.push(`${action.id}: efecto inválido sobre ${effect.fluent}`);
    }
  }
  return errors;
}

function applyAction(state: CausalState, action: CausalAction): CausalState {
  const facts = new Map(state.facts);
  for (const effect of action.effects) {
    const previous = factValue({ facts }, effect.fluent);
    const value =
      effect.operation === 'set'
        ? effect.value
        : effect.operation === 'increase'
          ? previous.value + effect.value
          : Math.max(0, previous.value - effect.value);
    const knowledge =
      previous.knowledge === 'hypothetical' || effect.knowledge === 'hypothetical'
        ? 'hypothetical'
        : effect.knowledge;
    facts.set(effect.fluent, {
      fluent: effect.fluent,
      value,
      knowledge,
      authority: action.authority,
    });
  }
  return { facts };
}

function stateKey(state: CausalState, usefulMaximums: ReadonlyMap<string, number> = new Map()): string {
  return [...state.facts.values()]
    .filter((fact) => fact.knowledge !== 'unknown')
    .sort((a, b) => a.fluent.localeCompare(b.fluent))
    .map((fact) => {
      const maximum = usefulMaximums.get(fact.fluent);
      const value = maximum === undefined ? fact.value : Math.min(fact.value, maximum);
      return `${fact.fluent}=${value}:${fact.knowledge}`;
    })
    .join('|');
}

function unsatisfiedCount(state: CausalState, goal: CausalGoal, allowHypothetical: boolean): number {
  return goal.conditions.filter(
    (condition) => !conditionSatisfied(state, condition, allowHypothetical),
  ).length;
}

interface SearchNode {
  state: CausalState;
  steps: CausalAction[];
  cost: number;
  risk: number;
  score: number;
  hypothetical: boolean;
}

/** Búsqueda uniforme informada, determinista por score e id de acción. */
export function planCausally(
  initial: CausalState,
  goal: CausalGoal,
  rawActions: readonly CausalAction[],
  options: Partial<PlannerLimits> = {},
): CausalPlanResult {
  const limits = { ...DEFAULT_LIMITS, ...options };
  const diagnostics = rawActions.flatMap(validateCausalAction);
  if (diagnostics.length > 0) {
    return { ok: false, reason: 'invalid-model', diagnostics, expandedStates: 0 };
  }
  const actions = [...rawActions]
    .filter((action) => action.knowledge === 'known' || limits.allowHypothetical)
    .sort((a, b) => a.id.localeCompare(b.id));
  // Cantidades por encima de todo umbral relevante son el mismo estado para
  // planificar. Sin esta normalización, una acción repetible como "explorar"
  // produciría loose:x=1,2,3... y agotaría expansiones sin aportar capacidad.
  const usefulMaximums = new Map<string, number>();
  for (const condition of [
    ...goal.conditions,
    ...actions.flatMap((action) => action.preconditions),
  ]) {
    usefulMaximums.set(
      condition.fluent,
      Math.max(usefulMaximums.get(condition.fluent) ?? 0, condition.value),
    );
  }
  const start: SearchNode = {
    state: initial,
    steps: [],
    cost: 0,
    risk: 0,
    score: unsatisfiedCount(initial, goal, limits.allowHypothetical),
    hypothetical: false,
  };
  const open: SearchNode[] = [start];
  const best = new Map<string, number>([[stateKey(initial, usefulMaximums), 0]]);
  let expandedStates = 0;
  let prunedByLimit = false;

  while (open.length > 0 && expandedStates < limits.maxExpandedStates) {
    open.sort((a, b) => a.score - b.score || a.steps.length - b.steps.length);
    const node = open.shift()!;
    expandedStates += 1;
    if (goalSatisfied(node.state, goal, limits.allowHypothetical)) {
      return {
        ok: true,
        plan: {
          steps: node.steps,
          totalCost: node.cost,
          totalRisk: node.risk,
          confidence: node.hypothetical ? 'hypothetical' : 'known',
          finalState: node.state,
          expandedStates,
        },
      };
    }
    if (node.steps.length >= limits.maxDepth) {
      prunedByLimit = true;
      continue;
    }
    for (const action of actions) {
      if (
        !action.preconditions.every((condition) =>
          conditionSatisfied(node.state, condition, limits.allowHypothetical),
        )
      ) {
        continue;
      }
      const cost = node.cost + action.cost;
      const risk = node.risk + action.risk;
      if (cost > limits.maxPlanCost || risk > limits.maxRisk) {
        prunedByLimit = true;
        continue;
      }
      const next = applyAction(node.state, action);
      const key = stateKey(next, usefulMaximums);
      const weighted = cost + risk * limits.riskWeight;
      if ((best.get(key) ?? Number.POSITIVE_INFINITY) <= weighted) continue;
      best.set(key, weighted);
      open.push({
        state: next,
        steps: [...node.steps, action],
        cost,
        risk,
        score: weighted + unsatisfiedCount(next, goal, limits.allowHypothetical),
        hypothetical:
          node.hypothetical ||
          action.knowledge === 'hypothetical' ||
          action.effects.some((effect) => effect.knowledge === 'hypothetical'),
      });
    }
  }

  const limitReached = expandedStates >= limits.maxExpandedStates || prunedByLimit;
  return {
    ok: false,
    reason: limitReached ? 'limit-reached' : 'no-plan',
    diagnostics: [
      ...goal.conditions
        .filter((condition) => !conditionSatisfied(initial, condition, limits.allowHypothetical))
        .map((condition) => `objetivo pendiente: ${condition.fluent}`),
      ...(limitReached ? ['la búsqueda alcanzó un límite configurado'] : []),
    ],
    expandedStates,
  };
}

/** Reproduce un plan sin confiar en el orden que propuso su autor. */
export function validateCausalPlan(
  initial: CausalState,
  goal: CausalGoal,
  steps: readonly CausalAction[],
  options: { allowHypothetical?: boolean } = {},
): PlanValidation {
  let state = initial;
  const issues: PlanValidationIssue[] = [];
  for (const [index, action] of steps.entries()) {
    const actionErrors = validateCausalAction(action);
    for (const detail of actionErrors) {
      issues.push({ step: index, actionId: action.id, kind: 'untrusted-action', detail });
    }
    for (const condition of action.preconditions) {
      if (!conditionSatisfied(state, condition, options.allowHypothetical ?? false)) {
        issues.push({
          step: index,
          actionId: action.id,
          kind: 'false-precondition',
          detail: `${condition.fluent} no satisface ${condition.comparison} ${condition.value}`,
        });
      }
    }
    if (actionErrors.length === 0 && !issues.some((issue) => issue.step === index)) {
      state = applyAction(state, action);
    }
  }
  if (!goalSatisfied(state, goal, options.allowHypothetical ?? false)) {
    issues.push({
      step: steps.length,
      actionId: 'goal',
      kind: 'goal-unmet',
      detail: 'el estado resultante no satisface el objetivo',
    });
  }
  return { valid: issues.length === 0, finalState: state, issues };
}

/**
 * Comprueba el efecto real de un paso. Si una precondición cambió o un efecto
 * conocido no ocurrió, el llamador debe abandonar el sufijo y replanificar
 * desde `observed`.
 */
export function validateObservedStep(
  action: CausalAction,
  before: CausalState,
  observed: CausalState,
): { valid: true } | { valid: false; reason: 'precondition-false' | 'effect-missing'; fluent: string } {
  for (const condition of action.preconditions) {
    if (!conditionSatisfied(before, condition)) {
      return { valid: false, reason: 'precondition-false', fluent: condition.fluent };
    }
  }
  const expected = applyAction(before, action);
  for (const effect of action.effects) {
    if (effect.knowledge !== 'known') continue;
    const expectedFact = factValue(expected, effect.fluent);
    const observedFact = factValue(observed, effect.fluent);
    if (observedFact.knowledge !== 'known' || observedFact.value !== expectedFact.value) {
      return { valid: false, reason: 'effect-missing', fluent: effect.fluent };
    }
  }
  return { valid: true };
}

/** Replanificación explícita: el plan viejo no aporta autoridad al estado nuevo. */
export function replanCausally(
  observed: CausalState,
  goal: CausalGoal,
  actions: readonly CausalAction[],
  failedActionIds: ReadonlySet<string> = new Set(),
  options: Partial<PlannerLimits> = {},
): CausalPlanResult {
  return planCausally(
    observed,
    goal,
    actions.filter((action) => !failedActionIds.has(action.id)),
    options,
  );
}
