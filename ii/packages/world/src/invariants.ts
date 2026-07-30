// ─── @anima/world/invariants.ts ──────────────────────────────────────────────
//
// El arnés que hace seguro dejar que un LLM escriba comportamiento.
//
// Ésta es la pieza que el documento de arquitectura rescata de Ánima I con
// nombre y con número de línea, y la razón por la que la rescata es que un
// invariante por tick es lo único que convierte «el modelo escribe código real»
// en algo que se puede sostener. La puerta de `admit()` juzga si un proceso
// PUEDE existir; esto juzga, tick por tick, si el mundo sigue siendo un mundo.
//
// Cinco preguntas, y la última es la que sostiene el producto:
//
//   1. ¿el estado está en su forma canónica? (sin esto, dos mundos iguales
//      hashean distinto y el replay no vale nada)
//   2. ¿las posiciones existen y no se solapan los sólidos?
//   3. ¿los inventarios cierran?
//   4. ¿las cualidades guardadas están dentro del rango que declararon?
//   5. **¿alguna cuenta CONSERVADA subió, o se evaporó?**
//
// La quinta es la que mata el juego si falla en silencio. `nutrition` es
// conservada, y si el mundo puede fabricarla, la criatura tiene comida infinita
// caminando hasta el chunk de al lado — y ahí el hambre, que es el motor de toda
// la historia, deja de doler. No se puede detectar mirando la pantalla: se ve
// como una partida donde todo sale bien.
//
// Y LAS DOS MITADES SON LA MISMA PREGUNTA. Durante mucho tiempo la quinta decía
// sólo «¿subió?», así que una cuenta conservada que se iba a CERO entera pasaba
// sin una violación. Pasó de verdad: la ley 4 le borraba la `stamina` a la
// criatura al transmutarle el cuerpo —949,70 → 0,00 en un tick— y el mundo
// contaba que se había muerto de hambre una que se había quemado viva, con cero
// violaciones. Fabricar materia y evaporarla son el mismo agujero mirado desde
// los dos lados, y un guardián que sólo mira uno deja pasar el otro.

import type { Physics, QualityId } from '@anima/physics'
import {
  CONSERVED,
  clampToRange,
  isDerived,
  qualityOf,
  QUALITY_IDS,
  totalConservado,
} from '@anima/physics'
import type { ActorId, BodyId, Placement } from './intent.js'
import { compararTexto, enRango } from './intent.js'
import { keyOfCell } from './cell.js'
import type { SimEvent, WorldBody, WorldState } from './step.js'
import { CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO } from './step.js'

// ─── Las violaciones ─────────────────────────────────────────────────────────

export type Violacion =
  | { readonly k: 'orden-no-canonico'; readonly donde: 'bodies' | 'actors'; readonly id: string }
  | { readonly k: 'posicion-invalida'; readonly body: BodyId; readonly at: Placement }
  | {
      readonly k: 'solidos-solapados'
      readonly a: BodyId
      readonly b: BodyId
      readonly at: Placement
    }
  | { readonly k: 'referencia-colgada'; readonly body: BodyId; readonly campo: 'supportedBy' | 'covering' | 'heldBy'; readonly hacia: string }
  | { readonly k: 'apoyo-circular'; readonly body: BodyId }
  | { readonly k: 'inventario-inconsistente'; readonly actor: ActorId; readonly body: BodyId; readonly por: string }
  | { readonly k: 'cualidad-fuera-de-rango'; readonly body: BodyId; readonly q: QualityId; readonly v: number }
  | { readonly k: 'cualidad-derivada-guardada'; readonly body: BodyId; readonly q: QualityId }
  | {
      readonly k: 'conservada-aumento'
      readonly q: QualityId
      readonly antes: number
      readonly despues: number
      readonly acreditado: number
    }
  /**
   * Una cuenta conservada bajó más de lo que el mundo declaró haberse llevado.
   * La otra mitad de `conservada-aumento`, y la que faltaba: una cuenta que se
   * evapora entera es tan imposible como una que se fabrica, y hasta acá sólo se
   * perseguía una de las dos.
   */
  | {
      readonly k: 'conservada-evaporada'
      readonly q: QualityId
      readonly antes: number
      readonly despues: number
      readonly gastado: number
      readonly conLosQueSeFueron: number
    }
  | {
      readonly k: 'conversion-sin-respaldo'
      readonly de: QualityId
      readonly a: QualityId
      readonly gastado: number
      readonly acreditado: number
    }

