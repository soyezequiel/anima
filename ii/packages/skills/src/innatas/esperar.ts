// INNATA 14/15 · «esperar» — dejar pasar el tiempo a propósito.

import type { BodyView, Ctx, Intent, Outcome, QualityId, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DOS UNIDADES DE TIEMPO, LAS DOS `number`, Y AHORA CONVERTIBLES.
 *
 * Lo que la API ganó al emitirse del código real, y es mucho:
 *
 *   · `clock.secondsToNightfall` está en SEGUNDOS (antes eran ticks), así que
 *     «esperar hasta que anochezca» SE PUEDE ESCRIBIR. Antes no.
 *   · `rateOf` declara su unidad —«unidades por SEGUNDO de mundo»—, así que
 *     `falta / rateOf(...)` da segundos y `wait` los toma. La división del ADR
 *     II-0004 cierra dimensionalmente.
 *   · `ctx.hz` existe, así que las dos unidades que quedan se relacionan.
 *
 * LO QUE QUEDA ABIERTO, y es un hueco de tipos y no de datos: siguen siendo
 * todos `number`. `explore.maxTicks` va en TICKS —correctamente, es
 * presupuesto de cómputo— y `wait` en SEGUNDOS, y esto compila sin una queja:
 *
 *     ctx.explore({ until: …, maxTicks: ctx.clock.secondsToNightfall })
 *
 * A 20 Hz eso es explorar veinte veces menos de lo que se quería. Verificado:
 * la sonda «unidades» de `tests/innatas-huecos.test.ts` corre `tsc` y da CERO
 * errores.
 *
 * Y lo que hace que valga la pena decirlo: el ADR II-0006 resolvió este mismo
 * problema del lado de la física con TIPOS NOMINALES — «sumar una tasa a una
 * magnitud no compila, y eso lo verifica `tsc`». La superficie que escribe el
 * MODELO, que es la que menos margen tiene, sigue sin nada. La reparación ya
 * está decidida un piso más abajo: `Segundos` y `Ticks` nominales, con
 * `ctx.hz` como única puerta entre los dos — exactamente el papel de `aplicar()`
 * entre `Fixed` y `Rate`.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const CONTRATO_ESPERAR: Contrato = {
  nombre: 'esperar',
  establece: [{ sujeto: 'el-objetivo', q: 'existe', op: '>=', v: 1 }],
  precondiciones: [],
  cuesta: { segundos: 0, commitment: 'reversible' },
  huecos: [
    'LA VISTA CONGELADA: `ctx.self` y `ctx.clock` son PROPIEDADES y no métodos. Un generador recibe `ctx` una sola vez; si el ejecutor no muta ese objeto en su lugar, la habilidad nunca ve lo que acaba de hacer. `see()` y `q()` no tienen el problema porque son métodos. La API no dice cuál de las dos lecturas vale, y con la equivocada esta habilidad se rompe. Medido: corriendo las quince, cinco fallaron a la vez por esto. Y `src/ejecutor.ts` llegó a lo mismo por el otro lado y lo dejó escrito como contrato EN PROSA sobre `WorldCtx` —el mundo refresca el objeto en su lugar—, o sea que la lectura correcta existe y vive en un comentario que el modelo no lee: `skill-api.d.ts`, que ES el prompt, no la menciona',
    'SEGUNDOS Y TICKS SIGUEN SIENDO EL MISMO TIPO. `wait(segundos)` y `explore({ maxTicks })` toman `number`, y pasarle uno al otro compila. `ctx.hz` permite convertir y nada obliga a hacerlo. Es la misma clase de bug que el ADR II-0006 cerró en la física con tipos nominales, sin cerrar en la superficie',
    'NO HAY ESPERA POR EVENTO. `wait(n)` es a ciegas: no hay `waitUntil(predicado)` ni forma de que el mundo despierte a la habilidad cuando algo cambia. Esperar «hasta que el pescado esté cocido» es un bucle de muestreo, y cada despertada cuesta una llamada a la mente',
    '`StepResult.status` no tiene un valor para «me despertaron antes»: si algo interrumpe una espera, no hay cómo enterarse',
    'no hay forma de saber cuánto tiempo REAL pasó: `ctx.tick` cuenta llamadas a la habilidad, no ticks del mundo («el contador de PASOS: cuántas veces llamaron a esta habilidad»). El único reloj de mundo legible es `clock`, que sólo habla del ciclo día/noche',
  ],
}

/**
 * CONTRATO
 *   establece   pasó el tiempo pedido, o se cumplió `hasta`, o `mirando` llegó
 *   precondiciones  ninguna
 *   cuesta      segundos de mundo, y el metabolismo que corra mientras tanto
 *
 * POR QUÉ ES INNATA Y NO ES `ctx.wait`: `wait(n)` es a ciegas. Esperar de
 * verdad es esperar A QUE ALGO PASE, y como no hay espera por evento, hay que
 * muestrear. Esta habilidad es el bucle de muestreo, con las dos salidas que
 * hacen falta: la condición y el desistimiento.
 *
 * POR QUÉ EL PASO SE CALCULA CON `rateOf` CUANDO SE PUEDE: muestrear cada 0.25 s
 * una cocción de 41 s —lo que tarda el cuero, medido— son 164 despertadas para
 * nada, y cada despertada es una llamada a la mente. Con la tasa se puede
 * dormir casi todo de una vez y despertar cerca. Es la extrapolación de primer
 * orden del ADR II-0004 usada para elegir CUÁNDO volver a mirar, no para
 * decidir. Si la tasa cambia —alguien apagó el fuego— la habilidad se despierta,
 * la relee y recalcula: nunca queda con un futuro viejo en la mano.
 *
 * POR QUÉ HAY UN PASO MÁXIMO ADEMÁS DEL MÍNIMO: dormir los 41 s de una es
 * confiar en una extrapolación de primer orden durante 41 s. El tope convierte
 * el supuesto «si nada cambia» en «si nada cambia en los próximos 2 s», que es
 * un supuesto que se puede sostener.
 */
export function* esperar(
  ctx: Ctx,
  args: {
    /** Cota superior de la espera, en SEGUNDOS de mundo. */
    segundos: number
    /** La condición que se está esperando. Sin ella, esto es `wait` a secas. */
    hasta?: () => boolean
    /** Para calcular el paso del muestreo: «esta cualidad de este cuerpo». */
    mirando?: { b: BodyView; q: QualityId; llegaA: number }
    pasoMinimo?: number
    pasoMaximo?: number
  },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('esperar')
  const pasoMinimo = args.pasoMinimo ?? 0.25
  const pasoMaximo = args.pasoMaximo ?? 2

  if (args.hasta?.()) return done()
  if (args.mirando && ctx.q(args.mirando.b, args.mirando.q) >= args.mirando.llegaA) return done(args.mirando.b)

  // Lo gastado vive en memoria: una espera larga es exactamente donde cae un
  // guardado, y reiniciar la cuenta haría que la criatura espere el doble.
  const clave = 'esperar:gastado'
  let gastados = ctx.memory.get<number>(clave) ?? 0

  while (gastados < args.segundos) {
    let paso = pasoMinimo

    if (args.mirando) {
      const falta = args.mirando.llegaA - ctx.q(args.mirando.b, args.mirando.q)
      if (falta <= 0) {
        ctx.memory.del(clave)
        return done(args.mirando.b)
      }
      // `rateOf` está declarada por SEGUNDO, así que esto son segundos.
      const tasa = ctx.rateOf(args.mirando.b, args.mirando.q)
      if (tasa <= 0) {
        // La tasa neta no va hacia donde quiero: esperar es tirar tiempo. Es la
        // misma guarda que `frotar`, y es lo que separa «esperar» de «colgarse».
        ctx.memory.del(clave)
        return fail('lo que espero no está pasando: la tasa es cero o va al revés')
      }
      const cuanto = falta / tasa
      paso = cuanto < pasoMinimo ? pasoMinimo : cuanto > pasoMaximo ? pasoMaximo : cuanto
    }

    const resta = args.segundos - gastados
    if (paso > resta) paso = resta

    const r = yield ctx.wait(paso)
    gastados += paso
    ctx.memory.set(clave, gastados)
    if (r.status === 'rejected') {
      ctx.memory.del(clave)
      return fail(`el mundo rechazó la espera: ${r.por ?? r.status}`)
    }
    if (args.hasta?.()) {
      ctx.memory.del(clave)
      return done()
    }
    if (args.mirando && ctx.q(args.mirando.b, args.mirando.q) >= args.mirando.llegaA) {
      ctx.memory.del(clave)
      return done(args.mirando.b)
    }
  }

  ctx.memory.del(clave)
  return args.hasta || args.mirando ? fail('se acabó la espera y no pasó') : done()
}

/**
 * Esperar hasta que anochezca. Existe como función aparte para dejar constancia
 * de que AHORA SE PUEDE: `clock.secondsToNightfall` está en segundos y `wait`
 * también. Con el `ticksToNightfall` del `.d.ts` escrito a mano esto era
 * inexpresable sin conocer la frecuencia, y la frecuencia no se publicaba.
 */
export function* esperarLaNoche(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  if (ctx.clock.phase === 'noche') return done()
  return yield* esperar(ctx, { segundos: ctx.clock.secondsToNightfall, hasta: () => ctx.clock.phase === 'noche' })
}
