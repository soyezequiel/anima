import { chebyshev } from '@anima/shared';
import type { Interaction, PerceivedEntity, Perception, Recipe } from '@anima/sim-core';
import { recipeProductKinds } from '@anima/sim-core';
import type { GoalUserRequest } from './goals.js';
import type {
  CausalAction,
  CausalEffect,
  CausalFact,
  CausalGoal,
  CausalState,
} from './causal-planner.js';
import { causalState } from './causal-planner.js';
import { factValue, planCausally } from './causal-planner.js';

/** Nombres canónicos; la búsqueda no interpreta strings escritos por modelos. */
export const causalFluent = {
  inventory: (kind: string): string => `inventory:${kind}`,
  loose: (kind: string): string => `loose:${kind}`,
  present: (entityId: string): string => `present:${entityId}`,
  located: (entityId: string): string => `located:${entityId}`,
  adjacent: (entityId: string): string => `adjacent:${entityId}`,
};

export interface RememberedCausalEntity {
  id: string;
  kind: string;
  portable?: boolean;
}

export interface CausalWorldModelOptions {
  /** Recuerdos espaciales: útiles, pero hipotéticos hasta volver a percibirlos. */
  rememberedEntities?: readonly RememberedCausalEntity[];
  /** Tipos que vale la pena buscar si no están ahora en el campo perceptivo. */
  explorableKinds?: readonly string[];
  /** Propuestas externas ya marcadas como hipótesis; pasan la puerta del planner. */
  hypotheses?: readonly CausalAction[];
}

export interface CausalWorldModel {
  initial: CausalState;
  actions: CausalAction[];
}

export type CausalRequestPlan =
  | { supported: false }
  | {
      supported: true;
      model: CausalWorldModel;
      goal: CausalGoal;
      result: ReturnType<typeof planCausally>;
    };

function countKinds(entities: readonly PerceivedEntity[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entity of entities) counts.set(entity.kind, (counts.get(entity.kind) ?? 0) + 1);
  return counts;
}

function knownFact(fluent: string, value: number): CausalFact {
  return { fluent, value, knowledge: 'known', authority: 'world' };
}

function metadata(values: Record<string, string | number | boolean>) {
  return values as Readonly<Record<string, string | number | boolean>>;
}

function pickupAction(kind: string): CausalAction {
  return {
    id: `pickup:${kind}`,
    description: `recoger ${kind}`,
    authority: 'code',
    knowledge: 'known',
    preconditions: [
      { fluent: causalFluent.loose(kind), comparison: 'at-least', value: 1 },
    ],
    effects: [
      {
        fluent: causalFluent.loose(kind),
        operation: 'decrease',
        value: 1,
        knowledge: 'known',
      },
      {
        fluent: causalFluent.inventory(kind),
        operation: 'increase',
        value: 1,
        knowledge: 'known',
      },
    ],
    cost: 2,
    risk: 0.02,
    metadata: metadata({ kind: 'pickup', itemKind: kind }),
  };
}

function recipeSuccess(recipe: Recipe, productKind: string): number {
  const total = recipe.outcomes.reduce((sum, outcome) => sum + Math.max(0, outcome.weight), 0);
  if (total <= 0) return 0;
  const successful = recipe.outcomes
    .filter((outcome) => outcome.output?.kind === productKind)
    .reduce((sum, outcome) => sum + Math.max(0, outcome.weight), 0);
  return successful / total;
}

function craftActions(recipe: Recipe): CausalAction[] {
  return recipeProductKinds(recipe).map((productKind) => {
    const probability = recipeSuccess(recipe, productKind);
    const variableConsumption = recipe.outcomes.some((outcome) => (outcome.spares?.length ?? 0) > 0);
    const knowledge = probability === 1 && !variableConsumption ? 'known' : 'hypothetical';
    return {
      id: `craft:${recipe.id}:${productKind}`,
      description: `fabricar ${productKind} con ${recipe.id}`,
      authority: 'world',
      knowledge,
      preconditions: recipe.ingredients.map((ingredient) => ({
        fluent: causalFluent.inventory(ingredient.kind),
        comparison: 'at-least' as const,
        value: ingredient.count,
      })),
      effects: [
        ...recipe.ingredients.map((ingredient): CausalEffect => ({
          fluent: causalFluent.inventory(ingredient.kind),
          operation: 'decrease',
          value: ingredient.count,
          knowledge,
        })),
        {
          fluent: causalFluent.loose(productKind),
          operation: 'increase' as const,
          value: 1,
          knowledge,
        },
      ],
      cost: 3,
      risk: Math.max(1 - probability, variableConsumption ? 0.05 : 0),
      metadata: metadata({ kind: 'craft', recipeId: recipe.id, productKind }),
    };
  });
}

