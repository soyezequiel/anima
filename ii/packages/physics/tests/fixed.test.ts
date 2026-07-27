import { describe, expect, it } from 'vitest'

import {
  FIXED_MAX,
  FIXED_MIN,
  FIXED_ONE,
  FIXED_SCALE,
  RATE_MAX,
  RATE_MIN,
  RATE_ONE,
  RATE_SCALE,
  aplicar,
  fabs,
  fadd,
  fclamp,
  fdiv,
  fexp,
  fixedFromRaw,
  fln,
  fmul,
  fpow,
  fsub,
  fx,
  radd,
  rate,
  rateFromRaw,
  rdiv,
  rscale,
  unfx,
  unrate,
} from '../src/fixed.js'
import type { Fixed, Rate } from '../src/fixed.js'

/**
 * Los tests de `fixed.ts`. Cuatro clases, y las cuatro hacen falta:
 *
 *   1. INVARIANTES  — entero siempre, simétrico en el signo, acotado. Se barren
 *      dominios enteros, sin valores de referencia: si algo de esto se rompe, el
 *      replay diverge aunque los números den «casi» bien.
 *   2. EXACTITUD    — contra referencias que NO son `Math`. Las racionales se
 *      comparan con `BigInt`, que es exacto por construcción; las trascendentes,
 *      contra constantes conocidas escritas a mano. Usar `Math.exp` como oráculo
 *      sería testear la implementación contra lo que este módulo existe para no
 *      depender.
 *   3. LAS DOS ESCALAS — que una tasa no se pueda confundir con una magnitud
 *      (eso lo verifica `tsc`, no `vitest`), que el techo de cada una sea el que
 *      el ADR II-0006 dice, y que `aplicar` sea la única puerta entre las dos.
 *   4. CALIBRACIÓN  — que las cuentas del Hito 0 den lo mismo en punto fijo. Un
 *      módulo de aritmética que pasa sus propios tests pero corre la ventana de
 *      cocción tres grados no sirve para nada.
 *
 * El azar de los barridos es un LCG con semilla fija. `Math.random` está
 * prohibido acá por la misma razón que en el resto del paquete, y además un test
 * que falla una vez cada cien corridas es peor que no tenerlo.
 */
function lcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s
  }
}

/**
 * Un entero crudo tomado como magnitud. Los barridos generan enteros YA
 * ESCALADOS —el LCG no devuelve reales— y ésa es exactamente la puerta para la
 * que existe `fixedFromRaw`: lo que llega de afuera (un journal, un
 * `Int32Array`, un generador) es `number` pelado.
 */
const F = (n: number): Fixed => fixedFromRaw(n)

/** El espejo, para las tasas. */
const R = (n: number): Rate => rateFromRaw(n)

/** `round(num / den)` exacto, con mitades alejándose del cero. La referencia. */
function exactDivRound(num: bigint, den: bigint): bigint {
  const neg = num < 0n !== den < 0n
  const a = num < 0n ? -num : num
  const b = den < 0n ? -den : den
  let q = a / b
  if ((a - q * b) * 2n >= b) q += 1n
  return neg ? -q : q
}

function saturate(v: bigint): number {
  if (v > BigInt(FIXED_MAX)) return FIXED_MAX
  if (v < BigInt(FIXED_MIN)) return FIXED_MIN
  return Number(v)
}

/** La cota declarada en la cabecera de `fixed.ts`: max(k ulp, |v| · rel). */
function within(got: number, want: number, ulps: number, rel: number): boolean {
  return Math.abs(got - want) <= Math.max(ulps, Math.abs(want) * rel)
}

