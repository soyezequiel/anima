// ─── LO QUE SE ROMPIÓ, GUARDADO ANTES DE QUE HAGA FALTA ─────────────────────
//
// El reporte de la partida existe para que alguien pueda debuggear lo que pasó
// SIN haber estado mirando. Y lo primero que hace falta para eso —los errores—
// es justamente lo único que no se puede juntar en el momento de pedir el
// reporte: cuando el jugador aprieta el botón, el error ya pasó hace tres
// minutos y la consola del navegador no es una fuente a la que este código
// pueda entrar. `console.error` escribe; no hay `console.leer()`.
//
// Así que se captura DESDE EL ARRANQUE y se guarda. El costo es un buffer de
// doscientas entradas y dos oyentes; el beneficio es que el reporte de una
// pestaña que se rompió a los diez minutos tenga el error de los diez minutos.
//
// ─── LAS CUATRO PUERTAS POR LAS QUE ENTRA UNA ROTURA ────────────────────────
//
//   `error`                una excepción que nadie agarró. La más ruidosa.
//   `unhandledrejection`   una promesa rechazada sin `catch`. La más silenciosa,
//                          y la que más importa acá: el guardado, el surtidor y
//                          el enlace con el modelo son todos asíncronos, así que
//                          cuando algo de eso se cae, se cae por acá.
//   `console.error`        lo que el juego decide contar como falla. `main.ts`
//                          ya escribe cuatro de estas —guardado que no se pudo
//                          leer, escribir o borrar— y sin envolver la consola
//                          serían invisibles para el reporte.
//   `console.warn`         lo mismo un escalón más abajo. Entra porque el
//                          arranque avisa por acá cuando la partida guardada no
//                          se pudo leer, que es exactamente la clase de cosa que
//                          explica un mundo en un estado raro.
//
// ─── POR QUÉ SE ENVUELVE LA CONSOLA Y NO SE CAMBIA EL CÓDIGO QUE LLAMA ──────
//
// Porque lo que se quiere pescar es lo que TODAVÍA no está escrito. Reemplazar
// los `console.error` que ya existen por una función propia captura los cuatro
// de hoy y ninguno de los que alguien agregue el mes que viene — y el que
// importa siempre es ese. La envoltura llama al original SIEMPRE: la consola del
// navegador tiene que seguir mostrando todo, porque quien está mirando en vivo
// mira ahí y no acá.
//
// ─── EL TOPE ES DURO Y TIRA LO VIEJO ────────────────────────────────────────
//
// Un bucle roto que escribe un error por cuadro llena la memoria en un minuto, y
// un reporte que no se puede generar porque la pestaña se quedó sin memoria es
// peor que no tener reporte. Se tiran las viejas y no las nuevas: cuando algo se
// rompe en cadena, la primera rotura explica y las siguientes son consecuencia
// —pero cuando el buffer se llenó fue porque hubo MILES, y ahí las últimas al
// menos dicen en qué quedó. La cuenta de las que se tiraron va en el reporte,
// porque «200 roturas» y «200 de 40.000 roturas» son dos mundos distintos.

/** Una rotura, tal como va al reporte. */
export interface Rotura {
  /**
   * EL TICK DEL MUNDO en que pasó, o `undefined` si todavía no había mundo.
   *
   * Es el número que sirve: el reloj de pared dice a qué hora fue y el tick dice
   * DÓNDE de la partida, que es lo único que se puede ir a buscar al guardado.
   * Los errores del arranque no lo tienen y por eso es opcional — decir «tick 0»
   * cuando el mundo no existía sería inventar una coincidencia con el primer
   * tick real.
   */
  readonly tick: number | undefined
  /** Cuántos milisegundos de reloj de pared desde que abrió la página. */
  readonly desdeQueAbrio: number
  /** Por cuál de las cuatro puertas entró. */
  readonly de: 'excepción' | 'promesa' | 'console.error' | 'console.warn'
  readonly texto: string
  readonly stack: string | undefined
}

/** Lo que el vigía juntó. */
export interface LoJuntado {
  readonly roturas: readonly Rotura[]
  /** Cuántas se tiraron por el tope. Cero es cero de verdad. */
  readonly tiradas: number
}

const TOPE = 200

// ─── Las dos superficies que el vigía toca, escritas mínimas ────────────────
//
// Se declaran acá en vez de usar `Window` y `Console` de lib.dom, y no es purismo:
// con los tipos del navegador, este archivo sólo se puede probar levantando un
// navegador entero para verificar un buffer de doscientas entradas. Con la
// superficie mínima, el test le pasa dos objetos de cuatro líneas —y `window` y
// `console` de verdad las cumplen igual, porque tienen de más y no de menos.

