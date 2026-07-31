/**
 * LOS TIPOS DE `@anima/lang`, y la decisión que los ordena a todos.
 *
 * ─── Lo que este paquete produce, y lo que NO ───────────────────────────────
 *
 * Produce una **lectura**: qué pidió alguien, en cláusulas, con cuánta confianza
 * se entendió cada una. Nada más. No decide qué hacer —eso es de `@anima/plan` y
 * de la escalera de `@anima/mind`, que ya existen— y no toca el mundo.
 *
 * La costura estaba escrita desde antes: `Lectura` y `goalGraph` viven en
 * `@anima/plan` desde hace tramos, con un comentario que dice «`@anima/lang` no
 * existe hasta el Hito 6, así que hasta entonces esto lo arma la mente o un
 * test». Este paquete es el que llena ese extremo.
 *
 * ─── LA DECISIÓN, y sale de una medición ────────────────────────────────────
 *
 * Antes de escribir una línea se midió cuánto castellano entiende el mundo por
 * su cuenta: once frases reales contra el léxico que la física trae puesto dan
 * **15% de cobertura, 5 palabras de 34**, y de doce verbos el mundo conoce UNO
 * (`atá` → el proceso `union`). El mundo sabe decir *frotar, atar, deshilachar,
 * sacar*; nadie habla así.
 *
 * De ahí sale la forma de todo el paquete: **una lectura NUNCA falla**. Tiene
 * grados, y el más bajo sigue siendo una respuesta:
 *
 * | grado | qué quiere decir | qué se hace con eso |
 * |---|---|---|
 * | `entendida` | hay un predicado y el catálogo sabe establecerlo | va a `plan()` como meta |
 * | `sin-camino` | se entendió y NINGÚN esquema lo establece | se acusa y se dice qué falta |
 * | `orientacion` | no se entendió del todo, pero sí hacia DÓNDE mirar | se emite un gesto reversible |
 * | `no-entendida` | ni eso | se pregunta, y el cuerpo sigue con lo suyo |
 *
 * **Ninguno de los cuatro es «nada»**, y eso es literalmente el punto 1 del
 * criterio del hito. La regla del documento —«corte a los 25 ms: no existe rama
 * que devuelva "nada"»— acá es un tipo y no una intención: `Lectura` no tiene
 * variante vacía.
 *
 * ─── Por qué la confianza es un número y no un booleano ─────────────────────
 *
 * Porque es el portón por donde entra el modelo en el Hito 8, y ese portón tiene
 * que existir ANTES para que enchufarlo no toque el camino crítico. Por debajo
 * del umbral la lectura no se compromete a una conducta sino a **orientarse**,
 * que es una apuesta mucho más barata de equivocar — y el modelo, cuando exista,
 * corrige la lectura mientras el cuerpo ya se mueve.
 */

import type { ProcessId, SubstanceId } from '@anima/physics'

// ─── Lo que una palabra quiere decir ────────────────────────────────────────

/**
 * A qué apunta una palabra del léxico. Cinco formas, y la frontera entre ellas
 * es de dónde salió el dato:
 *
 * - `sustancia`, `proceso` y `estado` los **deriva el mundo**: son los `lexeme`
 *   de la física y los adjetivos que `nameOf` sabe pegar. Si alguien agrega una
 *   sustancia, entran solas.
 * - `verbo` y `meta` los **escribimos nosotros**: son el puente entre cómo se
 *   habla y cómo se llaman las cosas acá. El documento de arquitectura ya avisó
 *   que esto había que presupuestarlo, y la medición dijo cuánto.
 */
export type Denota =
  | { readonly k: 'sustancia'; readonly id: SubstanceId }
  | { readonly k: 'proceso'; readonly id: ProcessId }
  /** Un adjetivo que `nameOf` puede pegar: «asado», «crudo», «ardiendo». */
  | { readonly k: 'estado'; readonly lema: string }
  /** Un verbo del cuidador. No es un proceso: «traer» no es una ley del mundo. */
  | { readonly k: 'verbo'; readonly id: VerboId }
  /**
   * Una firma de predicado, escrita a mano porque el mundo no la nombra.
   * «fuego» no es una sustancia ni un proceso: es `emitsPower>0`.
   */
  | { readonly k: 'meta'; readonly firma: string }

/**
 * Los verbos que un cuidador usa de verdad.
 *
 * **Ninguno es un proceso del mundo**, y ésa es toda la razón por la que esta
 * lista existe. El mundo tiene cuatro verbos —frotar, atar, deshilachar, sacar—
 * y la medición encontró que de doce verbos de frases reales, once no están.
 *
 * La lista se escribe cerrada a propósito: un `string` suelto invita a que cada
 * quien invente el suyo, y entonces el puente deja de ser revisable.
 */
export type VerboId =
  | 'traer'
  | 'ir'
  | 'hacer'
  | 'juntar'
  | 'comer'
  | 'cocinar'
  | 'pescar'
  | 'atar'
  | 'encender'
  | 'soltar'
  | 'buscar'
  | 'esperar'
  | 'parar'

// ─── El léxico ──────────────────────────────────────────────────────────────

