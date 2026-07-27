// INNATA 15/15 · «seguir orden de movimiento» — hacer lo que le pidieron.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult, Where } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { distancia, porCercania } from './comun.js'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * HALLAZGO PRINCIPAL — EL CANAL DE HABLA ES SIMPLEX.
 *
 * `Ctx` tiene `say(text: string): void` y NO TIENE NADA para escuchar. No hay
 * `heard`, no hay cola de mensajes, no hay orden pendiente. Dos borradores del
 * corpus ya lo habían pedido por nombre (`Ctx.heard`) y sigue sin estar.
 *
 * Consecuencia exacta: la orden **entra por argumento**. Alguien afuera —el
 * Hito 6, `@anima/lang`— la lee, la resuelve y la inyecta. Eso es defendible
 * como arquitectura; lo que no es defendible es que no esté escrito en ninguna
 * parte. Un modelo escribiendo «hacé lo que te pida el cuidador» va a escribir
 * `ctx.heard()` y va a comerse un TS2339.
 *
 * SEGUNDO HUECO, de identidad: NO HAY CUIDADOR. `venir` y `seguir` necesitan
 * saber dónde está quien dio la orden, y no hay `ctx.caretaker`, ni un tag, ni
 * ninguna cualidad de las 29 que distinga a una persona de una piedra.
 * `BodyView.heldBy` y `madeByMe` hablan de `ActorId`, así que los actores
 * existen del lado del mundo — y la superficie no deja ver ninguno.
 *
 * TERCER HUECO: NO HAY «PARAR». No hay primitiva de cancelación. La única
 * forma de dejar de moverse es que la habilidad que se mueve termine, y ésta no
 * puede terminar a la otra: `Ctx` no tiene prioridad ni `abort` (mismo hueco
 * que `huir-del-dolor`, y por la misma razón de fondo).
 * ────────────────────────────────────────────────────────────────────────────
 */

export type OrdenDeMovimiento =
  | { readonly verbo: 'ir'; readonly a: BodyView | Cell; readonly dentroDe?: number }
  | { readonly verbo: 'venir'; readonly quien: BodyView; readonly dentroDe?: number }
  | { readonly verbo: 'seguir'; readonly quien: BodyView; readonly dentroDe?: number; readonly porSegundos: number }
  | { readonly verbo: 'volver' }
  | { readonly verbo: 'parar' }

export const CONTRATO_SEGUIR_ORDEN: Contrato = {
  nombre: 'seguir-orden-de-movimiento',
  establece: [{ sujeto: 'yo', q: 'at', op: '<=', v: 1 }],
  precondiciones: [{ sujeto: 'yo', q: 'stamina', op: '>', v: 0 }],
  cuesta: { segundos: 0, commitment: 'reversible' },
  huecos: [
    'CANAL SIMPLEX: `ctx.say` sale y nada entra. No hay `heard`, ni cola de mensajes, ni orden pendiente. La orden tiene que llegar por argumento, y eso no está escrito en ninguna parte de la API',
    'NO HAY CUIDADOR: ninguna de las 29 cualidades ni ninguno de los campos de `BodyView` distingue a una persona. Los `ActorId` existen (aparecen en `heldBy`) y no hay forma de ver un actor, ni de saber cuál soy yo — `SelfView` no publica su `ActorId`',
    'NO HAY «PARAR»: no existe cancelación. Una orden de detenerse no puede detener nada, porque `Ctx` no tiene prioridad ni `abort`',
    'GUARDAR LA ORDEN NO ESTÁ DEFINIDO: la orden trae un `BodyView`, que tiene referencias a otros `BodyView` (`supportedBy`, `covering`, `coveredBy`). `SkillMemory.set<T>` acepta cualquier `T` y no dice qué le hace. Acá se guardan sólo los dos enteros de la celda, y por eso «seguime» NO sobrevive a un guardado mientras «andá al río» sí',
    '«volver» no tiene apoyo en la API: `recall(WhereCell)` busca por cualidad de celda, no por «el último lugar donde estuve». Se reconstruye con `ctx.memory`, que la habilidad tiene que haber llenado ella misma antes de moverse',
  ],
}

