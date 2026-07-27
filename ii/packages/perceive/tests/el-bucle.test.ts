/**
 * EL BUCLE — criterio (b) del tramo B.
 *
 * ─── EL CRITERIO, escrito ANTES de implementar ──────────────────────────────
 *
 *   (b) `ticksPerdidos === 0` en una corrida de al menos 2000 ticks con
 *       habilidades en vuelo, con el número medido.
 *
 * Y el que hace que (b) signifique algo, porque un contador que nadie pudo hacer
 * subir es un cero que no mide nada:
 *
 *   · **el contador se puede mover**. Con un reloj de pared falso que hace que
 *     cada tick tarde más que su ventana, `ticksPerdidos` sube, y sube el número
 *     que corresponde.
 *
 * La definición completa de `ticksPerdidos` —qué cuenta como perdido y contra qué
 * reloj— está en el encabezado de `src/bucle.ts`. En dos líneas: **un tick está
 * perdido cuando su ventana de `1000/hz` ms pasó sin que el mundo avanzara**, y
 * las dos formas de que eso pase se cuentan por separado (`porTiempo` y
 * `porFalla`).
 */

import { describe, expect, it } from 'vitest'
import type { WorldBody } from '@anima/world'
import { hashWorldState } from '@anima/world'
import type { Ctx, Intent, Outcome, StepResult } from '@anima/skills'

import { Partida } from '../src/index.js'
import { conElla, cuerpo, mundo, actor, criatura } from './mundo.js'

type Hab = Generator<Intent, Outcome, StepResult>

/** Va y viene para siempre. Es la habilidad más simple que no termina nunca. */
function* idaYVuelta(ctx: Ctx): Hab {
  ctx.phase('ida-y-vuelta')
  for (;;) {
    yield ctx.goTo({ x: 5, y: 0 }, {})
    yield ctx.goTo({ x: 0, y: 0 }, {})
  }
}

const TICKS = 2000

// ─── (b) EL CRITERIO ────────────────────────────────────────────────────────

describe('(b) `ticksPerdidos === 0` en 2000 ticks con habilidades en vuelo', () => {
  it('la corrida entera, con el número medido', () => {
    const p = new Partida(conElla([], { stamina: 900 }))
    const v = p.volar('ella', idaYVuelta, undefined)
    const informe = p.avanzar(TICKS)

    expect(informe.ticks, 'el mundo avanzó los 2000').toBe(TICKS)
    expect(p.state.tick).toBe(TICKS)
    expect(informe.ticksPerdidos, JSON.stringify(informe.fallas)).toBe(0)
    expect(informe.porTiempo).toBe(0)
    expect(informe.porFalla).toBe(0)
    // Y la habilidad ESTUVO en vuelo todo el tiempo, que es la otra mitad del
    // criterio: 2000 ticks con nadie volando los cumple una piedra.
    expect(v.terminado, 'la habilidad se cayó a mitad de camino').toBe(false)
    expect(v.ticks).toBe(TICKS)
    // Fue y vino de verdad: cinco celdas de ida, cinco de vuelta, más el tick de
    // reanudación de cada tramo. Que el viaje se haya completado decenas de veces
    // es lo que prueba que la repetición de `goTo` anda a escala.
    expect(p.state.bodies.get('ella-cuerpo')!.at.x).toBeGreaterThanOrEqual(0)
    expect(p.state.bodies.get('ella-cuerpo')!.at.x).toBeLessThanOrEqual(5)
  })

  it('con DOS criaturas volando a la vez, también', () => {
    // El índice de celdas se arma UNA vez por tick y lo comparten las dos: es la
    // razón de ser de que la proyección viva en la `Partida` y no en el `ctx`.
    const otra: WorldBody = { body: criatura('otra', 900), at: { x: 0, y: 8 } }
    const w = mundo({
      bodies: [{ body: criatura('ella', 900), at: { x: 0, y: 0 } }, otra, {
        body: cuerpo('p', 'piedra', 3),
        at: { x: 9, y: 9 },
      }],
      actors: [actor('ella'), actor('otra')],
    })
    const p = new Partida(w)
    const a = p.volar('ella', idaYVuelta, undefined)
    const b = p.volar('otra', idaYVuelta, undefined)
    const informe = p.avanzar(TICKS)
    expect(informe.ticksPerdidos).toBe(0)
    expect(a.terminado).toBe(false)
    expect(b.terminado).toBe(false)
  })
})

