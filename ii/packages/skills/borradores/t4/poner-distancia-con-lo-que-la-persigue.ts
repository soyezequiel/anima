// TANDA 4 · «Sabe defenderse de algo que la quiere a ella»
// ESCRITOR — habilidad escrita entera, no sonda. El árbitro es `tsc`.
//
// El crítico dijo NECESITA_LEY con cuatro errores ('threat' fuera de QualityId,
// 'afilar' fuera de ProcessId, `ctx.velocityOf` y `ctx.behind` fuera de Ctx) y
// con este razonamiento, que sigue siendo el correcto: la ley 9 hace de la
// fauna un contador dentro de un Stock, así que la criatura come animales pero
// ningún animal existe lo bastante como para comerla a ella. El peligro es
// unidireccional por construcción.
//
// ─── LO QUE ENCONTRÓ EL COMPILADOR ─────────────────────────────────────────
//
// El veredicto se sostiene, pero DOS de los cuatro errores eran evitables, y
// eso cambia dónde está la pared:
//
// CORRECCIÓN 1 — detectar que algo la persigue COMPILA HOY.
//   No hace falta 'threat' ni `ctx.velocityOf`. Persecución es: el mismo `id`,
//   dos ticks, menos distancia. `see([])` + `ctx.memory` + aritmética entera
//   alcanzan y sobran (ver `quienSeMeAcerca`). O sea que la criatura puede
//   detectar perfectamente una persecución que no puede ocurrir. La pared no
//   está en percibir: está en que no hay nadie del otro lado.
//
// CORRECCIÓN 2 — «ponerse detrás del fuego» COMPILA HOY, y es peor que si no
//   compilara. `ctx.behind` no hace falta: la celda opuesta se calcula con
//   `2*fuego - amenaza` sobre `Cell{x,y}` y `goTo` acepta `Cell`. Compila,
//   pasa `admit()`, pasa el smoke, y no significa NADA: no hay línea de vista,
//   no hay oclusión (el mismo hueco que techo-que-para-la-lluvia) y nada le
//   teme al fuego. Es geometría correcta sobre una física que no existe.
//
// Y tres hallazgos nuevos, en orden de gravedad:
//
// HALLAZGO D — NO PUEDE LEER SU PROPIO CUERPO. `ctx.q(b: BodyView, q)` pide un
//   `BodyView`, y `ctx.self` es un `SelfView` de `{ at, holding }`: no tiene
//   `id` ni `name`, así que no es asignable. `ctx.q(ctx.self, 'stamina')` es
//   error de tipos. Toda la escalera de tanda 4 lo necesita —«huir hasta que
//   se me acabe el aliento», «aguantar el hambre para guardarle al cuidador»—
//   y ninguna habilidad puede medir una sola cualidad propia. No es HUECO 5
//   («faltan campos»): es que la criatura no es un cuerpo para sí misma.
//
// HALLAZGO E — el determinismo no está tipado. `lib: ["ES2022"]` deja entrar
//   `Math.random()`, `Date.now()`, `Math.sqrt`. El comentario de `Ctx` dice
//   «no hay Math.random ni Date en el scope», pero eso es una promesa del
//   sandbox en runtime, no del compilador: una habilidad no determinista pasa
//   tipos, pasa `admit()` y pasa el smoke. Ver `defensaQueRompeElDeterminismo`.
//
// HALLAZGO F — no hay acto agresivo, ni siquiera mal. Los constructores de
//   `Intent` son cinco: goTo, take, put, apply, explore. «Encarar» no se puede
//   escribir ni mintiendo: lo más cerca es caminarle encima. Y el sustituto que
//   SÍ compila es el peligroso: `apply('friccion', { tool: piedra, work: vara })`
//   pasa tipos como «afilar» porque los roles no están tipados. El compilador
//   ataja la palabra 'afilar' y deja pasar el proceso equivocado con el nombre
//   de rol correcto.
//
// Veredicto sostenido: NECESITA_LEY. Pero con la pared corrida: no es que no
// pueda percibir ni maniobrar. Es que no hay depredador, no hay daño, y no hay
// filo.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

interface Huella {
  readonly d: number
  readonly t: number
}

/** Chebyshev entera. Sin `Math`: puro, determinista, portable. */
function lejos(a: Cell, b: Cell): number {
  const dx = a.x > b.x ? a.x - b.x : b.x - a.x
  const dy = a.y > b.y ? a.y - b.y : b.y - a.y
  return dx > dy ? dx : dy
}

/** Reflejo de `p` respecto de `pivote`: la celda del otro lado. */
function delOtroLado(pivote: Cell, p: Cell): Cell {
  return { x: pivote.x + (pivote.x - p.x), y: pivote.y + (pivote.y - p.y) }
}

/**
 * CORRECCIÓN 1 — esto compila entero. Persecución sin cualidad 'threat' y sin
 * `velocityOf`: dos fotos del mismo `id` y una resta.
 */
