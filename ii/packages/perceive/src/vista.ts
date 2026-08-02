// ─── @anima/perceive/vista.ts ────────────────────────────────────────────────
//
// LA VISTA CONGELADA DEL TICK. La pieza que el documento de arquitectura llama
// «no negociable»:
//
//   «el agente nunca ve `WorldState`. Es lo que hace del mundo un juez y no un
//    decorado, y lo que impide que el modelo alucine estado.»
//
// Acá se proyectan `BodyView`, `SelfView` y `PerceptionView` desde el
// `WorldState`, que hasta hoy no tenían ningún productor: el mundo guardaba
// `WorldBody` y `Actor`, y la única implementación de la superficie era
// `skills/tests/mundito.ts`, declarado juguete en su propio encabezado.
//
// ─── DECISIÓN 2: mutar `at` no puede mover el cuerpo ────────────────────────
//
// Es el agujero 2 del ataque al sandbox
// (`skills/tests/ataque-al-sandbox.test.ts`), y su `it.fails` decía, textual,
// que la reparación «no vive en este paquete… vive en la capa de PERCEPCIÓN, y
// `@anima/perceive` no existe todavía». Existe.
//
// Las dos salidas obvias son las dos malas:
//
//   - **clonar la celda** por cuerpo y por tick. Es exactamente el gasto que el
//     Hito 2 se pasó cuatro semanas sacando, y en la vista es peor que en el
//     mundo porque `see()` se llama diez veces por tick;
//   - **dejarlo abierto** y confiar en el `readonly` de `Cell`. El typecheck lo
//     ataja —está medido en el test de al lado— pero es una defensa con horario:
//     no cubre lo que se carga de un guardado, ni una innata parcheada, ni JS sin
//     tipos.
//
// La que se eligió no es ninguna de las dos: **`Object.freeze` sobre el propio
// `Placement` del mundo**. Cuesta CERO asignaciones —no se crea ningún objeto—,
// se paga una sola vez por objeto (`stepWorld` crea un `at` nuevo sólo cuando el
// cuerpo se muda, así que los quietos ya están congelados desde su primer tick),
// y en `"use strict"` —que es como corre el sandbox— asignar a una propiedad de
// un objeto congelado LANZA en vez de no hacer nada en silencio. La habilidad se
// entera; el mundo no se mueve.
//
// Lo que hay que decir de esta decisión, porque es lo único incómodo: se le
// cambia la extensibilidad a un objeto del mundo. Es seguro y está verificado —
// `stepWorld` nunca escribe `c.at.x`, siempre reemplaza el `WorldBody` entero
// (`grep "at\.x *=" world/src` da cero) — y el costo está medido en
// `tests/banco-la-vista.test.ts`.
//
// ─── DECISIÓN 3: la vista se refresca EN SU LUGAR ───────────────────────────
//
// El contrato de `WorldCtx` (`skills/src/ejecutor.ts:220-231`) dice que el mundo
// entrega UN objeto por habilidad en vuelo y lo refresca en su lugar cada tick,
// porque el generador se quedó con la referencia del primero.
//
// Y `ctx.self`, `ctx.tick` y `ctx.clock` son **PROPIEDADES, no métodos**. Cinco
// de las quince innatas se rompen si la vista queda congelada. La reparación que
// el Hito 4 proponía era `ctx.self()`, y arrastra a las quince y al corpus de 28
// borradores. Acá se hizo la otra: **la propiedad es un getter** que lee el
// estado del tick actual. La firma no cambia —`readonly self: SelfView` la
// cumple un getter— y el refresco es de verdad, no un contrato en prosa. Lo
// demuestra `tests/la-vista.test.ts` («la vista se refresca en su lugar»), que
// guarda la referencia al `ctx` de antes del tick y la lee treinta ticks después
// — y su contrapositivo al lado: un spread del `ctx` la congela.
//
// ─── DECISIÓN 4: la vista entera se congela, y no sólo su `at` ──────────────
//
// Sellar el `Placement` cerró la vía por la que una mutación llegaba AL MUNDO.
// No cerró la otra mitad, y el adversario de este tramo la midió: como la vista
// se MEMOIZA por `(actor, cuerpo)` y se devuelve por identidad, `b.name = 'PIEDRA
// FALSA'` sobrevivía al resto del tick — el `see()` siguiente devolvía el mismo
// objeto mentido mientras `q()` y `can()` seguían contestando la verdad, leyendo
// `state.bodies`. **La vista y el juez diciendo cosas distintas** es la peor de
// las combinaciones posibles: es un verde falso que dura toda la partida.
//
// Medido antes de la reparación: `at` rebota · `joints` MUTA · `name` MUTA ·
// `holding` MUTA.
//
// La reparación es `Object.freeze` sobre la `BodyView` al salir de la fábrica, y
// sobre los dos arreglos que cuelgan de ella (`joints` y, en la `SelfView`,
// `holding`). Por qué se puede pagar, y son las mismas tres razones que sostienen
// el sellado del `at`:
//
//   1. **se paga una vez por cuerpo y por tick**, no por mirada: la caché ya
//      existía y devuelve el mismo objeto a las diez `see()` del tick. Lo que se
//      congela es lo que se MIRA —71 cuerpos de 5000 con radio 12— y no el mundo;
//   2. **no asigna nada**: son los objetos que la vista ya construía;
//   3. **en `"use strict"` la mutación LANZA**, así que la habilidad se entera.
//      Contra el `readonly` del tipo —que es lo único que había— no se enteraba
//      nadie: `readonly` no existe en tiempo de ejecución y no cubre lo que se
//      carga de un guardado, ni una innata parcheada, ni JS sin tipos.
//
// El costo está medido en `tests/banco-la-vista.test.ts` («(c) congelar la vista
// entera»), contra el banco de 5000 cuerpos y contra los 50 ms del tick a 20 Hz.

