/**
 * LEER — de una frase a una lectura, y NUNCA a «nada».
 *
 * Es la función que el criterio del hito mide. Su contrato es corto y raro:
 *
 * > `leer()` siempre devuelve una `Lectura` con al menos una cláusula.
 * > No tiene rama vacía, no tira, no devuelve `undefined`.
 *
 * El punto 1 del criterio dice «ninguna de las 200 frases devuelve nada», y la
 * forma barata de cumplirlo sería un `if` al final que rellena. Acá no es un
 * `if`: es que **el tipo no tiene variante vacía** y los cuatro grados de
 * `GradoDeLectura` son respuestas. La regla del documento —«corte a los 25 ms:
 * no existe rama que devuelva "nada"»— está en `tipos.ts` como tipo.
 *
 * ─── El orden de los pasos, que es el orden en que pasan las cosas ──────────
 *
 * 1. **normalizar y cortar en cláusulas.** «Hacé una caña y andá a pescar,
 *    después asá el pescado» son tres pedidos, y el tercero va después.
 * 2. **la polaridad de cada cláusula, antes de anclar nada.** El porqué está
 *    entero en `polaridad.ts`: entre anclar y negar hay un tick en el que la
 *    criatura ya arrancó para el río.
 * 3. **emparejar palabra por palabra** contra el léxico, con plurales y con una
 *    edición de tolerancia (`emparejar.ts`).
 * 4. **componer**: el verbo y lo que lo acompaña deciden la firma. Es la tabla
 *    de alias de COMPOSICIÓN que el documento de arquitectura mandó
 *    presupuestar, y está abajo con ese nombre.
 * 5. **graduar**: qué tan comprometida sale la lectura.
 * 6. **acusar**, en la misma llamada. Un acuse que espera a `plan()` ya perdió
 *    el punto 4 del criterio.
 *
 * ─── LO QUE ESTE ARCHIVO NO PUEDE HACER, Y ESTÁ MEDIDO ──────────────────────
 *
 * `Predicado` de `@anima/plan` **no puede hablar del lugar**. Se probó con
 * `wet>=0.9`, con `at.x>=8` y con `distance<=1`: los tres dan `undefined` en
 * `interpretar`. O sea que «andá al río» no es una meta que este sistema pueda
 * recibir, y no es una limitación de la lectura sino de la capa de abajo.
 *
 * La respuesta honesta a eso NO es inventar un predicado: es el grado
 * `orientacion`. Se entendió hacia dónde mirar, se emite un gesto reversible
 * —que es una apuesta barata de equivocar— y se dice en voz alta. Un predicado
 * inventado sería una meta que el planificador persigue de verdad.
 */

import type { Physics, SubstanceId, Tag } from '@anima/physics'
import { PUENTE } from './alias.js'
import { emparejar } from './emparejar.js'
import { lexicoDe } from './lexico.js'
import { polaridadDe } from './polaridad.js'
import { aRef, referenciaDe, sinEnclitico } from './referencias.js'
import type { ClaseDeReferencia, MemoriaDeLaCharla } from './referencias.js'
import { tokenizar } from './normalizar.js'
import type {
  ClausulaLeida,
  Denota,
  GradoDeLectura,
  Lectura,
  Lexico,
  VerboId,
} from './tipos.js'

// ─── Cortar en cláusulas ────────────────────────────────────────────────────

/**
 * Las palabras que separan un pedido del siguiente, con qué tan fuerte atan.
 *
 * `despues` y `luego` producen un ORDEN; `y` y `mientras` dejan las dos
 * cláusulas sueltas. Es exactamente la distinción que `Lectura` de `@anima/plan`
 * espera en su campo `liga`, y por eso los valores son sus dos strings y no una
 * enumeración propia.
 *
 * La coma no está acá: `tokenizar` ya la comió (parte por lo que no es letra ni
 * dígito). Cortar por coma pediría conservarla, y una coma en castellano separa
 * cláusulas tanto como enumera sustantivos — «traé leña, agua y piedras» no son
 * tres pedidos.
 */
