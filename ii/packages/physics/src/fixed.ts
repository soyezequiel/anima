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
 * ─── DOS ESCALAS, y el compilador de por medio (ADR II-0006) ────────────────
 *
 * Una sola escala no puede servir a las dos cosas que el mundo necesita, y con
 * i32 no hay margen para las dos a la vez:
 *
 *   | escala | máximo representable | resolución |
 *   |--------|---------------------|------------|
 *   | 1e3    | 2 147 483.647       | 10⁻³       |
 *   | 1e6    | 2 147.483647        | 10⁻⁶       |
 *
 * Las MAGNITUDES —temperatura, masa, nutrición— necesitan RANGO: la fricción
 * empuja hacia 400 °C, una hoguera pasa los 600, y cualquier producto
 * intermedio de dos temperaturas satura a 1e6. Van en escala 1000.
 *
 * Las TASAS por segundo necesitan RESOLUCIÓN: la evaporación de la ley 5 es
 * `0.012·k²` por segundo, o sea `0.0006·k²` por paso a 20 Hz, y para k = 0.27
 * —el pescado sobre la parrilla— eso vale 4.4 × 10⁻⁵. En escala 1000 redondea a
 * CERO, o sea que el pescado no pierde agua nunca y cocinar deja de ser una
 * técnica. Van en escala 1 000 000.
 *
 * `Fixed` y `Rate` son **tipos nominales distintos**, así que sumar una tasa a
 * una magnitud NO COMPILA. Ésa es la mitad del valor de la decisión: el error
 * que esto previene no es de precisión, es de confundir una cosa con la otra, y
 * ese error es silencioso. Hay un test con `@ts-expect-error` que lo prueba, y
 * lo verifica `tsc`, no `vitest`.
 *
 * Y el techo de ±2147 POR SEGUNDO no aprieta a nadie: la más rápida de las doce
 * leyes empuja la temperatura 120 grados por segundo. Una tasa de 2147 por
 * segundo llevaría cualquier cualidad de punta a punta de su rango en menos de
 * un segundo, que es precisamente lo que el mundo no debería poder hacer.
 *
 * La conversión vive en UN SOLO LUGAR y es explícita: `aplicar()`.
 *
 * ─── La representación ──────────────────────────────────────────────────────
 *
 * Un `Fixed` es SIEMPRE un entero: el número real por `FIXED_SCALE`. Un `Rate`
 * también: el real por `RATE_SCALE`. Nunca hay fracción viva en ninguno de los
 * dos: si alguna operación dejara una, el invariante se rompe y con él la
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
 *   rscale        correctamente redondeada: usa el mismo `mulAt` que `fmul`.
 *   aplicar       un solo redondeo para los `pasos` enteros. Ver su comentario:
 *                 aplicar N veces por 1 paso NO es aplicar una vez por N, y eso
 *                 es una consecuencia de la decisión, no un descuido.
 *   porPaso       correctamente redondeada: divide por la frecuencia (un entero
 *                 exacto) en vez de multiplicar por `dt` (que no lo es). Ver su
 *                 comentario: `0.2 × 0.05` da un ulp de más y `0.2 ÷ 20` no.
 *
 * `fpow` con n = 2 importa más de lo que parece: la ley 5 evapora con
 * `0.012 · k²` por segundo y ese exponente es el hallazgo 2 del barrido térmico
 * (`ii/docs/hito-0-barrido-termico.md`). Con `evap ∝ k` cocinar deja de ser una
 * técnica; el cuadrado es lo que hace existir la decisión «comer antes o comer
 * mejor». Si `fpow(k, 2)` se corriera un 5%, la tabla de óptimos del barrido
 * cambiaría de sustancia y el mundo dejaría de ser el que se calibró.
 */

/**
 * Una MAGNITUD: temperatura, masa, nutrición. Necesita RANGO.
 *
 * Es un entero i32 que representa `real · FIXED_SCALE`. Nunca lleva fracción.
 * La marca `__fixed` no existe en tiempo de ejecución —un `Fixed` ES un número—:
 * está para que el compilador pueda distinguirlo de un `Rate`.
 */
export type Fixed = number & { readonly __fixed: unique symbol }

