/**
 * LAS QUINCE INNATAS, CORRIDAS.
 *
 * Cada una contra un mundito de juguete (`mundito.ts`), verificando su
 * contrato: que emita las intenciones que dice que emite, que termine, y que
 * establezca lo que promete establecer. NO prueba que funcionen en el mundo de
 * verdad — eso necesita el ejecutor del Hito 4 y el juez del Hito 7.
 */

import { describe, expect, it } from 'vitest'
import type { BodyView, Intent } from '../src/ctx.js'
import {
  INNATAS,
  aplicarProceso,
  comer,
  deshilachar,
  distancia,
  esperar,
  esperarLaNoche,
  explorar,
  frotar,
  guarecerse,
  huirDelDolor,
  ir,
  juntar,
  loQueSeHacer,
  poner,
  seguirOrdenDeMovimiento,
  sostener,
  tantear,
  tanteoDe,
  unir,
} from '../src/innatas/index.js'
import { Mundito, correr } from './mundito.js'

const clases = (m: Mundito): Intent['k'][] => m.emitidas.map((i) => i.k)
const vista = (m: Mundito, id: string): BodyView => {
  const c = m.cuerpo(id)
  if (!c) throw new Error(`no existe ${id}`)
  return { id: c.id, at: c.at, name: c.name, tags: c.tags ?? [], madeByMe: c.madeByMe ?? false, joints: [] }
}

// ─── El catálogo ─────────────────────────────────────────────────────────────

describe('el catálogo de las quince', () => {
  it('las quince del Hito 4 son las que el documento nombra, en su orden', () => {
    // La lista se afirma ENTERA y en orden. Lo que llegó después va abajo, con su
    // hito al lado: sin eso, un contrato nuevo entraría sin que nadie lo mire.
    expect(INNATAS.map((c) => c.nombre)).toEqual([
      'ir',
      'explorar',
      'juntar',
      'comer',
      'unir',
      'deshilachar',
      'aplicar-proceso',
      'poner',
      'sostener',
      'frotar',
      'tantear',
      'huir-del-dolor',
      'guarecerse',
      'esperar',
      'seguir-orden-de-movimiento',
      // Gate 5-6, ADR II-0023: el `BuildSkill`. No es del Hito 4 y por eso va al
      // final y anotada — el orden de las quince de arriba es historia.
      'construir',
    ])
  })

  it('las quince declaran qué establecen y qué comprometen', () => {
    // `establece` es la llave con la que el Hito 7 indexa la biblioteca. Una
    // habilidad sin `establece` es una que nadie va a poder encontrar.
    for (const c of INNATAS) {
      expect(c.establece.length, `${c.nombre} no establece nada`).toBeGreaterThan(0)
      expect(['reversible', 'costly', 'irreversible']).toContain(c.cuesta.commitment)
    }
  })

  it('las quince declararon dónde la API no alcanzó', () => {
    // El punto entero del ejercicio. Una habilidad sin huecos anotados es una
    // que no se miró.
    const sinHuecos = INNATAS.filter((c) => c.huecos.length === 0).map((c) => c.nombre)
    expect(sinHuecos).toEqual([])
    expect(INNATAS.reduce((n, c) => n + c.huecos.length, 0)).toBeGreaterThanOrEqual(15)
  })

  it('una sola de las quince es IRREVERSIBLE, y es comer', () => {
    // Si esto crece, la cuarentena de lo provisional se vuelve una jaula: una
    // habilidad `provisional` entra con `permits: reversible`.
    expect(INNATAS.filter((c) => c.cuesta.commitment === 'irreversible').map((c) => c.nombre)).toEqual(['comer'])
  })
})

// ─── 1 · ir ──────────────────────────────────────────────────────────────────

