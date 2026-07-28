// ─── EL HITO 5, TRAMO B: EL MUNDO TIENE AGUA, PECES Y LIBRO CALÓRICO ─────────
//
// El primer criterio del Hito 5, con el proveedor APAGADO, dice:
//
//   «con hambre y un río a la vista, la criatura deshilacha un matorral, ata una
//    vara, va y pesca. Sin una sola llamada al modelo.»
//
// Este archivo no cubre ese criterio: cubre **la mitad del mundo que hacía falta
// para poder escribirlo**. Antes de este frente, el mundo y el dios no se
// conocían: `grep -rln "@anima/oracle" packages/world/src` daba cero, no había un
// solo `rng` en el paso, nadie decretaba un `Stock`, y había DOS extracciones de
// las cuales sólo una cobraba —la del dios, que en la partida no recorría nadie—.
//
// ─── LOS CUATRO CRITERIOS, ESCRITOS ANTES DE IMPLEMENTAR ────────────────────
//
//   (a) **Una criatura parada en una orilla, con una caña, saca un pez.** De
//       punta a punta, con el mundo real y sin mocks.
//   (b) **El río se agota y se repone**, medido en SEGUNDOS DE MUNDO, y el chunk
//       no pasa su techo calórico. Es el criterio (e) del Hito 3, ahora sobre la
//       partida y no sobre el arnés del dios.
//   (c) **El anzuelo rinde más que la caña pelada**, con el número: dos aparejos
//       con `catch` distinto sobre el mismo pozo y la misma semilla.
//   (d) **El determinismo no se rompe**: dos mundos gemelos con el dado del mundo
//       adentro dan el mismo `hashWorldState`, y el replay del journal reconstruye
//       el estado exacto.
//
// Lo que MIDIÓ cada uno está en el cuerpo de cada bloque, con el número. Y donde
// la frase original no sobrevivió al contacto con los números —el criterio (b)—
// está dicho arriba del test y no escondido en un `expect` más flojo.

import { describe, expect, it } from 'vitest'

import {
  buildSeedPhysics,
  HZ_DE_REFERENCIA,
  qualityOf,
  seg,
  unir,
  type Body,
  type Physics,
} from '@anima/physics'
import {
  LibroCalorico,
  milicaloriasDe,
  population,
  presupuestoCaloricoDeChunk,
  probabilidadDePicar,
  type Stock,
} from '@anima/oracle'

import { crearDios, decretoDe, idDePozo, type EstadoDelDios } from '../src/dios.js'
import { hashWorldState, pasoDelMundo, restoreWorld, worldSlots } from '../src/mundo.js'
import { createJournal, replay } from '../src/journal.js'
import { apply, type Intent, type Placement } from '../src/intent.js'
import { keyOfCell } from '../src/cell.js'
import { desenlaceDe, mapaDeActores, mapaDeCuerpos, shelteredDe, stepWorld, type WorldState } from '../src/step.js'
import { segundosDe } from '../src/reloj.js'
import { actor, criatura, enLaMano, huella } from './mundo-minimo.js'

// ─── El banco de pruebas ─────────────────────────────────────────────────────

const SEMILLA = 20260727n
const PHYS: Physics = buildSeedPhysics()

/**
 * Los dos aparejos, y la única diferencia entre ellos es una lasca de pedernal.
 *
 * `catch = freeStrandEnds · (0.15 + max(sharpness) · 0.5)` — la fórmula está en
 * `quality.ts` y no acá. La caña pelada es una vara de madera con una liana atada
 * de un lado (`union` sin el rol opcional `b`, que es lo que deja la punta
 * suelta); el anzuelo es la misma caña con una lasca de pedernal en la vara.
 * Nadie escribió «anzuelo»: lo que sube el `catch` es el filo del pedernal.
 */
function aparejos(): { readonly pelada: Body; readonly anzuelo: Body } {
  const vara: Body = {
    id: 'vara',
    form: 'vara',
    parts: [{ substance: 'madera', mass: 1, q: {} }],
    joints: [],
    state: {},
  }
  const conFilo: Body = {
    id: 'vara-con-filo',
    form: 'vara',
    parts: [
      { substance: 'madera', mass: 1, q: {} },
      { substance: 'pedernal', mass: 0.1, q: {} },
    ],
    joints: [{ a: 0, b: 1, via: 'liana', strength: 1 }],
    state: {},
  }
  const hebra = (id: string): Body => ({
    id,
    form: 'hebra',
    parts: [{ substance: 'liana', mass: 0.2, q: {} }],
    joints: [],
    state: {},
  })
  const pelada = unir(vara, undefined, hebra('h1'), PHYS, 'cana')
  const anzuelo = unir(conFilo, undefined, hebra('h2'), PHYS, 'cana')
  if (pelada === undefined || anzuelo === undefined) throw new Error('no se pudo atar la caña')
  return { pelada, anzuelo }
}

interface Orilla {
  readonly dios: EstadoDelDios
  readonly cx: number
  readonly cy: number
  /** La celda mojada donde el dios puso el banco. */
  readonly pozo: Placement
  /** Una celda seca pegada al pozo: desde acá se pesca. */
  readonly parada: Placement
  readonly stock: Stock
}

/**
 * Una orilla de verdad de la semilla, buscada y no inventada.
 *
 * Barre chunks en orden canónico hasta encontrar uno con pozo y con una celda
 * SECA pegada al pozo. La celda seca puede ser del chunk vecino y eso es el caso
 * normal, no el raro: el 88,8% de los chunks de `agua-dulce` está enteramente
 * inundado.
 */
