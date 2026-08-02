// ─── QUÉ SE GUARDA DE UNA PARTIDA, Y QUÉ NO ─────────────────────────────────
//
// El verificable del Hito 10 dice *«cerrar y reabrir la pestaña a mitad de una
// obra no pierde el mundo y la habilidad converge»*. Las dos mitades de esa
// frase son cosas distintas y la segunda es la que decide el diseño.
//
// ─── LA ACTIVIDAD EN VUELO NO SE GUARDA. Es el ADR 0009, y el plan lo repite ─
//
// > **No se serializan generadores ni fronteras.** Al cargar, **se replanifica
// > de forma idempotente**.
//
// Un generador de JavaScript no se puede serializar —no hay forma de guardar en
// qué `yield` quedó— y fingir que sí, guardando un número de paso, produce
// exactamente el bug que `SkillRun.step` ya previene con una excepción: una
// habilidad que cree que llegó a un lugar donde nunca estuvo.
//
// Así que «la habilidad converge» NO quiere decir «la habilidad sigue donde
// estaba». Quiere decir: **la criatura restaurada vuelve a planificar sobre el
// mundo que quedó y llega al mismo resultado**. Es una promesa más fuerte y más
// barata: no hay estado a mitad de camino que pueda quedar inconsistente.
//
// ─── LO QUE SÍ SE GUARDA SON TRES COSAS, Y LA TERCERA ES LA QUE FALTABA ─────
//
//   el mundo        `worldSlots` / `restoreWorld`, del Hito 2. Ya existía.
//   el catálogo     el overlay de la sesión. Ya tiene su manifiesto (Gate 5→6).
//   LAS CREENCIAS   lo que la criatura aprendió — y esto NO existía.
//
// La tercera está escrita como hueco desde el Hito 5, en `mind/src/tipos.ts`:
//
//   > un replay desde el journal reconstruye el mundo y **NO las creencias**. La
//   > criatura revivida se acuerda de dónde estaban las cosas y no de si le
//   > rindieron.
//
// Ese hueco es justamente lo que el punto 6 del criterio mide en ticks: sin las
// creencias, una segunda vida tarda lo mismo que la primera, y la herencia no
// compró nada.

import { Creencias } from '@anima/mind'
import type { CreenciaVolcada } from '@anima/mind'
import { restoreWorld, worldSlots } from '@anima/world'
import type { WorldState } from '@anima/world'

import { loQueNoAguanta } from './deposito.js'
import type { Deposito } from './deposito.js'

/**
 * LA VERSIÓN DEL FORMATO DE GUARDADO.
 *
 * Sube cuando cambia la FORMA de lo que se escribe, no cuando cambia el mundo.
 * Un save de otra versión se rechaza con su número al lado en vez de explotar
 * tres capas más abajo con «no se puede leer la propiedad de undefined», que es
 * el error que hace que nadie sepa que el problema era el formato.
 */
export const VERSION_DEL_GUARDADO = 1

/**
 * UNA PARTIDA GUARDADA, en datos planos.
 *
 * `mundo` son las ranuras de `worldSlots` como pares, y no un `Map`: un `Map` se
 * convierte en `{}` al pasar por JSON, en silencio y sin lanzar. Es el mismo
 * motivo por el que `SlotPair` existe del lado del mundo.
 */
export interface Guardado {
  readonly version: number
  /** El tick en que se guardó. Sale del mundo, no de ningún reloj de sistema. */
  readonly tick: number
  readonly mundo: readonly (readonly [string, unknown])[]
  /** Lo que la criatura aprendió, sin el instinto adentro. Ver `Creencias.volcar`. */
  readonly creencias: readonly CreenciaVolcada[]
  /**
   * QUIÉN ES. Va guardado porque restaurar sin saber a quién restaurar no sirve,
   * y porque la herencia del punto 5 empieza por acá.
   */
  readonly quien: string
}

/**
 * LA PARTIDA COMO DATO. No toca el depósito: quien puede esperar la manda.
 *
 * Es la misma frontera de siempre. Esta función es sincrónica y pura, así que se
 * puede probar sin depósito, y lo que la prueba es lo que importa: que lo que
 * sale AGUANTA el viaje.
 */
export function comoSeGuarda(state: WorldState, creencias: Creencias, quien: string): Guardado {
  const g: Guardado = {
    version: VERSION_DEL_GUARDADO,
    tick: state.tick,
    mundo: [...worldSlots(state).entries()],
    creencias: [...creencias.volcar()],
    quien,
  }
  // ─── LA PUERTA, Y NO ES UN ASSERT DE LUJO ────────────────────────────────
  //
  // El modo de falla de guardar mal es CALLADO: `JSON.stringify` de un `Map`
  // devuelve `{}` sin lanzar. Sin esta puerta, guardar un mundo con una
  // estructura que no aguanta «funciona», y lo que se descubre tres semanas
  // después es que la partida restaurada no tiene cuerpos. Cuesta un recorrido
  // por guardado, y guardar no pasa por el tick.
  const mal = loQueNoAguanta(g)
  if (mal !== '') {
    throw new TypeError(
      `esto no sobrevive a un guardado: ${mal}. Lo que no aguanta el viaje por JSON no sirve para IndexedDB`,
    )
  }
  return g
}

/** El mundo y las creencias, de vuelta. La habilidad en vuelo NO vuelve: ver el encabezado. */
export function comoSeRestaura(g: Guardado): { readonly state: WorldState; readonly creencias: Creencias } {
  if (g.version !== VERSION_DEL_GUARDADO) {
    throw new RangeError(
      `este guardado es de la versión ${String(g.version)} y esta build lee la ${String(VERSION_DEL_GUARDADO)}`,
    )
  }
  const creencias = new Creencias()
  // `cargar` SUMA sobre el instinto que el constructor ya puso, y no reemplaza.
  // El porqué está en `Creencias.volcar`: el prior de fábrica es de la heredera.
  creencias.cargar(g.creencias)
  return { state: restoreWorld(new Map(g.mundo)), creencias }
}

/** La clave de un guardado en el depósito. Una función y no un template suelto: se usa de los dos lados. */
export function claveDe(quien: string, ranura = 'ultimo'): string {
  return `partida/${quien}/${ranura}`
}

/** Guardar de verdad. Acá SÍ hay un `await`, y por eso este paquete existe. */
export async function guardar(
  d: Deposito,
  state: WorldState,
  creencias: Creencias,
  quien: string,
  ranura?: string,
): Promise<Guardado> {
  const g = comoSeGuarda(state, creencias, quien)
  await d.poner(claveDe(quien, ranura), g)
  return g
}

/** Traer lo guardado. `undefined` cuando no hay nada: no estar es una respuesta. */
export async function cargar(
  d: Deposito,
  quien: string,
  ranura?: string,
): Promise<{ readonly state: WorldState; readonly creencias: Creencias } | undefined> {
  const raw = await d.leer(claveDe(quien, ranura))
  if (raw === undefined) return undefined
  return comoSeRestaura(raw as Guardado)
}
