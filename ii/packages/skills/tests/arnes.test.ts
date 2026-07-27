import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EL ARNÉS DE COMPILACIÓN — Hito 0, re-apuntado en el Hito 4.
 *
 * Los 28 borradores de la escalera de capacidades, corridos contra
 * `skill-api.d.ts` en cada build. No prueban que las habilidades FUNCIONEN
 * —para eso hace falta mundo, y el mundo es el Hito 2—: prueban que se puedan
 * EXPRESAR, que es lo único que se puede medir hoy y ya encontró un error en el
 * ejemplo canónico del documento de arquitectura y quince huecos de superficie.
 *
 * ─── LO QUE CAMBIÓ EN EL HITO 4, y es lo que este hito existía para tener ────
 *
 * `skill-api.d.ts` DEJÓ DE ESCRIBIRSE A MANO. Ahora lo emite `tsc --declaration`
 * de `src/tipos.ts` + `src/ctx.ts`, o sea de código real que importa
 * `@anima/physics`, `@anima/world` y `@anima/oracle`. El árbitro pasó de ser una
 * transcripción a ser el mundo. El número subió, y ese salto es la medición:
 * **64 → 84 errores, 10 → 3 borradores limpios**. Ver `linea-base.json`, que
 * lleva el porqué de cada uno de los 20 errores nuevos.
 *
 * ─── DOS BUGS DEL PROPIO ARNÉS, reparados acá ───────────────────────────────
 *
 * 1. **El ejemplo canónico nunca se compilaba.** Vive en `borradores/` y las
 *    tandas t1..t4 incluían `borradores/tN`, así que `conError.has('00-…')` era
 *    siempre `false` y el assert estaba trivialmente verde. Ahora hay una tanda 0
 *    y el ejemplo se compila: da tres errores, y están abajo con su porqué.
 * 2. **Se contaban errores que no eran del corpus.** El contador tomaba
 *    cualquier línea de `tsc`, y las tandas incluían `src`. Mientras `src/` era
 *    el `.d.ts` y nada más eso daba igual; con el ejecutor, el combustible y las
 *    quince innatas adentro, el número del trinquete se habría movido porque
 *    alguien rompió un archivo de runtime. Ahora solo cuenta `borradores/`, y
 *    hay un test que verifica que ninguna tanda esté arrastrando otra cosa.
 *
 * Es un trinquete. La línea base solo puede bajar sola; para que suba hay que
 * editarla a mano y decir por qué. Sin esto, el número deriva en silencio, que es
 * exactamente el bug de `DSL_REFERENCE` en Ánima I: una referencia mantenida a
 * mano que divergió del código y nadie se enteró hasta que el modelo no pudo
 * colocar un bloque.
 */

const RAIZ = resolve(__dirname, '../../../..')
const BASE = join(__dirname, 'linea-base.json')
const CORPUS = join(__dirname, '..', 'borradores')
/** La 0 es el ejemplo canónico, que vive suelto en `borradores/`. */
const TANDAS = [0, 1, 2, 3, 4] as const
const dirDe = (t: number): string => (t === 0 ? CORPUS : join(CORPUS, `t${t}`))

interface ErrorTsc {
  archivo: string
  ruta: string
  linea: number
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
    const [, ruta, linea, , codigo, mensaje] = m ?? []
    if (ruta && linea && codigo && mensaje) {
      out.push({
        archivo: ruta.split(/[\\/]/).pop() ?? ruta,
        ruta: ruta.replace(/\\/g, '/'),
        linea: Number(linea),
        codigo,
        mensaje,
      })
    }
  }
  return out
}

const crudos = TANDAS.flatMap(compilar)
/** SOLO el corpus. Un error de `src/` no es un hueco de la superficie: es un bug. */
const errores = crudos.filter((e) => e.ruta.includes('borradores/'))
const ajenos = crudos.filter((e) => !e.ruta.includes('borradores/'))
const conError = new Set(errores.map((e) => e.archivo))
const todos = TANDAS.flatMap((t) => readdirSync(dirDe(t)).filter((f) => f.endsWith('.ts')))
const limpios = todos.filter((f) => !conError.has(f)).sort()

const base = JSON.parse(readFileSync(BASE, 'utf8')) as {
  errores: number
  limpiosMinimo: string[]
  nota: string
}

const erroresDe = (archivo: string): ErrorTsc[] => errores.filter((e) => e.archivo === archivo)

