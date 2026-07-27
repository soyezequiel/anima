// ─── ATAQUE AL DIOS ──────────────────────────────────────────────────────────
//
// Este archivo no verifica el criterio: **busca que el dios se contradiga**. Los
// tests de cada agente prueban que su pieza hace lo que quiso; éste prueba lo
// otro, que es lo que rompe los mundos guardados: que dos caminos distintos
// hasta el mismo hecho den la misma respuesta, que el orden no importe, que el
// azar de una capa no se filtre en la otra y que ningún reloj de pared se meta
// en una cuenta del mundo.
//
// La forma de la caza es siempre la misma: **hacer dos veces lo mismo por
// caminos distintos y comparar bit a bit**. Un dios que se contradice no tira
// una excepción; devuelve un número plausible y equivocado, y el síntoma
// aparece mil ticks después en otro archivo.
//
// Lo que quedó ROTO y no se pudo arreglar acá está en `it.fails`, con el porqué
// al lado y con lo que haría falta para cerrarlo. Un `it.fails` es una deuda
// escrita en el arnés: el día que alguien la arregle, el test pasa a verde y
// vitest avisa que hay que sacarle el `.fails`.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Body } from '@anima/physics'
import { buildSeedPhysics, fx, seg, SEED_PROCESSES, unir } from '@anima/physics'

import type { ChunkDecretado, DiosRng, Stock, WorldRng } from '../src/index.js'
import {
  CELDAS_DE_LADO,
  CELDAS_POR_CHUNK,
  caloricBudget,
  climaDe,
  crearStock,
  decretarChunk,
  draw,
  keyOf,
  Ledger,
  mulberry32,
  population,
  probabilidadDePicar,
  resolveChunk,
  rngFor,
  textFingerprint,
  tieneAgua,
  waterBodyKey,
  WaterBodies,
  type MundoConDado,
} from '../src/index.js'

const PHYS = buildSeedPhysics()
const SEMILLA = 20260727n

function decretar(seed: bigint, cx: number, cy: number): ChunkDecretado {
  return decretarChunk(seed, cx, cy, SEED_PROCESSES, PHYS)
}

function huella(c: ChunkDecretado): string {
  const p: string[] = [c.bioma.id, `o${String(c.orilla ?? -1)}`, `cal${String(c.presupuestoCalorico)}`]
  for (let i = 0; i < CELDAS_POR_CHUNK; i++) p.push(`${String(c.terreno.wet[i])}/${String(c.terreno.cover[i])}`)
  for (const s of c.sueltas) p.push(`${s.substance}@${String(s.i)}#${String(s.masa)}`)
  return textFingerprint(p.join('|'))
}

const VARA: Body = { id: 'v', form: 'vara', parts: [{ substance: 'madera', mass: 1, q: {} }], joints: [], state: {} }
const HEBRA: Body = { id: 'h', form: 'hebra', parts: [{ substance: 'liana', mass: 0.3, q: {} }], joints: [], state: {} }
const CAÑA = unir(VARA, undefined, HEBRA, PHYS, 'c')!

function dadoDelMundo(valores: readonly number[]): { w: MundoConDado; tiros: () => number } {
  let i = 0
  const f = ((): number => {
    const v = valores[i % valores.length]!
    i += 1
    return v
  }) as WorldRng
  return { w: { phys: PHYS, rng: f }, tiros: () => i }
}

function rio(): Stock {
  return crearStock({
    id: 'rio',
    yields: 'pescado',
    capacity: 12,
    perMillePorSegundo: 500,
    depth: fx(2),
    atSecond: seg(0),
    amount: 12,
  })
}

// ─── 1. La misma clave desde dos caminos distintos ─────────────────────────