function quienSeMeAcerca(ctx: Ctx): BodyView | undefined {
  const antes = ctx.memory.get<Record<string, Huella>>('huellas') ?? {}
  const ahora: Record<string, Huella> = {}
  const yo = ctx.self.at

  let candidato: BodyView | undefined
  let mayorAcercamiento = 0

  for (const b of ctx.see([])) {
    const d = lejos(b.at, yo)
    ahora[b.id] = { d, t: ctx.tick }
    const previo = antes[b.id]
    if (!previo) continue
    if (ctx.tick - previo.t > 20) continue
    const acerco = previo.d - d
    if (acerco > 0 && acerco > mayorAcercamiento && d <= 8) {
      mayorAcercamiento = acerco
      candidato = b
    }
  }

  ctx.memory.set('huellas', ahora)
  return candidato
}

export function* ponerDistanciaConLoQueLaPersigue(
  ctx: Ctx,
  args: { con?: BodyView },
): Generator<Intent, Outcome, StepResult> {
  // ── 1. ¿Quién viene? ─────────────────────────────────────────────────────
  ctx.phase('mirar-atras')

  const amenaza = quienSeMeAcerca(ctx)
  if (!amenaza) return done()

  // ✗ ERROR — 'threat' no es cualidad. El acercamiento lo puedo medir; que sea
  //   PELIGRO no lo puedo preguntar, porque ningún cuerpo del mundo lo es.
  const declaradas = ctx.see([{ q: 'threat', op: '>', v: 0.5 }])

  // ✗ ERROR — y no puedo saber su rumbo ni su velocidad: BodyView es
  //   { id, at, name } y nada más (HUECO 4). Sé que está más cerca que hace
  //   diez ticks; no sé si venía a mí.
  const rumbo = ctx.velocityOf(amenaza)

  ctx.memory.set('amenaza', amenaza.id)
  ctx.say('algo se me está acercando')

  // ── 2. ¿Cuánto aguanto? ──────────────────────────────────────────────────
  // ✗ ERROR (HALLAZGO D) — SelfView no es BodyView: no tiene `id` ni `name`.
  //   La criatura no puede leer su propia `stamina`, así que la elección entre
  //   correr y plantarse —que es literalmente esta capacidad— no tiene el dato
  //   que la decide.
  const aliento = ctx.q(ctx.self, 'stamina')
  const puedoCorrer = aliento > 0.35

  // ── 3. Rama A: huir hacia terreno que me favorece ────────────────────────
  ctx.phase('huir')

  // 'footing' es derivada y existe, así que esto compila. Pero devuelve
  // CUERPOS, no celdas: no hay forma de preguntarle a una celda cómo se pisa,
  // y huir es elegir celdas. La rama «terreno que la favorece» se escribe como
  // «correr hacia una cosa que tiene buen piso», que es otra conducta.
  const firme = ctx.see([{ q: 'footing', op: '>=', v: 0.7 }])[0]
  const fuga: Cell = firme ? firme.at : delOtroLado(ctx.self.at, amenaza.at)

  if (puedoCorrer) {
    const ir = yield ctx.goTo(fuga)
    if (ir.status === 'arrived' && lejos(ctx.self.at, amenaza.at) > 8) {
      ctx.memory.del('amenaza')
      return done()
    }
  }

  // ── 4. Rama B: ponerse detrás del fuego ──────────────────────────────────
  ctx.phase('detras-del-fuego')

  const fuego = ctx.see([{ q: 'emitsPower', op: '>', v: 200 }])[0]
  if (fuego) {
    // ✗ ERROR — `ctx.behind` no existe…
    const refugio = ctx.behind(fuego, amenaza)

    // …y no hace falta (CORRECCIÓN 2): la celda del otro lado del fuego es
    // aritmética de enteros y `goTo` acepta `Cell`. Esto compila y no
    // significa nada: no hay línea de vista, no hay oclusión, y nada del mundo
    // le teme al fuego.
    const alOtroLado = delOtroLado(fuego.at, amenaza.at)
    const ir = yield ctx.goTo(alOtroLado, { within: 1 })
    if (ir.status !== 'arrived') return fail('no llegué al fuego')
  }

  // ── 5. Rama C: encarar con algo puntiagudo ───────────────────────────────
  ctx.phase('encarar')

  let punta = args.con ?? ctx.see([{ q: 'sharpness', op: '>=', v: 0.6 }])[0]

  if (!punta) {
    const piedra = ctx.see([{ q: 'rigidity', op: '>=', v: 0.9 }])[0]
    const vara = ctx.see([{ q: 'reach', op: '>=', v: 2 }])[0]
    if (!piedra || !vara) return fail('no tengo con qué')

    // ✗ ERROR — 'afilar' no es ProcessId. `sharpness` existe como cualidad con
    //   ley y NINGÚN proceso invocable la sube: friccion mueve temperature,
    //   union junta, deshilachar parte al hilo, extraccion saca de stock. La
    //   lanza es inconstruible.
    const afilado = yield ctx.apply('afilar', { stone: piedra, blank: vara })

    // …y este es el sustituto que compila, y es el HALLAZGO F: los roles son
    // `Record<string, BodyView>`, así que puedo llamar 'friccion' con los roles
    // de afilar y el compilador no tiene nada que decir. Pasa tipos, pasa
    // admit(), y calienta la vara en vez de sacarle filo.
    const mintiendo = yield ctx.apply('friccion', { stone: piedra, blank: vara })
    punta = mintiendo.got[0]
    if (!punta) return fail('no me salió la punta')
  }

  // HALLAZGO F, la otra mitad — no hay acto agresivo en `Ctx`. Los cinco
  // constructores de Intent son goTo/take/put/apply/explore. «Encarar» no se
  // puede escribir ni siquiera mal: lo más parecido es caminarle encima con
  // algo en la mano.
  const tomar = yield ctx.take(punta)
  if (tomar.status !== 'done') return fail('no la pude agarrar')
  const encarar = yield ctx.goTo(amenaza, { within: 1 })
  if (encarar.status !== 'arrived') return fail('no la alcancé')

  // ── 6. Sostener la elección hasta que se va ──────────────────────────────
  ctx.phase('sostener')

  const desde = ctx.memory.get<number>('desde') ?? ctx.tick
  ctx.memory.set('desde', desde)

  for (let i = 0; i < 120; i++) {
    const sigue = ctx.see([]).find((b: BodyView) => b.id === amenaza.id)
    if (!sigue) {
      ctx.memory.del('amenaza')
      ctx.memory.del('desde')
      ctx.say('se fue')
      return done()
    }
    const r = yield ctx.goTo(delOtroLado(ctx.self.at, sigue.at), { within: 1 })
    if (r.status === 'blocked') break
  }

  // Y esto es lo que no se puede escribir de ninguna manera: «sobrevive a un
  // encuentro que no eligió». Ninguna de las once leyes transfiere daño de un
  // cuerpo a otro, así que perder este enfrentamiento no tiene consecuencia
  // medible. `fail` acá abajo es literatura.
  return fail('no se fue')
}

