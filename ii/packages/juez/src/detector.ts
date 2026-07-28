// ─── EL DETECTOR AUTOMÁTICO DE SECUENCIAS ────────────────────────────────────
//
// La máquina. Come una partida tick a tick —el `WorldState` de cada paso y los
// `SimEvent` que ese paso narró— y al final dice qué secuencias aparecieron, en
// qué tick y con qué evidencia.
//
// ─── POR QUÉ ESTO NO ES UN TEST DE `@anima/mind` ────────────────────────────
//
// Porque el documento de arquitectura pide un juez EXTERNO, y lo argumenta:
// «“aparece un cuarto comportamiento que nadie diseñó” evaluado por el autor de
// las tablas no es un test». `@anima/juez` NO DEPENDE DE `@anima/mind` EN RUNTIME
// —sus `dependencies` son dos, `@anima/physics` y `@anima/world`, y nada más—, y
// `src/` tiene prohibido nombrarla: lo vigila `tests/ataque-determinismo.test.ts`
// leyendo el directorio, así que un módulo nuevo entra solo. El juez mira el mundo
// y los eventos; las decisiones de la mente no le llegan ni por accidente.
//
// LA EXCEPCIÓN, declarada acá porque esconderla sería peor: la mente está en
// `devDependencies`, porque el criterio hay que CORRERLO y correrlo es poner una
// criatura viva adentro de veinte partidas. Ese arnés es UN archivo de `tests/`
// —`hito-5-la-emergencia.test.ts`— que arma la partida con la mente y le pasa al
// `Detector` lo mismo que le pasaría cualquier otro banco: `{ state, events }` por
// tick. Que sea uno solo también está afirmado en aquel archivo.
//
// ─── EL CONTRATO DE ALIMENTACIÓN ────────────────────────────────────────────
//
// Una muestra por tick, en orden, y la primera es el estado INICIAL con la lista
// de eventos vacía. `state` es el estado DESPUÉS de `events`. Saltearse ticks no
// rompe nada pero degrada dos medidas —las rachas del detector 3 y los intervalos
// del 6— porque las dos cuentan ticks consecutivos; queda dicho acá y no
// verificado, porque verificarlo obligaría al juez a rechazar la partida de un
// banco que muestree cada N y ésa no es su decisión.

import { Cronica } from './cronica.js'
import { SECUENCIAS } from './secuencias.js'
import type { Fila, Muestra, NombreDeSecuencia, Veredicto } from './tipos.js'

export class Detector {
  /**
   * Pública y de sólo lectura a propósito: un juez cuya cuenta no se puede abrir
   * es un juez al que hay que creerle. Los tests del paquete la abren.
   */
  readonly cronica = new Cronica()

  observar(m: Muestra): void {
    this.cronica.observar(m)
  }

  /** Todas las muestras de una partida, en orden. */
  observarTodo(ms: Iterable<Muestra>): void {
    for (const m of ms) this.observar(m)
  }

  veredicto(): Veredicto {
    const filas: Fila[] = []
    const aparecidas: NombreDeSecuencia[] = []
    const noMedidas: NombreDeSecuencia[] = []
    for (const s of SECUENCIAS) {
      const a = s.dispara(this.cronica)
      const situacion = s.situacion(this.cronica)
      filas.push({
        nombre: s.nombre,
        mira: s.mira,
        llama: s.llama,
        aparecio: a !== undefined,
        tick: a?.tick,
        evidencia: a?.evidencia,
        situacion,
      })
      if (a !== undefined) aparecidas.push(s.nombre)
      // La Regla 4: si la situación no existió, el cero NO es una ausencia. Y una
      // secuencia que apareció no puede ser «no medida» aunque el contra-detector
      // diga que no —eso sería un contra-detector roto, y se ve en la tabla.
      else if (!situacion) noMedidas.push(s.nombre)
    }
    return { ticks: this.cronica.ticks, filas, aparecidas, noMedidas }
  }
}

/** Una partida entera de una sentada. */
export function juzgar(ms: Iterable<Muestra>): Veredicto {
  const d = new Detector()
  d.observarTodo(ms)
  return d.veredicto()
}

// ─── El informe ──────────────────────────────────────────────────────────────