/**
 * Se lanza y no se devuelve, y eso es a propósito: un invariante roto no es un
 * resultado del que se pueda seguir, es un mundo que dejó de ser un mundo. Que el
 * dios no pueda contradecirse «porque el motor no lo deja» es literalmente esto.
 */
export class InvariantError extends Error {
  readonly violaciones: readonly Violacion[]
  constructor(tick: number, violaciones: readonly Violacion[]) {
    super(`invariante roto en el tick ${tick}: ${violaciones.map(describir).join(' · ')}`)
    this.name = 'InvariantError'
    this.violaciones = violaciones
  }
}

export function describir(v: Violacion): string {
  switch (v.k) {
    case 'orden-no-canonico':
      return `${v.donde} fuera de orden en ${v.id}`
    case 'posicion-invalida':
      return `${v.body} en (${v.at.x},${v.at.y})`
    case 'solidos-solapados':
      return `${v.a} y ${v.b} en (${v.at.x},${v.at.y})`
    case 'referencia-colgada':
      return `${v.body}.${v.campo} -> ${v.hacia}`
    case 'apoyo-circular':
      return `${v.body} se apoya en sí mismo`
    case 'inventario-inconsistente':
      return `${v.actor}/${v.body}: ${v.por}`
    case 'cualidad-fuera-de-rango':
      return `${v.body}.${v.q} = ${v.v}`
    case 'cualidad-derivada-guardada':
      return `${v.body} guarda la derivada ${v.q}`
    case 'conservada-aumento':
      return `${v.q}: ${v.antes} -> ${v.despues} (acreditado ${v.acreditado})`
    case 'conservada-evaporada':
      return `${v.q} se evaporó: ${v.antes} -> ${v.despues} (el mundo gastó ${v.gastado} y se fueron ${v.conLosQueSeFueron} con cuerpos)`
    case 'conversion-sin-respaldo':
      return `${v.de} -> ${v.a}: gastó ${v.gastado} y acreditó ${v.acreditado}`
  }
}

// ─── La tolerancia, con su cuenta ────────────────────────────────────────────

/**
 * Cuánto se le perdona a una suma de 5000 términos en doubles.
 *
 * No es «un epsilon por las dudas». Cada cuerpo tiene garantizado por
 * `conservar()` de `@anima/physics` que su total no subió; sumar N términos que
 * no subieron da, en aritmética exacta, una suma que no subió. En IEEE-754 no:
 * el redondeo de la suma puede caer unos ulps para arriba. Con N = 5000 términos
 * y 2⁻⁵³ ≈ 1.1e-16 de épsilon relativo, el peor caso acumulado es del orden de
 * 5.5e-13 relativo; 1e-12 es un poco más del doble de eso, y sigue siendo diez
 * órdenes de magnitud menos que cualquier bomba de materia que importe.
 *
 * El término absoluto está para los totales cerca de cero, donde el relativo no
 * perdona nada y una resta de dos números casi iguales no tiene dígitos.
 */
export const TOLERANCIA_RELATIVA = 1e-12
export const TOLERANCIA_ABSOLUTA = 1e-9

function techo(antes: number, acreditado: number): number {
  const base = antes + acreditado
  const magnitud = base < 0 ? -base : base
  return base + magnitud * TOLERANCIA_RELATIVA + TOLERANCIA_ABSOLUTA
}

// ─── Los totales conservados ─────────────────────────────────────────────────

/**
 * Lo que hay en el mundo de cada cuenta conservada.
 *
 * Se suma en el orden canónico de ids, y no es un detalle: la suma en punto
 * flotante NO es asociativa, así que dos recorridos distintos del mismo conjunto
 * de cuerpos dan totales que difieren en el último bit. Si el orden dependiera
 * del orden de creación, dos mundos gemelos que llegaron al mismo estado por
 * caminos distintos verían totales distintos y el invariante saltaría en uno y no
 * en el otro. El `Map` de `WorldState` viene ordenado por id justamente para esto.
 */
export function totales(s: WorldState): ReadonlyMap<QualityId, number> {
  const out = new Map<QualityId, number>()
  for (const q of CONSERVED) {
    let total = 0
    for (const c of s.bodies.values()) total += totalConservado(c.body, q, s.phys)
    out.set(q, total)
  }
  return out
}

