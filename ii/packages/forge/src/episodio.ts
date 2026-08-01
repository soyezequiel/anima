/**
 * EL EPISODIO DE LA FRAGUA — Hito 8, tramo H. El punto 5 del criterio.
 *
 *   > **`ticksPerdidos === 0`** durante todo el episodio.
 *
 * ─── LA MEDICIÓN QUE MANDA, y salió antes de escribir una línea de esto ─────
 *
 * Una ventana de tick a 20 Hz son **50 ms**. Eso es todo el presupuesto que hay
 * entre un `stepWorld` y el siguiente. Medido en este paquete, contra esa
 * ventana:
 *
 * | pieza | costo | ¿entra? |
 * |---|---|---|
 * | el viaje al modelo | 6 a 25 s | **no**, por 120× |
 * | la puerta (`revisar`) | p50 56 ms · p95 105 | **no**, por poco y siempre |
 * | instrumentar + montar | p50 2,4 ms | sí |
 * | juzgar una habilidad | p50 2,9 ms | sí |
 * | un tick pelado | 0,02 ms | sí |
 *
 * Y la consecuencia, medida y no razonada — la fragua entera corrida en el hilo
 * del mundo, entre dos ticks:
 *
 *   de una sola vez ............ 10 ticks perdidos
 *   en rodajas, una por hueco ... 7 ticks perdidos
 *   en OTRO hilo ................ 0
 *
 * **Cortar en rodajas no alcanza**, y ése es el hallazgo del tramo. La rodaja
 * más fina que existe es una pasada por la puerta, y una sola pasada ya vale una
 * ventana entera. No hay forma de repartirla.
 *
 * ─── Entonces el episodio se parte en dos, y la línea está medida ───────────
 *
 * Lo único que va afuera es **lo que no entra en una ventana**. No es una
 * arquitectura elegida: es la tabla de arriba leída de arriba abajo.
 *
 *   AFUERA        el viaje al modelo · la puerta · la reparación
 *   EN LA FRONTERA  instrumentar · montar · juzgar · instalar
 *
 * ─── Lo que cruza la frontera es TEXTO, y no por gusto ──────────────────────
 *
 * Una habilidad montada es un objeto con funciones adentro, y **las funciones no
 * pasan por un `postMessage`**: el clonado estructurado no las sabe copiar. Así
 * que lo que vuelve del otro lado es lo que ya era texto — el código y los
 * errores— y montar se hace de este lado.
 *
 * Eso además cae bien con lo que el sandbox del Hito 4 pide: **entre que sale del
 * modelo y que corre hay tres puertas**, y ninguna puede trabajar sobre algo ya
 * evaluado.
 *
 * ─── Por qué este archivo NO abre el hilo ───────────────────────────────────
 *
 * Por la regla 2, la misma del Hito 6: en `src/` no hay un `await`. Un `Worker`
 * es asincrónico por definición, así que acá vive **la descripción** —qué paso
 * va de qué lado, y las dos mitades como funciones sincrónicas— y quien puede
 * esperar es el llamador. Es la frontera del ADR II-0024, otra vez: *el paquete
 * describe, el llamador manda*.
 */

import type { ApiTS } from '@anima/skills'
import { instrument } from '@anima/skills'
import type { Candidata } from './candidata.js'
import { fuentesDe } from './candidata.js'
import type { Encargo, LoQueFallo } from './encargo.js'
import { conceptosDe, loQueFalloDe, otraVuelta } from './encargo.js'
import { forjarUna } from './forjar.js'
import type { Desenlace } from './forjar.js'
import type { Puerta } from './puerta.js'
import type { Cambio } from './reparar.js'

/** La ventana de un tick a 20 Hz, en milisegundos. Es TODO el presupuesto. */
export const VENTANA_MS = 50

/**
 * DE QUÉ LADO DE LA FRONTERA CORRE UN PASO.
 *
 * Los dos nombres dicen la regla: lo que no entra en una ventana no puede estar
 * en el hilo donde vive el mundo, y lo que entra tiene que correr **entre dos
 * ticks** y no en el medio de uno.
 */
