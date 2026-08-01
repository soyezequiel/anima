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
import type { MessagePort } from 'node:worker_threads'
import ts from 'typescript'
import type { Candidata } from '../src/candidata.js'
import { loQueVaAfuera } from '../src/episodio.js'
import type { LoForjado } from '../src/episodio.js'
import { Puerta } from '../src/puerta.js'

/** Lo que se le manda al hilo: las K candidatas de un viaje, o el corte. */
export type Pedido =
  | { readonly k: 'forjá'; readonly candidatas: readonly Candidata[] }
  /**
   * EL CORTE — punto 3 del criterio.
   *
   * El criterio nombra `AbortController`, y acá adentro no sirve: un
   * `AbortSignal` no cruza un `postMessage` —no es clonable— y aunque cruzara,
   * `forjarUna` es **sincrónica de punta a punta** y no hay dónde escucharlo.
   *
   * Lo que sí funciona es lo mismo con otra forma: **una bandera que se mira
   * entre candidatas**. Es el único instante alcanzable del lado de afuera, y es
   * suficiente — la unidad de trabajo del hilo es una candidata, no una línea.
   */
  | { readonly k: 'cortá' }

/** Lo que contesta. `listo` sale una vez, cuando la puerta ya está tibia. */
export type Respuesta =
  | { readonly k: 'listo' }
  | {
      readonly k: 'forjado'
      readonly forjados: readonly LoForjado[]
      /** Si se cortó, cuántas quedaron sin forjar. Cero en el camino normal. */
      readonly sinForjar: number
    }

if (parentPort === null) throw new Error('el hilo de la fragua se arrancó sin puerto')

/**
 * El puerto, ya verificado y en una constante propia.
 *
 * `parentPort` es `MessagePort | null` y el estrechamiento de un `if` no
 * sobrevive a cruzar un `async`. Una constante local sí.
 */
const puerto: MessagePort = parentPort

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

/**
 * LA BANDERA DEL CORTE, y el `await` que la hace posible.
 *
 * ─── La primera versión NO SE PODÍA CORTAR, y está medido ───────────────────
 *
 * Era un `for` sincrónico que miraba la bandera entre candidatas, con este
 * razonamiento escrito al lado: *«el hilo procesa los mensajes de a uno, así que
 * el `cortá` entra cuando el bucle cede el turno»*. **Falso**: un handler
 * sincrónico no cede el turno nunca, así que el `cortá` se queda en la cola hasta
 * que el bucle termina — y para entonces ya no hay nada que cortar.
 *
 * Medido: cortando a mitad, `forjadas 6 de 6 · sin forjar 0`. El test pasaba, y
 * pasaba por no haber cortado nada. Sexto verde por omisión del hito, y éste lo
 * escribí yo.
 *
 * Lo que lo arregla es una línea: **ceder el turno entre candidatas**. Un
 * `setImmediate` deja que el planificador entregue lo que haya en la cola, y ahí
 * sí la bandera puede estar prendida.
 *
 * Cuesta ~0 contra una candidata de 56 ms, y es legal acá: esto es `demo/`, no
 * `src/`. La regla 2 prohíbe el `await` en el camino del tick, y este hilo es
 * justamente el que **no** está en el camino del tick.
 */
let cortada = false

const cederElTurno = (): Promise<void> => new Promise((r) => setImmediate(r))

puerto.on('message', (m: Pedido) => {
  if (m.k === 'cortá') {
    cortada = true
    return
  }
  cortada = false
  void forjar(m.candidatas)
})

async function forjar(candidatas: readonly Candidata[]): Promise<void> {
  const forjados: LoForjado[] = []
  let sinForjar = 0
  for (const c of candidatas) {
    // El turno se cede ANTES de mirar la bandera: al revés, la primera candidata
    // se forjaría siempre porque el `cortá` todavía no tuvo por dónde entrar.
    await cederElTurno()
    if (cortada) {
      sinForjar++
      continue
    }
    forjados.push(...loQueVaAfuera([c], puerta))
  }

  const r: Respuesta = { k: 'forjado', forjados, sinForjar }
  puerto.postMessage(r)
}
