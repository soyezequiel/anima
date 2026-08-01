// ─── EL ADVERSARIO DE LAS SUELTAS ────────────────────────────────────────────
//
// `las-sueltas-se-materializan.test.ts` mide la reparación del tramo K: el mundo
// dejó de materializar sólo el banco de peces y ahora también pone en el piso lo
// que el decreto deja tirado. Este archivo no la mide: la ATACA, por los cuatro
// frentes que una reparación así puede romper —determinismo, idempotencia, la
// celda ocupada y el costo— y por un quinto que es el más barato de todos:
// **verificar los números del que reparó**.
//
// El resultado, adelantado para que nadie tenga que leer 600 líneas para saber si
// hay algo grave:
//
//   · DETERMINISMO ...... SE ROMPE, y rompe el criterio publicado del Hito 3.
//                         Los MISMOS dos puntos visitados en los dos órdenes dan
//                         dos hashes distintos. Bloque (2), con `it.fails`.
//   · IDEMPOTENCIA ...... AGUANTA. 4492 ids en 2000 ticks y ninguno resucita, ni
//                         quemando la mitad cada cien ticks, ni pasando por JSON
//                         en el medio. Bloque (1).
//   · CELDA OCUPADA ..... SE ROMPE en 2 de 20 semillas, y no entre dos sueltas
//                         sino entre el pozo y una suelta. Bloque (3). Está
//                         anotado en el juez; acá se verifica desde afuera y con
//                         otras semillas.
//   · EL COSTO .......... CONFIRMADO —los conteos coinciden al cuerpo— y con una
//                         consecuencia que el otro archivo no saca: entre el tick
//                         10.000 y el 12.000 el tick pasa a costar MÁS que la
//                         ventana del reloj, o sea que `ticksPerdidos === 0` —el
//                         criterio (4) del Hito 5, hoy reportado como CUMPLE— deja
//                         de valer para cualquier criatura que camine. Bloque (4).
//   · LOS NÚMEROS ....... uno de los míos salió mal y está escrito: el bloque (5)
//                         cuenta el control mal armado que casi me hace publicar
//                         «el pozo no rompe la conservación, sólo las sueltas».

import { describe, expect, it } from 'vitest'
import type { Physics } from '@anima/physics'
import { buildSeedPhysics, HZ_DE_REFERENCIA, T_AMBIENTE } from '@anima/physics'
import { milicaloriasDe } from '@anima/oracle'
import { chunkFromKey, chunkKey } from '../src/cell.js'
import type { EstadoDelDios } from '../src/dios.js'
import { crearDios, decretoDe, idDeSuelta, PREFIJO_POZO, PREFIJO_SUELTA } from '../src/dios.js'
import { hashWorld } from '../src/hash.js'
import type { Placement } from '../src/intent.js'
import { goTo } from '../src/intent.js'
import { revisarEstado, revisarInvariantes } from '../src/invariants.js'
import { restoreWorld, worldSlots } from '../src/mundo.js'
import type { SimEvent, WorldBody, WorldState } from '../src/step.js'
import { mapaDeCuerpos, mapaDeActores, stepWorld } from '../src/step.js'

// ─── La escena, que no planta NADA ───────────────────────────────────────────
//
// Una criatura sola y un dios detrás. Todo lo que aparezca en el piso lo puso el
// mundo. La `stamina` es absurda a propósito: acá no se mide el hambre, y una
// criatura que se muere a mitad de un barrido de 2000 ticks deja de caminar y el
// mundo deja de crecer — que es justo lo que hay que medir.

const SEMILLA = 20260728n
const HAMBRE_QUE_NO_ESTORBA = 1_000_000

/**
 * `buildSeedPhysics()` NUEVA por escena, y no es cosmética.
 *
 * `decretoDe` memoiza los decretos en un `WeakMap<Physics, Map<"cx:cy", Decreto>>`
 * **sin la semilla adentro de la clave**, así que dos dioses distintos que
 * compartan el objeto `Physics` decretan un solo mundo. Verificado acá abajo en el
 * bloque (5): `decretoDe(crearDios(1n), phys, 0, 0) === decretoDe(crearDios(999n),
 * phys, 0, 0)` devuelve el MISMO objeto. Es el mismo rodeo que `nuevaFisica()` del
 * juez, y hasta el tramo K ese agujero sólo podía falsear un pozo; ahora falsea el
 * piso entero.
 */
function escena(o: { desde?: Placement; semilla?: bigint; sembrados?: readonly number[] } = {}): {
  readonly state: WorldState
  readonly phys: Physics
  readonly dios: EstadoDelDios
} {
  const phys = buildSeedPhysics()
  const base = crearDios(o.semilla ?? SEMILLA)
  const dios: EstadoDelDios =
    o.sembrados === undefined ? base : { ...base, sembrados: [...o.sembrados].sort((a, b) => a - b) }
  const desde = o.desde ?? { x: 0, y: 0 }
  return {
    phys,
    dios,
    state: {
      tick: 0,
      hz: HZ_DE_REFERENCIA,
      phys,
      bodies: mapaDeCuerpos([
        {
          body: {
            id: 'a0-cuerpo',
            form: 'bloque',
            parts: [{ substance: 'carne', mass: 2, q: {} }],
            joints: [],
            state: { temperature: T_AMBIENTE, stamina: HAMBRE_QUE_NO_ESTORBA },
          },
          at: desde,
        },
      ]),
      actors: mapaDeActores([
        { id: 'a0', body: 'a0-cuerpo', holding: [], capacity: 6, permits: 'irreversible' },
      ]),
      cells: new Map(),
      desplegados: new Map(),
      nextId: 1,
      dios,
    },
  }
}

function sueltasDe(w: WorldState): readonly string[] {
  return [...w.bodies.keys()].filter((id) => id.startsWith(PREFIJO_SUELTA))
}

function pozosDe(w: WorldState): readonly string[] {
  return [...w.bodies.keys()].filter((id) => id.startsWith(PREFIJO_POZO))
}

function donde(w: WorldState): Placement {
  return (w.bodies.get('a0-cuerpo') as WorldBody).at
}

/** Teletransportar es el arnés eligiendo el orden de exploración, no caminar. */
function mover(w: WorldState, p: Placement): WorldState {
  return {
    ...w,
    bodies: mapaDeCuerpos(
      [...w.bodies.values()].map((c) => (c.body.id === 'a0-cuerpo' ? { ...c, at: p } : c)),
    ),
  }
}

/**
 * El desvío del caminante, copiado de `las-sueltas-se-materializan.test.ts` y por
 * el mismo motivo medido allá: con el piso lleno, un `goTo` en línea recta termina
 * contra un sólido sin `footing` y no sale más. Desviar un poco en `y` según el
 * tick es lo mínimo para que el paso pruebe tres celdas y rodee. Es función del
 * tick, o sea determinista.
 */
const DESVIO = [0, 1, -1] as const

