// ═══ HITO 10 · punto 1 — EL REPLAY DE VEINTE MIL TICKS ══════════════════════
//
// El criterio del Hito 10 pide *«replay de 20.000 ticks reproduce el hash
// exacto»*. La medición M3, hecha antes de escribir nada:
//
//     el replay más largo del árbol es de 10.000 ticks   (hito-2-el-criterio, (a))
//
// O sea que la mitad que ya cumplía cumplía **a la mitad de la escala**. Este
// archivo la corre entera, y no es un número por el número: el criterio del Hito
// 5 mide la vida de una criatura en 20.000 ticks, así que ése es el largo de una
// partida de verdad. Un replay que sólo se probó a 10.000 no dice nada sobre la
// partida que el proyecto usa para todo lo demás.
//
// ─── LO QUE ESTE ARCHIVO NO CUBRE, Y ESTÁ EN OTRO LADO ──────────────────────
//
// La otra mitad del verificable —«y re-ejecuta las habilidades comparando la
// traza»— **no se puede hacer acá**, y no por comodidad: este replay replaya
// INTENCIONES, que es todo lo que el journal guarda, y una intención es lo que
// la habilidad ya produjo. El generador no corre ni una vez.
//
// Esa mitad vive en `perceive/tests/la-traza-ve-lo-que-el-hash-no-ve.test.ts`,
// con el control que muestra la clase de divergencia que ESTE archivo no puede
// ver por más ticks que corra: dos corridas con distintas fases dejan el mundo
// bit por bit idéntico.

import { describe, expect, it } from 'vitest'
import { createJournal, replay } from '../src/journal.js'
import { hashWorldState, pasoDelMundo, stepWorld } from '../src/index.js'
import type { Intent, WorldHash, WorldState } from '../src/index.js'
import { actor, criatura, cuerpo, enElPiso, intencionesAlAzar, lcg, mundo } from './mundo-minimo.js'

/** Los mismos 20.000 del criterio del Hito 5: el largo de una partida de verdad. */
const TICKS = 20_000
/**
 * Cuántas intenciones por tick.
 *
 * Menos que las 10 del test de 10.000 y es a propósito: lo que este archivo
 * duplica es **el largo**, que es lo que el criterio nombra, no la carga. Duplicar
 * las dos habría costado el cuádruple de segundos sin probar nada que el otro
 * archivo no probara ya — y un test caro que nadie corre no prueba nada.
 */
const POR_TICK = 4
/** Un checkpoint cada mil ticks: veintiuno en total, contando el del final. */
const CADA = 1000

const EN = (x: number, y: number) => ({ x, y })
const NOMBRES = ['ana', 'beto', 'cira', 'dani']
const MATERIA = ['madera', 'liana', 'pescado', 'corteza', 'hoja', 'piedra']

function partida(): WorldState {
  const bodies = NOMBRES.map((n, i) => enElPiso(criatura(n, 1000), EN(i, 0)))
  for (let i = 0; i < 6; i++) {
    bodies.push(enElPiso(cuerpo(`c${i}`, MATERIA[i] as string, 1), EN(i - 3, 3)))
  }
  return mundo({ bodies, actors: NOMBRES.map((n) => actor(n, { capacity: 3 })) })
}

