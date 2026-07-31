/**
 * LA POLARIDAD — y va ANTES del anclaje, que es lo único no obvio de este
 * archivo.
 *
 * El documento de arquitectura lo pide así, con esas palabras: «detector de
 * polaridad determinista **antes** del anclaje». Conviene decir por qué, porque
 * el orden inverso es el que uno escribe sin pensar.
 *
 * ─── El costo de detectarla después ─────────────────────────────────────────
 *
 * «No vayas al río» y «andá al río» comparten todas las palabras con contenido.
 * Un lector que ancla primero encuentra el verbo `ir` y la meta del río en las
 * dos, arma la misma intención en las dos, y recién al final le pega un signo
 * menos. El problema es lo que pasa en el medio: este sistema **se mueve
 * mientras piensa** —ésa es la apuesta entera del criterio— así que entre anclar
 * y negar hay un tick en el que la criatura ya arrancó para el río.
 *
 * Detectar la negación primero cuesta un barrido de las palabras de función, que
 * son trece, y evita esa clase de arranque. Es la diferencia entre equivocarse y
 * hacer exactamente lo contrario de lo que le pidieron.
 *
 * ─── Dos cosas que se parecen y no son la misma ─────────────────────────────
 *
 * - **Negar** es «no hagas X»: X todavía no empezó, y lo que se pide es que no
 *   empiece.
 * - **Parar** es «dejá de X»: X está en curso, y lo que se pide es que termine.
 *
 * Por eso `parar` es un VERBO del puente y no un valor de polaridad. La
 * distinción importa río abajo: negar produce una restricción que dura, y parar
 * produce una cancelación que se agota al aplicarse.
 *
 * ─── Y una que este archivo NO resuelve ─────────────────────────────────────
 *
 * El alcance. «No traigas leña ni agua» niega las dos cosas; «traé leña y no
 * agua» niega una sola. Acá la polaridad es de la CLÁUSULA entera, y el corte en
 * cláusulas lo hace `leer.ts`. Es una simplificación consciente y se nota: la
 * frase con el `ni` da una sola cláusula negada, que es la lectura correcta, y
 * la otra da dos cláusulas de las cuales sólo la segunda arranca con `no`, que
 * también es la correcta. El caso que se pierde es el `no` que se distribuye
 * hacia atrás, y no aparece en el corpus.
 */

/**
 * Las palabras que niegan.
 *
 * `sin` está y `ni` está: los dos niegan sin decir «no», y los dos aparecen en
 * frases que una persona escribe («traelo sin mojarlo», «ni se te ocurra»). Lo
 * que NO está es `nada`, que en rioplatense casi siempre acompaña a un `no` que
 * ya disparó («no traigas nada») y sola es un sustantivo.
 */
const NIEGAN: readonly string[] = [
  'no',
  'nunca',
  'jamas',
  'tampoco',
  'ni',
  'sin',
  'evita',
  'evitar',
  'prohibido',
]

/**
 * Cuántas palabras del principio mira.
 *
 * En castellano la negación va delante del verbo y muy cerca del principio de la
 * cláusula: «no comas eso», «nunca vayas al río», «ni se te ocurra». Mirar la
 * cláusula entera traería falsos positivos de la cola —«traé el palo que está
 * sin mojar» no es una orden negada— y la ventana corta los saca sin ninguna
 * regla más.
 *
 * Tres y no dos porque «ni se te ocurra» pone el negador primero pero
 * «que no lo toques» lo pone tercero.
 */
const VENTANA = 3

export type Polaridad = 'afirma' | 'niega'

/**
 * La polaridad de una cláusula ya tokenizada.
 *
 * Recibe tokens y no texto a propósito: quien la llama ya normalizó, y
 * normalizar dos veces es la forma de que las dos normalizaciones se separen.
 */
export function polaridadDe(tokens: readonly string[]): Polaridad {
  const tope = Math.min(VENTANA, tokens.length)
  for (let i = 0; i < tope; i++) {
    const t = tokens[i]
    if (t === undefined) continue
    for (const n of NIEGAN) if (t === n) return 'niega'
  }
  return 'afirma'
}

/**
 * Las palabras de negación, para que un test pueda barrerlas todas y para que
 * el que agregue una vea que hay una lista y no un `if`.
 */
export const PALABRAS_QUE_NIEGAN = NIEGAN
export const VENTANA_DE_POLARIDAD = VENTANA
