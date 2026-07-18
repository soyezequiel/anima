import { kindWithArticle } from '@anima/shared';
import type { ActionIntent, Interaction, PerceivedEntity, Perception } from '@anima/sim-core';
import {
  MAX_RECIPE_DEPTH,
  decompositionFor,
  recipeProduct,
  validateDecomposition,
  validateInteraction,
} from '@anima/sim-core';
import type { MemoryStore } from '@anima/memory';
import type { ModelProvider, ModelRequest, ModelResponse } from '@anima/model-providers';
import type { AgentEvent } from './events.js';
import type { Goal, GoalManager } from './goals.js';
import { normalizeSkillName } from './names.js';
import type { ProgressController } from './progress.js';

/**
 * El pipeline de invención: TODO lo que un modelo puede meter al mundo pasa
 * por la misma forma — el modelo propone crudo, una puerta determinista
 * filtra, y el mundo decide (ADR 0018/0024/0027). Este módulo concentra las
 * dos instancias que existen hoy (recetas e interacciones) sobre un núcleo
 * compartido: crédito de intentos por objetivo, memoria de rechazos que viaja
 * al siguiente intento, y consultas al proveedor con el error como dato.
 *
 * La única diferencia estructural entre ambas es deliberada: las
 * interacciones tienen un juez de coherencia (la IA Dios) y las recetas no.
 * Si mañana se abre una tercera puerta de invención (refugios, interacciones
 * por necesidad propia), debería ser una configuración más de este pipeline,
 * no una tercera copia.
 */

/**
 * Cuántas veces puede intentar inventar algo antes de rendirse y pedir ayuda.
 * Inventar cuesta una consulta al modelo por intento: sin tope, un mundo donde
 * nada sirve la dejaría proponiendo para siempre.
 */
export const MAX_INVENTION_ATTEMPTS = 3;

/**
 * Cuántas recetas admite un plan (ADR 0031). Es el tope de capas del árbol: si
 * una idea necesita más de cuatro pisos, la puerta la iba a rechazar igual
 * (`expandRecipeCost` la corta), y proponer lo que se va a rechazar solo gasta
 * turnos y ticks.
 */
export const MAX_PLAN_RECIPES = MAX_RECIPE_DEPTH;

/** Lo que se puede leer de una receta cruda sin confiar en ella. */
interface PlanNode {
  raw: unknown;
  /** Qué produce, si lo dice. */
  produces?: string;
  /** De qué dice hacerse. */
  needs: string[];
}

/**
 * Lee una propuesta cruda lo justo para poder ordenarla. No valida nada: la
 * validación es del mundo, y acá solo hace falta saber quién depende de quién.
 * Lo que no se entienda queda sin dependencias y sale primero — el mundo dirá
 * lo suyo cuando le llegue.
 */
function planNode(raw: unknown): PlanNode {
  const recipe = raw as { output?: { kind?: unknown }; ingredients?: unknown };
  const produces = typeof recipe?.output?.kind === 'string' ? recipe.output.kind : undefined;
  const needs = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients
        .map((i) => (i as { kind?: unknown })?.kind)
        .filter((kind): kind is string => typeof kind === 'string')
    : [];
  return { raw, ...(produces !== undefined ? { produces } : {}), needs };
}

/**
 * Ordena el plan de las hojas al tronco: primero la tabla, después la pared,
 * al final la casa. No es un detalle de presentación — la puerta rechaza lo
 * que se hace de algo que todavía no existe, así que un plan en el orden en
 * que se le ocurrió al modelo entraría al revés y se caería entero.
 *
 * Un plan que se muerde la cola (la tabla se hace de la casa) no se puede
 * ordenar: lo que quede se emite como vino y que lo rechace el mundo, que para
 * eso es quien decide.
 */