function buscarOrilla(dios: EstadoDelDios): Orilla {
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      const dec = decretoDe(dios, PHYS, cx, cy)
      if (dec.pozo === undefined) continue
      const p = dec.pozo.at
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const parada = { x: p.x + dx, y: p.y + dy }
        const vecino = decretoDe(dios, PHYS, Math.floor(parada.x / 16), Math.floor(parada.y / 16))
        const i = (((parada.y % 16) + 16) % 16) * 16 + (((parada.x % 16) + 16) % 16)
        if ((vecino.celdas[i] as { wet: number }).wet < 0.9) {
          return { dios, cx, cy, pozo: p, parada, stock: dec.pozo.stock }
        }
      }
    }
  }
  throw new Error('la semilla no tiene una sola orilla en 13×13 chunks')
}

/** El mundo mínimo para pescar: una criatura parada en la orilla con un aparejo
 *  en la mano. El banco de peces NO se pone acá: lo materializa `stepWorld` del
 *  decreto, que es justamente lo que hay que verificar. */
function mundoConRio(o: Orilla, aparejo: Body, stamina = 1000): WorldState {
  const cuerpo = criatura('ana', stamina)
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos([
      { body: cuerpo, at: o.parada },
      enLaMano(aparejo, o.parada, 'ana'),
    ]),
    actors: mapaDeActores([actor('ana', { holding: [aparejo.id], capacity: 3 })]),
    cells: new Map(),
    nextId: 1,
    dios: o.dios,
  }
}

/** Tirar la caña un tick. Es la MISMA intención cada tick: `extraccion` tarda 1,5
 *  segundos y quien no la sostiene la pierde. */
function tirar(w: WorldState, seq: number, banco: string, aparejo: string): readonly Intent[] {
  const i = apply({ by: 'ana', seq }, w.phys, 'extraccion', [
    { name: 'gear', body: aparejo },
    { name: 'source', body: banco },
  ])
  return i === undefined ? [] : [i]
}

interface Corrida {
  readonly estado: WorldState
  readonly sacados: number
  readonly rechazos: Readonly<Record<string, number>>
  readonly tiradas: number
}

/** Pescar `ticks` ticks seguidos, contando qué salió. */
function pescar(w0: WorldState, o: Orilla, aparejo: string, ticks: number): Corrida {
  const banco = idDePozo(o.cx, o.cy)
  let w = w0
  let sacados = 0
  let tiradas = 0
  const rechazos: Record<string, number> = {}
  for (let t = 0; t < ticks; t++) {
    const antes = w.dios?.dado
    const r = stepWorld(w, tirar(w, t, banco, aparejo))
    for (const e of r.events) {
      if (e.k === 'nacio' && e.por === 'rendimiento') sacados++
      if (e.k === 'rechazada') rechazos[e.por] = (rechazos[e.por] ?? 0) + 1
    }
    if (r.state.dios?.dado !== antes) tiradas++
    w = r.state
  }
  return { estado: w, sacados, rechazos, tiradas }
}

function stockDe(w: WorldState, o: Orilla): Stock {
  const banco = idDePozo(o.cx, o.cy)
  return w.dios?.stocks.find((p) => p.banco === banco)?.stock ?? o.stock
}

// ─── (a) UNA CRIATURA EN LA ORILLA SACA UN PEZ ───────────────────────────────

describe('(a) parada en la orilla, con una caña, saca un pez — sin un solo mock', () => {
  const dios = crearDios(SEMILLA)
  const o = buscarOrilla(dios)
  const { anzuelo } = aparejos()

  it('el dios pone el agua y el mundo la ve, sin copiar una sola celda', () => {
    // LO QUE ESTE TEST CIERRA: antes, `WorldState.cells` nacía vacío y `celdaDe`
    // devolvía aire libre en todas partes. El dios decretaba `wet = 1` en las
    // celdas del río y **no lo leía nadie**.
    const w = mundoConRio(o, anzuelo)
    const dec = decretoDe(dios, PHYS, o.cx, o.cy)
    const i = (((o.pozo.y % 16) + 16) % 16) * 16 + (((o.pozo.x % 16) + 16) % 16)
    expect((dec.celdas[i] as { wet: number }).wet).toBe(1)
    // Y el mundo no escribió ni una celda para saberlo: el decreto es el piso.
    expect(w.cells.size).toBe(0)
  })

  it('el banco de peces aparece solo, con el nombre del LUGAR y no del contador', () => {
    // El id sale de `(cx, cy)` y no de `nuevoId`. Con el contador, dos partidas
    // gemelas que exploraron en distinto orden le pondrían dos nombres al mismo
    // pozo y con eso tendrían dos hashes.
    const r = stepWorld(mundoConRio(o, anzuelo), [])
    const banco = r.state.bodies.get(idDePozo(o.cx, o.cy))
    expect(banco).toBeDefined()
    expect(banco?.at).toEqual(o.pozo)
    expect(r.state.nextId).toBe(1)
    expect(banco?.body.parts[0]?.substance).toBe(o.stock.yields)
  })

  it('EL CRITERIO: tira la caña y sale una pieza a la mano', () => {
    const w0 = mundoConRio(o, anzuelo)
    const r = pescar(w0, o, anzuelo.id, 400)
    console.log(
      `(a) · ${String(r.sacados)} piezas de ${o.stock.yields} en 400 ticks (20 s de mundo), ` +
        `${String(r.tiradas)} tiradas del dado, rechazos: ${JSON.stringify(r.rechazos)}`,
    )
    expect(r.sacados).toBeGreaterThan(0)
    // La pieza está EN LA MANO y es de la especie que el dios decretó.
    const ana = r.estado.actors.get('ana')
    const enMano = (ana?.holding ?? [])
      .map((id) => r.estado.bodies.get(id))
      .filter((c) => c !== undefined && c.body.parts[0]?.substance === o.stock.yields)
    expect(enMano.length).toBeGreaterThan(0)
    // Y pesa lo que el stock dice que pesa una pieza, no un 0,5 fijo.
    expect(enMano[0]?.body.parts[0]?.mass).toBeCloseTo(o.stock.masaPorUnidad / 1000, 9)
  })

  it('sin dios no hay pesca gratis: el mismo apply sale `sin-pozo`', () => {
    // El agujero que esto cierra es el peor de los dos que había: antes,
    // `drawFromStock` escalaba la masa de CUALQUIER cuerpo por 0,5 y la entregaba,
    // sin stock, sin dado y sin cobrarle a nadie.
    const { dios: _sinDios, ...pelado } = mundoConRio(o, anzuelo)
    const banco: WorldState = {
      ...pelado,
      bodies: mapaDeCuerpos([
        ...[...pelado.bodies.values()],
        { body: { id: 'banco', form: 'bloque', parts: [{ substance: 'pescado', mass: 50, q: {} }], joints: [], state: {} }, at: o.pozo },
      ]),
    }
    let w = banco
    let visto = ''
    for (let t = 0; t < 40; t++) {
      const r = stepWorld(w, tirar(w, t, 'banco', anzuelo.id))
      for (const e of r.events) if (e.k === 'rechazada') visto = e.por
      w = r.state
    }
    expect(visto).toBe('sin-pozo')
    // Y no nació ni un gramo de materia.
    expect(w.bodies.get('banco')?.body.parts[0]?.mass).toBe(50)
  })

  it('la masa que sale del agua es la que el chunk paga: el libro lo dice', () => {
    // La costura entera en una línea: lo que salió del mundo lo pagó el chunk, y
    // el techo del Hito 3 dejó de ser código muerto en la partida.
    const r = pescar(mundoConRio(o, anzuelo), o, anzuelo.id, 400)
    const libro = new LibroCalorico(SEMILLA, r.estado.dios?.cobros ?? [])
    expect(() => { libro.verificar() }).not.toThrow()
    expect(libro.cobros().length).toBe(r.sacados)
    const porPieza = milicaloriasDe(o.stock.yields, o.stock.masaPorUnidad, PHYS)
    expect(libro.aportado(o.cx, o.cy)).toBe(r.sacados * porPieza)
    expect(libro.aportado(o.cx, o.cy)).toBeLessThanOrEqual(libro.techo(o.cx, o.cy))
  })
})

