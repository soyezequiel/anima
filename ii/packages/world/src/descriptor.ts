// ─── EL DESCRIPTOR VISUAL: una vista DERIVADA, y nunca inventa geometría ────
//
// Punto 11 del Gate 5→6, y el [ADR II-0017] lo especifica entero. El problema que
// resuelve, en una frase: **con objetos emergentes, la mayoría de lo que hay en
// el mapa no va a tener sprite**. Un plano que la criatura inventó ayer no tiene
// arte, ni ícono, ni nombre canónico — y la UI del Hito 12 tiene como requisito
// que todo lo del área visible aparezca.
//
// Las dos salidas fáciles rompen cosas distintas: dibujar lo que no se sabe hace
// que la pantalla afirme geometría que la física no tiene —el jugador ve una
// jaula donde el mundo tiene un estado—, y no dibujar hasta tener arte deja el
// mapa vacío justo donde está lo que la criatura inventó, que es todo el producto.
//
// ─── DE QUÉ SE DERIVA, Y DE NADA MÁS ────────────────────────────────────────
//
//     forma · materiales · partes · juntas · progreso
//     · estado desplegado · captura almacenada
//
// ─── LO QUE QUEDA AFUERA, SIN EXCEPCIÓN ─────────────────────────────────────
//
// Textos localizados, nombres narrativos, skins, íconos generados, raster, hover,
// selección, animaciones y cosmética. **El motivo no es prolijidad**: si el
// descriptor entra al hash junto con textos, dos clientes con distinto idioma
// dejan de coincidir y el E2E no puede comparar nada. Cambiar una traducción
// rompería una comparación de determinismo.
//
// ─── LAS TRES REGLAS ────────────────────────────────────────────────────────
//
//   1. la representación es PROCEDURAL y esquemática: no hace falta arte para
//      que un objeto exista en el mapa;
//   2. el fallback es OBLIGATORIO: todo cuerpo tiene descriptor, siempre;
//   3. NO INVENTA posiciones internas, orientaciones, aberturas ni contención que
//      la física no modele. Lo que no está en el estado no se dibuja.
//
// Y la regla del mundo que esto no puede romper: **mirar, pensar o renderizar
// nunca consume RNG**. Este archivo es función pura del estado.

import type { FormId, SubstanceId } from '@anima/physics'

import { hashWorld } from './hash.js'
import type { WorldHash } from './hash.js'
import type { BodyId, Placement } from './intent.js'
import type { Desplegado, WorldState } from './step.js'

/**
 * LA VERSIÓN DEL DESCRIPTOR. Sube cuando cambia QUÉ se dibuja de un cuerpo.
 *
 * Entra en el hash a propósito: dos clientes con distinta versión del descriptor
 * dibujan cosas distintas del mismo mundo, y el E2E tiene que verlo. Es lo mismo
 * que `physicsVersion` para los sellos.
 */
export const VERSION_DEL_DESCRIPTOR = 1

/**
 * LO QUE HAY QUE SABER DE UN CUERPO PARA DIBUJARLO, y nada más.
 *
 * Las claves son fijas y hay un test que las afirma una por una. No es
 * ceremonia: el modo de falla de este tipo es que alguien le agregue `nombre` o
 * `sprite` «total es una línea», y con eso el hash deja de ser comparable entre
 * clientes sin que nada se ponga rojo.
 */
export interface RenderDescriptor {
  readonly v: number
  /** Dónde está. Sin esto no hay mapa; y es estado, no cosmética. */
  readonly at: Placement
  /** `vara`, `hebra`, `bloque`… Es del catálogo cerrado de formas. */
  readonly forma: FormId
  /**
   * DE QUÉ ESTÁ HECHO, en orden canónico y sin repetir.
   *
   * Ordenado y deduplicado porque el orden de las partes es un accidente de cómo
   * se armó: dos obras con las mismas piezas atadas en distinto orden se dibujan
   * igual. Lo que las distingue es la cuenta de partes y juntas, que va aparte.
   */
  readonly materiales: readonly SubstanceId[]
  /**
   * CUÁNTAS PIEZAS Y CUÁNTAS JUNTAS. Es el «progreso» de la lista del ADR: una
   * obra a medio armar tiene menos de las dos, y eso es todo lo que el mundo sabe
   * de su progreso — no hay proyecto de obra con un total al que compararse.
   */
  readonly partes: number
  readonly juntas: number
  /**
   * SI ESTÁ PUESTO Y FUNCIONANDO, y cuánto retuvo.
   *
   * `captura` es un NÚMERO y no la lista de ids: dos peces retenidos se dibujan
   * igual sean cuales sean sus ids, y meter los ids haría que el hash cambiara
   * por el contador de nombres del mundo. Ausente si no está desplegado, así que
   * un cuerpo suelto se hashea igual que antes de que existieran los dispositivos.
   */
  readonly desplegado?: { readonly captura: number }
}

/**
 * EL DESCRIPTOR DE UN CUERPO. Total: siempre devuelve uno.
 *
 * Ésa es la regla 2 del ADR y es lo que hace que el mapa no tenga huecos donde
 * está lo interesante. No hay rama que devuelva `undefined` ni que pida arte.
 */
export function descriptorDe(
  b: { readonly body: { readonly form: FormId; readonly parts: readonly { readonly substance: SubstanceId }[]; readonly joints: readonly unknown[] }; readonly at: Placement },
  desplegado?: Desplegado,
): RenderDescriptor {
  const materiales = [...new Set(b.body.parts.map((p) => p.substance))].sort(comparaTexto)
  const base: RenderDescriptor = {
    v: VERSION_DEL_DESCRIPTOR,
    at: b.at,
    forma: b.body.form,
    materiales,
    partes: b.body.parts.length,
    juntas: b.body.joints.length,
  }
  // La clave sólo si hay algo que decir: un `desplegado: undefined` explícito
  // viajaría al hash como una clave más. Misma razón que en `place` y en el dios.
  return desplegado === undefined ? base : { ...base, desplegado: { captura: desplegado.captura.length } }
}

/** Sin `localeCompare`: el orden no puede depender del idioma del cliente. */
function comparaTexto(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

/**
 * TODOS LOS DESCRIPTORES DE UN MUNDO, por id de cuerpo y en orden de id.
 *
 * `phys` no se usa hoy y no está en la firma por eso mismo: el descriptor sale
 * del CUERPO y del estado desplegado, no del catálogo. Si algún día hiciera falta
 * —una forma que dependa de una cualidad derivada— entra como parámetro y se ve.
 */
export function descriptoresDe(s: WorldState): ReadonlyMap<BodyId, RenderDescriptor> {
  const out = new Map<BodyId, RenderDescriptor>()
  for (const [id, c] of s.bodies) out.set(id, descriptorDe(c, s.desplegados.get(id)))
  return out
}

/**
 * EL HASH DE LO QUE SE DIBUJA. La tercera capa del E2E.
 *
 * El E2E del gate compara `worldHash`, `registryDigest` y `renderDescriptorHash`:
 * tres hashes, tres capas, y ninguno tapa al otro. Dos corridas pueden tener el
 * mismo mundo y dibujar distinto si el descriptor cambió de versión, y eso es
 * exactamente lo que este número hace visible.
 *
 * Usa `hashWorld` y no un mezclador propio, por lo mismo que `hashWorldState`: dos
 * verdades sobre «lo mismo» obligarían al juez a elegir una.
 */
export function renderDescriptorHash(s: WorldState): WorldHash {
  return hashWorld({ v: VERSION_DEL_DESCRIPTOR, cuerpos: descriptoresDe(s) })
}