export type Donde = 'afuera' | 'frontera'

export interface Paso {
  readonly nombre: string
  readonly donde: Donde
  /** Por qué está de ese lado. Sale de la tabla del encabezado. */
  readonly porque: string
}

/**
 * EL EPISODIO, EN ORDEN.
 *
 * Es un dato y no prosa por una razón sola: la clasificación se puede leer de un
 * vistazo y se puede contar. El test del tramo cuenta los que dicen `frontera` y
 * **cronometra los cuatro juntos** contra una ventana.
 *
 * Lo que NO se guarda acá son los milisegundos. Un número copiado en una tabla
 * queda viejo en silencio, que es lo que este repositorio viene castigando: lo
 * que se declara es la CLASIFICACIÓN, y el costo lo mide quien corre.
 *
 * **Lo que esta lista no puede probar**, y hay que decirlo: que los cuatro
 * `afuera` estén bien clasificados. Dos de ellos —el viaje al modelo y la
 * puerta— tienen su número medido; el tercero termina en el segundo, y el
 * primero cuesta plata cada vez que se lo mide. Lo que sí está probado es la
 * consecuencia: con ellos adentro del hilo del mundo se pierden ticks, y con
 * ellos afuera no.
 */
export const PASOS: readonly Paso[] = [
  { nombre: 'el encargo', donde: 'frontera', porque: 'es armar un string' },
  { nombre: 'el viaje al modelo', donde: 'afuera', porque: '6 a 25 s: 120 ventanas' },
  { nombre: 'la puerta', donde: 'afuera', porque: 'p50 56 ms: una ventana entera por candidata' },
  { nombre: 'la reparación', donde: 'afuera', porque: 'termina en otra pasada por la puerta' },
  {
    nombre: 'instrumentar y montar',
    donde: 'frontera',
    porque: 'p50 2,4 ms, y lo montado no cruza hilos — pero hay que tibiarlo antes: ver `tibiarElMontaje`',
  },
  { nombre: 'juzgar', donde: 'frontera', porque: 'p50 2,9 ms, y necesita lo montado' },
  { nombre: 'el encargo de la vuelta siguiente', donde: 'frontera', porque: 'es armar otro string' },
]

/**
 * LO QUE VUELVE DEL OTRO HILO. Datos y nada más — ver el encabezado.
 *
 * Es `Intento` de `forjar.ts` con dos diferencias, y las dos son por el cruce:
 * se le agrega el nombre (del otro lado no hay a quién preguntárselo) y los
 * errores crudos se resumen a `conceptos`, que es lo único que el encargo de la
 * vuelta siguiente usa. Mandar los `Error` enteros sería mandar posiciones de un
 * archivo que de este lado no existe.
 */
export interface LoForjado {
  readonly nombre: string
  readonly desenlace: Desenlace
  readonly codigo: string
  readonly cambios: readonly Cambio[]
  /** Los nombres que pidió y el mundo no tiene. Vacío salvo en `rota`. */
  readonly conceptos: readonly string[]
  /** El costo local, en pasadas por la puerta. Una pasada ≈ una ventana. */
  readonly puertazos: number
}

/**
 * LA MITAD DE AFUERA: puerta y reparación, para todas las candidatas del viaje.
 *
 * Sincrónica, y es correcto que lo sea: **del otro lado del hilo no hay tick que
 * perder**. Toda la asincronía del episodio está en el cruce, y el cruce lo hace
 * el llamador.
 */
export function loQueVaAfuera(candidatas: readonly Candidata[], p: Puerta): readonly LoForjado[] {
  const out: LoForjado[] = []
  for (const c of candidatas) {
    for (const f of fuentesDe(c)) {
      const i = forjarUna(f.fuente, p)
      out.push({
        nombre: f.nombre,
        desenlace: i.desenlace,
        codigo: i.codigo,
        cambios: i.cambios,
        conceptos: conceptosDe(i.erroresQueQuedaron),
        puertazos: i.puertazos,
      })
    }
  }
  return out
}