describe('ir', () => {
  it('llega, y no gasta una intención si ya está', () => {
    const m = new Mundito({ cuerpos: [{ id: 'p', at: { x: 0, y: 0 }, name: 'piedra', q: {} }], yo: { at: { x: 0, y: 0 } } })
    const r = correr(m, ir(m.ctx(), { a: vista(m, 'p'), within: 1 }))
    expect(r.outcome.ok).toBe(true)
    expect(m.emitidas.length).toBe(0)
  })

  it('camina cuando hace falta', () => {
    const m = new Mundito({ cuerpos: [{ id: 'p', at: { x: 9, y: 3 }, name: 'piedra', q: {} }] })
    const r = correr(m, ir(m.ctx(), { a: vista(m, 'p'), within: 1 }))
    expect(r.outcome.ok).toBe(true)
    expect(clases(m)).toEqual(['goTo'])
    expect(distancia(m.posicion, { x: 9, y: 3 })).toBeLessThanOrEqual(1)
  })

  it('NO reintenta cuando el motivo no mejora esperando', () => {
    // La rama que sólo se puede escribir desde que `StepResult.por` existe.
    const m = new Mundito({ cuerpos: [{ id: 'p', at: { x: 9, y: 3 }, name: 'p', q: {} }], rechaza: { goTo: 'sin-fuerza' } })
    const r = correr(m, ir(m.ctx(), { a: vista(m, 'p'), reintentos: 5 }))
    expect(r.outcome.ok).toBe(false)
    expect(clases(m)).toEqual(['goTo']) // una sola, no cinco
  })

  it('reintenta cuando SÍ mejora esperando', () => {
    const m = new Mundito({ cuerpos: [{ id: 'p', at: { x: 9, y: 3 }, name: 'p', q: {} }], rechaza: { goTo: 'celda-ocupada' } })
    correr(m, ir(m.ctx(), { a: vista(m, 'p'), reintentos: 3 }))
    expect(clases(m)).toEqual(['goTo', 'goTo', 'goTo'])
  })
})

// ─── 2 · explorar ────────────────────────────────────────────────────────────

describe('explorar', () => {
  it('no explora si lo buscado ya está a la vista', () => {
    const m = new Mundito({ cuerpos: [{ id: 'v', at: { x: 2, y: 0 }, name: 'vara', q: { rigidity: 0.9 } }] })
    const r = correr(m, explorar(m.ctx(), { busco: [{ q: 'rigidity', op: '>=', v: 0.5 }], maxTicks: 50 }))
    expect(r.outcome.ok).toBe(true)
    expect(m.emitidas.length).toBe(0)
  })

  it('busca AGUA por el campo de celda, que es donde vive', () => {
    // El hallazgo del emisor de la API: el agua no es un cuerpo. `see()` no la
    // encuentra nunca y `qAt` sí, y por eso esta habilidad tiene dos predicados.
    const m = new Mundito({ cuerpos: [], celdas: { '3,0': { wet: 1 } } })
    const r = correr(m, explorar(m.ctx(), { buscoEnLaCelda: { q: 'wet', op: '>=', v: 0.9 }, maxTicks: 50, radio: 4 }))
    expect(r.outcome.ok).toBe(true)
    expect(m.emitidas.length).toBe(0)
  })

  it('emite un explore cuando no ve nada, y falla con honestidad', () => {
    const m = new Mundito({ cuerpos: [] })
    const r = correr(m, explorar(m.ctx(), { busco: [{ q: 'rigidity', op: '>=', v: 0.5 }], maxTicks: 50 }))
    expect(clases(m)).toEqual(['explore'])
    expect(r.outcome.ok).toBe(false)
  })
})

// ─── 3 · juntar ──────────────────────────────────────────────────────────────

describe('juntar', () => {
  it('junta por cercanía y deja una mano libre', () => {
    const m = new Mundito({
      cuerpos: [
        { id: 'a', at: { x: 8, y: 0 }, name: 'a', q: { portable: 1, rigidity: 0.9 } },
        { id: 'b', at: { x: 1, y: 0 }, name: 'b', q: { portable: 1, rigidity: 0.9 } },
        { id: 'c', at: { x: 3, y: 0 }, name: 'c', q: { portable: 1, rigidity: 0.9 } },
      ],
      yo: { capacity: 3 },
    })
    const r = correr(m, juntar(m.ctx(), { que: [{ q: 'rigidity', op: '>=', v: 0.5 }], cuantos: 5 }))
    expect(r.outcome.ok).toBe(true)
    // capacity 3 y `dejarLibre` 1 → se queda en 2, y el primero es el más cercano.
    expect(m.manos).toEqual(['b', 'c'])
  })

  it('no levanta lo que no es portable', () => {
    const m = new Mundito({ cuerpos: [{ id: 't', at: { x: 1, y: 0 }, name: 'tronco', q: { portable: 0, rigidity: 0.9 } }] })
    const r = correr(m, juntar(m.ctx(), { que: [{ q: 'rigidity', op: '>=', v: 0.5 }], cuantos: 1 }))
    expect(r.outcome.ok).toBe(false)
    expect(m.emitidas.length).toBe(0)
  })
})