/** Lo que los eventos del tick declaran haber convertido hacia cada cuenta. */
function acreditado(events: readonly SimEvent[]): ReadonlyMap<QualityId, number> {
  const out = new Map<QualityId, number>()
  for (const e of events) {
    if (e.k !== 'convierte') continue
    out.set(e.a, (out.get(e.a) ?? 0) + e.acreditado)
  }
  return out
}

/**
 * Lo que los eventos del tick declaran que **el dios puso** de cada cuenta.
 *
 * Es el segundo permiso para que un total conservado suba, y es distinto del
 * primero: `convierte` mueve una cuenta a otra dentro del mundo y por eso pide
 * `acreditado ≤ gastado`; `decreta` trae materia de afuera, porque el mundo es
 * perezoso y el chunk que nadie visitó todavía no existe. No hay nada contra lo
 * que compararlo —el decreto no es un cuerpo que se gastó—, así que lo único que
 * el invariante puede exigir es que el mundo lo DIGA, y que lo dicho sea lo mismo
 * que entró.
 *
 * Sin esto, `revisarConservacion` acusaba `conservada-aumento` en cada chunk que
 * se abría (96 violaciones en 400 ticks de caminata) y en cada pozo que se
 * reponía (21 más), y la consecuencia práctica era que la sexta pregunta estaba
 * APAGADA en toda partida con dios — que son todas las que importan.
 */
function decretado(events: readonly SimEvent[]): ReadonlyMap<QualityId, number> {
  const out = new Map<QualityId, number>()
  for (const e of events) {
    if (e.k !== 'decreta') continue
    out.set(e.q, (out.get(e.q) ?? 0) + e.cuanto)
  }
  return out
}

/** Lo que los eventos del tick declaran que el mundo se llevó de cada cuenta. */
function gastado(events: readonly SimEvent[]): ReadonlyMap<QualityId, number> {
  const out = new Map<QualityId, number>()
  for (const e of events) {
    if (e.k !== 'gasto') continue
    out.set(e.q, (out.get(e.q) ?? 0) + e.cuanto)
  }
  return out
}

/**
 * Lo que se fue del mundo montado en cuerpos que dejaron de existir.
 *
 * Comer BORRA el cuerpo comido, y con él todo lo conservado que llevaba encima.
 * Sin este término, el piso de la bajada acusaría de evaporación a un mundo donde
 * alguien se comió algo, que es la operación más corriente que hay.
 *
 * Se recorre `antes` y no `despues` a propósito: lo que se busca es lo que estaba
 * y ya no está, y eso sólo lo sabe el estado viejo.
 */
function loQueSeFueConLosCuerpos(
  antes: WorldState,
  despues: WorldState,
  q: QualityId,
): number {
  let total = 0
  for (const [id, c] of antes.bodies) {
    if (despues.bodies.has(id)) continue
    total += totalConservado(c.body, q, antes.phys)
  }
  return total
}

// ─── Las cinco preguntas ─────────────────────────────────────────────────────

function revisarOrden(s: WorldState, out: Violacion[]): void {
  let previo: string | undefined
  for (const id of s.bodies.keys()) {
    if (previo !== undefined && compararTexto(previo, id) >= 0) {
      out.push({ k: 'orden-no-canonico', donde: 'bodies', id })
    }
    previo = id
  }
  previo = undefined
  for (const id of s.actors.keys()) {
    if (previo !== undefined && compararTexto(previo, id) >= 0) {
      out.push({ k: 'orden-no-canonico', donde: 'actors', id })
    }
    previo = id
  }
}

/**
 * Posiciones enteras y adentro del mundo, y UNA sola pila de sólidos por celda.
 *
 * La excepción —uno apoyado o tapando al otro— es la mitad de la ley 8 que el
 * mundo sostiene: apilar es una relación declarada, no un accidente de
 * coordenadas. Sin la excepción, la parrilla sobre el fuego sería una violación;
 * sin la regla, el mundo entero cabría en una celda.
 *
 * ─── Por qué la pila y no los pares ────────────────────────────────────────
 *
 * La primera versión pedía que CADA PAR de sólidos de la celda estuviera
 * relacionado, y eso es más estricto de lo que el mundo puede cumplir: una pila
 * de tres —la fogata, la parrilla apoyada en ella y el pescado apoyado en la
 * parrilla— tiene tres pares y solo dos relaciones, así que el par
 * fogata-pescado salía como solapamiento. Lo mismo con dos criaturas paradas
 * sobre la misma piedra, que es lo que encontró el arnés en el tick 76 de una
 * partida de diez actores: las dos declaran apoyo sobre la piedra y ninguna
 * sobre la otra.
 *
 * La regla correcta es la de la pila: los sólidos de una celda tienen que
 * colgar todos de UNA sola base. Se cuentan las RAÍCES —los que no se apoyan ni
 * tapan a nadie de esa misma celda— y si hay más de una, hay dos cosas en el
 * mismo lugar sin nada que las una. Sigue siendo cierto que el mundo entero no
 * cabe en una celda: N cuerpos sueltos son N raíces.
 *
 * Cero raíces con cuerpos adentro es un ciclo, y de eso se ocupa
 * `revisarReferencias`, que además lo recorre con cota. Cada invariante dice una
 * cosa sola: dos que digan la misma se contradicen el día que una cambie.
 */