function matchesPerceivedTarget(entity: PerceivedEntity, interaction: Interaction): boolean {
  const target = interaction.target;
  if (target.kind !== undefined && entity.kind !== target.kind) return false;
  if (target.wet !== undefined && (entity.wet === true) !== target.wet) return false;
  if (target.solid !== undefined && (entity.solid === true) !== target.solid) return false;
  if (target.portable !== undefined && (entity.portable === true) !== target.portable) return false;
  if (target.warm !== undefined && (entity.warmth !== undefined) !== target.warm) return false;
  if (target.shelter !== undefined && (entity.shelter === true) !== target.shelter) return false;
  return true;
}

function approachAction(entity: PerceivedEntity, remembered = false): CausalAction {
  return {
    id: `approach:${entity.id}`,
    description: `navegar hasta ${entity.kind}`,
    authority: 'code',
    // La ruta usa percepción parcial: el mundo todavía puede negar un paso.
    knowledge: 'hypothetical',
    preconditions: [
      { fluent: causalFluent.present(entity.id), comparison: 'at-least', value: 1 },
      { fluent: causalFluent.located(entity.id), comparison: 'at-least', value: 1 },
    ],
    effects: [
      {
        fluent: causalFluent.adjacent(entity.id),
        operation: 'set',
        value: 1,
        knowledge: 'hypothetical',
      },
    ],
    cost: remembered ? 8 : Math.max(1, entity.distance ?? 1),
    risk: remembered ? 0.25 : 0.08,
    metadata: metadata({ kind: 'navigate', targetId: entity.id, targetKind: entity.kind }),
  };
}

interface ToolCandidate {
  kind: string;
  power: number;
  /** Ausente significa que el mundo no declara desgaste. */
  durability?: number;
}

function toolCandidates(perception: Perception): ToolCandidate[] {
  const candidates = new Map<string, ToolCandidate>();
  const remember = (candidate: ToolCandidate): void => {
    const previous = candidates.get(candidate.kind);
    if (
      !previous ||
      candidate.power > previous.power ||
      (candidate.power === previous.power &&
        (candidate.durability ?? Number.POSITIVE_INFINITY) >
          (previous.durability ?? Number.POSITIVE_INFINITY))
    ) {
      candidates.set(candidate.kind, candidate);
    }
  };
  for (const entity of [...perception.visibleEntities, ...perception.self.heldItems]) {
    if (entity.toolPower !== undefined) {
      remember({
        kind: entity.kind,
        power: entity.toolPower,
        ...(entity.durability ? { durability: entity.durability.current } : {}),
      });
    }
  }
  for (const recipe of perception.recipes) {
    for (const outcome of recipe.outcomes) {
      const output = outcome.output;
      if (output?.components.tool) {
        // La calidad puede bajar el poder. Planificar con el mínimo evita
        // etiquetar como seguro un golpe que sólo serviría con una tirada alta.
        const power = output.components.tool.power * (outcome.quality?.min ?? 1);
        remember({
          kind: output.kind,
          power,
          ...(output.components.durability
            ? { durability: output.components.durability.current }
            : {}),
        });
      }
    }
  }
  return [...candidates.values()];
}

function harvestActions(perception: Perception, entity: PerceivedEntity): CausalAction[] {
  const drops = entity.dropKinds ?? [];
  if (drops.length === 0 || entity.hardness === undefined || !entity.durability) return [];
  const strength = perception.self.strength ?? 0;
  return toolCandidates(perception)
    .filter((tool) => strength + tool.power > entity.hardness!)
    .filter((tool) => {
      const damage = strength + tool.power - entity.hardness!;
      const hits = Math.ceil(entity.durability!.current / damage);
      return tool.durability === undefined || tool.durability >= hits;
    })
    .map((tool) => {
      const damage = strength + tool.power - entity.hardness!;
      const hits = Math.ceil(entity.durability!.current / damage);
      return {
        id: `harvest:${entity.id}:with:${tool.kind}`,
        description: `transformar ${entity.kind} con ${tool.kind}`,
        authority: 'world',
        knowledge: 'known',
        preconditions: [
          { fluent: causalFluent.present(entity.id), comparison: 'at-least', value: 1 },
          { fluent: causalFluent.adjacent(entity.id), comparison: 'at-least', value: 1 },
          { fluent: causalFluent.inventory(tool.kind), comparison: 'at-least', value: 1 },
        ],
        effects: [
          {
            fluent: causalFluent.present(entity.id),
            operation: 'set',
            value: 0,
            knowledge: 'known',
          },
          ...drops.map((kind) => ({
            fluent: causalFluent.loose(kind),
            operation: 'increase' as const,
            value: 1,
            knowledge: 'known' as const,
          })),
        ],
        cost: hits + 1,
        risk: Math.min(0.4, hits * 0.02),
        metadata: metadata({
          kind: 'harvest',
          sourceId: entity.id,
          sourceKind: entity.kind,
          toolKind: tool.kind,
          hits,
        }),
      };
    });
}

