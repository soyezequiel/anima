/**
 * EL CANAL DE HABLA — separado del camino de acción, y separado de verdad.
 *
 * El documento de arquitectura lo pide dos veces y con la misma palabra:
 *
 * > **acuse por canal de HABLA** — se pinta en el **mismo frame** que el mensaje
 * > del usuario. **Cuesta 0 en el camino de acción**.
 *
 * ─── Qué quiere decir «separado», que no es una carpeta ─────────────────────
 *
 * Que **nada del tick lo toca**. Este archivo es una lista a la que alguien
 * escribe y de la que alguien lee, y no aparece en `stepWorld`, ni en las
 * intenciones, ni en el hash del mundo. Si se borrara entero, la criatura haría
 * exactamente lo mismo — sólo que en silencio.
 *
 * Es la prueba de «cuesta 0 en el camino de acción», y es estructural: no hay
 * forma de que hablar retrase un movimiento porque el movimiento no lee de acá.
 *
 * ─── Y por qué NO es `ctx.say` ──────────────────────────────────────────────
 *
 * `ctx.say` existe y es **el habla de la HABILIDAD**, adentro del aislamiento.
 * Se midió: empuja a un array privado de `Contexto` que **ningún `src/` lee**, no
 * aparece en los `SimEvent`, ni en la `Escena`, ni en el `WorldState`. Y no está
 * roto: es de otra capa. La habilidad dice «me quedo acá» mientras corre; el
 * chat dice «dale, voy» antes de que nada corra.
 *
 * Mezclarlos habría metido el acuse adentro del aislamiento de las habilidades,
 * que es exactamente donde no puede estar: ahí no llega hasta que algo despega, y
 * el punto 5 del criterio pide que salga en el mismo frame que el mensaje.
 *
 * ─── Las cuatro clases, y por qué se distinguen ─────────────────────────────
 *
 * | clase | cuándo | quién la lee |
 * |---|---|---|
 * | `acuse` | en el acto, antes de decidir nada | el cuidador, para saber que lo oyeron |
 * | `aviso` | lo que no se pudo, con su porqué | el cuidador, para saber qué falta |
 * | `progreso` | mientras trabaja | el cuidador, para no creer que se colgó |
 * | `listo` | terminó lo que le pidieron | el cuidador, para pedir otra cosa |
 *
 * Se distinguen porque una UI las pinta distinto y porque el criterio mide sólo
 * el `acuse` — el resto puede tardar lo que quiera.
 */

export type ClaseDeDicho = 'acuse' | 'aviso' | 'progreso' | 'listo'

export interface Dicho {
  /** El tick del mundo en el que se dijo. `-1` si se dijo fuera de la partida. */
  readonly tick: number
  readonly clase: ClaseDeDicho
  readonly texto: string
}

/**
 * CUÁNTO SE GUARDA.
 *
 * Ciento, y se tira lo viejo. No es prudencia genérica: una charla larga con la
 * criatura corriendo miles de ticks acumula progreso sin techo, y este canal
 * vive lo que vive la partida. Cien alcanza para que una UI muestre el hilo
 * reciente, que es para lo único que sirve.
 */
const CUANTOS = 100

/**
 * LO QUE SE DIJO, en orden.
 *
 * Mutable y encerrado, como `EncargoEnCurso` y por lo mismo: es un registro que
 * crece, y uno inmutable que devuelve una copia por línea convierte una charla
 * en una copia por línea.
 */
export class CanalDeHabla {
  readonly #dichos: Dicho[] = []

  decir(tick: number, clase: ClaseDeDicho, texto: string): void {
    if (texto.length === 0) return
    this.#dichos.push({ tick, clase, texto })
    if (this.#dichos.length > CUANTOS) this.#dichos.shift()
  }

  /** Todo lo dicho, del más viejo al más nuevo. */
  get todo(): readonly Dicho[] {
    return [...this.#dichos]
  }

  /** Lo dicho desde un tick, para que una UI pinte sólo lo nuevo. */
  desde(tick: number): readonly Dicho[] {
    return this.#dichos.filter((d) => d.tick >= tick)
  }

  get ultimo(): Dicho | undefined {
    return this.#dichos[this.#dichos.length - 1]
  }

  get cuantos(): number {
    return this.#dichos.length
  }
}

/**
 * NARRAR EL PROGRESO — la tercera exigencia del caso de aceptación.
 *
 * > y **mostrar progreso sin detener el cuerpo**
 *
 * Las dos mitades ya estaban: el cuerpo no se detiene (punto 1 del criterio, con
 * su medición) y el `nearest` que `plan()` devuelve en un `gap` es todo
 * `reversible`, así que la criatura arranca con eso mientras el resto se
 * resuelve. **Lo que faltaba era decirlo.**
 *
 * Y lo que se dice tiene una regla: **el progreso se narra por lo que la criatura
 * HIZO, no por lo que va a hacer**. Un «ya casi» que sale de una estimación es la
 * clase de mensaje que convierte una espera en una mentira; «até dos cosas» es un
 * hecho y se puede verificar mirando el mundo.
 */
export function narrarProgreso(hecho: string, cuantos: number): string {
  return cuantos > 1 ? `${hecho} (${String(cuantos)} veces)` : hecho
}

/**
 * Lo que se dice cuando hay un `gap` con un prefijo reversible.
 *
 * `nearest` son los pasos que `plan()` SÍ puede dar aunque la meta entera no
 * salga, y son todos reversibles por construcción. Que existan y que nadie los
 * nombre es lo que hace que la criatura parezca detenida cuando no lo está.
 */
export function narrarElGap(cuantosPasos: number, falta: string): string {
  return cuantosPasos === 0
    ? `no encontré por dónde empezar: ${falta}`
    : `voy haciendo lo que puedo mientras tanto — ${String(cuantosPasos)} paso${cuantosPasos > 1 ? 's' : ''} que sí sé dar. Lo que me traba: ${falta}`
}
