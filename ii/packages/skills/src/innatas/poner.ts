// INNATA 8/15 · «poner» — dejar algo en un lugar, apoyado o tapando.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { distancia, enLaMano } from './comun.js'

export const CONTRATO_PONER: Contrato = {
  nombre: 'poner',
  establece: [{ sujeto: 'el-objetivo', q: 'at', op: '==', v: 0 }],
  precondiciones: [{ sujeto: 'yo', q: 'holding', op: '>=', v: 1 }],
  cuesta: { segundos: 0, commitment: 'reversible' },
  huecos: [
    'NO SE PUEDE SABER SI UNA CELDA ESTÁ LIBRE. El mundo rechaza con `celda-ocupada` —dos sólidos no comparten celda salvo apoyo u oclusión— y la superficie no tiene ninguna lectura de ocupación: `see()` devuelve cuerpos con su `at`, así que se puede inferir de lo que se VE, y nada dice si eso es todo lo que hay. Apilar la parrilla sobre el fuego es la técnica emblema del proyecto y depende de una lectura que no existe',
    '`covering` toma un `BodyView`, así que `put(techo, at, { covering: ctx.self })` TYPECHEQUEA. La criatura ES un cuerpo desde el pase 2, y si la ley 12 ocluye sobre ella o no, no está dicho en ninguna parte. Es el modo de fallo caro: pasa tipos, pasa smoke, produce un número que vale 0 para siempre',
    'no hay `footing` de celda: `footing` es cualidad de CUERPO y las de celda son cuatro (`wet`, `oxygen`, `temperature`, `sheltered`). Elegir dónde dejar algo para que no se hunda no se puede escribir',
  ],
}

/**
 * CONTRATO
 *   establece   `qué.at == en`, y —si vino— apoyado sobre `sobre` o tapando a
 *               `tapando`
 *   precondiciones  tenerlo en la mano y estar a Chebyshev ≤ 1 de la celda
 *   cuesta      un tick; `reversible`, siempre se puede volver a levantar
 *
 * APOYAR NO ES TAPAR, Y ES LA DISTINCIÓN MÁS CARA DE LA API (ADR II-0002).
 * `onTopOf` es la ley 8: sostiene peso. `covering` es la ley 12: ocluye el
 * intercambio con el ambiente. La parrilla APOYA sin tapar; la losa TAPA sin
 * sostener. Si se confunden, poner el pescado sobre la parrilla ahoga el fuego
 * y cocinar deja de existir. Por eso son dos campos y no un booleano, y por eso
 * esta habilidad los pasa separados y nunca deduce uno del otro.
 *
 * POR QUÉ LEVANTA PRIMERO: el borrador `43-mover-lo-que-no-entra-en-las-manos`
 * dejó escrito el peor de los casos — `put(b, celdaVecina)` en bucle compila,
 * parece arrastrar, y el mundo rechaza cada intención con `no-lo-tiene`. Falla
 * en el juez y no en el compilador, que es donde falla caro. Acá se levanta
 * primero y si no se puede levantar se falla temprano y barato.
 */
export function* poner(
  ctx: Ctx,
  args: { que: BodyView; en: Cell; sobre?: BodyView; tapando?: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('poner')

  if (!enLaMano(ctx.self, args.que)) {
    if (ctx.q(args.que, 'portable') < 1) return fail(`${args.que.name} no se puede levantar`)
    const irA = yield ctx.goTo(args.que, { within: 1 })
    if (irA.status !== 'arrived') return fail('no llegué a lo que quiero poner')
    const t = yield ctx.take(args.que)
    if (t.status !== 'done') return fail(`no lo pude levantar: ${t.por ?? t.status}`)
  }

  if (distancia(ctx.self.at, args.en) > 1) {
    const irB = yield ctx.goTo(args.en, { within: 1 })
    if (irB.status !== 'arrived') return fail('no llegué a la celda destino')
  }

  // Se arma el objeto por asignación y no por literal: con
  // `exactOptionalPropertyTypes`, `{ onTopOf: args.sobre }` con `sobre?:
  // BodyView` no compila. Asignar un valor ya estrechado sí. Es el mismo peaje
  // que en `unir`, y aparece cada vez que un opcional de la API se alimenta de
  // un opcional del llamador — o sea, siempre.
  const o: { onTopOf?: BodyView; covering?: BodyView } = {}
  if (args.sobre !== undefined) o.onTopOf = args.sobre
  if (args.tapando !== undefined) o.covering = args.tapando

  const r = yield ctx.put(args.que, args.en, o)
  if (r.status === 'done') return done(args.que)
  if (r.por === 'celda-ocupada') return fail('ahí no entra: hay algo sólido')
  if (r.por === 'no-lo-tiene') return fail('no lo tengo en la mano')
  return fail(`el mundo no me dejó poner: ${r.por ?? r.status}`)
}

/**
 * Poner algo TAPANDO otra cosa, en la celda de esa cosa. Es la forma que hace
 * carbón en vez de ceniza (ley 4, ADR II-0002), y existe aparte porque la celda
 * correcta es la del cuerpo tapado y no una que elija quien llama: taparlo
 * desde otra celda no ocluye nada, compila igual, y no se nota.
 */
export function* tapar(ctx: Ctx, args: { con: BodyView; que: BodyView }): Generator<Intent, Outcome, StepResult> {
  return yield* poner(ctx, { que: args.con, en: args.que.at, tapando: args.que })
}