function interactionActions(perception: Perception, entity: PerceivedEntity): CausalAction[] {
  return perception.interactions
    .filter((interaction) => matchesPerceivedTarget(entity, interaction))
    .flatMap((interaction) => {
      const preconditions = [
        { fluent: causalFluent.present(entity.id), comparison: 'at-least' as const, value: 1 },
      ];
      if (interaction.stance !== 'held') {
        preconditions.push({
          fluent: causalFluent.adjacent(entity.id),
          comparison: 'at-least',
          value: 1,
        });
      } else {
        preconditions.push({
          fluent: causalFluent.inventory(entity.kind),
          comparison: 'at-least',
          value: 1,
        });
      }
      if (interaction.requires) {
        preconditions.push({
          fluent: causalFluent.inventory(interaction.requires.heldKind),
          comparison: 'at-least',
          value: 1,
        });
      }
      return interaction.effects.map((effect, index): CausalAction => {
        const oldKind = effect.type === 'transform-held' ? interaction.requires?.heldKind : entity.kind;
        const newKind = effect.kind ?? oldKind;
        const effects =
          oldKind && newKind
            ? [
                {
                  fluent:
                    effect.type === 'transform-held'
                      ? causalFluent.inventory(oldKind)
                      : causalFluent.present(entity.id),
                  operation: 'decrease' as const,
                  value: 1,
                  knowledge: 'known' as const,
                },
                {
                  fluent:
                    effect.type === 'transform-held'
                      ? causalFluent.inventory(newKind)
                      : causalFluent.loose(newKind),
                  operation: 'increase' as const,
                  value: 1,
                  knowledge: 'known' as const,
                },
              ]
            : [];
        return {
          id: `interact:${interaction.id}:${entity.id}:${index}`,
          description: interaction.description,
          authority: 'world',
          knowledge: 'known',
          preconditions,
          effects,
          cost: 2,
          risk: 0.05,
          metadata: metadata({
            kind: 'interact',
            interactionId: interaction.id,
            targetId: entity.id,
          }),
        };
      });
    });
}

/**
 * Proyecta percepción + memoria a un modelo de acciones. Catálogos del mundo
 * (recetas, interacciones, drops) son autoridad; la ausencia fuera de vista no.
 */
export function deriveCausalWorldModel(
  perception: Perception,
  options: CausalWorldModelOptions = {},
): CausalWorldModel {
  const facts: CausalFact[] = [];
  const actions: CausalAction[] = [];
  const held = countKinds(perception.self.heldItems);
  const looseEntities = perception.visibleEntities.filter((entity) => entity.portable === true);
  const loose = countKinds(looseEntities);
  const kinds = new Set<string>([
    ...held.keys(),
    ...loose.keys(),
    ...(options.explorableKinds ?? []),
  ]);

  for (const recipe of perception.recipes) {
    for (const ingredient of recipe.ingredients) kinds.add(ingredient.kind);
    for (const product of recipeProductKinds(recipe)) kinds.add(product);
    actions.push(...craftActions(recipe));
  }
  for (const entity of perception.visibleEntities) {
    kinds.add(entity.kind);
    for (const dropKind of entity.dropKinds ?? []) kinds.add(dropKind);
    for (const interaction of perception.interactions) {
      if (!matchesPerceivedTarget(entity, interaction)) continue;
      for (const effect of interaction.effects) {
        if (effect.kind) kinds.add(effect.kind);
      }
    }
    facts.push(knownFact(causalFluent.present(entity.id), 1));
    facts.push(knownFact(causalFluent.located(entity.id), 1));
    const adjacent =
      entity.position && chebyshev(perception.self.position, entity.position) <= 1 ? 1 : 0;
    facts.push(knownFact(causalFluent.adjacent(entity.id), adjacent));
    if (adjacent === 0) actions.push(approachAction(entity));
    actions.push(...harvestActions(perception, entity));
    actions.push(...interactionActions(perception, entity));
  }

  for (const kind of kinds) {
    facts.push(knownFact(causalFluent.inventory(kind), held.get(kind) ?? 0));
    const looseCount = loose.get(kind) ?? 0;
    // La vista puede confirmar presencia, no ausencia en todo el mundo. Cero
    // queda desconocido y puede ser cubierto por un recuerdo o una búsqueda.
    if (looseCount > 0) facts.push(knownFact(causalFluent.loose(kind), looseCount));
    actions.push(pickupAction(kind));
  }

  for (const remembered of options.rememberedEntities ?? []) {
    // No se afirma `present`: recordar dónde estaba no demuestra que siga ahí.
    facts.push({
      fluent: causalFluent.located(remembered.id),
      value: 1,
      knowledge: 'hypothetical',
      authority: 'memory',
    });
    if (remembered.portable) {
      facts.push({
        fluent: causalFluent.loose(remembered.kind),
        value: 1,
        knowledge: 'hypothetical',
        authority: 'memory',
      });
    }
  }

  for (const kind of options.explorableKinds ?? []) {
    actions.push({
      id: `explore:${kind}`,
      description: `buscar ${kind}`,
      authority: 'code',
      knowledge: 'hypothetical',
      preconditions: [],
      effects: [
        {
          fluent: causalFluent.loose(kind),
          operation: 'increase',
          value: 1,
          knowledge: 'hypothetical',
        },
      ],
      cost: 12,
      risk: 0.35,
      metadata: metadata({ kind: 'explore', itemKind: kind }),
    });
  }

  actions.push(...(options.hypotheses ?? []));
  return { initial: causalState(facts), actions };
}

