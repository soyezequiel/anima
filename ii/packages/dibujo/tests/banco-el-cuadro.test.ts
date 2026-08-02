// ─── EL BANCO DEL CUADRO: ¿esto corre en tiempo real? ───────────────────────
//
// La pregunta que ningún banco de este proyecto hizo todavía, y la más cara de
// las abiertas. El Hito 0 midió el arranque del navegador y el costo del tick;
// **el dibujo no existía**. Y el número que hay que cruzar con esto ya está
// medido y es feo:
//
//     p99 del tick con 5000 cuerpos ......... 30,94 ms   (techo del criterio: 5)
//     ventana de un tick a 20 Hz ............ 50 ms
//     lo que queda para todo lo demás ....... ~19 ms
//
// Si pintar un cuadro cuesta 20 ms, el juego no corre — y toda la capa de dibujo
// hay que repensarla. Es muchísimo más barato saberlo ahora que después de
// escribir la UI encima.
//
// ─── QUÉ SE MIDE, Y POR QUÉ ASÍ ────────────────────────────────────────────
//
// Un cuadro completo es `mapaDe`: el suelo de (2r+1)² celdas más un glifo
// compuesto por cuerpo. Se mide entero y también partido, porque las dos mitades
// escalan distinto —el suelo con el RADIO, los cuerpos con cuántos haya— y
// saber cuál manda decide qué se optimiza si hace falta.
//
// El barrido va sobre densidades reales y una absurda: la partida medida tiene
// **10 cuerpos en 225 celdas**, así que 10 es el caso de hoy y 200 es el caso
// que nadie vio nunca. Un banco que sólo mide el caso de hoy no avisa nada.
//
// ─── LA PUERTA ─────────────────────────────────────────────────────────────
//
// Los números salen del reloj de pared, así que **se imprimen siempre y se
// afirman sólo con `ANIMA_RELOJ=1`**. Es la regla del Hito 11 y el motivo está
// escrito en `forge/tests/reloj-de-pared.ts`: una aserción sobre un milisegundo
// se pone roja porque la máquina estaba ocupada, no porque el código esté mal.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type FormId, type Physics } from '@anima/physics'
import type { Escena, RenderDescriptor } from '@anima/world'

import { glifoDe, pintar } from '../src/componer.js'
import { CELDA, mapaDe } from '../src/mapa.js'
import { CONTRA_EL_RELOJ, NO_SE_AFIRMA } from './reloj-de-pared.js'

const PHYS: Physics = buildSeedPhysics()
const RELOJ = { phase: 'dia' as const }

/**
 * EL PRESUPUESTO, y de dónde sale cada número.
 *
 * `VENTANA` es la de un tick a 20 Hz, que es `HZ_DE_REFERENCIA`. `TECHO` es lo
 * que queda después del p99 del tick medido en `world/tests/banco-el-tick`, con
 * un margen: si el dibujo se come lo que sobra, el mundo pierde ticks y eso ya
 * tiene un contador con nombre (`ticksPerdidos`).
 */
const VENTANA_MS = 50
const TECHO_DEL_CUADRO_MS = 16

function cuerpo(i: number, forma: FormId, partes: number): RenderDescriptor {
  const sustancias = ['madera', 'piedra', 'liana', 'hoja-seca', 'pescado', 'hueso']
  const s = sustancias[i % sustancias.length] ?? 'madera'
  return {
    v: 2,
    at: { x: 0, y: 0 },
    forma,
    materiales: [s],
    nucleo: s,
    partes,
    juntas: partes - 1,
    atadores: new Array<string>(Math.max(0, partes - 1)).fill('liana'),
    estado: 'sin-marca',
    porte: 'chico',
  }
}

/** Una escena de mentira con `cuantos` cuerpos repartidos por el área visible. */
function escenaCon(cuantos: number, radio: number): Escena {
  const celdas = []
  for (let y = -radio; y <= radio; y++) {
    for (let x = -radio; x <= radio; x++) {
      celdas.push({ at: { x, y }, wet: (x + y) % 3 === 0 ? 0.7 : 0.2, oxygen: 0.2, temperature: 20, sheltered: 0 })
    }
  }
  const cuerpos = new Map<string, { d: RenderDescriptor }>()
  const lado = 2 * radio + 1
  const formas: FormId[] = ['vara', 'hebra', 'bloque', 'malla', 'filete', 'grano']
  for (let i = 0; i < cuantos; i++) {
    const d = cuerpo(i, formas[i % formas.length] ?? 'bloque', (i % 6) + 1)
    const at = { x: (i % lado) - radio, y: (Math.trunc(i / lado) % lado) - radio }
    cuerpos.set(`c${String(i)}`, { d: { ...d, at } })
  }
  return {
    v: 1,
    tick: 0,
    foco: { x: 0, y: 0 },
    radio,
    celdas,
    cuerpos,
    actores: [],
  } as unknown as Escena
}

/** El mínimo de `rondas` corridas: el mínimo es lo menos contaminado por la máquina. */
function minMs(rondas: number, hacer: () => void): number {
  let mejor = Number.POSITIVE_INFINITY
  for (let i = 0; i < rondas; i++) {
    const t0 = performance.now()
    hacer()
    const ms = performance.now() - t0
    if (ms < mejor) mejor = ms
  }
  return mejor
}

