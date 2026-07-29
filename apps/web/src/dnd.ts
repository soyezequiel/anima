/**
 * MIME propio del arrastre de un tipo de objeto del catálogo (ItemsPanel) al
 * tablero (PhaserStage). Un tipo propio, y no `text/plain`, para que el tablero
 * solo reaccione a nuestros arrastres y no a texto suelto o archivos.
 */
export const DND_ITEM_KIND = 'application/x-anima-kind';

/**
 * MIME del arrastre inverso: un EJEMPLAR del tablero hacia el tacho. Va
 * aparte del anterior porque son dos gestos distintos —uno trae un TIPO al
 * mundo, el otro se lleva UNA cosa— y cada zona tiene que poder ignorar el
 * arrastre que no es suyo: el tablero no acepta que le suelten un ejemplar
 * encima, y el tacho no acepta que le suelten un tipo del catálogo.
 *
 * Viaja el id del ejemplar, no la celda: entre agarrar y soltar el mundo
 * sigue andando y lo agarrado puede haberse movido.
 */
export const DND_MAP_ENTITY = 'application/x-anima-entity';
