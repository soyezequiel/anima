// ─── QUÉ LE PASA A LA CHARLA CUANDO LA VENTANA CAMBIA DE TAMAÑO ─────────────
//
// Cuatro reglas, y las cuatro son sobre el CRUCE y no sobre el tamaño. Vive
// aparte del bucle por la misma razón que `con-quien.ts`, `criatura.ts` y
// `turnos.ts`: es lo único de esto que decide algo, y así se prueba sin abrir un
// navegador — con una tabla de seis filas en vez de con seis `setViewportSize`.
//
// Del otro lado quedan dos `classList.toggle`.
//
// ─── POR QUÉ NO ES UN `@media` ─────────────────────────────────────────────
//
// Porque un `@media` sabe DÓNDE estás y no DE DÓNDE VENÍS, y las tres primeras
// reglas son exactamente eso. La cuarta ni siquiera es de tamaño.
//
// La consecuencia de fondo: **la misma pantalla de 900 px tiene la charla
// abierta o cerrada según cómo llegaste**. Abrir el juego ahí la deja abierta;
// llegar achicando una ventana grande la cierra. No hay ancho que determine el
// estado, y por eso el estado no puede vivir en una regla de ancho.

/** Lo que hay que saber para decidir. Todo lo demás es pintar. */
export interface ElCambio {
  /** Si la ventana está abajo del umbral AHORA. */
  readonly esAngosto: boolean
  /** Y si lo estaba en la medición anterior. */
  readonly eraAngosto: boolean
  /** Cómo está la charla en este momento. */
  readonly abierta: boolean
  /**
   * SI ÉSTA ES LA PRIMERA MEDICIÓN, que es la regla 1 y no un caso de borde.
   *
   * Sin esta marca, arrancar el juego en un teléfono se leería como un cruce de
   * ancho a angosto —porque `eraAngosto` tendría que arrancar en algo— y la
   * charla saldría cerrada, detrás de un tirador, en la primera pantalla que ve
   * alguien que nunca vio el juego. Y la charla es una de las TRES cosas que
   * quedan con el modo dev apagado.
   */
  readonly primera: boolean
}

/**
 * ¿QUEDA ABIERTA? Las cuatro reglas del cajón, en un solo lugar.
 *
 *   1. la primera medición NO es un cruce: se deja como está (abierta);
 *   2. cruzar de ancho a angosto la CIERRA: de golpe taparía medio mapa, que es
 *      la pantalla principal;
 *   3. cruzar de angosto a ancho la ABRE: ahí no tapa nada, así que esconderla
 *      sería esconder por esconder;
 *   4. sin cruce no pasa nada. Achicar de 1400 a 1100 no la toca, y ése es el
 *      caso que hace que esto tenga que mirar los DOS lados y no sólo el de
 *      ahora: con `if (esAngosto) cerrar`, cada píxel de `resize` abajo del
 *      umbral volvería a cerrar la charla que la persona acaba de abrir.
 */
export function laCharlaQueda(c: ElCambio): boolean {
  if (c.primera) return c.abierta
  if (c.esAngosto === c.eraAngosto) return c.abierta
  return !c.esAngosto
}
