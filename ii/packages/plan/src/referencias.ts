// ─── @anima/plan/referencias.ts ──────────────────────────────────────────────
//
// RESOLVER ES DESCONFIAR DE LA FOTO.
//
// Un plan dura decenas de ticks y un `BodyView` dura UNO: la vista está congelada
// por tick —es lo que cierra el agujero 2 del ataque al sandbox— y se rearma
// entera en el siguiente. Guardar el objeto adentro del plan sería guardar una
// foto vieja y creerle: el pescado que ya me comí sigue teniendo `at`, `name` y
// `joints`, y el paso que lo nombra typechequea igual. Por eso el plan nombra con
// `Ref` y acá se busca CONTRA LA VISTA DE HOY, cada vez, aunque el costo duela.
//
// Y cuando no está, no está: `undefined`. La mente replanifica, que es correcto y
// no un bug — el equivalente barato de lo que si no se paga adentro del mundo,
// caminando hasta donde el pescado estaba.
//
// ─── Las decisiones, que son cinco ──────────────────────────────────────────
//
// 1. `resolverCuerpo` ES LA IMPLEMENTACIÓN Y `resolver` LA ENVUELVE, y no al
//    revés, aunque la lista de arriba se lea al revés. Si la primaria fuera
//    `resolver`, `resolverCuerpo` tendría que mirar el valor devuelto para saber
//    si le tocó cuerpo o celda (`'id' in x`) — y esa pregunta ya está contestada
//    en la ETIQUETA del `Ref`: la única forma que rinde una `Cell` es `celda`.
//    Interrogar al valor lo que el tipo ya dice es por donde se cuelan los casts.
//
// 2. `id` NO TIENE ÍNDICE, Y EL COSTO SE DICE EN VOZ ALTA. Ni `VistaDelPlan` ni
//    el `Ctx` del que es subconjunto tienen un `porId`: la única forma de ir de un
//    `BodyId` a su vista de hoy es `see([])` y filtrar, o sea O(cuerpos a la
//    vista) POR RESOLUCIÓN. Antes de pagarlo se prueban dos atajos que no son
//    adivinanza —la criatura misma y lo que tiene en la mano—, y son los dos casos
//    que más aparecen: un plan se refiere sobre todo a lo que acaba de fabricar,
//    y lo que uno fabrica lo tiene agarrado. Medido en `banco-las-referencias`.
//
// 3. `donde` ELIGE EL MÁS CERCANO Y DESEMPATA POR `id`. `see()` no promete orden,
//    así que «el primero que venga» es no-determinismo con cara de simplicidad; y
//    «el más cercano» a secas también, en cuanto dos cuerpos empatan en distancia.
//    La métrica es la `distancia` de `@anima/skills/innatas` —Chebyshev, la de
//    `aMano()` del mundo— IMPORTADA y no transcrita: dos métricas contra el mismo
//    `within` es el bug que aparece en la grilla como «a veces no llega».
//
// 4. NO SE ORDENA LA LISTA ENTERA: SE RECORRE UNA VEZ. `porCercania` ordena las N
//    y tira todas menos la primera; acá hace falta el mínimo y nada más, y el
//    mínimo sale de un barrido. El riesgo real de tener dos escrituras del mismo
//    orden es que un día digan cosas distintas, y eso lo cuida un test que compara
//    esta elección contra `porCercania(...)[0]` — no una promesa de este comentario.
//
// 5. `rinde` SE LAVA POR `id`. Ver `Rindes`, abajo: guarda `BodyView`, que es
//    exactamente lo que el encabezado de `tipos.ts` prohíbe guardar.
//
// Regla 2: no hay reloj, ni azar, ni `Math` trascendente, ni `await`. Todo el
// orden de acá es total —distancia, y después `id`— porque un orden parcial
// resuelto por el orden de llegada de `see()` es no-determinismo con otra cara.

