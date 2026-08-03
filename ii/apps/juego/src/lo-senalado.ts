// ─── QUÉ HAY EN UNA CELDA, Y DÓNDE PONER EL CARTEL ──────────────────────────
//
// Hasta acá, «qué hay ahí» vivía adentro del `click` del canvas en `main.ts`:
// cuatro filtros, un `sort` y cuatro nodos escritos, todo en la misma función.
// Mientras el único que preguntaba era el click daba igual; con el mouse
// preguntando lo mismo al pasar por arriba, dejar la cuenta ahí adentro sería
// tener **dos verdades sobre qué estás señalando** — y la primera vez que
// divergen, el cartel dice una cosa y el panel dice otra sobre la misma celda.
//
// Así que la decisión está acá y del otro lado quedan nodos que se escriben. Es
// la misma regla que `con-quien.ts` y `criatura.ts` tienen en su encabezado: lo
// que decide se prueba sin navegador, lo que pinta no.
//
// ─── LAS DOS COSAS QUE ESTE ARCHIVO CONTESTA ───────────────────────────────
//
//   1. **qué hay en la celda (x, y)**, ya resuelto a las cuatro frases que se
//      leen: qué es, de qué, cuántas piezas, en qué estado;
//   2. **dónde va el cartel** para que no se salga de la ventana. Es aritmética
//      de dos líneas y por eso mismo conviene que esté probada: el caso que
//      falla es el del borde derecho, que en pantalla se ve una vez cada diez
//      hover y en un test se ve siempre.

import { sueloDe } from '@anima/dibujo'
import { nombreDeLoVisible } from '@anima/physics'
import type { Physics } from '@anima/physics'
import type { BodyId, CeldaEnEscena, Escena, RenderDescriptor } from '@anima/world'

/**
 * EL MÁS GRANDE MANDA. El dios siembra hasta trece cuerpos en una misma celda y
 * el mapa dibuja el de más porte encima, así que ése es el que la persona creyó
 * estar tocando. Ordenar por otra cosa haría que el cartel nombre algo que está
 * tapado.
 */
const ORDEN_DE_PORTE = { menudo: 0, chico: 1, mediano: 2, grande: 3 }

/** Lo que hay en una celda, resuelto a lo que se lee. */
export interface Senalado {
  readonly id: BodyId
  /** El descriptor crudo, que es lo que `glifoDe` necesita para el dibujito. */
  readonly d: RenderDescriptor
  /**
   * CÓMO SE LLAMA: `tubérculo crudo`, `madera con liana`. La línea gruesa.
   *
   * ─── ACÁ DECÍA «bloque», Y ERA LA FORMA ────────────────────────────────
   *
   * El título salía de `d.forma`, que es la geometría del catálogo cerrado
   * —vara, hebra, filete, malla, bloque, grano— y no el nombre de nada: un
   * tubérculo y una piedra son los dos «bloque». El nombre lo arma el mundo con
   * `nombreDeLoVisible`, que es la misma función que usa el registro de la
   * charla, así que el cartel y «agarró tubérculo crudo» dicen igual.
   *
   * Lleva `(la criatura)` o `(y N más acá)` pegado cuando corresponde.
   */
  readonly titulo: string
  /**
   * DE QUÉ MÁS ESTÁ HECHO, y casi siempre está vacío a propósito.
   *
   * El nombre ya dice hasta dos sustancias —«liana», «madera con liana»— así que
   * repetirlas acá es leer lo mismo dos veces: el cartel decía «liana · liana ·
   * 1 parte». Con tres o más, el nombre deja alguna afuera y ahí esta línea
   * empieza a decir algo que no se sabía.
   */
  readonly de: string
  /** `2 partes, 1 atada` */
  readonly piezas: string
  /**
   * CÓMO ES: `bloque · chico`, la forma y el porte.
   *
   * La banda de estado ya no está acá y no se perdió: se mudó al nombre, que es
   * de donde nunca tendría que haber salido —«tubérculo crudo» es una cosa, no
   * un tubérculo que además está crudo—. Repetirla en las dos líneas era leer lo
   * mismo dos veces.
   */
  readonly comoEs: string
  /** Cuántos más hay debajo en la misma celda. */
  readonly mas: number
  readonly esAgente: boolean
}