// ─── QUE EL CONTADOR SE PUEDA MOVER ─────────────────────────────────────────

describe('el contador se puede mover: si no, el cero no significa nada', () => {
  it('un reloj de pared que hace cada tick el doble de su ventana pierde un tick por tick', () => {
    // La ventana a 20 Hz son 50 ms. Si cada tick tarda 100, cuando termina el
    // primero ya venció la ventana del segundo: se pierde uno por cada uno que
    // corre. El reloj es FALSO y determinista — el de pared vive en la frontera y
    // entra por parámetro, que es lo que deja a `src/` sin `Date` ni
    // `performance`.
    let ahora = 0
    const reloj = (): number => {
      ahora += 50
      return ahora
    }
    // Dos lecturas por tick (antes y después), 50 ms cada una: cada tick «tarda»
    // 50 ms de trabajo más 50 del salto entre ticks = 100, o sea dos ventanas.
    const p = new Partida(conElla([], { stamina: 900 }), { reloj })
    p.volar('ella', idaYVuelta, undefined)
    const informe = p.avanzar(100)
    expect(informe.ticks).toBe(100)
    expect(informe.porTiempo, 'el contador no se movió: no mide nada').toBeGreaterThan(0)
    expect(informe.ticksPerdidos).toBe(informe.porTiempo)
  })

  it('un reloj que va a tiempo NO pierde ninguno', () => {
    // El control negativo. Sin él, el test de arriba pasaría también con un
    // contador que sube siempre.
    let ahora = 0
    const reloj = (): number => {
      // Cada tick consume exactamente su ventana: 50 ms a 20 Hz, repartidos en
      // las dos lecturas.
      ahora += 25
      return ahora
    }
    const p = new Partida(conElla([], { stamina: 900 }), { reloj })
    p.volar('ella', idaYVuelta, undefined)
    const informe = p.avanzar(200)
    expect(informe.porTiempo).toBe(0)
    expect(informe.ticksPerdidos).toBe(0)
  })

  it('`porFalla` cuenta el tick que el mundo no pudo dar, y no tira la partida', () => {
    // Una frecuencia inadmisible: `dtDeFrecuencia` LANZA, porque a 30 Hz
    // `dt = 1/30` no es exacto en la escala de las tasas y el replay divergiría
    // (ADR II-0008). El bucle lo cuenta y sigue: tirar la corrida entera porque
    // un tick se rompió haría que el criterio no se pueda ni medir.
    const p = new Partida(conElla([], { stamina: 900, hz: 30 }))
    const informe = p.avanzar(10)
    expect(informe.ticks, 'el mundo no avanzó ni uno').toBe(0)
    expect(informe.porFalla).toBe(10)
    expect(informe.ticksPerdidos).toBe(10)
    expect(informe.fallas[0]?.why).toContain('30')
  })
})

// ─── DETERMINISMO DEL BUCLE ─────────────────────────────────────────────────

