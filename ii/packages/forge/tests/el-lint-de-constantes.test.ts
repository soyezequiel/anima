/**
 * EL LINT DE CONSTANTES FÍSICAS — Hito 8, del caso de aceptación.
 *
 * El porqué de las dos reglas y los números que las obligan están en el
 * encabezado de `src/lint.ts`. Acá se afirman contra el corpus de verdad.
 *
 * ─── LOS DOS CONTROLES, y el segundo es el que importa ──────────────────────
 *
 *   · un lint que no encuentra nada es un lint que no anda → tiene que encontrar
 *     las copias que el corpus tiene de verdad;
 *   · **un lint que encuentra de más es peor que no tenerlo** → el `aliento >
 *     0.35` de `t4` NO se marca, y eso se afirma con nombre y apellido.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as fisica from '@anima/physics'
import { describe, expect, it } from 'vitest'
import { CALIBRACIONES, comoSeArregla, loQueCopio } from '../src/lint.js'

const RAIZ = fileURLToPath(new URL('../../skills/borradores', import.meta.url))
const BORRADORES = ['t1', 't2', 't3', 't4'].flatMap((t) =>
  readdirSync(`${RAIZ}/${t}`)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ nombre: `${t}/${f}`, codigo: readFileSync(`${RAIZ}/${t}/${f}`, 'utf8') })),
)

describe('EL GUARDIÁN DE LA TABLA: los nombres siguen existiendo en la física', () => {
  it(`las ${String(CALIBRACIONES.length)} calibraciones, contra la fisica de verdad`, () => {
    // Sin esto, una constante renombrada en la física deja esta tabla apuntando a
    // un nombre muerto y el lint deja de ver esa copia — en silencio. Es la misma
    // lección del guardián del sello del Hito 7.
    const enLaFisica = fisica as unknown as Record<string, unknown>
    const faltan: string[] = []
    const cambiaron: string[] = []
    for (const c of CALIBRACIONES) {
      const v = enLaFisica[c.nombre]
      if (v === undefined) faltan.push(c.nombre)
      else if (v !== c.valor) cambiaron.push(`${c.nombre}: la tabla dice ${String(c.valor)} y la física ${String(v)}`)
    }
    console.log(`\n  ${String(CALIBRACIONES.length)} calibraciones · faltan ${String(faltan.length)} · con otro valor ${String(cambiaron.length)}\n`)
    expect(faltan, faltan.join(', ')).toEqual([])
    expect(cambiaron, cambiaron.join('\n')).toEqual([])
  })
})

describe('CONTRA EL CORPUS: qué encuentra de verdad', () => {
  it('el cuadro', () => {
    const filas: string[] = []
    let total = 0
    for (const b of BORRADORES) {
      const hs = loQueCopio(b.codigo)
      total += hs.length
      for (const h of hs) filas.push(`  ${b.nombre.padEnd(42)} ${h.motivo.padEnd(24)} ${h.texto.slice(0, 50)}`)
    }
    console.log(`\n${filas.join('\n')}\n\n  ${String(total)} copias en ${String(BORRADORES.length)} borradores\n`)
    // Un lint que no encuentra nada no sirve. El número exacto es un guardián de
    // regresión: si cambia, o cambió el corpus o cambió el lint.
    expect(total).toBeGreaterThan(0)
  })

  it('encuentra LA DESCARADA: la que re-declaró la constante con su nombre', () => {
    const b = BORRADORES.find((x) => x.nombre.includes('encender-solo-cuando-va-a-prender'))
    expect(b, 'el borrador se movió de lugar').toBeDefined()
    const hs = loQueCopio(b?.codigo ?? '')
    const porNombre = hs.filter((h) => h.motivo === 'el-nombre')
    console.log(`\n  ${porNombre.map((h) => `L${String(h.linea)}: ${h.texto}`).join('\n  ')}\n`)
    expect(porNombre.some((h) => h.constante === 'HUMEDAD_QUE_APAGA')).toBe(true)
  })

  it('y encuentra el valor pelado al lado de su cualidad', () => {
    const b = BORRADORES.find((x) => x.nombre.includes('22-retirar-lo-suyo-del-fuego'))
    expect(b, 'el borrador se movió de lugar').toBeDefined()
    const hs = loQueCopio(b?.codigo ?? '')
    console.log(`\n  ${hs.map((h) => `${h.motivo} L${String(h.linea)}: ${h.texto}`).join('\n  ')}\n`)
    expect(hs.some((h) => h.motivo === 'el-valor-y-la-cualidad' && h.constante === 'HUMEDAD_QUE_APAGA')).toBe(true)
  })
})

describe('EL CONTROL QUE IMPORTA: lo que NO se marca', () => {
  it('`aliento > 0.35` NO es una constante física, y no se marca', () => {
    // Es el falso positivo que la medición encontró: `t4` compara ALIENTO contra
    // 0.35, y 0.35 es también el valor de OXIGENO_QUE_HACE_CENIZA. Sin la regla
    // de la cualidad, el lint lo marcaría — y un lint que marca de más no lo lee
    // nadie.
    const b = BORRADORES.find((x) => x.nombre.includes('poner-distancia-con-lo-que-la-persigue'))
    expect(b, 'el borrador se movió de lugar').toBeDefined()
    const hs = loQueCopio(b?.codigo ?? '')
    const enEsaLinea = hs.filter((h) => h.texto.includes('aliento'))
    console.log(`\n  hallazgos en t4: ${String(hs.length)} · sobre «aliento»: ${String(enEsaLinea.length)}\n`)
    expect(enEsaLinea).toEqual([])
  })

  it('un `3` suelto NO se marca, aunque `MAX_ASSEMBLY_DEPTH` valga 3', () => {
    // Está en 26 de 27 borradores. Marcarlo sería rechazar el corpus entero.
    expect(loQueCopio('const cuantos = 3\n')).toEqual([])
    expect(loQueCopio('for (let i = 0; i < 3; i++) {}\n')).toEqual([])
  })

  it('y una habilidad sana no tiene un solo hallazgo', () => {
    const sana = [
      "import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'",
      "import { done } from '../../src/skill-api.js'",
      '',
      'export function* f(ctx: Ctx): Generator<Intent, Outcome, StepResult> {',
      "  ctx.phase('sana')",
      '  return done()',
      '}',
    ].join('\n')
    expect(loQueCopio(sana)).toEqual([])
  })

  it('el valor y la cualidad en LÍNEAS DISTINTAS no son una copia', () => {
    // Dos cosas que pasaban por ahí, no una calibración. Sin esta regla, un
    // archivo largo con un 0.45 arriba y un `moisture` abajo se marca solo.
    const lejos = ["const x = 0.45", "// ...", "const y = ctx.q(b, 'moisture')"].join('\n')
    expect(loQueCopio(lejos)).toEqual([])
  })
})

describe('EL MENSAJE dice qué hacer, no sólo qué está mal', () => {
  it('trae la alternativa', () => {
    const hs = loQueCopio("const HUMEDAD_QUE_APAGA = 0.45\n")
    const m = comoSeArregla(hs[0]!)
    console.log(`\n  ${m}\n`)
    expect(m).toContain('HUMEDAD_QUE_APAGA')
    expect(m).toContain('Preguntale al mundo')
  })

  it('y el del valor explica el costo, que es lo que el modelo no ve', () => {
    const hs = loQueCopio("if (ctx.q(b, 'moisture') < 0.45) return done()\n")
    const m = comoSeArregla(hs[0]!)
    console.log(`\n  ${m}\n`)
    expect(m).toContain('la física cambie')
  })
})
