import type { Components, Entity, EntityKind, WorldState } from '@anima/sim-core';
import { allEntities, canStandAt, getEntity } from '@anima/sim-core';
import type { Vec2 } from '@anima/shared';

/**
 * El vocabulario con el que un mapa dice qué significa haberlo superado.
 *
 * Es deliberadamente GENERAL: habla de propiedades, zonas, caminos y hechos
 * ocurridos, nunca de "el puente del mapa 1" ni de un tipo concreto inventado
 * por el diseñador. Un objetivo no puede nombrar la solución porque no la
 * conoce — describe el efecto que tiene que verse en el mundo, y cualquier
 * camino que lo produzca vale.
 *
 * La otra mitad de la misma regla: nada de esto se cumple porque Ánima lo
 * diga. Todo se mide contra `WorldState` y contra el registro de hechos que
 * el motor emitió. La palabra no es prueba.
 */

/** Componentes por los que un objetivo puede preguntar. */
export type ComponentKey = keyof Components;

/**
 * A qué entidades se refiere un objetivo. Todos los campos son conjunciones:
 * lo que no se dice, no se exige.
 */
export interface EntityQuery {
  /** Tipo exacto. Úsese con cuidado: nombrar el tipo es acercarse a nombrar la solución. */
  kind?: EntityKind;
  /** El TIPO no existía en el mundo al empezar la misión: es materia nueva. */
  kindIsNew?: boolean;
  /** La ENTIDAD nació durante la misión (no estaba sembrada). */
  createdDuringRun?: boolean;
  /** Nació de una receta ejecutada durante la misión (`item.crafted`). */
  crafted?: boolean;
  /** Fue puesta en el mundo con `place` (no soltada ni sembrada). */
  placed?: boolean;
  /** Componentes que la entidad debe tener. */
  has?: ComponentKey[];
  /** Componentes que la entidad NO debe tener. */
  lacks?: ComponentKey[];
}

