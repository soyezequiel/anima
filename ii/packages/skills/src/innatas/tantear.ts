// INNATA 11/15 · «tantear» — averiguar de qué está hecho algo, y anotarlo.

import type { BodyView, CellQuality, Ctx, Intent, Outcome, QualityId, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { distancia } from './comun.js'

/** Las siete que deciden qué se puede HACER con algo: las tres de los roles de
 *  los cuatro procesos (`rigidity`, `tensile`, `flexibility`), las dos que
 *  gobiernan el fuego, y las dos que gobiernan comer. */
const LO_QUE_SE_TANTEA: readonly QualityId[] = [
  'mass',
  'rigidity',
  'tensile',
  'flexibility',
  'moisture',
  'ignitionPoint',
  'calories',
]

const LO_QUE_SE_TANTEA_DE_LA_CELDA: readonly CellQuality[] = ['wet', 'oxygen', 'temperature', 'sheltered']

export interface Tanteo {
  readonly id: string
  readonly name: string
  readonly at: { readonly x: number; readonly y: number }
  readonly tick: number
  readonly cuerpo: Readonly<Record<string, number>>
  readonly celda: Readonly<Record<string, number>>
}

export const CONTRATO_TANTEAR: Contrato = {
  nombre: 'tantear',
  establece: [{ sujeto: 'lo-que-devuelve', q: 'existe', op: '>=', v: 1 }],
  precondiciones: [],
  cuesta: { segundos: 0.25, commitment: 'reversible' },
  huecos: [
    'TANTEAR NO AGREGA INFORMACIÓN. `ctx.q(b, q)` contesta cualquier cualidad de cualquier cuerpo que `see()` devuelva: sin distancia, sin oclusión, sin costo y sin incertidumbre. No hay cualidad oculta, no hay `inspect`, no hay grado de confianza. La habilidad innata «tantear» es, con esta API, un `wait` con adorno. Y no es que falte un método: falta que la percepción tenga estructura — hoy ver algo es saberlo todo de eso',
    'ASIMETRÍA `recall`/`remember`: `ctx.recall(w): PlaceMemory[]` existe y no hay NINGUNA forma de escribir un `PlaceMemory`. Quién llena esa memoria no está dicho en ninguna parte de la superficie. Lo único escribible es `ctx.memory`, que es KV crudo — o sea que la memoria de lugares que la API expone y la que una habilidad puede construir son dos memorias distintas que no se hablan',
    'NO ESTÁ DICHO QUÉ SE PUEDE GUARDAR EN `ctx.memory`. `SkillMemory.set<T>` acepta cualquier `T`. Un `BodyView` tiene ciclos (`supportedBy`, `covering`, `coveredBy` apuntan a otros `BodyView`) y no está dicho si se serializa, se clona o se guarda una referencia que al cargar la partida apunta a nada. El ejemplo canónico guarda `agua.at` —una celda— y no dice si es por prolijidad o por obligación. Acá se copian los dos enteros a mano, que es lo único de lo que se puede estar seguro',
    'no hay radio de percepción publicado: no se sabe si `see()` alcanza hasta un cuerpo o si hay que acercarse, ni qué se deja de ver al alejarse',
  ],
}

/**
 * CONTRATO
 *   establece   existe en `ctx.memory` un `Tanteo` de `qué`, con el tick en que
 *               se tomó
 *   precondiciones  ninguna
 *   cuesta      un `goTo` y `demora` segundos de mundo
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTA HABILIDAD ESTÁ CASI VACÍA, Y ES EL HALLAZGO.
 *
 * «Tantear» es palpar para averiguar lo que no se ve. En esta API todo se ve:
 * `see()` devuelve cuerpos enteros y `q()` contesta cualquier cualidad de
 * cualquiera de ellos, gratis, desde donde sea. No hay nada que averiguar.
 *
 * Entonces la habilidad hace lo único que le queda que sea real: acercarse y
 * ANOTAR, para que la información sobreviva a dejar de mirar. Eso sí vale
 * —`see()` es una foto del tick, y `recall()` no se puede escribir— pero es
 * memoria, no percepción.
 *
 * Lo que la haría honesta es una de dos, y ninguna existe: que `q()` tuviera
 * radio (de lejos se ve la forma, de cerca la humedad), o que hubiera
 * cualidades que sólo se revelan al manipular. Las dos son decisiones de
 * percepción —Hito 5— y por eso acá van anotadas y no inventadas.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function* tantear(
  ctx: Ctx,
  args: { que: BodyView; demora?: number },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('tantear')

  if (distancia(ctx.self.at, args.que.at) > 1) {
    const irA = yield ctx.goTo(args.que, { within: 1 })
    if (irA.status !== 'arrived') return fail('no llegué a tantearlo')
  }

  // La demora es lo único que hace que tantear CUESTE algo. En segundos de
  // mundo (ADR II-0008), que es la unidad de `wait`. Con `ctx.hz` se puede
  // convertir a ticks si hiciera falta; que la conversión sea posible es una
  // de las cosas que la API ganó al emitirse del código real.
  const demora = args.demora ?? 0.25
  if (demora > 0) yield ctx.wait(demora)

  const cuerpo: Record<string, number> = {}
  for (const q of LO_QUE_SE_TANTEA) cuerpo[q] = ctx.q(args.que, q)

  const celda: Record<string, number> = {}
  for (const q of LO_QUE_SE_TANTEA_DE_LA_CELDA) celda[q] = ctx.qAt(args.que.at, q)

  const t: Tanteo = {
    id: args.que.id,
    name: args.que.name,
    // Se copian los dos enteros y NO se guarda `args.que.at` ni el cuerpo: ver
    // el hueco de serialización. Es lo único de lo que se puede estar seguro.
    at: { x: args.que.at.x, y: args.que.at.y },
    tick: ctx.tick,
    cuerpo,
    celda,
  }
  ctx.memory.set(`tanteo:${args.que.id}`, t)

  return done(args.que)
}

/** Lo tanteado antes, si sigue en memoria. La otra mitad de la habilidad: sin
 *  esto, anotar no sirve de nada. */
export function tanteoDe(ctx: Ctx, b: BodyView): Tanteo | undefined {
  return ctx.memory.get<Tanteo>(`tanteo:${b.id}`)
}
