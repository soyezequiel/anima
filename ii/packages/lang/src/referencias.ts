/**
 * «EL tronco», «ESO», «traeLO» — de una referencia hablada a un `Ref`.
 *
 * ─── LO PRIMERO: acá NO se escribe un resolutor ─────────────────────────────
 *
 * El Hito 6 dice «`resolveReference` portado casi tal cual», y se midió cuánto
 * de eso es verdad **antes** de escribir una línea. El resultado dio vuelta el
 * trabajo:
 *
 * > `ii/packages/plan/src/referencias.ts` **YA ES** un resolutor de referencias
 * > completo —`Ref` de cinco formas, `resolver`/`resolverCuerpo`/`resolverTodos`,
 * > el más cercano con desempate por id, `undefined` en vez de fantasma— y con
 * > las mismas decisiones que el de Ánima I tomaría.
 *
 * Portar el de Ánima I encima habría dejado **dos resolutores que pueden
 * contestar distinto sobre el mismo mundo**, que es exactamente el modo de falla
 * que este repo persigue. Y de sus 197 líneas, 86 son código real y la mitad de
 * ésas se portaría MUERTA: `lastMentioned` y `lastUsed` no tienen quién las
 * llene en `ii/`.
 *
 * ─── Lo que sí falta, y es lo que hay acá ───────────────────────────────────
 *
 * Dos cosas, y ninguna es resolver:
 *
 * 1. **Detectar que una frase señala algo.** «Traé un palo» y «traé el palo» son
 *    dos pedidos distintos, y hasta hoy este paquete los leía igual.
 * 2. **Acordarse de qué se nombró.** Es el `lastMentioned`/`lastUsed` que el
 *    resolutor de Ánima I daba por sentado y que en `ii/` no produce nadie —
 *    porque es memoria de la CHARLA, y la charla es este paquete.
 *
 * Con esas dos, la referencia se convierte en un `Ref` y **lo resuelve el de
 * `@anima/plan`**, contra la vista de hoy y no contra una foto.
 *
 * ─── Y las tres cosas de Ánima I que NO se portan, medidas ──────────────────
 *
 * - **filtrar por `kind`**: no existe y no puede existir (punto 12 del Gate). Lo
 *   más parecido son los `tags`, que son **6 clases donde `kind` particionaba en
 *   30**: no separan palo de junco de liana de raíz.
 * - **filtrar por `name`**: peor, porque `name` **no es un identificador**. El
 *   mismo cuerpo se llama «pescado crudo», «pescado asado» y «pescado quemado»
 *   según cómo esté, así que un resolutor por nombre deja de encontrar «el
 *   pescado» **en cuanto se cocina** — que es el paso siguiente de la cadena.
 * - **`manhattan`**: no existe en `ii/` y no se transcribe. La métrica de este
 *   proyecto es Chebyshev, y dos métricas contra el mismo `within` es el bug que
 *   aparece en la grilla como «a veces no llega».
 *
 * Por eso la memoria guarda **ids**, que es lo único que no miente.
 */

import type { BodyId } from '@anima/skills'
import type { Ref } from '@anima/plan'
import type { Dicho } from './habla.js'

/**
 * Qué tan fuerte señala una frase.
 *
 * `ninguna` no es un fracaso: «traé un palo» no señala nada y está perfecto —
 * pide uno cualquiera. La diferencia con «traé EL palo» es real y hasta hoy se
 * perdía.
 */
export type ClaseDeReferencia =
  | 'ninguna'
  | 'definida'
  | 'demostrativa'
  | 'pronominal'
  /**
   * «EL OTRO». Señala un cuerpo, pero **por descarte**: el anterior al último.
   * Es la que obligó a que la memoria guarde una lista y no dos casilleros.
   */
  | 'otra'
  /**
   * «LO QUE TE PEDÍ». No señala un cuerpo: señala un TURNO.
   *
   * Es la referencia que el C2 agregó y es de otra especie que las cuatro de
   * arriba. Las otras preguntan «¿de qué objeto hablás?»; ésta pregunta «¿de qué
   * parte de la conversación hablás?», y por eso no se resuelve con un `Ref`
   * sino con el historial (ver `loQuePidio` en `recuerdos.ts`).
   */
  | 'discursiva'

