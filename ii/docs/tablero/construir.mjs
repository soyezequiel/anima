// Genera el tablero a partir de estado.json. Nada más lee estado.json.
//
//   node construir.mjs
//
// Escribe dos archivos al lado:
//   tablero.html            página completa, se abre en el navegador
//   tablero.fragmento.html  el mismo cuerpo sin <html>/<head>, para publicar como Artifact

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aca = dirname(fileURLToPath(import.meta.url))
const d = JSON.parse(readFileSync(join(aca, 'estado.json'), 'utf8'))

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ── el portón ────────────────────────────────────────────────────────────────
// Corre ANTES de dibujar nada y aborta con exit 1. Existe porque este archivo lo
// van a editar modelos distintos en sesiones distintas, y el modo de falla que
// importa no es el JSON roto —ése revienta solo— sino el JSON válido que dice
// algo que la página después muestra mal sin ponerse roja.
const ESTADOS_ETAPA = ['hecho', 'cerrado-con-rojo', 'en-curso', 'pendiente', 'sin-estimar']
const ESTADOS_PUNTO = ['si', 'medio', 'no', 'rojo']
const quejas = []
const exigir = (cond, queja) => { if (!cond) quejas.push(queja) }

exigir(/^\d{4}-\d{2}-\d{2}$/.test(d.actualizado ?? ''), `«actualizado» tiene que ser AAAA-MM-DD, y dice "${d.actualizado}"`)
exigir(typeof d.artifactUrl === 'string' && d.artifactUrl.startsWith('https://'), '«artifactUrl» falta. Sin ella, publicar mina una URL nueva y el usuario termina con dos tableros')
exigir(Array.isArray(d.etapas) && d.etapas.length > 0, '«etapas» tiene que ser una lista con algo adentro')

for (const e of d.etapas ?? []) {
  const yo = `etapa "${e.id ?? '(sin id)'}"`
  exigir(typeof e.id === 'string' && e.id, `${yo}: falta «id»`)
  exigir(typeof e.nombre === 'string' && e.nombre, `${yo}: falta «nombre»`)
  exigir(typeof e.enUnaFrase === 'string' && e.enUnaFrase, `${yo}: falta «enUnaFrase». Es lo primero que se lee, no es opcional`)
  exigir(ESTADOS_ETAPA.includes(e.estado), `${yo}: estado "${e.estado}" no existe. Son: ${ESTADOS_ETAPA.join(' | ')}`)
  exigir(typeof e.semanas === 'number' || e.semanas === null, `${yo}: «semanas» tiene que ser un número o null`)

  for (const p of e.puntos ?? []) {
    exigir(ESTADOS_PUNTO.includes(p.estado), `${yo}: un punto tiene estado "${p.estado}". Son: ${ESTADOS_PUNTO.join(' | ')}`)
    exigir(typeof p.texto === 'string' && p.texto.length > 10, `${yo}: un punto no tiene texto, o es demasiado corto para significar algo`)
  }

  // El avance NO se escribe a mano cuando hay criterios: se deriva de ellos.
  // Es la regla que saca la única decisión de gusto que este archivo tenía.
  if ((e.puntos ?? []).length > 0) {
    exigir(e.avance === undefined, `${yo}: tiene criterios, así que NO lleva «avance» — se deriva solo. Sacá el campo`)
  } else {
    exigir(typeof e.avance === 'number' && e.avance >= 0 && e.avance <= 100, `${yo}: no tiene criterios, así que «avance» es obligatorio y va de 0 a 100`)
  }
}

if (quejas.length) {
  console.error(`\nestado.json no pasa el portón — ${quejas.length} ${quejas.length === 1 ? 'problema' : 'problemas'}:\n`)
  for (const q of quejas) console.error(`  · ${q}`)
  console.error('\nNo se escribió ningún archivo.\n')
  process.exit(1)
}

// ── la cuenta ────────────────────────────────────────────────────────────────
// Sólo entran las etapas con estimación. El plan dice, con todas las letras,
// «no se calcula un total nuevo sin base»: los hitos sin semanas se muestran
// aparte en vez de inventarles un peso.
const conPeso = d.etapas.filter((e) => typeof e.semanas === 'number')
const sinPeso = d.etapas.filter((e) => typeof e.semanas !== 'number')
const total = conPeso.reduce((s, e) => s + e.semanas, 0)

