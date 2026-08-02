// ─── EL CICLO ENTERO: un jugador dibuja, otro lo recibe ─────────────────────
//
// Todo lo demás se prueba por pedazos: la puerta sola, el surtidor con un
// depósito de mentira, el servidor con `fetch` a mano. Este archivo es el único
// que pone las dos puntas juntas y contesta la pregunta del usuario tal como la
// hizo: *«queda guardado en el backend y se usa en cualquier partida de
// cualquiera»*.
//
// Los dos «jugadores» son dos repositorios de sprites distintos —dos pestañas,
// dos máquinas, dos partidas— contra un solo depósito. El segundo **no tiene
// proveedor**, y ésa es la mitad del asunto: si igual ve el dibujo, es porque lo
// heredó del primero y no porque se lo pidió a ningún modelo.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type Physics } from '@anima/physics'
import {
  cargarDeposito,
  claveDePieza,
  depositoHttp,
  glifoDe,
  pintar,
  spritesEnMemoria,
  surtir,
  type Proveedor,
} from '@anima/dibujo'
import type { RenderDescriptor } from '@anima/world'

import { baulEnMemoria, crearServidor } from '../src/servidor.js'

const PHYS: Physics = buildSeedPhysics()
const VARA = claveDePieza('vara', 'madera', 24)

/**
 * Lo que devuelve el modelo de mentira: un dibujo que PASA la puerta.
 *
 * Era un aspa de celdas `3` y dejó de servir cuando la puerta se endureció: toda
 * su tinta es luz tocando el vacío, y la regla 3 manda el contorno en sombra. El
 * detalle está contado entero en `el-deposito.test.ts`.
 */
function bloque(lado: number): string {
  const filas: string[] = []
  for (let y = 0; y < lado; y++) {
    let f = ''
    for (let x = 0; x < lado; x++) {
      const borde = y === 0 || x === 0 || y === lado - 1 || x === lado - 1
      f += borde ? '2' : x === y ? '3' : '1'
    }
    filas.push(f)
  }
  return filas.join('\n')
}

const cuerpo: RenderDescriptor = {
  v: 2,
  at: { x: 0, y: 0 },
  forma: 'vara',
  materiales: ['madera'],
  nucleo: 'madera',
  partes: 1,
  juntas: 0,
  atadores: [],
  estado: 'sin-marca',
  porte: 'chico',
}

async function conServidor<T>(hacer: (base: string) => Promise<T>): Promise<T> {
  const s = crearServidor(baulEnMemoria())
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve))
  const dir = s.address()
  if (dir === null || typeof dir === 'string') throw new Error('el servidor no dio puerto')
  try {
    return await hacer(`http://127.0.0.1:${String(dir.port)}`)
  } finally {
    await new Promise<void>((resolve) => s.close(() => {
      resolve()
    }))
  }
}

describe('el ciclo entero', () => {
  it('EL JUGADOR 1 DIBUJA Y EL JUGADOR 2 LO HEREDA, sin llamar a ningún modelo', async () => {
    await conServidor(async (base) => {
      const deposito = depositoHttp(base)
      let vecesQueSePidio = 0
      const modelo: Proveedor = {
        dibujar: (_p, clave) => {
          vecesQueSePidio++
          return Promise.resolve(bloque(Number.parseInt(clave.split('/')[2] ?? '24', 10)))
        },
      }

      // ─── JUGADOR 1: abre el juego y le falta todo ──────────────────────
      const uno = spritesEnMemoria()
      const procedural = pintar(glifoDe(cuerpo, PHYS, 24, uno))
      expect(uno.loQueFalta(), 'el primer dibujo tiene que haber pedido la pieza').toEqual([VARA])

      const r1 = await surtir(uno, { phys: PHYS, proveedor: modelo, deposito })
      expect(r1.delModelo).toEqual([VARA])
      expect(vecesQueSePidio).toBe(1)

      // Y ahora ve algo distinto de lo procedural.
      const conSprite = pintar(glifoDe(cuerpo, PHYS, 24, uno))
      expect(JSON.stringify(conSprite)).not.toBe(JSON.stringify(procedural))

      // ─── JUGADOR 2: otra partida, otro repositorio, SIN proveedor ──────
      const dos = spritesEnMemoria()
      expect(await cargarDeposito(dos, deposito), 'no bajó nada del depósito').toBe(1)

      const heredado = pintar(glifoDe(cuerpo, PHYS, 24, dos))
      // Ve EXACTAMENTE lo mismo que el jugador 1.
      expect(JSON.stringify(heredado)).toBe(JSON.stringify(conSprite))
      // Y no le pidió nada a nadie: el modelo se llamó una sola vez en total.
      expect(vecesQueSePidio, 'el jugador 2 pagó un dibujo que ya existía').toBe(1)
      expect(dos.loQueFalta()).toEqual([])
    })
  })

  it('DOS JUGADORES QUE DIBUJAN LA MISMA PIEZA A LA VEZ terminan viendo lo mismo', async () => {
    // Es el caso que «primero gana» resuelve. Sin esa regla, cada uno se
    // quedaría con el suyo y la misma vara se vería distinta en cada pantalla.
    await conServidor(async (base) => {
      const deposito = depositoHttp(base)
      const marco = Array.from({ length: 24 }, (_, y) =>
        y === 0 || y === 23 ? '1'.repeat(24) : `1${'0'.repeat(22)}1`,
      ).join('\n')

      const uno = spritesEnMemoria()
      const dos = spritesEnMemoria()
      uno.pedir(VARA)
      dos.pedir(VARA)

      await surtir(uno, { phys: PHYS, proveedor: { dibujar: () => Promise.resolve(bloque(24)) }, deposito })
      await surtir(dos, { phys: PHYS, proveedor: { dibujar: () => Promise.resolve(marco) }, deposito })

      // El segundo recibió el del primero DESDE el depósito, sin dibujar.
      expect(dos.dameYa(VARA)?.filas).toEqual(uno.dameYa(VARA)?.filas)
    })
  })

  it('y con el depósito APAGADO el juego se dibuja igual', async () => {
    // La prueba de que todo esto es opcional: un puerto donde no hay nadie.
    const deposito = depositoHttp('http://127.0.0.1:1')
    const sprites = spritesEnMemoria()

    expect(await cargarDeposito(sprites, deposito)).toBe(0)
    const r = await surtir(sprites, { phys: PHYS, deposito })
    expect(r.delModelo).toEqual([])

    // Y el cuerpo se dibuja: procedural, completo, sin un solo hueco.
    const lienzo = pintar(glifoDe(cuerpo, PHYS, 24, sprites))
    const tinta = lienzo.reduce((n, f) => n + f.filter((c) => c !== '').length, 0)
    expect(tinta).toBeGreaterThan(0)
  })
})
