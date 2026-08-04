import { beforeEach, describe, expect, it } from 'vitest'

import { porElSobre } from '../src/el-sobre.js'
import { miApi, normalizarBase } from '../src/mi-api.js'

/**
 * ═══ LA API QUE TRAE EL QUE JUEGA (ADR 0089) ═══════════════════════════════
 *
 * El depósito dejó de poner la cuenta. Lo que la reemplaza son dos piezas: leer
 * la API del `localStorage` —que lo escribe ÁNIMA I, porque comparten dominio—
 * y el baile de dos viajes con el depósito.
 *
 * Ninguna prueba de acá pisa `globalThis.fetch`: el `fetch` entra por parámetro.
 * La razón está escrita en `forjar-por-el-deposito.ts` y se pagó con un test que
 * fallaba una corrida sí y una no, en OTRO archivo.
 */

/** Un `localStorage` de tres líneas. Más honesto que traer un jsdom entero. */
function memoriaDelNavegador(): Storage {
  const datos = new Map<string, string>()
  return {
    get length() {
      return datos.size
    },
    clear: () => datos.clear(),
    getItem: (k: string) => datos.get(k) ?? null,
    key: (i: number) => [...datos.keys()][i] ?? null,
    removeItem: (k: string) => datos.delete(k),
    setItem: (k: string, v: string) => datos.set(k, v),
  } as Storage
}

function guardarApi(api: Record<string, unknown>, eleccion = 'openai'): void {
  localStorage.setItem('anima:ai:choice', eleccion)
  localStorage.setItem('anima:ai:openai-settings', JSON.stringify(api))
}

const API_COMPLETA = { baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x', model: 'gpt-4o-mini' }

describe('leer la API del navegador', () => {
  beforeEach(() => {
    ;(globalThis as { localStorage?: Storage }).localStorage = memoriaDelNavegador()
  })

  it('sin nada guardado no hay API', () => {
    expect(miApi()).toBeUndefined()
  })

  it('con los tres campos y la mente encendida, sí', () => {
    guardarApi(API_COMPLETA)
    expect(miApi()).toEqual(API_COMPLETA)
  })

  /**
   * TENER UNA LLAVE GUARDADA NO ES QUERER GASTARLA. Alguien que apagó la mente
   * real en Ánima I y volvió al simulado no debería empezar a pagar por bajar
   * al /v2 — y su llave sigue guardada, porque apagar no es olvidar.
   */
  it('con la llave guardada pero la mente apagada, no se usa', () => {
    guardarApi(API_COMPLETA, 'mock')
    expect(miApi()).toBeUndefined()
    // Salvo que se pregunte explícitamente por lo guardado.
    expect(miApi(false)).toEqual(API_COMPLETA)
  })

  it('con dos de tres campos, no: a medias no hay a quién llamar', () => {
    guardarApi({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x', model: '' })
    expect(miApi()).toBeUndefined()
  })

  it('un guardado corrupto no rompe nada: se lee como si no hubiera', () => {
    localStorage.setItem('anima:ai:choice', 'openai')
    localStorage.setItem('anima:ai:openai-settings', 'esto no es json')
    expect(miApi()).toBeUndefined()
  })

  it('le pone /v1 si falta, y respeta el camino que ya había', () => {
    expect(normalizarBase('https://api.openai.com')).toBe('https://api.openai.com/v1')
    expect(normalizarBase('http://localhost:11434/v1/')).toBe('http://localhost:11434/v1')
  })
})

/** Un `fetch` guionado que anota adónde le pegaron y con qué. */
function fetchDeMentira(respuestas: (() => Response)[]) {
  const pedidos: { url: string; cuerpo: unknown }[] = []
  let i = 0
  const fetch = ((url: string, init?: RequestInit) => {
    pedidos.push({ url, cuerpo: JSON.parse(String(init?.body)) })
    const r = respuestas[i] ?? respuestas.at(-1)
    i += 1
    return Promise.resolve(r!())
  }) as unknown as typeof globalThis.fetch
  return { fetch, pedidos }
}

const json = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } })

