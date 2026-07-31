// ─── LA ESCENA: el view model del Hito 12A, derivado y sin una sola opinión ──
//
// El Hito 12A pide «datos de mapa · criatura · cuerpos · objetos · relaciones ·
// obras · dispositivos · **deltas deterministas** · descriptor visual canónico ·
// `renderDescriptorHash` · fallback procedural».
//
// La mitad de esa lista existe desde el tramo D·quater: `descriptor.ts` contesta
// qué se dibuja de un CUERPO. Lo que falta —y es lo que hay acá— es lo que rodea
// a los cuerpos: **el mapa, las relaciones, quién es la criatura, y qué cambió
// entre dos ticks**.
//
// ─── POR QUÉ ESTO SE ADELANTA A LA UI, QUE VA DESPUÉS DEL HITO 11 ──────────
//
// Por lo mismo por lo que el gate exige el descriptor visual sin que la UI
// exista: **es dato derivado del estado, así que se puede afirmar sin dibujar un
// píxel**. Un view model que sólo se pueda probar mirando la pantalla no se
// prueba nunca, y para cuando la pantalla exista ya va a tener adentro tres
// decisiones que nadie midió.
//
// ─── LAS TRES REGLAS, HEREDADAS DEL ADR II-0017 ────────────────────────────
//
//   1. es una FUNCIÓN PURA del estado. Mirar, pensar o renderizar nunca consume
//      RNG — la regla del Hito 2 que este archivo no puede romper;
//   2. NO INVENTA nada que la física no modele. Sin orientaciones, sin aberturas,
//      sin contención, sin tamaño de dibujo;
//   3. NADA COSMÉTICO entra: ni textos, ni nombres narrativos, ni colores. Si
//      entraran, dos clientes con distinto idioma dejarían de coincidir y el E2E
//      no podría comparar nada.
//
// ─── Y UNA CUARTA QUE ES DE ESTE ARCHIVO: TODO VA ORDENADO ────────────────
//
// Las celdas por fila y columna, los cuerpos por id, los actores por id. Un
// `Map` recorrido en orden de inserción produciría dos escenas distintas del
// mismo mundo según cómo se armó, y el `escenaHash` dejaría de significar algo.

import { hashWorld } from './hash.js'
import type { WorldHash } from './hash.js'
import { descriptorDe } from './descriptor.js'
import type { RenderDescriptor } from './descriptor.js'
import { celdaDecretada } from './dios.js'
import { keyOfCell } from './cell.js'
import { CELDA_POR_OMISION, shelteredDe } from './step.js'
import type { ActorId, BodyId, Placement } from './intent.js'
import type { CellState, WorldState } from './step.js'

/**
 * LA VERSIÓN DE LA ESCENA. Sube cuando cambia QUÉ se publica de un mundo.
 *
 * Entra en el hash por lo mismo que la del descriptor: dos clientes con distinta
 * versión ven cosas distintas del mismo mundo, y el E2E tiene que verlo.
 */
export const VERSION_DE_LA_ESCENA = 1

/**
 * UNA CELDA DEL MAPA. Las tres que se guardan más `sheltered`, que es derivada.
 *
 * `sheltered` va aunque sea derivada —y no es una excepción a la regla 2— porque
 * la física SÍ la modela: sale de la oclusión de lo que haya puesto encima
 * (ADR II-0002), y es lo que distingue estar bajo techo de estar al aire. Sin
 * ella, un mapa no puede mostrar por qué la criatura se guareció ahí.
 */
export interface CeldaEnEscena {
  readonly at: Placement
  readonly wet: number
  readonly oxygen: number
  readonly temperature: number
  readonly sheltered: number
}

/**
 * UN CUERPO EN LA ESCENA: su descriptor más sus tres relaciones espaciales.
 *
 * Las relaciones viven acá y no adentro del `RenderDescriptor` a propósito: el
 * descriptor habla de UN cuerpo y se puede calcular sin el mundo (por eso
 * `descriptorDe` toma un cuerpo suelto), y una relación es entre DOS. Meterlas
 * adentro obligaría a que dibujar una vara suelta necesite el mapa entero.
 *
 * Son las tres que el mundo guarda y ni una más. `inside` no está, y su ausencia
 * es la mitad del ADR II-0002: el mundo evalúa `inside` como «tiene algo encima o
 * lo sostiene alguien», y publicarlo haría que la pantalla afirme una CONTENCIÓN
 * que la física no tiene. El jugador vería una jaula donde hay un estado.
 */
