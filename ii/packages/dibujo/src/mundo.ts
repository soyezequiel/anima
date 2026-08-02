// ─── EL FONDO: sobre qué se dibuja un glifo ─────────────────────────────────
//
// Un glifo no se mira en el aire: se mira sobre una celda del mapa. Y una
// paleta que se eligió sobre fondo neutro puede desaparecer sobre el suelo
// mojado o de noche — que es justo cuando el jugador más necesita encontrar el
// pedernal.
//
// Este archivo tiene las dos mitades de eso: **de qué color es una celda**, y
// **cuánto contrasta un color contra ella**, para que el contraste se pueda
// medir en un test en vez de mirarse de reojo.
//
// ─── LOS TRES SUELOS SALEN DE LO QUE LA ESCENA PUBLICA ──────────────────────
//
// `CeldaEnEscena` trae `wet`, `oxygen`, `temperature` y `sheltered`. De esos, el
// dibujo usa dos y el criterio de cada uno es el de una ley:
//
//   mojado      `wet >= 0.45`, que es `HUMEDAD_QUE_APAGA` de la ley 3 — o sea
//               que el suelo se ve mojado exactamente donde apaga un fuego;
//   bajo techo  `sheltered > 0`, la oclusión de la ley 12 (ADR II-0002).
//
// `oxygen` y `temperature` NO pintan el suelo, y conviene decir por qué: una
// celda caliente no se ve distinta, se ve el FUEGO que la calienta, y ese fuego
// es un cuerpo con su propio glifo. Pintar las dos cosas sería contar dos veces.
//
// ─── LA NOCHE ES UNA MEZCLA, Y LA MEZCLA ES ENTERA ──────────────────────────
//
// Sin `Math.pow` no hay corrección de gamma, así que la mezcla es lineal en
// sRGB. No es lo «correcto» en teoría de color y es lo correcto acá: la regla 2
// prohíbe la trascendente porque dos motores devuelven el último bit distinto, y
// un fondo que no coincide entre clientes rompe la comparación del E2E. Una
// mezcla lineal se ve apenas más apagada y es idéntica en todas las máquinas.

import type { Clock } from '@anima/world'

/** Lo que el dibujo necesita de una celda. Es un subconjunto de `CeldaEnEscena`. */
export interface CeldaVisible {
  readonly wet: number
  readonly sheltered: number
}

export type Suelo = 'seco' | 'mojado' | 'bajo-techo'

/** El mismo corte que la ley 3 usa para decidir si algo prende. */
const HUMEDAD_QUE_APAGA = 0.45

export function sueloDe(c: CeldaVisible): Suelo {
  // Bajo techo manda sobre mojado: si hay algo encima, lo que se ve es la
  // sombra. Y es el orden útil — guarecerse es la decisión que el jugador toma
  // mirando el mapa.
  if (c.sheltered > 0) return 'bajo-techo'
  return c.wet >= HUMEDAD_QUE_APAGA ? 'mojado' : 'seco'
}

/**
 * LOS TRES SUELOS, de día.
 *
 * Son oscuros y poco saturados a propósito: el fondo tiene que ser el lugar
 * donde las nueve familias se distinguen, no una décima familia compitiendo con
 * ellas. Todos están abajo de 60 de luma, y las familias arrancan en 74.
 */
export const SUELOS: Record<Suelo, string> = {
  seco: '#2c3126',
  mojado: '#1e3138',
  'bajo-techo': '#241f1c',
}

/** El azul al que tiende todo de noche, y cuánto se mezcla. */
const NOCHE = '#0a1533'
const CUANTO_DE_NOCHE = 150

function canal(hex: string, i: number): number {
  const n = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return Number.isNaN(n) ? 0 : n
}

function aHex(r: number, g: number, b: number): string {
  const dos = (v: number) => (v < 16 ? '0' : '') + v.toString(16)
  return `#${dos(r)}${dos(g)}${dos(b)}`
}

/**
 * MEZCLA ENTERA de dos colores. `k` es cuánto del segundo, de 0 a 255.
 *
 * `Math.trunc` está permitido y es todo lo que hace falta: la división entera no
 * depende de la precisión de ninguna función trascendente.
 */
export function mezclar(a: string, b: string, k: number): string {
  const c = (i: number) => Math.trunc((canal(a, i) * (255 - k) + canal(b, i) * k) / 255)
  return aHex(c(0), c(1), c(2))
}

/**
 * DE QUÉ COLOR ES ESTA CELDA, ahora.
 *
 * El reloj entra como el `Clock` que el mundo ya publica, con su `phase`. No hay
 * una luz continua y es correcto: el mundo tiene día y noche y nada en el medio
 * (`world/src/reloj.ts`), así que inventar un crepúsculo acá sería que la
 * pantalla afirme algo que la física no modela — la regla 3 del ADR II-0017.
 */
export function fondoDe(c: CeldaVisible, reloj: Pick<Clock, 'phase'>): string {
  const dia = SUELOS[sueloDe(c)]
  const conHumedad = mezclar(dia, MOJADO_DEL_TODO, gradoDeHumedad(c))
  return reloj.phase === 'dia' ? conHumedad : mezclar(conHumedad, NOCHE, CUANTO_DE_NOCHE)
}

