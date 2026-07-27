// t1 / capacidad 1 — «Sabe no gastarse en un fuego que no va a prender»
//
// QUÉ IMPLEMENTA
// Antes de aplicar `friccion`, medir `moisture` y `rigidity` de las varas
// candidatas y descartar las que no van a superar el umbral de la ley 11; si
// ninguna sirve, no frotar y decir por qué. La habilidad de frotar es de cinco
// líneas; la capacidad es el `if` que la precede.
//
// QUÉ DIJO EL CRÍTICO
// FALTA_API. Tres errores: (1) no se puede leer la propia `stamina`,
// (2) no se puede ligar el rol `actor` de FRICCION, (3) `combustion` no es
// `ProcessId` así que no se le puede preguntar al mundo «esto va a prender».
//
// QUÉ ENCONTRÓ EL COMPILADOR
// El casillero es correcto: FALTA_API, y los tres huecos que nombró son los
// tres huecos que hay. La cuenta es distinta: son CUATRO sitios de error, no
// tres, porque el hueco de `SelfView` golpea también en `apply` y no sólo en
// `can` — o sea que ni siquiera reescribiendo el chequeo a mano se puede
// FROTAR con el rol `actor` ligado. Salida literal de
// `pnpm exec tsc -p ii/packages/skills/tsconfig.t1.json`:
//
//   ii/packages/skills/borradores/t1/encender-solo-cuando-va-a-prender.ts(94,27): error TS2345: Argument of type 'SelfView' is not assignable to parameter of type 'BodyView'.
//     Type 'SelfView' is missing the following properties from type 'BodyView': id, name
//   ii/packages/skills/borradores/t1/encender-solo-cuando-va-a-prender.ts(105,51): error TS2739: Type 'SelfView' is missing the following properties from type 'BodyView': id, name
//   ii/packages/skills/borradores/t1/encender-solo-cuando-va-a-prender.ts(116,30): error TS2345: Argument of type '"combustion"' is not assignable to parameter of type 'ProcessId'.
//   ii/packages/skills/borradores/t1/encender-solo-cuando-va-a-prender.ts(147,54): error TS2739: Type 'SelfView' is missing the following properties from type 'BodyView': id, name
//
// LO QUE SÍ COMPILA, Y ES LA MITAD BARATA
// El filtro perceptivo entero —`see([{q:'rigidity'}])` + `q(b,'moisture')`—
// pasa sin una queja. O sea: la criatura puede mirar la leña y descartarla.
// Lo que no puede es mirarse a sí misma ni preguntarle al mundo si el fuego va
// a prender. La capacidad tiene dos mitades y sólo la barata es expresable.
//
// EL HALLAZGO QUE EL CRÍTICO NO NUMERÓ: LA ARIDAD ES DECORATIVA
// Ver `demostracionAridadDeApply` al final del archivo. CONFIRMADO por tsc: esa
// función no produce NINGÚN error. `ctx.apply('friccion', {})` —cero roles sobre
// un proceso que declara tres—, `ctx.apply('friccion', { rolQueNoExiste: x })` y
// `ctx.can('union', {})` pasan las cuatro llamadas limpias. `Record<string,
// BodyView>` no verifica ni nombres ni cantidad. El compilador, que es el único
// árbitro que tenemos, no puede distinguir una llamada correcta de una vacía.
// Eso no es un hueco de `Ctx`: es que la puerta de tipos que el remake promete
// («el código generado se typechequea antes de que el mundo lo vea») está
// abierta justo en el lugar donde el modelo se equivoca.

