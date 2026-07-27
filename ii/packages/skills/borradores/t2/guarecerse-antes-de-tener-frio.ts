// Tanda 2 · capacidad «guarecerse-antes-de-tener-frio»
// ESCRITOR — habilidad completa, escrita como si fuera a producción.
//
// QUÉ IMPLEMENTA
//   Anticipación térmica. Lee el reloj y su propio estado, estima cuántos ticks
//   le lleva la maniobra más barata que la deja abrigada (caminar a un reparo
//   que ya existe, o juntar leña y encender), y ARRANCA ANTES de que la ley 10
//   empiece a drenarle stamina por frío. Falsable: se la ve caminando con luz,
//   no tiritando a oscuras.
//
// QUÉ DECIDIÓ EL CRÍTICO
//   FALTA_MUNDO. Argumentó: (a) la superficie no tiene reloj (HUECO 11) ni
//   estado propio (HUECO 5); (b) —y esto es lo grave— ninguna de las once leyes
//   HACE la noche: la ley 1 relaja hacia `ambient` constante, así que aunque se
//   agregara `ctx.clock` la habilidad compilaría y no observaría nunca un
//   cambio; (c) «reparo» no tiene referente físico: el único reparo existente
//   es un cuerpo con `emitsPower > 0`, o sea el fuego.
//
// QUÉ ENCONTRÓ EL COMPILADOR — ver el bloque HALLAZGOS al pie del archivo.
//   Resumen: el crítico se queda corto por un lado y largo por el otro.
//   Corto: además de `clock` y `SelfView`, «reparo» no es sólo un problema de
//   diseño — es un ERROR DE TIPOS, porque no hay ninguna QualityId que nombre
//   estar bajo techo, y `ctx.q(x, 'sheltered')` no compila. Eso mueve la parte
//   (c) de «opinión» a «mecánico».
//   Largo: TODA la maniobra —el estimador de viaje, juntar leña, encender por
//   fricción, el presupuesto de stamina contra el costo del fuego— compila sin
//   tocar nada. Lo único inexpresable es SABER CUÁNDO.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

/** El mundo es una grilla; caminar en diagonal cuesta lo mismo que en recto. */
function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

/**
 * La compuerta de la ley 3, escrita con cualidades declaradas. Esto SÍ compila
 * (lo confirma también borradores/t2/26): saber que algo arde no necesita
 * ninguna API nueva.
 */
function arde(ctx: Ctx, b: BodyView): boolean {
  return ctx.q(b, 'temperature') >= ctx.q(b, 'ignitionPoint') && ctx.q(b, 'moisture') < 0.45
}

/** Costo estimado del viaje, en ticks. Aritmética pura sobre `Placement`. */
function ticksDeViaje(ctx: Ctx, destino: Cell): number {
  return chebyshev(ctx.self.at, destino) * TICKS_POR_CELDA
}

const TICKS_POR_CELDA = 2
/** Lo que la ley 2 le saca a la fricción, según el documento (~48 de stamina). */
const STAMINA_QUE_CUESTA_ENCENDER = 48
/** Margen de seguridad: no salir con lo justo. */
const COLCHON = 30

