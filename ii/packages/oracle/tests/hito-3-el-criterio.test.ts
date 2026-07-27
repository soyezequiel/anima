// ─── EL CRITERIO DEL HITO 3, uno por uno y con números ───────────────────────
//
// Del documento de arquitectura, palabra por palabra:
//
//   «el mismo mundo explorado en dos órdenes **y con dos historias distintas
//   entre medio** produce el mismo hash; escribir otra respuesta para una clave
//   existente lanza `InvariantError`; un hecho fino enmendado antes de
//   interactuar cambia y después no; la fusión de dos lagos con testigo no
//   contradice a ninguno; el río se agota y se repone; ningún chunk acuático
//   queda sin insumos para armar un aparejo en radio 2.»
//
// Son seis y acá está cada uno con su medición. Dos reglas para este archivo:
//
//   1. **Se importa desde `../src/index.js`**, el barril, y no desde los módulos
//      sueltos. Los tests de cada agente ya prueban sus piezas; lo que falta
//      probar es que el PAQUETE existe, que sus tres partes se llaman entre sí y
//      que nadie exportó dos veces el mismo nombre.
//   2. **El criterio no se juzga con el código que lo cumple.** El aparejo del
//      criterio (f) se arma acá adentro con `unir` de `@anima/physics` y se juzga
//      con `cumpleRol`: si el juez fuera `faltantesParaResolver`, el test estaría
//      de acuerdo con la garantía por construcción y con nadie más.

import { describe, expect, it } from 'vitest'

import type { Body, Physics } from '@anima/physics'
import { buildSeedPhysics, cumpleRol, EXTRACCION, fx, qualityOf, seg, SEED_PROCESSES, unfx, unir } from '@anima/physics'

import type { ChunkDecretado, Stock, WaterBodyId } from '../src/index.js'
import {
  CELDAS_DE_LADO,
  CELDAS_POR_CHUNK,
  crearStock,
  decretarChunk,
  draw,
  LibroCalorico,
  formaDeLoSuelto,
  InvariantError,
  Ledger,
  mulberry32,
  population,
  textFingerprint,
  tieneAgua,
  waterBodyKey,
  WaterBodies,
  type MundoConDado,
  type WorldRng,
} from '../src/index.js'

const PHYS: Physics = buildSeedPhysics()
const GEAR = EXTRACCION.roles.find((r) => r.name === 'gear')!
const SEMILLA = 20260727n

// ─── El arnés ───────────────────────────────────────────────────────────────

/**
 * La huella canónica de un chunk decretado: todo lo que el dios decidió de él.
 *
 * Entra el clima, el bioma, las 256 celdas de agua, las 256 de cobertura, la
 * orilla, TODO lo suelto (lo del ruido y lo que puso la garantía, con su celda y
 * su masa) y el techo calórico. Si el orden de exploración moviera cualquiera de
 * esos números, esta huella cambia.
 */
function huellaDeChunk(c: ChunkDecretado): string {
  const p: string[] = [
    `${String(c.cx)}:${String(c.cy)}`,
    c.bioma.id,
    `h${String(c.clima.humedad)} f${String(c.clima.fertilidad)} a${String(c.clima.altura)}`,
    `t${String(c.terreno.temperatura)} o2${String(c.terreno.oxigeno)}`,
    `orilla${String(c.orilla ?? -1)}`,
    `cal${String(c.presupuestoCalorico)}`,
  ]
  for (let i = 0; i < CELDAS_POR_CHUNK; i++) p.push(`${String(c.terreno.wet[i])}/${String(c.terreno.cover[i])}`)
  for (const s of c.sueltas) p.push(`${s.substance}@${String(s.i)}#${String(s.masa)}`)
  return textFingerprint(p.join('|'))
}

function decretar(seed: bigint, cx: number, cy: number): ChunkDecretado {
  return decretarChunk(seed, cx, cy, SEED_PROCESSES, PHYS)
}

/** Un dado del mundo de mentira, que además cuenta. El `as` vive acá y en el
 *  helper de `extraccion.test.ts`, y en ningún archivo de `src/`. */
