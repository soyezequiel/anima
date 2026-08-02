// ─── EL SURTIDOR, SIN RED ───────────────────────────────────────────────────
//
// Acá se prueba la orquestación con un proveedor y un depósito de mentira. El
// ciclo entero contra un servidor de verdad está en `ii/apps/sprites`, que es
// donde viven las dos puntas.
//
// Lo que este archivo persigue son los modos de falla, que en un orquestador son
// casi todo el trabajo: qué pasa si el depósito está caído, si el modelo tira,
// si contesta cualquier cosa, y —el más importante— **que nada de eso apague el
// juego**.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type Physics } from '@anima/physics'

import { dibujoValido } from './un-dibujo-valido.js'
import { claveDePieza, spritesEnMemoria, type Sprite } from '../src/sprite.js'
import { cargarDeposito, surtir, type DepositoRemoto, type Proveedor } from '../src/surtidor.js'

const PHYS: Physics = buildSeedPhysics()
const VARA = claveDePieza('vara', 'madera', 24)
const PIEDRA = claveDePieza('bloque', 'piedra', 24)


function spriteDe(clave: string, lado = 24): Sprite {
  return { clave, lado, filas: dibujoValido(lado) }
}

/** Un modelo que siempre dibuja bien, y que cuenta cuántas veces lo llamaron. */
function proveedorBueno(): Proveedor & { veces: () => number } {
  let n = 0
  return {
    veces: () => n,
    dibujar: (_prompt, clave) => {
      n++
      const lado = Number.parseInt(clave.split('/')[2] ?? '24', 10)
      return Promise.resolve(dibujoValido(lado).join('\n'))
    },
  }
}

function depositoFalso(tiene: readonly Sprite[] = []): DepositoRemoto & { subidos: () => readonly Sprite[] } {
  const m = new Map(tiene.map((s) => [s.clave, s]))
  const subidos: Sprite[] = []
  return {
    subidos: () => subidos,
    bajarTodo: () => Promise.resolve([...m.values()]),
    bajarUno: (clave) => Promise.resolve(m.get(clave)),
    subir: (s) => {
      subidos.push(s)
      m.set(s.clave, s)
      return Promise.resolve()
    },
  }
}

const caido: DepositoRemoto = {
  bajarTodo: () => Promise.reject(new Error('sin red')),
  bajarUno: () => Promise.reject(new Error('sin red')),
  subir: () => Promise.reject(new Error('sin red')),
}

describe('(a) el depósito primero, el modelo después', () => {
  it('LO QUE OTRO YA DIBUJÓ NO SE VUELVE A PEDIR: ése es el punto de compartir', async () => {
    const sprites = spritesEnMemoria()
    sprites.pedir(VARA)
    const modelo = proveedorBueno()

    const r = await surtir(sprites, { phys: PHYS, proveedor: modelo, deposito: depositoFalso([spriteDe(VARA)]) })

    expect(r.delDeposito).toEqual([VARA])
    expect(r.delModelo).toEqual([])
    expect(modelo.veces(), 'se le pidió al modelo algo que ya estaba').toBe(0)
    expect(sprites.dameYa(VARA)).toBeDefined()
  })

  it('y lo que nadie dibujó lo dibuja el modelo, y se sube para el que venga', async () => {
    const sprites = spritesEnMemoria()
    sprites.pedir(VARA)
    const deposito = depositoFalso()

    const r = await surtir(sprites, { phys: PHYS, proveedor: proveedorBueno(), deposito })

    expect(r.delModelo).toEqual([VARA])
    expect(deposito.subidos().map((s) => s.clave)).toEqual([VARA])
  })
})

describe('(b) de a poco', () => {
  it('el tope de la vuelta se respeta, y lo que sobra queda para la próxima', async () => {
    const sprites = spritesEnMemoria()
    for (const s of ['madera', 'piedra', 'liana', 'junco', 'hueso']) {
      sprites.pedir(claveDePieza('vara', s, 24))
    }
    const modelo = proveedorBueno()

    const r = await surtir(sprites, { phys: PHYS, proveedor: modelo, tope: 2 })

    expect(modelo.veces()).toBe(2)
    expect(r.delModelo.length).toBe(2)
    expect(r.enEspera).toBe(3)
    // Y la vuelta siguiente sigue por donde iba.
    const r2 = await surtir(sprites, { phys: PHYS, proveedor: modelo, tope: 2 })
    expect(r2.delModelo.length).toBe(2)
    expect(modelo.veces()).toBe(4)
  })
})

