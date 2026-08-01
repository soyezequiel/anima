/**
 * EL PUENTE A `goalGraph` — el extremo que estaba sin conectar.
 *
 * `Lectura`, `goalGraph` y `orden` viven en `@anima/plan` desde hace tramos,
 * escritos esperando a este hito, con un comentario que lo dice: «`@anima/lang`
 * no existe hasta el Hito 6, así que hasta entonces esto lo arma la mente o un
 * test». Se midió antes de escribir este archivo y el diagnóstico fue peor de lo
 * que ese comentario sugiere:
 *
 *     llamadas a `goalGraph`/`orden` en los `src/` de los paquetes .... 0
 *     sitios que construyen un GoalNode en producción ............ 1
 *
 * Ese único sitio es un literal de una línea en `mind/src/escalera.ts:1452`, con
 * `after: []` y sin `binds`. O sea que **el planificador sabe leer un `binds` y
 * la mente nunca le manda uno**: la costura está partida en dos y las dos
 * mitades están escritas. Este archivo es la soldadura.
 *
 * ─── LA DECISIÓN DEL ARCHIVO, y sale de dos mediciones incómodas ────────────
 *
 * El `bindeaSlot` **no se valida en ninguna parte**, ni por tipos ni por nombre,
 * y falla de dos formas opuestas. Las dos medidas, sobre la meta de asar con una
 * fogata a la vista:
 *
 * | qué se pasó | qué salió |
 * |---|---|
 * | `slot: 'comida'` (el correcto) | plan de **5 pasos** |
 * | sin `binds` | plan de **12 pasos**: vuelve a pescar de cero |
 * | `slot: 'este-rol-no-existe'` | **idéntico byte a byte** al de sin `binds` |
 * | `slot: 'fuego'` | plan **verde de 10 pasos** poniendo la comida encima del pescado, como si el pescado fuera el fuego |
 *
 * El primero vale siete pasos. El tercero se evapora **en silencio**. El cuarto
 * es peor que los dos: sale verde y pide un disparate, y nada se pone rojo hasta
 * que el mundo lo rebote.
 *
 * **Por eso este archivo no adivina un slot nunca.** Sólo liga cuando el par
 * (firma de destino, slot) está en una tabla escrita a mano y medida. Es
 * conservador a propósito: perder una ligadura cuesta siete pasos de plan, y
 * poner la equivocada manda a la criatura a hacer una cosa absurda con cara de
 * éxito.
 */

import type { Lectura as LecturaDePlan } from '@anima/plan'
import { goalGraph, interpretar } from '@anima/plan'
import type { GoalNode } from '@anima/plan'
import type { ClausulaLeida, Lectura } from './tipos.js'

/**
 * LOS PARES (firma de destino, slot) QUE SE PUEDEN LIGAR, medidos uno por uno.
 *
 * La regla para agregar una fila es la misma con la que se escribió ésta:
 * correr `plan()` con el `binds` puesto y sin él, y que la diferencia sea real y
 * en el sentido correcto. Una fila sin esa medición al lado no entra.
 */
const LIGABLES: readonly (readonly [destino: string, slot: string])[] = [
  // «...y después asá el pescado»: el pescado de la cláusula anterior entra como
  // `comida` de la cocción. Medido: 5 pasos contra 12.
  ['holding(tag:carnoso,digestibility>=0.85,toxicity<=0.05)', 'comida'],
]

function slotPara(destino: string): string | undefined {
  for (const [d, s] of LIGABLES) if (d === destino) return s
  return undefined
}

/**
 * Qué cláusulas SE PIERDEN al cruzar el puente, y por qué.
 *
 * Existe porque perder una cláusula en silencio es el modo de falla que este
 * paquete persigue. Una lectura de tres cláusulas de las cuales dos no se pueden
 * representar tiene que decir eso en voz alta, no entregar un grafo de uno y
 * dejar que el cuidador crea que se entendió todo.
 */
export interface Descarte {
  readonly crudo: string
  readonly porque: string
}

export interface Puente {
  readonly nodos: readonly GoalNode[]
  readonly descartes: readonly Descarte[]
  /** Lo que se le dice al cuidador si algo se perdió. Vacío si no se perdió nada. */
  readonly aviso: string
}

/**
 * ¿Esta cláusula puede ser un objetivo?
 *
 * Tres portones, y los tres tienen que pasar. El tercero es el que sorprende:
 * **una cláusula NEGADA no es un objetivo**. «No hagas fuego» no se convierte en
 * la meta `emitsPower>0` con un signo menos, porque `GoalNode` no tiene signo y
 * el planificador iría a hacer fuego. Una restricción es otra cosa que un
 * objetivo, y este sistema todavía no tiene dónde ponerla — así que se descarta
 * diciéndolo, que es lo único honesto que se puede hacer hoy.
 */
function porQueNoVa(c: ClausulaLeida): string | undefined {
  if (c.firma === undefined) {
    return c.verbo === undefined
      ? 'no reconocí ningún pedido en esa parte'
      : `«${c.verbo}» no lleva a un estado del mundo que yo sepa nombrar`
  }
  if (interpretar(c.firma) === undefined) {
    // No debería pasar —hay un test que lo impide— y si pasa, se dice.
    return `entendí «${c.firma}» y el planificador no sabe leerla`
  }
  if (c.polaridad === 'niega') {
    return 'lo que me pediste que NO haga lo entendí, pero todavía no sé guardarme una prohibición'
  }
  return undefined
}

/**
 * DE UNA LECTURA A UN GRAFO DE OBJETIVOS.
 *
 * `goalGraph` de `@anima/plan` hace el trabajo de las aristas —el orden parcial y
 * las ligaduras—; lo que este archivo aporta es lo que `goalGraph` no puede
 * saber: qué cláusulas son objetivos y cuáles no, y cuándo un `bindeaSlot` es
 * seguro.
 */
export function objetivosDe(l: Lectura): Puente {
  const clausulas: LecturaDePlan['clausulas'][number][] = []
  const descartes: Descarte[] = []
  let hubouna = false

  for (const c of l.clausulas) {
    const no = porQueNoVa(c)
    if (no !== undefined) {
      descartes.push({ crudo: c.crudo, porque: no })
      continue
    }
    const p = interpretar(c.firma as string)
    if (p === undefined) continue
    // La primera cláusula que sobrevive nunca dice «despues»: `goalGraph` lo
    // tolera pero no ordena nada, y decirlo sería mentir sobre el grafo. Y si
    // la que se descartó era la primera, la segunda pasa a serlo.
    const liga = hubouna ? c.liga : 'y'
    const slot = hubouna ? slotPara(c.firma as string) : undefined
    clausulas.push({
      goal: p,
      liga,
      ...(slot === undefined ? {} : { bindeaSlot: slot }),
      porque: c.porque,
    })
    hubouna = true
  }

  return {
    nodos: clausulas.length === 0 ? [] : goalGraph({ clausulas }),
    descartes,
    aviso: avisoDe(descartes, clausulas.length),
  }
}

function avisoDe(d: readonly Descarte[], cuantos: number): string {
  if (d.length === 0) return ''
  if (cuantos === 0) return `no puedo con eso: ${d[0]?.porque ?? ''}`
  return `voy con lo que entendí, pero ${String(d.length)} cosa${d.length > 1 ? 's' : ''} no: ${d
    .map((x) => x.porque)
    .join(' · ')}`
}

/** Los pares ligables, para que un test los barra y para que se vean. */
export const PARES_LIGABLES = LIGABLES
