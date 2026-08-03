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

// ─── EL PROMPT Y EL PARSEO SE MUDARON, y no es un detalle de orden ─────────
//
// Viven en `src/consulta.ts` desde que el juego le pregunta a Codex por el
// depósito. Este archivo importa el transporte, el transporte hace `spawn`, y un
// bundle de navegador que se lleve `node:child_process` no arranca. Se
// re-exportan para que los demos y los tests que ya los nombran no cambien. El
// `import` va aparte del `export`: un `export … from` re-exporta y NO trae los
// nombres al ámbito de este archivo, y `preguntarle` los usa acá abajo.
import { leerRespuesta, promptDe } from '../src/consulta.js'
export { leerRespuesta, promptDe } from '../src/consulta.js'

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
  /**
   * EL CORTE DEL QUE PREGUNTA, y no el del reloj.
   *
   * Un turno nuevo del cuidador cambia el contexto con el que se pidió, así que
   * la respuesta que venía ya no es sobre esto. Sin este parámetro el corte
   * llegaba hasta acá y moría: la app ignoraba lo que volvía y el CLI seguía
   * corriendo hasta el final — medido, 14.729 ms de más, pagados.
   */
  signal?: AbortSignal,
): Promise<RespuestaDelModelo | undefined> {
  if (transporteElegido() === 'falso') return porFalso(c)
  const texto = await preguntarTexto(promptDe(c), timeoutMs, signal)
  return texto === undefined ? undefined : leerRespuesta(texto, c.llave)
}
