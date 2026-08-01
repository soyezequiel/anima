// El banco de mundos de `@anima/mind`. No es un test: es lo que los tests usan
// para tener un mundo de VERDAD —`stepWorld`, la física semilla, los cuatro
// procesos, el dios— sin escribir cuarenta líneas de armado en cada uno.
//
// Es la TERCERA copia del mismo armado —`world/tests/mundo-minimo.ts` →
// `perceive/tests/mundo.ts` → `plan/tests/los-esquemas-contra-el-mundo.test.ts` → ésta—
// y la copia es deliberada por la razón que el segundo escribió: los `tests/` de
// un paquete no se exportan, así que compartirlo exigiría mover el arnés adentro
// de `src/`, o sea meterle al paquete un módulo que sólo existe para los tests.
// Lo que se copia es EL ARMADO: ni una regla del mundo, ni un número de la física.
//
// Lo que esta copia agrega y las otras no tienen: `laOrilla()`, que busca en la
// semilla un lugar donde el dios haya decretado un pozo con una celda seca al
// lado. Es el mismo barrido que `world/tests/hito-5-la-pesca.test.ts` usa para su
// criterio (a), y hace falta acá porque la corrida del documento —«con hambre y un
// río a la vista»— no se puede escribir sobre un río inventado: el pozo lo
// materializa `stepWorld` desde el decreto, y un cuerpo puesto a mano con el
// mismo nombre no es un pozo para `extraccion`.

import type { Body, FormId, Physics, QualityVector } from '@anima/physics'
import { buildSeedPhysics, HZ_DE_REFERENCIA, T_AMBIENTE } from '@anima/physics'
import type { Actor, CellState, EstadoDelDios, Placement, WorldBody, WorldState } from '@anima/world'
import { crearDios, decretoDe, idDePozo, keyOfCell, mapaDeActores, mapaDeCuerpos } from '@anima/world'

export const PHYS: Physics = buildSeedPhysics()

/** La misma semilla que `world/tests/hito-5-la-pesca.test.ts`: el mismo río. */
export const SEMILLA = 20260727n

/**
 * Un cuerpo cualquiera, A TEMPERATURA AMBIENTE.
 *
 * Lo de la temperatura no es adorno: un cuerpo sin `temperature` escrita nace a
 * 0 °C y el primer tick se le va en llegar a los 15 del ambiente. Sobre una
 * mente eso importa el doble que sobre una habilidad, porque `necesidades` mide
 * el frío del CUERPO de la criatura: una criatura que nace a cero grados tiene la
 * necesidad de calor en el techo y D5 la manda a juntar leña antes de mirar nada
 * más. Es un artefacto del armado, no del mundo.
 */
export function cuerpo(
  id: string,
  substance: string,
  mass: number,
  state: QualityVector = {},
  form: FormId = 'vara',
): Body {
  return {
    id,
    form,
    parts: [{ substance, mass, q: {} }],
    joints: [],
    state: { temperature: T_AMBIENTE, ...state },
  }
}

/**
 * Una criatura: un cuerpo de carne con `stamina` escrita.
 *
 * `form: 'bloque'` y no `'criatura'`: `FormId` es un catálogo CERRADO de seis
 * formas y no hay una para un cuerpo vivo, que es un dato — la criatura es
 * materia como cualquier otra cosa.
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
    // `irreversible` y no `reversible`: `comer` mira `ctx.self.permits` antes de
    // gastar un turno y se rinde con «todavía no tengo permiso» si no lo tiene.
    // Una criatura del Hito 5 no está en cuarentena.
    permits: o.permits ?? 'irreversible',
  }
}

export interface MundoInput {
  bodies?: readonly WorldBody[]
  actors?: readonly Actor[]
  cells?: readonly (readonly [Placement, CellState])[]
  phys?: Physics
  hz?: number
  dios?: EstadoDelDios
}

export function mundo(i: MundoInput = {}): WorldState {
  const cells = new Map<number, CellState>()
  for (const [at, c] of i.cells ?? []) cells.set(keyOfCell(at), c)
  const base: WorldState = {
    tick: 0,
    hz: i.hz ?? HZ_DE_REFERENCIA,
    phys: i.phys ?? PHYS,
    bodies: mapaDeCuerpos(i.bodies ?? []),
    actors: mapaDeActores(i.actors ?? []),
    cells,
    desplegados: new Map(),
    nextId: 1,
  }
  return i.dios === undefined ? base : { ...base, dios: i.dios }
}

/** Un cuerpo puesto en el piso, en una celda. */
export function enElPiso(b: Body, at: Placement): WorldBody {
  return { body: b, at }
}

/** Un cuerpo en la mano de alguien. Viaja con la criatura. */
export function enLaMano(b: Body, at: Placement, quien: string): WorldBody {
  return { body: b, at, heldBy: quien }
}

/** Un mundo con una criatura sola en el origen, que es el caso de casi todo test. */
export function conElla(
  cuerpos: readonly WorldBody[] = [],
  o: { at?: Placement; stamina?: number; holding?: readonly string[] } = {},
): WorldState {
  const at = o.at ?? { x: 0, y: 0 }
  const enMano = new Set(o.holding ?? [])
  const resto = cuerpos.map((c) => (enMano.has(c.body.id) ? { ...c, at, heldBy: 'ella' } : c))
  return mundo({
    bodies: [{ body: criatura('ella', o.stamina ?? 500), at }, ...resto],
    actors: [actor('ella', { holding: o.holding ?? [] })],
  })
}

// ─── La orilla de verdad de la semilla ──────────────────────────────────────

export interface Orilla {
  readonly dios: EstadoDelDios
  readonly cx: number
  readonly cy: number
  /** La celda mojada donde el dios puso el banco. */
  readonly pozo: Placement
  /** Una celda SECA pegada al pozo: desde acá se pesca. */
  readonly parada: Placement
  /** El id que el mundo le va a poner al banco cuando lo materialice. */
  readonly banco: string
}

/**
 * Una orilla de verdad de la semilla, BUSCADA y no inventada.
 *
 * Barre chunks en orden canónico hasta encontrar uno con pozo y con una celda
 * seca pegada al pozo. La celda seca puede ser del chunk vecino y ése es el caso
 * normal: el 88,8% de los chunks de `agua-dulce` está enteramente inundado
 * (medido en `world/tests/hito-5-la-pesca.test.ts`, de donde sale este barrido).
 */
export function laOrilla(semilla = SEMILLA): Orilla {
  const dios = crearDios(semilla)
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      const dec = decretoDe(dios, PHYS, cx, cy)
      if (dec.pozo === undefined) continue
      const p = dec.pozo.at
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const parada = { x: p.x + dx, y: p.y + dy }
        const vecino = decretoDe(dios, PHYS, Math.floor(parada.x / 16), Math.floor(parada.y / 16))
        const i = (((parada.y % 16) + 16) % 16) * 16 + (((parada.x % 16) + 16) % 16)
        if ((vecino.celdas[i] as { wet: number }).wet < 0.9) {
          return { dios, cx, cy, pozo: p, parada, banco: idDePozo(cx, cy) }
        }
      }
    }
  }
  throw new Error('la semilla no tiene una sola orilla en 13×13 chunks')
}
