import type { Vec2 } from '@anima/shared';
import { chebyshev } from '@anima/shared';
import type { Blueprint, Direction, Perception, Recipe } from '@anima/sim-core';
import { blueprintCounts, MAX_RECIPE_DEPTH, recipeProduct, recipeProducing } from '@anima/sim-core';
import type { SkillCondition, SkillOp, SkillProgram } from '@anima/skill-runtime';
import { MAX_REPEAT_LIMIT } from '@anima/skill-runtime';

/**
 * Programas deterministas de fábrica: las estrategias que la mascota trae
 * incorporadas, generadas por composición de primitivas — no son skills que
 * haya que aprender ni proponer. Viven aparte del agente porque no dependen
 * de su estado: reciben datos (una receta, una percepción, un camino) y
 * devuelven un programa de la DSL.
 */

/** Estrategia primitiva: ir directo al alimento y comerlo. Sin herramientas. */
export const DIRECT_APPROACH_PROGRAM: SkillProgram = [
  { op: 'findEntities', query: { kind: 'food' }, store: 'foods' },
  { op: 'selectTarget', from: 'foods', strategy: 'nearest', store: 'food' },
  { op: 'moveToward', target: 'food', maxSteps: 30 },
  {
    op: 'branch',
    if: { type: 'lastMoveBlocked' },
    then: [{ op: 'abort', reason: 'camino-bloqueado' }],
  },
  { op: 'consume', target: 'food' },
];

/**
 * Aproximación primitiva al calor: acercarse a lo que irradia sin pegarse.
 * Busca por `warm` y no por tipo: la mascota percibe qué da calor, no sabe
 * que eso se llama fogata. El `stopAtDistance: 2` es un reflejo prudente
 * incorporado, no conocimiento adquirido (ver ADR 0017).
 */
export const WARMTH_APPROACH_PROGRAM: SkillProgram = [
  { op: 'findEntities', query: { warm: true }, store: 'heatSources' },
  { op: 'selectTarget', from: 'heatSources', strategy: 'nearest', store: 'heat' },
  { op: 'moveToward', target: 'heat', maxSteps: 30, stopAtDistance: 2 },
  {
    op: 'branch',
    if: { type: 'lastMoveBlocked' },
    then: [{ op: 'abort', reason: 'camino-bloqueado' }],
  },
  // Quedarse el tiempo suficiente para que el calor haga efecto.
  { op: 'wait', ticks: 20 },
];

/**
 * El plan B sereno: sin fuego a la vista ni forma de hacerlo, un refugio no
 * devuelve el calor perdido pero para la sangría. Se pega (el refugio no
 * quema, la distancia prudente del fuego aquí no hace falta) y se queda.
 */
export const SHELTER_APPROACH_PROGRAM: SkillProgram = [
  { op: 'findEntities', query: { shelter: true }, store: 'shelters' },
  { op: 'selectTarget', from: 'shelters', strategy: 'nearest', store: 'shelter' },
  { op: 'moveToward', target: 'shelter', maxSteps: 30 },
  {
    op: 'branch',
    if: { type: 'lastMoveBlocked' },
    then: [{ op: 'abort', reason: 'camino-bloqueado' }],
  },
  { op: 'wait', ticks: 20 },
];

/**
 * Juntar los ingredientes que falten y construir. Se genera desde la receta
 * —dato del mundo—, igual que los programas de las peticiones del usuario:
 * composición determinista de primitivas, no una skill que haya que aprender.
 * Es el mismo programa para "tengo frío: hago fuego" y para "construí una
 * silla": si le faltan materiales los va a buscar, porque juntar es parte de
 * construir, no otra petición.
 *
 * Y desde el ADR 0031 se compone consigo mismo: si lo que falta es una pieza
 * que SABE hacer, hacerla es parte de construir igual que buscarla. El
 * programa de una casa contiene el de la pared, que contiene el de la tabla, y
 * la recursión termina en la materia del mundo. Es lo que vuelve conducta al
 * árbol de crafteo — sin esto, "me faltan 8 paredes" sería el final de la
 * historia teniendo el bosque al lado.
 *
 * Sus fallos dicen la verdad al controlador de progreso: sin materiales a la
 * vista aborta con `no-candidates` (falta el RECURSO → pedir ayuda, ADR
 * 0008); con el camino bloqueado aborta con `camino-bloqueado` (falta la
 * CAPACIDAD → el ciclo de skills tiene algo que aportar).
 */
