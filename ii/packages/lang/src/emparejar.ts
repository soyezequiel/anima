/**
 * EMPAREJAR — de una palabra escrita a una entrada del léxico, en tres niveles.
 *
 * El léxico contesta por igualdad exacta y nada más. Este archivo es lo que hay
 * entre «lo que una persona tipeó» y esa igualdad, y son tres pasos, cada uno
 * más barato de creer que el siguiente:
 *
 * | nivel | qué hace | confianza |
 * |---|---|---:|
 * | `exacto` | la clave está tal cual | 1,00 |
 * | `plural` | «peces» → «pez», «palos» → «palo» | 0,90 |
 * | `difuso` | una letra de diferencia: «ahoguera» → «hoguera» | 0,70 |
 *
 * ─── Por qué los plurales tienen su propio nivel ────────────────────────────
 *
 * Porque son la mitad del agujero que quedó del tramo anterior, y se midió: la
 * cobertura del léxico sobre once frases reales daba 9%, y dos de las palabras
 * que faltaban eran `peces` —el plural de `pez`, que SÍ está como sinónimo de
 * `pescado`— y nada más que eso. Un lector sin plurales no entiende «fabricá una
 * trampa para peces», que es la frase del caso de aceptación del hito.
 *
 * Y tienen nivel propio y no se mezclan con el difuso porque **no son un error**:
 * quien escribe «peces» escribió bien. Cobrarle la misma penalidad que a una
 * falta de ortografía sería castigar el castellano.
 *
 * ─── Por qué el difuso existe, y el dato que lo justifica ───────────────────
 *
 * El único historial de chat real que hay en el repo son nueve mensajes, y uno
 * dice **«construi una ahoguera»**. Está mal escrito de dos formas a la vez y
 * una persona lo escribió. Los 128 imperativos que hay en los tests de Ánima I
 * están en castellano perfecto; un lector calibrado sólo contra ellos estaría
 * calibrado contra un usuario que no existe.
 *
 * ─── Las tres cosas que el difuso NO hace ───────────────────────────────────
 *
 * 1. **No toca palabras cortas.** Con menos de cinco letras, una edición de
 *    distancia convierte cualquier cosa en cualquier otra: `pez` y `paz` y `paz`
 *    y `vez`. El piso está medido contra el léxico y hay un test que lo cuida.
 * 2. **No empareja de a frases.** Sólo entradas de una palabra. Una entrada
 *    multipalabra emparejada difusamente sería adivinar dos veces seguidas.
 * 3. **No desempata al azar.** Si dos entradas están a la misma distancia,
 *    manda el orden de las claves —`comparaClaves`, que es por punto de código y
 *    no por locale— y la confianza baja otro escalón. Un empate es información,
 *    no un problema a ocultar.
 */

import { comparaClaves } from './normalizar.js'
import type { EntradaDeLexico, Lexico } from './tipos.js'

/** Por debajo de esto no se empareja difuso. Ver el punto 1 del encabezado. */
export const LARGO_MINIMO_DIFUSO = 5

/** A cuántas ediciones se acepta una palabra. Una, y no es negociable acá. */
export const EDICIONES_MAXIMAS = 1

export type NivelDeEmparejamiento = 'exacto' | 'plural' | 'difuso'

export interface Emparejado {
  readonly entrada: EntradaDeLexico
  readonly nivel: NivelDeEmparejamiento
  /** Cuánto vale este emparejamiento, en `[0, 1]`. */
  readonly confianza: number
  /** Cuántos tokens consumió. Una entrada multipalabra consume varios. */
  readonly consume: number
  /** Hubo dos candidatos a la misma distancia y se eligió por orden de clave. */
  readonly empatado: boolean
}

const VALOR: Readonly<Record<NivelDeEmparejamiento, number>> = {
  exacto: 1,
  plural: 0.9,
  difuso: 0.7,
}

/**
 * Las formas singulares candidatas de una palabra, de la más probable a la
 * menos.
 *
 * Las tres reglas del castellano, escritas como reglas y no como tabla:
 *
 * - `-s` → nada: «palos» → «palo», «hojas» → «hoja»;
 * - `-es` → nada: «árboles» → «árbol», «panes» → «pan»;
 * - `-ces` → `-z`: «peces» → «pez», «luces» → «luz», «raíces» → «raíz».
 *
 * La tercera va PRIMERO porque es la más específica: «peces» también termina en
 * `-es` y quitarle `es` da «pec», que no es nada. Probar de específico a general
 * es lo que hace que no haga falta ninguna excepción escrita a mano.
 *
 * No se valida que el resultado sea una palabra: eso lo decide el léxico, que es
 * quien sabe. Acá se generan candidatos y se prueban.
 */
