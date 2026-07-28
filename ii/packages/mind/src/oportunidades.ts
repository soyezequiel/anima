// ─── @anima/mind/oportunidades.ts ────────────────────────────────────────────
//
// NECESIDAD × CREENCIA × ESCASEZ, ORDENADO. Es lo que D3 mira antes de pedirle
// un plan a D4: no «qué hago» sino «qué podría querer, y cuánto vale cada cosa».
//
// La fórmula es la del documento de arquitectura y no se toca:
//
//     valor = p · satisfaccion(necesidad, tag) / costoEstimado
//
// con `p = β.a / (β.a + β.b)`, la media del posterior. `valor` ORDENA y no es una
// probabilidad: es satisfacción esperada por unidad de esfuerzo, y como tal
// prefiere lo barato y cercano cuando lo bueno está lejos. Eso es una elección de
// diseño heredada del documento, no un accidente de esta implementación.
//
// ─── LAS SIETE DECISIONES ───────────────────────────────────────────────────
//
// 1. EL AGUA NO ES UN CUERPO, ASÍ QUE SE RECORREN DOS COSAS Y NO UNA. `wet` es un
//    campo de CELDA (ADR II-0002) y el propio `Ctx` lo dice: «buscar agua es
//    `qAt` o `recall`, nunca `see`». Un `opportunities()` que sólo barra `see()`
//    no ve el río —la única oportunidad que importa en el criterio del Hito 5— y
//    la corrida canónica del documento se rompe en silencio. Acá se barren las
//    dos: los cuerpos por `see([])` y el agua por un disco de `qAt` más lo que el
//    libro de lugares recuerde.
//
// 2. UN LUGAR ES UNA CLAVE DE CONTEXTO, NO UN CUERPO. El documento itera
//    `v.features` —«biomas y cuerpos a la vista»— y usa `f.ctx`: la creencia se
//    guarda POR CONTEXTO, así que dos cuerpos del mismo contexto dan la misma `p`
//    y el mismo tag, y sólo se diferencian en la caminata. El más lejano está
//    DOMINADO. Se queda el más cercano y el resto no entra: sin esto, pararse en
//    el medio de un río llena la lista con cuarenta celdas de la misma agua y
//    echa afuera todo lo demás.
//
// 3. EL COSTO SE MIDE EN ALIENTO, QUE ES LA MONEDA DE LA NECESIDAD. El andamio
//    decía «segundos de mundo» y en segundos la caminata NO SE PUEDE PRECIAR: la
//    criatura avanza una celda por TICK (`intencionCaminar`), así que cuántos
//    segundos cuesta un paso depende de la frecuencia, y la vista no la publica.
//    Es la decisión 4 del planificador —«meter hoy un número inventado ahí
//    ordenaría la búsqueda por una ficción»— y acá no hay que inventar nada,
//    porque el precio de caminar EN ALIENTO ya está medido y publicado. El test
//    `world/tests/el-tiempo-no-depende-del-tick.test.ts` lo afirma a cuatro
//    frecuencias con un `toEqual`: diez celdas cuestan exactamente
//    `10 × COSTO_POR_CELDA + (10/hz) × COSTO_VIVIR_POR_SEGUNDO` de `stamina`. Y
//    las dos monedas son una sola: `COSTO_VIVIR_POR_SEGUNDO = 1,0` dice, con
//    todas las letras, que **`stamina` se mide en segundos de vida**. Entonces:
//
//        costo = distancia × (COSTO_POR_CELDA + COSTO_VIVIR_POR_SEGUNDO/hz)
//              + COSTO_VIVIR_POR_SEGUNDO × los segundos que el esquema declara
//
//    que no es un modelo de esta mente: es la cuenta del mundo, copiada.
//
//    Los `segundos` no se inventan: salen de `SCHEMA_INDEX` de `@anima/plan`, que
//    a su vez los saca del catálogo (`completion.at`). Lo que NO tiene esquema
//    —levantar algo con la mano— cuesta UNA INTENCIÓN, que dura un tick.
//
//    El único número que este módulo toma prestado y no puede verificar contra la
//    partida es la FRECUENCIA: se usa `HZ_DE_REFERENCIA`. Está medido lo que eso
//    cuesta y está en el test: a 100 Hz el río de la corrida canónica pierde
//    contra el matorral. La reparación no es acá, es que la vista publique el
//    `hz` — el mismo hueco que le impide a `pasosPosibles` emitir un `explorar`.
//
// 4. DIVIDIR POR CERO NO SE ARREGLA CON `Infinity`. El costo PUEDE ser cero
//    —algo que ya está en la mano ya cumple `holding(tag:…)`, no hay nada que
//    hacer— y `p·sat/0` es `Infinity`. Un `Infinity` en la lista es peor que un
//    número grande: dos oportunidades gratis quedan EMPATADAS en `Infinity` y el
//    desempate cae en el `id`, o sea que la que calma nueve veces más se ordena
//    por orden alfabético. Se divide por `max(costo, PISO_DE_COSTO)`, con el piso
//    en un tick de vida: nada de lo que la criatura hace cuesta menos que estar
//    viva mientras lo hace, y así lo gratis se ordena entre sí por `p·sat`.
//
//    HOY el costo cero no puede salir de `costoEstimado`, y hay que decir por
//    qué: la mente no sabe qué tiene en la mano. `BodyView` no trae los tags de
//    la sustancia —el hueco está medido en `plan/src/predicado.ts`, caso
//    `sostiene`, que devuelve `false` siempre— así que un cuerpo en la mano se
//    cobra como «hay que agarrarlo»: una intención. El piso está escrito y
//    probado ahora igual, porque el día que la vista publique los tags el cero
//    aparece solo y no se puede estar mirando entonces.
//
// 5. EL ORDEN ES TOTAL Y ESTABLE (decisión 4 de `tipos.ts`). Por `valor`
//    descendente y los empates por `id`, comparado con `<` y no con
//    `localeCompare`. Y lo que no es finito NO SE ORDENA: un `NaN` —una Beta con
//    `a + b = 0` alcanza— rompe la transitividad del comparador y `sort` pasa a
//    depender de la implementación del motor. Sale de la lista antes.
//
// 6. LOS DOS GANCHOS SON INYECTABLES, Y NO ES PARA TESTEAR MÁS CÓMODO.
//    `satisfaccion` vive en `necesidades.ts` y `contextoDe` en `creencias.ts`:
//    son otros dos archivos del mismo tramo. El default es el de verdad —quien
//    llame `opportunities(v, m, n)` obtiene la mente entera— y la inyección
//    existe porque la corrida canónica del documento pina SUS números (sat 0,9 y
//    0,2) y no los que la tabla de satisfacción tenga hoy. Este módulo responde
//    por la fórmula, el orden y el costo; no por la tabla.
//
// 7. EL TRABAJO ESTÁ ACOTADO, QUE ES LA DECISIÓN 1 DE `tipos.ts` LLEVADA ACÁ.
//    D3 no se mide en milisegundos: se mide en cuántos candidatos mira. Son
//    `OPORTUNIDADES_QUE_MIRA` contextos distintos, un disco de radio
//    `RADIO_DE_AGUA` que se corta en la primera celda mojada, un `recall`, y la
//    lista de salida recortada a `OPORTUNIDADES_QUE_MIRA`. El corte de contextos
//    es POR CERCANÍA, así que lo que se pierde es lo más caro — y se pierde: un
//    lugar lejano con una creencia mucho mejor que las doce de al lado no entra.
//    Es una elección de escala y está dicha.
//
// ─── LA MITAD DE LA COSTURA QUE HOY FALTA DEL OTRO LADO ─────────────────────
//
// MEDIDO, y hay que decirlo acá arriba porque cambia lo que este módulo entrega
// hoy: `contextoDe` de `creencias.ts` **sólo sabe contestar por CUERPOS**.
// Recorre `see([])` buscando el id y, si no lo encuentra, devuelve `SIN_CUERPO`,
// que es un contexto sin tags. O sea que una celda de agua —`celda:6,0`—
// resuelve a `SIN_CUERPO` y no produce ninguna oportunidad.
//
// Este módulo le pasa igual la clave `celda:x,y`, y eso NO es optimismo: es la
// forma correcta de la costura. El día que `contextoDe` sepa que una celda
// mojada es `agua|…`, la rama del campo de celda empieza a rendir sin tocar una
// línea de acá. Mientras tanto el río entra por el otro lado —el pozo del dios
// ES un cuerpo con masa parado en agua franca, y la fila 1 del instinto
// (`agua|c--e` → `carnoso`) es exactamente esa— y lo que se pierde es el caso
// «veo el agua y todavía no veo nada adentro», que es justo el que hace falta
// para caminar hasta el río antes de saber si hay pescado.
//
// El hueco está pinado con un `it.fails` en el test, con esta misma medición.
//
// Regla 2: no hay reloj, ni azar, ni `Math` trascendente, ni `await`. Las únicas
// funciones de `Math` que se usan son `max` y `min`, que están permitidas.

