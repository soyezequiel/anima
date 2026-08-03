// ─── CUÁNTO MUNDO ENTRA EN LA PANTALLA, SIN NAVEGADOR ───────────────────────
//
// El defecto que esto arregla se veía y no se podía medir: en una ventana de
// 1900×900 sobraban setecientos píxeles a la derecha del mapa, y ningún zoom los
// llenaba porque el encuadre era un cuadrado de quince por quince, escrito a mano
// con un `const RADIO = 7`.
//
// La cuenta vive en `el-encuadre.ts` y no en `main.ts` justamente para esto. Lo
// que sí necesita un navegador —medir el lugar que hay— quedó del otro lado, y es
// tres líneas de `clientWidth`. Es la misma partición que ya tienen
// `lo-senalado.ts` y `con-quien.ts`: lo que decide se prueba, lo que pinta no.
//
// ─── LOS CUATRO CASOS ──────────────────────────────────────────────────────
//
//   1. una pantalla apaisada da un encuadre APAISADO — el caso que motivó todo;
//   2. el zoom cambia cuántas entran, porque cambia cuánto ocupa una celda;
//   3. el tope frena antes que la pantalla, y sin volverlo un cuadrado;
//   4. una ventana muy chica no deja a la criatura sin contexto.

import { describe, expect, it } from 'vitest'

import { CELDA } from '@anima/dibujo'

import { RADIO_MINIMO, TOPE_DE_CELDAS, encuadrePara } from '../src/el-encuadre.js'

/** Cuántas celdas dibuja un encuadre. */
function celdas(r: { x: number; y: number }): number {
  return (2 * r.x + 1) * (2 * r.y + 1)
}

/** Los píxeles que ocupa en pantalla, que es contra lo que hay que compararlo. */
function mide(r: { x: number; y: number }, zoom: number): { ancho: number; alto: number } {
  return { ancho: (2 * r.x + 1) * CELDA * zoom, alto: (2 * r.y + 1) * CELDA * zoom }
}

