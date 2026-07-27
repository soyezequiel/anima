// ─── @anima/oracle/pesca.ts ──────────────────────────────────────────────────
//
// LA LEY QUE FALTABA: `agua → Stock`.
//
// El Hito 3 dejó `Stock` (la contabilidad), `population` (la reposición
// integrada), `draw` (el acto) y `probabilidadDePicar` (la estimación), y no
// dejó **quién decide que en este pozo hay pescado**. `resolverAlPescar(agua,
// resolver)` le pedía el `resolver` al llamador, y ese resolver no existía en
// ningún `src/` del repo: los dos únicos usos estaban en tests, con un
// `() => stock({...})` escrito a mano. O sea que el río no tenía peces y nadie
// lo notaba porque nadie pescaba.
//
// Este archivo es ese resolvedor, y es una LEY y no una tabla por situación: una
// función pura de `(semilla, pozo)` que sale del bioma. Mismo patrón que
// `terrainFor` y `scatter` —el bioma decide QUÉ y CUÁNTO, el dado decide la
// textura— y por lo tanto misma garantía: preguntar hoy, dentro de mil ticks o
// dos veces seguidas da exactamente el mismo stock.
//
// ─── Por qué el pozo es del CHUNK y no del lago entero ──────────────────────
//
// El documento nombra el cuerpo de agua (la componente conexa del union-find de
// `compromiso.ts`) como la unidad del stock, y acá la unidad es el agua de UN
// chunk. Son tres razones y ninguna es de comodidad:
//
//   1. **el que paga es un chunk**. `Stock.cx/cy` existe porque el techo calórico
//      es por chunk, y `ley.ts` ya decidió que no se reparte: «la co-presencia de
//      comida es del lugar donde se pesca, no del promedio de un lago». Un stock
//      que cruza cuatro chunks le cobra a uno solo, y los otros tres quedan con
//      su techo entero sin que nadie pueda gastarlo. Con el pozo por chunk, el
//      pozo y el que paga son el mismo lugar y la cuenta cierra sola.
//   2. **la componente conexa no tiene cota**. El nivel de agua de un bioma
//      acuático tiene mediana 846 sobre 1000, o sea que un lago se extiende hasta
//      donde se corta el bioma: recorrerlo entero para nombrarlo puede costar 10⁵
//      celdas, y hay que hacerlo la primera vez que alguien mira el agua. Truncar
//      el recorrido no sirve: el conjunto truncado dependería de POR DÓNDE se
//      empezó, y con eso el id del cuerpo de agua —que es su celda canónicamente
//      menor— dejaría de ser el mismo para dos jugadores con la misma semilla.
//   3. **agotar un pozo tiene que poder empujar a caminar**. Con un stock por
//      lago, vaciar el pozo de acá vacía el de la otra punta y moverse no cambia
//      nada; con un pozo por chunk, la orilla de al lado todavía tiene.
//
// Lo que se pierde es real y hay que decirlo: dos chunks del mismo lago tienen
// poblaciones independientes, así que el lago rinde más que si fuera uno solo.
// Lo que impide que eso sea comida infinita NO es el stock sino el techo
// calórico, que sí es por chunk y sí está cobrado (ver `draw`). Está anotado
// como hueco abierto en `world/tests/hito-5-la-pesca.test.ts`.
//
// Determinismo: acá no hay `Math.random`, `Date`, `performance`, `Intl`,
// `localeCompare` ni `Math` trascendente.

import { fixedFromRaw, FIXED_SCALE, seg, type Fixed, type Physics, type SubstanceId } from '@anima/physics'

import { biomaPorClima } from './bioma.js'
import type { Bioma } from './bioma.js'
import { climaDe, crearStock, CAPACIDAD_MAXIMA, type Stock } from './ley.js'
import { diosElegir, diosEntero, rngFor, type Seed, type WaterBodyId } from './pregunta.js'

/**
 * El agua de un chunk vista como pozo: quién es, dónde y cuánta.
 *
 * `id` es la celda canónicamente menor del agua del chunk, escrita como la
 * escribe `waterCellKey` («x,y»). Es la misma regla de nombre que usa el
 * union-find de `compromiso.ts` para un cuerpo sin testigo, así que el día que el
 * pozo por chunk se reemplace por la componente conexa, los ids de los pozos de
 * una sola celda no se mueven.
 */
