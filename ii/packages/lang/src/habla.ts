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
 * ─── Las CINCO clases, y por qué se distinguen ──────────────────────────────
 *
 * | clase | cuándo | quién la lee |
 * |---|---|---|
 * | `entrada` | lo que escribió el cuidador | los dos: es el turno que abre |
 * | `acuse` | en el acto, antes de decidir nada | el cuidador, para saber que lo oyeron |
 * | `aviso` | lo que no se pudo, con su porqué | el cuidador, para saber qué falta |
 * | `progreso` | mientras trabaja | el cuidador, para no creer que se colgó |
 * | `listo` | terminó lo que le pidieron | el cuidador, para pedir otra cosa |
 *
 * Se distinguen porque una UI las pinta distinto y porque el criterio mide sólo
 * el `acuse` — el resto puede tardar lo que quiera.
 *
 * ─── LA QUINTA CLASE ES DEL TRAMO DE CONVERGENCIA, y es la que lo cambia todo ─
 *
 * `entrada` entró con el C1 de
 * [la convergencia conversacional](../../../../docs/product/convergencia-conversacional.md),
 * y no es una clase más: es lo que convierte este canal en **el historial**. Sin
 * ella hay dos listas —lo que dijo el cuidador de un lado, lo que salió del
 * agente del otro— y la app tenía la suya, con un `{de:'vos'|'ella'}` propio.
 * Dos listas son dos órdenes posibles, dos identidades y dos guardados.
 *
 * Y la separación que el documento pide se conserva **por la clase, no por la
 * lista**: `progreso` explica algo verificable y **no se guarda como si el
 * personaje lo hubiera dicho**. Quien pinta usa `quienDijo`; quien mide obediencia
 * no mira acá en absoluto.
 *
 * ─── EL TURNO, y por qué no alcanza con la posición en el array ─────────────
 *
 * Porque el array se recorta por arriba (ver `CUANTOS`) y se guarda y se
 * restaura. La posición cambia; el turno no. Es lo que permite afirmar «orden e
 * identidad» después de una recarga sin comparar textos, y lo que hace que
 * restaurar dos veces no duplique una línea.
 */

export type ClaseDeDicho = 'entrada' | 'acuse' | 'aviso' | 'progreso' | 'listo'

export interface Dicho {
  /**
   * SU IDENTIDAD. Empieza en 1, no se repite y sólo crece, también entre
   * sesiones: un canal que carga un log restaurado sigue por donde iba.
   */
  readonly turno: number
  /** El tick del mundo en el que se dijo. `-1` si se dijo fuera de la partida. */
  readonly tick: number
  readonly clase: ClaseDeDicho
  readonly texto: string
  /**
   * EL CUERPO DEL QUE HABLA ESTA LÍNEA, si habla de uno.
   *
   * Un id y nada más, por lo mismo que `MemoriaDeLaCharla` guarda ids: el nombre
   * de un cuerpo cambia al cocinarse y sus tags no lo distinguen. Es lo que hace
   * que «comé eso» tenga a qué apuntar en el turno siguiente —y, guardado,
   * también después de cerrar la pestaña.
   *
   * Es un `string` y no un `BodyId` importado a propósito: este módulo no importa
   * nada (ver el control de `el-canal-de-habla.test.ts`).
   */
  readonly sobre?: string
  /**
   * LA META QUE ESTE TURNO PIDIÓ, si pidió alguna. Sólo en las `entrada`.
   *
   * Es la firma de predicado que la lectura sacó de la frase —`emitsPower>0`—, y
   * está guardada por lo que el C2 necesita: **«hacé lo que te pedí» tiene que
   * poder recuperar el pedido después de una recarga**, y volver a leer la frase
   * vieja para sacarla otra vez sería pedirle a `leer()` que corra sobre un mundo
   * que ya no es el de entonces.
   *
   * Su ausencia también dice algo, y es la mitad epistemológica del asunto: una
   * `entrada` SIN meta es algo que el cuidador dijo y que no se convirtió en un
   * pedido. Ahí viven las afirmaciones y las enseñanzas, que **nunca se promueven
   * a hecho del mundo** (ver `recuerdos.ts`).
   *
   * `string` y no una firma tipada, por lo mismo que `sobre`: acá no hay imports.
   */
  readonly meta?: string
  /**
   * CUÁNTO SE ENTENDIÓ, en `[0, 1]`. Es `Lectura.confianza`, tal cual.
   *
   * Va guardada porque un recuerdo sin confianza no se puede pesar contra otro, y
   * el documento de convergencia la pide junto con la procedencia. No se deriva de
   * la clase: dos pedidos entendidos distinto no valen lo mismo.
   */
  readonly confianza?: number
}

