import { describe, expect, it } from 'vitest'

import {
  FIXED_MAX,
  FIXED_MIN,
  FIXED_ONE,
  FIXED_SCALE,
  fabs,
  fclamp,
  fdiv,
  fexp,
  fln,
  fmul,
  fpow,
  fx,
  unfx,
} from '../src/fixed.js'

/**
 * Los tests de `fixed.ts`. Tres clases, y las tres hacen falta:
 *
 *   1. INVARIANTES  — entero siempre, simétrico en el signo, acotado. Se barren
 *      dominios enteros, sin valores de referencia: si algo de esto se rompe, el
 *      replay diverge aunque los números den «casi» bien.
 *   2. EXACTITUD    — contra referencias que NO son `Math`. Las racionales se
 *      comparan con `BigInt`, que es exacto por construcción; las trascendentes,
 *      contra constantes conocidas escritas a mano. Usar `Math.exp` como oráculo
 *      sería testear la implementación contra lo que este módulo existe para no
 *      depender.
 *   3. CALIBRACIÓN  — que las cuentas del Hito 0 den lo mismo en punto fijo. Un
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
      const a = (rnd() % 2147484) * (rnd() % 2 ? 1 : -1)
      const b = (rnd() % 2147484) * (rnd() % 2 ? 1 : -1)
      for (const v of [fmul(a, b), fdiv(a, b), fexp(a % 15000), fln(fabs(a)), fpow(b % 4000, 2000)])
        expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('simetría de signo: f(−x) = −f(x)', () => {
    // Si esto se rompe, enfriarse deja de ser calentarse con el signo cambiado y
    // un cuerpo que cruza el cero pierde un milésimo que otro gana.
    const rnd = lcg(11)
    for (let i = 0; i < 20000; i++) {
      const a = rnd() % 2147484
      const b = (rnd() % 100000) + 1
      expect(fmul(-a, b)).toBe(-fmul(a, b))
      expect(fdiv(-a, b)).toBe(-fdiv(a, b))
      expect(fdiv(a, -b)).toBe(-fdiv(a, b))
    }
  })

  it('satura en vez de dar la vuelta o devolver NaN', () => {
    expect(fmul(FIXED_MAX, FIXED_MAX)).toBe(FIXED_MAX)
    expect(fmul(FIXED_MAX, FIXED_MIN)).toBe(FIXED_MIN)
    expect(fdiv(FIXED_MAX, 1)).toBe(FIXED_MAX)
    expect(fdiv(1000, 0)).toBe(FIXED_MAX)
    expect(fdiv(-1000, 0)).toBe(FIXED_MIN)
    expect(fdiv(0, 0)).toBe(0)
    expect(fexp(FIXED_MAX)).toBe(FIXED_MAX)
    expect(fexp(FIXED_MIN)).toBe(0)
    expect(fln(0)).toBe(FIXED_MIN)
    expect(fln(-5000)).toBe(FIXED_MIN)
  })

  it('−FIXED_MIN es representable', () => {
    // Por eso FIXED_MIN es −2147483647 y no el mínimo real de i32: con el mínimo
    // real, negar el borde se sale del rango y la simetría se rompe justo ahí.
    expect(-FIXED_MIN).toBe(FIXED_MAX)
  })

  it('es puro: la misma entrada da lo mismo siempre', () => {
    const rnd = lcg(23)
    for (let i = 0; i < 5000; i++) {
      const a = (rnd() % 2147484) * (rnd() % 2 ? 1 : -1)
      expect(fexp(a % 14000)).toBe(fexp(a % 14000))
      expect(fln(fabs(a) + 1)).toBe(fln(fabs(a) + 1))
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
    expect(unfx(2718)).toBeCloseTo(2.718, 10)
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
})

describe('fmul y fdiv son correctamente redondeadas', () => {
  it('coinciden con BigInt exacto en todo el rango', () => {
    // `a·b` de dos i32 grandes llega a 4.6e18 y el double deja de ser exacto
    // arriba de 9.0e15. Éste es el test que prueba que `mulAt` no pierde bits.
    const rnd = lcg(101)
    for (let i = 0; i < 60000; i++) {
      const a = (rnd() % 2147484) * (rnd() % 2 ? 1 : -1)
      const b = (rnd() % 2147484) * (rnd() % 2 ? 1 : -1)
      expect(fmul(a, b)).toBe(saturate(exactDivRound(BigInt(a) * BigInt(b), BigInt(FIXED_SCALE))))
    }
  })

  it('fdiv coincide con BigInt exacto', () => {
    const rnd = lcg(103)
    for (let i = 0; i < 60000; i++) {
      const a = (rnd() % 2147484) * (rnd() % 2 ? 1 : -1)
      const b = ((rnd() % 200000) + 1) * (rnd() % 2 ? 1 : -1)
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
    for (const [x, want] of TESTIGOS) expect(within(fexp(x), want, 1, 2e-7)).toBe(true)
  })

  it('para x ≤ 0 es EXACTO: coincide con el redondeo ideal', () => {
    // Es el caso de todos los factores de decaimiento —evaporación, pérdida de
    // calor, pudrición—, o sea el 99% de los usos del módulo en las doce leyes.
    for (const [x, want] of TESTIGOS) if (x <= 0) expect(fexp(x)).toBe(want)
  })

  it('es monótona no decreciente en todo el dominio', () => {
    // Sin valores de referencia: una exponencial que baja en algún punto haría
    // que enfriarse más tiempo enfríe menos, y eso se ve en el mundo aunque el
    // error absoluto sea de un milésimo.
    let prev = fexp(-7700)
    for (let x = -7699; x <= 14580; x++) {
      const v = fexp(x)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('satura en los dos bordes', () => {
    expect(fexp(14580)).toBe(FIXED_MAX)
    expect(fexp(20000)).toBe(FIXED_MAX)
    expect(fexp(-7700)).toBe(0)
    expect(fexp(-50000)).toBe(0)
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
        expect(within(fexp(a + b), fmul(fexp(a), fexp(b)), 2, 5e-3)).toBe(true)
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
    for (const [x, want] of TESTIGOS) expect(Math.abs(fln(x) - want)).toBeLessThanOrEqual(1)
  })

  it('es monótona no decreciente', () => {
    let prev = fln(1)
    for (let x = 2; x <= 120000; x++) {
      const v = fln(x)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('cumple ln(a·b) = ln a + ln b', () => {
    for (let a = 100; a <= 500000; a *= 3)
      for (let b = 100; b <= 500000; b *= 7)
        expect(Math.abs(fln(fmul(a, b)) - (fln(a) + fln(b)))).toBeLessThanOrEqual(3)
  })

  it('vuelve por donde vino: e^(ln x) ≈ x', () => {
    // La tolerancia es 1e-3 relativo y no puede ser mejor: `fln` devuelve
    // milésimos, y medio milésimo de error en el logaritmo son 5e-4 relativos
    // después de exponenciar. Es el piso de la escala, no del algoritmo.
    for (const x of [1, 10, 500, 1000, 2718, 100000, 2147483])
      expect(within(fexp(fln(x)), x, 1, 1e-3)).toBe(true)
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
    expect(fpow(0, 0)).toBe(FIXED_ONE) // el producto vacío
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
      expect(Math.abs(fpow(b, 2000) - want)).toBeLessThanOrEqual(1)
    }
  })

  it('n ≤ 8 se queda en max(n ulp, |v|·n·3e-4)', () => {
    for (let n = 1; n <= 8; n++) {
      for (let b = 1; b <= 40000; b += 13) {
        let want = BigInt(FIXED_SCALE)
        for (let i = 0; i < n; i++) want = exactDivRound(want * BigInt(b), BigInt(FIXED_SCALE))
        if (want > BigInt(FIXED_MAX)) break
        expect(within(fpow(b, n * FIXED_SCALE), Number(want), n, n * 3e-4)).toBe(true)
      }
    }
  })
})

describe('la calibración del Hito 0 sobrevive al punto fijo', () => {
  // `ii/docs/hito-0-barrido-termico.md`. Si estas cuentas se corren aunque sea un
  // grado, la ventana entre «no cocina» (63) y «se quema» (280) se mueve y el
  // barrido deja de valer.
  const EXPOSICION = { piso: fx(0.06), parrilla: fx(0.25), contacto: fx(0.6) }
  const formFactor = (d: number, exposicion: number) => fdiv(exposicion, fx(1) + fmul(d, d))
  const tEq = (potencia: number, d: number, exposicion: number) =>
    fx(15) + fdiv(fmul(potencia, formFactor(d, exposicion)), fx(0.5))

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
    // Las dos tasas van reescaladas ×1000 (0.6 en vez de 0.0006, 10 en vez de
    // 0.010): a escala 1000 las originales son cero. La razón es adimensional,
    // así que el reescalado no la toca.
    const toughness = fx(0.3)
    const razon = (k: number, exponente: number) => {
      const evap = fmul(fx(0.6), fpow(k, exponente))
      const coccion = fdiv(fmul(fx(10), k), fx(0.2) + toughness)
      return fdiv(evap, coccion)
    }
    const ks = [fx(0.27), fx(0.75), fx(1.59)] // parrilla d2, parrilla d1, brasas

    const conCuadrado = ks.map((k) => razon(k, fx(2)))
    expect(conCuadrado[0]!).toBeLessThan(conCuadrado[1]!)
    expect(conCuadrado[1]!).toBeLessThan(conCuadrado[2]!)

    const lineal = ks.map((k) => razon(k, fx(1)))
    expect(lineal[0]).toBe(lineal[1])
    expect(lineal[1]).toBe(lineal[2])
  })

  it('deja escrito el piso de resolución que las leyes tienen que esquivar', () => {
    // La evaporación literal de la ley 5, `0.0006·k²`, es CERO en escala 1000
    // para todo k razonable. No es un bug de este módulo: es que `FIXED_SCALE`
    // vale 1000. Quien escriba la ley 5 tiene que acumular en una cuenta más
    // fina o llevar la tasa reescalada. Este test está para que se entere acá y
    // no depurando por qué un pescado nunca pierde agua.
    expect(fx(0.0006)).toBe(1) // 0.0006 ya se redondea a 0.001
    expect(fmul(fx(0.0006), fpow(fx(0.27), fx(2)))).toBe(0)
    expect(fmul(fx(0.0006), fpow(fx(1.59), fx(2)))).toBe(3) // recién acá deja de ser cero
  })
})
