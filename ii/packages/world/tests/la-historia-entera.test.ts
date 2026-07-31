// ─── LA HISTORIA ENTERA, EN UN SOLO MUNDO ───────────────────────────────────
//
// Es el «se puede mostrar» del Gate 5→6, dicho en su documento así:
//
//   > una criatura que **fabrica algo que nadie programó**, lo deja funcionando y
//   > **vuelve a buscar lo que atrapó**.
//
// Los tramos anteriores probaron las piezas por separado: el plano es canónico, la
// obra queda puesta, el dispositivo retiene, el guardado la conserva. Este archivo
// las corre **todas juntas, en una sola partida, sin arneses que salteen pasos**.
//
// Y hace falta que exista aparte de los otros por un motivo que este proyecto ya
// se comió una vez (número 1 de los corregidos): **medir el catálogo no es medir
// el mundo**. Cinco piezas que pasan sus tests no son una historia que ocurre.
//
// ─── LOS SEIS PASOS, Y NINGUNO ESTÁ SIMULADO ────────────────────────────────
//
//   1. junta una vara y una hebra;
//   2. las ata — y de ahí sale una obra con `catch > 0` que nadie programó;
//   3. la deja sobre el pozo;
//   4. se va caminando;
//   5. el mundo corre sin ella, y la obra saca;
//   6. vuelve y se lleva lo que juntó.
//
// ─── LO QUE ESTE ARCHIVO NO USA, Y ES LA MITAD DEL PUNTO ────────────────────
//
// No hay `kind`, no hay receta, no hay nada llamado trampa. Lo único que hace que
// la obra pesque es que su `catch` da mayor que cero, y eso sale de la geometría
// de lo que la criatura ató. Con un palo pelado los seis pasos corren igual y no
// sale un solo pez — está medido en `el-dispositivo-retiene-solo.test.ts`.
//
// Tampoco hay mente: las intenciones se emiten a mano. Que la criatura DECIDA
// hacer esto es del Hito 5 y de la fragua; que el mundo lo PERMITA es del gate, y
// es lo que se mide acá.

import { describe, expect, it } from 'vitest'

import { HZ_DE_REFERENCIA, buildSeedPhysics, qualityOf, type Physics } from '@anima/physics'

import { crearDios, decretoDe, type EstadoDelDios } from '../src/dios.js'
import { apply, goTo, place, take, type Intent } from '../src/intent.js'
import { renderDescriptorHash } from '../src/descriptor.js'
import { hashWorldState } from '../src/mundo.js'
import { mapaDeActores, mapaDeCuerpos, stepWorld, type WorldState } from '../src/step.js'
import { actor, criatura, cuerpo, enElPiso } from './mundo-minimo.js'

const PHYS: Physics = buildSeedPhysics()
const SEMILLA = 20260727n

interface Orilla {
  readonly dios: EstadoDelDios
  readonly cx: number
  readonly cy: number
  readonly pozo: { readonly x: number; readonly y: number }
  readonly parada: { readonly x: number; readonly y: number }
}

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
        const v = decretoDe(dios, PHYS, Math.floor(parada.x / 16), Math.floor(parada.y / 16))
        const i = (((parada.y % 16) + 16) % 16) * 16 + (((parada.x % 16) + 16) % 16)
        if ((v.celdas[i] as { wet: number }).wet < 0.9) return { dios, cx, cy, pozo: p, parada }
      }
    }
  }
  throw new Error('la semilla no tiene una sola orilla en 13×13 chunks')
}

const O = buscarOrilla(crearDios(SEMILLA))
/** Lejos: la criatura se VA, no se queda mirando de al lado. */
const LEJOS = { x: O.parada.x + 6, y: O.parada.y + 6 }

/**
 * La escena: una criatura en la orilla, con una vara y una hebra en el piso.
 *
 * Dos cuerpos sueltos y nada más. Lo que salga de ahí lo arma ella.
 */
