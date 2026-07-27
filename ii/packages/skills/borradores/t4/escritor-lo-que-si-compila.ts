// TANDA 4 · ESCRITOR — LO QUE SÍ COMPILA, y por eso es el problema.
//
// Este archivo es la evidencia NEGATIVA de los dos intentos de esta tanda
// (`techo-que-para-la-lluvia.ts` y `poner-distancia-con-lo-que-la-persigue.ts`).
// No tiene un solo error de tipos. Corré:
//
//   pnpm exec tsc -p ii/packages/skills/tsconfig.t4.json
//
// y contá: ninguna línea de las de abajo aparece en la salida.
//
// Importa porque el árbitro mecánico solo sirve para lo que ataja. Cada
// función de acá es una capacidad de tanda 4 escrita de la forma equivocada, y
// las cuatro pasan tipos → pasan `admit()` → pasan el smoke con precondiciones
// satisfechas → se promueven a `provisional`. Ninguna se puede atrapar sin
// mundo, y tres de las cuatro no se pueden atrapar ni con mundo.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'
import { done, fail } from '../../src/skill-api.js'

// ── A · Ensamble de profundidad 3 ──────────────────────────────────────────
// `MAX_ASSEMBLY_DEPTH = 2` vive en @anima/physics/body.ts y no está en la
// superficie que ve el código generado. Postes → travesaño → cubierta es
// profundidad 3, es el refugio entero, y el compilador no tiene con qué verlo.
// De yapa: los roles son `Record<string, BodyView>`, así que 'techo' y 'mundo'
// son nombres de rol tan válidos como 'binder'.
export function* profundidadTres(
  ctx: Ctx,
  args: { a: BodyView; b: BodyView; malla: BodyView; fibra: BodyView },
): Generator<Intent, Outcome, StepResult> {
  const u1 = yield ctx.apply('union', { binder: args.fibra, a: args.a, b: args.b })
  const travesano = u1.got[0]
  if (!travesano) return fail('1')
  const u2 = yield ctx.apply('union', { binder: args.fibra, a: travesano, b: args.malla })
  const media = u2.got[0]
  if (!media) return fail('2')
  const u3 = yield ctx.apply('union', { techo: media, mundo: args.malla, binder: args.fibra })
  return done(u3.got[0])
}

// ── B · El proceso equivocado con el nombre de rol correcto ────────────────
// El compilador ataja la palabra 'afilar'. No ataja llamar a 'friccion' con los
// roles de afilar: 'stone' y 'blank' no significan nada para los tipos. Pasa
// tipos, pasa admit(), y calienta la vara en vez de sacarle filo. El error de
// vocabulario se convierte en un error de semántica, que es más caro.
export function* afilarQueNoAfila(
  ctx: Ctx,
  args: { piedra: BodyView; vara: BodyView },
): Generator<Intent, Outcome, StepResult> {
  const r = yield ctx.apply('friccion', { stone: args.piedra, blank: args.vara })
  const punta = r.got[0]
  if (!punta) return fail('no salió')
  return done(punta)
}

// ── C · Ponerse detrás del fuego, sin oclusión y sin nadie ─────────────────
// `ctx.behind` no hace falta: la celda del otro lado es aritmética entera y
// `goTo` acepta `Cell`. Compila, se ve bien en la UI, y no significa nada: no
// hay línea de vista, no hay oclusión, y ningún cuerpo del mundo le teme al
// fuego. Es geometría correcta sobre física inexistente — y es exactamente lo
// que un modelo va a escribir cuando el error de `ctx.behind` le vuelva del
// compilador.
export function* detrasDelFuego(
  ctx: Ctx,
  args: { amenaza: BodyView },
): Generator<Intent, Outcome, StepResult> {
  const fuego = ctx.see([{ q: 'emitsPower', op: '>', v: 200 }])[0]
  if (!fuego) return fail('sin fuego')
  const detras: Cell = {
    x: fuego.at.x + (fuego.at.x - args.amenaza.at.x),
    y: fuego.at.y + (fuego.at.y - args.amenaza.at.y),
  }
  const ir = yield ctx.goTo(detras, { within: 1 })
  if (ir.status !== 'arrived') return fail('no llegué')
  return done()
}

// ── D · El determinismo, que es un comentario y no un tipo ─────────────────
// `Ctx` promete «no hay Math.random ni Date en el scope». Con `lib: ["ES2022"]`
// eso no lo garantiza nada: `Math.random`, `Date.now` y `Math.sqrt` entran
// enteros y typechequean. Si el aislamiento del worker se afloja, una habilidad
// así desincroniza la partida habiendo pasado los tres filtros del arnés.
export function* noDeterminista(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  const moneda = Math.random()
  const cuando = Date.now()
  const raiz = Math.sqrt(cuando % 97)
  const yo = ctx.self.at
  const ir = yield ctx.goTo({ x: yo.x + (moneda > 0.5 ? 3 : -3), y: yo.y + (raiz > 5 ? 1 : -1) })
  if (ir.status !== 'arrived') return fail('no llegué')
  return done()
}