/** Lo que el banco publica de UNA secuencia sobre las N partidas corridas. */
export interface FilaDelBanco {
  readonly nombre: NombreDeSecuencia
  /** En cuántas partidas disparó. Dentro de una partida no se cuenta dos veces. */
  readonly aparecioEn: number
  /** En cuántas el mundo le puso el problema delante. */
  readonly situacionEn: number
  /** En cuántas no se pudo medir. Es `partidas − situacionEn`, y no es una ausencia. */
  readonly noMedidaEn: number
  /**
   * EN CUÁNTAS DISPARÓ MIENTRAS EL CONTRA-DETECTOR NEGABA LA SITUACIÓN.
   *
   * Cero es lo normal y cualquier otra cosa es una contradicción del juez consigo
   * mismo: el detector dice que la conducta ocurrió y el contra-detector dice que
   * el mundo nunca puso el problema delante. Se publica porque es el número que
   * delata un detector roto, y porque las filas así **no cuentan**.
   */
  readonly contradictorioEn: number
  /**
   * ¿Cuenta como aparecida? §10.2: hace falta que haya aparecido en ≥ 2 partidas
   * —«una sola aparición es indistinguible de una casualidad de semilla»— **y que
   * en alguna de ellas el contra-detector haya dicho que la situación existía**.
   *
   * ─── LA SEGUNDA MITAD, y era el vehículo de los dos agujeros mortales ──────
   *
   * `cuenta` salía de `aparecioEn >= 2` y nada más. Medido: dos partidas
   * idénticas con una fogata ya prendida daban «apareció en 2/2 con situación en
   * 0/2 → cuenta: true». Los dos disparos que el motor firmaba solo —el fardo
   * renombrado por `unir` y el leño con cero intenciones— salían los dos con esa
   * marca, o sea que la contradicción no era teórica: era la puerta por la que un
   * artefacto del detector llegaba al piso de cuatro y decidía el proyecto. Un
   * disparo que el propio contra-detector niega es un error del juez, no una
   * aparición.
   */
  readonly cuenta: boolean
}

export interface Resumen {
  readonly partidas: number
  readonly filas: readonly FilaDelBanco[]
  /** Cuántas cuentan como aparecidas. El criterio publicado pide al menos 4. */
  readonly cuantasCuentan: number
  /** §10: si quedan más de tres sin medir sobre nueve, el resultado no es interpretable. */
  readonly interpretable: boolean
}

/** El piso de §10.2: una sola aparición es una casualidad de semilla. */
export const PARTIDAS_QUE_HACEN_UNA_APARICION = 2

/** El techo de §10: más de tres «no medidas» sobre nueve y el banco no dice nada. */
export const NO_MEDIDAS_QUE_ARRUINAN_EL_BANCO = 3

export function resumir(veredictos: readonly Veredicto[]): Resumen {
  const filas: FilaDelBanco[] = []
  let cuantasCuentan = 0
  let sinMedir = 0
  for (const s of SECUENCIAS) {
    let aparecioEn = 0
    let situacionEn = 0
    let contradictorioEn = 0
    for (const v of veredictos) {
      // Por NOMBRE y no por índice: un veredicto llega de afuera y hacer coincidir
      // dos listas por posición es la clase de acoplamiento que aguanta hasta que
      // alguien reordena una y el banco pasa a sumar la columna equivocada sin
      // que nada falle.
      for (const f of v.filas) {
        if (f.nombre !== s.nombre) continue
        if (f.aparecio) aparecioEn += 1
        if (f.situacion) situacionEn += 1
        if (f.aparecio && !f.situacion) contradictorioEn += 1
      }
    }
    const cuenta = aparecioEn >= PARTIDAS_QUE_HACEN_UNA_APARICION && situacionEn > 0
    if (cuenta) cuantasCuentan += 1
    if (situacionEn === 0) sinMedir += 1
    filas.push({
      nombre: s.nombre,
      aparecioEn,
      situacionEn,
      noMedidaEn: veredictos.length - situacionEn,
      contradictorioEn,
      cuenta,
    })
  }
  return {
    partidas: veredictos.length,
    filas,
    cuantasCuentan,
    interpretable: sinMedir <= NO_MEDIDAS_QUE_ARRUINAN_EL_BANCO,
  }
}

/**
 * La tabla en texto, para que el informe se pueda leer sin un depurador.
 *
 * `padEnd` y `toFixed` y nada más: `toLocaleString` está prohibido en `src/`
 * porque el orden y el formato dependerían del idioma del sistema.
 */
export function tabla(v: Veredicto): string {
  const lineas: string[] = [`── el juez, sobre ${String(v.ticks)} ticks ──`]
  for (const f of v.filas) {
    // `SÍ … (no medida)` era una contradicción impresa como si fuera un
    // resultado: el detector afirmando la conducta y el contra-detector negando
    // que el mundo haya puesto el problema. Se imprime como lo que es, y `cuenta`
    // no la suma.
    const marca = f.aparecio ? (f.situacion ? 'SÍ ' : '?! ') : f.situacion ? 'no ' : '—  '
    const donde = f.tick === undefined ? '' : `  t=${String(f.tick)}`
    const nota = f.situacion ? '' : f.aparecio ? ' (CONTRADICE AL CONTRA-DETECTOR)' : ' (no medida)'
    lineas.push(`  ${marca} ${f.nombre.padEnd(38)}${nota}${donde}`)
    if (f.evidencia !== undefined) lineas.push(`        ${f.evidencia}`)
  }
  lineas.push(
    `  aparecieron ${String(v.aparecidas.length)} de ${String(v.filas.length)}` +
      `, no medidas ${String(v.noMedidas.length)}`,
  )
  return lineas.join('\n')
}
