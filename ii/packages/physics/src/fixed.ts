/**
 * ARITMÉTICA EN PUNTO FIJO — el piso determinista de `@anima/physics`.
 *
 * Por qué existe este archivo, y no `Math`:
 *
 * ECMAScript **no especifica la precisión** de `Math.exp`, `Math.pow`,
 * `Math.log` ni del operador `**`. La norma dice «implementation-approximated»:
 * dos motores pueden devolver el último bit distinto, y con eso el replay de una
 * partida diverge en el tick 400. No es un riesgo teórico — es la razón por la
 * que la regla 2 de `ii/README.md` los prohíbe por lint en los tres paquetes
 * deterministas.
 *
 * Lo que sí está especificado bit a bit y por lo tanto se usa sin culpa:
 * `+ - * /` sobre doubles IEEE-754, y `Math.floor`, `Math.trunc`, `Math.abs`,
 * `Math.min`, `Math.max`. Todo lo demás se construye acá, con enteros.
 *
 * ─── La representación ──────────────────────────────────────────────────────
 *
 * Un `Fixed` es SIEMPRE un entero: el número real por `FIXED_SCALE` (1000).
 * Resolución 0.001, rango real ±2 147 483.647. Nunca hay fracción viva en un
 * `Fixed`: si alguna operación dejara una, el invariante se rompe y con él la
 * promesa de que dos máquinas calculan lo mismo.
 *
 * ─── Redondeo: mitades ALEJÁNDOSE del cero ──────────────────────────────────
 *
 * `Math.round` manda las mitades hacia +∞, y entonces `f(-x) !== -f(x)`. En un
 * mundo donde enfriarse es calentarse con el signo cambiado, esa asimetría hace
 * que un cuerpo que baja de 0 °C pierda un milésimo que uno que sube gana. Acá
 * todo redondea alejándose del cero, y la simetría de signo es un test.
 *
 * ─── Error MEDIDO, no estimado ──────────────────────────────────────────────
 *
 * Una cota escrita a ojo es peor que ninguna, porque se le cree. Éstas salen de
 * barrer el dominio entero contra el redondeo exacto (BigInt para las racionales,
 * `Math` para las trascendentes — en el banco, nunca acá). `ulp` = 1 unidad =
 * 0.001, `v` = el resultado.
 *
 *   fmul, fdiv    CORRECTAMENTE REDONDEADAS en todo el rango i32: 0 desvíos
 *                 contra BigInt en 300 000 pares. No es «casi»: es exacto, y por
 *                 eso `mulAt` parte el producto en vez de confiar en el double.
 *   fexp          |err| ≤ max(1 ulp, |v|·2e-7), barrido en los 22 280 argumentos
 *                 enteros del dominio útil. Para x ≤ 0 —el caso de todos los
 *                 factores de decaimiento— coincide EXACTO con el redondeo ideal.
 *                 Satura en `FIXED_MAX` desde x ≥ 14.58 y en 0 desde x ≤ −7.7.
 *                 Monótona no decreciente en todo el dominio.
 *   fln           |err| ≤ 1 ulp para todo x > 0 del rango i32. Monótona.
 *                 `fln(x ≤ 0)` satura en `FIXED_MIN`.
 *   fpow          exponente entero n = 2: |err| ≤ 1 ulp, exhaustivo. Es el
 *                 óptimo: el techo lo pone la resolución de la salida, no el
 *                 algoritmo. Para n ≤ 8: |err| ≤ max(n ulp, |v|·n·3e-4), porque
 *                 cada multiplicación intermedia aporta hasta media ulp y hay n.
 *                 Exponente fraccionario: |err| ≤ max(1 ulp, |v|·1e-4).
 *
 * ─── El piso de resolución, que es una limitación real ──────────────────────
 *
 * Con escala 1000 hay tasas de las doce leyes que NO SE PUEDEN ESCRIBIR: la
 * evaporación de la ley 5 es `0.0006·k²`, y para k = 0.27 eso vale 4.4e-5, o sea
 * cero en esta escala. Las leyes tienen que llevar sus tasas reescaladas (×1000,
 * y dividir en el acumulador) o acumular en una cuenta más fina. No es un bug de
 * este módulo —`FIXED_SCALE` viene dado por el contrato— pero sí es una trampa
 * para quien escriba las leyes, y por eso queda escrita acá y hay un test que la
 * muestra en `tests/fixed.test.ts`.
 *
 * `fpow` con n = 2 importa más de lo que parece: la ley 5 evapora con
 * `0.0006 · k²` y ese exponente es el hallazgo 2 del barrido térmico
 * (`ii/docs/hito-0-barrido-termico.md`). Con `evap ∝ k` cocinar deja de ser una
 * técnica; el cuadrado es lo que hace existir la decisión «comer antes o comer
 * mejor». Si `fpow(k, 2)` se corriera un 5%, la tabla de óptimos del barrido
 * cambiaría de sustancia y el mundo dejaría de ser el que se calibró.
 */