function revisarEspacio(s: WorldState, out: Violacion[]): void {
  const porCelda = new Map<number, WorldBody[]>()
  for (const c of s.bodies.values()) {
    if (!enRango(c.at)) {
      out.push({ k: 'posicion-invalida', body: c.body.id, at: c.at })
      continue
    }
    if (c.heldBy !== undefined) continue
    if (qualityOf(c.body, 'solid', s.phys) <= 0) continue
    const k = keyOfCell(c.at)
    const l = porCelda.get(k)
    if (l === undefined) porCelda.set(k, [c])
    else l.push(c)
  }
  // `porCelda` se recorre en el orden en que se llenó, que es el de `s.bodies`, o
  // sea el canónico de ids: la lista de violaciones no depende de nada más.
  for (const [, l] of porCelda) {
    if (l.length < 2) continue
    const enLaCelda = new Set<BodyId>()
    for (const c of l) enLaCelda.add(c.body.id)
    const raices: WorldBody[] = []
    for (const c of l) {
      const apoyaAcá = c.supportedBy !== undefined && enLaCelda.has(c.supportedBy)
      const tapaAcá = c.covering !== undefined && enLaCelda.has(c.covering)
      if (!apoyaAcá && !tapaAcá) raices.push(c)
    }
    for (let i = 1; i < raices.length; i++) {
      const a = raices[i - 1] as WorldBody
      const b = raices[i] as WorldBody
      out.push({ k: 'solidos-solapados', a: a.body.id, b: b.body.id, at: b.at })
    }
  }
}

/** Ninguna relación apunta a la nada, y nada se apoya en sí mismo dando la vuelta. */
function revisarReferencias(s: WorldState, out: Violacion[]): void {
  for (const c of s.bodies.values()) {
    if (c.supportedBy !== undefined && !s.bodies.has(c.supportedBy)) {
      out.push({ k: 'referencia-colgada', body: c.body.id, campo: 'supportedBy', hacia: c.supportedBy })
    }
    if (c.covering !== undefined && !s.bodies.has(c.covering)) {
      out.push({ k: 'referencia-colgada', body: c.body.id, campo: 'covering', hacia: c.covering })
    }
    if (c.heldBy !== undefined && !s.actors.has(c.heldBy)) {
      out.push({ k: 'referencia-colgada', body: c.body.id, campo: 'heldBy', hacia: c.heldBy })
    }
    // Cadena de apoyo acotada: si en tantos saltos como cuerpos hay todavía no
    // llegó al piso, hay un ciclo. Sin esta cota, cualquier recorrido de la
    // cadena —el montaje de la ley 1, por ejemplo— es un tick que no termina.
    let paso = c.supportedBy
    for (let n = 0; paso !== undefined && n <= s.bodies.size; n++) {
      if (paso === c.body.id) {
        out.push({ k: 'apoyo-circular', body: c.body.id })
        break
      }
      paso = s.bodies.get(paso)?.supportedBy
    }
  }
}

/**
 * El inventario cierra por los dos lados: lo que el actor dice tener, y lo que
 * los cuerpos dicen de quién los tiene.
 *
 * Que se verifique en las dos direcciones y no en una es lo que atrapa el bug
 * caro: un cuerpo con `heldBy` puesto y fuera de toda mano queda invisible —no
 * está en el piso ni en el inventario— y aparece como materia que se evaporó.
 */
