// ═══ LAS SEIS FILAS QUE DICEN «EL MUNDO», VUELTAS A INTERROGAR ══════════════
//
// El bloque (4) de `hito-5-la-emergencia.test.ts` reparte los nueve ceros en tres
// casillas —EL MUNDO, LA MUERTE, LA MENTE— y en el tramo K la corrida canónica
// sigue contestando **6 filas EL MUNDO**. Ese veredicto se sacó, hasta el tramo J,
// sobre un mundo donde el dios decretaba 2280 cosas sueltas alrededor de la
// criatura y **`stepWorld` materializaba cero**: la única función que convertía un
// decreto en cuerpos traía los pozos de pesca y nada más. Un «el mundo no lo
// permite» medido sobre un mundo vacío no es un veredicto sobre el mundo.
//
// El tramo K lo reparó (`world/src/step.ts`, `materializarLoDecretado` →
// `abrirChunk`), y este archivo existe para volver a preguntar lo mismo sobre el
// mundo que ahora sí tiene cuerpos. **No mide a la mente ni corre una partida**:
// mira el mundo que le tocaría a la criatura en el tick 1 y pregunta qué ofrece.
//
// ═══ LO QUE YA CONTESTÓ LA CORRIDA, Y POR QUÉ NO SE REPITE ACÁ ══════════════
//
// Cinco de las seis cuelgan de que haya fuego, y eso está medido en el mismo
// archivo del criterio y sobre **las mismas veinte semillas y el mismo decreto**:
// el control del azar con la fogata regalada enciende cinco de los seis
// contra-detectores que la mente deja en cero.
//
//   contra-detector             la mente (0 fuegos)   el azar con fogata regalada
//   fuegoYDosPermeabilidades           0/20                    20/20
//   dosCombustiblesEnIntervalo         0/20                    20/20
//   parrillaOfrecida                   0/20                     6/20
//   algoSeCocino                       0/20                     5/20
//   loteAlAlcance                      0/20                     5/20
//   fardoPosible                       0/20                  ►  0/20  ◄
//
// O sea que para cinco de las seis **el mundo SÍ pone el problema delante en
// cuanto hay un fuego**, y su cero no es del mundo: es de los CERO FUEGOS en
// veinte partidas. La casilla «EL MUNDO» de `causaDe` no distingue esas dos cosas
// porque su control es el del tanque lleno, que tampoco enciende nada.
//
// La sexta —`fardoPosible`, la entrada 7 del documento— es la única que **no
// necesita fuego**: pide una vara encendible, algo con qué atar y dos combustibles,
// todo a tiro (Chebyshev ≤ 3) a la vez, y que la vara entregue lo que el fardo
// pide. Sigue en 0/20 con fuego y sin fuego, en las cuatro corridas del banco. Es
// la única de las seis sobre la que «EL MUNDO» todavía puede querer decir algo, y
// es la que este archivo interroga.
//
// **Y TAMPOCO LO MERECE.** El barrido de abajo mide que el mundo ofrecía la cadena
// en **5 de las 20 partidas**, desde 32 celdas, y que la más cercana estaba a
// **5 celdas** del arranque contra un alcance de 3. O sea que la sexta dice «la
// criatura no caminó hasta ahí» y no «el mundo no la tiene». Las seis filas de la
// casilla EL MUNDO quedan sin una sola que la merezca por el motivo que la casilla
// declara — y eso NO mueve el cero del criterio, que sigue siendo 0 de 9.
//
// ═══ LA PREGUNTA, PARTIDA EN DOS ════════════════════════════════════════════
//
// «El mundo no lo permite» puede ser dos cosas muy distintas, y la diferencia
// decide qué habría que arreglar:
//
//   (a) EL INVENTARIO. Lo que el dios decreta alrededor no alcanza para armar la
//       cadena ni juntándolo todo: falta la vara, falta el atador, faltan los dos
//       combustibles, o la vara no entrega lo que el fardo pide. Eso sería del
//       mundo de verdad, y se arregla en el dios o en la física.
//   (b) LA DISPERSIÓN. Los ingredientes están, pero nunca los cuatro adentro de la
//       misma ventana de 7×7. Eso NO es «el mundo no lo permite»: es «el mundo lo
//       permite en tal celda y la criatura nunca estuvo ahí» — y se arregla
//       caminando, o sea que vuelve a ser una fila que mide a la mente.
//
// Las dos se separan con la MISMA función exportada, `sePodiaArmarLaCadena`, y sin
// escribir una sola cuenta de física (Regla 1 del juez):
//
//   · el BARRIDO le pregunta por cada celda de los 3×3 chunks materializados, o
//     sea «¿había alguna parada desde la cual el mundo ofrecía el fardo?»;
//   · el APILADO se lo pregunta a un mundo HIPOTÉTICO donde todos los cuerpos
//     están en la celda de la criatura, o sea «¿el inventario da, si la distancia
//     no existiera?».
//
// El mundo apilado es ilegal —dos sólidos en una celda es `solidos-solapados`— y
// eso está bien y es a propósito: no se lo corre un tick ni se lo mide con
// `revisarEstado`, se le hace UNA pregunta pura sobre `(WorldState, Placement)`.
// Es una consulta, no un mundo.