describe('el banco del cuadro', () => {
  it('CUÁNTO SALE PINTAR UN CUADRO, por densidad', () => {
    const radio = 7
    console.log('\n─── EL CUADRO, A RADIO 7 (15×15 celdas, 420×420 px) ───')
    console.log('  cuerpos   ms/cuadro   cuadros por tick de 50 ms')

    const medidas: { cuantos: number; ms: number }[] = []
    for (const cuantos of [0, 10, 50, 200]) {
      const e = escenaCon(cuantos, radio)
      const ms = minMs(20, () => {
        mapaDe(e, PHYS, RELOJ)
      })
      medidas.push({ cuantos, ms })
      console.log(
        `  ${String(cuantos).padStart(7)}   ${ms.toFixed(2).padStart(9)}   ${(VENTANA_MS / ms).toFixed(0).padStart(6)}`,
      )
    }

    const caso = medidas.find((m) => m.cuantos === 10)
    const peor = medidas[medidas.length - 1]
    console.log(`\n  el caso de hoy (10 cuerpos): ${caso?.ms.toFixed(2) ?? '—'} ms`)
    console.log(`  el techo del cuadro: ${String(TECHO_DEL_CUADRO_MS)} ms`)

    if (CONTRA_EL_RELOJ) {
      expect(caso?.ms, 'el caso de hoy no entra en el presupuesto del cuadro').toBeLessThan(TECHO_DEL_CUADRO_MS)
      expect(peor?.ms, '200 cuerpos se pasan de una ventana entera').toBeLessThan(VENTANA_MS)
    } else {
      console.log(`  ${NO_SE_AFIRMA}\n`)
    }

    // Lo que SÍ se afirma sin mirar el reloj: que la medición ocurrió sobre algo.
    expect(medidas.length).toBe(4)
    expect(medidas.every((m) => Number.isFinite(m.ms))).toBe(true)
  })

  it('QUIÉN SE LLEVA EL TIEMPO: el suelo o los cuerpos', () => {
    // Escalan distinto —el suelo con el radio, los cuerpos con cuántos haya— y
    // saber cuál manda decide qué se optimiza el día que haya que optimizar.
    const vacio = escenaCon(0, 7)
    const lleno = escenaCon(50, 7)
    const soloSuelo = minMs(20, () => {
      mapaDe(vacio, PHYS, RELOJ)
    })
    const conCuerpos = minMs(20, () => {
      mapaDe(lleno, PHYS, RELOJ)
    })

    console.log('\n─── QUIÉN SE LLEVA EL TIEMPO ───')
    console.log(`  225 celdas de suelo, sin nada encima: ${soloSuelo.toFixed(2)} ms`)
    console.log(`  las mismas, con 50 cuerpos:           ${conCuerpos.toFixed(2)} ms`)
    console.log(`  lo que cuestan los 50 cuerpos:        ${(conCuerpos - soloSuelo).toFixed(2)} ms`)
    console.log(`  por cuerpo:                           ${((conCuerpos - soloSuelo) / 50).toFixed(3)} ms`)
    if (!CONTRA_EL_RELOJ) console.log(`  ${NO_SE_AFIRMA}\n`)

    expect(Number.isFinite(soloSuelo) && Number.isFinite(conCuerpos)).toBe(true)
  })

  it('y cuánto sale UN GLIFO suelto, que es la unidad de todo esto', () => {
    console.log('\n─── UN GLIFO ───')
    for (const partes of [1, 6]) {
      const d = cuerpo(0, 'bloque', partes)
      const ms = minMs(200, () => {
        pintar(glifoDe(d, PHYS, 24))
      })
      console.log(`  ${String(partes)} pieza${partes > 1 ? 's' : ''}: ${(ms * 1000).toFixed(1)} µs`)
    }
    if (!CONTRA_EL_RELOJ) console.log(`  ${NO_SE_AFIRMA}\n`)
    expect(true).toBe(true)
  })

  it('EL CONTROL: el banco está midiendo un mapa que DIBUJA algo', () => {
    // Sin este control, un `mapaDe` que no pintara nada mediría casi 0 ms y el
    // banco entero diría «entra holgado» sobre la nada.
    //
    // ─── Y SE AFIRMA CONTANDO PÍXELES, NO MILISEGUNDOS ──────────────────────
    //
    // La primera versión comparaba los tiempos de dos radios —«el grande tiene
    // que costar más»— y el guardián del Hito 11 la rechazó, con razón: es una
    // aserción sobre el reloj de pared, y la regla del árbol dice que **donde
    // haya una afirmación estructural que pruebe lo mismo, va ésa y no la
    // puerta** (`forge/tests/linea-base.json`, `comoSeBaja`).
    //
    // Acá la hay y es mejor: lo que se quería controlar no era que tardara más,
    // era que dibujara. Contar píxeles pintados lo dice sin mirar ninguna
    // máquina, y de paso afirma la relación exacta —cada celda del mundo son
    // CELDA² píxeles— en vez de un «mayor que».
    const pintados = (radio: number): number => {
      const p = mapaDe(escenaCon(0, radio), PHYS, RELOJ)
      let n = 0
      for (const fila of p.px) for (const c of fila) if (c !== '' && c !== '#000000') n++
      return n
    }
    const chico = pintados(4)
    const grande = pintados(12)
    console.log(`\n  radio 4 (81 celdas): ${String(chico)} px pintados · radio 12 (625): ${String(grande)} px`)
    console.log(`  razón: ${(grande / chico).toFixed(1)}× para 7,7× de celdas\n`)

    // 81 y 625 celdas, cada una de CELDA×CELDA píxeles. El suelo pinta TODAS.
    expect(chico, 'el mapa chico no pintó nada').toBe(81 * CELDA * CELDA)
    expect(grande, 'el mapa grande no pintó nada').toBe(625 * CELDA * CELDA)
  })
})