// ─── EL SUELO NO ES UN COLOR PLANO, Y ES EL 96% DE LA PANTALLA ──────────────
//
// El primer mapa de una partida real lo dejó a la vista: **10 cuerpos en 225
// celdas**. La hipótesis con la que se fue a mirar era la opuesta —que veinte
// objetos juntos se leyeran como una sopa— y lo que hay es muchísimo más suelo
// que cosas. Con tres colores planos, el mapa se veía como una hoja de cálculo.
//
// Las dos cosas que este bloque agrega NO inventan nada: las dos salen de
// `wet`, que la escena publica y que hasta ahora se usaba sólo para elegir entre
// tres colores fijos.
//
//   1. **el grado de humedad matiza dentro de la familia.** El umbral 0,45
//      sigue decidiendo QUÉ suelo es —es semántico, es donde la ley 3 apaga un
//      fuego— y el valor continuo decide cuánto tira al azul adentro de ese
//      suelo. Una celda a 0,50 y una a 0,95 son las dos «mojado» y no son lo
//      mismo para nadie que quiera encender algo;
//   2. **el granulado** rompe el plano liso. Es determinista por posición
//      absoluta, así que la misma celda se ve igual siempre y dos clientes
//      coinciden. Sin RNG: la posición ES la semilla.

/** A dónde tiende una celda empapada, dentro de su familia. */
const MOJADO_DEL_TODO = '#14384a'

/** De 0 a 255, cuánto de `MOJADO_DEL_TODO` le toca a esta celda. */
function gradoDeHumedad(c: CeldaVisible): number {
  const w = c.wet < 0 ? 0 : c.wet > 1 ? 1 : c.wet
  return Math.trunc(w * 120)
}

/**
 * LOS TRES TONOS DE UNA CELDA: el suyo, uno más claro y uno más oscuro.
 *
 * El mapa reparte los tres con un granulado determinista. La diferencia es
 * chica a propósito —el suelo tiene que ser el lugar donde las nueve familias se
 * distinguen, no una décima compitiendo con ellas— y alcanza para que se lea
 * como terreno y no como un rectángulo pintado.
 */
export function tonosDelSuelo(c: CeldaVisible, reloj: Pick<Clock, 'phase'>): [string, string, string] {
  const base = fondoDe(c, reloj)
  return [base, mezclar(base, '#ffffff', 12), mezclar(base, '#000000', 26)]
}

/**
 * CUÁL DE LOS TRES TONOS VA EN ESTE PÍXEL. Función pura de la posición ABSOLUTA
 * en el mundo, no de la posición en pantalla: así el granulado no «viaja» cuando
 * la cámara se mueve, que es lo que delata un patrón falso.
 */
export function granoDelSuelo(mundoX: number, mundoY: number, dx: number, dy: number): 0 | 1 | 2 {
  const n = (((mundoX * 73 + dx) * 31 + (mundoY * 91 + dy) * 17) % 23 + 23) % 23
  return n === 0 || n === 7 ? 1 : n === 3 || n === 14 || n === 19 ? 2 : 0
}

/**
 * LA LUMA DE UN COLOR, en enteros: `(299R + 587G + 114B) / 1000`.
 *
 * Son los pesos de siempre, con la división entera al final. Sin `sqrt` ni
 * potencias: es una suma ponderada y nada más.
 */
export function luma(hex: string): number {
  return Math.trunc((canal(hex, 0) * 299 + canal(hex, 1) * 587 + canal(hex, 2) * 114) / 1000)
}

/** Cuánto se despega un color de otro. Es una diferencia de luma, no una distancia. */
export function contraste(a: string, b: string): number {
  const d = luma(a) - luma(b)
  return d < 0 ? -d : d
}

/**
 * EL PISO DE CONTRASTE. Es una LÍNEA BASE MEDIDA, no una aspiración.
 *
 * No sale de una norma de accesibilidad —esas se escriben para texto sobre fondo
 * y usan una razón, no una diferencia— sino de la medición de este árbol: el
 * peor de los cincuenta y cuatro pares que recorre `tests/el-fondo.test.ts` es
 * **`tizon` contra el suelo seco de día, y vale 54**.
 *
 * ─── POR QUÉ 50 Y NO 20, QUE FUE EL PRIMER NÚMERO ───────────────────────────
 *
 * Porque un piso de 20 con un peor caso de 54 **no es un guardián**: deja que
 * el contraste empeore 2,7× antes de decir nada, y el día que alguien retoque
 * una paleta y el pedernal se pierda de noche, esto va a estar en verde.
 *
 * Es el mismo mecanismo que `skills/tests/linea-base.json` desde el Hito 4, con
 * su regla escrita adentro del propio archivo: **para bajar este número hay que
 * editarlo a mano y decir por qué**. Cuatro puntos de aire abajo del peor
 * medido, que es lo que absorbe un redondeo y nada más.
 */
export const CONTRASTE_MINIMO = 50
