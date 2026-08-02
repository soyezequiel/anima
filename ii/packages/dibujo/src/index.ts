// ─── @anima/dibujo ──────────────────────────────────────────────────────────
//
// LA CAPA DE PRESENTACIÓN del Hito 12: de lo que el mundo publica, a lo que se
// ve. Es el único paquete de `ii/` que tiene derecho a hablar de colores.
//
// La frontera con el mundo es la que fija el [ADR II-0017]: `@anima/world`
// publica un `RenderDescriptor` —forma, materiales, núcleo, partes, juntas,
// atadores, estado, porte— y **no publica una sola cosa cosmética**, porque
// todo eso entra a `renderDescriptorHash` y dos clientes con distinto idioma o
// distinta paleta tienen que seguir coincidiendo. Lo cosmético empieza acá.
//
// Dicho al revés, que es como se entiende: **cambiar la paleta de este paquete
// no puede mover ningún hash del mundo.** Si algún día lo mueve, la frontera se
// rompió.

export { PALETAS, aspectoDe, familiaDe, tramaDe } from './paleta.js'
export type { Familia, Paleta, Trama } from './paleta.js'
export { FORMAS, siluetaDe } from './forma.js'
export type { Mascara } from './forma.js'
export { celdasDistintas, glifoDe, pintar } from './componer.js'
export type { Capa, Glifo } from './componer.js'
export { CONTRASTE_MINIMO, SUELOS, contraste, fondoDe, luma, mezclar, sueloDe } from './mundo.js'
export type { CeldaVisible, Suelo } from './mundo.js'
export { CELDA, mapaDe } from './mapa.js'
export type { Pintado } from './mapa.js'
export { DE_FABRICA } from './semillas.js'
export {
  LADO_NATIVO,
  MEDIDAS_QUE_SE_USAN,
  claveDeCriatura,
  claveDePieza,
  esDeCriatura,
  mascaraDe,
  revisarSprite,
  spritesEnMemoria,
} from './sprite.js'
export type { ClaveDeSprite, Sprite, Sprites, Veredicto } from './sprite.js'
export { encargoDe, encargoDePieza, loQueHayQuePedir, partirClave, recibir, revisarRespuesta } from './pedido.js'
export type { Encargo } from './pedido.js'
export { cargarDeposito, surtir } from './surtidor.js'
export type { ComoSurtir, DepositoRemoto, Proveedor, Resultado } from './surtidor.js'
export { depositoHttp } from './deposito-http.js'