import type { BodyId, BodyView, Cell, SelfView, Where } from '@anima/skills'
import { distancia } from '@anima/skills/innatas'
import type { GoalId, Ref, VistaDelPlan } from './tipos.js'

/**
 * Lo que ya rindieron los pasos anteriores del mismo plan, por nodo. Es lo que
 * hace resoluble `{k:'rinde', de}` — la ligadura diferida del ADR 0082.
 *
 * HALLAZGO, y no es menor: este mapa guarda `BodyView`, o sea LA FOTO VIEJA que
 * el módulo entero existe para no creerle. El rendimiento de un paso se anota en
 * el tick en que el paso terminó, y se lee decenas de ticks después.
 *
 * Se resuelve sin cambiarle el tipo —hay otros módulos escritos contra él— pero
 * de la foto se usa SÓLO EL `id`, y con ese id se vuelve a resolver contra la
 * vista de hoy. Las dos consecuencias, dichas:
 *
 *   - `rinde` cuesta lo mismo que `id`, o sea O(cuerpos a la vista) en el peor
 *     caso. Deja de ser un `Map.get`, y está bien que deje de serlo;
 *   - un rendimiento que se fue de la vista —lo dejé en el piso y me alejé, o
 *     `union` se lo comió como atador— se resuelve a `undefined` en vez de a un
 *     fantasma con `at` de hace cuarenta ticks. El fantasma no falla acá: falla
 *     tres pasos después, adentro del mundo, con `cuerpo-desconocido`, o peor,
 *     mandando a la criatura a caminar hasta donde el pescado estaba.
 *
 * El tipo honesto sería `ReadonlyMap<GoalId, BodyId>`. Está anotado en el informe.
 */
export type Rindes = ReadonlyMap<GoalId, BodyView>

/**
 * Un `Ref` puede nombrar una celda, y una celda NO es un cuerpo. Que el tipo lo
 * diga evita el bug que el `Ctx` ya documenta en `see`: el agua es un campo de
 * celda, y tratarla como cuerpo compila y no encuentra nada nunca.
 */
export type Resuelto = BodyView | Cell

/**
 * `see([])` es «todo lo que hay a la vista»: un `Where` vacío no filtra nada
 * (`contexto.ts:285` recorre las cláusulas y no hay ninguna). Congelado y a nivel
 * de módulo porque se pide una vez por resolución de `id` y por resolución de
 * `rinde`, y un array nuevo por llamada es basura que el tick paga 5000 veces.
 */
const TODO: Where = Object.freeze([])

/**
 * Un `Ref` contra la vista de HOY. `undefined` si lo que el plan nombraba ya no
 * está: el paso se cae y la mente replanifica, que es correcto y no un bug.
 */
export function resolver(r: Ref, v: VistaDelPlan, rindes?: Rindes): Resuelto | undefined {
  // La celda se contesta acá y no en `resolverCuerpo` por la decisión 1: es la
  // ÚNICA forma que no rinde un cuerpo, y una celda no se resuelve contra nada
  // —no hay nada que consultar—, es la coordenada que el plan escribió.
  return r.k === 'celda' ? r.at : resolverCuerpo(r, v, rindes)
}

/** Igual, pero sólo cuerpos: `undefined` también cuando el `Ref` era una celda. */
export function resolverCuerpo(r: Ref, v: VistaDelPlan, rindes?: Rindes): BodyView | undefined {
  switch (r.k) {
    // No es un fracaso: es la respuesta. Quien pide un cuerpo y nombró una celda
    // preguntó mal, y enterarse acá es más barato que enterarse en `apply`.
    case 'celda':
      return undefined
    // `SelfView extends BodyView`, así que la criatura se puede pasar a sí misma
    // como rol —`friccion` la pide como `actor`, que es cómo enciende el primer
    // fuego de la partida—. Y sale por identidad: es la vista de hoy por
    // construcción, no hay nada que buscar.
    case 'yo':
      return v.self
    case 'id':
      return porId(r.id, v)
    case 'donde':
      return masCercano(v.see(r.where), v.self.at)
    // El lavado de la decisión 5: del mapa sale una foto, de la foto sale el id,
    // y del id sale la vista de hoy. Si `rindes` no vino, el plan nombró un
    // rendimiento antes de que existiera y eso también es `undefined`.
    case 'rinde': {
      const foto = rindes?.get(r.de)
      return foto === undefined ? undefined : porId(foto.id, v)
    }
  }
}

