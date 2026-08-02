// ─── LA QUINTA PUERTA, EN ÁNIMA II ──────────────────────────────────────────
//
// Lo que el usuario pidió, en sus términos: que el modelo dibuje los sprites,
// que el mundo **no espere** a que estén, que se muestre lo procedural mientras
// tanto, que el sprite reemplace al procedural cuando llegue, y que quede
// guardado para la partida de cualquiera.
//
// Este archivo afirma las cinco cosas, y una sexta que no se pidió y que es la
// que hace que todo lo anterior sea seguro: **un sprite no puede mover ningún
// hash**. Sin eso, dos jugadores —uno con el dibujo del modelo y otro sin él—
// dejarían de poder comparar sus partidas, y el E2E de tres hashes del gate se
// vuelve mentira.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type FormId, type Physics } from '@anima/physics'
import { renderDescriptorHash, type RenderDescriptor } from '@anima/world'

import { celdasDistintas, glifoDe, pintar } from '../src/componer.js'
import { dibujoValido } from './un-dibujo-valido.js'
import { claveDePieza, revisarSprite, spritesEnMemoria } from '../src/sprite.js'

const PHYS: Physics = buildSeedPhysics()
const GRILLA = 24

function obra(forma: FormId, n = 1, sustancia = 'madera'): RenderDescriptor {
  return {
    v: 2,
    at: { x: 0, y: 0 },
    forma,
    materiales: [sustancia],
    nucleo: sustancia,
    partes: n,
    juntas: 0,
    atadores: [],
    estado: 'sin-marca',
    porte: 'chico',
  }
}


// ─── (a) La puerta ──────────────────────────────────────────────────────────

describe('(a) la puerta: lo que propone un modelo es dato externo', () => {
  const clave = claveDePieza('vara', 'madera', 24)

  it('un dibujo bien formado entra', () => {
    const v = revisarSprite({ filas: dibujoValido(24) }, clave, 24)
    expect(v.ok).toBe(true)
  })

  it('la medida exacta: 23 filas no son 24', () => {
    const v = revisarSprite({ filas: dibujoValido(24).slice(1) }, clave, 24)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.porque).toContain('23')
  })

  it('el ALFABETO CERRADO es lo que hace que la coherencia no se pueda romper', () => {
    // Un `9` no es un índice de paleta. Y el motivo por el que esto alcanza está
    // en el encabezado de `sprite.ts`: como el dibujo llega como índices y no
    // como colores, el peor sprite posible sigue siendo del color de su
    // material. Un modelo no puede pintar una piedra de rosa aunque quiera.
    const malo = dibujoValido(24).map((f, i) => (i === 3 ? '9'.repeat(24) : f))
    const v = revisarSprite({ filas: malo }, clave, 24)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.porque).toContain('índice de paleta')
  })

  it('y una MOTA no es un dibujo: menos de doce celdas encendidas no entra', () => {
    const casiVacio = Array.from({ length: 24 }, (_, y) => (y === 0 ? '1'.repeat(5) + '0'.repeat(19) : '0'.repeat(24)))
    const v = revisarSprite({ filas: casiVacio }, clave, 24)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.porque).toContain('mota')
  })

  it('EL CONTROL: la puerta rechaza basura sin explotar', () => {
    for (const basura of [null, 42, 'hola', {}, { filas: 'no es un array' }, { filas: [1, 2, 3] }]) {
      expect(revisarSprite(basura, clave, 24).ok, JSON.stringify(basura)).toBe(false)
    }
  })
})

// ─── (b) No esperar ─────────────────────────────────────────────────────────

describe('(b) el mundo NO espera al modelo', () => {
  it('sin ningún sprite, se dibuja igual y se ENCOLA lo que falta', () => {
    const sprites = spritesEnMemoria()
    const conRepo = pintar(glifoDe(obra('vara'), PHYS, GRILLA, sprites))
    const sinRepo = pintar(glifoDe(obra('vara'), PHYS, GRILLA))

    // Se dibuja lo mismo que si el sistema de sprites no existiera.
    expect(celdasDistintas(conRepo, sinRepo)).toBe(0)
    // Y quedó anotado qué le falta al mundo para verse mejor.
    expect(sprites.loQueFalta()).toEqual([claveDePieza('vara', 'madera', 24)])
  })

  it('pedir dos veces lo mismo es pedir una vez', () => {
    const sprites = spritesEnMemoria()
    glifoDe(obra('vara'), PHYS, GRILLA, sprites)
    glifoDe(obra('vara'), PHYS, GRILLA, sprites)
    expect(sprites.loQueFalta().length).toBe(1)
  })

  it('y `dameYa` es SÍNCRONO: no hay promesa que esperar en el camino del dibujo', () => {
    // Es una afirmación de tipo tanto como de valor: si `dameYa` devolviera una
    // promesa, dibujar un cuadro esperaría a la red y el mapa se cortaría.
    const sprites = spritesEnMemoria()
    const r: unknown = sprites.dameYa('lo-que-sea')
    expect(r).toBeUndefined()
    expect(r instanceof Promise).toBe(false)
  })
})