// ─── 4 · comer ───────────────────────────────────────────────────────────────

describe('comer — el bucle central', () => {
  it('SE PUEDE ESCRIBIR, y sin cablear ningún umbral', () => {
    const m = new Mundito({
      cuerpos: [{ id: 'pez', at: { x: 1, y: 0 }, name: 'pescado', q: { nutrition: 8, mass: 0.6, digestibility: 0.6 } }],
      yo: { stamina: 10 },
    })
    const antes = m.stamina
    const r = correr(m, comer(m.ctx(), {}))
    expect(r.outcome.ok).toBe(true)
    expect(clases(m)).toEqual(['eat']) // ni siquiera hizo falta caminar ni levantarlo
    expect(m.stamina).toBeGreaterThan(antes)
    expect(m.existe('pez')).toBe(false)
  })

  it('elige por CALORÍAS y no por nutrición, que es intensiva', () => {
    const m = new Mundito({
      cuerpos: [
        // Más `nutrition` y muchísima menos masa: elegir por nutrición sería
        // preferir la miga al pescado. Es el error que `leyes.ts:37` documenta.
        { id: 'miga', at: { x: 1, y: 0 }, name: 'miga', q: { nutrition: 40, mass: 0.01, digestibility: 1 } },
        { id: 'pez', at: { x: 1, y: 0 }, name: 'pescado', q: { nutrition: 8, mass: 2, digestibility: 0.8 } },
      ],
    })
    correr(m, comer(m.ctx(), {}))
    expect(m.existe('pez')).toBe(false)
    expect(m.existe('miga')).toBe(true)
  })

  it('come lo que tiene en la mano antes que lo que ve', () => {
    const m = new Mundito({
      cuerpos: [
        { id: 'mano', at: { x: 0, y: 0 }, name: 'raíz', q: { nutrition: 5, mass: 1, digestibility: 0.5, portable: 1 } },
        { id: 'lejos', at: { x: 6, y: 0 }, name: 'fruto', q: { nutrition: 9, mass: 2, digestibility: 1 } },
      ],
      yo: { holding: ['mano'] },
    })
    correr(m, comer(m.ctx(), {}))
    expect(m.existe('mano')).toBe(false)
  })

  it('la CUARENTENA se puede respetar desde adentro: `self.permits`', () => {
    // `eat` es `irreversible` (tabla del mundo). Una habilidad `provisional`
    // entra con `permits: reversible` y el mundo la rechazaría con
    // `sin-permiso`. Que se pueda mirar antes es lo que deja elegir otro camino.
    const m = new Mundito({
      cuerpos: [{ id: 'pez', at: { x: 0, y: 0 }, name: 'pescado', q: { nutrition: 8, mass: 1, digestibility: 1 } }],
      yo: { permits: 'reversible' },
    })
    const r = correr(m, comer(m.ctx(), {}))
    expect(r.outcome.ok).toBe(false)
    expect(m.emitidas.length).toBe(0) // no chocó: eligió no chocar
  })

  it('no come lo que no alimenta, y no gasta la intención en preguntarlo', () => {
    const m = new Mundito({ cuerpos: [{ id: 'p', at: { x: 0, y: 0 }, name: 'piedra', q: { mass: 3 } }] })
    const r = correr(m, comer(m.ctx(), {}))
    expect(r.outcome.ok).toBe(false)
    expect(m.emitidas.length).toBe(0)
  })
})

// ─── 5 · unir · 6 · deshilachar · 7 · aplicar-proceso ────────────────────────

