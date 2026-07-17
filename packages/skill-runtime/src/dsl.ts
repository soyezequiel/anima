import { z } from 'zod';
import type { Result } from '@anima/shared';
import { err, ok } from '@anima/shared';

/**
 * DSL declarativa de habilidades. Lista cerrada de operaciones: nada fuera de
 * este catálogo puede ejecutarse. No hay JavaScript arbitrario, no hay acceso
 * al motor, al DOM ni a la red. Toda repetición exige un límite explícito.
 */

export const MAX_REPEAT_LIMIT = 50;
export const MAX_PROGRAM_DEPTH = 6;
export const MAX_PROGRAM_OPS = 200;

const entityQuerySchema = z
  .object({
    kind: z.string().min(1).optional(),
    tool: z.boolean().optional(),
    edible: z.boolean().optional(),
    portable: z.boolean().optional(),
    /** Fuentes de calor. La mascota percibe qué irradia calor, no de qué tipo es. */
    warm: z.boolean().optional(),
    /** Refugios: donde el calor corporal deja de perderse. Igual que `warm`, se percibe por lo que hace. */
    shelter: z.boolean().optional(),
    /**
     * Filtra por si ya lo lleva encima. Sin esto no se puede juntar dos cosas
     * del mismo tipo: `nearest` ordena lo sostenido a distancia 0, así que la
     * búsqueda del segundo tronco devolvía siempre el que ya tenía en la mano.
     */
    held: z.boolean().optional(),
  })
  .strict()
  .refine((q) => Object.keys(q).length > 0, { message: 'query vacía' });

export type EntityQuery = z.infer<typeof entityQuerySchema>;

const conditionSchema: z.ZodType<SkillCondition> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('always') }).strict(),
    z.object({ type: z.literal('lastMoveBlocked') }).strict(),
    z.object({ type: z.literal('lastActionFailed') }).strict(),
    z.object({ type: z.literal('entityGone'), ref: z.string().min(1) }).strict(),
    z.object({ type: z.literal('isAdjacent'), target: z.string().min(1) }).strict(),
    z.object({ type: z.literal('holding'), target: z.string().min(1) }).strict(),
    z.object({ type: z.literal('energyBelow'), value: z.number() }).strict(),
    z.object({ type: z.literal('temperatureBelow'), value: z.number() }).strict(),
    z.object({ type: z.literal('canCraft'), recipeId: z.string().min(1) }).strict(),
    z
      .object({
        type: z.literal('holdingCount'),
        kind: z.string().min(1),
        count: z.number().int().min(1).max(MAX_REPEAT_LIMIT),
      })
      .strict(),
    z.object({ type: z.literal('sees'), query: entityQuerySchema }).strict(),
    z.object({ type: z.literal('not'), cond: conditionSchema }).strict(),
  ]),
) as z.ZodType<SkillCondition>;

export type SkillCondition =
  | { type: 'always' }
  | { type: 'lastMoveBlocked' }
  | { type: 'lastActionFailed' }
  | { type: 'entityGone'; ref: string }
  | { type: 'isAdjacent'; target: string }
  | { type: 'holding'; target: string }
  | { type: 'energyBelow'; value: number }
  | { type: 'temperatureBelow'; value: number }
  /** Tiene en mano todo lo que la receta pide (y el mundo la admite). */
  | { type: 'canCraft'; recipeId: string }
  /**
   * Lleva encima al menos `count` bloques de un tipo. Lo que hace juntable una
   * obra: reunir las seis paredes antes de empezar a colocarlas (ADR 0032).
   */
  | { type: 'holdingCount'; kind: string; count: number }
  /**
   * Percibe (a la vista o en la mano) algo que cumple la query. Es la
   * condición que vuelve útil a `explore`: recorrer HASTA VER lo que busca.
   */
  | { type: 'sees'; query: EntityQuery }
  | { type: 'not'; cond: SkillCondition };

export const SELECT_STRATEGIES = ['nearest', 'strongestTool'] as const;
export type SelectStrategy = (typeof SELECT_STRATEGIES)[number];

const directionSchema = z.enum(['up', 'down', 'left', 'right']);