function orderPlan(raws: unknown[]): unknown[] {
  const pending = raws.slice(0, MAX_PLAN_RECIPES).map(planNode);
  const ordered: unknown[] = [];
  while (pending.length > 0) {
    const madeHere = new Set(
      pending.map((node) => node.produces).filter((kind): kind is string => kind !== undefined),
    );
    const index = pending.findIndex((node) => !node.needs.some((kind) => madeHere.has(kind)));
    if (index === -1) {
      ordered.push(...pending.map((node) => node.raw));
      break;
    }
    ordered.push(...pending.splice(index, 1).map((node) => node.raw));
  }
  return ordered;
}

/**
 * Cuántos de cada tipo, en orden de aparición: "2x esquirla" se lee mejor que
 * dos renglones iguales, y el juez pesa mejor una lista corta.
 */
function countByKind(drops: readonly { kind: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const drop of drops) counts.set(drop.kind, (counts.get(drop.kind) ?? 0) + 1);
  return counts;
}

/** Lo que el agente le presta al pipeline: sus órganos, no su clase entera. */
export interface InventionDeps {
  provider: ModelProvider;
  memory: MemoryStore;
  goals: GoalManager;
  progress: ProgressController;
  emit(type: AgentEvent['type'], data: Record<string, unknown>): void;
  reply(text: string): void;
  currentTick(): number;
}

export class InventionEngine {
  /** Rechazos del mundo a sus recetas: viajan al siguiente intento. */
  private recipeRejections: string[] = [];
  /** Lo que queda del plan por proponer, ya ordenado de las hojas al tronco. */
  private pendingPlan: unknown[] = [];
  /**
   * El plano que espera a que sus recetas entren antes de proponerse (ADR
   * 0032). Una obra necesita que sus piezas sean fabricables primero: la casa
   * después de las paredes, como las paredes después de las tablas.
   */
  private pendingBlueprint: unknown | null = null;
  /** Rechazos (puerta o Dios) a sus interacciones: viajan al siguiente intento. */
  private interactionRejections: string[] = [];
  /** Rechazos a sus descomposiciones: mismo trato, viajan al próximo intento. */
  private decompositionRejections: string[] = [];

  constructor(private readonly deps: InventionDeps) {}

  // ---- núcleo compartido ----------------------------------------------------

  /**
   * Una consulta al proveedor con el fallo como dato, nunca como excepción
   * hacia arriba: se registra y el flujo degrada (statu quo). El lado seguro
   * de un error siempre es que nada entre al mundo.
   */
  private async consult(
    request: ModelRequest,
    recoveredWith?: string,
  ): Promise<ModelResponse | null> {
    try {
      return await this.deps.provider.complete(request);
    } catch (error) {
      this.deps.emit('provider.error', {
        provider: this.deps.provider.name,
        operation: request.kind,
        message: error instanceof Error ? error.message : String(error),
        ...(recoveredWith !== undefined ? { recoveredWith } : {}),
      });
      return null;
    }
  }

  private remember(list: string[], reason: string): void {
    if (!list.includes(reason)) list.push(reason);
  }

  /** El crédito por objetivo es uno solo, invente lo que invente. */
  private spendAttempt(goalId: string): boolean {
    if (this.deps.progress.recipeAttemptsFor(goalId) >= MAX_INVENTION_ATTEMPTS) return false;
    this.deps.progress.recordRecipeAttempt(goalId);
    return true;
  }

  /**
   * El mundo rechazó una propuesta ya emitida: el motivo se recuerda. Un plano
   * rechazado (obra demasiado grande, bloque imposible) alimenta la MISMA lista
   * que las recetas, porque las obras nacen de `recipe.propose`: así el motivo
   * —"solo puedo cargar 6 bloques"— viaja a la próxima idea y el modelo propone
   * una casa más chica en vez de reintentar la que no le entra en los brazos.
   */
  recordWorldRejection(
    kind: 'recipe' | 'interaction' | 'blueprint' | 'decomposition',
    reason: string,
  ): void {
    const list =
      kind === 'interaction'
        ? this.interactionRejections
        : kind === 'decomposition'
          ? this.decompositionRejections
          : this.recipeRejections;
    this.remember(list, reason);
    this.deps.emit(`${kind}.rejected`, { reason, source: 'world' });
    // Si se cayó una pieza (o la obra que la coronaba), lo que se apoyaba en
    // ella ya no se sostiene: se tira el resto del plan y se vuelve a pensar con
    // el motivo como dato (ADR 0018). Las interacciones y las descomposiciones
    // no participan del plan de recetas: rechazarlas no tira nada.
    if (kind === 'recipe' || kind === 'blueprint') {
      this.pendingPlan = [];
      this.pendingBlueprint = null;
    }
  }

