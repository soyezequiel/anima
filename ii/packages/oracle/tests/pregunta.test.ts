import { describe, expect, it } from 'vitest'

import {
  diosElegir,
  diosEntero,
  diosFixed,
  diosOcurre,
  fnv1a,
  keyOf,
  LARGO_MAXIMO_DE_ID,
  LIMITE_DE_CHUNK,
  mulberry32,
  RANGO_MAXIMO,
  rngFor,
  semillaDeDominio,
  type Question,
  type WorldRng,
} from '../src/pregunta.js'

const SEMILLA = 12345n

describe('keyOf — la clave canónica', () => {
  it('tiene una forma estable, que es formato de guardado', () => {
    // Estos textos entran en la crónica y en los guardados. Si cambian, todas
    // las partidas guardadas dejan de encontrar sus compromisos: el test está
    // para que ese cambio sea una decisión y no un accidente.
    expect(keyOf({ k: 'chunk', cx: 3, cy: -7 })).toBe('c:3:-7')
    expect(keyOf({ k: 'waterBody', id: 'w17' })).toBe('w:w17')
    expect(keyOf({ k: 'draw', stock: 'w17-pez', n: 4 })).toBe('d:w17-pez:4')
    expect(keyOf({ k: 'novelty', topic: 'hongo-de-cueva', nonce: 0 })).toBe('n:hongo-de-cueva:0')
  })

  it('el cero negativo no abre una segunda clave para el mismo chunk', () => {
    expect(keyOf({ k: 'chunk', cx: -0, cy: 0 })).toBe(keyOf({ k: 'chunk', cx: 0, cy: 0 }))
  })

  it('es inyectiva sobre un barrido de preguntas vecinas', () => {
    const vistas = new Map<string, string>()
    const preguntas: Question[] = []
    for (let cx = -3; cx <= 3; cx++) for (let cy = -3; cy <= 3; cy++) preguntas.push({ k: 'chunk', cx, cy })
    for (const id of ['a', 'b', 'a1', '1a', '11']) preguntas.push({ k: 'waterBody', id })
    for (const stock of ['a', 'b', 'a1']) for (const n of [0, 1, 11]) preguntas.push({ k: 'draw', stock, n })
    for (const topic of ['a', 'b', 'a1']) for (const nonce of [0, 1, 11]) preguntas.push({ k: 'novelty', topic, nonce })
    for (const q of preguntas) {
      const k = keyOf(q)
      const antes = vistas.get(k)
      expect(antes, `colisión de clave «${k}» entre ${String(antes)} y ${JSON.stringify(q)}`).toBeUndefined()
      vistas.set(k, JSON.stringify(q))
    }
    expect(vistas.size).toBe(preguntas.length)
  })

  it('rechaza los separadores adentro de un id, que son la forma de romper la inyectividad', () => {
    expect(() => keyOf({ k: 'draw', stock: 'a:1', n: 2 })).toThrow(/separador/)
    expect(() => keyOf({ k: 'waterBody', id: 'a|b' })).toThrow(/separador/)
    expect(() => keyOf({ k: 'novelty', topic: '', nonce: 0 })).toThrow(/vacío/)
    expect(() => keyOf({ k: 'novelty', topic: 'x'.repeat(LARGO_MAXIMO_DE_ID + 1), nonce: 0 })).toThrow(/techo/)
  })

  it('rechaza coordenadas que no son enteros o que se van del mundo', () => {
    expect(() => keyOf({ k: 'chunk', cx: 1.5, cy: 0 })).toThrow(/entero/)
    expect(() => keyOf({ k: 'chunk', cx: Number.NaN, cy: 0 })).toThrow(/entero/)
    expect(() => keyOf({ k: 'chunk', cx: LIMITE_DE_CHUNK, cy: 0 })).toThrow(/rango/)
    expect(() => keyOf({ k: 'draw', stock: 'a', n: -1 })).toThrow(/rango/)
  })
})

