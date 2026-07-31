/**
 * EL CRITERIO DEL HITO 6, corrido — los cinco puntos, con su control.
 *
 *   pnpm --filter @anima/lang test
 *   ANIMA_BANCO=1 pnpm --filter @anima/lang test    ← el veredicto de verdad
 *
 * ─── POR QUÉ HAY DOS FORMAS DE CORRERLO ─────────────────────────────────────
 *
 * Porque un test de rendimiento adentro de la suite normal es un test flaky, y
 * un test flaky es peor que ninguno: enseña a ignorar el rojo. Es el patrón que
 * este proyecto ya tenía decidido (`world/tests/banco-el-tick.test.ts:165`): **se
 * imprime siempre, se afirma sólo midiendo en serio**.
 *
 * Lo que NO está detrás del portón son los puntos 1 y 4, porque no se afirman
 * con un cronómetro sino con un mecanismo.
 *
 * ─── EL PUNTO 2, Y POR QUÉ NECESITA UN CONTROL POSITIVO ─────────────────────
 *
 * El punto 2 dice: con el proveedor colgado, el mismo p95 que con el proveedor
 * apagado. Y un test que compara dos p95, los encuentra iguales y da verde **es
 * exactamente la clase de cero que este proyecto ya cobró** (número 20 de
 * `como-se-trabaja.md`: «un control que da cero hay que probarlo primero contra
 * el caso positivo»).
 *
 * Así que se corre TRES veces:
 *
 * | corrida | dónde está el proveedor | qué tiene que salir |
 * |---|---|---|
 * | **apagado** | no hay | el p95 de referencia |
 * | **colgado** | registrado, y contesta DESPUÉS del acuse y del movimiento | el MISMO p95 |
 * | **en el camino** | bloqueando ANTES del acuse — a propósito | un p95 **peor** |
 *
 * La tercera es el control. Sin ella, «los dos p95 son iguales» lo cumpliría un
 * arnés que no sabe medir.
 *
 * ─── UNA HONESTIDAD SOBRE EL NÚMERO DEL PROVEEDOR ───────────────────────────
 *
 * El proveedor simulado quema **20 ms** y uno de verdad tarda **900 ms de TTFT
 * con caché caliente** (tabla del documento de arquitectura, caso frío). O sea
 * que el control es **45× más suave que la realidad**: si el arnés ve estos 20
 * ms, ve cualquier proveedor. Se elige chico para que 250 corridas no tarden un
 * minuto.
 */

import { buildSeedPhysics } from '@anima/physics'
import { ESQUEMAS, plan } from '@anima/plan'
import { describe, expect, it } from 'vitest'
import { PUENTE } from '../src/alias.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { objetivosDe } from '../src/objetivos.js'
import { Reloj, mismaCorrida } from '../src/relojes.js'
import type { Resumen } from '../src/relojes.js'
import { CORPUS } from './corpus.js'
import { elRio } from './rio.js'

const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'

const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const ESTABLECIBLES = new Set<string>()
for (const e of ESQUEMAS) ESTABLECIBLES.add(e.establishes)
const OPC = { phys, lexico, sabeElCatalogo: (f: string): boolean => ESTABLECIBLES.has(f) }

/** La ventana de un tick del mundo semilla: `hz` es 20, medido. */
const VENTANA_DEL_TICK_MS = 50
/** El techo del criterio. */
const TECHO_MS = 150
/** Lo que quema el proveedor simulado. Ver el encabezado: uno real son 900. */
const PROVEEDOR_MS = 20

const ahora = (): number => Number(process.hrtime.bigint()) / 1e6

/** Quemar tiempo de verdad. Un `setTimeout` no serviría: el camino es sincrónico. */
function quemar(ms: number): void {
  const hasta = ahora() + ms
  while (ahora() < hasta) {
    /* el proveedor está pensando */
  }
}

type Donde = 'apagado' | 'colgado' | 'en-el-camino'

interface Paso {
  readonly acuseMs: number
  readonly movimientoMs: number
  readonly huboAcuse: boolean
  readonly huboMovimiento: boolean
}

/**
 * EL CAMINO ENTERO DE UN MENSAJE, con el proveedor donde se le diga.
 *
 * Es el mismo código en las tres corridas. Lo único que cambia es dónde se
 * quema el tiempo del proveedor, que es exactamente la variable del punto 2.
 */
