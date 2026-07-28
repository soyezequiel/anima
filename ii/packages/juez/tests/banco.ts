// ─── EL BANCO DEL JUEZ: mundos armados a mano, tick por tick ─────────────────
//
// No es un test: es lo que los tests usan para poner un mundo en una situación
// exacta sin escribir cuarenta líneas cada vez.
//
// ─── POR QUÉ ARMADOS A MANO Y NO CORRIDOS ───────────────────────────────────
//
// Porque lo que hay que probar es EL DETECTOR y no el mundo. Para saber que un
// detector mira el campo correcto hace falta ponerle delante la situación exacta
// que dice mirar, y la situación de al lado que dice NO mirar. Un mundo corrido
// no las produce a pedido: produce lo que produce, y si el detector mide cero no
// se sabe si es porque está roto o porque la partida no dio.
//
// Los cuerpos igual salen del catálogo real, con sustancias que el dios siembra y
// masas adentro de sus rangos — la REGLA 5 del documento («una medición vale lo
// que vale el banco con el que está hecha») vale también para un banco de
// detectores. Lo que se regala es el ESTADO —una vara a 600 °C— exactamente como
// hace `world/tests/el-fuego-no-se-propaga.test.ts`: «acá se le REGALA a la
// fuente el estado que se quiere probar y se pregunta qué le hace al vecino».
//
// Y para que no sea sólo eso, `los-detectores.test.ts` cierra con una partida
// CORRIDA con `stepWorld` de punta a punta, sin un solo estado escrito a mano.

import { buildSeedPhysics, HZ_DE_REFERENCIA, seg } from '@anima/physics'
import type { Body, Physics, QualityVector } from '@anima/physics'
import { mapaDeActores, mapaDeCuerpos } from '@anima/world'
import type {
  Activity,
  Actor,
  Placement,
  RoleBinding,
  SimEvent,
  WorldBody,
  WorldState,
} from '@anima/world'

import type { Muestra } from '../src/index.js'

export const PHYS: Physics = buildSeedPhysics()

export const EN = (x: number, y: number): Placement => ({ x, y })

export function cuerpo(id: string, substance: string, mass: number, state: QualityVector = {}): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state }
}

/**
 * Una criatura: un cuerpo de `carne` con `stamina` escrita.
 *
 * `carne` tiene `rigidity` 0,05 (`sustancias.ts:60`), o sea que el cuerpo de la
 * criatura NO cumple el rol `a` de `friccion` y no ensucia ningún conjunto de
 * candidatos. Sí tiene `nutrition` 9, y por eso `esPieza` lo saca a mano: si no,
 * una criatura parada al lado del fuego entraría sola en ventana de cocción.
 */
export function criatura(id: string, stamina = 1000): Body {
  return cuerpo(`${id}-cuerpo`, 'carne', 2, { stamina })
}

export function enElPiso(b: Body, at: Placement): WorldBody {
  return { body: b, at }
}

export function enLaMano(b: Body, at: Placement, quien: string): WorldBody {
  return { body: b, at, heldBy: quien }
}

/** Apoyado sobre otro cuerpo. Es la ley 8, y es la parrilla del detector 9. */
export function apoyadoEn(b: Body, at: Placement, sobre: string): WorldBody {
  return { body: b, at, supportedBy: sobre }
}

/** Tapando a otro cuerpo. Es la ley 12, y es lo que el detector 3 mira. */
export function tapando(b: Body, at: Placement, a: string): WorldBody {
  return { body: b, at, covering: a }
}

export function actor(
  id: string,
  o: { holding?: readonly string[]; capacity?: number; doing?: Activity } = {},
): Actor {
  const base = {
    id,
    body: `${id}-cuerpo`,
    holding: o.holding ?? [],
    capacity: o.capacity ?? 3,
    permits: 'irreversible',
  } as const
  // `exactOptionalPropertyTypes`: un `doing: undefined` explícito no es lo mismo
  // que la clave ausente, y el mundo distingue las dos.
  return o.doing === undefined ? base : { ...base, doing: o.doing }
}

/** La actividad en curso que el MUNDO anota. Es lo único de donde salen los roles. */
export function haciendo(process: string, roles: readonly RoleBinding[], segundos = 0.05): Activity {
  return { process, roles, segundos: seg(segundos) }
}

export interface MundoInput {
  readonly tick?: number
  readonly bodies?: readonly WorldBody[]
  readonly actors?: readonly Actor[]
}

export function mundo(i: MundoInput = {}): WorldState {
  return {
    tick: i.tick ?? 0,
    hz: HZ_DE_REFERENCIA,
    phys: PHYS,
    bodies: mapaDeCuerpos(i.bodies ?? []),
    actors: mapaDeActores(i.actors ?? []),
    cells: new Map(),
    nextId: 1,
  }
}

/** La lista de cuerpos de un tick. Con nombre propio para que los tests la puedan escribir. */
export type Cuerpos = readonly WorldBody[]

/** Un tick del banco: los cuerpos y actores que hay, y lo que el mundo narró. */
export interface Paso {
  readonly bodies?: Cuerpos
  readonly actors?: readonly Actor[]
  readonly events?: readonly SimEvent[]
}

/**
 * Una partida armada: el índice del paso ES el tick, así que las rachas del
 * detector 3 y los intervalos del 6 cuentan ticks consecutivos de verdad.
 */
export function partida(pasos: readonly Paso[]): Muestra[] {
  return pasos.map((p, tick) => ({
    state: mundo({ tick, bodies: p.bodies ?? [], actors: p.actors ?? [] }),
    events: p.events ?? [],
  }))
}

// ─── Eventos, escritos como los escribe el mundo ─────────────────────────────

export function proceso(by: string, process: string, completo = false, seq = 1): SimEvent {
  return { k: 'proceso', by, seq, process, segundos: seg(0.05), completo }
}

export function nacio(by: string, id: string, seq = 1): SimEvent {
  return { k: 'nacio', by, seq, id, por: 'rendimiento' }
}

export function puso(by: string, what: string, at: Placement, seq = 1): SimEvent {
  return { k: 'puso', by, seq, what, at }
}

export function comio(by: string, what: string, calorias: number, seq = 1): SimEvent {
  return { k: 'comio', by, seq, what, calorias }
}