export interface Pozo {
  readonly id: WaterBodyId
  readonly cx: number
  readonly cy: number
  /** Cuántas celdas de agua franca tiene el chunk. Es el tamaño del pozo. */
  readonly celdas: number
}

/**
 * Cuántos individuos por celda de agua, en milésimas, con fertilidad 0.
 *
 * El 200 sale de una cuenta y no de un gusto: un chunk de `agua-dulce`
 * enteramente inundado son 256 celdas, o sea 51 piezas de arranque. Una pieza
 * media de `pescado` pesa 1,75 kg y rinde `8 × 1,75 × 0,38 = 5,32` calorías
 * crudas, así que el pozo lleno vale unas 271 calorías contra un techo de chunk
 * que va de 900 (fertilidad 0) a 3500 (fertilidad 1). O sea: **el pozo lleno no
 * agota el techo**, hacen falta entre tres y trece pozos llenos para eso, y la
 * reposición es lo que los va acercando. Si el pozo lleno ya pasara el techo, la
 * población sería decoración y el único límite sería el libro.
 */
export const PIEZAS_POR_CELDA_POR_MIL = 200

/**
 * Cuánto empuja la fertilidad, en milésimas del multiplicador. Con fertilidad 0
 * el pozo tiene la mitad, con fertilidad 1 tiene una vez y media. La ventana es
 * 3× de ancho, la misma clase de rango que `caloriasPorFertilidad` en la tabla.
 */
export const PISO_POR_FERTILIDAD = 500
export const RANGO_POR_FERTILIDAD = 1000

/**
 * Cuántos SEGUNDOS DE MUNDO tarda un pozo vacío en llenarse.
 *
 * 200 es un día entero de `@anima/world` (`LARGO_DEL_DIA`), y está escrito acá
 * como número y no importado a propósito: **el oráculo no depende del mundo**
 * (la flecha va del mundo al dios, ver `MundoConDado`). Que coincidan no es
 * casualidad y es la frase que se quiere: *un pozo exprimido se recupera en un
 * día*. Si alguien mueve el largo del día y no esto, lo que cambia es cuántos
 * días de pesca da una orilla, no si el mundo funciona.
 */
export const SEGUNDOS_PARA_LLENAR = 200

/** La masa de una pieza, en el crudo de `Fixed`: entre 0,5 y 3 kg. */
export const MASA_MINIMA_RAW = 500
export const MASA_MAXIMA_RAW = 3000

/**
 * Qué tan hondo está lo que se saca, derivado del nivel de agua del bioma.
 *
 * `probabilidadDePicar` castiga con `min(1, reach / depth)`, y `union` establece
 * `reach >= 2`: con esta cuenta la profundidad más grande del catálogo es la de
 * `agua-dulce` (1 + 0,620 = 1,62 m), o sea que **una caña siempre llega entera**
 * y la profundidad no le come nada al aparejo bien armado. Eso es a propósito:
 * el factor que tiene que decidir si pica es el `catch`, que es lo que distingue
 * un anzuelo de una caña pelada. La profundidad está para el día que alguien
 * pesque con la mano o invente un aparejo corto.
 */
function profundidadDe(b: Bioma): Fixed {
  return fixedFromRaw(FIXED_SCALE + b.nivelDeAguaPorMil)
}

/**
 * QUÉ VIVE EN ESTA AGUA: la primera decisión, y la que puede decir «nada».
 *
 * Sale de `bioma.sustancias` filtrado por el tag `carnoso` del catálogo de la
 * FÍSICA, y no de una lista de peces escrita acá. Es la misma disciplina que
 * `cumpleRol`: lo que hace comestible a algo es una propiedad de la materia, no
 * una fila en una tabla del dios. `agua-dulce` da `pescado` y `molusco`;
 * `pantano` da `molusco`; un charco en la `pradera` da **nada**, y eso es
 * correcto —un charco de lluvia no tiene peces— y es lo que devuelve `null`.
 *
 * El catálogo entra por parámetro y no por import por lo mismo que en
 * `decretarChunk`: cuando la ley 4 dé de alta una sustancia, esto la ve sin que
 * este archivo cambie.
 */