// ─── (c) El reemplazo ───────────────────────────────────────────────────────

describe('(c) cuando el sprite llega, reemplaza a lo procedural', () => {
  it('el mismo cuerpo se dibuja distinto antes y después', () => {
    const sprites = spritesEnMemoria()
    const antes = pintar(glifoDe(obra('vara'), PHYS, GRILLA, sprites))

    const v = sprites.guardar(claveDePieza('vara', 'madera', 24), 24, { filas: dibujoValido(24) })
    expect(v.ok).toBe(true)

    const despues = pintar(glifoDe(obra('vara'), PHYS, GRILLA, sprites))
    expect(celdasDistintas(antes, despues)).toBeGreaterThan(0)
    // Y deja de estar en la lista de lo que falta.
    expect(sprites.loQueFalta()).toEqual([])
  })

  it('EL COLOR SIGUE SIENDO EL DE LA SUSTANCIA, aunque el dibujo lo haya hecho el modelo', () => {
    // Es la consecuencia del alfabeto de índices, y es lo que hace que un sprite
    // feo sea un problema estético y nunca uno de coherencia.
    const sprites = spritesEnMemoria()
    sprites.guardar(claveDePieza('vara', 'madera', 24), 24, { filas: dibujoValido(24) })
    const conSprite = pintar(glifoDe(obra('vara'), PHYS, GRILLA, sprites))
    const colores = new Set<string>()
    for (const fila of conSprite) for (const c of fila) if (c !== '') colores.add(c)
    // Los tres tonos de la MADERA y ninguno más. El dibujo lo hizo otro; el
    // color lo sigue poniendo la sustancia, que es toda la invariante.
    expect(colores).toEqual(new Set(['#9a6135', '#55321a', '#c9924f']))
  })

  it('y un sprite de OTRA MEDIDA no se usa: reducir rompe la esbeltez', () => {
    // Está medido en `forma.ts`. Un objeto de seis piezas dibuja a lado 8, así
    // que el sprite de 24 no le sirve y se pide el de 8.
    const sprites = spritesEnMemoria()
    sprites.guardar(claveDePieza('vara', 'madera', 24), 24, { filas: dibujoValido(24) })
    const seisPiezas = pintar(glifoDe(obra('vara', 6), PHYS, GRILLA, sprites))
    const sinNada = pintar(glifoDe(obra('vara', 6), PHYS, GRILLA))
    expect(celdasDistintas(seisPiezas, sinNada)).toBe(0)
    expect(sprites.loQueFalta()).toEqual([claveDePieza('vara', 'madera', 8)])
  })
})

// ─── (d) Sirve en la partida de cualquiera ──────────────────────────────────

