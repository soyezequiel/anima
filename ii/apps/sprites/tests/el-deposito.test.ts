// ─── EL DEPÓSITO, DE PUNTA A PUNTA ──────────────────────────────────────────
//
// Corre el servidor de verdad en un puerto suelto y le pega con `fetch`. Es una
// llamada a la red y conviene decir por qué no contradice el criterio del Hito 5
// —*proveedor apagado: 0 llamadas a la red*—: ese criterio es sobre el RUNTIME
// DEL MUNDO, que tiene que poder correr una partida entera sin salir a ningún
// lado. Esto es una app aparte, opcional, y si el depósito no está el juego
// dibuja procedural y no se entera.

import { describe, expect, it } from 'vitest'

import { claveDePieza } from '@anima/dibujo'

import { baulEnMemoria, crearServidor } from '../src/servidor.js'

/**
 * Un dibujo VÁLIDO cualquiera — y hay que contar por qué ya no es un aspa.
 *
 * Este fixture era un aspa de celdas `3`, y pasaba cuando la puerta sólo miraba
 * medida, alfabeto y doce celdas encendidas. Al endurecerla —las cuatro reglas de
 * «no se entiende qué es»— el aspa pasó a ser inválida por dos a la vez: **toda
 * su tinta es luz tocando el vacío**, que es exactamente lo que prohíbe la regla
 * 3 (el contorno va en sombra), y encima no llena el cuadro.
 *
 * Que estos tests se pusieran rojos fue la puerta haciendo su trabajo sobre el
 * banco de pruebas de sí misma. El de acá es un bloque lleno: borde en sombra,
 * relleno en base, y una veta de luz metida una celda adentro.
 */
function bloque(lado: number): string[] {
  const filas: string[] = []
  for (let y = 0; y < lado; y++) {
    let f = ''
    for (let x = 0; x < lado; x++) {
      const borde = y === 0 || x === 0 || y === lado - 1 || x === lado - 1
      f += borde ? '2' : x === y ? '3' : '1'
    }
    filas.push(f)
  }
  return filas
}

/** Levanta el servidor en un puerto libre y devuelve cómo hablarle. */
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

const CLAVE = claveDePieza('vara', 'madera', 24)
const RUTA = `/sprites/${encodeURIComponent(CLAVE)}`

describe('el depósito compartido', () => {
  it('arranca vacío y lo dice', async () => {
    await conServidor(async (base) => {
      const r = await fetch(`${base}/salud`)
      expect(r.status).toBe(200)
      // `dibuja` y `modelos` en `null`: este depósito no tiene dibujante y nadie
      // le pasó un vigía, así que no afirma nada sobre qué modelos hay. El
      // detalle vive en `quien-hay.test.ts`.
      // `contesta` también en `null`: dibujar y contestar el chat son dos
      // permisos distintos, y este depósito no tiene ninguno de los dos.
      expect(await r.json()).toEqual({ ok: true, sprites: 0, dibuja: null, contesta: null, forja: null, modelos: null })
    })
  })

  it('lo que nadie dibujó todavía contesta 404, no un error', async () => {
    await conServidor(async (base) => {
      const r = await fetch(`${base}${RUTA}`)
      expect(r.status).toBe(404)
    })
  })

  it('UN DIBUJO ENTRA, Y DESPUÉS ESTÁ PARA CUALQUIERA', async () => {
    await conServidor(async (base) => {
      const alta = await fetch(`${base}${RUTA}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filas: bloque(24) }),
      })
      expect(alta.status).toBe(201)

      // «Cualquiera» es otro cliente que sólo tiene la clave.
      const otro = await fetch(`${base}${RUTA}`)
      expect(otro.status).toBe(200)
      const s = (await otro.json()) as { filas: string[]; lado: number }
      expect(s.lado).toBe(24)
      expect(s.filas).toEqual(bloque(24))

      // Y aparece en el catálogo que un cliente carga al abrir.
      const todos = (await (await fetch(`${base}/sprites`)).json()) as { sprites: unknown[] }
      expect(todos.sprites.length).toBe(1)
    })
  })

  it('LA MISMA PUERTA QUE EL CLIENTE: un dibujo inválido no entra', async () => {
    await conServidor(async (base) => {
      const malo = bloque(24).map((f, i) => (i === 3 ? '9'.repeat(24) : f))
      const r = await fetch(`${base}${RUTA}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filas: malo }),
      })
      expect(r.status).toBe(422)
      expect(((await r.json()) as { porque: string }).porque).toContain('índice de paleta')

      // Y no quedó nada guardado.
      expect(((await (await fetch(`${base}/salud`)).json()) as { sprites: number }).sprites).toBe(0)
    })
  })

  it('PRIMERO GANA: el segundo que dibuja la misma clave recibe el que ya estaba', async () => {
    await conServidor(async (base) => {
      const mandar = (filas: string[]) =>
        fetch(`${base}${RUTA}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ filas }),
        })

      await mandar(bloque(24))
      // Otro dibujo válido, distinto: un marco.
      const marco = Array.from({ length: 24 }, (_, y) =>
        y === 0 || y === 23 ? '1'.repeat(24) : `1${'0'.repeat(22)}1`,
      )
      const segundo = await mandar(marco)
      expect(segundo.status).toBe(200)
      const cuerpo = (await segundo.json()) as { yaEstaba: boolean; sprite: { filas: string[] } }
      expect(cuerpo.yaEstaba).toBe(true)
      expect(cuerpo.sprite.filas).toEqual(bloque(24))
    })
  })

  it('y el cuerpo que no es JSON se rechaza sin tirar el servidor abajo', async () => {
    await conServidor(async (base) => {
      const r = await fetch(`${base}${RUTA}`, { method: 'POST', body: 'esto no es json' })
      expect(r.status).toBe(400)
      // El control que importa: sigue vivo.
      expect((await fetch(`${base}/salud`)).status).toBe(200)
    })
  })
})
