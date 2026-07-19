import type { Vec2 } from '@anima/shared';

export type EntityId = string;

/** Tipos de entidad conocidos por el MVP. El motor no restringe el catálogo. */
export type EntityKind = string;

/**
 * Componentes del mundo. Todos son datos serializables sin métodos:
 * la lógica vive en los sistemas de `step.ts`.
 */
export interface Components {
  position?: Vec2;
  collider?: { solid: boolean };
  /** Marca que la entidad puede recogerse. */
  portable?: Record<string, never>;
  energy?: { current: number; max: number; decayPerTick: number };
  health?: { current: number; max: number };
  strength?: { value: number };
  /** Resistencia al daño: el daño solo ocurre si el poder efectivo la supera. */
  hardness?: { value: number };
  durability?: { current: number; max: number };
  nutrition?: { value: number };
  inventory?: { items: EntityId[]; capacity: number };
  tool?: { power: number };
  /** Marca que la entidad puede consumirse (junto con nutrition). */
  edible?: Record<string, never>;
  agent?: { name: string; perceptionRange: number };
  dead?: { atTick: number; cause: string };
  /** Produce alimento periódicamente en una celda libre adyacente. */
  foodSource?: { intervalTicks: number; nutrition: number; nextSpawnAtTick: number };
  /**
   * Produce periódicamente el objeto declarado (arquetipo completo, como los
   * `drops`) en una celda libre adyacente: las ramas que un árbol suelta sin
   * que nadie lo tale. Es la forma genérica de `foodSource`, que se conserva
   * aparte porque vive en los guardados y porque el alimento satura distinto
   * (por ser comestible, no por ser del mismo tipo).
   */
  itemSource?: {
    intervalTicks: number;
    nextSpawnAtTick: number;
    output: { kind: EntityKind; components: Components };
  };
  /**
   * Agua: no es sólida (no tapa la vista ni la línea de visión) pero caminar
   * adentro falla con motivo propio. No hay nado ni sed: es terreno que da
   * forma a los caminos, no un recurso.
   */
  water?: Record<string, never>;
  /**
   * Ofrece dónde pisar: un cuerpo puede pararse en esta celda aunque el
   * terreno no lo permitiera. Es la propiedad que le faltaba al mundo para que
   * una cosa construida pudiera cambiar la FORMA de los caminos.
   *
   * Hasta acá, lo que Ánima fabricaba solo podía tapar (sólido) o estorbar; el
   * terreno era intocable, así que ninguna idea suya —ninguna— podía abrir un
   * paso donde no lo había. Un mundo donde inventar no puede cambiar por dónde
   * se camina es un mundo donde inventar sirve menos de lo que promete.
   *
   * Deliberadamente NO se llama "puente", "tabla" ni "balsa": es una propiedad,
   * y cualquier cosa puede tenerla. Qué cosa la tiene, cómo se llama y de qué
   * está hecha lo decide quien la imagine.
   *
   * Un piso es un piso, no un muro: lo que ofrece dónde pisar no cuenta como
   * obstáculo sólido, ni para caminar ni para el invariante de solapamiento.
   */
  footing?: Record<string, never>;
  /**
   * Refugio: anula la pérdida de calor corporal de los agentes a distancia
   * Chebyshev ≤ range. No calienta ni quema — es la contraparte serena de la
   * fogata: adentro no se pierde nada, pero tampoco se recupera.
   */
  shelter?: { range: number };
  /** Daña a los agentes adyacentes cada tick (espinas, fuego, etc.). */
  hazard?: { damagePerTick: number };
  /**
   * Calor corporal de un agente. Baja cada tick (el mundo es frío) salvo que
   * haya una fuente de calor en rango; en cero, la salud decae como con el
   * hambre pero con causa de muerte propia.
   */
  temperature?: { current: number; max: number; lossPerTick: number };
  /** Irradia calor a los agentes dentro del rango (distancia Chebyshev). */
  heatSource?: { warmthPerTick: number; range: number };
  /**
   * Qué deja la entidad al ser destruida (talar un árbol => troncos).
   * Declarativo: cada entrada es un arquetipo completo, listo para spawn.
   */
  drops?: Array<{ kind: EntityKind; components: Components }>;
}

export interface Entity {
  id: EntityId;
  kind: EntityKind;
  components: Components;
}