describe('unir, deshilachar y aplicar-proceso — la caña', () => {
  it('deshilachar da hebras que sirven de ligador: el circuito cierra', () => {
    const m = new Mundito({
      cuerpos: [{ id: 'mat', at: { x: 1, y: 0 }, name: 'matorral', q: { tensile: 0.6, portable: 1 } }],
      yo: { stamina: 40 },
    })
    const r = correr(m, deshilachar(m.ctx(), { fuente: vista(m, 'mat'), cuantas: 2 }))
    expect(r.outcome.ok).toBe(true)
    const hebra = r.outcome.ok ? r.outcome.got : undefined
    expect(hebra).toBeDefined()
    // Y lo que sale cumple EXACTAMENTE lo que `union` le pide a un ligador.
    // Eso es «la falta que generó el contrato es la llave que lo encuentra».
    const c = m.cuerpo(hebra!.id)!
    expect(c.q.flexibility).toBeGreaterThanOrEqual(0.8)
    expect(c.q.tensile).toBeGreaterThanOrEqual(0.3)
  })

  it('unir SIN `b` deja la punta suelta: la caña existe', () => {
    const m = new Mundito({
      cuerpos: [
        { id: 'vara', at: { x: 0, y: 0 }, name: 'vara', q: { rigidity: 0.8, portable: 1 } },
        { id: 'heb', at: { x: 0, y: 0 }, name: 'hebra', q: { flexibility: 0.9, tensile: 0.5, portable: 1 } },
      ],
      yo: { holding: ['vara', 'heb'] },
    })
    const r = correr(m, unir(m.ctx(), { binder: vista(m, 'heb'), a: vista(m, 'vara') }))
    expect(r.outcome.ok).toBe(true)
    const caña = r.outcome.ok ? r.outcome.got! : undefined
    expect(m.cuerpo(caña!.id)!.q.catch).toBeGreaterThan(0)
    expect(m.cuerpo(caña!.id)!.q.reach).toBeGreaterThanOrEqual(2)
  })

  it('unir rechaza un ligador que no sirve SIN gastar una intención', () => {
    // `can()` no cuesta nada y es la única puerta barata: gastar la hebra en
    // una unión que el mundo va a rechazar es cómo quedarse sin hebra.
    const m = new Mundito({
      cuerpos: [
        { id: 'vara', at: { x: 0, y: 0 }, name: 'vara', q: { rigidity: 0.8, portable: 1 } },
        { id: 'palito', at: { x: 0, y: 0 }, name: 'palito', q: { flexibility: 0.1, tensile: 0.9, portable: 1 } },
      ],
      yo: { holding: ['vara', 'palito'] },
    })
    const r = correr(m, unir(m.ctx(), { binder: vista(m, 'palito'), a: vista(m, 'vara') }))
    expect(r.outcome.ok).toBe(false)
    expect(clases(m)).not.toContain('apply')
  })

  it('aplicar-proceso pesca con la caña, y enumera lo que sabe hacer', () => {
    const m = new Mundito({
      cuerpos: [
        { id: 'caña', at: { x: 0, y: 0 }, name: 'caña', q: { reach: 3, catch: 1, portable: 1 } },
        { id: 'banco', at: { x: 1, y: 0 }, name: 'banco de peces', q: { mass: 4 } },
      ],
      yo: { holding: ['caña'] },
    })
    const r = correr(
      m,
      aplicarProceso(m.ctx(), {
        proceso: 'extraccion',
        roles: { gear: vista(m, 'caña'), source: vista(m, 'banco') },
        intentos: 10,
      }),
    )
    expect(r.outcome.ok).toBe(true)
    expect(loQueSeHacer()).toEqual(['friccion', 'union', 'deshilachar', 'extraccion'])
  })
})

// ─── 8 · poner · 9 · sostener ────────────────────────────────────────────────

describe('poner y sostener', () => {
  it('poner levanta primero: no finge arrastrar', () => {
    const m = new Mundito({ cuerpos: [{ id: 'p', at: { x: 2, y: 0 }, name: 'piedra', q: { portable: 1 } }] })
    const r = correr(m, poner(m.ctx(), { que: vista(m, 'p'), en: { x: 3, y: 0 } }))
    expect(r.outcome.ok).toBe(true)
    // Va, lo levanta, y NO camina de nuevo porque ya quedó a Chebyshev 1 de la
    // celda destino. El segundo `goTo` está escrito y no se emite: la guarda de
    // distancia lo evita, que es un tick que no se gasta.
    expect(clases(m)).toEqual(['goTo', 'take', 'put'])
  })

  it('poner falla temprano y barato con lo que no se puede levantar', () => {
    const m = new Mundito({ cuerpos: [{ id: 't', at: { x: 2, y: 0 }, name: 'tronco', q: { portable: 0 } }] })
    const r = correr(m, poner(m.ctx(), { que: vista(m, 't'), en: { x: 3, y: 0 } }))
    expect(r.outcome.ok).toBe(false)
    expect(m.emitidas.length).toBe(0)
  })

  it('sostener hace lugar soltando lo menos valioso, y NUNCA lo que hizo ella', () => {
    const m = new Mundito({
      cuerpos: [
        { id: 'caña', at: { x: 0, y: 0 }, name: 'caña', madeByMe: true, q: { portable: 1, calories: 0 } },
        { id: 'p1', at: { x: 0, y: 0 }, name: 'piedra', q: { portable: 1, calories: 3 } },
        { id: 'p2', at: { x: 0, y: 0 }, name: 'piedra', q: { portable: 1, calories: 1 } },
        { id: 'nueva', at: { x: 1, y: 0 }, name: 'vara', q: { portable: 1 } },
      ],
      yo: { capacity: 3, holding: ['caña', 'p1', 'p2'] },
    })
    const r = correr(m, sostener(m.ctx(), { que: vista(m, 'nueva') }))
    expect(r.outcome.ok).toBe(true)
    expect(m.manos).toContain('caña') // lo que fabricó no se tira
    expect(m.manos).not.toContain('p2') // la piedra que menos rinde, sí
  })
})

