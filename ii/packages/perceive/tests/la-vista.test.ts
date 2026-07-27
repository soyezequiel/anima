/**
 * LA VISTA CONGELADA — criterio (c) del tramo B, y los dos espejos.
 *
 * ─── LOS CRITERIOS, escritos ANTES de implementar ───────────────────────────
 *
 *   (c) una habilidad que muta `b.at.x` NO mueve el cuerpo, y el cuerpo sigue
 *       donde estaba en `WorldState`. Es el agujero 2 del ataque al sandbox.
 *
 * Y los dos que este archivo agregó porque sin ellos el criterio (c) no
 * significaría nada:
 *
 *   · la vista se REFRESCA EN SU LUGAR: el `ctx` que la habilidad tiene desde el
 *     tick 0 ve el mundo del tick N. Cinco de las quince innatas dependen de eso;
 *   · los dos ESPEJOS: `celda()` contra `shelteredDe` del mundo, y los dos
 *     caminos de `cuerposCerca` contra la definición a mano. Copiar una regla del
 *     mundo sin un espejo que la vigile es el bug de `DSL_REFERENCE`.
 */

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, nameOf, qualityOf } from '@anima/physics'
import type { WorldBody, WorldState } from '@anima/world'
import { keyOfCell, shelteredDe, stepWorld } from '@anima/world'
import type { Ctx, Intent, Outcome, StepResult } from '@anima/skills'

import { IndiceDelTick, Partida, Proyeccion, RADIO_DE_PERCEPCION } from '../src/index.js'
import { conElla, cuerpo, lcg, mundo } from './mundo.js'

type Hab = Generator<Intent, Outcome, StepResult>

const piedra = (id: string, x: number, y: number): WorldBody => ({
  body: cuerpo(id, 'piedra', 5),
  at: { x, y },
})

// ─── (c) EL AGUJERO 2, CERRADO ──────────────────────────────────────────────

describe('(c) mutar `at` no mueve el cuerpo', () => {
  it('asignar a `b.at.x` LANZA y el mundo no se movió', () => {
    // La reparación es `Object.freeze` sobre el propio `Placement` del mundo:
    // cero asignaciones, y en `"use strict"` —que es como corre el sandbox—
    // asignar a una propiedad congelada LANZA en vez de no hacer nada en
    // silencio. Las dos mitades importan: que el mundo no se mueva, y que la
    // habilidad se entere.
    const w = conElla([piedra('p', 3, 0)])
    const p = new Partida(w)
    const v = p.proyeccion.cuerpo('p', 'ella')
    expect(v).toBeDefined()
    const at = v!.at as unknown as { x: number; y: number }
    expect(() => {
      at.x = 999
    }).toThrow(TypeError)
    expect(p.state.bodies.get('p')?.at.x, 'el cuerpo se movió sin intención').toBe(3)
  })

  it('tampoco se mueve la criatura por `ctx.self.at.y`', () => {
    const p = new Partida(conElla([]))
    const a = p.state.actors.get('ella')!
    const self = p.proyeccion.self(a)!
    const at = self.at as unknown as { x: number; y: number }
    expect(() => {
      at.y = 777
    }).toThrow(TypeError)
    expect(p.state.bodies.get('ella-cuerpo')?.at.y).toBe(0)
  })

  it('y desde ADENTRO de una habilidad, que es donde vive el agujero', () => {
    const p = new Partida(conElla([piedra('p', 3, 0)]))
    let rebotó = false
    function* atacar(ctx: Ctx): Hab {
      const b = ctx.see([{ q: 'mass', op: '>=', v: 1 }])[0]
      try {
        ;(b!.at as unknown as { x: number }).x = 999
      } catch {
        rebotó = true
      }
      try {
        ;(ctx.self.at as unknown as { y: number }).y = 777
      } catch {
        rebotó = true
      }
      yield ctx.wait(0)
      return { ok: true }
    }
    const v = p.volar('ella', atacar, undefined)
    for (let i = 0; i < 10 && !v.terminado; i++) p.tick()
    expect(rebotó).toBe(true)
    expect(p.state.bodies.get('p')?.at.x, 'el cuerpo se movió sin intención').toBe(3)
    expect(p.state.bodies.get('ella-cuerpo')?.at.y, 'la criatura se movió sin intención').toBe(0)
  })

  it('sellar es IDEMPOTENTE: la misma celda no se vuelve a congelar', () => {
    // Es la mitad del argumento de rendimiento: `stepWorld` crea un `at` nuevo
    // sólo cuando el cuerpo se muda, así que los quietos se congelan una vez en
    // toda la partida. Si `sellar` congelara siempre, el costo sería por cuerpo
    // y por tick, que es justo lo que se quería evitar.
    const w = conElla([piedra('p', 3, 0)])
    const antes = w.bodies.get('p')!.at
    new Proyeccion(new IndiceDelTick(w)).cuerpo('p', 'ella')
    expect(Object.isFrozen(antes)).toBe(true)
    expect(new Proyeccion(new IndiceDelTick(w)).cuerpo('p', 'ella')!.at).toBe(antes)
  })

  it('congelar el `at` del mundo NO rompe una partida de 300 ticks con todo mirado', () => {
    // Lo único incómodo de la decisión es que se le cambia la extensibilidad a un
    // objeto del mundo. Que sea inocuo está verificado por lectura
    // (`grep "at\.x *=" world/src` da cero) y acá por corrida: se proyecta TODO
    // el mundo en cada tick —o sea que todo `Placement` queda congelado— y la
    // partida sigue caminando y chocando.
    let w: WorldState = conElla([piedra('p1', 2, 0), piedra('p2', -2, 3), piedra('p3', 5, 5)])
    const r = lcg(7)
    for (let t = 0; t < 300; t++) {
      const proy = new Proyeccion(new IndiceDelTick(w))
      for (const id of w.bodies.keys()) proy.cuerpo(id, 'ella')
      const to = { x: r.entero(9) - 4, y: r.entero(9) - 4 }
      w = stepWorld(w, [{ k: 'goTo', by: 'ella', seq: 0, commitment: 'reversible', to, within: 0 }]).state
    }
    expect(w.tick).toBe(300)
    expect(w.actors.has('ella')).toBe(true)
  })
})

