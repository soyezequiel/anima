// ═══ HITO 10 · puntos 2 y 3 — RE-EJECUTAR LAS HABILIDADES Y COMPARAR LA TRAZA ═
//
// El criterio entero está en `ii/docs/hito-10-cronica-y-herencia.md`. Lo que hay
// que saber para leer este archivo es la medición M2:
//
//     interface JournalEntry<I> { tick; seq; intent }     ← eso, y nada más
//
// El replay del journal replaya INTENCIONES. Una `Intent` es lo que la habilidad
// **ya produjo**, así que replayarla salta la habilidad entera: el generador no
// se vuelve a correr ni una vez. Lo que ese replay prueba es que **el mundo** es
// determinista, y no prueba nada sobre la habilidad.
//
// ─── LO QUE ESTE ARCHIVO DEMUESTRA, Y ES EL PUNTO 3 ─────────────────────────
//
// Que hay una clase entera de divergencia que el hash del mundo **no puede
// ver**, y que la traza sí ve:
//
//     ctx.phase('lo-que-esta-haciendo')     va a la traza · NO toca ningún cuerpo
//
// Dos corridas que emiten las MISMAS intenciones y distintas fases dejan el
// mundo bit por bit idéntico. El hash dice que todo está bien. Y no está bien:
// la habilidad hizo algo distinto las dos veces, que es la definición de una
// fuente de no-determinismo adentro del código que el modelo escribió.
//
// ─── LA ADVERTENCIA QUE EL CRITERIO ESCRIBIÓ, CUMPLIDA ──────────────────────
//
// El criterio dice, sobre este mismo control:
//
//   > Plantar el no-determinismo en un lugar que la habilidad no toca da verde y
//   > no controla nada — es exactamente el error que el Hito 8 cometió con el
//   > manual viejo. La fuente plantada tiene que estar EN EL CAMINO que la
//   > habilidad recorre, y hay que demostrarlo mostrando que la corrida sin
//   > plantar sí pasa.
//
// Por eso el primer bloque de abajo es el control AMABLE —la misma habilidad sin
// plantar nada, dos veces, trazas idénticas— y va PRIMERO. Sin él, «la
// comparación se puso roja» no diría si la cazó o si esta comparación se pone
// roja siempre.

import { describe, expect, it } from 'vitest'
import { hashWorldState } from '@anima/world'
import type { Ctx, Intent, Outcome, StepResult } from '@anima/skills'

import { Partida, compararVuelos, porQueDivergen } from '../src/index.js'
import type { VueloAnotado } from '../src/index.js'
import { conElla } from './mundo.js'

type Hab = Generator<Intent, Outcome, StepResult>

const QUIEN = 'ella'
const TICKS = 40

/** Camina a un lado y vuelve. Termina, que es lo que hace falta para que se anote. */
function* laHonesta(ctx: Ctx): Hab {
  ctx.phase('yendo')
  yield ctx.goTo({ x: 3, y: 0 }, {})
  ctx.phase('volviendo')
  yield ctx.goTo({ x: 0, y: 0 }, {})
  return { ok: true }
}

/**
 * LA MISMA, CON UNA FUENTE DE NO-DETERMINISMO PLANTADA EN SU CAMINO.
 *
 * El contador vive en el módulo, así que la segunda corrida lo encuentra en 1 y
 * no en 0 — que es el modo de falla real: una habilidad que guarda estado afuera
 * de `ctx.memory` y cree que arranca limpia.
 *
 * Y está plantada **donde la habilidad pasa sí o sí**: es la primera línea que
 * corre. No hay forma de que este control no muerda por no haber pasado por ahí.
 *
 * Lo que NO cambia es una sola intención: los dos `goTo` son idénticos, con los
 * mismos argumentos y en el mismo orden. Por eso el mundo queda igual.
 */
let cuantasVeces = 0
function* laQueSeAcuerdaDeMas(ctx: Ctx): Hab {
  cuantasVeces += 1
  ctx.phase(`yendo-vuelta-${String(cuantasVeces)}`)
  yield ctx.goTo({ x: 3, y: 0 }, {})
  ctx.phase('volviendo')
  yield ctx.goTo({ x: 0, y: 0 }, {})
  return { ok: true }
}

/** Una corrida entera: devuelve el hash del mundo y lo que quedó anotado. */
function corrida(hab: (ctx: Ctx) => Hab, nombre: string): { hash: string; vuelos: readonly VueloAnotado[] } {
  const p = new Partida(conElla([], { at: { x: 0, y: 0 } }), { anotarVuelos: true })
  p.volar(QUIEN, hab, undefined, { nombre })
  p.avanzar(TICKS)
  return { hash: hashWorldState(p.state), vuelos: p.vuelosAnotados }
}

