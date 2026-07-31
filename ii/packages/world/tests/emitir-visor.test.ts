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
// ─── LO QUE LA PRIMERA VERSIÓN HIZO MAL, Y ES EL MOTIVO DE LA SEGUNDA ──────
//
// El usuario la miró y no entendió nada: «la mascota se movió muy rápido». Tenía
// razón, y el número explica el porqué entero: **la partida son 441 ticks y toda
// la acción pasa en los primeros 65**. Después vienen 400 ticks donde no se mueve
// nadie —el mundo corriendo solo, que es justamente el punto del gate— y al final
// la vuelta. A cuadro fijo eso es un borrón de dos segundos, dieciséis segundos de
// nada, y otro borrón.
//
// Las tres reparaciones, y ninguna es «más lento»:
//
//   1. **el mundo NARRA lo que hace**. Cada tick trae los eventos de `stepWorld`
//      traducidos a una frase. Sin eso, ver moverse un círculo blanco no dice si
//      levantó algo, si ató algo o si le rebotó una intención;
//   2. **se puede saltar lo que no pasa nada**. Un tick es «interesante» si tuvo
//      eventos, y el reproductor va de interesante a interesante. Los 400 ticks
//      muertos se vuelven los seis en los que la obra pescó;
//   3. **se para en cada hito**, para poder leer.
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

import { HZ_DE_REFERENCIA, buildSeedPhysics, qualityOf, type Body, type Physics } from '@anima/physics'

import { crearDios, decretoDe, type EstadoDelDios } from '../src/dios.js'
import { aplicarDelta, deltaEntre, escenaDe, escenaHash, type Escena } from '../src/escena.js'
import { apply, goTo, place, take, type Intent } from '../src/intent.js'
import { mapaDeActores, mapaDeCuerpos, stepWorld, type SimEvent, type WorldState } from '../src/step.js'
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

// ─── La narración ───────────────────────────────────────────────────────────
//
// ─── QUÉ SE CUENTA Y QUÉ NO, Y LA LÍNEA IMPORTA ────────────────────────────
//
// Se cuenta lo que CAMBIA el mundo: levantar, soltar, desplegar, nacer, terminar
// un proceso, y los rechazos. NO se cuenta `movio`, aunque sea el evento más
// frecuente de lejos: con una línea por paso, la narración serían cuatrocientas
// veces «caminó una celda» y las seis que importan se perderían adentro.
//
// Que caminó se ve en el mapa, que es donde corresponde verlo.

/** Una frase por evento que valga contarse, o `undefined` si no vale. */
function narrar(e: SimEvent, obra: string | undefined): string | undefined {
  switch (e.k) {
    case 'tomo':
      return `levanta «${e.what}»`
    case 'solto':
      return e.what === obra ? 'deja la obra sobre el pozo' : `suelta «${e.what}»`
    case 'puso':
      return `apoya «${e.what}»`
    case 'nacio':
      // `by` es quién lo hizo nacer, y acá distingue las dos cosas que pueden
      // pasar: la criatura terminando una unión, o LA OBRA sacando del pozo sin
      // que nadie aplique nada — que es el corazón del caso de aceptación.
      return e.by === obra ? `la obra atrapa «${e.id}»` : `de lo que ató sale «${e.id}»`
    case 'proceso':
      return e.completo ? `termina de aplicar «${e.process}»` : undefined
    case 'rechazada':
      return `el mundo rechazó «${e.que}»: ${e.por}`
    case 'comio':
      return `come «${e.what}»`
    default:
      return undefined
  }
}

// ─── La partida que se graba ────────────────────────────────────────────────

interface Cuadro {
  readonly e: Escena
  /** Lo que pasó DURANTE este tick, en castellano. Vacío casi siempre. */
  readonly dice: readonly string[]
}

interface Grabacion {
  readonly cuadros: readonly Cuadro[]
  readonly hitos: readonly { readonly tick: number; readonly que: string }[]
  readonly obra: string
}

const CUERPO_VACIO: Body = { id: '', form: 'vara', parts: [], joints: [], state: {} }

/**
 * Los seis pasos de la historia del gate, grabando UN CUADRO POR TICK.
 *
 * Es la misma partida que `la-historia-entera.test.ts` afirma, y eso es a
 * propósito: si el visor mostrara otra cosa que lo que el criterio del gate
 * verifica, mostraría una demo y no el juego.
 */