const LIGAS: readonly (readonly [palabra: string, liga: 'y' | 'despues'])[] = [
  ['despues', 'despues'],
  ['luego', 'despues'],
  ['entonces', 'despues'],
  ['y', 'y'],
  ['mientras', 'y'],
]

interface Trozo {
  readonly tokens: readonly string[]
  readonly liga: 'y' | 'despues'
}

/**
 * La frase partida.
 *
 * La primera cláusula sale con `liga: 'y'` porque no hay nada antes a lo que
 * atarla, y `goalGraph` de `@anima/plan` ya lo espera así (su decisión 3 grita si
 * la primera dice `'despues'`).
 */
function cortar(tokens: readonly string[]): readonly Trozo[] {
  const out: Trozo[] = []
  let actual: string[] = []
  let liga: 'y' | 'despues' = 'y'
  for (const t of tokens) {
    let corta: 'y' | 'despues' | undefined
    for (const [p, l] of LIGAS) if (t === p) corta = l
    if (corta !== undefined) {
      // Una liga al principio de todo no corta nada: no hay qué separar.
      if (actual.length > 0) {
        out.push({ tokens: actual, liga })
        actual = []
      }
      liga = corta
      continue
    }
    actual.push(t)
  }
  if (actual.length > 0) out.push({ tokens: actual, liga })
  // Una frase vacía sigue siendo una frase: devuelve un trozo vacío para que
  // el resto del camino tenga qué leer y conteste «no te entendí».
  if (out.length === 0) out.push({ tokens: [], liga: 'y' })
  return out
}

// ─── LA TABLA DE ALIAS DE COMPOSICIÓN ───────────────────────────────────────
//
// Acá está el conocimiento que el documento de arquitectura nombró y mandó
// presupuestar: qué quiere decir un verbo del cuidador EN ESTE MUNDO.
//
// Cada fila se probó contra `plan()` con una vista real antes de escribirse, y
// al lado va lo que dio. Las que dan `gap` están igual y a propósito: informar
// que falta algo es una respuesta, y es la que el caso de aceptación pide.

/**
 * LA FIRMA DE LO COCIDO, tal como la física la define.
 *
 * No es «asado»: es digerible y sin veneno. Sale de los `establishes` de la ley
 * de desnaturalización y es una de las 13 filas del catálogo core.
 */
const COCIDO = 'holding(tag:carnoso,digestibility>=0.85,toxicity<=0.05)'

/** Tener algo de esta clase en la mano. La única forma de pedir un objeto. */
function tener(tag: Tag): string {
  return `holding(tag:${tag})`
}

/**
 * El tag con el que se pide una sustancia.
 *
 * De los siete tags, `Predicado` los admite todos y **la mente sólo sabe
 * conseguir uno**: seis de siete dan `gap` (medido). Así que esta función
 * devuelve el tag más específico de la sustancia y deja que el grado diga la
 * verdad; forzar `carnoso` para que «funcione» sería contestar otra cosa.
 *
 * «Más específico» = el que menos sustancias comparte. Se calcula del catálogo,
 * no de una lista: `carnoso` distingue 3 de 30 y `organico` distingue 20.
 */
function tagDe(phys: Physics, id: SubstanceId): Tag | undefined {
  const s = phys.substances.get(id)
  if (s === undefined || s.tags.length === 0) return undefined
  let mejor: Tag | undefined
  let mejorCuantas = Number.MAX_SAFE_INTEGER
  for (const t of s.tags) {
    let cuantas = 0
    for (const otra of phys.substances.values()) if (otra.tags.includes(t)) cuantas++
    // Desempate por el nombre del tag, para que no dependa del orden del Map.
    if (cuantas < mejorCuantas || (cuantas === mejorCuantas && mejor !== undefined && t < mejor)) {
      mejor = t
      mejorCuantas = cuantas
    }
  }
  return mejor
}

