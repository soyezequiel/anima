import { describe, expect, it, vi } from 'vitest'

import { InvariantError, Ledger, canonicalize, grainOf, textFingerprint, waterBodyKey } from '../src/ledger.js'
import type { Question } from '../src/pregunta.js'

/**
 * Los tests del libro del dios. Cuatro clases, y ninguna sobra:
 *
 *   1. EL INVARIANTE DURO — escribir otra respuesta para una clave existente
 *      lanza. Si esto fallara, el dios se contradice y el jugador ve el agua
 *      desaparecer al acercarse.
 *   2. LOS DOS GRANOS — mirar de lejos NO sella un hecho fino. Si esto fallara,
 *      la ventana del oráculo tendría ancho cero y el nivel 2 entero sería
 *      código muerto. Es la falla que tenían las tres propuestas originales y es
 *      la razón de que este archivo exista.
 *   3. LA HUELLA — no depende del tick ni del orden. Es el criterio del Hito 3.
 *   4. LA NARRATIVA — el log es append-only y `verify()` lo puede replayar hasta
 *      el estado vivo. Sin eso el panel de auditoría muestra ficción.
 */

const CHUNK: Question = { k: 'chunk', cx: 3, cy: -7 }
const ARROYO: Question = { k: 'waterBody', id: '12,4' }

describe('el invariante duro', () => {
  it('escribir OTRA respuesta para una clave existente lanza', () => {
    const l = new Ledger()
    l.establish('c:0:0', { bioma: 'bosque-humedo' }, 'gruesa')
    expect(() => l.establish('c:0:0', { bioma: 'desierto' }, 'gruesa')).toThrow(InvariantError)
  })

  it('el error dice qué decía antes y qué se quiso escribir', () => {
    const l = new Ledger()
    l.establish('c:0:0', 1, 'gruesa')
    try {
      l.establish('c:0:0', 2, 'gruesa')
      expect.unreachable('tenía que lanzar')
    } catch (e) {
      expect(e).toBeInstanceOf(InvariantError)
      expect((e as InvariantError).reason).toEqual({ k: 'respuesta-distinta', key: 'c:0:0', previa: 'n1', nueva: 'n2' })
    }
  })

  it('escribir la MISMA respuesta es idempotente y no deja renglón nuevo', () => {
    const l = new Ledger()
    l.establish('c:0:0', { a: 1, b: [2, 3] }, 'gruesa')
    l.establish('c:0:0', { b: [2, 3], a: 1 }, 'gruesa') // otro orden de claves: es la misma respuesta
    expect(l.entries()).toHaveLength(1)
  })

  it('lanza aunque la clave todavía no tenga testigo: cambiar de opinión tiene su propia puerta', () => {
    const l = new Ledger()
    l.establish('w:1,1', 'mojarras', 'fina')
    expect(l.hasWitness('w:1,1')).toBe(false)
    expect(() => l.establish('w:1,1', 'truchas', 'fina')).toThrow(InvariantError)
    // ...y esa puerta es `amend`, que sí lo deja.
    expect(l.amend('w:1,1', 'truchas')).toBe(true)
  })
})

describe('ask — sincrónico, y no reevalúa', () => {
  it('devuelve lo mismo para siempre y no vuelve a llamar a la ley', () => {
    const l = new Ledger()
    const ley = vi.fn(() => ({ bioma: 'bosque-humedo' }))
    const a = l.ask(CHUNK, ley)
    const b = l.ask(CHUNK, ley)
    expect(b).toBe(a)
    expect(ley).toHaveBeenCalledTimes(1)
  })

  it('preguntar en distinto tick da la misma respuesta', () => {
    const l = new Ledger()
    const primera = l.ask(CHUNK, () => 41)
    l.advanceTo(4021)
    expect(l.ask(CHUNK, () => 999)).toBe(primera)
  })

  it('el grano lo pone la pregunta, no el que pregunta', () => {
    expect(grainOf({ k: 'chunk', cx: 0, cy: 0 })).toBe('gruesa')
    expect(grainOf({ k: 'waterBody', id: '0,0' })).toBe('fina')
    expect(grainOf({ k: 'draw', stock: 'p', n: 0 })).toBe('fina')
    expect(grainOf({ k: 'novelty', topic: 'x', nonce: 1 })).toBe('fina')
    const l = new Ledger()
    l.ask(CHUNK, () => 1)
    l.ask(ARROYO, () => 2)
    expect(l.get('c:3:-7')?.grain).toBe('gruesa')
    expect(l.get('w:12,4')?.grain).toBe('fina')
  })
})