/**
 * Una TASA POR SEGUNDO de mundo: cuánto cambia una magnitud en un segundo.
 * Necesita RESOLUCIÓN.
 *
 * **No sabe que existe el tick** (ADR II-0008). Antes esto era «por tick», y
 * mientras lo fuera la frecuencia del tick gobernaba a la vez el rendimiento y
 * el ritmo del juego: bajar de 30 a 20 Hz hacía que cocinar el cuero pasara de
 * 40 a 60 segundos de reloj. Ahora la frecuencia decide con qué FINURA se
 * muestrea, y el ritmo lo deciden estas tasas y nada más.
 *
 * Entero i32 que representa `real · RATE_SCALE`. Techo ±2147.483647 por segundo.
 */
export type Rate = number & { readonly __rate: unique symbol }

/**
 * Una DURACIÓN en segundos de mundo (ADR II-0008).
 *
 * Es lo que declara `completion.at`: cuánto tiempo hay que sostener un proceso
 * para que rinda. En segundos y no en ticks, porque «cuarenta ticks» quiere
 * decir dos segundos a 20 Hz y cuatro a 10 Hz, y entonces el tiempo de atar
 * dependía de la máquina en la que corriera el juego.
 *
 * No lleva escala: es un real. Las duraciones son de orden 1 a 100 segundos y no
 * entran en ninguna cuenta que necesite el punto fijo; lo que sí lo necesita es
 * el `Dt`, y por eso ése tiene su propia regla de admisión.
 */
export type Duracion = number & { readonly __duracion: unique symbol }

/**
 * El PASO DE TIEMPO de un tick, en segundos. Lo fija el mundo, no la física.
 *
 * `dt = 1/Hz`. Se multiplica en cada aplicación de cada ley, así que si no es
 * exactamente representable el error se acumula tick a tick y el replay diverge:
 * ver `FRECUENCIAS_ADMISIBLES`.
 */
export type Dt = number & { readonly __dt: unique symbol }


/** Hasta ±2 147 483.647, resolución 10⁻³. */
export const FIXED_SCALE = 1000

/** Hasta ±2147.483647, resolución 10⁻⁶. */
export const RATE_SCALE = 1_000_000

/**
 * Cuántas unidades de `Rate` entran en una de `Fixed`. La única constante que
 * relaciona las dos escalas, y por eso vive acá arriba con nombre: si aparece un
 * `1000` suelto en una conversión, es este número y hay que decirlo.
 */
export const RATE_PER_FIXED = RATE_SCALE / FIXED_SCALE

/** El uno. Se escribe así y no `1000` cuando lo que se quiere decir es «uno». */
export const FIXED_ONE: Fixed = FIXED_SCALE as Fixed

export const FIXED_MAX: Fixed = 2147483647 as Fixed

/**
 * Deliberadamente −2147483647 y no −2147483648: con el mínimo real de i32,
 * `-FIXED_MIN` no es representable y la simetría de signo —que es un invariante
 * de todo el módulo— se rompería justo en el borde.
 */
export const FIXED_MIN: Fixed = -2147483647 as Fixed

/** «Una unidad por segundo». Una tasa así vacía cualquier cualidad de 0 a 1 en un segundo. */
export const RATE_ONE: Rate = RATE_SCALE as Rate

export const RATE_MAX: Rate = 2147483647 as Rate

/** Mismo argumento de simetría que `FIXED_MIN`. */
export const RATE_MIN: Rate = -2147483647 as Rate

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
//
// Todo lo de esta sección trabaja sobre `number` PELADO y no sobre `Fixed` ni
// `Rate`: acá adentro no hay magnitudes ni tasas, hay enteros escalados. Las
// marcas se ponen en la superficie pública, que es donde sirven.

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

/**
 * El rango es el MISMO para las dos escalas —las dos son i32— y por eso hay un
 * solo saturador. Lo que cambia entre `Fixed` y `Rate` es qué real representa
 * ese entero, no cuántos enteros hay.
 */
function clampRaw(v: number): number {
  // Un NaN acá envenenaría todo lo que toque y el replay moriría en silencio
  // muchos ticks después. Nunca debería entrar; si entra, cero y que el test lo
  // cace.
  if (Number.isNaN(v)) return 0
  if (v > 2147483647) return 2147483647
  if (v < -2147483647) return -2147483647
  return v
}

function clampFixed(v: number): Fixed {
  return clampRaw(v) as Fixed
}

function clampRate(v: number): Rate {
  return clampRaw(v) as Rate
}

