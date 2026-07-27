// Un mundo de juguete para probar la crónica.
//
// Por qué de juguete y no el mundo de verdad: si estos tests corrieran contra
// `stepWorld`, una divergencia podría ser del journal, del snapshot, del hash o
// de las doce leyes, y averiguar cuál cuesta un día. Acá el motor son treinta
// líneas de enteros que se leen de una sentada, así que cuando un test de
// `replay` se pone rojo, el bug es del replay. El mundo de verdad se prueba con
// esto mismo el día que exista: `replay` recibe el `step` por parámetro
// justamente para eso.
//
// Todo entero, todo con `+ - * >>`: nada de `Math` trascendente, nada de `Date`,
// nada de `Math.random`. Las mismas reglas que el paquete.

/** Un bicho: se enfría solo y se seca cuando está caliente. */
export interface Bicho {
  readonly id: string
  readonly calor: number
  readonly agua: number
}

export type Mundo = Map<string, Bicho>

export type Intencion =
  | { readonly k: 'calentar'; readonly id: string; readonly cuanto: number }
  | { readonly k: 'mojar'; readonly id: string; readonly cuanto: number }
  | { readonly k: 'nacer'; readonly id: string }
  | { readonly k: 'morir'; readonly id: string }

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * Un tick.
 *
 * Primero la FÍSICA, que corre sola y sin que nadie la pida —es lo que hace que
 * un replay que saltee ticks vacíos dé mal—, y después las intenciones en orden.
 *
 * Copia al escribir: el bicho que no cambió se devuelve por referencia. Sin eso,
 * el modo `'identidad'` del snapshot no tendría cómo funcionar ni cómo probarse.
 */
export function paso(m: Mundo, intents: readonly Intencion[], _tick: number): Mundo {
  const out: Mundo = new Map()

  for (const [k, b] of m) {
    // Se enfría uno más un octavo, y se seca en proporción al calor que tiene.
    const calor = b.calor > 0 ? clamp(b.calor - 1 - (b.calor >> 3), 0, 1_000_000) : 0
    const agua = clamp(b.agua - (b.calor >> 4), 0, 1_000_000)
    out.set(k, calor === b.calor && agua === b.agua ? b : { id: b.id, calor, agua })
  }

  for (const i of intents) {
    const k = `b:${i.id}`
    if (i.k === 'nacer') {
      if (!out.has(k)) out.set(k, { id: i.id, calor: 20, agua: 100 })
      continue
    }
    if (i.k === 'morir') {
      out.delete(k)
      continue
    }
    const b = out.get(k)
    if (b === undefined) continue // una intención sobre lo que no existe no hace nada
    if (i.k === 'calentar') {
      out.set(k, { id: b.id, calor: clamp(b.calor + i.cuanto, 0, 1_000_000), agua: b.agua })
    } else {
      out.set(k, { id: b.id, calor: b.calor, agua: clamp(b.agua + i.cuanto, 0, 1_000_000) })
    }
  }

  return out
}

export function mundoInicial(n: number): Mundo {
  const m: Mundo = new Map()
  for (let i = 0; i < n; i++) m.set(`b:${i}`, { id: `${i}`, calor: 10 + (i % 30), agua: 50 + (i % 17) })
  return m
}

/**
 * Congruencial lineal de 32 bits. Es el generador de los barridos deterministas
 * de `@anima/physics` y está acá por la misma razón: `Math.random` no se puede
 * sembrar, así que un test que lo use no se puede volver a correr igual, y un
 * test de determinismo que no se puede repetir no prueba nada.
 */
export function lcg(semilla: number): () => number {
  let s = semilla >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s
  }
}

/** Una intención cualquiera pero reproducible, sobre `n` bichos. */
export function intencionAlAzar(rnd: () => number, n: number): Intencion {
  const r = rnd()
  const id = `${r % n}`
  switch ((r >>> 16) % 8) {
    case 0:
      return { k: 'nacer', id: `${n + (r % 50)}` }
    case 1:
      return { k: 'morir', id }
    case 2:
    case 3:
      return { k: 'mojar', id, cuanto: ((r >>> 8) % 41) - 20 }
    default:
      return { k: 'calentar', id, cuanto: ((r >>> 8) % 61) - 20 }
  }
}
