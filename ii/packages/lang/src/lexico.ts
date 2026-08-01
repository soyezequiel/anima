/**
 * EL LÉXICO VIVO — lo que el mundo sabe nombrar, sacado de los datos.
 *
 * «Vivo» quiere decir una cosa concreta: **no hay ninguna lista de palabras acá
 * adentro**. Las palabras salen de `Physics` —los `lexeme` de las sustancias y
 * de los procesos— así que el día que el oráculo invente una sustancia nueva, su
 * nombre y sus sinónimos entran al léxico sin que nadie toque este archivo.
 *
 * Es la misma decisión que `substance.ts` explica en el comentario de `Lexeme`:
 * un diccionario aparte se desincroniza, y ése fue el bug de `DSL_REFERENCE` de
 * Ánima I — una referencia mantenida a mano que se separó del código y nadie se
 * enteró hasta que el modelo no pudo colocar un bloque.
 *
 * ─── Lo que este archivo NO puede derivar, y por qué está aparte ────────────
 *
 * Los verbos del cuidador y las metas que el mundo no nombra (*fuego*, *comida*,
 * *trampa*) **no salen de ningún dato**: son el puente entre cómo se habla y
 * cómo se llaman las cosas acá, y hay que escribirlos. Viven en `alias.ts`,
 * separados a propósito, para que se pueda contar cuánto conocimiento humano
 * lleva el sistema y no se confunda con lo que el mundo trae solo.
 *
 * ─── LA MEDICIÓN QUE JUSTIFICA QUE `alias.ts` EXISTA ────────────────────────
 *
 * Se corrieron once frases reales de castellano contra este léxico, el derivado,
 * antes de escribir el puente:
 *
 *     COBERTURA TOTAL: 3/34 palabras (9%)
 *     VERBOS: fabricá:no traé:no andá:no comas:no hacé:no juntá:no
 *             pescá:no asá:no dejá:no conseguí:no atá:no caminar:no
 *
 * **Cero de doce**, y el número está corregido desde el que se publicó primero.
 * Aquél decía «uno de doce: `atá` → el proceso `union`», y ese acierto dependía
 * de un paso que este archivo NO da: desconjugar el voseo quitando el acento y
 * agregando una `r`. Se descartó midiendo —la misma receta da `comasr`,
 * `caminarr` y un `hacer` que no es proceso: acierta 1 y ensucia 11— así que
 * `atá` normalizado da `ata`, el lexema del mundo es `atar`, y no son iguales.
 *
 * (La cobertura también bajó de 15% a 9% por dos palabras: `con`, que el barrido
 * anterior contó como acierto contra un adjetivo, y `peces`, que exige pasar de
 * plural a singular — trabajo de `emparejar.ts`, no del léxico.)
 *
 * ─── Las tres cosas que el léxico derivado sí trae ──────────────────────────
 *
 * 1. **30 nombres de sustancia y 51 sinónimos** = 81 cadenas distintas, de las
 *    cuales 64 son de una sola palabra y 17 de varias («raíz dura», «madera
 *    verde», «trozo de carne»).
 * 2. **4 verbos de proceso**: frotar, atar, deshilachar, sacar.
 * 3. **9 adjetivos de estado** en 16 formas, que son los que `nameOf` le pega a
 *    un cuerpo según cómo esté: ardiendo, quemado, asado, crudo…
 *
 * La tercera es la única que no se puede leer de un dato, porque `adjectivesOf`
 * es privada de `physics/src/body.ts`. Se escribe acá y **hay un test que la
 * compara contra el fuente de `body.ts`**, para que agregar un adjetivo allá y
 * olvidarse acá se ponga rojo. Copiar sin guardián es exactamente el bug del
 * párrafo de arriba.
 */

import type { Physics } from '@anima/physics'
import { clave } from './normalizar.js'
import type { Denota, EntradaDeLexico, FuenteDeEntrada, Lexico } from './tipos.js'

