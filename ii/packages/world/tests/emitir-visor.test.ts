// ─── EL VISOR: mirar una partida sin esperar al Hito 12 ─────────────────────
//
// Hasta hoy, la única forma de ver qué pasa en una partida de Ánima II era leer
// la salida de un test. La UI de verdad es el Hito 12 y va **después del 11**, o
// sea después de la fragua, la crónica, la herencia y la calibración.
//
// Esto no es esa UI y no quiere serlo. Es un **visor de descarte**: un archivo
// HTML, sin servidor, sin framework, sin dependencias y sin estilo gráfico
// elegido —el usuario todavía no eligió ninguno y comprometerlo acá sería
// decidirlo de costado—. Dibuja cuadrados y círculos a propósito.
//
// ─── POR QUÉ ES UN TEST Y NO UN SCRIPT ─────────────────────────────────────
//
// Por dos razones y las dos son de este repositorio. La primera es que los
// bancos de acá corren con vitest (`pnpm ii:banco`, `ii:tick`, `ii:barrido`), así
// que un `.mjs` suelto necesitaría su propia forma de compilar TypeScript.
//
// La segunda vale más: **generar el visor en cada corrida hace que no se pueda
// pudrir**. Un script que se corre a mano queda viejo el día que alguien cambia
// `Escena`, y se descubre cuando uno lo necesita. Acá el emisor typechequea y
// corre con todo lo demás.
//
// ─── Y POR QUÉ EL ARCHIVO VIAJA POR DELTAS ────────────────────────────────
//
// Porque una escena entera son (2·radio+1)² celdas más los cuerpos, y esta
// partida son cientos de ticks: embeber todas sería un HTML de megabytes que
// cambia entero cada vez. Con deltas, el archivo es chico y su diff muestra
// exactamente qué cambió en el mundo.
//
// De paso, **es el primer consumidor de verdad de `deltaEntre`**, que es la mejor
// forma de saber si el diseño servía para algo.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, qualityOf, type Physics } from '@anima/physics'

import { crearDios, decretoDe, type EstadoDelDios } from '../src/dios.js'
import { aplicarDelta, deltaEntre, escenaDe, escenaHash, type Escena } from '../src/escena.js'
import { apply, goTo, place, take, type Intent } from '../src/intent.js'
import { mapaDeActores, mapaDeCuerpos, stepWorld, type WorldState } from '../src/step.js'
import { HZ_DE_REFERENCIA } from '@anima/physics'
import { actor, criatura, cuerpo, enElPiso } from './mundo-minimo.js'

const PHYS: Physics = buildSeedPhysics()
const SEMILLA = 20260727n
const RADIO = 7
const SALIDA = fileURLToPath(new URL('../../../docs/visor/partida.html', import.meta.url))

// ─── La escena: la misma orilla de `la-historia-entera` ─────────────────────

interface Orilla {
  readonly dios: EstadoDelDios
  readonly pozo: { readonly x: number; readonly y: number }
  readonly parada: { readonly x: number; readonly y: number }
}

function buscarOrilla(dios: EstadoDelDios): Orilla {
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
        if ((v.celdas[i] as { wet: number }).wet < 0.9) return { dios, pozo: p, parada }
      }
    }
  }
  throw new Error('la semilla no tiene una sola orilla en 13x13 chunks')
}

const O = buscarOrilla(crearDios(SEMILLA))
const LEJOS = { x: O.parada.x + 5, y: O.parada.y + 5 }

function escenaInicial(): WorldState {
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos([
      { body: criatura('ana', 2000), at: O.parada },
      enElPiso(cuerpo('vara', 'madera', 0.5), O.parada),
      enElPiso(cuerpo('hebra', 'liana', 0.2), O.parada),
    ]),
    actors: mapaDeActores([actor('ana', { holding: [], capacity: 4 })]),
    cells: new Map(),
    desplegados: new Map(),
    nextId: 1,
    dios: O.dios,
  }
}

// ─── La partida que se graba ────────────────────────────────────────────────

interface Grabacion {
  readonly cuadros: readonly Escena[]
  readonly hitos: readonly { readonly tick: number; readonly que: string }[]
}