// Lo que vale cada criterio. `rojo` vale UNO a propósito: un rojo aceptado es un
// número que no cumple y que el usuario decidió cerrar igual, con la causa
// medida al lado. El trabajo está hecho; lo que falta es una decisión, y ésa se
// muestra en el chip de la etapa, no descontándole avance.
const PESO_PUNTO = { si: 1, rojo: 1, medio: 0.5, no: 0 }
const avanceDe = (e) => {
  const ps = e.puntos ?? []
  if (ps.length === 0) return e.avance
  return (ps.reduce((s, p) => s + PESO_PUNTO[p.estado], 0) / ps.length) * 100
}
for (const e of d.etapas) e._avance = avanceDe(e)

const pesoDe = (estados) =>
  conPeso.filter((e) => estados.includes(e.estado)).reduce((s, e) => s + (e.semanas * e._avance) / 100, 0)

const wListo = pesoDe(['hecho', 'cerrado-con-rojo'])
const wCurso = pesoDe(['en-curso'])
const pct = Math.round(((wListo + wCurso) / total) * 100)
const pc = (w) => (w / total) * 100

const cuenta = (estados) => d.etapas.filter((e) => estados.includes(e.estado)).length

const ETAPA = {
  hecho: { texto: 'Listo', clase: 'si' },
  'cerrado-con-rojo': { texto: 'Cerrado con rojo aceptado', clase: 'rojo' },
  'en-curso': { texto: 'En curso', clase: 'medio' },
  pendiente: { texto: 'No empezado', clase: 'no' },
  'sin-estimar': { texto: 'Sin estimación', clase: 'no' },
}
const PUNTO = {
  si: { marca: '✓', texto: 'cumple' },
  medio: { marca: '◐', texto: 'a medias' },
  no: { marca: '·', texto: 'falta' },
  rojo: { marca: '!', texto: 'rojo aceptado' },
}

// ── las piezas ───────────────────────────────────────────────────────────────
const salud = d.salud
  .map(
    (s) => `      <div class="dato">
        <div class="dato-valor">${esc(s.valor)}</div>
        <div class="dato-etiqueta">${esc(s.etiqueta)}</div>
        <div class="dato-nota">${esc(s.nota)}</div>
      </div>`
  )
  .join('\n')

const etapa = (e) => {
  const est = ETAPA[e.estado] ?? ETAPA.pendiente
  const puntos = e.puntos ?? []
  const cumplen = puntos.filter((p) => p.estado === 'si').length
  const marcador =
    puntos.length > 0
      ? `<span class="marcador" title="criterios que cumplen">${cumplen}<span class="barra-diagonal">/</span>${puntos.length}</span>`
      : ''

  const lista = puntos
    .map((p) => {
      const m = PUNTO[p.estado] ?? PUNTO.no
      return `          <li class="punto ${p.estado}"><span class="punto-marca" aria-label="${m.texto}">${m.marca}</span><span>${esc(p.texto)}</span></li>`
    })
    .join('\n')

  const detalle = puntos.length
    ? `        <details class="criterios">
          <summary>${puntos.length} ${puntos.length === 1 ? 'criterio' : 'criterios'}</summary>
          <ul>
${lista}
          </ul>
        </details>`
    : ''

  const nota = e.nota ? `        <p class="nota">${esc(e.nota)}</p>` : ''
  const semanas =
    typeof e.semanas === 'number'
      ? `<span class="semanas">${String(e.semanas).replace('.', ',')} sem</span>`
      : `<span class="semanas apagado">sin estimar</span>`

  return `      <article class="etapa ${est.clase}">
        <div class="rail" aria-hidden="true"><span class="punto-rail"></span></div>
        <div class="cuerpo">
          <div class="encabezado">
            <span class="id">${esc(e.id)}</span>
            <h3>${esc(e.nombre)}</h3>
            <span class="chip ${est.clase}">${esc(est.texto)}</span>
          </div>
          <p class="frase">${esc(e.enUnaFrase)}</p>
          <div class="medidas">${marcador}${semanas}</div>
${nota}
${detalle}
        </div>
      </article>`
}

