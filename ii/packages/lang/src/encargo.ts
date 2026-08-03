/**
 * UN ENCARGO DE VARIAS CLÁUSULAS, andando de a una.
 *
 * «Hacé fuego y después pescá» no se podía pedir, y el motivo estaba medido:
 * el único canal externo a la mente es `MenteOptions.drive`, que lleva **una**
 * firma de predicado. El orden parcial y las ligaduras que `objetivosDe` produce
 * no tienen por dónde entrar.
 *
 * ─── LAS DOS SALIDAS, y por qué ésta ────────────────────────────────────────
 *
 * **(a) Que la mente sepa recibir un grafo.** Es la buena, y es grande: hay que
 * tocar `Drive`, el peldaño D2, y —sobre todo— hay que resolver el `Ref` del
 * `binds`, que **hoy no lo puede resolver nadie**. Está medido: `{k:'rinde',
 * de:'g1'}` nombra un nodo hermano y `Mente.#rindes` se vacía en cada plan
 * nuevo, porque sus llaves son firmas de contenido intra-plan. La mitad del ADR
 * 0082 que `plan()` implementó no tiene ejecutor del otro lado.
 *
 * **(b) Que alguien afuera mande de a una.** Es ésta. No toca `@anima/mind` ni
 * `@anima/plan`, no inventa un ejecutor que no existe, y usa dos cosas que ya
 * estaban escritas y sin usar: `orden()` —el orden topológico estable de
 * `@anima/plan`, que hasta hoy no llamaba nadie— y el gancho `yaEstaCumplida`
 * que el tramo anterior agregó para otra cosa.
 *
 * ─── LO QUE SE PIERDE, y hay que decirlo ────────────────────────────────────
 *
 * **La ligadura diferida.** «Pescá algo y después asá EL PESCADO» se convierte
 * en dos encargos sueltos: primero «tener algo carnoso», después «tener algo
 * carnoso cocido». El `binds` que dice «el de la cláusula anterior» se pierde, y
 * con él los siete pasos de plan que valía (medido: 5 pasos contra 12).
 *
 * No se disimula: `Encargo.ligaduraPerdida` lo cuenta, y quien lo use puede
 * decírselo al cuidador. Recuperarlo es la salida (a).
 *
 * ─── Cómo avanza ────────────────────────────────────────────────────────────
 *
 * No con un temporizador ni contando ticks: **avanza cuando la meta en curso
 * está cumplida**. Es la misma pregunta que `tomarMeta` le hace a cada meta
 * antes de tomarla, así que las dos capas coinciden por construcción en vez de
 * por coincidencia.
 */

import { orden, textoDe } from '@anima/plan'
import type { GoalId, GoalNode } from '@anima/plan'
import { objetivosDe } from './objetivos.js'
import type { Descarte } from './objetivos.js'
import type { Lectura } from './tipos.js'

/**
 * UN NODO DEL ENCARGO, en datos planos — y por eso no es un `GoalNode`.
 *
 * `GoalNode` lleva un `Predicado` adentro, que es una estructura; esto lleva su
 * FIRMA, que es texto. La diferencia es que esto **aguanta el viaje por JSON**, y
 * ése es todo el motivo: el encargo se guarda (C3) y lo que no sobrevive a un
 * `stringify` no sirve para IndexedDB.
 *
 * Volver de la firma a la estructura es `interpretar()` de `@anima/plan`, que es
 * total y determinista, así que no se pierde nada por el camino.
 */
export interface NodoDelEncargo {
  readonly id: GoalId
  /** La firma del predicado, tal como `Drive.meta` la espera. */
  readonly meta: string
  /** Los nodos que tienen que estar hechos antes. Orden PARCIAL, no lista. */
  readonly after: readonly GoalId[]
  /**
   * La ligadura diferida, ANOTADA aunque todavía no la ejecute nadie.
   *
   * `Mente` no sabe recibir un `binds` —está medido en el encabezado— así que
   * hoy esto no cambia lo que la criatura hace. Se guarda igual porque es
   * información del pedido y no del plan: el día que exista el ejecutor, los
   * encargos viejos ya la tienen. Perderla sería tener que volver a leer la
   * frase contra un mundo que ya no es el de entonces.
   */
  readonly bindeaSlot?: string
}