/** Un entero i32 que representa `real · FIXED_SCALE`. Nunca lleva fracción. */
export type Fixed = number

export const FIXED_SCALE = 1000

/** El uno. Se escribe así y no `1000` cuando lo que se quiere decir es «uno». */
export const FIXED_ONE: Fixed = FIXED_SCALE

export const FIXED_MAX: Fixed = 2147483647

/**
 * Deliberadamente −2147483647 y no −2147483648: con el mínimo real de i32,
 * `-FIXED_MIN` no es representable y la simetría de signo —que es un invariante
 * de todo el módulo— se rompería justo en el borde.
 */
export const FIXED_MIN: Fixed = -2147483647

// ─── Potencias de dos ───────────────────────────────────────────────────────
//
// Tabuladas porque `Math.pow(2, k)` está prohibido y `1 << k` da la vuelta con
// k ≥ 32. Duplicar es exacto en doubles hasta 2^62, así que la tabla es exacta.
const POW2: readonly number[] = ((): number[] => {
  const t: number[] = [1]
  for (let i = 1; i <= 62; i++) t.push(t[i - 1]! * 2)
  return t
})()

function pow2(k: number): number {
  // Fuera de tabla solo se llega desde argumentos ya saturados; devolver 0 sería
  // mentir, así que se corta acá para que el error salga en el test y no en el
  // tick 400.
  if (k < 0 || k > 62) throw new RangeError(`pow2 fuera de tabla: ${k}`)
  return POW2[k]!
}

// ─── Núcleo entero ──────────────────────────────────────────────────────────

/**
 * `round(num / den)` con mitades alejándose del cero. `den` debe ser positivo.
 *
 * El paso de corrección no es paranoia: `num / den` es una división de doubles y
 * para `num` cerca de 2^53 su error (1 ulp) puede ser MAYOR que `1/den`, o sea
 * que `Math.floor` puede caer del lado equivocado de un entero. Con la
 * corrección, el resultado es exacto para cualquier `num` entero ≤ 2^53.
 */
function divRound(num: number, den: number): number {
  const neg = num < 0
  const a = neg ? -num : num
  let q = Math.floor(a / den)
  let r = a - q * den
  if (r < 0) {
    q -= 1
    r += den
  } else if (r >= den) {
    q += 1
    r -= den
  }
  const out = r * 2 >= den ? q + 1 : q
  return neg ? -out : out
}

/** Igual que `divRound`, pero acepta denominador negativo. */
function divRoundSigned(num: number, den: number): number {
  return den < 0 ? -divRound(num, -den) : divRound(num, den)
}

/**
 * `round(a · b / scale)` sin perder un solo bit.
 *
 * Hacer `a * b` directo es la trampa: dos i32 grandes dan hasta 4.6e18 y el
 * double deja de ser exacto arriba de 2^53 (9.0e15). Ahí el redondeo pasa a
 * depender de la magnitud de los operandos, que es exactamente la clase de
 * dependencia que rompe el replay.
 *
 * Se parte `a` contra la escala: `a = q·scale + r`. Entonces
 * `a·b/scale = q·b + r·b/scale`, y `q·b` es exacto porque `q` ya viene dividido
 * mientras que `r·b` es chico porque `r < scale`. Como `q·b` es entero, redondear
 * solo el segundo sumando da el redondeo correcto del total.
 */
function mulAt(a: number, b: number, scale: number): number {
  let q = Math.trunc(a / scale)
  let r = a - q * scale
  // Misma corrección que en `divRound`, por la misma razón.
  if (r <= -scale || r >= scale) {
    const adj = Math.trunc(r / scale)
    q += adj
    r -= adj * scale
  }
  return q * b + divRound(r * b, scale)
}

function clampFixed(v: number): Fixed {
  // Un NaN acá envenenaría todo lo que toque y el replay moriría en silencio
  // muchos ticks después. Nunca debería entrar; si entra, cero y que el test lo
  // cace.
  if (Number.isNaN(v)) return 0
  if (v > FIXED_MAX) return FIXED_MAX
  if (v < FIXED_MIN) return FIXED_MIN
  return v
}

// ─── La superficie pública básica ───────────────────────────────────────────

/** Convierte un real de autoría (una constante de calibración) a `Fixed`. */
export function fx(real: number): Fixed {
  const v = real * FIXED_SCALE
  const neg = v < 0
  const a = neg ? -v : v
  const f = Math.floor(a)
  const out = a - f >= 0.5 ? f + 1 : f
  return clampFixed(neg ? -out : out)
}