/**
 * HALLAZGO E — el determinismo del sandbox no está en los tipos.
 * Esta función pasa `tsc` sin una queja bajo el mismo tsconfig que el resto.
 * Si el aislamiento del worker falla o se afloja, una habilidad así se
 * promueve a `estable` habiendo pasado tipos, `admit()` y smoke, y desincroniza
 * la partida sin que nada del arnés lo haya podido ver.
 */
export function* defensaQueRompeElDeterminismo(
  ctx: Ctx,
): Generator<Intent, Outcome, StepResult> {
  // HUECO: `Math` y `Date` entran enteros por `lib: ["ES2022"]`. El
  // comentario de Ctx («no hay Math.random ni Date en el scope») es una
  // promesa de runtime que ningún tipo respalda.
  const moneda = Math.random()
  const cuando = Date.now()
  const yo = ctx.self.at
  const donde: Cell = { x: yo.x + (moneda > 0.5 ? 3 : -3), y: yo.y + (cuando % 2) }
  const ir = yield ctx.goTo(donde)
  if (ir.status !== 'arrived') return fail('no llegué')
  return done()
}

// ─── SALIDA LITERAL DE tsc ──────────────────────────────────────────────────
// pnpm exec tsc -p ii/packages/skills/tsconfig.t4.json
//
// ii/packages/skills/borradores/t4/poner-distancia-con-lo-que-la-persigue.ts(119,33): error TS2322: Type '"threat"' is not assignable to type 'QualityId'.
// ii/packages/skills/borradores/t4/poner-distancia-con-lo-que-la-persigue.ts(124,21): error TS2339: Property 'velocityOf' does not exist on type 'Ctx'.
// ii/packages/skills/borradores/t4/poner-distancia-con-lo-que-la-persigue.ts(134,25): error TS2345: Argument of type 'SelfView' is not assignable to parameter of type 'BodyView'.
//   Type 'SelfView' is missing the following properties from type 'BodyView': id, name
// ii/packages/skills/borradores/t4/poner-distancia-con-lo-que-la-persigue.ts(161,25): error TS2339: Property 'behind' does not exist on type 'Ctx'.
// ii/packages/skills/borradores/t4/poner-distancia-con-lo-que-la-persigue.ts(186,37): error TS2345: Argument of type '"afilar"' is not assignable to parameter of type 'ProcessId'.
//
// Cinco errores. Los cuatro del crítico más `ctx.q(ctx.self, …)` (HALLAZGO D),
// que es el que más duele porque no es de esta capacidad: es de todas.
//
// Y CERO errores en `quienSeMeAcerca` (detectar persecución con memoria y
// aritmética), cero en `delOtroLado` + `goTo` (ponerse detrás del fuego), cero
// en `apply('friccion', { stone, blank })` (afilar mintiendo) y cero en
// `defensaQueRompeElDeterminismo` (Math.random + Date.now). El compilador
// ataja las palabras que no existen y deja pasar entera la conducta falsa.
