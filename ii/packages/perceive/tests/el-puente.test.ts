/**
 * EL PUENTE Y LA REPETICIÓN — criterio (d) del tramo B.
 *
 * ─── EL CRITERIO, escrito ANTES de implementar ──────────────────────────────
 *
 *   (d) `explore` con un `until` que se cumple da `'found'`, y uno que no se
 *       cumple da `'timeout'` en EXACTAMENTE `maxTicks`.
 *
 * Y la tabla entera del puente, caso por caso, porque los seis `status` son
 * categorías de la MENTE y la traducción hay que justificarla una por una — el
 * propio `world/src/step.ts:405` dice que el mundo sabe tres cosas y ninguna
 * más. La tabla está escrita en `src/puente.ts`; acá se la corre.
 */

import { describe, expect, it } from 'vitest'
import type { WorldBody } from '@anima/world'
import type { Ctx, Intent, Outcome, StepResult } from '@anima/skills'

import { Partida } from '../src/index.js'
import { conElla, cuerpo } from './mundo.js'

type Hab = Generator<Intent, Outcome, StepResult>

const enElPiso = (id: string, sust: string, masa: number, x: number, y: number): WorldBody => ({
  body: cuerpo(id, sust, masa),
  at: { x, y },
})

/** Corre una habilidad hasta que termine, y devuelve cuántos ticks de MUNDO costó. */
function correr(p: Partida, skill: (ctx: Ctx) => Hab, tope = 400): { ticks: number; out?: Outcome } {
  const v = p.volar('ella', skill as never, undefined)
  let n = 0
  while (!v.terminado && n < tope) {
    p.tick()
    n++
  }
  return v.outcome === undefined ? { ticks: n } : { ticks: n, out: v.outcome }
}

// ─── (d) EXPLORE ENTERO ─────────────────────────────────────────────────────

describe('(d) `explore` entero: el `until` lo evalúa el ejecutor', () => {
  it('un `until` que se cumple da `found`', () => {
    // El `until` es una CLAUSURA y nunca cruzó al mundo: el `Intent` de
    // `@anima/world` es `{k:'explore', maxTicks}` y nada más. Y `stepWorld` no
    // produce jamás `'found'` (`grep -rn "'found'" world/src` da cero). Quien lo
    // evalúa, con la vista NUEVA de cada tick, es el ejecutor.
    const p = new Partida(conElla([]))
    let visto: StepResult | undefined
    const r = correr(p, function* (ctx) {
      visto = yield ctx.explore({
        until: (v) => Math.abs(v.self.at.x) + Math.abs(v.self.at.y) >= 3,
        maxTicks: 400,
      })
      return { ok: true }
    })
    expect(r.out?.ok).toBe(true)
    expect(visto?.status).toBe('found')
    // Y encontró CAMINANDO: el mundo movió a la criatura en un rumbo que sale
    // del reloj, y el corte lo dio la vista nueva.
    expect(Math.abs(p.state.bodies.get('ella-cuerpo')!.at.x) + Math.abs(p.state.bodies.get('ella-cuerpo')!.at.y))
      .toBeGreaterThanOrEqual(3)
  })

  it('un `until` que NO se cumple da `timeout` en EXACTAMENTE `maxTicks`', () => {
    // «Exactamente» es el criterio, así que se cuentan las intenciones que
    // llegaron a la mesa del mundo y no los ticks de la corrida: el tick en que
    // la habilidad se reanuda con el `timeout` no es una exploración.
    const p = new Partida(conElla([]))
    const MAX = 7
    let visto: StepResult | undefined
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        visto = yield ctx.explore({ until: () => false, maxTicks: MAX })
        return { ok: true }
      } as never,
      undefined,
    )
    let exploraciones = 0
    for (let i = 0; i < 50 && !v.terminado; i++) {
      p.tick()
      if (v.enMesa?.k === 'explore') exploraciones++
    }
    expect(visto?.status).toBe('timeout')
    expect(exploraciones, 'el mundo tiene que haber recibido exactamente maxTicks').toBe(MAX)
  })

  it('el `until` ve la vista NUEVA, no la del tick en que se lo escribió', () => {
    // Es la mitad del criterio y la que se rompe sin ruido: con la vista vieja el
    // predicado siempre contesta lo mismo y `explore` termina siempre en
    // `timeout`, que es un verde falso — la habilidad «funciona», sólo que nunca
    // encuentra nada.
    const p = new Partida(conElla([]))
    const posiciones: number[] = []
    correr(p, function* (ctx) {
      yield ctx.explore({
        until: (v) => {
          posiciones.push(v.self.at.x)
          return posiciones.length >= 5
        },
        maxTicks: 50,
      })
      return { ok: true }
    })
    expect(posiciones.length).toBe(5)
    // Si la vista estuviera congelada, las cinco lecturas serían iguales.
    expect(new Set(posiciones).size, `las cinco lecturas fueron ${posiciones.join(',')}`).toBeGreaterThan(1)
  })

  it('dos `explore` distintos no se pisan la clausura', () => {
    // El `until` viaja por un NÚMERO pegado a la intención (`CAMPO_UNTIL`) y no
    // por una ranura del contexto, justamente porque `SkillRun` hace
    // `{...cedido, by, seq}` y la intención que llega al ejecutor no es el mismo
    // objeto que devolvió el constructor. Con una sola ranura, construir dos y
    // ceder el primero usaría la clausura del segundo.
    const p = new Partida(conElla([]))
    const cuales: string[] = []
    correr(p, function* (ctx) {
      const primero = ctx.explore({
        until: () => {
          cuales.push('primero')
          return true
        },
        maxTicks: 9,
      })
      ctx.explore({
        until: () => {
          cuales.push('segundo')
          return true
        },
        maxTicks: 9,
      })
      yield primero
      return { ok: true }
    })
    expect(cuales).toEqual(['primero'])
  })
})

