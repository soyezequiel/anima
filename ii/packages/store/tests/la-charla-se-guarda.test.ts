// ═══ C1 · LA CUARTA RANURA: LA CONVERSACIÓN ════════════════════════════════
//
// El tramo está en `docs/product/convergencia-conversacional.md`. Lo que este
// archivo afirma es la mitad del criterio de C1 que vive en este paquete:
// **el log conversacional sobrevive el viaje**, con su orden y su identidad, y un
// guardado de la versión 1 no se tira por no tenerlo.
//
// Lo que NO se prueba acá: que la app lo use. Eso es de `apps/juego`, y está en
// `tests/la-charla-sobrevive.test.ts` con la recarga entera.

import { describe, expect, it } from 'vitest'
import { Creencias } from '@anima/mind'
import type { Dicho } from '@anima/lang'

import {
  cargar,
  comoSeGuarda,
  comoSeRestaura,
  enMemoria,
  guardar,
  loQueHereda,
  loQueNoAguanta,
  VERSION_DEL_GUARDADO,
  type Guardado,
} from '../src/index.js'
import { laEscenaDelDocumento } from './escena.js'

const QUIEN = 'ana'

const CHARLA: readonly Dicho[] = [
  { turno: 1, tick: 0, clase: 'entrada', texto: 'hacé fuego' },
  { turno: 2, tick: 0, clase: 'acuse', texto: 'dale, voy' },
  { turno: 3, tick: 12, clase: 'progreso', texto: 'agarró una vara de madera', sobre: 'vara' },
  { turno: 4, tick: 80, clase: 'listo', texto: 'listo' },
]

describe('C1 · la charla se guarda y vuelve', () => {
  it('el viaje de ida y vuelta la devuelve entera, en orden y con su identidad', async () => {
    const d = enMemoria()
    await guardar(d, laEscenaDelDocumento(), new Creencias(), QUIEN, CHARLA)
    const vuelto = await cargar(d, QUIEN)
    expect(vuelto?.charla).toEqual(CHARLA)
  })

  it('AGUANTA EL VIAJE POR JSON, que es lo único que este paquete puede prometer', () => {
    // La misma puerta que rechaza un `Map`: si un día alguien mete un objeto vivo
    // en un `Dicho`, se ve acá y no tres semanas después con la charla vacía.
    const g = comoSeGuarda(laEscenaDelDocumento(), new Creencias(), QUIEN, CHARLA)
    expect(loQueNoAguanta(g)).toBe('')
    expect(comoSeRestaura(JSON.parse(JSON.stringify(g)) as Guardado).charla).toEqual(CHARLA)
  })

  it('UN GUARDADO DE LA VERSIÓN 1 NO SE TIRA: entra con la charla vacía', () => {
    // Es la migración, y es lo que separa «subir la versión» de «borrarle la
    // partida a alguien». Un save viejo NO PUEDE tener charla: la respuesta
    // correcta es una lista vacía, no una excepción.
    const viejo = { ...comoSeGuarda(laEscenaDelDocumento(), new Creencias(), QUIEN, CHARLA), version: 1 }
    delete (viejo as { charla?: unknown }).charla

    const r = comoSeRestaura(viejo as Guardado)
    expect(r.charla).toEqual([])
    expect(r.state.tick).toBe(0)
    // Y heredar tampoco se rompe por la versión: las dos puertas usan la misma.
    expect(() => loQueHereda(viejo as Guardado)).not.toThrow()
  })

  it('UN GUARDADO DE LA VERSIÓN 2 tampoco se tira: entra sin encargo', () => {
    // La 2 tenía charla y no tenía encargo (el C3 lo agregó). Su ausencia no es
    // un hueco a rellenar: una partida sin nada pedido no tiene ninguno, así que
    // lo correcto es que siga faltando.
    const dos = { ...comoSeGuarda(laEscenaDelDocumento(), new Creencias(), QUIEN, CHARLA), version: 2 }
    const r = comoSeRestaura(dos as Guardado)
    expect(r.charla).toEqual(CHARLA)
    expect(r.encargo).toBeUndefined()
  })

  it('y una versión que nadie sabe leer SÍ se rechaza, con su número al lado', () => {
    // El control negativo de la migración. Sin él, «no se tira» podría querer
    // decir «se acepta cualquier cosa», que es peor que rechazar.
    const delFuturo = { ...comoSeGuarda(laEscenaDelDocumento(), new Creencias(), QUIEN), version: 99 }
    expect(() => comoSeRestaura(delFuturo)).toThrow(/99/)
    // El pin de la versión, actualizado con lo que afirmaba al lado: las dos
    // migraciones de arriba son 1→3 y 2→3, y este número dice contra cuál.
    expect(VERSION_DEL_GUARDADO).toBe(3)
  })

  it('sin charla, el guardado la escribe vacía y no `undefined`', () => {
    // Una ranura que a veces no está obliga a todos los lectores a preguntar.
    expect(comoSeGuarda(laEscenaDelDocumento(), new Creencias(), QUIEN).charla).toEqual([])
  })
})
