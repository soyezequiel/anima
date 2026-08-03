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
import { acusar } from './leer.js'
import { fnv1a } from './lexico.js'
import type { Dicho } from './habla.js'
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
  /**
   * LA VENTANA RECIENTE DE LA CHARLA — el mismo contexto que recibió la lectura.
   *
   * Es el C2 aplicado acá: *«Toda petición cognitiva relevante recibe el mismo
   * `ConversationContext`. No se mantienen contextos incompatibles para
   * `dialogue`, `interpret.command` y la fragua»*. Sin esto, el lector local
   * resuelve «comé eso» con el turno anterior y el modelo lee la frase suelta —
   * o sea que los dos contestan sobre entradas distintas y la comparación entre
   * ellos deja de significar algo.
   *
   * Va como dato plano y acotado (`CanalDeHabla.ventana`), no el log entero: el
   * historial durable **no se copia entero a cada prompt**.
   */
  readonly contexto: readonly Dicho[]
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

/**
 * La consulta de una lectura, o `undefined` si no hay nada que preguntar.
 *
 * `contexto` entra por parámetro y no se saca de ningún lado: este paquete no
 * tiene el historial —lo tiene el que llama— y es la misma forma que
 * `sabeElCatalogo` y `loQuePidio` ya usan. Sin pasarlo, la consulta sale con el
 * contexto vacío, que es lo que había antes del C2.
 */
export function consultaDe(
  l: Lectura,
  lex: Lexico,
  firmas: readonly string[],
  contexto: readonly Dicho[] = [],
): Consulta | undefined {
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
    contexto: [...contexto],
  }
}

/**
 * Lo que hace falta para juzgar una respuesta del modelo.
 *
 * Los dos campos son opcionales y los dos **deberían pasarse siempre**. Son
 * opcionales por la misma razón que `OpcionesDeLectura.sabeElCatalogo`: quien
 * llama no siempre tiene el catálogo a mano, y este archivo prefiere ser
 * prudente antes que inventarse el dato. Pero lo que se pierde sin ellos está
 * escrito abajo, portón por portón, y no es poco.
 */
export interface OpcionesDeRevision {
  /**
   * LAS FIRMAS QUE LA CONSULTA OFRECIÓ. Es `Consulta.firmas`, tal cual.
   *
   * Sin esto, el único portón contra una firma inventada es `interpretar`, que
   * sólo dice que es **sintácticamente legible**. `toxicity>=1` es legible y
   * nunca se ofreció.
   */
  readonly ofrecidas?: readonly string[]
  /** ¿Algún esquema establece esta firma? El mismo gancho que `leer()` usa. */
  readonly sabeElCatalogo?: (firma: string) => boolean
}

/**
 * LA LECTURA CORREGIDA POR EL MODELO.
 *
 * Devuelve **el mismo objeto** `l` cuando la respuesta no aporta nada, y eso es
 * parte del contrato: quien llame puede comparar por identidad para saber si
 * hubo cambio, sin volver a mirar el contenido.
 *
 * ─── LOS DOS PORTONES QUE FALTABAN, Y LO QUE COSTARON ───────────────────────
 *
 * La primera versión tenía cuatro portones y le faltaban dos. Un adversario lo
 * midió sobre el corpus:
 *
 *     consultables 61 · coladas como «entendida» con una firma inalcanzable: 62
 *
 * Los dos que faltaban:
 *
 * 1. **la firma tiene que ser UNA DE LAS QUE SE OFRECIERON.** El encabezado de
 *    este archivo decía —y dice— que el modelo «contesta firmas elegidas de una
 *    lista que va en la consulta», y `Consulta.firmas` existe exactamente para
 *    eso. Nadie lo hacía cumplir: `interpretar` sólo dice que la firma es
 *    legible. `toxicity>=1` es legible, no se ofreció nunca, y entraba.
 * 2. **el grado se GRADÚA, no se asigna.** Escribía `grado: 'entendida'` a
 *    secas, sin preguntarle a `sabeElCatalogo` — que es justo el portón que
 *    `graduar()` usa en el camino local para separar `entendida` de
 *    `sin-camino`. O sea que `revisar` producía **un estado que `leer` no puede
 *    producir**: una meta comprometida que ningún esquema establece.
 *
 * El segundo es el que rompe el invariante de este archivo, y de una forma que
 * el barrido de basura no podía ver: sus cuatro clases de basura mueren todas en
 * `interpretar`. Lo que se cuela es una firma **válida y fuera de lugar**, que es
 * exactamente lo que un modelo alucina.
 */
