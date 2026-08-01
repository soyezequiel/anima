/**
 * LA PUERTA, contra los 28 borradores que ya existían.
 *
 * No se inventó un corpus: `skills/borradores/` tiene **28 habilidades escritas
 * a mano** para medir si la API alcanzaba, y su auditoría cuenta **112 errores
 * de tipos**. Son candidatas de verdad, escritas por alguien que intentaba que
 * compilaran — que es exactamente lo que la fragua va a recibir del modelo.
 *
 * ─── Y este archivo NO escribe las reparaciones: las MIDE ───────────────────
 *
 * El criterio del hito pide «diez reparaciones deterministas». Escribir diez
 * antes de ver un solo error real es el mismo vicio que el `80%`, el `200` y el
 * `110` del Hito 6: **un número puesto antes de medir**.
 *
 * Así que acá sale la distribución de códigos de error sobre el corpus, y de ahí
 * salen las reparaciones — en su tramo, con los datos delante.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { normalizarImports, Puerta } from '../src/puerta.js'

const BORRADORES = fileURLToPath(new URL('../../skills/borradores/', import.meta.url))

function todosLosBorradores(dir: string): readonly string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = `${dir}${e}`
    if (statSync(p).isDirectory()) out.push(...todosLosBorradores(`${p}/`))
    else if (e.endsWith('.ts')) out.push(p)
  }
  return out.sort()
}

const CORPUS = todosLosBorradores(BORRADORES)

/** Una habilidad mínima que SÍ compila. El control de que la puerta deja pasar. */
const BUENA = `
import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done } from '../../src/skill-api.js'

export function* quieta(ctx: Ctx, _args: Record<string, never>): Generator<Intent, Outcome, StepResult> {
  ctx.phase('quieta')
  return done()
}
`

describe('LA PUERTA distingue, que es lo único que se le pide', () => {
  const p = new Puerta(ts)

  it('deja pasar una habilidad sana', () => {
    // Sin esto, «rechaza todo» y «es una puerta» se ven igual.
    const v = p.revisar(BUENA)
    if (v.k === 'no-compila') console.log(`\n  la buena NO pasó: ${v.errores.map((e) => e.mensaje).join(' · ')}`)
    expect(v.k).toBe('compila')
  })

  it('y frena una rota, diciendo QUÉ', () => {
    const v = p.revisar(BUENA.replace('return done()', 'return done(42)'))
    expect(v.k).toBe('no-compila')
    if (v.k === 'no-compila') {
      console.log(`  la rota: TS${String(v.errores[0]?.codigo)} línea ${String(v.errores[0]?.linea)} — ${v.errores[0]?.mensaje ?? ''}`)
      expect(v.errores.length).toBeGreaterThan(0)
      expect(v.errores[0]?.linea).toBeGreaterThan(0)
    }
  })

  it('un error de SINTAXIS corta antes, sin el ruido derivado', () => {
    // Con un paréntesis sin cerrar los semánticos son consecuencias, no causas.
    const v = p.revisar(BUENA.replace('return done()', 'return done('))
    expect(v.k).toBe('no-compila')
    if (v.k === 'no-compila') console.log(`  la sintáctica: ${String(v.errores.length)} error(es)`)
  })

  it('EL CONTROL DE LA RANURA: si el servicio no viera el archivo, todo pasaría', () => {
    // Es la peor forma de fallar de una puerta —no ver nada y dejar pasar todo—
    // y por eso se afirma que la rota de arriba SÍ dio errores. Acá se cierra el
    // otro lado: código que no es TypeScript ni por casualidad.
    const v = p.revisar('esto no es typescript ((( ')
    expect(v.k).toBe('no-compila')
  })
})

