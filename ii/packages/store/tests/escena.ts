// LA ESCENA DEL DOCUMENTO —«con hambre y un río a la vista»— para este paquete.
//
// Es la CUARTA copia del mismo armado, y la copia es deliberada por la razón que
// la segunda escribió: **los `tests/` de un paquete no se exportan**, así que
// compartirlo exigiría mover el arnés adentro de `src/`, o sea meterle al
// paquete un módulo que sólo existe para los tests.
//
// Lo que se copia es EL ARMADO: ni una regla del mundo, ni un número de la
// física, ni una constante de la mente. El pozo lo sigue materializando
// `stepWorld` desde el decreto del dios, que es lo único que hace que la pesca
// sea la pesca y no un cuerpo puesto a mano con el nombre correcto.

import type { Body, FormId, Physics, QualityVector } from '@anima/physics'
import { buildSeedPhysics, HZ_DE_REFERENCIA, T_AMBIENTE } from '@anima/physics'
import type { Actor, EstadoDelDios, Placement, WorldBody, WorldState } from '@anima/world'
import { crearDios, decretoDe, idDePozo, mapaDeActores, mapaDeCuerpos } from '@anima/world'

export const PHYS: Physics = buildSeedPhysics()

/** La misma semilla que el criterio del Hito 5: el mismo río. */
export const SEMILLA = 20260727n

function cuerpo(
  id: string,
  substance: string,
  mass: number,
  state: QualityVector = {},
  form: FormId = 'vara',
): Body {
  return { id, form, parts: [{ substance, mass, q: {} }], joints: [], state: { temperature: T_AMBIENTE, ...state } }
}

/** Una criatura: carne con `stamina`. `bloque` porque `FormId` no tiene una forma viva. */
function criatura(id: string, stamina: number): Body {
  return cuerpo(`${id}-cuerpo`, 'carne', 2, { stamina }, 'bloque')
}

/**
 * `permits: 'irreversible'`, y NO `undefined`.
 *
 * Costó media hora la primera vez: con el permiso vacío la criatura no llega a
 * ningún lado —el vuelo aterriza con «no llegué en 4 intentos», siete veces
 * seguidas— y el síntoma no dice nada del permiso. Una criatura del Hito 5 no
 * está en cuarentena.
 */
function actor(id: string, capacity: number): Actor {
  return { id, body: `${id}-cuerpo`, holding: [], capacity, permits: 'irreversible' }
}

interface Orilla {
  readonly dios: EstadoDelDios
  readonly parada: Placement
  readonly banco: string
}

/**
 * Un lugar de la semilla donde el dios decretó un pozo CON una celda seca al lado.
 *
 * El barrido es el mismo del criterio del Hito 5: sin él no hay dónde pararse a
 * pescar sin estar metido en el agua, y el plan elige mal.
 */
function laOrilla(semilla = SEMILLA): Orilla {
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
          return { dios, parada, banco: idDePozo(cx, cy) }
        }
      }
    }
  }
  throw new Error('la semilla no tiene una sola orilla en 13×13 chunks')
}

/** «Con hambre y un río a la vista». El 310 de aliento es el del criterio del Hito 5. */
export function laEscenaDelDocumento(stamina = 310): WorldState {
  const o = laOrilla()
  const bodies: readonly WorldBody[] = [{ body: criatura('ana', stamina), at: o.parada }]
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos(bodies),
    actors: mapaDeActores([actor('ana', 3)]),
    cells: new Map(),
    desplegados: new Map(),
    nextId: 1,
    dios: o.dios,
  }
}