/**
 * QUÉ HAY EN `at`, o nada.
 *
 * Lo que está en una mano NO cuenta, y no es un detalle de implementación: el
 * mapa no lo dibuja en el suelo (decisión 1 de `mapa.ts`, y está bien — pintarlo
 * ahí diría que está tirado), así que señalarlo sería nombrar algo que no se ve.
 */
export function loSenaladoEn(
  e: Escena,
  at: { x: number; y: number },
  phys: Physics,
): Senalado | undefined {
  const ahi = [...e.cuerpos.entries()].filter(
    ([, c]) => c.heldBy === undefined && c.d.at.x === at.x && c.d.at.y === at.y,
  )
  ahi.sort(([, a], [, b]) => ORDEN_DE_PORTE[b.d.porte] - ORDEN_DE_PORTE[a.d.porte])
  const primero = ahi[0]
  if (primero === undefined) return undefined

  const [id, c] = primero
  return describir(id, c.d, phys, {
    mas: ahi.length - 1,
    esAgente: e.actores.some((a) => a.body === id),
  })
}

/**
 * UN CUERPO, EN LAS CUATRO FRASES. Aparte de `loSenaladoEn` porque hay un lugar
 * que tiene el cuerpo pero no la celda: **lo que la criatura lleva en la mano**.
 * El mapa no lo dibuja en el suelo, o sea que no está en ninguna celda, y aun así
 * se ve —en el inventario— y se le puede pasar el mouse por arriba. Con esto,
 * las dos vistas dicen exactamente lo mismo del mismo objeto.
 */
export function describir(
  id: BodyId,
  d: RenderDescriptor,
  phys: Physics,
  extra: { readonly mas: number; readonly esAgente: boolean },
): Senalado {
  const nombre = nombreDe(d, phys)
  return {
    id,
    d,
    titulo:
      (extra.esAgente ? `${nombre} (la criatura)` : nombre) +
      (extra.mas > 0 ? ` (y ${String(extra.mas)} más acá)` : ''),
    de: d.materiales.length > 2 ? d.materiales.join(' · ') : '',
    piezas:
      `${String(d.partes)} ${d.partes === 1 ? 'parte' : 'partes'}` +
      (d.juntas > 0 ? `, ${String(d.juntas)} atada${d.juntas === 1 ? '' : 's'}` : ''),
    comoEs: `${d.forma} · ${d.porte}`,
    mas: extra.mas,
    esAgente: extra.esAgente,
  }
}

/**
 * EL NOMBRE, DESDE EL DESCRIPTOR. Las cuatro cosas que `nombreDeLoVisible` pide
 * están todas publicadas; la única que hay que reconstruir es la acompañante.
 *
 * ─── Y ACÁ HAY UNA DIFERENCIA CHICA QUE CONVIENE DEJAR ESCRITA ─────────────
 *
 * `nameOf` elige como acompañante la sustancia de MÁS MASA después del núcleo,
 * porque tiene el cuerpo y puede pesarlo. El descriptor publica `materiales`
 * ordenado alfabéticamente y sin masas (a propósito: dos obras con las mismas
 * piezas atadas en distinto orden se dibujan igual). Con dos sustancias las dos
 * reglas eligen la misma —no hay otra— y ése es el caso de todo lo que el mundo
 * arma hoy: una caña es madera con liana. Con tres o más podrían diferir en cuál
 * se menciona, nunca en el núcleo, que sí viaja.
 */
function nombreDe(d: RenderDescriptor, phys: Physics): string {
  const acompana = d.materiales.find((m) => m !== d.nucleo)
  return nombreDeLoVisible(
    {
      nucleo: d.nucleo,
      ...(acompana === undefined ? {} : { acompana }),
      banda: d.estado,
      podrido: d.podrido === true,
    },
    phys,
  )
}