function dadoDelMundo(valores: readonly number[]): { w: MundoConDado; tiros: () => number } {
  let i = 0
  const f = ((): number => {
    const v = valores[i % valores.length]!
    i += 1
    return v
  }) as WorldRng
  return { w: { phys: PHYS, rng: f, calorias: new LibroCalorico(SEMILLA) }, tiros: () => i }
}

/** Las celdas mojadas de un chunk, en coordenadas absolutas. */
function celdasDeAgua(c: ChunkDecretado): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < CELDAS_POR_CHUNK; i++) {
    if (!tieneAgua(c.terreno, i)) continue
    out.push({ x: c.cx * CELDAS_DE_LADO + (i % CELDAS_DE_LADO), y: c.cy * CELDAS_DE_LADO + Math.floor(i / CELDAS_DE_LADO) })
  }
  return out
}

/** Una permutación determinista. Nada de `Math.random` ni acá: un test que
 *  baraja con el azar del sistema falla una vez de cada mil y nadie lo reproduce. */
function barajar<T>(xs: readonly T[], semilla: number): T[] {
  const rng = mulberry32(semilla)
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

// ─── (a) dos órdenes, dos historias, el mismo hash ──────────────────────────

describe('(a) el mismo mundo en dos órdenes y con dos historias distintas', () => {
  const region: readonly (readonly [number, number])[] = (() => {
    const out: [number, number][] = []
    for (let cx = -4; cx <= 4; cx++) for (let cy = -4; cy <= 4; cy++) out.push([cx, cy])
    return out
  })()

  it('81 chunks decretados en dos órdenes, con otra historia entre medio, dan las 81 huellas idénticas', () => {
    // Historia A: en orden por filas, y entre chunk y chunk el mundo hace cosas
    // —decreta chunks lejanos, pregunta novedades, vacía un stock—.
    const ledgerA = new Ledger()
    const stockA = crearStock({
      id: 'a',
      yields: 'pescado',
      cx: 0,
      cy: 0,
      masaPorUnidad: fx(1),
      capacity: 40,
      perMillePorSegundo: 1000,
      depth: fx(1),
      atSecond: seg(0),
      amount: 40,
    })
    const huellasA = new Map<string, string>()
    let lejanos = 0
    region.forEach(([cx, cy], i) => {
      ledgerA.advanceTo(i * 7)
      huellasA.set(`${String(cx)}:${String(cy)}`, huellaDeChunk(decretar(SEMILLA, cx, cy)))
      decretar(SEMILLA, 900 + i, -900 - i)
      lejanos++
      ledgerA.ask({ k: 'novelty', topic: `ruido-${String(i)}`, nonce: i }, () => ({ n: i }))
      population(stockA, seg(i))
      stockA.amount = Math.max(0, stockA.amount - 1)
    })

    // Historia B: en el orden INVERSO, sin nada de lo anterior, y con el libro
    // en otros ticks. Ninguna de las dos historias sabe de la otra.
    const ledgerB = new Ledger(5000)
    const huellasB = new Map<string, string>()
    ;[...region].reverse().forEach(([cx, cy], i) => {
      ledgerB.advanceTo(5000 + i)
      huellasB.set(`${String(cx)}:${String(cy)}`, huellaDeChunk(decretar(SEMILLA, cx, cy)))
    })

    // Historia C: en un orden barajado, y con el mundo decretando dos veces el
    // mismo chunk entre medio (que es lo que pasa cuando alguien va y vuelve).
    const huellasC = new Map<string, string>()
    for (const [cx, cy] of barajar(region, 0xc0ffee)) {
      decretar(SEMILLA, cx, cy)
      huellasC.set(`${String(cx)}:${String(cy)}`, huellaDeChunk(decretar(SEMILLA, cx, cy)))
    }

    expect(huellasA.size).toBe(81)
    for (const [k, h] of huellasA) {
      expect(huellasB.get(k)).toBe(h)
      expect(huellasC.get(k)).toBe(h)
    }
    // Y las historias fueron de verdad distintas.
    expect(lejanos).toBe(81)
    expect(ledgerA.entries().length).toBe(81)
    expect(ledgerB.entries().length).toBe(0)
    expect(stockA.amount).toBeLessThan(40)
    console.log(
      `(a) 81 chunks · 3 órdenes (filas, inverso, barajado) · historias: A=81 chunks lejanos + 81 novedades + 81 retiros, B=libro en el tick 5000, C=cada chunk decretado dos veces → 81/81 huellas idénticas`,
    )
  })

  it('el libro y el agua: dos partidas con el mismo mundo, otro orden y otros ticks, dan la misma huella', () => {
    // El mismo lago, explorado al derecho y al revés. Lo que cambia entre las
    // dos partidas es el ORDEN de las celdas, el ORDEN de las preguntas, los
    // TICKS y cuántas veces se re-preguntó lo mismo.
    const chunks = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ] as const
    const celdas = chunks.flatMap(([cx, cy]) => celdasDeAgua(decretar(SEMILLA, cx, cy)))
    expect(celdas.length).toBeGreaterThan(100)

    function partida(orden: { x: number; y: number }[], tick0: number, repreguntas: number): {
      libro: string
      agua: string
      log: string
      cuerpos: number
    } {
      const led = new Ledger(tick0)
      const ag = new WaterBodies(led)
      orden.forEach((c, i) => {
        led.advanceTo(tick0 + i)
        ag.addWater(c.x, c.y)
      })
      // Preguntar por cada cuerpo (grano fino: preguntar no sella).
      const ids = ag.bodies().map((b) => b.id)
      for (const id of ids) ag.ask(id, () => ({ especie: 'mojarra', n: id.length }))
      // Re-preguntar N veces: es historia pura, no puede cambiar nada.
      for (let i = 0; i < repreguntas; i++) {
        for (const id of ids) ag.ask(id, () => ({ especie: 'no-debería-llamarse', n: -1 }))
      }
      // Y el mismo conjunto de testigos en las dos partidas, en otro orden.
      for (const id of i0(ids, tick0)) ag.witness(id, 'fina')
      led.verify()
      return {
        libro: led.fingerprint(),
        agua: ag.fingerprint(),
        log: led
          .entries()
          .map((e) => `${e.key}|${e.event}|${String(e.atTick)}`)
          .join(','),
        cuerpos: ag.bodies().length,
      }
    }
    /** Los mismos ids en otro orden: al derecho para una partida, al revés para
     *  la otra. Sellar en otro orden tiene que dar el mismo libro. */
    function i0(ids: readonly WaterBodyId[], tick0: number): readonly WaterBodyId[] {
      return tick0 === 0 ? ids : [...ids].reverse()
    }

    const A = partida([...celdas], 0, 0)
    const B = partida([...celdas].reverse(), 4000, 3)
    const C = partida(barajar(celdas, 0x51ded), 900, 1)

    expect(B.libro).toBe(A.libro)
    expect(C.libro).toBe(A.libro)
    expect(B.agua).toBe(A.agua)
    expect(C.agua).toBe(A.agua)
    expect(B.cuerpos).toBe(A.cuerpos)
    // Las historias fueron distintas de verdad: el log no coincide.
    expect(B.log).not.toBe(A.log)
    expect(C.log).not.toBe(A.log)
    console.log(
      `(a) ${String(celdas.length)} celdas de agua de 4 chunks · 3 órdenes (derecho, inverso, barajado) · ticks 0/4000/900 · 0/3/1 re-preguntas → misma huella de libro (${A.libro}) y de agua (${A.agua}), ${String(A.cuerpos)} cuerpos, y los tres logs distintos`,
    )
  })
})

