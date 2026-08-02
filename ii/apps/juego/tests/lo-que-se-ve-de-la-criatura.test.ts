// ─── LO QUE SE VE DE LA CRIATURA, SIN NAVEGADOR ─────────────────────────────
//
// Los puntos 6 y 7 de la vertical del Hito 12B —«observar progreso y acciones» e
// «inspeccionar la criatura»— terminan en píxeles, y los píxeles se prueban con
// Playwright. Lo que se prueba acá es lo de antes: **las decisiones**, que son
// tres y ninguna se ve mirando la pantalla.
//
//   1. el máximo del aliento y el total del proceso NO vienen de la escena: se
//      leen del catálogo, y si alguien los copiara habría dos verdades;
//   2. un proceso sin `completion` no tiene barra, y eso no es un caso raro:
//      `friccion` es exactamente eso. Una barra ahí sería una mentira con un
//      porcentaje adentro;
//   3. la fracción va topada. Un proceso que se pasa de su duración —pasa, porque
//      el mundo acumula en segundos y el corte es al final del tick— pintaría una
//      barra fuera de su caja.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, type Physics } from '@anima/physics'
import { escenaDe } from '@anima/world'
import type { ActorEnEscena, Escena } from '@anima/world'
import { seg } from '@anima/physics'

import { loQueSeVeDe } from '../src/criatura.js'
import { PHYS as PHYS_DEL_JUEGO, arrancar } from '../src/mundo.js'

const PHYS: Physics = buildSeedPhysics()

/** Una escena de verdad, con la criatura del juego adentro. */
function escenaConCriatura(): { e: Escena; a: ActorEnEscena } {
  const { state, parada } = arrancar(20260727n)
  const e = escenaDe(state, parada, 7)
  const a = e.actores[0]
  if (a === undefined) throw new Error('el mundo del juego no trajo actor')
  return { e, a }
}

describe('lo que se ve de la criatura', () => {
  it('EL MÁXIMO DEL ALIENTO sale del catálogo, no de la escena', () => {
    const { e, a } = escenaConCriatura()
    const c = loQueSeVeDe(a, e, PHYS_DEL_JUEGO)

    // 1000 es el `range` que `stamina` declara en `quality.ts`. La escena publica
    // el valor y nada más: acá se ve por qué alcanza.
    expect(c.aliento.de).toBe(1000)
    expect(c.aliento.valor).toBe(a.aliento)
    expect(c.aliento.fraccion).toBeCloseTo(a.aliento / 1000, 10)

    // Y el aliento es entero, que es lo que decidió el banco del delta.
    expect(Number.isInteger(c.aliento.valor)).toBe(true)
  })

  it('FROTAR NO TIENE BARRA, y ésa es la decisión que este archivo protege', () => {
    const { e, a } = escenaConCriatura()
    const frotando: ActorEnEscena = {
      ...a,
      haciendo: { proceso: 'friccion', roles: [], segundos: seg(3.5) },
    }
    const c = loQueSeVeDe(frotando, e, PHYS)

    expect(c.haciendo?.que).toBe('frotar')
    expect(c.haciendo?.segundos).toBe(3.5)
    // `friccion` no declara `completion` —frotar no termina, termina la criatura—
    // así que no hay de cuánto. La pantalla muestra el tiempo y ninguna barra.
    expect(c.haciendo?.barra).toBeUndefined()
  })

  it('ATAR SÍ, y el total lo pone `completion.at` del catálogo', () => {
    const { e, a } = escenaConCriatura()
    const atando: ActorEnEscena = {
      ...a,
      haciendo: { proceso: 'union', roles: [], segundos: seg(0.25) },
    }
    const c = loQueSeVeDe(atando, e, PHYS)

    expect(c.haciendo?.que).toBe('atar')
    expect(c.haciendo?.barra?.de).toBe(1)
    expect(c.haciendo?.barra?.fraccion).toBe(0.25)
  })

  it('la fracción NO SE PASA DE 1, ni siquiera con un proceso vencido', () => {
    const { e, a } = escenaConCriatura()
    const c = loQueSeVeDe(
      { ...a, haciendo: { proceso: 'union', roles: [], segundos: seg(9) } },
      e,
      PHYS,
    )
    expect(c.haciendo?.barra?.fraccion).toBe(1)
    // Y el valor crudo sigue siendo el del mundo: lo topado es la barra, no el
    // dato. Si se topara el dato, el panel mentiría sobre cuánto lleva.
    expect(c.haciendo?.barra?.valor).toBe(9)
  })

  it('UN PROCESO QUE EL CATÁLOGO NO CONOCE no rompe la pantalla', () => {
    // Pasa de verdad: la fragua da de alta procesos en vivo. Una pantalla que
    // reventara acá se caería justo cuando la criatura hace algo nuevo.
    const { e, a } = escenaConCriatura()
    const c = loQueSeVeDe(
      { ...a, haciendo: { proceso: 'algo-que-nadie-escribio', roles: [], segundos: seg(1) } },
      e,
      PHYS,
    )
    expect(c.haciendo?.que).toBe('algo-que-nadie-escribio')
    expect(c.haciendo?.barra).toBeUndefined()
  })

  it('LA ESPERA se mide contra lo que se pidió', () => {
    const { e, a } = escenaConCriatura()
    const c = loQueSeVeDe({ ...a, esperando: { segundos: seg(1.5), pedido: seg(2) } }, e, PHYS)
    expect(c.esperando?.fraccion).toBe(0.75)
  })

  it('lo que lleva en las manos se nombra con lo que la escena publica', () => {
    const { e, a } = escenaConCriatura()
    // Se elige un cuerpo que la escena efectivamente traiga, que es la única
    // forma de que este test hable del mundo y no de un id inventado.
    const alguno = [...e.cuerpos.keys()][0]
    if (alguno === undefined) throw new Error('la escena del juego no trajo cuerpos')
    const d = e.cuerpos.get(alguno)?.d

    const c = loQueSeVeDe({ ...a, holding: [alguno] }, e, PHYS)
    expect(c.manos).toEqual([`${String(d?.forma)} de ${String(d?.nucleo)}`])

    // Y un id que la escena no trae se muestra como id, sin inventarle un nombre.
    expect(loQueSeVeDe({ ...a, holding: ['fantasma'] }, e, PHYS).manos).toEqual(['fantasma'])
  })

  it('con la criatura quieta no hay ni actividad ni espera', () => {
    const { e, a } = escenaConCriatura()
    const c = loQueSeVeDe(a, e, PHYS)
    expect(c.haciendo).toBeUndefined()
    expect(c.esperando).toBeUndefined()
  })

  it('el juego usa la MISMA física que este test, y conviene que se note', () => {
    // Si el juego armara su `Physics` con otra cosa, todos los números de arriba
    // valdrían para un mundo que nadie juega.
    expect(PHYS_DEL_JUEGO.qualities.find((q) => q.id === 'stamina')?.range[1]).toBe(
      PHYS.qualities.find((q) => q.id === 'stamina')?.range[1],
    )
  })
})