export function revisar(
  l: Lectura,
  r: RespuestaDelModelo,
  lex: Lexico,
  o: OpcionesDeRevision = {},
): Lectura {
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

    // 3 · El modelo sólo opina de lo que el lector local no supo resolver.
    if (!SE_CONSULTAN.includes(vieja.grado)) continue

    // 4 · La firma tiene que ser legible por el mismo lector que usa la mente.
    if (interpretar(p.firma) === undefined) continue

    // 5 · Y tiene que ser una de las que se ofrecieron.
    if (o.ofrecidas !== undefined && !o.ofrecidas.includes(p.firma)) continue

    // 6 · El grado se GRADÚA con el mismo portón que el camino local. Sin
    //     catálogo no se puede saber, y entonces no se promete: queda en el
    //     grado más prudente de los dos.
    const alcanzable = o.sabeElCatalogo === undefined ? undefined : o.sabeElCatalogo(p.firma)
    const grado: GradoDeLectura =
      alcanzable === true ? 'entendida' : alcanzable === false ? 'sin-camino' : 'orientacion'

    nuevas[p.indice] = {
      ...vieja,
      firma: p.firma,
      grado,
      leidaPor: 'modelo',
      // La confianza NO sube a 1: el modelo acertó una firma, no demostró que
      // entendió. Se deja en el umbral, que es el piso de «alcanza para
      // comprometer conducta» y ni un punto más.
      confianza: UMBRAL_DEL_MODELO,
      porque:
        grado === 'entendida'
          ? `«${p.firma}», que no supe leer sola y el modelo propuso`
          : `el modelo propuso «${p.firma}» y ningún esquema conocido lo establece`,
    }
    cambio = true
  }

  if (!cambio) return l
  return {
    ...l,
    clausulas: nuevas,
    confianza: nuevas.reduce((a, c) => (c.confianza < a ? c.confianza : a), 1),
    // EL ACUSE SE REHACE, y no viaja de la lectura vieja. Sin esta línea, una
    // cláusula que el modelo arregló volvía con «no te entendí del todo» al
    // lado, o sea la frase que la persona lee diciendo lo contrario de lo que el
    // sistema entendió. Lo encontró una corrida contra el modelo de verdad.
    acuse: acusar(nuevas),
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

// ═══ CÓMO SE LE PREGUNTA AL MODELO, Y CÓMO SE LEE LO QUE CONTESTA ══════════
//
// Las dos funciones de acá abajo vivían en `demo/proveedor.ts`, y se mudaron sin
// cambiarles una línea. El motivo es de dónde se pueden correr:
//
// `demo/proveedor.ts` importa el transporte, y el transporte hace `spawn`. O sea
// que **cualquiera que importe ese archivo se lleva `node:child_process`**, y en
// un bundle de navegador eso no arranca. Mientras el único consumidor era un
// demo de terminal, daba igual. Desde que el juego le pregunta a Codex por el
// depósito, no: el navegador necesita ARMAR el prompt y LEER la respuesta, y no
// tiene que poder mandarla — de eso se encarga el backend, que es el único que
// tiene las credenciales.
//
// Y las dos son puras: texto adentro, texto afuera. Siguen sin llamar a nadie,
// que es lo que el ADR II-0024 le pide a este paquete.

/**
 * EL PROMPT. Corto a propósito: cada palabra de más es una forma de que el
 * modelo conteste otra cosa.
 *
 * El vocabulario va porque es lo que le permite decir «cuando dice *leña*
 * quiere decir *madera*» en vez de inventar una sustancia — y sale de `Physics`,
 * así que si el oráculo inventa algo, el prompt lo incluye solo.
 */
export function promptDe(c: Consulta): string {
  return [
    'Sos el lector de un juego. Una persona le habla a su criatura y vos decidís',
    'a qué ESTADO DEL MUNDO se refiere. No expliques nada.',
    '',
    `LA FRASE: «${c.texto}»`,
    '',
    'Las cláusulas que no se entendieron son estos índices: ' + c.clausulas.join(', '),
    '',
    'LOS ÚNICOS ESTADOS QUE ESTE MUNDO SABE CONSEGUIR (elegí de acá, textual):',
    ...c.firmas.map((f) => `  ${f}`),
    '',
    'Lo que el mundo sabe nombrar, por si ayuda a entender de qué habla:',
    `  ${c.vocabulario.slice(0, 120).join(', ')}`,
    '',
    'Elegí el estado que MEJOR sirva a lo que la persona quiere, aunque no sea',
    'literal: si pide comida, el estado es tenerla en la mano.',
    '',
    'CONTESTÁ SÓLO CON UN JSON, sin markdown y sin comentarios, de esta forma:',
    '  {"clausulas":[{"indice":0,"firma":"<una de las de arriba, textual>"}]}',
    '',
    'Sólo contestá {"clausulas":[]} si NINGUNA de las de arriba acerca a lo pedido.',
  ].join('\n')
}

/** El JSON que el modelo tenía que devolver, sacado de lo que sea que devolvió. */
export function leerRespuesta(salida: string, llave: string): RespuestaDelModelo | undefined {
  // ─── SE CUENTAN LAS LLAVES, no se adivina con un regex ────────────────────
  //
  // La primera versión buscaba con
  // `/\{[\s\S]*?"clausulas"[\s\S]*?\}\s*\}/` y fallaba con la respuesta
  // correcta: `{"clausulas":[{"indice":0,"firma":"..."}]}` termina en `}` `]`
  // `}`, y ese `]` del medio rompe el `\}\s*\}`. O sea que el proveedor
  // contestaba bien y el demo decía «no aportó nada».
  //
  // Un objeto JSON no se reconoce con una expresión regular —el anidamiento no
  // es regular— así que se cuenta: desde cada `{`, se avanza sumando y restando
  // llaves hasta cerrar, salteando las que están adentro de un string.
  const candidatos: string[] = []
  for (let i = 0; i < salida.length; i++) {
    if (salida[i] !== '{') continue
    let hondo = 0
    let enTexto = false
    let escapado = false
    for (let j = i; j < salida.length; j++) {
      const c = salida[j]
      if (escapado) {
        escapado = false
        continue
      }
      if (c === '\\') {
        escapado = true
        continue
      }
      if (c === '"') enTexto = !enTexto
      if (enTexto) continue
      if (c === '{') hondo++
      else if (c === '}') {
        hondo--
        if (hondo === 0) {
          const trozo = salida.slice(i, j + 1)
          if (trozo.includes('"clausulas"')) candidatos.push(trozo)
          break
        }
      }
    }
  }
  // De atrás para adelante: los CLI escriben encabezados y razonamiento antes del
  // mensaje final, y el último objeto con la forma correcta es el que vale.
  for (let i = candidatos.length - 1; i >= 0; i--) {
    const crudo = candidatos[i]
    if (crudo === undefined) continue
    try {
      const v = JSON.parse(crudo) as { clausulas?: unknown }
      if (!Array.isArray(v.clausulas)) continue
      const cs: { indice: number; firma: string }[] = []
      for (const c of v.clausulas) {
        const o = c as { indice?: unknown; firma?: unknown }
        if (typeof o.indice === 'number' && typeof o.firma === 'string') {
          cs.push({ indice: o.indice, firma: o.firma })
        }
      }
      return { llave, clausulas: cs }
    } catch {
      continue
    }
  }
  return undefined
}
