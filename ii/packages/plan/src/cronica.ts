// ─── EL CATÁLOGO SALE DE LA CRÓNICA — punto 10 del Gate 5→6 ─────────────────
//
//   > el **mismo journal produce el mismo mundo y el mismo catálogo**
//
// Hasta acá la primera mitad era cierta y la segunda no existía. El mundo se
// reconstruye plegando las intenciones del journal (`replay`, en `@anima/world`);
// el catálogo de una partida vivía en una variable que alguien pasaba de mano en
// mano, así que **restaurar una partida devolvía el mundo con el catálogo del
// proceso**, no con el de la partida. Un plan que dependía de una capacidad
// registrada en el tick 400 salía distinto al reproducirlo, y no había con qué
// notarlo.
//
// ─── LA DECISIÓN: UNA SOLA CRÓNICA, DOS LECTORES ───────────────────────────
//
//     crónica (append-only, un solo orden)
//        ├── stepWorld ......... pliega las intenciones  → WorldState
//        └── catalogoHasta ..... pliega los registros    → PlannerCatalogView
//
// ─── POR QUÉ NO ADENTRO DE `WorldState`, QUE ES LO PRIMERO QUE UNO PIENSA ───
//
// Porque el grafo de paquetes es `physics → oracle → world → skills → plan`, o
// sea que **`@anima/world` está DEBAJO de `@anima/plan`**: para guardar un
// `ConstructionSchema` adentro del mundo, el mundo tendría que saber qué es un
// esquema del planificador. Es una flecha que el diagrama no tiene, y traería
// puesto que el `worldHash` dependa del catálogo — con eso, registrar una
// capacidad movería la huella de una partida en la que no pasó nada físico.
//
// ─── Y POR QUÉ NO UNA CRÓNICA APARTE PARA EL CATÁLOGO ──────────────────────
//
// Porque dos archivos append-only son dos relojes, y dos relojes es exactamente
// cómo se llega a «el catálogo del tick 400 con el mundo del tick 380». El orden
// entre una intención y un registro **importa**: si la criatura planifica en el
// tick 400 y la capacidad se registró en el 399, el plan la usa; si se registró en
// el 401, no. Con un solo arreglo eso no se puede desincronizar.
//
// ─── LO QUE ESTE MÓDULO NO SABE, A PROPÓSITO ───────────────────────────────
//
// Qué es una intención del mundo. `RenglonDeCronica` pide `tick` y un `intent`
// opaco, y `esRegistro` reconoce los suyos y deja pasar el resto. Con eso este
// paquete no necesita depender de `@anima/world` para plegar su mitad, y el día
// que el journal lleve una tercera clase de renglón ninguno de los dos lectores se
// entera del otro.

import { conOverlay } from './catalogo.js'
import type { CatalogCapability, PlannerCatalogView } from './catalogo.js'
import type { ConstructionSchema } from './tipos.js'

/**
 * UN RENGLÓN DE CATÁLOGO EN LA CRÓNICA: se registró esta capacidad.
 *
 * Lleva la capacidad entera y no el sello, y la diferencia importa: lo que se
 * journalea es **la decisión ya tomada**, no la evidencia. Reproducir una partida
 * no vuelve a juzgar —el juez pudo haber cambiado— sino que vuelve a llegar al
 * mismo lado. Es la misma razón por la que el journal guarda intenciones y no
 * estados: se guarda lo que pasó, no lo que se creía.
 *
 * `k: 'registrar'` no colisiona con ninguna de las nueve clases de `Intent` del
 * mundo (`wait`, `goTo`, `explore`, `take`, `drop`, `put`, `eat`, `apply`,
 * `place`), y hay un test que lo afirma para que un `k` nuevo del mundo no se
 * coma un registro en silencio.
 */
export interface RegistroDeCatalogo {
  readonly k: 'registrar'
  readonly clase: 'construir' | 'usar'
  /** La revisión exacta que la respalda. Es lo que el punto 8 compara. */
  readonly de: string
  readonly esquema: ConstructionSchema
}

