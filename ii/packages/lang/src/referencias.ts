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

/**
 * Qué tan fuerte señala una frase.
 *
 * `ninguna` no es un fracaso: «traé un palo» no señala nada y está perfecto —
 * pide uno cualquiera. La diferencia con «traé EL palo» es real y hasta hoy se
 * perdía.
 */
export type ClaseDeReferencia = 'ninguna' | 'definida' | 'demostrativa' | 'pronominal'

/** Los artículos definidos. «Un/una» NO están: ésos no señalan. */
const DEFINIDOS: readonly string[] = ['el', 'la', 'los', 'las', 'lo']

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
  for (const d of DEMOSTRATIVOS) if (t === d) return 'demostrativa'
  const raiz = sinEnclitico(t)
  if (raiz !== undefined && conoceElVerbo(raiz)) return 'pronominal'
  // Un artículo definido señala sólo si viene algo detrás: «traé el» a secas no
  // es una referencia, es una frase cortada.
  for (const d of DEFINIDOS) {
    if (t === d && tokens[i + 1] !== undefined) return 'definida'
  }
  return 'ninguna'
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
 * ─── La cota, y por qué es tan chica ────────────────────────────────────────
 *
 * Dos: lo último nombrado y lo último usado. No es una limitación técnica — es
 * que **una referencia a algo que se nombró hace veinte frases ya no la resuelve
 * un pronombre**, la resuelve una descripción. Guardar cien ids daría la ilusión
 * de memoria conversacional sin la gramática que hace falta para usarla.
 */
export class MemoriaDeLaCharla {
  #nombrado: BodyId | undefined
  #usado: BodyId | undefined

  /** Alguien lo nombró en la charla — el cuidador o la criatura. */
  nombrar(id: BodyId): void {
    this.#nombrado = id
  }

  /** La criatura lo agarró, lo movió o lo transformó. */
  usar(id: BodyId): void {
    this.#usado = id
    // Usar algo también lo vuelve lo más saliente: después de agarrar el palo,
    // «eso» es el palo. Es el mismo criterio que la `salience` de Ánima I le
    // daba a lo que está en la mano, dicho de la forma más simple que funciona.
    this.#nombrado = id
  }

  get ultimoNombrado(): BodyId | undefined {
    return this.#nombrado
  }

  get ultimoUsado(): BodyId | undefined {
    return this.#usado
  }

  olvidar(): void {
    this.#nombrado = undefined
    this.#usado = undefined
  }
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
    case 'demostrativa':
    case 'pronominal': {
      const id = m.ultimoNombrado
      return id === undefined ? undefined : { k: 'id', id }
    }
  }
}

/** Las tres listas, para que un test las barra y para que se vean juntas. */
export const ARTICULOS_DEFINIDOS = DEFINIDOS
export const DEMOSTRATIVOS_CONOCIDOS = DEMOSTRATIVOS
export const ENCLITICOS_CONOCIDOS = ENCLITICOS
