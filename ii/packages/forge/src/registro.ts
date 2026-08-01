/**
 * EL REGISTRO Y LA INSTALACIÓN — Hito 8, etapa 1 de los puntos que faltaban.
 *
 * ─── Por qué existe: no había CÓMO ESCRIBIR ────────────────────────────────
 *
 * Tres puntos del criterio hablan de lo mismo sin nombrarlo:
 *
 *   3 · «matar la conexión a mitad de un parche no deja el mundo inconsistente»
 *   6 · «la ganadora **reemplaza** sin perder un tick»
 *   7 · «una candidata peor **no reemplaza nada**»
 *
 * Los tres necesitan que exista un reemplazo. Y hasta este archivo **no había
 * ninguno**: medido, la frontera del tramo H entera —instrumentar, montar,
 * juzgar— dejaba el mundo con el mismo `hashWorldState`. No había una sola
 * escritura de la fragua a ningún lado, así que un test que dijera «cortar a
 * mitad no rompe nada» salía verde por no haber nada que romper.
 *
 * ─── LA MEDICIÓN QUE DEFINIÓ LA FORMA, y no la esperaba ─────────────────────
 *
 * Una habilidad forjada por el modelo **sí puede cambiar el mundo**. Medido con
 * `agarrarLoQueVeo`, montada y volada en una `Partida` de verdad:
 *
 *   holding  0 → 1
 *   hash     901678e3300afcd4 → 17312250b1d751bd
 *   outcome  { ok: true, got: { id: 'palito' } }
 *
 * Pero sólo si le viaja **la celda de combustible**. Sin ella:
 *
 *   ultimo: { k: 'rota', why: 'se le acabó el combustible…', error: { budget: 0 } }
 *
 * Las quince innatas son funciones planas y no tienen celda; una forjada pasa por
 * `instrument()` y **nace con el tanque en cero**. `VueloOptions.cell` ya existía
 * —la ranura estaba— y nadie la había cruzado desde este lado. Por eso `Instalada`
 * lleva la celda: **una instalación sin celda es una habilidad que muere en su
 * primer paso**, y se ve como un fallo de la habilidad y no del instalador.
 *
 * ─── UNA INSTALACIÓN SON DOS ESCRITURAS ─────────────────────────────────────
 *
 *   1. la habilidad montada, para que se pueda volar
 *   2. la capacidad publicada al catálogo, para que el planificador la elija
 *
 * Y ahí está la inconsistencia que el punto 3 tiene que impedir, que **no es una
 * del mundo**: una capacidad publicada sin habilidad detrás es un plan que la
 * criatura no puede ejecutar. El planificador la elige, la mente la va a buscar y
 * no hay nada.
 *
 * `revisarEstado` de `@anima/world` NO puede verla, y hay que decirlo con el
 * número: `hashWorldState` hashea tick, hz, nextId, física, cuerpos, actores,
 * celdas, desplegados y dios. **Las habilidades no son estado del mundo.** Así
 * que este invariante es propio y se llama `revisar()`.
 *
 * ─── Cómo se impide: una sola asignación ────────────────────────────────────
 *
 * `instalar` calcula las dos mitades ENTERAS y recién después las asigna, juntas.
 * No hay un instante alcanzable en el medio — y eso no es disciplina, es que
 * entre las dos líneas del final no hay `await`: la frontera del tick es
 * sincrónica de punta a punta (regla 2).
 *
 * El control positivo de eso vive en el test y es un instalador **deliberadamente
 * ingenuo** que escribe las dos mitades por separado. Cortado en el medio, deja
 * el registro incoherente. Sin ese instalador, «cortar no rompe nada» sería otra
 * vez el verde por omisión.
 */

import { conOverlay } from '@anima/plan'
import type { CatalogCapability, PlannerCatalogView } from '@anima/plan'
import type { FuelCell, Skill } from '@anima/skills'

/**
 * POR QUÉ EL DICTAMEN ENTRA COMO FORMA Y NO COMO TIPO IMPORTADO.
 *
 * Es la misma decisión que `loQueFalloDe` en `encargo.ts`, por el mismo motivo y
 * uno más. El motivo repetido: un `Dictamen` trae `regresiones[].semilla`, que es
 * el id de un mundo, y lo que no entra no se puede filtrar mal.
 *
 * El motivo nuevo: `@anima/judge` depende de `@anima/world` y de
 * `@anima/perceive`. Importarlo acá haría que **la fragua necesite el mundo para
 * escribir código**, que es exactamente al revés de lo que este paquete es.
 */
export interface CargoDelJuez {
  readonly cargo: string
  readonly grado: string
  readonly porque: string
}

/** Una habilidad instalada, con todo lo que hace falta para volarla y para juzgarla de nuevo. */
export interface Instalada {
  readonly nombre: string
  /** El texto, tal como salió de la fragua. Es lo que el duelo vuelve a montar. */
  readonly codigo: string
  readonly skill: Skill<Record<string, never>>
  /**
   * EL TANQUE. Ver el encabezado: sin esto la habilidad muere en su primer paso
   * con `OutOfFuel` y `budget: 0`, y parece culpa de ella.
   */
  readonly cell: FuelCell
  /**
   * LA CAPACIDAD PUBLICADA, Y ES OPCIONAL POR UN TECHO MEDIDO DEL CATÁLOGO.
   *
   * `ConstructionSchema` tiene exactamente tres formas y ninguna es «una
   * habilidad que establece X»:
   *
   *   proceso  pide un `ProcessId` de una enumeración cerrada
   *   ley      pide un `LeyId` de las doce, y una pila de roles
   *   obra     pide un `BlueprintDefinition`
   *
   * O sea que **una candidata CON plano se puede publicar** —sale un
   * `EsquemaDeObra` con `esquemaDeObra(def, establishes)`, que ya existe— y una
   * candidata suelta, no. Se puede instalar, se puede volar y el mundo cambia
   * (medido), pero el planificador no la puede elegir porque no hay fila que la
   * represente.
   *
   * Eso NO es una incoherencia del registro y por eso `revisar()` no la acusa: es
   * el techo del catálogo. Lo que sí sería una incoherencia es publicar una
   * capacidad sin habilidad detrás, y ésa se acusa.
   *
   * Queda contado y no escondido: `sinPublicar` dice cuántas hay.
   */
  readonly capacidad?: CatalogCapability
  /** Por qué se la promovió. Es contra esto que el duelo del punto 7 compara. */
  readonly porQue: readonly CargoDelJuez[]
}

