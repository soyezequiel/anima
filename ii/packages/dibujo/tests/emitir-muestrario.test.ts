// ─── EL MUESTRARIO: lo único de este hito que no lo cierra un test ──────────
//
// El criterio del Hito 12 tiene una mitad que ningún número puede firmar: si el
// dibujo se ve bien. Eso lo mira el usuario. Lo que este archivo hace es que
// tenga QUÉ mirar, y que lo que mire sea lo que el código produce de verdad —no
// una maqueta hecha aparte que se despega al segundo cambio.
//
// Es el mismo truco que `world/tests/emitir-visor.test.ts`, y por el mismo
// motivo escrito allá: **generar el archivo en cada corrida hace que no se pueda
// pudrir**. Un script que se corre a mano queda viejo el día que alguien cambia
// una paleta, y se descubre cuando uno lo necesita.
//
// No afirma nada sobre cómo se ve. Afirma que se pudo escribir, que no está
// vacío y que cada muestra tiene tinta — un muestrario en blanco sería un
// archivo perfectamente válido y no serviría para nada.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type FormId, type Physics } from '@anima/physics'
import type { RenderDescriptor } from '@anima/world'

import { glifoDe, pintar } from '../src/componer.js'
import { fondoDe } from '../src/mundo.js'

const PHYS: Physics = buildSeedPhysics()
const GRILLA = 24
const SALIDA = fileURLToPath(new URL('../../../docs/visor/glifos.html', import.meta.url))

interface Muestra {
  titulo: string
  pie: string
  d: RenderDescriptor
}

function cuerpo(
  forma: FormId,
  nucleo: string,
  partes: number,
  juntas: number,
  atador: string,
  extra: Partial<RenderDescriptor> = {},
): RenderDescriptor {
  return {
    v: 2,
    at: { x: 0, y: 0 },
    forma,
    materiales: [...new Set([nucleo, ...(juntas > 0 ? [atador] : [])])].sort(),
    nucleo,
    partes,
    juntas,
    atadores: new Array<string>(juntas).fill(atador),
    estado: 'sin-marca',
    porte: 'chico',
    ...extra,
  }
}

/** Las muestras son cosas que la partida canónica produce de verdad. */
const MUESTRAS: readonly Muestra[] = [
  { titulo: 'vara de madera', pie: '1 pieza · lo que se frota', d: cuerpo('vara', 'madera', 1, 0, 'liana') },
  { titulo: 'vara de madera dura', pie: 'la misma forma, otra trama', d: cuerpo('vara', 'madera-dura', 1, 0, 'liana') },
  { titulo: 'la caña', pie: '2 piezas · 1 nudo de liana', d: cuerpo('vara', 'madera', 2, 1, 'liana') },
  { titulo: 'el fardo mixto', pie: '6 piezas · 5 nudos de junco', d: cuerpo('bloque', 'hoja-seca', 6, 5, 'junco') },
  { titulo: 'el fardo, de a cinco', pie: 'una pieza menos: se cuenta', d: cuerpo('bloque', 'hoja-seca', 5, 4, 'junco') },
  { titulo: 'corteza', pie: 'misma familia que la yesca, otra trama', d: cuerpo('bloque', 'corteza', 1, 0, 'liana') },
  { titulo: 'pedernal', pie: 'lo único que corta', d: cuerpo('bloque', 'pedernal', 1, 0, 'liana') },
  { titulo: 'carbón', pie: 'lo que ya ardió', d: cuerpo('bloque', 'carbon', 1, 0, 'liana') },
  { titulo: 'pescado crudo', pie: 'toxicity 0,25: no se come así', d: cuerpo('bloque', 'pescado', 1, 0, 'liana', { estado: 'crudo' }) },
  { titulo: 'pescado asado', pie: 'la misma cosa, cocinada', d: cuerpo('bloque', 'pescado', 1, 0, 'liana', { estado: 'asado' }) },
  { titulo: 'leño ardiendo', pie: 'temperature ≥ ignitionPoint', d: cuerpo('bloque', 'madera', 1, 0, 'liana', { estado: 'ardiendo', porte: 'grande' }) },
  { titulo: 'leño chamuscado', pie: 'charred ≥ 0,25', d: cuerpo('bloque', 'madera', 1, 0, 'liana', { estado: 'chamuscado' }) },
  { titulo: 'liana mojada', pie: 'moisture ≥ 0,6: no ata igual', d: cuerpo('hebra', 'liana', 1, 0, 'liana', { estado: 'mojado' }) },
  { titulo: 'pescado podrido', pie: 'decay ≥ 0,5, y sigue asado', d: cuerpo('bloque', 'pescado', 1, 0, 'liana', { estado: 'asado', podrido: true }) },
  { titulo: 'la trampa puesta', pie: 'malla · 5 piezas · 3 capturas', d: cuerpo('malla', 'junco', 5, 4, 'liana', { desplegado: { captura: 3 } }) },
  { titulo: 'un puñado de grano', pie: 'materia suelta', d: cuerpo('grano', 'grano', 1, 0, 'liana') },
]

