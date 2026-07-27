import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EL ARNÉS DE COMPILACIÓN — Hito 0.
 *
 * Los 28 borradores de la escalera de capacidades, corridos contra
 * `skill-api.d.ts` en cada build. No prueban que las habilidades FUNCIONEN
 * —para eso hace falta mundo, y el mundo es el Hito 2—: prueban que se puedan
 * EXPRESAR, que es lo único que se puede medir hoy y ya encontró un error en el
 * ejemplo canónico del documento de arquitectura y quince huecos de superficie.
 *
 * Es un trinquete. La línea base solo puede bajar sola; para que suba hay que
 * editarla a mano y decir por qué. Se espera que suba cuando el árbitro se
 * vuelva más estricto (los roles tipados subieron 15 errores a propósito) y que
 * baje cuando la superficie se repara.
 *
 * Sin esto, el número deriva en silencio, que es exactamente el bug de
 * `DSL_REFERENCE` en Ánima I: una referencia mantenida a mano que divergió del
 * código y nadie se enteró hasta que el modelo no pudo colocar un bloque.
 */

const RAIZ = resolve(__dirname, '../../../..')
const BASE = join(__dirname, 'linea-base.json')
const TANDAS = [1, 2, 3, 4] as const

interface ErrorTsc {
  archivo: string
  codigo: string
  mensaje: string
}

function compilar(tanda: number): ErrorTsc[] {
  const r = spawnSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-p', `ii/packages/skills/tsconfig.t${tanda}.json`],
    { cwd: RAIZ, encoding: 'utf8' },
  )
  const salida = (r.stdout ?? '') + (r.stderr ?? '')
  if (!salida.trim() && r.status !== 0) {
    throw new Error(`tsc no produjo salida y salió con ${r.status}. ¿Se movió el tsconfig?`)
  }
  const out: ErrorTsc[] = []
  for (const cruda of salida.split('\n')) {
    // Ojo: las líneas vienen con CRLF y en JS `.` no matchea \r.
    const m = cruda.trimEnd().match(/^(.+?\.ts)\((\d+),(\d+)\): error (TS\d+): (.+)$/)
    const [, ruta, , , codigo, mensaje] = m ?? []
    if (ruta && codigo && mensaje) {
      out.push({ archivo: ruta.split('/').pop() ?? ruta, codigo, mensaje })
    }
  }
  return out
}

const errores = TANDAS.flatMap(compilar)
const conError = new Set(errores.map((e) => e.archivo))
const todos = TANDAS.flatMap((t) =>
  readdirSync(join(__dirname, '..', 'borradores', `t${t}`)).filter((f) => f.endsWith('.ts')),
).concat(readdirSync(join(__dirname, '..', 'borradores')).filter((f) => f.endsWith('.ts')))
const limpios = todos.filter((f) => !conError.has(f)).sort()

const base = JSON.parse(readFileSync(BASE, 'utf8')) as {
  errores: number
  limpiosMinimo: string[]
  nota: string
}

describe('arnés de compilación de la escalera de capacidades', () => {
  it('el ejemplo canónico del documento de arquitectura compila', () => {
    // Si esto se rompe, el `.d.ts` dejó de representar lo que el documento
    // promete, y cualquier medición posterior está apoyada en arena.
    expect(conError.has('00-pescar-con-aparejo.ts')).toBe(false)
  })

  it('no crece la cantidad de errores de tipos', () => {
    // Trinquete. Si sube legítimamente —porque el árbitro se volvió más
    // estricto— hay que editar `linea-base.json` A MANO y explicar por qué.
    expect(errores.length).toBeLessThanOrEqual(base.errores)
  })

  it('ningún borrador que compilaba deja de compilar', () => {
    const perdidos = base.limpiosMinimo.filter((f) => conError.has(f))
    expect(perdidos, `dejaron de compilar: ${perdidos.join(', ')}`).toEqual([])
  })

  it('ningún borrador usa escapes para tapar un hueco', () => {
    // La regla de oro del ejercicio: el error de compilación ES el resultado.
    // Un `as any` convierte un hallazgo en un falso verde.
    const culpables: string[] = []
    for (const t of TANDAS) {
      const dir = join(__dirname, '..', 'borradores', `t${t}`)
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
        const src = readFileSync(join(dir, f), 'utf8')
        if (/@ts-(ignore|expect-error|nocheck)|\bas\s+any\b/.test(src)) culpables.push(`t${t}/${f}`)
      }
    }
    expect(culpables, `usan escapes: ${culpables.join(', ')}`).toEqual([])
  })

  it('deja el reporte al día', () => {
    const porFalta = new Map<string, Set<string>>()
    for (const e of errores) {
      let k = e.mensaje
      let m: RegExpMatchArray | null
      if ((m = e.mensaje.match(/Property '(.+?)' does not exist on type '(.+?)'/))) k = `${m[2]}.${m[1]}`
      else if ((m = e.mensaje.match(/type '"(.+?)"' is not assignable to type 'QualityId'/i))) k = `cualidad: ${m[1]}`
      else if ((m = e.mensaje.match(/of type '"(.+?)"' is not assignable to parameter of type 'ProcessId'/))) k = `proceso: ${m[1]}`
      if (!porFalta.has(k)) porFalta.set(k, new Set())
      porFalta.get(k)!.add(e.archivo)
    }
    writeFileSync(
      join(RAIZ, 'ii/docs/huecos-medidos-actual.json'),
      JSON.stringify(
        {
          totalErrores: errores.length,
          borradores: todos.length,
          conErrores: conError.size,
          limpios,
          filas: [...porFalta.entries()]
            .map(([falta, a]) => ({ falta, archivos: a.size }))
            .sort((x, y) => y.archivos - x.archivos),
        },
        null,
        1,
      ),
    )
    expect(limpios.length).toBeGreaterThanOrEqual(base.limpiosMinimo.length)
  })
}, 120_000)