  /**
   * La próxima receta del plan que valga la pena proponer, o null si no queda
   * nada. Lo que el mundo ya sabe hacer se saltea sin gastar un tick: volver a
   * proponer la tabla que ya existe es un rechazo tonto ("ya sé hacer eso") y
   * ese rechazo se llevaría puesto el resto del plan.
   */
  nextPlanStep(perception: Perception): ActionIntent | null {
    while (this.pendingPlan.length > 0) {
      const raw = this.pendingPlan.shift();
      const node = planNode(raw);
      const known =
        node.produces !== undefined &&
        perception.recipes.some((recipe) => recipeProduct(recipe)?.kind === node.produces);
      if (!known) return { type: 'proposeRecipe', recipe: raw };
    }
    // Las piezas ya entraron: ahora sí la obra (ADR 0032). Si ya está en el
    // mundo (se aprendió antes, o se restauró de un guardado) no se re-propone.
    if (this.pendingBlueprint !== null) {
      const blueprint = this.pendingBlueprint;
      this.pendingBlueprint = null;
      const id = (blueprint as { id?: unknown })?.id;
      const known =
        typeof id === 'string' && perception.blueprints.some((b) => b.id === id);
      if (!known) return { type: 'proposeBlueprint', blueprint };
    }
    return null;
  }

  attemptsLeft(goalId: string): boolean {
    return this.deps.progress.recipeAttemptsFor(goalId) < MAX_INVENTION_ATTEMPTS;
  }

  // ---- recetas (ADR 0018) ---------------------------------------------------