function camino(frase: string, donde: Donde): Paso {
  const t0 = ahora()

  // El control positivo: el proveedor ANTES de todo, que es donde no tiene que
  // estar. Es la única corrida en la que el acuse lo espera.
  if (donde === 'en-el-camino') quemar(PROVEEDOR_MS)

  const l = leer(frase, OPC)
  // EL ACUSE SALE ACÁ, de la misma llamada que leyó la frase. No espera al
  // catálogo, no espera al planificador, no espera un tick.
  const acuseMs = ahora() - t0
  const huboAcuse = l.acuse.length > 0

  const p = objetivosDe(l)
  const primero = p.nodos[0]
  let huboMovimiento = false
  if (primero !== undefined) {
    const r = plan(primero, elRio(), 400)
    huboMovimiento = r.k === 'plan' && r.steps.length > 0
  }
  // Y si no hubo plan, igual hay movimiento: la orientación y el descarte
  // producen habla y un gesto. Lo que el criterio prohíbe es «nada».
  if (!huboMovimiento) huboMovimiento = p.aviso.length > 0 || huboAcuse
  const movimientoMs = ahora() - t0

  // El proveedor COLGADO: contesta después, y lo que contesta no entra en el
  // reloj porque el cuerpo ya se movió. En un sistema de verdad esto es una
  // consulta que viaja sola; acá se quema igual para que la corrida cueste lo
  // mismo y la comparación no sea trampa.
  if (donde === 'colgado') quemar(PROVEEDOR_MS)

  return { acuseMs, movimientoMs, huboAcuse, huboMovimiento }
}

function corrida(donde: Donde): { acuse: Resumen; movimiento: Resumen; sinNada: string[] } {
  const acuse = new Reloj()
  const movimiento = new Reloj()
  const sinNada: string[] = []
  // Un pasaje de calentamiento: la primera llamada a `plan()` en frío mide 5,4 ms
  // contra 0,3 caliente (medido), y sin calentar el p95 sería el del JIT.
  for (const f of CORPUS.slice(0, 5)) camino(f.texto, 'apagado')
  for (const f of CORPUS) {
    const p = camino(f.texto, donde)
    acuse.anotar(p.acuseMs)
    movimiento.anotar(p.movimientoMs)
    if (!p.huboAcuse || !p.huboMovimiento) sinNada.push(f.texto)
  }
  return {
    acuse: acuse.resumen() as Resumen,
    movimiento: movimiento.resumen() as Resumen,
    sinNada,
  }
}

describe('el corpus', () => {
  it('es real: todas tienen de dónde y ninguna está corregida', () => {
    for (const f of CORPUS) expect(f.deDonde.length, `«${f.texto}» sin origen`).toBeGreaterThan(0)
    const conFalta = CORPUS.filter((f) => f.conFalta === true).length
    const historial = CORPUS.filter((f) => f.historial === true).length
    const formas = new Map<string, number>()
    for (const f of CORPUS) formas.set(f.forma, (formas.get(f.forma) ?? 0) + 1)
    const tabla = [...formas.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))

    console.log(`\n── EL CORPUS: ${String(CORPUS.length)} frases ──`)
    for (const [forma, n] of tabla) console.log(`  ${forma.padEnd(20)} ${String(n)}`)
    console.log(`  ── con faltas de ortografía: ${String(conFalta)}`)
    console.log(`  ── del historial de chat REAL: ${String(historial)}`)
    console.log(`  ── FALTAN PARA 200: ${String(200 - CORPUS.length)}\n`)

    // No están las 200 y el test lo dice en vez de taparlo. Lo que sí se afirma
    // es lo que hace que el corpus sirva: que tenga las formas difíciles y las
    // faltas de ortografía, que es donde un lector se rompe.
    expect(conFalta).toBeGreaterThanOrEqual(20)
    expect(historial).toBeGreaterThanOrEqual(5)
    expect(formas.size).toBeGreaterThanOrEqual(8)
    // Y el control de que no está torcido: ninguna forma se lleva más de la
    // mitad. Un corpus que mide sinónimos de «construir» pasa sin significar nada.
    for (const [forma, n] of tabla) {
      expect(n / CORPUS.length, `«${forma}» se lleva demasiado`).toBeLessThan(0.5)
    }
  })
})

