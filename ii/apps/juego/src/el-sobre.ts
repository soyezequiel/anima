// ─── EL SOBRE EN DOS TIEMPOS, VISTO DESDE EL JUEGO ──────────────────────────
//
// Del otro lado está `POST /sobre` y `POST /sobre/:ticket` (ver
// `apps/sprites/src/servidor.ts`). Acá está el baile:
//
//     1. el juego dice QUÉ quiere        →  el depósito devuelve {ticket, prompt}
//     2. el juego lleva el prompt a SU modelo
//     3. el juego devuelve el texto      →  el depósito valida, guarda y contesta
//
// ─── POR QUÉ UN SOLO ARCHIVO PARA LOS TRES TRABAJOS ────────────────────────
//
// Porque el baile es idéntico para dibujar, leer y forjar: lo único que cambia
// es qué se pone en el pedido y qué forma tiene lo que vuelve. Los tres call
// sites ya existían y cada uno tenía su propio `fetch`; darles a cada uno su
// propia versión de estos tres pasos sería tener tres lugares donde arreglar el
// mismo error de red.
//
// ═══ EL ATAJO QUE NO SE PUEDE PERDER ═══════════════════════════════════════
//
// `POST /sobre` de un dibujo que YA está en el baúl no devuelve sobre: devuelve
// el sprite. Es «primero gana» corriendo antes de que nadie gaste una consulta,
// y es la razón por la que esta función devuelve el cuerpo crudo en vez de
// obligar siempre a los dos viajes. Sin eso, un jugador con su API enchufada
// pagaría por cada dibujo que otro ya dibujó.

import type { LlevarAlModelo } from './mi-api.js'

/** Lo que el depósito contesta al primer viaje. */
interface Sobre {
  readonly ok?: unknown
  readonly ticket?: unknown
  readonly prompt?: unknown
  readonly esperaMs?: unknown
  readonly porque?: unknown
}

export interface PedidoDeSobre {
  readonly donde: string
  /** El cuerpo de `POST /sobre`: `{tipo:'dibujar', clave}` y sus hermanos. */
  readonly pedido: Record<string, unknown>
  readonly llevar: LlevarAlModelo
  readonly signal?: AbortSignal
  /**
   * CÓMO SE PIDE, por parámetro. La razón está escrita entera en
   * `forjar-por-el-deposito.ts` y se pagó una vez: pisar `globalThis.fetch` con
   * `vi.stubGlobal` no es de un archivo, es del PROCESO, y Vitest corre varios
   * archivos en el mismo worker. Aquel stub le salpicaba a otra suite y la hacía
   * fallar una corrida sí y una no.
   */
  readonly fetch?: typeof globalThis.fetch
}

/**
 * Hace el baile entero y devuelve el cuerpo final, con la misma forma que
 * devolvía la ruta de un solo tiro.
 *
 * TIRA cuando el camino falla —depósito caído, sobre vencido, modelo que no
 * contestó— y RESUELVE cuando el depósito contestó algo, aunque ese algo sea un
 * rechazo. Es la misma distinción que `preguntarle-al-deposito.ts` tenía escrita
 * antes que esto existiera: una falla del camino y una respuesta que no sirve se
 * pintan distinto, y mezclarlas manda a revisar el cableado cuando lo que pasó
 * es que el modelo no supo.
 */
export async function porElSobre(o: PedidoDeSobre): Promise<unknown> {
  const pedir = o.fetch ?? ((u: string | URL | Request, i?: RequestInit) => globalThis.fetch(u, i))
  const primero = await pedir(`${o.donde}/sobre`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(o.pedido),
    ...(o.signal === undefined ? {} : { signal: o.signal }),
  })
  if (!primero.ok) {
    throw new Error(`el depósito no armó el sobre (${String(primero.status)})${await elPorque(primero)}`)
  }
  const sobre = (await primero.json()) as Sobre
  // El atajo: vino la respuesta hecha, no hay a quién preguntarle nada.
  if (typeof sobre.ticket !== 'string') return sobre
  if (typeof sobre.prompt !== 'string') {
    throw new Error('el depósito dio un sobre sin prompt adentro')
  }

  const salida = await o.llevar(
    sobre.prompt,
    typeof sobre.esperaMs === 'number' ? sobre.esperaMs : undefined,
  )
  if (!salida.ok) throw new Error(salida.porque ?? 'tu modelo no contestó')

  const segundo = await pedir(`${o.donde}/sobre/${encodeURIComponent(sobre.ticket)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: salida.texto }),
    ...(o.signal === undefined ? {} : { signal: o.signal }),
  })
  // El 422 es «el modelo contestó algo que no pasa la puerta», y ése SÍ es una
  // respuesta: el cuerpo trae el porqué y quien llama sabe leerlo. Los demás
  // errores son del camino.
  if (!segundo.ok && segundo.status !== 422) {
    throw new Error(`el depósito rechazó la respuesta (${String(segundo.status)})${await elPorque(segundo)}`)
  }
  return await segundo.json()
}

/** El `porque` del cuerpo, si vino, para pegarlo al mensaje de error. */
async function elPorque(r: Response): Promise<string> {
  const porque = await r
    .json()
    .then((j: { porque?: unknown }) => (typeof j.porque === 'string' ? j.porque : ''))
    .catch(() => '')
  return porque === '' ? '' : `: ${porque}`
}