function caminar(
  w0: WorldState,
  ticks: number,
  rumbo: 'este' | 'norte' = 'este',
  mirar?: (antes: WorldState, w: WorldState, ev: readonly SimEvent[], t: number) => void,
): WorldState {
  let w = w0
  for (let t = 0; t < ticks; t++) {
    const antes = w
    const at = donde(w)
    const destino =
      rumbo === 'este'
        ? { x: at.x + 64, y: at.y + (DESVIO[t % 3] as number) }
        : { x: at.x + (DESVIO[t % 3] as number), y: at.y - 64 }
    // LOS EVENTOS DEL TICK VIAJAN CON EL ESTADO, y no es un detalle de firma: sin
    // ellos `revisarConservacion` no ve el `gasto` de stamina que el paso declaró
    // y acusa `conservada-evaporada` en cada celda caminada. Es el segundo número
    // que me salió mal en este archivo (ver el bloque 5) y salió del mismo lugar
    // que el primero: un guardián al que se le esconde la mitad de su entrada.
    const r = stepWorld(w, [goTo({ by: 'a0', seq: t }, destino, 0)])
    w = r.state
    if (mirar !== undefined) mirar(antes, w, r.events, t)
  }
  return w
}

function todosLosChunks(r: number): readonly number[] {
  const out: number[] = []
  for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) out.push(chunkKey(cx, cy))
  return out
}

// ═══ (1) IDEMPOTENCIA: ¿SE PUEDE DUPLICAR MATERIA? ═══════════════════════════
//
// Es el frente más grave de los cuatro, porque duplicar materia rompe la
// conservación y con ella todo lo que el mundo promete. `las-sueltas` ya prueba
// los casos de a uno —irse y volver, quitar un cuerpo, un viaje por JSON—; acá se
// prueban los tres A LA VEZ y a escala, que es donde este tipo de bug vive.

describe('(1) idempotencia: el libro mayor de lo que el mundo pare', () => {
  it('2000 TICKS CAMINANDO: 4492 ids, y ninguno vuelve después de irse', () => {
    // El libro mayor es la forma fuerte de la pregunta. `las-sueltas` mira que no
    // haya ids REPETIDOS en un instante —que es imposible por construcción, los
    // cuerpos viven en un `Map` por id— y que un cuerpo borrado no vuelva en cinco
    // ticks. Acá se lleva la cuenta a lo largo de toda la partida: cada id que
    // alguna vez estuvo y después no está queda RETIRADO, y si vuelve a aparecer es
    // materia duplicada.
    const e = escena()
    const vivas = new Set<string>()
    const retiradas = new Set<string>()
    const resucitadas: string[] = []
    const w = caminar(e.state, 2000, 'este', (_a, d, _ev, t) => {
      const ahora = new Set(sueltasDe(d))
      for (const id of ahora) {
        if (retiradas.has(id)) resucitadas.push(`t=${String(t)} ${id}`)
        vivas.add(id)
      }
      for (const id of vivas) if (!ahora.has(id)) retiradas.add(id)
    })
    console.log(
      `\n─── EL LIBRO MAYOR, 2000 TICKS ───\n` +
        `  ids vistos ${String(vivas.size)} · retirados ${String(retiradas.size)} · ` +
        `RESUCITADOS ${String(resucitadas.length)}\n` +
        `  chunks abiertos ${String((w.dios?.sembrados ?? []).length)} · cuerpos ${String(w.bodies.size)}\n`,
    )
    expect(resucitadas).toEqual([])
    // Y que el barrido haya tenido de qué hablar, o no prueba nada.
    expect(vivas.size).toBeGreaterThan(4000)
  }, 120_000)

  it('LA PRUEBA DURA: quemar la mitad cada cien ticks Y pasar por JSON en el medio', () => {
    // ─── POR QUÉ LOS TRES JUNTOS Y NO DE A UNO ───────────────────────────────
    //
    // La idempotencia de este tramo se apoya en UN campo —`EstadoDelDios.sembrados`—
    // y ese campo tiene tres enemigos distintos: que el cuerpo desaparezca (la
    // criatura lo quema y `d.bodies.has()` deja de verlo), que el estado viaje por
    // JSON (`restaurarDios` lo descartaba, y eso ya se cazó una vez) y que el mundo
    // siga creciendo mientras tanto. Probados de a uno pasan; el modo de falla que
    // queda es el de los tres a la vez, que es también el de una partida de verdad:
    // se guarda, se carga, se sigue jugando y se quema lo que se juntó.
    //
    // «Quemar» acá es sacar el cuerpo del estado a mano, que es lo que la ley 4 y
    // `comer` hacen: es la forma honesta de la desaparición, y es exactamente el
    // caso que `d.bodies.has(id)` no habría podido distinguir de un chunk sin abrir.
    const e = escena()
    let w = e.state
    const quemadas = new Set<string>()
    const resucitadas: string[] = []
    let viajes = 0
    for (let bloque = 0; bloque < 10; bloque++) {
      w = caminar(w, 100)
      // Quemar la mitad de lo que hay en el piso, en orden canónico de id.
      const enPie = sueltasDe(w)
      const sinEllas = new Map(w.bodies)
      for (let k = 0; k < enPie.length; k += 2) {
        const id = enPie[k] as string
        sinEllas.delete(id)
        quemadas.add(id)
      }
      w = { ...w, bodies: sinEllas }
      // Y el viaje por disco, con `JSON.parse(JSON.stringify(...))` de verdad: un
      // ida y vuelta en memoria no habría visto el agujero de `restaurarDios`.
      const enDisco = JSON.parse(JSON.stringify([...worldSlots(w)])) as [string, unknown][]
      w = restoreWorld(new Map(enDisco))
      viajes += 1
      for (const id of sueltasDe(w)) if (quemadas.has(id)) resucitadas.push(`bloque ${String(bloque)} ${id}`)
    }
    // Y cien ticks más después del último viaje, que es cuando un chunk mal marcado
    // volvería a parir.
    w = caminar(w, 100)
    for (const id of sueltasDe(w)) if (quemadas.has(id)) resucitadas.push(`al final ${id}`)
    console.log(
      `\n─── QUEMAR + GUARDAR + SEGUIR ───\n` +
        `  ${String(viajes)} viajes por JSON · quemadas ${String(quemadas.size)} · ` +
        `en pie ${String(sueltasDe(w).length)}\n` +
        `  chunks abiertos ${String((w.dios?.sembrados ?? []).length)}\n` +
        `  RESUCITADAS: ${String(resucitadas.length)} ${resucitadas.slice(0, 3).join(' | ')}\n`,
    )
    expect(resucitadas).toEqual([])
    expect(quemadas.size).toBeGreaterThan(500)
  }, 120_000)

  it('ir, volver y volver a ir: el mismo pasillo tres veces no pare tres veces', () => {
    const e = escena()
    let w = caminar(e.state, 200)
    const alLlegar = sueltasDe(w).length
    const abiertosAlLlegar = (w.dios?.sembrados ?? []).length
    // Vuelta al oeste por el mismo pasillo, y otra vez al este.
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      for (let t = 0; t < 300; t++) {
        const at = donde(w)
        const dx = vuelta === 0 ? -64 : 64
        w = stepWorld(w, [
          goTo({ by: 'a0', seq: t }, { x: at.x + dx, y: at.y + (DESVIO[t % 3] as number) }, 0),
        ]).state
      }
    }
    const ids = sueltasDe(w)
    // La cuenta cerrada contra el decreto: hay exactamente lo que decretaron los
    // chunks abiertos, ni una de más. Nadie tocó nada, así que no hay bajas.
    let decretadas = 0
    for (const k of w.dios?.sembrados ?? []) {
      const { cx, cy } = chunkFromKey(k)
      decretadas += decretoDe(e.dios, e.phys, cx, cy).chunk.sueltas.length
    }
    console.log(
      `\n─── TRES PASADAS POR EL MISMO PASILLO ───\n` +
        `  al llegar: ${String(alLlegar)} sueltas / ${String(abiertosAlLlegar)} chunks\n` +
        `  al final:  ${String(ids.length)} sueltas / ${String((w.dios?.sembrados ?? []).length)} chunks\n` +
        `  decretadas en lo abierto: ${String(decretadas)}\n`,
    )
    expect(new Set(ids).size).toBe(ids.length)
    // La única desigualdad admitida es hacia ABAJO: lo que chocó y no encontró
    // hueco no entra (ver el bloque 3). Hacia arriba sería materia inventada.
    expect(ids.length).toBeLessThanOrEqual(decretadas)
  }, 120_000)
})

