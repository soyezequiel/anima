// INNATA 5/15 · «unir» — atar dos cosas con una tercera. De acá sale la caña.

import type { BodyView, Ctx, Intent, Outcome, RolesOf, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { enLaMano } from './comun.js'

export const CONTRATO_UNIR: Contrato = {
  nombre: 'unir',
  // Lo que el proceso declara en `establishes`: una punta suelta y alcance. La
  // habilidad NO puede leerlo — ver hueco 1 — así que está transcripto acá.
  establece: [
    { sujeto: 'lo-que-devuelve', q: 'catch', op: '>', v: 0 },
    { sujeto: 'lo-que-devuelve', q: 'reach', op: '>=', v: 2 },
  ],
  precondiciones: [
    { sujeto: 'el-objetivo', q: 'flexibility', op: '>=', v: 0.8 },
    { sujeto: 'el-objetivo', q: 'tensile', op: '>=', v: 0.3 },
    { sujeto: 'yo', q: 'holding', op: '>=', v: 2 },
  ],
  cuesta: { segundos: 1, commitment: 'reversible' },
  huecos: [
    'NO SE PUEDE LEER `establishes`. Cada `Process` declara qué establece —`union` declara `freeStrandEnds>=1` y `reach>=2`— y ésa es la llave con la que el Hito 7 indexa la biblioteca. `SEED_ROLE_NAMES` publica los NOMBRES de rol; ni los predicados de `where` ni `establishes` cruzan a la superficie. Una habilidad no puede saber para qué sirve el proceso que invoca',
    'ROL OPCIONAL + `exactOptionalPropertyTypes`: `{ binder, a, b: args.b }` con `args.b?: BodyView` NO compila. El modelo lo va a escribir así siempre; es candidato #1 a reparación determinista del Hito 8',
    'no hay forma de deshacer una unión, y «romper el ensamble para recuperar la vara» es una de las diez secuencias emergentes con las que se juzga el Hito 5',
    '`JointView.a` y `.b` son ÍNDICES DE PARTE del mismo cuerpo, no cuerpos: correcto y bien dicho, pero significa que «¿a qué está atada mi caña?» no tiene respuesta — no hay relación entre cuerpos salvo `supportedBy`, `covering` y `heldBy`',
  ],
}

/**
 * CONTRATO
 *   establece   existe un cuerpo con `a` y (si vino) `b` como partes, unidos
 *               por `binder`; sin `b`, con una punta suelta — que es la caña
 *   precondiciones  los tres cuerpos EN LA MANO (`arrangement: { k: 'held' }`);
 *                   `binder` con `flexibility ≥ 0.8` y `tensile ≥ 0.3`
 *   cuesta      1 s de mundo; `reversible` según la tabla del catálogo
 *
 * POR QUÉ `b` ES OPCIONAL Y NO SON DOS HABILIDADES: es la caña entera. Sin
 * `b`, el atador sobrevive como PARTE, atado de un solo lado, y le queda una
 * punta suelta. Esa punta es `freeStrandEnds`, `freeStrandEnds` es lo único que
 * da `catch`, y `catch > 0` es lo único que califica para `extraccion`. Con `b`
 * obligatorio, pescar es imposible.
 *
 * POR QUÉ PREGUNTA `can()` ANTES: `can()` no ejecuta y NO CUESTA NADA — está
 * escrito en la API. Es la puerta más barata que hay, y es la única forma de no
 * cablear `flexibility ≥ 0.8` y `tensile ≥ 0.3` acá adentro. Que el veredicto
 * traiga `Motivo` y no sólo texto es lo que deja RAMIFICAR: `rol-no-cumple`
 * significa «este ligador no sirve, probá otro» y `arreglo-incorrecto`
 * significa «los tengo mal puestos, agarralos». Sin el motivo, las dos serían
 * la misma cadena de caracteres y la habilidad no podría reparar ninguna.
 */
export function* unir(
  ctx: Ctx,
  args: { binder: BodyView; a: BodyView; b?: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('unir')

  // ── EL HUECO, EN VIVO ─────────────────────────────────────────────────────
  // Lo natural es `{ binder: args.binder, a: args.a, b: args.b }` y NO COMPILA:
  // con `exactOptionalPropertyTypes`, `BodyView | undefined` no es asignable a
  // `b?: BodyView`. La rama de abajo es puro peaje del tipo — no dice nada del
  // mundo — y hay que escribirla en cada llamada a un proceso con rol opcional.
  const roles: RolesOf<'union'> =
    args.b === undefined
      ? { binder: args.binder, a: args.a }
      : { binder: args.binder, a: args.a, b: args.b }

  const piezas = args.b === undefined ? [args.binder, args.a] : [args.binder, args.a, args.b]

  // `arrangement: { k: 'held' }` — las tres tienen que estar EN LA MANO. No es
  // proximidad: es tenencia. Se sabe leyendo el catálogo de la física, no la
  // superficie; la superficie sólo lo dirá cuando `can()` conteste que no.
  for (const pieza of piezas) {
    if (enLaMano(ctx.self, pieza)) continue
    if (ctx.self.holding.length >= ctx.self.capacity) return fail('no me entran las tres en las manos')
    const irA = yield ctx.goTo(pieza, { within: 1 })
    if (irA.status !== 'arrived') return fail(`no llegué a ${pieza.name}`)
    const t = yield ctx.take(pieza)
    if (t.status !== 'done') return fail(`no pude levantar ${pieza.name}: ${t.por ?? t.status}`)
  }

  const v = ctx.can('union', roles)
  if (!v.ok) {
    if (v.por === 'rol-no-cumple') return fail('este atador no sirve: no es lo bastante flexible o resistente')
    if (v.por === 'arreglo-incorrecto') return fail('los tengo mal puestos')
    return fail(`no puedo unir: ${v.why}`)
  }

  const r = yield ctx.apply('union', roles)
  if (r.status !== 'done') return fail(`la unión salió ${r.por ?? r.status}`)

  const ensamble = r.got[0]
  return ensamble ? done(ensamble) : done()
}
