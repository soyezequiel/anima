// ─── LOS SPRITES DE FÁBRICA ─────────────────────────────────────────────────
//
// Dibujos que vienen con el juego, no del modelo. Hoy hay uno solo y es el que
// más importa.
//
// ─── POR QUÉ LA CRIATURA NO SE LE PIDE A NADIE ─────────────────────────────
//
// Por tres razones que se acumulan, y la tercera sola ya alcanzaría:
//
//   1. **es UNA clave.** Las otras 539 se reparten entre partidas y cada una se
//      ve un rato; a la criatura el jugador la mira el 100% del tiempo que juega;
//   2. **es el personaje.** Que el protagonista dependa de lo que conteste un
//      modelo esa vez es la única parte del sistema donde el fallback procedural
//      no alcanza: un terrón de carne no es «una versión menos linda» del
//      personaje, es la ausencia del personaje. El usuario lo dijo en esos
//      términos — «parece una roca, eso está mal»;
//   3. **medido: no salió.** Se le pidió a Codex con el prompt bueno y tardó
//      4 minutos 55 para devolver algo que la puerta rechazó (52% de sombra
//      contra un techo de 50). Una figura con brazos y piernas de cuatro celdas
//      es casi todo contorno, así que roza el límite por construcción.
//
// Lo que NO cambia: pasa por la misma puerta que todo lo demás, y hay un test
// que lo afirma. Un dibujo de fábrica mal hecho sería peor que uno del modelo,
// porque nadie lo estaría mirando con desconfianza.
//
// ─── Y ESTO NO PISA AL DEPÓSITO ────────────────────────────────────────────
//
// Las semillas se cargan primero, así que si alguien dibuja una criatura mejor y
// la sube, **la de fábrica gana igual** por «primero gana». Es a propósito: el
// personaje es una decisión de producto, no una carrera. El día que haya una
// mejor, se reemplaza acá.

import type { Sprite } from './sprite.js'
import { claveDeCriatura } from './sprite.js'

/**
 * LA CRIATURA, de pie y de frente.
 *
 * ─── QUÉ LA SACA DE SER UN TERRÓN, y es lo único que importa del dibujo ────
 *
 * Los HUECOS. No el color, no la textura: el cuello entre la cabeza y el torso,
 * el aire entre cada brazo y el costado, el hueco entre las dos piernas, y las
 * dos celdas de sombra de la cara. Un bulto con patas pintadas encima sigue
 * siendo un bulto — los huecos tienen que ser `0` de verdad, dejando ver el
 * suelo.
 *
 * Cumple las cuatro reglas de la puerta: una sola pieza conexa, ningún `3`
 * tocando el vacío, caja de 23×20 sobre 24, y la luz de arriba a la izquierda.
 * El 46% de sombra es alto y es honesto: los miembros miden cuatro celdas, así
 * que casi todo es contorno. Ésa es la regla del dibujo, no una falla suya.
 *
 * ─── UNA CONVENCIÓN QUE CONVIENE SABER QUE ES UNA CONVENCIÓN ───────────────
 *
 * «De pie y de frente» **no sale de la física**. El mapa es cenital y esto es
 * un personaje visto de frente, que es lo que hacen Ánima I y casi todo el
 * género. Cambiarlo después cuesta invalidar el caché compartido, así que queda
 * dicho acá antes de que se acumulen sprites encima.
 */
const LA_CRIATURA: readonly string[] = [
  '000000000000000000000000',
  '000000000222222000000000',
  '000000002333333200000000',
  '000000002311111200000000',
  '000000002312121200000000',
  '000000002311111200000000',
  '000000000223122000000000',
  '000000000002200000000000',
  '000000222223322222000000',
  '000222233331133332222000',
  '002332023111111120233200',
  '002312023111111120231200',
  '002312023111111120231200',
  '002312023111111120231200',
  '002312023111111120231200',
  '000222023111111120222000',
  '000000023112231120000000',
  '000000023120023120000000',
  '000000023120023120000000',
  '000000023120023120000000',
  '000000023120023120000000',
  '000000023120023120000000',
  '000000231120023132000000',
  '000000222220022222000000',
]

/**
 * LO QUE VIENE CON EL JUEGO. Hoy, la criatura de carne.
 *
 * La sustancia está en la clave porque una criatura de carne y una de otra
 * materia son criaturas distintas, y el mundo permite las dos. Si aparece una
 * criatura de otra cosa, cae al procedural hasta que alguien la dibuje — que es
 * el comportamiento correcto y no un hueco.
 */
export const DE_FABRICA: readonly Sprite[] = [
  { clave: claveDeCriatura('carne', 24), lado: 24, filas: LA_CRIATURA },
]
