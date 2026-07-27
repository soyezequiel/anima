// INNATA 13/15 · «guarecerse» — ponerse bajo techo antes de que haga falta.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { anillo, porCercania } from './comun.js'

/** Cuánto `sheltered` alcanza. Otra constante sin fuente: la ley 12 del ADR
 *  II-0002 produce el número y nadie publica desde cuánto vale la pena. */
const TECHO_SUFICIENTE = 0.5

export const CONTRATO_GUARECERSE: Contrato = {
  nombre: 'guarecerse',
  establece: [{ sujeto: 'la-celda', q: 'sheltered', op: '>=', v: TECHO_SUFICIENTE }],
  precondiciones: [{ sujeto: 'yo', q: 'stamina', op: '>', v: 0 }],
  cuesta: { segundos: 0, commitment: 'reversible' },
  huecos: [
    'LA VISTA CONGELADA: `ctx.self` y `ctx.clock` son PROPIEDADES y no métodos. Un generador recibe `ctx` una sola vez; si el ejecutor no muta ese objeto en su lugar, la habilidad nunca ve lo que acaba de hacer. `see()` y `q()` no tienen el problema porque son métodos. La API no dice cuál de las dos lecturas vale, y con la equivocada esta habilidad se rompe. Medido: corriendo las quince, cinco fallaron a la vez por esto. Y `src/ejecutor.ts` llegó a lo mismo por el otro lado y lo dejó escrito como contrato EN PROSA sobre `WorldCtx` —el mundo refresca el objeto en su lugar—, o sea que la lectura correcta existe y vive en un comentario que el modelo no lee: `skill-api.d.ts`, que ES el prompt, no la menciona',
    'SE PUEDE RECORDAR UN TECHO Y NO SE PUEDE BUSCAR. `recall(w: WhereCell)` toma tests de CELDA, así que `recall([{ q: "sheltered", op: ">=", v: 0.5 }])` compila y funciona — eso es nuevo y cierra el hueco más votado del corpus viejo. Pero sólo devuelve lo YA recordado, y no hay ninguna forma de escribir un `PlaceMemory`. Para un techo que nunca vio, la única vía es barrer celdas a mano con `qAt`: 80 llamadas por un radio de 4, para contestar lo que un predicado contestaría de una',
    '`put(techo, at, { covering: ctx.self })` TYPECHEQUEA: `SelfView extends BodyView`. Si la ley 12 ocluye sobre la criatura o no, no está dicho en ninguna parte. Es el modo de fallo caro —pasa tipos, pasa smoke, produce un número que vale 0 para siempre—, literalmente lo que pasaba con `q(fogata, "oxygen")` antes de que existiera `qAt`. Acá se escribe igual, y NO se da por buena: el resultado se verifica releyendo `sheltered`',
    '`place(bp: Blueprint)` existe, `Blueprint` es `{ id, at }`, y NO HAY FORMA DE OBTENER UNO: no hay catálogo ni `ctx.blueprints`. Y del otro lado, `stepWorld` lo rechaza con `no-implementado` — que es la forma honesta de decirlo, y significa que construirse un techo (ADR 0032) no existe todavía en ninguna de las dos puntas',
    'NO SE PUEDE PREGUNTAR SI LLUEVE. `raining` no está en `QualityId` ni en `CellQuality`. Guarecerse tiene condición de salida (`sheltered`) y no tiene condición de ENTRADA: la razón para guarecerse no es legible',
  ],
}

