// ─── DECIR UNA META CUANDO LA TABLA NO ALCANZA ──────────────────────────────
//
// El caso que motivó todo esto se vio en pantalla, y está acá como primer test:
// el panel del juego mostraba `holding(tag:carnoso,toxicity<0.0528)` porque el
// puente traduce por tabla y ese número no está en ninguna fila — ni puede
// estar, porque la criatura lo calcula a cada tick.

import { describe, expect, it } from 'vitest'
import { interpretar, textoDe } from '@anima/plan'
import { TAGS } from '@anima/physics'

import { PALABRA_DE_TAG, enPalabras } from '../src/decir.js'

/** De la firma a la frase, que es el camino que hace el juego. */
function decir(firma: string): string {
  const p = interpretar(firma)
  if (p === undefined) throw new Error(`no se pudo interpretar «${firma}»`)
  return enPalabras(p)
}

describe('una meta dicha en castellano', () => {
  it('EL CASO QUE LO MOTIVÓ: la meta de comer, con su número calculado', () => {
    expect(decir('holding(tag:carnoso,toxicity<0.0528)')).toBe('tener algo carnoso y poco venenoso')
  })

  it('el número NO se dice, y es a propósito', () => {
    // Dos umbrales distintos —una criatura llena y una flaca— dicen lo mismo. Es
    // la decisión del archivo: el jugador quiere saber QUÉ busca, no con qué
    // umbral lo evalúa. Y de paso, el panel deja de cambiar de texto cada tick.
    expect(decir('holding(tag:carnoso,toxicity<0.0528)')).toBe(decir('holding(tag:carnoso,toxicity<0.9)'))
  })

  it('el comparador da vuelta la palabra, que es por qué hay dos y no una', () => {
    expect(decir('holding(tag:organico,temperature>=100)')).toBe('tener algo orgánico y caliente')
    expect(decir('holding(tag:organico,temperature<=5)')).toBe('tener algo orgánico y frío')
  })

  it('sin condiciones, la frase es la corta', () => {
    expect(decir('holding(tag:fibroso)')).toBe('tener algo fibroso')
  })

  it('varias condiciones se encadenan', () => {
    const dicho = decir('holding(tag:carnoso,digestibility>=0.85,toxicity<=0.05)')
    expect(dicho).toContain('carnoso')
    expect(dicho).toContain('digerible')
    expect(dicho).toContain('poco venenoso')
  })

  it('una cualidad suelta y una geometría suelta también se dicen', () => {
    expect(decir('temperature>=400')).toBe('caliente')
    expect(decir('catch>0')).toBe('que atrape')
  })

  it('LOS SIETE TAGS TIENEN PALABRA, y eso hay que afirmarlo', () => {
    // La lista es cerrada en `substance.ts`. Si alguien agrega un tag y no le da
    // palabra, esto se pone rojo — que es mejor que enterarse mirando el panel.
    //
    // Se mira la TABLA y no la frase, y la primera versión hacía lo segundo: pedía
    // que la frase no contuviera el id del tag, y fallaba con «mineral» —que se
    // dice igual que se llama— sin que nada estuviera mal. Cuatro de los siete
    // están en ese caso: la traducción correcta es la identidad.
    for (const t of TAGS) {
      expect(PALABRA_DE_TAG[t], `el tag «${t}» no tiene palabra`).toBeDefined()
      // Y la frase se arma igual, que es lo que se ve.
      expect(decir(textoDe({ k: 'sostiene', tag: t }))).toBe(`tener algo ${String(PALABRA_DE_TAG[t])}`)
    }
  })

  it('lo que no tiene palabra sale crudo, y ésa es la señal', () => {
    // No es un descuido: el puente hace lo mismo. Una firma cruda en pantalla
    // dice «a esta meta le falta una palabra», y se ve para que se note.
    expect(decir('holding(tag:mineral,denaturesAt>=60)')).toContain('denaturesAt')
  })
})
