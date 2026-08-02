// ─── LOS DOS DEPÓSITOS, CONTRA EL MISMO LOTE ────────────────────────────────
//
// `@anima/store` publica una interfaz de cuatro métodos y dice, en su encabezado,
// para qué existe: *«toda la lógica de qué se guarda y cómo se restaura es
// independiente de dónde se guarda»*. Esa frase sólo es verdad si las dos
// implementaciones se comportan igual, y hasta este archivo **nadie lo había
// comprobado**: `enMemoria()` tenía toda la suite y el de IndexedDB no existía.
//
// Así que el lote se escribe UNA vez y corre contra los dos. Un test que le
// pasara sólo al de memoria no probaría la interfaz: probaría un `Map`.
//
// ─── POR QUÉ HACE FALTA `fake-indexeddb`, Y QUÉ NO PRUEBA ──────────────────
//
// No hay `indexedDB` en node, que es la razón entera por la que este adaptador
// vive en la app y no en el paquete. `fake-indexeddb` es la misma API sobre
// memoria, y alcanza para lo que este archivo afirma: que los cuatro métodos
// cumplen el contrato y que el viaje por JSON pasa igual en los dos.
//
// **Lo que no prueba es que ande en un navegador de verdad** —permisos, modo
// privado, cuota llena—, y eso se verifica abriendo el juego y recargando.

import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { enMemoria, loQueNoAguanta } from '@anima/store'
import type { Deposito } from '@anima/store'

import { depositoIndexedDB } from '../src/deposito-indexeddb.js'

/**
 * Una base por corrida, y el nombre lo trae quien la pide.
 *
 * `fake-indexeddb/auto` da UNA sola base global para todo el archivo, así que dos
 * tests que usaran el mismo nombre se verían las claves entre sí y el orden en
 * que vitest los corriera decidiría si pasan. Un contador es determinista; el
 * azar y el reloj están prohibidos en este repo.
 */
let cuantas = 0
const otraBase = (): Deposito => depositoIndexedDB(`prueba-${String(++cuantas)}`)

const LOS_DOS: readonly (readonly [string, () => Deposito])[] = [
  ['en memoria', enMemoria],
  ['IndexedDB', otraBase],
]

describe.each(LOS_DOS)('el depósito %s cumple el contrato', (_nombre, crear) => {
  let d: Deposito

  beforeEach(() => {
    d = crear()
  })

  it('lo que se pone se lee', async () => {
    await d.poner('a', { hola: 1, lista: [1, 2, 3] })
    expect(await d.leer('a')).toEqual({ hola: 1, lista: [1, 2, 3] })
  })

  it('lo que no está devuelve `undefined` y NO lanza', async () => {
    // Está en el contrato con esas palabras: «no estar es una respuesta». Un
    // depósito que lanzara obligaría a envolver cada carga en un try.
    expect(await d.leer('no-existe')).toBeUndefined()
  })

  it('poner dos veces la misma clave pisa', async () => {
    await d.poner('a', 1)
    await d.poner('a', 2)
    expect(await d.leer('a')).toBe(2)
  })

  it('las claves salen ORDENADAS, y no en orden de escritura', async () => {
    // Sin esto, comparar dos saves compararía en qué orden se escribieron.
    for (const k of ['zeta', 'alfa', 'mu']) await d.poner(k, k)
    expect(await d.claves()).toEqual(['alfa', 'mu', 'zeta'])
  })

  it('borrar saca la clave de la lista, y borrar lo que no está no rompe', async () => {
    await d.poner('a', 1)
    await d.borrar('a')
    expect(await d.claves()).toEqual([])
    expect(await d.leer('a')).toBeUndefined()
    await expect(d.borrar('fantasma')).resolves.toBeUndefined()
  })

  it('GUARDA UNA COPIA: mutar el objeto después no cambia lo guardado', async () => {
    // Un save que se mueve solo es peor que no tener save, porque el test que lo
    // compare da verde siempre. En IndexedDB esto sale del `stringify`; si el
    // adaptador guardara el objeto vivo, este test lo cazaría.
    const vivo = { n: 1 }
    await d.poner('a', vivo)
    vivo.n = 999
    expect(await d.leer('a')).toEqual({ n: 1 })
  })

  it('LO QUE NO AGUANTA EL VIAJE se pierde IGUAL en los dos', async () => {
    // La decisión de diseño del adaptador, afirmada. IndexedDB usa clon
    // estructurado y sabría guardar un `Map`; guardando texto no lo sabe, y los
    // dos depósitos se rompen igual. Lo contrario sería un guardado que anda en
    // el navegador y falla en la suite.
    const conMapa = { m: new Map([['k', 1]]) }
    expect(loQueNoAguanta(conMapa)).toBe('m es un Map')
    await d.poner('a', conMapa)
    expect(await d.leer('a')).toEqual({ m: {} })
  })
})
