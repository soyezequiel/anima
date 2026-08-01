/**
 * LAS RUTAS QUE UN PAQUETE ESCRIBE SOBRE OTRO TIENEN QUE EXISTIR.
 *
 * ─── De dónde salió: lo rompí en el tramo A de este mismo hito ──────────────
 *
 * El renombre de `@anima/juez` a `@anima/emergencia` se midió antes de mover
 * nada, y la medición dijo: **18 menciones, ninguna un `import`**. Con eso se
 * declaró contenido y salió barato.
 *
 * Estaba incompleta. `oracle/tests/presupuesto.test.ts` no importaba nada del
 * paquete viejo: **le leía un archivo por ruta relativa**.
 *
 *     const arnes = fileURLToPath(new URL('../../juez/tests/el-banco-de-la-mente.ts', …))
 *
 * Ni `@anima/juez` ni `packages/juez/` aparecen ahí, así que las dos búsquedas
 * dieron limpio y el árbol quedó roto **dos commits**. Lo encontró la suite
 * entera al final, que es tarde pero es.
 *
 * Y había nueve más en comentarios: no rompían nada, pero mandaban al que las
 * leyera a un directorio que ya no existe.
 *
 * ─── Qué guarda, exactamente ────────────────────────────────────────────────
 *
 * Toda mención de `<paquete>/src/…` o `<paquete>/tests/…` en cualquier fuente de
 * `ii/packages/`, venga de código o de prosa. Si el paquete no existe, rojo.
 *
 * **La prosa entra a propósito**, y es lo que lo hace valer: un comentario que
 * dice «esto está medido en `juez/tests/azar.ts`» es una afirmación
 * verificable, y una afirmación que apunta a la nada es peor que ninguna — manda
 * a buscar una evidencia que no está donde dice.
 *
 * ─── Por qué vive acá ───────────────────────────────────────────────────────
 *
 * Porque es un guardián de todo el árbol y no de un paquete, y ya hay precedente
 * de eso: `world/tests/sin-nombres-especiales.test.ts` escanea `ii/packages/`
 * entero desde adentro de `@anima/world`. Éste hace lo mismo desde el paquete
 * que lo necesitó. Mudarlo es mover un archivo.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PAQUETES = fileURLToPath(new URL('../../', import.meta.url))

const NOMBRES = readdirSync(PAQUETES, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== 'node_modules')
  .map((e) => e.name)

function fuentesDe(dir: string): readonly string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}${e.name}`
    if (e.name === 'node_modules' || e.name === 'dist') continue
    if (e.isDirectory()) out.push(...fuentesDe(`${p}/`))
    else if (/\.(ts|mts|mjs)$/.test(e.name)) out.push(p)
  }
  return out
}

/**
 * `<algo>/src/…` o `<algo>/tests/…`, donde `<algo>` parece un nombre de paquete.
 *
 * El `[a-z][a-z-]*` de adelante es lo que separa una ruta de paquete de una ruta
 * relativa cualquiera: `./src/tipos.ts` y `../tests/mundo.ts` no matchean, y son
 * la mayoría abrumadora de las rutas que hay escritas.
 */
const RUTA = /(?:^|[\s'"`(\\/])([a-z][a-z0-9-]{2,})\/(src|tests)\/([A-Za-z0-9./-]+\.(?:ts|mts|mjs))/g

describe('las rutas cruzadas entre paquetes', () => {
  const fuentes = fuentesDe(PAQUETES)

  it(`los ${String(NOMBRES.length)} paquetes, barridos entero: ninguna ruta apunta a la nada`, () => {
    const rotas: string[] = []
    let miradas = 0
    for (const f of fuentes) {
      // Este archivo se saltea a sí mismo, y no es comodidad: su control
      // positivo contiene una ruta rota A PROPÓSITO. Sin la excepción, el
      // guardián se reporta a sí mismo y nunca puede estar verde.
      if (f.endsWith('las-rutas-cruzadas-existen.test.ts')) continue
      const texto = readFileSync(f, 'utf8')
      for (const m of texto.matchAll(RUTA)) {
        const [, paquete, carpeta, resto] = m
        if (paquete === undefined || carpeta === undefined || resto === undefined) continue
        // Sólo nos metemos con lo que dice ser un paquete de `ii/packages/`.
        // Cualquier otra cosa —`node_modules/x/src/y.ts`, una ruta de Ánima I—
        // no es asunto de este guardián.
        if (!NOMBRES.includes(paquete)) continue
        miradas++
        const destino = `${PAQUETES}${paquete}/${carpeta}/${resto}`
        if (!existsSync(destino)) {
          rotas.push(`${f.slice(PAQUETES.length)} → ${paquete}/${carpeta}/${resto}`)
        }
      }
    }
    console.log(`\n  ${String(fuentes.length)} fuentes · ${String(miradas)} rutas a paquetes de ii/ · rotas: ${String(rotas.length)}`)
    expect(rotas, rotas.join('\n')).toEqual([])
  })

  it('EL CONTROL: el detector encuentra una rota cuando la hay', () => {
    // Sin esto, el de arriba está verde por no haber nada roto y no prueba que
    // sepa encontrarlo. Es la tercera vez en este hito que hace falta decirlo.
    const inventado = `const x = new URL('../../emergencia/tests/no-existe-jamas.ts', y)`
    const hallazgos = [...inventado.matchAll(RUTA)]
    expect(hallazgos.length).toBe(1)
    expect(existsSync(`${PAQUETES}emergencia/tests/no-existe-jamas.ts`)).toBe(false)

    // Y el control del otro lado: una que SÍ existe no se reporta.
    const bueno = `ver \`emergencia/tests/azar.ts\``
    const ok = [...bueno.matchAll(RUTA)]
    expect(ok.length).toBe(1)
    expect(existsSync(`${PAQUETES}emergencia/tests/azar.ts`)).toBe(true)
  })

  it('y NO se come las rutas relativas comunes, que son la mayoría', () => {
    // Si `./src/x.ts` o `../tests/mundo.ts` matchearan, este guardián reportaría
    // cientos de falsos y estaría desactivado antes de la semana.
    for (const r of ['./src/tipos.ts', '../tests/mundo.ts', '../../src/index.ts']) {
      expect([...r.matchAll(RUTA)].filter((m) => NOMBRES.includes(m[1] ?? '')).length, r).toBe(0)
    }
  })

  it('el barrido mira algo de verdad, y se ve cuánto', () => {
    expect(fuentes.length).toBeGreaterThan(100)
    expect(statSync(PAQUETES).isDirectory()).toBe(true)
  })
})