import { HZ_DE_REFERENCIA } from '@anima/physics'
import type { PredicateSignature } from '@anima/plan'
import { AGUA_FRANCA, interpretar, SCHEMA_INDEX, textoDe } from '@anima/plan'
import type { BodyView, Cell, Where, WhereCell } from '@anima/skills'
import { disco, distancia } from '@anima/skills/innatas'
import { COSTO_POR_CELDA, COSTO_VIVIR_POR_SEGUNDO, inWorld } from '@anima/world'

import { contextoDe } from './creencias.js'
import { satisfaccion } from './necesidades.js'
import type {
  AffordanceMemory,
  Beta,
  ContextKey,
  NeedVector,
  Opportunity,
  VistaDeLaMente,
} from './tipos.js'
import { cuantasVeces, media, OPORTUNIDADES_QUE_MIRA } from './tipos.js'

// ─── Los números, y de dónde sale cada uno ──────────────────────────────────

/**
 * Hasta dónde se barre el campo de celda buscando agua.
 *
 * Es el disco de `explorar` —el barrido de celdas más ancho que hace cualquiera
 * de las quince innatas— y no el radio de percepción, que es 12. La diferencia
 * son 169 llamadas a `qAt` contra 625, y la criatura ya trabaja con este número:
 * lo que `explorar` no encuentra en radio 6, la mente tampoco tiene por qué
 * verlo sin caminar. Lo que se pierde está dicho: un río a ocho celdas es
 * invisible para D3 aunque `see()` llegue hasta doce, porque `see()` no trae
 * agua.
 */