import type { Physics } from '@anima/physics'
import { nameOf, qualityOf, tagsDe } from '@anima/physics'
import type {
  Actor,
  ActorId,
  BodyId,
  Cell,
  WorldBody,
  WorldState,
} from '@anima/world'
import { chunkCoord, idDePozo } from '@anima/world'
import type { BodyView, JointView, SelfView } from '@anima/skills'

/**
 * ¿ESTE CUERPO ES UN BANCO DEL QUE SE SACA?
 *
 * La cuenta es la de `stockDe` en `world/src/step.ts`, copiada a propósito y no
 * aproximada: un cuerpo es el pozo de su chunk si su id es el que `idDePozo`
 * genera para las coordenadas donde ESTÁ. Preguntarlo distinto sería una
 * superficie que dice que sí y un mundo que contesta `sin-pozo`.
 *
 * Sin dios no hay decreto y por lo tanto no hay pozos: los mundos de test que no
 * lo traen contestan que no, que es la verdad ahí.
 */
function esUnaFuente(s: WorldState, c: WorldBody): boolean {
  if (s.dios === undefined) return false
  return c.body.id === idDePozo(chunkCoord(c.at.x), chunkCoord(c.at.y))
}

import { IndiceDelTick, RADIO_DE_PERCEPCION } from './indice.js'

/**
 * Hasta dónde se sigue la cadena `supportedBy` / `covering` al proyectar.
 *
 * Existe porque el mundo PERMITE ciclos por un tick: el arnés de invariantes del
 * Hito 2 encontró «A pisa a B y después B pisa a A» de verdad, en el tick 811 de
 * una partida al azar, y `revisarReferencias` recorre esa cadena con una cota
 * por la misma razón — sin ella el tick no termina. Una proyección recursiva sin
 * cota se cuelga con el mismo dato.
 *
 * Tres es la pila más alta que el arnés produjo (hilda, cira, ana) más uno.
 */
const PROFUNDIDAD_DE_APOYO = 4

/** Congela el `Placement` del mundo. Idempotente y sin asignar nada. Ver arriba. */
function sellar(at: Cell): Cell {
  // `isFrozen` primero: congelar un objeto ya congelado es barato pero no
  // gratis, y la enorme mayoría de los cuerpos no se mudó nunca.
  if (!Object.isFrozen(at)) Object.freeze(at)
  return at
}

