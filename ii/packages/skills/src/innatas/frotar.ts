// INNATA 10/15 · «frotar» — subir la temperatura de algo. NO es «encender».

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { enLaMano } from './comun.js'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * EL ÚNICO NÚMERO CABLEADO DE LAS QUINCE, Y ES EL HALLAZGO DE ESTE ARCHIVO.
 *
 * La ley 3 decide que algo prende con `moisture < HUMEDAD_QUE_APAGA`, y esa
 * constante vale **0.45** y vive en `physics/src/leyes.ts:202`. Desde la
 * superficie no hay forma de preguntarla, y `can('friccion', …)` tampoco la
 * contesta: el rol de `friccion` pide `rigidity >= 0.5`, no humedad — frotar un
 * palo mojado ES legal, sube la temperatura, y no prende nunca.
 *
 * O sea que ésta es la única precondición de las quince que NO se puede
 * verificar ni con `can()` ni con una lectura: es una ley ambiente, y las leyes
 * ambiente no tienen `can()`.
 *
 * Lo que hace que sea un hallazgo y no una queja: el `.d.ts` agregó
 * `denaturesAt` y `pyrolysisAt` a `QualityId` por ESTA MISMA RAZÓN — sin ellos,
 * la única forma de escribir «sacalo antes de que se queme» era cablear 63 y
 * 280. Los dos bordes de la ventana de cocción se repararon; el borde de la
 * ignición quedó sin reparar, y es el que decide si hay fuego. La reparación
 * fue parcial y nadie lo había medido.
 *
 * Y la reparación no es una cualidad más: es que las leyes AMBIENTE publiquen
 * sus umbrales igual que los procesos publican sus roles. `ignitionPoint` es de
 * cada sustancia y ya está; `HUMEDAD_QUE_APAGA` es de la LEY y no está.
 * ────────────────────────────────────────────────────────────────────────────
 */
const HUMEDAD_QUE_APAGA_CABLEADA = 0.45

export const CONTRATO_FROTAR: Contrato = {
  nombre: 'frotar',
  establece: [{ sujeto: 'el-objetivo', q: 'temperature', op: '>=', v: 400 }],
  precondiciones: [
    { sujeto: 'el-objetivo', q: 'rigidity', op: '>=', v: 0.5 },
    { sujeto: 'el-objetivo', q: 'moisture', op: '<', v: HUMEDAD_QUE_APAGA_CABLEADA },
    { sujeto: 'yo', q: 'stamina', op: '>=', v: 1 },
  ],
  cuesta: { segundos: 3, commitment: 'reversible' },
  huecos: [
    'CABLEADO OBLIGADO: `HUMEDAD_QUE_APAGA` (0.45, `physics/leyes.ts:202`) no se puede leer ni preguntar. Es una constante de una ley AMBIENTE, y las leyes ambiente no tienen `can()` — sólo los cuatro procesos aplicables lo tienen',
    'NO HAY FORMA DE SABER QUE ALGO YA ESTÁ ARDIENDO. No hay `burning` ni `onFire`; `temperature >= ignitionPoint` es una inferencia que además ignora la humedad y el oxígeno de la celda, que son los otros dos factores de la ley 3. Una habilidad no puede contestar «¿prendió?» — sólo «¿está caliente?»',
    'no hay `apply("combustion")` y está bien (ADR II-0001, encender es una consecuencia). Pero entonces `establece: temperature>=400` es lo único que esta habilidad puede prometer, y «hay fuego» —que es lo que el plan quiere— no lo establece nadie',
  ],
}

/**
 * CONTRATO
 *   establece   `temperature(a) ≥ objetivo`. Por omisión el objetivo es
 *               `ignitionPoint(a)`: «lo dejé listo para que prenda»
 *   precondiciones  los dos cuerpos con `rigidity ≥ 0.5` y EN LA MANO;
 *                   `stamina ≥ 1`; y `moisture(a) < 0.45`, que no se puede
 *                   verificar salvo cableando
 *   cuesta      3 s llevan la madera de 15 a 375 °C y se comen 48 de `stamina`.
 *               `reversible` — calentar algo no compromete nada
 *
 * ENCENDER NO ES UNA ACCIÓN (ADR II-0001). Esta habilidad NO enciende: sube la
 * temperatura. Que el cuerpo prenda lo decide la ley 3, y la habilidad se
 * entera mirando. La tentación —y el borrador `t1` la escribió— es
 * `ctx.apply('combustion', …)`, y no existe a propósito.
 *
 * LA PARTE QUE SÓLO SE PUEDE ESCRIBIR DESDE EL ADR II-0004: la guarda de
 * `rateOf`. Frotar sube el calor y la ley 1 lo relaja hacia el ambiente al
 * mismo tiempo. Si la relajación gana, frotar es gastar 48 de aliento para
 * nada, y la criatura frotaría hasta desmayarse sin acercarse un grado.
 * `rateOf` lee la tasa NETA que el motor ya calculó este tick, en unidades por
 * SEGUNDO: si es ≤ 0 después de haber frotado, no se llega nunca. Es una
 * división, no una simulación, y el supuesto «si nada cambia» queda a la vista.
 */
export function* frotar(
  ctx: Ctx,
  args: { a: BodyView; b: BodyView; hasta?: number; staminaMinima?: number },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('frotar')
  const piso = args.staminaMinima ?? 1

  // La rama mojada: mirar antes de gastarse es la capacidad entera del borrador
  // t1, y es lo único de las quince que hay que cablear para escribir.
  if (ctx.q(args.a, 'moisture') >= HUMEDAD_QUE_APAGA_CABLEADA) {
    return fail(`${args.a.name} está tan mojado que no va a prender aunque lo caliente`)
  }

  const objetivo = args.hasta ?? ctx.q(args.a, 'ignitionPoint')
  if (ctx.q(args.a, 'temperature') >= objetivo) return done(args.a)

  // `arrangement: { k: 'held' }`: los dos en la mano.
  for (const pieza of [args.a, args.b]) {
    if (enLaMano(ctx.self, pieza)) continue
    const irA = yield ctx.goTo(pieza, { within: 1 })
    if (irA.status !== 'arrived') return fail(`no llegué a ${pieza.name}`)
    const t = yield ctx.take(pieza)
    if (t.status !== 'done') return fail(`no pude agarrar ${pieza.name}: ${t.por ?? t.status}`)
  }

  // `rigidity >= 0.5` en los dos: lo pregunta `can()`, no lo cablea la habilidad.
  const v = ctx.can('friccion', { a: args.a, b: args.b, actor: ctx.self })
  if (!v.ok) {
    if (v.por === 'rol-no-cumple') return fail('alguno de los dos es demasiado blando para frotar')
    return fail(`no puedo frotar: ${v.por}`)
  }

  let vueltas = 0
  while (ctx.self.stamina > piso) {
    const r = yield ctx.apply('friccion', { a: args.a, b: args.b, actor: ctx.self })
    vueltas++
    if (r.status === 'rejected') {
      if (r.por === 'sin-fuerza') break
      return fail(`el mundo rechazó la fricción: ${r.por}`)
    }
    if (ctx.q(args.a, 'temperature') >= objetivo) return done(args.a)

    // Después de al menos una vuelta la tasa ya refleja frotar Y perder calor.
    // Si el neto no sube, no hay número de vueltas que alcance.
    if (vueltas >= 2 && ctx.rateOf(args.a, 'temperature') <= 0) {
      return fail('el calor se va más rápido de lo que entra')
    }
  }

  return fail(`me quedé sin aliento a ${ctx.q(args.a, 'temperature')} de ${objetivo}`)
}