/** Los artículos definidos. «Un/una» NO están: ésos no señalan. */
const DEFINIDOS: readonly string[] = ['el', 'la', 'los', 'las', 'lo']

/**
 * «El otro», «la otra», «los otros». Sin acento y sin artículo: el artículo lo
 * mira la guarda de `referenciaDe`.
 */
const OTROS: readonly string[] = ['otro', 'otra', 'otros', 'otras']

/**
 * LAS FRASES QUE SEÑALAN LA CONVERSACIÓN, en tokens ya normalizados.
 *
 * Escritas a mano y cerradas, como `DEMOSTRATIVOS` y por lo mismo: son puente
 * entre cómo se habla y qué existe acá, o sea conocimiento humano. El documento
 * de arquitectura ya avisó que esta clase de tabla hay que presupuestarla.
 *
 * Van de más larga a más corta: «lo que te pedí» tiene que probarse antes que
 * «lo de antes» aunque ninguna sea prefijo de la otra, porque el día que una lo
 * sea el orden va a decidir y conviene que ya esté.
 */
const DISCURSIVAS: readonly (readonly string[])[] = [
  ['lo', 'que', 'te', 'pedi'],
  ['lo', 'que', 'te', 'dije'],
  ['lo', 'que', 'pedi'],
  ['eso', 'que', 'te', 'pedi'],
  ['lo', 'de', 'antes'],
  ['lo', 'mismo'],
]

/** Los demostrativos, sin acento porque `clave()` ya los sacó. */
const DEMOSTRATIVOS: readonly string[] = [
  'eso',
  'esto',
  'ese',
  'esa',
  'esos',
  'esas',
  'este',
  'esta',
  'estos',
  'estas',
  'aquel',
  'aquella',
  'aquello',
]

/**
 * Los enclíticos que convierten un verbo en un pedido con objeto: «traeLO»,
 * «comeLA», «dejaLOS».
 *
 * Van de más largo a más corto y **eso importa**: `-los` tiene que probarse
 * antes que `-lo`, o «traelos» se lee como «traelo» con una `s` de sobra.
 */
const ENCLITICOS: readonly string[] = ['los', 'las', 'lo', 'la', 'le', 'les']

/**
 * El verbo sin su enclítico, si lo tiene.
 *
 * Devuelve `undefined` cuando no hay ninguno **o cuando lo que queda es
 * demasiado corto para ser un verbo**: sin ese piso, «solo» se leería como
 * «so» + «lo», y «malas» como «ma» + «las».
 */
export function sinEnclitico(palabra: string): string | undefined {
  for (const e of ENCLITICOS) {
    if (!palabra.endsWith(e)) continue
    const raiz = palabra.slice(0, palabra.length - e.length)
    if (raiz.length >= 3) return raiz
  }
  return undefined
}

/**
 * Qué clase de referencia hay en esta posición.
 *
 * `conoceElVerbo` entra por parámetro porque el enclítico sólo cuenta si lo que
 * queda ES un verbo: «traelo» señala y «pelo» no, y la única forma de
 * distinguirlos es preguntarle al léxico. Sin ese portón, cualquier palabra
 * terminada en `-lo` sería un pedido con objeto.
 */
export function referenciaDe(
  tokens: readonly string[],
  i: number,
  conoceElVerbo: (palabra: string) => boolean,
): ClaseDeReferencia {
  const t = tokens[i]
  if (t === undefined) return 'ninguna'
  // ─── LAS DOS NUEVAS VAN PRIMERO, Y NO ES ARBITRARIO ─────────────────────
  //
  // Las dos empiezan con una palabra que ya significaba otra cosa: «lo que te
  // pedí» arranca con `lo`, que es un artículo definido, y «el otro» arranca con
  // `el`. Con el orden al revés, el artículo gana en la posición anterior y las
  // dos se leen como «el X» — que es exactamente lo que no son.
  if (empiezaDiscursiva(tokens, i)) return 'discursiva'
  for (const o of OTROS) if (t === o) return 'otra'
  for (const d of DEMOSTRATIVOS) if (t === d) return 'demostrativa'
  const raiz = sinEnclitico(t)
  if (raiz !== undefined && conoceElVerbo(raiz)) return 'pronominal'
  // Un artículo definido señala sólo si viene algo detrás: «traé el» a secas no
  // es una referencia, es una frase cortada. Y no señala si lo que viene es un
  // «otro»: «el otro» no es «el X», es la referencia por descarte.
  for (const d of DEFINIDOS) {
    const que = tokens[i + 1]
    if (t === d && que !== undefined && !OTROS.includes(que)) return 'definida'
  }
  return 'ninguna'
}