// ─── (b) EL RÍO SE AGOTA Y SE REPONE ─────────────────────────────────────────

/**
 * ─── LO QUE EL CRITERIO (b) DECÍA, Y LO QUE MIDIÓ ───────────────────────────
 *
 * Escrito antes: «el río se agota y se repone, medido en segundos de mundo».
 * **La primera mitad no pasa, y no por un bug**: con los números que salieron de
 * la calibración, el pozo NO se puede vaciar pescando. La cuenta:
 *
 *   drenaje máximo  = catch / duración de `extraccion` = 0,575 / 1,5 s = 0,383 /s
 *   reposición      = `perMillePorSegundo` / 1000       = 0,225 /s (medido abajo)
 *
 * y como el drenaje es proporcional a `población / capacidad`, el pozo se
 * estabiliza donde los dos se igualan: `pob / cap = 0,225 / 0,383 = 0,59`. La
 * medición de abajo da 60% después de un minuto de pescar sin parar, o sea que
 * la cuenta y el mundo dicen lo mismo. O sea
 * que **una criatura sola no puede matar un río, y esa es una propiedad del
 * mundo, no un accidente del test**: quien lo agota es el techo calórico, que no
 * se repone jamás, o varias criaturas a la vez.
 *
 * Así que lo que se mide es lo que hay: el pozo BAJA mientras se pesca, se
 * ESTABILIZA, y VUELVE a llenarse cuando se deja de pescar — los tres en segundos
 * de mundo, y con el techo del chunk sin pasarse ni una milicaloría.
 */