import { describe, expect, it } from 'vitest'

import { CHUNK_SIZE, chebyshev, chunkCoord, mapaDeCuerpos, stepWorld } from '@anima/world'
import type { Placement, WorldBody, WorldState } from '@anima/world'

import { ALCANCE, sePodiaArmarLaCadena } from '../src/index.js'
import { escenaDe, laOrilla, PARTIDAS, RADIO_EN_CHUNKS, semillasQueSeJuegan } from './el-mundo-decretado.js'

/** El tanque canónico de §3, el mismo con el que corre el banco del criterio. */
const TANQUE = 310

/**
 * EL MUNDO DEL TICK 1: la escena cruda más lo que `stepWorld` materializa.
 *
 * Un solo paso sin intenciones. Es exactamente lo que la criatura encuentra al
 * abrir los ojos: `materializarLoDecretado` abre los nueve chunks de su vecindad
 * y `abrirChunk` convierte las `sueltas` del decreto en cuerpos.
 */
function elMundoDelPrimerTick(semilla: bigint): { readonly w: WorldState; readonly parada: Placement } | undefined {
  const o = laOrilla(semilla)
  if (o === undefined) return undefined
  return { w: stepWorld(escenaDe(o, TANQUE).state, []).state, parada: o.parada }
}

/**
 * EL MUNDO APILADO: los mismos cuerpos, todos en la celda de la criatura.
 *
 * No se toca ni una cualidad, ni una masa, ni una forma — sólo el `at`. Es la
 * pregunta «¿el inventario da?» hecha con la misma función que contesta «¿el mundo
 * lo ofrecía desde acá?», que es lo que la hace comparable: si el apilado dice que
 * sí y el barrido que no, la diferencia es la distancia y ninguna otra cosa.
 */
function apiladoEn(w: WorldState, celda: Placement): WorldState {
  const cuerpos: WorldBody[] = []
  for (const c of w.bodies.values()) cuerpos.push({ ...c, at: celda })
  return { ...w, bodies: mapaDeCuerpos(cuerpos) }
}

interface Barrido {
  /** La primera celda —en orden canónico— desde la que el mundo ofrecía el fardo. */
  readonly celda: Placement | undefined
  /** Cuántas celdas de los 3×3 chunks lo ofrecían. Se cuenta entero: es el denominador. */
  readonly cuantas: number
  /** Cuántas celdas se miraron. 48×48 con `RADIO_EN_CHUNKS` = 1. */
  readonly miradas: number
}

/**
 * BARRE LOS 3×3 CHUNKS y le pregunta a cada celda si desde ahí se armaba la cadena.
 *
 * Los 3×3 son la vecindad del dios (`NUEVE` en `materializarLoDecretado`) y no un
 * radio elegido acá: es exactamente lo que el mundo materializó en el primer paso,
 * o sea que barrer más lejos sería preguntar por cuerpos que todavía no existen.
 *
 * Se cuentan TODAS y no se corta en la primera: una sola celda buena en 2304 es un
 * mundo distinto de doscientas, y el número decide si «la criatura no pasó por ahí»
 * es una explicación o una excusa.
 */
function barrer(w: WorldState, centroDeLosChunks: Placement): Barrido {
  const acx = chunkCoord(centroDeLosChunks.x)
  const acy = chunkCoord(centroDeLosChunks.y)
  let celda: Placement | undefined
  let cuantas = 0
  let miradas = 0
  for (let dx = -RADIO_EN_CHUNKS; dx <= RADIO_EN_CHUNKS; dx++) {
    for (let dy = -RADIO_EN_CHUNKS; dy <= RADIO_EN_CHUNKS; dy++) {
      for (let i = 0; i < CHUNK_SIZE; i++) {
        for (let j = 0; j < CHUNK_SIZE; j++) {
          const p = { x: (acx + dx) * CHUNK_SIZE + i, y: (acy + dy) * CHUNK_SIZE + j }
          miradas += 1
          if (!sePodiaArmarLaCadena(w, p)) continue
          cuantas += 1
          celda ??= p
        }
      }
    }
  }
  return { celda, cuantas, miradas }
}