// ─── (b) escribir otra respuesta para una clave existente lanza ─────────────

describe('(b) escribir otra respuesta para una clave existente lanza', () => {
  it('lanza InvariantError con la clave y las dos respuestas adentro', () => {
    const led = new Ledger()
    led.establish('c:0:0', { bioma: 'pantano' }, 'gruesa')
    let lanzo: InvariantError | null = null
    try {
      led.establish('c:0:0', { bioma: 'estepa' }, 'gruesa')
    } catch (e) {
      lanzo = e as InvariantError
    }
    expect(lanzo).toBeInstanceOf(InvariantError)
    expect(lanzo?.reason.k).toBe('respuesta-distinta')
    expect(lanzo?.reason).toMatchObject({ key: 'c:0:0' })
    // La misma respuesta escrita de nuevo, con las claves en otro orden, NO
    // lanza y no deja renglón: re-preguntar no es un evento.
    led.establish('c:0:0', { bioma: 'pantano' }, 'gruesa')
    expect(led.entries().length).toBe(1)
    led.verify()
  })

  it('lanza también sin testigo, y lanza sobre lo que el dios acaba de decretar', () => {
    const led = new Ledger()
    const c = decretar(SEMILLA, 2, 3)
    const key = `c:${String(c.cx)}:${String(c.cy)}`
    led.establish(key, { bioma: c.bioma.id, cal: c.presupuestoCalorico }, 'gruesa')
    expect(led.hasWitness(key)).toBe(false)
    expect(() => led.establish(key, { bioma: c.bioma.id, cal: c.presupuestoCalorico + 1 }, 'gruesa')).toThrow(
      InvariantError,
    )
    // Y el mismo hecho, escrito con las claves del objeto en otro orden, es el
    // mismo hecho: la comparación es por forma canónica y no por texto.
    led.establish(key, { cal: c.presupuestoCalorico, bioma: c.bioma.id }, 'gruesa')
    expect(led.entries().length).toBe(1)
  })

  it('barrido: 200 claves decididas y 200 intentos de contradecirlas, 200 lanzadas', () => {
    const led = new Ledger()
    let contradicciones = 0
    for (let i = 0; i < 200; i++) {
      const key = `c:${String(i)}:0`
      led.establish(key, { n: i }, 'gruesa')
    }
    for (let i = 0; i < 200; i++) {
      try {
        led.establish(`c:${String(i)}:0`, { n: i + 1 }, 'gruesa')
      } catch (e) {
        if (e instanceof InvariantError && e.reason.k === 'respuesta-distinta') contradicciones++
      }
    }
    expect(contradicciones).toBe(200)
    expect(led.entries().length).toBe(200)
    led.verify()
    console.log('(b) 200 claves decididas · 200 intentos de contradecirlas · 200 InvariantError · 0 renglones de más')
  })
})

