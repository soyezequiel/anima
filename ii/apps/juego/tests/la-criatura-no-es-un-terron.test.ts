// ─── LA CRIATURA SE DIBUJA COMO CRIATURA, Y NO COMO LA CARNE QUE LA FORMA ───
//
// `glifoDe` toma un quinto parámetro, `esAgente`, y `componer.ts` lo usa para
// pedir la clave de CRIATURA en vez de la de la materia: *«una criatura pide un
// dibujo de criatura, no uno de la materia de la que está hecha»*.
//
// `mapa.ts` se lo pasaba y ninguna de las otras vistas lo hacía, así que la misma
// criatura salía como el MUÑECO en el mapa y como un bloque de carne en el
// cartel del mouse, en el globo del click y en el inspector. Es el caso 7 del
// 12C fallando —«la misma representación coherente en las tres vistas»— con el
// agravante de que **el dato nunca faltó**: `Senalado.esAgente` existe desde que
// se escribió `lo-senalado.ts` y no lo leía nadie.
//
// ─── QUÉ SE AFIRMA, Y POR QUÉ NO SE COMPARAN PÍXELES ───────────────────────
//
// Comparar el dibujo contra una foto guardada probaría que no cambió, que no es
// lo mismo que probar que está bien — y se pondría rojo cada vez que alguien
// mejore el sprite. Lo que se afirma es la propiedad que hace que la criatura
// NO sea un terrón, y está escrita en el Hito 12: *«lo que la saca de ser un
// terrón no es el color ni la textura: son LOS HUECOS. El cuello entre la cabeza
// y el torso, el aire entre cada brazo y el costado, el hueco entre las
// piernas»*. Un bloque de carne no tiene huecos interiores; el muñeco sí.

import { describe, expect, it } from 'vitest'
import { CELDA, DE_FABRICA, glifoDe, pintar, spritesEnMemoria } from '@anima/dibujo'
import { buildSeedPhysics } from '@anima/physics'
import type { RenderDescriptor } from '@anima/world'

const PHYS = buildSeedPhysics()
const SPRITES = spritesEnMemoria(DE_FABRICA)

/** El cuerpo de la criatura tal como la escena lo publica: carne, bloque, grande. */
const LA_CRIATURA: RenderDescriptor = {
  v: 1,
  forma: 'bloque',
  materiales: ['carne'],
  nucleo: 'carne',
  partes: 1,
  juntas: 0,
  atadores: [],
  estado: 'crudo',
  porte: 'grande',
} as unknown as RenderDescriptor

/**
 * QUÉ FRACCIÓN DE LA GRILLA TIENE TINTA.
 *
 * Se mide sobre lo PINTADO y no sobre el `Glifo` crudo: el glifo son capas con
 * índices de paleta y lo que el ojo ve es el resultado de componerlas. Contar
 * capas mediría cuántas hay, que no es lo mismo que cuánto se ve.
 */
function cuantaTinta(d: RenderDescriptor, lado: number, esAgente: boolean): number {
  const px = pintar(glifoDe(d, PHYS, lado, SPRITES, esAgente))
  let con = 0
  let total = 0
  for (const fila of px) {
    for (const color of fila) {
      total++
      if (color !== '') con++
    }
  }
  return con / total
}

describe('el quinto parámetro de glifoDe no es opcional en la práctica', () => {
  it('LA CRIATURA Y SU MATERIA SE DIBUJAN DISTINTO, y ésa es toda la cuestión', () => {
    const comoCriatura = cuantaTinta(LA_CRIATURA, 24, true)
    const comoCarne = cuantaTinta(LA_CRIATURA, 24, false)

    console.log('\n  ── CUÁNTA GRILLA OCUPA CADA UNO, sobre 24×24 ──')
    console.log(`  como criatura  ${comoCriatura.toFixed(3)}`)
    console.log(`  como carne     ${comoCarne.toFixed(3)}`)

    // El control primero: si los dos dieran lo mismo, el resto de este archivo
    // no probaría nada y el bug podría volver sin ponerse rojo.
    expect(comoCriatura, 'el `esAgente` no cambia el dibujo: el parámetro no hace nada').not.toBeCloseTo(comoCarne, 2)

    // Y LOS HUECOS: la criatura deja aire adentro de su caja y el bloque no.
    expect(comoCriatura).toBeLessThan(comoCarne)
  })

  it('LA MEDIDA ENTRA EN LA CLAVE, y pedir otra la devuelve como materia EN SILENCIO', () => {
    // Esto salió de que este archivo se escribió mal: el segundo bloque comparaba
    // el mapa contra el globo suponiendo que el mapa dibuja a `CELDA`, y dibuja a
    // 24 igual que todos (`GRILLA` en `mapa.ts`). Pero al pedir 28 el número no
    // fue «parecido»: fue el de la CARNE.
    //
    // El motivo es una regla del Hito 12 que acá se cobra: **la medida entra en
    // la clave del sprite**, y `DE_FABRICA` trae la criatura a 24 y nada más. A
    // cualquier otro lado, `glifoDe` cae al patrón de la materia sin decir nada
    // —que es correcto: lo procedural es el PISO y no el plan B— pero significa
    // que una vista que pida 32 «para que se vea más grande» pierde el muñeco sin
    // que se rompa nada.
    //
    // Por eso las cuatro vistas de esta app piden 24 y escalan por CSS.
    const aLaMedida = cuantaTinta(LA_CRIATURA, 24, true)
    const aOtraMedida = cuantaTinta(LA_CRIATURA, CELDA, true)
    const comoCarne = cuantaTinta(LA_CRIATURA, CELDA, false)

    expect(aOtraMedida, 'a 28 la criatura ya no cae en la materia: revisá la nota de arriba')
      .toBeCloseTo(comoCarne, 2)
    expect(aLaMedida).toBeLessThan(aOtraMedida)
  })
})
