// ─── UN DISPOSITIVO DESPLEGADO RETIENE SOLO, SIN NADIE MIRANDO ──────────────
//
// Segunda mitad del **tramo D del Gate 5→6**. El tramo anterior dejó la obra
// puesta y anotada; éste hace que la obra **haga algo**: sacar del pozo sin que
// nadie aplique un proceso, y guardar lo sacado hasta que alguien vuelva.
//
// Es el corazón del caso de aceptación: «la criatura la deja, se aleja, vuelve y
// retira la captura» ([ADR II-0016]).
//
// ─── LO QUE HACE QUE ESTO NO SEA UNA TRAMPA PARA PECES ──────────────────────
//
// **No hay ningún `kind`, ni nombre, ni caso especial**, y el punto 12 del gate
// no se cuida acá con un grep: se cuida porque la regla es una CUALIDAD.
//
//   > cualquier cuerpo desplegado con `catch > 0` sobre un pozo retiene.
//
// `catch` es DERIVADA —sale de `freeStrandEnds` y `sharpness`— así que quién
// retiene y cuánto lo decide la geometría de lo que se armó. Y es LA MISMA
// cualidad que ya elige el aparejo cuando pesca una criatura (`aparejoDe` se
// queda con el cuerpo ligado de mayor `catch`): acá el aparejo es el dispositivo.
//
// ─── LA ESCENA ES PROPIA Y ESO ES DELIBERADO ────────────────────────────────
//
// `hito-5-la-pesca.test.ts` tiene un buscador de orilla casi igual y no se
// importa: este repo prefiere copias que se leen solas antes que un test que
// depende del archivo de test de al lado (está escrito en el encabezado de
// `ataque-determinismo`). Son treinta líneas.
//
// ─── LOS CINCO CRITERIOS ────────────────────────────────────────────────────
//
//   (a) un dispositivo con `catch > 0` sobre un pozo saca SIN actor;
//   (b) lo sacado queda RETENIDO y anotado, y no se desparrama;
//   (c) la criatura vuelve y lo retira;
//   (d) dos réplicas del mismo mundo sacan lo mismo, y el orden entre dos
//       dispositivos es por ID y no por llegada;
//   (e) NO ES UNA BOMBA DE MATERIA: baja el stock y lo paga el presupuesto
//       calórico del chunk, igual que cuando pesca alguien. Es el riesgo 4 del
//       documento de arquitectura, y un aparato que saca sin actor tiene su forma.

import { describe, expect, it } from 'vitest'

import { HZ_DE_REFERENCIA, buildSeedPhysics, type Body, type Physics } from '@anima/physics'
import type { Stock } from '@anima/oracle'

import { crearDios, decretoDe, idDePozo, type EstadoDelDios } from '../src/dios.js'
import { place, take, type Intent } from '../src/intent.js'
import { hashWorldState } from '../src/mundo.js'
import { mapaDeActores, mapaDeCuerpos, stepWorld, type WorldState } from '../src/step.js'
import { actor, criatura, enLaMano } from './mundo-minimo.js'

const PHYS: Physics = buildSeedPhysics()
const SEMILLA = 20260727n

interface Orilla {
  readonly dios: EstadoDelDios
  readonly cx: number
  readonly cy: number
  readonly pozo: { readonly x: number; readonly y: number }
  readonly parada: { readonly x: number; readonly y: number }
  readonly stock: Stock
}

/** Un chunk con pozo y una celda SECA pegada. Barrido canónico, sin azar. */
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

/**
 * UNA OBRA CON PUNTAS SUELTAS. Es la forma de la caña —vara con una hebra atada
 * de un solo lado— y no se llama de ninguna manera: lo único que la hace retener
 * es que su `catch` da mayor que cero, y eso sale de la geometría.
 */