describe('(b) el pozo baja, se estabiliza y se repone, en segundos de mundo', () => {
  const dios = crearDios(SEMILLA)
  const o = buscarOrilla(dios)
  const { anzuelo } = aparejos()

  it('la reposición está en segundos y no en ticks: mismo pozo, dos frecuencias', () => {
    // EL FALSO VERDE QUE ESTO ATAJA: `perMillePorSegundo` va por segundo (ADR
    // II-0008) y es un `number` pelado, igual que un contador de ticks. Bajar la
    // frecuencia para que el juego corra mejor NO puede hacer que el río se
    // reponga más lento.
    const stock = o.stock
    const gastado: Stock = { ...stock, amount: 0, atSecond: stock.atSecond }
    const a20 = population(gastado, segundosDe({ tick: 20 * 60, hz: 20 }))
    const a100 = population(gastado, segundosDe({ tick: 100 * 60, hz: 100 }))
    expect(a20).toBe(a100)
    console.log(
      `(b) · tasa ${String(stock.perMillePorSegundo)}‰/s · capacidad ${String(stock.capacity)} · ` +
        `en 60 s de mundo repone ${String(a20)} a 20 Hz y ${String(a100)} a 100 Hz`,
    )
  })

  it('EL CRITERIO: pescando baja, y dejando de pescar vuelve a llenarse', () => {
    const w0 = mundoConRio(o, anzuelo)
    const cap = o.stock.capacity

    // 1200 ticks = 60 segundos de mundo pescando sin parar.
    const pesca = pescar(w0, o, anzuelo.id, 1200)
    const tPesca = segundosDe(pesca.estado)
    const quedan = population(stockDe(pesca.estado, o), tPesca)
    expect(quedan).toBeLessThan(cap)
    expect(pesca.sacados).toBeGreaterThan(0)

    // Y ahora se deja de pescar. La reposición está INTEGRADA (`population` no
    // tiene bucle), así que basta con avanzar el mundo: lo que se mide es el
    // segundo de mundo en el que vuelve a estar lleno.
    let w = pesca.estado
    let llenoEn = Number.NaN
    for (let t = 0; t < 6000; t++) {
      w = stepWorld(w, []).state
      if (population(stockDe(w, o), segundosDe(w)) >= cap) {
        llenoEn = segundosDe(w) - tPesca
        break
      }
    }
    console.log(
      `(b) · 60 s pescando: ${String(pesca.sacados)} piezas, el pozo bajó de ${String(cap)} a ${String(quedan)} ` +
        `(${String(Math.round((100 * quedan) / cap))}% de la capacidad); vuelve a llenarse en ${String(llenoEn)} s de mundo`,
    )
    expect(Number.isFinite(llenoEn)).toBe(true)
    expect(llenoEn).toBeGreaterThan(0)
  })

  it('y el chunk no pasa su techo calórico, ni con el pozo exprimido', () => {
    const r = pescar(mundoConRio(o, anzuelo), o, anzuelo.id, 1200)
    const libro = new LibroCalorico(SEMILLA, r.estado.dios?.cobros ?? [])
    const techo = presupuestoCaloricoDeChunk(SEMILLA, o.cx, o.cy) * 1000
    const porPieza = milicaloriasDe(o.stock.yields, o.stock.masaPorUnidad, PHYS)
    console.log(
      `(b) · techo del chunk ${String(techo)} mcal · pieza ${String(porPieza)} mcal · ` +
        `caben ${String(Math.floor(techo / porPieza))} piezas · se sacaron ${String(r.sacados)} · ` +
        `aportado ${String(libro.aportado(o.cx, o.cy))}`,
    )
    expect(libro.techo(o.cx, o.cy)).toBe(techo)
    expect(libro.aportado(o.cx, o.cy)).toBeLessThanOrEqual(techo)
    expect(() => { libro.verificar() }).not.toThrow()
  })

  it('el techo, cuando SÍ aprieta, corta la pesca con su propio motivo', () => {
    // El techo del chunk de esta semilla da para cientos de piezas, así que
    // gastarlo con `stepWorld` costaría decenas de miles de ticks. Se lo pone
    // gastado a mano —que es exactamente lo que hace cargar un guardado viejo— y
    // se mira que el mundo lo respete: cuatro finales distintos, y éste es el que
    // no se arregla nunca más.
    const porPieza = milicaloriasDe(o.stock.yields, o.stock.masaPorUnidad, PHYS)
    const techo = presupuestoCaloricoDeChunk(SEMILLA, o.cx, o.cy) * 1000
    const w0 = mundoConRio(o, anzuelo)
    const exprimido: WorldState = {
      ...w0,
      dios: {
        ...(w0.dios as EstadoDelDios),
        cobros: [
          {
            cx: o.cx,
            cy: o.cy,
            substance: o.stock.yields,
            masa: o.stock.masaPorUnidad,
            // Todo menos media pieza: lo que queda no alcanza para una más.
            milicalorias: techo - Math.floor(porPieza / 2),
            at: seg(0),
          },
        ],
      },
    }
    const r = pescar(exprimido, o, anzuelo.id, 200)
    expect(r.sacados).toBe(0)
    expect(r.rechazos['sin-presupuesto']).toBeGreaterThan(0)
    // Y NO se tiró el dado: preguntar por un lugar exprimido no corre la partida.
    expect(r.tiradas).toBe(0)
  })
})

// ─── (c) EL ANZUELO RINDE MÁS QUE LA CAÑA PELADA ─────────────────────────────

describe('(c) el anzuelo rinde más que la caña pelada, con el número', () => {
  const dios = crearDios(SEMILLA)
  const o = buscarOrilla(dios)
  const { pelada, anzuelo } = aparejos()

  it('los dos aparejos difieren SÓLO en el catch, y el reach no los desempata', () => {
    // Si el `reach` fuera el que decide, el test mediría otra cosa: `min(1,
    // reach/depth)` es 1 para los dos porque la profundidad del bioma es 1,38 y
    // las dos cañas llegan a más de 4.
    const rp = qualityOf(pelada, 'reach', PHYS)
    const ra = qualityOf(anzuelo, 'reach', PHYS)
    const cp = qualityOf(pelada, 'catch', PHYS)
    const ca = qualityOf(anzuelo, 'catch', PHYS)
    const prof = o.stock.depth / 1000
    expect(Math.min(1, rp / prof)).toBe(1)
    expect(Math.min(1, ra / prof)).toBe(1)
    expect(ca).toBeGreaterThan(cp)
    console.log(
      `(c) · pelada: reach ${String(rp)} catch ${String(cp)} · ` +
        `anzuelo: reach ${String(ra)} catch ${String(ca)} · razón de catch ${(ca / cp).toFixed(2)}×`,
    )
  })

  it('EL CRITERIO: mismo pozo, misma semilla, mismos ticks — y el anzuelo saca más', () => {
    const TICKS = 1200
    const conPelada = pescar(mundoConRio(o, pelada), o, pelada.id, TICKS)
    const conAnzuelo = pescar(mundoConRio(o, anzuelo), o, anzuelo.id, TICKS)
    const razon = conPelada.sacados === 0 ? Infinity : conAnzuelo.sacados / conPelada.sacados
    console.log(
      `(c) · en ${String(TICKS)} ticks (60 s de mundo): pelada ${String(conPelada.sacados)} piezas, ` +
        `anzuelo ${String(conAnzuelo.sacados)} piezas — ${razon.toFixed(2)}× a favor del anzuelo`,
    )
    // ANTES DE ESTE FRENTE ESTE NÚMERO ERA 1,00×: `drawFromStock` sacaba
    // `MASA_POR_EXTRACCION = 0.5` fijo y **un anzuelo de pedernal rendía
    // exactamente igual que una caña pelada**. Una conducta que no paga no la
    // aprende nadie ni la puede distinguir un juez.
    expect(conAnzuelo.sacados).toBeGreaterThan(conPelada.sacados)
    expect(conPelada.sacados).toBeGreaterThan(0)
  })

  it('y la probabilidad que la criatura puede ESTIMAR es la misma que usa el mundo', () => {
    // `probabilidadDePicar` es pública y no consume el dado, así que la mente
    // puede preguntarla antes de decidir. Que sea la MISMA cuenta que usa `draw`
    // es lo que hace que la estimación no mienta.
    const antes = probabilidadDePicar(o.stock, anzuelo, PHYS, seg(0))
    const r = pescar(mundoConRio(o, anzuelo), o, anzuelo.id, 1200)
    const s = stockDe(r.estado, o)
    const despues = probabilidadDePicar(s, anzuelo, PHYS, segundosDe(r.estado))
    expect(antes).toBeGreaterThan(despues)
    console.log(`(c) · p con el pozo lleno ${antes.toFixed(3)} · con el pozo bajo ${despues.toFixed(3)}`)
  })
})