// ─── 10 · frotar ─────────────────────────────────────────────────────────────

describe('frotar — encender no es una acción (ADR II-0001)', () => {
  it('NO frota lo mojado: mira antes de gastar 48 de aliento', () => {
    const m = new Mundito({
      cuerpos: [
        { id: 'a', at: { x: 0, y: 0 }, name: 'palo', q: { rigidity: 0.9, moisture: 0.9, ignitionPoint: 300, portable: 1 } },
        { id: 'b', at: { x: 0, y: 0 }, name: 'palo', q: { rigidity: 0.9, portable: 1 } },
      ],
      yo: { holding: ['a', 'b'] },
    })
    const r = correr(m, frotar(m.ctx(), { a: vista(m, 'a'), b: vista(m, 'b') }))
    expect(r.outcome.ok).toBe(false)
    expect(m.emitidas.length).toBe(0)
  })

  it('sube la temperatura hasta el punto de ignición y para', () => {
    const m = new Mundito({
      cuerpos: [
        { id: 'a', at: { x: 0, y: 0 }, name: 'palo', q: { rigidity: 0.9, moisture: 0.1, temperature: 15, ignitionPoint: 250, portable: 1 } },
        { id: 'b', at: { x: 0, y: 0 }, name: 'palo', q: { rigidity: 0.9, portable: 1 } },
      ],
      yo: { holding: ['a', 'b'], stamina: 200 },
    })
    const r = correr(m, frotar(m.ctx(), { a: vista(m, 'a'), b: vista(m, 'b') }))
    expect(r.outcome.ok).toBe(true)
    expect(m.cuerpo('a')!.q.temperature).toBeGreaterThanOrEqual(250)
    // Y NO emitió ninguna intención de «encender»: no existe, y no hizo falta.
    expect(clases(m).every((k) => k === 'apply')).toBe(true)
  })

  it('no frota lo que es demasiado blando: se lo pregunta a `can()`, no lo cabla', () => {
    const m = new Mundito({
      cuerpos: [
        { id: 'a', at: { x: 0, y: 0 }, name: 'hoja', q: { rigidity: 0.1, moisture: 0, ignitionPoint: 200, portable: 1 } },
        { id: 'b', at: { x: 0, y: 0 }, name: 'palo', q: { rigidity: 0.9, portable: 1 } },
      ],
      yo: { holding: ['a', 'b'] },
    })
    const r = correr(m, frotar(m.ctx(), { a: vista(m, 'a'), b: vista(m, 'b') }))
    expect(r.outcome.ok).toBe(false)
    expect(clases(m)).not.toContain('apply')
  })
})

// ─── 11 · tantear ────────────────────────────────────────────────────────────

describe('tantear', () => {
  it('anota lo tanteado y lo puede releer', () => {
    const m = new Mundito({
      cuerpos: [{ id: 'x', at: { x: 1, y: 0 }, name: 'cosa', q: { mass: 2, tensile: 0.7 } }],
      celdas: { '1,0': { wet: 0.3 } },
    })
    const ctx = m.ctx()
    const r = correr(m, tantear(ctx, { que: vista(m, 'x') }))
    expect(r.outcome.ok).toBe(true)
    const t = tanteoDe(m.ctx(), vista(m, 'x'))
    expect(t?.cuerpo['tensile']).toBe(0.7)
    expect(t?.celda['wet']).toBe(0.3)
  })

  it('LO QUE TANTEAR NO AGREGA: `q()` ya contestaba todo sin acercarse', () => {
    // El hallazgo, hecho test. Si algún día `q()` tuviera radio o incertidumbre,
    // este test se cae, y caerse es la señal correcta.
    const m = new Mundito({ cuerpos: [{ id: 'x', at: { x: 40, y: 40 }, name: 'lejos', q: { tensile: 0.7 } }] })
    expect(m.ctx().q(vista(m, 'x'), 'tensile')).toBe(0.7)
  })
})