/**
 * Todos los de un registro de roles. `undefined` si falta alguno.
 *
 * ES TODO O NADA a propósito. Un registro a medias —`{gear}` sin `source`— pasa
 * el typecheck de `RolesOf` sólo si el rol es opcional, y si no lo es viaja hasta
 * el mundo para volver como `rol-sin-cuerpo` cuando el turno ya se gastó.
 *
 * Y las claves salen ORDENADAS. `Object.keys` devuelve orden de inserción, así
 * que dos llamadores que arman el mismo registro con los mismos roles en distinto
 * orden producirían dos objetos que no son iguales para nada que los recorra
 * —una traza, un hash—. Se comparan con `<` y no con `localeCompare`: regla 2.
 */
export function resolverTodos(
  roles: Readonly<Record<string, Ref>>,
  v: VistaDelPlan,
  rindes?: Rindes,
): Readonly<Record<string, BodyView>> | undefined {
  const nombres = Object.keys(roles).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const out: Record<string, BodyView> = {}
  for (const nombre of nombres) {
    const r = roles[nombre]
    // Una clave presente con valor `undefined` no se saltea: se cae. Saltearla
    // sería descartar en silencio lo que no se entiende, que es el pecado que
    // `parsePromesa` comete y que este paquete existe en parte para no repetir.
    if (r === undefined) return undefined
    const b = resolverCuerpo(r, v, rindes)
    if (b === undefined) return undefined
    out[nombre] = b
  }
  return out
}

/**
 * De un `BodyId` a la vista de hoy, sin índice porque no hay ninguno.
 *
 * Los dos atajos de adelante no son una heurística: son las dos partes de la
 * vista que YA están armadas y que `see()` puede no traer. Un cuerpo en la mano
 * viaja con la criatura (`step.ts:1605`) y por eso hoy cae adentro del radio de
 * percepción, pero eso es una propiedad del mundo de hoy, no del contrato: si el
 * radio cambiara, o si la vista fuera una de mentira, mirar la mano primero sólo
 * puede encontrar algo que el barrido se hubiera perdido. Nunca puede encontrar
 * uno equivocado — las tres lecturas salen del mismo tick congelado.
 */
function porId(id: BodyId, v: VistaDelPlan): BodyView | undefined {
  const self: SelfView = v.self
  if (self.id === id) return self
  for (const b of self.holding) if (b.id === id) return b
  // Y acá se paga: O(cuerpos a la vista), una vez por resolución.
  for (const b of v.see(TODO)) if (b.id === id) return b
  return undefined
}

/**
 * El mínimo bajo el orden total (distancia Chebyshev, y después `id`).
 *
 * Un barrido y no un `sort`: es el mismo elemento que `porCercania(xs, desde)[0]`
 * —lo pina un test, ver la decisión 4— por la mitad del trabajo y sin copiar el
 * array. Lo de no copiarlo importa además por otra razón: `see()` puede devolver
 * la lista que la percepción tiene armada, y ordenarla en el lugar le cambiaría el
 * orden a todo el que la mire después.
 */
function masCercano(xs: readonly BodyView[], desde: Cell): BodyView | undefined {
  let mejor: BodyView | undefined
  let mejorD = 0
  for (const x of xs) {
    const d = distancia(x.at, desde)
    // El desempate por `id` va en la MISMA comparación y no en un segundo paso:
    // separarlos deja una ventana donde el primero que llegó gana el empate.
    if (mejor === undefined || d < mejorD || (d === mejorD && x.id < mejor.id)) {
      mejor = x
      mejorD = d
    }
  }
  return mejor
}