export interface CuerpoEnEscena {
  readonly d: RenderDescriptor
  readonly heldBy?: ActorId
  readonly supportedBy?: BodyId
  readonly covering?: BodyId
}

/**
 * QUIÉN ES LA CRIATURA, en lo que se puede mostrar.
 *
 * `permits` NO está: es la cuarentena de una habilidad candidata, o sea de la
 * fragua, no del mundo visible. `doing` y `esperando` tampoco, y eso sí es una
 * decisión con precio: la barra de progreso de «observar progreso y acciones»
 * (punto 6 de la vertical del Hito 12B) va a necesitarlos. Se dejan afuera hasta
 * que exista quien los dibuje, porque publicarlos ahora fijaría su forma sin una
 * sola medición de qué hace falta mostrar.
 */
export interface ActorEnEscena {
  readonly id: ActorId
  readonly body: BodyId
  readonly holding: readonly BodyId[]
  readonly capacity: number
}

/** LO QUE HAY QUE SABER PARA DIBUJAR UN MUNDO, y nada más. */
export interface Escena {
  readonly v: number
  readonly tick: number
  /** El centro del área visible, y a cuántas celdas llega. */
  readonly foco: Placement
  readonly radio: number
  /** Ordenadas por fila y después por columna. */
  readonly celdas: readonly CeldaEnEscena[]
  /** Por id, y el `Map` se recorre en orden de id. */
  readonly cuerpos: ReadonlyMap<BodyId, CuerpoEnEscena>
  /** Ordenados por id. */
  readonly actores: readonly ActorEnEscena[]
}

// ─── Armar una escena ───────────────────────────────────────────────────────

/**
 * LA CELDA QUE RIGE EN `at`, en las mismas tres capas que usan las doce leyes:
 * lo que el mundo escribió, lo que el dios decretó, y el aire libre.
 *
 * ─── POR QUÉ ESTO NO REUSA `celdaDe` DE `step.ts`, Y HAY QUE DECIRLO ───────
 *
 * Porque `celdaDe` devuelve la `Celda` de la FÍSICA —`oxygen`, `wet`,
 * `ambiente`, con la oclusión ya mezclada adentro— y una escena necesita las tres
 * guardadas SIN mezclar más `sheltered` aparte, para que el mapa pueda mostrar
 * las dos cosas. Y porque su camino caliente lee `entornoDecretado`, otro arreglo
 * memoizado, con cero asignaciones por cuerpo y por tick: meterle una rama para
 * el renderizador sería pagar en el tick por algo que se mira una vez por cuadro.
 *
 * O sea que son dos lectores de las mismas tres fuentes, y eso es una deuda
 * chica pero real. Se paga con un test que los compara celda por celda
 * (`tests/la-escena.test.ts`, bloque de las capas): si algún día divergen, se
 * pone rojo ahí y no en la pantalla.
 */
function celdaGuardadaEn(s: WorldState, at: Placement): CellState {
  const propia = s.cells.get(keyOfCell(at))
  if (propia !== undefined) return propia
  if (s.dios !== undefined) return celdaDecretada(s.dios, s.phys, at.x, at.y)
  return CELDA_POR_OMISION
}

/**
 * LA ESCENA DE UN MUNDO, centrada en `foco` y con `radio` celdas alrededor.
 *
 * El área es un cuadrado y no un círculo porque la distancia del mundo es
 * Chebyshev —tocar algo es estar a 1 en el máximo de las dos coordenadas— y una
 * vista circular mostraría celdas que no se pueden alcanzar y escondería celdas
 * que sí. La forma de lo que se ve tiene que ser la forma de lo que se puede
 * hacer.
 *
 * Un cuerpo entra si su celda entra. Un cuerpo EN LA MANO de alguien está en la
 * celda de ese alguien, así que entra o sale con él, que es lo correcto.
 */