  /**
   * Inventar un objeto que su mundo no sabe construir. El modelo propone; la
   * intención va al mundo, que valida y decide. Un rechazo no se pierde: se
   * recuerda y viaja al siguiente intento, para que corrija en vez de
   * insistir. Devuelve la intención de proponer, o null si no hay nada.
   */
  async inventRecipe(
    problem: string,
    perception: Perception,
    options: { goalId: string; wantedId?: string },
  ): Promise<ActionIntent | null> {
    const materials = [
      ...new Set([
        ...perception.self.heldItems.map((item) => `${item.kind} (lo llevo encima)`),
        ...perception.visibleEntities.filter((e) => e.portable).map((e) => `${e.kind} (lo veo)`),
      ]),
    ];
    // Sin materiales no hay nada que inventar: es falta de recurso, no de idea.
    if (materials.length === 0) return null;
    if (!this.spendAttempt(options.goalId)) return null;

    // La experiencia pasada viaja con la propuesta (ADR 0033): lo que ya hizo
    // o ya le falló, relacionado con el problema, para que la idea nueva no
    // ignore la historia. Recuperación acotada: nunca "toda la memoria".
    const past = this.deps.memory.retrieve(problem, 3);
    const priorExperience = past.episodes
      .filter((e) => e.kind === 'deed' || e.kind === 'failure')
      .map((e) => (e.occurrences > 1 ? `antes: ${e.summary} (×${e.occurrences})` : `antes: ${e.summary}`));

    const response = await this.consult({
      kind: 'recipe.propose',
      problem,
      materials,
      ...(priorExperience.length > 0 ? { priorExperience } : {}),
      ...(options.wantedId !== undefined ? { wantedId: options.wantedId } : {}),
      existingRecipes: perception.recipes.map(
        (recipe) =>
          `${recipe.id} (${recipe.ingredients.map((i) => `${i.count}x ${i.kind}`).join(' + ')})`,
      ),
      // El tope de una obra: lo que puede cargar (ADR 0032). Va siempre — si la
      // idea resulta un objeto, no estorba; si resulta una obra, evita que
      // proponga una casa que no le entra en los brazos.
      blockBudget: perception.self.inventoryCapacity,
      ...(this.recipeRejections.length > 0 ? { rejections: [...this.recipeRejections] } : {}),
    });
    if (response === null) return null;
    // Tres formas de una misma idea: una receta suelta, un árbol de recetas
    // (ADR 0031), o una obra —recetas + plano— (ADR 0032). La forma que elige
    // el modelo ES su decisión sobre qué es la cosa: un objeto, un objeto de
    // partes, o un lugar hecho de bloques.
    if (
      response.kind !== 'recipe' &&
      response.kind !== 'recipe-plan' &&
      response.kind !== 'blueprint'
    ) {
      this.deps.emit('provider.error', {
        provider: this.deps.provider.name,
        operation: 'recipe.propose',
        message: `respuesta inesperada del proveedor: ${response.kind}`,
      });
      return null;
    }
    const plan =
      response.kind === 'recipe'
        ? [response.recipe]
        : response.kind === 'recipe-plan'
          ? response.recipes
          : response.recipes;
    this.pendingPlan = orderPlan(plan);
    this.pendingBlueprint = response.kind === 'blueprint' ? response.blueprint : null;
    this.deps.emit('recipe.proposed', {
      rationale: response.rationale,
      // Cuántas piezas tiene la idea: una casa que necesita paredes que
      // necesitan tablas son tres, y eso se ve en la evidencia. La obra suma
      // un paso más: el plano que las dispone.
      steps: this.pendingPlan.length + (this.pendingBlueprint !== null ? 1 : 0),
    });
    return this.nextPlanStep(perception);
  }

  // ---- interacciones (ADR 0027) ----------------------------------------------

  /** El id con el que una interacción se guarda y se busca: verbo + objeto. */
  interactionIdFor(verb: string, targetKind: string): string {
    return normalizeSkillName(`${verb}-${targetKind}`);
  }

  /** El selector de la interacción, contra lo que ELLA percibe del objeto. */
  private perceivedMatchesTarget(
    entity: PerceivedEntity,
    target: Interaction['target'],
  ): boolean {
    if (target.kind !== undefined && entity.kind !== target.kind) return false;
    if (target.wet !== undefined && (entity.wet ?? false) !== target.wet) return false;
    if (target.solid !== undefined && (entity.solid ?? false) !== target.solid) return false;
    if (target.portable !== undefined && (entity.portable ?? false) !== target.portable)
      return false;
    if (target.warm !== undefined && (entity.warmth !== undefined) !== target.warm) return false;
    if (target.shelter !== undefined && (entity.shelter ?? false) !== target.shelter) return false;
    return true;
  }

  /**
   * Reuso primero: una interacción validada vive en `world.interactions` y NO
   * se inventa de nuevo — ni en esta sesión ni tras restaurar un guardado.
   * Encontrarla no cuesta ninguna consulta al modelo; solo crearla costó.
   */
  findInteractionFor(
    verb: string,
    targetKind: string,
    perception: Perception,
  ): Interaction | undefined {
    const wantedId = this.interactionIdFor(verb, targetKind);
    const byId = perception.interactions.find((i) => i.id === wantedId);
    if (byId) return byId;
    // Mismo verbo, objetivo compatible: "juntar-agua" guardada sobre {wet}
    // sirve también para el estanque nuevo, tenga el nombre que tenga.
    const sample =
      perception.visibleEntities.find((e) => e.kind === targetKind) ??
      perception.self.heldItems.find((e) => e.kind === targetKind);
    return perception.interactions.find(
      (interaction) =>
        interaction.id.startsWith(normalizeSkillName(verb)) &&
        (interaction.target.kind === targetKind ||
          (sample !== undefined && this.perceivedMatchesTarget(sample, interaction.target))),
    );
  }

