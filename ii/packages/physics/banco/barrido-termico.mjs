/**
 * BARRIDO TÉRMICO — corrección B de la auditoría, adelantada al Hito 0.
 *
 * La auditoría del documento de arquitectura dice:
 *
 *   «La tabla de `formFactor` (0.012 / 0.03 / 0.60 / 0.125) está escrita a mano
 *    por situación: es exactamente la "tabla de recetas disfrazada" que el doc
 *    acusa en las otras propuestas, pero en la ley 1. (…) la ventana entre "no
 *    cocina" (63) y "se quema" (280) tiene que seguir existiendo para 30
 *    sustancias, no para dos.»
 *
 * Y propone: «adelantar la calibración al Hito 0. Si esa ventana no existe sin
 * números por caso, el modelo físico cambia ahí y no en el mes cinco.»
 *
 * Esto lo prueba. No hay motor: son las ecuaciones de la ley 1 evaluadas.
 *
 *   node ii/packages/physics/banco/barrido-termico.mjs
 */

// ─── LA FUNCIÓN, EN LUGAR DE LA TABLA ───────────────────────────────────────
//
// La tabla del documento tiene cuatro filas. Resulta que las cuatro son la
// MISMA función evaluada en cuatro puntos:
//
//     formFactor(d, montaje) = exposicion(montaje) / (1 + d²)
//
//   piso     d=2  →  0.06 / 5  = 0.012   ← el documento dice 0.012
//   piso     d=1  →  0.06 / 2  = 0.03    ← el documento dice 0.03
//   contacto d=0  →  0.60 / 1  = 0.60    ← el documento dice 0.60
//   parrilla d=1  →  0.25 / 2  = 0.125   ← el documento dice 0.125
//
// O sea que la tabla NO era una tabla por caso: era una función con tres
// constantes de montaje que nadie había despejado. Eso cambia el veredicto de
// la auditoría, y hay que decirlo.
//
// `exposicion` es cuánto de la superficie del cuerpo mira a la fuente, y es una
// enumeración CERRADA de relaciones espaciales, no una fila por situación:
//   - apoyado en el piso: la fuente lo ve de costado y el suelo le roba calor
//   - sostenido sobre la fuente: le da la cara inferior entera
//   - en contacto con la brasa: conducción, no radiación
const EXPOSICION = { piso: 0.06, parrilla: 0.25, contacto: 0.6 }
const MONTAJES = Object.keys(EXPOSICION)

const formFactor = (d, montaje) => EXPOSICION[montaje] / (1 + d * d)

const T_AMBIENTE = 15
const H_PERDIDA = 0.5 // acoplamiento del cuerpo con el ambiente

/** Ley 1 — temperatura de equilibrio de un cuerpo frente a una fuente. */
const tEquilibrio = (potencia, d, montaje) =>
  T_AMBIENTE + (potencia * formFactor(d, montaje)) / H_PERDIDA

/**
 * Ley 5 — cuántos ticks tarda en COCINARSE a la temperatura `T`.
 *
 * OJO: la primera versión de este barrido medía cuánto tarda en CALENTARSE, y
 * daba 0-2 ticks. Está mal y el error importa: calentarse es casi instantáneo
 * comparado con desnaturalizarse, así que el tiempo de cocción es el de la ley
 * 5 y no el de la ley 1. Con el modelo equivocado, el óptimo era siempre el
 * mismo sitio y parecía que no había nada que aprender.
 *
 * La ley 5 del documento:  drive(digestibility → 0.95, 0.010·k/(0.2+toughness))
 * con k = (T − denaturesAt)/100. Aproximación exponencial, no lineal.
 */
const DIGESTIBILIDAD_CRUDA = 0.35
const DIGESTIBILIDAD_META = 0.85
const DIGESTIBILIDAD_TECHO = 0.95

function ticksDeCoccion(T, s) {
  const k = (T - s.denaturesAt) / 100
  if (k <= 0) return Infinity
  const r = (0.01 * k) / (0.2 + s.toughness)
  const restaAhora = DIGESTIBILIDAD_TECHO - DIGESTIBILIDAD_CRUDA
  const restaMeta = DIGESTIBILIDAD_TECHO - DIGESTIBILIDAD_META
  return Math.log(restaAhora / restaMeta) / r
}

