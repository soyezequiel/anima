// INNATA 6/15 · «deshilachar» — sacarle hebras a algo que aguanta el tirón.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { enLaMano } from './comun.js'

export const CONTRATO_DESHILACHAR: Contrato = {
  nombre: 'deshilachar',
  establece: [
    { sujeto: 'lo-que-devuelve', q: 'flexibility', op: '>=', v: 0.8 },
    { sujeto: 'lo-que-devuelve', q: 'tensile', op: '>=', v: 0.3 },
  ],
  precondiciones: [
    { sujeto: 'el-objetivo', q: 'tensile', op: '>=', v: 0.3 },
    { sujeto: 'yo', q: 'stamina', op: '>=', v: 3 },
  ],
  cuesta: { segundos: 2, commitment: 'costly' },
  huecos: [
    'NO ES `fibrous`, ES `tensile`, y la superficie no tiene forma de decirlo. El `.d.ts` a mano tenía `fibrous` en `UndeclaredQuality` y el catálogo real no la tiene: el rol `source` pide `tensile >= 0.3` porque `Role.where` sólo sabe de cualidades. Una habilidad que busque «lo fibroso» hoy no compila; la que busque `tensile` compila y acierta, y no hay nada en la superficie que la lleve de una a la otra',
    'no se sabe CUÁNTAS hebras quedan: la fuente no publica cuánto le queda por dar, así que el bucle corta por fracaso y no por cuenta',
    'no hay costo declarado por aplicación. El proceso drena 2 de stamina por segundo durante 2 s —4 en total—, y eso vive en el catálogo de la física. La habilidad sólo puede medirlo pagándolo una vez',
  ],
}

/**
 * CONTRATO
 *   establece   hasta `cuantas` hebras nuevas, con `flexibility ≥ 0.8` y
 *               `tensile ≥ 0.3` — o sea, exactamente lo que `union` pide de
 *               ligador. Ése es el circuito cerrado del que habla el Hito 7:
 *               lo que una establece es lo que la otra busca
 *   precondiciones  fuente con `tensile ≥ 0.3` y EN LA MANO; `stamina ≥ 3`
 *   cuesta      2 s y ~4 de aliento por hebra; `costly`
 *
 * POR QUÉ CORTA POR ALIENTO Y NO POR CANTIDAD: pedir cinco hebras y quedarse
 * sin aliento en la tercera es peor que tener tres, porque sin aliento tampoco
 * se puede ir a comer. El piso es un ARGUMENTO y no una constante: cuánto
 * guardarse es una decisión del plan, no de la habilidad.
 *
 * POR QUÉ MIDE EL ALIENTO ANTES Y DESPUÉS: es la única forma que la superficie
 * deja de saber cuánto cuesta un `apply`. No hay `costOf(p, roles)`. La
 * habilidad aprende el precio pagándolo una vez, y con eso decide si le alcanza
 * para la siguiente. Es honesto y es caro, y es una vuelta de aprendizaje que
 * el catálogo podría regalar.
 */
export function* deshilachar(
  ctx: Ctx,
  args: { fuente: BodyView; cuantas: number; staminaMinima?: number },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('deshilachar')
  const piso = args.staminaMinima ?? 3

  if (!enLaMano(ctx.self, args.fuente)) {
    const irA = yield ctx.goTo(args.fuente, { within: 1 })
    if (irA.status !== 'arrived') return fail('no llegué a la fuente')
    const t = yield ctx.take(args.fuente)
    if (t.status !== 'done') return fail(`no la pude agarrar: ${t.por ?? t.status}`)
  }

  // `can()` en vez de `ctx.q(fuente, 'tensile') >= 0.3`: el 0.3 es del catálogo
  // y no de la habilidad. Preguntar no cuesta nada y no envejece.
  const v = ctx.can('deshilachar', { source: args.fuente, actor: ctx.self })
  if (!v.ok) {
    if (v.por === 'rol-no-cumple') return fail('esto no da hebra, o no me queda aliento')
    return fail(`no puedo deshilachar: ${v.why}`)
  }

  const hebras: BodyView[] = []
  let costoObservado = 0

  for (let i = 0; i < args.cuantas; i++) {
    // Si lo que costó la vuelta anterior me deja por debajo del piso, no la
    // empiezo. En la primera vuelta `costoObservado` es 0, que es lo mejor que
    // se puede afirmar sin haber pagado nunca.
    if (ctx.self.stamina - costoObservado <= piso) break
    if (i > 0 && !ctx.can('deshilachar', { source: args.fuente, actor: ctx.self }).ok) break

    const antes = ctx.self.stamina
    const r = yield ctx.apply('deshilachar', { source: args.fuente, actor: ctx.self })
    costoObservado = antes - ctx.self.stamina
    if (r.status !== 'done') break
    for (const h of r.got) hebras.push(h)
  }

  const primera = hebras[0]
  return primera ? done(primera) : fail('no salió ni una hebra')
}