/**
 * Los seis pasos de la historia del gate, grabando UN CUADRO POR TICK.
 *
 * Es la misma partida que `la-historia-entera.test.ts` afirma, y eso es a
 * propósito: si el visor mostrara otra cosa que lo que el criterio del gate
 * verifica, mostraría una demo y no el juego.
 */
function grabar(): Grabacion {
  let w = escenaInicial()
  const cuadros: Escena[] = [escenaDe(w, O.parada, RADIO)]
  const hitos: { tick: number; que: string }[] = []
  const avanzar = (is: readonly Intent[]): void => {
    w = stepWorld(w, is).state
    cuadros.push(escenaDe(w, O.parada, RADIO))
  }
  const marcar = (que: string): void => {
    hitos.push({ tick: w.tick, que })
  }

  avanzar([take({ by: 'ana', seq: 0 }, 'vara')])
  avanzar([take({ by: 'ana', seq: 0 }, 'hebra')])
  marcar('junta la vara y la hebra')

  const atar = apply({ by: 'ana', seq: 0 }, PHYS, 'union', [
    { name: 'binder', body: 'hebra' },
    { name: 'a', body: 'vara' },
  ])
  if (atar === undefined) throw new Error('el catálogo no tiene `union`')
  let obra: string | undefined
  for (let t = 0; t < 60 && obra === undefined; t++) {
    const r = stepWorld(w, [{ ...atar, seq: t }])
    w = r.state
    cuadros.push(escenaDe(w, O.parada, RADIO))
    for (const e of r.events) if (e.k === 'nacio') obra = e.id
  }
  if (obra === undefined) throw new Error('no salió ningún ensamble')
  const cuerpoObra = w.bodies.get(obra)
  marcar(`ata las dos: sale una obra con catch ${qualityOf(cuerpoObra?.body ?? { id: '', form: 'vara', parts: [], joints: [], state: {} }, 'catch', PHYS).toFixed(4)}`)

  avanzar([place({ by: 'ana', seq: 0 }, obra, O.pozo)])
  marcar('la deja sobre el pozo')

  for (let t = 0; t < 12; t++) avanzar([goTo({ by: 'ana', seq: t }, LEJOS, 0)])
  marcar('se va')

  for (let t = 0; t < 400; t++) avanzar([])
  const capturado = w.desplegados.get(obra)?.captura ?? []
  marcar(`el mundo corrió solo: la obra retuvo ${String(capturado.length)}`)

  const pieza = capturado[0]
  const donde = pieza === undefined ? undefined : w.bodies.get(pieza)?.at
  if (pieza !== undefined && donde !== undefined) {
    for (let t = 0; t < 40; t++) {
      const a = w.bodies.get('ana-cuerpo')?.at
      if (a !== undefined && Math.max(Math.abs(a.x - donde.x), Math.abs(a.y - donde.y)) <= 1) break
      avanzar([goTo({ by: 'ana', seq: t }, donde, 1)])
    }
    avanzar([take({ by: 'ana', seq: 0 }, pieza)])
    marcar('vuelve y se lleva lo que atrapó')
  }

  return { cuadros, hitos }
}

// ─── El archivo ─────────────────────────────────────────────────────────────

/** Cuadro 0 entero, y de ahí en más sólo lo que cambió. */
function comprimir(cuadros: readonly Escena[]): string {
  const primero = cuadros[0]
  if (primero === undefined) throw new Error('grabación vacía')
  const deltas = cuadros.slice(1).map((b, i) => deltaEntre(cuadros[i] as Escena, b))
  return JSON.stringify({
    inicial: { ...primero, cuerpos: [...primero.cuerpos] },
    deltas,
  })
}