/** `round(real · scale)` con mitades alejándose del cero. La conversión de autoría. */
function scaleReal(real: number, scale: number): number {
  const v = real * scale
  const neg = v < 0
  const a = neg ? -v : v
  const f = Math.floor(a)
  const out = a - f >= 0.5 ? f + 1 : f
  return neg ? -out : out
}

// ─── Magnitudes: la superficie pública ──────────────────────────────────────

/** Convierte un real de autoría (una constante de calibración) a `Fixed`. */
export function fx(real: number): Fixed {
  return clampFixed(scaleReal(real, FIXED_SCALE))
}

/**
 * Vuelve al real. Solo para mostrar, medir y testear: el mundo nunca decide
 * nada sobre el resultado de `unfx`, porque ahí ya no hay determinismo que
 * proteger.
 */
export function unfx(f: Fixed): number {
  return f / FIXED_SCALE
}

/**
 * Un entero YA ESCALADO tomado como magnitud. No convierte: reinterpreta.
 *
 * Existe porque el mundo va a leer sus magnitudes de un `Int32Array` y de un
 * journal, y ahí llegan como `number` pelado. Es la única puerta de entrada
 * desde afuera, y trunca y satura para que el invariante «un `Fixed` es siempre
 * un entero en rango» valga también para lo que viene de otro lado.
 */
export function fixedFromRaw(n: number): Fixed {
  return clampFixed(Math.trunc(n))
}

/** Suma de dos magnitudes. Existe porque `a + b` devuelve `number` y pierde la marca. */
export function fadd(a: Fixed, b: Fixed): Fixed {
  return clampFixed(a + b)
}

export function fsub(a: Fixed, b: Fixed): Fixed {
  return clampFixed(a - b)
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
  if (b === 0) return a === 0 ? (0 as Fixed) : a > 0 ? FIXED_MAX : FIXED_MIN
  return clampFixed(divRoundSigned(a * FIXED_SCALE, b))
}

export function fclamp(v: Fixed, lo: Fixed, hi: Fixed): Fixed {
  return v < lo ? lo : v > hi ? hi : v
}

export function fabs(v: Fixed): Fixed {
  return (v < 0 ? -v : v) as Fixed
}

// ─── Tasas: la otra escala ──────────────────────────────────────────────────

/** Convierte un real de autoría (la tasa por segundo de una ley) a `Rate`. */
export function rate(real: number): Rate {
  return clampRate(scaleReal(real, RATE_SCALE))
}

/** Vuelve al real. Solo para mostrar, medir y testear, igual que `unfx`. */
export function unrate(r: Rate): number {
  return r / RATE_SCALE
}

/** Un entero ya escalado tomado como tasa. El espejo de `fixedFromRaw`. */
export function rateFromRaw(n: number): Rate {
  return clampRate(Math.trunc(n))
}

/**
 * Dos tasas sobre la misma cualidad se suman.
 *
 * Y sirve además para lo que la decisión de las dos escalas hace posible:
 * ACUMULAR en la escala fina. Una tasa de 4.4e-5 no se ve en una magnitud de
 * resolución 10⁻³, pero sumada consigo misma 23 veces sí. Ver `aplicar`.
 */
export function radd(a: Rate, b: Rate): Rate {
  return clampRate(a + b)
}

/**
 * Una tasa por un factor ADIMENSIONAL sigue siendo una tasa.
 *
 * Es la operación de la ley 5: `evaporación = 0.0006 · k²`, donde `0.0006` es la
 * tasa por tick y `k²` es un factor sin unidades que sale de la temperatura.
 * `rscale(rate(0.0006), fpow(fx(0.27), fx(2)))` vale 44, o sea 4.4e-5 — el
 * número que en escala 1000 era cero y que el ADR II-0006 existe para recuperar.
 *
 * El factor es un `Fixed` porque los factores adimensionales son magnitudes: van
 * de 0 a unos pocos miles y no necesitan resolución de 10⁻⁶.
 */
export function rscale(r: Rate, k: Fixed): Rate {
  return clampRate(mulAt(r, k, FIXED_SCALE))
}

/**
 * Una tasa dividida por otra tasa es ADIMENSIONAL, o sea una magnitud.
 *
 * Es la cuenta del hallazgo 2 del barrido térmico: «cuánta agua se pierde por
 * unidad de progreso de cocción» es `evaporación / cocción`, dos tasas por tick
 * cuyo cociente no tiene unidades y es lo que decide «comer antes o comer
 * mejor». Las escalas se cancelan solas porque son la misma, así que esto es
 * `fdiv` sobre los enteros crudos — pero el TIPO de salida es `Fixed`, y eso es
 * lo que impide seguir tratando el resultado como una tasa.
 *
 * Divisor cero satura, por la misma razón que `fdiv`.
 */
