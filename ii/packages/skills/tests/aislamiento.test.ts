import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { instrument, mount } from '../src/combustible.js'
import { FORBIDDEN_GLOBALS, ForbiddenError, safeMath, scanDeterminism, shadowScope } from '../src/aislamiento.js'

/**
 * EL AISLAMIENTO — Hito 4.
 *
 * La regla 2 de `ii/README.md` hecha cumplir sobre código que no escribimos
 * nosotros. Se verifica de las dos maneras que hacen falta, porque ninguna sola
 * alcanza: por ALCANCE (lo que no existe adentro del sandbox) y por ESCÁNER (lo
 * que ninguna sombra puede tapar, como el operador `**`).
 *
 * El criterio de fondo es el del documento: si `Math.pow` devuelve el último bit
 * distinto en dos motores, el replay diverge en el tick 400 y el juez —que
 * compara dos versiones de una habilidad en mundos gemelos— deja de significar
 * nada.
 */

/** Corre un fuente adentro del sandbox de verdad, con las sombras puestas. */
function correr(fuente: string): unknown {
  const { js } = instrument(ts, fuente)
  const m = mount(js, { scope: shadowScope() })
  m.cell.refill(100_000)
  return (m.exports['probar'] as () => unknown)()
}

describe('lo que no existe adentro del sandbox', () => {
  it('`Date` no existe, y el error dice con qué reemplazarlo', () => {
    expect(() => correr('export function probar() { return new Date().getTime() }')).toThrow(ForbiddenError)
    expect(() => correr('export function probar() { return new Date().getTime() }')).toThrow(/ctx\.clock/)
  })

  it('`Math.random` no existe, y manda a `ctx.rng`', () => {
    expect(() => correr('export function probar() { return Math.random() }')).toThrow(/ctx\.rng/)
  })

  it('`Math.pow` y `Math.exp` no existen, y mandan a `ctx.math`', () => {
    expect(() => correr('export function probar() { return Math.pow(2, 3) }')).toThrow(/ctx\.math/)
    expect(() => correr('export function probar() { return Math.exp(1) }')).toThrow(/ctx\.math/)
  })

  it('lo que SÍ está especificado exactamente sigue funcionando', () => {
    // Una caja que rechaza todo es trivialmente segura y completamente inútil.
    // `floor`, `min`, `abs` e `imul` están definidos con operaciones exactas
    // sobre el double: dan lo mismo en toda máquina y se quedan.
    expect(correr('export function probar() { return Math.floor(3.7) + Math.min(2, 5) + Math.abs(-1) }')).toBe(6)
    expect(correr('export function probar() { return Math.imul(65535, 65535) }')).toBe(Math.imul(65535, 65535))
  })

  it('`fetch`, `setTimeout` y `globalThis` no se pueden usar', () => {
    // Usarlos, no nombrarlos: la sombra es un objeto que lanza EN CUANTO SE LO
    // TOCA —llamarlo, construirlo o leerle una propiedad—, y eso está dicho en
    // el encabezado de `aislamiento.ts` junto con su contra (existe para
    // `typeof`).
    const usos = [
      "export function probar() { return fetch('http://x') }",
      'export function probar() { return setTimeout(() => 1, 0) }',
      'export function probar() { return globalThis.Date }',
      'export function probar() { return performance.now() }',
    ]
    for (const uso of usos) expect(() => correr(uso), uso).toThrow(ForbiddenError)
  })

  it('sombrear no toca nada global: afuera del sandbox `Date` sigue estando', () => {
    // Es la razón por la que las sombras son PARÁMETROS y no borrados: el mundo
    // y la UI corren en el mismo hilo que la habilidad, y parchear un
    // intrínseco los rompería a los dos junto con ella.
    expect(() => correr('export function probar() { return new Date() }')).toThrow()
    expect(typeof Date).toBe('function')
  })

  it('cada sombra dice qué usar en su lugar', () => {
    // Un mensaje sin reemplazo se come un viaje al modelo para descubrir algo
    // que ya sabíamos.
    for (const [nombre, instead] of Object.entries(FORBIDDEN_GLOBALS)) {
      expect(instead.length, `${nombre} no explica con qué reemplazarlo`).toBeGreaterThan(10)
    }
  })

  it('`safeMath` no expone ninguna trascendente', () => {
    const m = safeMath()
    for (const prohibida of ['random', 'exp', 'pow', 'log', 'sin', 'cos', 'sqrt', 'hypot']) {
      expect(() => (m as Record<string, unknown>)[prohibida]).toThrow(ForbiddenError)
    }
  })
})

