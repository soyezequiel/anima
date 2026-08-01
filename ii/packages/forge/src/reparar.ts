/**
 * LAS REPARACIONES — Hito 8, tramo C.
 *
 * > diez reparaciones deterministas
 *
 * ─── LA MEDICIÓN DIO VUELTA EL DISEÑO, y por eso no son diez reglas ─────────
 *
 * Contra los 28 borradores del repo (`la-puerta.test.ts`):
 *
 *   28 borradores · compilan 3 · fallan 25 · 83 errores
 *
 *   TS2339   29   Property 'ticksToNightfall' does not exist on type 'Clock'
 *   TS2322   22   Type '"wet"' is not assignable to type 'QualityId'
 *   TS2345   20   Argument of type '"combustion"' is not assignable to 'SeedProcessId'
 *
 * El 86% cae en tres códigos, y la primera lectura fue «es un solo error con tres
 * caras: inventó un nombre». **Esa lectura era mía y estaba de más.** El embudo,
 * medido en `las-reparaciones.test.ts`:
 *
 *   errores de la clase   71
 *   con nombre extraído   66     ← 5 no son nombres: son formas de objeto
 *   con candidatos        44
 *   dentro del corte       7     ← **sólo éstos son typos**
 *
 * ─── «INVENTÓ UN NOMBRE» SON DOS COSAS, y sólo una se repara acá ────────────
 *
 * | | ejemplo | ¿hay algo parecido? |
 * |---|---|---|
 * | **un typo** | `ticksToNightfall` → `secondsToNightfall` | sí, a 7 letras |
 * | **un concepto que el mundo no tiene** | `combustion` · `hunger` · `stock` · `qualifies` | **no, porque no existe la cosa** |
 *
 * Los segundos **no se pueden reparar localmente por definición**: no hay «el
 * nombre correcto» cerca porque no hay nada cerca. Y son exactamente el material
 * del **punto 9** del criterio —la candidata que falla alimenta a la siguiente—:
 * lo que hay que contarle al modelo es que pidió una cosa que no existe.
 *
 * O sea que el trabajo se reparte solo: **la puerta arregla los typos gratis, y
 * los conceptos inventados son lo que va al segundo intento.**
 *
 * ─── DE DÓNDE SALE EL NOMBRE CORRECTO, con las dos fuentes medidas ──────────
 *
 * **1. El mensaje de error: NO sirve.** De los 71 errores de esa clase en el
 * corpus, **cero** traen «Did you mean». Se contó antes de descartarlo.
 *
 * **2. El servicio: SÍ.** `getCompletionsAtPosition` en la posición del error
 * devuelve exactamente los nombres legales ahí, porque es lo mismo que le
 * muestra a un editor:
 *
 *   ticksToNightfall  →  dayLength · phase · **secondsToNightfall**
 *   'wet'             →  'calories' · 'catch' · 'charred' · … (los QualityId)
 *
 * Y la tercera que NO se eligió: **copiar los catálogos acá**. Una lista de
 * cualidades al lado de la que ya vive en `@anima/physics` es la duplicación que
 * queda vieja en silencio — lo mismo que el guardián del sello del Hito 7 existe
 * para atajar. El compilador no puede quedar viejo respecto de sí mismo.
 */

import type { Error, Puerta } from './puerta.js'

/**
 * EL NOMBRE QUE SE INVENTÓ, sacado del mensaje.
 *
 * Los tres códigos lo traen entrecomillado y en la primera posición, y son las
 * tres formas que el corpus produce:
 *
 *   Property 'X' does not exist on type 'Y'
 *   Type '"X"' is not assignable to type 'Y'
 *   Argument of type '"X"' is not assignable to parameter of type 'Y'
 *
 * Se lee del MENSAJE y no del código fuente a propósito: en la posición del
 * error puede haber una expresión entera, y lo que hay que reemplazar es el
 * nombre exacto que el compilador nombró.
 */
export function nombreInventado(e: Error): string | undefined {
  const m = /^(?:Property|Type|Argument of type) '"?([A-Za-z_][A-Za-z0-9_]*)"?'/.exec(e.mensaje)
  return m?.[1]
}

/** ¿El hueco espera un texto entre comillas, o un identificador pelado? */
function esDeTexto(e: Error): boolean {
  return /Type '"|type '"/.test(e.mensaje)
}

/**
 * DISTANCIA DE EDICIÓN, acotada.
 *
 * Acotada porque no interesa cuán lejos está lo lejano: interesa **cuál es el
 * más cerca**, y una distancia mayor que el corte no se usa para nada. Cortar
 * temprano evita recorrer una matriz entera por cada uno de los 1032 candidatos
 * que el servicio llega a devolver.
 */