describe('el encuadre sale del lugar que hay', () => {
  it('UNA PANTALLA APAISADA DA UN ENCUADRE APAISADO, que es el defecto que se arregló', () => {
    // La medida real del pedido: 1900 de ancho menos el panel de 290 y los
    // márgenes, contra unos 790 de alto útil. Con el cuadrado viejo esto daba
    // 15×15 y sobraban setecientos píxeles a la derecha.
    const r = encuadrePara({ ancho: 1550, alto: 790 }, 2)
    expect(r.x).toBeGreaterThan(r.y)
    // Y no por poco: el ancho útil es casi el doble del alto.
    expect(r.x).toBeGreaterThan(r.y + 4)
  })

  it('y lo que entra ENTRA: el mapa nunca se pasa del lugar que se le dio', () => {
    // La propiedad que hace que esto sirva. Un encuadre que se pase por una celda
    // no se ve como un error: se ve como scroll horizontal en toda la página, que
    // es el bug que el `max-width: 100%` del canvas tapa desde hace tres hitos.
    //
    // ─── SE MIRA EJE POR EJE, y la primera versión de este test no lo hacía ──
    //
    // Decía «cabe a lo ancho Y a lo alto, o está en el piso», con el piso mirado
    // sólo en la x. Se puso rojo con 1550×790 a zoom ×4, que es un caso real: a
    // ese zoom una celda ocupa 112 píxeles, así que a lo ancho entran trece
    // holgadas y a lo alto el encuadre toca el piso y se pasa. Un eje frenado por
    // la pantalla y el otro por el piso, al mismo tiempo.
    for (const espacio of [
      { ancho: 1550, alto: 790 },
      { ancho: 900, alto: 900 },
      { ancho: 640, alto: 480 },
      { ancho: 2400, alto: 1300 },
    ]) {
      for (const zoom of [1, 2, 3, 4]) {
        const r = encuadrePara(espacio, zoom)
        const px = mide(r, zoom)
        const donde = `${String(espacio.ancho)}×${String(espacio.alto)} a ×${String(zoom)}`
        // El piso es la única excusa para pasarse, y es a propósito: por debajo de
        // `RADIO_MINIMO` el encuadre deja de achicarse y el que achica pasa a ser
        // el navegador, con el `max-width` del canvas. Ver esa constante.
        expect(px.ancho <= espacio.ancho || r.x === RADIO_MINIMO, `${donde}: se pasa a lo ancho`).toBe(true)
        expect(px.alto <= espacio.alto || r.y === RADIO_MINIMO, `${donde}: se pasa a lo alto`).toBe(true)
      }
    }
  })

  it('EL ZOOM CAMBIA CUÁNTO SE VE, y en la dirección que uno esperaría', () => {
    // Una celda ocupa `CELDA × zoom`, así que a más zoom entran menos. Es la
    // razón por la que el botón del zoom tiene que volver a pedir el encuadre:
    // sin eso, el ×4 dibujaría el mismo mapa cuatro veces más grande y se saldría
    // de la ventana.
    const espacio = { ancho: 1550, alto: 790 }
    const uno = encuadrePara(espacio, 1)
    const cuatro = encuadrePara(espacio, 4)
    expect(celdas(uno)).toBeGreaterThan(celdas(cuatro))
  })

  it('EL TOPE FRENA ANTES QUE LA PANTALLA, y no lo hace volviéndolo un cuadrado', () => {
    // Un monitor 4K en zoom ×1 pediría nueve mil celdas, o sea un cuadro de dos
    // décimas de segundo. El mundo empezaría a perder ticks, y eso se ve como
    // «la criatura se mueve a los saltos», no como «el mapa es grande».
    const r = encuadrePara({ ancho: 3800, alto: 2000 }, 1)
    expect(celdas(r)).toBeLessThanOrEqual(TOPE_DE_CELDAS)

    // Y lo que hay que cuidar al achicar: que siga siendo apaisado. Recortar el
    // lado más largo hasta que entre lo llevaría al cuadrado, que es exactamente
    // lo que este archivo vino a arreglar.
    expect(r.x).toBeGreaterThan(r.y)
  })

  it('una ventana chica NO deja a la criatura sin contexto', () => {
    // Con radio 4 se ven las ocho celdas de alrededor más un anillo: alcanza para
    // entender qué está haciendo. Devolver 0 o 1 sería un mapa que no es un mapa.
    const r = encuadrePara({ ancho: 120, alto: 90 }, 4)
    expect(r.x).toBe(RADIO_MINIMO)
    expect(r.y).toBe(RADIO_MINIMO)
  })

  it('APROVECHA EL LUGAR: una celda más por lado ya no entraría', () => {
    // El control del test de arriba, y el que hace falta de verdad. «Cabe» lo
    // cumple también un encuadre de 3×3 en una pantalla de cine: sin esta mitad,
    // la función podría devolver cualquier cosa chica y el otro test daría verde
    // con el defecto original —setecientos píxeles muertos— intacto.
    //
    // ─── LOS CASOS ESTÁN ELEGIDOS, Y EL TEST SE DEFIENDE DE ESO ─────────────
    //
    // El encuadre tiene tres frenos: la pantalla, el tope de celdas y el piso.
    // Este test habla del PRIMERO, así que los casos son los que no tocan los
    // otros dos —a 1550×790 en zoom ×1 el tope frena antes que la ventana, y ahí
    // «desperdicia lugar» es lo correcto, no un defecto—.
    //
    // Elegir los casos así abre el riesgo de que el test se vuelva hueco: si
    // mañana `TOPE_DE_CELDAS` baja, estos casos podrían pasar a estar frenados
    // por el tope y la aserción de abajo sería sobre nada. Por eso las dos
    // primeras líneas del bucle **afirman que el caso sigue siendo del primer
    // tipo**. Si dejan de serlo, se pone rojo acá y no en silencio.
    const casos: readonly (readonly [{ ancho: number; alto: number }, number])[] = [
      [{ ancho: 1550, alto: 790 }, 2],
      [{ ancho: 640, alto: 480 }, 1],
      [{ ancho: 2400, alto: 1300 }, 3],
      [{ ancho: 900, alto: 900 }, 2],
    ]
    for (const [espacio, zoom] of casos) {
      const r = encuadrePara(espacio, zoom)
      const donde = `${String(espacio.ancho)}×${String(espacio.alto)} a ×${String(zoom)}`
      expect(celdas(r), `${donde}: lo frenó el tope, no la pantalla`).toBeLessThan(TOPE_DE_CELDAS)
      expect(Math.min(r.x, r.y), `${donde}: lo frenó el piso, no la pantalla`).toBeGreaterThan(RADIO_MINIMO)

      // Y acá lo que el test dice: crecer un radio —o sea una celda de cada lado
      // del foco, dos en total— ya no entraría.
      const masUno = mide({ x: r.x + 1, y: r.y + 1 }, zoom)
      expect(masUno.ancho > espacio.ancho || masUno.alto > espacio.alto, `${donde}: desperdicia lugar`).toBe(true)
    }
  })
})