describe('ataque 1 · la misma clave por dos caminos', () => {
  it('`waterBodyKey` y `keyOf` escriben la misma clave, y el ledger la ve como una sola', () => {
    const led = new Ledger()
    const agua = new WaterBodies(led)
    agua.addWater(3, 4)
    const id = agua.bodyAt(3, 4)!
    expect(waterBodyKey(id)).toBe(keyOf({ k: 'waterBody', id }))

    // Camino A: por el agua. Camino B: por el ledger, con la pregunta armada a
    // mano. El segundo NO puede volver a llamar a la ley.
    const a = agua.ask(id, () => ({ especie: 'mojarras' }))
    let volvioALlamar = false
    const b = led.ask({ k: 'waterBody', id }, () => {
      volvioALlamar = true
      return { especie: 'otra-cosa' }
    })
    expect(volvioALlamar).toBe(false)
    expect(b).toEqual(a)
    expect(led.entries().length).toBe(1)
    led.verify()
  })

  it('el mismo chunk por tres caminos: `resolveChunk`, `decretarChunk` y el ledger', () => {
    const led = new Ledger()
    const directo = resolveChunk(SEMILLA, 2, -3)
    const decretado = decretar(SEMILLA, 2, -3)
    const porLey = led.ask({ k: 'chunk', cx: 2, cy: -3 }, () => resolveChunk(SEMILLA, 2, -3))
    expect(decretado.bioma.id).toBe(directo.bioma.id)
    expect(porLey.clima).toEqual(directo.clima)
    expect(decretado.clima).toEqual(directo.clima)
    expect(decretado.presupuestoCalorico).toBe(directo.presupuestoCalorico)
    // Lo único que agrega el decreto es lo que la garantía sembró.
    expect(decretado.sueltas.length).toBe(directo.sueltas.length + decretado.sembradas.length)
  })

  it('dos preguntas distintas NUNCA comparten clave: 400 vecinas, 400 claves', () => {
    const claves = new Set<string>()
    let n = 0
    for (let i = -5; i <= 5; i++) {
      for (let j = -5; j <= 5; j++) {
        claves.add(keyOf({ k: 'chunk', cx: i, cy: j }))
        n++
      }
    }
    for (let i = 0; i < 40; i++) {
      claves.add(keyOf({ k: 'waterBody', id: `${String(i)},0` }))
      claves.add(keyOf({ k: 'draw', stock: 'a', n: i }))
      claves.add(keyOf({ k: 'draw', stock: `a${String(i)}`, n: 0 }))
      claves.add(keyOf({ k: 'novelty', topic: 'a', nonce: i }))
      n += 4
    }
    expect(claves.size).toBe(n)
    expect(n).toBe(281)
  })

  it('el ataque a la inyectividad: los separadores no se pueden meter adentro de un id', () => {
    // Sin esta defensa, `{draw, stock:'a:1', n:2}` y `{draw, stock:'a', n:...}`
    // podrían escribir la misma cadena, y dos hechos del mundo compartirían
    // dado: el río y la cueva de al lado decidiéndose con la misma tirada.
    expect(() => keyOf({ k: 'draw', stock: 'a:1', n: 2 })).toThrow(RangeError)
    expect(() => keyOf({ k: 'draw', stock: 'a|1', n: 2 })).toThrow(RangeError)
    expect(() => keyOf({ k: 'waterBody', id: 'x:y' })).toThrow(RangeError)
    expect(() => keyOf({ k: 'novelty', topic: 'a|b', nonce: 1 })).toThrow(RangeError)
    expect(() => keyOf({ k: 'chunk', cx: 1.5, cy: 0 })).toThrow(RangeError)
    expect(() => keyOf({ k: 'novelty', topic: 'x'.repeat(129), nonce: 0 })).toThrow(RangeError)
    // Y la semilla se separa de la clave con `|`, así que dos partidas no pueden
    // pisarse: seed 1 con `2:x` no es seed 12 con `:x`.
    const a = rngFor({ k: 'novelty', topic: 'x', nonce: 1 }, 1n)
    const b = rngFor({ k: 'novelty', topic: 'x', nonce: 1 }, 12n)
    expect(a()).not.toBe(b())
  })

  it.fails(
    'MISMA CLAVE, DOS TIPOS: el segundo llamador recibe el objeto del primero y `tsc` no lo ve',
    () => {
      // ─── El agujero, escrito ───────────────────────────────────────────────
      //
      // `ask<T>(q, byLaw)` castea el camino cacheado (`answer as T`). Dos
      // llamadores que pregunten la MISMA clave esperando formas distintas —uno
      // el `ChunkFacts`, otro un resumen para el mapa— compilan los dos y el
      // segundo recibe lo del primero. No hay error, hay un objeto con los
      // campos de otro.
      //
      // Cerrarlo cuesta un mapa de tipos por variante de `Question`, y eso ata
      // el ledger a las formas de respuesta de `bioma.ts` y `extraccion.ts`.
      // Está anotado por el autor del ledger como decisión consciente; queda
      // acá, medido, para que la decisión se pueda revisar con el caso adelante.
      const led = new Ledger()
      led.ask<string>({ k: 'novelty', topic: 'tema', nonce: 0 }, () => 'soy-un-texto')
      const segunda = led.ask<number>({ k: 'novelty', topic: 'tema', nonce: 0 }, () => 42)
      expect(typeof segunda).toBe('number')
    },
  )
})