// ─── EL REFRESCO EN SU LUGAR ────────────────────────────────────────────────

describe('la vista se refresca en su lugar', () => {
  it('el MISMO objeto `ctx` ve el mundo de cada tick', () => {
    // El hueco del Hito 4, medido: `ctx.self`, `ctx.tick` y `ctx.clock` son
    // PROPIEDADES y no métodos, y cinco de las quince innatas se rompen si la
    // vista queda congelada. Acá se guarda la referencia al `ctx` ANTES del
    // primer tick y se la lee al final.
    const p = new Partida(conElla([piedra('p', 10, 0)]))
    let guardado: Ctx | undefined
    const posiciones: number[] = []
    function* mirar(ctx: Ctx): Hab {
      guardado = ctx
      posiciones.push(ctx.self.at.x)
      const r = yield ctx.goTo({ x: 5, y: 0 }, {})
      posiciones.push(ctx.self.at.x)
      return r.status === 'arrived' ? { ok: true } : { ok: false, why: r.status }
    }
    const v = p.volar('ella', mirar, undefined)
    for (let i = 0; i < 30 && !v.terminado; i++) p.tick()
    expect(v.outcome?.ok, JSON.stringify(v.ultimo)).toBe(true)
    // Arrancó en 0 y terminó en 5. Con la vista congelada, las dos serían 0.
    expect(posiciones).toEqual([0, 5])
    expect(guardado!.self.at.x).toBe(5)
  })

  it('un spread del `ctx` congela la percepción, y por eso los getters son la reparación', () => {
    // El contrapositivo, medido para que no sea una advertencia: el test del
    // Hito 4 copiaba descriptores uno por uno justamente porque un spread evalúa
    // los getters UNA vez.
    const p = new Partida(conElla([]))
    let congelado: { self: { at: { x: number } } } | undefined
    function* copiar(ctx: Ctx): Hab {
      congelado = { ...ctx } as unknown as { self: { at: { x: number } } }
      yield ctx.goTo({ x: 4, y: 0 }, {})
      return { ok: true }
    }
    const v = p.volar('ella', copiar, undefined)
    for (let i = 0; i < 20 && !v.terminado; i++) p.tick()
    expect(p.state.bodies.get('ella-cuerpo')?.at.x).toBe(4)
    expect(congelado!.self.at.x, 'el spread evaluó el getter una sola vez').toBe(0)
  })

  it('`ctx.clock` también se refresca, y da el reloj del mundo', () => {
    const p = new Partida(conElla([]))
    const relojes: number[] = []
    function* dormir(ctx: Ctx): Hab {
      relojes.push(ctx.clock.secondsToNightfall)
      yield ctx.wait(2)
      relojes.push(ctx.clock.secondsToNightfall)
      return { ok: true }
    }
    const v = p.volar('ella', dormir, undefined)
    for (let i = 0; i < 80 && !v.terminado; i++) p.tick()
    expect(v.terminado).toBe(true)
    expect(relojes[0]).toBe(100)
    expect(relojes[1]!, 'anocheció dos segundos más cerca').toBeLessThan(relojes[0]!)
  })

  it('`ctx.tick` cuenta PASOS de la habilidad, no ticks del mundo', () => {
    // La superficie lo dice: «el contador de PASOS: cuántas veces llamaron a esta
    // habilidad. No es tiempo». Un `goTo` de seis celdas son seis ticks de mundo
    // y UN paso de habilidad, y confundirlos es la mitad del hueco de unidades.
    const p = new Partida(conElla([]))
    const vistos: number[] = []
    function* contar(ctx: Ctx): Hab {
      vistos.push(ctx.tick)
      yield ctx.goTo({ x: 6, y: 0 }, {})
      vistos.push(ctx.tick)
      return { ok: true }
    }
    const v = p.volar('ella', contar, undefined)
    for (let i = 0; i < 30 && !v.terminado; i++) p.tick()
    expect(vistos).toEqual([1, 2])
    expect(p.state.tick, 'el mundo sí avanzó los seis ticks del viaje').toBeGreaterThanOrEqual(6)
  })
})

