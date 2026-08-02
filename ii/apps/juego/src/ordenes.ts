// ─── HABLARLE A LA CRIATURA, DESDE EL JUEGO ─────────────────────────────────
//
// Los puntos 4, 5 y 6 de la vertical del Hito 12B: escribir una orden, recibir
// acuse **inmediato**, y ver que algo pasa. `@anima/lang` está entero desde el
// Hito 6 y hasta hoy su único consumidor era un demo de terminal.
//
// ─── EL CAMINO, Y POR QUÉ LA MENTE SIGUE HACIENDO FALTA ────────────────────
//
// Uno esperaría que «traé un palo» se convierta en una intención y se la mande al
// mundo. No es así, y la razón es del diseño de Ánima II: una frase se convierte
// en una **meta** —una firma de predicado como `emitsPower>0`— y quien sabe
// convertir una meta en pasos es la escalera de la mente. El chat no reemplaza a
// la mente: **le pone el objetivo**.
//
//     frase → leer() → encargoDe() → drive de la Mente → habilidades → intents
//
// La consecuencia práctica es la que importa: ordenar desde el chat no es un
// atajo que evita la mente, es la mente trabajando para vos en vez de para sus
// propias necesidades.
//
// ─── LAS DOS COSAS QUE ESTE ARCHIVO NO INVENTA ─────────────────────────────
//
//   1. **el acuse sale de `leer()` y de ningún otro lado.** El criterio pide que
//      aparezca en el mismo cuadro que el mensaje, así que no puede esperar a que
//      nada se planifique. Acá se muestra tal cual viene;
//   2. **una frase con varias cláusulas se manda de a una.** No es una
//      simplificación de esta app: el único canal hacia la mente es
//      `MenteOptions.drive`, que lleva UNA firma. `EncargoEnCurso` es el cursor
//      que `@anima/lang` ya escribió para eso.

import type { Physics } from '@anima/physics'
import { Contexto } from '@anima/perceive'
import type { Partida } from '@anima/perceive'
import { Creencias, Mente } from '@anima/mind'
import { ESQUEMAS, cumple, interpretar } from '@anima/plan'
import { EncargoEnCurso, PUENTE, encargoDe, enPalabras, leer, lexicoDe } from '@anima/lang'
import type { Lexico } from '@anima/lang'

/** Una línea de la charla. `ella` es la criatura. */
export interface Dicho {
  readonly de: 'vos' | 'ella'
  readonly texto: string
}

/** Lo que se está persiguiendo ahora, para mostrarlo al lado del progreso. */
export interface EnCurso {
  readonly meta: string
  /**
   * DE QUIÉN ES LA META, y no es un adorno.
   *
   * Se descubrió escribiendo el test: con la mente conectada y sin ninguna orden,
   * la criatura ya persigue metas propias —camina, junta— porque el `drive` del
   * cuidador **compite** con sus necesidades en vez de reemplazarlas. Entonces
   * «hay una meta en curso» no distingue obedecer de vivir, y una pantalla que no
   * lo dijera haría creer al jugador que todo lo que ve es consecuencia de lo que
   * pidió.
   */
  readonly de: 'vos' | 'ella'
  readonly hechas: number
  readonly total: number
}

/**
 * UNA META EN CASTELLANO, con dos intentos y en este orden.
 *
 *   1. **el puente**, que mapea «fuego» ↔ `emitsPower>0`. Leído al revés da el
 *      nombre humano, sale gratis y da la palabra corta y linda. Es exacto;
 *   2. **armar la frase leyendo el predicado**, para todo lo demás.
 *
 * El segundo existe porque el panel llegó a mostrar esto tal cual:
 *
 *     holding(tag:carnoso,toxicity<0.0528) (suya)
 *
 * y no se arreglaba agregando una fila: **el `0,0528` lo calcula la criatura en
 * el momento** —es cuánto veneno le conviene tragar, y depende de lo vacío que
 * tenga el tanque— así que cambia a cada tick. Una tabla necesitaría una fila por
 * número posible. Hoy eso se lee «tener algo carnoso y poco venenoso».
 *
 * Si los dos fallan sale la firma cruda, y eso se deja a propósito: verla en
 * pantalla es la señal de que a esa meta le falta una palabra.
 */
export function enCastellano(firma: string): string {
  for (const a of PUENTE) {
    if (a.denota.k === 'meta' && a.denota.firma === firma) return a.dice[0] ?? firma
  }
  const p = interpretar(firma)
  return p === undefined ? firma : enPalabras(p)
}

const ESTABLECIBLES = new Set(ESQUEMAS.map((e) => e.establishes))

export class Ordenes {
  readonly #partida: Partida
  readonly #quien: string
  readonly #lexico: Lexico
  readonly #memoria: Creencias
  #mente: Mente
  readonly #mentes = new Map<string, Mente>()
  #encargo: EncargoEnCurso | undefined
  /** La última meta puesta, para no reconstruir la `Mente` en cada tick. */
  #ultimaPuesta: string | undefined
  readonly #registro: Dicho[] = []

  /**
   * `memoria` entra por parámetro para que una partida CARGADA vuelva con lo que
   * la criatura había aprendido. Sin esto, reabrir la pestaña restauraría el
   * mundo y le borraría la experiencia — y eso se ve como una criatura que
   * vuelve a fallar en algo que ya sabía hacer.
   */
  constructor(partida: Partida, quien: string, phys: Physics, memoria = new Creencias()) {
    this.#partida = partida
    this.#quien = quien
    this.#lexico = lexicoDe(phys, PUENTE)
    this.#memoria = memoria
    this.#mente = new Mente({ actor: quien, memoria: this.#memoria })
    this.#mentes.set(quien, this.#mente)
  }