// ─── 12 · huir del dolor ─────────────────────────────────────────────────────

describe('huir del dolor', () => {
  it('baja el gradiente de temperatura de celda', () => {
    // Ambiente caliente: la única celda fresca está a distancia 2, así que el
    // anillo 1 no alcanza y hay que agrandarlo. Sin `ambiente`, toda celda no
    // declarada valdría 0 y huir sería dar un paso en cualquier dirección.
    const m = new Mundito({
      cuerpos: [],
      ambiente: { temperature: 300 },
      celdas: { '0,0': { temperature: 400 }, '2,0': { temperature: 20 } },
    })
    const r = correr(m, huirDelDolor(m.ctx(), { radio: 3 }))
    expect(r.outcome.ok).toBe(true)
    expect(m.posicion).toEqual({ x: 2, y: 0 })
  })

  it('falla en vez de caminar al azar cuando no hay dónde', () => {
    // Caminar al azar gasta el aliento, que es la otra mitad de lo que la mata.
    const m = new Mundito({ cuerpos: [], ambiente: { temperature: 300 } })
    const r = correr(m, huirDelDolor(m.ctx(), { radio: 2 }))
    expect(r.outcome.ok).toBe(false)
    expect(m.emitidas.length).toBe(0)
  })

  it('no se mueve si no le duele nada', () => {
    const m = new Mundito({ cuerpos: [], celdas: { '0,0': { temperature: 18 } } })
    const r = correr(m, huirDelDolor(m.ctx(), {}))
    expect(r.outcome.ok).toBe(true)
    expect(m.emitidas.length).toBe(0)
  })
})

// ─── 13 · guarecerse ─────────────────────────────────────────────────────────

describe('guarecerse', () => {
  it('se da cuenta de que ya está a cubierto', () => {
    const m = new Mundito({ cuerpos: [], celdas: { '0,0': { sheltered: 0.9 } } })
    const r = correr(m, guarecerse(m.ctx(), {}))
    expect(r.outcome.ok).toBe(true)
    expect(m.emitidas.length).toBe(0)
  })

  it('RECUERDA un techo, que es lo que `recall(WhereCell)` habilitó', () => {
    const m = new Mundito({ cuerpos: [], celdas: { '7,2': { sheltered: 0.8 } } })
    m.recordar({ x: 7, y: 2 }, { sheltered: 0.8 })
    const r = correr(m, guarecerse(m.ctx(), {}))
    expect(r.outcome.ok).toBe(true)
    expect(m.posicion).toEqual({ x: 7, y: 2 })
  })

  it('barre celdas a mano cuando no recuerda nada: 80 `qAt` por radio 4', () => {
    const m = new Mundito({ cuerpos: [], celdas: { '2,1': { sheltered: 0.9 } } })
    const r = correr(m, guarecerse(m.ctx(), { radio: 4 }))
    expect(r.outcome.ok).toBe(true)
    expect(m.posicion).toEqual({ x: 2, y: 1 })
  })

  it('EL FALSO VERDE: taparse a una misma compila y no ocluye', () => {
    // `put(techo, at, { covering: ctx.self })` typechequea porque `SelfView
    // extends BodyView`. El mundito hace lo que la ley 12 hace —tapar un
    // CUERPO, no a quien lo pone— y la habilidad se entera releyendo. Si
    // algún día la ley 12 ocluyera sobre la criatura, este test se cae, y
    // caerse es la señal correcta.
    const m = new Mundito({
      cuerpos: [{ id: 'losa', at: { x: 0, y: 0 }, name: 'losa', q: { portable: 1 } }],
      yo: { holding: ['losa'] },
    })
    const r = correr(m, guarecerse(m.ctx(), { conQue: vista(m, 'losa'), radio: 1 }))
    expect(r.outcome.ok).toBe(false)
    expect(r.outcome.ok === false && r.outcome.why).toContain('la ley 12 no ocluye sobre la criatura')
  })
})

// ─── 14 · esperar ────────────────────────────────────────────────────────────