  /** Rasgos observables del objetivo, en voz humana: base de la propuesta y del juicio. */
  private targetFacts(targetKind: string, perception: Perception): string[] {
    const sample =
      perception.visibleEntities.find((e) => e.kind === targetKind) ??
      perception.self.heldItems.find((e) => e.kind === targetKind);
    const facts: string[] = [];
    if (sample?.wet) facts.push('es agua: no se puede pisar, y suelta no se puede llevar');
    if (sample?.solid)
      facts.push(
        'es sólido: bloquea el paso al caminar, pero subirse encima (postura on-top) es posible',
      );
    if (sample?.portable) facts.push('se puede recoger y llevar');
    if (sample?.warmth !== undefined) facts.push('irradia calor (y pegado quema)');
    if (sample?.shelter) facts.push('es un refugio');
    if (sample?.edible) facts.push('es comestible');
    facts.push(
      ...this.deps.memory
        .factList()
        .filter((f) => f.statement.includes(targetKind))
        .slice(-3)
        .map((f) => `sé que ${f.statement}`),
    );
    return facts;
  }

  /**
   * Inventar una interacción que su mundo no admite (ADR 0027). Tres puertas,
   * en orden y sin atajos: el modelo propone (mente de la mascota), la física
   * determinista filtra (`validateInteraction`, la misma que step.ts volverá
   * a aplicar), y la IA Dios juzga la LÓGICA — que llevar agua exija un
   * recipiente no lo sabe ningún esquema, lo sabe el guardián del sentido de
   * las cosas. Un veto del Dios queda como hecho en su memoria: lo vetado no
   * se re-inventa, ni siquiera en otra sesión.
   */
  async inventInteraction(goal: Goal, perception: Perception): Promise<ActionIntent | null> {
    const request = goal.userRequest;
    if (request?.kind !== 'interact-entity' || !request.verb || !request.targetKind) return null;
    // Reuso: si ya la sabe, no hay nada que inventar — a ejecutarla.
    if (this.findInteractionFor(request.verb, request.targetKind, perception)) return null;

    const wantedId = this.interactionIdFor(request.verb, request.targetKind);
    const veto = this.deps.memory
      .factList()
      .find((f) => f.statement.startsWith(`mi mundo no permite ${wantedId}`));
    if (veto) {
      this.deps.reply(`Eso ya lo pensé una vez, y ${veto.statement}.`);
      this.suspendVetoed(goal, 'la lógica del mundo ya rechazó esa interacción');
      return null;
    }

    if (!this.spendAttempt(goal.id)) return null;

    const targetFacts = this.targetFacts(request.targetKind, perception);
    const proposal = await this.consult({
      kind: 'interaction.propose',
      problem: `mi cuidador me pidió ${request.verb.replace(/-/g, ' ')} con ${kindWithArticle(request.targetKind)}`,
      wantedId,
      targetKind: request.targetKind,
      targetFacts,
      heldKinds: [...new Set(perception.self.heldItems.map((item) => item.kind))],
      existingInteractions: perception.interactions.map(
        (interaction) => `${interaction.id} (${interaction.description})`,
      ),
      ...(this.interactionRejections.length > 0
        ? { rejections: [...this.interactionRejections] }
        : {}),
    });
    if (proposal === null) return null;
    if (proposal.kind !== 'interaction') {
      this.deps.emit('provider.error', {
        provider: this.deps.provider.name,
        operation: 'interaction.propose',
        message: `respuesta inesperada del proveedor: ${proposal.kind}`,
      });
      return null;
    }
    this.deps.emit('interaction.proposed', {
      interactionId: wantedId,
      rationale: proposal.rationale,
    });

    // La puerta local decide si vale la pena molestar al juez; el motivo de
    // un rechazo viaja al próximo intento, como con las recetas.
    const validated = validateInteraction(proposal.interaction, perception.interactions);
    if (!validated.ok) {
      this.remember(this.interactionRejections, validated.error);
      this.deps.emit('interaction.rejected', { reason: validated.error, source: 'gate' });
      return null;
    }

    // El juicio de la IA Dios: la física ya dijo "expresable"; falta
    // "coherente". Sin juez, nada entra: este poder no anda suelto.
    const judgement = await this.consult(
      {
        kind: 'interaction.judge',
        interactionId: validated.value.id,
        description: validated.value.description,
        stance: validated.value.stance,
        targetKind: request.targetKind,
        effectsSummary: validated.value.effects.map((effect) =>
          effect.type === 'transform-held'
            ? `lo que lleva (${validated.value.requires?.heldKind ?? '?'}) se convierte en ${effect.kind ?? 'otra versión de sí mismo'}`
            : `el objetivo se convierte en ${effect.kind ?? 'otra versión de sí mismo'}`,
        ),
        ...(validated.value.requires !== undefined
          ? { requiresHeld: validated.value.requires.heldKind }
          : {}),
        facts: [
          ...targetFacts,
          `llevo encima: ${perception.self.heldItems.map((item) => item.kind).join(', ') || 'nada'}`,
        ],
      },
      'statu-quo',
    );
    if (judgement === null) return null;
    if (judgement.kind !== 'judgement') {
      this.deps.emit('provider.error', {
        provider: this.deps.provider.name,
        operation: 'interaction.judge',
        message: `respuesta inesperada del proveedor: ${judgement.kind}`,
        recoveredWith: 'statu-quo',
      });
      return null;
    }
    this.deps.emit('interaction.judged', {
      interactionId: validated.value.id,
      willing: judgement.willing,
      reason: judgement.reason,
    });
    if (!judgement.willing) {
      // El veto es conocimiento y persiste (viaja en su memoria y en el
      // legado): lo vetado no se vuelve a inventar, y el motivo se dice.
      const fact = this.deps.memory.addFact(
        `mi mundo no permite ${wantedId}: ${judgement.reason}`,
        this.deps.currentTick(),
      );
      this.deps.emit('memory.created', { kind: 'fact', statement: fact.statement });
      this.deps.reply(`Lo imaginé, pero la lógica de mi mundo lo rechaza: ${judgement.reason}`);
      this.suspendVetoed(goal, 'la lógica del mundo rechazó la interacción');
      return null;
    }

    // Aprobada por la física y por el Dios: al mundo, que vuelve a validar.
    return { type: 'proposeInteraction', interaction: proposal.interaction };
  }

