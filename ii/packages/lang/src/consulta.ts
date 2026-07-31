/**
 * POR DÓNDE ENTRA EL MODELO — y la forma se la dictan tres restricciones que no
 * se pueden negociar entre sí.
 *
 * El ADR II-0024 dice que el modelo entra por la confianza y que «la puerta ya
 * existe». Existía como NÚMERO —`leer()` devuelve confianza desde el primer
 * tramo— y no como HUECO: no había por dónde enchufar nada. Este archivo es el
 * hueco.
 *
 * ─── Las tres restricciones, y por qué sólo hay una forma ───────────────────
 *
 * 1. **El acuse sale en el mismo frame que el mensaje** (punto 5 del criterio).
 *    O sea que `leer()` no puede esperar a nadie.
 * 2. **La regla 2 prohíbe `await` y `async` en todo `src/`**, y hay un guardián
 *    que lo hace cumplir sobre este mismo directorio.
 * 3. **El proveedor no está en el camino del primer movimiento** (punto 2), y
 *    eso se afirma comparando dos corridas contra un control positivo.
 *
 * Las tres juntas dejan exactamente una salida: **este paquete no llama al
 * modelo, lo DESCRIBE.** `leer()` devuelve la lectura y, si la confianza quedó
 * baja, una `Consulta`: qué preguntaría, con qué vocabulario y con qué llave de
 * caché. Qué se hace con eso es del llamador, que sí puede esperar. Cuando la
 * respuesta vuelve —un tick después, o treinta segundos después, o nunca—
 * `revisar()` produce una lectura nueva.
 *
 * **No es un patrón inventado para la ocasión:** es el mismo que
 * `perceive/src/bucle.ts` usa para el reloj de pared. Necesita saber si un tick
 * llegó tarde, que es tiempo del sistema, y **no lo llama**: lo recibe. La
 * frontera con el mundo asincrónico es el llamador, no el paquete.
 *
 * ─── LO QUE EL MODELO PUEDE Y NO PUEDE CONTESTAR ────────────────────────────
 *
 * No puede contestar texto libre. Si contestara texto habría que volver a
 * parsearlo, y el problema de parsear castellano es justamente el que se está
 * resolviendo — con el agravante de que el segundo texto no lo escribió una
 * persona.
 *
 * Contesta **firmas de predicado, elegidas de una lista que va en la consulta**.
 * Y aun así se validan una por una: una firma que `interpretar` no sabe leer se
 * rechaza. Es el ADR II-0001 aplicado acá — el modelo escribe habilidades y nada
 * más, o dicho en general: **el modelo propone, el código local dispone**.
 *
 * ─── EL INVARIANTE, que es lo que hace seguro tener esto puesto ─────────────
 *
 *     `revisar` NUNCA empeora una lectura.
 *
 * Si la respuesta no valida —llave vencida, firma ilegible, cláusula que no
 * existe— devuelve **la lectura original, el mismo objeto**. Y no toca las
 * cláusulas que se entendieron bien: el modelo sólo puede opinar sobre lo que el
 * lector local no supo leer.
 *
 * Está afirmado con un test que le manda basura a propósito, porque un invariante
 * sin control positivo es una intención.
 */

import { interpretar } from '@anima/plan'
import { fnv1a } from './lexico.js'
import type { ClausulaLeida, GradoDeLectura, Lectura, Lexico } from './tipos.js'

/**
 * LO QUE ESTE PAQUETE LE PREGUNTARÍA A UN MODELO.
 *
 * Es un dato, no una llamada. Se puede guardar, comparar, cachear y tirar sin
 * que nada se entere.
 */
export interface Consulta {
  /** La frase cruda, tal como se escribió. */
  readonly texto: string
  /** Qué cláusulas no se entendieron, por índice. El modelo sólo opina de éstas. */
  readonly clausulas: readonly number[]
  /** La confianza que tenía la lectura local. Sirve para decidir si vale la pena. */
  readonly confianza: number
  /**
   * LAS FIRMAS ENTRE LAS QUE EL MODELO PUEDE ELEGIR.
   *
   * Va en la consulta y no en el prompt del llamador porque el modelo tiene que
   * elegir de lo que ESTE mundo sabe establecer, y eso cambia entre partidas: el
   * catálogo es core más overlay por sesión (ADR II-0018). Un prompt con una
   * lista fija le ofrecería al modelo metas que esta partida no puede alcanzar.
   */
  readonly firmas: readonly string[]
  /**
   * EL VOCABULARIO QUE EL MUNDO SABE NOMBRAR.
   *
   * Para que el modelo pueda decir «cuando dice *leña* quiere decir *madera*» en
   * vez de inventar una sustancia. Son las claves del léxico vivo.
   */
  readonly vocabulario: readonly string[]
  /**
   * LA LLAVE DE LA CACHÉ, y lleva el léxico adentro a propósito.
   *
   * Es la caché L0 del documento de arquitectura: `fnv1a(texto | firma de
   * percepción | versión de léxico)`, con 30% de cobertura como objetivo. Si el
   * léxico cambia —el oráculo inventó una sustancia— la llave cambia y la
   * respuesta vieja deja de aplicar sola. Sin eso, la caché contestaría con el
   * vocabulario de antes, que es el bug que este proyecto ya persigue en otros
   * cuatro lugares.
   */
  readonly llave: string
}

