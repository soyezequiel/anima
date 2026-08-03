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

import { nombreDeLoVisible } from '@anima/physics'
import type { Physics } from '@anima/physics'
import type { BodyId, Escena, RenderDescriptor } from '@anima/world'

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
  /** `madera · liana` */
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
    de: d.materiales.join(' · '),
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
export function ubicarElCartel(raton: Punto, cartel: Caja, ventana: Caja): { left: number; top: number } {
  const derecha = raton.x + APARTE
  const abajo = raton.y + APARTE
  const left = derecha + cartel.ancho + ORILLA > ventana.ancho ? raton.x - APARTE - cartel.ancho : derecha
  const top = abajo + cartel.alto + ORILLA > ventana.alto ? raton.y - APARTE - cartel.alto : abajo
  return { left: Math.max(ORILLA, left), top: Math.max(ORILLA, top) }
}
