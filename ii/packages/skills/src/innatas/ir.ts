// INNATA 1/15 · «ir» — llegar a un lugar y saber si llegó.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { distancia } from './comun.js'

export const CONTRATO_IR: Contrato = {
  nombre: 'ir',
  establece: [{ sujeto: 'yo', q: 'at', op: '<=', v: 1 }], // distancia al objetivo ≤ within
  precondiciones: [{ sujeto: 'yo', q: 'stamina', op: '>', v: 0 }],
  cuesta: { segundos: 0, commitment: 'reversible' },
  huecos: [
    'no hay ensayo en seco de `goTo`: `can()` cubre sólo los cuatro `SeedProcessId`, y los motivos con los que el mundo rechaza un movimiento (`fuera-de-rango`, `celda-ocupada`, `sin-fuerza`) los sabe ANTES de moverse. La habilidad tiene que chocar para enterarse',
    '`StepResult` no dice cuántos ticks costó un `goTo` ni cuánta stamina: no hay forma de presupuestar un viaje, sólo de mirar `self.stamina` antes y después',
    'no hay nada que diga si un destino es ALCANZABLE: ni transitabilidad de celda, ni distancia de camino contra distancia recta',
  ],
}

/**
 * CONTRATO
 *   establece   distancia(self.at, objetivo) ≤ within, con la métrica del mundo
 *   precondiciones  `stamina` por encima de `COSTO_PASO`, o el mundo devuelve
 *                   `sin-fuerza`
 *   cuesta      ticks y `stamina`; `reversible` (tabla `COMMITMENT_OF` del mundo)
 *
 * POR QUÉ ES INNATA Y NO ES `ctx.goTo`: `goTo` es una intención; ir es una
 * conducta. La diferencia son los reintentos. El mundo contesta `blocked`
 * cuando algo se interpuso, y la respuesta correcta casi nunca es rendirse: es
 * volver a pedirlo, porque entre tick y tick el estorbo se puede haber movido.
 * Sin reintento, la primera criatura que se cruza con otra se queda parada.
 *
 * POR QUÉ RAMIFICA SOBRE `r.por` Y NO SOBRE EL TEXTO: `StepResult.por` es el
 * `Motivo` del mundo, el mismo con el que `stepWorld` rechaza. `sin-fuerza` no
 * se arregla reintentando y `celda-ocupada` sí; distinguirlos es la diferencia
 * entre insistir y ser terca. Antes de que `por` estuviera en la API esto no se
 * podía escribir: había que reintentar todo o rendirse con todo.
 */
export function* ir(
  ctx: Ctx,
  args: { a: BodyView | Cell; within?: number; reintentos?: number },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('ir')
  const within = args.within ?? 0
  const tope = args.reintentos ?? 4

  // La cuenta de reintentos vive en `ctx.memory` y no en una local porque al
  // cargar una partida la habilidad se REINICIA desde arriba: una corutina
  // suspendida no se serializa. Una local acá regala los reintentos gastados.
  const destino: Cell = 'at' in args.a ? args.a.at : args.a
  const clave = `ir:${'id' in args.a ? args.a.id : `${destino.x},${destino.y}`}`
  let hechos = ctx.memory.get<number>(clave) ?? 0

  while (hechos < tope) {
    // Salida temprana barata: si ya estoy, no gasto una intención.
    const aca: Cell = 'at' in args.a ? args.a.at : args.a
    if (distancia(ctx.self.at, aca) <= within) {
      ctx.memory.del(clave)
      return done()
    }

    ctx.memory.set(clave, ++hechos)
    const r = yield ctx.goTo(args.a, { within })
    if (r.status === 'arrived') {
      ctx.memory.del(clave)
      return done()
    }
    if (r.status === 'rejected') {
      ctx.memory.del(clave)
      // Los tres motivos que no mejoran esperando. `celda-ocupada` sí mejora,
      // y por eso NO está en la lista: cae al reintento.
      if (r.por === 'sin-fuerza') return fail('no me da el aliento para llegar')
      if (r.por === 'fuera-de-rango') return fail('está fuera del mundo')
      if (r.por === 'cuerpo-desconocido') return fail('lo que buscaba ya no está')
      continue
    }
  }

  ctx.memory.del(clave)
  return fail(`no llegué en ${tope} intentos`)
}