/**
 * CONTRATO
 *   establece   `qAt(self.at, 'sheltered') ≥ umbral`
 *   precondiciones  aliento; y que exista un techo
 *   cuesta      caminar, y si no hay techo, un `put` con `covering`
 *
 * LA ESTRATEGIA, EN TRES ESCALONES, Y CADA UNO ESTÁ EN UN ESTADO DISTINTO:
 *
 *   1. ¿ya estoy a cubierto? — SÓLIDO: `qAt(self.at, 'sheltered')`.
 *   2. ¿hay uno que yo conozca? — SÓLIDO desde que `recall` toma `WhereCell`:
 *      `recall([{ q: 'sheltered', … }])`. Lo que falta es quién llena esa
 *      memoria, porque `remember` no existe.
 *   3. ¿hay uno cerca que nunca vi? — A MANO: barrido de `qAt` sobre celdas
 *      inventadas con aritmética, porque no hay búsqueda sobre el campo de celda.
 *   4. ¿me hago uno? — `put(…, { covering })` compila y no se sabe qué hace;
 *      `place(blueprint)` está rechazado con `no-implementado` del otro lado.
 *
 * O sea: de las cuatro vías, dos andan, una es un barrido cuadrático, y la
 * cuarta no existe. Guarecerse sigue siendo la innata peor servida, aunque
 * mucho menos que antes de que `recall` hablara de celdas.
 */
export function* guarecerse(
  ctx: Ctx,
  args: { radio?: number; umbral?: number; conQue?: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('guarecerse')
  const umbral = args.umbral ?? TECHO_SUFICIENTE
  const radio = args.radio ?? 4

  if (ctx.qAt(ctx.self.at, 'sheltered') >= umbral) return done()

  // ── ESCALÓN 2: lo recordado. Una línea, porque `recall` habla de celdas. ──
  let destino: Cell | undefined
  const recordados = porCercania(
    ctx
      .recall([{ q: 'sheltered', op: '>=', v: umbral }])
      .map((p, i) => ({ at: p.at, id: `recuerdo:${i}`, atTick: p.atTick })),
    ctx.self.at,
  )
  const recordado = recordados[0]
  if (recordado) destino = recordado.at

  // ── ESCALÓN 3: el barrido a mano. 80 llamadas a `qAt` por un radio de 4. ──
  if (!destino) {
    let mejor = ctx.qAt(ctx.self.at, 'sheltered')
    for (let r = 1; r <= radio && !destino; r++) {
      for (const c of anillo(ctx.self.at, r)) {
        const s = ctx.qAt(c, 'sheltered')
        if (s >= umbral && s > mejor) {
          mejor = s
          destino = c
        }
      }
    }
  }

  if (destino) {
    const irA = yield ctx.goTo(destino, { within: 0 })
    if (irA.status === 'arrived' && ctx.qAt(ctx.self.at, 'sheltered') >= umbral) return done()
    if (irA.status === 'arrived') {
      // Llegué y no tapa: el recuerdo estaba viejo. `PlaceMemory.atTick` dice
      // cuán viejo, y no hay forma de CORREGIRLO — `remember` no existe, así
      // que la criatura va a volver a caminar hasta acá mañana.
      return fail('llegué al techo que recordaba y ya no tapa')
    }
    if (irA.por === 'sin-fuerza') return fail('no me da el aliento para llegar al techo')
  }

  // ── ESCALÓN 4: hacerse uno. Compila. No se sabe qué hace. ────────────────
  if (args.conQue) {
    const r = yield ctx.put(args.conQue, ctx.self.at, { covering: ctx.self })
    if (r.status !== 'done') return fail(`no pude armar el techo: ${r.por ?? r.status}`)
    if (ctx.qAt(ctx.self.at, 'sheltered') >= umbral) return done(args.conQue)
    return fail('puse algo encima y la celda sigue sin techo: la ley 12 no ocluye sobre la criatura')
  }

  return fail(`no hay techo en radio ${radio} y no me diste con qué hacer uno`)
}

/**
 * ¿Cuánto falta para la noche, en segundos de mundo?
 *
 * Está acá y no en `esperar` porque es el único disparador de guarecerse que la
 * superficie publica —`clock.secondsToNightfall`, en SEGUNDOS desde que el
 * `.d.ts` se emite del código real— y porque es la mitad que sí existe de la
 * pregunta cuya otra mitad falta: cuándo va a llover.
 */
export function faltaParaLaNoche(ctx: Ctx): number {
  return ctx.clock.phase === 'noche' ? 0 : ctx.clock.secondsToNightfall
}