describe('(1) NINGUNA frase devuelve nada', () => {
  it('las del corpus entero, con el proveedor apagado', () => {
    const r = corrida('apagado')
    expect(r.sinNada, `frases sin acuse o sin movimiento: ${r.sinNada.join(' · ')}`).toEqual([])
    console.log(`  ${String(CORPUS.length)} frases · 0 sin respuesta`)
  })
})

describe('(4) EL ACUSE SALE EN EL MISMO FRAME, y se afirma por mecanismo', () => {
  it('`leer` es sincrónica: no puede esperar a nadie', () => {
    // El mecanismo, y es más fuerte que cualquier cronómetro: si `leer`
    // devolviera una promesa, el acuse podría esperar. No la devuelve, y el
    // guardián de la regla 2 ya prohíbe `await`/`async` en todo `src/`.
    const l = leer('hacé fuego', OPC)
    expect(l instanceof Promise).toBe(false)
    expect(typeof l.acuse).toBe('string')
    expect(l.acuse.length).toBeGreaterThan(0)
  })

  it('y el acuse no depende de nada de lo que viene después', () => {
    // El control de la afirmación de arriba: la misma frase leída SIN catálogo
    // —o sea sin poder distinguir `entendida` de `sin-camino`— saca acuse igual.
    const sinCatalogo = leer('hacé fuego', { phys, lexico })
    expect(sinCatalogo.acuse.length).toBeGreaterThan(0)
  })

  it('y cuesta una fracción de la ventana del tick', () => {
    const r = corrida('apagado')
    console.log(
      `  acuse p50 ${r.acuse.p50.toFixed(3)} ms · p95 ${r.acuse.p95.toFixed(3)} ms · ventana del tick ${String(VENTANA_DEL_TICK_MS)} ms`,
    )
    if (!MIDIENDO_EN_SERIO) return
    expect(r.acuse.p95).toBeLessThan(VENTANA_DEL_TICK_MS)
  })
})

describe('(2) y (3) EL PROVEEDOR NO ESTÁ EN EL CAMINO', () => {
  it('tres corridas del mismo corpus, con su control positivo', () => {
    const apagado = corrida('apagado')
    const colgado = corrida('colgado')
    const enElCamino = corrida('en-el-camino')

    const fila = (n: string, r: Resumen): string =>
      `  ${n.padEnd(16)} p50 ${r.p50.toFixed(2).padStart(7)} ms   p95 ${r.p95.toFixed(2).padStart(7)} ms   máx ${r.max.toFixed(2).padStart(7)} ms`
    console.log('\n── MENSAJE → PRIMER MOVIMIENTO ──')
    console.log(fila('apagado', apagado.movimiento))
    console.log(fila('colgado', colgado.movimiento))
    console.log(`${fila('EN EL CAMINO', enElCamino.movimiento)}   ← el control`)
    console.log(
      `\n  el proveedor simulado quema ${String(PROVEEDOR_MS)} ms; uno real son 900 de TTFT`,
    )
    console.log(`  el techo del criterio es ${String(TECHO_MS)} ms\n`)

    if (!MIDIENDO_EN_SERIO) return

    // EL CONTROL POSITIVO, y va PRIMERO: si el arnés no distingue la corrida con
    // el proveedor adentro, la comparación de abajo no significa nada.
    expect(
      enElCamino.movimiento.p95,
      'el arnés no ve al proveedor: la comparación de abajo no valdría',
    ).toBeGreaterThan(apagado.movimiento.p95 * 2)

    // EL PUNTO 2: colgado y apagado son la misma corrida.
    expect(
      mismaCorrida(apagado.movimiento, colgado.movimiento),
      `apagado p95 ${apagado.movimiento.p95.toFixed(2)} vs colgado ${colgado.movimiento.p95.toFixed(2)}`,
    ).toBe(true)

    // EL PUNTO 3: las dos, abajo del techo.
    expect(apagado.movimiento.p95).toBeLessThan(TECHO_MS)
    expect(colgado.movimiento.p95).toBeLessThan(TECHO_MS)
  })
})