/**
 * DE QUÉ HABILIDAD ES ESTA CAPACIDAD.
 *
 * `CatalogCapability.de` está documentado como «qué revisión exacta la respalda,
 * en texto», y hoy va **el nombre a secas**. No es lo ideal y conviene decir por
 * qué: el único digest del repositorio que serviría —`dosCarriles`, el que sella
 * el catálogo— es privado de `plan/src/catalogo.ts`, y escribir un segundo digest
 * al lado es la clase de duplicación que el guardián del sello existe para
 * atajar.
 *
 * Con **una titular por nombre** —que es la regla del registro— el nombre alcanza
 * como llave. El día que haya dos revisiones vivas de la misma habilidad, no.
 */
export function deQuienEs(c: CatalogCapability): string {
  return c.de
}

export type Incoherencia =
  /** Hay una capacidad publicada y no hay habilidad que la respalde. La grave. */
  | { readonly k: 'capacidad-sin-habilidad'; readonly nombre: string }
  /** Hay una habilidad montada que nadie puede elegir. La callada. */
  | { readonly k: 'habilidad-sin-capacidad'; readonly nombre: string }

/**
 * EL REGISTRO: las dos mitades de lo instalado, y el invariante que las ata.
 *
 * Una titular por nombre. Instalar de nuevo el mismo nombre **reemplaza**, que es
 * lo que el punto 6 pide con esas palabras.
 */
export class Registro {
  #titulares: ReadonlyMap<string, Instalada>
  #catalogo: PlannerCatalogView

  constructor(base: PlannerCatalogView) {
    this.#titulares = new Map()
    this.#catalogo = base
  }

  get titulares(): ReadonlyMap<string, Instalada> {
    return this.#titulares
  }

  get catalogo(): PlannerCatalogView {
    return this.#catalogo
  }

  /** La titular de este nombre, o `undefined` si no hay ninguna. */
  titular(nombre: string): Instalada | undefined {
    return this.#titulares.get(nombre)
  }

  /**
   * LA INSTALACIÓN, y es UNA operación.
   *
   * Las dos mitades se calculan enteras arriba y se asignan abajo, juntas. Entre
   * las dos asignaciones no hay `await` ni puede haberlo —regla 2— así que no
   * existe un instante en que el registro esté a medias.
   *
   * El catálogo se re-arma desde `base` y no se le apila overlay sobre overlay:
   * `conOverlay` acumula, así que reemplazar a la titular apilando dejaría la
   * capacidad vieja publicada para siempre. Medido en el test del duelo.
   */
  instalar(base: PlannerCatalogView, x: Instalada): void {
    const titulares = new Map(this.#titulares)
    titulares.set(x.nombre, x)
    const caps: CatalogCapability[] = []
    for (const i of titulares.values()) if (i.capacidad !== undefined) caps.push(i.capacidad)
    const catalogo = conOverlay(base, caps)

    // ─── Las dos escrituras, juntas ────────────────────────────────────────
    this.#titulares = titulares
    this.#catalogo = catalogo
  }

  /**
   * CUÁNTAS INSTALADAS NO SE PUEDEN PUBLICAR, por el techo del catálogo.
   *
   * Existe para que ese techo sea un número visible y no un silencio. Ver el
   * comentario de `Instalada.capacidad`.
   */
  get sinPublicar(): number {
    let n = 0
    for (const i of this.#titulares.values()) if (i.capacidad === undefined) n++
    return n
  }

  /**
   * EL INVARIANTE. Vacío quiere decir coherente.
   *
   * Se mira en las dos direcciones y no en una: una capacidad publicada sin
   * habilidad detrás es un plan que la criatura no puede ejecutar —el
   * planificador la elige y no hay nada— y una habilidad que TRAJO capacidad y no
   * quedó publicada es trabajo pagado que nadie va a elegir. La primera rompe la
   * partida, la segunda la empobrece en silencio, y una función que sólo mirara
   * la grave dejaría pasar exactamente la mitad de un instalador ingenuo.
   *
   * Lo que NO se acusa es la instalada sin capacidad: eso es el techo del
   * catálogo, no una incoherencia. Se cuenta aparte, en `sinPublicar`.
   */
  revisar(): readonly Incoherencia[] {
    const out: Incoherencia[] = []
    const publicadas = new Set(
      [...this.#catalogo.buildCapabilities, ...this.#catalogo.skillCapabilities].map(deQuienEs),
    )
    for (const n of publicadas) {
      if (!this.#titulares.has(n)) out.push({ k: 'capacidad-sin-habilidad', nombre: n })
    }
    for (const [n, i] of this.#titulares) {
      if (i.capacidad !== undefined && !publicadas.has(n)) {
        out.push({ k: 'habilidad-sin-capacidad', nombre: n })
      }
    }
    return out
  }
}