function escena(): WorldState {
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos([
      { body: criatura('ana', 2000), at: O.parada },
      enElPiso(cuerpo('vara', 'madera', 0.5), O.parada),
      enElPiso(cuerpo('hebra', 'liana', 0.2), O.parada),
    ]),
    actors: mapaDeActores([actor('ana', { holding: [], capacity: 4 })]),
    cells: new Map(),
    desplegados: new Map(),
    nextId: 1,
    dios: O.dios,
  }
}

/** Un tick con estas intenciones. Devuelve el estado y lo que el mundo narró. */
function paso(w: WorldState, is: readonly Intent[]): { readonly w: WorldState; readonly rechazos: readonly string[] } {
  const r = stepWorld(w, is)
  return { w: r.state, rechazos: r.events.filter((e) => e.k === 'rechazada').map((e) => e.por) }
}

function correr(w: WorldState, n: number): WorldState {
  let s = w
  for (let i = 0; i < n; i++) s = stepWorld(s, []).state
  return s
}

describe('la historia entera: fabrica, deja, se va, vuelve y se lleva', () => {
  it('los seis pasos, en una sola partida', () => {
    let w = escena()
    const bitacora: string[] = []

    // ─── 1 y 2 · Junta las dos piezas ────────────────────────────────────────
    let r = paso(w, [take({ by: 'ana', seq: 0 }, 'vara')])
    w = r.w
    expect(r.rechazos, 'no pudo levantar la vara').toEqual([])
    r = paso(w, [take({ by: 'ana', seq: 0 }, 'hebra')])
    w = r.w
    expect(r.rechazos, 'no pudo levantar la hebra').toEqual([])
    bitacora.push('  1-2 · junta una vara y una hebra')

    // ─── 3 · Las ata. `union` sin `b`: la hebra SOBREVIVE atada de un solo lado
    //        y le queda una punta suelta — que es todo el asunto (tramo C·bis).
    const atar = apply({ by: 'ana', seq: 0 }, PHYS, 'union', [
      { name: 'binder', body: 'hebra' },
      { name: 'a', body: 'vara' },
    ])
    expect(atar, 'el catálogo no tiene `union`').toBeDefined()
    if (atar === undefined) return
    // `union` tarda un segundo de mundo: la intención se sostiene hasta que
    // completa. Se re-emite cada tick, igual que la pesca a mano.
    let obra: string | undefined
    for (let t = 0; t < 60 && obra === undefined; t++) {
      const paso2 = stepWorld(w, [{ ...atar, seq: t }])
      w = paso2.state
      for (const e of paso2.events) if (e.k === 'nacio') obra = e.id
    }
    expect(obra, 'no salió ningún ensamble en 60 ticks').toBeDefined()
    if (obra === undefined) return

    const cuerpoObra = w.bodies.get(obra)
    expect(cuerpoObra).toBeDefined()
    if (cuerpoObra === undefined) return
    const engancha = qualityOf(cuerpoObra.body, 'catch', PHYS)
    bitacora.push(
      `  3   · las ata → sale «${obra}» con ${String(cuerpoObra.body.parts.length)} piezas y catch ${engancha.toFixed(4)}`,
    )
    // ─── LO QUE NADIE PROGRAMÓ ───────────────────────────────────────────────
    // Nadie escribió que esto fuera una trampa. Ató dos cosas y lo que salió
    // engancha, porque `catch` sale de las puntas sueltas y del filo.
    expect(engancha).toBeGreaterThan(0)

    // ─── 4 · La deja sobre el pozo ───────────────────────────────────────────
    r = paso(w, [place({ by: 'ana', seq: 0 }, obra, O.pozo)])
    w = r.w
    expect(r.rechazos, 'no pudo dejarla puesta').toEqual([])
    expect(w.desplegados.get(obra)?.at).toEqual(O.pozo)
    bitacora.push(`  4   · la deja sobre el pozo en ${JSON.stringify(O.pozo)}`)

    // ─── 5 · Se va, y el mundo corre sin ella ────────────────────────────────
    for (let t = 0; t < 12; t++) w = stepWorld(w, [goTo({ by: 'ana', seq: t }, LEJOS, 0)]).state
    const miCuerpo = w.bodies.get('ana-cuerpo')
    expect(miCuerpo).toBeDefined()
    const lejos = Math.max(
      Math.abs((miCuerpo?.at.x ?? 0) - O.pozo.x),
      Math.abs((miCuerpo?.at.y ?? 0) - O.pozo.y),
    )
    // Se fue de verdad: fuera del alcance con el que se toca algo (Chebyshev 1).
    expect(lejos).toBeGreaterThan(1)
    bitacora.push(`  5   · se va: queda a ${String(lejos)} celdas del pozo`)

    w = correr(w, 400)
    const capturado = w.desplegados.get(obra)?.captura ?? []
    bitacora.push(`      · el mundo corre 400 ticks sin nadie → retuvo ${String(capturado.length)} piezas`)
    expect(capturado.length, 'la obra no retuvo nada en 20 s').toBeGreaterThan(0)

    // ─── 6 · Vuelve y se lo lleva ────────────────────────────────────────────
    const pieza = capturado[0]
    if (pieza === undefined) return
    const donde = w.bodies.get(pieza)?.at
    expect(donde).toBeDefined()
    if (donde === undefined) return
    for (let t = 0; t < 40; t++) {
      const actual = w.bodies.get('ana-cuerpo')?.at
      if (actual !== undefined && Math.max(Math.abs(actual.x - donde.x), Math.abs(actual.y - donde.y)) <= 1) break
      w = stepWorld(w, [goTo({ by: 'ana', seq: t }, donde, 1)]).state
    }
    r = paso(w, [take({ by: 'ana', seq: 0 }, pieza)])
    w = r.w
    expect(r.rechazos, 'volvió y no pudo levantar lo que la obra atrapó').toEqual([])
    expect(w.actors.get('ana')?.holding).toContain(pieza)
    // Y deja de ser de la obra: la lista no guarda fantasmas.
    expect(w.desplegados.get(obra)?.captura).not.toContain(pieza)
    bitacora.push(`  6   · vuelve y se lleva «${pieza}»`)

    console.log(`\n─── LA HISTORIA ENTERA ───\n${bitacora.join('\n')}\n`)
  })

  it('y la historia es REPRODUCIBLE: dos corridas dan el mismo mundo y el mismo dibujo', () => {
    // El piso de todo. Si esto se pusiera rojo, adentro habría estado que no sale
    // del journal — y con dispositivos que sacan solos del mismo dado que la
    // criatura, es justo donde una divergencia se escondería.
    function historia(): WorldState {
      let w = escena()
      w = stepWorld(w, [take({ by: 'ana', seq: 0 }, 'vara')]).state
      w = stepWorld(w, [take({ by: 'ana', seq: 0 }, 'hebra')]).state
      const atar = apply({ by: 'ana', seq: 0 }, PHYS, 'union', [
        { name: 'binder', body: 'hebra' },
        { name: 'a', body: 'vara' },
      ])
      if (atar === undefined) throw new Error('sin `union`')
      let obra: string | undefined
      for (let t = 0; t < 60 && obra === undefined; t++) {
        const p = stepWorld(w, [{ ...atar, seq: t }])
        w = p.state
        for (const e of p.events) if (e.k === 'nacio') obra = e.id
      }
      if (obra === undefined) throw new Error('sin obra')
      w = stepWorld(w, [place({ by: 'ana', seq: 0 }, obra, O.pozo)]).state
      return correr(w, 300)
    }
    const a = historia()
    const b = historia()
    expect(hashWorldState(a)).toBe(hashWorldState(b))
    // Y las TRES capas del E2E del gate coinciden, no sólo el mundo.
    expect(renderDescriptorHash(a)).toBe(renderDescriptorHash(b))
  })
})
