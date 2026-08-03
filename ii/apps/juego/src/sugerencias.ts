// ─── LAS SUGERENCIAS NO SON ATAJOS: SON EL VOCABULARIO ──────────────────────
//
// Sin ellas hay que adivinar qué entiende, y adivinar es la carga más cara de
// todas: la caja de texto acepta cualquier cosa y no hay forma de saber cuál de
// todas las frases posibles va a llegar a algún lado. Cuatro palabras que sí
// funcionan enseñan la forma de pedir, y de ahí en adelante uno improvisa.
//
// De ahí sale la única regla que importa acá: **la lista se DERIVA del catálogo,
// no se escribe a mano**. Una lista a mano se desactualiza en silencio el día que
// `ESQUEMAS` gane una meta —queda enseñando un vocabulario más chico que el que
// la criatura entiende— y peor, puede quedar enseñando uno más grande, que es
// prometer algo que no se cumple.
//
// ─── EL FILTRO SON DOS TABLAS, Y CADA UNA APORTA LA MITAD ──────────────────
//
// `PUENTE_METAS` (de `@anima/lang`) dice qué PALABRAS nombran una meta —«fuego»,
// «trampa»— y `ESQUEMAS` (de `@anima/plan`) dice cuáles de esas metas el
// planificador sabe establecer. La intersección es exactamente «lo que la
// criatura entiende Y sabe hacer», que es lo que un chip promete al ofrecerse.
//
// Medido hoy: pasan SEIS. El handoff pedía cuatro y son un subconjunto elegido a
// mano; se muestran las seis porque la regla de arriba manda sobre el número, y
// porque los chips envuelven — dos filas no son un problema.
//
// ─── Y EL TEXTO NO LLEVA ARTÍCULO, QUE ES UNA MEDICIÓN ─────────────────────
//
// Pasando cada forma por `leer()`:
//
//     trampa            1,00      hacé trampa       1,00      armá trampa   1,00
//     armá una trampa   0,67      hacé una cuerda   0,67      hacé un fuego 0,67
//
// **El artículo cuesta un tercio de la confianza y el verbo no cuesta nada.** Un
// chip cuyo trabajo declarado es enseñar cómo pedir no puede enseñar la forma que
// el lector entiende peor, así que van sin artículo — y el handoff proponía
// «armá una trampa» y «hacé una cuerda», que son justamente las dos que caen.
//
// El VERBO es uno solo para todas, y eso es una decisión y no pereza: **no hay
// ningún dato que ate una meta a su verbo**. `PUENTE_VERBOS` tiene trece verbos y
// ninguno declara con qué metas va, así que elegir «buscá» para comida y «armá»
// para trampa sería una segunda tabla a mano — exactamente lo que la regla de
// arriba vino a evitar, con la desactualización silenciosa incluida.

import { PUENTE_METAS } from '@anima/lang'
import { ESQUEMAS } from '@anima/plan'

/**
 * EL VERBO ÚNICO. `hacer` y no otro porque es el que más alias tiene en el
 * puente —hace, fabricá, construí, armá, creá— o sea el que más formas de
 * escribirlo reconoce, y porque es el único que aplica a las seis metas sin
 * mentir sobre ninguna.
 */
const VERBO = 'hacé'

/**
 * LO QUE LA CRIATURA ENTIENDE Y SABE HACER, en frases listas para enviar.
 *
 * Se calcula al cargar el módulo porque las dos tablas son constantes del
 * catálogo core y no cambian dentro de una partida. El día que la fragua dé de
 * alta esquemas en vivo, esto pasa a ser una función y recibe el catálogo — que
 * es el mismo movimiento que el tramo A del Gate 5→6 le hizo a `plan()`.
 */
export function sugerencias(): readonly string[] {
  const establecibles = new Set(ESQUEMAS.map((e) => e.establishes))
  const frases: string[] = []
  for (const a of PUENTE_METAS) {
    if (a.denota.k !== 'meta') continue
    if (!establecibles.has(a.denota.firma)) continue
    // El PRIMER alias y no otro: la tabla los ordena a propósito y el primero es
    // el que se lee de vuelta cuando hay que decirle a una persona que entendió
    // (está escrito en `alias.ts`, arriba de «comida cocida»).
    const como = a.dice[0]
    if (como === undefined) continue
    frases.push(`${VERBO} ${como}`)
  }
  return frases
}
