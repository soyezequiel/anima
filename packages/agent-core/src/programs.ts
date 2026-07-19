import type { Vec2 } from '@anima/shared';
import { chebyshev } from '@anima/shared';
import type {
  Blueprint,
  BlueprintPlacement,
  Direction,
  Perception,
  Recipe,
} from '@anima/sim-core';
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
 * Cuántos pasos se le conceden a salir a buscar antes de admitir que no
 * encontró. Alcanza para cruzar un mapa mediano; pasado eso, seguir caminando
 * con el cuerpo en rojo gasta más de lo que promete.
 */
const SEEK_MAX_STEPS = 40;

/**
 * Salir a BUSCAR lo que no ve (ADR 0054).
 *
 * Todas las estrategias del cuerpo —comida, calor, refugio— arrancaban con
 * `findEntities` sobre lo VISIBLE, y la vista exige línea despejada (ADR 0025).
 * Detrás de un muro, un refugio a diez celdas no existe. Una generación murió
 * de frío parada, repitiendo «no veo nada que dé calor» con un refugio y tres
 * pedernales en el mapa: nunca dio un paso para mirar.
 *
 * `explore` recorre lo menos visitado HASTA VER lo que busca; si se agota sin
 * encontrar, el programa sigue igual y la aproximación de siempre aborta por
 * `no-candidates`. Buscar y no encontrar es una respuesta honesta —y una que
 * solo se puede dar después de haber buscado.
 */
export const SEEK_FOOD_PROGRAM: SkillProgram = [
  { op: 'explore', maxSteps: SEEK_MAX_STEPS, until: { type: 'sees', query: { edible: true } } },
  ...DIRECT_APPROACH_PROGRAM,
];

