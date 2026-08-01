/**
 * EL MODELO DE MENTIRA DE LA FRAGUA — Hito 8, tramo G.
 *
 * ─── Para qué existe, y son dos razones medidas ─────────────────────────────
 *
 * **1. Probar la línea cuesta plata.** Cada candidata del modelo de verdad son
 * ~14 s y **US$ 0,0158**, medidos en el Hito 6. La línea hay que probarla en
 * cada cambio, para siempre.
 *
 * **2. Y el de verdad contesta distinto cada vez.** Es la razón que importa: un
 * test que dice «funciona» un día y «falla» al otro **sin que nadie tocara
 * nada** dejó de ser un test. El Hito 6 lo midió en vivo — la misma frase le dio
 * a Claude dos metas distintas.
 *
 * ─── Por qué NO se puede compartir con el falso del chat ────────────────────
 *
 * Es el hallazgo del tramo F, y vale la pena tenerlo escrito: de los cuatro
 * transportes, **el falso es el único que no se pudo hacer genérico**. Los tres
 * de verdad sólo mueven texto y no les importa quién pregunta; uno de mentira
 * **tiene que conocer la forma del que pregunta para poder fingir que
 * entiende**.
 *
 * El del chat mapea palabras a firmas. Éste tiene que producir CÓDIGO.
 *
 * ─── Vive en `demo/` y no en `src/` ─────────────────────────────────────────
 *
 * No por la regla 2 —esto es sincrónico, no espera a nadie— sino porque **un
 * simulador en `src/` es algo que se puede embarcar sin querer**. Acá adentro no
 * llega a ninguna criatura.
 *
 * ─── Las tres candidatas, y por qué son ESAS ────────────────────────────────
 *
 * Cubren los tres desenlaces que la línea sabe distinguir, que es lo único que
 * un muñeco tiene que hacer:
 *
 * | candidata | qué le pasa | qué punto del criterio prueba |
 * |---|---|---|
 * | `limpia` | compila sola | **1** — «al menos una compila sin reparación» |
 * | `conTypo` | compila **después** de reparar | **2** — «al menos una compila con reparación» |
 * | `conConceptoInventado` | no se puede reparar | **9** — alimenta al segundo intento |
 *
 * **No están para ser buenas.** Están para que los tres caminos existan y se
 * puedan medir. Una que acertara todo mediría al simulador y no al enganche.
 */

import type { Candidata, HabilidadCandidata } from '../src/candidata.js'

const CABECERA = [
  "import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'",
  "import { done } from '../../src/skill-api.js'",
  '',
].join('\n')

/** Compila tal cual. Es el control de que la puerta deja pasar lo bueno. */
const LIMPIA: HabilidadCandidata = {
  nombre: 'esperarQuieta',
  fuente: `${CABECERA}export function* esperarQuieta(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('esperar-quieta')
  return done()
}
`,
}

/**
 * Un typo y nada más: `ticksToNightfall` por `secondsToNightfall`.
 *
 * El nombre no se eligió al azar — es el error más frecuente del corpus de 28
 * borradores, con **29 apariciones**, y es el que la reparación arregla porque
 * el nombre correcto está a siete letras.
 */
const CON_TYPO: HabilidadCandidata = {
  nombre: 'esperarLaNoche',
  fuente: `${CABECERA}export function* esperarLaNoche(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('esperar-la-noche')
  const falta = ctx.clock.ticksToNightfall
  if (falta > 0) return done()
  return done()
}
`,
}

/**
 * Pide algo que el mundo no tiene, y **no hay nada parecido**.
 *
 * `hunger` está en la lista de 34 conceptos que el corpus midió: el mundo no
 * modela el hambre como una lectura de `ctx`. La reparación no puede hacer nada
 * —no hay un nombre cerca— y por eso este caso es el que va al punto 9.
 */
const CON_CONCEPTO_INVENTADO: HabilidadCandidata = {
  nombre: 'comerSiHayHambre',
  fuente: `${CABECERA}export function* comerSiHayHambre(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('comer-si-hay-hambre')
  const h = ctx.self.hunger
  if (h > 0.5) return done()
  return done()
}
`,
}

/**
 * LAS DOS QUE EL CRITERIO PIDE POR VIAJE.
 *
 * > «al menos una de dos candidatas compila sin reparación y al menos una
 * > compila con reparación»
 *
 * `K = 2` no es un número de acá: está en la descripción del hito («K=2
 * candidatas por viaje»), y el motivo es económico — dos por el precio de un
 * viaje, porque lo caro es el viaje y no la candidata.
 */
export function dosCandidatas(gap: string, vuelta = 1): readonly Candidata[] {
  return [
    { gap, vuelta, usar: LIMPIA },
    { gap, vuelta, usar: CON_TYPO },
  ]
}

/** La que no se puede reparar. Para el camino del punto 9. */
export function laQueInventa(gap: string, vuelta = 1): Candidata {
  return { gap, vuelta, usar: CON_CONCEPTO_INVENTADO }
}

export { CON_CONCEPTO_INVENTADO, CON_TYPO, LIMPIA }