function paginaDe(g: Grabacion): string {
  const datos = comprimir(g.cuadros)
  return `<!doctype html>
<meta charset="utf-8">
<title>Anima II — visor de descarte</title>
<style>
 :root { color-scheme: dark; --tinta: #e8e6e1; --fondo: #14161a; --tenue: #8b8f98; }
 body { margin:0; background:var(--fondo); color:var(--tinta);
        font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
 header { padding:12px 16px; border-bottom:1px solid #262a31; }
 h1 { font-size:14px; margin:0 0 4px; font-weight:600; letter-spacing:.02em; }
 p  { margin:0; color:var(--tenue); font-size:12px; }
 main { display:flex; flex-wrap:wrap; gap:16px; padding:16px; align-items:flex-start; }
 canvas { background:#0d0f12; border:1px solid #262a31; image-rendering:pixelated;
          max-width:100%; height:auto; }
 #lado { min-width:260px; flex:1 1 260px; }
 #mandos { display:flex; gap:8px; align-items:center; padding:0 16px 8px; }
 input[type=range] { flex:1; }
 button { background:#1d2128; color:var(--tinta); border:1px solid #333944;
          border-radius:4px; padding:4px 10px; cursor:pointer; font:inherit; }
 button:hover { background:#252a33; }
 table { border-collapse:collapse; font-size:12px; width:100%; }
 td { padding:1px 8px 1px 0; vertical-align:top; }
 td:first-child { color:var(--tenue); white-space:nowrap; }
 .hito { color:#c8b273; }
 h2 { font-size:12px; margin:14px 0 4px; color:var(--tenue); font-weight:600;
      text-transform:uppercase; letter-spacing:.06em; }
</style>
<header>
 <h1>Ánima II · visor de descarte</h1>
 <p>No es la UI del Hito 12. Dibuja cuadrados a propósito: el estilo gráfico todavía no se eligió.
    Todo lo que se ve sale de <code>escenaDe()</code>, que es función pura del estado.</p>
</header>
<div id="mandos">
 <button id="play">▶</button>
 <input type="range" id="barra" min="0" value="0">
 <span id="reloj"></span>
</div>
<main>
 <canvas id="lienzo" width="600" height="600"></canvas>
 <div id="lado"></div>
</main>
<script id="datos" type="application/json">${datos}</script>
<script id="hitos" type="application/json">${JSON.stringify(g.hitos)}</script>
<script>
${VISOR_JS}
</script>
`
}

/**
 * EL VISOR, en JavaScript plano.
 *
 * Va como texto y no como archivo aparte porque el requisito es que la página sea
 * de un solo archivo: se abre con doble clic, sin servidor y sin red.
 *
 * ─── LO QUE DIBUJA, Y DE DÓNDE SALE CADA COSA ─────────────────────────────
 *
 * Nada de acá inventa: el azul sale de \`wet\`, el rojo de \`temperature\`, la forma
 * de \`forma\`, el tono de \`materiales\`, el anillo de estar desplegado y el número
 * de adentro de \`captura\`. Es el ADR II-0017 aplicado con un pincel: lo que la
 * física no modela, la pantalla no lo afirma.
 */
