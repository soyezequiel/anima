/**
 * LA FRAGUA CONTRA EL MODELO DE VERDAD — Hito 8, puntos 1 y 2.
 *
 *   > dado el gap «conseguir alimento de un cuerpo de agua», **al menos una de
 *   > dos candidatas compila sin reparación** y **al menos una compila con
 *   > reparación**
 *
 * ─── Por qué esto es un demo y no un test ───────────────────────────────────
 *
 * Porque cuesta plata y contesta distinto cada vez, que son las dos razones por
 * las que existe el muñeco. Un test que llama a un modelo real dice «funciona»
 * un día y «falla» al otro sin que nadie toque nada.
 *
 * Lo que la suite vigila para siempre es la CAÑERÍA, con el muñeco. Lo que esto
 * mide —una vez, y se anota— es si el modelo de verdad la llena.
 *
 * ─── Cómo se corre ──────────────────────────────────────────────────────────
 *
 *     ANIMA_LLM=claude ANIMA_HILO=<esta ruta> node packages/forge/demo/arranque.mjs
 *
 * `--vueltas N` da varias corridas seguidas, que es lo que hace falta para decir
 * algo sobre un modelo que contesta distinto cada vez.
 */

import { costoDeLaUltima, preguntarTexto, transporteElegido } from '@anima/llm/demo/transporte.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { leerCandidatas } from '../src/costura.js'
import { conceptosDe, elSiguienteEncargo, primerEncargo, textoDe } from '../src/index.js'
import type { Superficie } from '../src/encargo.js'
import { forjarUna } from '../src/forjar.js'
import { Puerta } from '../src/puerta.js'

const GAP = 'conseguir alimento de un cuerpo de agua'

/**
 * EL PEDIDO DEL CONTROL, y por qué NO es el del criterio.
 *
 * El primer intento de forzar el error corrió con el gap del criterio —pescar— y
 * el manual viejo no mordió: **6 de 6 salieron limpias igual**. El motivo, obvio
 * una vez visto: `secondsToNightfall` es el reloj, y pescar no mira el reloj. Se
 * corrompió un nombre que este pedido no usa nunca.
 *
 * El nombre viejo sale del corpus —29 apariciones, el error más frecuente— pero
 * la frecuencia era sobre 28 borradores de TODO tipo, no sobre éste. Un control
 * que corrompe algo que el sujeto no toca no controla nada.
 *
 * Así que el control cambia de pedido: uno que **no se puede escribir sin mirar
 * el reloj**. El criterio sigue midiéndose con el suyo; esto mide la REPARACIÓN,
 * que es otra cosa.
 */
const GAP_DEL_RELOJ = 'ponerse a cubierto antes de que caiga la noche'
const VOCABULARIO = ['madera', 'liana', 'carne', 'agua', 'piedra', 'hueso']
const K = 2

const API = readFileSync(fileURLToPath(new URL('../../skills/src/skill-api.d.ts', import.meta.url)), 'utf8')

/**
 * EL MANUAL VIEJO — el control positivo del punto 2, y es un caso REAL.
 *
 * ─── El problema ────────────────────────────────────────────────────────────
 *
 * El punto 2 pide «al menos una candidata compila CON reparación», y medido
 * contra Claude: **10 de 10 salen limpias**. La reparación no tiene nada que
 * reparar, así que el punto no se puede afirmar esperando a que el modelo se
 * equivoque.
 *
 * ─── Cómo se fuerza sin hacer trampa ────────────────────────────────────────
 *
 * No pidiéndole al modelo que escriba mal —eso mediría si obedece— sino
 * **dándole un manual con un nombre viejo**. El modelo escribe bien contra el
 * manual que le dimos; la puerta compila contra el manual de verdad; y la
 * diferencia entre los dos es exactamente el typo que la reparación arregla.
 *
 * Y no es un caso inventado: **es lo que pasa el día que la API cambia y el
 * prompt quedó viejo.** Un `secondsToNightfall` que ayer se llamaba
 * `ticksToNightfall` es la forma más común de romper a un modelo sin que nadie
 * se entere.
 *
 * El nombre no se eligió al azar: `ticksToNightfall` es **el error más frecuente
 * del corpus de 28 borradores, con 29 apariciones**, y está a siete letras del
 * correcto — adentro del corte de la reparación.
 */