/**
 * LOS ADJETIVOS DE ESTADO, en sus dos géneros.
 *
 * Espejo de `adjectivesOf` (`physics/src/body.ts:568`), que es privada. El
 * guardián está en `tests/el-lexico-no-se-desincroniza.test.ts`: lee el fuente
 * de `body.ts`, saca los literales de `out.push(...)` y exige que estén todos
 * acá. Sin ese test esta lista es justo el bug que el encabezado denuncia.
 *
 * Van los dos géneros escritos y no derivados con una regla: `agree()` sólo
 * cambia la `o` final, así que «ardiendo» y «a medio cocinar» son invariables y
 * una regla automática los rompería.
 */
const ESTADOS: readonly (readonly [lema: string, ...formas: string[]])[] = [
  ['ardiendo', 'ardiendo'],
  ['consumido', 'consumido', 'consumida'],
  ['quemado', 'quemado', 'quemada'],
  ['chamuscado', 'chamuscado', 'chamuscada'],
  ['asado', 'asado', 'asada'],
  ['crudo', 'crudo', 'cruda'],
  ['a medio cocinar', 'a medio cocinar'],
  ['mojado', 'mojado', 'mojada'],
  ['podrido', 'podrido', 'podrida'],
]

/** Cuántas palabras tiene una clave ya normalizada. */
function cuantasPalabras(k: string): number {
  let n = 1
  for (let i = 0; i < k.length; i++) if (k.charCodeAt(i) === 32) n++
  return n
}

/**
 * Junta denotaciones bajo la misma clave en vez de pisarlas.
 *
 * Pisar sería una pérdida de información silenciosa, y hay casos reales: `grano`
 * es el nombre de una sustancia y también un `FormId`, y `liquido` es sinónimo
 * de `agua` y también un `Tag`. Quien lea decide con más contexto del que hay
 * acá; este archivo no puede elegir por él.
 *
 * La `fuente` que queda es la de la PRIMERA, y el orden de construcción es
 * deliberado: nombres antes que sinónimos, y lo derivado antes que el alias. Así
 * «esto lo sabe el mundo» le gana a «esto lo escribimos nosotros», que es la
 * respuesta honesta cuando las dos son ciertas.
 */
function sumar(
  m: Map<string, EntradaDeLexico>,
  texto: string,
  d: Denota,
  fuente: FuenteDeEntrada,
): void {
  const k = clave(texto)
  if (k.length === 0) return
  const ya = m.get(k)
  if (ya === undefined) {
    m.set(k, { clave: k, palabras: cuantasPalabras(k), denota: [d], fuente })
    return
  }
  // Sin duplicar: la misma denotación dos veces no agrega nada y ensucia el
  // digest, que tiene que ser estable.
  for (const otra of ya.denota) if (mismaDenota(otra, d)) return
  m.set(k, { ...ya, denota: [...ya.denota, d] })
}

function mismaDenota(a: Denota, b: Denota): boolean {
  if (a.k !== b.k) return false
  if (a.k === 'sustancia' && b.k === 'sustancia') return a.id === b.id
  if (a.k === 'proceso' && b.k === 'proceso') return a.id === b.id
  if (a.k === 'estado' && b.k === 'estado') return a.lema === b.lema
  if (a.k === 'verbo' && b.k === 'verbo') return a.id === b.id
  if (a.k === 'meta' && b.k === 'meta') return a.firma === b.firma
  return false
}

/** Una entrada de alias, tal como `alias.ts` la escribe. */
export interface AliasCrudo {
  readonly dice: readonly string[]
  readonly denota: Denota
}

/**
 * EL LÉXICO DE ESTA FÍSICA, más el puente que se le pase.
 *
 * `alias` es un parámetro y no un import fijo por la misma razón por la que
 * `PlannerCatalogView` dejó de ser una constante de módulo en el tramo A del
 * Gate 5→6: una constante de módulo es un estado global compartido entre
 * partidas, y dos partidas no se pueden contaminar. Acá además vale para poder
 * medir el léxico **sin** puente, que es como salió el 9%.
 */
