/**
 * EL CARRIL DE MEJORA — Hito 8, punto 6.
 *
 *   > una habilidad **degradada a propósito** entra en la cola, se re-forja en el
 *   > fondo y la ganadora **reemplaza sin perder un tick**
 *
 * ─── Qué había acá antes: cero líneas ───────────────────────────────────────
 *
 * `grep -rn cola ii/packages/*​/src` no daba una sola definición. El punto 6 y el
 * 8 hablan los dos de «la cola» y era el sujeto de una oración que no existía.
 *
 * ─── EL DISPARADOR, y hoy es UNO SOLO ───────────────────────────────────────
 *
 * El criterio nombra `degradada` con su definición adentro: *«la tasa real cayó
 * por debajo de la que midió el juez al promoverla»*. Ése es el que está.
 *
 * Los otros que el plan nombra —`gap nuevo`, `costo alto`, `capacidad
 * prometida y no usada`— necesitan telemetría de partida que todavía no existe, y
 * escribirlos hoy sería escribir tres ramas que nada ejercita. Queda dicho, con
 * el número al lado: **1 de 4**.
 *
 * ─── POR QUÉ EL ORDEN DE LOS GRADOS ENTRA POR PARÁMETRO ─────────────────────
 *
 * Porque es del juez, no de la fragua. `GRAVEDAD_DE` vive en `@anima/judge` junto
 * con `elPeor`, y `@anima/judge` depende de `@anima/world` y `@anima/perceive` —
 * importarlo acá haría que **la fragua necesite el mundo para escribir código**.
 *
 * Es el mismo patrón que `ApiTS` en la puerta y que el modelo en el Hito 6: **el
 * paquete describe, el llamador provee**. La alternativa —copiar la tabla de
 * gravedad acá— es exactamente la duplicación que queda vieja en silencio, y el
 * día que se separen un duelo elegiría mal sin que nada se ponga rojo.
 */

import type { CargoDelJuez } from './registro.js'

/**
 * CUÁNTAS CANDIDATAS PIDE EL CARRIL DE MEJORA, y no son las dos del carril normal.
 *
 * `K = 6` sale de la descripción del hito. El motivo es que acá **ya hay una
 * titular que funciona**: el viaje sólo vale la pena si alguna de las candidatas
 * la supera, y con dos la probabilidad de superar a algo que ya pasó el juez es
 * baja. Lo caro sigue siendo el viaje, así que se piden más por el mismo precio.
 *
 * `forjarTanda` ya lo tenía previsto —«el carril de mejora usa K=6 y sería el
 * mismo código con otro número»— y por eso K entra por parámetro y no por
 * constante.
 */
export const K_DE_MEJORA = 6

/**
 * CUÁNTAS VUELTAS SE LE DAN A UNA HABILIDAD, y por qué hay un tope.
 *
 * Porque sin tope una habilidad que no se puede mejorar vuelve a la cola para
 * siempre y se come el presupuesto de todas las demás. Dos: la primera con lo que
 * el juez dijo, la segunda con eso más lo que falló en la primera. Una tercera
 * repetiría el mismo encargo — el punto 9 aporta información en el primer rebote
 * y ya no en el segundo.
 */
export const VUELTAS_POR_HABILIDAD = 2

export type MotivoDeCola = 'degradada'

export interface Pendiente {
  readonly nombre: string
  readonly motivo: MotivoDeCola
  /** En castellano llano, para el informe y para el encargo. */
  readonly porque: string
  /** Qué cargos cayeron, que es lo que el encargo de la re-forja le cuenta al modelo. */
  readonly cargosQueCayeron: readonly string[]
}

/** ¿El grado de ahora es peor que el de antes? Lo contesta el juez (`GRAVEDAD_DE`). */
export type Empeoro = (antes: string, ahora: string) => boolean

/** Lo que se sabe de una titular para decidir si hay que re-forjarla. */
export interface Titular {
  readonly nombre: string
  /** Los cargos con los que se la promovió. Es la vara. */
  readonly porQue: readonly CargoDelJuez[]
  /** Cuántas veces ya pasó por el carril. Ver `VUELTAS_POR_HABILIDAD`. */
  readonly vueltas?: number
}

/**
 * LA COLA: quién hay que re-forjar, y por qué.
 *
 * Compara **cargo por cargo** y no el grado global, por el mismo hallazgo que
 * mandó sobre el duelo: ningún dictamen de habilidad puede salir `promueve`, así
 * que el grado global de dos juzgamientos de la misma habilidad empata siempre y
 * ninguna degradación se vería nunca.
 *
 * Una titular que **no está degradada no entra**, y ése es el control que impide
 * el verde por omisión más obvio de este archivo: «la degradada entra en la cola»
 * lo cumple una cola que mete todo.
 */
export function colaDeMejora(
  titulares: readonly Titular[],
  ahora: ReadonlyMap<string, readonly CargoDelJuez[]>,
  empeoro: Empeoro,
): readonly Pendiente[] {
  const out: Pendiente[] = []
  for (const t of titulares) {
    if ((t.vueltas ?? 0) >= VUELTAS_POR_HABILIDAD) continue
    const hoy = ahora.get(t.nombre)
    if (hoy === undefined) continue

    const cayeron: string[] = []
    for (const antes of t.porQue) {
      const ahoraCargo = hoy.find((c) => c.cargo === antes.cargo)
      if (ahoraCargo === undefined) continue
      if (empeoro(antes.grado, ahoraCargo.grado)) cayeron.push(antes.cargo)
    }
    if (cayeron.length === 0) continue

    out.push({
      nombre: t.nombre,
      motivo: 'degradada',
      porque: `cayó en ${cayeron.join(', ')} contra lo que el juez midió al promoverla`,
      cargosQueCayeron: cayeron,
    })
  }
  return out
}

/**
 * EL ENCARGO DE UNA RE-FORJA, y **no arranca de cero**.
 *
 * Es el punto 9 aplicado al carril de mejora: lo que el juez dijo de la titular
 * entra como contexto, así que el modelo tiene de dónde agarrarse en vez de una
 * hoja en blanco. La pregunta del usuario era exactamente ésta —*«en vez de crear
 * una habilidad nueva desde cero, se lo haría con la experiencia»*—.
 *
 * Y lo que NO entra es el código de la titular. No por disciplina: la fragua no
 * lo tiene acá. `Pendiente` guarda el nombre y los cargos, y nada más.
 */
export function gapDeLaReforja(p: Pendiente): string {
  return `mejorar «${p.nombre}»: ${p.porque}`
}