/** Una región rectangular del mapa, en celdas inclusive. */
export interface Zone {
  id: string;
  /** Para los informes: "la orilla lejana". */
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Objective =
  /** Existen al menos `min` entidades que cumplen la consulta. */
  | { id: string; describe: string; kind: 'entity-exists'; query: EntityQuery; min?: number }
  /** ...y además están dentro de la zona. */
  | {
      id: string;
      describe: string;
      kind: 'entity-in-zone';
      query: EntityQuery;
      zone: string;
      min?: number;
    }
  /** No queda ninguna entidad que cumpla la consulta (opcionalmente, en una zona). */
  | { id: string; describe: string; kind: 'no-entity'; query: EntityQuery; zone?: string }
  /** La mascota está dentro de la zona. */
  | { id: string; describe: string; kind: 'agent-in-zone'; zone: string }
  /**
   * Hay un camino caminable entre dos celdas, con la MISMA regla de
   * pisabilidad que aplica el motor (`canStandAt`). Es la forma honesta de
   * comprobar "se abrió un paso": no se pregunta por el objeto que lo abrió,
   * se pregunta si el mundo cambió de forma.
   */
  | { id: string; describe: string; kind: 'path-open'; from: Vec2; to: Vec2 }
  /** El mundo aprendió al menos `min` reglas nuevas por esa puerta, durante la misión. */
  | {
      id: string;
      describe: string;
      kind: 'rule-learned';
      gate: 'recipe' | 'interaction' | 'blueprint' | 'decomposition';
      min?: number;
    }
  /**
   * Ocurrió al menos `min` veces un hecho registrado. El tipo es un string
   * abierto a propósito: valen los hechos del motor (`interaction.performed`)
   * y los de quien lo conduce (`skill.promoted`, que no es una afirmación de
   * Ánima sino el veredicto de un evaluador determinista). Lo que nunca vale
   * es que ella lo diga: `agent.spoke` no prueba nada.
   */
  | {
      id: string;
      describe: string;
      kind: 'event-happened';
      event: string;
      /** Filtro sobre `event.data`: todas las claves deben coincidir. */
      where?: Record<string, unknown>;
      min?: number;
    }
  /**
   * Otros objetivos de la misma misión, nombrados por su id, se cumplieron en
   * este orden temporal. Referencia y no copia: la condición se declara una
   * sola vez, y exigir un orden no puede cambiar lo que se exige.
   */
  | { id: string; describe: string; kind: 'sequence'; of: string[] }
  | { id: string; describe: string; kind: 'all'; of: Objective[] }
  | { id: string; describe: string; kind: 'any'; of: Objective[] };

/**
 * Lo que hay que saber del pasado para juzgar el presente. Lo mantiene el
 * `MissionTracker`; los objetivos solo lo leen.
 */
export interface MissionHistory {
  /** Tipos que ya existían al empezar: lo que NO cuenta como invención. */
  initialKinds: ReadonlySet<EntityKind>;
  /** Entidades que ya existían al empezar. */
  initialEntityIds: ReadonlySet<string>;
  /** Entidades nacidas de un `item.crafted` durante la misión. */
  craftedIds: ReadonlySet<string>;
  /** Entidades puestas con `place` durante la misión. */
  placedIds: ReadonlySet<string>;
  /** Reglas aceptadas por cada puerta durante la misión. */
  learned: Readonly<Record<'recipe' | 'interaction' | 'blueprint' | 'decomposition', number>>;
  /** Todos los hechos del motor, en orden. */
  events: readonly { type: string; tick: number; data: Record<string, unknown> }[];
}

export interface ObjectiveResult {
  id: string;
  describe: string;
  met: boolean;
  /** Tick en el que se cumplió por primera vez, si se cumplió. */
  metAtTick?: number;
  /**
   * Qué FALTA para cumplirlo, en voz de cuidador. `null` cuando ya está: el
   * tilde ya lo dijo, y repetirlo con otras palabras era leer dos veces.
   *
   * No dice cómo se mide. Antes volcaba la query (`0/4 entidades nacida en la
   * partida, colocada en el cauce`), que era el `describe` otra vez pero en
   * jerga —con cocientes como `6/1`, coordenadas crudas e ids internos entre
   * comillas—. Lo que hace falta saber es cuánto falta, no contra qué se
   * compara.
   */
  detail: string | null;
}

function zoneOf(zones: readonly Zone[], id: string): Zone {
  const zone = zones.find((z) => z.id === id);
  if (!zone) throw new Error(`La misión nombra una zona que no existe: "${id}"`);
  return zone;
}

function inZone(pos: Vec2 | undefined, zone: Zone): boolean {
  if (!pos) return false;
  return (
    pos.x >= zone.x && pos.y >= zone.y && pos.x < zone.x + zone.width && pos.y < zone.y + zone.height
  );
}

function matchesQuery(entity: Entity, query: EntityQuery, history: MissionHistory): boolean {
  if (query.kind !== undefined && entity.kind !== query.kind) return false;
  if (query.kindIsNew === true && history.initialKinds.has(entity.kind)) return false;
  if (query.kindIsNew === false && !history.initialKinds.has(entity.kind)) return false;
  if (query.createdDuringRun === true && history.initialEntityIds.has(entity.id)) return false;
  if (query.createdDuringRun === false && !history.initialEntityIds.has(entity.id)) return false;
  if (query.crafted === true && !history.craftedIds.has(entity.id)) return false;
  if (query.placed === true && !history.placedIds.has(entity.id)) return false;
  for (const key of query.has ?? []) {
    if (entity.components[key] === undefined) return false;
  }
  for (const key of query.lacks ?? []) {
    if (entity.components[key] !== undefined) return false;
  }
  return true;
}

function matchingEntities(
  world: WorldState,
  query: EntityQuery,
  history: MissionHistory,
): Entity[] {
  return allEntities(world).filter((e) => matchesQuery(e, query, history));
}

function countEvents(
  history: MissionHistory,
  type: string,
  where?: Record<string, unknown>,
): number {
  return history.events.filter((event) => {
    if (event.type !== type) return false;
    if (!where) return true;
    return Object.entries(where).every(([key, value]) => event.data[key] === value);
  }).length;
}

/**
 * Búsqueda en anchura sobre las celdas que un cuerpo puede pisar, usando la
 * regla del motor. Cuatro direcciones, como el movimiento.
 */
function pathExists(world: WorldState, from: Vec2, to: Vec2, ignoreId?: string): boolean {
  if (!canStandAt(world, to, ignoreId)) return false;
  const seen = new Set<string>([`${from.x},${from.y}`]);
  const queue: Vec2[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === to.x && current.y === to.y) return true;
    for (const delta of [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]) {
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      const key = `${next.x},${next.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (canStandAt(world, next, ignoreId)) queue.push(next);
    }
  }
  return false;
}

export interface ObjectiveContext {
  world: WorldState;
  petId: string;
  zones: readonly Zone[];
  history: MissionHistory;
  /** Objetivos ya cumplidos y cuándo: lo que `sequence` necesita para juzgar el orden. */
  metAt: ReadonlyMap<string, number>;
  /**
   * Cómo se llama cada objetivo en voz humana. Una secuencia solo conoce los
   * ids de sus partes, y decir «todavía falta "tendido-completo"» es mostrar
   * el nombre interno; con esto dice qué paso falta con las mismas palabras
   * con que ese paso figura en la lista.
   */
  describeOf: ReadonlyMap<string, string>;
}

/** «van 2 de 4», o «todavía no» cuando alcanza con uno solo. */
function shortfall(count: number, min: number): string {
  return min === 1 ? 'todavía no' : `van ${count} de ${min}`;
}

/**
 * Juzga un objetivo contra el estado real del mundo. Función pura: mismo
 * mundo e historia ⇒ mismo veredicto.
 */
export function evaluateObjective(objective: Objective, ctx: ObjectiveContext): ObjectiveResult {
  const base = { id: objective.id, describe: objective.describe };
  switch (objective.kind) {
    case 'entity-exists': {
      const min = objective.min ?? 1;
      const found = matchingEntities(ctx.world, objective.query, ctx.history);
      const met = found.length >= min;
      return { ...base, met, detail: met ? null : shortfall(found.length, min) };
    }
    case 'entity-in-zone': {
      const min = objective.min ?? 1;
      const zone = zoneOf(ctx.zones, objective.zone);
      const found = matchingEntities(ctx.world, objective.query, ctx.history).filter((e) =>
        inZone(e.components.position, zone),
      );
      const met = found.length >= min;
      return {
        ...base,
        met,
        detail: met
          ? null
          : min === 1
            ? `nada en ${zone.label} todavía`
            : `van ${found.length} de ${min} en ${zone.label}`,
      };
    }
    case 'no-entity': {
      const zone = objective.zone ? zoneOf(ctx.zones, objective.zone) : undefined;
      const found = matchingEntities(ctx.world, objective.query, ctx.history).filter(
        (e) => !zone || inZone(e.components.position, zone),
      );
      return {
        ...base,
        met: found.length === 0,
        detail:
          found.length === 0
            ? null
            : `todavía queda${found.length === 1 ? '' : 'n'} ${found.length}`,
      };
    }
    case 'agent-in-zone': {
      const zone = zoneOf(ctx.zones, objective.zone);
      const pos = getEntity(ctx.world, ctx.petId)?.components.position;
      const met = inZone(pos, zone);
      // Sin coordenadas —«(3,7)» es el motor hablando— y sin repetir la zona:
      // el `describe` del objetivo ya dice adónde tenía que llegar, así que
      // nombrarla otra vez es la misma frase dos veces seguidas.
      return { ...base, met, detail: met ? null : 'todavía no' };
    }
    case 'path-open': {
      const open = pathExists(ctx.world, objective.from, objective.to, ctx.petId);
      return { ...base, met: open, detail: open ? null : 'sigue sin haber paso' };
    }
    case 'rule-learned': {
      const min = objective.min ?? 1;
      const count = ctx.history.learned[objective.gate];
      const met = count >= min;
      return { ...base, met, detail: met ? null : shortfall(count, min) };
    }
    case 'event-happened': {
      const min = objective.min ?? 1;
      const count = countEvents(ctx.history, objective.event, objective.where);
      const met = count >= min;
      return { ...base, met, detail: met ? null : shortfall(count, min) };
    }
    case 'all': {
      const parts = objective.of.map((child) => evaluateObjective(child, ctx));
      const pending = parts.filter((p) => !p.met);
      return {
        ...base,
        met: pending.length === 0,
        detail:
          pending.length === 0 ? null : `falta: ${pending.map((p) => p.describe).join('; ')}`,
      };
    }
    case 'any': {
      const parts = objective.of.map((child) => evaluateObjective(child, ctx));
      const met = parts.find((p) => p.met);
      // Acá el detalle SÍ sirve cumplido: de varias alternativas, dice cuál
      // fue la que valió, y eso no está en ninguna otra parte de la pantalla.
      return {
        ...base,
        met: met !== undefined,
        detail: met ? `por ${met.describe}` : 'ninguna todavía',
      };
    }
    case 'sequence': {
      // El orden se lee del tick en que cada parte se cumplió por primera vez.
      // Una secuencia satisfecha "de golpe" (todas en el mismo tick) es
      // legítima; lo que se rechaza es el desorden.
      let previous = -Infinity;
      const named = (id: string): string => ctx.describeOf.get(id) ?? id;
      for (const id of objective.of) {
        const at = ctx.metAt.get(id);
        if (at === undefined) return { ...base, met: false, detail: `falta: ${named(id)}` };
        if (at < previous) {
          return { ...base, met: false, detail: `${named(id)} pasó fuera de orden` };
        }
        previous = at;
      }
      return { ...base, met: true, detail: null };
    }
  }
}

/** Todos los objetivos de un árbol, incluidos los anidados: lo que hay que rastrear. */
export function flattenObjectives(objectives: readonly Objective[]): Objective[] {
  const out: Objective[] = [];
  for (const objective of objectives) {
    out.push(objective);
    if (objective.kind === 'all' || objective.kind === 'any') {
      out.push(...flattenObjectives(objective.of));
    }
  }
  return out;
}
