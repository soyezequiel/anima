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
// ─── 8. TENER COMIDA NO ES LA META: LA META ES DEJAR DE TENER HAMBRE ────────
//
// Y acá estaba el bug que mató la primera corrida entera del Hito 5. Medido:
// **la criatura pescó 199 veces y se murió de hambre en el tick 6194 de 20.000**,
// con `bocados 0`.
//
// La causa no era un `if` que faltara en la escalera: era ESTA función. Lo que
// una oportunidad de comida decía es `holding(tag:carnoso)` —tener algo carnoso
// en la mano— y eso NO es lo que apaga la necesidad. La necesidad la apaga
// TRAGAR. Peor todavía: el `valor` con el que la meta ganaba ya estaba preciado
// como si se comiera —`satisfaccion` mira `nutrition · digestibility`, que son
// calorías, que es lo que da el mordisco y no lo que da la mano—. O sea que el
// numerador hablaba de comer y el objetivo hablaba de tener: **la fórmula y la
// meta no eran de la misma frase**, y el pescado se quedaba en la mano hasta que
// la criatura se moría al lado del río.
//
// La reparación es que el hambre produzca TRES clases de oportunidad y no una:
//
//   · las de siempre, `holding(tag:…)`, que son EL MEDIO: se le pasan a `plan()`
//     y la regresión sabe encadenarlas (la caña, el pozo, la extracción);
//   · **el bocado**, que es EL FIN: «comerme eso», con un cuerpo concreto ya
//     elegido, ya preciado y con su tolerancia al veneno ya calculada. No va al
//     planificador: lo cierra la escalera de un mordisco;
//   · **el medio con la condición puesta** —`holding(tag:carnoso,toxicity<0,0528)`,
//     ver `metaComestibleDe`—, que es «algo COMESTIBLE en la mano». Ésa sí va al
//     planificador, y qué hay que hacer para conseguirla lo decide él.
//
// Las tres entran en la MISMA lista y se ordenan con la MISMA fórmula, que es lo
// único que hace que la elección sea una elección: «¿me como lo que tengo, voy a
// buscar más, o arreglo lo que traje?» se contesta comparando tres números de la
// misma escala, no con una regla de precedencia escrita a mano.
//
// ─── Y EL BOCADO SE PRECIA CON EL VENENO YA COBRADO (ADR II-0013) ───────────
//
// `stepWorld` acredita `calories · STAMINA_POR_CALORIA` y cobra
// `toxicity · masa · COSTO_POR_TOXICIDAD_Y_KILO`, por separado y no neteado. Con
// esos dos números —y NO con una tabla de «esto es comida y esto no»— sale sola
// la escalera de alimentación del catálogo: grasa, médula y huevo se comen
// crudos, y pescado y carne son VENENO hasta que alguien los cocine. Medido acá
// mismo, sobre la corrida canónica: el pescado que la criatura saca del pozo pesa
// 2,8870 kg, tiene 7,8421 calorías y `toxicity` 0,3298, o sea que tragarlo deja
// **−15,9645 de aliento**. Una mente que se lo come vive menos que una que no.
//
// Por eso el bocado NO EXISTE cuando el neto no es positivo: no es una
// oportunidad que se ordena baja, es que no hay tal oportunidad.
//
// ─── QUE LA CRIATURA NO SE COMA A SÍ MISMA ES UN CERROJO, Y NO DOS ──────────
//
// Acá decía que eran dos y que el segundo era la cuenta: «su propio cuerpo es
// carne de 2 kg con `toxicity` 0,30, o sea −8,7000, así que la cuenta la
// excluiría igual si `lugares()` no lo hiciera». **La segunda mitad es falsa, y
// el adversario la midió**: el cuerpo de la criatura es `carne`, o sea `organico`
// y `carnoso` —exactamente el tag que la fila de cocción de `@anima/plan`
// trabaja— y la ley 5 escribe `digestibility` y `toxicity` en `Body.state`, que es
// donde ese cuerpo las tiene. Una criatura parada en la celda de un leño ardiendo
// termina, a los 40 s y sin morirse, con su propio cuerpo en `dig 0,8574 · tox
// 0,0184 · cal 15,2232`: **neto +14,51**, y la cuenta lo aceptaría contenta.
//
// O sea que el único cerrojo de este archivo es el `if (b.id === v.self.id)
// continue` de `lugares()`, en sus dos barridos. Es UNO, y por eso hay otros dos
// afuera y hacían falta: el mundo rechaza `eat` sobre el propio cuerpo con
// `es-uno-mismo` (era el único bocado gratis que había: acreditaba, borraba el
// cuerpo y perdía el cobro, dejando un actor vivo sin cuerpo para siempre), y la
// innata `comer` se saltea `ctx.self.id` en las dos listas que mira.
//
// ─── Y ACÁ NO SE NOMBRA EL FUEGO NI UNA VEZ ─────────────────────────────────
//
// La tercera clase pide `toxicity < 0,0528` y nada más. El 0,0528 no es una
// preferencia: es la misma desigualdad del bocado despejada sobre el tag —ver
// `venenoQueBanca`— y sale del PEOR carnoso del catálogo. Que la cocción medida
// deje el pescado en 0,0345 y que el esquema de cocción prometa 0,05 son números
// de otros dos paquetes, calibrados por separado, que entran justo abajo.
//
// O sea: **no hay ni un `if (esPescado) cocinar`**. La mente pide una cualidad y
// el planificador contesta con lo que sepa. Si sabe cocinar, cocina; si no,
// `sinVocabulario` saltea la meta en D3 y la criatura sigue con lo que puede.
//
// La consecuencia de HOY hay que decirla igual, y está medida en
// `tests/el-bocado.test.ts`: en la corrida canónica la mente pesca, mira lo que
// sacó, le da **−15,9645** y no se lo come; sube el pedido a la meta comestible
// en el tick 98; y `plan()` regresa hasta la ley de cocción y se corta en la
// ventana de potencia del fuego (`gap` con `missing` «emitsPower<410 &
// emitsPower>=253»), contestando mientras tanto con «pescá otro». Por eso el
// número de pescas todavía no se mueve, y por eso lo que falta no es de este
// paquete.
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

