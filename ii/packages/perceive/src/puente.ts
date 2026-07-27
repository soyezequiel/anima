// ─── @anima/perceive/puente.ts ───────────────────────────────────────────────
//
// EL PUENTE EVENTO → `StepResult`. La segunda costura que el Hito 4 dejó
// abierta: `stepWorld` devuelve `{ state, events }` y una habilidad espera un
// `StepResult` por intención. El único que hacía esa traducción era
// `Mundito.juzgar()`, en tests.
//
// La correlación NO se reimplementa: la hace `desenlaceDe(events, {by, seq})` de
// `@anima/world`, que es del mundo y sabe lo que el mundo sabe. Lo que se hace
// acá es lo otro, que el mundo dice con todas las letras que no le corresponde:
//
//   «los seis estados de `StepResult` —`arrived`, `found`, `done`, `blocked`,
//    `rejected`, `timeout`— son categorías de la MENTE, que sabe qué estaba
//    buscando y cuánto presupuesto le quedaba. El mundo sabe tres cosas y ninguna
//    más: si lo que pidió pasó, si se lo rechazó, o si todavía está pasando.»
//    (`world/src/step.ts:405`)
//
// ─── LA TABLA, caso por caso y con su porqué ────────────────────────────────
//
// | desenlace / situación                          | status      | por qué |
// |---|---|---|
// | `rechazado`                                    | `rejected`  | el mundo dijo que no, y `por` viaja tal cual. **Ninguna clase de rechazo se re-etiqueta**: las quince innatas ramifican sobre `r.por` —`ir` distingue `sin-fuerza` de `celda-ocupada` para decidir si insistir— y traducir un motivo a otra categoría les saca la información con la que deciden |
// | `logrado`, intención de un tick                | `done`      | `take`, `drop`, `put`, `eat`. Pasó y se terminó |
// | `logrado`/`en-curso`, `goTo`, llegó            | `arrived`   | «llegó» es distancia ≤ `within` LEÍDA DEL MUNDO después del paso, no el evento `movio`: `movio` dice que dio UN paso |
// | `goTo` sin presupuesto y sin llegar            | `timeout`   | ver `vuelo.ts`: el presupuesto sale de la distancia inicial, no de un número mágico |
// | `goTo` que no se acercó y no fue rechazado     | `blocked`   | el único caso que el mundo no puede nombrar: no dijo que no, y no avanzó |
// | `explore`, `until(vista)` dio verdadero        | `found`     | lo evalúa el EJECUTOR con la vista nueva de cada tick. La clausura nunca cruza |
// | `explore`, `maxTicks` agotados                 | `timeout`   | exactamente `maxTicks`, contados por el ejecutor |
// | `apply` con `completion`, completo             | `done` + `got` | `got` son los `nacio` del desenlace, que es literalmente lo que `StepResult.got` quiere (`world/src/step.ts:317`) |
// | `apply` sin `completion` (`friccion`)          | `done`      | no completa NUNCA —no tiene `completion`— así que repetirlo sería un bucle infinito. `frotar` lo reemite él mismo en su `while` |
// | `wait`, la espera se cerró (`espero`)          | `done`      | |
// | `sin-respuesta`                                | `blocked`   | el mundo no dijo NADA sobre esta intención. `desenlaceDe` avisa que con `stepWorld` no puede pasar —hasta un actor inventado sale rechazado— así que si aparece, algo se interpuso entre la habilidad y el mundo. «Bloqueada» es la lectura honesta, y la única que no inventa un motivo |
//
// ─── Lo que NO hace este archivo ────────────────────────────────────────────
//
// No repite nada. Traducir un desenlace es puro y sin estado; **repetir** —que
// es lo que hace que `goTo` llegue y que `explore` explore— necesita la vista de
// cada tick y el presupuesto, y eso es `vuelo.ts`. Mezclarlos haría que el
// traductor tuviera que acordarse de en qué tick va, que es justo lo que hace
// que una traducción deje de ser verificable con una tabla.

import type { BodyView, Motivo, StepResult } from '@anima/skills'
import type { Desenlace } from '@anima/world'

export type Estado = StepResult['status']

/** Arma un `StepResult` sin que el `por: undefined` viaje. */
export function resultado(status: Estado, got: readonly BodyView[] = [], por?: Motivo): StepResult {
  // Campo por campo y no con un spread del opcional: `exactOptionalPropertyTypes`
  // distingue «ausente» de «presente y undefined», y la superficie declara `por?`
  // — un `por: undefined` explícito viaja hasta el hash de la traza.
  return por === undefined ? { status, got } : { status, got, por }
}

/**
 * La traducción BASE: la que no necesita saber qué se estaba pidiendo.
 *
 * Devuelve `undefined` cuando el desenlace **no alcanza para cerrar**, o sea
 * cuando la intención sigue en curso y quien la emitió tiene que volver a
 * preguntar el tick que viene. Esa es la única pregunta que este archivo no
 * puede contestar solo, y por eso la devuelve en vez de inventarla.
 *
 * `nacidos` se resuelve a vistas afuera —acá no hay proyección— y por eso `got`
 * entra por parámetro: el puente traduce estados, no materia.
 */
export function traducir(d: Desenlace, got: readonly BodyView[]): StepResult | undefined {
  switch (d.k) {
    case 'rechazado':
      return resultado('rejected', got, d.por)
    case 'sin-respuesta':
      return resultado('blocked', got)
    case 'en-curso':
      return undefined
    case 'logrado':
      return resultado('done', got)
  }
}
