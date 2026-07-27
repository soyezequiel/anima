// TANDA 3 · capacidad «tapar-la-fogata-para-hacer-carbon»
// ESCRITOR — intento de escribirla de verdad, entera, como si la API existiera.
//
// QUÉ CAPACIDAD IMPLEMENTA
//   La técnica emblema del documento: «nadie programó hacer carbón». Cubrir la
//   fogata para que el oxígeno de la CELDA baje de 0.35, esperar a que `charred`
//   cruce 0.8, y destapar a tiempo para recuperar residuo carbonoso en vez de
//   ceniza mineral. Toda la consecuencia cuelga de la ley 4.
//
// QUÉ DECIDIÓ EL CRÍTICO
//   FALTA_MUNDO, con el modo de falla más peligroso: compila y miente.
//   `ctx.q(fogata, 'oxygen')` typechequea pero devuelve el oxígeno del CUERPO,
//   y la ley 4 lee `w.oxygenAt(b.at)`, que es el de la CELDA.
//
// QUÉ ENCONTRÓ EL COMPILADOR (salida literal en el reporte)
//   Confirmado, y con DOS agregados que el crítico no tenía:
//
//   AGREGADO 1 — el vocabulario cerrado ni siquiera deja NOMBRAR el gesto.
//   `ctx.apply('cubrir', ...)` no falla con «no existe ese proceso»: falla con
//   TS2345, porque 'cubrir' no es asignable a `ProcessId`. Cubrir no es una ley
//   que falte implementar: es una palabra que el sistema no tiene. Y no hay
//   ruta alternativa, porque `apply(p, roles)` no toma `arrangement` — el
//   `{k:'inside'}` que la ley 8 define vive del lado del motor y la habilidad
//   no puede pedirlo ni por accidente.
//
//   AGREGADO 2 — la verificación tampoco se puede escribir. `BodyView` es
//   `{id, at, name}` (HUECO 4): no hay `coveredBy` ni `covering`, así que la
//   criatura no puede comprobar que su propia tapa siga puesta. Una técnica que
//   depende de mantener una condición durante 300 ticks, sin ninguna forma de
//   leer si la condición se mantiene.
//
//   LO QUE SÍ COMPILA, y conviene decirlo porque es a favor del documento:
//   toda la parte TÉRMICA de la técnica se expresa limpia. `ctx.q(tapa,
//   'temperature') >= ctx.q(tapa, 'ignitionPoint')` typechequea, o sea que el
//   caso límite de la tapa orgánica —la tapa se prende y se vuelve la fogata—
//   es detectable por la criatura sin API nueva. La física de la ley 1 y la
//   ley 3 está al alcance de la mano; la ley 4 no, y la ley 4 es la de la frase
//   insignia. La afirmación «puede combinar cualquier cosa cuya física ya esté
//   escrita» es verdadera para las leyes que actúan sobre CUERPOS y falsa para
//   las que actúan sobre CELDAS, y el corte es exactamente ése.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

/** La ley 4: por debajo de esto el residuo es carbonoso; por encima, mineral. */
const OXI_UMBRAL = 0.35

/** Cuánto `charred` hace falta antes de que valga la pena destapar. */
const CHARRED_LISTO = 0.8

