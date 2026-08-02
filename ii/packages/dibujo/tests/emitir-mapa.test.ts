// ─── EL MAPA DE UNA PARTIDA DE VERDAD ───────────────────────────────────────
//
// Es la prueba que ninguna de las anteriores podía dar: **veinte objetos juntos,
// con la densidad que el dios decreta**, y no una escena que elija quien escribe
// el test. La diferencia importa — inventando la escena uno elige la densidad y
// se engaña solo, que es exactamente el error que este árbol ya cometió con el
// catálogo: *medir el catálogo no es medir el mundo*.
//
// Por eso acá se busca una orilla en el mundo decretado, se planta la criatura y
// se corre `stepWorld` hasta que el dios materialice lo que haya. Lo que salga,
// salió.
//
// El SVG va comprimido por tramos horizontales de color igual: un mapa de 15×15
// celdas son 176.400 píxeles, y un rectángulo por píxel es un archivo que no
// abre. Con tramos son unos pocos miles.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { HZ_DE_REFERENCIA, buildSeedPhysics, type Body, type Physics } from '@anima/physics'
import {
  crearDios,
  decretoDe,
  escenaDe,
  mapaDeActores,
  mapaDeCuerpos,
  relojDe,
  stepWorld,
  type EstadoDelDios,
  type WorldState,
} from '@anima/world'

import { CELDA, mapaDe, type Pintado } from '../src/mapa.js'

const PHYS: Physics = buildSeedPhysics()
const SEMILLA = 20260727n
const RADIO = 7
const SALIDA = fileURLToPath(new URL('../../../docs/visor/mapa.html', import.meta.url))

// ─── Los mismos helpers que `world/tests/mundo-minimo.ts`, que no se puede
// ─── importar desde otro paquete. Son cinco líneas y se copian a propósito.

function cuerpo(id: string, substance: string, mass: number): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state: {} }
}

function criatura(id: string, stamina: number): Body {
  return {
    id: `${id}-cuerpo`,
    form: 'bloque',
    parts: [{ substance: 'carne', mass: 60, q: {} }],
    joints: [],
    state: { stamina },
  }
}

/** La misma orilla que usa el visor de la partida: pozo con una celda seca al lado. */
function buscarOrilla(dios: EstadoDelDios): { dios: EstadoDelDios; parada: { x: number; y: number } } {
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      const dec = decretoDe(dios, PHYS, cx, cy)
      if (dec.pozo === undefined) continue
      const p = dec.pozo.at
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const parada = { x: p.x + dx, y: p.y + dy }
        const v = decretoDe(dios, PHYS, Math.floor(parada.x / 16), Math.floor(parada.y / 16))
        const i = (((parada.y % 16) + 16) % 16) * 16 + (((parada.x % 16) + 16) % 16)
        if ((v.celdas[i] as { wet: number }).wet < 0.9) return { dios, parada }
      }
    }
  }
  throw new Error('la semilla no tiene una sola orilla en 13x13 chunks')
}

const O = buscarOrilla(crearDios(SEMILLA))

function mundoInicial(): WorldState {
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos([
      { body: criatura('ana', 2000), at: O.parada },
      { body: cuerpo('vara', 'madera', 0.5), at: O.parada },
      { body: cuerpo('hebra', 'liana', 0.2), at: { x: O.parada.x + 1, y: O.parada.y } },
    ]),
    actors: mapaDeActores([{ id: 'ana', body: 'ana-cuerpo', holding: [], capacity: 4, permits: 'irreversible' }]),
    cells: new Map(),
    desplegados: new Map(),
    nextId: 1,
    dios: O.dios,
  }
}

function svgDe(p: Pintado): string {
  let s = `<svg viewBox="0 0 ${String(p.lado)} ${String(p.lado)}" width="${String(p.lado)}" height="${String(p.lado)}" shape-rendering="crispEdges">`
  for (let y = 0; y < p.px.length; y++) {
    const fila = p.px[y]
    if (fila === undefined) continue
    let x = 0
    while (x < fila.length) {
      const color = fila[x]
      let hasta = x + 1
      while (hasta < fila.length && fila[hasta] === color) hasta++
      if (color !== undefined && color !== '') {
        s += `<rect x="${String(x)}" y="${String(y)}" width="${String(hasta - x)}" height="1" fill="${color}"/>`
      }
      x = hasta
    }
  }
  return s + '</svg>'
}