/**
 * ─── LA DEGENERACIÓN, Y EL ARREGLO ──────────────────────────────────────────
 *
 * El documento define las dos tasas de la ley 5 proporcionales a la MISMA k:
 *
 *     cocción       r    = 0.010·k / (0.2 + toughness)
 *     evaporación   evap = 0.0006·k
 *
 * Entonces el agua perdida por unidad de progreso de cocción es
 * evap/r = 0.06·(0.2+toughness), que NO DEPENDE DE LA TEMPERATURA. Cocinar
 * rápido y caliente cuesta exactamente el mismo agua que cocinar lento y tibio.
 * Con eso, más caliente es siempre estrictamente mejor, y la técnica de cocinar
 * colapsa en «hacé el fuego más grande que puedas». Es una degeneración
 * matemática de las fórmulas del documento, no una opinión.
 *
 * El arreglo es de física, no de perilla: son DOS PROCESOS DISTINTOS y no
 * tienen por qué depender igual de la temperatura. Desnaturalizar una proteína
 * y evaporar agua tienen energías de activación distintas; la evaporación
 * escala más rápido con el calor. Basta con un exponente:
 *
 *     evap = 0.0006 · k^EXP_EVAPORACION      con EXP_EVAPORACION > 1
 *
 * Un solo número, aplicado a todas las sustancias por igual. Si con esto el
 * óptimo se diversifica, el modelo se sostiene. Si hubiera que ajustar por
 * sustancia, sería la tabla de recetas otra vez y el modelo estaría mal.
 */
const EXP_EVAPORACION = 2

/** Fracción de masa que queda después de cocinarse `ticks` a temperatura `T`. */
function masaQueQueda(T, s, ticks) {
  const k = (T - s.denaturesAt) / 100
  if (k <= 0 || !Number.isFinite(ticks)) return 1
  const evap = 0.0006 * Math.pow(k, EXP_EVAPORACION)
  return Math.exp(-evap * ticks)
}

// ─── LAS FUENTES ────────────────────────────────────────────────────────────
// La criatura puede hacer fuegos distintos: es otra perilla que tiene ella, no
// nosotros. `emitsPower` sale de la ley 3, del `fuelEnergy` que drena.
const FUEGOS = [
  { nombre: 'brasas',  potencia: 120 },
  { nombre: 'fogata',  potencia: 300 }, // la del documento
  { nombre: 'hoguera', potencia: 600 },
]

// ─── LAS SUSTANCIAS ─────────────────────────────────────────────────────────
// Doce orgánicos con ventanas distintas. `carne` y `madera` son las del
// documento; las otras diez son lo que el barrido tiene que cubrir.
const SUSTANCIAS = [
  { id: 'carne',     denaturesAt: 63, pyrolysisAt: 280, toughness: 0.30 },
  { id: 'pescado',   denaturesAt: 55, pyrolysisAt: 260, toughness: 0.18 },
  { id: 'molusco',   denaturesAt: 48, pyrolysisAt: 240, toughness: 0.55 },
  { id: 'huevo',     denaturesAt: 62, pyrolysisAt: 220, toughness: 0.05 },
  { id: 'tuberculo', denaturesAt: 75, pyrolysisAt: 300, toughness: 0.70 },
  { id: 'raiz-dura', denaturesAt: 88, pyrolysisAt: 310, toughness: 0.90 },
  { id: 'grano',     denaturesAt: 92, pyrolysisAt: 290, toughness: 0.80 },
  { id: 'hongo',     denaturesAt: 45, pyrolysisAt: 200, toughness: 0.20 },
  { id: 'hoja',      denaturesAt: 40, pyrolysisAt: 180, toughness: 0.08 },
  { id: 'savia',     denaturesAt: 70, pyrolysisAt: 190, toughness: 0.02 },
  { id: 'cuero',     denaturesAt: 58, pyrolysisAt: 250, toughness: 0.95 },
  { id: 'medula',    denaturesAt: 52, pyrolysisAt: 230, toughness: 0.25 },
]

const DISTANCIAS = [0, 1, 2, 3]
const TICKS_ACEPTABLES = 3000 // 100 s a 30 Hz. Más que eso, la ventana es teórica.
// Margen al punto de pirólisis por debajo del cual cocinar es apostar: una
// racha de viento, un leño que cae, y se quemó. No es una regla nueva del
// motor: es cómo el barrido juzga si un sitio es SENSATO, no si es legal.
const MARGEN_SENSATO = 30

// ─── EL BARRIDO ─────────────────────────────────────────────────────────────
const filas = []
for (const s of SUSTANCIAS) {
  const sitios = []
  for (const f of FUEGOS) {
    for (const m of MONTAJES) {
      for (const d of DISTANCIAS) {
        // `contacto` solo tiene sentido a distancia cero; el resto, a ≥1.
        if (m === 'contacto' && d !== 0) continue
        if (m !== 'contacto' && d === 0) continue
        const tEq = tEquilibrio(f.potencia, d, m)
        const cocina = tEq >= s.denaturesAt
        const quema = tEq >= s.pyrolysisAt
        const margen = s.pyrolysisAt - tEq
        const ticks = cocina && !quema ? ticksDeCoccion(tEq, s) : Infinity
        // `calories = nutrition × mass × digestibility`. La digestibilidad
        // llega a 0.85 en todos los sitios que sirven; lo que las diferencia es
        // cuánta masa sobrevive. Rendimiento = masa × digestibilidad.
        const rinde = masaQueQueda(tEq, s, ticks) * DIGESTIBILIDAD_META
        sitios.push({
          etiqueta: `${f.nombre}/${m}/d${d}`,
          tEq,
          margen,
          rinde,
          sirve: cocina && !quema && ticks <= TICKS_ACEPTABLES && margen >= MARGEN_SENSATO,
          quema,
          frio: !cocina,
          alFilo: cocina && !quema && margen < MARGEN_SENSATO,
          lento: cocina && !quema && ticks > TICKS_ACEPTABLES,
          ticks,
        })
      }
    }
  }
  const buenos = sitios.filter((x) => x.sirve)
  filas.push({ s, sitios, buenos })
}