const decisiones = d.decisionesQueEsperan
  .map(
    (x) => `      <div class="decision">
        <h3>${esc(x.titulo)}</h3>
        <p class="porque">${esc(x.porQue)}</p>
        <ul class="opciones">
${x.opciones.map((o) => `          <li>${esc(o)}</li>`).join('\n')}
        </ul>
${x.descartado ? `        <p class="descartado"><span>Descartado —</span> ${esc(x.descartado)}</p>` : ''}
      </div>`
  )
  .join('\n')

const deudas = d.deudasAbiertas.map((x) => `        <li>${esc(x)}</li>`).join('\n')

// Los números de la fila de arriba valen lo que valga su exit code. Esta tabla
// dice cuáles se corrieron de verdad y cuáles vienen citados de un documento.
const verificacion = d.verificacion
  ? `  <section class="seccion">
    <header>
      <h2>Qué se corrió, y qué salió</h2>
      <p>${esc(d.verificacion.cuando)}</p>
    </header>
    <div class="corridas">
${d.verificacion.comandos
  .map(
    (c) => `      <div class="corrida ${c.ok ? 'si' : 'rojo'}">
        <code>${esc(c.cmd)}</code>
        <span class="resultado">${esc(c.resultado)}</span>
      </div>`
  )
  .join('\n')}
    </div>
${d.verificacion.sinCorrer ? `    <p class="aclaracion">${esc(d.verificacion.sinCorrer)}</p>` : ''}
  </section>
`
  : ''

