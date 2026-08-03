/**
 * EL LUGAR ENTRA AL LENGUAJE DE OBJETIVOS — la última pieza del C3.
 *
 * ─── LA MEDICIÓN QUE LO PIDIÓ, y viene de tres lados ────────────────────────
 *
 * «Dejá uno junto al fuego» —la segunda parte de la frase del criterio— salía
 * por `orientacion` y `objetivosDe` la descartaba con su porqué: *«soltar no
 * lleva a un estado del mundo que yo sepa nombrar»*. Y no era falta de una fila
 * en una tabla: **`Predicado` tenía tres formas y ninguna relaciona dos
 * cuerpos**. `distance<=1`, `at.x>=8` y `wet>=0.9` daban `undefined`.
 *
 * ─── LA FORMA, y por qué el radio no se escribe ─────────────────────────────
 *
 * `cerca(tag:fibroso,emitsPower>0)`: algo de esta clase, **fuera de la mano**,
 * pegado a algo que cumpla aquello. El radio es UNO y no es un parámetro:
 * «junto a» en castellano quiere decir al lado, y un radio escribible invita a
 * pedir «a tres celdas del fuego», que no es una frase que alguien diga y sí es
 * una que habría que planificar.
 *
 * ─── FUERA DE LA MANO, y ésa es la mitad que se olvida ──────────────────────
 *
 * Tenerlo en la mano al lado del fuego NO es dejarlo junto al fuego. Sin esa
 * exclusión, la meta se cumple sola con sólo caminar hasta la fogata, y el
 * cuidador ve que «ya está» sin que nada se haya soltado.
 */

import { describe, expect, it } from 'vitest'
import { firmaDe, implica, interpretar, textoDe } from '../src/predicado.js'

const JUNTO_AL_FUEGO = 'cerca(tag:fibroso,emitsPower>0)'

describe('la cercanía se lee, se escribe y vuelve igual', () => {
  it('se entiende, y dice las dos cosas que relaciona', () => {
    const p = interpretar(JUNTO_AL_FUEGO)
    expect(p?.k).toBe('cerca')
    if (p?.k !== 'cerca') throw new Error('imposible')
    expect(p.tag).toBe('fibroso')
    expect(textoDe(p.de)).toBe('emitsPower>0')
  })

  it('IDA Y VUELTA: lo que se lee se escribe igual', () => {
    expect(textoDe(interpretar(JUNTO_AL_FUEGO) as never)).toBe(JUNTO_AL_FUEGO)
    expect(firmaDe(JUNTO_AL_FUEGO)).toBe(JUNTO_AL_FUEGO)
  })

  it('el tag tiene que ser uno de la física, como en `sostiene`', () => {
    // Un tag inventado no es un predicado con un tag nuevo: es alguien
    // confundiendo la sustancia con la superficie por la que las leyes la agarran.
    expect(interpretar('cerca(tag:pescado,emitsPower>0)')).toBeUndefined()
  })

  it('y lo de adentro tiene que ser un predicado de cuerpo, no otra relación', () => {
    // Sin anidar: `cerca(cerca(...))` no quiere decir nada que alguien pida, y
    // el parser plano es lo que hace que la firma sea una llave comparable.
    expect(interpretar('cerca(tag:fibroso,cerca(tag:x,y>0))')).toBeUndefined()
    expect(interpretar('cerca(tag:fibroso)')).toBeUndefined()
    expect(interpretar('cerca(tag:fibroso,xyzzy>0)')).toBeUndefined()
  })
})

describe('EL PORTÓN: la cercanía no se confunde con tener', () => {
  it('TENER ALGO NO ES HABERLO DEJADO EN NINGÚN LADO', () => {
    // Es el portón que evita el falso cumplimiento: si `sostiene` implicara
    // `cerca`, el esquema que sabe agarrar contestaría un pedido de dejar, y la
    // criatura diría «dale, voy» sobre algo que no sabe hacer.
    const tener = interpretar('holding(tag:fibroso)') as never
    const dejar = interpretar(JUNTO_AL_FUEGO) as never
    expect(implica(tener, dejar)).toBe(false)
    expect(implica(dejar, tener)).toBe(false)
  })

  it('y dos cercanías se implican sólo si dicen lo mismo', () => {
    const a = interpretar(JUNTO_AL_FUEGO) as never
    const b = interpretar('cerca(tag:fibroso,emitsPower>0)') as never
    const otra = interpretar('cerca(tag:carnoso,emitsPower>0)') as never
    const otroDe = interpretar('cerca(tag:fibroso,temperature>=100)') as never
    expect(implica(a, b)).toBe(true)
    expect(implica(a, otra)).toBe(false)
    expect(implica(a, otroDe)).toBe(false)
  })

  it('sigue siendo reflexiva', () => {
    const p = interpretar(JUNTO_AL_FUEGO) as never
    expect(implica(p, p)).toBe(true)
  })
})
