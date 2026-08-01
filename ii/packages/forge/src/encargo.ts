/**
 * QUÉ SE LE PIDE AL MODELO — Hito 8, tramo D. El punto 9.
 *
 * ─── La frontera es la del Hito 6, y no se rehace ───────────────────────────
 *
 * `@anima/lang` ya resolvió esto: el paquete **describe** la consulta como DATO
 * y el llamador —que sí puede esperar— la manda. Su `Consulta` lleva adentro
 * hasta el vocabulario del que el modelo puede elegir, y el porqué está escrito
 * allá: *«el catálogo es core más overlay por sesión; un prompt con una lista
 * fija le ofrecería al modelo metas que esta partida no puede alcanzar»*.
 *
 * Lo mismo vale acá y por lo mismo. `Encargo` es dato.
 *
 * ─── EL PUNTO 9: la candidata que falla alimenta a la siguiente ─────────────
 *
 * > *«en caso de que el código sea malo, ¿eso entra como contexto para el
 * > siguiente? Capaz que con un pequeño cambio se lo arregla, en vez de crear
 * > una habilidad nueva desde cero»* — el usuario.
 *
 * Y el tramo C midió que **hay dos clases de fallo y sólo una llega hasta acá**:
 *
 * | clase | cuántas | quién la resuelve |
 * |---|---|---|
 * | un **typo** (`ticksToNightfall`) | 7 | la reparación, gratis. **No llega al modelo** |
 * | un **concepto que el mundo no tiene** (`hunger`, `smoke`) | 34 | **esto** |
 *
 * Así que el segundo intento no dice «falló, probá de nuevo». Dice **qué pidió
 * que no existe**, que es lo único que la primera vuelta no podía saber.
 *
 * ─── LA TRAMPA, Y CÓMO SE ATAJA POR CONSTRUCCIÓN ────────────────────────────
 *
 * Si se le cuentan los mundos donde falló, **aprende los mundos y no la
 * habilidad** — es decirle a alguien las preguntas del recuperatorio.
 *
 * La decisión ya estaba tomada: se le cuenta **el QUÉ y el PORQUÉ, no el DÓNDE**.
 * Y al escribirlo apareció que eso se puede garantizar **estructuralmente** en
 * vez de filtrando: **este archivo no tiene ninguna forma de nombrar un mundo**.
 * No recibe ids, no los lee del dictamen, no los imprime.
 *
 * Un filtro se puede olvidar de una lista; no tener el dato no se olvida. Hay un
 * test que lo afirma sobre un dictamen lleno de ids: **ninguno aparece en el
 * texto**.
 */

import type { Cambio } from './reparar.js'
import type { Error } from './puerta.js'
import { nombreInventado } from './reparar.js'

/**
 * LO QUE LA CANDIDATA ANTERIOR HIZO MAL, sin decir dónde.
 *
 * Las tres formas están separadas porque **se arreglan distinto**, y un mensaje
 * que las mezcla le pide al modelo que adivine cuál es cuál.
 */
export interface LoQueFallo {
  /** Nombres que pidió y el mundo no tiene. Es la clase grande (34 de 41). */
  readonly conceptosQueNoExisten: readonly string[]
  /** Lo que la puerta arregló sola. Va para que no lo vuelva a escribir igual. */
  readonly typosCorregidos: readonly Cambio[]
  /**
   * Qué cargo del juez salió mal y por qué, **en castellano llano**.
   *
   * Sale del `porque` del `Veredicto`, que se escribió así para que un panel lo
   * mostrara sin traducir (Hito 7). Resulta que también sirve para esto.
   */
  readonly cargosQueFallaron: readonly { readonly cargo: string; readonly porque: string }[]
}

export const NADA_FALLO: LoQueFallo = {
  conceptosQueNoExisten: [],
  typosCorregidos: [],
  cargosQueFallaron: [],
}

/**
 * Los conceptos inventados, sacados de los errores que la reparación NO pudo
 * arreglar.
 *
 * Se lee de los errores que quedaron **después** de reparar, y no de los de
 * antes: un typo que la puerta ya corrigió no es un concepto que falte, y
 * mandarlo confundiría al modelo con un problema que ya no existe.
 */
export function conceptosDe(erroresQueQuedaron: readonly Error[]): readonly string[] {
  const out = new Set<string>()
  for (const e of erroresQueQuedaron) {
    const n = nombreInventado(e)
    if (n !== undefined) out.add(n)
  }
  return [...out].sort()
}