// ─── (d) EL DETERMINISMO NO SE ROMPE ─────────────────────────────────────────

describe('(d) el dado del mundo adentro del estado, y el determinismo intacto', () => {
  const dios = crearDios(SEMILLA)
  const o = buscarOrilla(dios)
  const { anzuelo } = aparejos()
  const TICKS = 600

  it('dos mundos gemelos que pescan dan el mismo hash y la misma huella', () => {
    const a = pescar(mundoConRio(o, anzuelo), o, anzuelo.id, TICKS)
    const b = pescar(mundoConRio(o, anzuelo), o, anzuelo.id, TICKS)
    expect(a.sacados).toBeGreaterThan(0)
    expect(hashWorldState(a.estado)).toBe(hashWorldState(b.estado))
    expect(huella(a.estado)).toBe(huella(b.estado))
  })

  it('EL DADO ESTÁ EN EL HASH: dos mundos iguales salvo el dado hashean distinto', () => {
    // Sin esto, el criterio de arriba pasaría con el dado viviendo afuera del
    // estado —y el replay divergería en la primera tirada—. Es el control
    // negativo del frente entero.
    const w = mundoConRio(o, anzuelo)
    const corrido: WorldState = {
      ...w,
      dios: { ...(w.dios as EstadoDelDios), dado: (w.dios as EstadoDelDios).dado + 1 },
    }
    expect(hashWorldState(corrido)).not.toBe(hashWorldState(w))
  })

  it('y el pozo también: dos mundos iguales salvo lo que queda en el río', () => {
    const w = mundoConRio(o, anzuelo)
    const gastado: WorldState = {
      ...w,
      dios: {
        ...(w.dios as EstadoDelDios),
        stocks: [{ banco: idDePozo(o.cx, o.cy), stock: { ...o.stock, amount: o.stock.amount - 1 } }],
      },
    }
    expect(hashWorldState(gastado)).not.toBe(hashWorldState(w))
  })

  it('pescar de verdad mueve el hash, o los dos de arriba no miden nada', () => {
    const w = mundoConRio(o, anzuelo)
    const r = pescar(w, o, anzuelo.id, TICKS)
    expect(hashWorldState(r.estado)).not.toBe(hashWorldState(w))
    expect(r.estado.dios?.dado).not.toBe(w.dios?.dado)
    expect(r.estado.dios?.cobros.length).toBe(r.sacados)
  })

  it('el replay del journal reconstruye el estado exacto, con dado y todo', () => {
    // ES EL TEST QUE MÁS IMPORTA DEL FRENTE. El journal guarda INTENCIONES, no
    // suerte: si el dado del mundo viviera afuera del `WorldState`, esto daría un
    // mundo coherente y distinto —otras piezas, otro pozo, otro libro— sin ningún
    // error de por medio.
    const w0 = mundoConRio(o, anzuelo)
    const banco = idDePozo(o.cx, o.cy)
    const j = createJournal<Intent>({ hz: w0.hz, semilla: 0 })
    let w = w0
    for (let t = 0; t < TICKS; t++) {
      const is = tirar(w, t, banco, anzuelo.id)
      for (const i of is) j.append(t, i)
      w = stepWorld(w, is).state
    }
    const rehecho = replay(j, { tick: 0, state: w0 }, pasoDelMundo, { hasta: TICKS - 1 })
    expect(hashWorldState(rehecho)).toBe(hashWorldState(w))
    expect(rehecho.dios?.dado).toBe(w.dios?.dado)
    expect(rehecho.dios?.cobros.length).toBe(w.dios?.cobros.length)
    expect(rehecho.dios?.cobros.length).toBeGreaterThan(0)
  })

  it('guardar y cargar a mitad reproduce el final exacto', () => {
    const w0 = mundoConRio(o, anzuelo)
    const banco = idDePozo(o.cx, o.cy)
    const guion = (w: WorldState, t: number): readonly Intent[] => tirar(w, t, banco, anzuelo.id)

    let seguido = w0
    for (let t = 0; t < TICKS / 2; t++) seguido = stepWorld(seguido, guion(seguido, t)).state
    // El viaje por JSON es el que importa: un `Map` no sobrevive a
    // `JSON.stringify`, y un mundo que se «guarda» sin salir de la memoria no
    // prueba que se pueda guardar.
    const enDisco = JSON.parse(
      JSON.stringify([...worldSlots(seguido)].map(([k, v]) => [k, v])),
    ) as [string, unknown][]
    let cortado = restoreWorld(new Map(enDisco))
    expect(hashWorldState(cortado)).toBe(hashWorldState(seguido))
    for (let t = TICKS / 2; t < TICKS; t++) {
      seguido = stepWorld(seguido, guion(seguido, t)).state
      cortado = stepWorld(cortado, guion(cortado, t)).state
    }
    expect(hashWorldState(cortado)).toBe(hashWorldState(seguido))
  })

  it('el mundo SIN dios hashea exactamente igual que antes de que el dios existiera', () => {
    // `hashWorld` saltea las claves ausentes, así que agregar `dios` no movió ni
    // un bit de las partidas que no lo tienen. Es lo que hace que los números de
    // los Hitos 2 y 3 sigan valiendo.
    const { dios: _sin, ...pelado } = mundoConRio(o, anzuelo)
    const w: WorldState = pelado
    expect(worldSlots(w).has('dios')).toBe(false)
    expect(hashWorldState(w)).toBe(hashWorldState({ ...w }))
    // Y un mundo sin dios no gana ni pierde un cuerpo al correr: nada se
    // materializa.
    const r = stepWorld(w, [])
    expect(r.state.bodies.size).toBe(w.bodies.size)
  })

  it('el desenlace de una tirada se puede correlacionar con la intención', () => {
    // La costura tiene que llegar hasta la mente: quien tiró la caña se entera de
    // qué pasó, y de cuál de los cuatro finales fue.
    const w0 = mundoConRio(o, anzuelo)
    const banco = idDePozo(o.cx, o.cy)
    let w = w0
    const finales = new Set<string>()
    for (let t = 0; t < 900; t++) {
      const r = stepWorld(w, tirar(w, t, banco, anzuelo.id))
      const d = desenlaceDe(r.events, { by: 'ana', seq: t })
      if (d.k === 'rechazado' && d.por !== undefined) finales.add(d.por)
      if (d.k === 'logrado' && d.nacidos.length > 0) finales.add('saco')
      w = r.state
    }
    console.log(`(d) · finales vistos en 900 ticks: ${[...finales].sort().join(', ')}`)
    expect(finales.has('saco')).toBe(true)
    expect(finales.has('no-pico')).toBe(true)
  })
})

