/**
 * LAS HABILIDADES INNATAS — quince del Hito 4, más «construir» y «usar» del Gate 5-6.
 *
 * Escritas a mano en el mismo TypeScript que después va a escribir el modelo.
 * No están acá para que la criatura las use: están acá para MEDIR SI LA API
 * ALCANZA. Si una habilidad honesta no se puede escribir contra `Ctx`, la API
 * está mal y hay que arreglarla ANTES de que el modelo empiece a escribir.
 *
 * Es el mismo lente que la segunda vuelta contra `admit()` —buscar procesos
 * HONESTOS que la puerta rebota, en vez de tramposos que deja pasar— aplicado a
 * la superficie en vez de a la física. Ese lente encontró que `comer` no se
 * podía escribir, o sea que la criatura pescaba y no comía.
 *
 * CÓMO SE LEE EL RESULTADO: cada habilidad exporta su `Contrato`, y cada
 * contrato trae `huecos`. Un hueco no es una opinión: le corresponde una sonda
 * en `tests/innatas-huecos.test.ts` que corre `tsc` de verdad sobre el código
 * que uno querría escribir y muestra el error.
 *
 * Y HAY SONDAS QUE MUESTRAN CERO ERRORES, que es peor: el código compila y hace
 * otra cosa. Son la de unidades (`explore.maxTicks` alimentado con segundos) y
 * la de `covering: ctx.self`. Un error de compilación cuesta 90 ms; un verde
 * falso cuesta la grilla entera del Hito 7 y encima no dice por qué.
 *
 * SE ESCRIBIERON CONTRA LA API EMITIDA, no contra el `.d.ts` a mano. La primera
 * versión de estos quince archivos se escribió contra el `.d.ts` viejo y la
 * mitad de sus hallazgos murieron el mismo día, porque la API real los había
 * cerrado: `ctx.hz`, `Verdict.por`, `StepResult.por`, `SelfView.permits`,
 * `clock.secondsToNightfall`, `recall(WhereCell)` y `SEED_PROCESS_IDS`. Los que
 * quedan son los que sobrevivieron a eso.
 */

import type { Contrato } from './contrato.js'

export type { Contrato, Predicado } from './contrato.js'
export { alAlcance, anillo, disco, distancia, enLaMano, porCercania } from './comun.js'

export { ir, CONTRATO_IR } from './ir.js'
export { explorar, CONTRATO_EXPLORAR } from './explorar.js'
export { juntar, CONTRATO_JUNTAR } from './juntar.js'
export { comer, rinde, CONTRATO_COMER } from './comer.js'
export { unir, CONTRATO_UNIR } from './unir.js'
export { construir, CONTRATO_CONSTRUIR } from './construir.js'
export { usar, CONTRATO_USAR } from './usar.js'
export { deshilachar, CONTRATO_DESHILACHAR } from './deshilachar.js'
export { aplicarProceso, loQueSeHacer, CONTRATO_APLICAR_PROCESO } from './aplicar-proceso.js'
export { poner, tapar, CONTRATO_PONER } from './poner.js'
export { sostener, CONTRATO_SOSTENER } from './sostener.js'
export { frotar, CONTRATO_FROTAR } from './frotar.js'
export { tantear, tanteoDe, CONTRATO_TANTEAR } from './tantear.js'
export type { Tanteo } from './tantear.js'
export { huirDelDolor, CONTRATO_HUIR_DEL_DOLOR } from './huir-del-dolor.js'
export { guarecerse, faltaParaLaNoche, CONTRATO_GUARECERSE } from './guarecerse.js'
export { esperar, esperarLaNoche, CONTRATO_ESPERAR } from './esperar.js'
export { seguirOrdenDeMovimiento, objetivoMasCercano, CONTRATO_SEGUIR_ORDEN } from './seguir-orden-de-movimiento.js'
export type { OrdenDeMovimiento } from './seguir-orden-de-movimiento.js'

import { CONTRATO_IR } from './ir.js'
import { CONTRATO_EXPLORAR } from './explorar.js'
import { CONTRATO_JUNTAR } from './juntar.js'
import { CONTRATO_COMER } from './comer.js'
import { CONTRATO_UNIR } from './unir.js'
import { CONTRATO_CONSTRUIR } from './construir.js'
import { CONTRATO_USAR } from './usar.js'
import { CONTRATO_DESHILACHAR } from './deshilachar.js'
import { CONTRATO_APLICAR_PROCESO } from './aplicar-proceso.js'
import { CONTRATO_PONER } from './poner.js'
import { CONTRATO_SOSTENER } from './sostener.js'
import { CONTRATO_FROTAR } from './frotar.js'
import { CONTRATO_TANTEAR } from './tantear.js'
import { CONTRATO_HUIR_DEL_DOLOR } from './huir-del-dolor.js'
import { CONTRATO_GUARECERSE } from './guarecerse.js'
import { CONTRATO_ESPERAR } from './esperar.js'
import { CONTRATO_SEGUIR_ORDEN } from './seguir-orden-de-movimiento.js'

/**
 * Las quince, en el orden en que el documento de arquitectura las nombra: ir,
 * explorar, juntar, comer, unir, deshilachar, aplicar-proceso, poner, sostener,
 * frotar, tantear, huir del dolor, guarecerse, esperar,
 * seguir-orden-de-movimiento.
 *
 * El orden importa: es el que va a leer el detector de cobertura del Hito 7
 * cuando diga cuáles se ejecutaron de verdad — «solo se acredita lo que
 * efectivamente se ejecutó».
 */
export const INNATAS: readonly Contrato[] = [
  CONTRATO_IR,
  CONTRATO_EXPLORAR,
  CONTRATO_JUNTAR,
  CONTRATO_COMER,
  CONTRATO_UNIR,
  CONTRATO_DESHILACHAR,
  CONTRATO_APLICAR_PROCESO,
  CONTRATO_PONER,
  CONTRATO_SOSTENER,
  CONTRATO_FROTAR,
  CONTRATO_TANTEAR,
  CONTRATO_HUIR_DEL_DOLOR,
  CONTRATO_GUARECERSE,
  CONTRATO_ESPERAR,
  CONTRATO_SEGUIR_ORDEN,
  // La dieciséis, y llegó con el Gate 5-6 (ADR II-0023). Va al final y no al lado
  // de `unir`: el orden de esta lista es el de las quince del Hito 4 y moverlo
  // haría que un test que las nombra por posición mienta.
  CONTRATO_CONSTRUIR,
  CONTRATO_USAR,
]