// ─── (c) enmendado antes de interactuar cambia; después, no ─────────────────

describe('(c) un hecho fino enmendado antes de interactuar cambia, y después no', () => {
  it('la secuencia completa: ask → mirar de lejos no sella → enmienda → meter la mano → enmienda tarde', () => {
    const led = new Ledger()
    const agua = new WaterBodies(led)
    agua.addWater(0, 0)
    agua.addWater(1, 0)
    const id = agua.bodyAt(0, 0)!
    const key = waterBodyKey(id)

    const primera = agua.ask(id, () => ({ especie: 'mojarras' }))
    expect(primera).toEqual({ especie: 'mojarras' })

    // Mirar de lejos NO sella un hecho fino: ésa es la ventana del oráculo.
    expect(agua.witness(id, 'gruesa')).toBe(false)
    expect(led.hasWitness(key)).toBe(false)

    // El oráculo llega a tiempo.
    led.advanceTo(4021)
    expect(led.amend(key, { especie: 'truchas' }, 'el oráculo miró el clima y dijo truchas')).toBe(true)
    expect(agua.ask(id, () => ({ especie: 'jamás' }))).toEqual({ especie: 'truchas' })

    // Meter la mano sí sella.
    led.advanceTo(4100)
    expect(agua.witness(id, 'fina')).toBe(true)
    expect(led.hasWitness(key)).toBe(true)

    // Y a partir de acá el oráculo llega tarde, para siempre.
    led.advanceTo(4200)
    expect(led.amend(key, { especie: 'salmones' })).toBe(false)
    expect(agua.ask(id, () => ({ especie: 'jamás' }))).toEqual({ especie: 'truchas' })
    led.verify()

    // El libro cuenta lo que PASÓ y no sólo lo que quedó: es el panel de
    // auditoría del hito.
    const narrativa = led.entries().map((e) => `${String(e.atTick)} ${e.event} ${e.by}`)
    expect(narrativa).toEqual(['0 decidido ley', '4021 enmendado oraculo', '4100 testigo oraculo'])
    console.log(`(c) narrativa del arroyo: ${narrativa.join(' → ')}`)
  })

  it('un hecho GRUESO lo sella mirarlo de lejos, y ahí el oráculo ya llegó tarde', () => {
    const led = new Ledger()
    const c = decretar(SEMILLA, 0, 0)
    const key = `c:0:0`
    led.establish(key, { bioma: c.bioma.id }, 'gruesa')
    expect(led.witness(key, 'gruesa')).toBe(true)
    expect(led.amend(key, { bioma: 'arenal' })).toBe(false)
    led.verify()
  })

  it('barrido: 100 cuerpos de agua, la mitad enmendada antes y la mitad después', () => {
    const led = new Ledger()
    const agua = new WaterBodies(led)
    for (let i = 0; i < 100; i++) agua.addWater(i * 3, 0)
    const ids = agua.bodies().map((b) => b.id)
    expect(ids.length).toBe(100)
    let cambiaron = 0
    let noCambiaron = 0
    ids.forEach((id, i) => {
      agua.ask(id, () => ({ especie: 'mojarras' }))
      if (i % 2 === 0) {
        if (led.amend(waterBodyKey(id), { especie: 'truchas' })) cambiaron++
        agua.witness(id, 'fina')
      } else {
        agua.witness(id, 'fina')
        if (!led.amend(waterBodyKey(id), { especie: 'truchas' })) noCambiaron++
      }
    })
    expect(cambiaron).toBe(50)
    expect(noCambiaron).toBe(50)
    for (const id of ids) {
      const esperado = ids.indexOf(id) % 2 === 0 ? 'truchas' : 'mojarras'
      expect(agua.ask(id, () => ({ especie: 'jamás' }))).toEqual({ especie: esperado })
    }
    led.verify()
    console.log('(c) 100 arroyos · 50 enmendados antes del testigo (cambian) · 50 después (no cambian) · 0 contradicciones')
  })
})

