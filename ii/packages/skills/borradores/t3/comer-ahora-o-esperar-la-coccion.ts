// TANDA 3 · capacidad «comer-ahora-o-esperar-la-coccion»
// ESCRITOR — intento de escribirla de verdad, entera, como si la API existiera.
//
// QUÉ CAPACIDAD IMPLEMENTA
//   Con hambre y una pieza cruda al lado del fuego, comparar lo que rinde
//   comerla YA (calorías bajas + toxicidad) contra lo que rinde en ~300 ticks
//   (digestibilidad alta, toxicidad desnaturalizada) frente a cuánta stamina le
//   queda, y elegir. Con hambre leve, espera. Al borde del colapso, come cruda
//   y se banca la intoxicación.
//
// QUÉ DECIDIÓ EL CRÍTICO
//   FALTA_API. Faltan `eat`, `wait`, y el estado propio (`stamina`/`hunger` en
//   `SelfView`). Dijo además que `ctx.q(ctx.self, 'stamina')` no sirve como
//   camino largo porque `SelfView` no es asignable a `BodyView`.
//
// QUÉ ENCONTRÓ EL COMPILADOR (salida literal en el reporte)
//   Confirmado y AMPLIADO. Los errores de este archivo son seis distintos, y
//   uno de ellos el crítico no lo tenía:
//
//     TS2339  ctx.self.hunger              — SelfView no tiene hunger
//     TS2339  ctx.self.stamina             — SelfView no tiene stamina
//     TS2345  ctx.q(ctx.self, 'stamina')   — SelfView no es asignable a BodyView
//     TS2339  ctx.project(...)             — no hay simulación proyectiva
//     TS2339  ctx.qAt(...)                 — no hay lectura de cualidad de celda
//     TS2339  ctx.wait(...)                — no hay intención que gaste tiempo
//     TS2339  ctx.eat(...)                 — HUECO 8, el verbo no existe
//
//   EL HALLAZGO QUE NO ESTABA: la habilidad no puede ni siquiera DECIDIR MAL,
//   porque la comparación «ahora vs. en 300 ticks» no tiene con qué escribirse
//   sin cablear el 2.70 de la tabla del documento. `ctx.project` es la pieza
//   que evita que «cocinar = 300 ticks» se vuelva una fila de receta. Sin ella
//   el único código que compila es el que copia el número a mano — o sea, la
//   receta que el remake dice haber matado, escrita por el modelo en vez de por
//   un humano, que es peor porque nadie la revisa.
//
//   SEGUNDO HALLAZGO: `ctx.wait` no es un capricho de comodidad. NO HAY NINGUNA
//   intención en toda la superficie que consuma tiempo sin mover el cuerpo. La
//   cocción, el secado, la descomposición y el carbonizado son todos leyes
//   ambiente que corren POR TICK: el repertorio entero de técnicas pasivas del
//   mundo —la mitad de la física escrita— es inalcanzable porque la criatura no
//   tiene forma de esperar. El sustituto que compila es `goTo(ctx.self.at)` en
//   un for, que es hacer que la criatura camine en el lugar para que pase el
//   tiempo. Está abajo, marcado.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

/** Cuánto castiga la toxicidad por caloría. No sale de ninguna ley publicada. */
const K_TOXICIDAD = 1.5

/** Debajo de esto no hay lujo de esperar: se come lo que haya. */
const COLAPSO = 0.15