/** ¿Alguna de las frases del discurso empieza exactamente acá? */
function empiezaDiscursiva(tokens: readonly string[], i: number): boolean {
  for (const frase of DISCURSIVAS) {
    let entra = true
    for (let k = 0; k < frase.length; k++) {
      if (tokens[i + k] !== frase[k]) {
        entra = false
        break
      }
    }
    if (entra) return true
  }
  return false
}

/**
 * LA MEMORIA DE LA CHARLA — lo que se nombró y lo que se usó.
 *
 * Es el `lastMentioned`/`lastUsed` que el resolutor de Ánima I daba por sentado
 * y que en `ii/` **no lo produce nadie**. Vive acá porque es memoria de la
 * conversación, y la conversación es este paquete: la mente tiene `Creencias`
 * —Betas sobre `(contexto, tag)`— y el `LibroDeLugares` guarda celdas pisadas.
 * Ninguna de las dos sabe de qué se habló.
 *
 * ─── Guarda ids y nada más, y por qué ───────────────────────────────────────
 *
 * Porque un id es lo único que no cambia. El `name` de un cuerpo cambia al
 * cocinarse, sus `tags` son 6 clases para 30 sustancias, y su posición cambia a
 * cada tick. Lo que se resuelve contra la vista de HOY es el resolutor de
 * `@anima/plan`; acá sólo se recuerda a QUÉ apuntar.
 *
 * ─── La cota, y por qué DEJÓ DE SER DOS ─────────────────────────────────────
 *
 * Eran dos casilleros —lo último nombrado y lo último usado— con este argumento
 * escrito: *«una referencia a algo que se nombró hace veinte frases ya no la
 * resuelve un pronombre»*. **Eso sigue siendo cierto y no alcanzaba**, y lo
 * mostró una frase del criterio del C2: «traé EL OTRO».
 *
 * «El otro» no es un pronombre que busca lo más saliente: es una referencia **por
 * descarte**, y para descartar hacen falta por lo menos dos. Con dos casilleros
 * donde `usar` pisa a `nombrar`, los dos terminan apuntando al mismo cuerpo y no
 * hay «otro» que devolver.
 *
 * Así que ahora guarda una LISTA CORTA, del más nuevo al más viejo y sin
 * repetidos. Corta en serio —`CUANTOS_NOMBRADOS`— porque el argumento de arriba
 * no se cayó: lo que se agregó es el segundo, no una memoria larga.
 */
export const CUANTOS_NOMBRADOS = 8

export class MemoriaDeLaCharla {
  /** Del más nuevo al más viejo, sin repetidos. `[0]` es «eso»; `[1]` es «el otro». */
  readonly #nombrados: BodyId[] = []
  #usado: BodyId | undefined

  #alFrente(id: BodyId): void {
    const i = this.#nombrados.indexOf(id)
    if (i >= 0) this.#nombrados.splice(i, 1)
    this.#nombrados.unshift(id)
    if (this.#nombrados.length > CUANTOS_NOMBRADOS) this.#nombrados.pop()
  }

  /** Alguien lo nombró en la charla — el cuidador o la criatura. */
  nombrar(id: BodyId): void {
    this.#alFrente(id)
  }

  /** La criatura lo agarró, lo movió o lo transformó. */
  usar(id: BodyId): void {
    this.#usado = id
    // Usar algo también lo vuelve lo más saliente: después de agarrar el palo,
    // «eso» es el palo. Es el mismo criterio que la `salience` de Ánima I le
    // daba a lo que está en la mano, dicho de la forma más simple que funciona.
    this.#alFrente(id)
  }

  /**
   * EL ANTERIOR AL ÚLTIMO. `undefined` si sólo se nombró uno, y eso es correcto:
   * «el otro» sin un otro no se degrada a «cualquiera», se queda sin resolver.
   */
  get otro(): BodyId | undefined {
    return this.#nombrados[1]
  }