/**
 * LO QUE SE SABE DE UNA LÍNEA CUANDO SE LA ESCRIBE, aparte del texto.
 *
 * Un objeto y no tres parámetros posicionales: son todos opcionales y ninguno se
 * usa en la mayoría de las llamadas, así que posicionales obligarían a escribir
 * `decir(t, 'listo', 'listo', undefined, undefined, 0.9)`.
 */
export interface LoQueSeSabe {
  readonly sobre?: string
  readonly meta?: string
  readonly confianza?: number
}

/**
 * QUIÉN DIJO UNA LÍNEA. Se deriva de la clase en vez de guardarse al lado.
 *
 * Guardar un `de: 'vos' | 'ella'` sería un segundo campo que puede contradecir al
 * primero, y ya pasó: la app tenía un `{de}` sin clase, así que el progreso se
 * guardaba como habla del personaje sin que nada se pusiera rojo.
 */
export function quienDijo(clase: ClaseDeDicho): 'vos' | 'ella' {
  return clase === 'entrada' ? 'vos' : 'ella'
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
 * CUÁNTOS TURNOS SON «LA VENTANA RECIENTE».
 *
 * Ocho, que es lo que el documento de convergencia llama la primera de sus tres
 * capas: *«los últimos turnos necesarios para resolver elipsis, referencias y
 * correcciones inmediatas»*. No es la memoria de la charla —eso son dos ids— ni
 * el retrieval, que es C2: es cuánto se mira hacia atrás para armarla.
 *
 * Ocho y no cien porque el historial durable **no se copia entero a cada
 * prompt**, que es la otra mitad de la misma frase del documento.
 */
export const VENTANA_RECIENTE = 8

/**
 * EL LOG DE LA CONVERSACIÓN, en orden. Un solo canal para las cinco clases.
 *
 * Mutable y encerrado, como `EncargoEnCurso` y por lo mismo: es un registro que
 * crece, y uno inmutable que devuelve una copia por línea convierte una charla
 * en una copia por línea.
 */
export class CanalDeHabla {
  readonly #dichos: Dicho[] = []
  /** El último turno REPARTIDO, que no es el último que quedó en la lista. */
  #ultimoTurno = 0

  decir(tick: number, clase: ClaseDeDicho, texto: string, mas: LoQueSeSabe = {}): void {
    if (texto.length === 0) return
    this.#ultimoTurno++
    this.#dichos.push({
      turno: this.#ultimoTurno,
      tick,
      clase,
      texto,
      // Uno por uno y no un spread de `mas`: así una propiedad de más que
      // alguien agregue al objeto no entra al log sin pasar por acá, que es
      // donde está escrito qué se guarda.
      ...(mas.sobre === undefined ? {} : { sobre: mas.sobre }),
      ...(mas.meta === undefined ? {} : { meta: mas.meta }),
      ...(mas.confianza === undefined ? {} : { confianza: mas.confianza }),
    })
    if (this.#dichos.length > CUANTOS) this.#dichos.shift()
  }

  /**
   * LO GUARDADO, DE VUELTA — y restaurar dos veces no duplica una línea.
   *
   * Los turnos ya repartidos se saltean, y lo que entra se ordena por turno. Las
   * dos cosas son la misma decisión: **el orden y la identidad son del dato**, no
   * de en qué orden alguien llamó a esta función. Sin eso, «una salida no aparece
   * dos veces» dependería de que nadie cargue dos veces, que es una promesa sobre
   * el llamador y no sobre el canal.
   */
  cargar(dichos: readonly Dicho[]): void {
    const vistos = new Set(this.#dichos.map((d) => d.turno))
    for (const d of dichos) {
      if (d.texto.length === 0 || vistos.has(d.turno)) continue
      vistos.add(d.turno)
      this.#dichos.push(d)
      if (d.turno > this.#ultimoTurno) this.#ultimoTurno = d.turno
    }
    this.#dichos.sort((a, b) => a.turno - b.turno)
    while (this.#dichos.length > CUANTOS) this.#dichos.shift()
  }

  /** Todo lo dicho, del más viejo al más nuevo. Es lo que se guarda. */
  get todo(): readonly Dicho[] {
    return [...this.#dichos]
  }

  /** Lo dicho desde un tick, para que una UI pinte sólo lo nuevo. */
  desde(tick: number): readonly Dicho[] {
    return this.#dichos.filter((d) => d.tick >= tick)
  }

  /** Los últimos turnos: la ventana reciente que va a cada lectura. */
  ventana(cuantos: number = VENTANA_RECIENTE): readonly Dicho[] {
    return this.#dichos.slice(cuantos >= this.#dichos.length ? 0 : this.#dichos.length - cuantos)
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
