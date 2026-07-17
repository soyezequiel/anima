import type { Vec2 } from '@anima/shared';
import { chebyshev } from '@anima/shared';
import type { Direction, Perception, Recipe } from '@anima/sim-core';
import type { SkillCondition, SkillOp, SkillProgram } from '@anima/skill-runtime';

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
 * Sus fallos dicen la verdad al controlador de progreso: sin materiales a la
 * vista aborta con `no-candidates` (falta el RECURSO → pedir ayuda, ADR
 * 0008); con el camino bloqueado aborta con `camino-bloqueado` (falta la
 * CAPACIDAD → el ciclo de skills tiene algo que aportar).
 */
export function gatherAndCraftProgram(
  recipe: Recipe,
  options: {
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
  } = {},
): SkillProgram {
  const done: SkillCondition = { type: 'canCraft', recipeId: recipe.id };
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
      max: need.remaining,
      // Si a mitad de camino ya puede construir, no junta de más.
      until: done,
      body: [
        // Con searchFirst, si el ingrediente no está a la vista sale a
        // recorrer hasta verlo: sin esto, un tronco fuera del rango de
        // percepción era "no hay troncos" y el pedido moría sin haber
        // buscado. Si ya lo ve, la exploración no cuesta ni un tick.
        ...(options.searchFirst
          ? [
              {
                op: 'explore' as const,
                maxSteps: 50,
                until: { type: 'sees' as const, query: { kind: need.kind, held: false } },
              },
            ]
          : []),
        {
          op: 'findEntities' as const,
          query: { kind: need.kind, held: false },
          store: `mat-${need.kind}`,
        },
        { op: 'selectTarget' as const, from: `mat-${need.kind}`, strategy: 'nearest' as const, store: `next-${need.kind}` },
        { op: 'moveToward' as const, target: `next-${need.kind}`, maxSteps: 40 },
        { op: 'pickup' as const, target: `next-${need.kind}` },
      ],
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
export function buildFireProgram(recipe: Recipe, held: Map<string, number>): SkillProgram {
  return gatherAndCraftProgram(recipe, { held, waitAfterTicks: 20 });
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