const VISOR_JS = String.raw`
const D = JSON.parse(document.getElementById('datos').textContent)
const HITOS = JSON.parse(document.getElementById('hitos').textContent)

// Reconstruir la escena N aplicando los deltas. Es la MISMA operación que
// \`aplicarDelta\` del motor, y por eso el emisor afirma que las dos coinciden.
function reconstruir () {
  const out = []
  let e = { ...D.inicial, cuerpos: new Map(D.inicial.cuerpos) }
  out.push(e)
  for (const d of D.deltas) {
    const cuerpos = new Map(e.cuerpos)
    for (const id of d.salieron) cuerpos.delete(id)
    for (const [id, c] of d.entraron) cuerpos.set(id, c)
    for (const [id, c] of d.cambiaron) cuerpos.set(id, c)
    const ord = new Map([...cuerpos.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)))
    const porClave = new Map(d.celdas.map((c) => [c.at.x + ',' + c.at.y, c]))
    const celdas = e.celdas.map((c) => porClave.get(c.at.x + ',' + c.at.y) ?? c)
    e = { ...e, tick: d.a, celdas, cuerpos: ord, actores: d.actores ?? e.actores }
    out.push(e)
  }
  return out
}

const CUADROS = reconstruir()
const LADO = 2 * D.inicial.radio + 1
const lienzo = document.getElementById('lienzo')
const g = lienzo.getContext('2d')
const PX = Math.floor(lienzo.width / LADO)

/** Un tono estable por material. Es hash, no gusto: el mismo junco es el mismo color. */
function tono (s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

function pintar (e) {
  g.fillStyle = '#0d0f12'
  g.fillRect(0, 0, lienzo.width, lienzo.height)
  const x0 = e.foco.x - e.radio
  const y0 = e.foco.y - e.radio

  for (const c of e.celdas) {
    const cx = (c.at.x - x0) * PX
    const cy = (c.at.y - y0) * PX
    // Azul por humedad, rojo por calor sobre el ambiente, gris si nada.
    const calor = Math.max(0, Math.min(1, (c.temperature - 15) / 300))
    const r = Math.round(24 + calor * 190)
    const b = Math.round(24 + c.wet * 150)
    const v = Math.round(26 + c.wet * 60 + calor * 60)
    g.fillStyle = 'rgb(' + r + ',' + v + ',' + b + ')'
    g.fillRect(cx, cy, PX, PX)
    if (c.sheltered > 0.01) {
      g.fillStyle = 'rgba(0,0,0,' + (c.sheltered * 0.5) + ')'
      g.fillRect(cx, cy, PX, PX)
    }
  }

  g.strokeStyle = 'rgba(255,255,255,.05)'
  for (let i = 0; i <= LADO; i++) {
    g.beginPath(); g.moveTo(i * PX, 0); g.lineTo(i * PX, LADO * PX); g.stroke()
    g.beginPath(); g.moveTo(0, i * PX); g.lineTo(LADO * PX, i * PX); g.stroke()
  }

  const cuerpoDeActor = new Set(e.actores.map((a) => a.body))
  for (const [id, c] of e.cuerpos) {
    const d = c.d
    const cx = (d.at.x - x0) * PX + PX / 2
    const cy = (d.at.y - y0) * PX + PX / 2
    if (c.heldBy) continue // lo que está en la mano se dibuja con quien lo lleva
    const h = tono(d.materiales.join('+') || 'nada')
    g.fillStyle = 'hsl(' + h + ' 55% 62%)'
    g.strokeStyle = 'hsl(' + h + ' 55% 80%)'
    if (cuerpoDeActor.has(id)) {
      g.fillStyle = '#f0ede6'
      g.beginPath(); g.arc(cx, cy, PX * 0.32, 0, 7); g.fill()
    } else if (d.forma === 'hebra') {
      g.lineWidth = 2
      g.beginPath(); g.moveTo(cx - PX * .3, cy + PX * .3); g.lineTo(cx + PX * .3, cy - PX * .3); g.stroke()
    } else if (d.forma === 'vara') {
      g.fillRect(cx - PX * .34, cy - PX * .1, PX * .68, PX * .2)
    } else if (d.forma === 'grano') {
      g.beginPath(); g.arc(cx, cy, PX * 0.14, 0, 7); g.fill()
    } else {
      g.fillRect(cx - PX * .26, cy - PX * .26, PX * .52, PX * .52)
    }
    // Más de una pieza: se marca, porque es lo único que distingue una obra.
    if (d.partes > 1) {
      g.strokeStyle = '#f0ede6'; g.lineWidth = 1
      g.beginPath(); g.arc(cx, cy, PX * 0.42, 0, 7); g.stroke()
    }
    if (d.desplegado) {
      g.strokeStyle = '#c8b273'; g.lineWidth = 2
      g.beginPath(); g.arc(cx, cy, PX * 0.46, 0, 7); g.stroke()
      if (d.desplegado.captura > 0) {
        g.fillStyle = '#c8b273'
        g.font = 'bold ' + Math.round(PX * .5) + 'px monospace'
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(String(d.desplegado.captura), cx, cy)
      }
    }
  }
}

function contar (e) {
  const filas = []
  const a = e.actores[0]
  if (a) filas.push(['criatura', a.id + ' · manos ' + a.holding.length + '/' + a.capacity])
  filas.push(['cuerpos a la vista', e.cuerpos.size])
  const desp = [...e.cuerpos.values()].filter((c) => c.d.desplegado)
  for (const c of desp) filas.push(['desplegado', c.d.partes + ' piezas · retuvo ' + c.d.desplegado.captura])
  let html = '<h2>estado</h2><table>' +
    filas.map((f) => '<tr><td>' + f[0] + '</td><td>' + f[1] + '</td></tr>').join('') + '</table>'
  html += '<h2>lo que hay</h2><table>'
  for (const [id, c] of e.cuerpos) {
    html += '<tr><td>' + id + '</td><td>' + c.d.forma + ' · ' + c.d.materiales.join(', ') +
      (c.d.partes > 1 ? ' · ' + c.d.partes + ' piezas' : '') +
      (c.heldBy ? ' · en la mano' : '') + '</td></tr>'
  }
  html += '</table><h2>la historia</h2><table>'
  for (const h of HITOS) {
    html += '<tr><td' + (h.tick <= e.tick ? ' class="hito"' : '') + '>t' + h.tick + '</td><td' +
      (h.tick <= e.tick ? ' class="hito"' : '') + '>' + h.que + '</td></tr>'
  }
  return html + '</table>'
}

const barra = document.getElementById('barra')
const reloj = document.getElementById('reloj')
const lado = document.getElementById('lado')
barra.max = String(CUADROS.length - 1)

function mostrar (i) {
  const e = CUADROS[i]
  pintar(e)
  reloj.textContent = 'tick ' + e.tick + ' / ' + CUADROS[CUADROS.length - 1].tick
  lado.innerHTML = contar(e)
}

barra.addEventListener('input', () => mostrar(Number(barra.value)))
let corriendo = null
document.getElementById('play').addEventListener('click', (ev) => {
  if (corriendo) { clearInterval(corriendo); corriendo = null; ev.target.textContent = '▶'; return }
  ev.target.textContent = '❚❚'
  corriendo = setInterval(() => {
    const n = Number(barra.value) + 1
    if (n > Number(barra.max)) { clearInterval(corriendo); corriendo = null; ev.target.textContent = '▶'; return }
    barra.value = String(n); mostrar(n)
  }, 40)
})
mostrar(0)
`