describe('CONTRA EL CORPUS: los 28 borradores que ya existían', () => {
  it('la distribución de errores, que es de donde van a salir las reparaciones', () => {
    const p = new Puerta(ts)
    const porCodigo = new Map<number, { n: number; ejemplo: string }>()
    let compilan = 0
    let errores = 0

    for (const f of CORPUS) {
      const v = p.revisar(readFileSync(f, 'utf8'))
      if (v.k === 'compila') {
        compilan++
        continue
      }
      errores += v.errores.length
      for (const e of v.errores) {
        const y = porCodigo.get(e.codigo)
        if (y === undefined) porCodigo.set(e.codigo, { n: 1, ejemplo: e.mensaje })
        else y.n += 1
      }
    }

    console.log(`\n  ${String(CORPUS.length)} borradores · compilan ${String(compilan)} · fallan ${String(CORPUS.length - compilan)} · ${String(errores)} errores\n`)
    console.log(`  ${'código'.padEnd(8)} ${'veces'.padStart(6)}  qué dice`)
    const orden = [...porCodigo.entries()].sort((a, b) => (b[1].n === a[1].n ? a[0] - b[0] : b[1].n - a[1].n))
    for (const [codigo, { n, ejemplo }] of orden.slice(0, 12)) {
      console.log(`  TS${String(codigo).padEnd(6)} ${String(n).padStart(6)}  ${ejemplo.slice(0, 90)}`)
    }
    const top = orden.slice(0, 3).reduce((s, [, v]) => s + v.n, 0)
    console.log(`\n  los 3 códigos más comunes son ${String(top)} de ${String(errores)} errores (${((top / errores) * 100).toFixed(0)}%)`)

    // LA PUERTA TIENE QUE DISTINGUIR. Un corpus donde compilan todos o ninguno
    // no dice nada sobre si la puerta sirve.
    expect(compilan).toBeGreaterThan(0)
    expect(compilan).toBeLessThan(CORPUS.length)
    expect(porCodigo.size).toBeGreaterThan(0)
  })

  it('EL HALLAZGO: los tres errores más comunes son EL MISMO error', () => {
    // 86% de los errores del corpus son TS2339, TS2322 y TS2345, y los tres
    // dicen lo mismo con distinta cara:
    //
    //   TS2339  Property 'ticksToNightfall' does not exist on type 'Clock'
    //   TS2322  Type '"wet"' is not assignable to type 'QualityId'
    //   TS2345  Argument of type '"combustion"' is not assignable to 'SeedProcessId'
    //
    // **Inventó un nombre que la API no tiene.** Una propiedad, una cualidad, un
    // proceso — tres vocabularios CERRADOS y el mismo modo de fallar.
    //
    // Eso cambia el diseño de las «diez reparaciones deterministas» que el
    // criterio pide: no son diez reglas sueltas. La dominante es UNA sola, «ese
    // nombre no existe, acá está el catálogo», aplicada a distintos catálogos.
    // Escribir diez antes de esta medición habría repartido el esfuerzo al revés.
    const p = new Puerta(ts)
    const invento = new Set([2339, 2322, 2345])
    let deInvento = 0
    let total = 0
    for (const f of CORPUS) {
      const v = p.revisar(readFileSync(f, 'utf8'))
      if (v.k === 'no-compila') {
        for (const e of v.errores) {
          total += 1
          if (invento.has(e.codigo)) deInvento += 1
        }
      }
    }
    console.log(`\n  «inventó un nombre»: ${String(deInvento)} de ${String(total)} errores (${((deInvento / total) * 100).toFixed(0)}%)`)
    expect(deInvento / total).toBeGreaterThan(0.6)
  })

  it('y la cuenta NO es la que dice la auditoría vieja — se re-midió', () => {
    // `escalera-capacidades.md` cuenta **112 errores** y acá salen 83. No se
    // copió el número: se corrió. La diferencia puede ser el corpus (esa
    // auditoría contaba borradores que no están) o la API, que se movió desde
    // entonces. Lo que vale es el número de hoy, y queda dicho que son dos.
    const p = new Puerta(ts)
    let total = 0
    for (const f of CORPUS) {
      const v = p.revisar(readFileSync(f, 'utf8'))
      if (v.k === 'no-compila') total += v.errores.length
    }
    expect(total).toBeGreaterThan(0)
    expect(total).not.toBe(112)
  })

  it('UNA sola puerta para las 28: el reuso es lo que compra los 47 ms', () => {
    // Construir una `Puerta` por candidata es exactamente lo que el banco midió
    // como `createProgram` por candidata: +319 ms cada una.
    const p = new Puerta(ts)
    for (const f of CORPUS) p.revisar(readFileSync(f, 'utf8'))
    expect(p.revisadas).toBe(CORPUS.length)
  })
})

describe('LOS ENTEROS DE LOS ENUMS, que están escritos a mano', () => {
  it('son los que TypeScript dice hoy — si los renumerara, esto se pone rojo', () => {
    // `OPCIONES` es una constante de módulo y los enums viven en el objeto que
    // se RECIBE, así que los tres valores están escritos como número. Eso los
    // deja libres de derivar en silencio: si una versión de TypeScript los
    // moviera, la puerta compilaría contra otro target sin que nadie lo note.
    console.log(
      `
  ES2022=${String(ts.ScriptTarget.ES2022)} · ESNext=${String(ts.ModuleKind.ESNext)} · Bundler=${String(ts.ModuleResolutionKind.Bundler)}`,
    )
    expect(ts.ScriptTarget.ES2022).toBe(9)
    expect(ts.ModuleKind.ESNext).toBe(99)
    expect(ts.ModuleResolutionKind.Bundler).toBe(100)
  })
})

describe('la normalización del import', () => {
  it('cualquier profundidad cae en la misma ruta', () => {
    for (const r of ["'../../src/skill-api.js'", "'../src/skill-api.js'", '"../../../x/skill-api.js"']) {
      expect(normalizarImports(`import { done } from ${r}`)).toBe(
        "import { done } from '../skills/src/skill-api.js'",
      )
    }
  })

  it('pero NO toca lo que se importa: pedir un símbolo que no existe sigue siendo error', () => {
    const p = new Puerta(ts)
    const v = p.revisar(BUENA.replace('import { done }', 'import { done, noExisteEsto }'))
    expect(v.k).toBe('no-compila')
  })
})
