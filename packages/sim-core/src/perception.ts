import type { Vec2 } from '@anima/shared';
import { chebyshev, manhattan } from '@anima/shared';
import type { Entity, EntityId, EntityKind } from './components.js';
import type { Blueprint } from './blueprints.js';
import type { Decomposition } from './decompositions.js';
import type { Interaction } from './interactions.js';
import type { Recipe } from './recipes.js';
import type { WorldState } from './world.js';
import { allEntities, getEntity } from './world.js';

/**
 * Vista parcial de una entidad, tal como el agente puede percibirla.
 * No expone el estado interno del motor: solo propiedades observables.
 */
export interface PerceivedEntity {
  id: EntityId;
  kind: string;
  position?: Vec2;
  /** Distancia Manhattan desde el observador (pasos en grilla de 4 direcciones). */
  distance?: number;
  edible?: boolean;
  portable?: boolean;
  solid?: boolean;
  toolPower?: number;
  hardness?: number;
  /** Calor que irradia por tick (si es una fuente de calor). */
  warmth?: number;
  /** Agua: se ve (no es sólida) pero no se puede pisar. */
  wet?: boolean;
  /**
   * Ofrece dónde pisar: encima de esto se puede caminar aunque el terreno no
   * lo permitiera. Se expone porque sin verlo, lo que ella misma construyó
   * para abrirse paso le seguiría pareciendo un obstáculo.
   */
  footing?: boolean;
  /** Refugio: al lado de esto no se pierde calor corporal. */
  shelter?: boolean;
  /**
   * true si ya se sabe que deja algo al romperse (un árbol deja troncos; una
   * silla, los materiales que costó). Lo que NO lo trae es materia cuya
   * descomposición todavía nadie definió: es la señal de que hay que
   * imaginarla antes de romperla (la cuarta puerta), y no volver a hacerlo
   * para lo que ya la tiene.
   */
  leavesRemains?: boolean;
  /**
   * QUÉ deja al romperse, por tipo. `leavesRemains` decía que algo cae pero no
   * qué, y con eso no se puede planificar: "me faltan troncos" y "este árbol
   * deja troncos" son la misma frase separada por el dato que no se exponía, y
   * por eso la mascota abortaba «no hay troncos» rodeada de árboles. Solo
   * aparece cuando el mundo ya lo sabe — si nadie definió la descomposición,
   * sigue siendo algo que hay que imaginar antes de romper (la cuarta puerta).
   */
  dropKinds?: string[];
  /** true si el observador la lleva en su inventario. */
  held?: boolean;
}

export interface Perception {
  tick: number;
  self: {
    id: EntityId;
    position: Vec2;
    energy?: { current: number; max: number };
    health?: { current: number; max: number };
    temperature?: { current: number; max: number };
    heldItems: PerceivedEntity[];
    /**
     * Cuántas cosas puede cargar en total. Lo sabe de su propio cuerpo, como la
     * energía: es lo que le deja entender por qué una obra grande no le entra en
     * los brazos (ADR 0032) y decirlo con un número, no con un "no pude".
     */
    inventoryCapacity: number;
  };
  visibleEntities: PerceivedEntity[];
  /**
   * El tamaño del mundo, con el mismo trato que las recetas: saber hasta dónde
   * llega el suelo es saber la física. Sin esto, planificar un rodeo incluía
   * celdas que no existen y había que descubrir cada borde chocándolo.
   */
  bounds?: { width: number; height: number };
  /**
   * Las recetas del mundo. La mascota sabe cómo se combinan las cosas, igual
   * que sabe que puede moverse: es la física de su mundo, no un secreto. Lo
   * que no le regala nadie es tener los ingredientes ni querer construirlo.
   */
  recipes: Recipe[];
  /**
   * Las interacciones del mundo, con el mismo trato que las recetas: saberlas
   * es saber la física. Es lo que permite REUSAR una interacción aprendida en
   * vez de inventarla de nuevo (ADR 0027).
   */
  interactions: Interaction[];
  /**
   * Los planos del mundo (ADR 0032), con el mismo trato: saber cómo se dispone
   * una obra es saber la física. Es lo que permite construir de nuevo una casa
   * ya aprendida sin volver a imaginarla.
   */
  blueprints: Blueprint[];
  /**
   * En qué se deshace cada tipo al romperse (la cuarta puerta, ADR 0027), con
   * el mismo trato: saberlo es saber la física. Es lo que permite REUSAR una
   * descomposición aprendida en vez de volver a preguntarle a la IA Dios qué
   * deja un pedernal que ya se rompió una vez.
   */
  decompositions: Decomposition[];
  /**
   * Qué tipos ya tienen dibujo (la quinta puerta). Solo los NOMBRES, no las
   * grillas: la mascota necesita saber qué le falta dibujar, y cargarle 256
   * caracteres por cada cosa que ya dibujó sería llenarle la cabeza con lo que
   * ya está hecho. Es lo que permite no volver a dibujar lo mismo.
   */
  drawnKinds: EntityKind[];
}