export function* taparLaFogataParaHacerCarbon(
  ctx: Ctx,
  args: { fogata: BodyView; tapa: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('acercarse')
  const ir = yield ctx.goTo(args.fogata, { within: 1 })
  if (ir.status !== 'arrived') return fail('no llegué a la fogata')

  // ── (1) ¿ESTÁ ARDIENDO? Esta parte se expresa entera. Es la ley 1 + la ley 3,
  //    ambas sobre cuerpos, y la superficie las cubre bien.
  ctx.phase('verificar-fuego')
  if (ctx.q(args.fogata, 'temperature') < ctx.q(args.fogata, 'ignitionPoint')) {
    return fail('la fogata no está prendida')
  }

  // ── (2) LEER EL OXÍGENO. Acá está la mentira, y son dos líneas seguidas.
  //    La primera compila y contesta otra cosa. La segunda es la que hace falta.
  const oxiDelCuerpo = ctx.q(args.fogata, 'oxygen') // compila · NO es lo que lee la ley 4
  const oxiDeLaCelda = ctx.qAt(args.fogata.at, 'oxygen') // ← esperado TS2339
  if (oxiDeLaCelda < OXI_UMBRAL) {
    ctx.say('ya está sin aire, no hace falta tapar')
  }

  // La vía indirecta tampoco sirve, y también compila: un `see` sobre una
  // cualidad de celda typechequea y devuelve CUERPOS, no celdas.
  const celdasSinAire = ctx.see([{ q: 'oxygen', op: '<', v: OXI_UMBRAL }])
  if (celdasSinAire.length > 999) return fail('nunca')

  // ── (3) TAPAR. El gesto central de la técnica, y no hay forma de pedirlo.
  ctx.phase('tapar')

  // (3a) lo que existe: apilar. En ningún lado está dicho que apilar TAPE.
  //      La única relación que la ley 8 modela es `supportedBy`, que es
  //      SOPORTE, no OCLUSIÓN. Esto compila y produce ceniza.
  const apilar = yield ctx.put(args.tapa, args.fogata.at, { onTopOf: args.fogata })
  if (apilar.status !== 'done') return fail('no pude apoyar la tapa')

  // (3b) lo que haría falta: una relación de oclusión de primera clase.
  yield ctx.put(args.tapa, args.fogata.at, { covering: args.fogata }) // ← esperado TS2353

  // (3c) la vía del proceso: cubrir como transformación. El vocabulario cerrado
  //      no la contiene, y el error lo dice sin ambigüedad.
  const puedo = ctx.can('cubrir', { cover: args.tapa, target: args.fogata }) // ← esperado TS2345
  if (!puedo.ok) return fail(puedo.why)
  yield ctx.apply('cubrir', { cover: args.tapa, target: args.fogata }) // ← esperado TS2345

  // ── (4) ESPERAR LA CARBONIZACIÓN, vigilando las tres formas de arruinarla.
  ctx.phase('carbonizar')
  const desde = ctx.tick
  while (ctx.q(args.fogata, 'charred') < CHARRED_LISTO) {
    // (a) la tapa orgánica se prende y se vuelve la fogata. ESTO SÍ SE EXPRESA.
    if (ctx.q(args.tapa, 'temperature') >= ctx.q(args.tapa, 'ignitionPoint')) {
      ctx.say('se me prendió la tapa')
      yield ctx.take(args.tapa)
      return fail('la tapa se volvió leña')
    }

    // (b) ¿sigue tapada? `BodyView` no tiene con qué contestarlo.
    if (!args.fogata.coveredBy) return fail('se destapó sola') // ← esperado TS2339

    // (c) la ley 11: bajo lluvia la fogata se apaga y `charred` no llega nunca.
    if (ctx.qAt(args.fogata.at, 'wet') >= 0.5) {
      // ← esperado TS2339
      ctx.say('llueve, se apagó')
      return fail('lluvia')
    }

    // (d) plazo, porque sin (b) y (c) el bucle es infinito por construcción.
    if (ctx.tick - desde > 900) return fail('no carbonizó en el plazo')

    yield ctx.wait(30) // ← esperado TS2339
  }

  // ── (5) DESTAPAR A TIEMPO Y RECUPERAR. Esto se expresa entero.
  ctx.phase('destapar')
  const sacar = yield ctx.take(args.tapa)
  if (sacar.status !== 'done') return fail('no pude sacar la tapa')

  const residuo = ctx.see([{ q: 'charred', op: '>=', v: CHARRED_LISTO }])[0]
  if (!residuo) return fail('quedó ceniza')

  // El chequeo final que decide si la técnica salió o no: si el oxígeno de la
  // celda estuvo bajo, es carbón; si no, es mineral. Es la única línea que
  // separa la técnica emblema de un fuego común, y es la que no compila.
  if (oxiDeLaCelda >= OXI_UMBRAL || oxiDelCuerpo < 0) return fail('salió mineral')

  yield ctx.take(residuo)
  return done(residuo)
}