// ─── (d) la fusión de dos lagos con testigo no contradice a ninguno ─────────

describe('(d) la fusión de dos lagos con testigo no contradice a ninguno', () => {
  /** Dos charcos de tres celdas separados por una celda, y esa celda al final. */
  function dosCharcos(): { led: Ledger; agua: WaterBodies; a: WaterBodyId; b: WaterBodyId } {
    const led = new Ledger()
    const agua = new WaterBodies(led)
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [2, 0],
      [4, 0],
      [5, 0],
      [6, 0],
    ] as const) {
      agua.addWater(x, y)
    }
    return { led, agua, a: agua.bodyAt(0, 0)!, b: agua.bodyAt(4, 0)! }
  }

  it('los dos vistos: dos stocks lógicos compartiendo agua, y ninguna respuesta tocada', () => {
    const { led, agua, a, b } = dosCharcos()
    agua.ask(a, () => ({ especie: 'mojarras' }))
    agua.ask(b, () => ({ especie: 'truchas' }))
    expect(agua.witness(a, 'fina')).toBe(true)
    expect(agua.witness(b, 'fina')).toBe(true)

    agua.addWater(3, 0) // se juntan
    const cuerpos = agua.bodies()
    expect(cuerpos.length).toBe(2)
    expect(agua.regionOf(a)).toBe(agua.regionOf(b))
    expect(agua.populationsOf(a)).toEqual([a, b])
    expect(agua.ask(a, () => ({ especie: 'jamás' }))).toEqual({ especie: 'mojarras' })
    expect(agua.ask(b, () => ({ especie: 'jamás' }))).toEqual({ especie: 'truchas' })
    // Ninguna celda quedó sin dueño ni con dos.
    const dueños = new Set<string>()
    for (let x = 0; x <= 6; x++) {
      const id = agua.bodyAt(x, 0)
      expect(id).not.toBeNull()
      dueños.add(`${String(x)}=${String(id)}`)
    }
    expect(dueños.size).toBe(7)
    expect(led.entries().filter((e) => e.event === 'descartado').length).toBe(0)
    led.verify()
    console.log(
      `(d) dos charcos de 3 celdas, los dos sellados, se juntan por la celda del medio → ${String(cuerpos.length)} cuerpos lógicos, 1 región, 7 celdas con dueño único, 0 descartes, 0 contradicciones`,
    )
  })

  it('uno solo visto: el fusionado hereda id y respuesta del que se vio', () => {
    const { led, agua, a, b } = dosCharcos()
    agua.ask(b, () => ({ especie: 'truchas' }))
    expect(agua.witness(b, 'fina')).toBe(true)
    agua.addWater(3, 0)
    expect(agua.bodies().length).toBe(1)
    expect(agua.bodyAt(0, 0)).toBe(b)
    expect(agua.bodyAt(6, 0)).toBe(b)
    expect(agua.ask(b, () => ({ especie: 'jamás' }))).toEqual({ especie: 'truchas' })
    // Y el que nadie vio ya no nombra nada: su respuesta se descartó en vez de
    // mudarse, porque la respuesta de la ley es función de la CLAVE.
    expect(led.has(waterBodyKey(a))).toBe(false)
    led.verify()
  })

  it('ninguno visto: uno solo con el id canónico, y da igual el orden en que se juntaron', () => {
    const uno = dosCharcos()
    uno.agua.ask(uno.a, () => ({ especie: 'mojarras' }))
    uno.agua.ask(uno.b, () => ({ especie: 'truchas' }))
    uno.agua.addWater(3, 0)
    expect(uno.agua.bodies().length).toBe(1)
    expect(uno.agua.bodies()[0]!.id).toBe('0,0')
    uno.led.verify()

    // El mismo charco armado al revés: mismas celdas, otro orden de llegada.
    const led = new Ledger()
    const agua = new WaterBodies(led)
    for (const [x, y] of [
      [6, 0],
      [5, 0],
      [4, 0],
      [3, 0],
      [2, 0],
      [1, 0],
      [0, 0],
    ] as const) {
      agua.addWater(x, y)
    }
    expect(agua.fingerprint()).toBe(uno.agua.fingerprint())
  })
})