export function* comerAhoraOEsperarLaCoccion(
  ctx: Ctx,
  args: { pieza: BodyView; fogata: BodyView },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('tasar')

  // ── (1) TASAR LA COMIDA. Esto SÍ se expresa, y es la mitad que menos importa.
  const caloriasAhora = ctx.q(args.pieza, 'calories')
  const toxicidadAhora = ctx.q(args.pieza, 'toxicity')
  const rindeAhora = caloriasAhora - toxicidadAhora * K_TOXICIDAD

  // ── (2) TASARSE A SÍ MISMA. Acá se cae todo.
  //    La criatura puede medir la carne con precisión y no puede medirse a sí.
  const hambre = ctx.self.hunger // ← esperado TS2339
  const stamina = ctx.self.stamina // ← esperado TS2339

  // El camino largo tampoco existe: medirse con el mismo verbo con el que mide
  // todo lo demás. `SelfView` no es `BodyView` — no tiene `id` ni `name`.
  const staminaPorElCaminoLargo = ctx.q(ctx.self, 'stamina') // ← esperado TS2345

  // ── (3) PROYECTAR. «Lo que rinde en 300 ticks» necesita simular, no recordar.
  //    Sin esto, el único código posible es `rindeAhora * 2.14`, que es la tabla
  //    del documento copiada a mano dentro de la habilidad.
  const piezaCocida = ctx.project(args.pieza, 300) // ← esperado TS2339
  const rindeCocida = ctx.q(piezaCocida, 'calories') - ctx.q(piezaCocida, 'toxicity') * K_TOXICIDAD

  // ── (4) DECIDIR. La decisión en sí es aritmética honesta y de tres líneas.
  //    Es lo único de toda la capacidad que no necesita nada nuevo.
  const alBordeDelColapso = stamina <= COLAPSO || staminaPorElCaminoLargo <= COLAPSO
  const valeLaPenaEsperar = rindeCocida > rindeAhora && !alBordeDelColapso

  if (!valeLaPenaEsperar) {
    ctx.say('la como cruda, no llego')
    const mordisco = yield ctx.eat(args.pieza) // ← esperado TS2339 · HUECO 8
    return mordisco.status === 'done' ? done() : fail('no pude comerla')
  }

  // ── (5) ESPERAR LA COCCIÓN, con desistimiento.
  ctx.phase('esperar-coccion')
  const desde = ctx.tick
  while (ctx.q(args.pieza, 'digestibility') < 0.85) {
    // (a) plazo: si la fogata no la va a cocinar nunca, hay que cortar.
    if (ctx.tick - desde > 600) {
      ctx.say('no se cocina, me la como así')
      const tarde = yield ctx.eat(args.pieza) // ← esperado TS2339
      return tarde.status === 'done' ? done() : fail('ni cruda pude')
    }

    // (b) el mundo no negocia: si se largó a llover, la fogata baja de 63 °C y
    //     `digestibility` deja de subir. `wet` es cualidad de CELDA.
    if (ctx.qAt(ctx.self.at, 'wet') >= 0.5) {
      // ← esperado TS2339
      ctx.say('se mojó el fuego')
      const mojada = yield ctx.eat(args.pieza) // ← esperado TS2339
      return mojada.status === 'done' ? done() : fail('lluvia y hambre')
    }

    // (c) el espejo: si la fogata se pasa de 280 °C entra la ley 3, `charred`
    //     sube y `nutrition` se va a cero mientras ella espera sentada.
    if (ctx.q(args.pieza, 'charred') > 0.5) {
      ctx.say('se me quemó')
      return fail('esperé de más')
    }

    // (d) si el hambre cruzó el umbral mientras esperaba, se come lo que hay.
    if (ctx.self.hunger > 0.9) {
      // ← esperado TS2339
      const urgente = yield ctx.eat(args.pieza) // ← esperado TS2339
      return urgente.status === 'done' ? done() : fail('no llegué')
    }

    yield ctx.wait(30) // ← esperado TS2339
  }

  ctx.phase('comer')
  const r = yield ctx.eat(args.pieza) // ← esperado TS2339
  return r.status === 'done' ? done() : fail('cocida y no la pude comer')
}

// ────────────────────────────────────────────────────────────────────────────
// LA VERSIÓN QUE SÍ COMPILA, para que se vea qué queda cuando se saca todo lo
// que falta. No es una versión reducida: es OTRA cosa. No come, no se mide, no
// proyecta y no espera — camina en el lugar. Es la habilidad de mirar la carne.
// ────────────────────────────────────────────────────────────────────────────
export function* comerDegenerada(
  ctx: Ctx,
  args: { pieza: BodyView },
): Generator<Intent, Outcome, StepResult> {
  const rindeAhora = ctx.q(args.pieza, 'calories') - ctx.q(args.pieza, 'toxicity') * K_TOXICIDAD
  // HUECO: no hay `ctx.project`. El 2.14 es el 1.26→2.70 de la tabla del
  // documento, copiado a mano. Es una fila de receta escrita por el modelo.
  const rindeCocida = rindeAhora * 2.14

  if (rindeCocida > rindeAhora) {
    // HUECO: no hay `ctx.wait`. Caminar al lugar donde ya se está es el único
    // modo de gastar ticks que la superficie permite.
    for (let i = 0; i < 10; i++) {
      yield ctx.goTo(ctx.self.at)
      if (ctx.q(args.pieza, 'digestibility') >= 0.85) break
    }
  }
  // HUECO 8: no hay `eat`. La habilidad termina acá, mirando la comida.
  ctx.say('está lista')
  return done(args.pieza)
}
