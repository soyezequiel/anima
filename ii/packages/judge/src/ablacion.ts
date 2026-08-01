/**
 * LA ABLACIÓN DE PRECONDICIONES — Hito 7, tramo E. Punto 4.
 *
 * > para cada `requires` candidato se corren N mundos donde esa condición no se
 * > cumple; si la habilidad funciona igual, la precondición era **espuria** y se
 * > borra
 *
 * ─── Por qué esto se puede escribir hoy, y no es casualidad ─────────────────
 *
 * Las dos piezas que hacen falta ya estaban, y las dos se escribieron
 * ANTICIPANDO este archivo:
 *
 * 1. **El dato.** `skills/src/innatas/contrato.ts` guarda `precondiciones` como
 *    DATO y su encabezado dice para qué: *«el juez del Hito 7 hace ablación de
 *    precondiciones. Una precondición escrita en prosa dentro de un comentario
 *    no se puede ablacionar. Escrita acá, sí.»*
 * 2. **El mundo.** El banco del tramo D produce, para cada precondición, un
 *    mundo que viola **ésa y sólo ésa** (`MundoDelBanco.ataca`). Ese aislamiento
 *    no era un lujo: sin él no se puede atribuir el resultado.
 *
 * Y hasta el sujeto lo pidió por su nombre. El encabezado de `sostener`, sobre
 * su heurística de qué soltar:
 *
 *   > Es una heurística escrita a mano, o sea exactamente el tipo de decisión
 *   > que **el juez del Hito 7 tendría que ablacionar**.
 *
 * ─── QUÉ SIGNIFICA «ESPURIA», con cuidado ───────────────────────────────────
 *
 * Que la habilidad **funcione igual** con la condición violada. No que la
 * condición sea falsa: que **no la esté usando**.
 *
 * La distinción importa porque el resultado se aplica: una precondición espuria
 * se borra del contrato, y borrar una que sí hacía falta convierte una habilidad
 * honesta en una que promete de más. Por eso el veredicto por defecto es **no
 * espuria**, y hace falta evidencia positiva —la habilidad terminó BIEN en el
 * mundo que la viola— para moverlo.
 *
 * ─── EL HUECO QUE ESTE ARCHIVO NO PUEDE CERRAR, medido ──────────────────────
 *
 * **El juez no puede invocar una habilidad sin saber sus argumentos.** `sostener`
 * pide `{ que: BodyView }`, `frotar` pide otra cosa, y no hay en el árbol ningún
 * esquema que diga qué args lleva cada una: se leen del tipo de TypeScript, que
 * en tiempo de corrida no existe.
 *
 * Así que el sujeto los trae (`Sujeto.argsDe`). No es una comodidad de prueba:
 * es la frontera real del hito. Del Hito 8 en adelante la fragua produce el
 * paquete entero —`BlueprintCandidate + BuildSkillCandidate + UseSkillCandidate`—
 * y ahí los args son parte de lo forjado. Hasta entonces, los pone quien acusa.
 */

import type { Physics } from '@anima/physics'
import { Partida } from '@anima/perceive'
import type { Skill } from '@anima/skills'
import { bancoDe } from './banco.js'
import type { MundoDelBanco } from './banco.js'
import { mundoConObjetivo, EL_ACTOR } from './escena.js'
import type { Acusada } from './tipos.js'

/**
 * Lo que hace falta para poder correr una habilidad, y no lo puede armar el juez.
 * Ver el hueco medido del encabezado.
 */
export interface Sujeto<A> {
  readonly acusada: Acusada
  readonly skill: Skill<A>
  /**
   * Los args, mirando el mundo. `undefined` si en este mundo no hay con qué —
   * y eso NO es un fracaso de la habilidad: es un mundo donde no se la puede
   * ni largar, así que no cuenta.
   */
  readonly argsDe: (p: Partida) => A | undefined
}

export type Desenlace = 'llego' | 'fallo' | 'no-se-pudo-largar' | 'se-colgo'

export interface Corrio {
  readonly mundo: string
  readonly desenlace: Desenlace
  readonly ticks: number
}

/**
 * CUÁNTOS TICKS SE LE DAN, y por qué un número y no «hasta que termine».
 *
 * Porque una habilidad que no termina es un resultado, no un cuelgue del arnés,
 * y sin tope no hay forma de distinguirlo de un banco lento. Cuarenta alcanza
 * para las innatas —la cadena más larga del Hito 5 tira la caña en el tick 48
 * partiendo de cero, y acá el objetivo nace al lado— y es barato: el banco corre
 * una vez por precondición y por habilidad.
 */
const TOPE_DE_TICKS = 40

export function correrEn<A>(s: Sujeto<A>, m: MundoDelBanco, phys: Physics): Corrio {
  const p = mundoConObjetivo(m, phys)
  const args = s.argsDe(p)
  if (args === undefined) return { mundo: m.id, desenlace: 'no-se-pudo-largar', ticks: 0 }

  const v = p.volar(EL_ACTOR, s.skill, args)
  let t = 0
  while (!v.terminado && t < TOPE_DE_TICKS) {
    p.tick()
    t++
  }
  if (!v.terminado) return { mundo: m.id, desenlace: 'se-colgo', ticks: t }
  return { mundo: m.id, desenlace: v.outcome?.ok === true ? 'llego' : 'fallo', ticks: t }
}

export interface Ablacion {
  /** La precondición, tal como se lee del contrato. */
  readonly precondicion: string
  readonly espuria: boolean
  readonly porque: string
  readonly corridas: readonly Corrio[]
}

/**
 * ABLACIONAR UN CONTRATO.
 *
 * Para cada precondición con un mundo que la viole a ella sola, se corre la
 * habilidad ahí. Si **llegó**, no la estaba usando.
 *
 * Y las que no tienen un mundo así **no se ablacionan y se dice**: declararlas
 * «no espurias» por no haberlas probado sería exactamente la clase de verde por
 * omisión que este hito viene encontrando en todos lados.
 */
export function ablacionar<A>(s: Sujeto<A>, phys: Physics): readonly Ablacion[] {
  const banco = bancoDe(s.acusada.contrato, phys)
  const out: Ablacion[] = []

  for (const p of s.acusada.contrato.precondiciones) {
    const clave = `${p.q}${p.op}${String(p.v)}`
    const mundos = banco.filter((m) => m.ataca === clave)
    if (mundos.length === 0) {
      out.push({
        precondicion: clave,
        espuria: false,
        porque: 'NO SE PROBÓ: el catálogo no tiene materia que viole ésta y ninguna otra',
        corridas: [],
      })
      continue
    }

    const corridas = mundos.map((m) => correrEn(s, m, phys))
    const llego = corridas.filter((c) => c.desenlace === 'llego')
    out.push({
      precondicion: clave,
      espuria: llego.length > 0,
      porque:
        llego.length > 0
          ? `la habilidad LLEGÓ en ${String(llego.length)} mundo(s) que la violan: no la estaba usando`
          : `la habilidad no llegó en ninguno de los ${String(corridas.length)} mundos que la violan`,
      corridas,
    })
  }
  return out
}