export function holdingCausalGoal(kind: string, count = 1): CausalGoal {
  return {
    conditions: [
      { fluent: causalFluent.inventory(kind), comparison: 'at-least', value: count },
    ],
  };
}

export function looseCausalGoal(kind: string, count = 1): CausalGoal {
  return {
    conditions: [{ fluent: causalFluent.loose(kind), comparison: 'at-least', value: count }],
  };
}

export function absentCausalGoal(entityId: string): CausalGoal {
  return {
    conditions: [{ fluent: causalFluent.present(entityId), comparison: 'at-most', value: 0 }],
  };
}

/**
 * Traduce objetivos verificables de pedidos comunes al mismo lenguaje del
 * planner. Las formas todavía no modeladas se declaran `unsupported`: nunca se
 * simula causalidad inventada para llenar un hueco.
 */
export function planCausalRequest(
  request: GoalUserRequest,
  perception: Perception,
  options: Pick<CausalWorldModelOptions, 'rememberedEntities'> = {},
): CausalRequestPlan {
  // Una obra tiene estado geométrico y su propio planificador. Salir antes de
  // fundamentar el dominio evita pagar una búsqueda de recursos que no podría
  // expresar el verdadero objetivo de todos modos.
  if (
    request.kind === 'craft-item' &&
    request.recipeId &&
    perception.blueprints.some((blueprint) => blueprint.id === request.recipeId)
  ) {
    return { supported: false };
  }
  // Sin receta no hay efecto de fabricación conocido. La invención puede
  // proponer una, pero hasta que el mundo la valide no entra al modelo causal.
  if (
    request.kind === 'craft-item' &&
    request.recipeId &&
    !perception.recipes.some((recipe) => recipe.id === request.recipeId)
  ) {
    return { supported: false };
  }
  const targetKind = request.targetKind;
  const explorable = new Set<string>();
  if (targetKind) explorable.add(targetKind);
  for (const recipe of perception.recipes) {
    for (const ingredient of recipe.ingredients) explorable.add(ingredient.kind);
  }
  const model = deriveCausalWorldModel(perception, {
    explorableKinds: [...explorable],
    ...(options.rememberedEntities ? { rememberedEntities: options.rememberedEntities } : {}),
  });

  let goal: CausalGoal | undefined;
  if (request.kind === 'fetch-item' && targetKind) {
    const heldNow = factValue(model.initial, causalFluent.inventory(targetKind)).value;
    goal = holdingCausalGoal(targetKind, heldNow + Math.max(1, request.amount ?? 1));
  } else if (request.kind === 'craft-item' && request.recipeId) {
    const recipe = perception.recipes.find((candidate) => candidate.id === request.recipeId);
    const productKind = recipe ? recipeProductKinds(recipe)[0] : undefined;
    if (productKind) {
      const looseNow = factValue(model.initial, causalFluent.loose(productKind)).value;
      goal = looseCausalGoal(productKind, looseNow + 1);
    }
  } else if (request.kind === 'destroy-entity') {
    const target = request.targetEntityId
      ? perception.visibleEntities.find((entity) => entity.id === request.targetEntityId)
      : perception.visibleEntities.find((entity) => entity.kind === targetKind);
    if (target) goal = absentCausalGoal(target.id);
  }

  if (!goal) return { supported: false };
  return {
    supported: true,
    model,
    goal,
    result: planCausally(model.initial, goal, model.actions, {
      allowHypothetical: true,
      maxExpandedStates: 600,
      // Una búsqueda ciega es válida como contingencia, pero una cadena
      // fundamentada en recetas/drops visibles debe ganarle aunque sea larga.
      riskWeight: 50,
    }),
  };
}