/** Cuántos cuerpos hay a tiro de una celda. El «ya no es un mundo vacío», contado. */
function aTiroDe(w: WorldState, centro: Placement): number {
  let n = 0
  for (const c of w.bodies.values()) if (chebyshev(c.at, centro) <= ALCANCE) n += 1
  return n
}

describe('las seis filas que dicen EL MUNDO, sobre el mundo que ahora SÍ existe', () => {
  it('1· YA NO ES UN MUNDO VACÍO: cuántos cuerpos trajo el primer tick, y cuántos a tiro', () => {
    // ─── LA PREMISA DEL TRAMO, HECHA MEDICIÓN ────────────────────────────────
    //
    // Antes de discutir de quién es cada cero hay que poder decir que el mundo
    // tiene cuerpos, porque el veredicto viejo se sacó sobre uno que no los tenía.
    // Acá no se afirma nada sobre las secuencias: se cuenta materia.
    const { semillas } = semillasQueSeJuegan(PARTIDAS)
    const filas: string[] = [
      '─── EL MUNDO DEL PRIMER TICK, CUERPO POR CUERPO ───',
      '',
      '  semilla   │ cuerpos │ a tiro del arranque (Chebyshev ≤ 3)',
      '  ──────────┼─────────┼────────────────────────────────────',
    ]
    let minimoATiro = Number.POSITIVE_INFINITY
    let totalCuerpos = 0
    for (const semilla of semillas) {
      const m = elMundoDelPrimerTick(semilla)
      // `semillasQueSeJuegan` sólo devuelve semillas con orilla: un `undefined` acá
      // sería un mundo que dejó de ser el mismo entre dos llamadas.
      expect(m, `la semilla ${String(semilla)} tenía orilla y ahora no`).not.toBe(undefined)
      if (m === undefined) continue
      const aTiro = aTiroDe(m.w, m.parada)
      totalCuerpos += m.w.bodies.size
      if (aTiro < minimoATiro) minimoATiro = aTiro
      filas.push(
        `  ${String(semilla).padStart(9)} │ ${String(m.w.bodies.size).padStart(7)} │ ${String(aTiro)}`,
      )
    }
    filas.push('')
    filas.push(`  cuerpos en total, en las ${String(semillas.length)} partidas: ${String(totalCuerpos)}`)
    filas.push(`  el peor arranque tenía ${String(minimoATiro)} cuerpos a tiro`)
    console.log(['', ...filas, ''].join('\n'))

    // LO QUE SE AFIRMA, y es lo único que este bloque puede afirmar: que el mundo
    // trae materia sola, sin que ningún arnés la siembre. El cuerpo de la criatura
    // es UNO, así que un mundo con dos ya trae algo; el número real se publica.
    expect(totalCuerpos).toBeGreaterThan(semillas.length)
    expect(minimoATiro).toBeGreaterThan(1)
  }, 300_000)

  it('2· LA SEXTA FILA, la única que no cuelga del fuego: ¿falta el inventario o falta la distancia?', () => {
    // Ver el encabezado: el barrido contesta (b) y el apilado contesta (a).
    const { semillas } = semillasQueSeJuegan(PARTIDAS)
    const filas: string[] = [
      '─── `fardoPosible` SOBRE LOS 3×3 CHUNKS MATERIALIZADOS ───',
      '  (vara encendible + atador + dos combustibles, todo a Chebyshev ≤ 3, y la vara',
      '   entregando lo que el `ignitionPoint` del fardo que `unir` arma pide)',
      '',
      '  semilla   │ celdas que lo ofrecían │ la primera │ a cuánto del arranque │ ¿y apilando todo?',
      '  ──────────┼───────────────────────┼────────────┼───────────────────────┼──────────────────',
    ]
    let conBarrido = 0
    let conApilado = 0
    let miradasTotales = 0
    let celdasBuenas = 0
    let laMasCerca = Number.POSITIVE_INFINITY
    for (const semilla of semillas) {
      const m = elMundoDelPrimerTick(semilla)
      expect(m, `la semilla ${String(semilla)} tenía orilla y ahora no`).not.toBe(undefined)
      if (m === undefined) continue
      const b = barrer(m.w, m.parada)
      const apilado = sePodiaArmarLaCadena(apiladoEn(m.w, m.parada), m.parada)
      miradasTotales += b.miradas
      celdasBuenas += b.cuantas
      if (b.cuantas > 0) conBarrido += 1
      if (b.celda !== undefined && chebyshev(b.celda, m.parada) < laMasCerca) {
        laMasCerca = chebyshev(b.celda, m.parada)
      }
      if (apilado) conApilado += 1
      filas.push(
        `  ${String(semilla).padStart(9)} │ ${String(b.cuantas).padStart(21)} │ ` +
          `${(b.celda === undefined ? '—' : `${String(b.celda.x)},${String(b.celda.y)}`).padStart(10)} │ ` +
          `${(b.celda === undefined ? '—' : String(chebyshev(b.celda, m.parada))).padStart(21)} │ ` +
          `${apilado ? 'SÍ' : 'no'}`,
      )
    }
    filas.push('')
    filas.push(
      `  el mundo ofrecía el fardo en alguna celda: ${String(conBarrido)} de ${String(semillas.length)} partidas · ` +
        `${String(celdasBuenas)} celdas de ${String(miradasTotales)} interrogadas`,
    )
    filas.push(
      `  la más cerca del arranque de la criatura estaba a ` +
        `${laMasCerca === Number.POSITIVE_INFINITY ? '—' : String(laMasCerca)} celdas, y el alcance es ${String(ALCANCE)}`,
    )
    filas.push(`  y apilando TODOS los cuerpos en la celda de la criatura: ${String(conApilado)} de ${String(semillas.length)}`)
    console.log(['', ...filas, ''].join('\n'))

    // ═══ LO QUE ESTE BARRIDO CONTESTÓ, Y NO ES LO QUE IBA A CONTESTAR ═══════
    //
    // La hipótesis con la que se escribió este bloque era (a): que el inventario no
    // daba, y que por eso la entrada 7 quedaba en «EL MUNDO». **Es falsa, medida.**
    //
    //   el mundo ofrecía el fardo en 5 de las 20 partidas, desde 32 celdas de las
    //   46.080 interrogadas (el 0,07%), y la más cercana estaba a 5 celdas del
    //   arranque — con un alcance de 3.
    //
    // O sea que la sexta fila tampoco dice «EL MUNDO no lo permite»: dice **«el
    // mundo lo permitía a cinco celdas de distancia y la criatura no fue»**. Con las
    // otras cinco —que se encienden todas en cuanto hay un fuego, ver el
    // encabezado— eso deja a las SEIS filas de la casilla EL MUNDO sin una sola que
    // la merezca por el motivo que la casilla declara.
    //
    // ─── Y LA TRAMPA DEL APILADO, que hay que decir porque va en contra ──────
    //
    // El apilado NO es una cota superior del barrido, y las dos columnas lo
    // muestran: hay semillas donde el barrido dice SÍ y el apilado dice no
    // (20260766, 20260739, 20260786) y al revés (20260752, 20260760, 20260781).
    // El motivo es del propio contra-detector y no del mundo: elige los DOS
    // COMBUSTIBLES MÁS PESADOS que hay a tiro, así que juntar el vecindario entero
    // en una celda le mete al fardo dos leños más gordos, le sube el
    // `ignitionPoint` que `unir` devuelve, y la vara deja de alcanzarlo. **Más
    // materia puede dar menos fardo**, y por eso el apilado se publica como lo que
    // es —otra pregunta— y no como el techo de la primera.
    //
    // ─── LO QUE SE AFIRMA, Y NO ES UN UMBRAL ─────────────────────────────────
    //
    // Los números crudos, clavados, para que moverlos se note. No se elige ninguno:
    // son lo que el dios decreta hoy con estas veinte semillas y lo que
    // `abrirChunk` materializa de eso. El día que cambien, esto se pone rojo y
    // alguien tiene que volver a mirar de quién es el cero de la entrada 7.
    expect(conBarrido).toBe(5)
    expect(celdasBuenas).toBe(32)
    expect(laMasCerca).toBe(5)
    expect(conApilado).toBe(5)
    // Y lo que de verdad importa del bloque, dicho como aserción y no como prosa:
    // el mundo ofrecía la cadena en alguna parte, o sea que el cero de la entrada 7
    // no se explica por un mundo que no la tiene.
    expect(conBarrido).toBeGreaterThan(0)
    // Pero nunca a tiro del arranque: si algún día lo estuviera, la fila pasaría a
    // medir a la mente sin que nadie tocara nada, y esto avisa.
    expect(laMasCerca).toBeGreaterThan(ALCANCE)
  }, 600_000)
})