describe('arnés de compilación de la escalera de capacidades', () => {
  it('el corpus es de 28 borradores y las cinco tandas los compilan a todos', () => {
    // Sin esto, mover un archivo de carpeta cambia el número medido sin que nadie
    // se entere. Es el bug que tuvo este arnés durante todo el Hito 0.
    expect(todos.length).toBe(28)
    expect(new Set(todos).size).toBe(28)
  })

  it('el arnés no cuenta errores que no sean del corpus', () => {
    // El trinquete mide cuánto del mundo se puede EXPRESAR. Si contara los
    // errores de `src/`, mediría además si el ejecutor compila, y dos cosas
    // contadas en el mismo número no son medibles ninguna de las dos.
    expect(ajenos.map((e) => `${e.ruta}:${e.linea} ${e.mensaje}`)).toEqual([])
  })

  it('EL EJEMPLO CANÓNICO DEL DOCUMENTO NO COMPILA, y por qué', () => {
    // Hasta el Hito 4 este assert decía `.toBe(false)` y estaba trivialmente
    // verde: el archivo no lo compilaba ninguna tanda. Compilado de verdad contra
    // la superficie EMITIDA del código real, da tres errores y los tres son el
    // mismo: el documento busca agua con `see([{ q: 'wet' }])`, o sea busca un
    // CUERPO por una cualidad de CELDA.
    //
    // No es un defecto de la emisión: es el mundo contestando. El agua es un
    // campo por celda —un lago de 4000 celdas como entidades serían 4000 objetos
    // que filtrar diez veces por tick— así que buscar agua es `qAt`, `recall` o
    // `explore`, nunca `see`. La superficie ya tiene con qué: `PerceptionView.qAt`
    // y `recall(WhereCell)` existen justamente para que esto sea expresable.
    //
    // Se deja ROJO a propósito. Repararlo acá sería arreglar la medición: el
    // ejemplo es del documento de arquitectura y lo que hay que corregir es el
    // documento. El test se pone rojo si aparece un error DISTINTO —o si dejan de
    // aparecer—, que es cuando alguien tiene que volver a mirar.
    const del00 = erroresDe('00-pescar-con-aparejo.ts')
    expect(del00.map((e) => `${e.linea}: ${e.mensaje}`)).toEqual([
      `37: Type '"wet"' is not assignable to type 'QualityId'.`,
      `40: Type '"wet"' is not assignable to type 'QualityId'.`,
      `44: Type '"wet"' is not assignable to type 'QualityId'.`,
    ])
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

  it('los 20 errores nuevos del Hito 4 son SEIS causas, y ninguna es una capacidad perdida', () => {
    // La otra mitad de la medición. Que el número suba no dice nada por sí solo;
    // lo que dice algo es que TODO el aumento se explique por sitios donde la
    // superficie a mano dejaba escribir algo que el mundo no puede hacer.
    //
    // Si mañana el número sube por otra causa, esta lista deja de cuadrar y el
    // test se pone rojo antes de que el trinquete se toque.
    const causa = (m: string): string | undefined => {
      let x: RegExpMatchArray | null
      if ((x = m.match(/Type '"(.+?)"' is not assignable to type 'QualityId'\./))) return `cualidad de cuerpo: ${x[1]}`
      if ((x = m.match(/of type '"(.+?)"' is not assignable to parameter of type 'QualityId'/)))
        return `cualidad de cuerpo: ${x[1]}`
      if ((x = m.match(/Type '"(.+?)"' is not assignable to type 'CellQuality'\./))) return `cualidad de celda: ${x[1]}`
      if ((x = m.match(/Property '(.+?)' does not exist on type '(.+?)'/))) return `${x[2]}.${x[1]}`
      return undefined
    }
    const cuenta = (k: string): number => errores.filter((e) => causa(e.mensaje) === k).length

    // wet: 9 sitios. El agua es un campo de CELDA. Buscar agua con `see` busca un
    // cuerpo por una cualidad que los cuerpos no tienen — la misma familia que
    // `q(fogata,'oxygen')`, que typechequeaba y contestaba el oxígeno del cuerpo
    // mientras la ley 4 lee el de la celda.
    expect(cuenta('cualidad de cuerpo: wet')).toBe(9)
    // hunger: 4 sitios. La física NO TIENE ninguna cualidad `hunger`. Lo que
    // duele es `stamina`, que es conservada y la drena el metabolismo.
    expect(cuenta('SelfView.hunger')).toBe(4)
    // stock: 2 sitios. Hueco ya anotado en la física: EXTRACCION usa `mass > 0`
    // como stock restante. Antes typechequeaba y devolvía un número sin sentido.
    expect(cuenta('cualidad de cuerpo: stock')).toBe(2)
    // ticksToNightfall: 2 sitios. ADR II-0008 — esperar es ritmo, no muestreo.
    expect(cuenta('Clock.ticksToNightfall')).toBe(2)
    // charred / fuelEnergy / mass sobre `recall`: 3 sitios. `recall` filtra
    // LUGARES, y un lugar no tiene masa ni combustible: tiene las cuatro
    // cualidades de celda.
    expect(
      ['charred', 'fuelEnergy', 'mass'].reduce((n, q) => n + cuenta(`cualidad de celda: ${q}`), 0),
    ).toBe(3)
  })

  it('ningún borrador usa escapes para tapar un hueco', () => {
    // La regla de oro del ejercicio: el error de compilación ES el resultado.
    // Un `as any` convierte un hallazgo en un falso verde.
    const culpables: string[] = []
    for (const t of TANDAS) {
      for (const f of readdirSync(dirDe(t)).filter((x) => x.endsWith('.ts'))) {
        const src = readFileSync(join(dirDe(t), f), 'utf8')
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
      else if ((m = e.mensaje.match(/type '"(.+?)"' is not assignable to type 'CellQuality'/i)))
        k = `cualidad de celda: ${m[1]}`
      else if ((m = e.mensaje.match(/of type '"(.+?)"' is not assignable to parameter of type '(\w+)'/)))
        k = `${m[2]}: ${m[1]}`
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