// ═══ (2) DETERMINISMO: EL HALLAZGO ═══════════════════════════════════════════

describe('(2) determinismo: el criterio del Hito 3, sobre el mundo materializado', () => {
  it('el control: dos partidas gemelas que caminan igual dan el mismo hash', () => {
    const a = caminar(escena().state, 300)
    const b = caminar(escena().state, 300)
    expect(hashWorld(worldSlots(a))).toBe(hashWorld(worldSlots(b)))
  }, 60_000)

  it('CERRADO · LOS MISMOS DOS PUNTOS EN LOS DOS ÓRDENES DAN EL MISMO HASH', () => {
    // ═══ CÓMO SE CERRÓ, ANTES DE LA HISTORIA ════════════════════════════════
    //
    // `abrirChunk` (`world/src/step.ts`) le preguntaba al MUNDO dónde había
    // lugar (`celdaLibreCerca`) y ahora le pregunta al DECRETO
    // (`celdaDelDecreto`): la celda de cada suelta sale de `(semilla, chunk,
    // índice)` y el estado del mundo no entra en la cuenta. El caso que ninguna
    // función pura resuelve sola —alguien parado en la celda decretada— se
    // resuelve al revés que antes: **manda el decreto y se corre el que estaba**
    // (`correrAlQueEstaba`). El precio, dicho entero, está en el encabezado de
    // `abrirChunk`; la mitad corta es que la posición de la criatura ya dependía
    // de su historia y la de una piedra sembrada no dependía de nada.
    //
    // Los dos hashes de abajo eran `2f63c2f9eabd29b6` y `a4fc2879124b0d36`.
    // Este test quedó con las MISMAS dos aserciones que tenía cuando era un
    // `it.fails`; lo único que se le sacó es el `.fails`.

    // ═══ EL CRITERIO, CITADO DEL DOCUMENTO Y NO PARAFRASEADO ═════════════════
    //
    // `docs/architecture/remake-anima-ii.md`, Hito 3, línea 1436:
    //
    //   «el mismo mundo explorado en dos órdenes **y con dos historias distintas
    //    entre medio** produce el mismo hash»
    //
    // El hash del que habla es el del MUNDO (`hashWorld`), que es la única función
    // de hash que el paquete tiene. `abrirChunk` (`world/src/step.ts`) declara el
    // precio de su decisión y después lo despacha así:
    //
    //   «Es la misma clase de dependencia del camino que el encabezado de
    //    `materializarLoDecretado` ya declara para CUÁNTOS bancos hay, y **no toca
    //    el criterio del Hito 3, que es sobre el DECRETO —que no se mueve— y no
    //    sobre el mundo**.»
    //
    // Esa última oración vuelve a escribir el criterio más chico de lo que está
    // publicado. Es exactamente el movimiento que la sección 5 del traspaso ya
    // cobró una vez («cuando un criterio falla, volvé al texto que lo pidió y no al
    // documento intermedio que lo reformuló»), y acá está el contraejemplo.
    //
    // ─── LA CONSTRUCCIÓN, QUE ES LO QUE HACE QUE ESTO CUENTE ────────────────
    //
    // `las-sueltas-se-materializan.test.ts` tiene su propio test de dos órdenes y
    // pasa. Pasa porque sus cuatro puntos —(0,0), (48,0), (48,48), (0,48)— son
    // esquinas de chunk y NINGUNO cae sobre una celda que el decreto haya elegido:
    // sin choque no hay dependencia del camino, y el test mide un mundo donde el
    // mecanismo que se quiere probar nunca se activa. Además compara `inventario()`
    // —nombre, sustancia y celda— y no el hash, que es lo que el criterio pide.
    //
    // Acá los dos recorridos visitan LOS MISMOS DOS PUNTOS y sólo cambian el orden:
    //
    //   B = la celda que el decreto le eligió a `suelta:2:0:0`
    //   C = otra celda cualquiera del mismo chunk
    //
    //   [C, B]  se abre el chunk con la criatura en C → la suelta va donde el dios dijo
    //   [B, C]  se abre el chunk con la criatura en B → la suelta se corre una celda
    //
    // Los dos abren los MISMOS 9 chunks y terminan con las MISMAS 90 sueltas. La
    // criatura se normaliza a (0,0) en los dos antes de hashear, así que lo único
    // que queda de diferencia es de dónde salió la piedra. MEDIDO:
    //
    //     B={"x":34,"y":6} · C={"x":41,"y":13} · mismos chunks: true (9/9)
    //     en [C,B] y no en [B,C] .... suelta:2:0:0@34,6
    //     en [B,C] y no en [C,B] .... suelta:2:0:0@35,6
    //     hash [C,B] ............... 2f63c2f9eabd29b6
    //     hash [B,C] ............... a4fc2879124b0d36
    //
    // ─── CUÁL DE LAS TRES SALIDAS SE TOMÓ ──────────────────────────────────
    //
    // El adversario dejó tres escritas:
    //
    //   (a) que la celda final NO dependa del mundo: correrse por un orden que sea
    //       función pura de `(chunk, índice)` —el primer rumbo libre EN EL DECRETO,
    //       no en el estado—, y descartar sólo cuando la celda decretada esté
    //       ocupada por otra COSA DECRETADA. Deja el caso «alguien está parado ahí»
    //       sin resolver, que es el que producía este hallazgo;
    //   (b) que el que se corra sea el que ya estaba —la criatura— en vez de la
    //       piedra. Es raro pero es determinista: el decreto manda;
    //   (c) aceptar la dependencia y BAJAR el criterio del Hito 3 en el documento,
    //       con la firma del usuario.
    //
    // Se tomaron **(a) y (b) juntas**, que es lo que hacía falta: (a) sola no
    // alcanza —el adversario lo dice en su propio texto— porque descartar la suelta
    // hace que su EXISTENCIA dependa del camino, que es la misma dependencia con
    // otro disfraz. (c) no se tomó: el criterio publicado se cumple.
    const e0 = escena()
    const CX = 2
    const CY = 0
    const s0 = decretoDe(e0.dios, e0.phys, CX, CY).chunk.sueltas[0] as { i: number }
    const B: Placement = { x: CX * 16 + (s0.i % 16), y: CY * 16 + Math.floor(s0.i / 16) }
    const C: Placement = {
      x: CX * 16 + (((s0.i % 16) + 7) % 16),
      y: CY * 16 + ((Math.floor(s0.i / 16) + 7) % 16),
    }
    const recorrer = (orden: readonly Placement[]): WorldState => {
      let w = escena({ desde: orden[0] as Placement }).state
      for (const p of orden) w = stepWorld(mover(w, p), []).state
      // La criatura, a la misma celda en los dos: lo que se compara es el mundo que
      // el dios puso, no dónde quedó parada.
      return mover(w, { x: 0, y: 0 })
    }
    const uno = recorrer([C, B])
    const dos = recorrer([B, C])
    const inv = (w: WorldState): readonly string[] =>
      sueltasDe(w)
        .map((id) => {
          const c = w.bodies.get(id) as WorldBody
          return `${id}@${String(c.at.x)},${String(c.at.y)}`
        })
        .sort()
    console.log(
      `\n─── DOS ÓRDENES, DOS MUNDOS ───\n` +
        `  B=${JSON.stringify(B)} (la celda de suelta:${String(CX)}:${String(CY)}:0) · C=${JSON.stringify(C)}\n` +
        `  mismos chunks abiertos: ${String(
          JSON.stringify(uno.dios?.sembrados) === JSON.stringify(dos.dios?.sembrados),
        )} (${String((uno.dios?.sembrados ?? []).length)}/${String((dos.dios?.sembrados ?? []).length)})\n` +
        `  sueltas ${String(inv(uno).length)} / ${String(inv(dos).length)}\n` +
        `  sólo en [C,B]: ${inv(uno).filter((x) => !inv(dos).includes(x)).join(' | ')}\n` +
        `  sólo en [B,C]: ${inv(dos).filter((x) => !inv(uno).includes(x)).join(' | ')}\n` +
        `  hash [C,B] ${hashWorld(worldSlots(uno))} · hash [B,C] ${hashWorld(worldSlots(dos))}\n`,
    )
    // Las dos mitades del criterio. La primera pasa —los dos órdenes abren los
    // mismos chunks— y la que falla es la segunda, que es la que está publicada.
    expect(uno.dios?.sembrados).toEqual(dos.dios?.sembrados)
    expect(hashWorld(worldSlots(uno))).toBe(hashWorld(worldSlots(dos)))
  })

  it('LA VERSIÓN MÍNIMA, DADA VUELTA: la celda NO depende de quién estaba, y el que estaba se corre', () => {
    // El mismo mecanismo mínimo del hallazgo, medido después de la reparación y
    // sin sacarle ningún caso: la misma escena, las mismas dos posiciones de la
    // criatura, y las mismas dos preguntas. Lo que cambió es la respuesta de la
    // segunda.
    //
    //   ANTES  el decreto decía {10,15}; con la criatura lejos la suelta salía en
    //          {10,15} y con la criatura ahí en {11,15} — o sea, el mundo decidía.
    //   HOY    sale en {10,15} las dos veces, y en la segunda **la criatura es la
    //          que se movió**.
    //
    // La tercera aserción es la que hace que esto no sea media medida: si la
    // criatura se quedara donde estaba, el mundo tendría dos sólidos en una celda
    // y habríamos cambiado un hallazgo por otro peor.
    const e0 = escena()
    const s0 = decretoDe(e0.dios, e0.phys, 0, 0).chunk.sueltas[0] as { i: number }
    const suCelda: Placement = { x: s0.i % 16, y: Math.floor(s0.i / 16) }
    const lejos: Placement = { x: (suCelda.x + 5) % 16, y: (suCelda.y + 5) % 16 }
    const conLaCriaturaEn = (p: Placement): { suelta: Placement; criatura: Placement; w: WorldState } => {
      const w = stepWorld(escena({ desde: p }).state, []).state
      return { suelta: (w.bodies.get(idDeSuelta(0, 0, 0)) as WorldBody).at, criatura: donde(w), w }
    }
    const sinNadie = conLaCriaturaEn(lejos)
    const conAlguien = conLaCriaturaEn(suCelda)
    console.log(
      `\n─── LA CELDA QUE YA NO DEPENDE DE QUIÉN ESTABA ───\n` +
        `  el decreto dice ${JSON.stringify(suCelda)}\n` +
        `  con la criatura lejos → suelta ${JSON.stringify(sinNadie.suelta)} · criatura ${JSON.stringify(sinNadie.criatura)}\n` +
        `  con la criatura ahí   → suelta ${JSON.stringify(conAlguien.suelta)} · criatura ${JSON.stringify(conAlguien.criatura)}\n`,
    )
    expect(sinNadie.suelta).toEqual(suCelda)
    expect(conAlguien.suelta).toEqual(suCelda)
    // El que estaba se corrió, a una celda pegada y no a cualquier lado.
    expect(conAlguien.criatura).not.toEqual(suCelda)
    expect(
      Math.max(
        Math.abs(conAlguien.criatura.x - suCelda.x),
        Math.abs(conAlguien.criatura.y - suCelda.y),
      ),
    ).toBe(1)
    expect(revisarEstado(conAlguien.w).filter((v) => v.k === 'solidos-solapados')).toEqual([])
  })

  it('lo que SÍ aguanta: el orden de las intenciones no decide nada', () => {
    // El control negativo del bloque. Lo que se ataca acá es lo otro: que el
    // resultado no dependa de en qué ORDEN vino el arreglo de intenciones, que es
    // el orden en que contestaron las mentes y no puede decidir nada del mundo.
    const dos = (invertido: boolean): WorldState => {
      const e = escena()
      const conDos: WorldState = {
        ...e.state,
        bodies: mapaDeCuerpos([
          ...e.state.bodies.values(),
          {
            body: {
              id: 'a1-cuerpo',
              form: 'bloque',
              parts: [{ substance: 'carne', mass: 2, q: {} }],
              joints: [],
              state: { temperature: T_AMBIENTE, stamina: HAMBRE_QUE_NO_ESTORBA },
            },
            at: { x: 1, y: 0 },
          },
        ]),
        actors: mapaDeActores([
          { id: 'a0', body: 'a0-cuerpo', holding: [], capacity: 6, permits: 'irreversible' },
          { id: 'a1', body: 'a1-cuerpo', holding: [], capacity: 6, permits: 'irreversible' },
        ]),
      }
      let w = conDos
      for (let t = 0; t < 120; t++) {
        const p = (w.bodies.get('a0-cuerpo') as WorldBody).at
        const q = (w.bodies.get('a1-cuerpo') as WorldBody).at
        const is = [
          goTo({ by: 'a0', seq: t }, { x: p.x + 64, y: p.y + (DESVIO[t % 3] as number) }, 0),
          goTo({ by: 'a1', seq: t }, { x: q.x - 64, y: q.y + (DESVIO[t % 3] as number) }, 0),
        ]
        w = stepWorld(w, invertido ? [...is].reverse() : is).state
      }
      return w
    }
    expect(hashWorld(worldSlots(dos(false)))).toBe(hashWorld(worldSlots(dos(true))))
  }, 60_000)
})