// ─── LA TABLA DEL PUENTE ────────────────────────────────────────────────────

describe('la tabla del puente, caso por caso', () => {
  it('`goTo` que llega da `arrived`, y tarda los ticks de la distancia', () => {
    const p = new Partida(conElla([]))
    let visto: StepResult | undefined
    const r = correr(p, function* (ctx) {
      visto = yield ctx.goTo({ x: 6, y: 0 }, {})
      return { ok: true }
    })
    expect(visto?.status).toBe('arrived')
    expect(p.state.bodies.get('ella-cuerpo')!.at).toEqual({ x: 6, y: 0 })
    // Seis pasos de mundo más el tick en que la habilidad se reanuda y termina.
    expect(r.ticks).toBe(7)
  })

  it('`goTo` a donde ya estoy da `arrived` en un tick, sin caminar', () => {
    const p = new Partida(conElla([], { stamina: 500 }))
    const antes = p.state.bodies.get('ella-cuerpo')!.at
    let visto: StepResult | undefined
    correr(p, function* (ctx) {
      visto = yield ctx.goTo({ x: 0, y: 0 }, {})
      return { ok: true }
    })
    expect(visto?.status).toBe('arrived')
    expect(p.state.bodies.get('ella-cuerpo')!.at).toEqual(antes)
  })

  it('`goTo` fuera del mundo da `rejected` con `fuera-de-rango`, y `por` viaja tal cual', () => {
    // Ninguna clase de rechazo se re-etiqueta: las quince innatas ramifican sobre
    // `r.por` —`ir` distingue `sin-fuerza` de `celda-ocupada` para decidir si
    // insistir— y traducir un motivo a otra categoría les saca la información con
    // la que deciden.
    const p = new Partida(conElla([]))
    let visto: StepResult | undefined
    correr(p, function* (ctx) {
      visto = yield ctx.goTo({ x: 1 << 25, y: 0 }, {})
      return { ok: true }
    })
    expect(visto?.status).toBe('rejected')
    expect(visto?.por).toBe('fuera-de-rango')
  })

  it('`goTo` sin aliento da `rejected` con `sin-fuerza`', () => {
    // A 100 Hz, y el porqué ERA un hallazgo que sólo aparecía corriendo esto contra
    // el mundo de verdad: **a la frecuencia de referencia, `sin-fuerza` de un `goTo`
    // era INALCANZABLE**. `cobrarStamina` rechaza si queda menos de `COSTO_POR_CELDA`
    // (0,05), y `sistemaMetabolismo` cobra `COSTO_VIVIR_POR_SEGUNDO/hz`, que a 20 Hz
    // valía exactamente 0,05 también — así que toda criatura que pudiera ser
    // rechazada por falta de fuerza se moría de hambre en el mismo tick, y el
    // ejecutor le cortaba el vuelo antes de que recibiera la respuesta. A 100 Hz
    // vivir costaba 0,01 y las dos cosas se separaban.
    //
    // ESA COINCIDENCIA SE ROMPIÓ y conviene que quede escrito acá: con
    // `COSTO_VIVIR_POR_SEGUNDO` en 0,34 el tick de 20 Hz cuesta 0,017 y ya no empata
    // con `COSTO_POR_CELDA`, así que `sin-fuerza` es alcanzable también a la
    // frecuencia de referencia. Este test se deja a 100 Hz igual: lo que afirma es
    // el CAMINO del rechazo, no la frecuencia, y a 100 Hz el margen entre las dos
    // constantes es de 5× en vez de 3× —o sea que sigue siendo el caso más limpio—.
    // Lo que la ruptura sí movió es el test de acá abajo, que necesitaba el empate
    // para matarla; ver su nota.
    const p = new Partida(conElla([], { stamina: 0.03, hz: 100 }))
    let visto: StepResult | undefined
    correr(p, function* (ctx) {
      visto = yield ctx.goTo({ x: 9, y: 0 }, {})
      return { ok: true }
    })
    expect(visto?.status).toBe('rejected')
    expect(visto?.por).toBe('sin-fuerza')
  })

  it('y si la criatura se muere a mitad del viaje, el vuelo se corta', () => {
    // ADR II-0009: el actor se va de `actors` y el cuerpo queda tirado. Sin este
    // corte la habilidad seguiría emitiendo intenciones que `stepWorld` rechaza
    // con `actor-desconocido` hasta el fin de los tiempos, y la partida no
    // terminaría nunca — o sea que el criterio (b), que se mide sobre 2000 ticks
    // con habilidades en vuelo, mediría una habilidad zombi.
    //
    // ─── EL TANQUE ERA 0,04 Y CON ÉSE YA NO SE MUERE ──────────────────────
    //
    // Cuando vivir costaba 1,0 por segundo —o sea 0,05 por tick a 20 Hz, EXACTAMENTE
    // lo mismo que `COSTO_POR_CELDA`— cualquier criatura a la que le faltara para
    // dar un paso se moría en ese mismo tick, y 0,04 alcanzaba para que este caso
    // pasara. Con `COSTO_VIVIR_POR_SEGUNDO` en 0,34 el tick sale 0,017 y las dos
    // cosas se separaron: con 0,04 la criatura AHORA sobrevive, el `goTo` le vuelve
    // `rejected` con `sin-fuerza` y la habilidad termina `ok: true` — que es el caso
    // del test de arriba, no el de éste.
    //
    // Así que el arnés la hace morir de la única manera que sigue existiendo: con
    // tanque para dar unos pasos y no para llegar. Cada tick de viaje le cuesta
    // `COSTO_POR_CELDA + 0,017` = 0,067, así que 0,2 de tanque compran tres pasos de
    // los nueve y el tercero la deja en 0,016, por debajo de lo que el metabolismo
    // le cobra en el mismo tick. Se muere ANDANDO, que es lo que el título dice y lo
    // que el corte tiene que ver: no se debilitó el caso, se lo volvió a poner.
    const p = new Partida(conElla([], { stamina: 0.2 }))
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        yield ctx.goTo({ x: 9, y: 0 }, {})
        return { ok: true }
      } as never,
      undefined,
    )
    for (let i = 0; i < 20 && !v.terminado; i++) p.tick()
    expect(v.terminado).toBe(true)
    expect(v.outcome?.ok).toBe(false)
    expect(p.state.actors.has('ella')).toBe(false)
    expect(p.state.bodies.has('ella-cuerpo'), 'la materia no se destruye').toBe(true)
    // Y MURIÓ A MITAD DEL VIAJE Y NO EN LA LARGADA: salió de (0,0) y no llegó a
    // (9,0). Sin esto, un tanque demasiado chico haría pasar el test con una
    // criatura que se muere antes de dar un paso, que es otro caso.
    const donde = p.state.bodies.get('ella-cuerpo')!.at
    expect(donde.x).toBeGreaterThan(0)
    expect(donde.x).toBeLessThan(9)
  })

  it('`take` de lo que está al lado da `done`', () => {
    const p = new Partida(conElla([enElPiso('vara', 'madera', 0.4, 1, 0)]))
    let visto: StepResult | undefined
    correr(p, function* (ctx) {
      visto = yield ctx.take(ctx.see([{ q: 'rigidity', op: '>=', v: 0.5 }])[0]!)
      return { ok: true }
    })
    expect(visto?.status).toBe('done')
    expect(p.state.actors.get('ella')!.holding).toEqual(['vara'])
  })

  it('`take` de lo que no existe da `rejected` con `cuerpo-desconocido`', () => {
    const p = new Partida(conElla([]))
    let visto: StepResult | undefined
    correr(p, function* (ctx) {
      visto = yield ctx.take({ id: 'fantasma' } as never)
      return { ok: true }
    })
    expect(visto?.status).toBe('rejected')
    expect(visto?.por).toBe('cuerpo-desconocido')
  })

  it('`eat` de algo con calorías da `done` y sube la `stamina`', () => {
    const p = new Partida(conElla([enElPiso('bocado', 'medula', 1, 1, 0)], { stamina: 100 }))
    let visto: StepResult | undefined
    correr(p, function* (ctx) {
      visto = yield ctx.eat(ctx.see([{ q: 'nutrition', op: '>=', v: 1 }])[0]!)
      return { ok: true }
    })
    expect(visto?.status).toBe('done')
    expect(p.state.bodies.has('bocado')).toBe(false)
  })

  it('`wait` NO se reemite y cierra con `done` cuando la espera se cumple', () => {
    // El mundo lo pide así: «una habilidad puede emitir `wait(2)` UNA vez y
    // callarse — es el uso previsto». `avanzarEsperas` contesta todos los ticks
    // con el `seq` de la `Espera`, así que escuchar alcanza; reemitir gastaría el
    // turno del cuerpo por nada.
    const p = new Partida(conElla([]))
    let visto: StepResult | undefined
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        visto = yield ctx.wait(2)
        return { ok: true }
      } as never,
      undefined,
    )
    let emisiones = 0
    for (let i = 0; i < 120 && !v.terminado; i++) {
      p.tick()
      if (v.enMesa !== undefined) emisiones++
    }
    expect(visto?.status).toBe('done')
    expect(emisiones, 'se emitió una sola vez y después se escuchó').toBe(1)
    // Dos segundos a 20 Hz son cuarenta ticks; el mundo cierra en el que llega.
    expect(p.state.tick).toBeGreaterThanOrEqual(40)
    expect(p.state.tick).toBeLessThanOrEqual(43)
  })

  it('`apply` de un proceso CON `completion` se repite hasta completar y devuelve `got`', () => {
    // `union` completa a 1 segundo, o sea 20 ticks a 20 Hz. `unir` hace UN
    // `yield ctx.apply('union', …)` y lee `r.got[0]`: sin la repetición, esa
    // línea nunca ve nada.
    const p = new Partida(
      conElla([enElPiso('vara', 'madera', 0.4, 0, 0), enElPiso('atadura', 'liana', 0.2, 0, 0)], {
        holding: ['vara', 'atadura'],
      }),
    )
    let visto: StepResult | undefined
    correr(p, function* (ctx) {
      const vara = ctx.self.holding.find((b) => b.id === 'vara')!
      const atadura = ctx.self.holding.find((b) => b.id === 'atadura')!
      visto = yield ctx.apply('union', { binder: atadura, a: vara })
      return { ok: true }
    })
    expect(visto?.status, JSON.stringify(visto)).toBe('done')
    expect(visto!.got.length, 'el ensamble tiene que llegar en `got`').toBe(1)
    expect(p.state.bodies.has('vara')).toBe(false)
  })

  it('`apply` de un proceso SIN `completion` cierra en un tick', () => {
    // `friccion` no declara `completion`, así que `intencionAplicar` calcula
    // `completo = at !== undefined && …` y NUNCA completa. Repetirla sería un
    // bucle infinito; quien quiera seguir frotando la reemite él, que es
    // literalmente lo que hace `frotar`.
    const p = new Partida(
      conElla([enElPiso('a', 'madera-dura', 0.5, 0, 0), enElPiso('b', 'piedra', 0.5, 0, 0)], {
        holding: ['a', 'b'],
      }),
    )
    let visto: StepResult | undefined
    const v = p.volar(
      'ella',
      function* (ctx: Ctx): Hab {
        const a = ctx.self.holding.find((x) => x.id === 'a')!
        const b = ctx.self.holding.find((x) => x.id === 'b')!
        visto = yield ctx.apply('friccion', { a, b, actor: ctx.self })
        return { ok: true }
      } as never,
      undefined,
    )
    let emisiones = 0
    for (let i = 0; i < 20 && !v.terminado; i++) {
      p.tick()
      if (v.enMesa?.k === 'apply') emisiones++
    }
    expect(visto?.status, JSON.stringify(visto)).toBe('done')
    expect(emisiones).toBe(1)
  })

  it('`place` DEJA LA OBRA PUESTA, y ya no contesta `no-implementado`', () => {
    // Decía «`place` da `rejected` con `no-implementado`, que es lo que el mundo
    // contesta», y tomaba un `Blueprint` de dos campos. El tramo D del Gate 5→6
    // lo implementó y el tramo C·bis le cambió el sentido: `place` no construye
    // un plano, DESPLIEGA un cuerpo ya armado (ADR II-0022). Construir sigue
    // siendo `apply('union', …)` encadenado.
    const p = new Partida(conElla([enElPiso('obra', 'madera', 1, 0, 0)], { holding: ['obra'] }))
    let visto: StepResult | undefined
    correr(p, function* (ctx) {
      const obra = ctx.self.holding[0]!
      visto = yield ctx.place(obra, { x: 1, y: 0 })
      return { ok: true }
    })
    expect(visto?.status, JSON.stringify(visto)).not.toBe('rejected')
    expect(p.state.desplegados.get('obra')?.at).toEqual({ x: 1, y: 0 })
  })

  it('y lo que NO se tiene no se despliega: el rechazo sigue teniendo nombre', () => {
    // El control con el signo al revés. Sin él, un `place` que contestara que sí
    // a cualquier cosa pasaría el bloque de arriba igual.
    const p = new Partida(conElla([enElPiso('obra', 'madera', 1, 3, 3)]))
    let visto: StepResult | undefined
    correr(p, function* (ctx) {
      const obra = ctx.see([])[0]!
      visto = yield ctx.place(obra, { x: 1, y: 0 })
      return { ok: true }
    })
    expect(visto?.status).toBe('rejected')
    expect(visto?.por).toBe('no-lo-tiene')
  })
})

