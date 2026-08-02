// ─── EL MUNDO DE LA PARTIDA ─────────────────────────────────────────────────
//
// La misma orilla que usan el visor de la partida y el emisor del mapa: un pozo
// con una celda seca al lado, buscada en el mundo que el dios decreta. **Nadie
// planta nada**: lo que hay alrededor es lo que la semilla dice que hay, y por
// eso el mapa que sale es una medición y no una maqueta.

import { HZ_DE_REFERENCIA, buildSeedPhysics, type Body, type Physics } from '@anima/physics'
import { crearDios, decretoDe, mapaDeActores, mapaDeCuerpos, type EstadoDelDios, type WorldState } from '@anima/world'

export const PHYS: Physics = buildSeedPhysics()

/** El cuerpo de la criatura: carne, una parte, bloque. Es lo que el mundo cree. */
function criatura(id: string, stamina: number): Body {
  return {
    id: `${id}-cuerpo`,
    form: 'bloque',
    parts: [{ substance: 'carne', mass: 60, q: {} }],
    joints: [],
    state: { stamina },
  }
}

function cuerpo(id: string, substance: string, mass: number): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state: {} }
}

/** Un pozo con una celda seca al lado, en los 13×13 chunks del origen. */
function buscarOrilla(dios: EstadoDelDios): { x: number; y: number } {
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
        const v = decretoDe(dios, PHYS, Math.floor(parada.x / 16), Math.floor(parada.y / 16))
        const i = (((parada.y % 16) + 16) % 16) * 16 + (((parada.x % 16) + 16) % 16)
        if ((v.celdas[i] as { wet: number }).wet < 0.9) return parada
      }
    }
  }
  throw new Error('la semilla no tiene una sola orilla en 13×13 chunks')
}

export interface Arranque {
  readonly state: WorldState
  readonly parada: { x: number; y: number }
}

export function arrancar(semilla: bigint): Arranque {
  const dios = crearDios(semilla)
  const parada = buscarOrilla(dios)
  return {
    parada,
    state: {
      tick: 0,
      hz: HZ_DE_REFERENCIA,
      phys: PHYS,
      bodies: mapaDeCuerpos([
        // 1000 y no 2000, que es lo que decía antes: `stamina` declara
        // `range: [0, 1000]` y `qualityOf` recorta contra el rango, así que los
        // otros mil nunca existieron. Se vio al poner la barra de aliento —el
        // panel mostraba 999/1000 en el tick 16— y el número de más sólo servía
        // para que alguien creyera que esta criatura arranca con el doble.
        { body: criatura('ana', 1000), at: parada },
        { body: cuerpo('vara', 'madera', 0.5), at: parada },
        { body: cuerpo('hebra', 'liana', 0.2), at: { x: parada.x + 1, y: parada.y } },
      ]),
      actors: mapaDeActores([{ id: 'ana', body: 'ana-cuerpo', holding: [], capacity: 4, permits: 'irreversible' }]),
      cells: new Map(),
      desplegados: new Map(),
      nextId: 1,
      dios,
    },
  }
}
