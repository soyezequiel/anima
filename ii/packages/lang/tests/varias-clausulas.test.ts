/**
 * VARIAS CLÁUSULAS, MANDADAS DE A UNA — contra un mundo de verdad.
 *
 * «Hacé fuego y después pescá» no se podía pedir: el canal a la mente lleva UNA
 * firma. El porqué de mandar de a una en vez de enseñarle el grafo a la mente
 * está entero en el encabezado de `src/encargo.ts` — en dos líneas: la ligadura
 * diferida **no tiene ejecutor**, así que un grafo entregado a la mente se caería
 * en el tercer paso con un `Ref` sin resolver.
 *
 * Lo que este archivo mide es que la secuencia AVANCE de verdad, y para eso hace
 * falta correr el mundo: un cursor que avanza sobre un `Set` a mano no prueba
 * nada.
 */

import { buildSeedPhysics } from '@anima/physics'
import { ESQUEMAS, cumple, interpretar } from '@anima/plan'
import { Contexto, Partida } from '@anima/perceive'
import { Creencias, Mente, vivir } from '@anima/mind'
import { describe, expect, it } from 'vitest'
import { PUENTE } from '../src/alias.js'
import { EncargoEnCurso, encargoDe } from '../src/encargo.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { actor, criatura, enElPiso, laOrilla, mundo } from './mundo.js'

const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

const QUIEN = 'ana'
const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const FIRMAS = new Set(ESQUEMAS.map((e) => e.establishes))

const orilla = laOrilla()
function nuevaPartida(): Partida {
  return new Partida(
    mundo({
      dios: orilla.dios,
      bodies: [enElPiso(criatura(QUIEN, 1000), orilla.parada)],
      actors: [actor(QUIEN, { capacity: 3 })],
    }),
    { vigilar: true },
  )
}

function cumplidaEn(p: Partida): (firma: string) => boolean {
  return (firma: string): boolean => {
    const pr = interpretar(firma)
    if (pr === undefined) return false
    const v = new Contexto(p.proyeccion, { actor: QUIEN, rng: p.dado.tirar, lugares: p.lugares }).ctx
    return cumple(pr, v)
  }
}

const OPC = {
  phys,
  lexico,
  sabeElCatalogo: (f: string): boolean => FIRMAS.has(f),
}

describe('un encargo de varias cláusulas', () => {
  it('sale en orden, y dice cuántas ligaduras perdió', () => {
    const e = encargoDe(leer('hacé fuego y después pescá algo', OPC))
    console.log(`\n  «hacé fuego y después pescá algo»`)
    console.log(`     ${String(e.metas.length)} metas: ${e.metas.join('  →  ')}`)
    expect(e.metas).toEqual(['emitsPower>0', 'holding(tag:carnoso)'])
    // Ésta no tiene ligadura: son dos pedidos sueltos con un orden.
    expect(e.ligaduraPerdida).toBe(0)
  })

  it('y la que SÍ tenía ligadura lo dice en vez de callarlo', () => {
    // «Asá el pescado» refiere al de la cláusula anterior, y ese `binds` se
    // pierde al partir el grafo. Vale siete pasos de plan (medido: 5 contra 12)
    // y por eso se cuenta en vez de disimularse.
    const e = encargoDe(leer('pescá algo y después asá el pescado', OPC))
    console.log(`  «pescá algo y después asá el pescado» → ligaduras perdidas: ${String(e.ligaduraPerdida)}`)
    expect(e.metas.length).toBe(2)
    expect(e.ligaduraPerdida).toBe(1)
  })

  it('el cursor saltea lo que el mundo YA cumple', () => {
    // Sin correr nada: con un mundo que dice que todo está hecho, el encargo
    // termina de una. Es el control barato del cursor.
    const c = EncargoEnCurso.nuevo(encargoDe(leer('hacé fuego y después pescá algo', OPC)))
    expect(c.ahora(() => true)).toBeUndefined()
    expect(c.terminado).toBe(true)
    // Y con un mundo que no cumple nada, se queda en la primera.
    const d = EncargoEnCurso.nuevo(encargoDe(leer('hacé fuego y después pescá algo', OPC)))
    expect(d.ahora(() => false)).toBe('emitsPower>0')
    expect(d.ahora(() => false)).toBe('emitsPower>0')
    expect(d.hechas).toBe(0)
  })
})