describe('el mapa de una partida', () => {
  it('SE DIBUJA, con la densidad que el dios decreta', () => {
    let w = mundoInicial()
    // Cien ticks quietos: alcanza para que el dios materialice los chunks del
    // radio y para que la física haga lo suyo con lo que sembró.
    for (let i = 0; i < 100; i++) w = stepWorld(w, []).state

    const e = escenaDe(w, O.parada, RADIO)
    const reloj = relojDe(w)
    const pintado = mapaDe(e, PHYS, reloj)

    // ─── Lo que este test SÍ puede afirmar ─────────────────────────────────
    //
    // Que se ve bien no lo firma nadie más que el usuario. Lo que sí se puede
    // afirmar es que hay algo que mirar y que no es un rectángulo de un color.
    expect(pintado.lado).toBe((2 * RADIO + 1) * CELDA)

    const colores = new Set<string>()
    for (const fila of pintado.px) for (const c of fila) colores.add(c)
    expect(colores.size, 'el mapa salió de un solo color').toBeGreaterThan(3)

    // Y que el mundo tenga cosas: un mapa vacío se dibujaría perfecto y no
    // probaría nada. Éste es el número que hace que la prueba valga.
    const enElArea = [...e.cuerpos.values()].filter((c) => c.heldBy === undefined).length
    console.log(`\n─── EL MAPA ───`)
    console.log(`  celdas: ${String(2 * RADIO + 1)}×${String(2 * RADIO + 1)} · ${String(pintado.lado)}px`)
    console.log(`  cuerpos en el área visible: ${String(enElArea)}`)
    console.log(`  colores distintos en pantalla: ${String(colores.size)}`)
    console.log(`  reloj: ${reloj.phase}\n`)
    expect(enElArea, 'el área visible salió vacía: el mapa no prueba nada').toBeGreaterThan(5)

    const html = `<!doctype html>
<meta charset="utf-8">
<title>Ánima II — el mapa</title>
<style>
 :root { color-scheme: dark }
 body { margin:0; background:#14161a; color:#e8e6e1; padding:20px;
        font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace }
 h1 { font-size:14px; margin:0 0 4px; font-weight:600 }
 p { margin:0 0 16px; color:#8b8f98; font-size:12px; max-width:72ch }
 .marco { display:inline-block; border:1px solid #262a31; border-radius:8px; padding:10px; line-height:0 }
 dl { display:grid; grid-template-columns:auto auto; gap:2px 12px; font-size:12px; margin:16px 0 0 }
 dt { color:#8b8f98 }
</style>
<h1>El mapa, tick ${String(w.tick)}</h1>
<p>Una partida de verdad: la orilla de la semilla ${String(SEMILLA)}, cien ticks corridos, y lo que el
dios decretó. Nadie eligió qué hay acá. La celda con marco claro es la criatura — su cuerpo es
<code>carne</code>, una parte, bloque, o sea indistinguible de un trozo de carne sin ese realce.</p>
<div class="marco">${svgDe(pintado)}</div>
<dl>
<dt>celdas</dt><dd>${String(2 * RADIO + 1)}×${String(2 * RADIO + 1)}, de ${String(CELDA)}px</dd>
<dt>cuerpos visibles</dt><dd>${String(enElArea)}</dd>
<dt>colores en pantalla</dt><dd>${String(colores.size)}</dd>
<dt>reloj</dt><dd>${reloj.phase}</dd>
</dl>
`
    mkdirSync(dirname(SALIDA), { recursive: true })
    writeFileSync(SALIDA, html, 'utf8')
  })

  it('y es determinista: dos dibujos del mismo mundo son el mismo dibujo', () => {
    let w = mundoInicial()
    for (let i = 0; i < 20; i++) w = stepWorld(w, []).state
    const e = escenaDe(w, O.parada, RADIO)
    const uno = mapaDe(e, PHYS, relojDe(w))
    const otro = mapaDe(e, PHYS, relojDe(w))
    expect(JSON.stringify(uno)).toBe(JSON.stringify(otro))
  })
})