const VIEJO = 'ticksToNightfall'
const NUEVO = 'secondsToNightfall'

function conElManualViejo(api: string): string {
  return api.split(NUEVO).join(VIEJO)
}

const forzar = process.argv.includes('--manual-viejo')
const cuantas = Number(process.argv.find((a) => a.startsWith('--vueltas='))?.split('=')[1] ?? '1')
const puerta = new Puerta(ts)
puerta.revisar('export const tibia = 1\n')

/**
 * LA SUPERFICIE QUE SE MANDA, que con `--manual-viejo` NO es la que compila.
 *
 * Es toda la gracia del control: la puerta sigue compilando contra
 * `skill-api.d.ts` de verdad, sin enterarse de nada.
 */
const SUPERFICIE: Superficie = {
  api: forzar ? conElManualViejo(API) : API,
  desde: '../../src/skill-api.js',
  cuantas: K,
}

console.log(
  `\ntransporte: ${transporteElegido()} · ${String(cuantas)} viaje(s) de K=${String(K)}` +
    (forzar ? `\nMANUAL VIEJO: se le manda «${VIEJO}» donde la API de verdad dice «${NUEVO}»` : '') +
    '\n',
)

let limpias = 0
let reparadas = 0
let rotas = 0
let usd = 0

for (let v = 1; v <= cuantas; v++) {
  const e = primerEncargo(forzar ? GAP_DEL_RELOJ : GAP, VOCABULARIO)
  const prompt = textoDe(e, SUPERFICIE)
  const t0 = Date.now()
  const salida = await preguntarTexto(prompt, 180_000)
  const ms = Date.now() - t0
  usd += costoDeLaUltima()?.usd ?? 0

  if (salida === undefined) {
    console.log(`  viaje ${String(v)}: el modelo no contestó`)
    continue
  }

  const cs = leerCandidatas(salida, e, K)
  const filas: string[] = []
  const conceptos = new Set<string>()

  for (const c of cs) {
    const f = c.usar
    if (f === undefined) continue
    const i = forjarUna(f.fuente, puerta)
    if (i.desenlace === 'limpia') limpias++
    else if (i.desenlace === 'reparada') reparadas++
    else rotas++
    for (const n of conceptosDe(i.erroresQueQuedaron)) conceptos.add(n)
    const detalle =
      i.desenlace === 'reparada'
        ? i.cambios.map((c2) => `${c2.de} → ${c2.a}`).join(', ')
        : i.desenlace === 'rota'
          ? conceptosDe(i.erroresQueQuedaron).join(', ') || i.erroresQueQuedaron[0]?.mensaje.slice(0, 60) || ''
          : ''
    filas.push(`    ${f.nombre.padEnd(26)} ${i.desenlace.padEnd(10)} ${detalle}`)
  }

  console.log(`  viaje ${String(v)} · ${String(cs.length)} candidatas · ${String(ms)} ms`)
  console.log(filas.join('\n'))

  // El punto 9 contra el modelo real: si algo se rompió, qué le diría la vuelta 2.
  if (conceptos.size > 0) {
    const dos = elSiguienteEncargo(
      e,
      [...conceptos].map((n) => ({ nombre: n, desenlace: 'rota' as const, codigo: '', cambios: [], conceptos: [n], puertazos: 1 })),
      [],
    )
    console.log(`    → la vuelta 2 le contaría: ${dos.loQueFallo.conceptosQueNoExisten.join(' · ')}`)
  }
}

const total = limpias + reparadas + rotas
console.log(
  `\n  ── ${String(total)} candidatas en ${String(cuantas)} viaje(s) ──` +
    `\n  limpias    ${String(limpias)}` +
    `\n  reparadas  ${String(reparadas)}` +
    `\n  rotas      ${String(rotas)}` +
    `\n  costo      US$ ${usd.toFixed(4)}\n`,
)
console.log(`  punto 1 (al menos una limpia): ${limpias > 0 ? 'CUMPLE' : 'no'}`)
console.log(`  punto 2 (al menos una reparada): ${reparadas > 0 ? 'CUMPLE' : 'no'}\n`)