/**
 * La proyección de un tick. Vive adentro del `IndiceDelTick` y muere con él.
 *
 * Las vistas se MEMOIZAN por id: diez `see()` en el mismo tick devuelven los
 * MISMOS objetos, así que comparar por identidad funciona y no se asigna una
 * vista por llamada. La caché muere con el tick, que es lo que la hace
 * imposible de invalidar mal.
 */
export class Proyeccion {
  readonly indice: IndiceDelTick
  /**
   * Por ACTOR y después por cuerpo, y las dos claves hacen falta.
   *
   * La primera versión cacheaba sólo por id y el test de `madeByMe` la agarró en
   * la primera corrida: `madeByMe` es una RELACIÓN y no un campo del cuerpo (ADR
   * II-0003, «autoría, no propiedad»), así que el mismo cuerpo es `true` para
   * quien lo hizo y `false` para todos los demás. Con una sola clave, la segunda
   * criatura que mira en el mismo tick se lleva la vista de la primera y se cree
   * autora de lo que no hizo. Hoy hay una criatura por partida y el bug era
   * invisible; el día que haya dos, es una mentira sobre quién construyó qué.
   */
  readonly #vistas = new Map<ActorId, Map<BodyId, BodyView>>()

  constructor(indice: IndiceDelTick) {
    this.indice = indice
  }