export const RADIO_DE_AGUA = 6

/**
 * Cuántos segundos de mundo dura UNA INTENCIÓN: un tick.
 *
 * La frecuencia es la DE REFERENCIA y no la de la partida, porque la vista no
 * publica ninguna. Es el único préstamo que este módulo no puede verificar
 * contra el mundo en el que corre, y está medido lo que cuesta (ver el test de
 * la fragilidad de la corrida canónica).
 */
export const SEGUNDOS_DE_UNA_INTENCION = 1 / HZ_DE_REFERENCIA

/**
 * Lo que cuesta entrar en una celda, en aliento: el paso MÁS el tiempo del paso.
 *
 * Son dos cobros distintos del mundo y no uno contado dos veces: `stepWorld`
 * cobra `COSTO_POR_CELDA` por celda entrada, y el metabolismo cobra
 * `COSTO_VIVIR_POR_SEGUNDO` por segundo, pase lo que pase. La suma no la
 * despejó nadie acá: es la que `world/tests/el-tiempo-no-depende-del-tick.test.ts`
 * verifica a cuatro frecuencias sobre un viaje de diez celdas.
 *
 * A la frecuencia de referencia los dos términos dan lo mismo —«caminar cuesta
 * lo mismo que vivir», dice el mundo, y las dos constantes se eligieron sin
 * mirarse— así que el total es exactamente el doble del paso: 0,10.
 */
export const ALIENTO_POR_CELDA = COSTO_POR_CELDA + COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_UNA_INTENCION

/**
 * El piso de la división. Un tick de estar viva.
 *
 * No es una constante de gusto: es la unidad más chica que el mundo sabe cobrar,
 * y lo que compra es que una oportunidad gratis tenga un valor FINITO y grande
 * en vez de `Infinity`. Ver la decisión 4 del encabezado.
 */
export const PISO_DE_COSTO = COSTO_VIVIR_POR_SEGUNDO * SEGUNDOS_DE_UNA_INTENCION

/** Todo lo que se ve. `see([])` es «lo que hay», no «el mundo»: ya está acotado. */
const TODO: Where = []

/** Agua franca, con el MISMO umbral con el que el esquema de `extraccion` la pide. */
const MOJADA: WhereCell = [{ q: 'wet', op: '>=', v: AGUA_FRANCA }]

