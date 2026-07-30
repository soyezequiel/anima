#!/usr/bin/env node
// ─── EL ESTADO DEL REMAKE, DERIVADO ──────────────────────────────────────────
//
// Emite el bloque de números de `ii/docs/continuar-aca.md` en markdown, listo
// para pegar. Existe por dos razones y la segunda importa más que la primera:
//
//   1. El que cierra un tramo tenía que releer 523 líneas de traspaso para
//      actualizar 29 números mecánicos. Eso son veinte minutos por tramo, y el
//      documento crece cada vez.
//
//   2. **Un número escrito a mano se pudre.** El README decía «11 ADRs propios»
//      cuando había 14, y «Hito 4» cuando el Hito 5 llevaba ocho tramos. Nadie
//      mintió: cada uno actualizó lo suyo y se olvidó de lo de al lado. Lo que
//      se deriva no se puede desactualizar.
//
// Lo que NO hace, a propósito: los veredictos de los criterios del Hito 5. Ésos
// salen de correr las partidas y de leer la salida, y ponerlos acá los volvería
// «lo que el script cree» en vez de «lo que se midió». El script cuenta lo que
// se puede contar sin interpretar nada.
//
// Uso:  pnpm ii:estado        (desde la raíz del repo)

import { execSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const II = fileURLToPath(new URL('../', import.meta.url))

/** Los paquetes, en el orden en que el traspaso los presenta: de abajo hacia arriba. */
const ORDEN = ['physics', 'world', 'oracle', 'skills', 'perceive', 'plan', 'mind', 'juez']

const QUE_ES = {
  physics: 'materia, 12 leyes, `admit()`, 4 procesos aplicables',
  world: 'el árbitro determinista, `stepWorld`, metabolismo, reloj',
  oracle: 'el dios perezoso, biomas, pozos, libro calórico',
  skills: 'el sandbox y las 15 innatas',
  perceive: 'LA COSTURA mundo↔habilidades, `Partida`, `ticksPerdidos`',
  plan: '`SCHEMA_INDEX`, `goalGraph()`, `plan()` anytime',
  mind: 'necesidades, creencias β, `opportunities()`, escalera D0–D5',
  juez: 'el detector de secuencias de emergencia, **externo a propósito**',
}

/**
 * Cuántos `it.fails` hay en un paquete.
 *
 * Se cuentan las DECLARACIONES —`it.fails(` al principio de la línea— y no las
 * menciones: los comentarios de este repositorio hablan de `it.fails` todo el
 * tiempo, y contarlos daba 122 donde hay 45. Ya pasó una vez.
 */
function huecosDe(paquete) {
  const dir = `${II}packages/${paquete}/tests`
  let n = 0
  for (const f of leerTests(dir)) {
    for (const linea of readFileSync(f, 'utf8').split('\n')) {
      if (/^\s*it\.fails\(/.test(linea)) n += 1
    }
  }
  return n
}

function leerTests(dir) {
  const out = []
  let entradas
  try {
    entradas = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entradas) {
    if (e.isDirectory()) out.push(...leerTests(`${dir}/${e.name}`))
    else if (e.name.endsWith('.test.ts')) out.push(`${dir}/${e.name}`)
  }
  return out
}

/**
 * Cuántos tests tiene un paquete, corriéndolo.
 *
 * Se corre de verdad y no se estima: contar `it(` con una expresión regular deja
 * afuera los `it.each`, los `describe.each` y los que se generan en un bucle, que
 * en este repositorio son muchos. Un número aproximado en un documento que se lee
 * como si fuera exacto es peor que no tenerlo.
 */
function testsDe(paquete) {
  try {
    const salida = execSync(`pnpm --filter @anima/${paquete} test`, {
      cwd: `${II}..`,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 900_000,
    })
    const m = /Tests\s+(\d+)\s+passed/.exec(salida.replace(/\[[0-9;]*m/g, ''))
    return m ? Number(m[1]) : null
  } catch {
    return null
  }
}

const conTests = !process.argv.includes('--sin-tests')

const filas = []
let totalTests = 0
let totalHuecos = 0
for (const p of ORDEN) {
  const h = huecosDe(p)
  totalHuecos += h
  const t = conTests ? testsDe(p) : null
  if (t !== null) totalTests += t
  filas.push(`| \`@anima/${p}\` | ${QUE_ES[p]} | ${t === null ? '—' : t} | ${h} |`)
}

const adrs = readdirSync(`${II}docs/decisions`).filter((f) => f.endsWith('.md')).length
const commits = execSync('git rev-list --count main..HEAD', { cwd: `${II}..`, encoding: 'utf8' }).trim()
const rama = execSync('git rev-parse --abbrev-ref HEAD', { cwd: `${II}..`, encoding: 'utf8' }).trim()
const ultimo = execSync('git log --oneline -1', { cwd: `${II}..`, encoding: 'utf8' }).trim()
const sucio = execSync('git status --porcelain', { cwd: `${II}..`, encoding: 'utf8' }).trim().length > 0

console.log(`**Ocho paquetes${conTests ? `, ${totalTests} tests verdes` : ''}, ${totalHuecos} huecos \`it.fails\` anotados.**
${commits} commits por delante de \`main\`, en la rama \`${rama}\`. **Ninguno pusheado** — el usuario
pushea solo. Si la sesión nueva es en otra máquina, hay que pushear antes.
Último commit: \`${ultimo}\`${sucio ? ' · **con cambios sin commitear encima**' : ' · árbol limpio'}.

| paquete | qué es | tests | \`it.fails\` |
|---|---|---:|---:|
${filas.join('\n')}

**${adrs} ADRs propios** en \`ii/docs/decisions/\`.
Comandos: \`pnpm ii:test\` · \`pnpm ii:typecheck\` · \`pnpm ii:estado\` · bancos con \`ANIMA_BANCO=1\`.`)