/**
 * Cómo llegar a donde recordaba un material que ahora no ve. La percepción
 * exige línea de visión (ADR 0025): un tronco tras un muro es invisible aunque
 * esté en el mapa, y `explore` a ciegas no siempre da con el hueco por donde
 * cruzar. Si la memoria de lugares tiene ese material, esto devuelve los pasos
 * hacia allá; volver a verlo es lo que hace `explore` de abajo (0 pasos) y
 * `moveToward` después. Devuelve undefined si no recuerda nada de ese tipo.
 */
export type RememberedWalk = (kind: string) => Direction[] | undefined;

interface GatherOptions {
  held?: Map<string, number>;
  waitAfterTicks?: number;
  /**
   * Recorrer el mapa hasta VER cada ingrediente que falte antes de dar el
   * "no hay" por cierto. Lo activan los pedidos del cuidador («construí una
   * cama»): ahí buscar es lo que se espera. Las necesidades del cuerpo (el
   * frío) NO lo usan: su fallo rápido por `no-candidates` es la señal de
   * falta de RECURSO que dispara pedir ayuda (ADR 0008), y vagar 50 ticks
   * congelándose sería peor que preguntar.
   */
  searchFirst?: boolean;
  /**
   * Las recetas que el mundo admite. Con ellas, un ingrediente que la
   * mascota SABE hacer deja de ser un "no hay" y pasa a ser un paso más
   * (ADR 0031). Sin ellas el programa es el de antes: juntar del suelo y
   * construir.
   */
  recipes?: readonly Recipe[];
  /**
   * Dónde recuerda cada material (memoria de lugares, ADR 0025). Cuando junta
   * para un pedido, un material que no ve pero recuerda deja de ser un vagar a
   * ciegas: va a donde lo vio. Sin esto el programa es el de antes.
   */
  rememberedWalk?: RememberedWalk;
}

export function gatherAndCraftProgram(
  recipe: Recipe,
  options: GatherOptions = {},
  depth = 0,
): SkillProgram {
  const done: SkillCondition = { type: 'canCraft', recipeId: recipe.id };
  // Qué ingredientes de esta receta sabe fabricar: lo que cambia no es solo
  // cómo conseguirlos, también cuántas vueltas hacen falta.
  const makeableKinds = new Set(
    depth < MAX_RECIPE_DEPTH
      ? recipe.ingredients
          .map((i) => i.kind)
          .filter((kind) => recipeProducing(options.recipes ?? [], kind))
      : [],
  );
  const gather: SkillOp[] = recipe.ingredients
    // Solo lo que efectivamente falta: con 2 troncos ya en la mano y el
    // pedernal en el suelo, buscar troncos abortaría (no hay ninguno suelto)
    // aunque no hiciera falta ninguno.
    .map((ingredient) => ({
      kind: ingredient.kind,
      remaining: ingredient.count - (options.held?.get(ingredient.kind) ?? 0),
    }))
    .filter((need) => need.remaining > 0)
    .map((need) => ({
      op: 'repeatWithLimit' as const,
      // Recoger no falla, pero construir es intentar (ADR 0020): una pieza que
      // hay que FABRICAR puede salir mal y llevarse el material. Sin margen
      // para reintentar, una tirada perdida en la tabla mataba la casa entera
      // aunque quedaran troncos de sobra — y cuanto más hondo es el árbol, más
      // tiradas hay, así que la obra larga se caía casi siempre. El doble de
      // vueltas no cuesta nada cuando sale bien: `until` corta apenas alcanza.
      max: makeableKinds.has(need.kind)
        ? Math.min(need.remaining * 2, MAX_REPEAT_LIMIT)
        : need.remaining,
      // Si a mitad de camino ya puede construir, no junta de más.
      until: done,
      body: fetchOrMakeOps(need.kind, options, depth),
    }));
  const afterCraft: SkillOp[] =
    options.waitAfterTicks !== undefined ? [{ op: 'wait', ticks: options.waitAfterTicks }] : [];
  return [
    ...gather,
    {
      op: 'branch',
      if: done,
      then: [{ op: 'craft', recipeId: recipe.id }, ...afterCraft],
      else: [{ op: 'abort', reason: `no-candidates:ingredientes-${recipe.id}` }],
    },
  ];
}

