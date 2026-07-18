/**
 * MIME propio del arrastre de un tipo de objeto del catálogo (ItemsPanel) al
 * tablero (PhaserStage). Un tipo propio, y no `text/plain`, para que el tablero
 * solo reaccione a nuestros arrastres y no a texto suelto o archivos.
 */
export const DND_ITEM_KIND = 'application/x-anima-kind';