/**
 * QUÉ ESTADO DEL MUNDO PIDE ESTE VERBO CON ESTOS OBJETOS.
 *
 * `undefined` quiere decir «este verbo no pide un estado», y no es un fallo:
 * `parar`, `esperar` y `soltar` describen qué hacer con lo que ya está pasando.
 * Ver el comentario de `ClausulaLeida.verbo`.
 */
function componer(
  phys: Physics,
  verbo: VerboId,
  objetos: readonly Denota[],
): string | undefined {
  // ─── EL ATAJO DE LA META, y por qué NO es global ─────────────────────────
  //
  // Si el objeto ya ES una meta, manda él: «hacé fuego» no compone nada, el
  // fuego ya es `emitsPower>0`. Pero esto valía para todos los verbos y estaba
  // mal, y lo destapó una frase del corpus: «atá la vara con la hebra» tiene
  // `hebra` adentro, que el puente mapea a `freeStrandEnds>=1`, así que el
  // atajo contestaba «conseguí una punta suelta» cuando lo que se pidió es que
  // ATE las dos cosas. Ahí la hebra es MATERIAL, no meta.
  //
  // La regla que quedó: el atajo vale para los verbos de CONSEGUIR —donde lo
  // que se nombra es lo que se quiere— y no para los de TRANSFORMAR, donde lo
  // que se nombra es con qué.
  const CONSEGUIR: readonly VerboId[] = ['traer', 'juntar', 'buscar', 'hacer', 'encender']
  if (CONSEGUIR.includes(verbo)) {
    for (const o of objetos) if (o.k === 'meta') return o.firma
  }

  const sustancia = objetos.find((o) => o.k === 'sustancia')
  const proceso = objetos.find((o) => o.k === 'proceso')
  const estado = objetos.find((o) => o.k === 'estado')

  switch (verbo) {
    // ── Conseguir algo y traerlo. Da plan sólo con carne (6 de 7 tags gapean).
    case 'traer':
    case 'juntar':
    case 'buscar': {
      if (sustancia?.k !== 'sustancia') return undefined
      const t = tagDe(phys, sustancia.id)
      return t === undefined ? undefined : tener(t)
    }

    // ── Pescar, que es la palabra que el documento usó de ejemplo para decir
    //    que este puente hace falta. No es «extraer»: es sacar algo carnoso.
    case 'pescar':
      return tener('carnoso')

    // ── Cocinar y comer piden lo mismo: comida en condiciones de comerse. La
    //    diferencia entre los dos es de conducta, no de meta, y quien la use
    //    tiene el verbo al lado para distinguirlas.
    case 'cocinar':
    case 'comer':
      return COCIDO

    // ── Hacer fuego. `encender` y `hacer` con un estado «ardiendo» caen acá.
    case 'encender':
      return 'emitsPower>0'

    // ── Fabricar. Sin objeto no se puede saber qué; con un proceso conocido,
    //    lo que ese proceso establece.
    case 'hacer': {
      if (estado?.k === 'estado' && estado.lema === 'ardiendo') return 'emitsPower>0'
      if (proceso?.k === 'proceso') {
        const p = phys.processes.get(proceso.id)
        const primero = p?.establishes[0]
        return primero
      }
      if (sustancia?.k !== 'sustancia') return undefined
      const t = tagDe(phys, sustancia.id)
      return t === undefined ? undefined : tener(t)
    }

    // ── Atar. Lo que `union` establece y que sí llega a un plan es el alcance;
    //    `jointCount>=1` se probó y da `gap`.
    case 'atar':
      return 'reach>=2'

    // ── Y los tres que no piden un estado del mundo.
    case 'ir':
    case 'soltar':
    case 'esperar':
    case 'parar':
      return undefined
  }
}