/** Ir a buscar un objeto que está a la vista y traerlo. */
function fetchOps(
  kind: string,
  options: { searchFirst?: boolean; rememberedWalk?: RememberedWalk } = {},
): SkillOp[] {
  const searchFirst = options.searchFirst ?? false;
  const seek: SkillOp[] = [];
  // Si no lo ve pero recuerda dónde estaba, ir hacia allá antes de vagar. La
  // vista exige línea despejada (ADR 0025): un material tras un muro no se
  // percibe aunque esté en el mapa, y `explore` a ciegas puede no dar nunca
  // con el hueco para cruzar. Best-effort y sin abortar: si el camino se
  // corta, el `explore` de abajo toma la posta en vez de matar la obra. En la
  // segunda vuelta ya lo ve, así que el `not sees` se salta el rodeo solo.
  const dirs = searchFirst ? options.rememberedWalk?.(kind) : undefined;
  if (dirs && dirs.length > 0) {
    seek.push({
      op: 'branch',
      if: { type: 'not', cond: { type: 'sees', query: { kind, held: false } } },
      then: dirs.map((dir) => ({ op: 'moveStep', dir })),
    });
  }
  // Con searchFirst, si el ingrediente sigue sin estar a la vista sale a
  // recorrer hasta verlo: sin esto, un tronco fuera de la vista era "no hay
  // troncos" y el pedido moría sin haber buscado. Si ya lo ve, la exploración
  // no cuesta ni un tick.
  if (searchFirst) {
    seek.push({
      op: 'explore',
      maxSteps: 50,
      until: { type: 'sees', query: { kind, held: false } },
    });
  }
  return [
    ...seek,
    { op: 'findEntities', query: { kind, held: false }, store: `mat-${kind}` },
    {
      op: 'selectTarget',
      from: `mat-${kind}`,
      strategy: 'nearest',
      store: `next-${kind}`,
    },
    { op: 'moveToward', target: `next-${kind}`, maxSteps: 40 },
    { op: 'pickup', target: `next-${kind}` },
  ];
}

/**
 * Conseguir UNA pieza: la que está tirada por ahí, o —si no hay ninguna y sabe
 * hacerla— fabricarla (ADR 0031). Es donde el árbol de crafteo se vuelve
 * conducta: "me faltan 2 paredes" deja de ser el final de la historia y pasa a
 * ser el principio de otra, la de hacer paredes.
 *
 * Cuál de las dos ramas toca lo decide el MUNDO en el momento (`sees`), no el
 * planificador al generar el programa: una tabla tirada en el suelo es más
 * barata que partir un tronco, y si aparece una a mitad de la obra, la usa.
 *
 * Lo construido nace en el suelo, al lado (`resolveCraft`), no en las manos:
 * por eso fabricar una pieza termina en recogerla. Sin eso, la mascota haría
 * ocho paredes y seguiría sin tener ninguna.
 */