/**
 * CONTRATO
 *   establece   `distancia(self.at, objetivo) ≤ dentroDe`
 *   precondiciones  aliento; y para `venir`/`seguir`, la referencia de quién
 *   cuesta      caminar; `reversible` siempre — obedecer no compromete nada
 *
 * POR QUÉ SOBREVIVE A UN GUARDADO Y CÓMO: la continuidad es DÉBIL — al cargar,
 * la habilidad se reinicia desde arriba y se saltea a su `phase` leyendo
 * `ctx.memory`. Una orden de movimiento es el caso más visible: si el usuario
 * dice «andá al río», cierra la pestaña y vuelve, la criatura tiene que seguir
 * yendo al río. Por eso la celda destino se escribe en memoria ANTES del primer
 * paso y se borra al llegar. Lo que NO sobrevive es «seguime», porque seguir a
 * alguien es seguir a un cuerpo y un cuerpo no se puede guardar — y eso no es
 * un defecto de esta habilidad, es lo que la API deja.
 */
export function* seguirOrdenDeMovimiento(
  ctx: Ctx,
  args: { orden: OrdenDeMovimiento },
): Generator<Intent, Outcome, StepResult> {
  const o = args.orden
  ctx.phase(`orden:${o.verbo}`)

  if (o.verbo === 'parar') {
    // No hay nada que parar desde acá. Se deja constancia por el canal que sí
    // existe, y se devuelve `ok` porque «no moverme» ya es verdad.
    ctx.say('me quedo acá')
    ctx.memory.del('orden:destino')
    return done()
  }

  if (o.verbo === 'volver') {
    const guardado = ctx.memory.get<Cell>('orden:origen')
    if (!guardado) return fail('no me acuerdo de dónde vine')
    const r = yield ctx.goTo(guardado, { within: 0 })
    if (r.status !== 'arrived') return fail(`no pude volver: ${r.por ?? r.status}`)
    ctx.memory.del('orden:origen')
    return done()
  }

  if (o.verbo === 'seguir') {
    const dentroDe = o.dentroDe ?? 2
    let gastados = 0
    while (gastados < o.porSegundos) {
      if (distancia(ctx.self.at, o.quien.at) > dentroDe) {
        const r = yield ctx.goTo(o.quien, { within: dentroDe })
        if (r.status === 'rejected' && r.por === 'sin-fuerza') return fail('no te puedo seguir, no me da')
        if (r.status === 'rejected' && r.por === 'cuerpo-desconocido') return fail('te perdí')
      } else {
        yield ctx.wait(0.5)
      }
      gastados += 0.5
    }
    return done()
  }

  // 'ir' y 'venir' comparten todo salvo de dónde sale el destino.
  const destino: BodyView | Cell = o.verbo === 'venir' ? o.quien : o.a
  const dentroDe = o.dentroDe ?? (o.verbo === 'venir' ? 1 : 0)

  // Se anota de dónde salgo ANTES de moverme: es lo único que hace posible
  // «volvé». Y se anota la celda destino para que un guardado no la pierda.
  ctx.memory.set('orden:origen', { x: ctx.self.at.x, y: ctx.self.at.y })
  const celda: Cell = 'at' in destino ? destino.at : destino
  ctx.memory.set('orden:destino', { x: celda.x, y: celda.y })

  const r = yield ctx.goTo(destino, { within: dentroDe })
  if (r.status !== 'arrived') {
    if (r.por === 'sin-fuerza') return fail('no me da el aliento')
    // Un solo reintento hacia la celda anotada: si el cuerpo se movió, ir al
    // lugar donde estaba es lo más parecido a obedecer que queda.
    const anotada = ctx.memory.get<Cell>('orden:destino')
    if (!anotada) return fail('no llegué')
    const r2 = yield ctx.goTo(anotada, { within: dentroDe })
    if (r2.status !== 'arrived') return fail(`no llegué: ${r2.por ?? r2.status}`)
  }

  ctx.memory.del('orden:destino')
  return done()
}

/** Lo que el Hito 6 va a necesitar para inyectar una orden: resolver «el más
 *  cercano que cumpla» a un cuerpo. Va acá y no en `@anima/lang` porque es la
 *  única parte de la resolución que necesita percepción. */
export function objetivoMasCercano(ctx: Ctx, que: Where): BodyView | undefined {
  return porCercania(ctx.see(que), ctx.self.at)[0]
}