// ─── Graduar ────────────────────────────────────────────────────────────────

/**
 * De cuánto se entendió a qué tan comprometida sale la lectura.
 *
 * `sabeElCatalogo` es una función y no un booleano porque quien lee no tiene por
 * qué conocer el catálogo: se lo pasa el que llama, y si no se lo pasa, la
 * lectura no distingue `entendida` de `sin-camino` y se queda en la más
 * prudente. Es la misma forma que `MenteOptions.catalogo` tomó en el tramo A del
 * Gate 5→6, y por la misma razón: una constante de módulo es estado compartido
 * entre partidas.
 */
export interface OpcionesDeLectura {
  readonly phys: Physics
  readonly lexico?: Lexico
  /** ¿Algún esquema establece esta firma? Sin esto no se distingue el sin-camino. */
  readonly sabeElCatalogo?: (firma: string) => boolean
  /**
   * ¿EL MUNDO YA LA CUMPLE?
   *
   * Existe por una medición incómoda: «fabricá una trampa para peces» sale como
   * `catch>0`, y `Predicado` es **existencial** — dice «que haya algo que
   * atrape», no «que vos hagas uno». Con algo así a la vista, la meta ya está
   * cumplida, y la mente la descarta **con razón**: perseguir lo que ya tenés te
   * deja parado.
   *
   * Lo que estaba mal no era el descarte: era que **nadie lo decía**. Desde
   * afuera se ve exactamente igual que «no me hace caso». Medido sobre la escena
   * canónica en el tick 40: `catch>0` y `reach>=2` ya están cumplidas.
   */
  readonly yaEstaCumplida?: (firma: string) => boolean
  /** Bajo esto no se compromete conducta, se compromete gesto. Por omisión 0,5. */
  readonly umbral?: number
  /**
   * LO QUE SE NOMBRÓ ANTES EN LA CHARLA.
   *
   * Sin esto, «comé eso» no tiene a qué apuntar y sale por `orientacion` — que
   * es correcto y es lo que pasa en la primera frase de una conversación. Quien
   * mantenga una charla se guarda una y se la pasa siempre la misma.
   */
  readonly memoria?: MemoriaDeLaCharla
  /**
   * LO QUE SE PIDIÓ ANTES, para «hacé lo que te pedí».
   *
   * Es la otra mitad del contexto conversacional, y es de otra especie que
   * `memoria`: aquélla dice a qué OBJETO apuntar, ésta a qué TURNO. El C2 las
   * necesita a las dos y por eso viajan juntas.
   *
   * Una función y no un valor, por lo mismo que `sabeElCatalogo`: quien llama
   * tiene el historial y este paquete no, y calcularlo cuesta recorrerlo — no
   * hay por qué pagarlo en las frases que no lo miran, que son casi todas.
   */
  readonly loQuePidio?: () => string | undefined
}

const UMBRAL_POR_OMISION = 0.5

function graduar(
  firma: string | undefined,
  verbo: VerboId | undefined,
  confianza: number,
  umbral: number,
  sabeElCatalogo: ((f: string) => boolean) | undefined,
  yaEstaCumplida: ((f: string) => boolean) | undefined,
): GradoDeLectura {
  // Sin nada reconocido, ni orientación hay.
  if (firma === undefined && verbo === undefined) return 'no-entendida'
  // Con el verbo pero sin meta —«andá al río», «pará»— se orienta. El caso del
  // lugar es el más común y está medido: `Predicado` no habla de celdas.
  if (firma === undefined) return 'orientacion'
  // Con meta pero con la lectura floja, tampoco se compromete conducta.
  if (confianza < umbral) return 'orientacion'
  // Y con meta firme van DOS preguntas, en este orden. Primero si ya está: no
  // tiene sentido contestar «no sé cómo» sobre algo que el mundo ya cumple.
  if (yaEstaCumplida !== undefined && yaEstaCumplida(firma)) return 'ya-esta'
  if (sabeElCatalogo !== undefined && !sabeElCatalogo(firma)) return 'sin-camino'
  return 'entendida'
}