// ─── 2. Materializar en órdenes distintos ──────────────────────────────────

describe('ataque 2 · el orden de materialización', () => {
  it('14 órdenes distintos sobre 49 chunks dan las 49 huellas idénticas', () => {
    const region: [number, number][] = []
    for (let cx = -3; cx <= 3; cx++) for (let cy = -3; cy <= 3; cy++) region.push([cx, cy])
    const canonico = new Map(region.map(([cx, cy]) => [`${String(cx)}:${String(cy)}`, huella(decretar(SEMILLA, cx, cy))]))

    const ordenes: [number, number][][] = [region, [...region].reverse()]
    for (let s = 0; s < 12; s++) {
      const rng = mulberry32(1000 + s)
      const a = [...region]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[a[i], a[j]] = [a[j]!, a[i]!]
      }
      ordenes.push(a)
    }
    expect(ordenes.length).toBe(14)

    let comparaciones = 0
    for (const orden of ordenes) {
      for (const [cx, cy] of orden) {
        // Y entre chunk y chunk, el mundo hace otra cosa: decreta lejos, tira el
        // dado de otras preguntas y pregunta novedades. Nada de eso puede mover
        // lo que ya decidió.
        decretar(SEMILLA, 500 + cx, 500 + cy)
        rngFor({ k: 'novelty', topic: 'ruido', nonce: comparaciones }, SEMILLA)()
        expect(huella(decretar(SEMILLA, cx, cy))).toBe(canonico.get(`${String(cx)}:${String(cy)}`))
        comparaciones++
      }
    }
    expect(comparaciones).toBe(14 * 49)
    console.log(`ataque 2 · ${String(comparaciones)} decretos en 14 órdenes, con otra historia entre medio: 0 diferencias`)
  })

  it('el agua de un lago armada celda por celda en 14 órdenes da la misma huella', () => {
    const celdas: { x: number; y: number }[] = []
    for (const [cx, cy] of [
      [0, 0],
      [1, 0],
    ] as const) {
      const c = decretar(SEMILLA, cx, cy)
      for (let i = 0; i < CELDAS_POR_CHUNK; i++) {
        if (!tieneAgua(c.terreno, i)) continue
        celdas.push({ x: cx * CELDAS_DE_LADO + (i % CELDAS_DE_LADO), y: cy * CELDAS_DE_LADO + Math.floor(i / CELDAS_DE_LADO) })
      }
    }
    expect(celdas.length).toBeGreaterThan(200)

    function armar(orden: { x: number; y: number }[]): string {
      const led = new Ledger()
      const agua = new WaterBodies(led)
      for (const c of orden) agua.addWater(c.x, c.y)
      led.verify()
      return agua.fingerprint()
    }
    const base = armar([...celdas])
    const huellas = new Set<string>([base])
    huellas.add(armar([...celdas].reverse()))
    for (let s = 0; s < 12; s++) {
      const rng = mulberry32(7000 + s)
      const a = [...celdas]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[a[i], a[j]] = [a[j]!, a[i]!]
      }
      huellas.add(armar(a))
    }
    expect(huellas.size).toBe(1)
    console.log(`ataque 2 · ${String(celdas.length)} celdas de agua en 14 órdenes → 1 sola huella (${base})`)
  })
})

// ─── 3. Resolver, olvidar, volver a resolver ───────────────────────────────