export function singularesDe(palabra: string): readonly string[] {
  const out: string[] = []
  if (palabra.length >= 5 && palabra.endsWith('ces')) out.push(`${palabra.slice(0, -3)}z`)
  if (palabra.length >= 4 && palabra.endsWith('es')) out.push(palabra.slice(0, -2))
  if (palabra.length >= 3 && palabra.endsWith('s')) out.push(palabra.slice(0, -1))
  return out
}

/**
 * Distancia de edición ACOTADA: devuelve `tope + 1` en cuanto se pasa.
 *
 * Acotada y no completa porque el resultado exacto no le importa a nadie: la
 * única pregunta es «¿está a una edición o no?». Cortar temprano convierte el
 * peor caso de una comparación contra 120 entradas en un barrido de largos.
 *
 * El primer corte es por LARGO y no cuesta nada: dos palabras que difieren en
 * más de `tope` letras no pueden estar a `tope` ediciones.
 */
export function distancia(a: string, b: string, tope: number): number {
  const la = a.length
  const lb = b.length
  if (la - lb > tope || lb - la > tope) return tope + 1
  if (a === b) return 0

  // Una sola fila de la matriz: la de arriba se va reescribiendo.
  let previa: number[] = []
  for (let j = 0; j <= lb; j++) previa.push(j)
  for (let i = 1; i <= la; i++) {
    const fila: number[] = [i]
    let mejorDeLaFila = i
    for (let j = 1; j <= lb; j++) {
      const costo = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      const arriba = (previa[j] ?? 0) + 1
      const izq = (fila[j - 1] ?? 0) + 1
      const diag = (previa[j - 1] ?? 0) + costo
      let v = arriba
      if (izq < v) v = izq
      if (diag < v) v = diag
      fila.push(v)
      if (v < mejorDeLaFila) mejorDeLaFila = v
    }
    // Si TODA la fila ya se pasó del tope, ninguna fila de abajo puede bajar:
    // la distancia sólo crece hacia abajo y hacia la derecha.
    if (mejorDeLaFila > tope) return tope + 1
    previa = fila
  }
  const d = previa[lb] ?? tope + 1
  return d > tope ? tope + 1 : d
}

/**
 * LA ENTRADA QUE MEJOR EMPAREJA en la posición `i`, o `undefined`.
 *
 * El orden de los tres niveles es el orden de la tabla del encabezado y no se
 * puede cambiar: el exacto tiene que ganar siempre, porque una palabra que está
 * en el léxico **es** esa palabra aunque también esté a una edición de otra.
 */
export function emparejar(
  lex: Lexico,
  tokens: readonly string[],
  i: number,
): Emparejado | undefined {
  // 1 · Exacto, y con el emparejamiento más largo, que ya lo hace el léxico.
  const exacto = lex.buscar(tokens, i)
  if (exacto !== undefined) {
    return { entrada: exacto, nivel: 'exacto', confianza: VALOR.exacto, consume: exacto.palabras, empatado: false }
  }

  const palabra = tokens[i]
  if (palabra === undefined || palabra.length === 0) return undefined

  // 2 · Plural. Se prueba contra el léxico entero, así que un plural de una
  //     entrada multipalabra («hojas secas») también engancha si la cabeza está.
  for (const s of singularesDe(palabra)) {
    const conSingular = [...tokens.slice(0, i), s, ...tokens.slice(i + 1)]
    const e = lex.buscar(conSingular, i)
    if (e !== undefined) {
      return { entrada: e, nivel: 'plural', confianza: VALOR.plural, consume: e.palabras, empatado: false }
    }
  }

  // 3 · Difuso, y sólo contra entradas de UNA palabra.
  if (palabra.length < LARGO_MINIMO_DIFUSO) return undefined
  let mejor: EntradaDeLexico | undefined
  let mejorD = EDICIONES_MAXIMAS + 1
  let empatado = false
  for (const e of lex.entradas.values()) {
    if (e.palabras !== 1) continue
    if (e.clave.length < LARGO_MINIMO_DIFUSO) continue
    const d = distancia(palabra, e.clave, EDICIONES_MAXIMAS)
    if (d > EDICIONES_MAXIMAS) continue
    if (mejor === undefined || d < mejorD) {
      mejor = e
      mejorD = d
      empatado = false
      continue
    }
    if (d === mejorD) {
      // Empate: manda el orden de las claves. Determinista y sin locale.
      empatado = true
      if (comparaClaves(e.clave, mejor.clave) < 0) mejor = e
    }
  }
  if (mejor === undefined) return undefined
  return {
    entrada: mejor,
    nivel: 'difuso',
    // Un empate vale menos que un acierto solo: hubo dos formas de leerlo.
    confianza: empatado ? VALOR.difuso * 0.8 : VALOR.difuso,
    consume: 1,
    empatado,
  }
}

/** Los tres valores, para que un test los barra y para que se vean juntos. */
export const CONFIANZA_POR_NIVEL = VALOR