// ─── El acuse ───────────────────────────────────────────────────────────────

/**
 * LO QUE SE CONTESTA EN EL ACTO.
 *
 * Sale de la misma llamada que leyó la frase, y ésa es toda su razón de ser: el
 * punto 4 del criterio pide que el acuse aparezca en el mismo frame que el
 * mensaje, y la única forma de garantizarlo por construcción es que no dependa
 * de nada que venga después. No mira el catálogo, no mira el mundo, no espera un
 * tick.
 *
 * Está en rioplatense corto porque lo lee una persona mientras espera.
 */
function acusar(cs: readonly ClausulaLeida[]): string {
  const peor = cs.reduce((a, b) => (b.confianza < a.confianza ? b : a), cs[0] as ClausulaLeida)
  switch (peor.grado) {
    case 'entendida':
      return cs.length > 1 ? 'dale, arranco por lo primero' : 'dale, voy'
    case 'ya-esta':
      return 'eso ya está. ¿querés otra cosa?'
    case 'sin-camino':
      return 'te entendí, pero no sé cómo hacerlo todavía'
    case 'orientacion':
      return 'no te entendí del todo, voy tanteando'
    case 'no-entendida':
      return 'no te entendí. ¿qué querés que haga?'
  }
}

// ─── Leer ───────────────────────────────────────────────────────────────────

/**
 * LA FUNCIÓN DEL HITO. Nunca falla, nunca devuelve vacío.
 *
 * El léxico se construye una vez y se pasa por `opciones.lexico`; si no se pasa,
 * se arma acá con el puente puesto. Armarlo cuesta un barrido de 30 sustancias y
 * no está pensado para el camino caliente: quien llame por cada mensaje tiene
 * que guardarse el suyo.
 */
