/**
 * LA COMA CORTA CUANDO LA SIGUE UN VERBO — y el hallazgo que lo pidió.
 *
 * ─── LA MEDICIÓN, antes de escribir una línea ───────────────────────────────
 *
 * La frase del criterio del C3 —«juntá dos troncos, dejá uno junto al fuego y
 * guardá el otro»— se leía como **UNA sola cláusula**, y salía con la meta
 * `emitsPower>0`. O sea: un pedido de tres partes se convertía en uno de una, **y
 * con la meta equivocada**.
 *
 * El mecanismo son dos cosas encadenadas:
 *
 *   1. `tokenizar` se come la coma y `cortar` sólo parte por «y», «después»,
 *      «luego», «entonces» y «mientras». Así que «junta dos troncos deja uno
 *      junto al fuego» es un trozo solo;
 *   2. adentro de ese trozo, el atajo de la meta de `componer` hace lo suyo:
 *      `juntar` es un verbo de CONSEGUIR y «fuego» está entre sus objetos, así
 *      que gana `emitsPower>0`. **La segunda mitad le robó la meta a la primera.**
 *
 * Es el mismo defecto que el ADR 0078 de Ánima I arregló —«un encargo de varias
 * partes perdía todas menos la primera»— reintroducido por otra puerta.
 *
 * ─── POR QUÉ NO ALCANZA CON «CORTAR POR COMA» ───────────────────────────────
 *
 * Porque no cortar era una decisión ESCRITA, con su contraejemplo al lado: *«una
 * coma en castellano separa cláusulas tanto como enumera sustantivos — “traé
 * leña, agua y piedras” no son tres pedidos»*. Cortar a secas rompe eso.
 *
 * La regla que distingue los dos casos es de una línea y usa el léxico, que ya
 * sabe qué es un verbo: **una coma seguida de un verbo abre una cláusula; una
 * coma seguida de cualquier otra cosa sigue la anterior.** Es la misma forma que
 * `referenciaDe` usa con `conoceElVerbo` para no leer «pelo» como «pe» + «lo».
 *
 * Y el contraejemplo del comentario viejo se comporta IGUAL que antes, que es lo
 * único que hace segura la reparación. Está afirmado abajo con las dos formas.
 */

import { buildSeedPhysics } from '@anima/physics'
import { ESQUEMAS } from '@anima/plan'
import { describe, expect, it } from 'vitest'
import { PUENTE } from '../src/alias.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'

const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const FIRMAS = new Set(ESQUEMAS.map((e) => e.establishes))
const opc = { phys, lexico, sabeElCatalogo: (f: string): boolean => FIRMAS.has(f) }

/** Las cláusulas como texto, que es lo que se está afirmando. */
function partes(frase: string): readonly string[] {
  return leer(frase, opc).clausulas.map((c) => c.crudo)
}

describe('la coma que corta', () => {
  it('LA FRASE DEL CRITERIO se parte en tres y no en una', () => {
    const cs = partes('juntá dos troncos, dejá uno junto al fuego y guardá el otro')
    expect(cs).toEqual(['junta dos troncos', 'deja uno junto al fuego', 'guarda el otro'])
  })

  it('Y LA PRIMERA DEJA DE PEDIR FUEGO, que es el daño de verdad', () => {
    // Con la frase pegada, «juntá dos troncos» salía como `emitsPower>0` porque
    // el «fuego» de la otra mitad estaba entre sus objetos. Una cosa es perder
    // una cláusula; otra es que la que queda pida algo que nadie pidió.
    const primera = leer('juntá dos troncos, dejá uno junto al fuego y guardá el otro', opc).clausulas[0]
    expect(primera?.firma).not.toBe('emitsPower>0')
    expect(primera?.firma).toBe(leer('juntá dos troncos', opc).clausulas[0]?.firma)
  })

  it('EL CONTRAEJEMPLO ESCRITO se comporta IGUAL que antes', () => {
    // «Traé leña, agua y piedras» no son tres pedidos, y el comentario viejo lo
    // decía. La prueba de que la reparación no lo rompe es que la frase CON coma
    // y la misma SIN coma dan exactamente lo mismo — que es lo que pasaba antes,
    // cuando la coma no existía para el lector.
    expect(partes('traé leña, agua y piedras')).toEqual(partes('traé leña agua y piedras'))
  })

  it('una coma seguida de algo que no es verbo no abre nada', () => {
    expect(partes('traé una vara, una hebra')).toEqual(['trae una vara una hebra'])
  })

  it('y dos comas seguidas de verbo abren dos', () => {
    const cs = partes('juntá dos troncos, hacé fuego, comé algo')
    expect(cs).toHaveLength(3)
  })

  it('la coma sola, o al final, no inventa una cláusula vacía', () => {
    expect(partes('hacé fuego,')).toEqual(['hace fuego'])
    expect(leer(',', opc).clausulas).toHaveLength(1)
  })

  it('lo que ya andaba sigue andando: «y» y «después» no se tocan', () => {
    expect(partes('traé un palo y después hacé fuego')).toEqual(['trae un palo', 'hace fuego'])
    const l = leer('pescá algo y después asá el pescado', opc)
    expect(l.clausulas[1]?.liga).toBe('despues')
  })
})
