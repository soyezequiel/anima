/**
 * EL C4 CONTRA EL PROVEEDOR DE VERDAD — la puerta de salida del tramo.
 *
 *     pnpm --filter @anima/juego con-claude --claude "conseguime algo para comer"
 *     pnpm --filter @anima/juego con-claude --falso "conseguime algo para comer"
 *
 * Es un DEMO y no un test, por la razón de siempre y por una más: **cuesta
 * plata y tarda segundos**, así que en CI sería una prueba que a veces falla por
 * la red y siempre cobra. Lo que en CI corre es el fixture con proveedor
 * guionado, que es determinista; esto es lo que se corre a mano cuando hay que
 * saber si la cosa anda de verdad.
 *
 * ─── LO QUE ESTE ARCHIVO AFIRMA, y no lo puede afirmar ningún otro ─────────
 *
 * `lang/demo/hablarle.mts` ya habla con el modelo, pero lo hace **esperándolo**:
 * `await preguntarle(...)` y recién después sigue. O sea que prueba la lectura y
 * no la costura del C4, que es exactamente la promesa contraria — **el tick no
 * espera al proveedor**.
 *
 * Acá el mundo corre mientras la consulta viaja, y lo que se imprime es:
 *
 *   · cuántos TICKS pasaron con la consulta en el aire;
 *   · en qué tick aterrizó la respuesta, que tiene que ser una FRONTERA;
 *   · qué entendió antes y qué entendió después.
 *
 * Si los ticks en el aire dan cero, la costura está rota aunque el resultado sea
 * correcto: quiere decir que algo lo esperó.
 */

import { buildSeedPhysics } from '@anima/physics'
import { Partida } from '@anima/perceive'
import { vivir } from '@anima/mind'
import type { Consulta } from '@anima/lang'
import {
  costoDeLaUltima,
  fraseDeLaLinea,
  preguntarle,
  transporteElegido,
} from '@anima/lang/demo/proveedor.js'

import { Ordenes } from '../src/ordenes.js'
import { arrancar } from '../src/mundo.js'

const QUIEN = 'ana'
const PHYS = buildSeedPhysics()
const FRASE = fraseDeLaLinea() || 'conseguime algo para comer'
/** Cuántos ticks se le dan al mundo para que la respuesta llegue y se aplique. */
const TOPE = 2_000

const { state } = arrancar(20260727n)
const partida = new Partida(state)

let enElAire = 0
let pedidaEn = -1
/** `--cortar` dice una segunda frase a mitad del viaje, que aborta la primera. */
const CORTAR = process.argv.includes('--cortar')
let abortadaEn: number | undefined
let asentoEn: number | undefined

const ordenes = new Ordenes(partida, QUIEN, PHYS, {
  preguntar: (c: Consulta, signal?: AbortSignal) => {
    pedidaEn = partida.state.tick
    const arranco = Date.now()
    signal?.addEventListener('abort', () => {
      abortadaEn = Date.now() - arranco
    })
    return preguntarle(c, 30_000, signal).then((r) => {
      asentoEn = Date.now() - arranco
      // El corte se respeta: una consulta abortada no vuelve.
      if (signal?.aborted === true) return undefined
      return r
    })
  },
})

console.log(`\n  «${FRASE}»  ·  proveedor: ${transporteElegido()}\n`)
ordenes.decir(FRASE)

const antes = ordenes.ultimaLectura?.clausulas[0]
console.log(`  el lector local  ${String(antes?.grado)}  ${String(antes?.firma)}`)
console.log(`  el acuse         «${String(ordenes.charla[1]?.texto)}»`)
console.log(`  consultas        ${String(ordenes.consultas)}\n`)

// ─── Y ACÁ EL MUNDO CORRE, con la consulta viajando ────────────────────────
//
// El `setTimeout(0)` de cada vuelta es lo que le da lugar al `then` de la
// promesa: sin él, el bucle sincrónico no suelta el hilo ni una vez y lo que el
// modelo conteste no llega nunca. No es un truco del demo — es el bucle de
// cuadros del navegador, que suelta el hilo entre uno y otro.
for (let k = 0; k < TOPE; k++) {
  // A los 20 ticks, el cuidador cambia de tema. Eso corta lo que esté en el aire.
  if (CORTAR && k === 20) ordenes.decir('traé un palo')
  const aplicadasAntes = ordenes.aplicadas + ordenes.descartadas
  ordenes.antesDelTick(partida.state.tick)
  vivir(partida, ordenes.mentes, 1)
  ordenes.despuesDelTick()
  if (pedidaEn >= 0 && ordenes.aplicadas + ordenes.descartadas === aplicadasAntes) enElAire++
  if (ordenes.aplicadas + ordenes.descartadas > aplicadasAntes) {
    console.log(`  aterrizó en el tick ${String(partida.state.tick)}\n`)
    break
  }
  await new Promise((r) => setTimeout(r, 0))
}

const despues = ordenes.ultimaLectura?.clausulas[0]
const costo = costoDeLaUltima()

console.log('  ── lo que pasó ────────────────────────────────────────────')
console.log(`     ticks en el aire   ${String(enElAire)}   ${enElAire === 0 ? '← ROTO: algo lo esperó' : ''}`)
console.log(`     se pidió en tick   ${String(pedidaEn)}`)
console.log(`     aplicadas          ${String(ordenes.aplicadas)}`)
console.log(`     descartadas        ${String(ordenes.descartadas)}`)
console.log(`     grado antes        ${String(antes?.grado)}`)
console.log(`     grado después      ${String(despues?.grado)}  (${String(despues?.leidaPor)})`)
console.log(`     meta               ${String(despues?.firma)}`)
console.log(`     encargo            ${String(ordenes.encargo?.nodos.length ?? 0)} nodo(s)`)
console.log(
  `     costo              ${costo === undefined ? 'sin datos' : `${costo.modelo} · US$ ${costo.usd.toFixed(4)}`}`,
)
if (CORTAR) {
  // ─── LO QUE ESTE NÚMERO DICE, Y LO QUE NO ─────────────────────────────────
  //
  // DICE cuánto tardamos NOSOTROS en dejar de esperar después del abort. Los
  // catorce segundos de antes querían decir que sólo se ignoraba lo que volvía.
  //
  // NO DICE que el proceso se haya muerto, y la diferencia importa: en Windows
  // `spawn` con `shell: true` lanza `cmd.exe /c claude …`, así que el `kill`
  // podría matar al `cmd` y dejar vivo al nieto. Eso se mide desde AFUERA,
  // mirando la lista de procesos, y está anotado en `ii/docs/convergencia.md`:
  // cortado vive 1.130 ms y sin cortar 27.960 ms, o sea que sí lo mata.
  //
  // Y TAMPOCO dice que no se haya pagado. La consulta ya salió para el servidor;
  // matar el CLI local no cancela la inferencia del otro lado. Lo único que se
  // pierde es el sobre con `total_cost_usd`, que se imprime al final — por eso
  // el costo sale «sin datos» y eso no quiere decir que fue gratis.
  console.log(`     abortada a los     ${String(abortadaEn ?? -1)} ms`)
  console.log(`     asentó a los       ${String(asentoEn ?? -1)} ms`)
  console.log(
    `     siguió viva        ${String((asentoEn ?? 0) - (abortadaEn ?? 0))} ms   ← cerca de 0 es que cortó`,
  )
}
console.log('  ───────────────────────────────────────────────────────────\n')
console.log('  la charla:')
for (const d of ordenes.charla) console.log(`     t${String(d.tick)} [${d.clase}] ${d.texto}`)
console.log('')