/** Lo mínimo que este módulo necesita de un renglón. El resto no lo mira. */
export interface RenglonDeCronica {
  readonly tick: number
  readonly intent: unknown
}

/** Escribe una capacidad ya publicada como renglón de crónica. */
export function registrar(cap: CatalogCapability): RegistroDeCatalogo {
  return { k: 'registrar', clase: cap.clase, de: cap.de, esquema: cap.esquema }
}

/**
 * ¿Este renglón es de catálogo?
 *
 * Escrito a mano y no con un `as`: el journal viene de un archivo, y un `as` sobre
 * datos que pasaron por JSON es una afirmación sin nada que la sostenga. La
 * comprobación mira las cuatro claves porque las cuatro se usan.
 */
export function esRegistro(x: unknown): x is RegistroDeCatalogo {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Partial<RegistroDeCatalogo>
  return (
    o.k === 'registrar' &&
    (o.clase === 'construir' || o.clase === 'usar') &&
    typeof o.de === 'string' &&
    typeof o.esquema === 'object' &&
    o.esquema !== null
  )
}

/**
 * EL CATÁLOGO AL COMIENZO DEL TICK `hasta`, plegando la crónica desde el arranque.
 *
 * ─── LA CONVENCIÓN DEL TICK, QUE ES DE DONDE SALEN LOS ERRORES DE UNO ──────
 *
 * Es la MISMA que el journal del mundo: `tick: t` quiere decir «este renglón se
 * consume DURANTE el tick t», y un estado «en el tick t» es el estado AL COMIENZO
 * de t, con los anteriores ya corridos. Así que acá entran los registros de ticks
 * **estrictamente menores** que `hasta`, y con eso
 * `catalogoHasta(base, c, d.tick)` es el compañero exacto de
 * `replay(j, { tick: d.tick, state }, step)`, sin sumar ni restar uno en ningún
 * lado.
 *
 * Un corrimiento de un tick acá no da un error: da una partida en la que la
 * criatura planificó con una capacidad que todavía no tenía, y eso es un plan
 * coherente y equivocado — que es la clase de bug que no se encuentra nunca.
 *
 * ─── POR QUÉ SE PLIEGA ENTERO Y NO SE GUARDA UN ACUMULADOR ─────────────────
 *
 * Porque un acumulador es estado que hay que guardar, restaurar y mantener en
 * sincronía con el journal, o sea otra cosa que se puede desincronizar. Plegar
 * cuesta un recorrido de una lista que tiene tantas entradas como capacidades
 * registró la partida —decenas, no miles— y no puede quedar viejo.
 */
export function catalogoHasta(
  base: PlannerCatalogView,
  cronica: readonly RenglonDeCronica[],
  hasta: number,
): PlannerCatalogView {
  const caps: CatalogCapability[] = []
  for (const r of cronica) {
    if (r.tick >= hasta) break
    if (!esRegistro(r.intent)) continue
    caps.push({ clase: r.intent.clase, de: r.intent.de, esquema: r.intent.esquema })
  }
  return caps.length === 0 ? base : conOverlay(base, caps)
}

/**
 * El catálogo con TODA la crónica adentro. El caso de «terminó la partida».
 *
 * `Infinity` y no `cronica[cronica.length - 1].tick + 1` porque el segundo se
 * equivoca con una crónica vacía y hay que acordarse; y porque «todo» es lo que
 * se quiere decir.
 */
export function catalogoDeLaCronica(
  base: PlannerCatalogView,
  cronica: readonly RenglonDeCronica[],
): PlannerCatalogView {
  return catalogoHasta(base, cronica, Infinity)
}

/**
 * LAS INTENCIONES DEL MUNDO de un renglón, o sea todo lo que NO es de catálogo.
 *
 * Existe acá y no del lado del mundo por la misma razón que `esRegistro`: quien
 * sabe qué es un registro es este paquete, y el mundo no tiene por qué aprenderlo
 * para poder ignorarlo.
 */
export function sinRegistros<T extends RenglonDeCronica>(cronica: readonly T[]): readonly T[] {
  return cronica.filter((r) => !esRegistro(r.intent))
}
