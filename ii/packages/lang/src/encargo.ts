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
  /**
   * EL CUERPO AL QUE ESTE NODO APUNTA, si el cuidador señaló uno.
   *
   * Sale de una corrección —«no ése, el otro tronco»— y se guarda con el encargo.
   * **Todavía no llega al planificador**: `Drive.meta` lleva una firma de texto y
   * nada más, y `Mente.#rindes` se vacía en cada plan nuevo (medido). Lo que este
   * campo cierra es la mitad que sí se puede: que el pedido quede bien anotado,
   * con identidad y con traza, en vez de perderse.
   */
  readonly sobre?: string
}

/** Un nodo que el mundo probó, con el tick en que lo probó por PRIMERA vez. */
export interface Cumplido {
  readonly nodo: GoalId
  readonly enTick: number
  /**
   * CON QUÉ CUERPO se cumplió, si se pudo saber. Es lo que la ligadura arrastra.
   *
   * «Pescá algo y después asá EL PESCADO»: el pescado de la segunda cláusula no
   * existe cuando la frase se dice, y lo único que lo identifica es que es **lo
   * que rindió el nodo anterior**. Sin este campo, «el pescado» se resuelve a
   * cualquier cosa carnosa que haya a la vista — que puede ser otra, y entonces
   * la criatura asa un pescado y guarda el que pescó.
   *
   * `undefined` cuando el nodo se dio por cumplido sin que nadie pudiera decir
   * cuál: se prefiere no saber a inventar un cuerpo.
   */
  readonly rindio?: string
}

/**
 * UNA CORRECCIÓN APLICADA, con todo lo que hace falta para auditarla.
 *
 * El documento pide que una corrección multi-turno «revise la ligadura del nodo
 * pendiente y deje traza; no cree silenciosamente otro encargo». La traza es
 * esto, y las tres cosas que trae son las que permiten volver de la revisión a
 * la conversación: qué nodo cambió, a qué cuerpo pasó a apuntar, y de qué turno
 * del log salió.
 */
export interface Revision {
  readonly turno: number
  readonly nodo: GoalId
  readonly sobre: string
  /** Lo que el cuidador escribió. Se conserva por lo mismo que `Encargo.texto`. */
  readonly texto: string
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
  /** Las correcciones que se le hicieron, en orden. Vacío si no hubo ninguna. */
  readonly revisiones: readonly Revision[]
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
    nodos: NodoDelEncargo[]
    hechos: Cumplido[]
    revisiones: Revision[]
    desdeTick: number
    estado: EncargoGuardado['estado']
  }

  private constructor(g: EncargoGuardado) {
    this.#g = {
      ...g,
      nodos: [...g.nodos],
      hechos: [...g.hechos],
      // `?? []` y no `[]`: un guardado escrito antes de que existieran las
      // revisiones no las tiene, y perder las que sí hay sería peor.
      revisiones: [...(g.revisiones ?? [])],
    }
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
      revisiones: [],
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
  ahora(
    yaEstaCumplida: (firma: string) => boolean,
    tick = -1,
    /**
     * CON QUÉ se cumplió, para la ligadura diferida. Opcional porque no todos los
     * llamadores tienen una vista del mundo a mano —un cursor de test no la
     * tiene— y porque no saberlo es una respuesta: mejor `undefined` que un
     * cuerpo inventado.
     */
    conQue?: (firma: string) => string | undefined,
  ): string | undefined {
    for (const n of this.#g.nodos) {
      if (this.#hecho(n.id)) continue
      // El orden parcial: un nodo cuyo `after` no está servido no se toca. Con el
      // orden topológico esto no debería pasar, y por eso mismo se pregunta: el
      // día que el grafo deje de ser una cadena, la guarda ya está.
      if (!n.after.every((a) => this.#hecho(a))) continue
      if (!yaEstaCumplida(n.meta)) return n.meta
      const rindio = conQue?.(n.meta)
      this.#g.hechos.push({ nodo: n.id, enTick: tick, ...(rindio === undefined ? {} : { rindio }) })
    }
    if (this.#g.estado === 'activo') this.#g.estado = 'cumplido'
    return undefined
  }

  #hecho(id: GoalId): boolean {
    return this.#g.hechos.some((h) => h.nodo === id)
  }

  /**
   * EL CUERPO QUE EL NODO PENDIENTE SEÑALA, venga de donde venga.
   *
   * Dos fuentes y en este orden, que es el que importa:
   *
   *   1. **la corrección del cuidador** (`nodo.sobre`). Lo último que dijo una
   *      persona gana siempre: si te corrigieron, te corrigieron;
   *   2. **la ligadura diferida** — lo que rindió el nodo del que éste depende.
   *      «Asá el pescado» sin más aclaración es el que pescaste recién.
   *
   * Y la ligadura sólo se sigue si el nodo la DECLARA (`bindeaSlot`). Arrastrar
   * el rendimiento anterior a un nodo que no lo pidió sería inventar una atadura
   * que nadie midió, que es exactamente lo que `objetivosDe` se niega a hacer con
   * su tabla de pares ligables.
   */
  senaladoDelPendiente(): string | undefined {
    const n = this.#g.nodos.find((x) => !this.#hecho(x.id))
    if (n === undefined) return undefined
    if (n.sobre !== undefined) return n.sobre
    if (n.bindeaSlot === undefined) return undefined
    for (const a of n.after) {
      const h = this.#g.hechos.find((x) => x.nodo === a)
      if (h?.rindio !== undefined) return h.rindio
    }
    return undefined
  }

  /**
   * «NO ÉSE, EL OTRO»: el nodo pendiente pasa a apuntar a otro cuerpo.
   *
   * ─── Lo que esto NO hace, y hay que decirlo ─────────────────────────────────
   *
   * No crea un encargo nuevo, y ése es el punto: el documento pide que una
   * corrección «no cree silenciosamente otro encargo». La identidad, el grafo y
   * lo ya cumplido quedan intactos; lo único que cambia es a qué apunta el nodo
   * que todavía no se hizo.
   *
   * Tampoco llega al planificador todavía. `Drive.meta` lleva una firma de texto,
   * así que el `sobre` se guarda y espera al ejecutor de la ligadura diferida —
   * la misma mitad que le falta al `bindeaSlot`. Lo que sí queda cerrado es que
   * el pedido **no se pierda**: antes esta frase no hacía absolutamente nada.
   *
   * `undefined` cuando no hay nodo pendiente: corregir un encargo terminado no es
   * una corrección, es una frase suelta.
   */
  revisar(turno: number, sobre: string, texto: string): Revision | undefined {
    const pendiente = this.#g.nodos.find((n) => !this.#hecho(n.id))
    if (pendiente === undefined) return undefined
    const i = this.#g.nodos.indexOf(pendiente)
    this.#g.nodos[i] = { ...pendiente, sobre }
    const r: Revision = { turno, nodo: pendiente.id, sobre, texto }
    this.#g.revisiones.push(r)
    return r
  }

  /** El encargo como dato, para guardarlo. */
  volcar(): EncargoGuardado {
    return {
      ...this.#g,
      nodos: [...this.#g.nodos],
      hechos: [...this.#g.hechos],
      revisiones: [...this.#g.revisiones],
    }
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