/**
 * LO QUE FALLÓ, ARMADO DESDE UN DICTAMEN — y la firma es el guardián.
 *
 * Recibe **sólo los cargos**, no el dictamen entero. No es una comodidad: un
 * `Dictamen` trae `regresiones`, y ahí adentro está `semilla`, que **es el id
 * del mundo**. Si esta función recibiera el dictamen, filtrar sería una
 * disciplina que alguien puede olvidar en el próximo cambio.
 *
 * Pidiendo sólo los cargos, **el dato del mundo no entra al paquete**. Es la
 * misma forma que el `CanalDeHabla` del Hito 6 —que no tiene un solo import para
 * que no pueda tocar el tick— llevada a un tipo de argumento.
 *
 * El tipo se escribe estructural y no se importa de `@anima/judge`: la fragua no
 * necesita al juez para armar un encargo, y una dependencia de más es una razón
 * de más para que alguien pase el objeto entero.
 */
export function loQueFalloDe(
  cargos: readonly { readonly cargo: string; readonly grado: string; readonly porque: string }[],
  conceptosQueNoExisten: readonly string[] = [],
  typosCorregidos: readonly Cambio[] = [],
): LoQueFallo {
  return {
    conceptosQueNoExisten,
    typosCorregidos,
    // Sólo los que fallaron: contarle los verdes le pide al modelo que adivine
    // cuál arreglar, y alarga el mensaje con lo que ya está bien.
    cargosQueFallaron: cargos
      .filter((c) => c.grado === 'no-promueve')
      .map((c) => ({ cargo: c.cargo, porque: c.porque })),
  }
}

export interface Encargo {
  /** Qué capacidad hace falta, en los términos del mundo. */
  readonly gap: string
  /**
   * EL VOCABULARIO DEL QUE PUEDE ELEGIR.
   *
   * Va en el encargo y no en el prompt del llamador, por la misma razón que las
   * `firmas` de la `Consulta` del Hito 6: cambia entre partidas, y una lista fija
   * le ofrecería al modelo cosas que esta partida no tiene.
   */
  readonly seSabeNombrar: readonly string[]
  /** Qué vuelta es. La primera no lleva `loQueFallo`. */
  readonly vuelta: number
  readonly loQueFallo: LoQueFallo
}

export function primerEncargo(gap: string, seSabeNombrar: readonly string[]): Encargo {
  return { gap, seSabeNombrar, vuelta: 1, loQueFallo: NADA_FALLO }
}

export function otraVuelta(anterior: Encargo, loQueFallo: LoQueFallo): Encargo {
  return { ...anterior, vuelta: anterior.vuelta + 1, loQueFallo }
}

/**
 * EL TEXTO DEL ENCARGO.
 *
 * En castellano y no en inglés porque todo el repo lo está, y porque el modelo
 * que se probó en el Hito 6 contesta igual de bien — se midió con Claude.
 *
 * **Lo que este texto NO puede contener, y no por disciplina sino porque el dato
 * no está acá: el nombre de un mundo.** Ver el encabezado.
 */
export function textoDe(e: Encargo): string {
  const cabeza = [
    `Escribí una habilidad para: ${e.gap}`,
    '',
    `El mundo sabe nombrar estas cosas y ninguna otra:`,
    `  ${e.seSabeNombrar.join(' · ')}`,
  ]

  if (e.vuelta === 1) return cabeza.join('\n')

  const f = e.loQueFallo
  const cuerpo: string[] = ['', `— Intento ${String(e.vuelta)}. Lo que pasó con el anterior —`]

  if (f.conceptosQueNoExisten.length > 0) {
    cuerpo.push(
      '',
      'Pediste cosas que este mundo NO TIENE. No son errores de tipeo: no existe',
      'nada parecido, así que hay que resolverlo con lo que sí hay.',
      `  ${f.conceptosQueNoExisten.join(' · ')}`,
    )
  }

  if (f.typosCorregidos.length > 0) {
    cuerpo.push(
      '',
      'Y esto lo corregí solo, para que no lo vuelvas a escribir igual:',
      ...f.typosCorregidos.map((c) => `  ${c.de} → ${c.a}`),
    )
  }

  if (f.cargosQueFallaron.length > 0) {
    cuerpo.push('', 'Compiló, pero al probarla:', ...f.cargosQueFallaron.map((c) => `  ${c.cargo}: ${c.porque}`))
  }

  return [...cabeza, ...cuerpo].join('\n')
}