function revisarInventarios(s: WorldState, out: Violacion[]): void {
  const enManoDe = new Map<BodyId, ActorId>()
  for (const a of s.actors.values()) {
    if (a.holding.length > a.capacity) {
      out.push({
        k: 'inventario-inconsistente',
        actor: a.id,
        body: '',
        por: `lleva ${a.holding.length} y le entran ${a.capacity}`,
      })
    }
    const vistos = new Set<BodyId>()
    for (const id of a.holding) {
      if (vistos.has(id)) {
        out.push({ k: 'inventario-inconsistente', actor: a.id, body: id, por: 'repetido en la mano' })
      }
      vistos.add(id)
      const c = s.bodies.get(id)
      if (c === undefined) {
        out.push({ k: 'inventario-inconsistente', actor: a.id, body: id, por: 'no existe' })
        continue
      }
      if (c.heldBy !== a.id) {
        out.push({ k: 'inventario-inconsistente', actor: a.id, body: id, por: 'el cuerpo no lo sabe' })
      }
      const previo = enManoDe.get(id)
      if (previo !== undefined) {
        out.push({ k: 'inventario-inconsistente', actor: a.id, body: id, por: `también lo tiene ${previo}` })
      }
      enManoDe.set(id, a.id)
      if (id === a.body) {
        out.push({ k: 'inventario-inconsistente', actor: a.id, body: id, por: 'se lleva a sí misma' })
      }
    }
    if (!s.bodies.has(a.body)) {
      out.push({ k: 'inventario-inconsistente', actor: a.id, body: a.body, por: 'sin cuerpo' })
    }
  }
  for (const c of s.bodies.values()) {
    if (c.heldBy === undefined) continue
    if (enManoDe.get(c.body.id) !== c.heldBy) {
      out.push({
        k: 'inventario-inconsistente',
        actor: c.heldBy,
        body: c.body.id,
        por: 'dice estar en una mano que no lo tiene',
      })
    }
  }
}

/**
 * Toda cualidad GUARDADA, dentro de su rango declarado y finita, y ninguna
 * cualidad DERIVADA guardada.
 *
 * Lo segundo parece un detalle de higiene y no lo es: `qualityOf` contesta la
 * derivada calculándola y no mira `state`, así que un `state.heatCapacity`
 * escrito no cambia nada y queda ahí, viejo, mintiéndole a cualquiera que lea el
 * dato crudo —un snapshot, un hash, el juez—. Es la misma clase de bug que
 * `isDerived` cerró adentro de la física, mirado desde el mundo.
 */
function revisarCualidades(s: WorldState, out: Violacion[]): void {
  for (const c of s.bodies.values()) {
    revisarVector(c.body.id, c.body.state, out)
    for (const p of c.body.parts) revisarVector(c.body.id, p.q, out)
  }
}

const CATALOGO: ReadonlySet<string> = new Set<string>(QUALITY_IDS)

function revisarVector(
  id: BodyId,
  v: Partial<Record<QualityId, number>>,
  out: Violacion[],
): void {
  for (const clave of Object.keys(v)) {
    if (!CATALOGO.has(clave)) continue
    const q = clave as QualityId
    const valor = v[q]
    if (valor === undefined) continue
    if (isDerived(q)) {
      out.push({ k: 'cualidad-derivada-guardada', body: id, q })
      continue
    }
    if (!Number.isFinite(valor) || clampToRange(q, valor) !== valor) {
      out.push({ k: 'cualidad-fuera-de-rango', body: id, q, v: valor })
    }
  }
}

/**
 * Ninguna cuenta conservada sube, salvo lo que una conversión declarada acreditó,
 * **y ninguna baja más de lo que el mundo declaró haberse llevado**.
 *
 * La excepción no es un agujero: es la reparación que la segunda vuelta de
 * adversarios contra `admit()` encontró y que sin ella **comer no se puede
 * escribir**. `nutrition` y `stamina` son las dos conservadas, comer convierte la
 * primera en la segunda, y una regla que solo supiera sumar la misma cuenta
 * dejaría a la criatura pescando y sin poder comer. Lo que la regla exige es que
 * la conversión esté DECLARADA en un evento y que no acredite más de lo que gastó
 * — o sea, eficiencia ≤ 1. Con `calories = nutrition · mass · digestibility` y
 * `digestibility ≤ 0.95`, comer paga su ineficiencia sin que nadie la escriba.
 */