describe('ataque 3 · un chunk que se resuelve, se olvida y se vuelve a resolver', () => {
  it('descartar del libro y volver a preguntar da exactamente la misma respuesta', () => {
    const led = new Ledger()
    const key = keyOf({ k: 'chunk', cx: 4, cy: 4 })
    const primera = led.ask({ k: 'chunk', cx: 4, cy: 4 }, () => huella(decretar(SEMILLA, 4, 4)))
    expect(led.discard(key, 'el mundo descargó el chunk')).toBe(true)
    expect(led.has(key)).toBe(false)
    led.advanceTo(900)
    const segunda = led.ask({ k: 'chunk', cx: 4, cy: 4 }, () => huella(decretar(SEMILLA, 4, 4)))
    expect(segunda).toBe(primera)
    led.verify()
  })

  it('el libro entero tirado a la basura: el mundo vuelve a decir lo mismo sobre todo', () => {
    // Es la propiedad que hace que el ledger sea una caché y no la fuente del
    // determinismo. Si mañana se borrara entero, el mundo tendría que volver a
    // decir lo mismo.
    const region: [number, number][] = []
    for (let cx = 0; cx < 6; cx++) for (let cy = 0; cy < 6; cy++) region.push([cx, cy])

    function partida(led: Ledger): string {
      const texto = region.map(([cx, cy]) => led.ask({ k: 'chunk', cx, cy }, () => huella(decretar(SEMILLA, cx, cy))))
      return textFingerprint(texto.join('\n'))
    }
    const conLibro = partida(new Ledger())
    const led = new Ledger()
    const primera = partida(led)
    // Se olvida todo lo que no tiene testigo.
    let olvidados = 0
    for (const [cx, cy] of region) if (led.discard(keyOf({ k: 'chunk', cx, cy }))) olvidados++
    expect(olvidados).toBe(36)
    expect(partida(led)).toBe(primera)
    expect(primera).toBe(conLibro)
    led.verify()
  })

  it('lo que el oráculo enmendó SÍ se pierde al olvidarlo, y eso es información y no un bug', () => {
    // La ley se re-deriva; el oráculo no. Por eso `Commitment.by` existe: es la
    // diferencia entre «esto se puede recalcular» y «esto es irrecuperable».
    const led = new Ledger()
    const agua = new WaterBodies(led)
    agua.addWater(0, 0)
    const id = agua.bodyAt(0, 0)!
    agua.ask(id, () => ({ especie: 'mojarras' }))
    led.amend(waterBodyKey(id), { especie: 'truchas' })
    expect(led.get(waterBodyKey(id))?.by).toBe('oraculo')
    led.discard(waterBodyKey(id))
    expect(agua.ask(id, () => ({ especie: 'mojarras' }))).toEqual({ especie: 'mojarras' })
  })

  it('pero lo que tiene testigo NO se puede olvidar', () => {
    const led = new Ledger()
    led.establish('c:9:9', { x: 1 }, 'gruesa')
    led.witness('c:9:9', 'gruesa')
    expect(led.discard('c:9:9')).toBe(false)
    expect(led.has('c:9:9')).toBe(true)
    led.verify()
  })
})

// ─── 4. Dos cuerpos de agua que se tocan en la frontera de dos chunks ──────