describe('el baile de los dos viajes', () => {
  it('pide el sobre, lleva el prompt al modelo y devuelve lo que el depósito validó', async () => {
    const { fetch, pedidos } = fetchDeMentira([
      () => json({ ok: true, ticket: 't-1', prompt: 'dibujá una vara' }),
      () => json({ ok: true, yaEstaba: false, sprite: { filas: ['11', '11'] } }, 201),
    ])
    const vistos: string[] = []

    const r = (await porElSobre({
      donde: 'http://deposito',
      pedido: { tipo: 'dibujar', clave: 'vara/madera/24' },
      llevar: (prompt) => {
        vistos.push(prompt)
        return Promise.resolve({ ok: true, texto: '11\n11' })
      },
      fetch,
    })) as { sprite?: unknown }

    // El prompt es EL QUE ARMÓ EL DEPÓSITO: el juego no lo escribe, lo transporta.
    expect(vistos).toEqual(['dibujá una vara'])
    expect(pedidos[1]!.url).toBe('http://deposito/sobre/t-1')
    expect(pedidos[1]!.cuerpo).toEqual({ texto: '11\n11' })
    expect(r.sprite).toBeDefined()
  })

  /**
   * EL ATAJO. Un dibujo que ya está no arma sobre, así que el modelo del jugador
   * ni se entera — y no se le cobra por algo que otro ya dibujó.
   */
  it('si el dibujo ya estaba, no se le pregunta a nadie', async () => {
    const { fetch, pedidos } = fetchDeMentira([
      () => json({ ok: true, yaEstaba: true, sprite: { filas: ['11'] } }),
    ])
    let pregunto = false

    const r = (await porElSobre({
      donde: 'http://deposito',
      pedido: { tipo: 'dibujar', clave: 'vara/madera/24' },
      llevar: () => {
        pregunto = true
        return Promise.resolve({ ok: true, texto: 'x' })
      },
      fetch,
    })) as { yaEstaba?: boolean }

    expect(pregunto).toBe(false)
    expect(pedidos).toHaveLength(1)
    expect(r.yaEstaba).toBe(true)
  })

  it('si el modelo del jugador no contesta, tira con su motivo', async () => {
    const { fetch } = fetchDeMentira([() => json({ ok: true, ticket: 't', prompt: 'p' })])
    await expect(
      porElSobre({
        donde: 'http://deposito',
        pedido: { tipo: 'leer', consulta: {} },
        llevar: () => Promise.resolve({ ok: false, texto: '', porque: 'tu API rechazó la llave' }),
        fetch,
      }),
    ).rejects.toThrow(/rechazó la llave/)
  })

  it('un sobre vencido tira, y el mensaje trae el porqué del depósito', async () => {
    const { fetch } = fetchDeMentira([
      () => json({ ok: true, ticket: 't', prompt: 'p' }),
      () => json({ ok: false, porque: 'ese sobre no existe, ya se contestó o venció' }, 404),
    ])
    await expect(
      porElSobre({
        donde: 'http://deposito',
        pedido: { tipo: 'dibujar', clave: 'vara/madera/24' },
        llevar: () => Promise.resolve({ ok: true, texto: 'algo' }),
        fetch,
      }),
    ).rejects.toThrow(/venció/)
  })

  /**
   * EL 422 NO ES UNA FALLA DEL CAMINO. «Tu modelo contestó algo que no pasa la
   * puerta» es una respuesta, y quien llama sabe leerla. Tirarla acá borraría la
   * diferencia entre «no llegué» y «llegué y no sirvió», que es exactamente la
   * distinción que las lámparas del juego pintan distinto.
   */
  it('un rechazo de la puerta vuelve como respuesta, no como excepción', async () => {
    const { fetch } = fetchDeMentira([
      () => json({ ok: true, ticket: 't', prompt: 'p' }),
      () => json({ ok: false, porque: 'eso no tiene 24 filas' }, 422),
    ])
    const r = (await porElSobre({
      donde: 'http://deposito',
      pedido: { tipo: 'dibujar', clave: 'vara/madera/24' },
      llevar: () => Promise.resolve({ ok: true, texto: 'cualquier cosa' }),
      fetch,
    })) as { porque?: string }
    expect(r.porque).toContain('24 filas')
  })
})