function revisarConservacion(
  antes: WorldState,
  despues: WorldState,
  events: readonly SimEvent[],
  out: Violacion[],
): void {
  for (const e of events) {
    if (e.k !== 'convierte') continue
    if (e.acreditado > e.gastado || e.gastado < 0 || e.acreditado < 0) {
      out.push({
        k: 'conversion-sin-respaldo',
        de: e.de,
        a: e.a,
        gastado: e.gastado,
        acreditado: e.acreditado,
      })
    }
  }
  const tA = totales(antes)
  const tD = totales(despues)
  const cred = acreditado(events)
  const dec = decretado(events)
  for (const q of CONSERVED) {
    const a = tA.get(q) ?? 0
    const dsp = tD.get(q) ?? 0
    // Los dos permisos, sumados: lo que una conversión declaró y lo que el dios
    // declaró haber puesto. `acreditado` se sigue reportando solo en la violación
    // porque es el que tiene una contraparte que revisar (`conversion-sin-respaldo`);
    // lo decretado no la tiene, y mezclarlos en el mensaje escondería cuál de los
    // dos permisos se estaba usando.
    const c = (cred.get(q) ?? 0) + (dec.get(q) ?? 0)
    if (dsp > techo(a, c)) {
      out.push({ k: 'conservada-aumento', q, antes: a, despues: dsp, acreditado: c })
    }
  }

  // ─── Y LA OTRA MITAD: las bajadas que nadie explica ───────────────────────
  //
  // Sólo para las cuentas de `CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO`, que es una
  // restricción con motivo y no un recorte: para las otras tres el motor las baja
  // legítimamente en cuatro leyes distintas y ninguna declara cuánto, así que un
  // piso para ellas sería un piso que no significa nada. Está dicho ahí y medido
  // en `tests/la-conservada-que-se-evapora.test.ts`, con su `it.fails` abierto.
  const gas = gastado(events)
  for (const q of CONSERVADAS_QUE_SOLO_MUEVE_EL_MUNDO) {
    const a = tA.get(q) ?? 0
    const dsp = tD.get(q) ?? 0
    const g = gas.get(q) ?? 0
    const idos = loQueSeFueConLosCuerpos(antes, despues, q)
    // El piso NO suma lo acreditado, y no es un olvido: comer SUBE la stamina, y
    // `conCualidad` la topa contra el techo de su rango. Un piso que contara el
    // crédito acusaría de evaporación a la criatura que comió estando casi llena,
    // que no perdió nada — no le entró. Sin el crédito el piso es más bajo y
    // sigue siendo correcto: lo que se busca es lo que DESAPARECIÓ.
    const piso = a - g - idos
    if (dsp < piso - Math.abs(piso) * TOLERANCIA_RELATIVA - TOLERANCIA_ABSOLUTA) {
      out.push({
        k: 'conservada-evaporada',
        q,
        antes: a,
        despues: dsp,
        gastado: g,
        conLosQueSeFueron: idos,
      })
    }
  }
}

// ─── La revisión completa ────────────────────────────────────────────────────

/**
 * Todas las preguntas, sobre el estado que salió del tick.
 *
 * Devuelve la lista COMPLETA y no la primera violación: cuando algo se rompe,
 * saber que se rompieron tres cosas a la vez es la mitad del diagnóstico, y
 * arreglarlas de a una obliga a correr la partida tres veces.
 */
export function revisarInvariantes(
  antes: WorldState,
  despues: WorldState,
  events: readonly SimEvent[] = [],
): readonly Violacion[] {
  const out: Violacion[] = []
  revisarOrden(despues, out)
  revisarEspacio(despues, out)
  revisarReferencias(despues, out)
  revisarInventarios(despues, out)
  revisarCualidades(despues, out)
  revisarConservacion(antes, despues, events, out)
  return out
}

/**
 * Lo mismo, pero lanza. Es la forma que se usa adentro del bucle del mundo: un
 * invariante roto no admite «seguir con lo que se pueda».
 */
export function exigirInvariantes(
  antes: WorldState,
  despues: WorldState,
  events: readonly SimEvent[] = [],
): void {
  const v = revisarInvariantes(antes, despues, events)
  if (v.length > 0) throw new InvariantError(despues.tick, v)
}

/**
 * Las preguntas que un estado puede contestar SOLO —sin comparar con el anterior—.
 * Sirve para validar un mundo recién cargado de un snapshot, que es el momento en
 * el que un estado corrupto entra sin que nadie lo haya producido.
 */
export function revisarEstado(s: WorldState, _phys?: Physics): readonly Violacion[] {
  const out: Violacion[] = []
  revisarOrden(s, out)
  revisarEspacio(s, out)
  revisarReferencias(s, out)
  revisarInventarios(s, out)
  revisarCualidades(s, out)
  return out
}