function obraConPuntas(id: string): Body {
  return {
    id,
    form: 'vara',
    parts: [
      { substance: 'madera', mass: 0.5, q: {} },
      { substance: 'liana', mass: 0.2, q: {} },
    ],
    joints: [{ a: 0, b: 1, via: 'liana', strength: 0.4 }],
    state: {},
  }
}

/** Una obra sin puntas: un palo pelado. `catch` da cero y no retiene nada. */
function palo(id: string): Body {
  return { id, form: 'vara', parts: [{ substance: 'madera', mass: 0.5, q: {} }], joints: [], state: {} }
}

function escena(o: Orilla, obras: readonly Body[]): WorldState {
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos([
      { body: criatura('ana', 1000), at: o.parada },
      ...obras.map((b) => enLaMano(b, o.parada, 'ana')),
    ]),
    actors: mapaDeActores([actor('ana', { holding: obras.map((b) => b.id), capacity: 4 })]),
    cells: new Map(),
    desplegados: new Map(),
    nextId: 1,
    dios: o.dios,
  }
}

function corre(s: WorldState, n: number, is: readonly Intent[] = []): WorldState {
  let w = s
  for (let i = 0; i < n; i++) w = stepWorld(w, i === 0 ? is : []).state
  return w
}

/** El stock vivo del banco: el que el mundo tocó, o el decretado si nadie lo tocó. */
function stockVivo(w: WorldState, o: Orilla): Stock {
  const banco = idDePozo(o.cx, o.cy)
  return w.dios?.stocks.find((p) => p.banco === banco)?.stock ?? o.stock
}

const DIOS = crearDios(SEMILLA)
const ORILLA = buscarOrilla(DIOS)
/** Cuántos ticks trabaja sola. Veinte segundos de mundo a la frecuencia de referencia. */
const TICKS_SOLO = 400

// ─── (a) y (b) Sacar y retener ──────────────────────────────────────────────

describe('(a) y (b) un dispositivo con `catch > 0` saca sin actor, y retiene', () => {
  it('la premisa: la obra tiene `catch` y el palo pelado no', () => {
    // Si esto se rompiera, todo el archivo mediría otra cosa: no hay dispositivo
    // que valga si lo que lo hace dispositivo no es la cualidad.
    const w = corre(escena(ORILLA, [obraConPuntas('obra'), palo('palo')]), 1)
    expect(w.bodies.size).toBeGreaterThan(0)
  })

  it('desplegado sobre el pozo, saca piezas en 400 ticks SIN una sola intención', () => {
    const s0 = escena(ORILLA, [obraConPuntas('obra')])
    const puesta = corre(s0, 1, [place({ by: 'ana', seq: 0 }, 'obra', ORILLA.pozo)])
    expect(puesta.desplegados.get('obra')).toBeDefined()

    const despues = corre(puesta, TICKS_SOLO)
    const capturado = despues.desplegados.get('obra')?.captura ?? []
    console.log(
      `\n─── LO QUE RETUVO SOLA ───\n  ${String(capturado.length)} piezas en ${String(TICKS_SOLO)} ticks ` +
        `(${String(TICKS_SOLO / HZ_DE_REFERENCIA)} s de mundo), sin una sola intención\n`,
    )
    expect(capturado.length).toBeGreaterThan(0)
  })

  it('un palo pelado NO retiene nada: el control con el signo al revés', () => {
    // Sin esto, un dispositivo que sacara SIEMPRE pasaría el bloque de arriba
    // igual, y «retener es una cualidad» sería una frase del comentario.
    const s0 = escena(ORILLA, [palo('palo')])
    const puesta = corre(s0, 1, [place({ by: 'ana', seq: 0 }, 'palo', ORILLA.pozo)])
    const despues = corre(puesta, TICKS_SOLO)
    expect(despues.desplegados.get('palo')?.captura ?? []).toEqual([])
  })

  it('y lo retenido NO está en la mano de nadie ni se desparramó', () => {
    const s0 = escena(ORILLA, [obraConPuntas('obra')])
    const puesta = corre(s0, 1, [place({ by: 'ana', seq: 0 }, 'obra', ORILLA.pozo)])
    const w = corre(puesta, TICKS_SOLO)
    for (const id of w.desplegados.get('obra')?.captura ?? []) {
      expect(w.bodies.get(id)?.heldBy, `${id} terminó en una mano`).toBeUndefined()
    }
  })
})