export function escenaDe(s: WorldState, foco: Placement, radio: number): Escena {
  const celdas: CeldaEnEscena[] = []
  for (let y = foco.y - radio; y <= foco.y + radio; y++) {
    for (let x = foco.x - radio; x <= foco.x + radio; x++) {
      const at = { x, y }
      const c = celdaGuardadaEn(s, at)
      celdas.push({
        at,
        wet: c.wet,
        oxygen: c.oxygen,
        temperature: c.temperature,
        sheltered: shelteredDe(s, keyOfCell(at)),
      })
    }
  }

  const cuerpos = new Map<BodyId, CuerpoEnEscena>()
  for (const id of [...s.bodies.keys()].sort(comparaTexto)) {
    const b = s.bodies.get(id)
    if (b === undefined) continue
    if (!seVe(b.at, foco, radio)) continue
    // Las claves opcionales sólo si hay algo que decir: un `heldBy: undefined`
    // explícito viaja al hash como una clave más. Misma razón que en el descriptor.
    const rel: { heldBy?: ActorId; supportedBy?: BodyId; covering?: BodyId } = {}
    if (b.heldBy !== undefined) rel.heldBy = b.heldBy
    if (b.supportedBy !== undefined) rel.supportedBy = b.supportedBy
    if (b.covering !== undefined) rel.covering = b.covering
    cuerpos.set(id, { d: descriptorDe(b, s.desplegados.get(id)), ...rel })
  }

  const actores: ActorEnEscena[] = []
  for (const id of [...s.actors.keys()].sort(comparaTexto)) {
    const a = s.actors.get(id)
    if (a === undefined) continue
    actores.push({ id: a.id, body: a.body, holding: [...a.holding], capacity: a.capacity })
  }

  return { v: VERSION_DE_LA_ESCENA, tick: s.tick, foco, radio, celdas, cuerpos, actores }
}

function seVe(at: Placement, foco: Placement, radio: number): boolean {
  return Math.abs(at.x - foco.x) <= radio && Math.abs(at.y - foco.y) <= radio
}

