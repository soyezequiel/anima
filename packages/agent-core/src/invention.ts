import { kindWithArticle } from '@anima/shared';
import type { ActionIntent, Interaction, PerceivedEntity, Perception } from '@anima/sim-core';
import { validateInteraction } from '@anima/sim-core';
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
  /** Rechazos (puerta o Dios) a sus interacciones: viajan al siguiente intento. */
  private interactionRejections: string[] = [];

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

  /** El mundo rechazó una propuesta ya emitida: el motivo se recuerda. */
  recordWorldRejection(kind: 'recipe' | 'interaction', reason: string): void {
    this.remember(kind === 'recipe' ? this.recipeRejections : this.interactionRejections, reason);
    this.deps.emit(`${kind}.rejected`, { reason, source: 'world' });
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

    const response = await this.consult({
      kind: 'recipe.propose',
      problem,
      materials,
      ...(options.wantedId !== undefined ? { wantedId: options.wantedId } : {}),
      existingRecipes: perception.recipes.map(
        (recipe) =>
          `${recipe.id} (${recipe.ingredients.map((i) => `${i.count}x ${i.kind}`).join(' + ')})`,
      ),
      ...(this.recipeRejections.length > 0 ? { rejections: [...this.recipeRejections] } : {}),
    });
    if (response === null) return null;
    if (response.kind !== 'recipe') {
      this.deps.emit('provider.error', {
        provider: this.deps.provider.name,
        operation: 'recipe.propose',
        message: `respuesta inesperada del proveedor: ${response.kind}`,
      });
      return null;
    }
    this.deps.emit('recipe.proposed', { rationale: response.rationale });
    return { type: 'proposeRecipe', recipe: response.recipe };
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

  private suspendVetoed(goal: Goal, reason: string): void {
    this.deps.goals.suspend(
      goal.id,
      reason,
      'que algo cambie: otro objeto, otra herramienta, otro pedido',
    );
    this.deps.emit('goal.suspended', { goalId: goal.id, reason: 'veto de la lógica del mundo' });
  }
}
