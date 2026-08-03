// ─── CUÁNTO MUNDO ENTRA EN LA PANTALLA ──────────────────────────────────────
//
// Hasta acá el juego pedía `escenaDe(state, foco, 7)`: quince por quince celdas,
// siempre, decidido una vez y escrito a mano. En una ventana de 1900×900 eso se
// veía como **setecientos píxeles de nada a la derecha del mapa**, y no había
// zoom que los llenara: el mapa era cuadrado, así que crecer lo frenaba el alto
// mucho antes que el ancho.
//
// Este archivo contesta una sola pregunta —cuántas celdas para cada lado— y no
// sabe que existe un `<canvas>`. Por eso se puede probar sin navegador, que es
// la misma regla que ya cumplen `lo-senalado.ts` y `con-quien.ts`: lo que decide
// se prueba, lo que pinta no.
//
// ─── EL TOPE NO ES POR LAS DUDAS: SALE DEL BANCO ────────────────────────────
//
// `dibujo/tests/banco-el-cuadro` mide el cuadro entero, y el suelo es casi todo:
//
//     225 celdas, 10 cuerpos ......... 3,09 ms   (≈ 0,014 ms por celda)
//     los 50 cuerpos de una escena ... 0,42 ms   (o sea: el suelo manda)
//     techo del cuadro ............... 16 ms
//
// A ese precio el techo se toca cerca de las mil doscientas celdas. Sin un tope,
// una pantalla de 4K en zoom ×1 pediría **nueve mil** —un cuadro de dos décimas
// de segundo— y el mundo empezaría a perder ticks, que es un defecto que se ve
// como «la criatura se mueve a los saltos» y no como «el mapa es grande».

import { CELDA } from '@anima/dibujo'
import type { RadioDeEscena } from '@anima/world'

/**
 * EL TOPE DE CELDAS DIBUJABLES, a 0,014 ms cada una: unos 9,6 ms de suelo.
 *
 * Es la mitad larga del techo de 16 ms y deja el resto para los cuerpos y para
 * el propio navegador. No muerde nunca en el caso normal —a zoom ×2 son 37×19
 * celdas, o sea un mapa de 2072 px de ancho, más que cualquier pantalla— así que
 * lo único que hace es que el ×1 en un monitor enorme no se lleve el tick puesto.
 */
export const TOPE_DE_CELDAS = 700

/**
 * Y UN PISO, porque una ventana chica no puede dejar a la criatura sin contexto.
 *
 * Con radio 4 se ven las nueve celdas de alrededor más un anillo: alcanza para
 * entender qué está haciendo. Por debajo de esto el encuadre deja de achicarse y
 * el que achica pasa a ser el navegador, con el `max-width: 100%` del canvas —o
 * sea que el mapa se ve más chico, no más pobre.
 */
export const RADIO_MINIMO = 4

/** El lugar que hay para el mapa, en píxeles de pantalla. */
export interface Espacio {
  readonly ancho: number
  readonly alto: number
}

/** Cuántas celdas son `(2r+1)` por `(2r+1)`. */
function cuantasCeldas(r: RadioDeEscena): number {
  return (2 * r.x + 1) * (2 * r.y + 1)
}

/**
 * EL ENCUADRE QUE ENTRA EN `espacio` a este `zoom`.
 *
 * Una celda ocupa `CELDA × zoom` píxeles en pantalla —el agrandado lo hace CSS,
 * ver `lienzo.ts`—, así que cuántas entran es una división. De ahí sale el radio
 * restando el centro y partiendo en dos: con 27 celdas de ancho, el foco tiene
 * trece a cada lado.
 *
 * ─── POR QUÉ EL NÚMERO DE CELDAS SE FUERZA IMPAR ───────────────────────────
 *
 * Porque la escena se define por un CENTRO y un radio, no por una esquina y un
 * tamaño. Con 28 celdas de ancho no hay forma de poner el foco en el medio: la
 * criatura quedaría media celda corrida, y esa media celda es la que hace que
 * «lo que tengo al lado» no coincida con lo que se dibuja al lado. Se descarta
 * la celda sobrante, que en pantalla son 28 píxeles de nada.
 */
export function encuadrePara(espacio: Espacio, zoom: number): RadioDeEscena {
  const enCeldas = (px: number): number => {
    const entran = Math.floor(px / (CELDA * zoom))
    return Math.max(RADIO_MINIMO, Math.floor((entran - 1) / 2))
  }
  let r: RadioDeEscena = { x: enCeldas(espacio.ancho), y: enCeldas(espacio.alto) }
  if (cuantasCeldas(r) <= TOPE_DE_CELDAS) return r

  // ─── ACHICAR SIN DEFORMAR, y después ajustar ────────────────────────────
  //
  // Primero se escala por la raíz del exceso, que es lo que mantiene la FORMA:
  // un encuadre apaisado que se pase del tope tiene que seguir siendo apaisado,
  // porque la forma es todo el punto de este archivo. Recortar el lado más largo
  // hasta entrar lo llevaría al cuadrado, que es lo que se vino a arreglar.
  //
  // La raíz deja un sobrante de un par de celdas por el redondeo, y ahí sí el
  // bucle recorta el lado más largo. Son dos o tres vueltas, no un barrido: sin
  // la raíz previa, una pantalla 4K en ×1 pediría nueve mil celdas y este bucle
  // daría miles de vueltas por cada `resize`.
  const factor = Math.sqrt(TOPE_DE_CELDAS / cuantasCeldas(r))
  r = {
    x: Math.max(RADIO_MINIMO, Math.floor(r.x * factor)),
    y: Math.max(RADIO_MINIMO, Math.floor(r.y * factor)),
  }
  while (cuantasCeldas(r) > TOPE_DE_CELDAS && (r.x > RADIO_MINIMO || r.y > RADIO_MINIMO)) {
    r = r.x >= r.y && r.x > RADIO_MINIMO ? { x: r.x - 1, y: r.y } : { x: r.x, y: r.y - 1 }
  }
  return r
}