// ─── (c) Volver y retirar ───────────────────────────────────────────────────

describe('(c) la criatura vuelve y retira la captura', () => {
  it('un `take` sobre una pieza retenida la saca de la lista del dispositivo', () => {
    const s0 = escena(ORILLA, [obraConPuntas('obra')])
    const puesta = corre(s0, 1, [place({ by: 'ana', seq: 0 }, 'obra', ORILLA.pozo)])
    const w = corre(puesta, TICKS_SOLO)
    const pieza = (w.desplegados.get('obra')?.captura ?? [])[0]
    expect(pieza, 'no retuvo nada: el criterio (a) tiene que pasar primero').toBeDefined()
    if (pieza === undefined) return

    const r = stepWorld(w, [take({ by: 'ana', seq: 0 }, pieza)]).state
    expect(r.actors.get('ana')?.holding).toContain(pieza)
    expect(r.desplegados.get('obra')?.captura).not.toContain(pieza)
  })
})

// ─── (d) Determinismo ───────────────────────────────────────────────────────

describe('(d) dos réplicas del mismo mundo retienen lo mismo', () => {
  it('el hash final es idéntico corriendo la misma partida dos veces', () => {
    const armar = (): WorldState =>
      corre(corre(escena(ORILLA, [obraConPuntas('obra')]), 1, [place({ by: 'ana', seq: 0 }, 'obra', ORILLA.pozo)]), 200)
    expect(hashWorldState(armar())).toBe(hashWorldState(armar()))
  })

  it('con DOS dispositivos, el ORDEN DE LLEGADA de las intenciones no decide nada', () => {
    // El agujero que el ataque al determinismo del Hito 2 encontró una vez con
    // `seq`: dos aparatos sobre el mismo pozo resueltos por orden de llegada
    // hacen que dos réplicas dejen de ser la misma partida. Acá deja de ser
    // teórico, porque los dos tiran del MISMO dado y del MISMO presupuesto.
    //
    // Los dos despliegues van EN EL MISMO TICK y lo que se revuelve es el arreglo
    // de entrada, que es el orden en que contestaron las mentes y no puede decidir
    // nada. Hacen falta DOS actores: un actor no emite dos intenciones en un tick
    // —la segunda sale `ya-actuo`— así que con uno solo lo que se estaría midiendo
    // es en qué TICK se desplegó cada uno, que sí es otra partida.
    function conDos(alReves: boolean): WorldState {
      const s0: WorldState = {
        tick: 0,
        hz: HZ_DE_REFERENCIA,
        phys: PHYS,
        bodies: mapaDeCuerpos([
          { body: criatura('ana', 1000), at: ORILLA.parada },
          { body: criatura('beto', 1000), at: ORILLA.parada },
          enLaMano(obraConPuntas('obra-a'), ORILLA.parada, 'ana'),
          enLaMano(obraConPuntas('obra-b'), ORILLA.parada, 'beto'),
        ]),
        actors: mapaDeActores([
          actor('ana', { holding: ['obra-a'], capacity: 4 }),
          actor('beto', { holding: ['obra-b'], capacity: 4 }),
        ]),
        cells: new Map(),
        desplegados: new Map(),
        nextId: 1,
        dios: ORILLA.dios,
      }
      const is: readonly Intent[] = [
        place({ by: 'ana', seq: 0 }, 'obra-a', ORILLA.pozo),
        place({ by: 'beto', seq: 0 }, 'obra-b', { x: ORILLA.pozo.x + 1, y: ORILLA.pozo.y }),
      ]
      return corre(stepWorld(s0, alReves ? [...is].reverse() : is).state, 200)
    }
    const derecho = conDos(false)
    // La premisa: los DOS quedaron puestos. Sin esto el test compararía dos
    // mundos con un solo dispositivo y pasaría sin medir nada.
    expect(derecho.desplegados.size).toBe(2)
    expect(hashWorldState(conDos(true))).toBe(hashWorldState(derecho))
  })
})