export function distancia(a: string, b: string, corte: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > corte) return corte + 1
  let previa = new Array<number>(b.length + 1)
  let actual = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) previa[j] = j
  for (let i = 1; i <= a.length; i++) {
    actual[0] = i
    let mejorDeLaFila = actual[0] as number
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min(
        (previa[j] as number) + 1,
        (actual[j - 1] as number) + 1,
        (previa[j - 1] as number) + costo,
      )
      actual[j] = v
      if (v < mejorDeLaFila) mejorDeLaFila = v
    }
    if (mejorDeLaFila > corte) return corte + 1
    const t = previa
    previa = actual
    actual = t
  }
  return previa[b.length] as number
}

/**
 * CUÁNTO SE PERMITE QUE SE HAYA EQUIVOCADO.
 *
 * Un tercio del nombre, con piso de 2. No es un número puesto a ojo: sale de la
 * forma de los errores del corpus —`ticksToNightfall` contra
 * `secondsToNightfall` son **7** de 18 letras— y de lo que pasa si se afloja:
 * con un corte grande, `'wet'` matchea `'catch'` y la reparación **inventa una
 * conducta distinta en vez de arreglar un typo**.
 *
 * Prefiere no reparar antes que reparar mal: una candidata que no compila cuesta
 * 47 ms; una que compila y hace otra cosa cuesta un viaje al juez y un veredicto
 * equivocado.
 */
function corteDe(nombre: string): number {
  return Math.max(2, Math.floor(nombre.length / 3))
}

export interface Cambio {
  readonly de: string
  readonly a: string
  readonly codigo: number
  readonly linea: number
}

export type Reparacion =
  | { readonly k: 'reparado'; readonly codigo: string; readonly cambios: readonly Cambio[] }
  | { readonly k: 'sin-arreglo'; readonly porque: string }

/**
 * REPARAR UNA CANDIDATA, sin volver al modelo.
 *
 * Un pase: se juntan todos los reemplazos que se puedan justificar y se aplican
 * de una. **No se itera hasta que compile** —eso sería adivinar— y no hace falta:
 * quien llama vuelve a pasar por la puerta, que cuesta 47 ms, y decide.
 *
 * Los reemplazos se aplican **de atrás para adelante** por posición, para que
 * cambiar el largo de uno no mueva la posición de los otros.
 */
export function reparar(codigo: string, errores: readonly Error[], p: Puerta): Reparacion {
  const cambios: Cambio[] = []
  const parches: { inicio: number; largo: number; texto: string }[] = []

  for (const e of errores) {
    const malo = nombreInventado(e)
    if (malo === undefined) continue

    const deTexto = esDeTexto(e)
    const candidatos = p
      .queSeriaValido(e.inicio)
      // El servicio devuelve todo lo que está en alcance —1032 entradas para un
      // hueco de `QualityId`—. Los de un hueco de texto vienen entrecomillados,
      // y ese comillado es lo único que los separa de los identificadores.
      .filter((c) => (deTexto ? /^['"]/.test(c) : !/^['"]/.test(c)))
      .map((c) => c.replace(/^['"]|['"]$/g, ''))

    if (candidatos.length === 0) continue

    const corte = corteDe(malo)
    let mejor: string | undefined
    let mejorD = corte + 1
    for (const c of candidatos) {
      const d = distancia(malo, c, corte)
      if (d < mejorD) {
        mejorD = d
        mejor = c
      }
    }
    if (mejor === undefined || mejorD > corte) continue

    // El nombre malo está en el fuente, en la posición del error o muy cerca.
    // Se busca desde ahí y no desde el principio: el mismo identificador puede
    // aparecer diez veces y sólo ésta está mal.
    const donde = codigo.indexOf(malo, Math.max(0, e.inicio - malo.length - 2))
    if (donde < 0) continue

    parches.push({ inicio: donde, largo: malo.length, texto: mejor })
    cambios.push({ de: malo, a: mejor, codigo: e.codigo, linea: e.linea })
  }

  if (parches.length === 0) return { k: 'sin-arreglo', porque: 'ningún error tenía un nombre parecido que sí exista' }

  parches.sort((a, b) => b.inicio - a.inicio)
  let out = codigo
  let ultimo = Infinity
  for (const x of parches) {
    // Dos errores pueden apuntar al mismo lugar; aplicar dos parches solapados
    // corrompe el archivo. Se queda el primero de la lista ordenada.
    if (x.inicio + x.largo > ultimo) continue
    out = out.slice(0, x.inicio) + x.texto + out.slice(x.inicio + x.largo)
    ultimo = x.inicio
  }
  return { k: 'reparado', codigo: out, cambios }
}