// ─── Los nombres de las cosas ───────────────────────────────────────────────

/**
 * El predicado que una oportunidad quiere: «tener algo con este tag en la mano».
 *
 * El texto NO se escribe acá: lo escribe `textoDe` de `@anima/plan`, que es el
 * mismo que indexa `SCHEMA_INDEX`. Una segunda copia del formato —un
 * `` `holding(tag:${tag})` `` escrito a mano— es exactamente la clase de
 * duplicación que hace que un día el índice diga que no conoce una firma que la
 * mente cree estar pidiendo bien.
 */
export function metaDe(tag: string): PredicateSignature {
  return textoDe({ k: 'sostiene', tag })
}

const PREFIJO_CUERPO = 'cuerpo:'
const PREFIJO_CELDA = 'celda:'

/**
 * El id de un lugar que es un cuerpo, y el de uno que es una celda.
 *
 * Dos formas y un solo espacio de nombres, porque el id de la oportunidad se
 * PARSEA de vuelta en `costoEstimado`: sin el prefijo no hay forma de saber si
 * lo que sigue es un `BodyId` o un par de coordenadas.
 */
export function lugarDeCuerpo(id: string): string {
  return `${PREFIJO_CUERPO}${id}`
}

export function lugarDeCelda(c: Cell): string {
  return `${PREFIJO_CELDA}${String(c.x)},${String(c.y)}`
}

/** `lugar#tag`. Único dentro de un tick, que es lo que `Opportunity.id` promete. */
export function idDeOportunidad(lugar: string, tag: string): string {
  return `${lugar}#${tag}`
}

/** La celda de un `celda:x,y`, o `undefined` si eso no es un lugar de celda. */
export function celdaDeLugar(lugar: string): Cell | undefined {
  if (!lugar.startsWith(PREFIJO_CELDA)) return undefined
  const resto = lugar.slice(PREFIJO_CELDA.length)
  const coma = resto.indexOf(',')
  if (coma <= 0 || coma === resto.length - 1) return undefined
  const x = Number(resto.slice(0, coma))
  const y = Number(resto.slice(coma + 1))
  // Enteros y nada más: la grilla es discreta, y `Number('1.5')` no es una celda.
  if (!Number.isInteger(x) || !Number.isInteger(y)) return undefined
  return { x, y }
}

// ─── El valor ───────────────────────────────────────────────────────────────

/**
 * `p · sat / costo`, con el piso puesto. Es la única división del módulo.
 *
 * Está aparte y exportada porque el caso que hay que poder interrogar —costo
 * cero— hoy no se puede armar desde una vista (ver la decisión 4): probarlo a
 * través de `opportunities` sería probar otra cosa.
 */
export function valorDe(p: number, sat: number, costo: number): number {
  return (p * sat) / Math.max(costo, PISO_DE_COSTO)
}

// ─── El costo ───────────────────────────────────────────────────────────────

/**
 * Cuánto ALIENTO cuesta esta oportunidad, estimado. Sin simular: ADR II-0004.
 *
 * `id` es el de una `Opportunity` (`lugar#tag`) o el de un lugar pelado, y en
 * ese caso la cuenta es sólo la caminata. Un id que la vista de HOY no puede
 * resolver —un cuerpo que ya no se ve, una celda mal escrita— vale
 * `Infinity`, y eso NO ensucia ningún orden: `Infinity` de costo es `0` de
 * valor, que es un número como cualquier otro. El que envenena es el
 * `Infinity` de VALOR, y de ése se encarga el piso.
 */
export function costoEstimado(v: VistaDeLaMente, id: string): number {
  const corte = id.lastIndexOf('#')
  const lugar = corte < 0 ? id : id.slice(0, corte)
  const tag = corte < 0 ? undefined : id.slice(corte + 1)
  const d = distanciaAlLugar(v, lugar)
  if (d === undefined) return Number.POSITIVE_INFINITY
  return costoDe(d, tag)
}

/** La cuenta, ya resuelto el lugar. Es lo que comparte `opportunities`. */
function costoDe(d: number, tag: string | undefined): number {
  return d * ALIENTO_POR_CELDA + (tag === undefined ? 0 : alientoDeConseguir(tag))
}