export function rdiv(a: Rate, b: Rate): Fixed {
  if (b === 0) return a === 0 ? (0 as Fixed) : a > 0 ? FIXED_MAX : FIXED_MIN
  return clampFixed(divRoundSigned(a * FIXED_SCALE, b))
}

// ─── El tiempo del mundo ────────────────────────────────────────────────────
//
// ¿POR QUÉ ACÁ Y NO EN `@anima/world`? Porque la regla que decide qué frecuencia
// es admisible sale de la ESCALA DE LAS TASAS, y esa escala vive en este archivo.
// Una copia de la regla en el mundo sería un segundo lugar donde decir lo mismo,
// que es exactamente el bug de `DSL_REFERENCE` de Ánima I.

/**
 * Micro-segundos por segundo. Es `RATE_SCALE` mirado como tiempo, y no es una
 * coincidencia: el `dt` se multiplica por tasas de esta escala, así que la
 * resolución con la que el tiempo puede ser exacto es la misma con la que las
 * tasas lo son.
 */
export const MICROS_POR_SEGUNDO = RATE_SCALE

/**
 * Las frecuencias que dan un `dt` EXACTO, o sea las que dividen 10⁶ sin resto.
 *
 * | Hz | `dt` | en escala 10⁶ | |
 * |---|---|---|---|
 * | 10 | 0,1 | 100000 | **exacta** |
 * | 15 | 0,0666… | 66666,67 | periódica |
 * | **20** | **0,05** | **50000** | **exacta** |
 * | 24 | 0,04166… | 41666,67 | periódica |
 * | 25 | 0,04 | 40000 | **exacta** |
 * | **30** | **0,0333…** | **33333,33** | **periódica** |
 * | 50 | 0,02 | 20000 | **exacta** |
 * | 60 | 0,01666… | 16666,67 | periódica |
 *
 * Los 30 Hz que el documento de arquitectura declaraba «fijos» NO dan un `dt`
 * exacto: la frecuencia que la auditoría marcó como decretada sin argumento
 * habría roto el determinismo el día que el tiempo se hiciera explícito. Los
 * 20 Hz del ADR II-0007 sí lo dan, y ésa es una justificación que no teníamos
 * cuando se eligieron.
 *
 * Esto NO es una lista escrita a mano: `esFrecuenciaAdmisible` calcula la
 * condición, y esta constante existe para poder ENUMERAR las razonables en un
 * mensaje de error y en un test. La verdad es la función.
 */
export const FRECUENCIAS_ADMISIBLES: readonly number[] = [10, 20, 25, 50, 100]

/**
 * La frecuencia de referencia: la que el ADR II-0007 eligió y contra la que está
 * medida la huella de conducta de `paso()`.
 *
 * No es «la» frecuencia del mundo —eso es un parámetro y se puede mover— y
 * ninguna ley la lee. Está para que un test pueda decir «a la frecuencia de
 * referencia esto vale exactamente esto» sin escribir un 20 suelto.
 */
export const HZ_DE_REFERENCIA = 20

/**
 * Una frecuencia es admisible si `1/Hz` cae exacto en la escala de las tasas.
 *
 * Que RECHACE y no que redondee en silencio: un `dt` redondeado se multiplica en
 * cada aplicación de cada ley y el error se acumula tick a tick, así que el
 * síntoma no sería un número raro sino dos motores que divergen en el tick 400
 * sin ninguna causa visible.
 */
export function esFrecuenciaAdmisible(hz: number): boolean {
  if (!Number.isInteger(hz) || hz <= 0) return false
  return MICROS_POR_SEGUNDO % hz === 0
}

/**
 * El `dt` de una frecuencia. **Lanza** si la frecuencia no es admisible.
 *
 * Lanzar y no saturar, al revés que `fdiv`: esto NO corre adentro del tick. Corre
 * una vez, al armar el mundo, y ahí un error es una configuración mal escrita que
 * hay que arreglar antes de que la partida exista — no un borde numérico que hay
 * que sobrevivir.
 */
