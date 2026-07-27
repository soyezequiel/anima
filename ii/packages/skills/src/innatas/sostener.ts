// INNATA 9/15 · «sostener» — tener algo en la mano, y hacerle lugar si no entra.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { enLaMano } from './comun.js'

export const CONTRATO_SOSTENER: Contrato = {
  nombre: 'sostener',
  establece: [{ sujeto: 'yo', q: 'holding', op: '>=', v: 1 }],
  precondiciones: [{ sujeto: 'el-objetivo', q: 'portable', op: '>=', v: 1 }],
  cuesta: { segundos: 0, commitment: 'reversible' },
  huecos: [
    'LA VISTA CONGELADA: `ctx.self` y `ctx.clock` son PROPIEDADES y no métodos. Un generador recibe `ctx` una sola vez; si el ejecutor no muta ese objeto en su lugar, la habilidad nunca ve lo que acaba de hacer. `see()` y `q()` no tienen el problema porque son métodos. La API no dice cuál de las dos lecturas vale, y con la equivocada esta habilidad se rompe. Medido: corriendo las quince, cinco fallaron a la vez por esto. Y `src/ejecutor.ts` llegó a lo mismo por el otro lado y lo dejó escrito como contrato EN PROSA sobre `WorldCtx` —el mundo refresca el objeto en su lugar—, o sea que la lectura correcta existe y vive en un comentario que el modelo no lee: `skill-api.d.ts`, que ES el prompt, no la menciona',
    '`drop(b)` NO DICE DÓNDE CAE, y el mundo lo suelta en la celda de quien lo tiene. Si esa celda tiene la fogata, soltar quema lo soltado, y la habilidad no lo puede prever: no hay lectura de qué hay en la celda propia salvo las cuatro cualidades de celda, y «hay fuego acá» no es ninguna de las cuatro (`temperature` alta es una inferencia, no una lectura)',
    'NO HAY VALOR DE NADA. Para elegir qué soltar hay que inventar una métrica. La API ofrece dos señales: `madeByMe` (ADR II-0003, autoría no propiedad) y `calories`. Una vara de tres días de trabajo cuyo `madeBy` se perdió vale lo mismo que una piedra',
    '`capacity` es un entero de piezas y no cambia con lo que se lleva: sostener un tronco y sostener una hebra ocupan lo mismo',
  ],
}

/**
 * CONTRATO
 *   establece   `qué ∈ self.holding`
 *   precondiciones  `portable ≥ 1`
 *   cuesta      un `goTo` + un `take`, y posiblemente un `drop`
 *
 * POR QUÉ NO ES `ctx.take`: `take` falla con `manos-llenas` y no hace nada al
 * respecto. Sostener es «tenerlo, cueste lo que cueste», y el costo es soltar
 * otra cosa. Sin esta habilidad, una criatura con las manos llenas de piedras
 * no puede levantar la caña que acaba de fabricar, y la secuencia estrella del
 * Hito 5 se corta en el paso más tonto. Y no es un caso raro: los tres procesos
 * de `arrangement: { k: 'held' }` piden hasta TRES cuerpos en la mano a la vez.
 *
 * QUÉ SUELTA, Y POR QUÉ ES LA PARTE FRÁGIL: lo menos valioso. «Valioso» no
 * existe en la API, así que se compone de las dos únicas señales disponibles:
 * lo que hice yo pesa más que lo que encontré, y entre lo encontrado manda
 * `calories`. Es una heurística escrita a mano, o sea exactamente el tipo de
 * decisión que el juez del Hito 7 tendría que ablacionar. No es una verdad: es
 * lo mejor que la superficie deja escribir.
 */
export function* sostener(
  ctx: Ctx,
  args: { que: BodyView; noSoltar?: readonly BodyView[] },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('sostener')

  if (enLaMano(ctx.self, args.que)) return done(args.que)
  if (ctx.q(args.que, 'portable') < 1) return fail(`${args.que.name} no entra en las manos`)
  if (args.que.heldBy !== undefined) return fail(`${args.que.name} lo tiene otro`)

  if (ctx.self.holding.length >= ctx.self.capacity) {
    const intocables = new Set((args.noSoltar ?? []).map((b) => b.id))
    const candidatos = [...ctx.self.holding]
      .filter((b) => !intocables.has(b.id))
      .sort((p, q) => {
        // `madeByMe` domina: soltar lo que una fabricó es tirar el trabajo, y
        // el trabajo no se recupera con `take`.
        if (p.madeByMe !== q.madeByMe) return p.madeByMe ? 1 : -1
        const d = ctx.q(p, 'calories') - ctx.q(q, 'calories')
        return d !== 0 ? d : p.id < q.id ? -1 : p.id > q.id ? 1 : 0
      })
    const sobrante = candidatos[0]
    if (!sobrante) return fail('tengo las manos llenas y nada que pueda soltar')

    const d = yield ctx.drop(sobrante)
    if (d.status !== 'done') return fail(`no pude soltar nada: ${d.por ?? d.status}`)
  }

  const irA = yield ctx.goTo(args.que, { within: 1 })
  if (irA.status !== 'arrived') return fail('no llegué')

  const t = yield ctx.take(args.que)
  if (t.status === 'done') return done(args.que)
  return fail(`no lo pude tomar: ${t.por ?? t.status}`)
}
