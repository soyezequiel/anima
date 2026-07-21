import { z } from 'zod';
import type { Result } from '@anima/shared';
import type { Vec2 } from '@anima/shared';
import { err, ok } from '@anima/shared';

/**
 * DSL declarativa de habilidades. Lista cerrada de operaciones: nada fuera de
 * este catálogo puede ejecutarse. No hay JavaScript arbitrario, no hay acceso
 * al motor, al DOM ni a la red. Toda repetición exige un límite explícito.
 */

export const MAX_REPEAT_LIMIT = 50;
export const MAX_PROGRAM_DEPTH = 6;
export const MAX_PROGRAM_OPS = 200;
/** Cuán lejos del ancla puede caer una celda de obra (ADR 0035): footprint 9×9. */
export const MAX_CELL_OFFSET = 4;

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
    z.object({ type: z.literal('lastActionUnaffected') }).strict(),
    z.object({ type: z.literal('lastStrikeIneffective') }).strict(),
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
    z
      .object({
        type: z.literal('blockAt'),
        dx: z.number().int().min(-1).max(1),
        dy: z.number().int().min(-1).max(1),
        kind: z.string().min(1).optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal('blockAtCell'),
        target: z.string().min(1),
        kind: z.string().min(1).optional(),
      })
      .strict(),
    z.object({ type: z.literal('not'), cond: conditionSchema }).strict(),
  ]),
) as z.ZodType<SkillCondition>;

export type SkillCondition =
  | { type: 'always' }
  | { type: 'lastMoveBlocked' }
  | { type: 'lastActionFailed' }
  /**
   * La última acción falló porque el objetivo NO puede recibirla en absoluto
   * (`target-unaffected`): no es "todavía no", es "nunca" — un pedernal no tiene
   * durabilidad, ninguna herramienta lo rompe. Distinta de `lastActionFailed`
   * (que también cubre un fallo transitorio) para poder decir la verdad
   * categórica y no mandar a Ánima a buscar una herramienta más fuerte en vano.
   */
  | { type: 'lastActionUnaffected' }
  /**
   * El último golpe no hizo mella: o falló, o pegó sin quitar durabilidad
   * (`damage` 0 porque la dureza supera al poder). Repetir el MISMO golpe no va
   * a cambiar nada — un solo intento inútil ya lo prueba, no hacen falta veinte.
   */
  | { type: 'lastStrikeIneffective' }
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
  /**
   * ¿Hay ya un bloque en la celda a `(dx,dy)` de donde estoy parada? (de un
   * `kind`, si se da). Lo que vuelve idempotente levantar una obra en tandas
   * (ADR 0034): una colocación ya hecha se saltea en vez de repetirse, así la
   * mascota puede irse a buscar material y retomar sin rehacer lo puesto.
   */
  | { type: 'blockAt'; dx: number; dy: number; kind?: string }
  /**
   * ¿Hay ya un bloque (de `kind`, si se da) en la celda ABSOLUTA que guarda un
   * ancla? Es el `blockAt` para obras grandes (ADR 0035): la celda no está a un
   * paso de la mascota sino en una coordenada del mundo, a la que camina.
   */
  | { type: 'blockAtCell'; target: string; kind?: string }
  | { type: 'not'; cond: SkillCondition };

export const SELECT_STRATEGIES = ['nearest', 'strongestTool'] as const;
export type SelectStrategy = (typeof SELECT_STRATEGIES)[number];

const directionSchema = z.enum(['up', 'down', 'left', 'right']);

