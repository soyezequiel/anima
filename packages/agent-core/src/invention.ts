import { kindLabel, kindWithArticle } from '@anima/shared';
import type {
  ActionIntent,
  Blueprint,
  Interaction,
  PerceivedEntity,
  Perception,
} from '@anima/sim-core';
import {
  MAX_BLUEPRINT_BLOCKS,
  MAX_BLUEPRINT_OFFSET,
  MAX_RECIPE_DEPTH,
  decompositionFor,
  recipeProduct,
  validateDecomposition,
  validateGlyph,
  validateInteraction,
  validateRecipe,
  validateWorkGlyphs,
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
 * Desde el ADR 0042 las tres puertas que tocan la física comparten también el
 * juez: el modelo propone, la puerta determinista filtra lo que se puede medir,
 * y la IA Dios cuida lo que no se mide. Las recetas fueron las últimas en
 * tenerlo, y el hueco se veía: "celular = 1 rama + 1 pedernal" pasaba todas las
 * comprobaciones —no crea materia, no cicla, sus propiedades están en cota—
 * porque cada una mira UN paso aislado y ese paso está bien formado. Lo que
 * ninguna medía es que faltaran los pasos del MEDIO. El juez no prohíbe el
 * celular: exige la cadena que lo sostiene (ADR 0031/0042).
 *
 * Si mañana se abre una puerta más, debería ser una configuración más de este
 * pipeline, no otra copia.
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
/**
 * La primera frase de un veredicto: lo que se le dice al cuidador (ADR 0073).
 *
 * Los veredictos del juez se escriben para ella y son largos a propósito —le
 * nombran las piezas que le faltan, que es de donde nace su próxima idea—. Al
 * cuidador le alcanza con el titular. Si esa primera frase igual se va de
 * largo, se corta en palabra entera: una idea que termina se lee; una cortada
 * al medio parece un error del programa.
 */
function firstSentence(reason: string, max = 180): string {
  const clean = reason.replace(/\s+/g, ' ').trim();
  const boundary = clean.search(/(?<=[.!?])\s/);
  const first = boundary > 0 ? clean.slice(0, boundary) : clean;
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:—-]+$/, '')}…`;
}

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
  /**
   * Para qué nació el plan. Viaja hasta el juez (ADR 0042) porque una receta se
   * juzga contra el problema que decía resolver: "una vara larga" tiene sentido
   * si no llega a la fruta, y ninguno si tiene frío.
   */
  private pendingProblem = '';
  /**
   * De QUIÉN es el plan que está en curso. El plan vivía suelto en el motor, así
   * que una idea nacida del frío se seguía emitiendo desde el objetivo del
   * hambre o desde el encargo del cuidador — y cualquier regla que mire "para
   * qué objetivo se está inventando" se podía saltear por ese agujero.
   *
   * Una idea es de quien la pidió: mientras haya plan abierto, solo su dueño lo
   * continúa.
   */
  private pendingOwnerGoalId: string | null = null;
  /** Rechazos (puerta o Dios) a sus interacciones: viajan al siguiente intento. */
  private interactionRejections: string[] = [];
  /** Rechazos a sus descomposiciones: mismo trato, viajan al próximo intento. */
  private decompositionRejections: string[] = [];
  /** Rechazos a sus dibujos: mismo trato, viajan al próximo intento. */
  private glyphRejections: string[] = [];
  /** Rechazos a sus dibujos de obra: lista propia, otro problema que corregir. */
  private workGlyphRejections: string[] = [];

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
    kind: 'recipe' | 'interaction' | 'blueprint' | 'decomposition' | 'glyph' | 'workGlyphs',
    reason: string,
  ): void {
    const list =
      kind === 'interaction'
        ? this.interactionRejections
        : kind === 'decomposition'
          ? this.decompositionRejections
          : kind === 'glyph'
            ? this.glyphRejections
            : kind === 'workGlyphs'
              ? this.workGlyphRejections
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
      this.pendingOwnerGoalId = null;
    }
  }

  /**
   * La próxima receta del plan que valga la pena proponer, o null si no queda
   * nada. Lo que el mundo ya sabe hacer se saltea sin gastar un tick: volver a
   * proponer la tabla que ya existe es un rechazo tonto ("ya sé hacer eso") y
   * ese rechazo se llevaría puesto el resto del plan.
   */
  async nextPlanStep(perception: Perception, goalId?: string): Promise<ActionIntent | null> {
    // El plan abierto es de quien lo pidió: otro objetivo no lo continúa. Sin
    // esto, una idea del frío seguía saliendo por el encargo del cuidador y al
    // revés — y con ella se colaban las piezas de un plan que nadie había
    // pedido desde acá.
    if (
      goalId !== undefined &&
      this.pendingOwnerGoalId !== null &&
      this.pendingOwnerGoalId !== goalId
    ) {
      return null;
    }
    while (this.pendingPlan.length > 0) {
      const raw = this.pendingPlan.shift();
      const node = planNode(raw);
      const known =
        node.produces !== undefined &&
        perception.recipes.some((recipe) => recipeProduct(recipe)?.kind === node.produces);
      if (known) continue;
      // Cada receta pasa por el Dios antes de llegar al mundo (ADR 0042). Se
      // juzga aquí, de a una y en el momento de emitirla, y no el plan entero
      // de golpe: una receta se juzga por lo que ES, y en un árbol de cuatro
      // capas las de abajo todavía no existían cuando el modelo las pensó.
      const verdict = await this.judgeRecipe(raw, perception);
      if (verdict === 'rejected') return null;
      if (verdict === 'unavailable') {
        // El juez no contestó. Nada entra —es el lado seguro, el mismo que las
        // otras dos puertas— pero el plan se conserva: no fue una mala idea,
        // fue un fallo de infraestructura, y castigarla por eso sería mentirle.
        this.pendingPlan.unshift(raw);
        return null;
      }
      return { type: 'proposeRecipe', recipe: raw };
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

  /**
   * El hecho con el que se recuerda un veto de receta: nombre, FORMA y motivo.
   *
   * La forma no es un adorno. Al juez se le pregunta algo distinto según lo que
   * tenga delante: de una cosa suelta puede decir «eso es una obra, no una
   * cosa», y de una pieza de obra esa objeción no tiene sentido (ADR 0074).
   *
   * Sin la forma en el veto pasaba esto, y se vio en una partida real: el juez
   * rechazó «puente» como cosa pidiendo textualmente que se propusiera como
   * OBRA; el modelo obedeció y mandó el plano con sus piezas; y el veto viejo
   * —guardado solo contra el nombre «puente»— tumbó la obra antes de que nadie
   * la mirara. La memoria del rechazo bloqueaba justo la corrección que el
   * rechazo había pedido.
   *
   * Los dos prefijos son hermanos y ninguno es prefijo del otro: buscar uno
   * nunca encuentra al otro por accidente.
   */
  private recipeVetoPrefix(outputKind: string, partOfWork: boolean): string {
    const shape = partOfWork ? 'como pieza de una obra' : 'como cosa';
    return `no tiene sentido construir ${outputKind} ${shape}`;
  }

  /**
   * El veto guardado que corresponde a ESTA forma, si lo hay. Reconoce también
   * el formato viejo (sin forma), que solo puede haber sido de una cosa suelta:
   * un guardado anterior no debería perder lo que ya había aprendido.
   */
  private vetoFor(outputKind: string, partOfWork: boolean): string | undefined {
    const prefix = this.recipeVetoPrefix(outputKind, partOfWork);
    const legacy = `no tiene sentido construir ${outputKind}:`;
    return this.deps.memory
      .factList()
      .find(
        (f) => f.statement.startsWith(prefix) || (!partOfWork && f.statement.startsWith(legacy)),
      )?.statement;
  }

  /**
   * Qué haría lo construido, en frases humanas. El juez pesa mejor "da calor" e
   * "irradia calor" que un JSON de componentes, y sobre todo: puede contrastar
   * lo que la cosa HACE con lo que la cosa DICE LLAMARSE, que es exactamente
   * donde se cuela un celular hecho de una rama.
   */
  private describeComponents(components: Record<string, unknown>): string[] {
    const said: string[] = [];
    const value = (key: string, field: string): number | undefined => {
      const component = components[key] as Record<string, unknown> | undefined;
      const raw = component?.[field];
      return typeof raw === 'number' ? raw : undefined;
    };
    if (components.portable) said.push('se puede llevar encima');
    const solid = (components.collider as { solid?: unknown } | undefined)?.solid;
    if (solid === true) said.push('es sólido: bloquea el paso');
    const hardness = value('hardness', 'value');
    if (hardness !== undefined) said.push(`tiene dureza ${hardness}`);
    const durability = value('durability', 'max');
    if (durability !== undefined) said.push(`aguanta ${durability} golpes antes de romperse`);
    const power = value('tool', 'power');
    if (power !== undefined) said.push(`sirve como herramienta de fuerza ${power}`);
    const warmth = value('heatSource', 'warmthPerTick');
    if (warmth !== undefined) said.push(`da calor (${warmth} por tick)`);
    const damage = value('hazard', 'damagePerTick');
    if (damage !== undefined) said.push(`hace daño al tocarlo (${damage} por tick)`);
    return said;
  }

  /**
   * El juicio de la IA Dios sobre UNA receta (ADR 0042). Tres respuestas, y la
   * diferencia entre las dos últimas importa: `rejected` es "el mundo dijo que
   * no" y cuesta el plan entero; `unavailable` es "no hubo quien dijera nada" y
   * no cuesta nada, porque un proveedor caído no es un veredicto.
   *
   * Antes del juez corre la puerta determinista, igual que en las otras dos
   * puertas: si la idea ya es imposible, no vale la pena molestar al Dios. Se
   * la llama SIN `obtainable` a propósito — el agente solo percibe su entorno, y
   * juzgar la materia con su lista rechazaría ideas por ingredientes que existen
   * tres celdas más allá (recipe-validation.ts:174). Sin ese argumento la puerta
   * local es un subconjunto estricto de la del mundo: lo que rechaza aquí lo
   * rechazaría allá igual, así que no puede perderse ninguna idea viable.
   */
  private async judgeRecipe(
    raw: unknown,
    perception: Perception,
  ): Promise<'approved' | 'rejected' | 'unavailable'> {
    const gated = validateRecipe(raw, perception.recipes);
    if (!gated.ok) {
      this.remember(this.recipeRejections, gated.error);
      this.deps.emit('recipe.rejected', { reason: gated.error, source: 'gate' });
      this.pendingPlan = [];
      this.pendingBlueprint = null;
      this.pendingOwnerGoalId = null;
      return 'rejected';
    }

    // ¿Le entra en las manos? Construir consume los ingredientes del inventario,
    // así que hay que tenerlos TODOS a la vez: una receta que pide más piezas
    // que ranuras no es cara, es imposible — y no de un modo que se note.
    //
    // La corrida real: una balsa de 4 tablas, 2 fibras y 1 resina, con seis
    // manos. Juntó las cuatro tablas y las dos fibras, llenó el inventario
    // exacto, y se quedó dando vueltas con tres resinas a la vista que no podía
    // levantar. Nada le sobraba —soltar cualquier cosa rompía la receta— así que
    // ninguna regla de hacer lugar podía destrabarla. Y el mensaje culpaba al
    // mundo: «me falta una resina y no veo más por acá», con tres delante.
    //
    // Va en la puerta del AGENTE y no en la del mundo porque no es física: con
    // una mochila más grande la misma receta es perfectamente posible. Es un
    // límite de su cuerpo, y por eso el motivo habla de sus manos.
    const capacity = perception.self.inventoryCapacity;
    const pieces = (gated.value.ingredients ?? []).reduce((sum, i) => sum + i.count, 0);
    if (pieces > capacity) {
      const made = recipeProduct(gated.value)?.kind ?? gated.value.id;
      const reason =
        `Receta inválida: "${made}" pide ${pieces} ingredientes de una vez ` +
        `y solo puedo llevar ${capacity} cosas encima. Para construir hay que tenerlos todos ` +
        `en la mano al mismo tiempo, así que esta receta no la puedo hacer nunca: ` +
        `necesito una que entre en ${capacity}.`;
      this.remember(this.recipeRejections, reason);
      this.deps.emit('recipe.rejected', { reason, source: 'gate' });
      this.pendingPlan = [];
      this.pendingBlueprint = null;
      this.pendingOwnerGoalId = null;
      return 'rejected';
    }

    const recipe = raw as {
      output?: { kind?: string; components?: Record<string, unknown> };
      ingredients?: { kind?: string; count?: number }[];
    };
    const outputKind = recipe.output?.kind ?? '';
    const components = recipe.output?.components ?? {};

    // Lo ya vetado no se re-imagina, ni en esta sesión ni tras restaurar un
    // guardado: el veto es conocimiento, y volver a proponerlo gastaría una
    // consulta para escuchar el mismo "no".
    const partOfWork = this.pendingBlueprint !== null;
    const veto = this.vetoFor(outputKind, partOfWork);
    if (veto !== undefined) {
      this.remember(this.recipeRejections, veto);
      this.deps.emit('recipe.rejected', { reason: veto, source: 'memory' });
      this.pendingPlan = [];
      this.pendingBlueprint = null;
      this.pendingOwnerGoalId = null;
      return 'rejected';
    }

    const drops = (components.drops ?? []) as { kind: string }[];
    const judgement = await this.consult(
      {
        kind: 'recipe.judge',
        problem: this.pendingProblem,
        outputKind,
        ingredientsSummary: (recipe.ingredients ?? []).map((i) => `${i.count}x ${i.kind}`),
        effectsSummary: this.describeComponents(components),
        ...(drops.length > 0
          ? { dropsSummary: [...countByKind(drops)].map(([kind, count]) => `${count}x ${kind}`) }
          : {}),
        // Si hay un plano esperando, esto es una PIEZA de esa obra y no la cosa
        // pedida (ADR 0074): el modelo ya contestó que lo pedido es un lugar.
        ...(partOfWork ? { partOfWork: true } : {}),
        // Lo que ya sabe hacer es lo que separa un paso de un salto: un celular
        // hecho de procesador y pantalla es honesto SI esas dos ya existen, y es
        // el mismo salto de siempre si no.
        knownRecipes: perception.recipes.map(
          (r) => `${recipeProduct(r)?.kind ?? r.id} (${r.ingredients.map((i) => `${i.count}x ${i.kind}`).join(' + ')})`,
        ),
        // Cuánto árbol le queda por debajo. Sin esto el juez puede exigirle seis
        // pisos a un mundo que admite cuatro, que es mandarla contra una pared.
        depthBudget: MAX_RECIPE_DEPTH,
        facts: [
          `llevo encima: ${perception.self.heldItems.map((item) => item.kind).join(', ') || 'nada'}`,
          `veo alrededor: ${[...new Set(perception.visibleEntities.map((e) => e.kind))].join(', ') || 'nada'}`,
          ...this.deps.memory
            .factList()
            .slice(-3)
            .map((f) => `sé que ${f.statement}`),
        ],
      },
      'statu-quo',
    );
    if (judgement === null) return 'unavailable';
    if (judgement.kind !== 'judgement') {
      this.deps.emit('provider.error', {
        provider: this.deps.provider.name,
        operation: 'recipe.judge',
        message: `respuesta inesperada del proveedor: ${judgement.kind}`,
        recoveredWith: 'statu-quo',
      });
      return 'unavailable';
    }
    this.deps.emit('recipe.judged', {
      outputKind,
      willing: judgement.willing,
      reason: judgement.reason,
    });
    if (judgement.willing) return 'approved';

    // El veto persiste, como el de las interacciones: viaja en su memoria y en
    // el legado, y el motivo se dice en voz alta — que sepa POR QUÉ su idea no
    // tenía sentido es la mitad de lo que la hace inventar mejor la próxima.
    const fact = this.deps.memory.addFact(
      `${this.recipeVetoPrefix(outputKind, partOfWork)}: ${judgement.reason}`,
      this.deps.currentTick(),
    );
    this.deps.emit('memory.created', { kind: 'fact', statement: fact.statement });
    this.remember(this.recipeRejections, fact.statement);
    // Al cuidador, la primera frase (ADR 0073). El veredicto entero está escrito
    // PARA ELLA —«proponémela como obra: la receta del fogón, la de la mesada…»,
    // seiscientos caracteres de taller— y volcarlo tal cual al chat era mostrarle
    // al cuidador un diálogo interno del que no tiene nada que hacer. Sigue
    // entero donde sirve: en el registro técnico y en su memoria, que es lo que
    // la hace inventar mejor la próxima.
    this.deps.reply(`Lo imaginé, pero no tiene sentido: ${firstSentence(judgement.reason)}`);
    // Lo que se apoyaba en esta pieza ya no se sostiene (ADR 0018).
    this.pendingPlan = [];
    this.pendingBlueprint = null;
    this.pendingOwnerGoalId = null;
    return 'rejected';
  }

  // ---- recetas (ADR 0018) ---------------------------------------------------

  /**
   * Inventar un objeto que su mundo no sabe construir. El modelo propone; la
   * intención va al mundo, que valida y decide. Un rechazo no se pierde: se
   * recuerda y viaja al siguiente intento, para que corrija en vez de
   * insistir. Devuelve la intención de proponer, o null si no hay nada.
   *
   * Corregir NO cuesta un tick (ADR 0042). Cuando la puerta o el Dios rechazan
   * una idea, la mascota vuelve a pensar en el acto, dentro del mismo turno, en
   * vez de quedarse sin hacer nada hasta el siguiente: el rechazo llegó de sus
   * propios filtros, no del mundo, así que no hubo acto que gastar. El tope de
   * intentos sigue siendo el mismo, y es lo que impide que esto gire.
   */
  async inventRecipe(
    problem: string,
    perception: Perception,
    options: { goalId: string; wantedId?: string; reserved?: string[] },
  ): Promise<ActionIntent | null> {
    // Lo que un encargo abierto ya tiene reclamado no se ofrece como materia
    // libre. Ofrecerlo era pedirle al modelo que gastara lo ajeno: con «cruzá el
    // río» esperando troncos, el frío inventó una fogata de troncos y el encargo
    // despertó sin lo suyo. No se le prohíbe tener la idea — se le saca de la
    // mesa el material que ya está comprometido, y que invente con lo que sobra.
    const reserved = new Set(options.reserved ?? []);
    const materials = [
      ...new Set([
        ...perception.self.heldItems
          .filter((item) => !reserved.has(item.kind))
          .map((item) => `${item.kind} (lo llevo encima)`),
        ...perception.visibleEntities
          .filter((e) => e.portable && !reserved.has(e.kind))
          .map((e) => `${e.kind} (lo veo)`),
      ]),
    ];
    // Sin materiales no hay nada que inventar: es falta de recurso, no de idea.
    if (materials.length === 0) return null;

    while (this.spendAttempt(options.goalId)) {
      const step = await this.proposeOnce(problem, perception, options, materials);
      if (step !== null) return step;
      // El plan quedó en pie: no lo rechazó nadie, no hubo quien juzgara. Con el
      // proveedor caído, insistir es gastar intentos contra una puerta cerrada.
      if (this.pendingPlan.length > 0 || this.pendingBlueprint !== null) return null;
    }
    return null;
  }

  /**
   * Una vuelta del ciclo: consultar, ordenar el plan y llevar su primera pieza
   * hasta la puerta. Devuelve la intención, o null si no salió nada de aquí.
   */
  private async proposeOnce(
    problem: string,
    perception: Perception,
    options: { goalId: string; wantedId?: string },
    materials: string[],
  ): Promise<ActionIntent | null> {
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
      // Los topes de una obra salen del VALIDADOR, no de una copia escrita a
      // mano en el texto de invención (ADR 0035). Esa copia se quedó en el
      // mundo del ADR 0032 —alcance del brazo, la obra entera en los brazos— y
      // le prohibía imaginar planos que el mundo aceptaba sin chistar: con un
      // tope de 3 celdas de largo, ningún puente suyo podía cruzar un cauce de
      // 4. Un límite que se copia es un límite que se desincroniza.
      reach: MAX_BLUEPRINT_OFFSET,
      maxBlocks: MAX_BLUEPRINT_BLOCKS,
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
    this.pendingProblem = problem;
    this.pendingOwnerGoalId = options.goalId;
    this.deps.emit('recipe.proposed', {
      rationale: response.rationale,
      // Cuántas piezas tiene la idea: una casa que necesita paredes que
      // necesitan tablas son tres, y eso se ve en la evidencia. La obra suma
      // un paso más: el plano que las dispone.
      steps: this.pendingPlan.length + (this.pendingBlueprint !== null ? 1 : 0),
    });
    return this.nextPlanStep(perception, options.goalId);
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

  /**
   * Dibujar un tipo que nadie dibujó a mano (la quinta puerta).
   *
   * Es la más barata de las cinco y la única sin juez: un dibujo no toca la
   * física, así que nadie puede romper el mundo dibujando mal. Lo peor que
   * puede pasar es que quede feo, y contra eso la pantalla ya tiene su piso —
   * compone material y forma sola. El dibujo de la IA es una mejora sobre ese
   * piso, nunca un requisito.
   *
   * Por eso tampoco gasta el crédito de invención (`spendAttempt`): ese crédito
   * cuida los intentos que pueden cambiar el mundo, y dibujar no lo cambia.
   * Cobrárselo haría que dibujar le quitara oportunidades de resolver el hambre
   * o el frío, que es exactamente al revés de lo que queremos.
   */
  async inventGlyph(targetKind: string, perception: Perception): Promise<ActionIntent | null> {
    // Reuso primero: lo que ya está dibujado no se vuelve a dibujar.
    if (perception.drawnKinds.includes(targetKind)) return null;

    const proposal = await this.consult({
      kind: 'glyph.propose',
      targetKind,
      targetFacts: this.targetFacts(targetKind, perception),
      ...(this.glyphRejections.length > 0 ? { rejections: [...this.glyphRejections] } : {}),
    });
    if (proposal === null) return null;
    if (proposal.kind !== 'glyph') {
      this.deps.emit('provider.error', {
        provider: this.deps.provider.name,
        operation: 'glyph.propose',
        message: `respuesta inesperada del proveedor: ${proposal.kind}`,
      });
      return null;
    }
    this.deps.emit('glyph.proposed', { targetKind, rationale: proposal.rationale });

    // La puerta local ahorra el viaje al mundo cuando el dibujo no es dibujo;
    // el motivo viaja al próximo intento, como con todo lo demás.
    const validated = validateGlyph(proposal.glyph, perception.drawnKinds);
    if (!validated.ok) {
      this.remember(this.glyphRejections, validated.error);
      this.deps.emit('glyph.rejected', { reason: validated.error, source: 'gate' });
      return null;
    }

    return { type: 'proposeGlyph', glyph: proposal.glyph };
  }

  /**
   * Dibujar una obra entera: una consulta, todas sus celdas.
   *
   * Misma inocencia que `inventGlyph` —un dibujo no toca la física, así que no
   * hay juez detrás ni gasta crédito de invención— y la misma puerta local que
   * ahorra el viaje al mundo cuando lo que llegó no es dibujable.
   *
   * Lo único distinto es la unidad: acá el trabajo es el PLANO, no el tipo. Es
   * lo que hace que la tabla del medio pueda continuar a la del costado, y lo
   * que evita pagar medio minuto de reloj por cada pieza.
   */
  async inventWorkGlyphs(
    blueprint: Blueprint,
    perception: Perception,
  ): Promise<ActionIntent | null> {
    // Reuso primero: la obra ya ilustrada no se vuelve a dibujar.
    if (perception.illustratedWorks.includes(blueprint.id)) return null;

    const proposal = await this.consult({
      kind: 'workGlyphs.propose',
      blueprintId: blueprint.id,
      workLabel: kindLabel(blueprint.id),
      cells: blueprint.placements.map((p) => ({ offset: { ...p.offset }, kind: p.kind })),
      ...(this.workGlyphRejections.length > 0
        ? { rejections: [...this.workGlyphRejections] }
        : {}),
    });
    if (proposal === null) return null;
    if (proposal.kind !== 'work-glyphs') {
      this.deps.emit('provider.error', {
        provider: this.deps.provider.name,
        operation: 'workGlyphs.propose',
        message: `respuesta inesperada del proveedor: ${proposal.kind}`,
      });
      return null;
    }
    this.deps.emit('workGlyphs.proposed', {
      blueprintId: blueprint.id,
      rationale: proposal.rationale,
    });

    const validated = validateWorkGlyphs(proposal.glyphs, blueprint, perception.illustratedWorks);
    if (!validated.ok) {
      this.remember(this.workGlyphRejections, validated.error);
      this.deps.emit('workGlyphs.rejected', { reason: validated.error, source: 'gate' });
      return null;
    }

    return { type: 'proposeWorkGlyphs', blueprintId: blueprint.id, glyphs: proposal.glyphs };
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
