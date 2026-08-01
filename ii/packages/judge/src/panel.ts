/**
 * EL PANEL DEL JUEZ — Hito 7, lo que el hito dice que «se puede mostrar».
 *
 *   > el panel del juez. **Por qué** una habilidad es estable y otra no, **con
 *   > los mundos donde falló**.
 *
 * ─── Por qué es HTML generado por un test y no una UI ───────────────────────
 *
 * Porque la UI es el Hito 12 y adelantarla mezclaría dos hitos. Pero «se puede
 * mostrar» pide algo que se pueda abrir, y el repo ya tiene el patrón: el visor
 * de descarte de `ii/docs/visor/partida.html` lo **genera un test**, y el
 * encabezado dice para qué —«para que no se pueda pudrir»—. Un panel escrito a
 * mano queda viejo el día que cambia un cargo; uno que sale de un test se pone
 * rojo.
 *
 * ─── Las dos reglas del contenido ───────────────────────────────────────────
 *
 * **1. Los cuatro cargos siempre, aunque tres estén verdes.** El panel existe
 * para que «construye bien y no sirve» no se lea igual que «no lo puede armar»,
 * y esconder los verdes deja la mitad de la frase.
 *
 * **2. Los mundos donde falló, con nombre.** «No promueve» sin el mundo es un
 * veredicto que no se puede contestar. Como el banco es determinista, el id del
 * mundo ALCANZA para rearmarlo — el panel cita el id y eso es la evidencia.
 */

import type { Dictamen, Grado } from './tipos.js'

const COLOR: Readonly<Record<Grado, string>> = {
  promueve: '#2e7d32',
  'no-promueve': '#c62828',
  inconcluso: '#ef6c00',
  injuzgable: '#6a1b9a',
}

/** Sin `innerHTML` de por medio, pero un nombre con `<` no puede romper la página. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function chip(g: Grado): string {
  return `<span class="chip" style="background:${COLOR[g]}">${esc(g)}</span>`
}

function unDictamen(d: Dictamen): string {
  const cargos = d.cargos
    .map((c) => {
      const n =
        c.corrida.mundos === 0
          ? ''
          : `<td class="num">${String(c.corrida.aprobados)}/${String(c.corrida.mundos)}</td>` +
            `<td class="num">${String(c.corrida.adversosAprobados)}/${String(c.corrida.adversos)}</td>`
      const vacio = c.corrida.mundos === 0 ? '<td class="num">—</td><td class="num">—</td>' : ''
      return `<tr><td class="cargo">${esc(c.cargo)}</td><td>${chip(c.grado)}</td>${n}${vacio}<td class="por">${esc(c.porque)}</td></tr>`
    })
    .join('\n')

  // «Con los mundos donde falló»: sin esto el panel dice qué y no dice dónde.
  const fallos =
    d.regresiones.length === 0
      ? '<p class="ok">Ningún mundo salió distinto de lo que debía.</p>'
      : `<p class="mal">Mundos donde falló — el id alcanza para rearmarlos, el banco es determinista:</p>
<ul class="mundos">${d.regresiones.map((r) => `<li><code>${esc(r.semilla)}</code> — se esperaba ${esc(r.queSeEspera)}</li>`).join('')}</ul>`

  return `<section>
<h2>${esc(d.habilidad)} ${chip(d.grado)}</h2>
<table><thead><tr><th>cargo</th><th>veredicto</th><th>mundos</th><th>adversos</th><th>por qué</th></tr></thead>
<tbody>
${cargos}
</tbody></table>
${fallos}
</section>`
}

/**
 * El panel entero. Determinista: mismos dictámenes, mismo HTML — sin fecha ni
 * nada que cambie solo, para que un `git diff` del archivo generado signifique
 * que **cambió un veredicto** y no que se volvió a correr.
 */
export function panelDe(ds: readonly Dictamen[]): string {
  const resumen = ds
    .map((d) => `<li><a href="#${esc(d.habilidad)}">${esc(d.habilidad)}</a> ${chip(d.grado)}</li>`)
    .join('')
  return `<!doctype html>
<meta charset="utf-8">
<title>El panel del juez — Ánima II</title>
<style>
 /* El fondo va explícito: fijar sólo el color del texto deja los títulos grises
    sobre negro en un navegador con tema oscuro. Se vio mirándolo. */
 html{background:#fff}
 body{font:15px/1.6 system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#222;background:#fff}
 h1{font-size:1.5rem;margin:0 0 .25rem}
 .sub{color:#666;margin:0 0 2rem}
 section{border-top:1px solid #ddd;padding-top:1rem;margin-top:2rem}
 h2{font-size:1.15rem;display:flex;align-items:center;gap:.5rem}
 table{border-collapse:collapse;width:100%;margin:.5rem 0}
 th,td{text-align:left;padding:.35rem .6rem;border-bottom:1px solid #eee;vertical-align:top}
 th{font-weight:600;color:#666;font-size:.85rem}
 .cargo{font-weight:600;white-space:nowrap}
 .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;color:#666}
 .por{color:#444}
 .chip{color:#fff;border-radius:.7rem;padding:.05rem .55rem;font-size:.78rem;white-space:nowrap}
 .mundos{margin:.25rem 0 0;padding-left:1.2rem}
 code{background:#f4f4f4;padding:.05rem .3rem;border-radius:.2rem;font-size:.85rem}
 .ok{color:#2e7d32} .mal{color:#c62828;margin-bottom:.25rem}
 ul.resumen{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:.75rem}
 ul.resumen li{display:flex;align-items:center;gap:.4rem}
</style>
<h1>El panel del juez</h1>
<p class="sub">Por qué una cosa es estable y otra no, con los mundos donde falló.
Generado por <code>judge/tests/el-panel.test.ts</code> — no se edita a mano.</p>
<ul class="resumen">${resumen}</ul>
${ds.map((d) => unDictamen(d).replace('<section>', `<section id="${esc(d.habilidad)}">`)).join('\n')}
`
}
