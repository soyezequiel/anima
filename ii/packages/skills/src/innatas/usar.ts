// INNATA 17/17 · «usar» — dejar una obra puesta y funcionando. El UseSkill.

import type { BodyView, Cell, Ctx, Intent, Outcome, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { distancia, enLaMano } from './comun.js'

export const CONTRATO_USAR: Contrato = {
  nombre: 'usar',
  // Lo que queda después: la obra está en el sitio y trabajando. `at` es la única
  // forma que el vocabulario de predicados tiene de decir «quedó ahí»; que además
  // esté DESPLEGADA y no simplemente apoyada no se puede decir — ver el hueco 1.
  establece: [{ sujeto: 'el-objetivo', q: 'at', op: '==', v: 0 }],
  precondiciones: [
    // Lo único que hace que una obra desplegada RETENGA es `catch > 0`, que es una
    // cualidad DERIVADA de la geometría de lo que se ató. Un palo pelado sobre el
    // mejor pozo del mundo no saca nada, y eso no lo decide una tabla: le da cero
    // la fórmula. Es el punto 12 del Gate 5→6 dicho desde el lado de la habilidad.
    { sujeto: 'el-objetivo', q: 'catch', op: '>', v: 0 },
    { sujeto: 'yo', q: 'holding', op: '>=', v: 1 },
  ],
  cuesta: { segundos: 0, commitment: 'irreversible' },
  huecos: [
    'NO SE PUEDE SABER SI HAY UN POZO EN EL SITIO. Lo que hace que una obra desplegada saque algo es tener un `Stock` al lado, y un `Stock` es un decreto del dios: no es un cuerpo, no es una cualidad de celda, y `see()` no lo devuelve. El mundo lo distingue con el motivo `sin-pozo`, así que la habilidad se entera DESPUÉS de caminar hasta ahí. Lo más cerca que llega es `qAt(at, "wet")`, que es necesario y no suficiente — una piedra tirada adentro del río también moja',
    'NO SE PUEDE PREGUNTAR SI ALGO YA ESTÁ DESPLEGADO. `place` es idempotente —el mundo lo garantiza— pero la superficie no tiene ninguna lectura de `WorldState.desplegados`: `BodyView` trae `heldBy`, `supportedBy` y `covering`, y no «está puesta y funcionando». Una habilidad que quisiera decidir entre desplegar y recoger no tiene con qué',
    'NO SE PUEDE RETIRAR LA CAPTURA SIN NOMBRARLA. Lo que la obra atrapó son cuerpos de verdad con ids nuevos, y la única forma de encontrarlos es `see()` sobre la celda: no hay `ctx` que diga «lo que ESTA obra retuvo». La criatura vuelve y levanta lo que ve, que es lo correcto por casualidad — si dos obras estuvieran en celdas vecinas, se llevaría lo de la otra',
  ],
}

/**
 * CONTRATO
 *   establece   la obra queda en `en`, puesta y funcionando
 *   precondiciones  tenerla (o poder levantarla), y que `catch > 0`
 *   cuesta      un tick; `irreversible`, porque desplegar no es soltar
 *
 * ─── POR QUÉ ESTO NO ES `poner` CON OTRO NOMBRE ─────────────────────────────
 *
 * Porque `put` deja un cuerpo APOYADO y `place` lo deja DESPLEGADO, y el mundo
 * los trata distinto: una obra desplegada con `catch > 0` al lado de un pozo saca
 * **sin que nadie aplique un proceso** (ADR II-0016). Es lo único del tick que no
 * lo pide nadie. Un cuerpo apoyado no hace nada.
 *
 * Y por eso el compromiso es `irreversible` y no `reversible`: soltar algo se
 * deshace levantándolo, y desplegar arranca una máquina que va a sacar materia de
 * un pozo mientras nadie la levante.
 *
 * ─── LO QUE ESTA HABILIDAD SE NIEGA A HACER, Y ES LA MITAD DE SU VALOR ──────
 *
 * Desplegar algo que no engancha. `catch` es una cualidad DERIVADA de las puntas
 * sueltas y el filo, así que la habilidad no necesita saber qué es una trampa: le
 * pregunta al cuerpo cuánto engancha y, si da cero, no camina hasta el sitio para
 * dejar puesto algo que no va a sacar nada.
 *
 * Está medido que la distinción es real: la misma vara y la misma hebra atadas
 * como caña dan `catch` 0,15, y un palo pelado da 0. **Ningún nombre interviene**
 * — que es el punto 12 del criterio del gate.
 */
export function* usar(
  ctx: Ctx,
  args: { obra: BodyView; en: Cell },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('usar')

  // ─── Primero lo barato: ¿esto sirve de algo puesto? ───────────────────────
  //
  // `ctx.q` no cuesta nada y no mueve el mundo. Preguntarlo ANTES de caminar es
  // lo mismo que `unir` hace con `can()`: la puerta más barata que hay.
  const engancha = ctx.q(args.obra, 'catch')
  if (engancha <= 0) {
    return fail(`${args.obra.name} no engancha nada (catch ${engancha.toFixed(4)}): dejarla puesta no hace nada`)
  }

  if (!enLaMano(ctx.self, args.obra)) {
    if (ctx.q(args.obra, 'portable') < 1) return fail(`${args.obra.name} no se puede levantar`)
    const irA = yield ctx.goTo(args.obra, { within: 1 })
    if (irA.status !== 'arrived') return fail('no llegué hasta la obra')
    const t = yield ctx.take(args.obra)
    if (t.status !== 'done') return fail(`no pude levantarla: ${t.por ?? t.status}`)
  }

  if (distancia(ctx.self.at, args.en) > 1) {
    const irB = yield ctx.goTo(args.en, { within: 1 })
    if (irB.status !== 'arrived') return fail('no llegué al sitio')
  }

  const r = yield ctx.place(args.obra, args.en)
  if (r.status === 'done') return done(args.obra)
  // ─── Los tres rechazos que se pueden distinguir, y qué significa cada uno ──
  //
  // `celda-ocupada` es el que más importa y el que más se malinterpreta: el mundo
  // NO corre la obra a la celda libre más cercana como hace `drop`. El sitio es el
  // que se pidió (ADR 0049 de Ánima I): una obra que se muda sola deja media choza
  // abandonada en el sitio anterior. Así que hay que elegir otro sitio, y eso lo
  // decide quien llama y no esta habilidad.
  if (r.por === 'celda-ocupada') return fail('ahí no entra: hay algo sólido, y una obra no se muda sola')
  if (r.por === 'no-lo-tiene') return fail('no la tengo en la mano')
  if (r.por === 'sin-permiso') return fail('todavía no tengo permiso para dejar algo funcionando')
  return fail(`el mundo no me dejó dejarla puesta: ${r.por ?? r.status}`)
}