// ─── (e) el río se agota y se repone ───────────────────────────────────────

describe('(e) el río se agota y se repone', () => {
  const VARA: Body = { id: 'v', form: 'vara', parts: [{ substance: 'madera', mass: 1, q: {} }], joints: [], state: {} }
  const HEBRA: Body = { id: 'h', form: 'hebra', parts: [{ substance: 'liana', mass: 0.3, q: {} }], joints: [], state: {} }
  const CAÑA = unir(VARA, undefined, HEBRA, PHYS, 'c')!

  function rio(): Stock {
    return crearStock({
      id: 'rio',
      yields: 'pescado',
      cx: 0,
      cy: 0,
      masaPorUnidad: fx(1),
      capacity: 12,
      // 500 milésimas por segundo: medio pez por segundo, 24 s para llenarlo.
      perMillePorSegundo: 500,
      depth: fx(2),
      atSecond: seg(0),
      amount: 12,
    })
  }

  it('se agota: 12 extracciones lo vacían y la 13ª no tira el dado', () => {
    const s = rio()
    // Un dado que siempre da 0 pica siempre (0 >= p es falso con p > 0).
    const { w, tiros } = dadoDelMundo([0])
    expect(qualityOf(CAÑA, 'catch', PHYS)).toBeGreaterThan(0)
    expect(qualityOf(CAÑA, 'reach', PHYS)).toBeGreaterThanOrEqual(2)

    let sacados = 0
    for (let i = 0; i < 12; i++) {
      const r = draw(w, s, CAÑA, seg(1))
      expect(r.yields).toBe('pescado')
      expect(r.tiro).toBe(true)
      sacados++
    }
    expect(population(s, seg(1))).toBe(0)
    const vacio = draw(w, s, CAÑA, seg(1))
    expect(vacio.yields).toBeNull()
    expect(vacio.tiro).toBe(false)
    expect(sacados).toBe(12)
    expect(tiros()).toBe(12)
    console.log('(e) 12 peces sacados en 12 tiradas del dado del mundo; el pozo vacío no consume ni una')
  })

  it('se repone: la población vuelve por el reloj DEL MUNDO, y la cuenta es cerrada', () => {
    const s = rio()
    const { w } = dadoDelMundo([0])
    for (let i = 0; i < 12; i++) draw(w, s, CAÑA, seg(1))
    expect(population(s, seg(1))).toBe(0)

    // Medio pez por segundo desde el segundo 1.
    const muestras = [
      [seg(1), 0],
      [seg(3), 1],
      [seg(5), 2],
      [seg(11), 5],
      [seg(25), 12],
      [seg(1000), 12],
    ] as const
    for (const [t, esperado] of muestras) expect(population(s, t)).toBe(esperado)

    // Monótona en 400 muestras, y jamás por encima de la capacidad.
    let previa = 0
    for (let i = 0; i <= 400; i++) {
      const v = population(s, seg(1 + i / 10))
      expect(v).toBeGreaterThanOrEqual(previa)
      expect(v).toBeLessThanOrEqual(12)
      previa = v
    }
    // Y preguntar 400 veces no movió nada: `population` no muta.
    expect(s.amount).toBe(0)
    console.log('(e) reposición: 0 → 5 peces en 10 s, lleno (12) a los 24 s, tope respetado a los 1000 s, 401 muestras monótonas')
  })

  it('perezosa: mirarlo 398 veces o mirarlo una da el mismo número', () => {
    const a = rio()
    a.amount = 0
    a.atSecond = seg(2)
    const b = rio()
    b.amount = 0
    b.atSecond = seg(2)
    for (let i = 0; i < 398; i++) population(a, seg(2 + i / 4))
    expect(population(a, seg(400))).toBe(population(b, seg(400)))
    expect(population(b, seg(400))).toBe(12)

    // Y un intento FALLIDO no re-ancla la marca: si lo hiciera, el río se
    // repondría más lento cuanto más lo intentaran.
    const c = rio()
    c.amount = 0
    c.atSecond = seg(0)
    const { w } = dadoDelMundo([1]) // 1 >= p siempre: nunca pica
    for (let i = 0; i < 4; i++) draw(w, c, CAÑA, seg(1))
    expect(c.atSecond).toBe(seg(0))
    expect(population(c, seg(4))).toBe(2)
    console.log('(e) perezosa: 398 miradas o ninguna dan lo mismo; 4 intentos fallidos no frenan la reposición (2 peces al segundo 4)')
  })
})