/**
 * LA FIRMA DE LO SEÑALADO: cambia cuando cambia algo que se lee.
 *
 * El cartel se refresca en cada cuadro mientras el mouse esté encima —el mundo
 * puede correr abajo del puntero y la vara puede empezar a arder— pero reescribir
 * el DOM sesenta veces por segundo para dejar el mismo texto arruina la selección
 * y tira un layout por cuadro. Con esto, se reescribe cuando cambió.
 *
 * Va el id adentro porque dos cuerpos distintos pueden leerse idénticos —dos
 * varas de madera crudas en la misma celda— y el dibujito se rearma por id.
 */
export function firmaDe(s: Senalado | undefined): string {
  if (s === undefined) return ''
  return `${s.id}|${s.titulo}|${s.de}|${s.piezas}|${s.comoEs}`
}

export interface Caja {
  readonly ancho: number
  readonly alto: number
}

export interface Punto {
  readonly x: number
  readonly y: number
}

// ─── EL PIE DEL GLOBO: LO QUE LA CELDA DICE Y EL CUERPO NO ──────────────────
//
// El globo del click tiene un renglón abajo de todo, separado por una línea, y
// contesta una pregunta que el cuerpo señalado no puede contestar: **qué más hay
// en esta casilla**. Son dos casos y nunca los dos a la vez.
//
// Con algo encima, lo que falta saber es cuántos quedan debajo — el dios siembra
// hasta trece cuerpos en una celda y el mapa dibuja uno.
//
// Y con la celda vacía, lo que queda para decir es EL SUELO. Ahí está lo que
// hace que este renglón valga la pena y no sea relleno: una celda vacía no es
// nada, es un lugar donde una chispa prende o donde se apaga, y eso decide dónde
// se enciende un fuego. Es la única parte del mapa que hoy se ve como color y no
// se puede leer.
//
// ─── LAS TRES FRASES SALEN DE UNA LEY, NO DE UN ADJETIVO ────────────────────
//
// Cada implicación es el criterio de la ley que produce ese suelo, dicho en
// castellano. Ninguna es una impresión:
//
//   seco        `wet < 0.45`, que es `HUMEDAD_QUE_APAGA` de la ley 3, o sea que
//               el suelo se ve seco exactamente donde un fuego NO se apaga;
//   mojado      el mismo corte del otro lado;
//   bajo techo  `sheltered > 0`, la oclusión de la ley 12 (ADR II-0002), que es
//               lo que la mente lee para dejar de necesitar refugio
//               (`necesidades.ts` multiplica por `1 − sheltered`).
//
// `sueloDe` es la MISMA función con la que `@anima/dibujo` pinta la celda, así
// que el renglón no puede decir «seco» sobre un suelo pintado de mojado. Un
// umbral propio acá sería la segunda verdad sobre el mismo suelo.
const LO_QUE_IMPLICA = {
  seco: 'suelo seco: acá una chispa prende',
  mojado: 'suelo mojado: acá un fuego se apaga',
  'bajo-techo': 'bajo techo: acá deja de necesitar refugio',
} as const

/**
 * EL RENGLÓN DE ABAJO DEL GLOBO. Vacío cuando no hay nada que agregar, que es el
 * caso de una celda con UN solo cuerpo: ahí el globo ya lo dijo todo.
 *
 * `celda` puede faltar y no es un borde defensivo: el encuadre publica las celdas
 * que entran en el radio, y se puede clickear el sobrante de media celda que
 * queda al borde del canvas. Sin cuerpo y sin celda no hay nada que decir.
 */
export function piePara(s: Senalado | undefined, celda: CeldaEnEscena | undefined): string {
  if (s !== undefined) {
    if (s.mas === 0) return ''
    return s.mas === 1 ? 'hay uno más debajo, en esta casilla' : `hay ${String(s.mas)} más debajo, en esta casilla`
  }
  return celda === undefined ? '' : LO_QUE_IMPLICA[sueloDe(celda)]
}

/** La celda del encuadre en `at`, o nada si el click cayó afuera. */
export function celdaEnEscena(e: Escena, at: Punto): CeldaEnEscena | undefined {
  return e.celdas.find((c) => c.at.x === at.x && c.at.y === at.y)
}