/** El evento de `error` de la ventana, con lo único que se le mira. */
export interface RoturaDeVentana {
  readonly message: string
  readonly filename: string
  readonly lineno: number
  readonly colno: number
  readonly error: unknown
}

/** El evento de `unhandledrejection`, con lo único que se le mira. */
export interface PromesaRechazada {
  readonly reason: unknown
}

export interface DondeEscuchar {
  addEventListener(tipo: 'error', f: (ev: RoturaDeVentana) => void): void
  addEventListener(tipo: 'unhandledrejection', f: (ev: PromesaRechazada) => void): void
}

export interface ConsolaMinima {
  error(...args: unknown[]): void
  warn(...args: unknown[]): void
}

/**
 * Un valor cualquiera, escrito para que se pueda leer en un archivo de texto.
 *
 * `String(e)` sobre un `Error` da «Error: no se pudo escribir», que es lo que se
 * quiere; sobre un objeto pelado da «[object Object]», que no dice nada. Por eso
 * el objeto pasa por `JSON.stringify` — y ese también puede lanzar, con un ciclo
 * o con un `bigint`, así que va con red. Una rotura que no se puede escribir
 * igual tiene que aparecer en el reporte: que diga poco es infinitamente mejor
 * que no estar.
 */
function comoTexto(v: unknown): string {
  if (typeof v === 'string') return v
  if (v instanceof Error) return `${v.name}: ${v.message}`
  if (typeof v === 'object' && v !== null) {
    try {
      return JSON.stringify(v)
    } catch {
      return Object.prototype.toString.call(v)
    }
  }
  return String(v)
}

function stackDe(v: unknown): string | undefined {
  return v instanceof Error && typeof v.stack === 'string' ? v.stack : undefined
}

/**
 * EL VIGÍA. Se instala una vez, al principio de todo, y no se apaga.
 *
 * `mirarElTick` se pasa por función y no por número porque el vigía se instala
 * ANTES de que exista la partida —ése es el punto: pescar lo que se rompe al
 * cargar el guardado— y después el mundo aparece. Una función que devuelve
 * `undefined` hasta que hay mundo dice la verdad en los dos momentos.
 */
export class Vigia {
  readonly #roturas: Rotura[] = []
  #tiradas = 0
  #mirarElTick: () => number | undefined = () => undefined
  #instalado = false
  readonly #abrio: number

  constructor(abrio: number) {
    this.#abrio = abrio
  }

  /** Desde acá en adelante, las roturas saben en qué tick pasaron. */
  seguirElTick(f: () => number | undefined): void {
    this.#mirarElTick = f
  }

  anotar(de: Rotura['de'], texto: string, stack?: string, ahora = performance.now()): void {
    if (this.#roturas.length >= TOPE) {
      this.#roturas.shift()
      this.#tiradas++
    }
    this.#roturas.push({
      tick: this.#mirarElTick(),
      desdeQueAbrio: Math.round(ahora - this.#abrio),
      de,
      texto,
      ...(stack === undefined ? { stack: undefined } : { stack }),
    })
  }

  get juntado(): LoJuntado {
    return { roturas: [...this.#roturas], tiradas: this.#tiradas }
  }

  /**
   * Engancha las cuatro puertas. Idempotente: llamarla dos veces no envuelve la
   * consola dos veces, que dejaría cada `console.error` anotado por duplicado.
   */
  instalar(ventana: DondeEscuchar, consola: ConsolaMinima): void {
    if (this.#instalado) return
    this.#instalado = true

    ventana.addEventListener('error', (ev: RoturaDeVentana) => {
      // El `message` del evento y no el del error: cuando lo que falla es cargar
      // un recurso —un script, una imagen— no hay `error` ninguno y el mensaje
      // del evento es todo lo que existe.
      const texto =
        ev.error instanceof Error
          ? comoTexto(ev.error)
          : `${ev.message} (${ev.filename}:${String(ev.lineno)}:${String(ev.colno)})`
      this.anotar('excepción', texto, stackDe(ev.error))
    })

    ventana.addEventListener('unhandledrejection', (ev: PromesaRechazada) => {
      this.anotar('promesa', comoTexto(ev.reason), stackDe(ev.reason))
    })

    for (const cual of ['error', 'warn'] as const) {
      const original: (...args: unknown[]) => void = consola[cual].bind(consola)
      consola[cual] = (...args: unknown[]): void => {
        // El original PRIMERO: si anotar llegara a lanzar, la consola ya mostró
        // el error de verdad y no queda tapado por un bug de este archivo.
        original(...args)
        // El stack sale del primer argumento que sea un `Error`, que es la forma
        // en que todo este código escribe: `console.error('[x] no anduvo:', e)`.
        const conStack = args.find((a) => a instanceof Error)
        this.anotar(`console.${cual}`, args.map(comoTexto).join(' '), stackDe(conStack))
      }
    }
  }
}