describe('los dos granos — la ventana del oráculo', () => {
  it('mirar de lejos sella lo GRUESO', () => {
    const l = new Ledger()
    l.ask(CHUNK, () => ({ bioma: 'bosque-humedo' }))
    expect(l.witness('c:3:-7', 'gruesa')).toBe(true)
    expect(l.hasWitness('c:3:-7')).toBe(true)
  })

  it('mirar de lejos NO sella lo FINO: ahí vive el nivel 2', () => {
    const l = new Ledger()
    l.ask(ARROYO, () => 'mojarras')
    expect(l.witness('w:12,4', 'gruesa')).toBe(false)
    expect(l.hasWitness('w:12,4')).toBe(false)
  })

  it('interactuar sella lo fino', () => {
    const l = new Ledger()
    l.ask(ARROYO, () => 'mojarras')
    expect(l.witness('w:12,4', 'fina')).toBe(true)
    expect(l.hasWitness('w:12,4')).toBe(true)
  })

  it('EL CRITERIO: un hecho fino enmendado ANTES de interactuar cambia, y DESPUÉS no', () => {
    const l = new Ledger()
    l.ask(ARROYO, () => 'mojarras')

    // De lejos se ve el agua. El hecho fino sigue abierto.
    l.advanceTo(10)
    expect(l.witness('w:12,4', 'gruesa')).toBe(false)

    // El oráculo tardó nueve ticks y llegó a tiempo.
    l.advanceTo(19)
    expect(l.amend('w:12,4', 'truchas', 'el oráculo miró el bioma')).toBe(true)
    expect(l.get('w:12,4')?.answer).toBe('truchas')
    expect(l.get('w:12,4')?.by).toBe('oraculo')

    // Alguien metió la mano. Se estableció.
    l.advanceTo(20)
    expect(l.witness('w:12,4', 'fina')).toBe(true)

    // Y ahora el oráculo llega tarde, para siempre.
    l.advanceTo(400)
    expect(l.amend('w:12,4', 'bagres')).toBe(false)
    expect(l.get('w:12,4')?.answer).toBe('truchas')
    l.verify()
  })

  it('sellar dos veces es idempotente: dos criaturas mirando el mismo río no es una contradicción', () => {
    const l = new Ledger()
    l.ask(CHUNK, () => 1)
    expect(l.witness('c:3:-7', 'gruesa')).toBe(true)
    expect(l.witness('c:3:-7', 'gruesa')).toBe(true)
    expect(l.witness('c:3:-7', 'fina')).toBe(true)
    expect(l.entries().filter((e) => e.event === 'testigo')).toHaveLength(1)
  })

  it('sellar una clave que nadie decidió lanza', () => {
    const l = new Ledger()
    expect(() => l.witness('w:0,0', 'fina')).toThrow(InvariantError)
  })
})

describe('amend y discard — lo que alguien vio no se toca', () => {
  it('enmendar algo que el mundo olvidó devuelve false, no lanza', () => {
    const l = new Ledger()
    expect(l.amend('w:9,9', 'lo que sea')).toBe(false)
  })

  it('descartar devuelve false si hay testigo', () => {
    const l = new Ledger()
    l.ask(ARROYO, () => 'mojarras')
    l.witness('w:12,4', 'fina')
    expect(l.discard('w:12,4')).toBe(false)
    expect(l.get('w:12,4')?.answer).toBe('mojarras')
  })

  it('descartar sin testigo saca la clave del estado pero NO del log', () => {
    const l = new Ledger()
    l.ask(ARROYO, () => 'mojarras')
    expect(l.discard('w:12,4', 'se fusionó')).toBe(true)
    expect(l.get('w:12,4')).toBeNull()
    expect(l.entries().map((e) => e.event)).toEqual(['decidido', 'descartado'])
    // Y se puede volver a decidir: la ley da lo mismo porque la clave es la misma.
    expect(l.ask(ARROYO, () => 'mojarras')).toBe('mojarras')
    l.verify()
  })

  it('una respuesta sin forma canónica no entra ni de la mano del oráculo', () => {
    const l = new Ledger()
    l.ask(ARROYO, () => 'mojarras')
    expect(() => l.amend('w:12,4', undefined)).toThrow(InvariantError)
    expect(() => l.establish('w:0,0', () => 1, 'fina')).toThrow(InvariantError)
    expect(l.get('w:12,4')?.answer).toBe('mojarras')
  })
})