function grabar(): Grabacion {
  let w = escenaInicial()
  let obra: string | undefined
  const cuadros: Cuadro[] = [{ e: escenaDe(w, O.parada, RADIO), dice: [] }]
  const hitos: { tick: number; que: string }[] = []

  const avanzar = (is: readonly Intent[]): readonly SimEvent[] => {
    const r = stepWorld(w, is)
    w = r.state
    const dice: string[] = []
    for (const ev of r.events) {
      const linea = narrar(ev, obra)
      if (linea !== undefined) dice.push(linea)
    }
    cuadros.push({ e: escenaDe(w, O.parada, RADIO), dice })
    return r.events
  }
  const marcar = (que: string): void => {
    hitos.push({ tick: w.tick, que })
  }

  avanzar([take({ by: 'ana', seq: 0 }, 'vara')])
  avanzar([take({ by: 'ana', seq: 0 }, 'hebra')])
  marcar('1 · junta una vara y una hebra')

  const atar = apply({ by: 'ana', seq: 0 }, PHYS, 'union', [
    { name: 'binder', body: 'hebra' },
    { name: 'a', body: 'vara' },
  ])
  if (atar === undefined) throw new Error('el catálogo no tiene `union`')
  for (let t = 0; t < 60 && obra === undefined; t++) {
    for (const ev of avanzar([{ ...atar, seq: t }])) if (ev.k === 'nacio') obra = ev.id
  }
  if (obra === undefined) throw new Error('no salió ningún ensamble')
  const enganche = qualityOf(w.bodies.get(obra)?.body ?? CUERPO_VACIO, 'catch', PHYS)
  marcar(`2 · las ata: sale una obra con catch ${enganche.toFixed(4)} que nadie programó`)

  avanzar([place({ by: 'ana', seq: 0 }, obra, O.pozo)])
  marcar('3 · la deja puesta sobre el pozo')

  for (let t = 0; t < 12; t++) avanzar([goTo({ by: 'ana', seq: t }, LEJOS, 0)])
  marcar('4 · se va caminando')

  for (let t = 0; t < 400; t++) avanzar([])
  const capturado = w.desplegados.get(obra)?.captura ?? []
  marcar(`5 · el mundo corrió 400 ticks sin nadie: la obra retuvo ${String(capturado.length)}`)

  const pieza = capturado[0]
  const donde = pieza === undefined ? undefined : w.bodies.get(pieza)?.at
  if (pieza !== undefined && donde !== undefined) {
    for (let t = 0; t < 40; t++) {
      const a = w.bodies.get('ana-cuerpo')?.at
      if (a !== undefined && Math.max(Math.abs(a.x - donde.x), Math.abs(a.y - donde.y)) <= 1) break
      avanzar([goTo({ by: 'ana', seq: t }, donde, 1)])
    }
    avanzar([take({ by: 'ana', seq: 0 }, pieza)])
    marcar('6 · vuelve y se lleva lo que la obra atrapó')
  }

  return { cuadros, hitos, obra }
}

// ─── El archivo ─────────────────────────────────────────────────────────────

/** Cuadro 0 entero, y de ahí en más sólo lo que cambió. */
function comprimir(g: Grabacion): string {
  const primero = g.cuadros[0]?.e
  if (primero === undefined) throw new Error('grabación vacía')
  const deltas = g.cuadros.slice(1).map((c, i) => deltaEntre(g.cuadros[i]?.e as Escena, c.e))
  return JSON.stringify({
    inicial: { ...primero, cuerpos: [...primero.cuerpos] },
    deltas,
    dice: g.cuadros.map((c) => c.dice),
    hitos: g.hitos,
    obra: g.obra,
    pozo: O.pozo,
  })
}

