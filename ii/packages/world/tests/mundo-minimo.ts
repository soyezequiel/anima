// El banco de pruebas del mundo. No es un test: es lo que los tests usan para
// tener un mundo sin escribir cuarenta líneas de armado en cada uno.
//
// Todo lo de acá es determinista y explícito. En particular el generador de
// números: es un LCG escrito a mano, con las constantes de Numerical Recipes y
// aritmética de 32 bits, porque `Math.random` está prohibido en este paquete y
// porque un barrido que no se puede repetir no sirve para encontrar el tick en el
// que dos mundos gemelos se separaron.

import type { Body, Physics, QualityVector, Substance } from '@anima/physics'
import { buildSeedPhysics, SUSTANCIAS_SEMILLA } from '@anima/physics'
import type { Intent, Placement } from '../src/intent.js'
import type { Actor, CellState, WorldBody, WorldState } from '../src/step.js'
import { mapaDeActores, mapaDeCuerpos } from '../src/step.js'
import { keyOfCell } from '../src/cell.js'

// ─── Azar reproducible ───────────────────────────────────────────────────────

export interface Rng {
  (): number
  entero(n: number): number
}

export function lcg(semilla: number): Rng {
  let s = semilla >>> 0
  const f = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s
  }
  const r = f as Rng
  // Los DIECISÉIS BITS ALTOS, y no `% n` sobre el valor entero.
  //
  // No es cosmética: en un LCG de módulo 2³², el bit k tiene período 2^(k+1), así
  // que los tres bits bajos se repiten cada ocho tiradas. Con `% 8`, las semillas
  // 1 y 2 producen LA MISMA sucesión corrida un lugar —se comprobó—, y el control
  // negativo del test de gemelos («dos semillas distintas dan huellas distintas»)
  // fallaba por eso: no porque el mundo fuera insensible a la semilla, sino
  // porque las dos semillas eran la misma. Un generador de pruebas que no
  // distingue es peor que no tener ninguno.
  r.entero = (n: number): number => (n <= 0 ? 0 : (f() >>> 16) % n)
  return r
}

// ─── Cuerpos ─────────────────────────────────────────────────────────────────

export function cuerpo(
  id: string,
  substance: string,
  mass: number,
  state: QualityVector = {},
): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state }
}

export function enElPiso(b: Body, at: Placement): WorldBody {
  return { body: b, at }
}

export function enLaMano(b: Body, at: Placement, quien: string): WorldBody {
  return { body: b, at, heldBy: quien }
}

/**
 * Una criatura: un cuerpo de carne con `stamina` escrita.
 *
 * `stamina` no sale de ninguna sustancia —no es una propiedad de la carne— y por
 * eso va en `state`: es una cuenta que el cuerpo lleva, y la única del mundo que
 * puede subir, y solo comiendo.
 */
export function criatura(id: string, stamina = 100): Body {
  return cuerpo(`${id}-cuerpo`, 'carne', 2, { stamina })
}

export function actor(
  id: string,
  o: { holding?: readonly string[]; capacity?: number; permits?: Actor['permits'] } = {},
): Actor {
  return {
    id,
    body: `${id}-cuerpo`,
    holding: o.holding ?? [],
    capacity: o.capacity ?? 2,
    permits: o.permits ?? 'irreversible',
  }
}

export interface MundoInput {
  bodies?: readonly WorldBody[]
  actors?: readonly Actor[]
  cells?: readonly (readonly [Placement, CellState])[]
  phys?: Physics
  tick?: number
  nextId?: number
}

export function mundo(i: MundoInput = {}): WorldState {
  const cells = new Map<number, CellState>()
  for (const [at, c] of i.cells ?? []) cells.set(keyOfCell(at), c)
  return {
    tick: i.tick ?? 0,
    phys: i.phys ?? buildSeedPhysics(),
    bodies: mapaDeCuerpos(i.bodies ?? []),
    actors: mapaDeActores(i.actors ?? []),
    cells,
    nextId: i.nextId ?? 1,
  }
}

/** Una física con una sustancia más. Sirve para probar sin tocar el catálogo. */
export function conExtra(s: Substance): Physics {
  return buildSeedPhysics({ substances: [...SUSTANCIAS_SEMILLA, s] })
}

// ─── La huella ───────────────────────────────────────────────────────────────
//
// El criterio del Hito 2 habla de `hashWorld`. Esa función es de otro archivo del
// paquete; acá hay una huella LOCAL de los tests, y es a propósito: si el test de
// gemelos usara el mismo código que el mundo, un bug en el hash haría pasar el
// test de determinismo por la peor razón posible —dos mundos distintos que
// hashean igual—. Ésta recorre el estado entero, campo por campo, y no comparte
// una sola línea con el paquete.

