/**
 * LA CAÑERÍA DE LA FRAGUA — Hito 8, tramo G. Puntos 1 y 2.
 *
 * > dado el gap «conseguir alimento de un cuerpo de agua», **al menos una de dos
 * > candidatas compila sin reparación** y **al menos una compila con reparación**
 *
 * ─── Qué hace, en tres pasos y ningún viaje ─────────────────────────────────
 *
 *   1. la puerta        ¿compila? — 47 ms
 *   2. la reparación    si no, se arreglan los typos — sin volver al modelo
 *   3. la puerta        ¿y ahora? — otros 47 ms
 *
 * Y nada más. **No itera hasta que compile**: eso sería adivinar, y cada vuelta
 * de más es tiempo que la criatura pasa sin la habilidad. Lo que no se arregló en
 * un pase va al segundo intento, con `Encargo` y lo que falló (`encargo.ts`).
 *
 * ─── LO QUE ESTE ARCHIVO NO PUEDE PROBAR, y hay que decirlo ─────────────────
 *
 * **Que el modelo real produzca una candidata buena y una casi buena.** Eso es
 * lo que los puntos 1 y 2 afirman, y sólo se puede medir con el modelo real
 * contestando.
 *
 * Lo que sí se prueba acá es **la cañería**: que una candidata sana pase, que una
 * con un typo pase DESPUÉS de reparar, y que una rota de verdad no pase. Si esto
 * anduviera mal, el criterio fallaría por culpa de la fragua y no del modelo — y
 * no habría forma de distinguirlo.
 *
 * Un modelo de mentira que devolviera justo lo que el criterio pide no probaría
 * la fragua: probaría que alguien supo escribir el simulador.
 */

import { reparar } from './reparar.js'
import type { Cambio } from './reparar.js'
import type { Error, Puerta } from './puerta.js'

export type Desenlace =
  /** Compiló de una. Es la mitad del punto 1. */
  | 'limpia'
  /** No compilaba, se le arreglaron los typos y ahora sí. Es el punto 2. */
  | 'reparada'
  /** Ni así. Lo que quedó es material para el segundo intento. */
  | 'rota'

export interface Intento {
  /** El código final: el original si fue `limpia`, el parchado si fue `reparada`. */
  readonly codigo: string
  readonly desenlace: Desenlace
  readonly cambios: readonly Cambio[]
  /**
   * Lo que quedó sin arreglar. Vacío salvo en `rota`, y es de donde salen los
   * conceptos que el mundo no tiene (`conceptosDe`, en `encargo.ts`).
   */
  readonly erroresQueQuedaron: readonly Error[]
  /** Cuántas veces se pasó por la puerta. Es el costo local, en unidades de 47 ms. */
  readonly puertazos: number
}

/**
 * UNA CANDIDATA, de punta a punta.
 *
 * El orden importa y no es el obvio: **primero se pregunta si compila y recién
 * después se repara**. Reparar siempre —aunque compile— es la forma de romper
 * algo que estaba bien, y cuesta lo mismo que preguntar.
 */
export function forjarUna(codigo: string, p: Puerta): Intento {
  const antes = p.revisar(codigo)
  if (antes.k === 'compila') {
    return { codigo, desenlace: 'limpia', cambios: [], erroresQueQuedaron: [], puertazos: 1 }
  }

  const r = reparar(codigo, antes.errores, p)
  if (r.k === 'sin-arreglo') {
    return { codigo, desenlace: 'rota', cambios: [], erroresQueQuedaron: antes.errores, puertazos: 1 }
  }

  const despues = p.revisar(r.codigo)
  if (despues.k === 'compila') {
    return { codigo: r.codigo, desenlace: 'reparada', cambios: r.cambios, erroresQueQuedaron: [], puertazos: 2 }
  }
  return {
    codigo: r.codigo,
    desenlace: 'rota',
    cambios: r.cambios,
    erroresQueQuedaron: despues.errores,
    puertazos: 2,
  }
}

export interface Tanda {
  readonly intentos: readonly Intento[]
  /** Cuántas pasaron, de una o reparadas. */
  readonly sirven: number
  /** El costo local entero, en pasadas por la puerta. */
  readonly puertazos: number
}

/**
 * LAS K CANDIDATAS DE UN VIAJE.
 *
 * `K=2` es lo que el criterio nombra para el carril normal, pero acá entra por
 * parámetro y no por constante: el carril de mejora usa **K=6** y sería el mismo
 * código con otro número. Un `2` clavado obligaría a duplicarlo.
 *
 * **Se revisan TODAS, aunque la primera compile.** Es plata ya gastada —el viaje
 * al modelo se pagó por las dos— y la segunda puede ser mejor: quien elija cuál
 * promover es el juez, no el orden en que llegaron.
 */
export function forjarTanda(candidatas: readonly string[], p: Puerta): Tanda {
  const intentos = candidatas.map((c) => forjarUna(c, p))
  return {
    intentos,
    sirven: intentos.filter((i) => i.desenlace !== 'rota').length,
    puertazos: intentos.reduce((s, i) => s + i.puertazos, 0),
  }
}