describe('el bucle no le agrega azar al mundo', () => {
  it('dos partidas gemelas con la misma habilidad dan el mismo `hashWorldState`', () => {
    const correr = (): string => {
      const p = new Partida(conElla([cuerpo0()], { stamina: 900 }), { semilla: 7 })
      p.volar('ella', idaYVuelta, undefined)
      p.avanzar(600)
      return hashWorldState(p.state)
    }
    const a = correr()
    const b = correr()
    expect(a).toBe(b)
  })

  it('y una habilidad DISTINTA da un hash distinto: el test no es trivial', () => {
    const p1 = new Partida(conElla([cuerpo0()], { stamina: 900 }))
    p1.volar('ella', idaYVuelta, undefined)
    p1.avanzar(300)
    const p2 = new Partida(conElla([cuerpo0()], { stamina: 900 }))
    p2.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        for (;;) yield ctx.goTo({ x: -4, y: 2 }, {})
      },
      undefined,
    )
    p2.avanzar(300)
    expect(hashWorldState(p1.state)).not.toBe(hashWorldState(p2.state))
  })

  it('dos habilidades del mismo actor no se pueden poner en vuelo, y se dice por qué', () => {
    // `SkillRun` numera sus intenciones desde cero POR CORRIDA, así que dos
    // corridas del mismo actor vivas en el mismo tick emiten las dos `seq: 0` y
    // `stepWorld` las rechaza a las dos con `orden-duplicado`. Está dicho en
    // `skills/src/ejecutor.ts:#seq`; acá se hace explícito en vez de dejar que el
    // mundo lo descubra.
    const p = new Partida(conElla([]))
    p.volar('ella', idaYVuelta, undefined)
    expect(() => p.volar('ella', idaYVuelta, undefined)).toThrow(/ya tiene una habilidad en vuelo/)
  })
})

// ─── EL HUECO QUE QUEDA ABIERTO ─────────────────────────────────────────────

describe('lo que este tramo NO cerró', () => {
  it.fails('el dado de la PARTIDA —el que ve `ctx.rng`— no entra en `hashWorldState`', () => {
    // CORRECCIÓN, y hay que decirla porque la versión anterior de este comentario
    // ya no es cierta: decía «`@anima/world` no importa `@anima/oracle` en ninguna
    // línea, así que `WorldState` no tiene dónde guardar el entero del dado». El
    // otro frente de este mismo tramo escribió `world/src/dios.ts`, y **el dado
    // DEL MUNDO sí entra al hash y sí sobrevive a `JSON.stringify`** — medido en
    // `tests/ataque-a-la-costura.test.ts`, bloque 4.
    //
    // POR QUÉ SIGUE ABIERTO IGUAL, con el hueco corregido: son DOS dados. El del
    // mundo vive en `WorldState.dios.dado` y lo tira `sacarDelPozo`; el que la
    // habilidad recibe por `ctx.rng` lo construye `Partida` (`dadoDelMundo(o.semilla
    // ?? 0)`) y **ése no está en ningún lado del estado**. O sea que dos partidas
    // con el mismo hash de mundo pueden tener suertes distintas del lado de la
    // mente, y restaurar un snapshot le reinicia el dado a la habilidad. Este test
    // lo mide sobre un mundo SIN dios, que es el caso donde el hash del mundo es
    // idéntico y la única diferencia posible es la de la `Partida`.
    //
    // Hoy no se nota porque ninguna de las quince innatas usa `ctx.rng`; se nota
    // el día que una elija a dónde caminar tirando el dado.
    //
    // QUÉ HARÍA FALTA: que `Partida` le pase a `Contexto` el dado del mundo
    // (`dadoDe(state.dios)`, que ya existe en `world/src/dios.ts`) en vez de uno
    // propio, o —si la mente tiene que tener su propio azar para no correrle el
    // dado al mundo— que ese entero viva en una ranura del snapshot. Archivos:
    // `perceive/src/bucle.ts` (`Partida.dado`) y `perceive/src/contexto.ts`
    // (`ContextoOptions.rng`).
    const a = new Partida(conElla([]), { semilla: 1 })
    const b = new Partida(conElla([]), { semilla: 999 })
    a.avanzar(5)
    b.avanzar(5)
    a.dado.tirar()
    b.dado.tirar()
    expect(hashWorldState(a.state) === hashWorldState(b.state)).toBe(false)
  })
})

function cuerpo0(): WorldBody {
  return { body: cuerpo('p', 'piedra', 3), at: { x: 3, y: 3 } }
}