describe('el dado del dios', () => {
  it('no depende de cuándo ni en qué orden se preguntó', () => {
    const q: Question = { k: 'chunk', cx: 4, cy: 9 }
    const primero = [...Array<number>(8)].map(() => rngFor(q, SEMILLA)())

    // Entre medio pasa OTRA historia: se decretan otros chunks, se saca de otro
    // stock, se inventa una novedad. Nada de eso puede haber tocado el dado de
    // esta pregunta, porque no hay ningún dado compartido que tocar.
    for (let i = 0; i < 50; i++) rngFor({ k: 'chunk', cx: i, cy: -i }, SEMILLA)()
    for (let i = 0; i < 50; i++) rngFor({ k: 'draw', stock: 'otro', n: i }, SEMILLA)()
    rngFor({ k: 'novelty', topic: 'algo', nonce: 3 }, SEMILLA)()

    const despues = [...Array<number>(8)].map(() => rngFor(q, SEMILLA)())
    expect(despues).toEqual(primero)
  })

  it('la secuencia de un dado avanza, pero cada dado nuevo arranca igual', () => {
    const a = rngFor({ k: 'chunk', cx: 0, cy: 0 }, SEMILLA)
    const uno = a()
    const dos = a()
    expect(uno).not.toBe(dos)
    const b = rngFor({ k: 'chunk', cx: 0, cy: 0 }, SEMILLA)
    expect(b()).toBe(uno)
    expect(b()).toBe(dos)
  })

  it('dos semillas distintas dan mundos distintos, y dos claves vecinas también', () => {
    const q: Question = { k: 'chunk', cx: 0, cy: 0 }
    expect(rngFor(q, 1n)()).not.toBe(rngFor(q, 2n)())
    expect(rngFor({ k: 'chunk', cx: 0, cy: 0 }, SEMILLA)()).not.toBe(rngFor({ k: 'chunk', cx: 0, cy: 1 }, SEMILLA)())
  })

  it('el dado del MUNDO no entra donde va el del dios, y eso lo verifica `tsc`', () => {
    // El criterio de la marca nominal no es de tiempo de ejecución: los dos son
    // `() => number` y en runtime funcionaría igual. Lo que tiene que fallar es
    // la COMPILACIÓN, y `@ts-expect-error` falla el typecheck del paquete si
    // algún día deja de fallar — o sea que el día que alguien fusione los dos
    // tipos, este test se pone rojo en `tsc`, no en vitest.
    const delMundo = ((): number => 0) as unknown as WorldRng
    // @ts-expect-error el decretador no tiene acceso léxico al dado del mundo
    const v = diosEntero(delMundo, 0, 0)
    expect(v).toBe(0)
    // Y el del dios sí entra, que es la otra mitad: una marca que no deja pasar
    // nada es tan inútil como no tenerla.
    expect(diosEntero(mulberry32(1), 0, 0)).toBe(0)
  })

  it('entrega valores en [0, 1) y nunca un NaN', () => {
    const rng = mulberry32(0)
    for (let i = 0; i < 5000; i++) {
      const v = rng()
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('la semilla de dominio descorrelaciona de verdad, y el `^` del documento no', () => {
    // La forma del documento (`seed ^ 0xA1n`) mueve solo los bits bajos: dos
    // sales chicas dejan casi toda la semilla igual. Esto verifica que la
    // mezcla por FNV separa los dominios aunque las sales sean vecinas.
    const a = semillaDeDominio(SEMILLA, 'humedad')
    const b = semillaDeDominio(SEMILLA, 'humedae')
    expect(a).not.toBe(b)
    expect(Math.abs(a - b)).toBeGreaterThan(1000)
  })

  it('fnv1a no colisiona sobre las claves de un barrido de chunks', () => {
    const vistos = new Set<number>()
    for (let cx = -40; cx <= 40; cx++) {
      for (let cy = -40; cy <= 40; cy++) vistos.add(fnv1a(keyOf({ k: 'chunk', cx, cy })))
    }
    expect(vistos.size).toBe(81 * 81)
  })
})

describe('sacar cosas del dado', () => {
  it('`diosEntero` cubre el rango y no se sale', () => {
    const rng = mulberry32(7)
    const vistos = new Set<number>()
    for (let i = 0; i < 4000; i++) {
      const v = diosEntero(rng, -3, 3)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(-3)
      expect(v).toBeLessThanOrEqual(3)
      vistos.add(v)
    }
    expect(vistos.size).toBe(7)
  })

  it('`diosEntero` lanza en vez de perder exactitud', () => {
    const rng = mulberry32(1)
    expect(() => diosEntero(rng, 0, RANGO_MAXIMO)).toThrow(/exacto/)
    expect(() => diosEntero(rng, 5, 1)).toThrow(/dado vuelta/)
  })

  it('`diosFixed` entrega [0, 1] en milésimas enteras', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 2000; i++) {
      const v = diosFixed(rng)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1000)
    }
  })

  it('`diosOcurre` respeta la probabilidad de los extremos, que son las que importan', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 500; i++) {
      expect(diosOcurre(rng, 0)).toBe(false)
      expect(diosOcurre(rng, 1000)).toBe(true)
    }
  })

  it('`diosElegir` respeta los pesos y no se cae en el borde', () => {
    const rng = mulberry32(11)
    const cuenta = new Map<string, number>()
    for (let i = 0; i < 6000; i++) {
      const q = diosElegir(rng, [
        { peso: 1, qué: 'raro' },
        { peso: 9, qué: 'común' },
      ])
      cuenta.set(q, (cuenta.get(q) ?? 0) + 1)
    }
    const raro = cuenta.get('raro') ?? 0
    const comun = cuenta.get('común') ?? 0
    expect(raro + comun).toBe(6000)
    expect(comun).toBeGreaterThan(raro * 4)
    expect(raro).toBeGreaterThan(0)
  })

  it('`diosElegir` con una sola opción siempre la devuelve', () => {
    const rng = mulberry32(13)
    for (let i = 0; i < 100; i++) expect(diosElegir(rng, [{ peso: 1, qué: 'única' }])).toBe('única')
  })
})