export const SEEK_WARMTH_PROGRAM: SkillProgram = [
  { op: 'explore', maxSteps: SEEK_MAX_STEPS, until: { type: 'sees', query: { warm: true } } },
  ...WARMTH_APPROACH_PROGRAM,
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
 * Abrirse paso a golpes (ADR 0066): buscar la herramienta más fuerte y romper
 * el obstáculo que la separa del resto del mundo.
 *
 * No es "destruir algo": es dejar de estar encerrada. Se usa cuando ya buscó y
 * no encontró — la partida real que lo motivó tenía una columna de muro sin
 * abertura partiendo el mapa en dos, con toda la madera del otro lado. Ella
 * podía explorar para siempre: de su lado no había nada que encontrar.
 *
 * `kind` es el tipo del obstáculo, que el agente elige mirando cuál tapa
 * espacio sin visitar. Golpear lo que uno mismo construyó ya lo impide la
 * regla de no comerse lo hecho (ADR 0058), que se aplica al elegirlo.
 */
export function breakThroughProgram(kind: string): SkillProgram {
  return [
    { op: 'findEntities', query: { tool: true }, store: 'paso-herramientas' },
    { op: 'selectTarget', from: 'paso-herramientas', strategy: 'strongestTool', store: 'paso-tool' },
    {
      op: 'branch',
      if: { type: 'not', cond: { type: 'holding', target: 'paso-tool' } },
      then: [
        { op: 'moveToward', target: 'paso-tool', maxSteps: 40 },
        { op: 'pickup', target: 'paso-tool' },
      ],
    },
    { op: 'findEntities', query: { kind }, store: 'paso-obstaculos' },
    { op: 'selectTarget', from: 'paso-obstaculos', strategy: 'nearest', store: 'paso-obstaculo' },
    { op: 'moveToward', target: 'paso-obstaculo', maxSteps: 40 },
    {
      op: 'repeatWithLimit',
      max: 20,
      until: { type: 'entityGone', ref: 'paso-obstaculo' },
      body: [
        { op: 'useItem', item: 'paso-tool', target: 'paso-obstaculo' },
        // Lo mismo que al destruir por encargo: si el golpe no hace mella, un
        // intento ya lo prueba. Insistir veinte veces contra algo inmune es lo
        // que la dejaba pegada.
        {
          op: 'branch',
          if: { type: 'lastActionUnaffected' },
          then: [{ op: 'abort', reason: 'obstaculo-inmune' }],
        },
      ],
    },
  ];
}

/** Buscar techo cuando no se ve ninguno. El último recurso antes de rendirse. */
export const SEEK_SHELTER_PROGRAM: SkillProgram = [
  { op: 'explore', maxSteps: SEEK_MAX_STEPS, until: { type: 'sees', query: { shelter: true } } },
  ...SHELTER_APPROACH_PROGRAM,
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

/**
 * De qué se cosecha un material: dado lo que falta ("log"), qué tipo hay que
 * romper para conseguirlo ("tree"). Lo resuelve quien tiene la percepción — el
 * mundo dice qué deja caer cada cosa (`dropKinds`) — y devuelve undefined si
 * nada de lo que ve lo deja. Es el gemelo de `RememberedWalk`: el planificador
 * no mira el mundo, se lo pasan resuelto.
 */
export type HarvestSource = (kind: string) => string | undefined;

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
  /**
   * Los tipos que NO hay que soltar al hacer lugar: la materia de la obra en
   * curso (ADR 0032). Se acumula al bajar por el árbol de recetas, así que
   * juntar los troncos de una tabla no tira el pedernal ya conseguido arriba.
   */
  keepKinds?: string[];
  /**
   * Cuánto de cada tipo hace falta de verdad. El excedente por encima de esto
   * se puede soltar aunque el tipo esté en `keepKinds`: una quinta tabla para
   * una receta que pide dos no es materia de la receta, es lastre.
   */
  keepAtMost?: Record<string, number>;
  /** De qué romper lo que ninguna receta hace (un tronco sale de un árbol). */
  harvestSource?: HarvestSource;
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
  // Lo que esta obra necesita, sumado a lo que ya venía cuidando de arriba: es
  // lo que `makeRoom` no puede soltar. Acumular importa en el árbol de recetas
  // —juntar los troncos de una tabla no debe tirar el pedernal de la fogata.
  const keepKinds = [
    ...new Set([...(options.keepKinds ?? []), ...recipe.ingredients.map((i) => i.kind)]),
  ];
  // Y CUÁNTO de cada cosa: proteger por tipo y no por cantidad convertía juntar
  // de más en un candado. Lo que pide esta receta se suma a lo que venía
  // cuidando de arriba, porque bajar por el árbol no puede bajar el techo de lo
  // de arriba: los 2 troncos de la tabla no autorizan a soltar el tercer tronco
  // que la fogata necesitaba.
  const keepAtMost: Record<string, number> = { ...(options.keepAtMost ?? {}) };
  for (const ingredient of recipe.ingredients) {
    keepAtMost[ingredient.kind] = Math.max(keepAtMost[ingredient.kind] ?? 0, ingredient.count);
  }
  const withKeep: GatherOptions = { ...options, keepKinds, keepAtMost };
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
      body: fetchOrMakeOps(need.kind, withKeep, depth),
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
  options: {
    searchFirst?: boolean;
    rememberedWalk?: RememberedWalk;
    keepKinds?: string[];
    keepAtMost?: Record<string, number>;
  } = {},
): SkillOp[] {
  const searchFirst = options.searchFirst ?? false;
  const seek: SkillOp[] = [];
  // Si no lo ve pero recuerda dónde estaba, ir hacia allá antes de vagar. La
  // vista exige línea despejada (ADR 0025): un material tras un muro no se
  // percibe aunque esté en el mapa, y `explore` a ciegas puede no dar nunca
  // con el hueco para cruzar. Best-effort y sin abortar: si el camino se
  // corta, el `explore` de abajo toma la posta en vez de matar la obra. En la
  // segunda vuelta ya lo ve, así que el `not sees` se salta el rodeo solo.
  // `portable: true`: solo materia SUELTA. Un bloque ya colocado en una obra
  // deja de ser portable (ADR 0034), así que sin este filtro la mascota volvía
  // a recoger su propia pared —el bloque más cercano— en vez de traer una nueva.
  const looseQuery = { kind, held: false, portable: true } as const;
  const dirs = searchFirst ? options.rememberedWalk?.(kind) : undefined;
  if (dirs && dirs.length > 0) {
    seek.push({
      op: 'branch',
      if: { type: 'not', cond: { type: 'sees', query: looseQuery } },
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
      until: { type: 'sees', query: looseQuery },
    });
  }
  // Con las manos llenas de sobras, soltar lo que no sirve para esta obra ANTES
  // de intentar recoger: sin esto, recoger fallaba en silencio por inventario
  // lleno y la obra abortaba como si no viera el material (ADR 0032). Solo actúa
  // si de verdad no hay lugar, y nunca suelta la materia de la receta (`keep`).
  const makeRoom: SkillOp[] = options.keepKinds
    ? [
        {
          op: 'makeRoom',
          keep: options.keepKinds,
          ...(options.keepAtMost ? { atMost: options.keepAtMost } : {}),
        },
      ]
    : [];
  return [
    ...seek,
    { op: 'findEntities', query: looseQuery, store: `mat-${kind}` },
    {
      op: 'selectTarget',
      from: `mat-${kind}`,
      strategy: 'nearest',
      store: `next-${kind}`,
    },
    { op: 'moveToward', target: `next-${kind}`, maxSteps: 40 },
    ...makeRoom,
    { op: 'pickup', target: `next-${kind}` },
  ];
}

/**
 * Cosechar: romper algo que DEJA CAER lo que falta, y levantarlo del suelo.
 *
 * Es la tercera vía de conseguir materia, y faltaba. Un tronco no sale de
 * ninguna receta: sale de talar un árbol. Sin esta rama, "me faltan troncos"
 * abortaba con `no-candidates` rodeada de árboles, y el cuidador tenía que
 * decir "talá un árbol" — la misma intervención en tres partidas seguidas. El
 * modelo, cuando diseña una habilidad, escribe esta cadena solo; el compositor
 * determinista no la conocía.
 *
 * La herramienta primero (buscarla puede alejarla del objetivo), el objetivo
 * después, y recién al final recoger lo que cayó: lo que se rompe deja la
 * materia en el suelo, no en las manos.
 */
function harvestOps(
  kind: string,
  source: string,
  keepKinds?: string[],
  keepAtMost?: Record<string, number>,
): SkillOp[] {
  const dropped = { kind, held: false, portable: true } as const;
  return [
    { op: 'findEntities', query: { tool: true }, store: `tool-${kind}` },
    { op: 'selectTarget', from: `tool-${kind}`, strategy: 'strongestTool', store: `best-${kind}` },
    {
      op: 'branch',
      if: { type: 'not', cond: { type: 'holding', target: `best-${kind}` } },
      then: [
        { op: 'moveToward', target: `best-${kind}`, maxSteps: 40 },
        { op: 'pickup', target: `best-${kind}` },
      ],
    },
    { op: 'gpsTo', kind: source, maxSteps: 50, store: `src-${kind}` },
    {
      op: 'repeatWithLimit',
      max: 20,
      until: { type: 'entityGone', ref: `src-${kind}` },
      body: [
        { op: 'useItem', item: `best-${kind}`, target: `src-${kind}` },
        // No insistir contra lo que no cede: un golpe ya lo prueba. Sin esto
        // gastaría veinte turnos pegándole a algo demasiado duro mientras el
        // motivo que la trajo hasta acá sigue empeorando.
        {
          op: 'branch',
          if: { type: 'lastStrikeIneffective' },
          then: [{ op: 'abort', reason: 'objetivo-muy-duro' }],
        },
        {
          op: 'branch',
          if: { type: 'lastActionUnaffected' },
          then: [{ op: 'abort', reason: 'objetivo-inmune' }],
        },
      ],
    },
    // Solo si de verdad cayó: romperlo pudo fallar, y buscar en el suelo algo
    // que no está abortaría la obra por "no lo encuentro" cuando lo que pasó
    // es que el golpe no alcanzó.
    {
      op: 'branch',
      if: { type: 'sees', query: dropped },
      then: fetchOps(kind, {
        ...(keepKinds ? { keepKinds } : {}),
        ...(keepAtMost ? { keepAtMost } : {}),
      }),
    },
  ];
}

/**
 * Conseguir UNA pieza: la que está tirada por ahí, o —si no hay ninguna y sabe
 * hacerla— fabricarla (ADR 0031), o —si tampoco hay receta— cosecharla de algo
 * que la deja caer. Es donde el árbol de crafteo se vuelve
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
  options: {
    searchFirst?: boolean;
    recipes?: readonly Recipe[];
    rememberedWalk?: RememberedWalk;
    keepKinds?: string[];
    keepAtMost?: Record<string, number>;
    harvestSource?: HarvestSource;
  },
  depth: number,
): SkillOp[] {
  const keepOptions = {
    ...(options.keepKinds ? { keepKinds: options.keepKinds } : {}),
    ...(options.keepAtMost ? { keepAtMost: options.keepAtMost } : {}),
  };
  const fetchOptions = {
    searchFirst: options.searchFirst ?? false,
    ...(options.rememberedWalk ? { rememberedWalk: options.rememberedWalk } : {}),
    ...keepOptions,
  };
  const fetch = fetchOps(kind, fetchOptions);
  const recipes = options.recipes;
  if (!recipes || depth >= MAX_RECIPE_DEPTH) return fetch;
  const sub = recipeProducing(recipes, kind);
  if (!sub) {
    // Ninguna receta lo hace, pero algo que ve lo deja caer al romperse: se
    // cosecha. Va después de fabricar porque partir una tabla es más barato
    // que talar un árbol, y antes de rendirse porque rendirse no es una vía.
    const source = options.harvestSource?.(kind);
    if (source) {
      return [
        {
          op: 'branch',
          if: { type: 'sees', query: { kind, held: false, portable: true } },
          then: fetchOps(kind, keepOptions),
          else: harvestOps(kind, source, options.keepKinds, options.keepAtMost),
        },
      ];
    }
    return fetch;
  }

  const made = recipeProduct(sub)?.kind ?? kind;
  return [
    {
      op: 'branch',
      // Sin `searchFirst` en la rama de buscar: ya sabe que lo ve, y explorar
      // 50 pasos para llegar a lo que tiene delante sería absurdo. `portable`:
      // una pieza suelta que recoger, no una ya colocada en la obra (ADR 0034).
      if: { type: 'sees', query: { kind, held: false, portable: true } },
      then: fetchOps(kind, keepOptions),
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
            ...keepOptions,
            // Y la cosecha VIAJA hacia abajo (ADR 0058). Sin esto se perdía en
            // el primer escalón: para hacer una pared hace falta un tronco, y
            // el tronco no se fabrica —se saca de un árbol—, pero la sub-receta
            // no sabía cómo. Resultado: sin troncos SUELTOS no había pared
            // posible, rodeada de árboles. Lo que arriba era una capacidad,
            // un nivel más abajo era ceguera.
            ...(options.harvestSource ? { harvestSource: options.harvestSource } : {}),
          },
          depth + 1,
        ),
        // Solo si salió. El intento pudo fallar (ADR 0020) y entonces no hay
        // nada en el suelo que levantar: ir a buscarlo abortaría la obra
        // entera por "no lo encuentro", cuando lo que pasó es que esta vez no
        // salió y hay que volver a intentarlo.
        {
          op: 'branch',
          if: { type: 'sees', query: { kind: made, held: false, portable: true } },
          then: [
            {
              op: 'findEntities',
              query: { kind: made, held: false, portable: true },
              store: `made-${made}`,
            },
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

/** Cuántos bloques de cada tipo piden estas celdas. Hermano de `blueprintCounts`,
 * pero sobre un subconjunto: lo que falta levantar, no el plano entero. */
export function countPlacements(placements: BlueprintPlacement[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const placement of placements) {
    counts.set(placement.kind, (counts.get(placement.kind) ?? 0) + 1);
  }
  return counts;
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
 * Levantar una obra caminando entre celda y celda (ADR 0035, que releva el
 * footprint 3×3 del ADR 0032 y usa las tandas del ADR 0034). La obra ya no tiene
 * que caber alrededor de la mascota ni entrarle en las manos:
 *
 * 1. **Recordar el ancla base** (`markAnchor`): la celda donde arranca fija el
 *    origen de la obra. Cada celda del plano es ese ancla más su offset.
 * 2. **Por cada tanda** (hasta `capacity` bloques): juntar los bloques de la
 *    tanda en un solo viaje (los recoge o los fabrica, soltando sobras si hace
 *    falta), y después ir CELDA POR CELDA: derivar la coordenada absoluta
 *    (`markCell`), caminar hasta su lado (`moveToward` a distancia 1) y colocar
 *    ahí (`placeAt`).
 *
 * Juntar la tanda antes de repartir es lo que rinde: buscar material mueve mucho
 * a la mascota, y traer de a uno multiplicaba los cruces. `blockAtCell` la vuelve
 * idempotente —una celda ya puesta se saltea—, así que puede irse a comer a
 * mitad de la obra y retomar. Límite honesto: si al colocar se tapia el paso a
 * una celda que falta, esa queda a medias (el mundo siendo honesto, ADR 0032).
 */
export function buildStructureProgram(
  blueprint: Blueprint,
  options: {
    held?: Map<string, number>;
    recipes?: readonly Recipe[];
    rememberedWalk?: RememberedWalk;
    capacity?: number;
    harvestSource?: HarvestSource;
    /**
     * Pasos hasta el sitio elegido (ADR 0049). El ancla se marca DESPUÉS de
     * caminar, así la obra cae siempre en el mismo lugar aunque la retome desde
     * la otra punta del mapa. Vacío = plantarla donde está parada, como antes.
     */
    approach?: Direction[];
    /**
     * Las celdas que todavía faltan. Lo ya colocado no se vuelve a pedir: con
     * dos muros puestos y cuatro en la mano, exigir los cinco del plano dejaba
     * la obra trabada para siempre — y con las manos llenas, sin lugar para la
     * herramienta, era imposible por construcción.
     */
    pending?: BlueprintPlacement[];
  } = {},
): SkillProgram {
  // La materia de la obra no se suelta al hacer lugar: son los bloques del plano.
  const keepKinds = [...blueprintCounts(blueprint).keys()];
  // Pero solo hasta donde el plano los pide. Un bloque de más no es materia de
  // la obra: es una mano ocupada que le falta para el siguiente.
  const keepAtMost = Object.fromEntries(blueprintCounts(blueprint));
  // Una ranura libre para la herramienta: acopiar hasta llenar las manos deja
  // sin lugar el martillo con el que se consigue el material que falta.
  const capacity = Math.max(1, (options.capacity ?? 6) - 1);
  const placements = options.pending ?? blueprint.placements;
  const BASE = 'obra-ancla';
  const CELL = 'obra-celda';
  const fetchOptions = (): Parameters<typeof fetchOrMakeOps>[1] => ({
    ...(options.recipes ? { recipes: options.recipes } : {}),
    ...(options.rememberedWalk ? { rememberedWalk: options.rememberedWalk } : {}),
    ...(options.harvestSource ? { harvestSource: options.harvestSource } : {}),
    keepKinds,
    keepAtMost,
    searchFirst: true,
  });

  /** Poner en su celda lo que YA lleva encima, si esa celda sigue vacía. */
  const placeOps = (batch: BlueprintPlacement[]): SkillOp[] =>
    batch.flatMap((placement) => [
        // La coordenada absoluta de esta celda = ancla base + offset del plano.
        { op: 'markCell', from: BASE, dx: placement.offset.x, dy: placement.offset.y, store: CELL },
        {
          op: 'branch',
          // Solo si esa celda todavía no tiene su bloque: retomar sin repetir.
          if: { type: 'not', cond: { type: 'blockAtCell', target: CELL, kind: placement.kind } },
          // Y solo si de verdad lo tiene en la mano: si una tirada falló y le
          // faltó el bloque, deja la celda a medias en vez de abortar la obra.
          then: [
            {
              op: 'branch',
              if: { type: 'holdingCount', kind: placement.kind, count: 1 },
              then: [
                // Caminar hasta el LADO de la celda (nunca encima: el mundo la
                // vería ocupada por la propia mascota) y colocar ahí.
                {
                  op: 'moveToward',
                  target: CELL,
                  maxSteps: MAX_REPEAT_LIMIT,
                  stopAtDistance: 1,
                  avoidTarget: true,
                },
                // Y queda escrito que esta pieza es parte de la obra, en su
                // lugar del plano: es lo que después le permite a la pantalla
                // dibujarla como el tablón de la punta y no como un tablón.
                {
                  op: 'placeAt',
                  kind: placement.kind,
                  target: CELL,
                  partOf: { blueprintId: blueprint.id, offset: { ...placement.offset } },
                },
              ],
            },
          ],
        },
      ]);

  // Cuántas ranuras quedan libres: es lo que decide si conviene descargar la
  // obra antes de salir a buscar, o si alcanza con juntar y colocar al final.
  const carried = [...(options.held ?? []).values()].reduce((sum, n) => sum + n, 0);
  const freeSlots = (options.capacity ?? 6) - carried;

  /**
   * Cuántas ranuras hace falta tener libres para conseguir UN bloque más.
   * Recogerlo cuesta una; FABRICARLO cuesta tantas como ingredientes lleve,
   * porque la receta los consume de la mano y hay que tenerlos todos a la vez.
   *
   * Sin esta cuenta, «¿hay lugar?» era «¿queda alguna ranura?», y eso alcanza
   * para recoger pero no para fabricar: con cuatro muros y el martillo encima
   * quedaba UNA ranura libre y un pizarrón que pide DOS arcillas. Nunca entraba
   * la segunda, la obra no avanzaba, y la mochila llena no era el problema
   * —había lugar— así que tampoco se descargaba. Trabada para siempre con la
   * arcilla a cuatro pasos.
   */
  const slotsForOneMore = Math.max(
    1,
    ...placements.map((placement) => {
      const recipe = recipeProducing(options.recipes ?? [], placement.kind);
      if (!recipe) return 1;
      return recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.count, 0);
    }),
  );

  // Caminar primero al sitio, marcar el ancla después: el ancla es el LUGAR de
  // la obra, no donde ella estaba cuando se le ocurrió empezar (ADR 0049).
  //
  // Con `walkOps` y no con `moveStep` pelados (ADR 0071). Los pasos sueltos no
  // comprobaban nada: si algo frenaba el camino —un muro entre ella y el sitio,
  // que el caminante greedy del ADR 0005 no sabe rodear—, los pasos rebotaban,
  // el programa seguía como si hubiera llegado y `markAnchor` marcaba el ancla
  // DONDE QUEDÓ TRABADA. La obra entera se plantaba corrida, sobre celdas que
  // nadie había validado: se la vio poniendo un fogón sobre una veta y una
  // encimera sobre el muro que la había frenado. Es decir, la invariante que
  // este mismo comentario declara no la garantizaba nadie.
  //
  // Ahora el primer paso rechazado corta con `camino-bloqueado`. No llegar es
  // un final honesto; llegar a otro lado y construir ahí, no.
  const steps: SkillOp[] = [
    ...walkOps(options.approach ?? []),
    { op: 'markAnchor', store: BASE },
    // DESCARGAR PRIMERO, pero solo si hace falta. Sin lugar para la próxima
    // pieza, salir a buscarla es imposible: no entra. Colocar lo que ya lleva
    // libera las ranuras y la obra sigue — es lo que destrabó una escuela con
    // cuatro muros en la mano y lugar para nada más.
    //
    // Cuando SÍ hay lugar suficiente no se descarga: los bloques suelen ser
    // sólidos, y levantarlos antes de salir a buscar material puede tapiarle el
    // camino a ella misma. Con espacio de sobra conviene juntar con el sitio
    // despejado y colocar todo junto al final.
    ...(freeSlots >= slotsForOneMore ? [] : placeOps(placements)),
  ];

  // Qué celdas quedan para el ciclo de juntar-y-colocar. Si hubo descarga, las
  // que esa descarga ya resolvió salen de la lista: volver a pedirlas haría que
  // el `until` —que mira las manos, no la obra— mandara a juntar de nuevo lo
  // que acaba de colocar. Si no hubo descarga, las tandas tienen que cubrirlas
  // todas, y `until` se satisface solo con lo que ya lleva encima.
  const stock = new Map(options.held ?? []);
  const batchSource =
    freeSlots >= slotsForOneMore
      ? placements
      : placements.filter((placement) => {
          const have = stock.get(placement.kind) ?? 0;
          if (have <= 0) return true;
          stock.set(placement.kind, have - 1);
          return false;
        });

  // En tandas de a lo sumo `capacity` colocaciones: una obra grande son varios
  // viajes de acopio, no un imposible.
  for (let i = 0; i < batchSource.length; i += capacity) {
    const batch = batchSource.slice(i, i + capacity);
    const counts = new Map<string, number>();
    for (const p of batch) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);

    // Juntar los bloques de la tanda, en un viaje. `until` corta apenas los
    // tiene (si ya le sobraban de antes, no junta de más); margen doble para lo
    // que se fabrica y puede fallar (ADR 0020).
    for (const [kind, count] of counts) {
      const makeable = !!recipeProducing(options.recipes ?? [], kind);
      steps.push({
        op: 'repeatWithLimit',
        max: makeable ? Math.min(count * 2, MAX_REPEAT_LIMIT) : count,
        until: { type: 'holdingCount', kind, count },
        body: fetchOrMakeOps(kind, fetchOptions(), 0),
      });
    }
    // Y repartir la tanda: cada bloque a su celda, caminando hasta ella.
    steps.push(...placeOps(batch));
  }
  return steps;
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