// ── el estilo ────────────────────────────────────────────────────────────────
// El color significa UNA sola cosa en toda la página: en qué estado está algo.
// No hay color decorativo, porque cada color de más es una cosa más que leer.
const estilo = `
:root {
  color-scheme: light dark;
  --ground: #f4f4f1;
  --surface: #ffffff;
  --line: #e2e2da;
  --line-suave: #ecece5;
  --ink: #1f211e;
  --ink-2: #6c706a;
  --ink-3: #93978f;
  --si: #3d7a4c;
  --si-suave: #e6efe6;
  --medio: #96700f;
  --medio-suave: #f5eddb;
  --no: #8b8f88;
  --no-suave: #ececeb;
  --rojo: #a4483b;
  --rojo-suave: #f4e6e3;
  --radio: 3px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ground: #121412;
    --surface: #1a1c1a;
    --line: #2b2e2b;
    --line-suave: #232622;
    --ink: #e8eae5;
    --ink-2: #969b91;
    --ink-3: #6f746c;
    --si: #78b487;
    --si-suave: #1e2a20;
    --medio: #d3a548;
    --medio-suave: #2c2517;
    --no: #757a72;
    --no-suave: #232522;
    --rojo: #d98577;
    --rojo-suave: #2e1e1b;
  }
}
:root[data-theme='dark'] {
  --ground: #121412;
  --surface: #1a1c1a;
  --line: #2b2e2b;
  --line-suave: #232622;
  --ink: #e8eae5;
  --ink-2: #969b91;
  --ink-3: #6f746c;
  --si: #78b487;
  --si-suave: #1e2a20;
  --medio: #d3a548;
  --medio-suave: #2c2517;
  --no: #757a72;
  --no-suave: #232522;
  --rojo: #d98577;
  --rojo-suave: #2e1e1b;
}
:root[data-theme='light'] {
  --ground: #f4f4f1;
  --surface: #ffffff;
  --line: #e2e2da;
  --line-suave: #ecece5;
  --ink: #1f211e;
  --ink-2: #6c706a;
  --ink-3: #93978f;
  --si: #3d7a4c;
  --si-suave: #e6efe6;
  --medio: #96700f;
  --medio-suave: #f5eddb;
  --no: #8b8f88;
  --no-suave: #ececeb;
  --rojo: #a4483b;
  --rojo-suave: #f4e6e3;
}

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.hoja {
  max-width: 50rem;
  margin: 0 auto;
  padding: 3.5rem 1.5rem 6rem;
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
}
h1, h2, h3 { margin: 0; text-wrap: balance; font-weight: 600; }
p { margin: 0; }
.mono, .dato-valor, .cifra, .marcador, .semanas, .id, .eyebrow, .leyenda {
  font-family: ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, monospace;
  font-variant-numeric: tabular-nums;
}
.eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-3);
}

/* ── cabecera ───────────────────────────────────────────── */
.cabecera { display: flex; flex-direction: column; gap: 0.75rem; }
.cabecera h1 { font-size: 2rem; letter-spacing: -0.02em; }
.cabecera .sub { color: var(--ink-2); font-size: 1.05rem; }
.cabecera .tesis {
  border-left: 2px solid var(--line);
  padding-left: 1rem;
  color: var(--ink-2);
  max-width: 40rem;
}
.sello { display: flex; flex-wrap: wrap; gap: 1.25rem; font-size: 0.8rem; color: var(--ink-3); }
.sello b { font-weight: 500; color: var(--ink-2); }

/* ── la barra ────────────────────────────────────────────── */
.avance { display: flex; flex-direction: column; gap: 1rem; }
.cifra-fila { display: flex; align-items: baseline; gap: 0.75rem; }
.cifra { font-size: 3.25rem; line-height: 1; letter-spacing: -0.04em; font-weight: 500; }
.cifra-pie { color: var(--ink-2); font-size: 0.95rem; }
.barra {
  display: flex;
  height: 0.75rem;
  border-radius: var(--radio);
  overflow: hidden;
  background: var(--no-suave);
  border: 1px solid var(--line);
}
.tramo { height: 100%; }
.tramo.si { background: var(--si); }
.tramo.medio { background: var(--medio); }
.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  font-size: 0.78rem;
  color: var(--ink-2);
}
.leyenda span::before {
  content: '';
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  margin-right: 0.4rem;
  background: currentColor;
}
.leyenda .l-si { color: var(--si); }
.leyenda .l-medio { color: var(--medio); }
.leyenda .l-no { color: var(--no); }
.aclaracion { font-size: 0.85rem; color: var(--ink-3); max-width: 38rem; }

/* ── dónde estás parado ─────────────────────────────────── */
.ahora {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radio);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.ahora h2 { font-size: 1.35rem; letter-spacing: -0.01em; }
.ahora .detalle { color: var(--ink-2); max-width: 42rem; }
.ahora ol { margin: 0; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
.ahora li { color: var(--ink); padding-left: 0.25rem; }
.ahora li::marker { color: var(--ink-3); font-family: ui-monospace, monospace; font-size: 0.85em; }

/* ── datos de salud ─────────────────────────────────────── */
.salud { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: var(--radio); overflow: hidden; }
.dato { background: var(--surface); padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.15rem; }
.dato-valor { font-size: 1.3rem; font-weight: 500; letter-spacing: -0.01em; }
.dato-etiqueta { font-size: 0.8rem; color: var(--ink-2); }
.dato-nota { font-size: 0.72rem; color: var(--ink-3); line-height: 1.45; }

/* ── el camino ──────────────────────────────────────────── */
.seccion { display: flex; flex-direction: column; gap: 1.5rem; }
.seccion > header { display: flex; flex-direction: column; gap: 0.35rem; }
.seccion h2 { font-size: 1.15rem; letter-spacing: -0.01em; }
.seccion header p { font-size: 0.9rem; color: var(--ink-2); max-width: 38rem; }
.camino { display: flex; flex-direction: column; }

.etapa { display: grid; grid-template-columns: 1.5rem 1fr; gap: 1rem; }
.rail { position: relative; display: flex; justify-content: center; }
.rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--line);
}
.etapa:first-child .rail::before { top: 0.7rem; }
.etapa:last-child .rail::before { bottom: calc(100% - 0.7rem); }
.punto-rail {
  position: relative;
  margin-top: 0.45rem;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--ground);
  border: 2px solid var(--no);
}
.etapa.si .punto-rail { background: var(--si); border-color: var(--si); }
.etapa.medio .punto-rail { background: var(--medio); border-color: var(--medio); }
.etapa.rojo .punto-rail { background: var(--rojo); border-color: var(--rojo); }

.cuerpo { padding-bottom: 2.25rem; display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
.encabezado { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.6rem; }
.encabezado h3 { font-size: 1.05rem; letter-spacing: -0.01em; }
.id { font-size: 0.72rem; color: var(--ink-3); letter-spacing: 0.06em; }
.chip {
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
}
.chip.si { color: var(--si); background: var(--si-suave); }
.chip.medio { color: var(--medio); background: var(--medio-suave); }
.chip.no { color: var(--no); background: var(--no-suave); }
.chip.rojo { color: var(--rojo); background: var(--rojo-suave); }
.frase { color: var(--ink-2); max-width: 40rem; }
.medidas { display: flex; gap: 1rem; font-size: 0.78rem; color: var(--ink-3); }
.marcador { color: var(--ink-2); }
.barra-diagonal { color: var(--ink-3); margin: 0 0.1em; }
.semanas.apagado { font-style: italic; }
.nota {
  font-size: 0.87rem;
  color: var(--ink-2);
  border-left: 2px solid var(--line);
  padding-left: 0.9rem;
  max-width: 40rem;
}

.criterios { font-size: 0.88rem; }
.criterios summary {
  cursor: pointer;
  color: var(--ink-3);
  font-size: 0.78rem;
  width: fit-content;
  padding: 0.15rem 0;
  border-radius: 2px;
}
.criterios summary:hover { color: var(--ink-2); }
.criterios summary:focus-visible { outline: 2px solid var(--ink-2); outline-offset: 3px; }
.criterios ul { margin: 0.65rem 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.55rem; }
.punto { display: grid; grid-template-columns: 1.1rem 1fr; gap: 0.5rem; color: var(--ink-2); max-width: 42rem; line-height: 1.5; }
.punto-marca { font-family: ui-monospace, monospace; text-align: center; }
.punto.si .punto-marca { color: var(--si); }
.punto.medio .punto-marca { color: var(--medio); }
.punto.no .punto-marca { color: var(--ink-3); }
.punto.rojo .punto-marca { color: var(--rojo); }
.punto.no { color: var(--ink-3); }

/* ── decisiones y deudas ────────────────────────────────── */
.decisiones { display: flex; flex-direction: column; gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: var(--radio); overflow: hidden; }
.decision { background: var(--surface); padding: 1.4rem 1.5rem; display: flex; flex-direction: column; gap: 0.6rem; }
.decision h3 { font-size: 1rem; }
.porque { color: var(--ink-2); font-size: 0.92rem; max-width: 40rem; }
.opciones { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.88rem; color: var(--ink-2); }
.opciones li::marker { color: var(--ink-3); }
.descartado { font-size: 0.82rem; color: var(--ink-3); }
.descartado span { color: var(--rojo); }
.deudas { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.65rem; color: var(--ink-2); font-size: 0.92rem; max-width: 42rem; }
.deudas li::marker { color: var(--ink-3); }

/* ── qué se corrió ──────────────────────────────────────── */
.corridas { display: flex; flex-direction: column; gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: var(--radio); overflow: hidden; }
.corrida {
  background: var(--surface);
  padding: 0.8rem 1.1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1rem;
  border-left: 3px solid var(--no);
  font-size: 0.85rem;
}
.corrida.si { border-left-color: var(--si); }
.corrida.rojo { border-left-color: var(--rojo); }
.corrida code {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  color: var(--ink);
  font-size: 0.82rem;
}
.corrida .resultado { color: var(--ink-2); font-variant-numeric: tabular-nums; }

.pie {
  border-top: 1px solid var(--line);
  padding-top: 1.25rem;
  font-size: 0.8rem;
  color: var(--ink-3);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.pie code {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  background: var(--line-suave);
  padding: 0.1rem 0.35rem;
  border-radius: 2px;
  color: var(--ink-2);
}
@media (max-width: 34rem) {
  .hoja { padding: 2.5rem 1.1rem 4rem; gap: 2.75rem; }
  .cifra { font-size: 2.5rem; }
  .cabecera h1 { font-size: 1.6rem; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
`

