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
import type { GoalNode } from '@anima/plan'
import { objetivosDe } from './objetivos.js'
import type { Descarte } from './objetivos.js'
import type { Lectura } from './tipos.js'

export interface Encargo {
  /** Las metas, en el orden en que hay que perseguirlas. */
  readonly metas: readonly string[]
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
    return { metas: [], descartes: p.descartes, ligaduraPerdida: 0 }
  }
  const porId = new Map<string, GoalNode>()
  for (const n of p.nodos) porId.set(n.id, n)

  // `orden()` de `@anima/plan`, que hasta hoy no llamaba nadie en producción.
  // Devuelve un orden topológico ESTABLE, así que la misma lectura da la misma
  // secuencia — que es lo que hace que un encargo se pueda guardar y repetir.
  const ids = orden(p.nodos)
  const metas: string[] = []
  let ligaduraPerdida = 0
  for (const id of ids) {
    const n = porId.get(id)
    if (n === undefined) continue
    if (n.binds !== undefined) ligaduraPerdida++
    metas.push(textoDeLaMeta(n))
  }
  return { metas, descartes: p.descartes, ligaduraPerdida }
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
  readonly #metas: readonly string[]
  #i = 0

  constructor(e: Encargo) {
    this.#metas = e.metas
  }

  /**
   * LA META DE AHORA, salteando las que el mundo ya cumple.
   *
   * `yaEstaCumplida` entra por parámetro y no se guarda: la respuesta cambia a
   * cada tick, y un cursor que se guardara la de hace veinte estaría contestando
   * sobre un mundo que ya no existe.
   *
   * `undefined` quiere decir **terminado**, y hay que distinguirlo de «no había
   * nada»: para eso está `total`.
   */
  ahora(yaEstaCumplida: (firma: string) => boolean): string | undefined {
    while (this.#i < this.#metas.length) {
      const m = this.#metas[this.#i]
      if (m === undefined) break
      if (!yaEstaCumplida(m)) return m
      this.#i++
    }
    return undefined
  }

  get total(): number {
    return this.#metas.length
  }

  /** Cuántas quedaron atrás. Sirve para decir «voy por la segunda de tres». */
  get hechas(): number {
    return this.#i
  }

  get terminado(): boolean {
    return this.#i >= this.#metas.length
  }
}