describe('el visor de descarte', () => {
  it('graba la historia del gate y escribe un HTML de un solo archivo', () => {
    const g = grabar()
    expect(g.cuadros.length).toBeGreaterThan(400)
    expect(g.hitos.length).toBe(6)

    // ─── EL CONTROL QUE HACE QUE ESTO SEA UN TEST ────────────────────────────
    //
    // El archivo viaja por deltas, así que si `deltaEntre` perdiera información el
    // visor mostraría un mundo cada vez más viejo y NO fallaría nada. Acá se
    // reconstruye la grabación entera desde el cuadro 0 y se compara cuadro por
    // cuadro CONTRA LO GRABADO, por hash.
    let e = g.cuadros[0] as Escena
    for (let i = 1; i < g.cuadros.length; i++) {
      const b = g.cuadros[i] as Escena
      e = aplicarDelta(e, deltaEntre(e, b))
      expect(escenaHash(e), `el cuadro ${String(i)} no se reconstruye desde los deltas`).toBe(escenaHash(b))
    }

    const html = paginaDe(g)
    mkdirSync(dirname(SALIDA), { recursive: true })
    writeFileSync(SALIDA, html, 'utf8')

    // La compresión, impresa: es lo que justifica que el archivo se pueda commitear.
    const entero = JSON.stringify(g.cuadros.map((c) => ({ ...c, cuerpos: [...c.cuerpos] }))).length
    console.log(
      `\n─── EL VISOR ───\n` +
        `  ${String(g.cuadros.length)} cuadros · escenas enteras ${String(Math.round(entero / 1024))} KB` +
        ` → con deltas ${String(Math.round(html.length / 1024))} KB\n` +
        `  ${SALIDA}\n`,
    )
    // Un HTML de un solo archivo: sin red, sin CDN, sin nada que buscar afuera.
    expect(html).not.toMatch(/https?:\/\//)
    expect(html.length).toBeLessThan(900_000)
  })
})