describe('esperar', () => {
  it('usa `rateOf` para dormir de a poco en vez de muestrear a ciegas', () => {
    const m = new Mundito({
      cuerpos: [{ id: 'pez', at: { x: 0, y: 0 }, name: 'pescado', q: { digestibility: 0.1 }, tasa: { digestibility: 0.1 } }],
    })
    const r = correr(m, esperar(m.ctx(), { segundos: 30, mirando: { b: vista(m, 'pez'), q: 'digestibility', llegaA: 0.85 } }))
    expect(r.outcome.ok).toBe(true)
    // 7.5 s de cocción con paso máximo de 2 s: cinco despertadas, no 120.
    expect(m.emitidas.length).toBeLessThanOrEqual(6)
    expect(clases(m).every((k) => k === 'wait')).toBe(true)
  })

  it('NO se queda colgada esperando algo que no está pasando', () => {
    const m = new Mundito({ cuerpos: [{ id: 'x', at: { x: 0, y: 0 }, name: 'x', q: { digestibility: 0.1 } }] })
    const r = correr(m, esperar(m.ctx(), { segundos: 999, mirando: { b: vista(m, 'x'), q: 'digestibility', llegaA: 0.85 } }))
    expect(r.outcome.ok).toBe(false)
    expect(m.emitidas.length).toBe(0)
  })

  it('esperar la noche SE PUEDE ESCRIBIR: `secondsToNightfall` está en segundos', () => {
    // Con el `ticksToNightfall` del `.d.ts` a mano esto era inexpresable, y la
    // frecuencia no se publicaba. Hoy `wait` y el reloj hablan la misma unidad.
    const m = new Mundito({ cuerpos: [], clock: { secondsToNightfall: 6 } })
    const r = correr(m, esperarLaNoche(m.ctx()))
    expect(r.outcome.ok).toBe(true)
    expect(clases(m).every((k) => k === 'wait')).toBe(true)
  })
})

// ─── 15 · seguir orden de movimiento ─────────────────────────────────────────

describe('seguir orden de movimiento', () => {
  it('obedece «andá ahí»', () => {
    const m = new Mundito({ cuerpos: [] })
    const r = correr(m, seguirOrdenDeMovimiento(m.ctx(), { orden: { verbo: 'ir', a: { x: 5, y: 5 } } }))
    expect(r.outcome.ok).toBe(true)
    expect(m.posicion).toEqual({ x: 5, y: 5 })
  })

  it('«volvé» funciona porque la habilidad anotó de dónde salió', () => {
    // `recall` busca por cualidad de celda; «el último lugar donde estuve» no
    // existe en la API. Lo sostiene `ctx.memory`, llenado por esta habilidad.
    const m = new Mundito({ cuerpos: [] })
    const ctx = m.ctx()
    correr(m, seguirOrdenDeMovimiento(ctx, { orden: { verbo: 'ir', a: { x: 5, y: 5 } } }))
    const r = correr(m, seguirOrdenDeMovimiento(m.ctx(), { orden: { verbo: 'volver' } }))
    expect(r.outcome.ok).toBe(true)
    expect(m.posicion).toEqual({ x: 0, y: 0 })
  })

  it('«pará» no para nada, y lo dice', () => {
    const m = new Mundito({ cuerpos: [] })
    const r = correr(m, seguirOrdenDeMovimiento(m.ctx(), { orden: { verbo: 'parar' } }))
    expect(r.outcome.ok).toBe(true)
    expect(m.emitidas.length).toBe(0) // no hay primitiva de cancelación
  })
})

// ─── EL HALLAZGO QUE ENCONTRÓ CORRERLAS ──────────────────────────────────────