// ═══ (3) LA CELDA OCUPADA ════════════════════════════════════════════════════

describe('(3) la celda ocupada: cuántas violaciones aparecen de verdad', () => {
  it('CERRADO · `solidos-solapados` en 0 de 20 semillas: la celda del pozo la reserva el decreto', () => {
    // ─── CÓMO SE CERRÓ ──────────────────────────────────────────────────────
    //
    // No se le enseñó al banco a esquivar: se le enseñó a las SUELTAS que esa
    // celda ya es de alguien. `abrirChunk` arranca su conjunto de celdas tomadas
    // con `dec.pozo.at`, así que ninguna suelta la elige y el banco puede seguir
    // entrando con `ponerCuerpo` sin preguntarle a `estorbo` —que es lo que tiene
    // que hacer, porque su lugar lo fija el decreto y su masa se reescribe todos
    // los ticks desde el `Stock`—.
    //
    // El comentario que el adversario citó sigue siendo cierto y por eso no se
    // tocó el orden: invertir suelta/pozo cambiaba de víctima, no de problema.
    // Las dos violaciones medidas eran `pozo:6:0` con `suelta:6:0:3` en la semilla
    // 20260740 y `pozo:7:1` con `suelta:7:1:4` (× 2) en la 20260747.

    // ─── QUÉ SE VERIFICA ACÁ Y POR QUÉ NO ALCANZA LO QUE YA HABÍA ───────────
    //
    // `las-sueltas-se-materializan.test.ts` tiene dos tests de esto y los dos
    // pasan: «ni un `solidos-solapados` en 9 chunks abiertos de golpe» y «tampoco
    // caminando 300 ticks». Los dos corren sobre UNA semilla —`20260728n`— y el
    // título del bloque dice «el mundo no apila». Sobre veinte semillas no es
    // cierto, y la violación no es entre dos sueltas: es entre el BANCO DE PECES y
    // una suelta, porque `materializarLoDecretado` pone el banco en `pozo.at` con
    // `ponerCuerpo`, que no le pregunta a `estorbo`.
    //
    // MEDIDO, semillas `20260728n + n` para n en 0..19, 120 ticks de caminata cada
    // una (el arnés del juez usa otra lista y llega al mismo 2 de 20 desde otro
    // lado, con su `it.fails` en `emergencia/tests/hito-5-la-emergencia.test.ts`):
    //
    //     2 / 20 semillas con violación
    //     20260740 · pozo:6:0 y suelta:6:0:3 en (98,0)
    //     20260747 · pozo:7:1 y suelta:7:1:4 en (122,16)   (2 violaciones)
    //
    // El orden de `materializarLoDecretado` —las sueltas ANTES del pozo— no es el
    // culpable ni la cura, y el comentario de ahí lo dice bien: invertirlo cambia de
    // víctima, no de problema. Lo que falta es una decisión sobre qué hace el mundo
    // cuando el dios decreta dos cosas en la misma celda y una de las dos es una
    // proyección que se reescribe todos los ticks.
    //
    // El testigo vive acá además de en el juez porque el juez lo mide con la escena
    // de la emergencia y este paquete es el dueño del invariante. Y se barren VEINTE
    // semillas y no una, que es la otra mitad del hallazgo: sobre una sola semilla
    // el bloque (4) de `las-sueltas-se-materializan.test.ts` decía «el mundo no
    // apila» y sobre veinte no era cierto.
    const filas: string[] = []
    let malas = 0
    for (let n = 0; n < 20; n++) {
      const e = escena({ semilla: BigInt(20260728 + n) })
      const w = caminar(e.state, 120)
      const v = revisarEstado(w).filter((x) => x.k === 'solidos-solapados')
      if (v.length > 0) {
        malas += 1
        filas.push(`  ${String(20260728 + n)} · ${String(v.length)} · ${JSON.stringify(v[0])}`)
      }
    }
    console.log(`\n─── SOLAPADOS SOBRE VEINTE SEMILLAS ───\n  ${String(malas)}/20\n${filas.join('\n')}\n`)
    expect(malas).toBe(0)
  }, 120_000)

  it('CERRADO · la suelta que no encuentra hueco se pierde, Y AHORA EL MUNDO LO NARRA', () => {
    // ─── EL RESIDUO QUE `abrirChunk` DECLARA, ATACADO POR SU LADO CIEGO ─────
    //
    // El encabezado de `abrirChunk` dice, y está bien dicho: «si los nueve rumbos
    // están ocupados, la suelta NO ENTRA y el chunk queda anotado igual, o sea que
    // no vuelve. Sobre las veinte partidas del banco son 3 de 2280, el 0,13%».
    //
    // Lo que no dice es lo que este test mide: **no se emite un solo evento**. El
    // tick en el que el mundo se traga una pieza decretada narra `["gasto"]` y nada
    // más. O sea que:
    //
    //   · la crónica no lo tiene, y `Partida` lee la crónica;
    //   · `revisarEstado` no lo puede ver —no hay nada roto, hay algo que falta—;
    //   · y el 0,13% es un número que sólo se puede conseguir comparando contra el
    //     decreto desde AFUERA, que es lo que ese banco hace a mano.
    //
    // Es la única puerta por la que el mundo pierde materia decretada en silencio, y
    // la diferencia con «descartar la segunda» —la opción (2) que `abrirChunk`
    // rechaza por ser mala para el diagnóstico— es sólo la frecuencia: las dos son
    // invisibles.
    //
    // ─── CÓMO SE CERRÓ, Y LO QUE NO CAMBIÓ ──────────────────────────────────
    //
    // La pérdida SIGUE EXISTIENDO y este test la sigue afirmando: hace falta un
    // racimo de sólidos tan denso que ni el que estaba parado ahí tenga a dónde
    // irse, y en ese caso la suelta no entra. Lo que se agregó es el evento
    // `perdida`, con el id y el chunk. La diferencia práctica es entera: antes el
    // tick narraba `["gasto"]` y el 0,13% sólo se conseguía comparando contra el
    // decreto desde afuera; ahora la crónica lo dice, y `Partida` lee la crónica.
    //
    // MEDIDO acá: un muro de 9 piedras —las ocho de alrededor **y la de la celda
    // decretada**, que después de la reparación hace falta porque si esa celda
    // estuviera libre la suelta entraría ahí— y la suelta no entra.
    const e = escena()
    const s0 = decretoDe(e.dios, e.phys, 0, 0).chunk.sueltas[0] as { i: number }
    const c: Placement = { x: s0.i % 16, y: Math.floor(s0.i / 16) }
    const muro: WorldBody[] = []
    let n = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        // Las NUEVE, la del centro incluida. El renglón que había acá salteaba
        // `p.x === 0 && p.y === 0`, que es el origen DEL MUNDO y no el centro del
        // muro: con `c = {10,15}` no salteaba ninguna, así que el muro siempre fue
        // de nueve y el comentario decía ocho. Ahora está escrito lo que hace, y
        // hace falta que sean nueve: con la celda decretada libre, la reparación
        // pone la suelta ahí y no hay pérdida que medir.
        const p = { x: c.x + dx, y: c.y + dy }
        muro.push({
          body: {
            id: `muro-${String(n++)}`,
            form: 'bloque',
            parts: [{ substance: 'piedra', mass: 5, q: {} }],
            joints: [],
            state: { temperature: T_AMBIENTE },
          },
          at: p,
        })
      }
    }
    const r = stepWorld(
      { ...e.state, bodies: mapaDeCuerpos([...e.state.bodies.values(), ...muro]) },
      [],
    )
    const perdida = idDeSuelta(0, 0, 0)
    console.log(
      `\n─── LA QUE NO ENTRA ───\n` +
        `  celda decretada ${JSON.stringify(c)} · muro de ${String(muro.length)}\n` +
        `  ¿entró?: ${String(r.state.bodies.has(perdida))} · ` +
        `chunk marcado: ${String((r.state.dios?.sembrados ?? []).includes(chunkKey(0, 0)))}\n` +
        `  eventos del tick: ${JSON.stringify(r.events.map((x) => x.k))}\n`,
    )
    expect(r.state.bodies.has(perdida)).toBe(false)
    // LO QUE ERA EL HALLAZGO: que algo lo cuente. Ahora hay un `SimEvent`.
    expect(r.events.some((x) => JSON.stringify(x).includes(perdida))).toBe(true)
    // Y dicho fino, para que no lo cierre cualquier evento que mencione el id:
    expect(r.events).toContainEqual({ k: 'perdida', id: perdida, en: chunkKey(0, 0) })
    // No lleva firma, porque no le contesta a nadie: el chunk se abre antes de que
    // se despache una sola intención. Ver `SIN_FIRMA` en `world/src/step.ts`.
    expect(r.events.filter((x) => x.k === 'perdida').every((x) => !('by' in x))).toBe(true)
  })

  it('la que choca contra un cuerpo cualquiera ENTRA DONDE EL DIOS DIJO, y el cuerpo se corre', () => {
    // La decisión (4) de `abrirChunk` en el caso normal, y hay que decirla con el
    // mismo cuidado con el que se dice lo que falla. Antes de la reparación este
    // test afirmaba lo contrario —`nacida.at` NO era la celda decretada— porque la
    // que se corría era la suelta; ahora se corre la piedra. Las otras dos
    // aserciones no se movieron: no se apila nada y el invariante queda limpio.
    const e = escena()
    const s0 = decretoDe(e.dios, e.phys, 0, 0).chunk.sueltas[0] as { i: number }
    const c: Placement = { x: s0.i % 16, y: Math.floor(s0.i / 16) }
    const r = stepWorld(
      {
        ...e.state,
        bodies: mapaDeCuerpos([
          ...e.state.bodies.values(),
          {
            body: {
              id: 'piedra-plantada',
              form: 'bloque',
              parts: [{ substance: 'piedra', mass: 5, q: {} }],
              joints: [],
              state: { temperature: T_AMBIENTE },
            },
            at: c,
          },
        ]),
      },
      [],
    )
    const nacida = r.state.bodies.get(idDeSuelta(0, 0, 0)) as WorldBody
    const piedra = r.state.bodies.get('piedra-plantada') as WorldBody
    expect(nacida).toBeDefined()
    expect(nacida.at).toEqual(c)
    expect(piedra.at).not.toEqual(c)
    expect(Math.max(Math.abs(piedra.at.x - c.x), Math.abs(piedra.at.y - c.y))).toBe(1)
    expect(nacida.supportedBy).toBeUndefined()
    expect(revisarEstado(r.state).filter((v) => v.k === 'solidos-solapados')).toEqual([])
  })
})