  #cacheDe(quien: ActorId): Map<BodyId, BodyView> {
    let m = this.#vistas.get(quien)
    if (m === undefined) {
      m = new Map<BodyId, BodyView>()
      this.#vistas.set(quien, m)
    }
    return m
  }

  get state(): WorldState {
    return this.indice.state
  }

  get phys(): Physics {
    return this.indice.state.phys
  }

  cuerpo(id: BodyId, quien: ActorId): BodyView | undefined {
    const c = this.state.bodies.get(id)
    return c === undefined ? undefined : this.vista(c, quien, 0)
  }

  /**
   * `quien` entra porque `madeByMe` es una relación y no un campo del cuerpo:
   * ADR II-0003, «autoría, no propiedad — no es lo mío, es lo que hice». El
   * mismo cuerpo es `madeByMe: true` para una criatura y `false` para la otra, y
   * por eso la caché va por las dos claves. Ver `#vistas`.
   */
  vista(c: WorldBody, quien: ActorId, hondo: number): BodyView {
    const cache = this.#cacheDe(quien)
    if (hondo === 0) {
      const memo = cache.get(c.body.id)
      if (memo !== undefined) return memo
    }
    // Congelado ACÁ y no al final: es el arreglo que la vista publica, y un
    // `push` sobre él le inventaba juntas a un cuerpo que no las tiene.
    const joints: readonly JointView[] = Object.freeze(
      c.body.joints.map((j) => Object.freeze({ a: j.a, b: j.b, strength: j.strength })),
    )
    const v: {
      -readonly [K in keyof BodyView]: BodyView[K]
    } = {
      id: c.body.id,
      at: sellar(c.at),
      name: nameOf(c.body, this.phys),
      // De qué clase es la materia, con la `Physics` VIVA y no con el catálogo de
      // la semilla: `tagsDe` lee `phys.substances`, así que una sustancia que la
      // ley 4 dio de alta en esta partida —el residuo de una pirólisis— contesta
      // SUS tags y no los de la madre. Ver `BodyView.tags` para el bug que costó.
      // No se congela ACÁ y no por descuido: `tagsDe` lo memoriza por el arreglo de
      // partes y lo comparte entre vistas, así que lo congela ELLA, una vez por
      // arreglo de partes en vez de una por vista. Sin eso, un `push` desde una
      // habilidad no ensuciaría una vista: ensuciaría la física entera.
      tags: tagsDe(c.body, this.phys),
      madeByMe: c.body.madeBy === quien,
      joints,
    }
    // ─── ESTO ES UNA FUENTE, y se pregunta con la MISMA regla que el mundo ────
    //
    // `stockDe` decide que un cuerpo es un pozo comparando su id con el del chunk
    // donde está, así que acá se hace la misma cuenta y no una parecida. Dos
    // definiciones de «esto es un banco» serían una superficie que dice que sí y
    // un mundo que contesta `sin-pozo`.
    //
    // Sólo se pone cuando es verdad: un `esFuente: false` explícito no agrega
    // nada y ensucia todas las vistas, que son miles por tick.
    if (esUnaFuente(this.state, c)) v.esFuente = true
    // De alguien: `actors` dice qué cuerpo es de quién, y se pregunta ahí en vez
    // de mirarle el id. Ver `BodyView.esDeAlguien`.
    if (this.indice.esDeAlgunActor(c.body.id)) v.esDeAlguien = true
    if (c.heldBy !== undefined) v.heldBy = c.heldBy
    if (hondo < PROFUNDIDAD_DE_APOYO) {
      if (c.supportedBy !== undefined) {
        const s = this.state.bodies.get(c.supportedBy)
        if (s !== undefined) v.supportedBy = this.vista(s, quien, hondo + 1)
      }
      if (c.covering !== undefined) {
        const t = this.state.bodies.get(c.covering)
        if (t !== undefined) v.covering = this.vista(t, quien, hondo + 1)
      }
      const arriba = this.indice.tapadoPor(c.body.id)
      if (arriba !== undefined) {
        const t = this.state.bodies.get(arriba)
        if (t !== undefined) v.coveredBy = this.vista(t, quien, hondo + 1)
      }
    }
    // DECISIÓN 4: se congela al SALIR de la fábrica, con todos los campos ya
    // puestos. Las vistas de `supportedBy`/`covering`/`coveredBy` vienen
    // congeladas de su propia llamada, así que la cadena entera queda cerrada sin
    // ningún recorrido extra.
    const vista = Object.freeze(v) as BodyView
    if (hondo === 0) cache.set(c.body.id, vista)
    return vista
  }

  /**
   * La criatura. `SelfView extends BodyView`, así que se puede pasar a sí misma
   * como rol de un proceso — que es el paso 1 de encender el primer fuego.
   *
   * `stamina` es `qualityOf(cuerpo, 'stamina')` y no otra cosa: la superficie lo
   * declara como «atajo de `ctx.q(ctx.self,'stamina')`», y que sean literalmente
   * la misma lectura es lo que impide que un día digan cosas distintas.
   *
   * Devuelve `undefined` si el actor ya no está: se murió de hambre (ADR
   * II-0009) o nunca existió. No se inventa una criatura vacía — una `SelfView`
   * con `stamina: 0` sobre un actor muerto es exactamente la clase de dato que
   * hace que una habilidad siga trabajando después del final.
   */
  self(a: Actor): SelfView | undefined {
    const c = this.state.bodies.get(a.body)
    if (c === undefined) return undefined
    const base = this.vista(c, a.id, 0)
    const holding: BodyView[] = []
    for (const id of a.holding) {
      const h = this.state.bodies.get(id)
      if (h !== undefined) holding.push(this.vista(h, a.id, 0))
    }
    // El spread de `base` copia campo por campo, así que el congelado de `base` no
    // viaja: hay que volver a congelar. Y `holding` aparte, por la misma razón que
    // `joints` — un `push` le ponía cosas en la mano que el mundo no le dio.
    return Object.freeze({
      ...base,
      holding: Object.freeze(holding) as readonly BodyView[],
      capacity: a.capacity,
      stamina: qualityOf(c.body, 'stamina', this.phys),
      permits: a.permits,
    })
  }

  /** Los cuerpos a la vista de esta criatura, en orden canónico de id. */
  aLaVista(desde: Cell, quien: ActorId, radio = RADIO_DE_PERCEPCION): BodyView[] {
    const out: BodyView[] = []
    for (const id of this.indice.cuerposCerca(desde, radio)) {
      const c = this.state.bodies.get(id)
      if (c !== undefined) out.push(this.vista(c, quien, 0))
    }
    return out
  }
}