describe('(Hito 10 · 1) el replay de VEINTE MIL ticks reproduce el hash exacto', () => {
  it('veinte mil ticks, replayados desde cero, dan el mismo mundo y los mismos veintiún checkpoints', () => {
    const journal = createJournal<Intent>()
    const r = lcg(20260801)
    const checkpoints = new Map<number, WorldHash>()
    let s = partida()
    const t0 = process.hrtime.bigint()
    for (let t = 0; t < TICKS; t++) {
      if (t % CADA === 0) checkpoints.set(t, hashWorldState(s))
      const intents = intencionesAlAzar(r, NOMBRES, POR_TICK)
      for (const i of intents) journal.append(t, i)
      s = stepWorld(s, intents).state
    }
    checkpoints.set(TICKS, hashWorldState(s))
    const msCorrida = Number(process.hrtime.bigint() - t0) / 1e6

    // ─── EL REPLAY, desde el tick 0 y con los checkpoints puestos ───────────
    //
    // Con checkpoints y no sin ellos, por lo que el propio `replay` explica: sin
    // ellos una divergencia se manifiesta como «los dos hashes finales no
    // coinciden» y hay que bisecar veinte mil ticks a mano. Con ellos corta en el
    // PRIMER tick que no da y lo dice.
    const t1 = process.hrtime.bigint()
    const rehecho = replay(journal, { tick: 0, state: partida() }, pasoDelMundo, {
      hasta: TICKS - 1,
      checkpoints,
      hashOf: hashWorldState,
    })
    const msReplay = Number(process.hrtime.bigint() - t1) / 1e6

    console.log(
      `\n─── EL REPLAY DE VEINTE MIL ───\n` +
        `  ticks .............. ${String(TICKS)} (el largo del criterio del Hito 5)\n` +
        `  intenciones ........ ${String(journal.length)}\n` +
        `  checkpoints ........ ${String(checkpoints.size)}\n` +
        `  correr la partida .. ${msCorrida.toFixed(0)} ms\n` +
        `  replayarla ......... ${msReplay.toFixed(0)} ms\n` +
        `  hash final ......... ${hashWorldState(rehecho)}\n`,
    )

    expect(journal.length).toBe(TICKS * POR_TICK)
    expect(checkpoints.size).toBe(TICKS / CADA + 1)
    expect(hashWorldState(rehecho)).toBe(hashWorldState(s))

    // ── LAS DOS GUARDAS CONTRA EL TEST QUE PASA SIN PROBAR NADA.
    //    El mundo terminó vivo, y no es el hash del mundo de partida —o sea que
    //    los veinte mil ticks movieron algo.
    expect(rehecho.bodies.size).toBeGreaterThan(5)
    expect(hashWorldState(rehecho)).not.toBe(hashWorldState(partida()))
  }, 600_000)

  it('EL CONTROL: sacándole UNA intención del medio, el replay corta — y corta ADENTRO, no en el tick 0', () => {
    // ─── LA PRIMERA VERSIÓN DE ESTE CONTROL CORTABA EN EL TICK 0 ────────────
    //
    // Arrancaba el replay desde un mundo distinto —una criatura con un punto
    // menos de aliento— y el corte llegaba en el checkpoint del tick 0, o sea
    // **antes de entrar al bucle**. Probaba que el primer hash se compara, y
    // nada más: un `replay` que no replayara ni un tick lo habría pasado igual.
    //
    // Es el modo de falla que este proyecto ya cazó siete veces con otro nombre.
    // Acá el journal arranca IGUAL y se le saca una intención de la mitad, así
    // que los primeros checkpoints tienen que pasar y el corte tiene que caer
    // adentro — y el test lo exige con un número, no con la ausencia de error.
    const CORTO = 400
    const journal = createJournal<Intent>()
    const r = lcg(20260801)
    const checkpoints = new Map<number, WorldHash>()
    let s = partida()
    for (let t = 0; t < CORTO; t++) {
      if (t % 100 === 0) checkpoints.set(t, hashWorldState(s))
      const intents = intencionesAlAzar(r, NOMBRES, POR_TICK)
      for (const i of intents) journal.append(t, i)
      s = stepWorld(s, intents).state
    }
    checkpoints.set(CORTO, hashWorldState(s))

    // El mismo journal con UNA entrada menos, sacada de la mitad. Todo lo de
    // antes queda igual; lo de después ya no puede dar.
    const todas = journal.entries()
    const cortada = Math.trunc(todas.length / 2)
    const mutilado = createJournal<Intent>()
    todas.forEach((e, i) => {
      if (i !== cortada) mutilado.append(e.tick, e.intent)
    })
    const tickDeLaFalta = todas[cortada]?.tick ?? -1

    let rompio = ''
    try {
      replay(mutilado, { tick: 0, state: partida() }, pasoDelMundo, {
        hasta: CORTO - 1,
        checkpoints,
        hashOf: hashWorldState,
      })
    } catch (e) {
      rompio = e instanceof Error ? e.message : String(e)
    }

    console.log(
      `\n─── EL CONTROL ───\n` +
        `  intenciones ......... ${String(todas.length)} → ${String(mutilado.length)}\n` +
        `  la que falta era del . tick ${String(tickDeLaFalta)}\n` +
        `  ${rompio === '' ? 'NO cortó: el replay no compara nada' : rompio}\n`,
    );

    expect(mutilado.length).toBe(todas.length - 1)
    expect(rompio, 'el replay no cortó: los checkpoints no están comparando nada').not.toBe('')
    // ── Y LA MITAD QUE HACE FALTA: cortó ADENTRO, no en el tick 0.
    //    El tick del corte se lee del propio mensaje, que es el que después va a
    //    leer quien busque el bug.
    const enElTick = /tick (\d+)/.exec(rompio)
    expect(enElTick, `el mensaje no dice en qué tick cortó: «${rompio}»`).not.toBeNull()
    const cortoEn = Number(enElTick?.[1] ?? -1)
    expect(cortoEn, 'cortó en el tick 0: no llegó a replayar nada').toBeGreaterThan(0)
    expect(cortoEn).toBeGreaterThanOrEqual(tickDeLaFalta)
  }, 120_000)
})
