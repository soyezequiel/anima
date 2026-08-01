/**
 * EL PROVEEDOR DEL CHAT — la forma de `Consulta`, y nada de red.
 *
 * ─── QUÉ SE FUE DE ACÁ, y por qué ───────────────────────────────────────────
 *
 * Este archivo tenía adentro **las dos cosas**: cómo hablar con un modelo
 * (`spawn`, `fetch`, timeouts, costo) y cómo se le habla **al modelo del chat**
 * (el prompt de firmas, el JSON de cláusulas).
 *
 * El Hito 8 quiso mudarlo entero a `@anima/llm` y no se pudo: **el transporte
 * habría arrastrado a `Consulta`**, que es la forma del chat, y `@anima/llm`
 * habría terminado dependiendo de `@anima/lang` — la flecha al revés. La fragua
 * pregunta con otra forma (`Encargo`) y necesita el mismo transporte.
 *
 * Así que se partió por donde correspondía:
 *
 *   `@anima/llm/demo/transporte`  prompt (texto) → respuesta (texto)
 *   ESTE archivo                  `Consulta` → prompt, y texto → `RespuestaDelModelo`
 *
 * **Un transporte que conoce la forma del que pregunta sirve para uno solo.**
 *
 * Lo que NO cambió es la frontera del Hito 6: `@anima/lang` produce una
 * `Consulta` —un DATO— y esto la manda. El paquete sigue sin poder esperar a
 * nadie, que es todo el punto del ADR II-0024.
 *
 * ─── Lo que se le pide al modelo, y lo que NO ───────────────────────────────
 *
 * Se le pide que **elija de una lista**. No que escriba un predicado, no que
 * invente una meta, no que devuelva texto libre: que mire la frase y diga cuál
 * de las N firmas que este mundo sabe establecer es la que se pidió.
 *
 * Y lo que conteste pasa igual por los seis portones de `revisar()`, incluido el
 * que verifica que la firma esté en la lista que se le ofreció. **El modelo
 * propone, el código local dispone.**
 */

import { loQueNoEsBandera, preguntarTexto, transporteElegido } from '@anima/llm/demo/transporte.js'
import type { Consulta, RespuestaDelModelo } from '../src/consulta.js'

// El demo del chat los usa tal cual; se re-exportan para no obligarlo a saber
// que ahora viven en otro paquete.
export { costoDeLaUltima, transporteElegido } from '@anima/llm/demo/transporte.js'
export type { Transporte } from '@anima/llm/demo/transporte.js'

/** Los argumentos que NO son banderas: la frase. */
export function fraseDeLaLinea(): string {
  return loQueNoEsBandera()
}

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

/**
 * UN MODELO DE MENTIRA, para probar el enchufe sin gastar cuota.
 *
 * Nueve pistas y nada más. **No está para ser bueno**, está para que el camino
 * exista y se pueda comparar contra el de sin proveedor. Uno que acertara todo
 * mediría el simulador y no el enganche.
 *
 * Vive acá y no en el transporte a propósito: un modelo de mentira **tiene que
 * conocer la forma del que pregunta** para poder contestarle, así que es lo
 * único de los cuatro transportes que no puede ser genérico.
 */
const PISTAS: readonly (readonly [string, string])[] = [
  ['rio', 'holding(tag:carnoso)'],
  ['pescar', 'holding(tag:carnoso)'],
  ['pesca', 'holding(tag:carnoso)'],
  ['comida', 'holding(tag:carnoso)'],
  ['lena', 'emitsPower>0'],
  ['tronco', 'emitsPower>0'],
  ['fuego', 'emitsPower>0'],
  ['choza', 'reach>=2'],
  ['silla', 'reach>=2'],
]

function porFalso(c: Consulta): RespuestaDelModelo | undefined {
  const t = c.texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const cs: { indice: number; firma: string }[] = []
  for (const i of c.clausulas) {
    for (const [pista, firma] of PISTAS) {
      if (t.includes(pista) && c.firmas.includes(firma)) {
        cs.push({ indice: i, firma })
        break
      }
    }
  }
  return cs.length === 0 ? undefined : { llave: c.llave, clausulas: cs }
}

/**
 * PREGUNTARLE AL MODELO.
 *
 * `undefined` cuando no contesta, cuando tarda de más, cuando no hay cuota o
 * cuando lo que dijo no se entiende. **Ninguno de esos casos es un error**: el
 * acuse ya salió y el cuerpo ya se movió. Ésa es toda la apuesta del hito.
 */
export async function preguntarle(
  c: Consulta,
  timeoutMs = 30_000,
): Promise<RespuestaDelModelo | undefined> {
  if (transporteElegido() === 'falso') return porFalso(c)
  const texto = await preguntarTexto(promptDe(c), timeoutMs)
  return texto === undefined ? undefined : leerRespuesta(texto, c.llave)
}