const opSchema: z.ZodType<SkillOp> = z.lazy(() =>
  z.discriminatedUnion('op', [
    z.object({ op: z.literal('findEntities'), query: entityQuerySchema, store: z.string().min(1) }).strict(),
    z
      .object({
        op: z.literal('selectTarget'),
        from: z.string().min(1),
        strategy: z.enum(SELECT_STRATEGIES),
        store: z.string().min(1),
      })
      .strict(),
    z
      .object({
        op: z.literal('moveToward'),
        target: z.string().min(1),
        maxSteps: z.number().int().min(1).max(MAX_REPEAT_LIMIT),
        /**
         * A qué distancia (Chebyshev) detenerse. Por defecto 1: pegado, que es
         * lo que hace falta para recoger, usar o interactuar (las posturas
         * encima/debajo suben a la mascota como parte del acto, ADR 0027). Hay
         * cosas a las que conviene acercarse SIN tocarlas: el fuego calienta a
         * 2 y quema a 1. Y 0 es pisar la celda del objetivo; contra un sólido
         * simplemente nunca llega, y ese fallo es del mundo, no de la DSL.
         */
        stopAtDistance: z.number().int().min(0).max(10).optional(),
      })
      .strict(),
    z.object({ op: z.literal('moveStep'), dir: directionSchema }).strict(),
    z
      .object({
        op: z.literal('explore'),
        maxSteps: z.number().int().min(1).max(MAX_REPEAT_LIMIT),
        until: conditionSchema.optional(),
      })
      .strict(),
    z.object({ op: z.literal('pickup'), target: z.string().min(1) }).strict(),
    z.object({ op: z.literal('drop'), target: z.string().min(1) }).strict(),
    z
      .object({
        op: z.literal('place'),
        kind: z.string().min(1),
        dx: z.number().int().min(-1).max(1),
        dy: z.number().int().min(-1).max(1),
      })
      .strict(),
    z.object({ op: z.literal('consume'), target: z.string().min(1) }).strict(),
    z.object({ op: z.literal('useItem'), item: z.string().min(1), target: z.string().min(1) }).strict(),
    z.object({ op: z.literal('craft'), recipeId: z.string().min(1) }).strict(),
    z
      .object({
        op: z.literal('interact'),
        interactionId: z.string().min(1),
        target: z.string().min(1),
      })
      .strict(),
    z.object({ op: z.literal('wait'), ticks: z.number().int().min(1).max(MAX_REPEAT_LIMIT).optional() }).strict(),
    z.object({ op: z.literal('speak'), text: z.string().max(300) }).strict(),
    z
      .object({
        op: z.literal('branch'),
        if: conditionSchema,
        then: z.array(opSchema).min(1),
        else: z.array(opSchema).optional(),
      })
      .strict(),
    z
      .object({
        op: z.literal('repeatWithLimit'),
        max: z.number().int().min(1).max(MAX_REPEAT_LIMIT),
        until: conditionSchema.optional(),
        body: z.array(opSchema).min(1),
      })
      .strict(),
    z.object({ op: z.literal('runSkill'), skillId: z.string().min(1) }).strict(),
    z.object({ op: z.literal('abort'), reason: z.string().min(1).max(200) }).strict(),
  ]),
) as z.ZodType<SkillOp>;

export type SkillOp =
  | { op: 'findEntities'; query: EntityQuery; store: string }
  | { op: 'selectTarget'; from: string; strategy: SelectStrategy; store: string }
  | { op: 'moveToward'; target: string; maxSteps: number; stopAtDistance?: number }
  | { op: 'moveStep'; dir: 'up' | 'down' | 'left' | 'right' }
  /**
   * Recorrer el mapa sin destino: cada paso va hacia la celda vecina menos
   * visitada, esquivando los sólidos que percibe. Con `until` se detiene al
   * cumplirse la condición (típicamente `sees`: buscar hasta encontrar); sin
   * ella camina hasta agotar `maxSteps`. Es la respuesta a "no lo veo": no
   * abortar en el acto, salir a mirar.
   */
  | { op: 'explore'; maxSteps: number; until?: SkillCondition }
  | { op: 'pickup'; target: string }
  | { op: 'drop'; target: string }
  /**
   * Colocar un bloque que se lleva encima (por tipo) en la celda vecina que
   * marca el offset, desde la posición actual (ADR 0032). El offset es de una
   * celda como mucho: la mascota coloca al alcance del brazo. La forma de la
   * DSL con la que se levanta una obra sin que ella se mueva entre bloque y
   * bloque — las celdas relativas a su lugar son estables mientras coloca.
   */
  | { op: 'place'; kind: string; dx: number; dy: number }
  | { op: 'consume'; target: string }
  | { op: 'useItem'; item: string; target: string }
  /** Construir según una receta del mundo, con lo que lleva en el inventario. */
  | { op: 'craft'; recipeId: string }
  /** Ejecutar una interacción que el mundo admite (ADR 0027) sobre un objetivo. */
  | { op: 'interact'; interactionId: string; target: string }
  | { op: 'wait'; ticks?: number }
  | { op: 'speak'; text: string }
  | { op: 'branch'; if: SkillCondition; then: SkillOp[]; else?: SkillOp[] }
  | { op: 'repeatWithLimit'; max: number; until?: SkillCondition; body: SkillOp[] }
  | { op: 'runSkill'; skillId: string }
  | { op: 'abort'; reason: string };

export const skillProgramSchema = z.array(opSchema).min(1);
export type SkillProgram = SkillOp[];

function measure(ops: SkillOp[], depth: number): { count: number; maxDepth: number } {
  let count = 0;
  let maxDepth = depth;
  for (const op of ops) {
    count += 1;
    const children: SkillOp[][] = [];
    if (op.op === 'branch') {
      children.push(op.then);
      if (op.else) children.push(op.else);
    } else if (op.op === 'repeatWithLimit') {
      children.push(op.body);
    }
    for (const block of children) {
      const inner = measure(block, depth + 1);
      count += inner.count;
      maxDepth = Math.max(maxDepth, inner.maxDepth);
    }
  }
  return { count, maxDepth };
}

/**
 * Valida un programa recibido de una fuente no confiable (un modelo, el
 * backend, un archivo). Devuelve el programa tipado o un error legible.
 */
export function validateSkillProgram(raw: unknown): Result<SkillProgram> {
  const parsed = skillProgramSchema.safeParse(raw);
  if (!parsed.success) {
    return err(`Programa inválido: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  const { count, maxDepth } = measure(parsed.data, 1);
  if (count > MAX_PROGRAM_OPS) {
    return err(`Programa demasiado largo: ${count} operaciones (máximo ${MAX_PROGRAM_OPS})`);
  }
  if (maxDepth > MAX_PROGRAM_DEPTH) {
    return err(`Programa demasiado anidado: profundidad ${maxDepth} (máximo ${MAX_PROGRAM_DEPTH})`);
  }
  return ok(parsed.data);
}