export function* guarecerseAntesDeTenerFrio(
  ctx: Ctx,
  args: { yesca?: BodyView },
): Generator<Intent, Outcome, StepResult> {
  // ─── FASE 1 · ¿cuánto falta? ──────────────────────────────────────────────
  // Anticipar es, literalmente, comparar dos números: cuánto falta para que el
  // mundo se ponga hostil, y cuánto tarda la maniobra. El segundo lo sé. El
  // primero no tengo cómo preguntarlo.
  ctx.phase('leer-el-reloj')

  // HUECO 11: no hay reloj más allá de `ctx.tick`, que es un contador monótono
  // sin fase. Sin esto no hay ningún futuro que anticipar.
  const faltaParaLaNoche = ctx.clock.ticksToNightfall
  const yaEsDeNoche = ctx.clock.phase === 'noche'

  // HUECO 5: `SelfView` declara `at` y `holding` y nada más. La criatura sabe
  // la temperatura de cualquier cuerpo del mapa y no la suya.
  const miTemperatura = ctx.q(ctx.self, 'temperature')
  const miStamina = ctx.self.stamina

  // El estado de la CELDA donde estoy parada: el ambiente contra el que la ley
  // 1 me relaja. No hay forma de leerlo (no hay `qAt`, y `Cell` no tiene id
  // para pasársela a `ctx.q`).
  const ambienteAcá = ctx.qAt(ctx.self.at, 'temperature')

  // ─── FASE 2 · ¿qué reparo tengo? ──────────────────────────────────────────
  // Dos candidatos: un lugar abrigado, o un fuego. El primero no existe en el
  // vocabulario de cualidades; el segundo sí.
  ctx.phase('elegir-reparo')

  // FALTA UNA CUALIDAD: 'sheltered' no está en las 26 (ni en las 3 sin
  // declarar). `Placement = Cell` (HUECO 3) no distingue adentro de afuera, así
  // que ni siquiera hay dónde colgar la propiedad.
  const abrigados = ctx.see([{ q: 'sheltered', op: '>=', v: 0.5 }])

  const fuegosVivos = ctx.see([{ q: 'emitsPower', op: '>', v: 0 }]).filter((f) => arde(ctx, f))
  const fuego = fuegosVivos
    .map((f) => ({ f, d: chebyshev(ctx.self.at, f.at) }))
    .sort((a, b) => a.d - b.d)[0]

  const reparo: BodyView | undefined = abrigados[0] ?? fuego?.f

  // ─── FASE 3 · la decisión anticipatoria ───────────────────────────────────
  // Este es el corazón de la capacidad y es media docena de restas. Salvo que
  // no tengo ninguno de los operandos del lado izquierdo.
  ctx.phase('decidir')

  const costoDeIrAlReparo = reparo ? ticksDeViaje(ctx, reparo.at) : Number.POSITIVE_INFINITY
  const costoDeEncender = args.yesca ? ticksDeViaje(ctx, args.yesca.at) + 120 : Number.POSITIVE_INFINITY
  const maniobraMásBarata = Math.min(costoDeIrAlReparo, costoDeEncender)

  const meDaElTiempo = faltaParaLaNoche > maniobraMásBarata + COLCHON
  const meDaElCuerpo = miStamina > STAMINA_QUE_CUESTA_ENCENDER + COLCHON
  const todavíaEstoyTibia = miTemperatura > 35 && ambienteAcá > 10

  if (!yaEsDeNoche && meDaElTiempo && todavíaEstoyTibia) {
    // Todavía hay luz y me sobra margen: sigo con lo mío. Que ESTA rama exista
    // es la mitad del punto — una criatura que se guarece siempre es un
    // termostato con patas.
    ctx.memory.set('ultimaEvaluacion', ctx.tick)
    return done()
  }

  // ─── FASE 4 · la maniobra ─────────────────────────────────────────────────
  // De acá para abajo, todo compila. Es la parte que el mundo ya sabe hacer.
  if (reparo && costoDeIrAlReparo <= costoDeEncender) {
    ctx.phase('ir-al-reparo')
    ctx.memory.set('reparo', reparo.at)
    const ir = yield ctx.goTo(reparo, { within: 1 })
    if (ir.status !== 'arrived') return fail('no llegué al reparo')
    ctx.say('llegué con luz')
    return done()
  }

  if (!args.yesca) return fail('sin reparo y sin yesca')
  if (!meDaElCuerpo) return fail('no me alcanza la stamina para encender')

  ctx.phase('juntar-lena')
  const leña = ctx.see([
    { q: 'moisture', op: '<=', v: 0.3 },
    { q: 'fuelEnergy', op: '>', v: 0 },
    { q: 'portable', op: '>', v: 0 },
  ])
    .map((b) => ({ b, d: chebyshev(ctx.self.at, b.at) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 2)

  if (leña.length === 0) return fail('no hay leña seca a la vista')

  for (const l of leña) {
    const ir = yield ctx.goTo(l.b, { within: 1 })
    if (ir.status !== 'arrived') continue
    const t = yield ctx.take(l.b)
    if (t.status !== 'done') return fail('no pude levantar la leña')
  }

  ctx.phase('encender')
  const puedo = ctx.can('friccion', { actor: args.yesca, target: args.yesca })
  if (!puedo.ok) return fail(`no puedo encender: ${puedo.why}`)

  const chispa = yield ctx.apply('friccion', { actor: args.yesca, target: args.yesca })
  if (chispa.status !== 'done') return fail('no prendió')

  ctx.phase('quedarme-al-lado')
  ctx.memory.set('reparo', ctx.self.at)
  return done()
}

// ─── HALLAZGOS ──────────────────────────────────────────────────────────────
//
// 1. El crítico dijo FALTA_MUNDO y tiene razón, pero por una razón MÁS
//    mecánica de la que dio. Él trató «no hay cualidad de abrigo» como un
//    problema de diseño («reparo se va a cablear como fuego»). No lo es: es un
//    error de tipos. `{ q: 'sheltered', ... }` no compila porque `QualityId` es
//    un vocabulario cerrado. Eso es exactamente el criterio C del enunciado
//    —«necesita una cualidad que no existe»— y lo decide tsc, no el gusto.
//
// 2. El crítico se pasó de largo con «la anticipación no se puede escribir».
//    El estimador de viaje, la comparación de maniobras, el presupuesto de
//    stamina contra el costo de la fricción, juntar dos leños ordenados por
//    distancia y encender: TODO ESO COMPILA HOY. La capacidad no está bloqueada
//    por la maniobra, está bloqueada por tres lecturas: el reloj, mi
//    temperatura, y la temperatura de la celda. Es un hueco chico y muy
//    localizado, y es una buena noticia para el alcance del proyecto.
//
// 3. Confirmo el hallazgo grande del crítico, y no lo dice el compilador:
//    aunque se agreguen `ctx.clock`, `SelfView.temperature` y `ctx.qAt`, esta
//    habilidad compilaría, correría y no vería jamás cambiar `ambienteAcá`,
//    porque `QualitySpec.relaxesTo.target: 'ambient' | number` es una CONSTANTE
//    en la ley 1. La superficie no puede detectar eso. Es el caso «compila y
//    miente» y sólo lo atrapa el mundo del Hito 2.
//
// 4. Deuda que ya se ve acá: `TICKS_POR_CELDA = 2` y `STAMINA_QUE_CUESTA_
//    ENCENDER = 48` son constantes de calibración escritas DENTRO de la
//    habilidad. `physicsVersion` invalida sellos de procesos, no literales que
//    escribió el modelo. Después de recalibrar la ley 2, esta habilidad sigue
//    sellada «estable» y sigue saliendo tarde.