  /** Todos los que se nombraron, del más nuevo al más viejo. */
  get nombrados(): readonly BodyId[] {
    return [...this.#nombrados]
  }

  get ultimoNombrado(): BodyId | undefined {
    return this.#nombrados[0]
  }

  get ultimoUsado(): BodyId | undefined {
    return this.#usado
  }

  olvidar(): void {
    this.#nombrados.length = 0
    this.#usado = undefined
  }
}

/**
 * LA MEMORIA DE LA CHARLA, DERIVADA DEL LOG — y no guardada aparte.
 *
 * ─── Por qué se deriva, que es la decisión del C1 ───────────────────────────
 *
 * Una `MemoriaDeLaCharla` viva al costado del log sería un segundo almacén con
 * su propio guardado, su propia restauración y su propia forma de quedar
 * desincronizado. Derivarla de la ventana reciente la hace **una vista**: lo
 * único durable es el historial, y esto es lo que se lee de él.
 *
 * La consecuencia se puede probar, y es lo que el criterio de C1 pide: con el
 * log restaurado, «comé eso» tiene a qué apuntar; **con el mismo mundo y el log
 * vacío, no**. Si la memoria viviera aparte —o se reconstruyera de lo que la
 * criatura tiene en la mano— ese control negativo daría verde y no probaría nada.
 *
 * ─── Y quién nombró qué ─────────────────────────────────────────────────────
 *
 * Una `entrada` es del cuidador y **nombra**; cualquier otra clase la produjo el
 * agente narrando lo que hizo, y eso **usa**. Es la misma distinción que
 * `MemoriaDeLaCharla` ya hacía, leída del log en vez de recibida por llamada.
 */
export function memoriaDe(ventana: readonly Dicho[]): MemoriaDeLaCharla {
  const m = new MemoriaDeLaCharla()
  // Del más viejo al más nuevo: lo último gana, que es lo que «eso» quiere decir.
  for (const d of ventana) {
    if (d.sobre === undefined) continue
    if (d.clase === 'entrada') m.nombrar(d.sobre)
    else m.usar(d.sobre)
  }
  return m
}

/**
 * EL `Ref` DE UNA REFERENCIA, o `undefined` si no hay a qué apuntar.
 *
 * `undefined` es una respuesta y no un error: «comé eso» sin nada nombrado antes
 * es una frase que no se puede cumplir, y el grado `orientacion` es lo correcto
 * — la criatura se orienta y pregunta, que es lo que haría cualquiera.
 *
 * **No se degrada a «cualquier cosa».** Es la decisión que el resolutor de Ánima
 * I declara en su encabezado y que vale igual acá: una referencia específica que
 * no se puede resolver **no se convierte en una genérica**, porque agarrar el
 * palo equivocado es peor que preguntar cuál.
 */
export function aRef(clase: ClaseDeReferencia, m: MemoriaDeLaCharla): Ref | undefined {
  switch (clase) {
    case 'ninguna':
    case 'definida':
      // La definida NO se resuelve todavía. «El tronco» pide mirar el mundo por
      // sustancia, y `Where` sólo filtra por cualidades numéricas: no hay forma
      // de escribir «los de madera». Se detecta —que es lo que faltaba— y se
      // deja sin `Ref` en vez de inventar uno que apunte a otra cosa.
      return undefined
    case 'discursiva':
      // No apunta a un cuerpo: apunta a un turno. Lo resuelve el historial, no
      // el resolutor de `@anima/plan`. Devolver un `Ref` acá sería inventarle un
      // objeto a una frase que habla de la conversación.
      return undefined
    case 'demostrativa':
    case 'pronominal': {
      const id = m.ultimoNombrado
      return id === undefined ? undefined : { k: 'id', id }
    }
    case 'otra': {
      // Por descarte y no por saliencia: el anterior al último.
      const id = m.otro
      return id === undefined ? undefined : { k: 'id', id }
    }
  }
}

/** Las tres listas, para que un test las barra y para que se vean juntas. */
export const ARTICULOS_DEFINIDOS = DEFINIDOS
export const DEMOSTRATIVOS_CONOCIDOS = DEMOSTRATIVOS
export const ENCLITICOS_CONOCIDOS = ENCLITICOS