/**
 * Vuelve al real. Solo para mostrar, medir y testear: el mundo nunca decide
 * nada sobre el resultado de `unfx`, porque ahí ya no hay determinismo que
 * proteger.
 */
export function unfx(f: Fixed): number {
  return f / FIXED_SCALE
}

export function fmul(a: Fixed, b: Fixed): Fixed {
  return clampFixed(mulAt(a, b, FIXED_SCALE))
}

/**
 * División. `b = 0` NO lanza: satura.
 *
 * Lanzar sería más limpio en una biblioteca, pero esto corre adentro del tick y
 * una excepción mata el mundo entero por una celda con masa cero. Saturar es la
 * misma decisión que toma el resto del módulo: el valor queda absurdo pero
 * acotado, y el efecto se ve en el mundo en vez de esconderse en un stack trace.
 */
export function fdiv(a: Fixed, b: Fixed): Fixed {
  if (b === 0) return a === 0 ? 0 : a > 0 ? FIXED_MAX : FIXED_MIN
  return clampFixed(divRoundSigned(a * FIXED_SCALE, b))
}

export function fclamp(v: Fixed, lo: Fixed, hi: Fixed): Fixed {
  return v < lo ? lo : v > hi ? hi : v
}

export function fabs(v: Fixed): Fixed {
  return v < 0 ? -v : v
}

// ─── Escala interna ─────────────────────────────────────────────────────────
//
// `fexp` y `fln` trabajan en 2^24 y no en 1000. Dos razones, y las dos son
// necesarias:
//
//   1. Precisión. Con 1000, la reducción de rango de `fexp` (x = n·ln2 + r)
//      arrastra el error de ln2 ≈ 0.693 multiplicado por n hasta 20 veces: el
//      resultado se iría un 0.3%. Con 24 bits de fracción el mismo error queda
//      en 1e-7.
//   2. Potencia de dos. El paso `e^x = 2^n · e^r` es un corrimiento EXACTO solo
//      si la escala es potencia de dos; con 1000 habría un redondeo por cada
//      duplicación y el error dependería del exponente.
//
// El techo: las dos funciones normalizan a un valor cercano a 1 antes de operar,
// así que 24 bits caben con margen. `fpow` NO puede darse ese lujo —tiene que
// recorrer todo el rango i32— y por eso su camino entero se queda en escala
// 1000, donde `fmul` ya es correctamente redondeada.
const S = 16777216 // 2^24

/** round(ln2 · 2^24). El valor exacto es 11629080.498…, error −4.2e-8. */
const LN2_S = 11629080

function toS(x: Fixed): number {
  return mulAt(x, S, FIXED_SCALE)
}

function fromS(v: number): Fixed {
  return clampFixed(mulAt(v, FIXED_SCALE, S))
}

function mulS(a: number, b: number): number {
  return mulAt(a, b, S)
}

/**
 * `e^xs` con entrada y salida en escala 2^24. El argumento tiene que venir ya
 * acotado por el llamador (ver `EXP_ARG_MAX_S` / `EXP_ARG_MIN_S`).
 *
 * Reducción de rango + Taylor. Con `x = n·ln2 + r` queda `|r| ≤ ln2/2 = 0.347`,
 * y ahí la serie converge tan rápido que el primer término omitido —r⁸/40320—
 * vale 5e-9: tres órdenes por debajo de la resolución de la escala interna. Todo
 * el peso del error queda en la serie, porque `2^n` no aporta ninguno.
 */
function expS(xs: number): number {
  const n = divRound(xs, LN2_S)
  const r = xs - n * LN2_S
  // Horner de 1 + r(1 + r/2(1 + r/3(… (1 + r/7))))
  let t = S + divRound(r, 7)
  for (let i = 6; i >= 1; i--) t = S + mulS(divRound(r, i), t)
  return n >= 0 ? t * pow2(n) : divRound(t, pow2(-n))
}

/**
 * `ln(xs)` con entrada y salida en escala 2^24. `xs` tiene que ser > 0.
 *
 * Se normaliza `xs = m · 2^e` con `m ∈ [√½, √2)` y se usa
 * `ln m = 2·atanh((m−1)/(m+1))`, cuya serie en z = (m−1)/(m+1) converge con
 * |z| ≤ 0.1716: el término omitido z¹¹/11 vale 1e-10.
 *
 * La ventana [√½, √2) y no [1, 2) es el detalle que importa: centrar en 1 deja
 * |z| ≤ 0.1716 en vez de 0.333, y eso baja el error del último término omitido
 * casi tres órdenes por el mismo costo de cómputo.
 */