describe('ataque 4 · el agua cruza el borde de dos chunks', () => {
  /** Dos chunks vecinos con agua a los dos lados de su borde compartido. */
  const A = decretar(SEMILLA, 0, 0)
  const B = decretar(SEMILLA, 1, 0)

  function celdas(c: ChunkDecretado): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = []
    for (let i = 0; i < CELDAS_POR_CHUNK; i++) {
      if (!tieneAgua(c.terreno, i)) continue
      out.push({ x: c.cx * CELDAS_DE_LADO + (i % CELDAS_DE_LADO), y: c.cy * CELDAS_DE_LADO + Math.floor(i / CELDAS_DE_LADO) })
    }
    return out
  }

  it('el río NO se corta en el borde: las dos mitades son UN cuerpo', () => {
    const led = new Ledger()
    const agua = new WaterBodies(led)
    agua.addWaters(celdas(A))
    agua.addWaters(celdas(B))
    // Alguna fila tiene agua a los dos lados del borde x=15 | x=16.
    let pares = 0
    for (let y = 0; y < CELDAS_DE_LADO; y++) {
      const izq = agua.bodyAt(15, y)
      const der = agua.bodyAt(16, y)
      if (izq === null || der === null) continue
      pares++
      expect(der).toBe(izq)
    }
    expect(pares).toBeGreaterThan(0)
    console.log(`ataque 4 · ${String(pares)} filas con agua a los dos lados del borde, todas en el mismo cuerpo`)
  })

  it('da igual qué chunk se explore primero: misma huella, mismos ids', () => {
    function armar(primero: ChunkDecretado, segundo: ChunkDecretado): { h: string; ids: string } {
      const led = new Ledger()
      const agua = new WaterBodies(led)
      agua.addWaters(celdas(primero))
      agua.addWaters(celdas(segundo))
      led.verify()
      return { h: agua.fingerprint(), ids: agua.bodies().map((b) => b.id).join(' ') }
    }
    const ab = armar(A, B)
    const ba = armar(B, A)
    expect(ba.h).toBe(ab.h)
    expect(ba.ids).toBe(ab.ids)
  })

  it('con testigo de un lado, el cuerpo fusionado conserva el id y la respuesta de ese lado', () => {
    const led = new Ledger()
    const agua = new WaterBodies(led)
    // Se explora primero el chunk de la DERECHA y se lo mira de cerca. Su id no
    // es el canónicamente menor del lago entero, y aun así tiene que sobrevivir.
    agua.addWaters(celdas(B))
    const primerB = agua.bodies()[0]!.id
    // Su ancla está en el chunk de la derecha, o sea que NO es la celda menor
    // del lago entero: lo que lo salva es el testigo y nada más.
    expect(primerB.startsWith('16,')).toBe(true)
    agua.ask(primerB, () => ({ especie: 'truchas' }))
    expect(agua.witness(primerB, 'fina')).toBe(true)

    agua.addWaters(celdas(A))
    const vivos = agua.bodies().map((b) => b.id)
    expect(vivos).toContain(primerB)
    expect(agua.ask(primerB, () => ({ especie: 'jamás' }))).toEqual({ especie: 'truchas' })
    // Y el testigo congela el id: aunque el lago creció hacia celdas menores,
    // el cuerpo sellado no se rebautiza.
    expect(agua.body(primerB)?.witnessed).toBe(true)
    led.verify()
  })
})

// ─── 5. El dado del dios y el dado del mundo ───────────────────────────────

describe('ataque 5 · que un dado se filtre en el otro', () => {
  it('decretar 500 chunks y armar el agua no consume NI UNA tirada del dado del mundo', () => {
    const { w, tiros } = dadoDelMundo([0.5])
    const led = new Ledger()
    const agua = new WaterBodies(led)
    for (let i = 0; i < 500; i++) {
      const c = decretar(SEMILLA, i % 25, Math.floor(i / 25))
      if (c.orilla === null) continue
      for (let k = 0; k < CELDAS_POR_CHUNK; k += 37) {
        if (!tieneAgua(c.terreno, k)) continue
        agua.addWater(c.cx * CELDAS_DE_LADO + (k % CELDAS_DE_LADO), c.cy * CELDAS_DE_LADO + Math.floor(k / CELDAS_DE_LADO))
      }
    }
    expect(tiros()).toBe(0)
    // Y pensar tampoco: 1000 estimaciones, 0 tiradas.
    const s = rio()
    for (let i = 0; i < 1000; i++) probabilidadDePicar(s, CAÑA, w.phys, seg(i))
    expect(tiros()).toBe(0)
    // Sacar sí: exactamente una por intento.
    draw(w, s, CAÑA, seg(1))
    expect(tiros()).toBe(1)
  })

  it('pensar mucho no cambia lo que sale: dos partidas gemelas, una que duda y otra que no', () => {
    const a = dadoDelMundo([0.2, 0.9, 0.05, 0.7, 0.4])
    const b = dadoDelMundo([0.2, 0.9, 0.05, 0.7, 0.4])
    const sa = rio()
    const sb = rio()
    const saca: string[] = []
    const sacb: string[] = []
    for (let i = 0; i < 30; i++) {
      // La criatura A duda 17 veces antes de cada tirada.
      for (let k = 0; k < 17; k++) probabilidadDePicar(sa, CAÑA, PHYS, seg(i))
      saca.push(String(draw(a.w, sa, CAÑA, seg(i)).yields))
      sacb.push(String(draw(b.w, sb, CAÑA, seg(i)).yields))
    }
    expect(saca.join(',')).toBe(sacb.join(','))
    expect(a.tiros()).toBe(b.tiros())
    expect(sa.amount).toBe(sb.amount)
  })

  it('el dado del dios no tiene estado: 101 preguntas de otros no le mueven la secuencia a nadie', () => {
    const antes: number[] = []
    const rng1 = rngFor({ k: 'chunk', cx: 7, cy: 7 }, SEMILLA)
    for (let i = 0; i < 8; i++) antes.push(rng1())
    for (let i = 0; i < 101; i++) rngFor({ k: 'novelty', topic: 'otra', nonce: i }, SEMILLA)()
    const rng2 = rngFor({ k: 'chunk', cx: 7, cy: 7 }, SEMILLA)
    const despues: number[] = []
    for (let i = 0; i < 8; i++) despues.push(rng2())
    expect(despues).toEqual(antes)
  })

  it('y los dos tipos no son intercambiables: lo verifica `tsc`, no vitest', () => {
    const delDios: DiosRng = mulberry32(1)
    const delMundo = (() => 0.5) as WorldRng
    const s = rio()
    // @ts-expect-error el dado del DIOS no entra donde va el del MUNDO: si
    // entrara, decretar el mapa correría la partida.
    draw({ phys: PHYS, rng: delDios }, s, CAÑA, seg(0))
    // @ts-expect-error y al revés tampoco: el dado del mundo no siembra chunks.
    const _x: DiosRng = delMundo
    void _x
    expect(typeof delDios()).toBe('number')
  })
})