import type { BodyView, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

// ─── Constantes de calibración copiadas a mano ──────────────────────────────
// NINGUNA de estas es leíble como cualidad. Cada habilidad generada se lleva su
// propia copia de la perilla; cuando el Hito 11 la mueva, `physicsVersion`
// invalida el sello pero el literal sigue acá decidiendo con el número viejo.
// HUECO: no hay cualidad derivada `ignitable` ni forma de leer el umbral de la ley 11.
const HUMEDAD_QUE_APAGA = 0.45 // ley 11, doc:374
// HUECO: `rigidity >= 0.5` es el `where` del rol 'a' de FRICCION (doc:362), copiado.
const RIGIDEZ_MINIMA = 0.5
// HUECO: 60 ticks × 6 °C/tick con eficiencia 0.35 = 48 de stamina (doc:372), copiado.
const STAMINA_POR_INTENTO = 48
const TICKS_DE_FRICCION = 60

export function* encenderSoloCuandoVaAPrender(
  ctx: Ctx,
  _args: Record<string, never>,
): Generator<Intent, Outcome, StepResult> {
  // ── Fase 1: elegir leña. Esta mitad compila entera. ────────────────────────
  ctx.phase('elegir-lena')

  const rigidas = ctx.see([{ q: 'rigidity', op: '>=', v: RIGIDEZ_MINIMA }])
  if (rigidas.length < 2) return fail('no veo dos varas rígidas')

  const secas: BodyView[] = []
  for (const vara of rigidas) {
    const humedad = ctx.q(vara, 'moisture')
    if (humedad >= HUMEDAD_QUE_APAGA) {
      ctx.say(`${vara.name} está mojada (${humedad}); frotarla es tirar la energía`)
      continue
    }
    secas.push(vara)
  }

  const a = secas[0]
  const b = secas[1]
  if (!a || !b) {
    // Éste es el corazón de la capacidad: abstenerse Y decir por qué.
    ctx.say('toda la leña que veo pasa el umbral de humedad: no froto')
    return fail('leña mojada: la fricción no llegaría a ignición')
  }

  // ── Fase 2: mirarme a mí misma. Acá se rompe. ─────────────────────────────
  ctx.phase('medir-lo-mio')

  // El sujeto del gasto es la criatura. La capacidad es «no gastarse 48 de una
  // cuenta conservada». `ctx.self` es `SelfView` y `ctx.q` pide `BodyView`.
  // HUECO: falta `ctx.me: BodyView` (o que `SelfView extends BodyView`).
  const miEnergia = ctx.q(ctx.self, 'stamina')
  if (miEnergia < STAMINA_POR_INTENTO) {
    ctx.say(`me quedan ${miEnergia} y frotar cuesta ${STAMINA_POR_INTENTO}: no alcanza`)
    return fail('sin energía para los 60 ticks')
  }

  // ── Fase 3: preguntarle al mundo en vez de adivinarle. ────────────────────
  ctx.phase('preguntar')

  // FRICCION declara TRES roles: a, b, actor (doc:362-364). El tercero soy yo.
  // HUECO: no hay `BodyView` de la propia criatura para ligar el rol `actor`.
  const puedoFrotar = ctx.can('friccion', { a, b, actor: ctx.self })
  if (!puedoFrotar.ok) {
    ctx.say(`el mundo dice que no: ${puedoFrotar.why}`)
    return fail(puedoFrotar.why)
  }

  // Y ésta es la pregunta que define la capacidad: «¿va a prender?». La ley 3
  // (`combustion`) es la que decide, y es `AmbientLawId`, no `ProcessId`: no
  // hay ninguna forma de consultarla. El `if` de arriba tuvo que reimplementar
  // a mano su compuerta con el literal HUMEDAD_QUE_APAGA.
  // HUECO: `ctx.can()` no acepta leyes ambiente; falta eso o una derivada `ignitable`.
  const vaAPrender = ctx.can('combustion', { fuel: a })
  if (!vaAPrender.ok) {
    ctx.say(`no va a prender: ${vaAPrender.why}`)
    return fail(vaAPrender.why)
  }

  // ── Fase 4: recién ahora, gastar. ─────────────────────────────────────────
  ctx.phase('frotar')

  for (const vara of [a, b]) {
    const yendo = yield ctx.goTo(vara, { within: 1 })
    if (yendo.status !== 'arrived') return fail(`no llegué a ${vara.name}`)
    const agarre = yield ctx.take(vara)
    // HUECO: `StepResult` no trae `why`. Un 'rejected' acá no enseña si fue
    // porque las manos están llenas o porque otro la sostiene.
    if (agarre.status !== 'done') return fail(`no pude agarrar ${vara.name}`)
  }

  const yaVa = ctx.memory.get<number>('ticks-frotados') ?? 0
  for (let t = yaVa; t < TICKS_DE_FRICCION; t++) {
    ctx.memory.set('ticks-frotados', t)

    // Re-chequeo a mitad: bajo lluvia la ley 11 puede volver a mojar la vara
    // durante los 60 ticks, y ahí los 48 de stamina se van sobre leña que ya
    // no califica — exactamente el suicidio que la capacidad promete evitar.
    if (ctx.q(a, 'moisture') >= HUMEDAD_QUE_APAGA) {
      ctx.say('se me mojó a mitad de frotar; corto acá antes de gastar el resto')
      ctx.memory.del('ticks-frotados')
      return fail('la leña se mojó durante la fricción')
    }

    const paso = yield ctx.apply('friccion', { a, b, actor: ctx.self })
    if (paso.status === 'rejected') {
      ctx.memory.del('ticks-frotados')
      return fail('el mundo rechazó la fricción')
    }
  }

  ctx.memory.del('ticks-frotados')
  return done(a)
}

/**
 * DEMOSTRACIÓN, no habilidad. Existe para dejar registrado que estas tres
 * llamadas pasan `tsc` sin una sola queja, sobre un proceso que declara los
 * roles `a`, `b` y `actor`:
 *
 *   - con CERO roles
 *   - con un rol que no existe
 *   - con el MISMO cuerpo en dos roles distintos
 *
 * `Record<string, BodyView>` no tiene aridad ni nombres. Mientras `apply` y
 * `can` tengan esta firma, el compilador no es árbitro de nada en el único
 * lugar donde importa. Lo que hace falta es tipar el mapa por proceso:
 * `RoleMap<'friccion'> = { a: BodyView; b: BodyView; actor: BodyView }`.
 */
export function demostracionAridadDeApply(ctx: Ctx, cualquiera: BodyView): void {
  ctx.apply('friccion', {})
  ctx.apply('friccion', { rolQueNoExiste: cualquiera })
  ctx.apply('friccion', { a: cualquiera, b: cualquiera })
  ctx.can('union', {})
}
