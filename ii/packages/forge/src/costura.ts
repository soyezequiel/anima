/**
 * LA COSTURA — Hito 8, etapa 2. Los puntos 4 y 8.
 *
 *   4 · «el episodio completo **no supera N consultas**»
 *   8 · «con la **cuota agotada**, la cola no dispara ni una consulta»
 *
 * ─── Por qué los dos estaban INAFIRMABLES, y está medido ────────────────────
 *
 * Porque el salto de `Encargo` (el pedido, texto) a `Candidata` (el código) **no
 * existía**. Las candidatas nacían de una función pura del muñeco, y el barrido de
 * los diez agentes lo midió con tres hechos, cada uno suficiente por su cuenta:
 *
 *   · un episodio gasta **0 consultas**
 *   · `Presupuesto` tiene **cero llamadores** fuera de su propio test
 *   · `@anima/forge` declara `@anima/llm` y **no lo importa en ninguna línea**
 *
 * Con eso, `expect(consultas).toBe(0)` sale verde para siempre y no puede
 * ponerse rojo nunca. Sería el sexto verde por omisión del hito.
 *
 * Este archivo es el salto. Y trae la puerta que el punto 8 nombra.
 *
 * ─── EL PRESUPUESTO ES UNA PUERTA, NO UN AVISO ──────────────────────────────
 *
 * La diferencia importa y es la mitad del punto 8: un aviso se consulta DESPUÉS
 * —«uy, me pasé»— y una puerta se consulta ANTES y **no deja pasar**. Por eso
 * `pedirPermiso` devuelve un `Viaje` o no lo devuelve: quien recibe un
 * `no-preguntes` no tiene con qué preguntar, aunque quiera.
 *
 * ─── Y por qué acá no se pregunta nada ──────────────────────────────────────
 *
 * Regla 2: en `src/` no hay un `await`. Este archivo **describe el viaje** y
 * **lee lo que volvió**; quien puede esperar es el llamador. Es la misma frontera
 * del Hito 6 y la misma que el tramo H usó para la puerta.
 *
 * Que las dos mitades sean sincrónicas es lo que las hace probables sin gastar
 * un centavo, que es todo el punto del muñeco.
 */

import { deUsd } from '@anima/llm'
import type { Costo, Motivo, Presupuesto } from '@anima/llm'
import type { Candidata, HabilidadCandidata } from './candidata.js'
import type { Encargo } from './encargo.js'
import { textoDe } from './encargo.js'

/**
 * CUÁNTAS CANDIDATAS POR VIAJE.
 *
 * No es un número de acá: está en la descripción del hito («K=2 candidatas por
 * viaje») y el motivo es económico — **lo caro es el viaje, no la candidata**.
 * El carril de mejora usa otro, y por eso entra por parámetro.
 */
export const K_POR_VIAJE = 2

/**
 * LO QUE SE ESTIMA QUE SALE UNA CANDIDATA, en dólares.
 *
 * Medido en el Hito 6 contra Claude por el CLI: **US$ 0,0158 por frase**. Es una
 * estimación y se usa como tal — `puedo()` autoriza contra esto y `gastar()`
 * cobra lo real, que es la razón por la que `puedo` no descuenta.
 */
export const USD_POR_CANDIDATA = 0.0158

/** Un viaje al modelo: lo que se le pide y lo que se estima que sale. */
export interface Viaje {
  readonly encargo: Encargo
  /** El texto que se le manda. Sale de `textoDe`, que no sabe de ningún mundo. */
  readonly texto: string
  readonly k: number
  readonly costo: Costo
}

/**
 * UN VIAJE ES **UNA** CONSULTA, traiga las candidatas que traiga.
 *
 * Es la decisión que hace que N signifique algo. La alternativa —contar una
 * consulta por candidata— haría que subir K de 2 a 6 en el carril de mejora
 * pareciera un aumento de consultas cuando es el mismo viaje. Lo que sube con K
 * es la plata, y eso sí se cobra por candidata.
 */
export function viajeDe(e: Encargo, k: number = K_POR_VIAJE): Viaje {
  return { encargo: e, texto: textoDe(e), k, costo: deUsd(USD_POR_CANDIDATA * k, 1) }
}

export type Salida =
  | { readonly k: 'preguntá'; readonly viaje: Viaje }
  /** Sin viaje adentro: quien recibe esto **no tiene con qué** preguntar. */
  | { readonly k: 'no-preguntes'; readonly porque: Motivo }

/**
 * LA PUERTA DEL PUNTO 8.
 *
 * Se le pide permiso al presupuesto ANTES, y si dice que no, el viaje no sale de
 * acá. `Presupuesto.puedo` ya cuenta el negado, así que el llamador no tiene que
 * acordarse de nada.
 */
export function pedirPermiso(p: Presupuesto, v: Viaje): Salida {
  const permiso = p.puedo('fragua', v.costo)
  return permiso.k === 'dale' ? { k: 'preguntá', viaje: v } : { k: 'no-preguntes', porque: permiso.porque }
}

/**
 * DE LO QUE CONTESTÓ EL MODELO A CANDIDATAS.
 *
 * ─── El formato, y por qué es el de un bloque cercado ───────────────────────
 *
 * Porque es el que un modelo produce solo. El Hito 6 midió que los CLI escriben
 * encabezados y razonamiento alrededor de la respuesta —por eso `leerRespuesta`
 * del chat cuenta llaves de atrás para adelante— y un bloque ```ts es lo único
 * que sobrevive a eso sin pedirle al modelo que se porte bien.
 *
 * El NOMBRE no se le pregunta aparte: sale del propio código, del `export
 * function*`. Pedirlo por separado es una forma de que no coincida.
 *
 * Lo que NO se hace acá es validar: para eso está la puerta. Un bloque que no
 * compila entra igual como candidata y muere 56 ms después, que es exactamente
 * el orden que el tramo B compró.
 */
const BLOQUE = /```(?:ts|typescript)?\r?\n([\s\S]*?)```/g
const NOMBRE = /export\s+function\s*\*\s*([A-Za-z_$][\w$]*)/

export function leerCandidatas(salida: string, e: Encargo, k: number = K_POR_VIAJE): readonly Candidata[] {
  const out: Candidata[] = []
  for (const m of salida.matchAll(BLOQUE)) {
    const fuente = m[1]
    if (fuente === undefined) continue
    const n = NOMBRE.exec(fuente)
    if (n === null || n[1] === undefined) continue
    const usar: HabilidadCandidata = { nombre: n[1], fuente }
    out.push({ gap: e.gap, vuelta: e.vuelta, usar })
    // Se corta en K: un modelo que devuelve nueve bloques no compra nueve
    // candidatas por el precio de dos, y quien paga el typecheck es la fragua.
    if (out.length >= k) break
  }
  return out
}