export function lexicoDe(phys: Physics, alias: readonly AliasCrudo[] = []): Lexico {
  const m = new Map<string, EntradaDeLexico>()

  // 1 · Los nombres de las sustancias. Primero, para que ganen la `fuente`.
  for (const [id, s] of phys.substances) sumar(m, s.lexeme.nombre, { k: 'sustancia', id }, 'nombre')
  // 2 · Y sus sinónimos, que son 51 contra 30 nombres: la mayor parte del léxico.
  for (const [id, s] of phys.substances) {
    for (const sin of s.lexeme.sinonimos) sumar(m, sin, { k: 'sustancia', id }, 'sinonimo')
  }
  // 3 · Los cuatro verbos que el mundo sí tiene.
  for (const [id, p] of phys.processes) sumar(m, p.lexeme.nombre, { k: 'proceso', id }, 'proceso')
  // 4 · Los adjetivos con los que `nameOf` describe un cuerpo.
  for (const [lema, ...formas] of ESTADOS) {
    for (const f of formas) sumar(m, f, { k: 'estado', lema }, 'estado')
  }
  // 5 · Y recién ahora el puente escrito a mano.
  for (const a of alias) for (const d of a.dice) sumar(m, d, a.denota, 'alias')

  let maxPalabras = 1
  for (const e of m.values()) if (e.palabras > maxPalabras) maxPalabras = e.palabras

  const digest = digestDe(m)
  return {
    entradas: m,
    maxPalabras,
    digest,
    epoca: fnv1a(digest),
    buscar(tokens: readonly string[], i: number): EntradaDeLexico | undefined {
      // De la más larga a la más corta: «madera verde» tiene que ganarle a
      // «madera», porque quien pidió la verde no pidió la otra. Arrancar por la
      // corta y quedarse con la primera es el bug clásico del emparejamiento
      // por prefijo, y acá tiene 17 entradas donde manifestarse.
      const tope = Math.min(maxPalabras, tokens.length - i)
      for (let n = tope; n >= 1; n--) {
        let k = ''
        for (let j = 0; j < n; j++) k = j === 0 ? (tokens[i] ?? '') : `${k} ${tokens[i + j] ?? ''}`
        const e = m.get(k)
        if (e !== undefined) return e
      }
      return undefined
    },
  }
}

// ─── La identidad del léxico ────────────────────────────────────────────────
//
// Copiado en forma de `catalogo.ts` y por el mismo motivo: el orden de las
// claves de un `Map` es el de inserción, y el mismo léxico construido en otro
// orden tiene que dar el mismo número. Se ordena el texto y recién después se
// hashea.

function comparaTexto(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

/** El texto canónico: una línea por entrada, con sus denotaciones ordenadas. */
function digestDe(m: ReadonlyMap<string, EntradaDeLexico>): string {
  const renglones: string[] = []
  for (const e of m.values()) {
    const ds = e.denota.map(textoDeDenota)
    ds.sort(comparaTexto)
    renglones.push(`${e.clave}|${e.fuente}|${ds.join(',')}`)
  }
  renglones.sort(comparaTexto)
  return renglones.join('\n')
}

function textoDeDenota(d: Denota): string {
  switch (d.k) {
    case 'sustancia':
      return `sustancia:${d.id}`
    case 'proceso':
      return `proceso:${d.id}`
    case 'estado':
      return `estado:${d.lema}`
    case 'verbo':
      return `verbo:${d.id}`
    case 'meta':
      return `meta:${d.firma}`
  }
}

const FNV_OFFSET = 0x811c9dc5 | 0
const FNV_PRIME = 0x01000193

/**
 * FNV-1a de 32 bits, escrito acá y no importado.
 *
 * Es la misma decisión que `oracle/src/pregunta.ts:171` declara en su
 * comentario: son ocho líneas, y un paquete «util» compartido es la clase de
 * dependencia que en tres meses tiene adentro la mitad del juego. `Math.imul` y
 * no `a * b` porque el producto de dos enteros de 32 bits pasa 2⁵³ y un double
 * redondearía distinto según el motor.
 */
export function fnv1a(s: string): number {
  let h = FNV_OFFSET
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h = Math.imul(h ^ ((c >>> 8) & 0xff), FNV_PRIME)
    h = Math.imul(h ^ (c & 0xff), FNV_PRIME)
  }
  return h >>> 0
}