/**
 * Lo que cuesta pasar de «estoy al lado» a «lo tengo».
 *
 * Sale del esquema, no de la intuición: `SCHEMA_INDEX` dice qué proceso deja
 * `holding(tag:…)` establecido y cuántos segundos tarda. Si hay más de una fila
 * se toma la MÁS BARATA, que es lo mismo que hace la regresión —saca de la cola
 * el nodo de menor costo—; si no hay ninguna, el tag se consigue con la mano y
 * eso es una intención, o sea un tick.
 *
 * Hoy la semilla tiene UNA sola fila de `holding`: `carnoso`, por `extraccion`.
 * O sea que todo lo demás que la criatura crea que rinde algo se cotiza como
 * «agarralo», y eso es correcto para una baya y optimista para lo que haya que
 * cazar. El día que la fragua escriba un proceso que deje otra cosa en la mano,
 * entra en el índice y esta cuenta lo usa sin que nadie la toque.
 */
function alientoDeConseguir(tag: string): number {
  const filas = SCHEMA_INDEX.get(metaDe(tag))
  let mejor: number | undefined
  for (const f of filas ?? []) {
    // Un `segundos` que no es finito no es un costo: es una fila rota. Se saltea
    // en vez de contaminar la cuenta con `NaN`, que después no se ordena.
    if (!Number.isFinite(f.segundos)) continue
    if (mejor === undefined || f.segundos < mejor) mejor = f.segundos
  }
  return COSTO_VIVIR_POR_SEGUNDO * (mejor ?? SEGUNDOS_DE_UNA_INTENCION)
}

/**
 * A cuántas celdas está el lugar, o `undefined` si la vista de hoy no lo tiene.
 *
 * La mano primero y por id, como hace `elegirCuerpo` del planificador: lo que se
 * lleva encima no cuesta caminata, y `see()` no promete devolverlo.
 */
function distanciaAlLugar(v: VistaDeLaMente, lugar: string): number | undefined {
  const celda = celdaDeLugar(lugar)
  if (celda !== undefined) return distancia(celda, v.self.at)
  if (!lugar.startsWith(PREFIJO_CUERPO)) return undefined
  const id = lugar.slice(PREFIJO_CUERPO.length)
  for (const b of v.self.holding) if (b.id === id) return 0
  for (const b of v.see(TODO)) if (b.id === id) return distancia(b.at, v.self.at)
  return undefined
}

// ─── Los lugares ────────────────────────────────────────────────────────────

/**
 * Un candidato: algo sobre lo que se puede creer que rinde.
 *
 * `clave` es lo que se le pasa a `contextoDe` y `lugar` lo que va en el id de la
 * oportunidad, y no son lo mismo a propósito: `contextoDe(v, id)` toma el id de
 * un CUERPO, así que un cuerpo se nombra por su `BodyId` pelado. Una celda no
 * tiene id, y ahí las dos formas coinciden en `celda:x,y`.
 */
interface Lugar {
  readonly clave: string
  readonly lugar: string
  /** Celdas de Chebyshev hasta acá, ya contadas. */
  readonly d: number
  /** Para el «por qué». De un cuerpo sale `nameOf`; de una celda, el agua. */
  readonly nombre: string
}

function deCuerpo(b: BodyView, d: number): Lugar {
  return { clave: b.id, lugar: lugarDeCuerpo(b.id), d, nombre: b.name }
}

function deCelda(c: Cell, d: number): Lugar {
  const lugar = lugarDeCelda(c)
  return { clave: lugar, lugar, d, nombre: `el agua en (${String(c.x)}, ${String(c.y)})` }
}

/** Cercanía primero, y el empate por el id del lugar. Orden TOTAL. */
function comparaLugares(a: Lugar, b: Lugar): number {
  if (a.d !== b.d) return a.d < b.d ? -1 : 1
  return a.lugar < b.lugar ? -1 : a.lugar > b.lugar ? 1 : 0
}

/**
 * Todo lo que se puede mirar, del más cercano al más lejano.
 *
 * Cuatro fuentes y las cuatro hacen falta: la mano (que no cuesta caminata),
 * lo que se ve, el agua que se ve —que no es un cuerpo— y el agua que se
 * recuerda.
 */
