/**
 * HABLARLE A LA CRIATURA — el Hito 6, a mano, en la terminal.
 *
 *     pnpm --filter @anima/lang hablarle
 *     pnpm --filter @anima/lang hablarle "hacé fuego"
 *
 * Es un DEMO, no un test: no afirma nada y no corre en CI. Existe para poder
 * escribir una frase y ver si la criatura hace caso, que es la única forma de
 * saber si el hito significa algo.
 *
 * ─── Lo que este archivo prueba, y lo que NO ────────────────────────────────
 *
 * Prueba el camino entero contra un mundo de verdad: se lee la frase, sale el
 * acuse **en el acto**, se convierte en una meta y se le inyecta a una `Mente`
 * que ya venía viviendo. Después corren los ticks y se ve qué hace.
 *
 * **Lo que todavía no hay es una sola cosa y conviene decirla:** el único canal
 * externo a la mente es `MenteOptions.drive`, que lleva **una** firma de
 * predicado. Alcanza para una orden de una cláusula —«hacé fuego»— y **no**
 * para «hacé fuego y después pescá»: el orden parcial y las ligaduras que
 * `objetivosDe` sabe producir no tienen por dónde entrar. Cuando la frase tiene
 * varias cláusulas, este demo manda la primera y lo dice.
 *
 * ─── Por qué importa de `mind/tests/` ───────────────────────────────────────
 *
 * La regla del repo es no importar los `tests/` de otro paquete, y vale para los
 * tests: uno que depende del de al lado se rompe cuando el de al lado se
 * reordena. Esto no es un test. El constructor de mundos de verdad —con dios,
 * con orilla y con pozo— vive ahí, y copiar doscientas líneas para un demo sería
 * peor: la copia se quedaría vieja sin que nadie se entere.
 */

import { createInterface } from 'node:readline'
import { buildSeedPhysics, qualityOf } from '@anima/physics'
import { ESQUEMAS, catalogoDe } from '@anima/plan'
import { Partida } from '@anima/perceive'
import { Creencias, Mente, vivir } from '@anima/mind'
import type { Drive } from '@anima/mind'
import { PUENTE } from '../src/alias.js'
import { consultaDe } from '../src/consulta.js'
import { faltaDe } from '../src/falta.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { objetivosDe } from '../src/objetivos.js'
import { actor, criatura, enElPiso, laOrilla, mundo } from '../../mind/tests/mundo.js'

const QUIEN = 'ana'
/** Ticks que corre el mundo antes de la primera frase, para que se asiente. */
const CALENTAR = 40
/** Ticks que corre después de cada orden. A 20 Hz son 15 segundos del mundo. */
const DESPUES = 300

const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const catalogo = catalogoDe(ESQUEMAS)
const ESTABLECIBLES = new Set(ESQUEMAS.map((e) => e.establishes))
const FIRMAS = [...ESTABLECIBLES]
const OPC = { phys, lexico, sabeElCatalogo: (f: string): boolean => ESTABLECIBLES.has(f) }

const orilla = laOrilla()
// La escena canónica del Hito 5: la criatura parada en la orilla, con el tanque
// de arranque del criterio. Está escrita acá y no importada porque el que la
// arma —`conRegalo`— vive en `mind/tests/el-criterio.ts`, que es el arnés del
// criterio y no un constructor de mundos.
const partida = new Partida(
  mundo({
    dios: orilla.dios,
    bodies: [enElPiso(criatura(QUIEN, 310), orilla.parada)],
    actors: [actor(QUIEN, { capacity: 3 })],
  }),
  { vigilar: true },
)
let memoria = new Creencias()
let mente = new Mente({ actor: QUIEN, memoria })
const mentes = new Map([[QUIEN, mente]])
let tick = 0

/**
 * Donde esta parada, y con cuanto aliento.
 *
 * La clave es `ana-cuerpo` y no `ana`: el ACTOR y su CUERPO son dos cosas, y el
 * cuerpo lleva el sufijo. La primera version buscaba `ana` y la criatura salia
 * «ya no esta» siempre — un fantasma de mi display, no del mundo.
 */
function donde(): string {
  const a = partida.state.bodies.get(`${QUIEN}-cuerpo`)
  if (a === undefined) return 'ya no está (se murió)'
  // `Placement` es `{x, y}` y nada mas: no es una union con variantes. Escribi
  // un `at.k === 'cell'` de memoria y salio `(undefined)` — el tipo se lee, no
  // se recuerda.
  const en = `${String(a.at.x)},${String(a.at.y)}`
  const st = qualityOf(a.body, 'stamina', partida.state.phys)
  return `en (${en}) con ${st.toFixed(0)} de aliento`
}

function enLaMano(): string {
  const s = partida.state.actors.get(QUIEN)
  const n = s === undefined ? 0 : s.holding.length
  return n === 0 ? 'con las manos vacías' : `con ${String(n)} cosa${n > 1 ? 's' : ''} en la mano`
}

interface Hecho {
  readonly t: number
  readonly nombre: string
}