describe('(Hito 10 · 2 y 3) la traza ve lo que el hash del mundo no ve', () => {
  it('EL CONTROL AMABLE, primero: la misma habilidad dos veces deja la MISMA traza', () => {
    const a = corrida(laHonesta, 'la-honesta')
    const b = corrida(laHonesta, 'la-honesta')

    console.log(
      `\n─── EL CONTROL AMABLE ───\n` +
        `  vuelos anotados ... ${String(a.vuelos.length)}\n` +
        `  traza ............. ${a.vuelos[0]?.traza ?? '(ninguna)'} y ${b.vuelos[0]?.traza ?? '(ninguna)'}\n` +
        `  hash del mundo .... ${a.hash}\n`,
    )

    // Que se anotó ALGO va primero: sin esto, «no hubo divergencias» sería cierto
    // sobre dos listas vacías, que es el cero por omisión de este archivo.
    expect(a.vuelos.length, 'no se anotó ningún vuelo: no hay nada que comparar').toBeGreaterThan(0)
    expect(a.vuelos[0]?.ok).toBe(true)
    expect(a.vuelos[0]?.pasos).toBeGreaterThan(0)
    expect(compararVuelos(a.vuelos, b.vuelos)).toEqual([])
    expect(b.hash).toBe(a.hash)
  })

  it('EL CONTROL QUE MUERDE: con la fuente plantada, el MUNDO queda igual y la TRAZA no', () => {
    cuantasVeces = 0
    const a = corrida(laQueSeAcuerdaDeMas, 'la-que-se-acuerda')
    const b = corrida(laQueSeAcuerdaDeMas, 'la-que-se-acuerda')
    const d = compararVuelos(a.vuelos, b.vuelos)

    console.log(
      `\n─── EL CONTROL QUE MUERDE ───\n` +
        `  hash del mundo, corrida 1 ... ${a.hash}\n` +
        `  hash del mundo, corrida 2 ... ${b.hash}\n` +
        `  ¿el hash lo vio? ............ ${a.hash === b.hash ? 'NO. Son idénticos' : 'sí'}\n` +
        `  traza, corrida 1 ............ ${a.vuelos[0]?.traza ?? '?'}\n` +
        `  traza, corrida 2 ............ ${b.vuelos[0]?.traza ?? '?'}\n` +
        `  ¿la traza lo vio? ........... ${d.length > 0 ? 'SÍ' : 'no'}\n` +
        (d[0] === undefined ? '' : `  y lo dijo así ............... ${porQueDivergen(d[0])}\n`),
    )

    // ── LA MITAD QUE HACE FALTA PRIMERO: el mundo NO se enteró.
    //    Si el hash cambiara, este control probaría algo que el replay del
    //    journal ya cazaba, y no habría hecho falta escribir nada.
    expect(a.hash, 'el hash del mundo cambió: este control no prueba lo que dice probar').toBe(b.hash)
    // ── Y LA MITAD QUE IMPORTA: la traza sí.
    expect(d.length, 'la traza no cazó la divergencia').toBeGreaterThan(0)
    expect(d[0]?.k).toBe('traza')
  })

  it('el cero es distinguible de «no se miró»', () => {
    // `vuelosAnotados: []` con la opción apagada NO quiere decir «no voló nada».
    // Es el mismo cero ambiguo que `violaciones` ya resolvía con `vigilada`.
    const p = new Partida(conElla([], { at: { x: 0, y: 0 } }))
    p.volar(QUIEN, laHonesta, undefined, { nombre: 'la-honesta' })
    p.avanzar(TICKS)
    expect(p.anotandoVuelos).toBe(false)
    expect(p.vuelosAnotados).toEqual([])

    const q = new Partida(conElla([], { at: { x: 0, y: 0 } }), { anotarVuelos: true })
    q.volar(QUIEN, laHonesta, undefined, { nombre: 'la-honesta' })
    q.avanzar(TICKS)
    expect(q.anotandoVuelos).toBe(true)
    expect(q.vuelosAnotados.length).toBeGreaterThan(0)
  })

  it('una divergencia se lee: dice cuál vuelo, en qué tick y qué habilidad', () => {
    const uno: readonly VueloAnotado[] = [
      { tick: 7, actor: QUIEN, nombre: 'unir(vara+hebra)', traza: 'aaaa', pasos: 3, ok: true },
    ]
    const otro: readonly VueloAnotado[] = [
      { tick: 7, actor: QUIEN, nombre: 'unir(vara+hebra)', traza: 'bbbb', pasos: 3, ok: true },
    ]
    const d = compararVuelos(uno, otro)[0]
    expect(d).toBeDefined()
    const texto = porQueDivergen(d as never)
    expect(texto).toContain('tick 7')
    expect(texto).toContain('unir(vara+hebra)')
    // Corta en la primera y no devuelve cuatrocientas: ver `compararVuelos`.
    expect(compararVuelos([...uno, ...uno], [...otro, ...otro]).length).toBe(1)
    // Y las tres formas que no son «otra traza» también se leen.
    expect(porQueDivergen({ k: 'faltan', i: 2, cuantos: 3 })).toContain('faltan 3')
    expect(porQueDivergen({ k: 'sobran', i: 2, cuantos: 1 })).toContain('1 veces de más')
  })
})