function paginaDe(g: Grabacion): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Anima II — visor de descarte</title>
<style>
 :root { color-scheme: dark; --tinta:#e8e6e1; --fondo:#14161a; --tenue:#8b8f98;
         --oro:#d4b96a; --linea:#262a31; }
 * { box-sizing:border-box }
 body { margin:0; background:var(--fondo); color:var(--tinta);
        font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace }
 header { padding:12px 16px 10px; border-bottom:1px solid var(--linea) }
 h1 { font-size:13px; margin:0 0 3px; font-weight:600; letter-spacing:.02em }
 header p { margin:0; color:var(--tenue); font-size:11.5px }
 #paso { padding:14px 16px; border-bottom:1px solid var(--linea); background:#181b20 }
 #paso b { display:block; font-size:17px; color:var(--oro); font-weight:600; line-height:1.35 }
 #paso small { display:block; margin-top:4px; color:var(--tenue); font-size:12px; min-height:1.4em }
 #mandos { display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:10px 16px;
           border-bottom:1px solid var(--linea) }
 #barra { flex:1 1 220px; min-width:160px }
 #reloj { color:var(--tenue); font-size:12px; white-space:nowrap }
 main { display:flex; flex-wrap:wrap; gap:18px; padding:16px; align-items:flex-start }
 canvas { background:#0d0f12; border:1px solid var(--linea); image-rendering:pixelated;
          max-width:100%; height:auto }
 #lado { min-width:280px; flex:1 1 280px }
 button { background:#1d2128; color:var(--tinta); border:1px solid #333944; border-radius:4px;
          padding:4px 10px; cursor:pointer; font:inherit; font-size:12.5px }
 button:hover { background:#252a33 }
 button.on { background:#2f3644; border-color:#4a5568 }
 label { font-size:12px; color:var(--tenue); display:flex; align-items:center; gap:5px; cursor:pointer }
 h2 { font-size:11px; margin:16px 0 5px; color:var(--tenue); font-weight:600;
      text-transform:uppercase; letter-spacing:.07em }
 table { border-collapse:collapse; font-size:12px; width:100% }
 td { padding:1px 8px 1px 0; vertical-align:top }
 td:first-child { color:var(--tenue); white-space:nowrap }
 .ya { color:var(--oro) }
 .chip { font-size:11.5px; padding:3px 8px }
 #hitos { display:flex; gap:6px; flex-wrap:wrap; padding:0 16px 10px }
 #leyenda { display:grid; grid-template-columns:auto 1fr; gap:2px 10px; font-size:11.5px;
            color:var(--tenue); margin-top:4px }
 #leyenda i { font-style:normal; color:var(--tinta) }
 #diario { font-size:12px; max-height:170px; overflow:auto; border:1px solid var(--linea);
           border-radius:4px; padding:6px 8px; background:#101317 }
 #diario div { color:var(--tenue) }
 #diario div.nuevo { color:var(--tinta) }
</style>
<header>
 <h1>Ánima II · visor de descarte</h1>
 <p>No es la UI del Hito 12. Dibuja cuadrados a propósito: el estilo gráfico todavía no se eligió.
    Todo sale de <code>escenaDe()</code>, función pura del estado, y el archivo viaja por deltas.</p>
</header>
<div id="paso"><b id="titulo"></b><small id="sub"></small></div>
<div id="mandos">
 <button id="play">▶ reproducir</button>
 <button id="atras">◀</button>
 <button id="adelante">▶|</button>
 <input type="range" id="barra" min="0" value="0">
 <span id="reloj"></span>
 <button class="chip" data-vel="500">lento</button>
 <button class="chip on" data-vel="250">normal</button>
 <button class="chip" data-vel="80">rápido</button>
 <label><input type="checkbox" id="saltar" checked> saltar lo que no pasa nada</label>
 <label><input type="checkbox" id="parar" checked> parar en cada paso</label>
</div>
<div id="hitos"></div>
<main>
 <canvas id="lienzo" width="620" height="620"></canvas>
 <div id="lado"></div>
</main>
<script id="datos" type="application/json">${comprimir(g)}</script>
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
 *
 * Y lo único que se agrega encima del estado son AYUDAS DE LECTURA, marcadas como
 * tales: la estela de por dónde vino la criatura, y el parpadeo de lo que cambió
 * en este tick —que sale del delta, o sea del mismo dato—.
 */
const VISOR_JS = String.raw`
const D = JSON.parse(document.getElementById('datos').textContent)

// Reconstruir la escena N aplicando los deltas. Es la MISMA operación que
// ` + '`aplicarDelta`' + ` del motor, y por eso el emisor afirma que las dos coinciden.
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
const DICE = D.dice
const HITOS = D.hitos
const LADO = 2 * D.inicial.radio + 1
const lienzo = document.getElementById('lienzo')
const g = lienzo.getContext('2d')
const PX = Math.floor(lienzo.width / LADO)

const TICKS_DE_HITO = new Set(HITOS.map((h) => h.tick))

/** Dónde está la criatura en el cuadro ` + '`i`' + `. */
function dondeEsta (i) {
  const e = CUADROS[i]
  const a = e.actores[0]
  const c = a && e.cuerpos.get(a.body)
  return c ? c.d.at : null
}

/**
 * LOS CUADROS QUE VALE LA PENA MOSTRAR. Es lo que arregla el ritmo.
 *
 * Tres clases, y las tres hacen falta:
 *
 *   · los que NARRAN algo — levantar, atar, desplegar, pescar;
 *   · los que la CRIATURA SE MOVIÓ. Sin éstos, «se va caminando» sería un salto
 *     de doce celdas en un cuadro: se teletransporta y no se entiende que se fue;
 *   · los ticks de HITO, para que el reproductor pueda parar ahí.
 *
 * Lo que queda afuera son los cuatrocientos ticks en los que el mundo corre solo
 * y nadie se mueve — que es justamente lo que hacía que la primera versión fuera
 * un borrón de dos segundos y dieciséis de nada.
 */
const INTERESANTES = (() => {
  const out = []
  let previo = null
  for (let i = 0; i < CUADROS.length; i++) {
    const aca = dondeEsta(i)
    const camino = previo && aca && (previo.x !== aca.x || previo.y !== aca.y)
    if (DICE[i].length > 0 || camino || TICKS_DE_HITO.has(CUADROS[i].tick)) out.push(i)
    previo = aca
  }
  return out
})()

/** Un tono estable por material. Es hash, no gusto: el mismo junco es el mismo color. */
function tono (s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

/** Por dónde vino la criatura en los últimos cuadros. AYUDA DE LECTURA, no estado. */
function estela (i) {
  const out = []
  for (let k = Math.max(0, i - 14); k <= i; k++) {
    const e = CUADROS[k]
    const a = e.actores[0]
    const c = a && e.cuerpos.get(a.body)
    if (c) out.push(c.d.at)
  }
  return out
}

function pintar (i) {
  const e = CUADROS[i]
  const cambiaron = new Set((D.deltas[i - 1] || { cambiaron: [], entraron: [] }).cambiaron.map((x) => x[0])
    .concat((D.deltas[i - 1] || { entraron: [] }).entraron.map((x) => x[0])))
  g.fillStyle = '#0d0f12'
  g.fillRect(0, 0, lienzo.width, lienzo.height)
  const x0 = e.foco.x - e.radio
  const y0 = e.foco.y - e.radio

  for (const c of e.celdas) {
    const cx = (c.at.x - x0) * PX
    const cy = (c.at.y - y0) * PX
    const calor = Math.max(0, Math.min(1, (c.temperature - 15) / 300))
    const r = Math.round(22 + calor * 190)
    const b = Math.round(26 + c.wet * 155)
    const v = Math.round(28 + c.wet * 62 + calor * 55)
    g.fillStyle = 'rgb(' + r + ',' + v + ',' + b + ')'
    g.fillRect(cx, cy, PX, PX)
    if (c.sheltered > 0.01) {
      g.fillStyle = 'rgba(0,0,0,' + (c.sheltered * 0.5) + ')'
      g.fillRect(cx, cy, PX, PX)
    }
  }

  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1
  for (let k = 0; k <= LADO; k++) {
    g.beginPath(); g.moveTo(k * PX, 0); g.lineTo(k * PX, LADO * PX); g.stroke()
    g.beginPath(); g.moveTo(0, k * PX); g.lineTo(LADO * PX, k * PX); g.stroke()
  }

  // El pozo, marcado: sin esto «la deja sobre el pozo» no se puede ver.
  const px = (D.pozo.x - x0) * PX, py = (D.pozo.y - y0) * PX
  g.strokeStyle = 'rgba(120,190,255,.55)'; g.setLineDash([4, 3]); g.lineWidth = 1.5
  g.strokeRect(px + 2, py + 2, PX - 4, PX - 4); g.setLineDash([])

  // La estela. Ayuda de lectura: no es estado del mundo.
  const rastro = estela(i)
  g.strokeStyle = 'rgba(240,237,230,.30)'; g.lineWidth = 2
  g.beginPath()
  rastro.forEach((p, k) => {
    const cx = (p.x - x0) * PX + PX / 2, cy = (p.y - y0) * PX + PX / 2
    if (k === 0) g.moveTo(cx, cy); else g.lineTo(cx, cy)
  })
  g.stroke()

  const cuerpoDeActor = new Map(e.actores.map((a) => [a.body, a.id]))

  // ─── ABANICO: varios cuerpos en la MISMA celda se corren un poco ──────────
  //
  // AYUDA DE LECTURA, y hay que decirlo: el mundo no tiene sub-posiciones dentro
  // de una celda —eso sería inventar geometría, que es lo que el ADR II-0017
  // prohíbe—. Pero al arrancar la partida la criatura, la vara y la hebra están
  // las tres en la misma celda, y dibujadas en el centro se tapan: se ve un solo
  // círculo blanco y parece que no hay nada más. El corrimiento es del DIBUJO y
  // no del estado, y por eso es chico y en anillo: se lee «hay tres acá», no «uno
  // está más a la derecha».
  const enLaCelda = new Map()
  for (const [id, c] of e.cuerpos) {
    if (c.heldBy) continue
    const k = c.d.at.x + ',' + c.d.at.y
    if (!enLaCelda.has(k)) enLaCelda.set(k, [])
    enLaCelda.get(k).push(id)
  }
  function abanico (id, at) {
    const vecinos = enLaCelda.get(at.x + ',' + at.y) || [id]
    if (vecinos.length < 2) return [0, 0]
    const k = vecinos.indexOf(id)
    const ang = (k / vecinos.length) * Math.PI * 2 - Math.PI / 2
    const r = PX * 0.22
    return [Math.cos(ang) * r, Math.sin(ang) * r]
  }

  for (const [id, c] of e.cuerpos) {
    const d = c.d
    if (c.heldBy) continue // lo que está en la mano se dibuja con quien lo lleva
    const off = abanico(id, d.at)
    const cx = (d.at.x - x0) * PX + PX / 2 + off[0]
    const cy = (d.at.y - y0) * PX + PX / 2 + off[1]
    const h = tono(d.materiales.join('+') || 'nada')
    g.fillStyle = 'hsl(' + h + ' 58% 63%)'
    g.strokeStyle = 'hsl(' + h + ' 58% 80%)'
    if (cuerpoDeActor.has(id)) {
      g.fillStyle = '#f4f1ea'
      g.beginPath(); g.arc(cx, cy, PX * 0.30, 0, 7); g.fill()
      g.fillStyle = '#f4f1ea'; g.font = '10px monospace'; g.textAlign = 'center'
      g.fillText(cuerpoDeActor.get(id), cx, cy - PX * 0.38)
    } else if (d.forma === 'hebra') {
      g.lineWidth = 2.5
      g.beginPath(); g.moveTo(cx - PX * .28, cy + PX * .28); g.lineTo(cx + PX * .28, cy - PX * .28); g.stroke()
    } else if (d.forma === 'vara') {
      g.fillRect(cx - PX * .32, cy - PX * .09, PX * .64, PX * .18)
    } else if (d.forma === 'grano') {
      g.beginPath(); g.arc(cx, cy, PX * 0.13, 0, 7); g.fill()
    } else {
      g.fillRect(cx - PX * .24, cy - PX * .24, PX * .48, PX * .48)
    }
    if (d.partes > 1) {
      g.strokeStyle = '#f4f1ea'; g.lineWidth = 1
      g.beginPath(); g.arc(cx, cy, PX * 0.40, 0, 7); g.stroke()
    }
    if (d.desplegado) {
      g.strokeStyle = '#d4b96a'; g.lineWidth = 2.5
      g.beginPath(); g.arc(cx, cy, PX * 0.44, 0, 7); g.stroke()
      g.fillStyle = '#d4b96a'; g.font = '10px monospace'; g.textAlign = 'center'
      g.fillText('obra', cx, cy + PX * 0.66)
      if (d.desplegado.captura > 0) {
        g.font = 'bold ' + Math.round(PX * .46) + 'px monospace'; g.textBaseline = 'middle'
        g.fillText(String(d.desplegado.captura), cx, cy)
        g.textBaseline = 'alphabetic'
      }
    }
    // Parpadeo de lo que CAMBIÓ este tick. Sale del delta, o sea del mismo dato.
    if (cambiaron.has(id)) {
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5
      g.strokeRect((d.at.x - x0) * PX + 1, (d.at.y - y0) * PX + 1, PX - 2, PX - 2)
    }
  }
}

function hitoDe (i) {
  let ultimo = null
  for (const h of HITOS) if (h.tick <= CUADROS[i].tick) ultimo = h
  return ultimo
}

function lateral (i) {
  const e = CUADROS[i]
  const a = e.actores[0]
  let html = '<h2>leyenda</h2><div id="leyenda">' +
    '<i>○</i><span>la criatura</span>' +
    '<i>▬</i><span>una vara · <i>╱</i> una hebra</span>' +
    '<i>◎</i><span>algo de más de una pieza: una obra</span>' +
    '<i style="color:#d4b96a">◉</i><span>obra desplegada; el número es lo que retuvo</span>' +
    '<i style="color:#7abeff">⬚</i><span>el pozo</span>' +
    '<i>azul</i><span>agua · <i>rojo</i> calor · <i>oscuro</i> a reparo</span>' +
    '</div>'
  html += '<h2>estado</h2><table>'
  if (a) html += '<tr><td>criatura</td><td>' + a.id + ' · manos ' + a.holding.length + '/' + a.capacity + '</td></tr>'
  html += '<tr><td>cuerpos a la vista</td><td>' + e.cuerpos.size + '</td></tr>'
  for (const c of e.cuerpos.values()) {
    if (!c.d.desplegado) continue
    html += '<tr><td>desplegado</td><td>' + c.d.partes + ' piezas · retuvo ' + c.d.desplegado.captura + '</td></tr>'
  }
  html += '</table><h2>diario</h2><div id="diario">'
  let vistas = 0
  for (let k = i; k >= 0 && vistas < 14; k--) {
    for (const linea of DICE[k]) {
      html += '<div class="' + (k === i ? 'nuevo' : '') + '">t' + CUADROS[k].tick + ' · ' + linea + '</div>'
      vistas++
    }
  }
  if (vistas === 0) html += '<div>—</div>'
  html += '</div><h2>lo que hay</h2><table>'
  for (const [id, c] of e.cuerpos) {
    html += '<tr><td>' + id + '</td><td>' + c.d.forma + ' · ' + c.d.materiales.join(', ') +
      (c.d.partes > 1 ? ' · ' + c.d.partes + ' piezas' : '') +
      (c.heldBy ? ' · en la mano' : '') + '</td></tr>'
  }
  return html + '</table>'
}

const barra = document.getElementById('barra')
const reloj = document.getElementById('reloj')
const lado = document.getElementById('lado')
const titulo = document.getElementById('titulo')
const sub = document.getElementById('sub')
barra.max = String(CUADROS.length - 1)

function mostrar (i) {
  barra.value = String(i)
  pintar(i)
  const h = hitoDe(i)
  titulo.textContent = h ? h.que : 'la partida arranca: una criatura, una vara y una hebra'
  sub.textContent = DICE[i].length ? DICE[i].join(' · ') : ''
  reloj.textContent = 'tick ' + CUADROS[i].tick + ' / ' + CUADROS[CUADROS.length - 1].tick
  lado.innerHTML = lateral(i)
}

/** El próximo cuadro a mostrar: el siguiente, o el siguiente que TENGA algo. */
function siguiente (i) {
  if (!document.getElementById('saltar').checked) return i + 1
  for (const k of INTERESANTES) if (k > i) return k
  return CUADROS.length - 1
}

let vel = 250
let corriendo = null
const play = document.getElementById('play')

function parar () {
  if (corriendo) clearInterval(corriendo)
  corriendo = null
  play.textContent = '▶ reproducir'
}

play.addEventListener('click', () => {
  if (corriendo) return parar()
  play.textContent = '❚❚ pausa'
  corriendo = setInterval(() => {
    const n = siguiente(Number(barra.value))
    if (n >= CUADROS.length - 1) { mostrar(CUADROS.length - 1); parar(); return }
    mostrar(n)
    if (document.getElementById('parar').checked && TICKS_DE_HITO.has(CUADROS[n].tick)) parar()
  }, vel)
})

document.getElementById('atras').addEventListener('click', () => { parar(); mostrar(Math.max(0, Number(barra.value) - 1)) })
document.getElementById('adelante').addEventListener('click', () => { parar(); mostrar(siguiente(Number(barra.value))) })
barra.addEventListener('input', () => { parar(); mostrar(Number(barra.value)) })

for (const b of document.querySelectorAll('[data-vel]')) {
  b.addEventListener('click', () => {
    vel = Number(b.dataset.vel)
    for (const o of document.querySelectorAll('[data-vel]')) o.classList.toggle('on', o === b)
    if (corriendo) { parar(); play.click() }
  })
}

// Un botón por hito: la forma más corta de que se pueda ver el paso que interesa.
const chips = document.getElementById('hitos')
HITOS.forEach((h) => {
  const b = document.createElement('button')
  b.className = 'chip'
  b.textContent = h.que
  b.addEventListener('click', () => {
    parar()
    let i = 0
    while (i < CUADROS.length - 1 && CUADROS[i].tick < h.tick) i++
    mostrar(i)
  })
  chips.appendChild(b)
})

mostrar(0)
`

describe('el visor de descarte', () => {
  it('graba la historia del gate, la narra, y escribe un HTML de un solo archivo', () => {
    const g = grabar()
    expect(g.cuadros.length).toBeGreaterThan(400)
    expect(g.hitos.length).toBe(6)

    // ─── LO QUE LA PRIMERA VERSIÓN NO TENÍA, Y ES POR QUÉ NO SE ENTENDÍA ─────
    //
    // La partida son 441 cuadros y la acción entera pasa en los primeros 65. Sin
    // narración, ver un círculo blanco moverse no dice si levantó algo, si ató
    // algo o si le rebotó una intención. Acá se afirma que la narración EXISTE y
    // que es escasa: si contara `movio` habría una línea por tick y las que
    // importan se perderían adentro de cuatrocientas.
    const conAlgo = g.cuadros.filter((c) => c.dice.length > 0)
    expect(conAlgo.length, 'la partida no narra nada').toBeGreaterThan(5)
    expect(conAlgo.length, 'narra demasiado: los hitos se pierden').toBeLessThan(g.cuadros.length / 4)

    const dicho = g.cuadros.flatMap((c) => c.dice)
    expect(dicho.some((l) => l.includes('levanta'))).toBe(true)
    expect(dicho.some((l) => l.includes('deja la obra sobre el pozo'))).toBe(true)
    // La línea que ES el caso de aceptación: la obra saca sin que nadie aplique
    // nada, y se distingue de lo que hizo la criatura por quién la hizo nacer.
    expect(dicho.some((l) => l.includes('la obra atrapa'))).toBe(true)

    // ─── EL CONTROL QUE HACE QUE ESTO SEA UN TEST ────────────────────────────
    //
    // El archivo viaja por deltas, así que si `deltaEntre` perdiera información el
    // visor mostraría un mundo cada vez más viejo y NO fallaría nada. Acá se
    // reconstruye la grabación entera desde el cuadro 0 y se compara cuadro por
    // cuadro CONTRA LO GRABADO, por hash.
    let e = g.cuadros[0]?.e as Escena
    for (let i = 1; i < g.cuadros.length; i++) {
      const b = g.cuadros[i]?.e as Escena
      e = aplicarDelta(e, deltaEntre(e, b))
      expect(escenaHash(e), `el cuadro ${String(i)} no se reconstruye desde los deltas`).toBe(escenaHash(b))
    }

    const html = paginaDe(g)
    mkdirSync(dirname(SALIDA), { recursive: true })
    writeFileSync(SALIDA, html, 'utf8')

    const entero = JSON.stringify(g.cuadros.map((c) => ({ ...c.e, cuerpos: [...c.e.cuerpos] }))).length
    console.log(
      `\n─── EL VISOR ───\n` +
        `  ${String(g.cuadros.length)} cuadros · ${String(conAlgo.length)} con algo que contar\n` +
        `  escenas enteras ${String(Math.round(entero / 1024))} KB` +
        ` → con deltas ${String(Math.round(html.length / 1024))} KB\n` +
        `  ${SALIDA}\n`,
    )
    // Un HTML de un solo archivo: sin red, sin CDN, sin nada que buscar afuera.
    expect(html).not.toMatch(/https?:\/\//)
    expect(html.length).toBeLessThan(900_000)
  })
})