describe('(d) el sprite es del catálogo, no de la partida', () => {
  it('LA CLAVE NO LLEVA ESTADO: el mismo leño ardiendo y frío piden el mismo dibujo', () => {
    // Es lo que hace que un caché compartido sirva. Si el estado entrara en la
    // clave, cada grado de temperatura sería un sprite nuevo y el modelo
    // dibujaría el mismo leño cien veces.
    const frio = spritesEnMemoria()
    const ardiendo = spritesEnMemoria()
    glifoDe({ ...obra('vara'), estado: 'sin-marca' }, PHYS, GRILLA, frio)
    glifoDe({ ...obra('vara'), estado: 'ardiendo', porte: 'grande' }, PHYS, GRILLA, ardiendo)
    expect(frio.loQueFalta()).toEqual(ardiendo.loQueFalta())
  })

  it('y tampoco lleva la POSICIÓN: la misma vara en dos lugares es un solo dibujo', () => {
    const a = spritesEnMemoria()
    const b = spritesEnMemoria()
    glifoDe({ ...obra('vara'), at: { x: 0, y: 0 } }, PHYS, GRILLA, a)
    glifoDe({ ...obra('vara'), at: { x: 99, y: -7 } }, PHYS, GRILLA, b)
    expect(a.loQueFalta()).toEqual(b.loQueFalta())
  })

  it('un sprite guardado en una partida sirve en otra: es el mismo repositorio', () => {
    const compartido = spritesEnMemoria()
    compartido.guardar(claveDePieza('vara', 'madera', 24), 24, { filas: dibujoValido(24) })
    // «Otra partida» es otro descriptor, con otro estado y otro lugar.
    const otraPartida = { ...obra('vara'), at: { x: 42, y: 13 }, estado: 'mojado' as const }
    const conSprite = pintar(glifoDe(otraPartida, PHYS, GRILLA, compartido))
    const sinNada = pintar(glifoDe(otraPartida, PHYS, GRILLA))
    expect(celdasDistintas(conSprite, sinNada)).toBeGreaterThan(0)
  })
})

// ─── (e) Lo que no puede pasar nunca ────────────────────────────────────────

describe('(e) UN SPRITE NO MUEVE NINGÚN HASH', () => {
  it('`renderDescriptorHash` no se entera de que existen los sprites', () => {
    // Es la regla del ADR II-0017 y es lo que permite que esto sea opcional de
    // verdad: dos jugadores, uno con los dibujos del modelo y otro sin ellos,
    // tienen que poder comparar sus partidas. El hash es del ESTADO; el sprite
    // es de la pantalla.
    const mundo = {
      tick: 0,
      bodies: new Map(),
      desplegados: new Map(),
      phys: PHYS,
    } as unknown as Parameters<typeof renderDescriptorHash>[0]
    const antes = renderDescriptorHash(mundo)

    const sprites = spritesEnMemoria()
    sprites.guardar(claveDePieza('vara', 'madera', 24), 24, { filas: dibujoValido(24) })
    glifoDe(obra('vara'), PHYS, GRILLA, sprites)

    expect(renderDescriptorHash(mundo)).toBe(antes)
  })

  it('y el descriptor no tiene ninguna clave que hable de dibujos', () => {
    const claves = new Set(Object.keys(obra('vara')))
    for (const prohibida of ['sprite', 'glifo', 'dibujo', 'skin', 'imagen', 'arte']) {
      expect(claves.has(prohibida), `apareció «${prohibida}»`).toBe(false)
    }
  })

  it('EL CONTROL: los dos dibujos SÍ son distintos, o el test de arriba no prueba nada', () => {
    // Si el sprite no cambiara el dibujo, «el hash no se movió» sería trivial.
    const sprites = spritesEnMemoria()
    const antes = pintar(glifoDe(obra('vara'), PHYS, GRILLA, sprites))
    sprites.guardar(claveDePieza('vara', 'madera', 24), 24, { filas: dibujoValido(24) })
    expect(celdasDistintas(antes, pintar(glifoDe(obra('vara'), PHYS, GRILLA, sprites)))).toBeGreaterThan(0)
  })
})

// ─── (f) El techo del catálogo ──────────────────────────────────────────────

describe('(f) cuántos dibujos puede llegar a haber', () => {
  it('el techo es chico, y por eso un caché compartido sirve', () => {
    // 6 formas × 30 sustancias × 3 medidas. Es el argumento entero a favor de
    // cachear por PIEZA y no por objeto: por objeto sería combinatorio.
    const formas = 6
    const sustancias = PHYS.substances.size
    const medidas = 3
    const techo = formas * sustancias * medidas
    console.log(`\n  techo del catálogo de sprites: ${String(techo)} claves`)
    expect(techo).toBeLessThan(1000)
  })

  it('y una partida real toca unas pocas', () => {
    const sprites = spritesEnMemoria()
    for (const forma of ['vara', 'hebra', 'bloque'] as const) {
      for (const s of ['madera', 'liana', 'piedra', 'hoja-seca']) {
        for (const n of [1, 3, 6]) glifoDe(obra(forma, n, s), PHYS, GRILLA, sprites)
      }
    }
    console.log(`  una escena de doce cuerpos pide: ${String(sprites.loQueFalta().length)} dibujos\n`)
    expect(sprites.loQueFalta().length).toBeLessThan(40)
  })
})