export function dtDeFrecuencia(hz: number): Dt {
  if (!esFrecuenciaAdmisible(hz)) {
    throw new RangeError(
      `frecuencia inadmisible: ${String(hz)} Hz da dt = 1/${String(hz)}, que no es exacto en la escala de las tasas (10⁻⁶). Admisibles: las que dividen ${String(MICROS_POR_SEGUNDO)} — por ejemplo ${FRECUENCIAS_ADMISIBLES.join(', ')}`,
    )
  }
  return (1 / hz) as Dt
}

/**
 * La frecuencia de un `dt`. Entero exacto por construcción: `dtDeFrecuencia` es
 * la única forma de fabricar un `Dt`, y solo la fabrica para frecuencias enteras
 * que dividen 10⁶.
 */
export function frecuenciaDe(dt: Dt): number {
  return Math.round(1 / dt)
}

/**
 * Una tasa POR SEGUNDO, aplicada durante UN paso. **La única conversión entre el
 * ritmo del mundo y el muestreo del tick**, y por eso vive en una sola función.
 *
 * ─── Por qué DIVIDE por la frecuencia en vez de multiplicar por `dt` ─────────
 *
 * Son la misma cuenta en el álgebra y no en IEEE-754, y la diferencia se mide:
 *
 *   0.2 × 0.05  = 0.010000000000000002   ← un ulp de más
 *   0.2 ÷ 20    = 0.01                   ← exacto
 *
 * `dt` es `1/Hz` REDONDEADO —0,05 no es representable en binario—, así que
 * multiplicar por él arrastra ese redondeo a toda tasa que toque. Dividir por la
 * frecuencia no: `Hz` es un entero exacto (lo garantiza `dtDeFrecuencia`) y la
 * división de IEEE-754 es correctamente redondeada, así que el resultado es el
 * double más cercano a la tasa por paso de verdad.
 *
 * Y no es una sutileza de bits sin consecuencia: la huella de conducta de
 * `paso()` mezcla los BITS de cada double que las leyes escriben, sobre 2880
 * pasos. Con el `× dt`, tres de las diez constantes de calibración vuelven un
 * ulp corridas y la huella se mueve — o sea que una migración que no cambió
 * ninguna conducta sería indistinguible de una que sí.
 */
export function porPaso(tasaPorSegundo: number, dt: Dt): number {
  return tasaPorSegundo / frecuenciaDe(dt)
}

/**
 * Suma un paso al tiempo transcurrido de un proceso en curso, SIN DERIVA.
 *
 * La suma ingenua no sirve, y falla en el caso más común de todos: veinte veces
 * 0,05 da 0,9999999999999999, que NO llega al segundo que `union` pide, y atar
 * pasaría a tardar veintiún ticks en vez de veinte. El error no sería un número
 * raro: sería un proceso que tarda un tick más, siempre, y nadie sabría por qué.
 *
 * Se suma en MICRO-SEGUNDOS ENTEROS, que es donde `dt` es exacto por
 * construcción, y se vuelve a segundos con una sola división. Dos tiempos que son
 * múltiplos de 10⁻⁶ se comparan entonces exactamente contra cualquier
 * `completion.at` que también lo sea.
 */
export function sumarPaso(transcurrido: Duracion, dt: Dt): Duracion {
  const micros = Math.round(transcurrido * MICROS_POR_SEGUNDO) + Math.round(dt * MICROS_POR_SEGUNDO)
  return (micros / MICROS_POR_SEGUNDO) as Duracion
}

/** Una duración en segundos, escrita como real de autoría. */
export function seg(segundos: number): Duracion {
  return segundos as Duracion
}

// ─── La única puerta entre las dos escalas ──────────────────────────────────

/** `pasos · r` desborda el double exacto (2^53) a partir de acá. */
const PASOS_SEGUROS = Math.floor(9007199254740991 / 2147483647)

