import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import {
  FUEL_LEFT,
  OutOfFuel,
  countInjectionPoints,
  instrument,
  isSuspension,
  mount,
  type FuelCell,
} from '../src/combustible.js'

/**
 * EL COMBUSTIBLE — Hito 4.
 *
 * Lo que se verifica acá es lo que el ADR II-0005 dejó escrito como requisito y
 * lo que el documento de arquitectura promete del sandbox:
 *
 *   - la inyección va EN LÍNEA y no como llamada (1,5× gratis, medido);
 *   - se instrumentan TAMBIÉN las entradas de función (si no, la recursión
 *     infinita muere por `RangeError` y no por combustible);
 *   - un `while (true)` plantado se corta;
 *   - y la suspensión es REANUDABLE, que es lo que QuickJS no podía dar: la
 *     habilidad sigue en el mismo punto, no vuelve a empezar.
 *
 * El presupuesto —los milisegundos— se mide aparte, en `presupuesto.test.ts`.
 */

/** Compila e instala en un alcance cerrado, que es como lo hace el ejecutor. */
function montar(fuente: string, scope: Record<string, unknown> = {}): {
  cell: FuelCell
  exports: Record<string, unknown>
  js: string
} {
  const { js } = instrument(ts, fuente)
  return { ...mount(js, { scope }), js }
}

describe('el transformer inyecta donde tiene que inyectar', () => {
  const FUENTE = `
    export function elegir(cuerpos: { m: number }[]): number {
      let mejor = -1
      for (const c of cuerpos) { if (c.m > mejor) mejor = c.m }
      return mejor
    }
  `

  it('la comprobación va EN LÍNEA, no como llamada a función', () => {
    // El hallazgo 1 del banco del Hito 0, ascendido a requisito por el ADR
    // II-0005: pasar de `__fuel()` a la comprobación desnuda bajó el overhead de
    // 33% a 22%. Un tercio del costo era la llamada.
    const { js } = montar(FUENTE)
    expect(js).toContain(`--${FUEL_LEFT} < 0`)
    expect(js).not.toMatch(/\b__fuel\(\)/)
  })

  it('cuenta un punto por back-edge y uno por entrada de función', () => {
    // Dos puntos: la función y el `for…of`. Y los puntos contados tienen que ser
    // exactamente los inyectados, porque ese número es el que va al informe del
    // juez: si mintiera, el presupuesto de una habilidad sería una estimación.
    const { js } = montar(FUENTE)
    const puntos = countInjectionPoints(ts, FUENTE)
    expect(puntos).toBe(2)
    expect(js.split(`--${FUEL_LEFT} < 0`).length - 1).toBe(puntos)
  })

  it('instrumenta la flecha de cuerpo de expresión envolviéndola', () => {
    const { js } = montar('export const doble = (x: number) => x * 2')
    expect(js).toContain(`--${FUEL_LEFT} < 0`)
    expect(js).toContain('return x * 2')
  })

  it('no cambia lo que el programa calcula', () => {
    const { cell, exports } = montar(FUENTE)
    cell.refill(1_000_000)
    const elegir = exports['elegir'] as (c: { m: number }[]) => number
    expect(elegir([{ m: 3 }, { m: 9 }, { m: 1 }])).toBe(9)
  })
})

describe('de verdad corta', () => {
  it('un `while (true)` en una función común muere por combustible', () => {
    const { cell, exports } = montar('export function colgar() { let n = 0; while (true) { n++ } }')
    cell.refill(50_000)
    expect(() => (exports['colgar'] as () => void)()).toThrow(OutOfFuel)
    // Y consumió su tanque: el corte fue por presupuesto y no por otra cosa.
    expect(cell.left).toBeLessThan(0)
  })

  it('la recursión infinita muere por COMBUSTIBLE y no por RangeError', () => {
    // Es la razón por la que el ADR II-0005 conservó la instrumentación de las
    // entradas de función: sacarla no ahorraba nada medible (52,6% → 51,9%) y
    // cambiaba la causa de muerte por una que no se puede administrar.
    const { cell, exports } = montar('export function hondo(n: number): number { return hondo(n + 1) }')
    cell.refill(2_000)
    let atrapado: unknown
    try {
      ;(exports['hondo'] as (n: number) => number)(0)
    } catch (e) {
      atrapado = e
    }
    expect(atrapado).toBeInstanceOf(OutOfFuel)
    expect(atrapado).not.toBeInstanceOf(RangeError)
  })

  it('el tanque es un tope y no una factura: recargar deja seguir', () => {
    const { cell, exports } = montar('export function contar(n: number) { let s = 0; for (let i = 0; i < n; i++) s += i; return s }')
    cell.refill(10)
    expect(() => (exports['contar'] as (n: number) => number)(1000)).toThrow(OutOfFuel)
    cell.refill(10_000)
    expect((exports['contar'] as (n: number) => number)(1000)).toBe(499_500)
  })
})