  // ---- descomposiciones (la cuarta puerta) -----------------------------------

  /**
   * Inventar en QUÉ se deshace algo al romperse. Es la cuarta puerta y sigue el
   * mismo camino que las interacciones: el modelo propone, la física
   * determinista filtra, y la IA Dios juzga la coherencia — que un pedernal
   * deje esquirlas y no diez troncos no lo sabe ningún esquema, porque la
   * materia base no tiene receta que acote su costo. Ahí, y no en un tope
   * numérico, vive la conservación (ADR 0008).
   *
   * Una diferencia deliberada con las interacciones: un veto aquí NO cancela el
   * acto. Que el Dios rechace unos fragmentos significa "romperlo no deja eso",
   * no "no se puede romper" — el golpe sigue su curso y la cosa se rompe sin
   * dejar nada, que es exactamente como se comportaba el mundo antes. Suspender
   * el objetivo convertiría una idea fallida en una prohibición.
   */
  async inventDecomposition(
    targetKind: string,
    perception: Perception,
    options: { goalId: string },
  ): Promise<ActionIntent | null> {
    // Reuso primero: si el mundo ya sabe en qué se deshace, no cuesta nada.
    if (decompositionFor(perception.decompositions, targetKind)) return null;

    // Lo que ya declara qué deja (un árbol, una silla con sus materiales) no
    // necesita regla: su propio `drops` manda sobre la del tipo.
    const sample =
      perception.visibleEntities.find((e) => e.kind === targetKind) ??
      perception.self.heldItems.find((e) => e.kind === targetKind);
    if (sample?.leavesRemains) return null;

    const veto = this.deps.memory
      .factList()
      .find((f) => f.statement.startsWith(`romper ${targetKind} no deja nada`));
    // Ya se pensó una vez y el Dios dijo que no queda nada: no se re-pregunta.
    if (veto) return null;

    if (!this.spendAttempt(options.goalId)) return null;

    const targetFacts = this.targetFacts(targetKind, perception);
    const knownKinds = [
      ...new Set([
        ...perception.visibleEntities.map((e) => e.kind),
        ...perception.self.heldItems.map((e) => e.kind),
      ]),
    ].filter((kind) => kind !== targetKind);

    const proposal = await this.consult({
      kind: 'decomposition.propose',
      targetKind,
      targetFacts,
      knownKinds,
      ...(this.decompositionRejections.length > 0
        ? { rejections: [...this.decompositionRejections] }
        : {}),
    });
    if (proposal === null) return null;
    if (proposal.kind !== 'decomposition') {
      this.deps.emit('provider.error', {
        provider: this.deps.provider.name,
        operation: 'decomposition.propose',
        message: `respuesta inesperada del proveedor: ${proposal.kind}`,
      });
      return null;
    }
    this.deps.emit('decomposition.proposed', {
      targetKind,
      rationale: proposal.rationale,
    });

    // La puerta local decide si vale la pena molestar al juez; el motivo de un
    // rechazo viaja al próximo intento, como con las recetas.
    const validated = validateDecomposition(proposal.decomposition, perception.decompositions);
    if (!validated.ok) {
      this.remember(this.decompositionRejections, validated.error);
      this.deps.emit('decomposition.rejected', { reason: validated.error, source: 'gate' });
      return null;
    }

    // El juicio de la IA Dios: la física ya dijo "expresable"; falta que sea
    // materia honesta — que lo que queda salga del objeto y valga menos.
    const judgement = await this.consult(
      {
        kind: 'decomposition.judge',
        targetKind,
        dropsSummary: [...countByKind(validated.value.drops)].map(
          ([kind, count]) => `${count}x ${kind}`,
        ),
        facts: targetFacts,
      },
      'statu-quo',
    );
    if (judgement === null) return null;
    if (judgement.kind !== 'judgement') {
      this.deps.emit('provider.error', {
        provider: this.deps.provider.name,
        operation: 'decomposition.judge',
        message: `respuesta inesperada del proveedor: ${judgement.kind}`,
        recoveredWith: 'statu-quo',
      });
      return null;
    }
    this.deps.emit('decomposition.judged', {
      targetKind,
      willing: judgement.willing,
      reason: judgement.reason,
    });
    if (!judgement.willing) {
      // El veto es conocimiento y persiste: romper eso no deja nada, y no hay
      // que volver a imaginarlo. Pero el acto sigue en pie — se rompe igual.
      const fact = this.deps.memory.addFact(
        `romper ${targetKind} no deja nada: ${judgement.reason}`,
        this.deps.currentTick(),
      );
      this.deps.emit('memory.created', { kind: 'fact', statement: fact.statement });
      return null;
    }

    // Aprobada por la física y por el Dios: al mundo, que vuelve a validar.
    return { type: 'proposeDecomposition', decomposition: proposal.decomposition };
  }

  private suspendVetoed(goal: Goal, reason: string): void {
    this.deps.goals.suspend(
      goal.id,
      reason,
      'que algo cambie: otro objeto, otra herramienta, otro pedido',
    );
    this.deps.emit('goal.suspended', { goalId: goal.id, reason: 'veto de la lógica del mundo' });
  }
}