const opSchema: z.ZodType<SkillOp> = z.lazy(() =>
  z.discriminatedUnion('op', [
    z
      .object({ op: z.literal('findEntities'), query: entityQuerySchema, store: z.string().min(1) })
      .strict(),
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
        /**
         * Quedar AL LADO del destino, nunca encima (ADR 0035): para colocar un
         * bloque en una celda hay que estar adyacente, porque pararse en ella la
         * dejaría ocupada por el propio cuerpo. Trata la celda como un obstáculo
         * y, si ya está encima, se corre a un lado.
         */
        avoidTarget: z.boolean().optional(),
      })
      .strict(),
    z
      .object({
        op: z.literal('moveTo'),
        position: z.object({ x: z.number().int(), y: z.number().int() }).strict(),
        maxSteps: z.number().int().min(1).max(MAX_REPEAT_LIMIT),
        stopAtDistance: z.number().int().min(0).max(10).optional(),
      })
      .strict(),
    z.object({ op: z.literal('moveStep'), dir: directionSchema }).strict(),
    z
      .object({
        op: z.literal('gpsTo'),
        kind: z.string().min(1),
        maxSteps: z.number().int().min(1).max(MAX_REPEAT_LIMIT),
        stopAtDistance: z.number().int().min(0).max(10).optional(),
        store: z.string().min(1).optional(),
      })
      .strict(),
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
        op: z.literal('makeRoom'),
        keep: z.array(z.string().min(1)),
        atMost: z.record(z.string().min(1), z.number().int().min(0)).optional(),
      })
      .strict(),
    z.object({ op: z.literal('markAnchor'), store: z.string().min(1) }).strict(),
    z
      .object({ op: z.literal('markTarget'), from: z.string().min(1), store: z.string().min(1) })
      .strict(),
    z
      .object({
        op: z.literal('markCell'),
        from: z.string().min(1),
        dx: z.number().int().min(-MAX_CELL_OFFSET).max(MAX_CELL_OFFSET),
        dy: z.number().int().min(-MAX_CELL_OFFSET).max(MAX_CELL_OFFSET),
        store: z.string().min(1),
      })
      .strict(),
    z
      .object({
        op: z.literal('placeAt'),
        kind: z.string().min(1),
        target: z.string().min(1),
        partOf: z
          .object({
            blueprintId: z.string().min(1),
            offset: z.object({ x: z.number().int(), y: z.number().int() }).strict(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    z
      .object({
        op: z.literal('place'),
        kind: z.string().min(1),
        dx: z.number().int().min(-1).max(1),
        dy: z.number().int().min(-1).max(1),
      })
      .strict(),
    z.object({ op: z.literal('consume'), target: z.string().min(1) }).strict(),
    z
      .object({ op: z.literal('useItem'), item: z.string().min(1), target: z.string().min(1) })
      .strict(),
    z.object({ op: z.literal('craft'), recipeId: z.string().min(1) }).strict(),
    z
      .object({
        op: z.literal('interact'),
        interactionId: z.string().min(1),
        target: z.string().min(1),
      })
      .strict(),
    z
      .object({
        op: z.literal('wait'),
        ticks: z.number().int().min(1).max(MAX_REPEAT_LIMIT).optional(),
      })
      .strict(),
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
    // Una de las dos formas, nunca ambas: por NOMBRE (lo que escribe el
    // modelo, resuelto tarde a la mejor versión) o por id congelado (lo que
    // emiten las rutas de TypeScript). Ver ADR 0055.
    // (que sea exactamente una de las dos lo comprueba `validateSkillProgram`:
    // un `.refine` acá rompería la unión discriminada de zod)
    z
      .object({
        op: z.literal('runSkill'),
        skillId: z.string().min(1).optional(),
        skillName: z.string().min(1).optional(),
      })
      .strict(),
    z.object({ op: z.literal('abort'), reason: z.string().min(1).max(200) }).strict(),
  ]),
) as z.ZodType<SkillOp>;

export type SkillOp =
  | { op: 'findEntities'; query: EntityQuery; store: string }
  | { op: 'selectTarget'; from: string; strategy: SelectStrategy; store: string }
  | {
      op: 'moveToward';
      target: string;
      maxSteps: number;
      stopAtDistance?: number;
      avoidTarget?: boolean;
    }
  /** Ir a una celda fija del mundo; el BFS comparte la misma memoria que moveToward. */
  | { op: 'moveTo'; position: Vec2; maxSteps: number; stopAtDistance?: number }
  | { op: 'moveStep'; dir: 'up' | 'down' | 'left' | 'right' }
  /**
   * El GPS hacia un recurso (ADR 0038): "llevame a donde hay X" en una sola
   * operación. Encadena los tres rumbos que ya existían sueltos — si VE un X,
   * va derecho rodeando obstáculos (el BFS de `moveToward`); si no lo ve pero
   * RECUERDA dónde había uno (memoria de lugares, ADR 0025), camina hasta ahí,
   * y si al llegar no está, el recuerdo se descarta y prueba el siguiente; si
   * no ve ni recuerda, EXPLORA hacia lo menos visitado hasta verlo. Sigue sin
   * omnisciencia: solo navega por lo percibido y lo recordado. Al llegar,
   * `store` guarda el ejemplar alcanzado, listo para pickup/consume/useItem.
   */
  | { op: 'gpsTo'; kind: string; maxSteps: number; stopAtDistance?: number; store?: string }
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
   * Soltar a conciencia para hacer lugar (ADR 0032): SOLO si el inventario está
   * lleno, deja en el suelo la cosa MENOS útil que no sirva para la tarea en
   * curso —lo que no esté en `keep`, prefiriendo lo que no es herramienta y, si
   * no queda otra, la herramienta más débil—. Con lugar de sobra no hace nada.
   * Es lo que permite juntar el pedernal con las manos ocupadas de sobras en
   * vez de quedar trabada diciendo "no me entra".
   *
   * `atMost` dice CUÁNTO de cada tipo hace falta de verdad. Lo que pase de ahí
   * es lastre aunque el tipo esté en `keep`: la quinta tabla de una receta que
   * pide dos no es materia de la receta, es una tabla de más ocupando la mano
   * con la que tendría que agarrar la fibra. Sin esto, `keep` protegía por
   * tipo y no por cantidad, y juntar de más se volvía un candado — se la vio
   * con 5 tablas y 1 pilote en 6 ranuras, caminando el mismo circuito para
   * siempre porque cada `pickup` moría con "no me entra" y no había nada que
   * `makeRoom` se creyera autorizada a soltar.
   */
  | { op: 'makeRoom'; keep: string[]; atMost?: Record<string, number> }
  /**
   * Recuerda la celda donde estoy parada como el ancla de una obra (ADR 0034):
   * el punto al que vuelve entre viaje y viaje de material para que las
   * colocaciones —relativas a su lugar— caigan siempre en la misma casa. Sin
   * esto, irse a buscar un bloque movía el "centro" y la obra quedaba
   * desparramada; con esto puede construir en tandas, sin el tope de las manos.
   */
  | { op: 'markAnchor'; store: string }
  /**
   * Guarda como ancla la celda de algo que VE (un objetivo ya seleccionado).
   * Sin esto, lo único que se podía anclar era la propia posición, así que
   * colocar una cosa EN un lugar concreto del mundo —y no a N pasos de donde
   * uno está parado— no se podía expresar.
   */
  | { op: 'markTarget'; from: string; store: string }
  /**
   * Guarda como ancla la celda a `(dx,dy)` de OTRA ancla (`from`). Con esto una
   * obra grande deriva cada celda absoluta desde el ancla base y la persigue
   * como un lugar del mundo (ADR 0035). Los offsets llegan hasta el footprint.
   */
  | { op: 'markCell'; from: string; dx: number; dy: number; store: string }
  /**
   * Coloca un bloque (por tipo) en la celda ABSOLUTA que guarda un ancla, no a
   * un paso de donde está parada (ADR 0035). El mundo revalida adyacencia, celda
   * vacía y dentro del mapa: por eso la mascota camina hasta el lado de la celda
   * antes. Es lo que levanta obras más grandes que su alcance de brazo.
   */
  /**
   * `partOf` dice de qué obra es parte esta pieza y qué lugar ocupa en su
   * plano. Va acá y no en el mundo porque es quien construye el que lo sabe:
   * el motor ve una cosa colocada en una celda, no una obra. Queda escrito en
   * la pieza, y por eso sobrevive al guardado y se va cuando la levantan.
   */
  | {
      op: 'placeAt';
      kind: string;
      target: string;
      partOf?: { blueprintId: string; offset: { x: number; y: number } };
    }
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
  | { op: 'runSkill'; skillId?: string; skillName?: string }
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

/** Los nombres de habilidad que un programa llama, en orden de aparición. */
export function calledSkillNames(ops: SkillOp[]): string[] {
  const names: string[] = [];
  for (const op of ops) {
    if (op.op === 'runSkill' && op.skillName) names.push(op.skillName);
    else if (op.op === 'branch') {
      names.push(...calledSkillNames(op.then), ...calledSkillNames(op.else ?? []));
    } else if (op.op === 'repeatWithLimit') names.push(...calledSkillNames(op.body));
  }
  return names;
}

/**
 * Lo que hace falta para juzgar las llamadas a otras habilidades (ADR 0055).
 * `programOf` devuelve el programa de una habilidad por nombre —así se puede
 * seguir la cadena— y `selfName` es el nombre de la que se está validando,
 * que todavía no está en la biblioteca.
 */
export interface ComposeContext {
  programOf(name: string): SkillProgram | undefined;
  selfName?: string;
}

/**
 * Valida un programa recibido de una fuente no confiable (un modelo, el
 * backend, un archivo). Devuelve el programa tipado o un error legible.
 *
 * Con `compose`, además comprueba las llamadas a otras habilidades: que
 * existan y que no se cierre un ciclo. Sin esa comprobación, un nombre
 * inventado por el modelo pasaba limpio, se guardaba, y recién moría en los
 * cuarenta mundos del evaluador — caro y con un mensaje que hablaba de un id
 * interno que el modelo nunca vio.
 */
export function validateSkillProgram(raw: unknown, compose?: ComposeContext): Result<SkillProgram> {
  const parsed = skillProgramSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      `Programa inválido: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
    );
  }
  const { count, maxDepth } = measure(parsed.data, 1);
  if (count > MAX_PROGRAM_OPS) {
    return err(`Programa demasiado largo: ${count} operaciones (máximo ${MAX_PROGRAM_OPS})`);
  }
  if (maxDepth > MAX_PROGRAM_DEPTH) {
    return err(`Programa demasiado anidado: profundidad ${maxDepth} (máximo ${MAX_PROGRAM_DEPTH})`);
  }
  const malformed = badRunSkill(parsed.data);
  if (malformed) return err(malformed);
  if (compose) {
    const cycle = checkCalls(parsed.data, compose, compose.selfName ? [compose.selfName] : []);
    if (cycle) return err(cycle);
  }
  return ok(parsed.data);
}

/** Un `runSkill` sin destino, o con los dos, no dice a quién llamar. */
function badRunSkill(ops: SkillOp[]): string | null {
  for (const op of ops) {
    if (op.op === 'runSkill' && (op.skillId === undefined) === (op.skillName === undefined)) {
      return 'runSkill necesita skillName (recomendado) o skillId, exactamente uno';
    }
    const blocks =
      op.op === 'branch' ? [op.then, op.else ?? []] : op.op === 'repeatWithLimit' ? [op.body] : [];
    for (const block of blocks) {
      const inner = badRunSkill(block);
      if (inner) return inner;
    }
  }
  return null;
}

/** Recorre las llamadas en profundidad: nombre desconocido o ciclo. */
function checkCalls(ops: SkillOp[], compose: ComposeContext, chain: string[]): string | null {
  for (const name of calledSkillNames(ops)) {
    if (chain.includes(name)) {
      return `Habilidad circular: ${[...chain, name].join(' → ')} se llama a sí misma`;
    }
    const program = compose.programOf(name);
    if (!program) return `No existe ninguna habilidad llamada "${name}"`;
    const deeper = checkCalls(program, compose, [...chain, name]);
    if (deeper) return deeper;
  }
  return null;
}