  /** Lo que aprendió. Lo necesita quien guarda. */
  get memoria(): Creencias {
    return this.#memoria
  }

  get mentes(): ReadonlyMap<string, Mente> {
    return this.#mentes
  }

  get registro(): readonly Dicho[] {
    return this.#registro
  }

  get enCurso(): EnCurso | undefined {
    const e = this.#encargo
    const meta = this.#mente.estado.metaEnCurso ?? this.#ultimaPuesta
    if (meta === undefined) return undefined
    // Es tuya sólo si hay un encargo abierto Y la meta que la escalera persigue es
    // la que se le puso. Si la mente cambió a una suya —porque el hambre le ganó
    // al pedido— esto lo dice, en vez de seguir mostrando la orden vieja.
    const tuya = e !== undefined && this.#ultimaPuesta === meta
    return {
      meta: enCastellano(meta),
      de: tuya ? 'vos' : 'ella',
      hechas: e?.hechas ?? 0,
      total: tuya ? e.total : 1,
    }
  }

  /**
   * ¿EL MUNDO YA CUMPLE ESTA FIRMA? Contra la vista de AHORA y no contra una foto.
   *
   * Existe por una medición del Hito 6 que conviene no perder: «fabricá una
   * trampa» sale como `catch>0`, y un `Predicado` es EXISTENCIAL —dice «que haya
   * algo que atrape», no «que vos hagas uno»—. Con una caña a la vista la meta ya
   * está cumplida y la mente la descarta con razón; lo que estaba mal era que
   * desde afuera se veía igual que «no me hace caso».
   */
  #yaEstaCumplida = (firma: string): boolean => {
    const pr = interpretar(firma)
    if (pr === undefined) return false
    const v = new Contexto(this.#partida.proyeccion, {
      actor: this.#quien,
      rng: this.#partida.dado.tirar,
      lugares: this.#partida.lugares,
    }).ctx
    return cumple(pr, v)
  }

  /** Lo que se le dice. El acuse entra al registro en la misma llamada. */
  decir(texto: string): void {
    const dicho = texto.trim()
    if (dicho === '') return
    this.#registro.push({ de: 'vos', texto: dicho })

    const l = leer(dicho, {
      phys: this.#partida.state.phys,
      lexico: this.#lexico,
      sabeElCatalogo: (f) => ESTABLECIBLES.has(f),
      yaEstaCumplida: this.#yaEstaCumplida,
    })
    this.#registro.push({ de: 'ella', texto: l.acuse })

    const e = encargoDe(l)
    // Un encargo vacío NO se pisa sobre el anterior: si la frase no se pudo
    // convertir en nada, lo que la criatura estaba haciendo sigue. Borrarlo sería
    // castigar una frase mal entendida cancelando una orden que sí se entendió.
    if (e.metas.length === 0) return
    this.#encargo = new EncargoEnCurso(e)
    this.#ultimaPuesta = undefined
  }

  /**
   * SE LLAMA ANTES DE CADA TICK, y el orden importa: si la meta de ahora ya está
   * cumplida, la criatura tiene que arrancar la siguiente EN ESTE tick y no en el
   * que viene. Con el orden al revés se pierde un tick por cláusula.
   */
  antesDelTick(tick: number): void {
    const e = this.#encargo
    if (e === undefined) return
    const quiere = e.ahora(this.#yaEstaCumplida)
    if (quiere === undefined) {
      this.#registro.push({ de: 'ella', texto: 'listo' })
      this.#encargo = undefined
      return
    }
    // ─── LA GUARDA ES SÓLO CONTRA `#ultimaPuesta`, Y ANTES ERAN DOS ────────
    //
    // Decía `if (quiere === metaEnCurso || quiere === ultimaPuesta) return`, y esa
    // primera mitad tenía un agujero que el spec de Playwright encontró: **si la
    // mente YA perseguía esa meta por su cuenta**, la función salía antes de
    // registrar la orden, `#ultimaPuesta` quedaba en `undefined` y el panel
    // mostraba «fuego (suya)» para siempre — aunque vos acabaras de pedir fuego.
    //
    // Pasa seguido, no es un borde raro: pedirle a la criatura algo que ya estaba
    // por hacer es lo más normal del mundo. Y era invisible desde adentro, porque
    // la mente hacía exactamente lo correcto: lo que estaba mal era quién se
    // llevaba el crédito.
    //
    // Ahora la meta se registra siempre y la guarda sólo evita reconstruir la
    // `Mente` en cada tick, que es para lo único que estaba.
    if (quiere === this.#ultimaPuesta) return

    this.#ultimaPuesta = quiere
    if (e.total > 1) {
      this.#registro.push({
        de: 'ella',
        texto: `voy por «${enCastellano(quiere)}» (${String(e.hechas + 1)} de ${String(e.total)})`,
      })
    }
    // Una `Mente` nueva y no un setter: `drive` es de sólo lectura en
    // `MenteOptions`, y la memoria —lo que aprendió— se pasa entera, así que lo
    // único que se reinicia es la escalera. Es lo que hace el demo del Hito 6.
    this.#mente = new Mente({
      actor: this.#quien,
      memoria: this.#memoria,
      drive: { meta: quiere, peso: 1, desdeTick: tick },
    })
    this.#mentes.set(this.#quien, this.#mente)
  }
}