/** Un nodo que el mundo probó, con el tick en que lo probó por PRIMERA vez. */
export interface Cumplido {
  readonly nodo: GoalId
  readonly enTick: number
}

/**
 * EL ENCARGO COMO DATO — lo que se guarda y lo que vuelve.
 *
 * Es el `Commission` del documento de convergencia, con lo que este tramo puede
 * sostener. Lo que NO está, y se dice para que nadie lo busque: `priority` e
 * `interruptibility` son del scheduler (C5) y `blocker` necesita el bloqueo
 * estructurado que hoy no produce nadie.
 */
export interface EncargoGuardado {
  /**
   * SU IDENTIDAD, derivada del turno que lo creó.
   *
   * Derivada y no sorteada: `Math.random` está prohibido en `src/` y un id que
   * dependiera del reloj haría que dos corridas de la misma partida guardaran
   * datos distintos. El turno ya es único y creciente, así que alcanza — y de
   * paso el id dice de dónde salió el encargo.
   */
  readonly id: string
  /** Los turnos del log de los que salió. Es la procedencia, como en C2. */
  readonly turnos: readonly number[]
  /** Lo que el cuidador escribió, tal cual. */
  readonly texto: string
  readonly nodos: readonly NodoDelEncargo[]
  readonly hechos: readonly Cumplido[]
  readonly desdeTick: number
  readonly estado: 'activo' | 'cumplido' | 'cancelado'
}

export interface Encargo {
  /** Las metas, en el orden en que hay que perseguirlas. */
  readonly metas: readonly string[]
  /** El grafo, con su orden parcial y sus ligaduras. Es lo que se hace durable. */
  readonly nodos: readonly NodoDelEncargo[]
  /** Lo que la lectura no pudo convertir en objetivo, con su porqué. */
  readonly descartes: readonly Descarte[]
  /**
   * Cuántas ligaduras diferidas se perdieron al partir el grafo en metas
   * sueltas. Cada una vale, medida, siete pasos de plan.
   */
  readonly ligaduraPerdida: number
}

/** El encargo de una lectura. Puede quedar vacío, y eso también es una respuesta. */
export function encargoDe(l: Lectura): Encargo {
  const p = objetivosDe(l)
  if (p.nodos.length === 0) {
    return { metas: [], nodos: [], descartes: p.descartes, ligaduraPerdida: 0 }
  }
  const porId = new Map<string, GoalNode>()
  for (const n of p.nodos) porId.set(n.id, n)

  // `orden()` de `@anima/plan`, que hasta hoy no llamaba nadie en producción.
  // Devuelve un orden topológico ESTABLE, así que la misma lectura da la misma
  // secuencia — que es lo que hace que un encargo se pueda guardar y repetir.
  const ids = orden(p.nodos)
  const metas: string[] = []
  const nodos: NodoDelEncargo[] = []
  let ligaduraPerdida = 0
  for (const id of ids) {
    const n = porId.get(id)
    if (n === undefined) continue
    if (n.binds !== undefined) ligaduraPerdida++
    const meta = textoDeLaMeta(n)
    metas.push(meta)
    nodos.push({
      id: n.id,
      meta,
      after: [...n.after],
      ...(n.binds === undefined ? {} : { bindeaSlot: n.binds.slot }),
    })
  }
  return { metas, nodos, descartes: p.descartes, ligaduraPerdida }
}

/**
 * La firma de un nodo, tal como `Drive.meta` la espera.
 *
 * `GoalNode.goal` es una ESTRUCTURA y `Drive.meta` es un STRING, y la conversión
 * existe: `textoDe` de `@anima/plan` es total sobre `Predicado`. La asimetría es
 * de la costura —un canal lleva estructura y el otro texto— y no de este archivo.
 */
function textoDeLaMeta(n: GoalNode): string {
  return textoDe(n.goal)
}

/**
 * EL ESTADO DE UN ENCARGO EN CURSO.
 *
 * Mutable y encerrado: es un cursor, y un cursor inmutable que devuelve una
 * copia por paso convierte tres cláusulas en tres objetos por tick.
 */