describe('(c) lo que falla no rompe nada', () => {
  it('CON EL DEPÓSITO CAÍDO se le pide al modelo igual', async () => {
    const sprites = spritesEnMemoria()
    sprites.pedir(VARA)
    const r = await surtir(sprites, { phys: PHYS, proveedor: proveedorBueno(), deposito: caido })
    expect(r.delModelo).toEqual([VARA])
    expect(sprites.dameYa(VARA)).toBeDefined()
  })

  it('SIN MODELO no pasa nada: el juego se ve procedural y sigue', async () => {
    const sprites = spritesEnMemoria()
    sprites.pedir(VARA)
    const r = await surtir(sprites, { phys: PHYS })
    expect(r.delModelo).toEqual([])
    expect(sprites.dameYa(VARA)).toBeUndefined()
    // Y la clave sigue pedida: cuando haya modelo, se resuelve sola.
    expect(sprites.loQueFalta()).toEqual([VARA])
  })

  it('un modelo que TIRA queda anotado y la clave se reintenta', async () => {
    const sprites = spritesEnMemoria()
    sprites.pedir(VARA)
    const explota: Proveedor = { dibujar: () => Promise.reject(new Error('se cayó el proveedor')) }

    const r = await surtir(sprites, { phys: PHYS, proveedor: explota })

    expect(r.rechazados).toEqual([{ clave: VARA, porque: 'se cayó el proveedor' }])
    expect(sprites.loQueFalta()).toEqual([VARA])
  })

  it('y un modelo que CONTESTA CUALQUIER COSA tampoco ensucia el repositorio', async () => {
    const sprites = spritesEnMemoria()
    sprites.pedir(VARA)
    const chamuyo: Proveedor = { dibujar: () => Promise.resolve('no sé dibujar eso, perdón') }

    const r = await surtir(sprites, { phys: PHYS, proveedor: chamuyo })

    expect(r.rechazados.length).toBe(1)
    expect(sprites.dameYa(VARA)).toBeUndefined()
  })

  it('EL CONTROL: con todo bien, no hay rechazados', async () => {
    // Sin esto, un `rechazados` que se llenara siempre pasaría los tres de
    // arriba sin que el camino feliz funcione.
    const sprites = spritesEnMemoria()
    sprites.pedir(VARA)
    const r = await surtir(sprites, { phys: PHYS, proveedor: proveedorBueno() })
    expect(r.rechazados).toEqual([])
  })
})

describe('(d) cargar el catálogo al abrir', () => {
  it('el jugador número dos ve los dibujos del número uno SIN pedirle nada a un modelo', async () => {
    const sprites = spritesEnMemoria()
    const cuantos = await cargarDeposito(sprites, depositoFalso([spriteDe(VARA), spriteDe(PIEDRA)]))
    expect(cuantos).toBe(2)
    expect(sprites.dameYa(VARA)).toBeDefined()
    expect(sprites.dameYa(PIEDRA)).toBeDefined()
  })

  it('LO QUE VIENE DEL DEPÓSITO PASA POR LA PUERTA IGUAL', async () => {
    // Es dato externo aunque venga de casa: un depósito con un dibujo corrupto
    // —o adulterado— no puede meterlo en la pantalla de nadie.
    const sprites = spritesEnMemoria()
    const corrupto = { clave: VARA, lado: 24, filas: ['9'.repeat(24)] } as unknown as Sprite
    const cuantos = await cargarDeposito(sprites, depositoFalso([corrupto]))
    expect(cuantos).toBe(0)
    expect(sprites.dameYa(VARA)).toBeUndefined()
  })

  it('y con el depósito caído se arranca igual, con cero dibujos', async () => {
    const sprites = spritesEnMemoria()
    expect(await cargarDeposito(sprites, caido)).toBe(0)
  })
})
