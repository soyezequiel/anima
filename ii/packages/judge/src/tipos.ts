/**
 * EL VOCABULARIO DEL VEREDICTO — Hito 7, tramo C.
 *
 * Antes de este archivo, `injuzgable`, `inconcluso` y «promover» existían en el
 * documento de arquitectura y en **un comentario** de `explorar.ts`. Cero líneas
 * de código. Así que acá no hay deuda previa que respetar, y conviene decir por
 * qué cada palabra es una palabra distinta.
 *
 * ─── Por qué NO se llama `Verdict` ──────────────────────────────────────────
 *
 * Porque el nombre está tomado **tres veces**, y por tres cosas distintas:
 *
 *   physics/src/admit.ts:280    ¿esta física es legal? (ok + razones)
 *   skills/src/tipos.ts:367     ¿esta intención salió? (ok | por + why)
 *   skills/src/skill-api.d.ts   la copia de la anterior que ve la habilidad
 *
 * Un cuarto `Verdict` que quiere decir «¿esta habilidad es estable?» sería la
 * clase de nombre que hace que alguien importe el equivocado y el tipo cierre
 * igual. Va en castellano, como todo `@anima/lang`.
 *
 * ─── LOS CUATRO CARGOS, y por qué se juzgan por separado ────────────────────
 *
 * Es exigencia del caso de aceptación, y la frase que la justifica es ésta:
 *
 *   > **Construir algo no demuestra que funcione**, y un `BuildSkill` verde con
 *   > `UseSkill` rojo es un resultado legítimo, no un error del arnés.
 *
 * | cargo | la pregunta |
 * |---|---|
 * | `plano` | ¿lo que describe es armable con la materia que existe? |
 * | `construccion` | ¿la habilidad que lo arma llega hasta el final? |
 * | `uso` | ¿la habilidad que lo usa hace lo que promete? |
 * | `utilidad` | ¿sirve de algo? Un aparejo que atrapa cero no falló: no sirve |
 *
 * Un solo número los promedia y **pierde exactamente lo que hay que ver**. Con
 * cuatro, «construye bien y no sirve» y «no lo puede armar» dejan de parecer el
 * mismo 50%.
 *
 * ─── LOS CUATRO GRADOS, y los dos que se confunden ──────────────────────────
 *
 * `promueve` y `no-promueve` no necesitan defensa. Los otros dos sí, porque a
 * primera vista son el mismo «no sé» y **son responsabilidades distintas**:
 *
 * | grado | qué pasó | de quién es la culpa |
 * |---|---|---|
 * | `injuzgable` | no se pudo ARMAR un mundo donde probarla | del **contrato** |
 * | `inconcluso` | se armaron y se corrieron, y el resultado no decide | del **banco** |
 *
 * La diferencia manda sobre qué hacer después, que es para lo único que sirve un
 * veredicto: un `injuzgable` se contesta arreglando el contrato, y un
 * `inconcluso` se contesta corriendo más mundos. Tratarlos igual manda a la
 * fragua a re-forjar algo que estaba bien.
 *
 * Y hay una consecuencia dura, que es el punto 3 del criterio: **un `injuzgable`
 * no siembra regresiones**. Nunca corrió nada, así que no hay conducta que
 * proteger. Sembrar una sería guardar el resultado de un experimento que no se
 * hizo.
 */

// De `@anima/skills/innatas` y NO de `@anima/skills`: el índice del paquete no
// re-exporta las innatas a propósito —«la frontera entre la caja y lo que corre
// adentro de la caja» tiene que verse en los imports— y deja esta puerta lateral
// abierta para el día que alguien las necesite. Ese día es éste.
import type { Contrato } from '@anima/skills/innatas'

/** Las cuatro cosas que se juzgan por separado. */
export type Cargo = 'plano' | 'construccion' | 'uso' | 'utilidad'

export const CARGOS: readonly Cargo[] = ['plano', 'construccion', 'uso', 'utilidad']

export type Grado = 'promueve' | 'no-promueve' | 'inconcluso' | 'injuzgable'

/**
 * EL ORDEN DE GRAVEDAD, y no es el orden en que están escritos.
 *
 * El dictamen entero toma **el peor** de sus cargos, no el promedio. Y «peor»
 * necesita un orden explícito porque `injuzgable` no es «más grave» que
 * `no-promueve` en el sentido moral: es que **frena antes**. Si el plano no se
 * puede ni armar, que el uso haya salido verde no significa nada — se probó
 * contra otra cosa.
 */
const GRAVEDAD: Readonly<Record<Grado, number>> = {
  promueve: 0,
  inconcluso: 1,
  'no-promueve': 2,
  injuzgable: 3,
}

export function elPeor(gs: readonly Grado[]): Grado {
  let peor: Grado = 'promueve'
  for (const g of gs) if (GRAVEDAD[g] > GRAVEDAD[peor]) peor = g
  return peor
}

/**
 * Lo que se corrió, para que el número no sea una opinión.
 *
 * `adversos` va aparte de `mundos` porque el banco tiene que ser **1/3
 * adverso** y sin contarlos esa exigencia no se puede afirmar. Una habilidad que
 * aprueba 20 de 20 mundos amables y ninguno adverso no aprobó nada.
 */
export interface Corrida {
  readonly mundos: number
  readonly aprobados: number
  readonly adversos: number
  readonly adversosAprobados: number
}

export const SIN_CORRER: Corrida = { mundos: 0, aprobados: 0, adversos: 0, adversosAprobados: 0 }

export interface Veredicto {
  readonly cargo: Cargo
  readonly grado: Grado
  /** En castellano llano, para que un panel lo pueda mostrar sin traducir. */
  readonly porque: string
  readonly corrida: Corrida
}

/**
 * UNA REGRESIÓN es una conducta que ya se vio y que no se puede perder.
 *
 * Guarda el mundo con el que se produjo —no un resumen— porque el criterio pide
 * «regresiones con snapshot real»: un resumen deja de reproducir el fallo en
 * cuanto cambia lo que el resumen no guardaba.
 */
export interface Regresion {
  readonly habilidad: string
  readonly cargo: Cargo
  /** La semilla del mundo, que es lo único que hace falta para rearmarlo. */
  readonly semilla: string
  readonly queSeEspera: string
}

export interface Dictamen {
  readonly habilidad: string
  readonly cargos: readonly Veredicto[]
  /** El PEOR de los cargos. Ver `elPeor`. */
  readonly grado: Grado
  /**
   * Vacío cuando el grado es `injuzgable`, y eso es el punto 3 del criterio, no
   * una comodidad: nunca corrió nada, así que no hay conducta que proteger.
   */
  readonly regresiones: readonly Regresion[]
}

/** Lo que se juzga. Hasta el Hito 8 son las innatas; después, lo que forje. */
export interface Acusada {
  readonly nombre: string
  readonly contrato: Contrato
}
