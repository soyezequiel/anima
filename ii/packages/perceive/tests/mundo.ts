// El banco de pruebas de `@anima/perceive`. No es un test: es lo que los tests
// usan para tener un mundo de VERDAD —`stepWorld`, la física semilla, los cuatro
// procesos— sin escribir cuarenta líneas de armado en cada uno.
//
// Es una copia adaptada de `world/tests/mundo-minimo.ts`, y la copia es a
// propósito: los `tests/` de un paquete no se exportan, así que la única forma de
// compartirlo sería moverlo a `src/`, o sea meter el arnés adentro del paquete.
// Lo que se copió es el armado, no ninguna regla del mundo.
//
// El LCG está escrito a mano, con las constantes de Numerical Recipes: un barrido
// que no se puede repetir no sirve para encontrar el tick en el que dos mundos
// gemelos se separaron.

import type { Body, FormId, Physics, QualityVector } from '@anima/physics'
import { buildSeedPhysics, HZ_DE_REFERENCIA } from '@anima/physics'
import type { Actor, CellState, Placement, WorldBody, WorldState } from '@anima/world'
import { keyOfCell, mapaDeActores, mapaDeCuerpos } from '@anima/world'

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
  // Los DIECISÉIS BITS ALTOS y no `% n` sobre el valor entero: en un LCG de
  // módulo 2³² el bit k tiene período 2^(k+1), así que los tres bits bajos se
  // repiten cada ocho tiradas y dos semillas distintas dan la misma sucesión
  // corrida un lugar.
  r.entero = (n: number): number => (n <= 0 ? 0 : (f() >>> 16) % n)
  return r
}

export function cuerpo(
  id: string,
  substance: string,
  mass: number,
  state: QualityVector = {},
  form: FormId = 'vara',
): Body {
  return { id, form, parts: [{ substance, mass, q: {} }], joints: [], state }
}

/**
 * Una criatura: un cuerpo de carne con `stamina` escrita.
 *
 * `form: 'bloque'` y no `'criatura'`: `FormId` es un catálogo CERRADO de seis
 * formas y no hay una para un cuerpo vivo, que es un dato — la criatura es
 * materia como cualquier otra cosa, y por eso se puede comer el cadáver de la
 * que no llegó.
 */
export function criatura(id: string, stamina = 500): Body {
  return cuerpo(`${id}-cuerpo`, 'carne', 2, { stamina }, 'bloque')
}

export function actor(
  id: string,
  o: { holding?: readonly string[]; capacity?: number; permits?: Actor['permits'] } = {},
): Actor {
  return {
    id,
    body: `${id}-cuerpo`,
    holding: o.holding ?? [],
    capacity: o.capacity ?? 3,
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
  hz?: number
}

export function mundo(i: MundoInput = {}): WorldState {
  const cells = new Map<number, CellState>()
  for (const [at, c] of i.cells ?? []) cells.set(keyOfCell(at), c)
  return {
    tick: i.tick ?? 0,
    hz: i.hz ?? HZ_DE_REFERENCIA,
    phys: i.phys ?? buildSeedPhysics(),
    bodies: mapaDeCuerpos(i.bodies ?? []),
    actors: mapaDeActores(i.actors ?? []),
    cells,
    desplegados: new Map(),
    nextId: i.nextId ?? 1,
  }
}

/** Un mundo con una criatura sola en el origen, que es el caso de casi todo test. */
export function conElla(
  cuerpos: readonly WorldBody[] = [],
  o: { at?: Placement; stamina?: number; holding?: readonly string[]; hz?: number } = {},
): WorldState {
  const at = o.at ?? { x: 0, y: 0 }
  const cuerpoDeElla: WorldBody = { body: criatura('ella', o.stamina ?? 500), at }
  const enMano = new Set(o.holding ?? [])
  const resto = cuerpos.map((c) => (enMano.has(c.body.id) ? { ...c, at, heldBy: 'ella' } : c))
  return mundo({
    bodies: [cuerpoDeElla, ...resto],
    actors: [actor('ella', { holding: o.holding ?? [] })],
    ...(o.hz === undefined ? {} : { hz: o.hz }),
  })
}