/** Cuánto se aparta el cartel del puntero, para no quedar abajo del cursor. */
const APARTE = 16
/** Y cuánto respeta los bordes de la ventana. */
const ORILLA = 6

/**
 * DÓNDE VA EL CARTEL, en coordenadas de ventana (`position: fixed`).
 *
 * Abajo y a la derecha del puntero, que es donde el ojo ya está mirando. Y se da
 * vuelta cuando no entra: contra el borde derecho de la pantalla, un cartel que
 * se pega al borde tapa justamente la celda que estás señalando, y uno que
 * desborda se lleva la barra de scroll horizontal de toda la página.
 *
 * El `max` final no es defensivo por las dudas: en una ventana más angosta que
 * el cartel, las dos ramas dan negativo y el texto se corta por la izquierda.
 */
/** Cuánto se aparta el globo de su ancla, abajo y a la derecha. */
const APARTE_DEL_ANCLA = 14
/** Y cuánto respeta los bordes de la pantalla. Es el `8` del diseño. */
const ORILLA_DEL_GLOBO = 8

/**
 * DÓNDE VA EL GLOBO DEL CLICK, y por qué NO es la misma cuenta que el cartel.
 *
 * Las dos ponen una caja cerca de un punto sin que se salga, y ahí se termina el
 * parecido. El cartel del mouse **se da vuelta** cuando no entra: se pasa al otro
 * lado del puntero, porque el puntero se está moviendo y taparle la celda de
 * abajo sería taparle justo lo que está mirando. El globo **se acota**: se queda
 * abajo y a la derecha del ancla y se frena contra el borde, porque el ancla es
 * un lugar elegido y ya está marcada con su círculo — moverlo al otro lado
 * rompería la relación «esto habla de aquello» que el ancla acaba de establecer.
 *
 * ─── LO RESERVADO NO ES UN MARGEN: SON LAS OTRAS CAPAS ─────────────────────
 *
 * `reservado.derecha` es lo que ocupa la charla y `reservado.abajo` lo que ocupa
 * el dock. No alcanza con no salirse de la ventana: un globo que quede DEBAJO del
 * dock o DETRÁS de la charla está tan perdido como uno que se fue de la pantalla,
 * y peor, porque el ancla sigue marcando su celda y no se ve nada al lado.
 *
 * Los dos números se miden y no se suponen —el dock crece cuando la fila de
 * chips se envuelve— así que entran por parámetro en vez de vivir acá.
 */
export function ubicarElGlobo(
  ancla: Punto,
  globo: Caja,
  ventana: Caja,
  reservado: { readonly derecha: number; readonly abajo: number },
): { left: number; top: number } {
  const tope = (borde: number, reserva: number, lado: number): number =>
    borde - reserva - lado - ORILLA_DEL_GLOBO
  // El `max` va afuera del `min` y no al revés: en una ventana más chica que el
  // globo el tope da negativo, y con el orden invertido el globo se iría por la
  // izquierda en vez de pegarse a la orilla. Es la misma guarda que el cartel.
  const acotar = (v: number, t: number): number => Math.max(ORILLA_DEL_GLOBO, Math.min(v, t))
  return {
    left: acotar(ancla.x + APARTE_DEL_ANCLA, tope(ventana.ancho, reservado.derecha, globo.ancho)),
    top: acotar(ancla.y + APARTE_DEL_ANCLA, tope(ventana.alto, reservado.abajo, globo.alto)),
  }
}

export function ubicarElCartel(raton: Punto, cartel: Caja, ventana: Caja): { left: number; top: number } {
  const derecha = raton.x + APARTE
  const abajo = raton.y + APARTE
  const left = derecha + cartel.ancho + ORILLA > ventana.ancho ? raton.x - APARTE - cartel.ancho : derecha
  const top = abajo + cartel.alto + ORILLA > ventana.alto ? raton.y - APARTE - cartel.alto : abajo
  return { left: Math.max(ORILLA, left), top: Math.max(ORILLA, top) }
}