// ─── INFORME ────────────────────────────────────────────────────────────────
const n = (x, k = 0) => (Number.isFinite(x) ? x.toFixed(k) : '∞')
console.log(`\nBarrido térmico — ${SUSTANCIAS.length} sustancias × ${FUEGOS.length} fuegos × ${MONTAJES.length} montajes × ${DISTANCIAS.length} distancias\n`)
console.log('formFactor(d, montaje) = exposicion / (1 + d²)   ·   exposicion: piso 0.06 · parrilla 0.25 · contacto 0.60')
console.log(`T_eq = ${T_AMBIENTE} + potencia × formFactor / ${H_PERDIDA}\n`)

console.log('| sustancia | ventana | dureza | sitios | el mejor RENDIMIENTO | T_eq | ticks | rinde | el mas RAPIDO | rinde |')
console.log('|---|---|---|---|---|---|---|---|---|---|')
const optimos = new Map()
for (const { s, buenos } of filas) {
  const mejor = buenos.slice().sort((a, b) => b.rinde - a.rinde)[0]
  const rapido = buenos.slice().sort((a, b) => a.ticks - b.ticks)[0]
  if (mejor) optimos.set(mejor.etiqueta, (optimos.get(mejor.etiqueta) ?? 0) + 1)
  console.log(`| ${s.id.padEnd(10)} | ${String(s.denaturesAt).padStart(3)}–${s.pyrolysisAt} | ${s.toughness.toFixed(2)} | ${String(buenos.length).padStart(2)} | ${(mejor?.etiqueta ?? '— NINGUNO —').padEnd(22)} | ${mejor ? n(mejor.tEq) + '°' : '—'} | ${mejor ? n(mejor.ticks) : '—'} | ${mejor ? mejor.rinde.toFixed(3) : '—'} | ${(rapido?.etiqueta ?? '—').padEnd(22)} | ${rapido ? rapido.rinde.toFixed(3) : '—'} |`)
}

const sinSitio = filas.filter((f) => f.buenos.length === 0)
const unicos = filas.filter((f) => f.buenos.length === 1)
const sinRiesgo = filas.filter((f) => !f.sitios.some((x) => x.quema) || !f.sitios.some((x) => x.frio))

console.log('\n── Dónde está el óptimo de cada una ───────────────────────────────')
for (const [sitio, cuantas] of [...optimos].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${sitio.padEnd(24)} es el mejor para ${cuantas} sustancia${cuantas > 1 ? 's' : ''}`)
}

console.log('\n── Veredicto ──────────────────────────────────────────────────────')
console.log(`  Con al menos un sitio sensato:            ${SUSTANCIAS.length - sinSitio.length} / ${SUSTANCIAS.length}`)
console.log(`  Imposibles de cocinar bien:              ${sinSitio.length}${sinSitio.length ? ' → ' + sinSitio.map((f) => f.s.id).join(', ') : ''}`)
console.log(`  Con un solo sitio (hay que encontrarlo): ${unicos.length}${unicos.length ? ' → ' + unicos.map((f) => f.s.id).join(', ') : ''}`)
console.log(`  Donde la elección no importa:            ${sinRiesgo.length}${sinRiesgo.length ? ' → ' + sinRiesgo.map((f) => f.s.id).join(', ') : ''}`)
console.log(`  Óptimos DISTINTOS entre las doce:        ${optimos.size}`)

// El test que decide si hay algo que aprender. Si un solo sitio fuera el mejor
// para las doce, la técnica de cocinar sería «hacé el fuego más grande que
// puedas y usá la parrilla», y no habría nada que descubrir ni que enseñar.
const hayQueAprender = optimos.size >= 3 && Math.max(...optimos.values()) <= SUSTANCIAS.length - 3

const ok = sinSitio.length === 0 && sinRiesgo.length === 0 && hayQueAprender
console.log(
  `\n${ok ? '✔' : '✘'} ${
    ok
      ? 'La ventana existe para las doce con la función y sin números por caso,\n  y el mejor sitio DEPENDE de la sustancia: hay técnica que aprender.'
      : !hayQueAprender
        ? 'La ventana existe, pero el óptimo es casi siempre el mismo sitio.\n  Cocinar no sería una técnica: sería una receta. El modelo necesita otra tensión.'
        : 'El modelo físico necesita cambiar ANTES del Hito 1.'
  }\n`,
)
process.exit(ok ? 0 : 1)
