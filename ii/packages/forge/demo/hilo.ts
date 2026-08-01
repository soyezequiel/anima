/**
 * EL HILO DE LA FRAGUA — Hito 8, tramo H.
 *
 * Acá corre **lo único que no entra en una ventana de tick**: el viaje al modelo
 * y la puerta. La tabla que lo decide está en `src/episodio.ts` y el número que
 * la manda es uno solo — la puerta cuesta p50 56 ms y la ventana son 50.
 *
 * ─── Lo que este archivo NO hace, y es la mitad del diseño ──────────────────
 *
 * No monta, no juzga y no instala. Las tres cosas necesitan el objeto montado, y
 * **un objeto con funciones adentro no cruza un `postMessage`**. Lo que sale de
 * acá es lo que ya era texto.
 *
 * ─── Por qué vive en `demo/` ────────────────────────────────────────────────
 *
 * Por la regla 2: `parentPort.on` es asincronía, y en `src/` no hay un `await`.
 * La misma frontera del Hito 6 — el paquete describe, el llamador espera. Lo que
 * este archivo aporta es exclusivamente el CRUCE; la lógica es `loQueVaAfuera`,
 * que es sincrónica y vive del otro lado.
 */

import { parentPort } from 'node:worker_threads'
import ts from 'typescript'
import type { Candidata } from '../src/candidata.js'
import { loQueVaAfuera } from '../src/episodio.js'
import type { LoForjado } from '../src/episodio.js'
import { Puerta } from '../src/puerta.js'

/** Lo que se le manda al hilo: las K candidatas de un viaje. */
export interface Pedido {
  readonly k: 'forjá'
  readonly candidatas: readonly Candidata[]
}

/** Lo que contesta. `listo` sale una vez, cuando la puerta ya está tibia. */
export type Respuesta =
  | { readonly k: 'listo' }
  | { readonly k: 'forjado'; readonly forjados: readonly LoForjado[] }

const puerto = parentPort
if (puerto === null) throw new Error('el hilo de la fragua se arrancó sin puerto')

/**
 * UNA sola puerta para todo el hilo, y es lo que compra los 56 ms.
 *
 * El `LanguageService` tiene que sobrevivir entre candidatas o no hay estructura
 * que reusar: una puerta por pedido son los +319 ms por candidata que el banco
 * del Hito 0 midió para `createProgram`.
 */
const puerta = new Puerta(ts)

/**
 * EL PRIMER TYPECHECK PAGA EL PROGRAMA ENTERO, y se paga acá a propósito.
 *
 * Medido sobre el corpus: la primera pasada son **428 ms** y las siguientes 56.
 * Si ese arranque cayera con la primera candidata de verdad, el episodio tendría
 * medio segundo de más que no es de nadie. Acá lo paga el arranque del hilo, con
 * el mundo todavía sin correr.
 */
puerta.revisar('export const tibia = 1\n')

const listo: Respuesta = { k: 'listo' }
puerto.postMessage(listo)

puerto.on('message', (m: Pedido) => {
  const r: Respuesta = { k: 'forjado', forjados: loQueVaAfuera(m.candidatas, puerta) }
  puerto.postMessage(r)
})