function lugares(v: VistaDeLaMente): Lugar[] {
  const out: Lugar[] = []
  const ya = new Set<string>()
  const sumar = (l: Lugar): void => {
    if (ya.has(l.lugar)) return
    ya.add(l.lugar)
    out.push(l)
  }
  // La mano ANTES que `see`: si el mismo cuerpo viene por los dos lados, gana la
  // distancia 0. Lo que se lleva encima viaja con la criatura.
  //
  // Y LA EXCLUSIÓN DE UNO MISMO VA EN LOS DOS BARRIDOS, no en uno.
  //
  // Estaba escrita sólo en el de `see()`, y el de la mano va PRIMERO y entra con
  // `d = 0`. Parece imposible tenerse a uno mismo en la mano y no lo es: D5 emite
  // `juntar({fuelEnergy > 0}, 1)` cuando lo que duele es el frío, la carne de la
  // criatura arde, pesa 2 kg —o sea que es `portable`— y no la tiene agarrada
  // nadie, así que `juntar` la ve, camina cero celdas y la levanta. Medido por el
  // adversario: primer agarre del propio cuerpo en el tick 2, y a partir de ahí
  // `cuerpo:ana-cuerpo#carnoso` valía 0,4324 contra los 0,3815 del pescado del
  // pozo — la criatura se ofrecía a sí misma como comida y ganaba, porque el
  // valor es satisfacción por unidad de esfuerzo y no hay esfuerzo más chico que
  // cero.
  //
  // Que `juntar` levante el propio cuerpo NO se arregla desde acá y queda pinado
  // con su medición: `Where` es una lista de pruebas sobre CUALIDADES y «no soy
  // yo» no es una cualidad, así que la mente no tiene con qué escribir ese
  // filtro. Lo que sí se arregla desde acá es que, una vez levantado, no se
  // ordene por encima de la comida de verdad.
  for (const b of v.self.holding) {
    if (b.id === v.self.id) continue
    sumar(deCuerpo(b, 0))
  }
  for (const b of v.see(TODO)) {
    // La criatura no es una oportunidad para sí misma. Es la misma exclusión que
    // hace `elegirCuerpo`, y por la misma razón: nadie se pesca a sí mismo.
    if (b.id === v.self.id) continue
    sumar(deCuerpo(b, distancia(b.at, v.self.at)))
  }
  const aLaVista = aguaALaVista(v)
  if (aLaVista !== undefined) sumar(aLaVista)
  const recordada = aguaRecordada(v)
  if (recordada !== undefined) sumar(recordada)
  out.sort(comparaLugares)
  return out
}

/**
 * El agua más cercana del disco, o `undefined`.
 *
 * `disco()` viene del más cercano al más lejano, así que la PRIMERA que aparece
 * es la más cercana y el barrido se corta ahí: las demás celdas de la misma agua
 * están dominadas (misma clave de contexto, misma creencia, más caminata). Lo
 * que se pierde con eso es distinguir dos aguas distintas adentro del mismo
 * disco — y hoy eso no se pierde, porque la creencia se guarda por clave de
 * contexto y dos aguas del mismo bioma comparten clave. O sea: se pierde una
 * diferencia que la memoria de afordancias todavía no sabe representar.
 *
 * `inWorld` antes de preguntar: la grilla LANZA fuera del mundo (`cellKey`), y
 * el disco de una criatura parada en el borde se sale. Una criatura en el borde
 * no puede voltear el tick de las otras 4999.
 */
function aguaALaVista(v: VistaDeLaMente): Lugar | undefined {
  for (const c of disco(v.self.at, RADIO_DE_AGUA)) {
    if (!inWorld(c.x, c.y)) continue
    if (v.qAt(c, 'wet') >= AGUA_FRANCA) return deCelda(c, distancia(c, v.self.at))
  }
  return undefined
}

/**
 * El agua RECORDADA más cercana.
 *
 * Se consulta aunque hoy casi nunca conteste, y hay que decir por qué: el libro
 * de lugares sólo anota **lo que se pisó**, no lo que se vio de lejos (el hueco
 * está medido en `perceive/tests/los-lugares.test.ts`), y una criatura no camina
 * adentro del agua franca. Cuando el libro anote lo que se ve, la mente ya va a
 * estar mirando acá.
 *
 * Se vuelve a preguntar `q('wet')` sobre lo que `recall` ya filtró: un recuerdo
 * es una hipótesis —lleva `atTick` justamente por eso— y el filtro corre sobre
 * lo anotado, no sobre el mundo de hoy.
 */
