// ═══ HITO 11 · punto 4 — CUÁNTOS RELOJES DE PARED QUEDAN EN LA SUITE ════════
//
// > CI determinista, benchmark real y E2E de navegador corren **aparte**.
// > Mezclarlos es cómo un banco de 500 s termina adentro de la suite compartida
// > y nadie la corre más — ya pasó dos veces en este proyecto.
//
// La tercera vez está medida y estaba en el árbol: `el-episodio.test.ts` afirma
// contra el reloj de pared, pasa 6 de 6 solo y falla con los 13 archivos del
// paquete en paralelo.
//
// ─── PERO NO ERA UN TEST: ERAN OCHO ARCHIVOS ────────────────────────────────
//
// Medido antes de tocar nada, sobre todo `ii/packages/*/tests`:
//
//     archivos que tocan el reloj de pared Y afirman ....... 8
//     paquetes involucrados ............................... 6
//
// Arreglar el que falla hoy y no mirar los otros siete sería arreglar el
// síntoma. Y arreglarlos todos de una es una barrida por seis paquetes que nadie
// puede revisar.
//
// ─── ASÍ QUE LA DEUDA SE MIDE Y SE CONGELA ──────────────────────────────────
//
// Este archivo cuenta los que quedan y compara contra una línea base que **sólo
// puede bajar**. Es el mismo mecanismo de los puntos 1 a 3 aplicado a una deuda
// en vez de a un número de rendimiento: no obliga a arreglar todo hoy, y no deja
// que crezca mañana.
//
// Un archivo que agregue una aserción de reloj sin la puerta de `reloj.ts` sube
// el número y pone esto rojo.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { CONTRA_EL_RELOJ } from './reloj.js'

/**
 * LA RAÍZ DE LOS PAQUETES. Este test lee FUERA de su paquete, y es a propósito:
 * lo que mide es una propiedad del árbol entero, no de la fragua. Ponerlo en cada
 * paquete daría ocho cuentas parciales que nadie suma.
 */
const PAQUETES = new URL('../../', import.meta.url)

/** El reloj de pared, en las tres formas que el árbol usa. */
const TOCA_EL_RELOJ = /\bhrtime\b|\bDate\.now\b|\bperformance\.now\b/

/**
 * UNA ASERCIÓN CONTRA UN TIEMPO.
 *
 * No alcanza con que el archivo toque el reloj: `el-criterio.ts` lo toca para
 * IMPRIMIR cuánto tardó, y eso no rompe nada en una máquina cargada. Lo que
 * rompe es afirmar sobre el número. Se buscan las dos formas que el árbol usa:
 * un techo (`toBeLessThan`) sobre algo que se llama como un tiempo, y el cero de
 * los ticks perdidos.
 */
const AFIRMA_UN_TIEMPO =
  /expect\([^)]*\b(?:ms|Ms|perdidos|Perdidos|atraso)\w*[^)]*\)[^\n]*\.(?:toBeLessThan|toBe)\(/

/** El fuente sin comentarios: explicar el problema no puede ser el problema. */
function sinComentarios(c: string): string {
  return c
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

/** Los archivos de test del árbol, con su paquete adelante. */
function todosLosTests(): readonly { readonly nombre: string; readonly texto: string }[] {
  const out: { nombre: string; texto: string }[] = []
  for (const paq of readdirSync(PAQUETES)) {
    if (paq === 'node_modules') continue
    const dir = new URL(`${paq}/tests/`, PAQUETES)
    let entradas: readonly string[]
    try {
      if (!statSync(dir).isDirectory()) continue
      entradas = readdirSync(dir)
    } catch {
      continue
    }
    for (const f of entradas) {
      if (!f.endsWith('.ts')) continue
      out.push({
        nombre: `${paq}/tests/${f}`,
        texto: sinComentarios(readFileSync(new URL(f, dir), 'utf8')),
      })
    }
  }
  return out
}

/** Los que afirman contra el reloj SIN pasar por la puerta de `reloj.ts`. */
function losQueQuedan(): readonly string[] {
  return todosLosTests()
    .filter((a) => TOCA_EL_RELOJ.test(a.texto) && AFIRMA_UN_TIEMPO.test(a.texto))
    .filter((a) => !/CONTRA_EL_RELOJ/.test(a.texto))
    .map((a) => a.nombre)
    .sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
}

interface LineaBase {
  readonly relojesSinPuerta: { readonly cuantos: number; readonly cuales: readonly string[] }
}

const BASE = JSON.parse(readFileSync(new URL('./linea-base.json', import.meta.url), 'utf8')) as LineaBase

describe('(Hito 11 · 4) los relojes de pared que quedan en la suite determinista', () => {
  it('el detector encuentra lo que dice encontrar, con carnada', () => {
    // Antes de contar nada: que el detector muerda. Este proyecto ya se comió
    // tres detectores rotos que daban verde por no encontrar nada.
    expect(TOCA_EL_RELOJ.test('const t = process.hrtime.bigint()')).toBe(true)
    expect(TOCA_EL_RELOJ.test('const t = tick + 1')).toBe(false)
    expect(AFIRMA_UN_TIEMPO.test('expect(ms).toBeLessThan(50)')).toBe(true)
    expect(AFIRMA_UN_TIEMPO.test('expect(r.perdidosPorLaFragua).toBe(0)')).toBe(true)
    // Y no muerde lo que sólo imprime, ni una aserción que no habla de tiempo.
    expect(AFIRMA_UN_TIEMPO.test('console.log(`${ms} ms`)')).toBe(false)
    expect(AFIRMA_UN_TIEMPO.test('expect(r.ticks).toBeGreaterThan(100)')).toBe(false)
  })

  it('no crecieron: la deuda de relojes sólo puede bajar', () => {
    const quedan = losQueQuedan()
    console.log(
      `\n─── RELOJES DE PARED SIN PUERTA ───\n` +
        `  línea base ... ${String(BASE.relojesSinPuerta.cuantos)}\n` +
        `  ahora ........ ${String(quedan.length)}\n` +
        quedan.map((f) => `    · ${f}`).join('\n') +
        `\n`,
    )

    // Que el detector esté mirando algo: si diera cero archivos de test, «no
    // creció» sería cierto sobre una lista vacía.
    expect(todosLosTests().length, 'no se leyó ni un test: el detector mira el lugar equivocado').toBeGreaterThan(50)

    expect(
      quedan.length,
      `apareció una aserción contra el reloj de pared en la suite determinista. Si es a propósito, ` +
        `pasala por la puerta de \`tests/reloj.ts\` — y si de verdad tiene que quedar, hay que subir ` +
        `\`relojesSinPuerta\` en tests/linea-base.json A MANO y escribir por qué`,
    ).toBeLessThanOrEqual(BASE.relojesSinPuerta.cuantos)
  })

  it('y la fragua ya está del lado bueno: sus tres archivos pasaron por la puerta', () => {
    // El paquete donde vivía el rojo. Es lo único que este tramo arregló de
    // verdad; el resto está contado, congelado y pendiente.
    const deLaFragua = losQueQuedan().filter((f) => f.startsWith('forge/'))
    console.log(`  archivos de forge que todavía afirman contra el reloj: ${String(deLaFragua.length)}`)
    expect(deLaFragua).toEqual([])
    // Y la puerta existe de los dos lados: apagada por omisión, encendible.
    expect(CONTRA_EL_RELOJ).toBe(process.env['ANIMA_RELOJ'] === '1')
  })
})