export class EncargoEnCurso {
  readonly #g: {
    id: string
    turnos: readonly number[]
    texto: string
    nodos: readonly NodoDelEncargo[]
    hechos: Cumplido[]
    desdeTick: number
    estado: EncargoGuardado['estado']
  }

  private constructor(g: EncargoGuardado) {
    this.#g = { ...g, hechos: [...g.hechos] }
  }

  /**
   * UN ENCARGO NUEVO, con su identidad y su procedencia.
   *
   * `turnos` y `texto` no son adorno: son lo que permite volver del encargo a la
   * conversación que lo creó, que es lo mismo que los recuerdos del C2 hacen con
   * `sourceTurnIds`. Un encargo sin fuente es una orden que apareció sola.
   */
  static nuevo(
    e: Encargo,
    // Con valores por omisión para el cursor de un test o de un demo, que no
    // tiene log ni partida detrás. En producción se pasan los tres: un encargo
    // sin procedencia es una orden que apareció sola, y `-1` es la misma
    // convención que `Dicho.tick` ya usa para «fuera de la partida».
    turnos: readonly number[] = [],
    texto = '',
    tick = -1,
  ): EncargoEnCurso {
    return new EncargoEnCurso({
      id: `enc:${String(turnos[0] ?? 0)}`,
      turnos: [...turnos],
      texto,
      nodos: e.nodos,
      hechos: [],
      desdeTick: tick,
      estado: 'activo',
    })
  }

  /** El que volvió del guardado. Mismo id, mismo grafo, mismo lo hecho. */
  static desdeGuardado(g: EncargoGuardado): EncargoEnCurso {
    return new EncargoEnCurso(g)
  }

  /**
   * LA META DE AHORA: el primer nodo pendiente cuyo orden ya está servido.
   *
   * `yaEstaCumplida` entra por parámetro y no se guarda: la respuesta cambia a
   * cada tick, y un cursor que se guardara la de hace veinte estaría contestando
   * sobre un mundo que ya no existe.
   *
   * ─── LO QUE CAMBIÓ EN EL C3, y es la diferencia entre acordarse y mirar ────
   *
   * Antes esto era un índice sobre una lista: avanzaba mientras el mundo
   * cumpliera, y no dejaba rastro. Ahora, cuando el mundo prueba un nodo, **se
   * anota cuál y en qué tick**, y esa anotación se guarda.
   *
   * La consecuencia es la que el criterio pide con todas las letras: una recarga
   * en el medio **no repite el primer paso**. Y va más lejos que eso — no lo
   * repite ni siquiera si el mundo dejó de cumplirlo, porque lo que se afirma es
   * que se cumplió UNA VEZ. Es el ADR 0083 de Ánima I portado: «`sequence`
   * compara el tick en que cada objetivo se cumplió por primera vez».
   *
   * `undefined` quiere decir **terminado**, y hay que distinguirlo de «no había
   * nada»: para eso está `total`.
   */
  ahora(yaEstaCumplida: (firma: string) => boolean, tick = -1): string | undefined {
    for (const n of this.#g.nodos) {
      if (this.#hecho(n.id)) continue
      // El orden parcial: un nodo cuyo `after` no está servido no se toca. Con el
      // orden topológico esto no debería pasar, y por eso mismo se pregunta: el
      // día que el grafo deje de ser una cadena, la guarda ya está.
      if (!n.after.every((a) => this.#hecho(a))) continue
      if (!yaEstaCumplida(n.meta)) return n.meta
      this.#g.hechos.push({ nodo: n.id, enTick: tick })
    }
    if (this.#g.estado === 'activo') this.#g.estado = 'cumplido'
    return undefined
  }

  #hecho(id: GoalId): boolean {
    return this.#g.hechos.some((h) => h.nodo === id)
  }

  /** El encargo como dato, para guardarlo. */
  volcar(): EncargoGuardado {
    return { ...this.#g, hechos: [...this.#g.hechos] }
  }

  get id(): string {
    return this.#g.id
  }

  get total(): number {
    return this.#g.nodos.length
  }

  /** Cuántas quedaron atrás. Sirve para decir «voy por la segunda de tres». */
  get hechas(): number {
    return this.#g.hechos.length
  }

  get terminado(): boolean {
    return this.#g.hechos.length >= this.#g.nodos.length
  }
}