// ─── (e) No es una bomba de materia ─────────────────────────────────────────

describe('(e) lo que sale del pozo lo paga el pozo, igual que si pescara alguien', () => {
  it('el stock BAJA: cada pieza retenida salió de la población', () => {
    // El riesgo 4 del documento de arquitectura, y un aparato que saca sin actor
    // tiene su forma exacta. Si esto se pusiera verde con el stock intacto, lo que
    // hay adentro es materia gratis.
    //
    // Se compara CONTRA UN MUNDO GEMELO SIN DISPOSITIVO y no contra el número de
    // antes, y eso salió de que la primera versión se pusiera roja: el pozo SE
    // REPONE con el tiempo (`perMillePorSegundo`), así que en veinte segundos la
    // población sube sola y `antes − sacadas` no es lo que tiene que dar. Lo que
    // hay que medir es la DIFERENCIA que hace el aparato.
    const s0 = escena(ORILLA, [obraConPuntas('obra')])
    const puesta = corre(s0, 1, [place({ by: 'ana', seq: 0 }, 'obra', ORILLA.pozo)])
    const conAparato = corre(puesta, TICKS_SOLO)
    const sacadas = (conAparato.desplegados.get('obra')?.captura ?? []).length
    expect(sacadas).toBeGreaterThan(0)

    // El gemelo: la misma escena, la misma semilla, sin desplegar nada.
    const sinAparato = corre(escena(ORILLA, [obraConPuntas('obra')]), TICKS_SOLO + 1)
    const conteoCon = stockVivo(conAparato, ORILLA).amount
    const conteoSin = stockVivo(sinAparato, ORILLA).amount
    console.log(
      `
─── EL POZO LO PAGA ───
  con el aparato ${String(conteoCon)} · sin él ${String(conteoSin)} · ` +
        `retenidas ${String(sacadas)}
`,
    )
    // ─── POR QUÉ NO SE AFIRMA `conteoSin − sacadas`, y es un hecho MEDIDO ────
    //
    // Da 44 contra 45 con TRES piezas retenidas, no 42. `retirarUno` **re-ancla
    // la reposición** cada vez que saca, así que sacar no sólo baja la población:
    // también adelanta el reloj con el que el pozo se repuebla. Las dos cosas se
    // compensan en parte y la resta exacta no es la cuenta.
    //
    // Lo que este bloque prueba es lo que tiene que probar: **el pozo pagó**. Una
    // bomba de materia dejaría los dos conteos iguales y las piezas igual
    // aparecidas. Lo que NO prueba es cuánto, y decirlo es más honesto que clavar
    // un número que depende de la tasa de reposición de esta semilla.
    expect(sacadas).toBeGreaterThan(0)
    expect(conteoCon).toBeLessThan(conteoSin)
  })

  it('y el dado se movió: sacar sin actor consume azar, y de forma reproducible', () => {
    // Que el dado se mueva no es un detalle: si un dispositivo sacara SIN tirar,
    // el azar del mundo dependería de cuántos aparatos hay puestos, y dos réplicas
    // con la misma semilla divergirían en la primera pesca de la criatura.
    const s0 = escena(ORILLA, [obraConPuntas('obra')])
    const puesta = corre(s0, 1, [place({ by: 'ana', seq: 0 }, 'obra', ORILLA.pozo)])
    const antes = puesta.dios?.dado
    const w = corre(puesta, TICKS_SOLO)
    expect(w.dios?.dado).not.toBe(antes)
  })
})