function svgDe(d: RenderDescriptor): string {
  const lienzo = pintar(glifoDe(d, PHYS, GRILLA))
  let s = `<svg viewBox="0 0 ${String(GRILLA)} ${String(GRILLA)}" width="96" height="96" shape-rendering="crispEdges">`
  for (let y = 0; y < lienzo.length; y++) {
    const fila = lienzo[y]
    if (fila === undefined) continue
    for (let x = 0; x < fila.length; x++) {
      const c = fila[x]
      if (c === undefined || c === '') continue
      s += `<rect x="${String(x)}" y="${String(y)}" width="1" height="1" fill="${c}"/>`
    }
  }
  return s + '</svg>'
}

function tintaDe(d: RenderDescriptor): number {
  return pintar(glifoDe(d, PHYS, GRILLA)).reduce((n, f) => n + f.filter((c) => c !== '').length, 0)
}

describe('el muestrario', () => {
  it('se emite, y cada muestra tiene tinta', () => {
    const tarjetas = MUESTRAS.map((m) => {
      const tinta = tintaDe(m.d)
      // Un muestrario en blanco es un archivo válido que no sirve para nada.
      expect(tinta, `«${m.titulo}» salió vacío`).toBeGreaterThan(0)
      return `<figure><div class="lienzo">${svgDe(m.d)}</div><figcaption><b>${m.titulo}</b><span>${m.pie}</span></figcaption></figure>`
    })

    // ─── LA SEGUNDA TIRA: los mismos glifos sobre los suelos de verdad ─────
    //
    // El contraste ya lo mide `el-fondo.test.ts` con una tabla de cincuenta y
    // cuatro pares. Esto no lo re-mide: lo hace MIRABLE, que es la mitad que
    // ningún número firma. Van los tres casos que el proyecto puso en juego —el
    // pedernal que se perdía de noche, el carbón que es su vecino de familia, y
    // la yesca sin la cual no hay primer fuego.
    const SOBRE_FONDO = [
      { titulo: 'pedernal', d: cuerpo('bloque', 'pedernal', 1, 0, 'liana') },
      { titulo: 'carbón', d: cuerpo('bloque', 'carbon', 1, 0, 'liana') },
      { titulo: 'hoja seca', d: cuerpo('bloque', 'hoja-seca', 1, 0, 'liana') },
    ]
    const CELDAS = [
      { nombre: 'seca', c: { wet: 0.1, sheltered: 0 } },
      { nombre: 'mojada', c: { wet: 0.7, sheltered: 0 } },
      { nombre: 'bajo techo', c: { wet: 0.1, sheltered: 0.8 } },
    ]
    const tiras = SOBRE_FONDO.map((m) => {
      const celdas = CELDAS.flatMap(({ nombre, c }) =>
        (['dia', 'noche'] as const).map((phase) => {
          const fondo = fondoDe(c, { phase })
          return `<div class="sobre"><div class="lienzo" style="background:${fondo}">${svgDe(m.d)}</div><span>${nombre} · ${phase}</span></div>`
        }),
      )
      return `<div class="tira"><b>${m.titulo}</b><div class="fondos">${celdas.join('')}</div></div>`
    })

    const html = `<!doctype html>
<meta charset="utf-8">
<title>Ánima II — los glifos</title>
<style>
 :root { color-scheme: dark; --tinta:#e8e6e1; --fondo:#14161a; --tenue:#8b8f98; --linea:#262a31 }
 * { box-sizing:border-box }
 body { margin:0; background:var(--fondo); color:var(--tinta);
        font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; padding:20px }
 h1 { font-size:14px; margin:0 0 4px; font-weight:600 }
 p.sub { margin:0 0 20px; color:var(--tenue); font-size:12px; max-width:70ch }
 .grilla { display:flex; flex-wrap:wrap; gap:14px }
 figure { margin:0; width:150px }
 .lienzo { background:#0d0f12; border:1px solid var(--linea); border-radius:6px;
           display:flex; align-items:center; justify-content:center; padding:10px; line-height:0 }
 figcaption { margin-top:6px; font-size:11.5px; line-height:1.45 }
 figcaption b { display:block; font-weight:600 }
 figcaption span { color:var(--tenue) }
 h2 { font-size:11px; margin:24px 0 8px; color:var(--tenue); font-weight:600;
      text-transform:uppercase; letter-spacing:.07em }
 .tira { margin-bottom:14px }
 .tira b { font-size:12px; display:block; margin-bottom:5px }
 .fondos { display:flex; gap:8px; flex-wrap:wrap }
 .sobre { text-align:center }
 .sobre .lienzo { border:1px solid var(--linea); border-radius:6px; padding:8px }
 .sobre span { display:block; margin-top:3px; font-size:10.5px; color:var(--tenue) }
</style>
<h1>Los glifos de Ánima II</h1>
<p class="sub">Generado por <code>dibujo/tests/emitir-muestrario.test.ts</code> en cada corrida, así no se
puede pudrir. Cada figura sale de un <code>RenderDescriptor</code> real pasado por
<code>glifoDe</code>: nadie dibujó ninguna. Grilla de ${String(GRILLA)}.</p>
<h2>Muestras</h2>
<div class="grilla">${tarjetas.join('')}</div>
<h2>Sobre los suelos del mapa</h2>
<p class="sub">Tres suelos por dos fases del reloj. El caso que motivó la familia <code>tizon</code>:
el pedernal es lo único que corta en el catálogo, y con un negro real desaparecía de noche.</p>
${tiras.join('')}
`
    mkdirSync(dirname(SALIDA), { recursive: true })
    writeFileSync(SALIDA, html, 'utf8')
    expect(html.length).toBeGreaterThan(2000)
  })
})