/**
 * Aplica una tasa durante `pasos` aplicaciones a una magnitud. **LA ÚNICA PUERTA
 * ENTRE ESCALAS.**
 *
 * Es la única función del módulo que CONVIERTE, y conviene ser preciso con qué
 * quiere decir eso, porque hay otras dos que tocan las dos escalas:
 *
 *   `rscale(Rate, Fixed): Rate`  multiplica por un factor ADIMENSIONAL. No hay
 *                                conversión: entra una tasa y sale una tasa.
 *   `rdiv(Rate, Rate): Fixed`    las dos escalas se cancelan entre sí porque son
 *                                la misma. Tampoco hay conversión.
 *   `aplicar(Fixed, Rate, n)`    ACÁ, y solo acá, un número de la escala de las
 *                                tasas se vuelve un cambio en la escala de las
 *                                magnitudes.
 *
 * Si eso estuviera repartido, la pregunta «¿esto es por tick o es el total?»
 * habría que contestarla en cada sitio, y el error de contestarla mal es
 * silencioso.
 *
 * ─── Un solo redondeo, y por qué importa ────────────────────────────────────
 *
 * `aplicar(m, r, 23)` NO es lo mismo que llamar 23 veces a `aplicar(m, r, 1)`, y
 * la diferencia es toda la decisión: con `r` = 4.4e-5, veintitrés pasos de a uno
 * redondean a cero veintitrés veces y la magnitud no se mueve NUNCA; un solo
 * paso de 23 aplicaciones da 0.001 y el pescado pierde agua.
 *
 * O sea: quien integre paso a paso tiene que llevar la cuenta fina EN `Rate`
 * —acumulando con `radd`— y cruzar una sola vez. Cruzar en cada paso es tirar
 * exactamente lo que la escala de 10⁻⁶ vino a comprar.
 *
 * `pasos` es un `number` pelado y no un `Fixed` porque es un CONTEO de
 * aplicaciones, no una magnitud ni una duración: no tiene escala, no tiene
 * fracción y no se le pueden sumar grados. La duración que representa es
 * `pasos · dt` y la sabe quien llama, no esta función. Se trunca a entero, y un
 * `pasos` que no sea finito no mueve nada.
 */
export function aplicar(m: Fixed, r: Rate, pasos: number): Fixed {
  if (!Number.isFinite(pasos)) return m
  const n = Math.trunc(pasos)
  if (n === 0 || r === 0) return m
  // Con más pasos que esto, `r · n` sale del entero exacto del double y el
  // redondeo pasaría a depender de la magnitud de los operandos. Saturar es
  // honesto: una tasa sostenida ese tiempo ya se comió el rango entero. El signo
  // sale del producto y no solo de `r`: aplicar hacia atrás una tasa positiva
  // baja, no sube.
  if (n > PASOS_SEGUROS || n < -PASOS_SEGUROS) return r > 0 === n > 0 ? FIXED_MAX : FIXED_MIN
  return clampFixed(m + divRound(r * n, RATE_PER_FIXED))
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

function toS(x: number): number {
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
const EXP_ARG_MAX = 14580
const EXP_ARG_MIN = -7700
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
  if (x <= EXP_ARG_MIN) return 0 as Fixed
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
    let cur: Fixed = (negBase ? -base : base) as Fixed
    let acc: Fixed = FIXED_ONE
    while (k > 0) {
      if (k % 2 === 1) acc = fmul(acc, cur)
      k = Math.floor(k / 2)
      if (k > 0) cur = fmul(cur, cur)
    }
    // El signo sale de la paridad, no de la aritmética: así `(−2)^2` da 4 exacto
    // sin depender de cómo redondeen los pasos intermedios.
    const signed: Fixed = (negBase && n % 2 !== 0 ? -acc : acc) as Fixed
    return negExp ? fdiv(FIXED_ONE, signed) : signed
  }

  if (base <= 0) return 0 as Fixed
  return fromS(expSClamped(mulS(toS(exp), lnS(toS(base)))))
}

// ─── Lo que este módulo NO exporta, y por qué ───────────────────────────────
//
// No hay `fsin`, `fsqrt` ni `frandom`. Las dos primeras porque ninguna de las
// doce leyes las pide todavía y una tabla sin usuario se calibra mal; la tercera
// porque el azar no vive acá: vive en el dios perezoso, derivado de la semilla y
// de la pregunta, nunca del reloj.
//
// Tampoco hay `rexp`, `rln` ni `rpow`. Una tasa no se eleva ni se logaritma: se
// escala por un factor adimensional (`rscale`), se suma con otra tasa (`radd`) y
// se aplica (`aplicar`). Toda la curvatura vive en el factor, que es un `Fixed`,
// y ahí ya están las trascendentes.
//
// Tampoco hay acumuladores ni estado. Todo lo de este archivo es puro: misma
// entrada, misma salida, en cualquier máquina y en cualquier orden. Ése es el
// único contrato que el resto del paquete necesita de acá.
