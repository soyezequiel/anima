/**
 * NORMALIZAR — la primera etapa del camino, y la más fácil de hacer mal.
 *
 * Todo lo que este paquete compara —lo que el cuidador escribió contra lo que el
 * mundo sabe nombrar— pasa por acá primero. Si dos formas de escribir la misma
 * palabra no llegan a la misma clave, el trie no engancha y la frase se cae al
 * carril lento sin que nada se ponga rojo.
 *
 * ─── Por qué NO se usa `toLocaleLowerCase` ──────────────────────────────────
 *
 * Porque el resultado depende del idioma del sistema y este proyecto tiene una
 * regla contra eso. El caso canónico es la `i` turca:
 *
 *     'I'.toLocaleLowerCase('tr')  →  'ı'   (i sin punto)
 *     'I'.toLowerCase()            →  'i'
 *
 * O sea que en una máquina con locale turco, «Ir al río» y «ir al río» darían
 * dos claves distintas. `toLowerCase()` a secas usa la tabla Unicode fija y da
 * lo mismo en todos lados, que es exactamente lo que hace falta.
 *
 * ─── Por qué los acentos se van, y por qué la eñe también ────────────────────
 *
 * `normalize('NFD')` parte cada letra acentuada en dos: la letra pelada y una
 * **marca combinante**. `río` pasa a ser `r · i · U+0301 · o`, y borrando el
 * rango de las marcas queda `rio`. Es una tabla del estándar Unicode, no una
 * lista que escribimos nosotros, así que no se olvida de ninguna.
 *
 * Y con la eñe pasa lo mismo sin que nadie lo pida: `ñ` es `n` + `U+0303`, así
 * que **`caña` y `cana` llegan a la misma clave**. Eso es una decisión, no un
 * descuido: quien escribe rápido en un teclado que no tiene eñe a mano igual
 * tiene que poder pedir una caña. El costo es que dos palabras que sólo se
 * distinguen por la eñe se confundirían, y en el léxico del mundo no hay
 * ninguna así — lo verifica un test, porque el día que la haya hay que enterarse.
 *
 * ─── Lo que NO hace ─────────────────────────────────────────────────────────
 *
 * No corta en palabras. Cortar es de `tokenizar`, que vive acá abajo y separa
 * por lo que NO es letra ni dígito, no por espacio: «hacé fuego,después pescá»
 * sin espacio después de la coma tiene que dar tres palabras y no dos.
 *
 * No corrige de ortografía. Eso es del emparejamiento difuso de `readFast`, que
 * trabaja **sobre** estas claves ya normalizadas y no sobre el texto crudo.
 */

/**
 * Las marcas combinantes de Unicode, que es lo que NFD deja suelto.
 *
 * **Van escritas como escape y no como el carácter**, y no es cosmético: una
 * marca combinante adentro de una clase de caracteres se dibuja **encima del
 * corchete** y la regex se lee `[-]`. `physics/src/plano.ts` ya cobró esta
 * lección con seis NUL crudos que `grep` contestaba «Binary file matches»; acá
 * es peor, porque el carácter sí se ve — se ve mal, arriba de otro.
 */
const MARCAS = /[\u0300-\u036f]/g

/**
 * Lo que separa una palabra de la siguiente: cualquier cosa que no sea letra
 * latina ni dígito. Se escribe por lo que SÍ es y no por lo que no es, para que
 * una coma, un signo de pregunta o tres espacios corten igual.
 *
 * Va después de bajar a minúscula y sacar las marcas, así que a esta altura no
 * quedan mayúsculas ni acentos que contemplar.
 */
const NO_ES_PALABRA = /[^a-z0-9]+/

/**
 * Una clave de comparación: minúscula, sin acentos, sin espacio de sobra.
 *
 * El orden importa y es el único que funciona: **NFD antes de borrar**, porque
 * en la forma compuesta (`é` como un solo carácter) no hay ninguna marca que
 * borrar y el acento sobreviviría.
 */
export function clave(texto: string): string {
  return texto.normalize('NFD').replace(MARCAS, '').toLowerCase().trim()
}

/**
 * El texto partido en palabras normalizadas, sin vacías.
 *
 * Devuelve un array nuevo siempre: quien lo llame va a indexarlo y compararlo, y
 * un array compartido invita a que alguien lo ordene en el lugar.
 */
export function tokenizar(texto: string): readonly string[] {
  const partes = clave(texto).split(NO_ES_PALABRA)
  const out: string[] = []
  for (const p of partes) if (p.length > 0) out.push(p)
  return out
}

/**
 * Dos claves comparadas sin depender del idioma del sistema.
 *
 * Es el reemplazo de `localeCompare`, que está prohibido por la misma razón que
 * `toLocaleLowerCase`: en castellano el orden de la ICU pone `ñ` entre `n` y `o`
 * y en el orden de código va después de `z`, y cuál de los dos sale depende de
 * qué ICU trajo el motor. Acá el orden es el de los puntos de código, que es
 * feo para un humano y **el mismo en todas las máquinas** — y estas claves no
 * las lee un humano, las usa un desempate.
 */
export function comparaClaves(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}