describe('el escáner ataja lo que el alcance no puede tapar', () => {
  it('el operador `**` es sintaxis: ninguna sombra lo alcanza', () => {
    const h = scanDeterminism(ts, 'export const y = (x: number) => x ** 2')
    expect(h.map((f) => f.what)).toContain('**')
    expect(h[0]?.why).toMatch(/ctx\.math\.pow/)
  })

  it('`localeCompare` y `toLocaleString` son métodos de prototipo', () => {
    const h = scanDeterminism(ts, 'export const f = (a: string, b: string) => a.localeCompare(b)')
    expect(h.map((f) => f.what)).toContain('.localeCompare()')
    const g = scanDeterminism(ts, 'export const f = (n: number) => n.toLocaleString()')
    expect(g.map((f) => f.what)).toContain('.toLocaleString()')
  })

  it('marca `Math.random` antes de correr un solo tick', () => {
    const h = scanDeterminism(ts, 'export const f = () => Math.random()')
    expect(h.map((f) => f.what)).toContain('Math.random')
    expect(h[0]?.line).toBe(1)
  })

  it('marca los globals prohibidos, con línea y columna', () => {
    const h = scanDeterminism(ts, 'export function f() {\n  return Date.now()\n}')
    expect(h).toHaveLength(1)
    expect(h[0]?.what).toBe('Date')
    expect(h[0]?.line).toBe(2)
    expect(h[0]?.column).toBe(10)
  })

  it('no marca un nombre que el propio fuente declara', () => {
    // Sin esto, una habilidad con una variable llamada `location` sería
    // rechazada por algo que no hizo. El falso positivo es más caro que el
    // falso negativo acá: el alcance de `mount()` ataja igual en ejecución.
    expect(scanDeterminism(ts, 'export function f() { const location = 3; return location }')).toEqual([])
  })

  it('no marca una PROPIEDAD que se llame igual que un global', () => {
    expect(scanDeterminism(ts, 'export const f = (o: { Date: number }) => o.Date')).toEqual([])
  })

  it('rechaza que una habilidad se compre el contador de la casa', () => {
    const h = scanDeterminism(ts, 'export function f() { let __fuelLeft = 1e9; return __fuelLeft }')
    expect(h.length).toBeGreaterThan(0)
    expect(h[0]?.why).toMatch(/combustible/)
  })

  it('devuelve TODOS los hallazgos, no el primero', () => {
    // El bucle de reparación arregla de a un viaje: darle los cuatro problemas
    // juntos es la diferencia entre una reparación y cuatro.
    const h = scanDeterminism(
      ts,
      'export function f(a: string, b: string) {\n  const t = Date.now()\n  const r = Math.random()\n  const p = 2 ** 3\n  return a.localeCompare(b) + t + r + p\n}',
    )
    expect(h.length).toBe(4)
  })

  it('una habilidad honesta no tiene ni un hallazgo', () => {
    // La otra mitad del trabajo: una puerta que rechaza todo no sirve. Éste es
    // el cuerpo del ejemplo canónico del documento, con sus cuentas.
    const h = scanDeterminism(
      ts,
      `export function* pescar(ctx: any, args: any) {
         ctx.phase('buscar-agua')
         const agua = ctx.see([{ q: 'wet', op: '>=', v: 0.9 }])[0]
         if (!agua) return { ok: false, why: 'no hay agua' }
         ctx.memory.set('pozo', agua.at)
         const dx = agua.at.x - ctx.self.at.x
         const dy = agua.at.y - ctx.self.at.y
         const lejos = dx * dx + dy * dy
         for (let i = 0; i < 40; i++) {
           const o = yield ctx.apply('extraccion', { gear: args.con, source: agua })
           if (o.got.length > 0) return { ok: true, got: o.got[0], lejos }
         }
         return { ok: false, why: 'no picó' }
       }`,
    )
    expect(h).toEqual([])
  })
})