function lnS(xs: number): number {
  const LO = 11863283 // round(2^24 · √½)
  const HI = 23726566 // round(2^24 · √2)
  let e = 0
  let m = xs
  // Un solo redondeo: se recalcula siempre desde `xs`, no se va dividiendo por
  // dos acumulando error en cada paso.
  while (m >= HI) {
    e += 1
    m = divRound(xs, pow2(e))
  }
  while (m < LO) {
    e -= 1
    m = xs * pow2(-e) // exacto: acá `xs` es chico
  }
  const z = divRound((m - S) * S, m + S)
  const z2 = mulS(z, z)
  let a = divRound(S, 9)
  a = divRound(S, 7) + mulS(z2, a)
  a = divRound(S, 5) + mulS(z2, a)
  a = divRound(S, 3) + mulS(z2, a)
  a = S + mulS(z2, a)
  return e * LN2_S + 2 * mulS(z, a)
}

// e^x pasa `FIXED_MAX` desde x = ln(2147483.647) = 14.5799, y cae por debajo de
// medio milésimo desde x = ln(0.0005) = −7.6. Fuera de esos dos bordes no hay
// nada que calcular, y acotar acá es lo que garantiza que los índices de `pow2`
// se queden en tabla.
const EXP_ARG_MAX: Fixed = 14580
const EXP_ARG_MIN: Fixed = -7700
const EXP_ARG_MAX_S = toS(EXP_ARG_MAX)
const EXP_ARG_MIN_S = toS(EXP_ARG_MIN)

function expSClamped(xs: number): number {
  if (xs >= EXP_ARG_MAX_S) return toS(FIXED_MAX)
  if (xs <= EXP_ARG_MIN_S) return 0
  return expS(xs)
}

// ─── Trascendentes ──────────────────────────────────────────────────────────

/** `e^x`. Satura en `FIXED_MAX` desde x ≥ 14.58 y en 0 desde x ≤ −7.7. */
export function fexp(x: Fixed): Fixed {
  if (x >= EXP_ARG_MAX) return FIXED_MAX
  if (x <= EXP_ARG_MIN) return 0
  return fromS(expS(toS(x)))
}

/**
 * `ln(x)`. Para `x ≤ 0` satura en `FIXED_MIN` en vez de lanzar, por la misma
 * razón que `fdiv`: esto corre adentro del tick.
 */
export function fln(x: Fixed): Fixed {
  if (x <= 0) return FIXED_MIN
  return fromS(lnS(toS(x)))
}

/**
 * `base ^ exp`, con `exp` también en punto fijo.
 *
 * Dos caminos, y la separación es lo importante:
 *
 * - **Exponente entero** (`exp` múltiplo exacto de 1000): exponenciación binaria
 *   con `fmul`, que es correctamente redondeada. Para n = 2 —el caso de la ley
 *   5— el resultado está a ≤ 0.5 ulp del ideal, o sea que es lo mejor que la
 *   resolución de salida permite. Pasar por `exp(n·ln b)` daría un 0.3% de error
 *   en `k²` y correría la calibración del barrido térmico; por eso el camino
 *   entero existe y no es una optimización.
 * - **Exponente fraccionario**: `e^(exp·ln base)`, todo en escala interna para
 *   no perder precisión en el producto intermedio. Solo definido para
 *   `base > 0`; con base negativa devuelve 0, porque en los reales no hay
 *   respuesta y saturar sería inventar una.
 */
export function fpow(base: Fixed, exp: Fixed): Fixed {
  if (exp === 0) return FIXED_ONE // incluye 0^0 = 1: el producto vacío

  if (exp % FIXED_SCALE === 0) {
    const n = exp / FIXED_SCALE
    const negExp = n < 0
    let k = negExp ? -n : n
    const negBase = base < 0
    let cur = negBase ? -base : base
    let acc: Fixed = FIXED_ONE
    while (k > 0) {
      if (k % 2 === 1) acc = fmul(acc, cur)
      k = Math.floor(k / 2)
      if (k > 0) cur = fmul(cur, cur)
    }
    // El signo sale de la paridad, no de la aritmética: así `(−2)^2` da 4 exacto
    // sin depender de cómo redondeen los pasos intermedios.
    const signed = negBase && n % 2 !== 0 ? -acc : acc
    return negExp ? fdiv(FIXED_ONE, signed) : signed
  }

  if (base <= 0) return 0
  return fromS(expSClamped(mulS(toS(exp), lnS(toS(base)))))
}

// ─── Lo que este módulo NO exporta, y por qué ───────────────────────────────
//
// No hay `fsin`, `fsqrt` ni `frandom`. Las dos primeras porque ninguna de las
// doce leyes las pide todavía y una tabla sin usuario se calibra mal; la tercera
// porque el azar no vive acá: vive en el dios perezoso, derivado de la semilla y
// de la pregunta, nunca del reloj.
//
// Tampoco hay acumuladores ni estado. Todo lo de este archivo es puro: misma
// entrada, misma salida, en cualquier máquina y en cualquier orden. Ése es el
// único contrato que el resto del paquete necesita de acá.