// ─── 6. El reloj de pared ──────────────────────────────────────────────────

describe('ataque 6 · una reposición que dependa del reloj de pared', () => {
  it('30 ms de reloj de pared entre dos preguntas no mueven un solo pez', () => {
    const s = rio()
    s.amount = 0
    const antes = population(s, seg(10))
    // Espera activa de verdad: el tiempo del sistema avanza mientras el mundo no.
    const hasta = Date.now() + 30
    let vueltas = 0
    while (Date.now() < hasta) vueltas++
    const despues = population(s, seg(10))
    expect(despues).toBe(antes)
    expect(vueltas).toBeGreaterThan(0)
    expect(Date.now()).toBeGreaterThanOrEqual(hasta)
  })

  it('con el reloj del sistema movido diez años, el mundo no se entera', () => {
    const realNow = Date.now
    const realPerf = performance.now.bind(performance)
    try {
      const salto = 10 * 365 * 24 * 3600 * 1000
      Date.now = (): number => realNow() + salto
      performance.now = (): number => realPerf() + salto
      const s = rio()
      s.amount = 0
      expect(population(s, seg(4))).toBe(2)
      expect(huella(decretar(SEMILLA, 1, 1))).toBe(huella(decretar(SEMILLA, 1, 1)))
      expect(climaDe(SEMILLA, 1, 1)).toEqual(climaDe(SEMILLA, 1, 1))
    } finally {
      Date.now = realNow
      performance.now = realPerf
    }
    // Y con el reloj devuelto a su lugar, el mismo chunk da lo mismo que antes.
    expect(huella(decretar(SEMILLA, 1, 1))).toBe(huella(decretar(SEMILLA, 1, 1)))
  })

  it('la reposición depende del INTERVALO de mundo y no de cuándo empezó', () => {
    // Dos stocks con la misma marca relativa y momentos absolutos muy distintos.
    const temprano = rio()
    temprano.amount = 0
    temprano.atSecond = seg(0)
    const tarde = rio()
    tarde.amount = 0
    tarde.atSecond = seg(396)
    expect(population(temprano, seg(4))).toBe(population(tarde, seg(400)))
    expect(population(temprano, seg(4))).toBe(2)
  })

  it('el guardián de la regla 2: NINGUNA fuente del paquete toca el reloj ni el azar del sistema', () => {
    const SRC = fileURLToPath(new URL('../src/', import.meta.url))
    const PROHIBIDAS: readonly { patron: RegExp; que: string }[] = [
      { patron: /\bMath\s*\.\s*exp\b/, que: 'Math.exp' },
      { patron: /\bMath\s*\.\s*pow\b/, que: 'Math.pow' },
      { patron: /\bMath\s*\.\s*log\b/, que: 'Math.log' },
      { patron: /\bMath\s*\.\s*random\b/, que: 'Math.random' },
      { patron: /\bMath\s*\.\s*sqrt\b/, que: 'Math.sqrt' },
      { patron: /\bMath\s*\.\s*sin\b/, que: 'Math.sin' },
      { patron: /\bMath\s*\.\s*cos\b/, que: 'Math.cos' },
      { patron: /\*\*/, que: 'el operador de potencia' },
      { patron: /\bnew\s+Date\b|\bDate\s*\.\s*now\b/, que: 'Date' },
      { patron: /\bperformance\s*\.\s*now\b/, que: 'performance.now' },
      { patron: /\bIntl\b/, que: 'Intl' },
      { patron: /\blocaleCompare\b/, que: 'localeCompare' },
      { patron: /\btoLocaleString\b/, que: 'toLocaleString' },
      // Y la regla 1: nada de `ii/` importa de Ánima I.
      { patron: /from\s+'(\.\.\/){2,}packages\//, que: 'un import a packages/' },
      { patron: /@anima\/(sim-core|agent-core|skill-runtime|world-model)/, que: 'un paquete de Ánima I' },
    ]
    const soloCodigo = (f: string): string =>
      f.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')

    const fuentes = readdirSync(SRC).filter((f) => f.endsWith('.ts'))
    const sucios: string[] = []
    for (const nombre of fuentes) {
      const codigo = soloCodigo(readFileSync(SRC + nombre, 'utf8'))
      for (const { patron, que } of PROHIBIDAS) if (patron.test(codigo)) sucios.push(`${nombre}: ${que}`)
    }
    expect(sucios).toEqual([])
    expect(fuentes.length).toBe(9)
    console.log(`ataque 6 · ${String(fuentes.length)} fuentes del paquete barridas, 0 infracciones a la regla 2`)
  })

  it('y el guardián detecta: un detector que no puede fallar no guarda nada', () => {
    const carnada = [
      'const a = Math.exp(1) + Math.pow(2, 3) + Math.log(4) + Math.random()',
      'const b = Math.sqrt(2) + Math.sin(1) + Math.cos(1) + (2 ' + '** 3)',
      'const c = new Date(); const d = Date.now(); const e = performance.now()',
      'const f = new Intl.NumberFormat(); "a".localeCompare("b"); (1).toLocaleString()',
      "import { x } from '../../packages/sim-core/src/x.js'",
      "import { y } from '@anima/agent-core'",
    ].join('\n')
    const patrones = [
      /\bMath\s*\.\s*exp\b/,
      /\bMath\s*\.\s*random\b/,
      /\*\*/,
      /\bnew\s+Date\b|\bDate\s*\.\s*now\b/,
      /\bperformance\s*\.\s*now\b/,
      /\bIntl\b/,
      /\blocaleCompare\b/,
      /from\s+'(\.\.\/){2,}packages\//,
      /@anima\/(sim-core|agent-core|skill-runtime|world-model)/,
    ]
    expect(patrones.filter((p) => p.test(carnada)).length).toBe(patrones.length)
  })
})

// ─── 7. El presupuesto calórico ────────────────────────────────────────────

describe('ataque 7 · pedir más de lo que el chunk puede dar', () => {
  it('el techo es una función pura de la semilla: ningún sorteo ni ninguna historia lo mueve', () => {
    // Ésta es la mitad que SÍ está: el techo no se negocia. Es lo que impide que
    // el oráculo siembre comida infinita mientras la llame terreno.
    const c = decretar(SEMILLA, 0, 0)
    expect(caloricBudget(c.bioma, c.clima.fertilidad)).toBe(c.presupuestoCalorico)
    for (let i = 0; i < 50; i++) expect(decretar(SEMILLA, 0, 0).presupuestoCalorico).toBe(c.presupuestoCalorico)
    // Y es monótono en la fertilidad, con tope: no hay fertilidad que lo dispare.
    let previo = -1
    for (let f = 0; f <= 1000; f += 25) {
      const v = caloricBudget(c.bioma, fx(f / 1000))
      expect(v).toBeGreaterThanOrEqual(previo)
      previo = v
    }
    expect(previo).toBe(c.bioma.caloriasBase + c.bioma.caloriasPorFertilidad)
  })

  it.fails('NADIE COMPARA EL STOCK CONTRA EL TECHO: un pozo puede entregar 100 veces el presupuesto del chunk', () => {
    // ─── El agujero, con los números ───────────────────────────────────────
    //
    // `presupuestoCalorico` se calcula, se guarda en el `ChunkFacts`... y no lo
    // lee nadie. El documento pide `aportadoEsteTick ≤ min(loQuePidióElOráculo,
    // presupuestoCalóricoDelChunk)`, y hoy no hay una sola función del paquete
    // que compare las dos cosas.
    //
    // Medido acá abajo: un chunk de bioma acuático tiene un techo de ~2400
    // calorías; un stock de capacidad 12 que se repone medio pez por segundo
    // entrega, en una hora de MUNDO, 1812 peces. Un pescado de 1 kg son
    // 8 × 1 × 0.38 = 3.04 calorías, así que son ~5500 calorías: más del doble
    // del techo, en una hora, sin que nada se queje.
    //
    // Y falta una pieza para poder cerrarlo, que es lo que lo hace un hueco de
    // diseño y no un olvido: **`Stock` no sabe de qué chunk es** y `draw`
    // devuelve un `SubstanceId` sin masa, así que hoy ni siquiera se puede
    // calcular cuántas calorías entregó un chunk. Para cerrarlo hacen falta tres
    // cosas: que el stock nombre su chunk, que lo que sale tenga masa, y un
    // acumulado por chunk en el ledger contra el que `draw` compare.
    const c = decretar(SEMILLA, 0, 0)
    const techo = c.presupuestoCalorico
    const s = rio()
    const { w } = dadoDelMundo([0]) // pica siempre
    let peces = 0
    for (let t = 0; t <= 3600; t++) {
      const r = draw(w, s, CAÑA, seg(t))
      if (r.yields !== null) peces++
    }
    const calorias = peces * 8 * 1 * 0.38
    console.log(
      `ataque 7 · techo del chunk ${String(techo)} cal · una hora de mundo entregó ${String(peces)} peces ≈ ${calorias.toFixed(0)} cal (${(calorias / techo).toFixed(1)}× el techo)`,
    )
    expect(calorias).toBeLessThanOrEqual(techo)
  })

  it.fails('LA GARANTÍA SIEMBRA CUALQUIER SUSTANCIA DEL CATÁLOGO: hasta una hebra de agua en la orilla', () => {
    // ─── El agujero ────────────────────────────────────────────────────────
    //
    // `ensureSolvable` busca en el catálogo ENTERO —que es lo correcto: si
    // buscara solo entre las sustancias del bioma, un chunk de pradera al lado
    // de un lago no tendría con qué y la garantía lanzaría—, pero no filtra
    // nada. Como `agua` tiene `flexibility: 1`, `formaDeLoSuelto` la llama
    // `hebra`, y una hebra de agua tiene `catch > 0`: el dios puede dejar un
    // hilo de agua tirado en la orilla para que se ate a una vara.
    //
    // Medido: en un barrido de 1681 chunks aparecen sembradas `agua/hebra`,
    // `pluma/hebra` y `tendon/hebra` —cosas que no son materia tirada de ese
    // lugar—. No rompe ningún invariante: rompe la coherencia que el propio
    // paquete verifica al cargar para `scatter` («lo que está tirado tiene que
    // ser de lo que el lugar está hecho»).
    //
    // Para cerrarlo hace falta decidir QUÉ puede caer del cielo: lo más barato
    // es excluir por tag (`liquido`, y lo que sea parte de un animal vivo) y
    // dejar que la garantía elija entre lo demás. Hay que verificar que con esa
    // exclusión la garantía sigue cerrando en los 721 chunks con orilla.
    const sembradas = new Set<string>()
    for (let cx = -20; cx <= 20; cx++) {
      for (let cy = -20; cy <= 20; cy++) {
        for (const s of decretar(SEMILLA, cx, cy).sembradas) sembradas.add(s.substance)
      }
    }
    console.log(`ataque 7 · la garantía sembró: ${[...sembradas].sort().join(', ')}`)
    expect([...sembradas].filter((s) => PHYS.substances.get(s)?.tags.includes('liquido'))).toEqual([])
  })
})