/** De dónde salió una entrada. Es lo que permite decir «esto no lo inventamos». */
export type FuenteDeEntrada = 'nombre' | 'sinonimo' | 'proceso' | 'estado' | 'alias'

export interface EntradaDeLexico {
  /** Normalizada por `clave()`: minúscula, sin acentos, palabras con un espacio. */
  readonly clave: string
  /** Cuántas palabras ocupa. Decide el desempate: la más larga gana. */
  readonly palabras: number
  /**
   * Todo lo que esa clave puede querer decir, y puede ser más de una cosa.
   *
   * No es hipotético: «grano» es el nombre de una sustancia **y** un `FormId`,
   * y «liquido» es sinónimo de agua **y** un `Tag`. Colapsar eso a una sola
   * lectura acá sería decidir con menos información de la que va a haber en el
   * paso siguiente.
   */
  readonly denota: readonly Denota[]
  readonly fuente: FuenteDeEntrada
}

export interface Lexico {
  readonly entradas: ReadonlyMap<string, EntradaDeLexico>
  /** La entrada más larga, en palabras: la cota del emparejamiento por prefijo. */
  readonly maxPalabras: number
  /**
   * LA IDENTIDAD DEL LÉXICO, derivada del contenido.
   *
   * Existe por lo mismo que `registryDigest` en `@anima/plan`: la caché de
   * lectura se llavea con `texto | percepción | léxico`, y si el léxico cambia
   * sin que su llave cambie, la caché contesta con el vocabulario de antes.
   */
  readonly digest: string
  readonly epoca: number
  /**
   * La entrada MÁS LARGA que empieza exactamente en `tokens[i]`, o `undefined`.
   *
   * Más larga y no la primera: «madera verde» y «madera» son dos sustancias
   * distintas, y quien pidió la verde no pidió la otra.
   */
  buscar(tokens: readonly string[], i: number): EntradaDeLexico | undefined
}

// ─── La lectura ─────────────────────────────────────────────────────────────

/**
 * Cuánto se entendió. **Los cuatro son una respuesta**; ninguno es «nada».
 *
 * El orden es de más a menos compromiso, y no es cosmético: el criterio del hito
 * pide que el cuerpo se mueva sin esperar a nadie, y sólo los dos primeros
 * grados comprometen una conducta. Los otros dos comprometen un gesto, que es
 * reversible y barato de equivocar.
 */
export type GradoDeLectura = 'entendida' | 'sin-camino' | 'orientacion' | 'no-entendida'

/**
 * Qué clase de cosa falta cuando algo no se puede hacer.
 *
 * Son CUATRO y las pide el caso de aceptación del hito con todas las letras:
 * informar qué falta distinguiendo plano, habilidad, proceso o física. Hoy
 * `plan()` devuelve un `gap` con una firma y un `why`, que es una sola respuesta
 * para cuatro preguntas distintas del cuidador.
 */
export type ClaseDeFalta = 'plano' | 'habilidad' | 'proceso' | 'fisica'

/**
 * Una cláusula leída.
 *
 * `liga` y `bindeaSlot` son exactamente los campos que `Lectura` de
 * `@anima/plan` espera, y están acá con el mismo nombre para que el puente sea
 * una copia y no una traducción.
 */
export interface ClausulaLeida {
  /** El texto tal cual lo escribió quien habló. Se conserva para el acuse. */
  readonly crudo: string
  readonly grado: GradoDeLectura
  /** En `[0, 1]`. Bajo el umbral no se compromete conducta, se compromete gesto. */
  readonly confianza: number
  /** La firma del predicado, cuando hay. `interpretar()` de `@anima/plan` la lee. */
  readonly firma?: string
  /**
   * El verbo que se leyó, si hubo.
   *
   * Está aparte de `firma` porque **no todo pedido es una meta**. «Pará» y
   * «esperá» no describen un estado del mundo al que llegar: describen qué hacer
   * con lo que ya está pasando. Un tipo que sólo tuviera `firma` obligaría a
   * inventarles un predicado, y un predicado inventado es una meta que el
   * planificador va a perseguir de verdad.
   */
  readonly verbo?: VerboId
  /** Sobre qué. Sirve para el acuse y para el `bindeaSlot` del paso siguiente. */
  readonly objetos: readonly Denota[]
  /** `'despues'` la ata a la anterior; `'y'` la deja suelta (orden parcial). */
  readonly liga: 'y' | 'despues'
  readonly bindeaSlot?: string
  /** Negada o prohibida. Se decide ANTES del anclaje, ver `polaridad.ts`. */
  readonly polaridad: 'afirma' | 'niega'
  /** Por qué salió así. Es lo que el cuidador lee cuando algo no se pudo. */
  readonly porque: string
}

export interface Lectura {
  readonly crudo: string
  readonly clausulas: readonly ClausulaLeida[]
  /**
   * LO QUE SE DICE EN EL ACTO, antes de que nada se decida.
   *
   * No es decoración: el punto 4 del criterio pide que el acuse aparezca en el
   * mismo frame que el mensaje, y la única forma de garantizarlo es que salga de
   * la misma llamada que leyó la frase. Un acuse que espera a `plan()` ya perdió.
   */
  readonly acuse: string
  /** La confianza de la peor cláusula: la frase vale lo que su eslabón flojo. */
  readonly confianza: number
}
