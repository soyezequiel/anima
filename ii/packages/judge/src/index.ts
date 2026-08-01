/**
 * `@anima/judge` — el juez del Hito 7.
 *
 * Decide si una habilidad recién escrita **es estable o tuvo suerte**,
 * corriéndola en mundos que ella no vio.
 *
 * OJO CON EL NOMBRE: `@anima/emergencia` NO es este paquete. Ése mira una
 * partida entera y dice si la criatura resolvió el hambre sin que nadie se lo
 * pidiera (criterio 6 del Hito 5). Se llamaba `@anima/juez` hasta el tramo A de
 * este hito, y se renombró justamente para que estos dos no se confundan.
 *
 * El criterio entero, con sus siete puntos y las cinco mediciones que le dieron
 * forma, está en `ii/docs/hito-7-el-juez.md`.
 */

export * from './tipos.js'
export * from './sintetizar.js'
export * from './banco.js'
export * from './escena.js'
export * from './ablacion.js'
export * from './juzgar.js'
export * from './dispositivo.js'
export * from './panel.js'