export function huella(s: WorldState): number {
  const t = new Texto()
  t.n(s.tick)
  t.n(s.nextId)
  t.n(s.phys.version)
  for (const id of s.phys.substances.keys()) t.s(id)
  for (const [id, c] of s.bodies) {
    t.s(id)
    t.n(c.at.x)
    t.n(c.at.y)
    t.s(c.heldBy ?? '-')
    t.s(c.supportedBy ?? '-')
    t.s(c.covering ?? '-')
    t.s(c.body.form)
    t.s(c.body.madeBy ?? '-')
    for (const p of c.body.parts) {
      t.s(p.substance)
      t.n(p.mass)
      vector(t, p.q)
    }
    for (const j of c.body.joints) {
      t.n(j.a)
      t.n(j.b)
      t.s(j.via)
      t.n(j.strength)
    }
    vector(t, c.body.state)
  }
  for (const [id, a] of s.actors) {
    t.s(id)
    t.s(a.body)
    t.n(a.capacity)
    t.s(a.permits)
    for (const h of a.holding) t.s(h)
    if (a.doing !== undefined) {
      t.s(a.doing.process)
      t.n(a.doing.ticks)
      for (const r of a.doing.roles) {
        t.s(r.name)
        t.s(r.body)
      }
    }
  }
  for (const [k, c] of s.cells) {
    t.n(k)
    t.n(c.wet)
    t.n(c.oxygen)
    t.n(c.temperature)
  }
  return t.valor
}

function vector(t: Texto, v: QualityVector): void {
  // Las claves se ordenan antes de mezclarlas: `Object.keys` no promete un orden
  // que sirva para comparar dos mundos que llegaron al mismo estado por caminos
  // distintos, y ése es exactamente el caso del test de restaurar a mitad.
  for (const k of Object.keys(v).sort()) {
    t.s(k)
    t.n(v[k as keyof QualityVector] ?? 0)
  }
}

class Texto {
  valor = 2166136261
  s(x: string): void {
    for (let i = 0; i < x.length; i++) this.byte(x.charCodeAt(i))
    this.byte(0)
  }
  n(x: number): void {
    // Los bits exactos del double, no su forma decimal: dos números que difieren
    // en el último bit tienen que dar huellas distintas o el test no mide nada.
    const b = new DataView(new ArrayBuffer(8))
    b.setFloat64(0, x)
    for (let i = 0; i < 8; i++) this.byte(b.getUint8(i))
  }
  byte(x: number): void {
    this.valor = Math.imul(this.valor ^ (x & 255), 16777619) >>> 0
  }
}

// ─── Intenciones al azar, reproducibles ──────────────────────────────────────

/**
 * Un chorro de intenciones arbitrarias. La mitad son honestas y la otra mitad
 * son basura —cuerpos que no existen, compromisos mal declarados, actores
 * inventados—, y eso es el punto: el determinismo tiene que valer también para el
 * camino del rechazo, que es el que más ramas tiene.
 */
export function intencionesAlAzar(r: Rng, actores: readonly string[], cuantas: number): Intent[] {
  const out: Intent[] = []
  for (let i = 0; i < cuantas; i++) {
    const by = actores[r.entero(actores.length)] ?? 'a'
    const seq = i
    switch (r.entero(9)) {
      case 0:
        out.push({ k: 'wait', by, seq, commitment: 'reversible', ticks: 1 })
        break
      case 1:
        out.push({
          k: 'goTo',
          by,
          seq,
          commitment: 'reversible',
          to: { x: r.entero(9) - 4, y: r.entero(9) - 4 },
          within: 0,
        })
        break
      case 2:
        out.push({ k: 'explore', by, seq, commitment: 'reversible', maxTicks: 5 })
        break
      case 3:
        out.push({ k: 'take', by, seq, commitment: 'reversible', what: `c${r.entero(6)}` })
        break
      case 4:
        out.push({ k: 'drop', by, seq, commitment: 'reversible', what: `c${r.entero(6)}` })
        break
      case 5:
        out.push({
          k: 'put',
          by,
          seq,
          commitment: 'reversible',
          what: `c${r.entero(6)}`,
          at: { x: r.entero(3) - 1, y: r.entero(3) - 1 },
        })
        break
      case 6:
        out.push({ k: 'eat', by, seq, commitment: 'irreversible', what: `c${r.entero(6)}` })
        break
      case 7:
        out.push({
          k: 'apply',
          by,
          seq,
          commitment: 'costly',
          process: 'deshilachar',
          roles: [
            { name: 'actor', body: `${by}-cuerpo` },
            { name: 'source', body: `c${r.entero(6)}` },
          ],
        })
        break
      default:
        // `union` entra al barrido porque su rendimiento `join` es el que más
        // toca: consume tres cuerpos, crea uno, y lo tiene que meter en una mano
        // que acaba de quedar libre. Es donde más fácil se inventa o se pierde
        // materia, así que es donde más falta hace que el arnés mire.
        out.push({
          k: 'apply',
          by,
          seq,
          commitment: 'reversible',
          process: 'union',
          roles: [
            { name: 'a', body: `c${r.entero(6)}` },
            { name: 'binder', body: `c${r.entero(6)}` },
          ],
        })
        break
    }
  }
  return out
}
