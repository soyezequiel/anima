// ─── UN DIBUJO QUE PASA LA PUERTA, para los tests ───────────────────────────
//
// Antes cada test armaba un aspa —dos diagonales de `3`— y servía porque la
// puerta sólo miraba medida, alfabeto y doce celdas. **Con la puerta nueva el
// aspa no entra**, y está bien que no entre: es todo luz tocando el vacío, que
// es exactamente el defecto que la regla 3 caza.
//
// Lo que se usa ahora no es un dibujo inventado a mano: es **el que produce el
// propio motor**. `siluetaDe` pasa por `contornear()`, así que sale con el
// contorno entero en sombra y la luz una celda adentro — que es la regla que la
// puerta exige, porque la puerta se escribió para que un sprite del modelo
// conviva con los procedurales sin verse iluminado al revés.
//
// Que el dato de prueba salga del motor tiene un efecto que vale más que la
// comodidad: **si algún día el motor y la puerta se separan, estos tests se
// ponen rojos**. Un dibujo escrito a mano acá los dejaría en verde para siempre.

import { siluetaDe } from '../src/forma.js'

/** Un dibujo válido de `lado`×`lado`, con la firma del motor. */
export function dibujoValido(lado = 24): string[] {
  return [...siluetaDe('bloque', lado, { grano: 1, veta: 1 })]
}

/** El mismo, como texto — que es lo que contestaría un modelo. */
export function comoLoContestaUnModelo(lado = 24): string {
  return dibujoValido(lado).join('\n')
}

/**
 * OTRO dibujo válido y DISTINTO del anterior, para los tests que necesitan
 * comparar dos. Cambia el grano, así que cambia la silueta.
 */
export function otroDibujoValido(lado = 24): string[] {
  return [...siluetaDe('bloque', lado, { grano: 2, veta: 2 })]
}