// ═══ (4) EL COSTO ════════════════════════════════════════════════════════════

describe('(4) el costo: lo que la tabla del otro archivo mide y lo que no concluye', () => {
  it('LA CURVA, y la consecuencia sobre `ticksPerdidos` que nadie sacó', () => {
    // ═══ LO QUE YA ESTABA MEDIDO Y SE VERIFICA ══════════════════════════════
    //
    // `las-sueltas-se-materializan.test.ts` publica la tabla y la publica bien: una
    // criatura caminando derecho deja 4493 cuerpos a los 2000 ticks y 23.472 a los
    // 10.000, con 7,550 y 74,064 ms/tick. Corrido acá de nuevo, en otra máquina y
    // con otro arnés, el orden de magnitud coincide (abajo).
    //
    // ═══ Y LA CONSECUENCIA QUE ESA TABLA NO SACA ════════════════════════════
    //
    // La tabla concluye sobre el criterio (3) del Hito 5 —el p99 del tick con 5000
    // cuerpos, que ya estaba ACEPTADO fallando por 6,8×— y dice «17,5× el techo».
    // Pero hay un segundo criterio del Hito 5 que esos mismos números tocan y que
    // hoy está reportado como **CUMPLE**: `ticksPerdidos === 0`.
    //
    // La ventana de un tick es `1000 / hz` (`perceive/src/bucle.ts:533`), y con
    // `HZ_DE_REFERENCIA = 20` son **50 ms**. Los dos relojes, el del otro archivo y
    // el mío con `ANIMA_BANCO=1` en esta misma máquina —los CONTEOS coinciden al
    // cuerpo, así que lo único que difiere es el reloj—:
    //
    //     tick      cuerpos    allá        acá
    //      2.000      4.493    7,550 ms    8,23 ms
    //      5.000     11.541   28,019 ms   21,37 ms
    //     10.000     23.353   74,064 ms      —
    //
    // Con el reloj de allá la ventana se cruza antes de los 10.000; con el mío, a
    // ~1,85 µs por cuerpo, se cruza en ~27.000 cuerpos, o sea alrededor del tick
    // 12.000. **Las dos caen adentro de los 20.000 del criterio**, que es lo único
    // que hay que sostener acá: el número exacto depende de la máquina y la
    // conclusión no.
    //
    // O sea que una criatura que camine pierde ticks antes de los 20.000, y el 0 que
    // el traspaso reporta para el criterio (4) se midió sobre una partida que **no
    // camina**: la del criterio muere en el tick 3743, y el DIAGNÓSTICO 11 del
    // propio tramo mostró que hasta hace dos días se pasaba la vida despegando el
    // mismo `ir` sin moverse. Un contador que nadie pudo hacer subir es un cero que
    // no dice nada —lo dice el encabezado de `bucle.ts`, sobre este mismo contador—.
    //
    // No se cambia ningún criterio acá: se deja el número al lado del otro para que
    // la próxima vez que se reporte «(4) CUMPLE» se reporte con la condición puesta.
    //
    // ─── QUÉ SE AFIRMA Y QUÉ SE IMPRIME ────────────────────────────────────
    //
    // Se AFIRMA el mecanismo, que es lo que no depende del reloj: la población crece
    // con lo caminado, nunca baja, y **ningún cuerpo se retira jamás** —no hay
    // desmaterialización de chunks lejanos—. Se IMPRIME el reloj. Un test de
    // rendimiento adentro de la suite normal es flaky y un test flaky enseña a
    // ignorar el rojo.
    const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'
    const hitos = MIDIENDO_EN_SERIO ? ([250, 500, 1000, 2000, 5000] as const) : ([250, 500, 1000] as const)
    const filas: string[] = []
    const medido: { ticks: number; cuerpos: number; chunks: number; ms: number }[] = []
    let w = escena().state
    let t = 0
    let anterior = 0
    let minimoDesdeElPico = Number.POSITIVE_INFINITY
    let pico = 0
    for (const hasta of hitos) {
      const t0 = performance.now()
      for (; t < hasta; t++) {
        const at = donde(w)
        w = stepWorld(w, [
          goTo({ by: 'a0', seq: t }, { x: at.x + 64, y: at.y + (DESVIO[t % 3] as number) }, 0),
        ]).state
        // El mecanismo: la población NUNCA baja. Un solo tick que la baje sería una
        // desmaterialización, y no existe ninguna.
        if (w.bodies.size > pico) pico = w.bodies.size
        if (w.bodies.size < minimoDesdeElPico) minimoDesdeElPico = w.bodies.size
        if (w.bodies.size < pico) minimoDesdeElPico = w.bodies.size
      }
      const ms = (performance.now() - t0) / (hasta - anterior)
      anterior = hasta
      medido.push({ ticks: hasta, cuerpos: w.bodies.size, chunks: (w.dios?.sembrados ?? []).length, ms })
      filas.push(
        `  tick ${String(hasta).padStart(5)} · cuerpos ${String(w.bodies.size).padStart(6)} · ` +
          `chunks ${String((w.dios?.sembrados ?? []).length).padStart(4)} · ${ms.toFixed(2)} ms/tick`,
      )
    }
    const primero = medido[0] as { cuerpos: number; chunks: number }
    const ultimo = medido[medido.length - 1] as { cuerpos: number; chunks: number; ms: number }
    console.log(
      `\n─── LA CURVA, REMEDIDA POR EL ADVERSARIO ───\n${filas.join('\n')}\n` +
        `  la ventana de un tick es 1000/${String(HZ_DE_REFERENCIA)} = ${String(1000 / HZ_DE_REFERENCIA)} ms\n` +
        `  cuerpos retirados en todo el barrido: ${String(pico - ultimo.cuerpos > 0 ? pico - ultimo.cuerpos : 0)}\n` +
        `${MIDIENDO_EN_SERIO ? '' : '  (ANIMA_BANCO=1 para llegar a los 5000 ticks)\n'}`,
    )
    // EL MECANISMO, sin reloj:
    expect(ultimo.chunks).toBeGreaterThan(primero.chunks)
    expect(ultimo.cuerpos).toBeGreaterThan(primero.cuerpos)
    // …y nada se retira nunca: el pico es el final.
    expect(ultimo.cuerpos).toBe(pico)
    // …y crece LINEAL con lo caminado y no cuadrático. La cota es floja a
    // propósito —un cuarto de chunk por tick— porque el caminante se desvía en `y`
    // para rodear (ver `DESVIO`) y abre alguna fila de más: medido, 201 chunks en
    // 1000 ticks contra los 189 que darían tres cada dieciséis celdas en línea
    // recta. Lo que la cota descarta es lo que importa: si el mundo abriera los
    // NUEVE chunks de la vecindad cada vez, serían ~570.
    const ticks = medido[medido.length - 1]?.ticks ?? 0
    expect(ultimo.chunks).toBeLessThanOrEqual(Math.ceil(ticks / 4) + 9)
  }, 300_000)
})