export function leer(texto: string, opciones: OpcionesDeLectura): Lectura {
  const lex = opciones.lexico ?? lexicoDe(opciones.phys, PUENTE)
  const umbral = opciones.umbral ?? UMBRAL_POR_OMISION
  const trozos = cortar(tokenizar(texto))

  const clausulas: ClausulaLeida[] = []
  for (const trozo of trozos) {
    const polaridad = polaridadDe(trozo.tokens)

    // El barrido: cada token empareja o no, y lo que empareja se acumula.
    let verbo: VerboId | undefined
    const objetos: Denota[] = []
    let cubiertos = 0
    let suma = 0
    let vistos = 0
    // La referencia se busca ANTES de emparejar, por lo mismo que la polaridad:
    // «traelo» es un verbo con objeto, y si se empareja primero se pierde el
    // enclítico. `conoceElVerbo` mira el léxico para que «pelo» no cuente.
    let clase: ClaseDeReferencia = 'ninguna'
    for (let i = 0; i < trozo.tokens.length && clase === 'ninguna'; i++) {
      clase = referenciaDe(trozo.tokens, i, (p) => lex.entradas.has(p))
    }
    for (let i = 0; i < trozo.tokens.length; ) {
      // Un verbo con enclítico —«traelo»— no está en el léxico tal cual, así que
      // se prueba también su raíz. Sin esto, «traelo» era una palabra
      // desconocida y la frase entera caía a `no-entendida`.
      const raiz = sinEnclitico(trozo.tokens[i] ?? '')
      if (raiz !== undefined && lex.entradas.has(raiz) && !lex.entradas.has(trozo.tokens[i] ?? '')) {
        const e = lex.entradas.get(raiz)
        if (e !== undefined) {
          for (const d of e.denota) {
            if (d.k === 'verbo' && verbo === undefined) verbo = d.id
            else objetos.push(d)
          }
          cubiertos++
          suma += 0.9
          vistos++
          i++
          continue
        }
      }
      const m = emparejar(lex, trozo.tokens, i)
      if (m === undefined) {
        i++
        vistos++
        continue
      }
      for (const d of m.entrada.denota) {
        if (d.k === 'verbo' && verbo === undefined) verbo = d.id
        else objetos.push(d)
      }
      cubiertos += m.consume
      suma += m.confianza * m.consume
      vistos += m.consume
      i += m.consume
    }

    // La confianza de la cláusula: cuánto se cubrió, ponderado por qué tan
    // seguro fue cada emparejamiento. Una palabra que no se reconoció NO baja a
    // cero: «traé un palo» tiene un `un` que no está en ningún léxico y la
    // frase se entiende perfecto.
    const confianza = vistos === 0 ? 0 : suma / vistos
    const propia = verbo === undefined ? firmaSuelta(objetos) : componer(opciones.phys, verbo, objetos)
    // ─── «HACÉ LO QUE TE PEDÍ»: la meta la trae el HISTORIAL ────────────────
    //
    // Sólo cuando la frase no pudo componer una propia. Si dijo «hacé fuego y lo
    // que te pedí», el fuego manda: lo que está escrito ahora pesa más que lo
    // que se recuerda, siempre. Y si no hay historial —o no hay ningún pedido en
    // él— queda `undefined` y el grado dice la verdad: no se entendió del todo.
    const firma = propia ?? (clase === 'discursiva' ? opciones.loQuePidio?.() : undefined)
    const grado = graduar(
      firma,
      verbo,
      confianza,
      umbral,
      opciones.sabeElCatalogo,
      opciones.yaEstaCumplida,
    )

    clausulas.push({
      crudo: trozo.tokens.join(' '),
      grado,
      confianza,
      ...(firma === undefined ? {} : { firma }),
      liga: trozo.liga,
      ...(verbo === undefined ? {} : { verbo }),
      objetos,
      ...(clase === 'ninguna'
        ? {}
        : {
            referencia: {
              clase,
              ...(() => {
                const r = opciones.memoria === undefined ? undefined : aRef(clase, opciones.memoria)
                return r === undefined ? {} : { ref: r }
              })(),
            },
          }),
      polaridad,
      leidaPor: 'local',
      porque: porqueDe(grado, firma, verbo, cubiertos, vistos),
    })
  }

  return {
    crudo: texto,
    clausulas,
    acuse: acusar(clausulas),
    confianza: clausulas.reduce((a, c) => (c.confianza < a ? c.confianza : a), 1),
  }
}

/**
 * Una cláusula sin verbo puede seguir siendo un pedido: «fuego», a secas, o
 * «comida». Es la forma en que una persona contesta una pregunta, y aparece en
 * el corpus real.
 */
function firmaSuelta(objetos: readonly Denota[]): string | undefined {
  for (const o of objetos) if (o.k === 'meta') return o.firma
  return undefined
}

/** El «por qué» que viaja hasta el cuidador. Corto, y dice qué faltó. */
function porqueDe(
  grado: GradoDeLectura,
  firma: string | undefined,
  verbo: VerboId | undefined,
  cubiertos: number,
  vistos: number,
): string {
  const cobertura = `${String(cubiertos)}/${String(vistos)} palabras`
  switch (grado) {
    case 'entendida':
      return `«${String(firma)}», ${cobertura}`
    case 'ya-esta':
      return `entendí «${String(firma)}» y el mundo ya lo cumple`
    case 'sin-camino':
      return `entendí «${String(firma)}» y ningún esquema conocido lo establece`
    case 'orientacion':
      return verbo === undefined
        ? `sólo reconocí ${cobertura}`
        : `entendí el verbo «${verbo}» y no a qué estado del mundo lleva`
    case 'no-entendida':
      return `no reconocí ninguna palabra con contenido (${cobertura})`
  }
}