/** Sin `localeCompare`: el orden no puede depender del idioma del cliente. */
function comparaTexto(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

/**
 * EL HASH DE LO QUE SE VE. La cuarta capa, y la que el E2E del Hito 12 compara.
 *
 * Usa `hashWorld` y no un mezclador propio por lo mismo que `hashWorldState` y
 * `renderDescriptorHash`: dos verdades sobre «lo mismo» obligarían al juez a
 * elegir una.
 */
export function escenaHash(e: Escena): WorldHash {
  return hashWorld(e)
}

// ─── LOS DELTAS: qué cambió entre dos escenas ───────────────────────────────
//
// ─── PARA QUÉ, Y NO ES OPTIMIZACIÓN PREMATURA ──────────────────────────────
//
// El Hito 12B pide que «el mapa se actualiza en tiempo real» y que «las acciones
// y construcciones se ven mientras ocurren», o sea veinte cuadros por segundo. Una
// escena entera son (2·radio+1)² celdas más todos los cuerpos: con radio 12 son
// 625 celdas por cuadro, y casi todas iguales a las del cuadro anterior. Mandar
// eso veinte veces por segundo funciona en la máquina de uno y se cae en cuanto
// hay una red en el medio.
//
// ─── LA PROPIEDAD QUE LO HACE CONFIABLE, Y ES UNA SOLA ────────────────────
//
//     aplicarDelta(a, deltaEntre(a, b))  ===  b
//
// Escrita como igualdad de HASH y no campo por campo, porque comparar campo por
// campo se olvida del campo que alguien agregue mañana. Un delta que pierda
// información hace que el cliente se desincronice despacio: no falla, muestra un
// mundo cada vez más viejo, y nadie sabe desde cuándo.

export interface DeltaDeEscena {
  readonly v: number
  readonly de: number
  readonly a: number
  /** Cuerpos que aparecieron o entraron al área visible. */
  readonly entraron: readonly (readonly [BodyId, CuerpoEnEscena])[]
  /** Cuerpos que se fueron o dejaron de existir. Ordenados por id. */
  readonly salieron: readonly BodyId[]
  /** Cuerpos que siguen y cambiaron en algo. */
  readonly cambiaron: readonly (readonly [BodyId, CuerpoEnEscena])[]
  /** Sólo las celdas que cambiaron, en el orden de la escena. */
  readonly celdas: readonly CeldaEnEscena[]
  /**
   * LOS ACTORES, ENTEROS SI ALGUNO CAMBIÓ.
   *
   * Es la única lista que no se manda por diferencias, y es a propósito: son dos
   * o tres, cada uno pesa cuatro campos, y calcular el delta de una lista tan
   * chica cuesta más código que mandarla. `undefined` quiere decir «no cambió
   * ninguno», que es el caso de casi todos los cuadros.
   */
  readonly actores?: readonly ActorEnEscena[]
}

/**
 * QUÉ CAMBIÓ DE `a` A `b`. Las dos escenas tienen que ser del mismo foco y radio.
 *
 * Si no lo son, el delta no se puede calcular —la lista de celdas no es la misma
 * grilla— y devolver algo igual sería devolver basura. Lo dice lanzando, y no
 * con un delta vacío, porque un delta vacío es indistinguible de «no pasó nada».
 */
export function deltaEntre(a: Escena, b: Escena): DeltaDeEscena {
  if (a.foco.x !== b.foco.x || a.foco.y !== b.foco.y || a.radio !== b.radio) {
    throw new RangeError('no se puede diferenciar dos escenas de distinto encuadre: la grilla no es la misma')
  }
  if (a.v !== b.v) {
    throw new RangeError(`no se puede diferenciar la escena v${String(a.v)} contra la v${String(b.v)}`)
  }

  const entraron: (readonly [BodyId, CuerpoEnEscena])[] = []
  const cambiaron: (readonly [BodyId, CuerpoEnEscena])[] = []
  for (const [id, c] of b.cuerpos) {
    const antes = a.cuerpos.get(id)
    if (antes === undefined) entraron.push([id, c])
    else if (!igual(antes, c)) cambiaron.push([id, c])
  }
  const salieron: BodyId[] = []
  for (const id of a.cuerpos.keys()) if (!b.cuerpos.has(id)) salieron.push(id)

  const celdas: CeldaEnEscena[] = []
  for (let i = 0; i < b.celdas.length; i++) {
    const antes = a.celdas[i]
    const ahora = b.celdas[i]
    if (ahora === undefined) continue
    if (antes === undefined || !igual(antes, ahora)) celdas.push(ahora)
  }

  const base: DeltaDeEscena = { v: b.v, de: a.tick, a: b.tick, entraron, salieron, cambiaron, celdas }
  return igual(a.actores, b.actores) ? base : { ...base, actores: b.actores }
}

/**
 * LA ESCENA `b` RECONSTRUIDA desde `a` y el delta. Es la mitad que se verifica.
 *
 * Existe para que la propiedad se pueda afirmar, y no porque el cliente vaya a
 * llamarla tal cual: un cliente de verdad va a aplicar el delta sobre su propia
 * estructura de dibujo. Pero si esta función no puede reconstruir `b`, ninguna
 * otra va a poder, y el bug se vería como un mapa que se atrasa sin motivo.
 */
export function aplicarDelta(a: Escena, d: DeltaDeEscena): Escena {
  const cuerpos = new Map(a.cuerpos)
  for (const id of d.salieron) cuerpos.delete(id)
  for (const [id, c] of d.entraron) cuerpos.set(id, c)
  for (const [id, c] of d.cambiaron) cuerpos.set(id, c)

  // Reordenar por id: el `Map` heredado trae el orden de `a`, y un cuerpo que
  // entró quedaría al final. Sin esto, dos clientes que llegaron al mismo estado
  // por caminos distintos hashean distinto — que es exactamente lo que el delta
  // no puede hacer.
  const ordenados = new Map<BodyId, CuerpoEnEscena>()
  for (const id of [...cuerpos.keys()].sort(comparaTexto)) {
    const c = cuerpos.get(id)
    if (c !== undefined) ordenados.set(id, c)
  }

  const porClave = new Map<string, CeldaEnEscena>()
  for (const c of d.celdas) porClave.set(`${String(c.at.x)},${String(c.at.y)}`, c)
  const celdas = a.celdas.map((c) => porClave.get(`${String(c.at.x)},${String(c.at.y)}`) ?? c)

  return {
    v: a.v,
    tick: d.a,
    foco: a.foco,
    radio: a.radio,
    celdas,
    cuerpos: ordenados,
    actores: d.actores ?? a.actores,
  }
}

/**
 * Igualdad por el TEXTO CANÓNICO, que es el mismo criterio con el que se hashea.
 *
 * Comparar campo por campo obligaría a acordarse de cada campo nuevo. Comparar
 * por `JSON.stringify` pelado sería frágil por el orden de las claves — pero acá
 * los dos lados los construye ESTE archivo con el mismo orden de escritura, así
 * que el orden es el mismo por construcción. Que eso valga lo sostiene el test de
 * la propiedad: si dejara de valer, `aplicarDelta` no reconstruiría `b`.
 */
function igual(x: unknown, y: unknown): boolean {
  return JSON.stringify(x) === JSON.stringify(y)
}