/**
 * LO QUE UN MODELO PUEDE CONTESTAR. Nada más que esto.
 *
 * `indice` y no el texto de la cláusula: el modelo no tiene por qué poder
 * cambiar de qué frase está hablando.
 */
export interface RespuestaDelModelo {
  readonly llave: string
  readonly clausulas: readonly {
    readonly indice: number
    readonly firma: string
  }[]
}

/** La llave de caché de un texto contra un léxico. */
export function llaveDe(texto: string, lex: Lexico): string {
  return `${String(fnv1a(texto))}:${String(lex.epoca)}`
}

/**
 * ¿VALE LA PENA PREGUNTAR?
 *
 * Sólo si hay alguna cláusula que el lector local no supo llevar a una meta. Una
 * lectura entera en `entendida` no se consulta aunque la confianza sea baja: ya
 * hay algo que hacer, y consultar costaría plata para confirmar lo que ya se
 * sabe.
 *
 * `sin-camino` **tampoco** se consulta, y es la decisión menos obvia del archivo:
 * ahí el problema no es la lectura sino el mundo —se entendió perfecto y ningún
 * esquema lo establece— así que preguntarle al modelo cómo se dice no arregla
 * nada. Eso es del Hito 8, que escribe la habilidad que falta.
 */
const SE_CONSULTAN: readonly GradoDeLectura[] = ['orientacion', 'no-entendida']

/** La consulta de una lectura, o `undefined` si no hay nada que preguntar. */
export function consultaDe(l: Lectura, lex: Lexico, firmas: readonly string[]): Consulta | undefined {
  const flojas: number[] = []
  for (const [i, c] of l.clausulas.entries()) {
    if (SE_CONSULTAN.includes(c.grado)) flojas.push(i)
  }
  if (flojas.length === 0) return undefined
  return {
    texto: l.crudo,
    clausulas: flojas,
    confianza: l.confianza,
    firmas,
    vocabulario: [...lex.entradas.keys()],
    llave: llaveDe(l.crudo, lex),
  }
}

/**
 * LA LECTURA CORREGIDA POR EL MODELO.
 *
 * Devuelve **el mismo objeto** `l` cuando la respuesta no aporta nada, y eso es
 * parte del contrato: quien llame puede comparar por identidad para saber si
 * hubo cambio, sin volver a mirar el contenido.
 */
export function revisar(l: Lectura, r: RespuestaDelModelo, lex: Lexico): Lectura {
  // 1 · La llave. Una respuesta de otro texto o de otro léxico no aplica.
  if (r.llave !== llaveDe(l.crudo, lex)) return l

  const nuevas: ClausulaLeida[] = [...l.clausulas]
  let cambio = false

  for (const p of r.clausulas) {
    // 2 · El índice tiene que existir. `Number.isInteger` y no `>= 0` a secas:
    //     un `1.5` indexaría a `undefined` sin que nada se queje.
    if (!Number.isInteger(p.indice)) continue
    const vieja = nuevas[p.indice]
    if (vieja === undefined) continue

    // 3 · El modelo sólo opina de lo que el lector local no supo leer. Una
    //     cláusula ya entendida no se toca ni aunque el modelo insista: si la
    //     lectura local llegó a una meta, esa meta la produjo el léxico de este
    //     mundo y vale más que una propuesta de afuera.
    if (!SE_CONSULTAN.includes(vieja.grado)) continue

    // 4 · La firma tiene que ser legible por el mismo lector que usa la mente.
    if (interpretar(p.firma) === undefined) continue

    nuevas[p.indice] = {
      ...vieja,
      firma: p.firma,
      grado: 'entendida',
      leidaPor: 'modelo',
      // La confianza NO sube a 1: el modelo acertó una firma, no demostró que
      // entendió. Se deja en el umbral, que es el piso de «alcanza para
      // comprometer conducta» y ni un punto más.
      confianza: UMBRAL_DEL_MODELO,
      porque: `«${p.firma}», que no supe leer sola y el modelo propuso`,
    }
    cambio = true
  }

  if (!cambio) return l
  return {
    ...l,
    clausulas: nuevas,
    confianza: nuevas.reduce((a, c) => (c.confianza < a ? c.confianza : a), 1),
  }
}

/**
 * Lo que vale una cláusula que arregló el modelo.
 *
 * Es exactamente el umbral por omisión de `leer()`, y está escrito como
 * constante propia para que se pueda mover sin tocar el otro: son dos decisiones
 * distintas que hoy dan el mismo número. Una dice «bajo esto no comprometo
 * conducta»; ésta dice «esto es lo que vale la palabra de un modelo».
 */
export const UMBRAL_DEL_MODELO = 0.5

/** Los grados que se consultan, para que un test los barra. */
export const GRADOS_QUE_SE_CONSULTAN = SE_CONSULTAN
