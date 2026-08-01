// ─── El vocabulario del juez ─────────────────────────────────────────────────
//
// Nada de acá decide nada: son los nombres con los que el resto del paquete
// habla. Están separados del detector por la misma razón por la que el detector
// está separado de la mente — para que se puedan leer sin leer la máquina.

import type { SimEvent, WorldState } from '@anima/world'

/**
 * LOS NUEVE NOMBRES, en kebab-case y EXACTAMENTE como los escribe
 * `ii/docs/hito-5-las-diez-secuencias.md` §4.
 *
 * Que sea una unión de literales y no `string` es la mitad del punto: el día que
 * alguien le cambie una letra a un detector, `tsc` lo dice. Un criterio de corte
 * cuyos nombres se puedan mover en silencio no es un criterio.
 *
 * El orden es el del documento y es ESTABLE: el informe se publica en él, y una
 * tabla que se reordena entre corridas no se puede comparar con la anterior.
 */
export type NombreDeSecuencia =
  | 'no-frotar-lo-que-no-alcanza-a-encender'
  | 'la-vara-mas-liviana-que-igual-cocina'
  | 'taparlo-con-lo-que-respira'
  | 'ponerle-punta-al-aparejo'
  | 'comerla-en-el-pico-de-calorias'
  | 'cocinar-el-lote-en-un-solo-fuego'
  | 'el-fardo-de-corteza'
  | 'el-leno-mas-grande-que-todavia-cocina'
  | 'la-piedra-primero-y-la-comida-encima'

/**
 * UN TICK DE PARTIDA, visto desde afuera.
 *
 * Es estructuralmente el `StepOutcome` de `@anima/world` —`{ state, events }`—
 * a propósito: quien corra el banco le pasa al juez lo que `stepWorld` le
 * devolvió, sin traducir nada. Se declara acá igual, y no se importa aquel tipo,
 * porque el juez también tiene que poder comer el estado INICIAL, que no salió
 * de ningún paso y no tiene eventos.
 *
 * `state` es el estado DESPUÉS de los `events`. Esa asimetría importa y está
 * dicha en `Cronica.observar`: en el tick en que un proceso se completa el mundo
 * le saca la actividad al actor, así que los roles de esa actividad hay que
 * haberlos visto en el tick anterior.
 */
export interface Muestra {
  readonly state: WorldState
  readonly events: readonly SimEvent[]
}

/** Dónde y con qué se vio una secuencia. La evidencia va en castellano y con números. */
export interface Aparicion {
  /** El `tick` del mundo en el que quedó cerrada la firma. */
  readonly tick: number
  readonly evidencia: string
}

/**
 * Una fila del informe. Son las tres cifras que §10 del documento manda publicar
 * —apareció / la situación existió / no medida— más la evidencia del disparo.
 */
export interface Fila {
  readonly nombre: NombreDeSecuencia
  /** Qué mira el detector, en una línea. */
  readonly mira: string
  /** QUÉ FUNCIONES EXPORTADAS DEL MOTOR llama. La Regla 1, hecha dato. */
  readonly llama: readonly string[]
  readonly aparecio: boolean
  readonly tick: number | undefined
  readonly evidencia: string | undefined
  /**
   * EL CONTRA-DETECTOR: ¿el mundo le puso el problema delante?
   *
   * Si es `false`, el `aparecio: false` de al lado **no es una ausencia**: es una
   * no-medida, y §10 manda reportarla como tal. Un cero que nadie pudo mover no
   * es un resultado.
   */
  readonly situacion: boolean
}

/** Lo que el juez dice de UNA partida. */
export interface Veredicto {
  /** El `tick` de la última muestra. Cero si no se observó ninguna. */
  readonly ticks: number
  readonly filas: readonly Fila[]
  readonly aparecidas: readonly NombreDeSecuencia[]
  /** Las que no aparecieron Y cuya situación no existió. No cuentan como ausencia. */
  readonly noMedidas: readonly NombreDeSecuencia[]
}