function correr(n: number): readonly Hecho[] {
  const hechos: Hecho[] = []
  for (let k = 0; k < n; k++) {
    const antes = mente.despegues
    vivir(partida, mentes, 1)
    tick++
    if (mente.despegues > antes) hechos.push({ t: tick, nombre: mente.ultimoDespegue ?? '?' })
  }
  return hechos
}

/**
 * Cuantas veces hizo cada cosa.
 *
 * Los `Hecho` llevan el tick y el nombre APARTE. La primera version los guardaba
 * como una linea de texto y despues la volvia a partir, y como la linea arranca
 * con espacios el `split` daba `['', '41', 'deshilachar...']`: contaba los
 * NUMEROS DE TICK como si fueran nombres de habilidad. Volver a parsear lo que
 * uno mismo formateo es el bug mas facil de escribir y el mas dificil de ver.
 */
function contar(hechos: readonly Hecho[]): string {
  const cuenta = new Map<string, number>()
  for (const h of hechos) {
    const nombre = h.nombre.split('(')[0] ?? '?'
    cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1)
  }
  const filas = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  return filas.map(([n, c]) => `${n}×${String(c)}`).join(' · ')
}

/** Una frase, de punta a punta. */
function decirle(frase: string): void {
  const t0 = Number(process.hrtime.bigint()) / 1e6

  const l = leer(frase, OPC)
  // EL ACUSE, en el acto. Antes de mirar el catálogo y antes de planificar.
  const acuseMs = Number(process.hrtime.bigint()) / 1e6 - t0
  console.log(`\n  🐾 «${l.acuse}»   (${acuseMs.toFixed(2)} ms)`)

  const puente = objetivosDe(l)
  if (puente.aviso !== '') console.log(`     ${puente.aviso}`)

  const primera = l.clausulas.find((c) => c.firma !== undefined && c.polaridad === 'afirma')
  if (primera?.firma === undefined) {
    // Ninguna cláusula llegó a una meta. El cuerpo NO se detiene: sigue con lo
    // suyo, que es el punto 1 del criterio.
    console.log(`     ${primera === undefined ? l.clausulas[0]?.porque ?? '' : ''}`)
    const c = consultaDe(l, lexico, FIRMAS)
    if (c !== undefined) {
      console.log(`     [le preguntaría al modelo: ${String(c.clausulas.length)} cláusula(s), llave ${c.llave}]`)
    }
    const hechos = correr(60)
    console.log(`     mientras tanto sigue con lo suyo: ${contar(hechos) || 'nada'}`)
    return
  }

  if (l.clausulas.length > 1) {
    console.log(`     (son ${String(l.clausulas.length)} cláusulas y el canal a la mente lleva UNA: va la primera)`)
  }

  const falta = faltaDe(primera.firma, phys, catalogo)
  console.log(`     entendí: ${primera.firma}`)
  if (primera.grado === 'sin-camino') {
    console.log(`     pero ${falta.enVozAlta}  [falta: ${falta.clase}]`)
  }

  // LA INYECCIÓN. `Mente` recibe el drive al construirse, así que una orden
  // nueva es una mente nueva — con la MISMA memoria, que es lo que hace que no
  // se olvide de lo que aprendió. Reiniciar el plan en curso es lo correcto:
  // le acaban de pedir otra cosa.
  const drive: Drive = { meta: primera.firma, peso: 1, desdeTick: tick }
  mente = new Mente({ actor: QUIEN, memoria, drive })
  mentes.set(QUIEN, mente)

  const hechos = correr(DESPUES)
  console.log(`\n     ${String(DESPUES)} ticks después (${String(DESPUES / 20)} s del mundo): ${donde()}, ${enLaMano()}`)
  console.log(`     hizo: ${contar(hechos) || '(nada: no encontró por dónde)'}`)
  if (hechos.length > 0) {
    console.log(`     primeros pasos:`)
    for (const h of hechos.slice(0, 8)) console.log(`       ${String(h.t).padStart(5)}  ${h.nombre}`)
  }
}

// ─── El bucle ───────────────────────────────────────────────────────────────

console.log('\n══ HABLARLE A LA CRIATURA ══════════════════════════════════')
console.log(`   mundo: la orilla de la semilla 20260727, pozo en (${String(orilla.pozo.x)},${String(orilla.pozo.y)})`)
console.log(`   léxico: ${String(lexico.entradas.size)} entradas · catálogo: ${String(FIRMAS.length)} firmas alcanzables`)
correr(CALENTAR)
console.log(`   la criatura ya vivió ${String(CALENTAR)} ticks sola. Está ${donde()}, ${enLaMano()}.`)
console.log('════════════════════════════════════════════════════════════')

const deLaLinea = process.argv.slice(2).join(' ').trim()
if (deLaLinea !== '') {
  decirle(deLaLinea)
  console.log('')
} else {
  console.log('\nEscribile algo. `salir` para terminar.\n')
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })
  rl.prompt()
  rl.on('line', (linea) => {
    const t = linea.trim()
    if (t === 'salir' || t === 'chau') {
      rl.close()
      return
    }
    if (t !== '') decirle(t)
    console.log('')
    rl.prompt()
  })
  rl.on('close', () => {
    console.log('\n  chau.\n')
    process.exit(0)
  })
}