// ─── `can()`, el ensayo en seco ─────────────────────────────────────────────

describe('`can()` contesta lo mismo que `stepWorld`', () => {
  it('dice que no con `rol-no-cumple` cuando el atador es demasiado rígido', () => {
    const p = new Partida(
      conElla([enElPiso('vara', 'madera', 0.4, 0, 0), enElPiso('mal', 'piedra', 0.2, 0, 0)], {
        holding: ['vara', 'mal'],
      }),
    )
    let v: import('@anima/skills').Verdict | undefined
    correr(p, function* (ctx) {
      const vara = ctx.self.holding.find((b) => b.id === 'vara')!
      const mal = ctx.self.holding.find((b) => b.id === 'mal')!
      v = ctx.can('union', { binder: mal, a: vara })
      yield ctx.wait(0)
      return { ok: true }
    })
    expect(v?.ok).toBe(false)
    if (v?.ok === false) expect(v.por).toBe('rol-no-cumple')
  })

  it('dice que no con `arreglo-incorrecto` cuando las piezas están en el piso', () => {
    // `union` pide `arrangement: {k:'held'}` — no es proximidad, es tenencia. La
    // habilidad no lo sabe leyendo la superficie; lo sabe porque `can()` se lo
    // dice, que es exactamente para lo que existe.
    const p = new Partida(
      conElla([enElPiso('vara', 'madera', 0.4, 1, 0), enElPiso('atadura', 'liana', 0.2, 1, 0)]),
    )
    let v: import('@anima/skills').Verdict | undefined
    correr(p, function* (ctx) {
      const vara = ctx.see([{ q: 'rigidity', op: '>=', v: 0.5 }])[0]!
      const atadura = ctx.see([{ q: 'flexibility', op: '>=', v: 0.85 }])[0]!
      v = ctx.can('union', { binder: atadura, a: vara })
      yield ctx.wait(0)
      return { ok: true }
    })
    expect(v?.ok).toBe(false)
    if (v?.ok === false) expect(v.por).toBe('arreglo-incorrecto')
  })

  it('y el veredicto coincide con lo que el mundo hace de verdad', () => {
    // El espejo: si `can()` dijera que sí y `stepWorld` rechazara, el ensayo en
    // seco sería peor que no tenerlo — mandaría a la habilidad a chocar
    // creyéndose autorizada.
    const p = new Partida(
      conElla([enElPiso('vara', 'madera', 0.4, 0, 0), enElPiso('atadura', 'liana', 0.2, 0, 0)], {
        holding: ['vara', 'atadura'],
      }),
    )
    let dijo: boolean | undefined
    let paso: StepResult | undefined
    correr(p, function* (ctx) {
      const vara = ctx.self.holding.find((b) => b.id === 'vara')!
      const atadura = ctx.self.holding.find((b) => b.id === 'atadura')!
      dijo = ctx.can('union', { binder: atadura, a: vara }).ok
      paso = yield ctx.apply('union', { binder: atadura, a: vara })
      return { ok: true }
    })
    expect(dijo).toBe(true)
    expect(paso?.status).not.toBe('rejected')
  })
})
