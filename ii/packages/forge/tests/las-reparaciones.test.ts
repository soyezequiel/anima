/**
 * LAS REPARACIONES, medidas contra el mismo corpus de 28.
 *
 * El criterio pide «al menos una candidata compila CON reparación». Este archivo
 * mide la otra pregunta, que es la que dice si la reparación sirve: **de las 25
 * que no compilan, ¿cuántas arregla sin volver al modelo?**
 *
 * Y una que importa igual: **cuántas empeora**. Una reparación que convierte un
 * error en dos es peor que no reparar — cuesta lo mismo y confunde al que mira.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { Puerta } from '../src/puerta.js'
import { distancia, nombreInventado, reparar } from '../src/reparar.js'

const BORRADORES = fileURLToPath(new URL('../../skills/borradores/', import.meta.url))

function todos(dir: string): readonly string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = `${dir}${e}`
    if (statSync(p).isDirectory()) out.push(...todos(`${p}/`))
    else if (e.endsWith('.ts')) out.push(p)
  }
  return out.sort()
}

const CORPUS = todos(BORRADORES)

describe('las piezas sueltas', () => {
  it('el nombre inventado sale del mensaje, en las tres formas', () => {
    const casos: readonly [string, string][] = [
      ["Property 'ticksToNightfall' does not exist on type 'Clock'.", 'ticksToNightfall'],
      ['Type \'"wet"\' is not assignable to type \'QualityId\'.', 'wet'],
      ['Argument of type \'"combustion"\' is not assignable to parameter of type \'SeedProcessId\'.', 'combustion'],
    ]
    for (const [mensaje, esperado] of casos) {
      expect(nombreInventado({ codigo: 0, mensaje, linea: 1, inicio: 0 })).toBe(esperado)
    }
  })

  it('la distancia corta temprano y no miente cerca del corte', () => {
    expect(distancia('ticksToNightfall', 'secondsToNightfall', 8)).toBeLessThanOrEqual(8)
    expect(distancia('wet', 'catch', 1)).toBe(2)
    expect(distancia('igual', 'igual', 0)).toBe(0)
  })

  it('EL CORTE es lo que impide que `wet` se vuelva `catch`', () => {
    // Con un corte grande la reparación no arregla un typo: INVENTA UNA CONDUCTA
    // DISTINTA. Prefiere no reparar antes que reparar mal — una candidata que no
    // compila cuesta 47 ms; una que compila y hace otra cosa cuesta un viaje al
    // juez y un veredicto equivocado.
    const corteDeWet = Math.max(2, Math.floor('wet'.length / 3))
    expect(distancia('wet', 'catch', corteDeWet)).toBeGreaterThan(corteDeWet)
  })
})

describe('CONTRA EL CORPUS: cuántas arregla sin volver al modelo', () => {
  it('el cuadro', () => {
    const p = new Puerta(ts)
    let fallaban = 0
    let arregladas = 0
    let mejoraron = 0
    let empeoraron = 0
    let cambiosTotales = 0
    const ejemplos: string[] = []

    for (const f of CORPUS) {
      const original = readFileSync(f, 'utf8')
      const antes = p.revisar(original)
      if (antes.k === 'compila') continue
      fallaban++

      const r = reparar(original, antes.errores, p)
      if (r.k === 'sin-arreglo') continue

      cambiosTotales += r.cambios.length
      for (const c of r.cambios) {
        if (ejemplos.length < 8) ejemplos.push(`TS${String(c.codigo)}  ${c.de}  →  ${c.a}`)
      }

      const despues = p.revisar(r.codigo)
      if (despues.k === 'compila') arregladas++
      else if (despues.errores.length < antes.errores.length) mejoraron++
      else if (despues.errores.length > antes.errores.length) empeoraron++
    }

    console.log(`\n  de ${String(fallaban)} que no compilaban:`)
    console.log(`    arregladas del todo   ${String(arregladas)}`)
    console.log(`    quedaron con menos    ${String(mejoraron)}`)
    console.log(`    EMPEORARON            ${String(empeoraron)}`)
    console.log(`    reemplazos aplicados  ${String(cambiosTotales)}\n`)
    for (const e of ejemplos) console.log(`    ${e}`)

    // Lo que se afirma: que arregla algo y que NO ROMPE NADA. El número de
    // arregladas es una medición, no un objetivo — subirlo a fuerza de aflojar
    // el corte es exactamente lo que el test de arriba prohíbe.
    expect(cambiosTotales).toBeGreaterThan(0)
    expect(empeoraron, 'una reparación que agrega errores es peor que no reparar').toBe(0)
  })

  it('EL CONTROL: la reparación no toca lo que ya compila', () => {
    // Sin esto, «arregla 5» y «reescribe todo» se ven igual en el número.
    const p = new Puerta(ts)
    for (const f of CORPUS) {
      const original = readFileSync(f, 'utf8')
      const v = p.revisar(original)
      if (v.k !== 'compila') continue
      const r = reparar(original, [], p)
      expect(r.k).toBe('sin-arreglo')
    }
  })
})

describe('EL EMBUDO: dónde se cae cada error, que es el resultado del tramo', () => {
  it('los cuatro escalones, contados', () => {
    // Sin esto, «la reparación arregla 7» es un número sin explicación y la
    // primera reacción sería aflojar el corte para subirlo. El embudo dice que
    // eso no arreglaría nada: lo que queda afuera no son typos.
    const p = new Puerta(ts)
    let clase = 0
    let conNombre = 0
    let conCandidatos = 0
    let dentro = 0
    const conceptos = new Set<string>()

    for (const f of CORPUS) {
      const v = p.revisar(readFileSync(f, 'utf8'))
      if (v.k !== 'no-compila') continue
      for (const e of v.errores) {
        if (![2339, 2322, 2345].includes(e.codigo)) continue
        clase++
        const malo = nombreInventado(e)
        if (malo === undefined) continue
        conNombre++
        const deTexto = /Type '"|type '"/.test(e.mensaje)
        const cands = p
          .queSeriaValido(e.inicio)
          .filter((c) => (deTexto ? /^['"]/.test(c) : !/^['"]/.test(c)))
          .map((c) => c.replace(/^['"]|['"]$/g, ''))
        if (cands.length === 0) {
          conceptos.add(malo)
          continue
        }
        conCandidatos++
        const corte = Math.max(2, Math.floor(malo.length / 3))
        let mejorD = corte + 1
        for (const c of cands) {
          const d = distancia(malo, c, corte)
          if (d < mejorD) mejorD = d
        }
        if (mejorD <= corte) dentro++
        else conceptos.add(malo)
      }
    }

    console.log(`
  EL EMBUDO`)
    console.log(`    errores de la clase   ${String(clase)}`)
    console.log(`    con nombre extraído   ${String(conNombre)}   (los que faltan son formas de objeto, no nombres)`)
    console.log(`    con candidatos        ${String(conCandidatos)}`)
    console.log(`    dentro del corte      ${String(dentro)}   ← los typos
`)
    console.log(`  CONCEPTOS QUE EL MUNDO NO TIENE (${String(conceptos.size)}): ${[...conceptos].sort().join(', ')}`)

    // Lo que se afirma: que las dos clases EXISTEN y que la de los conceptos es
    // la grande. Es lo que manda al punto 9 en vez de a más reparaciones.
    expect(dentro).toBeGreaterThan(0)
    expect(conceptos.size).toBeGreaterThan(dentro)
  })
})

describe('el caso que el criterio nombra', () => {
  it('«al menos una compila CON reparación» — con el ejemplo mínimo', () => {
    const p = new Puerta(ts)
    const roto = `
import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done } from '../../src/skill-api.js'
export function* x(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  const t = ctx.clock.ticksToNightfall
  return done()
}`
    const antes = p.revisar(roto)
    expect(antes.k).toBe('no-compila')
    if (antes.k !== 'no-compila') return

    const r = reparar(roto, antes.errores, p)
    expect(r.k).toBe('reparado')
    if (r.k !== 'reparado') return
    console.log(`\n    ${r.cambios.map((c) => `${c.de} → ${c.a}`).join(' · ')}`)
    expect(r.cambios[0]?.a).toBe('secondsToNightfall')
    expect(p.revisar(r.codigo).k).toBe('compila')
  })
})