// ─── (f) ningún chunk acuático queda sin insumos en radio 2 ────────────────

describe('(f) ningún chunk desde donde se pesca queda sin insumos para un aparejo en radio 2', () => {
  /**
   * El juez, escrito acá: con estas sueltas, ¿se puede tener en la mano algo que
   * `cumpleRol(gear)`? Se prueban las sueltas solas y todos los pares atados con
   * `unir`. No se usa NADA de `resolubilidad.ts` para juzgar.
   */
  function hayAparejo(cuerpos: readonly Body[]): boolean {
    for (const b of cuerpos) if (cumpleRol(b, GEAR, PHYS)) return true
    for (let i = 0; i < cuerpos.length; i++) {
      for (let j = 0; j < cuerpos.length; j++) {
        if (i === j) continue
        const e = unir(cuerpos[i]!, undefined, cuerpos[j]!, PHYS, 'u')
        if (e !== undefined && cumpleRol(e, GEAR, PHYS)) return true
      }
    }
    return false
  }

  function aManoDeLaOrilla(c: ChunkDecretado): Body[] {
    const orilla = c.orilla!
    const ax = orilla % CELDAS_DE_LADO
    const ay = Math.floor(orilla / CELDAS_DE_LADO)
    const out: Body[] = []
    for (const s of c.sueltas) {
      const sx = s.i % CELDAS_DE_LADO
      const sy = Math.floor(s.i / CELDAS_DE_LADO)
      if (Math.max(Math.abs(sx - ax), Math.abs(sy - ay)) > 2) continue
      out.push({
        id: `s${String(out.length)}`,
        form: formaDeLoSuelto(s.substance, PHYS),
        parts: [{ substance: s.substance, mass: unfx(s.masa), q: {} }],
        joints: [],
        state: {},
      })
    }
    return out
  }

  /**
   * Cuatro semillas, elegidas por tener agua en la ventana que se barre y no
   * por dar el resultado lindo.
   *
   * Y esto último es un hallazgo del barrido que vale escribir: el campo de
   * clima tiene período 64 CHUNKS, así que una ventana de 41×41 es más chica que
   * un rasgo del mapa y puede caer entera adentro de un desierto. Medido sobre
   * ocho semillas, dos (`0xbadbeef` y `2`) dan 1681 chunks sin una sola gota de
   * agua. En esas, el criterio (f) pasa por vacuidad — no hay dónde pescar—, y
   * un test que las incluyera estaría midiendo nada y diciendo que sí.
   */
  it('barrido de cuatro semillas: TODAS las orillas tienen con qué armar el aparejo', () => {
    const semillas = [SEMILLA, 7n, 999n, 1n]
    let chunks = 0
    let orillas = 0
    let noAcuaticos = 0
    let sembrados = 0
    let sinAparejo = 0
    let enElAgua = 0
    let fueraDeRadio = 0
    const t0 = Date.now()
    const porSemilla: string[] = []
    for (const seed of semillas) {
      const antes = orillas
      const antesSembrados = sembrados
      for (let cx = -20; cx <= 20; cx++) {
        for (let cy = -20; cy <= 20; cy++) {
          chunks++
          const c = decretar(seed, cx, cy)
          if (c.orilla === null) continue
          orillas++
          if (!c.bioma.acuatico) noAcuaticos++
          if (c.sembradas.length > 0) sembrados++
          const ax = c.orilla % CELDAS_DE_LADO
          const ay = Math.floor(c.orilla / CELDAS_DE_LADO)
          for (const s of c.sembradas) {
            if (tieneAgua(c.terreno, s.i)) enElAgua++
            const d = Math.max(Math.abs((s.i % CELDAS_DE_LADO) - ax), Math.abs(Math.floor(s.i / CELDAS_DE_LADO) - ay))
            if (d > 2) fueraDeRadio++
          }
          if (!hayAparejo(aManoDeLaOrilla(c))) sinAparejo++
        }
      }
      // Una semilla sin una sola orilla haría que el criterio pasara por
      // vacuidad, así que cada una tiene que aportar las suyas.
      expect(orillas - antes).toBeGreaterThan(20)
      porSemilla.push(`${String(seed)}: ${String(orillas - antes)} orillas, ${String(sembrados - antesSembrados)} sembradas`)
    }
    const ms = Date.now() - t0
    expect(sinAparejo).toBe(0)
    expect(enElAgua).toBe(0)
    expect(fueraDeRadio).toBe(0)
    expect(orillas).toBeGreaterThan(300)
    console.log(
      `(f) ${String(chunks)} chunks de 4 semillas · ${String(orillas)} con orilla (de los cuales ${String(noAcuaticos)} NO son de bioma acuático) · ${String(sembrados)} necesitaron siembra · ${String(sinAparejo)} sin aparejo · ${String(enElAgua)} sembrados en el agua · ${String(fueraDeRadio)} fuera del radio 2 · ${String(ms)} ms`,
    )
    console.log(`(f) por semilla → ${porSemilla.join(' · ')}`)
  })

  it('la garantía es idempotente: decretar dos veces siembra lo mismo, en la misma celda', () => {
    let comparados = 0
    for (let cx = -6; cx <= 6; cx++) {
      for (let cy = -6; cy <= 6; cy++) {
        const a = decretar(SEMILLA, cx, cy)
        const b = decretar(SEMILLA, cx, cy)
        expect(huellaDeChunk(b)).toBe(huellaDeChunk(a))
        if (a.sembradas.length > 0) comparados++
      }
    }
    expect(comparados).toBeGreaterThan(0)
    console.log(`(f) 169 chunks decretados dos veces, 169 huellas idénticas (${String(comparados)} con siembra de la garantía)`)
  })

  it('el chunk sin orilla no recibe nada: la garantía no tira una caña en el medio del lago', () => {
    let inundados = 0
    let secos = 0
    for (let cx = -20; cx <= 20; cx++) {
      for (let cy = -20; cy <= 20; cy++) {
        const c = decretar(SEMILLA, cx, cy)
        if (c.orilla !== null) continue
        expect(c.sembradas.length).toBe(0)
        let wet = 0
        for (let i = 0; i < CELDAS_POR_CHUNK; i++) if (tieneAgua(c.terreno, i)) wet++
        if (wet === CELDAS_POR_CHUNK) inundados++
        else secos++
      }
    }
    console.log(`(f) sin orilla: ${String(inundados)} chunks enteramente inundados (la orilla es del vecino) y ${String(secos)} sin agua cerca`)
  })
})