export function especiesDe(b: Bioma, phys: Physics): readonly SubstanceId[] {
  const out: SubstanceId[] = []
  for (const id of b.sustancias) {
    const s = phys.substances.get(id)
    if (s !== undefined && s.tags.includes('carnoso')) out.push(id)
  }
  return out
}

/**
 * EL STOCK DE UN POZO. Función pura de `(semilla, pozo, catálogo)`.
 *
 * `null` quiere decir «acá no vive nada extraíble», que es una respuesta y no una
 * falla: un charco en la pradera es agua y nada más. Devolver un stock de
 * capacidad cero en vez de `null` habría sido peor —`crearStock` lo acepta, y
 * después `probabilidadDePicar` divide por `s.capacity`— y además mentiría: no
 * es que el pozo esté vacío, es que nunca tuvo.
 *
 * El pozo nace LLENO (`amount === capacity`) y con la marca en el segundo cero.
 * Nacer a medias sería una historia que el pozo no tiene, y `population` no
 * repone hacia atrás: un pozo que naciera vacío en el segundo 0 y se mirara por
 * primera vez en el 4000 aparecería lleno igual, así que la única diferencia
 * sería para el que lo mira temprano.
 */
export function stockDeAgua(seed: Seed, pozo: Pozo, phys: Physics): Stock | null {
  if (!Number.isInteger(pozo.celdas) || pozo.celdas <= 0) return null
  const clima = climaDe(seed, pozo.cx, pozo.cy)
  const bioma = biomaPorClima(clima)
  const especies = especiesDe(bioma, phys)
  if (especies.length === 0) return null

  // El dado sale de la PREGUNTA por el cuerpo de agua, que es la que el ledger
  // ya sabe nombrar (`{k:'waterBody'}` tiene grano FINO). Dos pozos distintos del
  // mismo chunk sortean por separado, y el mismo pozo sortea igual siempre.
  const rng = rngFor({ k: 'waterBody', id: pozo.id }, seed)
  // Pesos 1: la elección es uniforme entre lo que el bioma tiene. No hay tabla de
  // «qué tan común es cada pez» porque no hace falta una: el bioma ya eligió el
  // repertorio, y `diosElegir` exige pesos enteros positivos.
  const yields = diosElegir(rng, especies.map((qué) => ({ peso: 1, qué })))
  const masaPorUnidad = fixedFromRaw(diosEntero(rng, MASA_MINIMA_RAW, MASA_MAXIMA_RAW))

  // UNA sola división, al final, la misma disciplina de `nivelDeAgua` y de
  // `relojDe`: el numerador entero más grande posible es
  // `256 · 200 · 1500 = 7,7 × 10⁷`, cómodamente exacto en un double, así que dos
  // motores dan el mismo bit porque no hay ni un real dando vueltas en el medio.
  const multiplicador =
    PISO_POR_FERTILIDAD + Math.floor((RANGO_POR_FERTILIDAD * clima.fertilidad) / FIXED_SCALE)
  const crudo = Math.floor(
    (pozo.celdas * PIEZAS_POR_CELDA_POR_MIL * multiplicador) / (FIXED_SCALE * FIXED_SCALE),
  )
  // Un pozo que existe tiene al menos una pieza. Sin este piso, un charco de una
  // celda tendría capacidad 0 y la garantía de resolubilidad estaría sembrando
  // un aparejo al lado de un agua que no puede dar nada — el fallo silencioso
  // que el Hito 3 existe para tapar, con otra ropa.
  const capacity = crudo < 1 ? 1 : crudo > CAPACIDAD_MAXIMA ? CAPACIDAD_MAXIMA : crudo
  // La tasa se deriva de la capacidad y no al revés: lo que se quiere fijar es el
  // TIEMPO de recuperación («un día»), no la velocidad. Con la velocidad fija, un
  // pozo grande tardaría diez días y uno chico un rato.
  const perMillePorSegundo = Math.ceil((capacity * FIXED_SCALE) / SEGUNDOS_PARA_LLENAR)

  return crearStock({
    id: pozo.id,
    yields,
    cx: pozo.cx,
    cy: pozo.cy,
    masaPorUnidad,
    capacity,
    perMillePorSegundo,
    depth: profundidadDe(bioma),
    atSecond: seg(0),
    amount: capacity,
  })
}