// ─── LOS DOS ESPEJOS ────────────────────────────────────────────────────────

describe('los espejos de lo que se copió del mundo', () => {
  it('`celda().sheltered` da lo MISMO que `shelteredDe`, celda por celda', () => {
    // `oclusiones` y `celdaDe` no se exportan y hubo que copiarlas. La copia se
    // sostiene con esto y no con un comentario: si el mundo cambia la ley 12,
    // este test se pone rojo.
    const phys = buildSeedPhysics()
    const r = lcg(31)
    let tapadas = 0
    for (let caso = 0; caso < 40; caso++) {
      const cuerpos: WorldBody[] = []
      for (let n = 0; n < 8; n++) {
        const at = { x: r.entero(5) - 2, y: r.entero(5) - 2 }
        const tapa: WorldBody = {
          body: cuerpo(`t${n}`, r.entero(2) === 0 ? 'hoja' : 'arcilla', 1),
          at,
        }
        cuerpos.push(n % 2 === 0 ? { ...tapa, covering: `b${n}` } : tapa)
        cuerpos.push({ body: cuerpo(`b${n}`, 'madera', 1), at })
      }
      const w = mundo({ bodies: cuerpos, phys })
      const proy = new Proyeccion(new IndiceDelTick(w))
      for (let x = -3; x <= 3; x++) {
        for (let y = -3; y <= 3; y++) {
          const mio = proy.indice.celda({ x, y }).sheltered
          const suyo = shelteredDe(w, keyOfCell({ x, y }))
          if (suyo > 0) tapadas++
          expect(mio, `caso ${caso} celda ${x},${y}`).toBeCloseTo(suyo, 12)
        }
      }
    }
    // Un espejo que sólo compara ceros no compara nada.
    expect(tapadas, 'el barrido no produjo ni una celda tapada').toBeGreaterThan(50)
  })

  it('los dos caminos de `cuerposCerca` devuelven exactamente la misma lista', () => {
    // El índice elige el camino barato comparando `(2r+1)²` contra `bodies.size`.
    // Que los dos den lo mismo no es obvio —uno recorre celdas y el otro
    // cuerpos— y si difirieran, `see()` dependería de cuántos cuerpos haya en el
    // mundo: la peor clase de no-determinismo, la que sólo aparece a escala.
    const r = lcg(99)
    for (let caso = 0; caso < 30; caso++) {
      const cuerpos: WorldBody[] = []
      const n = 3 + r.entero(40)
      for (let i = 0; i < n; i++) {
        cuerpos.push(piedra(`p${String(i).padStart(3, '0')}`, r.entero(21) - 10, r.entero(21) - 10))
      }
      const w = mundo({ bodies: cuerpos })
      const idx = new IndiceDelTick(w)
      const centro = { x: r.entero(11) - 5, y: r.entero(11) - 5 }
      for (const radio of [0, 1, 3, 6]) {
        const porIndice = [...idx.cuerposCerca(centro, radio)].sort()
        const aMano = [...w.bodies.values()]
          .filter((c) => Math.max(Math.abs(c.at.x - centro.x), Math.abs(c.at.y - centro.y)) <= radio)
          .map((c) => c.body.id)
          .sort()
        expect(porIndice, `caso ${caso} radio ${radio}`).toEqual(aMano)
      }
    }
  })
})