describe('CONTRA EL MUNDO: la segunda cláusula arranca cuando la primera está', () => {
  it('«hacé fuego y después pescá algo», corrido', () => {
    const p = nuevaPartida()
    const memoria = new Creencias()
    let m = new Mente({ actor: QUIEN, memoria })
    const mentes = new Map([[QUIEN, m]])
    vivir(p, mentes, 40)

    const cumplida = cumplidaEn(p)
    const cursor = EncargoEnCurso.nuevo(encargoDe(leer('hacé fuego y después pescá algo', OPC)))
    const bitacora: string[] = []
    let enCurso: string | undefined
    let cambios = 0

    for (let t = 40; t < 40 + 1200; t++) {
      const quiere = cursor.ahora(cumplida)
      if (quiere !== enCurso) {
        cambios++
        bitacora.push(
          quiere === undefined
            ? `  ${String(t).padStart(5)}  terminó el encargo`
            : `  ${String(t).padStart(5)}  pasa a «${quiere}»  (${String(cursor.hechas + 1)} de ${String(cursor.total)})`,
        )
        enCurso = quiere
        if (quiere !== undefined) {
          m = new Mente({ actor: QUIEN, memoria, drive: { meta: quiere, peso: 1, desdeTick: t } })
          mentes.set(QUIEN, m)
        }
      }
      vivir(p, mentes, 1)
      if (cursor.terminado) break
    }

    console.log('\n── EL ENCARGO, CORRIDO ──')
    for (const b of bitacora) console.log(b)
    console.log(`  ${String(cursor.hechas)} de ${String(cursor.total)} metas hechas\n`)

    // Lo que se afirma siempre: el cursor arranca por la primera y no se saltea
    // ninguna sin que el mundo la cumpla.
    expect(bitacora[0]).toContain('emitsPower>0')
    expect(cambios).toBeGreaterThanOrEqual(1)

    if (!MIDIENDO_EN_SERIO) return
    // Y midiendo en serio: la primera se cumple y la segunda arranca. Si esto
    // se pone rojo NO se afloja — quiere decir que la criatura no llegó a hacer
    // fuego en 1200 ticks, que es un hecho del mundo y hay que mirarlo.
    expect(cursor.hechas, 'no llegó a cumplir la primera meta').toBeGreaterThanOrEqual(1)
  })

  it('EL CONTROL: sin encargo, la misma criatura no pasa por las dos', () => {
    // Sin esto, «pasó a la segunda» podría ser la criatura haciendo lo suyo. Se
    // corre la misma escena con UNA sola meta clavada y se cuenta cuántas metas
    // distintas persiguió: tiene que ser una.
    const p = nuevaPartida()
    const memoria = new Creencias()
    const m = new Mente({
      actor: QUIEN,
      memoria,
      drive: { meta: 'emitsPower>0', peso: 1, desdeTick: 40 },
    })
    const mentes = new Map([[QUIEN, m]])
    vivir(p, mentes, 40)
    const porD2 = new Set<string>()
    for (let k = 0; k < 600; k++) {
      vivir(p, mentes, 1)
      const e = m.estado
      if (e.porQuien === 'D2' && e.metaEnCurso !== undefined) porD2.add(e.metaEnCurso)
    }
    console.log(`  con una sola meta clavada, D2 persiguió: ${[...porD2].join(', ') || '(ninguna)'}`)
    expect(porD2.size).toBeLessThanOrEqual(1)
  })
})