/**
 * LAS QUE MERECEN QUE EL HILO DEL MUNDO GASTE UNA VENTANA EN ELLAS.
 *
 * Las rotas se quedan afuera: montarlas costaría lo mismo que montar una buena y
 * no hay nada que juzgar. Lo suyo es alimentar la vuelta siguiente, que es
 * `elSiguienteEncargo` y no cuesta un tick.
 */
export function loQueEntra(fs: readonly LoForjado[]): readonly LoForjado[] {
  return fs.filter((f) => f.desenlace !== 'rota')
}

/**
 * EL PUNTO 9, ARMADO — lo que falló alimenta al que viene.
 *
 * Junta las **dos** formas de fallar, que hasta este tramo vivían separadas:
 *
 *   · las que no compilaron  → `conceptos` y `cambios`, del otro hilo
 *   · las que compilaron y NO SIRVEN → los cargos del juez, de este lado
 *
 * La segunda es la que el usuario pidió y la que el criterio heredado no tenía:
 * *«capaz que con un pequeño cambio se lo arregla, en vez de crear una habilidad
 * nueva desde cero»*. Sin el juez no había forma de saber que hacía falta.
 *
 * Y los cargos entran **sin el dictamen**: `loQueFalloDe` recibe la lista y
 * nunca el objeto, porque un `Dictamen` trae las semillas de los mundos adentro.
 * Ver su encabezado — el guardián es la firma.
 */
export function loQueFalloDelEpisodio(
  fs: readonly LoForjado[],
  cargos: readonly { readonly cargo: string; readonly grado: string; readonly porque: string }[],
): LoQueFallo {
  const conceptos = new Set<string>()
  const cambios: Cambio[] = []
  for (const f of fs) {
    for (const c of f.conceptos) conceptos.add(c)
    for (const c of f.cambios) cambios.push(c)
  }
  return loQueFalloDe(cargos, [...conceptos].sort(), cambios)
}

/**
 * TIBIAR EL MONTAJE, ANTES DE QUE EL MUNDO ARRANQUE.
 *
 * ─── El número que lo obliga ────────────────────────────────────────────────
 *
 * `instrument()` cuesta **p50 2,4 ms** tibio y **~55 ms la primera vez del
 * proceso**: la primera llamada a `transpileModule` paga la inicialización de
 * TypeScript entera. Medido en el tramo H, en la corrida real del episodio —la
 * frontera del primer episodio dio **56,1 ms** y la del segundo **6,1**—.
 *
 * Cincuenta y seis contra una ventana de cincuenta. **La primera habilidad que
 * se instale en la vida de una partida se lleva un tick puesto.**
 *
 * ─── Por qué se arregla tibiando y no cortando ──────────────────────────────
 *
 * Porque no hay nada que cortar: el costo es de adentro de TypeScript y no se
 * reparte. Lo que sí se puede elegir es **cuándo** se paga, y hay un momento en
 * que es gratis — antes de que el bucle arranque, cuando todavía no hay ninguna
 * ventana que vencer.
 *
 * Es exactamente lo que hace el hilo de la fragua con la puerta (428 ms en frío
 * contra 56 tibia). El mismo problema, dos veces, en los dos lados de la
 * frontera.
 */
export function tibiarElMontaje(ts: ApiTS): void {
  instrument(ts, 'export const tibia = 1\n')
}

/** El encargo de la vuelta que viene, con todo lo que se aprendió en ésta. */
export function elSiguienteEncargo(
  previo: Encargo,
  fs: readonly LoForjado[],
  cargos: readonly { readonly cargo: string; readonly grado: string; readonly porque: string }[],
): Encargo {
  return otraVuelta(previo, loQueFalloDelEpisodio(fs, cargos))
}