describe('la narrativa', () => {
  it('el log es append-only: los renglones viejos no cambian', () => {
    const l = new Ledger()
    l.ask(ARROYO, () => 'mojarras')
    const primero = l.entries()[0]
    l.advanceTo(5)
    l.amend('w:12,4', 'truchas')
    l.advanceTo(9)
    l.witness('w:12,4', 'fina')
    expect(l.entries()).toHaveLength(3)
    expect(l.entries()[0]).toBe(primero)
    expect(primero?.answer).toBe('mojarras')
    expect(primero?.witnessed).toBe(false)
    expect(l.entries().map((e) => e.atTick)).toEqual([0, 5, 9])
  })

  it('el renglón guarda cuándo se decidió por primera vez, aunque después se enmiende', () => {
    const l = new Ledger(100)
    l.ask(ARROYO, () => 'mojarras')
    l.advanceTo(400)
    l.amend('w:12,4', 'truchas')
    expect(l.get('w:12,4')?.decidedAtTick).toBe(100)
    expect(l.get('w:12,4')?.atTick).toBe(400)
  })

  it('el reloj del libro no vuelve atrás', () => {
    const l = new Ledger(10)
    expect(() => l.advanceTo(9)).toThrow(InvariantError)
  })

  it('verify() replaya el log hasta el estado vivo, tick por tick', () => {
    const l = new Ledger()
    for (let t = 0; t < 40; t++) {
      l.advanceTo(t)
      l.ask({ k: 'chunk', cx: t % 7, cy: 0 }, () => ({ bioma: `b${String(t % 7)}` }))
      if (t % 3 === 0) l.witness(`c:${String(t % 7)}:0`, 'gruesa')
      if (t % 5 === 0) l.amend(`c:${String(t % 7)}:0`, { bioma: 'enmendado' })
      l.verify() // el invariante duro, verificado POR TICK
    }
    expect(l.state().length).toBe(7)
  })
})

describe('la huella', () => {
  it('no depende del tick ni del orden en que se preguntó', () => {
    const ley = (q: Question): string => `respuesta-de-${JSON.stringify(q)}`
    const preguntas: Question[] = [
      { k: 'chunk', cx: 0, cy: 0 },
      { k: 'chunk', cx: 1, cy: 0 },
      { k: 'waterBody', id: '3,3' },
      { k: 'novelty', topic: 'liana', nonce: 2 },
    ]

    // Una historia: preguntar todo y recién después mirar.
    const a = new Ledger()
    for (const q of preguntas) a.ask(q, () => ley(q))
    a.advanceTo(50)
    a.witness('c:0:0', 'gruesa')
    a.witness('w:3,3', 'fina')

    // Otra historia: otro orden, otros ticks, y mirar sobre la marcha.
    const b = new Ledger()
    for (const q of [...preguntas].reverse()) {
      b.advanceTo(b.tick + 13)
      b.ask(q, () => ley(q))
      if (q.k === 'waterBody') b.witness('w:3,3', 'fina')
    }
    b.advanceTo(999)
    b.witness('c:0:0', 'gruesa')

    expect(b.fingerprint()).toBe(a.fingerprint())
    // ...y las historias SÍ difieren: otro orden, otros ticks. Que la huella no
    // se entere de eso es exactamente lo que se está midiendo.
    const historia = (l: Ledger): string => JSON.stringify(l.entries().map((e) => [e.key, e.event, e.atTick]))
    expect(historia(b)).not.toBe(historia(a))
  })

  it('cambia cuando cambia una respuesta', () => {
    const a = new Ledger()
    a.ask(ARROYO, () => 'mojarras')
    const antes = a.fingerprint()
    a.amend('w:12,4', 'truchas')
    expect(a.fingerprint()).not.toBe(antes)
  })

  it('dos claves con la misma respuesta no colisionan', () => {
    const a = new Ledger()
    a.establish('w:1,1', 'x', 'fina')
    const b = new Ledger()
    b.establish('w:1,2', 'x', 'fina')
    expect(a.fingerprint()).not.toBe(b.fingerprint())
  })
})

describe('la forma canónica', () => {
  it('el orden de las claves no cambia el texto', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }))
  })

  it('-0 y 0 son la misma respuesta, porque para el resto del motor lo son', () => {
    expect(canonicalize(-0)).toBe(canonicalize(0))
  })

  it('lo que no se puede guardar, lanza', () => {
    expect(() => canonicalize(undefined)).toThrow(InvariantError)
    expect(() => canonicalize(NaN)).toThrow(InvariantError)
    expect(() => canonicalize(Infinity)).toThrow(InvariantError)
    expect(() => canonicalize(Symbol('x'))).toThrow(InvariantError)
  })

  it('distingue lo que hay que distinguir', () => {
    expect(canonicalize('1')).not.toBe(canonicalize(1))
    expect(canonicalize(1n)).not.toBe(canonicalize(1))
    expect(canonicalize([1, 2])).not.toBe(canonicalize({ 0: 1, 1: 2 }))
    expect(canonicalize(null)).not.toBe(canonicalize('z'))
  })

  it('la huella de texto es estable y de 16 dígitos', () => {
    expect(textFingerprint('mojarras')).toBe(textFingerprint('mojarras'))
    expect(textFingerprint('mojarras')).toHaveLength(16)
    expect(textFingerprint('mojarras')).not.toBe(textFingerprint('mojarras '))
  })
})

describe('la clave de un cuerpo de agua', () => {
  it('es una sola forma, y es la del ledger', () => {
    expect(waterBodyKey('12,4')).toBe('w:12,4')
  })
})
