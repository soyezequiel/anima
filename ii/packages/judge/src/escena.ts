/**
 * DE UN MUNDO DEL BANCO A UNA PARTIDA QUE CORRE — Hito 7, tramo E.
 *
 * `banco.ts` decide QUÉ materia se le pone delante a la habilidad. Este archivo
 * arma el mundo donde eso pasa: una criatura, el objetivo al lado, y nada más.
 *
 * ─── Por qué la escena es POBRE a propósito ─────────────────────────────────
 *
 * Porque lo que se juzga es la habilidad, no su suerte. Un mundo con veinte
 * cuerpos alrededor le da a la habilidad veinte formas de acertar por accidente
 * —agarra otra cosa, se topa con lo que necesitaba— y el veredicto deja de
 * hablar de ella.
 *
 * La escena tiene exactamente lo que el contrato nombra: la criatura, y el
 * objetivo si el contrato pide uno. Si la habilidad llega acá, llegó por lo que
 * hace.
 *
 * ─── Y por qué el objetivo nace AL LADO y no encima ─────────────────────────
 *
 * Al lado, no en la misma celda. Encima, un `goTo` que no funciona pasaría
 * desapercibido —ya está donde tiene que estar— y media habilidad quedaría sin
 * probar. A una celda, moverse es parte de llegar.
 *
 * No más lejos porque el tope de ticks es 40 y caminar diez celdas se los come:
 * un `se-colgo` por distancia se leería como «la habilidad no termina», que es
 * otra cosa.
 */

import { HZ_DE_REFERENCIA, T_AMBIENTE } from '@anima/physics'
import type { Body, Physics } from '@anima/physics'
import { Partida } from '@anima/perceive'
import { mapaDeActores, mapaDeCuerpos } from '@anima/world'
import type { Actor, Placement, WorldBody, WorldState } from '@anima/world'
import type { MundoDelBanco } from './banco.js'

/** El único actor de toda escena del juez. Un nombre fijo hace citables los ids. */
export const EL_ACTOR = 'acusada'

/** Dónde nace la criatura, y dónde el objetivo. Ver el encabezado. */
const DONDE_ELLA: Placement = { x: 0, y: 0 }
const DONDE_ESO: Placement = { x: 1, y: 0 }

/**
 * EL ALIENTO CON EL QUE ARRANCA, y no es el del criterio del Hito 5.
 *
 * Ahí son 310 porque el criterio mide si sobrevive veinte mil ticks. Acá se
 * miden cuarenta, y una habilidad que falla por quedarse sin aliento en cuarenta
 * ticks estaría midiendo el tanque y no la habilidad. Se le da de sobra a
 * propósito: lo que se juzga es si SABE, no si le alcanza.
 */
const ALIENTO = 5000

function criatura(stamina: number): Body {
  return {
    id: `${EL_ACTOR}-cuerpo`,
    form: 'bloque',
    parts: [{ substance: 'carne', mass: 2, q: {} }],
    joints: [],
    state: { temperature: T_AMBIENTE, stamina },
  } as unknown as Body
}

function elActor(): Actor {
  return {
    id: EL_ACTOR,
    body: `${EL_ACTOR}-cuerpo`,
    holding: [],
    capacity: 3,
    // `irreversible` y no `reversible`: varias innatas miran `self.permits`
    // antes de gastar un turno y se rinden con «todavía no tengo permiso». Una
    // habilidad que se rinde por cuarentena no dice nada sobre si sabe hacer lo
    // suyo, y el juez estaría midiendo el permiso.
    permits: 'irreversible',
  }
}

export function estadoDe(objetivo: Body | undefined, phys: Physics): WorldState {
  const cuerpos: WorldBody[] = [{ body: criatura(ALIENTO), at: DONDE_ELLA }]
  if (objetivo !== undefined) cuerpos.push({ body: objetivo, at: DONDE_ESO })
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys,
    bodies: mapaDeCuerpos(cuerpos),
    actors: mapaDeActores([elActor()]),
    cells: new Map(),
    desplegados: new Map(),
    nextId: 1,
  }
}

/**
 * La partida donde se juzga un mundo del banco.
 *
 * `vigilar: false` a propósito: el arnés de violaciones de `Partida` mide el
 * MUNDO, y acá el mundo es de mentira por construcción —dos cuerpos y nada más—.
 * Dejarlo prendido llenaría el veredicto de ruido sobre la escena en vez de
 * sobre la habilidad.
 */
export function mundoConObjetivo(m: MundoDelBanco, phys: Physics): Partida {
  return new Partida(estadoDe(m.objetivo, phys), { vigilar: false })
}
