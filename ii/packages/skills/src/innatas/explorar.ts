// INNATA 2/15 · «explorar» — buscar hasta encontrar, o hasta que no dé más.

import type { BodyView, CellQuality, Ctx, Intent, Outcome, StepResult, Where } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { disco } from './comun.js'

export const CONTRATO_EXPLORAR: Contrato = {
  nombre: 'explorar',
  establece: [{ sujeto: 'lo-que-devuelve', q: 'existe', op: '>=', v: 1 }],
  precondiciones: [{ sujeto: 'yo', q: 'stamina', op: '>', v: 0 }],
  cuesta: { segundos: 0, commitment: 'reversible' },
  huecos: [
    'EL `until` NUNCA CRUZA AL MUNDO. `Intent` de `@anima/world` para `explore` es `{ k: "explore", maxTicks }` y nada más: la clausura se queda de este lado. Y `intencionExplorar` (`world/src/step.ts:872`) da UN PASO en un rumbo rotativo por intención. O sea que `yield ctx.explore({ until, maxTicks: 400 })` NO explora 400 ticks: camina una celda. Quién evalúa `until` y quién repite es el ejecutor, y hasta que exista, el ejemplo canónico del documento de arquitectura —`if (r.status !== "found")`— no lo puede satisfacer nadie: `stepWorld` no produce jamás `found` ni `timeout`',
    'NO HAY BÚSQUEDA DE CELDAS. `Ctx` dice, con todas las letras, «buscar agua es `qAt` o `recall`, nunca `see`». Pero `qAt(at, q)` necesita que uno le dé la celda y no hay ninguna forma de PEDIR celdas, y `recall(w)` sólo devuelve lo ya recordado. Buscar en el campo de celda se hace inventando coordenadas con aritmética, de a una',
    'el rumbo de `explore` lo elige el mundo con FNV-1a del id del actor y el tick: no hay forma de explorar EN UNA DIRECCIÓN, ni de excluir lo ya visto',
  ],
}

/**
 * CONTRATO
 *   establece   `ctx.see(args.busco).length > 0`, o —para el campo de celda—
 *               existe una celda a la vista que cumple `buscoEnLaCelda`
 *   precondiciones  aliento; y que lo buscado EXISTA, cosa que nadie puede
 *                   verificar antes (por eso el veredicto `injuzgable` existe)
 *   cuesta      hasta `maxTicks` pasos, y `COSTO_PASO` de aliento cada uno
 *
 * LAS DOS CONDICIONES DE CORTE, y la segunda es la que importa: se deja de
 * buscar cuando se encontró, y también cuando a una se le está acabando el
 * aliento. La segunda sólo se puede escribir porque `PerceptionView.self`
 * existe; sin eso el predicado de corte sólo sabía hablar del paisaje y una
 * criatura buscando agua se moría buscando agua.
 *
 * POR QUÉ HAY DOS PREDICADOS Y NO UNO: el agua NO es un cuerpo. Es `wet`, un
 * campo de la celda, porque un lago de 4000 celdas como entidades son 4000
 * objetos que hay que filtrar diez veces por tick. Entonces «buscá agua» y
 * «buscá una vara» son dos búsquedas con dos verbos distintos —`qAt` y `see`—
 * y esta habilidad tiene que aceptar los dos o no sirve para lo único que el
 * documento le pide de ejemplo. Que el usuario tenga que saber de qué lado cae
 * lo que busca es superficie filtrándose.
 */
export function* explorar(
  ctx: Ctx,
  args: {
    busco?: Where
    buscoEnLaCelda?: { q: CellQuality; op: '>=' | '<='; v: number }
    maxTicks: number
    /** Radio del barrido de celdas alrededor. Sólo se usa con `buscoEnLaCelda`. */
    radio?: number
    staminaMinima?: number
  },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('explorar')
  const piso = args.staminaMinima ?? 0
  const radio = args.radio ?? 6

  const hayCelda = (): boolean => {
    const t = args.buscoEnLaCelda
    if (!t) return false
    for (const c of disco(ctx.self.at, radio)) {
      const v = ctx.qAt(c, t.q)
      if (t.op === '>=' ? v >= t.v : v <= t.v) return true
    }
    return false
  }
  const hayCuerpo = (): BodyView | undefined => (args.busco ? ctx.see(args.busco)[0] : undefined)

  // Si ya está a la vista, explorar es un no-op. Vale la guarda: `explore`
  // cobra un paso de stamina aunque lo buscado estuviera ahí desde el principio.
  const yaEsta = hayCuerpo()
  if (yaEsta) return done(yaEsta)
  if (hayCelda()) return done()

  const busco = args.busco
  const t = args.buscoEnLaCelda

  // El `until` se escribe igual que si el mundo lo fuera a evaluar, porque ésa
  // es la firma. Ver el primer hueco: hoy la clausura no cruza.
  const r = yield ctx.explore({
    until: (v) => {
      if (v.self.stamina <= piso) return true
      if (busco && v.see(busco).length > 0) return true
      if (t) {
        for (const c of disco(v.self.at, radio)) {
          const q = v.qAt(c, t.q)
          if (t.op === '>=' ? q >= t.v : q <= t.v) return true
        }
      }
      return false
    },
    maxTicks: args.maxTicks,
  })

  // Se vuelve a mirar: entre el corte y esta línea pasó un tick.
  const hallado = hayCuerpo()
  if (hallado) return done(hallado)
  if (hayCelda()) return done()

  if (r.status === 'rejected' && r.por === 'sin-fuerza') return fail('me quedé sin aliento buscando')
  if (r.status === 'timeout') return fail(`no encontré en ${args.maxTicks} ticks`)
  if (ctx.self.stamina <= piso) return fail('corté por aliento, no por haber buscado todo')
  return fail(`la exploración terminó en ${r.status} y no hay nada a la vista`)
}