describe('invariantes', () => {
  it('todo resultado es un entero', () => {
    const rnd = lcg(7)
    for (let i = 0; i < 6000; i++) {
      const a = F((rnd() % 2147484) * (rnd() % 2 ? 1 : -1))
      const b = F((rnd() % 2147484) * (rnd() % 2 ? 1 : -1))
      for (const v of [
        fmul(a, b),
        fdiv(a, b),
        fexp(F(a % 15000)),
        fln(fabs(a)),
        fpow(F(b % 4000), fx(2)),
      ])
        expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('simetría de signo: f(−x) = −f(x)', () => {
    // Si esto se rompe, enfriarse deja de ser calentarse con el signo cambiado y
    // un cuerpo que cruza el cero pierde un milésimo que otro gana.
    const rnd = lcg(11)
    for (let i = 0; i < 20000; i++) {
      const a = F(rnd() % 2147484)
      const b = F((rnd() % 100000) + 1)
      expect(fmul(F(-a), b)).toBe(-fmul(a, b))
      expect(fdiv(F(-a), b)).toBe(-fdiv(a, b))
      expect(fdiv(a, F(-b))).toBe(-fdiv(a, b))
    }
  })

  it('satura en vez de dar la vuelta o devolver NaN', () => {
    expect(fmul(FIXED_MAX, FIXED_MAX)).toBe(FIXED_MAX)
    expect(fmul(FIXED_MAX, FIXED_MIN)).toBe(FIXED_MIN)
    expect(fdiv(FIXED_MAX, fx(0.001))).toBe(FIXED_MAX)
    expect(fdiv(fx(1), fx(0))).toBe(FIXED_MAX)
    expect(fdiv(fx(-1), fx(0))).toBe(FIXED_MIN)
    expect(fdiv(fx(0), fx(0))).toBe(0)
    expect(fexp(FIXED_MAX)).toBe(FIXED_MAX)
    expect(fexp(FIXED_MIN)).toBe(0)
    expect(fln(fx(0))).toBe(FIXED_MIN)
    expect(fln(fx(-5))).toBe(FIXED_MIN)
  })

  it('−FIXED_MIN es representable', () => {
    // Por eso FIXED_MIN es −2147483647 y no el mínimo real de i32: con el mínimo
    // real, negar el borde se sale del rango y la simetría se rompe justo ahí.
    expect(-FIXED_MIN).toBe(FIXED_MAX)
    expect(-RATE_MIN).toBe(RATE_MAX)
  })

  it('es puro: la misma entrada da lo mismo siempre', () => {
    const rnd = lcg(23)
    for (let i = 0; i < 5000; i++) {
      const a = F((rnd() % 2147484) * (rnd() % 2 ? 1 : -1))
      expect(fexp(F(a % 14000))).toBe(fexp(F(a % 14000)))
      expect(fln(F(fabs(a) + 1))).toBe(fln(F(fabs(a) + 1)))
    }
  })
})

describe('fx / unfx', () => {
  it('convierte y vuelve', () => {
    expect(fx(1)).toBe(1000)
    expect(fx(0)).toBe(0)
    expect(fx(-2.5)).toBe(-2500)
    expect(fx(0.001)).toBe(1)
    expect(FIXED_ONE).toBe(FIXED_SCALE)
    expect(unfx(fx(2.718))).toBeCloseTo(2.718, 10)
  })

  it('redondea las mitades alejándose del cero, no hacia +∞', () => {
    expect(fx(0.0005)).toBe(1)
    expect(fx(-0.0005)).toBe(-1)
    expect(fx(1.0015)).toBe(1002)
    expect(fx(-1.0015)).toBe(-1002)
  })

  it('sobrevive a los decimales que el double no representa exacto', () => {
    // 0.145 · 1000 da 144.99999999999997 en IEEE-754. Un `Math.floor` pelado
    // devolvería 144 y todas las constantes de calibración quedarían un milésimo
    // abajo.
    expect(fx(0.145)).toBe(145)
    expect(fx(0.27)).toBe(270)
    expect(fx(1.005)).toBe(1005)
    expect(fx(8.29)).toBe(8290)
  })

  it('satura fuera de rango', () => {
    expect(fx(1e9)).toBe(FIXED_MAX)
    expect(fx(-1e9)).toBe(FIXED_MIN)
  })

  it('fixedFromRaw reinterpreta, no convierte, y no deja fracción viva', () => {
    // La puerta desde afuera: un journal y un `Int32Array` traen `number` pelado.
    expect(fixedFromRaw(1000)).toBe(fx(1))
    expect(fixedFromRaw(1000.9)).toBe(1000)
    expect(fixedFromRaw(-1000.9)).toBe(-1000)
    expect(fixedFromRaw(1e12)).toBe(FIXED_MAX)
  })
})

describe('fmul y fdiv son correctamente redondeadas', () => {
  it('coinciden con BigInt exacto en todo el rango', () => {
    // `a·b` de dos i32 grandes llega a 4.6e18 y el double deja de ser exacto
    // arriba de 9.0e15. Éste es el test que prueba que `mulAt` no pierde bits.
    const rnd = lcg(101)
    for (let i = 0; i < 60000; i++) {
      const a = F((rnd() % 2147484) * (rnd() % 2 ? 1 : -1))
      const b = F((rnd() % 2147484) * (rnd() % 2 ? 1 : -1))
      expect(fmul(a, b)).toBe(saturate(exactDivRound(BigInt(a) * BigInt(b), BigInt(FIXED_SCALE))))
    }
  })

  it('fdiv coincide con BigInt exacto', () => {
    const rnd = lcg(103)
    for (let i = 0; i < 60000; i++) {
      const a = F((rnd() % 2147484) * (rnd() % 2 ? 1 : -1))
      const b = F(((rnd() % 200000) + 1) * (rnd() % 2 ? 1 : -1))
      expect(fdiv(a, b)).toBe(saturate(exactDivRound(BigInt(a) * BigInt(FIXED_SCALE), BigInt(b))))
    }
  })

  it('los casos que uno espera que den exacto, dan exacto', () => {
    expect(fmul(fx(2), fx(3))).toBe(fx(6))
    expect(fmul(fx(0.5), fx(0.5))).toBe(fx(0.25))
    expect(fdiv(fx(1), fx(3))).toBe(333)
    expect(fdiv(fx(300), fx(0.5))).toBe(fx(600))
    expect(fclamp(fx(5), fx(0), fx(1))).toBe(fx(1))
    expect(fabs(fx(-3))).toBe(fx(3))
    expect(fadd(fx(1.5), fx(2.25))).toBe(fx(3.75))
    expect(fsub(fx(1.5), fx(2.25))).toBe(fx(-0.75))
  })

  it('fadd y fsub saturan como todo lo demás', () => {
    // Existen porque `a + b` sobre dos magnitudes devuelve `number` y pierde la
    // marca; ya que existen, saturan igual que el resto del módulo.
    expect(fadd(FIXED_MAX, fx(1))).toBe(FIXED_MAX)
    expect(fsub(FIXED_MIN, fx(1))).toBe(FIXED_MIN)
  })
})

describe('fexp', () => {
  // Constantes conocidas, escritas a mano. No salen de `Math.exp`: son los
  // valores de e^x redondeados a milésimos.
  const TESTIGOS: readonly [number, number][] = [
    [0, 1000], // 1
    [1000, 2718], // 2.718281828…
    [-1000, 368], // 0.367879441…
    [500, 1649], // 1.648721271…
    [-500, 607], // 0.606530660…
    [2000, 7389], // 7.389056099…
    [-2000, 135], // 0.135335283…
    [270, 1310], // 1.309964451…
    [5000, 148413], // 148.413159103…
    [-5000, 7], // 0.006737947…
    [10000, 22026466], // 22026.465795…
    [14000, 1202604284], // 1202604.284165…
  ]

  it('acierta los valores conocidos dentro de la cota declarada', () => {
    for (const [x, want] of TESTIGOS) expect(within(fexp(F(x)), want, 1, 2e-7)).toBe(true)
  })

  it('para x ≤ 0 es EXACTO: coincide con el redondeo ideal', () => {
    // Es el caso de todos los factores de decaimiento —evaporación, pérdida de
    // calor, pudrición—, o sea el 99% de los usos del módulo en las doce leyes.
    for (const [x, want] of TESTIGOS) if (x <= 0) expect(fexp(F(x))).toBe(want)
  })

  it('es monótona no decreciente en todo el dominio', () => {
    // Sin valores de referencia: una exponencial que baja en algún punto haría
    // que enfriarse más tiempo enfríe menos, y eso se ve en el mundo aunque el
    // error absoluto sea de un milésimo.
    let prev = fexp(F(-7700))
    for (let x = -7699; x <= 14580; x++) {
      const v = fexp(F(x))
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('satura en los dos bordes', () => {
    expect(fexp(F(14580))).toBe(FIXED_MAX)
    expect(fexp(F(20000))).toBe(FIXED_MAX)
    expect(fexp(F(-7700))).toBe(0)
    expect(fexp(F(-50000))).toBe(0)
  })

  it('cumple e^(a+b) = e^a · e^b', () => {
    // Identidad estructural: la reducción de rango (x = n·ln2 + r) podría dar
    // valores buenos por tramo y saltar en las fronteras entre n y n+1. Esto lo
    // caza sin necesitar una tabla de referencia.
    //
    // La tolerancia (5e-3 relativo) la fija la CUANTIZACIÓN DE LOS FACTORES, no
    // `fexp`: e^−2 vale 135 milésimos, así que ya viene con 0.4% de error propio
    // antes de multiplicar. Pedir menos sería testear una precisión que la escala
    // no tiene.
    for (let a = -2000; a <= 3000; a += 137)
      for (let b = -2000; b <= 3000; b += 211)
        expect(within(fexp(F(a + b)), fmul(fexp(F(a)), fexp(F(b))), 2, 5e-3)).toBe(true)
  })
})

describe('fln', () => {
  const TESTIGOS: readonly [number, number][] = [
    [1000, 0], // ln 1
    [2000, 693], // 0.693147181…
    [500, -693], // −0.693147181…
    [10000, 2303], // 2.302585093…
    [1500, 405], // 0.405465108…
    [100000, 4605], // 4.605170186…
    [1000000, 6908], // 6.907755279…
    [1, -6908], // ln 0.001
    [2718, 1000], // ln 2.718 ≈ 0.999896…
    [2147483647, 14580], // 14.579862…
  ]

  it('acierta los valores conocidos con error ≤ 1 ulp', () => {
    for (const [x, want] of TESTIGOS) expect(Math.abs(fln(F(x)) - want)).toBeLessThanOrEqual(1)
  })

  it('es monótona no decreciente', () => {
    let prev = fln(F(1))
    for (let x = 2; x <= 120000; x++) {
      const v = fln(F(x))
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('cumple ln(a·b) = ln a + ln b', () => {
    for (let a = 100; a <= 500000; a *= 3)
      for (let b = 100; b <= 500000; b *= 7)
        expect(Math.abs(fln(fmul(F(a), F(b))) - (fln(F(a)) + fln(F(b))))).toBeLessThanOrEqual(3)
  })

  it('vuelve por donde vino: e^(ln x) ≈ x', () => {
    // La tolerancia es 1e-3 relativo y no puede ser mejor: `fln` devuelve
    // milésimos, y medio milésimo de error en el logaritmo son 5e-4 relativos
    // después de exponenciar. Es el piso de la escala, no del algoritmo.
    for (const x of [1, 10, 500, 1000, 2718, 100000, 2147483])
      expect(within(fexp(fln(F(x))), x, 1, 1e-3)).toBe(true)
  })
})

describe('fpow', () => {
  it('acierta los valores conocidos', () => {
    expect(fpow(fx(2), fx(10))).toBe(fx(1024))
    expect(fpow(fx(1.5), fx(3))).toBe(fx(3.375))
    expect(fpow(fx(10), fx(3))).toBe(fx(1000))
    expect(fpow(fx(0.27), fx(2))).toBe(73) // 0.0729
    expect(fpow(fx(2), fx(-2))).toBe(fx(0.25))
    expect(fpow(fx(2), fx(0.5))).toBe(1414) // √2 = 1.414213562…
    expect(fpow(fx(10), fx(1.5))).toBe(31623) // 31.622776602…
    expect(fpow(fx(5), fx(0))).toBe(FIXED_ONE)
    expect(fpow(fx(0), fx(0))).toBe(FIXED_ONE) // el producto vacío
  })

  it('el signo sale de la paridad del exponente, no de la aritmética', () => {
    expect(fpow(fx(-2), fx(2))).toBe(fx(4))
    expect(fpow(fx(-2), fx(3))).toBe(fx(-8))
    expect(fpow(fx(-1.5), fx(4))).toBe(fx(5.0625))
    // Base negativa con exponente fraccionario no existe en los reales: 0, y no
    // un saturado que parecería un número.
    expect(fpow(fx(-2), fx(0.5))).toBe(0)
  })

  it('n = 2 está a ≤ 1 ulp del ideal en todo el rango barrido', () => {
    // Es EL caso de la ley 5. Referencia exacta con BigInt, no con `Math.pow`.
    for (let b = -200000; b <= 200000; b += 23) {
      const want = saturate(exactDivRound(BigInt(b) * BigInt(b), BigInt(FIXED_SCALE)))
      expect(Math.abs(fpow(F(b), fx(2)) - want)).toBeLessThanOrEqual(1)
    }
  })

  it('n ≤ 8 se queda en max(n ulp, |v|·n·3e-4)', () => {
    for (let n = 1; n <= 8; n++) {
      for (let b = 1; b <= 40000; b += 13) {
        let want = BigInt(FIXED_SCALE)
        for (let i = 0; i < n; i++) want = exactDivRound(want * BigInt(b), BigInt(FIXED_SCALE))
        if (want > BigInt(FIXED_MAX)) break
        expect(within(fpow(F(b), F(n * FIXED_SCALE)), Number(want), n, n * 3e-4)).toBe(true)
      }
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// LAS DOS ESCALAS (ADR II-0006)
// ═════════════════════════════════════════════════════════════════════════════

describe('las magnitudes necesitan rango y las tasas necesitan resolución', () => {
  it('cada escala tiene el techo que el ADR dice, y son distintos', () => {
    // La tabla del ADR II-0006, ejecutable. Es la razón entera de que haya dos
    // tipos: con una sola escala hay que elegir cuál de los dos requisitos se
    // rompe.
    expect(unfx(FIXED_MAX)).toBeCloseTo(2147483.647, 3) // rango para el fuego
    expect(unrate(RATE_MAX)).toBeCloseTo(2147.483647, 6) // resolución 10⁻⁶
    expect(RATE_SCALE / FIXED_SCALE).toBe(1000)
  })

  it('una temperatura de hoguera no satura, y su cuadrado tampoco', () => {
    // El motivo por el que NO se subió `FIXED_SCALE` a 1e6 y listo: con techo
    // 2147, una hoguera de 600 °C entra pero cualquier producto intermedio de
    // dos temperaturas se sale, y el bug es silencioso.
    const hoguera = fx(600)
    expect(hoguera).toBeLessThan(FIXED_MAX)
    expect(fmul(hoguera, hoguera)).toBe(fx(360000))
    expect(fmul(hoguera, hoguera)).toBeLessThan(FIXED_MAX)
    // La misma cuenta en la escala de las tasas: la hoguera entra, su cuadrado
    // no, y satura sin avisar. Ése es el bug que subir `FIXED_SCALE` a 1e6
    // habría comprado a cambio del que arreglaba.
    expect(rate(600)).toBeLessThan(RATE_MAX)
    expect(rate(600 * 600)).toBe(RATE_MAX)
  })

  it('una tasa por tick nunca necesita más de 2147, y por eso el techo no aprieta', () => {
    // La más rápida de las doce leyes relaja el oxígeno a 0.05 por tick. La más
    // lenta —el secado de la ley 11— es 2e-5, que en escala 1000 sería CERO.
    expect(rate(0.05)).toBe(50000)
    expect(rate(0.00002)).toBe(20)
    expect(rate(0.0004)).toBe(400)
    // Y una tasa de 1 por tick ya lleva cualquier cualidad de 0 a 1 en un paso,
    // que es lo que el mundo no debería poder hacer: el techo está 2147 veces
    // más arriba que eso.
    expect(RATE_ONE).toBe(RATE_SCALE)
    expect(unrate(RATE_MAX)).toBeGreaterThan(2000)
  })

  it('rate satura en los bordes, como todo lo demás', () => {
    expect(rate(3000)).toBe(RATE_MAX)
    expect(rate(-3000)).toBe(RATE_MIN)
    expect(rateFromRaw(1e12)).toBe(RATE_MAX)
    expect(rateFromRaw(44.9)).toBe(44)
  })

  it('radd suma tasas y satura', () => {
    expect(radd(rate(0.01), rate(0.02))).toBe(rate(0.03))
    expect(radd(RATE_MAX, rate(1))).toBe(RATE_MAX)
  })

  it('rscale usa el mismo redondeo correcto que fmul', () => {
    expect(rscale(rate(1), fx(0.5))).toBe(rate(0.5))
    expect(rscale(rate(0.001), fx(2))).toBe(rate(0.002))
    expect(rscale(RATE_MAX, fx(2))).toBe(RATE_MAX)
    // Simetría de signo, igual que en las magnitudes.
    expect(rscale(rate(-0.0006), fx(0.073))).toBe(-rscale(rate(0.0006), fx(0.073)))
  })
})

describe('la evaporación de la ley 5 ya no es cero', () => {
  // EL número del ADR II-0006, y la razón por la que hay dos escalas.
  //
  // La ley 5 evapora a `0.0006·k²`. Para k = 0.27 —el pescado sobre la parrilla,
  // que es el caso del barrido térmico— eso vale 4.4e-5. En escala 1000 redondea
  // a CERO, o sea que el pescado no pierde agua NUNCA, la tensión «comer antes o
  // comer mejor» desaparece y cocinar vuelve a ser una receta.
  const EVAPORACION_BASE = 0.0006
  const K_PARRILLA = 0.27

  it('vale 4.4e-5 y NO es cero', () => {
    const k2 = fpow(fx(K_PARRILLA), fx(2))
    const evap = rscale(rate(EVAPORACION_BASE), k2)
    expect(evap).not.toBe(0)
    expect(evap).toBe(44)
    expect(unrate(evap)).toBeCloseTo(4.4e-5, 9)
    // El real exacto es 4.374e-5; la diferencia es que `k²` se cuantiza a 0.073
    // en la escala de las MAGNITUDES, no en la de las tasas. Es el error de la
    // entrada, no el de la operación, y son 6 partes en mil.
    expect(Math.abs(unrate(evap) - 0.0006 * 0.27 * 0.27)).toBeLessThan(3e-7)
  })

  it('en la escala vieja era cero, y ésa era la trampa', () => {
    // Este test decía lo contrario hasta el ADR II-0006: estaba para dejar
    // escrito el piso de resolución que las leyes «tenían que esquivar». Ahora
    // está para mostrar el antes y el después en la misma pantalla.
    expect(fx(EVAPORACION_BASE)).toBe(1) // 0.0006 ya se redondea a 0.001
    expect(fmul(fx(EVAPORACION_BASE), fpow(fx(K_PARRILLA), fx(2)))).toBe(0)
    // Y la tasa, en su escala, sí existe.
    expect(rscale(rate(EVAPORACION_BASE), fpow(fx(K_PARRILLA), fx(2)))).toBeGreaterThan(0)
  })

  it('en la escala vieja fallaban DOS cosas, no una: la constante y el producto', () => {
    // 1. La CONSTANTE misma es irrepresentable: 0.0006 redondea a 0.001, o sea
    //    67% de más antes de multiplicar nada.
    expect(fx(EVAPORACION_BASE)).toBe(1)

    // 2. Y aun con la constante inflada, el producto es cero en toda la banda de
    //    cocción que importa: la parrilla a distancia 2 (k = 0.27) y a distancia
    //    1 (k = 0.5). O sea que el pescado no perdía agua ni en el sitio bueno
    //    ni en el mejor.
    for (const k of [0.27, 0.5]) {
      expect(fmul(fx(EVAPORACION_BASE), fpow(fx(k), fx(2)))).toBe(0)
      expect(rscale(rate(EVAPORACION_BASE), fpow(fx(k), fx(2)))).toBeGreaterThan(0)
    }

    // 3. Y donde dejaba de ser cero, la respuesta venía en escalones de un
    //    milésimo: sobre las brasas (k = 1.59) la escala vieja dice 0.003 y la
    //    fina 0.001517 — casi el doble, que es lo mismo que decir que la
    //    calibración del barrido térmico no sobrevivía el cruce.
    expect(fmul(fx(EVAPORACION_BASE), fpow(fx(1.59), fx(2)))).toBe(3)
    expect(rscale(rate(EVAPORACION_BASE), fpow(fx(1.59), fx(2)))).toBe(1517)
  })
})

describe('aplicar es la única puerta entre las dos escalas', () => {
  it('suma la tasa por los ticks y devuelve una magnitud', () => {
    expect(aplicar(fx(20), rate(0.5), 10)).toBe(fx(25))
    expect(aplicar(fx(20), rate(-0.5), 10)).toBe(fx(15))
    expect(aplicar(fx(20), rate(0.5), 0)).toBe(fx(20))
    expect(aplicar(fx(20), rate(0), 1000)).toBe(fx(20))
  })

  it('acumular en la escala fina y cruzar UNA vez no es cruzar todos los ticks', () => {
    // La consecuencia de la decisión, escrita como test para que nadie la
    // descubra depurando. La humedad del pescado vale 0.72 y la evaporación es
    // 4.4e-5 por tick:
    //
    //   - cruzando cada tick, la magnitud (resolución 10⁻³) no se mueve NUNCA;
    //   - acumulando en `Rate` y cruzando una vez cada 23 ticks, sí.
    //
    // Por eso `aplicar` toma `ticks` y no se llama una vez por tick: la cuenta
    // fina vive en la escala fina.
    const evap = rscale(rate(-0.0006), fpow(fx(0.27), fx(2)))
    let tickATick: Fixed = fx(0.72)
    for (let i = 0; i < 23; i++) tickATick = aplicar(tickATick, evap, 1)
    expect(tickATick).toBe(fx(0.72)) // no se movió ni un milésimo

    const deUnaVez = aplicar(fx(0.72), evap, 23)
    expect(deUnaVez).toBe(fx(0.719)) // sí se movió
    expect(deUnaVez).toBeLessThan(tickATick)
  })

  it('acumular con radd y aplicar una vez da lo mismo que aplicar por N ticks', () => {
    // La otra forma de llevar la cuenta fina: sumar la tasa consigo misma. Las
    // dos tienen que coincidir, o habría dos maneras de integrar y darían
    // distinto.
    const r = rate(0.0004)
    let acumulada = rate(0)
    for (let i = 0; i < 37; i++) acumulada = radd(acumulada, r)
    expect(aplicar(fx(1), acumulada, 1)).toBe(aplicar(fx(1), r, 37))
  })

  it('es simétrica en el signo, como el resto del módulo', () => {
    const rnd = lcg(31)
    // Negar una tasa es escalarla por −1: exacto, y sin salir de la escala.
    const opuesta = (r: Rate): Rate => rscale(r, fx(-1))
    for (let i = 0; i < 5000; i++) {
      const r = R((rnd() % 2000000) - 1000000)
      const n = (rnd() % 500) + 1
      expect(opuesta(r)).toBe(-r)
      expect(aplicar(fx(0), r, n)).toBe(-aplicar(fx(0), opuesta(r), n))
      // Ir para adelante y volver para atrás con la tasa opuesta es la identidad.
      expect(aplicar(aplicar(fx(0), r, n), opuesta(r), n)).toBe(0)
    }
  })

  it('satura en vez de dar la vuelta, y un ticks absurdo no rompe el redondeo', () => {
    expect(aplicar(FIXED_MAX, rate(1), 1000)).toBe(FIXED_MAX)
    expect(aplicar(FIXED_MIN, rate(-1), 1000)).toBe(FIXED_MIN)
    // Por encima de 4 194 304 ticks el producto `r · ticks` sale del entero
    // exacto del double. Saturar es honesto; redondear mal, no.
    expect(aplicar(fx(0), RATE_MAX, 1e9)).toBe(FIXED_MAX)
    expect(aplicar(fx(0), RATE_MAX, -1e9)).toBe(FIXED_MIN)
    expect(aplicar(fx(5), rate(1), Number.NaN)).toBe(fx(5))
    expect(aplicar(fx(5), rate(1), Number.POSITIVE_INFINITY)).toBe(fx(5))
  })

  it('trunca los ticks fraccionarios: un tick es un conteo, no una magnitud', () => {
    expect(aplicar(fx(0), rate(1), 2.9)).toBe(aplicar(fx(0), rate(1), 2))
  })
})

describe('el compilador impide confundir una magnitud con una tasa', () => {
  // ESTE test no lo corre `vitest`: lo corre `tsc --noEmit`. Si alguna de estas
  // líneas empezara a compilar, `@ts-expect-error` pasaría a ser un error de
  // «directiva sin uso» y el typecheck se caería. Es la mitad del valor del ADR
  // II-0006 —el error que previene es silencioso— y por eso está escrito.
  it('las líneas de abajo no compilan, y eso es el test', () => {
    const m = fx(20)
    const r = rate(0.5)

    // @ts-expect-error sumar una tasa a una magnitud
    fadd(m, r)
    // @ts-expect-error multiplicar una magnitud como si fuera una tasa
    rscale(m, r)
    // @ts-expect-error los argumentos de `aplicar` no son intercambiables
    aplicar(r, m, 1)
    // @ts-expect-error `unfx` de una tasa daría un número mil veces más grande
    unfx(r)
    // @ts-expect-error `unrate` de una magnitud, lo mismo al revés
    unrate(m)
    // @ts-expect-error `+` devuelve `number` pelado y pierde la marca
    const perdida: Fixed = m + m
    // @ts-expect-error una tasa cruda no es una magnitud aunque el entero sirva
    const confundida: Fixed = r

    expect([m, r, perdida, confundida].length).toBe(4)
  })
})

describe('la calibración del Hito 0 sobrevive al punto fijo', () => {
  // `ii/docs/hito-0-barrido-termico.md`. Si estas cuentas se corren aunque sea un
  // grado, la ventana entre «no cocina» (63) y «se quema» (280) se mueve y el
  // barrido deja de valer.
  const EXPOSICION = { piso: fx(0.06), parrilla: fx(0.25), contacto: fx(0.6) }
  const formFactor = (d: Fixed, exposicion: Fixed) => fdiv(exposicion, fadd(fx(1), fmul(d, d)))
  const tEq = (potencia: Fixed, d: Fixed, exposicion: Fixed) =>
    fadd(fx(15), fdiv(fmul(potencia, formFactor(d, exposicion)), fx(0.5)))

  it('las cuatro filas de formFactor dan EXACTO lo que dice el documento', () => {
    expect(formFactor(fx(2), EXPOSICION.piso)).toBe(fx(0.012))
    expect(formFactor(fx(1), EXPOSICION.piso)).toBe(fx(0.03))
    expect(formFactor(fx(0), EXPOSICION.contacto)).toBe(fx(0.6))
    expect(formFactor(fx(1), EXPOSICION.parrilla)).toBe(fx(0.125))
  })

  it('las cuatro temperaturas de equilibrio del pescado, también', () => {
    const fogata = fx(300)
    expect(tEq(fogata, fx(2), EXPOSICION.piso)).toBe(fx(22.2)) // no cocina (< 63)
    expect(tEq(fogata, fx(1), EXPOSICION.piso)).toBe(fx(33)) // no cocina
    expect(tEq(fogata, fx(0), EXPOSICION.contacto)).toBe(fx(375)) // se quema (> 280)
    expect(tEq(fogata, fx(1), EXPOSICION.parrilla)).toBe(fx(90)) // cocina y no se quema
  })

  it('el exponente 2 de la evaporación es lo que hace que cocinar sea una técnica', () => {
    // EL hallazgo del Hito 0, ejecutable. El agua perdida por unidad de progreso
    // de cocción es evap/r. Con `evap ∝ k` la razón NO DEPENDE DE k: más caliente
    // es siempre mejor y no hay nada que decidir. Con `evap ∝ k²` crece con k, y
    // ahí aparece la tensión «comer antes o comer mejor».
    //
    // Las dos tasas van EN SU ESCALA y ya no reescaladas a mano (antes del ADR
    // II-0006 este test llevaba `fx(0.6)` en vez de 0.0006 y `fx(10)` en vez de
    // 0.010, porque en escala 1000 las de verdad eran cero). La razón es
    // adimensional: `rdiv` la devuelve como magnitud y ahí se acaba la tasa.
    const toughness = fx(0.3)
    const razon = (k: Fixed, exponente: Fixed): Fixed => {
      const evap = rscale(rate(0.0006), fpow(k, exponente))
      const coccion = rscale(rate(0.01), fdiv(k, fadd(fx(0.2), toughness)))
      return rdiv(evap, coccion)
    }
    const ks = [fx(0.27), fx(0.75), fx(1.59)] // parrilla d2, parrilla d1, brasas

    const conCuadrado = ks.map((k) => razon(k, fx(2)))
    expect(conCuadrado[0]!).toBeLessThan(conCuadrado[1]!)
    expect(conCuadrado[1]!).toBeLessThan(conCuadrado[2]!)

    const lineal = ks.map((k) => razon(k, fx(1)))
    expect(lineal[0]).toBe(lineal[1])
    expect(lineal[1]).toBe(lineal[2])
  })
})