// ─── EL RADIO Y LAS LECTURAS ────────────────────────────────────────────────

describe('el radio de percepción y las lecturas', () => {
  it('lo que está más lejos que el radio NO se ve', () => {
    const p = new Partida(
      conElla([piedra('cerca', 3, 0), piedra('lejos', RADIO_DE_PERCEPCION + 5, 0)]),
    )
    const ids = p.proyeccion.aLaVista({ x: 0, y: 0 }, 'ella').map((b) => b.id)
    expect(ids).toContain('cerca')
    expect(ids).not.toContain('lejos')
  })

  it('el radio cubre los barridos de las quince: 12 ≥ el disco de 6 de `explorar`', () => {
    // El número no se eligió mirando el rendimiento: se eligió mirando qué barren
    // las innatas —`explorar` un disco de 6, `guarecerse` un anillo de 4— y se le
    // puso el doble del más ancho.
    expect(RADIO_DE_PERCEPCION).toBeGreaterThanOrEqual(12)
  })

  it('`name` es `nameOf` de la física y no un `kind` guardado', () => {
    const p = new Partida(conElla([piedra('p', 2, 0)]))
    const c = p.state.bodies.get('p')!
    expect(p.proyeccion.cuerpo('p', 'ella')!.name).toBe(nameOf(c.body, p.state.phys))
  })

  it('`self.stamina` es literalmente `qualityOf(cuerpo, "stamina")`', () => {
    // La superficie declara `stamina` como «atajo de `ctx.q(ctx.self,'stamina')`».
    // Que sean la MISMA lectura es lo que impide que un día digan cosas distintas.
    const p = new Partida(conElla([], { stamina: 137 }))
    const a = p.state.actors.get('ella')!
    const self = p.proyeccion.self(a)!
    expect(self.stamina).toBe(qualityOf(p.state.bodies.get('ella-cuerpo')!.body, 'stamina', p.state.phys))
    expect(self.stamina).toBe(137)
  })

  it('`madeByMe` es autoría y no propiedad (ADR II-0003)', () => {
    const hecho: WorldBody = { body: { ...cuerpo('h', 'liana', 0.2), madeBy: 'ella' }, at: { x: 1, y: 0 } }
    const p = new Partida(conElla([hecho, piedra('p', 1, 1)]))
    expect(p.proyeccion.cuerpo('h', 'ella')!.madeByMe).toBe(true)
    expect(p.proyeccion.cuerpo('h', 'otra')!.madeByMe).toBe(false)
    expect(p.proyeccion.cuerpo('p', 'ella')!.madeByMe).toBe(false)
  })

  it('`coveredBy` existe y es el DUAL de `covering`, que es el lado que la habilidad usa', () => {
    const fogata: WorldBody = { body: cuerpo('fogata', 'madera', 2), at: { x: 1, y: 0 } }
    const losa: WorldBody = {
      body: cuerpo('losa', 'arcilla', 3),
      at: { x: 1, y: 0 },
      covering: 'fogata',
    }
    const p = new Partida(conElla([fogata, losa]))
    expect(p.proyeccion.cuerpo('losa', 'ella')!.covering?.id).toBe('fogata')
    expect(p.proyeccion.cuerpo('fogata', 'ella')!.coveredBy?.id, 'el mundo sólo guarda la ida').toBe(
      'losa',
    )
  })

  it('una cadena de apoyo CÍCLICA no cuelga la proyección', () => {
    // El arnés del Hito 2 encontró el ciclo de verdad —A pisa a B y B pisa a A—
    // en el tick 811 de una partida al azar. Una proyección recursiva sin cota se
    // cuelga con ese mismo dato.
    const a: WorldBody = { body: cuerpo('a', 'piedra', 1), at: { x: 1, y: 0 }, supportedBy: 'b' }
    const b: WorldBody = { body: cuerpo('b', 'piedra', 1), at: { x: 1, y: 0 }, supportedBy: 'a' }
    const p = new Partida(conElla([a, b]))
    const v = p.proyeccion.cuerpo('a', 'ella')
    expect(v?.supportedBy?.id).toBe('b')
    expect(v?.supportedBy?.supportedBy?.id).toBe('a')
  })
})