describe('la suspensión es reanudable, que es lo que QuickJS no podía dar', () => {
  // `local` es la clave del test de abajo: vive en el stack del generador, así
  // que si la reanudación fuera «correr la habilidad otra vez desde arriba»
  // volvería a cero y la caja dejaría de crecer.
  const CONTADOR = `
    export function* contar(caja: { n: number }) {
      let local = 0
      while (true) { local++; caja.n = local }
    }
  `

  it('un bucle infinito en el cuerpo de la habilidad CEDE en vez de lanzar', () => {
    const { cell, exports } = montar(CONTADOR)
    cell.refill(20)
    const caja = { n: 0 }
    const g = (exports['contar'] as (c: { n: number }) => Generator<unknown>)(caja)
    const r = g.next()
    expect(r.done).toBe(false)
    expect(isSuspension(r.value)).toBe(true)
    expect(caja.n).toBeGreaterThan(0)
  })

  it('reanuda EN EL MISMO PUNTO: no vuelve a empezar', () => {
    // Éste es el test que separa este diseño del que el documento descartó. Con
    // `setInterruptHandler` de QuickJS el generador queda `completed` para
    // siempre y «reanudar» significa correr la habilidad otra vez desde arriba.
    const { cell, exports } = montar(CONTADOR)
    const caja = { n: 0 }
    const g = (exports['contar'] as (c: { n: number }) => Generator<unknown>)(caja)
    cell.refill(20)
    g.next()
    const tras1 = caja.n
    cell.refill(20)
    g.next()
    const tras2 = caja.n
    expect(tras1).toBeGreaterThan(0)
    // Si la reanudación reiniciara la habilidad, `local` volvería a cero y la
    // segunda vuelta terminaría en el mismo número que la primera.
    expect(tras2).toBeGreaterThan(tras1)
    // Y el trabajo de la segunda vuelta es al menos el de la primera: el tanque
    // se recarga entero y nada se gastó en volver a llegar hasta acá.
    expect(tras2 - tras1).toBeGreaterThanOrEqual(tras1)
  })

  it('cede en `while`, `do` y `for`, y NUNCA adentro de un `for…of`', () => {
    // La excepción medida: un `yield` adentro de un `for…of` cuesta 13× (2,023
    // contra 0,366 ms en la carga del banco) porque el punto de suspensión
    // obliga a que el iterador sobreviva, y V8 pierde el camino rápido de
    // iteración de arrays. Y no compra nada: un `for…of` recorre una colección
    // que ya existe, o sea que termina. El número está en `presupuesto.test.ts`.
    const { js } = montar(`
      export function* habilidad(xs: number[]) {
        while (xs.length) { xs.pop() }
        do { xs.pop() } while (xs.length)
        for (let i = 0; i < 3; i++) { xs.push(i) }
        for (const x of xs) { xs.push(x) }
        for (const k in xs) { xs.push(Number(k)) }
      }
    `)
    const inyecciones = js.split(`--${FUEL_LEFT} < 0`).length - 1
    const cesiones = js.split('yield __fuelSuspend').length - 1
    const throws = js.split(`${'__fuelOut'}()`).length - 1
    expect(inyecciones).toBe(6) // entrada + cinco bucles
    expect(cesiones).toBe(4) // entrada, while, do, for
    expect(throws).toBe(2) // for…of y for…in
  })

  it('y un `while (true)` adentro de un `for…of` sigue suspendiendo', () => {
    // Es el caso que la regla alternativa —«ceder solo en bucles de primer
    // nivel»— habría sacrificado, y es justo el peligroso.
    const { cell, exports } = montar(`
      export function* habilidad(caja: { n: number }) {
        for (const x of [1, 2, 3]) { while (true) { caja.n += x } }
      }
    `)
    cell.refill(30)
    const g = (exports['habilidad'] as (c: { n: number }) => Generator<unknown>)({ n: 0 })
    expect(isSuspension(g.next().value)).toBe(true)
  })

  it('un generador auxiliar delegado con `yield*` también suspende', () => {
    const { cell, exports } = montar(`
      function* auxiliar(caja: { n: number }) { while (true) { caja.n++ } }
      export function* habilidad(caja: { n: number }) { yield* auxiliar(caja) }
    `)
    cell.refill(20)
    const caja = { n: 0 }
    const g = (exports['habilidad'] as (c: { n: number }) => Generator<unknown>)(caja)
    expect(isSuspension(g.next().value)).toBe(true)
    expect(caja.n).toBeGreaterThan(0)
  })

  it('adentro de una flecha NO puede ceder, y ahí sí lanza', () => {
    // `yield` solo es legal en el cuerpo de un generador: la gramática de
    // ECMAScript no lo permite adentro de una flecha aunque esté escrita adentro
    // de la habilidad. Que ahí muera por `OutOfFuel` es la mitad honesta de la
    // promesa del documento, y está dicha en el encabezado de `combustible.ts`.
    const { cell, exports } = montar(`
      export function* habilidad(caja: { n: number }) {
        const machacar = () => { while (true) { caja.n++ } }
        machacar()
        yield 1
      }
    `)
    cell.refill(50)
    const g = (exports['habilidad'] as (c: { n: number }) => Generator<unknown>)({ n: 0 })
    expect(() => g.next()).toThrow(OutOfFuel)
  })
})

describe('el montaje cierra el alcance', () => {
  it('el nombre sombreado gana sobre el global', () => {
    const { cell, exports } = montar('export function que() { return typeof Date }', {
      Date: undefined,
    })
    cell.refill(100)
    expect((exports['que'] as () => string)()).toBe('undefined')
  })

  it('un import que no está en la lista lanza al montar', () => {
    const { js } = instrument(ts, "import { fail } from 'afuera'\nexport const x = fail")
    expect(() => mount(js, {})).toThrow(/importa "afuera"/)
  })

  it('el alcance puede servir los módulos que el sandbox sí tiene', () => {
    const { js } = instrument(ts, "import { saludo } from 'api'\nexport function hola() { return saludo }")
    const m = mount(js, { modules: { api: { saludo: 'hola' } } })
    m.cell.refill(100)
    expect((m.exports['hola'] as () => string)()).toBe('hola')
  })

  it('una sombra no puede pisar los nombres del andamio', () => {
    // Si una habilidad pudiera atar su propio `__fuelLeft`, se estaría comprando
    // el presupuesto de la casa.
    const { js } = instrument(ts, 'export const x = 1')
    expect(() => mount(js, { scope: { [FUEL_LEFT]: 1e9 } })).toThrow(/andamio/)
  })
})