// ─── LO QUE CUESTA LA COSTURA ────────────────────────────────────────────────

describe('lo que cuesta tener al dios adentro del tick', () => {
  const o = buscarOrilla(crearDios(SEMILLA))
  const { anzuelo } = aparejos()

  it('medido: decretar un chunk, el tick con dios y el tick sin dios', () => {
    // El criterio del Hito 2 es 4 ms por tick con 5000 cuerpos, y el banco mide
    // ese caso SIN dios. Lo que falta saber es qué agrega la costura, y son dos
    // cosas distintas: **decretar** (caro, una vez por chunk, memoizado) y
    // **consultar** (todos los ticks). Si el segundo no fuera despreciable, el
    // decreto habría que copiarlo a las celdas y la decisión del encabezado de
    // `dios.ts` estaría mal.
    const phys = buildSeedPhysics() // catálogo NUEVO: la caché se memoiza por él
    const virgen = crearDios(SEMILLA)
    const t0 = process.hrtime.bigint()
    for (let cx = 100; cx < 108; cx++) for (let cy = 100; cy < 108; cy++) decretoDe(virgen, phys, cx, cy)
    const decretar = Number(process.hrtime.bigint() - t0) / 1e6 / 64

    const t1 = process.hrtime.bigint()
    for (let cx = 100; cx < 108; cx++) for (let cy = 100; cy < 108; cy++) decretoDe(virgen, phys, cx, cy)
    const memo = Number(process.hrtime.bigint() - t1) / 1e6 / 64

    const conDios = mundoConRio(o, anzuelo)
    const { dios: _sin, ...sinDios } = conDios
    const medir = (w0: WorldState): number => {
      let w = w0
      for (let t = 0; t < 50; t++) w = stepWorld(w, []).state // calentar
      const t2 = process.hrtime.bigint()
      for (let t = 0; t < 500; t++) w = stepWorld(w, []).state
      return Number(process.hrtime.bigint() - t2) / 1e6 / 500
    }
    const conMs = medir(conDios)
    const sinMs = medir(sinDios)
    console.log(
      `costo · decretar un chunk ${decretar.toFixed(3)} ms (memoizado ${memo.toFixed(5)} ms, ` +
        `${(decretar / Math.max(memo, 1e-6)).toFixed(0)}× más barato) · ` +
        `tick con dios ${conMs.toFixed(4)} ms · sin dios ${sinMs.toFixed(4)} ms · ` +
        `la costura agrega ${((conMs - sinMs) * 1000).toFixed(1)} µs`,
    )
    // La caché tiene que servir de verdad: si decretar y leer costaran lo mismo,
    // `celdaDe` estaría decretando un chunk por cuerpo y por tick.
    expect(memo).toBeLessThan(decretar / 10)
    // Y el tick con dios tiene que quedar MUY por debajo del techo del criterio.
    expect(conMs).toBeLessThan(1)
  })

  it('la pasada de materialización escala SUBLINEAL con los actores, y el número', () => {
    // ─── ESTE TEST EMPEZÓ SIENDO UN `it.fails` Y LA MEDICIÓN LO DESMINTIÓ ─────
    //
    // La hipótesis escrita antes de medir era: «`materializarPozos` recorre los
    // nueve chunks de CADA actor todos los ticks, así que con 5000 criaturas son
    // 45 000 vueltas aunque estén todas paradas en el mismo lugar; eso es un
    // hueco». La primera medición pareció confirmarlo —118× de un actor a mil—
    // pero comparaba un mundo de UN actor contra uno de MIL, o sea que adentro del
    // número estaban mil metabolismos y mil vueltas de las doce leyes, que este
    // frente no agregó.
    //
    // Aislado como corresponde —el MISMO mundo con dios y sin dios—, doscientos
    // actores apilados le agregan unas pocas veces y no 200×. El `Set` de chunks ya vistos hace el
    // trabajo: lo que queda por actor son nueve sumas y nueve consultas a un `Set`
    // de enteros, y eso no es lo que cuesta. La conclusión honesta es que el hueco
    // no está, y queda escrito acá con el número por si algún día vuelve.
    //
    // Lo que sí queda anotado como mejora posible, sin ser un hueco: la pasada
    // podría recorrer CHUNKS HABITADOS en vez de actores, llevando ese conjunto
    // incremental en `ponerCuerpo`/`sacarCuerpo`. Sería O(chunks) en vez de
    // O(actores), pero cuesta un tercer índice en el `Borrador` para ahorrar 270
    // µs de un presupuesto de 4 ms.
    // Se compara EL MISMO mundo con dios y sin dios, y no un mundo de un actor
    // contra uno de mil: mil criaturas cuestan mil metabolismos y mil vueltas de
    // las doce leyes, y eso no lo agregó este frente. Lo único que se quiere
    // aislar es lo que agrega la costura.
    const armar = (n: number, dios: EstadoDelDios | undefined): WorldState => {
      const cuerpos = []
      const actores = []
      for (let i = 0; i < n; i++) {
        const id = `a${String(i).padStart(5, '0')}`
        // Todos APILADOS en la misma zona: es el caso que interesa, porque el
        // trabajo de materializar es el mismo para uno que para mil.
        cuerpos.push({ body: criatura(id, 1000), at: { x: o.parada.x, y: o.parada.y + 2 + (i % 4) } })
        actores.push(actor(id))
      }
      const base = {
        tick: 0,
        hz: HZ_DE_REFERENCIA,
        phys: PHYS,
        bodies: mapaDeCuerpos(cuerpos),
        actors: mapaDeActores(actores),
        cells: new Map(),
        nextId: 1,
      }
      return dios === undefined ? base : { ...base, dios }
    }
    const medirN = (w0: WorldState): number => {
      let w = w0
      for (let t = 0; t < 20; t++) w = stepWorld(w, []).state
      const t0 = process.hrtime.bigint()
      for (let t = 0; t < 100; t++) w = stepWorld(w, []).state
      return Number(process.hrtime.bigint() - t0) / 1e6 / 100
    }
    const sobrecarga = (n: number): number => medirN(armar(n, o.dios)) - medirN(armar(n, undefined))
    const uno = sobrecarga(1)
    const mil = sobrecarga(200)
    console.log(
      `costo · lo que AGREGA el dios: con 1 actor ${(uno * 1000).toFixed(1)} µs por tick · ` +
        `con 200 actores apilados ${(mil * 1000).toFixed(1)} µs por tick · ${(mil / uno).toFixed(1)}×`,
    )
    // La cota es 20× para 200× de actores. Está holgada respecto de lo medido
    // (unas 3×) a propósito: lo que tiene que atajar es que alguien vuelva a poner
    // trabajo POR ACTOR adentro de la pasada —una cadena de texto, un decreto sin
    // memoizar, un `qualityOf` de más—, no la varianza de la máquina.
    // La cota RELATIVA se afirma siempre: es una razón entre dos mediciones de la
    // MISMA corrida, así que la carga de la máquina se le va casi entera y no
    // depende de en qué orden corrió el resto de la suite.
    expect(mil).toBeLessThan(uno * 20)

    // ─── La cota ABSOLUTA, en cambio, sólo midiendo en serio ─────────────────
    //
    // Se puso roja: dio 1,298 ms contra el 1 que afirmaba. No era una regresión
    // del código — es que `pnpm test` corre este archivo junto con
    // `el-tick-remedido.test.ts`, que tarda SETENTA SEGUNDOS y le come el CPU.
    // Aislado, este mismo número entra.
    //
    // Es la misma disciplina que `banco-el-tick.test.ts:161` fijó para el
    // paquete: «un test de rendimiento adentro de la suite normal es un test
    // flaky, y un test flaky es peor que ninguno: enseña a ignorar el rojo». La
    // reparación no es subir el 1 hasta que dé verde; es medir cuando la máquina
    // está tranquila. El número se imprime igual en cada corrida.
    if (process.env['ANIMA_BANCO'] !== '1') return
    // Lo que el dios le agrega al tick tiene que quedar muy por debajo del
    // presupuesto de 4 ms del criterio del Hito 2.
    expect(mil).toBeLessThan(1)
  })
})