/**
 * Línea de Bresenham entre dos celdas: true si ninguna celda INTERMEDIA está
 * ocupada por un sólido. Los extremos no cuentan: el observador no se tapa a
 * sí mismo y un muro no se esconde detrás de su propia celda. Determinista.
 */
function hasLineOfSight(from: Vec2, to: Vec2, solidCells: ReadonlySet<string>): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = -Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x === to.x && y === to.y) return true;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    if (x === to.x && y === to.y) return true;
    if (solidCells.has(`${x},${y}`)) return false;
  }
}

function perceiveEntity(entity: Entity, observerPos: Vec2 | null, held: boolean): PerceivedEntity {
  const perceived: PerceivedEntity = { id: entity.id, kind: entity.kind };
  const pos = entity.components.position;
  if (pos) {
    perceived.position = { ...pos };
    if (observerPos) perceived.distance = manhattan(observerPos, pos);
  }
  if (entity.components.edible) perceived.edible = true;
  if (entity.components.portable) perceived.portable = true;
  if (entity.components.collider?.solid) perceived.solid = true;
  if (entity.components.tool) perceived.toolPower = entity.components.tool.power;
  if (entity.components.hardness) perceived.hardness = entity.components.hardness.value;
  if (entity.components.heatSource) perceived.warmth = entity.components.heatSource.warmthPerTick;
  if (entity.components.water) perceived.wet = true;
  if (entity.components.footing) perceived.footing = true;
  if (entity.components.shelter) perceived.shelter = true;
  const drops = entity.components.drops ?? [];
  if (drops.length > 0) {
    perceived.leavesRemains = true;
    // Los TIPOS que caen, sin repetir: alcanza para planificar ("necesito
    // troncos, este árbol deja troncos") y no filtra los arquetipos completos,
    // que son estado interno del motor.
    perceived.dropKinds = [...new Set(drops.map((drop) => drop.kind))];
  }
  if (held) perceived.held = true;
  return perceived;
}

/**
 * Construye la percepción limitada de un agente. El agente nunca recibe el
 * WorldState completo: solo esta vista, restringida por su rango sensorial.
 */
export function buildPerception(world: WorldState, agentId: EntityId): Perception {
  const agent = getEntity(world, agentId);
  const pos = agent?.components.position;
  if (!agent || !pos) {
    throw new Error(`No se puede percibir: el agente ${agentId} no existe o no tiene posición`);
  }
  const range = agent.components.agent?.perceptionRange ?? 5;
  const heldIds = new Set(agent.components.inventory?.items ?? []);

  // Celdas que tapan la vista: todo sólido con posición, salvo el observador.
  // Los extremos de cada línea se excluyen en hasLineOfSight, así que un
  // sólido nunca se oculta a sí mismo.
  const solidCells = new Set<string>();
  for (const entity of allEntities(world)) {
    const entityPos = entity.components.position;
    if (entity.id !== agentId && entityPos && entity.components.collider?.solid) {
      solidCells.add(`${entityPos.x},${entityPos.y}`);
    }
  }

  const visibleEntities: PerceivedEntity[] = [];
  const heldItems: PerceivedEntity[] = [];
  for (const entity of allEntities(world)) {
    if (entity.id === agentId) continue;
    if (heldIds.has(entity.id)) {
      heldItems.push(perceiveEntity(entity, null, true));
      continue;
    }
    const entityPos = entity.components.position;
    if (!entityPos || chebyshev(pos, entityPos) > range) continue;
    // La vista exige línea despejada (Bresenham), pero no es el único sentido:
    // lo comestible se huele y una fuente de calor se siente, igual que el
    // calor del motor atraviesa muros (runTemperatureSystem). Sin ese canal,
    // la comida tras el muro no existiría para ella y la historia del MVP
    // —querer lo que se ve y no se alcanza— no podría empezar (ADR 0025).
    const sensedWithoutSight =
      entity.components.edible !== undefined || entity.components.heatSource !== undefined;
    if (sensedWithoutSight || hasLineOfSight(pos, entityPos, solidCells)) {
      visibleEntities.push(perceiveEntity(entity, pos, false));
    }
  }

  const self: Perception['self'] = {
    id: agentId,
    position: { ...pos },
    heldItems,
    inventoryCapacity: agent.components.inventory?.capacity ?? 0,
  };
  if (agent.components.energy) {
    self.energy = { current: agent.components.energy.current, max: agent.components.energy.max };
  }
  if (agent.components.health) {
    self.health = { current: agent.components.health.current, max: agent.components.health.max };
  }
  if (agent.components.temperature) {
    self.temperature = {
      current: agent.components.temperature.current,
      max: agent.components.temperature.max,
    };
  }
  return {
    tick: world.tick,
    self,
    visibleEntities,
    bounds: { width: world.config.width, height: world.config.height },
    recipes: structuredClone(world.recipes),
    interactions: structuredClone(world.interactions),
    blueprints: structuredClone(world.blueprints),
    decompositions: structuredClone(world.decompositions),
    drawnKinds: Object.keys(world.glyphs),
  };
}