function aguaRecordada(v: VistaDeLaMente): Lugar | undefined {
  let mejor: Lugar | undefined
  for (const r of v.recall(MOJADA)) {
    if (r.q('wet') < AGUA_FRANCA) continue
    const l = deCelda(r.at, distancia(r.at, v.self.at))
    if (mejor === undefined || comparaLugares(l, mejor) < 0) mejor = l
  }
  return mejor
}

// ─── La lista ───────────────────────────────────────────────────────────────

/**
 * Los dos módulos del tramo de los que este depende, inyectables. Ver la
 * decisión 6 del encabezado: el default es el de verdad.
 */
export interface GanchosDeOportunidad {
  readonly sat?: (n: NeedVector, tag: string) => number
  readonly ctxDe?: (v: VistaDeLaMente, lugar: string) => ContextKey
}

/** Por valor descendente, y los empates por `id`. Orden TOTAL y estable. */
function comparaOportunidades(a: Opportunity, b: Opportunity): number {
  if (a.valor !== b.valor) return a.valor > b.valor ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Dos decimales con coma, que es como se escribe un número acá.
 *
 * `toFixed` y no `toLocaleString`: la regla 2 prohíbe `Intl` y todo lo que
 * dependa del locale, y con razón —el mismo `porque` tiene que salir igual en
 * toda máquina—. `toFixed` está especificado al último dígito por ECMAScript.
 */
function dosDecimales(x: number): string {
  return x.toFixed(2).replace('.', ',')
}

function porqueDe(nombre: string, tag: string, p: number, β: Beta): string {
  return `creo que ${nombre} rinde ${tag} (p=${dosDecimales(p)}, n=${String(cuantasVeces(β))})`
}

/**
 * Qué se puede querer, ordenado. Orden TOTAL y ESTABLE: por valor, y los empates
 * por `id`.
 *
 * No escribe nada: `observe` y `seed` son de quien ejecuta y ve el resultado, no
 * de quien mira. D3 propone; la evidencia la trae el mundo.
 */
export function opportunities(
  v: VistaDeLaMente,
  m: AffordanceMemory,
  n: NeedVector,
  ganchos: GanchosDeOportunidad = {},
): readonly Opportunity[] {
  const sat = ganchos.sat ?? satisfaccion
  const ctxDe = ganchos.ctxDe ?? contextoDe
  const out: Opportunity[] = []
  const contextos = new Set<ContextKey>()

  for (const l of lugares(v)) {
    if (contextos.size >= OPORTUNIDADES_QUE_MIRA) break
    const ctx = ctxDe(v, l.clave)
    // Decisión 2: el segundo lugar del mismo contexto no agrega nada que la
    // creencia sepa distinguir, y está más lejos.
    if (contextos.has(ctx)) continue
    contextos.add(ctx)

    const tags = new Set<string>()
    for (const tag of m.tagsDe(ctx)) {
      if (tags.has(tag)) continue
      tags.add(tag)
      const s = sat(n, tag)
      // La línea del documento: `if (sat <= 0) continue`. Escrita como `!(s > 0)`
      // para que un `NaN` de una tabla rota también se caiga acá.
      if (!(s > 0)) continue
      // El `meta` viaja hasta D4 y lo lee `plan()`. Un tag que el intérprete no
      // entiende no es una oportunidad: es una fila mal escrita en la tabla de
      // creencias, y si pasa se descubre tres peldaños más abajo disfrazada de
      // objetivo imposible. Se le pregunta al MISMO intérprete que lo va a leer.
      const meta = metaDe(tag)
      if (interpretar(meta) === undefined) continue
      const β = m.belief(ctx, tag)
      const p = media(β)
      const valor = valorDe(p, s, costoDe(l.d, tag))
      // Decisión 5: lo que no es finito no entra al `sort`.
      if (!Number.isFinite(valor)) continue
      out.push({
        meta,
        valor,
        id: idDeOportunidad(l.lugar, tag),
        porque: porqueDe(l.nombre, tag, p, β),
      })
    }
  }

  out.sort(comparaOportunidades)
  return out.length > OPORTUNIDADES_QUE_MIRA ? out.slice(0, OPORTUNIDADES_QUE_MIRA) : out
}
