// INNATA 12/15 · «huir del dolor» — el reflejo. Alejarse de lo que hace mal.

import type { Cell, Ctx, Intent, Outcome, StepResult } from '../ctx.js'
import { done, fail } from '../ctx.js'
import type { Contrato } from './contrato.js'
import { anillo, distancia } from './comun.js'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * HALLAZGO PRINCIPAL — NO HAY DOLOR, Y AHORA SE PUEDE DEMOSTRAR.
 *
 * `QualityId` son 29 cualidades. Ninguna es `pain`, `health`, `damage`,
 * `injury` ni `threat`. Y `Motivo` —el vocabulario completo de todo lo que el
 * mundo le puede contestar a una criatura— tiene veinte entradas y ninguna
 * habla de daño.
 *
 * Lo único que puede lastimarla y es LEGIBLE:
 *
 *   · su propia `temperature`, que la ley 1 relaja hacia el ambiente y la ley 3
 *     dispara si llega al punto de ignición — o sea, quemarse;
 *   · su `stamina`, que la ley del metabolismo drena sola y que `sin-fuerza`
 *     denuncia cuando llega a cero.
 *
 * Y `toxicity` NO cuenta, por una razón que se puede medir: `grep toxicity`
 * sobre `@anima/world/src` devuelve CERO. El veneno no hace nada. La ley de
 * descomposición lo sube y la de cocción lo baja, y ninguna consecuencia lo
 * lee. Comer algo podrido es, hoy, exactamente igual de bueno que comerlo
 * fresco a igualdad de calorías.
 *
 * SEGUNDO HUECO, estructural: un reflejo tiene que poder INTERRUMPIR lo que se
 * esté haciendo. `Ctx` no tiene prioridad, ni `abort`, ni forma de que una
 * habilidad se dispare sola. Quién la llama es el Hito 5; que la innata exista
 * no alcanza para que sea un reflejo, y esa distancia hay que decirla.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Cableado, y no hay de dónde sacarlo: no existe un rango «sano» publicado
 *  para el cuerpo de la criatura. 60 °C es una elección de este archivo. */
const CALOR_QUE_DUELE = 60

export const CONTRATO_HUIR_DEL_DOLOR: Contrato = {
  nombre: 'huir-del-dolor',
  establece: [{ sujeto: 'la-celda', q: 'temperature', op: '<', v: CALOR_QUE_DUELE }],
  precondiciones: [{ sujeto: 'yo', q: 'stamina', op: '>', v: 0 }],
  cuesta: { segundos: 0, commitment: 'reversible' },
  huecos: [
    'NO HAY DOLOR: ni `pain`, ni `health`, ni `damage`, ni `threat` en las 29 cualidades, y ninguno de los 20 `Motivo` habla de daño. Lo único legible que puede lastimar es la `temperature` del propio cuerpo y de la celda',
    'EL VENENO NO HACE NADA: `grep toxicity` sobre `@anima/world/src` devuelve cero resultados. Es una cualidad con dos leyes que la mueven y ninguna consecuencia que la lea',
    'NO HAY ENUMERACIÓN DE CELDAS: `qAt` acepta cualquier `Cell` y no hay ninguna forma de PEDIR celdas. Hay que inventarlas con aritmética desde `self.at`. Y no está dicho qué contesta `qAt` de una celda que la criatura nunca vio — si el dios la decreta al preguntarle, tantear el terreno con `qAt` estaría revelando mapa gratis',
    'NO HAY PRIORIDAD NI INTERRUPCIÓN: un reflejo que no puede cortar lo que está corriendo no es un reflejo. `Ctx` no tiene `abort` ni disparo automático',
    'no hay rango sano publicado para el cuerpo: el 60 de este archivo es una invención',
  ],
}

/**
 * CONTRATO
 *   establece   `qAt(self.at, 'temperature') < umbral`
 *   precondiciones  aliento para caminar
 *   cuesta      ticks de caminata; `reversible`
 *
 * POR QUÉ BAJA EL GRADIENTE Y NO CORRE EN LÍNEA RECTA: no hay dirección de
 * huida porque no hay perseguidor. Lo que hay es un campo escalar
 * —`qAt(celda, 'temperature')`— y una criatura parada en un punto caliente.
 * Bajar el gradiente es lo único que la superficie deja escribir, y encima es
 * lo correcto para el único daño que el mundo modela.
 *
 * POR QUÉ MIRA VARIOS ANILLOS: el anillo 1 puede estar todo caliente si una
 * está en el medio de la fogata. Se agrandan hasta `radio`, y si ninguna celda
 * mejora, se falla en vez de caminar al azar — caminar al azar gasta el aliento
 * que es la otra mitad de lo que la está matando.
 */
export function* huirDelDolor(
  ctx: Ctx,
  args: { radio?: number; umbral?: number },
): Generator<Intent, Outcome, StepResult> {
  ctx.phase('huir')
  const umbral = args.umbral ?? CALOR_QUE_DUELE
  const radio = args.radio ?? 4

  const aca = ctx.qAt(ctx.self.at, 'temperature')
  const enElCuerpo = ctx.q(ctx.self, 'temperature')
  if (aca < umbral && enElCuerpo < umbral) return done()

  // Los anillos se anclan en DÓNDE EMPEZÓ y no en dónde está: si se recentraran
  // en cada paso, el anillo 2 de la posición nueva se solapa con el anillo 1 de
  // la vieja y la búsqueda se muerde la cola. La celda de origen se copia, no se
  // guarda la referencia, porque `self.at` se refresca.
  const origen: Cell = { x: ctx.self.at.x, y: ctx.self.at.y }

  for (let r = 1; r <= radio; r++) {
    // Las celdas se INVENTAN con aritmética. La API no las enumera.
    let mejor: Cell | undefined
    let mejorT = aca
    for (const c of anillo(origen, r)) {
      const t = ctx.qAt(c, 'temperature')
      if (t < mejorT) {
        mejorT = t
        mejor = c
      } else if (mejor && t === mejorT && distancia(origen, c) < distancia(origen, mejor)) {
        mejor = c
      }
    }
    if (!mejor) continue

    const irA = yield ctx.goTo(mejor, { within: 0 })
    if (irA.status === 'rejected' && irA.por === 'sin-fuerza') {
      return fail('me quema y no me da el aliento para moverme')
    }
    if (irA.status === 'arrived' && ctx.qAt(ctx.self.at, 'temperature') < umbral) return done()
    // Si llegó y sigue caliente, o si la celda estaba ocupada, se prueba un
    // anillo más grande. `celda-ocupada` es exactamente el caso de estar
    // rodeada, y agrandar el radio es la respuesta correcta.
  }

  return fail(`no encontré dónde estar fresca en radio ${radio}`)
}