// ═══ (5) LO QUE ATAQUÉ Y NO CEDIÓ, Y EL NÚMERO MÍO QUE SALIÓ MAL ═════════════

describe('(5) los ataques que rebotaron, escritos igual', () => {
  it('EL NÚMERO MÍO QUE SALIÓ MAL: el control que casi me hace publicar una mentira', () => {
    // ─── LA HISTORIA, PORQUE LA REGLA DE LA CASA ES ESCRIBIRLA ──────────────
    //
    // `revisarConservacion` compara dos estados y acusa `conservada-aumento` cuando
    // una cuenta conservada sube sin un evento `convierte` que la respalde.
    // Materializar un chunk sube `mass`, `nutrition` y `fuelEnergy` de la nada, así
    // que el guardián acusa. Medido: **96 violaciones en 400 ticks de caminata**, o
    // sea 32 aperturas de chunk × las 3 cuentas.
    //
    // Eso ya está anotado y con su `it.fails`: `perceive/src/bucle.ts` lo dice en el
    // campo `vigilar` («los tres caminos por los que el dios materializa materia no
    // emiten ningún evento que `acreditado()` sepa leer») y el hueco vive en
    // `perceive/tests/ataque-a-la-costura.test.ts:1410`.
    //
    // Mi primer control fue: pre-marcar todos los chunks en `sembrados` para que las
    // sueltas no entren, y contar. Dio **0 violaciones**, y con ese número la
    // conclusión salía sola y era jugosa: «el pozo no rompe la conservación; la
    // rompieron las sueltas del tramo K». **Era falsa.** El control caminaba hacia el
    // ESTE, y hacia el este esa semilla no tiene un solo pozo en 200 ticks: el
    // control medía cero porque no había qué medir, no porque el pozo fuera inocente.
    //
    // Con el rumbo cambiado al NORTE, el mismo control encuentra un pozo y acusa
    // igual —`mass 2 → 3,475` en el tick en que el banco aparece—: **21 violaciones
    // en 400 ticks contra las 96 del otro rumbo**. El pozo rompe la conservación
    // exactamente igual que una suelta, y el hueco es de antes del tramo K.
    //
    // (Y hubo un SEGUNDO número mío mal en el camino, por si la regla no quedó
    // clara: la primera versión de `caminar` no le pasaba los eventos del tick a
    // `revisarInvariantes`, así que el guardián no veía el `gasto` de stamina que el
    // paso declara y acusaba `conservada-evaporada` en cada celda caminada — 496 y
    // 421 «violaciones» en vez de 96 y 21. Mismo error que el control: esconderle
    // media entrada al que juzga.)
    //
    // → REGLA, para la sección 5 del traspaso: **un control que da cero hay que
    //   probarlo primero contra el caso positivo.** Un control que no puede fallar no
    //   es un control, es un cero.
    //
    // Lo que el tramo K sí cambió, y es lo único honesto que queda del ataque: la
    // FRECUENCIA. Antes el guardián acusaba cuando aparecía o se reponía un pozo;
    // ahora acusa en cada chunk que se abre.
    //
    // ─── Y ACÁ ESTÁ LA REPARACIÓN, MEDIDA CON EL MISMO ARNÉS ────────────────
    //
    // El evento `decreta` de `world/src/step.ts` declara, por tick y por cuenta
    // conservada, cuánto puso el dios; `revisarConservacion` lo suma al techo. Las
    // 96 y las 21 pasaron a **0 y 0**, sin tocar el arnés ni una línea.
    //
    // Y el cero se prueba, porque la regla de arriba es mía y vale para mí: la
    // tercera y la cuarta columna corren LO MISMO tapándole al guardián los
    // eventos `decreta`, o sea el mundo reparado juzgado con el guardián viejo.
    // Ahí vuelven a salir las 96 y las 21. **Un control que no puede fallar no es
    // un control**: éste puede, y las dos veces que lo hace son exactamente las
    // dos que el hallazgo describía.
    const conta = (
      rumbo: 'este' | 'norte',
      o: { sembrados?: readonly number[]; sinDecreto?: boolean } = {},
    ): { v: number; pozos: number; sueltas: number; primera: string } => {
      const e = escena(o.sembrados === undefined ? {} : { sembrados: o.sembrados })
      let v = 0
      let primera = '—'
      const w = caminar(e.state, 400, rumbo, (antes, d, ev) => {
        // Taparle `decreta` al guardián es EXACTAMENTE el mundo de antes de la
        // reparación: el mismo estado, los mismos cuerpos, y la sexta pregunta sin
        // con qué explicar de dónde salieron.
        const vistos = o.sinDecreto === true ? ev.filter((x) => x.k !== 'decreta') : ev
        for (const x of revisarInvariantes(antes, d, vistos)) {
          v += 1
          if (primera === '—') primera = JSON.stringify(x)
        }
      })
      return { v, pozos: pozosDe(w).length, sueltas: sueltasDe(w).length, primera }
    }
    const conSueltas = conta('este')
    const soloPozo = conta('norte', { sembrados: todosLosChunks(20) })
    const ciegoSueltas = conta('este', { sinDecreto: true })
    const ciegoPozo = conta('norte', { sembrados: todosLosChunks(20), sinDecreto: true })
    console.log(
      `\n─── EL CONTROL QUE ESTABA MAL, Y LA REPARACIÓN ───\n` +
        `  caminando al ESTE, con sueltas: ${String(conSueltas.v)} violaciones · ` +
        `pozos ${String(conSueltas.pozos)} · sueltas ${String(conSueltas.sueltas)}\n` +
        `    ${conSueltas.primera}\n` +
        `  al NORTE, chunks pre-marcados (sólo el pozo materializa en el radio): ` +
        `${String(soloPozo.v)} violaciones · pozos ${String(soloPozo.pozos)}\n` +
        `    ${soloPozo.primera}\n` +
        `  ── el mismo mundo, con el guardián CIEGO a \`decreta\` (o sea, el de antes) ──\n` +
        `  al ESTE  ${String(ciegoSueltas.v)} violaciones\n` +
        `    ${ciegoSueltas.primera}\n` +
        `  al NORTE ${String(ciegoPozo.v)} violaciones\n` +
        `    ${ciegoPozo.primera}\n`,
    )
    // LO QUE SE REPARÓ: ni una violación por ninguno de los dos caminos.
    expect(conSueltas.v).toBe(0)
    expect(soloPozo.v).toBe(0)
    // Y las dos mitades del hallazgo original, que siguen siendo ciertas del
    // guardián viejo: las sueltas acusaban…
    expect(ciegoSueltas.v).toBeGreaterThan(0)
    // …y el pozo TAMBIÉN, que es lo que el control malo escondía.
    expect(soloPozo.pozos).toBeGreaterThan(0)
    expect(ciegoPozo.v).toBeGreaterThan(0)
  }, 240_000)

  it('EL TECHO CALÓRICO NO SE ROMPE: el piso regala el 0,05% del presupuesto del chunk', () => {
    // ─── EL ATAQUE, Y POR QUÉ PARECÍA BUENO ────────────────────────────────
    //
    // El riesgo 4 del documento de arquitectura es «el oráculo puede sembrar peces
    // → fuente infinita de comida siempre que pueda caminar hasta el chunk
    // siguiente», y `oracle/src/presupuesto.ts` existe entero para taparlo: lo que
    // sale de un pozo se COBRA contra el techo calórico del chunk.
    //
    // `abrirChunk` no cobra nada, y lo que siembra incluye comida de verdad: sobre
    // el chunk (0,0) de esta semilla, `[["tuberculo",2],["grano",4],["raiz",3],
    // ["hoja",1]]`, y `grano` trae `nutrition` 13. O sea que el tramo K abrió una
    // segunda canilla de calorías que el libro no ve, por la misma puerta que el
    // riesgo 4 describe: caminar al chunk siguiente.
    //
    // ─── Y EL NÚMERO LO DESARMA ────────────────────────────────────────────
    //
    // Las masas sembradas son diminutas —`grano` entre 10 y 150 gramos, con
    // `digestibility` 0,15— contra techos de cientos de miles de milicalorías. El
    // ataque no se sostiene y se escribe igual, medido, para que nadie lo tenga que
    // volver a intentar. Si mañana un bioma siembra algo gordo, este test lo dice.
    const e = escena()
    const w = caminar(e.state, 3)
    let regalado = 0
    let techo = 0
    for (const k of w.dios?.sembrados ?? []) {
      const { cx, cy } = chunkFromKey(k)
      const dec = decretoDe(e.dios, e.phys, cx, cy)
      for (const s of dec.chunk.sueltas) regalado += milicaloriasDe(s.substance, s.masa, e.phys)
      techo += dec.chunk.presupuestoCalorico * 1000
    }
    console.log(
      `\n─── EL TECHO CALÓRICO ───\n` +
        `  chunks abiertos ${String((w.dios?.sembrados ?? []).length)}\n` +
        `  milicalorías que el piso regala sin cobrar: ${String(regalado)}\n` +
        `  techo sumado de esos chunks:               ${String(techo)}\n` +
        `  razón: ${((100 * regalado) / techo).toFixed(3)}%\n`,
    )
    expect(regalado).toBeGreaterThan(0)
    // El umbral es holgado a propósito: lo que se vigila es el ORDEN DE MAGNITUD.
    expect(regalado / techo).toBeLessThan(0.01)
  })

  it('LA MINA QUE SIGUE PUESTA: `decretoDe` memoiza sin la semilla', () => {
    // Hasta el tramo K, dos dioses que compartieran un `Physics` compartían el pozo.
    // Ahora comparten el PISO ENTERO, que es todo lo que la criatura tiene para
    // trabajar. Ningún arnés de hoy lo pisa —el juez arma `nuevaFisica()` por
    // semilla y `mind/tests/mundo.ts` sólo usa una— así que no es un hallazgo del
    // tramo: es una mina que este tramo hizo mucho más grande.
    const phys = buildSeedPhysics()
    const a = decretoDe(crearDios(1n), phys, 0, 0)
    const b = decretoDe(crearDios(999n), phys, 0, 0)
    console.log(
      `\n─── DOS DIOSES, UNA FÍSICA ───\n` +
        `  ¿el mismo objeto de decreto?: ${String(a === b)}\n` +
        `  sueltas: ${String(a.chunk.sueltas.length)} y ${String(b.chunk.sueltas.length)}\n`,
    )
    // Se afirma el HECHO, no el deseo: si mañana alguien mete la semilla en la
    // clave, este test se pone rojo y hay que borrarlo con una sonrisa.
    expect(a).toBe(b)
  })
})