function fetchOrMakeOps(
  kind: string,
  options: { searchFirst?: boolean; recipes?: readonly Recipe[]; rememberedWalk?: RememberedWalk },
  depth: number,
): SkillOp[] {
  const fetch = fetchOps(kind, {
    searchFirst: options.searchFirst ?? false,
    ...(options.rememberedWalk ? { rememberedWalk: options.rememberedWalk } : {}),
  });
  const recipes = options.recipes;
  if (!recipes || depth >= MAX_RECIPE_DEPTH) return fetch;
  const sub = recipeProducing(recipes, kind);
  if (!sub) return fetch;

  const made = recipeProduct(sub)?.kind ?? kind;
  return [
    {
      op: 'branch',
      // Sin `searchFirst` en la rama de buscar: ya sabe que lo ve, y explorar
      // 50 pasos para llegar a lo que tiene delante sería absurdo.
      if: { type: 'sees', query: { kind, held: false } },
      then: fetchOps(kind),
      else: [
        // Lo que lleva encima NO viaja a la sub-receta: `held` cuenta lo que
        // tenía al planificar y adentro de un bucle eso ya es mentira. El
        // `until: canCraft` de la sub-receta se encarga sin necesidad de
        // adivinarlo — si ya tiene las tablas, no junta ninguna. Y la espera
        // de después de construir es del fuego que se acaba de encender, no
        // de cada tabla que se parte por el camino.
        ...gatherAndCraftProgram(
          sub,
          {
            searchFirst: options.searchFirst ?? false,
            recipes,
            ...(options.rememberedWalk ? { rememberedWalk: options.rememberedWalk } : {}),
          },
          depth + 1,
        ),
        // Solo si salió. El intento pudo fallar (ADR 0020) y entonces no hay
        // nada en el suelo que levantar: ir a buscarlo abortaría la obra
        // entera por "no lo encuentro", cuando lo que pasó es que esta vez no
        // salió y hay que volver a intentarlo.
        {
          op: 'branch',
          if: { type: 'sees', query: { kind: made, held: false } },
          then: [
            { op: 'findEntities', query: { kind: made, held: false }, store: `made-${made}` },
            {
              op: 'selectTarget',
              from: `made-${made}`,
              strategy: 'nearest',
              store: `pick-${made}`,
            },
            { op: 'pickup', target: `pick-${made}` },
          ],
        },
      ],
    },
  ];
}

/** Lo que lleva encima, contado por tipo: insumo para saber qué falta juntar. */
export function heldCounts(perception: Perception): Map<string, number> {
  const held = new Map<string, number>();
  for (const item of perception.self.heldItems) {
    held.set(item.kind, (held.get(item.kind) ?? 0) + 1);
  }
  return held;
}

/**
 * "No hay fuego: hacelo". El reflejo de dolor la aparta del fuego recién
 * hecho; la espera posterior transcurre a distancia segura, dentro del rango
 * de calor.
 */
export function buildFireProgram(
  recipe: Recipe,
  held: Map<string, number>,
  recipes: readonly Recipe[] = [],
): SkillProgram {
  return gatherAndCraftProgram(recipe, { held, waitAfterTicks: 20, recipes });
}

/**
 * Levantar una obra (ADR 0032). Dos actos, en orden:
 *
 * 1. **Juntar** todos los bloques que el plano pide, con la maquinaria del eje
 *    A (los fabrica si sabe, los recoge si los ve). Termina con todo encima —
 *    por eso una obra no puede pedir más bloques de los que entran en los
 *    brazos.
 * 2. **Colocar** cada bloque en su celda, sin moverse: las celdas relativas a
 *    donde quedó parada son estables mientras coloca. Si una quedó ocupada, esa
 *    colocación falla y la obra queda a medias — construir es intentar (ADR
 *    0020), ahora en el espacio.
 *
 * No hay entidad al final: la casa es las paredes puestas donde van. El
 * "listo" es haber intentado todas las colocaciones.
 */
export function buildStructureProgram(
  blueprint: Blueprint,
  options: { held?: Map<string, number>; recipes?: readonly Recipe[]; rememberedWalk?: RememberedWalk } = {},
): SkillProgram {
  const gather: SkillOp[] = [...blueprintCounts(blueprint)].map(([kind, count]) => {
    const held = options.held?.get(kind) ?? 0;
    const remaining = Math.max(0, count - held);
    const makeable = !!recipeProducing(options.recipes ?? [], kind);
    return {
      op: 'repeatWithLimit' as const,
      // Margen para reintentar lo que se fabrica y puede fallar (ADR 0020),
      // como en el árbol de crafteo. Lo que solo se recoge no falla.
      max: Math.max(1, makeable ? Math.min(remaining * 2, MAX_REPEAT_LIMIT) : remaining),
      until: { type: 'holdingCount' as const, kind, count },
      body: fetchOrMakeOps(
        kind,
        {
          ...(options.recipes ? { recipes: options.recipes } : {}),
          ...(options.rememberedWalk ? { rememberedWalk: options.rememberedWalk } : {}),
          searchFirst: true,
        },
        0,
      ),
    };
  });
  // Colocar es lo último y de a un bloque por tick. El offset va tal cual: el
  // mundo revalida que la celda esté vacía, dentro y al alcance.
  const place: SkillOp[] = blueprint.placements.map((placement) => ({
    op: 'place' as const,
    kind: placement.kind,
    dx: placement.offset.x,
    dy: placement.offset.y,
  }));
  return [...gather, ...place];
}

