// ─── PREGUNTARLE A CODEX, POR EL DEPÓSITO ───────────────────────────────────
//
// El hueco `preguntar` de `Ordenes` existe desde el C1 y hasta hoy nadie se lo
// llenaba en el juego. Éste lo llena, y el camino no es nuevo: es el mismo por
// el que ya viajan los dibujos.
//
//     el juego ── Consulta ──▶ depósito ── prompt ──▶ codex exec
//                                  ▲
//                          acá están las credenciales
//
// ─── POR QUÉ NO LE HABLA A CODEX DIRECTO ───────────────────────────────────
//
// Porque no puede. Codex es un proceso y esto es una página: no hay `spawn` en
// un navegador, y aunque lo hubiera, las credenciales de una cuenta no viajan al
// cliente. Está escrito con esas palabras en `apps/sprites/src/codex.ts` desde
// que el dibujante existe, y vale igual acá.
//
// ─── Y POR QUÉ MANDA LA `Consulta` Y NO EL PROMPT ──────────────────────────
//
// Sería más corto armar el prompt acá y mandarlo. Sería también convertir al
// depósito en un proxy abierto a la cuenta de quien lo corre: cualquiera con el
// puerto le gasta la cuota en lo que se le ocurra. El prompt lo arma el
// servidor, con `promptDe`, que es la misma función que usa el demo de terminal.
//
// ═══ LAS DOS MANERAS DE NO CONTESTAR, Y SON DISTINTAS ══════════════════════
//
// Esto es lo único fino del archivo. `Ordenes` lee dos resultados distintos:
//
//   · **la promesa se RECHAZA** → «no llegué». El depósito no está, la red se
//     cortó, el CLI no arrancó. Es una falla del camino;
//   · **la promesa RESUELVE `undefined`** → «llegué y no trajo nada». El modelo
//     contestó y no eligió ninguna firma, o contestó algo que no se entiende.
//
// Los dos terminan con la criatura haciendo lo mismo —seguir con lo que
// entendió— y en la pantalla dicen cosas distintas, que es todo el punto del
// aviso: uno manda a mirar el cableado y el otro no. Un proveedor que devolviera
// `undefined` para las dos cosas dejaría la lámpara diciendo «no trajo nada»
// mientras el depósito está apagado, que es exactamente la clase de mentira que
// este tramo vino a sacar.

import type { Consulta, RespuestaDelModelo } from '@anima/lang'

/** Lo que `/leer` contesta cuando le salió. `respuesta` es `null` si no eligió nada. */
interface LoQueVuelve {
  readonly ok?: unknown
  readonly respuesta?: unknown
  readonly porque?: unknown
}

/**
 * UNA RESPUESTA LEÍDA SIN CONFIAR, o `undefined`.
 *
 * Viene de la red igual que todo lo demás. Y hay una razón concreta para no
 * confiar aunque el servidor sea nuestro: `revisar()` de `@anima/lang` es quien
 * decide si esta respuesta vale, y para poder decidirlo necesita que los campos
 * existan. Un `clausulas: "todas"` lo haría explotar adentro del tick.
 */
function laRespuesta(crudo: unknown, llave: string): RespuestaDelModelo | undefined {
  if (typeof crudo !== 'object' || crudo === null) return undefined
  const o = crudo as { llave?: unknown; clausulas?: unknown }
  if (!Array.isArray(o.clausulas)) return undefined
  const cs: { indice: number; firma: string }[] = []
  for (const c of o.clausulas) {
    if (typeof c !== 'object' || c === null) continue
    const x = c as { indice?: unknown; firma?: unknown }
    if (typeof x.indice === 'number' && typeof x.firma === 'string') cs.push({ indice: x.indice, firma: x.firma })
  }
  // La llave de acá y no la que vino: es la que correlaciona la respuesta con la
  // consulta que sigue viva, y aceptar la del servidor dejaría que una respuesta
  // se hiciera pasar por otra. `Ordenes` la compara contra la suya igual, así que
  // mandar la ajena sólo podría hacer que se descarte una respuesta buena.
  return { llave, clausulas: cs }
}

/**
 * EL PROVEEDOR DEL JUEGO. Se le pasa a `OpcionesDeOrdenes.preguntar`.
 *
 * `donde` es la raíz del depósito, la misma que ya se usa para `/salud` y los
 * dibujos: un solo backend y un solo lugar donde configurarlo.
 */
export function preguntarPorElDeposito(
  donde: string,
): (c: Consulta, signal?: AbortSignal) => Promise<RespuestaDelModelo | undefined> {
  return async (c, signal) => {
    const r = await fetch(`${donde}/leer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(c),
      ...(signal === undefined ? {} : { signal }),
    })
    // Se TIRA y no se devuelve `undefined`: un 501 —«este depósito no contesta
    // preguntas»— y un 502 —«el CLI no arrancó»— son los dos «no llegué», y hay
    // una luz que los espera. Ver el encabezado.
    if (!r.ok) {
      const porque = await r
        .json()
        .then((j: LoQueVuelve) => (typeof j.porque === 'string' ? j.porque : ''))
        .catch(() => '')
      throw new Error(`el depósito contestó ${String(r.status)}${porque === '' ? '' : `: ${porque}`}`)
    }
    const j = (await r.json()) as LoQueVuelve
    // Y acá sí `undefined`: llegó, contestó, y no eligió nada.
    if (j.respuesta === null || j.respuesta === undefined) return undefined
    return laRespuesta(j.respuesta, c.llave)
  }
}