// ── el cuerpo ────────────────────────────────────────────────────────────────
const cuerpo = `<div class="hoja">

  <header class="cabecera">
    <div class="eyebrow">Tablero del proyecto</div>
    <h1>${esc(d.proyecto)}</h1>
    <p class="sub">${esc(d.subtitulo)}</p>
    <p class="tesis">${esc(d.enUnaFrase)}</p>
    <div class="sello">
      <span>Actualizado <b>${esc(d.actualizado)}</b></span>
      <span>Rama <b>${esc(d.rama)}</b></span>
      <span><b>${cuenta(['hecho', 'cerrado-con-rojo'])}</b> etapas listas · <b>${cuenta(['en-curso'])}</b> en curso · <b>${cuenta(['pendiente'])}</b> por delante · <b>${sinPeso.length}</b> sin estimar</span>
    </div>
  </header>

  <section class="avance" aria-label="Avance general">
    <div class="cifra-fila">
      <span class="cifra">${pct}%</span>
      <span class="cifra-pie">del plan que tiene estimación</span>
    </div>
    <div class="barra" role="img" aria-label="${pct} por ciento avanzado">
      <div class="tramo si" style="width:${pc(wListo).toFixed(2)}%"></div>
      <div class="tramo medio" style="width:${pc(wCurso).toFixed(2)}%"></div>
    </div>
    <div class="leyenda">
      <span class="l-si">terminado · ${wListo.toFixed(1).replace('.', ',')} de ${String(total).replace('.', ',')} semanas</span>
      <span class="l-medio">en curso · ${wCurso.toFixed(1).replace('.', ',')}</span>
      <span class="l-no">por delante · ${(total - wListo - wCurso).toFixed(1).replace('.', ',')}</span>
    </div>
    <p class="aclaracion">Las semanas son las estimaciones del propio plan y pesan cada etapa. Los ${sinPeso.length} bloques sin estimación quedan afuera de esta cuenta a propósito: el plan dice que no se calcula un total nuevo sin base.</p>
  </section>

  <section class="ahora" aria-label="Dónde está parado el proyecto">
    <div class="eyebrow">Dónde estás parado</div>
    <h2>${esc(d.ahora.titulo)}</h2>
    <p class="detalle">${esc(d.ahora.detalle)}</p>
    <ol>
${d.ahora.proximosPasos.map((p) => `      <li>${esc(p)}</li>`).join('\n')}
    </ol>
  </section>

  <section class="salud" aria-label="Estado del árbol">
${salud}
  </section>

  <section class="seccion">
    <header>
      <h2>El camino, en orden</h2>
      <p>De arriba abajo es el orden real de trabajo. Cada etapa abre sus criterios: verde cumple, ámbar va a medias, rojo es un número que no cumple y el usuario aceptó igual, con la causa medida al lado.</p>
    </header>
    <div class="camino">
${d.etapas.map(etapa).join('\n')}
    </div>
  </section>

  <section class="seccion">
    <header>
      <h2>Lo que espera una decisión tuya</h2>
      <p>Nadie puede avanzar acá sin que vos elijas. Cada una viene con su precio medido.</p>
    </header>
    <div class="decisiones">
${decisiones}
    </div>
  </section>

${verificacion}
  <section class="seccion">
    <header>
      <h2>Deudas abiertas</h2>
      <p>No bloquean el tramo de hoy, pero muerden más adelante. Están acá para que no las descubra alguien a los golpes.</p>
    </header>
    <ul class="deudas">
${deudas}
    </ul>
  </section>

  <footer class="pie">
    <p>La única fuente de la verdad de esta página es <code>ii/docs/tablero/estado.json</code>.</p>
    <p>Se regenera con <code>node ii/docs/tablero/construir.mjs</code>. Editar el HTML a mano no sirve: la próxima corrida lo pisa.</p>
  </footer>

</div>`

// ── salida ───────────────────────────────────────────────────────────────────
const titulo = `${d.proyecto} — tablero (${pct}%)`

writeFileSync(
  join(aca, 'tablero.html'),
  `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<style>*,*::before,*::after{box-sizing:border-box}${estilo}</style>
</head>
<body>
${cuerpo}
</body>
</html>
`,
  'utf8'
)

writeFileSync(
  join(aca, 'tablero.fragmento.html'),
  `<title>${esc(titulo)}</title>
<style>${estilo}</style>
${cuerpo}
`,
  'utf8'
)

console.log(`tablero.html y tablero.fragmento.html escritos — ${pct}% (${wListo.toFixed(2)} + ${wCurso.toFixed(2)} de ${total} semanas)`)
