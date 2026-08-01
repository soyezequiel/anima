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

import type { Contrato } from '@anima/skills/innatas'
import type { Candidata, HabilidadCandidata } from '../src/candidata.js'

/**
 * LO QUE `esperarQuieta` DICE QUE HACE, y no hace.
 *
 * ─── Por qué el muñeco publica una promesa que no cumple ────────────────────
 *
 * Porque es el único caso que el tramo G no podía armar: **compila y no sirve**.
 * Los tres desenlaces de la puerta —limpia, reparada, rota— hablan del
 * compilador, y ninguno distingue una habilidad que anda de una que no. Eso lo
 * dice el juez, y el juez necesita una promesa contra la cual medir.
 *
 * La promesa es la de `sostener` —*te deja algo en la mano*— y el cuerpo de
 * `esperarQuieta` no toca nada. Es exactamente la mitad cara del punto 9: sin
 * contrato publicado, «compiló» pasaría por «anda».
 *
 * Los predicados son los de `CONTRATO_SOSTENER`, copiados con intención: es una
 * promesa que el mundo **sabe** armar —hay materia portátil— así que el banco se
 * construye y la habilidad corre de verdad. Una promesa imposible daría
 * `injuzgable` y mediría al sintetizador, no a la candidata.
 */
const PROMETE_Y_NO_CUMPLE: Contrato = {
  nombre: 'esperarQuieta',
  establece: [{ sujeto: 'yo', q: 'holding', op: '>=', v: 1 }],
  precondiciones: [{ sujeto: 'el-objetivo', q: 'portable', op: '>=', v: 1 }],
  cuesta: { segundos: 0, commitment: 'reversible' },
  huecos: [],
}

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
 * LA QUE TOCA EL MUNDO — y es la que hace instalable a todo lo demás.
 *
 * ─── Por qué hizo falta una cuarta ──────────────────────────────────────────
 *
 * Las tres de arriba cubren los tres desenlaces de la PUERTA —compila, compila
 * reparada, no compila— y ninguna hace nada: las tres devuelven `done()` en la
 * primera línea. Alcanzaba mientras lo único que se medía era el compilador.
 *
 * Deja de alcanzar en el momento en que hay que probar que instalar sirve de
 * algo. Medido con las tres viejas: la partida corre, la habilidad vuela, y el
 * mundo queda idéntico. Un test de instalación con esas candidatas es un test que
 * no puede ponerse rojo.
 *
 * Ésta agarra lo primero portátil que ve. Medido, montada y volada en una
 * `Partida` de verdad: `holding 0 → 1`, hash `901678e3300afcd4 → 17312250b1d751bd`,
 * y `outcome { ok: true, got: { id: 'palito' } }` en 3 ticks.
 *
 * ─── Y encontró el enganche que faltaba ─────────────────────────────────────
 *
 * La primera corrida murió con `OutOfFuel` y `budget: 0` en el primer paso: una
 * habilidad instrumentada **nace con el tanque vacío** y `Partida.volar` sólo lo
 * recarga si le pasan la celda por `VueloOptions.cell`. Las quince innatas son
 * funciones planas y no tienen celda, así que nadie había cruzado esa ranura
 * desde este lado. Ver el encabezado de `registro.ts`.
 */
const CABECERA_LARGA = [
  "import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'",
  "import { done, fail } from '../../src/skill-api.js'",
  '',
].join('\n')

const AGARRAR_LO_QUE_VEO = `${CABECERA_LARGA}export function* agarrarLoQueVeo(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('agarrar-lo-que-veo')
  const cerca: BodyView[] = []
  for (const b of ctx.see([])) {
    if (b.id === ctx.self.id) continue
    if (b.heldBy !== undefined) continue
    if (ctx.q(b, 'portable') < 1) continue
    cerca.push(b)
  }
  const que = cerca[0]
  if (que === undefined) return fail('no veo nada que se pueda agarrar')
  const irA = yield ctx.goTo(que, { within: 1 })
  if (irA.status !== 'arrived') return fail('no llegue')
  const t = yield ctx.take(que)
  if (t.status === 'done') return done(que)
  return fail('no lo pude tomar')
}
`

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
    { gap, vuelta, usar: LIMPIA, contrato: PROMETE_Y_NO_CUMPLE },
    { gap, vuelta, usar: CON_TYPO },
  ]
}

/** La que no se puede reparar. Para el camino del punto 9. */
export function laQueInventa(gap: string, vuelta = 1): Candidata {
  return { gap, vuelta, usar: CON_CONCEPTO_INVENTADO }
}

export { AGARRAR_LO_QUE_VEO, CON_CONCEPTO_INVENTADO, CON_TYPO, LIMPIA, PROMETE_Y_NO_CUMPLE }