/**
 * Camino greedy de pasos hacia una POSICIÓN, calculado al planificar: la DSL
 * solo sabe perseguir entidades percibidas, y una posición recordada no es
 * ninguna. Sin pathfinding, a propósito (ADR 0005): si el mundo pone un
 * obstáculo, el programa aborta con `camino-bloqueado` y eso también es
 * información. `preferAxis` decide los desempates para poder generar dos
 * variantes deterministas del mismo camino.
 */
export function stepsToward(
  from: Vec2,
  to: Vec2,
  stopAt: number,
  preferAxis: 'x' | 'y',
): { dirs: Direction[]; end: Vec2 } {
  const dirs: Direction[] = [];
  const cur = { ...from };
  while (chebyshev(cur, to) > stopAt && dirs.length < 40) {
    const dx = to.x - cur.x;
    const dy = to.y - cur.y;
    const moveX =
      dx !== 0 &&
      (dy === 0 || (preferAxis === 'x' ? Math.abs(dx) >= Math.abs(dy) : Math.abs(dx) > Math.abs(dy)));
    if (moveX) {
      dirs.push(dx > 0 ? 'right' : 'left');
      cur.x += Math.sign(dx);
    } else {
      dirs.push(dy > 0 ? 'down' : 'up');
      cur.y += Math.sign(dy);
    }
  }
  return { dirs, end: cur };
}

/** Un paso por op; el primero que el mundo rechaza corta el programa. */
export function walkOps(dirs: Direction[]): SkillOp[] {
  return dirs.flatMap((dir): SkillOp[] => [
    { op: 'moveStep', dir },
    {
      op: 'branch',
      if: { type: 'lastActionFailed' },
      then: [{ op: 'abort', reason: 'camino-bloqueado' }],
    },
  ]);
}

/**
 * Ir a donde recordaba comida y buscarla DE VERDAD al llegar: la memoria solo
 * aporta el destino; comer exige percibirla. Si al llegar no hay nada
 * comestible, `selectTarget` aborta con `no-candidates:rememberedFoods` — la
 * señal con la que el recuerdo se invalida y el fallo se registra honesto.
 */
export function rememberedFoodProgram(dirs: Direction[]): SkillProgram {
  return [
    ...walkOps(dirs),
    { op: 'findEntities', query: { edible: true, held: false }, store: 'rememberedFoods' },
    { op: 'selectTarget', from: 'rememberedFoods', strategy: 'nearest', store: 'rememberedFood' },
    { op: 'moveToward', target: 'rememberedFood', maxSteps: 12 },
    { op: 'consume', target: 'rememberedFood' },
  ];
}

/** Como la comida recordada, pero con la distancia prudente del calor. */
export function rememberedHeatProgram(dirs: Direction[]): SkillProgram {
  return [
    ...walkOps(dirs),
    { op: 'findEntities', query: { warm: true }, store: 'rememberedHeats' },
    { op: 'selectTarget', from: 'rememberedHeats', strategy: 'nearest', store: 'rememberedHeat' },
    { op: 'moveToward', target: 'rememberedHeat', maxSteps: 12, stopAtDistance: 2 },
    { op: 'wait', ticks: 20 },
  ];
}

/** Alejarse hasta la celda segura y quedarse hasta que el daño pare. */
export function retreatProgram(dirs: Direction[]): SkillProgram {
  return [...walkOps(dirs), { op: 'wait', ticks: 5 }];
}
