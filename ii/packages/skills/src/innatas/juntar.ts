// INNATA 3/15 · «juntar» — recolectar N cosas que cumplan un predicado.

import type { BodyView, Ctx, Intent, Outcome, StepResult, Where } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { enLaMano, porCercania } from './comun.js'

export const CONTRATO_JUNTAR: Contrato = {
  nombre: 'juntar',
  establece: [{ sujeto: 'yo', q: 'holding', op: '>=', v: 1 }],
  precondiciones: [
    { sujeto: 'el-objetivo', q: 'portable', op: '>=', v: 1 },
    { sujeto: 'yo', q: 'holding', op: '<', v: 1 }, // < capacity, que no es constante
  ],
  cuesta: { segundos: 0, commitment: 'reversible' },
  huecos: [
    'LA VISTA CONGELADA: `ctx.self` y `ctx.clock` son PROPIEDADES y no métodos. Un generador recibe `ctx` una sola vez; si el ejecutor no muta ese objeto en su lugar, la habilidad nunca ve lo que acaba de hacer. `see()` y `q()` no tienen el problema porque son métodos. La API no dice cuál de las dos lecturas vale, y con la equivocada esta habilidad se rompe. Medido: corriendo las quince, cinco fallaron a la vez por esto. Y `src/ejecutor.ts` llegó a lo mismo por el otro lado y lo dejó escrito como contrato EN PROSA sobre `WorldCtx` —el mundo refresca el objeto en su lugar—, o sea que la lectura correcta existe y vive en un comentario que el modelo no lee: `skill-api.d.ts`, que ES el prompt, no la menciona',
    '`capacity` cuenta PIEZAS y no masa ni volumen: juntar diez troncos y juntar diez hebras cuesta lo mismo, y `mass` está en `QualityId` sin que nadie la mire al levantar',
    'no hay `can()` para `take`: los cuatro motivos con que el mundo lo rechaza (`no-portable`, `manos-llenas`, `no-esta-a-mano`, `cuerpo-desconocido`) son todos decidibles antes, y hay que chocar para saberlos. Dos se pueden anticipar leyendo `portable` y `capacity`; los otros dos no',
    '`see()` devuelve también lo que ya tengo en la mano (`BodyView.heldBy` lo dice, pero el filtro lo tiene que escribir cada habilidad)',
  ],
}

/**
 * CONTRATO
 *   establece   `self.holding` contiene hasta `cuantos` cuerpos que cumplen
 *               `que`, o todos los que había si eran menos
 *   precondiciones  `portable ≥ 1` en lo que se junta; lugar en las manos
 *   cuesta      un `goTo` y un `take` por pieza; `reversible`
 *
 * POR QUÉ EL BUCLE ES POR CERCANÍA Y NO POR ORDEN DE `see()`: el orden de
 * `see()` no está especificado. Como no lo está, ordenar acá es lo único
 * determinista — y el desempate por `id` de `porCercania` no es prolijidad:
 * sin él, dos corridas del mismo mundo pueden juntar cuerpos distintos y el
 * criterio del Hito 4 «una habilidad corrida dos veces da el mismo hash» se cae.
 *
 * POR QUÉ SE DETIENE UNA PIEZA ANTES DEL TOPE: llenarse las manos es reversible
 * pero no gratis — con las manos llenas no se puede `take` la vara para pescar,
 * y `union` y `friccion` piden `arrangement: { k: 'held' }`, o sea que TODO
 * proceso aplicable necesita manos libres. Dejar margen es la diferencia entre
 * juntar y quedarse trabada.
 */
export function* juntar(
  ctx: Ctx,
  args: { que: Where; cuantos: number; dejarLibre?: number },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('juntar')
  const libre = args.dejarLibre ?? 1
  const juntados: BodyView[] = []

  for (let i = 0; i < args.cuantos; i++) {
    if (ctx.self.holding.length + libre >= ctx.self.capacity) {
      const p = juntados[0]
      return p ? done(p) : fail('no me entra nada más en las manos')
    }

    // Cada vuelta relee el mundo: entre `take` y `take` pasó un tick y lo que
    // vi antes pudo pudrirse, hundirse o llevárselo otro.
    const candidatos = porCercania(
      ctx.see(args.que).filter((b) => !enLaMano(ctx.self, b) && b.heldBy === undefined && ctx.q(b, 'portable') >= 1),
      ctx.self.at,
    )
    const b = candidatos[0]
    if (!b) break

    const irA = yield ctx.goTo(b, { within: 1 })
    if (irA.status !== 'arrived') continue

    const t = yield ctx.take(b)
    if (t.status === 'done') {
      juntados.push(b)
      continue
    }
    // `manos-llenas` significa que `capacity` mintió o que alguien me puso algo
    // en la mano: no tiene sentido seguir pidiendo.
    if (t.por === 'manos-llenas') break
  }

  const primero = juntados[0]
  return primero ? done(primero) : fail('no junté nada')
}