describe('la vista congelada: `ctx.self` es una PROPIEDAD, no un método', () => {
  /**
   * Lo encontró la ejecución y no el compilador, que es exactamente para lo que
   * está este archivo. Cinco de las quince fallaron a la vez con la misma causa.
   *
   * Un generador recibe `ctx` UNA sola vez, en la llamada, y lo sigue teniendo
   * después de cada `yield`. `see()`, `q()` y `qAt()` son MÉTODOS, así que se
   * vuelven a llamar y contestan el tick nuevo. Pero `self`, `tick` y `clock`
   * son PROPIEDADES. Si el ejecutor construye un `Ctx` con `self` ya calculado,
   * la habilidad nunca ve que acaba de levantar algo, ni que se movió, ni que
   * anocheció — y `juntar` se llena las manos más allá de `capacity`,
   * `guarecerse` relee la celda vieja, y `esperarLaNoche` no termina nunca.
   *
   * LA API NO DICE CUÁL DE LAS DOS LECTURAS VALE, y las dos son escribibles:
   *
   *   a) el ejecutor entrega un `Ctx` nuevo por tick  → la habilidad tiene el
   *      viejo, y `self` queda congelado. CINCO DE LAS QUINCE SE ROMPEN.
   *   b) el ejecutor MUTA el mismo objeto en su lugar → anda, y es la única
   *      lectura con la que el ejemplo canónico del documento funciona.
   *
   * Y LA CONVERGENCIA, que es lo que convierte esto de sospecha en hallazgo:
   * `src/ejecutor.ts` llegó a lo mismo por el otro lado y lo escribió como
   * contrato, en prosa, sobre `WorldCtx` —«el mundo entrega UN objeto por
   * habilidad en vuelo y lo REFRESCA en su lugar cada tick […] no puede
   * entregar uno nuevo por paso, porque el generador se quedó con la referencia
   * del primero»—. O sea que la lectura correcta es (b), y está anotada en un
   * comentario de un archivo que el modelo no lee. `skill-api.d.ts`, que ES el
   * prompt, no lo dice en ninguna parte, y `Ctx` no tiene forma de obligarlo:
   * `installSkillState` recibe un `WorldCtx` cualquiera y confía.
   *
   * Y el precio de (b) es que `Ctx` tiene que ser mutable por dentro, que es lo
   * contrario de «la percepción congelada del tick». La reparación limpia es
   * hacer `self` un MÉTODO —`ctx.self()`— igual que `see()`, `q()` y `qAt()`:
   * la forma de la firma dice sola que se relee, no hay nada que documentar, y
   * `Ctx` puede volver a ser inmutable. `hz` puede quedar como propiedad porque
   * es lo único que de verdad no cambia.
   */
  it('una habilidad que releyó `self` ve lo que acaba de hacer', () => {
    const m = new Mundito({
      cuerpos: [{ id: 'p', at: { x: 1, y: 0 }, name: 'piedra', q: { portable: 1 } }],
    })
    const ctx = m.ctx()
    expect(ctx.self.holding.length).toBe(0)
    m.juzgar(ctx.take(vista(m, 'p')))
    // Con el mismo `ctx` de antes. Si esto diera 0, `juntar` se pasaría de
    // `capacity` y `sostener` soltaría cosas que no hacía falta soltar.
    expect(ctx.self.holding.length).toBe(1)
  })

  it('y `clock` también, o esperar la noche no termina nunca', () => {
    const m = new Mundito({ cuerpos: [], clock: { secondsToNightfall: 1 } })
    const ctx = m.ctx()
    m.juzgar(ctx.wait(2))
    expect(ctx.clock.phase).toBe('noche')
  })
})

// ─── El criterio del Hito 4 que sí se puede medir hoy ────────────────────────

describe('criterio: las quince corren y ninguna se cuelga', () => {
  it('ninguna de las quince necesita más de 200 pasos en su caso nominal', () => {
    // El criterio del documento es «las quince corren dentro del presupuesto».
    // El presupuesto de combustible es de otro archivo; lo que se puede medir
    // acá es que ninguna entre en un bucle sin salida.
    const m = new Mundito({
      cuerpos: [
        { id: 'mat', at: { x: 1, y: 0 }, name: 'matorral', q: { tensile: 0.6, portable: 1 } },
        { id: 'pez', at: { x: 1, y: 0 }, name: 'pescado', q: { nutrition: 8, mass: 1, digestibility: 0.8, portable: 1 } },
      ],
      yo: { stamina: 100 },
    })
    const corridas = [
      correr(m, ir(m.ctx(), { a: { x: 2, y: 2 } })),
      correr(m, explorar(m.ctx(), { busco: [{ q: 'tensile', op: '>=', v: 0.3 }], maxTicks: 20 })),
      correr(m, juntar(m.ctx(), { que: [{ q: 'tensile', op: '>=', v: 0.3 }], cuantos: 1 })),
      correr(m, deshilachar(m.ctx(), { fuente: vista(m, 'mat'), cuantas: 1 })),
      correr(m, tantear(m.ctx(), { que: vista(m, 'pez') })),
      correr(m, huirDelDolor(m.ctx(), {})),
      correr(m, guarecerse(m.ctx(), { radio: 2 })),
      correr(m, esperar(m.ctx(), { segundos: 1 })),
      correr(m, seguirOrdenDeMovimiento(m.ctx(), { orden: { verbo: 'ir', a: { x: 1, y: 1 } } })),
      correr(m, comer(m.ctx(), {})),
    ]
    expect(corridas.filter((c) => c.cortada)).toEqual([])
  })
})