import { HZ_DE_REFERENCIA, specOf, TAGS } from '@anima/physics'
import type { Predicado, PredicateSignature } from '@anima/plan'
import { AGUA_FRANCA, firmaDe, implica, interpretar, SCHEMA_INDEX, textoDe } from '@anima/plan'
import type { BodyView, Cell, Where, WhereCell } from '@anima/skills'
import { CONTRATO_COMER, disco, distancia } from '@anima/skills/innatas'
import {
  COSTO_POR_CELDA,
  COSTO_POR_TOXICIDAD_Y_KILO,
  COSTO_VIVIR_POR_SEGUNDO,
  inWorld,
  STAMINA_POR_CALORIA,
} from '@anima/world'

import { contextoDe } from './creencias.js'
import {
  caloriasDelPeorDeTag,
  promesaDeCalorias,
  satisfaccion,
  satisfaccionDe,
  TANQUE_DE_ALIENTO,
} from './necesidades.js'
import type {
  AffordanceMemory,
  Beta,
  Bocado,
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

/**
 * HASTA CUÁNTO VENENO SE BANCA CUALQUIER COSA DE ESTE TAG, en `toxicity`.
 *
 * Es la desigualdad del bocado despejada sobre el tag en vez de sobre un cuerpo.
 * Tragar deja `neto = nutrition · masa · digestibility · S − toxicity · masa · K`
 * y **la masa se cancela**, que es el regalo entero: lo que hace falta para que
 * algo valga la pena no depende de cuánto hay. Queda
 *
 *     toxicity  <  (nutrition · digestibility) · S / K
 *
 * y `nutrition · digestibility` son las calorías por kilo, que es exactamente lo
 * que el catálogo publica por sustancia. Se toma el PEOR miembro del tag
 * (`caloriasDelPeorDeTag`) porque esto es una condición y no una promesa: quien
 * pide «algo carnoso que no me envenene» no sabe si le va a tocar grasa o
 * molusco, y una condición que sólo aguanta el mejor caso no condiciona nada.
 *
 * Para `carnoso` en la semilla el peor es el molusco (1,32 por kilo) y da
 * **0,0528**. Que la cocción prometa `toxicity <= 0,05` y entre justo abajo no lo
 * arregló nadie: son dos números calibrados por separado, en dos paquetes
 * distintos, y se tocan.
 */
export function venenoQueBanca(tag: string): number {
  return (caloriasDelPeorDeTag(tag) * STAMINA_POR_CALORIA) / COSTO_POR_TOXICIDAD_Y_KILO
}

/**
 * «ALGO COMESTIBLE EN LA MANO», dicho en el vocabulario de `@anima/plan`.
 *
 * Es la meta que le falta a esta mente desde que el mundo cobra el veneno, y es
 * la que hace innecesario cualquier `if (esPescado) cocinar`: la mente pide un
 * carnoso **que no la envenene**, y qué hay que hacer para conseguirlo lo decide
 * el planificador. Si hay un esquema que promete dejar algo cocido en la mano, la
 * regresión lo encuentra por implicación; si no lo hay, `sinVocabulario` la
 * saltea en D3 y no pasa nada.
 *
 * `undefined` en dos casos, y los dos quieren decir «esto no se puede pedir»:
 *
 *   · el tag no tiene piso calórico —alguno de sus miembros no se come, así que
 *     ningún umbral de veneno lo vuelve comida—;
 *   · **el vocabulario todavía no sabe decirlo.** Si `textoDe` devuelve la misma
 *     firma que `metaDe(tag)`, es que las condiciones se perdieron por el camino
 *     y esta meta sería un duplicado de la otra con otro id. Se compara el
 *     resultado en vez de preguntar por la versión de otro paquete, que es la
 *     única forma que no envejece.
 */
export function metaComestibleDe(tag: string): PredicateSignature | undefined {
  const t = venenoQueBanca(tag)
  if (!(t > 0)) return undefined
  const firma = textoDe({ k: 'sostiene', tag, tests: [{ q: 'toxicity', op: '<', v: t }] })
  return firma === metaDe(tag) ? undefined : firma
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
  /**
   * El cuerpo, cuando el lugar ES un cuerpo. `undefined` para una celda de agua.
   *
   * Lo necesita el bocado y nada más: la rama de los tags trabaja con la CLAVE de
   * contexto —dos cuerpos del mismo contexto son intercambiables— y la del bocado
   * trabaja con el cuerpo concreto, porque `calories`, `mass` y `toxicity` son de
   * ESE cuerpo y no de su clase. Es la misma diferencia que hay entre «creo que el
   * río rinde pescado» y «este pescado que tengo acá pesa 2,89 kg y está podrido».
   */
  readonly cuerpo?: BodyView
}

function deCuerpo(b: BodyView, d: number): Lugar {
  return { clave: b.id, lugar: lugarDeCuerpo(b.id), d, nombre: b.name, cuerpo: b }
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

// ─── El bocado ──────────────────────────────────────────────────────────────

/**
 * LO QUE `comer` PROMETE, leído de su contrato y no escrito acá.
 *
 * Es el mismo movimiento que hace D0 con `CONTRATO_HUIR_DEL_DOLOR` para sacar su
 * umbral de calor: lo que una habilidad establece es DATO (`Contrato.establece`
 * existe justamente para que el juez del Hito 7 lo pueda ablacionar), no un
 * comentario que haya que transcribir. Si mañana `comer` promete otra cosa, esto
 * lanza AL CARGAR el módulo en vez de mentir en silencio.
 *
 * No se le pasa a `plan()` nunca —ninguna cadena de esquemas establece `stamina`,
 * y no tiene por qué: lo establece la mente de un mordisco—. Viaja para que la
 * lista se pueda leer, comparar y contar.
 */
export const META_DEL_BOCADO: PredicateSignature = ((): PredicateSignature => {
  for (const p of CONTRATO_COMER.establece) {
    if (p.sujeto !== 'yo' || p.q !== 'stamina') continue
    const f = firmaDe(`${p.q}${p.op}${String(p.v)}`)
    if (interpretar(f) !== undefined) return f
  }
  throw new RangeError('`CONTRATO_COMER` ya no promete `yo.stamina`: el bocado se quedó sin meta')
})()

/**
 * Cómo se llama la «clase de cosa» de un bocado dentro de un id de oportunidad.
 *
 * `Opportunity.id` es `lugar#tag` y `costoEstimado` lo parsea de vuelta, así que
 * el bocado necesita una cola que NO pueda ser un tag de verdad — si no, dos
 * oportunidades distintas sobre el mismo cuerpo podrían compartir id. Se verifica
 * contra la enumeración cerrada de la física al cargar, que es más barato que
 * confiar en que nadie llame `bocado` a un tag.
 */
const [COLA_DEL_BOCADO, COLA_DEL_RESCATE] = ((): readonly [string, string] => {
  const colas = ['bocado', 'rescate'] as const
  for (const c of colas) {
    if ((TAGS as readonly string[]).includes(c)) {
      throw new RangeError(`«${c}» pasó a ser un tag de la física: el id de una oportunidad colisiona`)
    }
  }
  return colas
})()

/**
 * El techo de `toxicity` que declara el catálogo. Tolerar más que eso es tolerar
 * todo, y decirlo con el rango en vez de con un 1 escrito a mano es lo que hace
 * que esto siga siendo verdad si alguien recalibra la cualidad.
 */
const VENENO_MAXIMO = specOf('toxicity').range[1]

/**
 * Lo que cuesta el acto de tragar, en aliento, leído del contrato.
 *
 * `CONTRATO_COMER.cuesta.segundos` es 0 —comer no espera— pero ningún acto cuesta
 * menos que el tick en el que ocurre, que es el mismo piso que usa
 * `alientoDeConseguir` para lo que no tiene esquema. La caminata se suma aparte.
 */
const ALIENTO_DE_UN_BOCADO =
  COSTO_VIVIR_POR_SEGUNDO * Math.max(CONTRATO_COMER.cuesta.segundos, SEGUNDOS_DE_UNA_INTENCION)

/**
 * LO QUE CADA ESQUEMA DEL PLANIFICADOR SABE DEJAR ESTABLECIDO, ya interpretado y
 * con su precio en segundos, calculado UNA vez al cargar.
 *
 * Se calcula al cargar y no por tick porque `SCHEMA_INDEX` es una constante de
 * `@anima/plan`. Y se guarda INTERPRETADO —no la firma en texto— porque la
 * pregunta que hay que hacerle es de implicación y no de igualdad: un esquema que
 * deje `digestibility >= 0,85` cubre un pedido de `digestibility > 0,78`, y
 * compararlos por texto haría preciar como «no hay forma» algo que el catálogo
 * sabe hacer. Parsear las ocho firmas una vez por rescate y por tick sería el
 * peldaño D3 pagando un `replace` de expresión regular por candidato.
 */
const LO_QUE_CUESTA_ESTABLECER: readonly { readonly p: Predicado; readonly segundos: number }[] =
  ((): readonly { readonly p: Predicado; readonly segundos: number }[] => {
    const out: { readonly p: Predicado; readonly segundos: number }[] = []
    for (const [firma, filas] of SCHEMA_INDEX) {
      const p = interpretar(firma)
      if (p === undefined) continue
      for (const f of filas) {
        // Un `segundos` que no es finito no es un precio: es una fila rota, y se
        // saltea en vez de contaminar la cuenta con un `NaN` que después no ordena.
        if (Number.isFinite(f.segundos)) out.push({ p, segundos: f.segundos })
      }
    }
    return out
  })()

/**
 * Cuánto aliento cuesta que ALGUIEN establezca esto, o un tick si nadie sabe.
 *
 * No es el costo de verdad —el planificador puede necesitar una cadena de tres
 * esquemas y esto cuenta uno— y por eso es un piso y no una estimación. Lo que
 * compra es que una meta que cuesta un fuego no se ordene igual que una que
 * cuesta agacharse.
 */
export function alientoDelEsquema(p: Predicado): number {
  let mejor: number | undefined
  for (const e of LO_QUE_CUESTA_ESTABLECER) {
    if (!implica(e.p, p)) continue
    if (mejor === undefined || e.segundos < mejor) mejor = e.segundos
  }
  return COSTO_VIVIR_POR_SEGUNDO * (mejor ?? SEGUNDOS_DE_UNA_INTENCION)
}

/** Un bocado ya preciado, más su rendimiento POR KILO, que es lo que se normaliza. */
interface Mordida {
  readonly bocado: Bocado
  /** Neto por unidad de masa: la misma unidad con la que el catálogo mide un tag. */
  readonly porKilo: number
}

/**
 * CUÁNTO DEJA TRAGARSE ESTO, con la cuenta del mundo copiada y no modelada.
 *
 * Las dos mitades salen de `intencionComer` (`world/src/step.ts`), en el orden en
 * que el mundo las hace:
 *
 *   acredita  `calories · STAMINA_POR_CALORIA` — **topado por lo que todavía
 *             entra en el tanque**, porque `conCualidad` recorta contra el rango
 *             de la cualidad y lo que sobra se pierde;
 *   cobra     `toxicity · masa · COSTO_POR_TOXICIDAD_Y_KILO`, entero y sin topar.
 *
 * De esas dos líneas sale TODO lo demás, sin una sola regla escrita:
 *
 *   · **la tolerancia al veneno deja de ser una constante.** `comer` se
 *     autoimpone 0,2 cuando nadie le dice otra cosa, y ese 0,2 no sabe nada de
 *     quién come. Acá el número es `gana / (masa · K)`: es el punto exacto en el
 *     que el mordisco deja de convenir, y depende de lo vacío que esté el tanque
 *     porque `gana` está topado por el margen. **Una criatura llena rechaza lo
 *     que una flaca acepta** — y no porque la flaca sea imprudente, sino porque a
 *     la llena las calorías se le derraman y el veneno se le cobra igual;
 *   · **lo grande no es mejor.** Las dos mitades escalan con la masa, así que un
 *     pozo de 50 kg de pescado no es cincuenta veces mejor que un kilo: es
 *     cincuenta veces peor, porque el pescado crudo da negativo. Nadie escribió
 *     «no te comas el río».
 *
 * `undefined` quiere decir **esto no es un bocado**, y no «es un bocado malo». La
 * diferencia importa: una oportunidad con valor bajo igual compite y puede ganar
 * un tick flojo; algo que resta no tiene que estar en la lista.
 */
function mordidaDe(v: VistaDeLaMente, b: BodyView, margen: number): Mordida | undefined {
  const calorias = v.q(b, 'calories')
  const masa = v.q(b, 'mass')
  // Las dos precondiciones que el mundo mira antes de tragar, leídas antes de
  // gastar el tick: sin calorías rechaza con `nada-que-comer`, y sin masa la
  // cuenta del veneno no tiene sobre qué correr.
  if (!(calorias > 0) || !(masa > 0)) return undefined
  const gana = Math.min(calorias * STAMINA_POR_CALORIA, margen)
  const porVeneno = masa * COSTO_POR_TOXICIDAD_Y_KILO
  const neto = gana - v.q(b, 'toxicity') * porVeneno
  if (!(neto > 0)) return undefined
  const tolerada = porVeneno > 0 ? Math.min(gana / porVeneno, VENENO_MAXIMO) : VENENO_MAXIMO
  return { bocado: { id: b.id, neto, toxicidadTolerada: tolerada }, porKilo: neto / masa }
}

/**
 * QUÉ SE PODRÍA COMER AHORA, ordenado con todo lo demás.
 *
 * Tres portones antes de mirar un solo cuerpo, y los tres evitan gastar un tick
 * de mundo en algo que ya se sabe que va a fracasar:
 *
 *   · **el permiso.** `comer` se rinde con «todavía no tengo permiso» si
 *     `self.permits` no es `irreversible`, y se rinde SIN ceder una intención: la
 *     criatura quedaría eligiendo el mismo bocado todos los ticks para siempre.
 *     La cuarentena es visible desde la vista, así que se mira acá.
 *   · **el margen.** Con el tanque lleno no hay nada que ganar y el veneno se
 *     cobra igual. `necesidades` ya dice lo mismo por otro lado —con el tanque
 *     lleno `energia` vale 0,0025— pero eso es una preferencia y esto es una
 *     imposibilidad.
 *   · **la mano ajena.** El mundo deja comerle algo de la mano a otro
 *     (`sacarCuerpo` lo saca de todas las manos) y `comer` no lo hace: filtra
 *     `heldBy === undefined` para lo que ve. La mente no va a ser más suelta que
 *     la habilidad que va a correr.
 *
 * EL TRABAJO ESTÁ ACOTADO (decisión 7): se miran a lo sumo
 * `OPORTUNIDADES_QUE_MIRA` cuerpos, y `lugares()` los trae del más cercano al más
 * lejano CON LA MANO PRIMERO — que es el mismo orden que usa `comer` para elegir
 * sola. Lo que se pierde con la cota es un bocado lejano detrás de doce cosas
 * cercanas que no se comen, y se dice: en un mundo tapado de piedras, la mente no
 * ve la fruta del fondo.
 *
 * La `satisfaccion` NO pasa por el gancho inyectable y hay que decir por qué: el
 * gancho existe para pinar los números que la corrida canónica del documento le
 * asigna a un TAG, y un bocado no tiene tag. Tiene calorías netas por kilo, que
 * se normalizan contra el mismo techo del catálogo con el que se normaliza un tag
 * (`promesaDeCalorias`), así que las dos clases de oportunidad siguen siendo
 * comparables aunque una de las dos no se pueda inyectar.
 */
function losBocados(v: VistaDeLaMente, n: NeedVector, ls: readonly Lugar[]): Opportunity[] {
  const out: Opportunity[] = []
  if (v.self.permits !== 'irreversible') return out
  const margen = TANQUE_DE_ALIENTO - v.self.stamina
  if (!(margen > 0)) return out

  let mirados = 0
  for (const l of ls) {
    if (mirados >= OPORTUNIDADES_QUE_MIRA) break
    const b = l.cuerpo
    if (b === undefined) continue
    mirados += 1
    if (b.heldBy !== undefined && !enMiMano(v, b)) continue
    const m = mordidaDe(v, b, margen)
    if (m === undefined) continue
    // `p = 1` y no una creencia, y es la diferencia entera entre las dos clases de
    // oportunidad: que el río RINDA pescado es una apuesta y se aprende; que ESTE
    // pescado tenga estas calorías es una lectura. Meterle una Beta encima sería
    // dudar de lo que ya se está mirando.
    const s = satisfaccionDe(n, promesaDeCalorias(m.porKilo))
    if (!(s > 0)) continue
    const valor = valorDe(1, s, l.d * ALIENTO_POR_CELDA + ALIENTO_DE_UN_BOCADO)
    if (!Number.isFinite(valor)) continue
    out.push({
      meta: META_DEL_BOCADO,
      valor,
      id: idDeOportunidad(l.lugar, COLA_DEL_BOCADO),
      porque: `me como ${l.nombre}: deja ${dosDecimales(m.bocado.neto)} de aliento y me banco ${dosDecimales(m.bocado.toxicidadTolerada)} de veneno`,
      bocado: m.bocado,
    })
  }
  return out
}

/** Si este cuerpo lo tengo yo agarrado. Por id, que es lo único estable. */
function enMiMano(v: VistaDeLaMente, b: BodyView): boolean {
  for (const h of v.self.holding) if (h.id === b.id) return true
  return false
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
 * DOS CLASES DE COSA EN UNA SOLA LISTA (decisión 8): las metas —`holding(tag:…)`,
 * que se le pasan a `plan()`— y los bocados —`Opportunity.bocado`, que no se le
 * pasan a nadie porque la mente los cierra de un mordisco—. Están juntas porque
 * la pregunta que hay que contestar es una sola: **¿me como lo que tengo o voy a
 * buscar más?** Separarlas en dos listas obligaría a escribir a mano cuál gana, y
 * no hay ninguna respuesta escrita a mano que sea correcta en los dos extremos.
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
  // UNA sola vez, y las dos ramas la comparten: `lugares()` barre un disco de
  // `qAt` y un `recall`, y llamarla dos veces por tick duplicaría el peldaño más
  // caro de D3 para obtener exactamente la misma lista.
  const ls = lugares(v)
  const out: Opportunity[] = losBocados(v, n, ls)
  const contextos = new Set<ContextKey>()

  for (const l of ls) {
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
      // ─── LA MISMA APUESTA, PERO PIDIENDO QUE SE PUEDA COMER ──────────────
      //
      // Va acá adentro y no en una función aparte porque es LA MISMA creencia
      // sobre el mismo lugar: la `p` es la misma —que el río rinda carnoso no
      // depende de si después se cocina— y lo que cambia es lo que se pide y lo
      // que cuesta. Que las dos convivan en la lista es lo que deja que la
      // criatura arranque por la barata («conseguí un pescado») y siga por la
      // cara («conseguí uno que no me envenene») cuando la primera ya se cumplió.
      //
      // El costo lleva el esquema encima: conseguir algo carnoso cuesta la
      // extracción, y conseguirlo comestible cuesta además lo que valga el
      // esquema que lo prometa —hoy, si existe, la cocción—. Sin ese término las
      // dos metas costarían lo mismo y la mente elegiría la difícil por nada.
      const comestible = metaComestibleDe(tag)
      const pc = comestible === undefined ? undefined : interpretar(comestible)
      if (comestible !== undefined && pc !== undefined) {
        const valorC = valorDe(p, s, costoDe(l.d, tag) + alientoDelEsquema(pc))
        if (Number.isFinite(valorC)) {
          out.push({
            meta: comestible,
            valor: valorC,
            id: idDeOportunidad(l.lugar, `${tag}+${COLA_DEL_RESCATE}`),
            porque: `${porqueDe(l.nombre, tag, p, β)}, y lo quiero comestible: «${comestible}»`,
          })
        }
      }
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