// ─── LO QUE QUEDA ABIERTO ────────────────────────────────────────────────────

describe('lo que este frente NO cerró', () => {
  const dios = crearDios(SEMILLA)
  const o = buscarOrilla(dios)

  it.fails('el pozo es del CHUNK y no de la componente conexa del union-find', () => {
    // POR QUÉ SIGUE ABIERTO: `compromiso.ts` tiene el union-find entero
    // (`WaterBodies`, con los tres casos de la fusión de lagos) y el mundo no lo
    // usa: `dios.ts` resuelve un pozo por chunk. Un lago que cruza cuatro chunks
    // tiene cuatro poblaciones independientes, así que rinde cuatro veces lo que
    // rendiría si fuera uno.
    //
    // QUÉ HARÍA FALTA: recorrer la componente conexa al primer contacto para
    // nombrarla —el id es su celda canónicamente menor— y guardar el mapa
    // `celda → cuerpo de agua` en `EstadoDelDios`. El problema que lo frena está
    // medido y escrito en el encabezado de `oracle/src/pesca.ts`: el nivel de agua
    // de un bioma acuático tiene mediana 846 sobre 1000, así que una componente
    // puede tener 10⁵ celdas y truncar el recorrido haría que el id dependiera de
    // por dónde se empezó.
    //
    // EN QUÉ ARCHIVO: `world/src/dios.ts` (`pozoDe`) y `oracle/src/pesca.ts`
    // (`Pozo` pasaría a recibir el `WaterBody` de `compromiso.ts`).
    const a = decretoDe(dios, PHYS, o.cx, o.cy).pozo
    const b = decretoDe(dios, PHYS, o.cx + 1, o.cy).pozo
    // Si los dos chunks comparten agua, el stock tendría que ser EL MISMO objeto.
    if (a === undefined || b === undefined) throw new Error('no hay dos pozos vecinos')
    expect(a.stock.id).toBe(b.stock.id)
  })

  it.fails('el `cover` del decreto —lo que tapa el follaje— no llega al mundo', () => {
    // POR QUÉ SIGUE ABIERTO: `Terreno` trae `cover` por celda —la entrada de la
    // ley 12, lo que el follaje tapa— y `CellState` guarda tres campos: `wet`,
    // `oxygen` y `temperature`. `celdasDe` en `dios.ts` lo descarta.
    //
    // La consecuencia es concreta: `sheltered` sale HOY sólo de la oclusión de
    // los cuerpos que alguien puso encima (`oclusiones` en `step.ts`), así que un
    // bosque cerrado no da más reparo que una estepa pelada y guarecerse bajo un
    // árbol no existe como conducta.
    //
    // QUÉ HARÍA FALTA: un cuarto campo en `CellState` —o mejor, que `shelteredDe`
    // sume el `cover` decretado a la oclusión de los cuerpos, que no cuesta ni un
    // campo nuevo en el hash—. Es un ADR chico: cambia qué significa `sheltered`.
    //
    // EN QUÉ ARCHIVO: `world/src/step.ts` (`shelteredDe`) y `world/src/dios.ts`
    // (`celdasDe`).
    //
    // ─── POR QUÉ ESTE CUERPO SE REESCRIBIÓ ─────────────────────────────────
    //
    // La primera versión afirmaba `expect(conCover).toBe(false)` sobre el
    // `cover` DEL DECRETO, y eso convertía al marcador en un cartel muerto:
    // fallaba porque el decreto tiene `cover`, y **habría seguido fallando
    // después de arreglar el hueco**, porque el decreto va a seguir teniéndolo.
    // Un `it.fails` que no se pone en rojo el día que el hueco se cierra no
    // avisa de nada. Ahora mide la CONSECUENCIA —lo que el mundo contesta— así
    // que el día que `celdasDe` lleve el `cover` y `shelteredDe` lo sume, este
    // test pasa, `it.fails` se pone rojo, y alguien viene a borrarlo.
    const dec = decretoDe(dios, PHYS, o.cx, o.cy)
    // La celda del chunk con más follaje, buscada y no elegida.
    let mejor = 0
    let cover = 0
    for (let i = 0; i < dec.chunk.terreno.cover.length; i++) {
      const v = dec.chunk.terreno.cover[i] as number
      if (v > cover) {
        cover = v
        mejor = i
      }
    }
    expect(cover, 'el chunk elegido no tiene follaje: el test no probaría nada').toBeGreaterThan(0)
    const at = { x: o.cx * 16 + (mejor % 16), y: o.cy * 16 + Math.floor(mejor / 16) }
    const w = stepWorld(mundoConRio(o, aparejos().anzuelo), []).state
    expect(
      shelteredDe(w, keyOfCell(at)),
      'el follaje que el dios decretó no da ni una pizca de reparo en el mundo',
    ).toBeGreaterThan(0)
  })

  it.fails('lo que el dios deja TIRADO no se materializa: no hay matorral que deshilachar', () => {
    // POR QUÉ SIGUE ABIERTO: `decretarChunk` devuelve `sueltas` —lo que el ruido
    // dejó tirado más lo que la garantía de resolubilidad tuvo que sembrar para
    // que se pueda armar un aparejo en radio 2— y `materializarPozos` sólo
    // materializa el banco de peces. O sea que la criatura llega a la orilla y no
    // hay ni una liana que levantar: el aparejo hay que ponérselo en la mano desde
    // afuera, como hace este mismo archivo.
    //
    // Es exactamente la mitad que le falta al primer criterio del Hito 5:
    // «deshilacha un matorral, ata una vara» necesita el matorral y la vara EN EL
    // MUNDO.
    //
    // QUÉ HARÍA FALTA: extender `materializarPozos` a las `sueltas`, con ids
    // derivados del lugar (`suelta:<cx>:<cy>:<n>`) por la misma razón que el
    // banco, y decidir qué pasa cuando alguien se lleva una y vuelve —el chunk se
    // re-decreta igual, así que hay que llevar en `EstadoDelDios` cuáles ya se
    // materializaron o el mundo las repone solas—. Eso último es la decisión, y
    // no es chica.
    //
    // EN QUÉ ARCHIVO: `world/src/step.ts` (`materializarPozos`) y
    // `world/src/dios.ts` (`EstadoDelDios`).
    const { anzuelo } = aparejos()
    const r = stepWorld(mundoConRio(o, anzuelo), [])
    const dec = decretoDe(dios, PHYS, o.cx, o.cy)
    expect(dec.chunk.sueltas.length).toBeGreaterThan(0)
    const materializadas = [...r.state.bodies.values()].filter((c) => c.body.id.startsWith('suelta:'))
    expect(materializadas.length).toBe(dec.chunk.sueltas.length)
  })
})
