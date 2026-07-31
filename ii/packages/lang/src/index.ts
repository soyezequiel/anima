// @anima/lang — de una frase en castellano a un objetivo, sin esperar a nadie.
//
//   normalizar.ts  la clave de comparación: minúscula, sin acentos, sin locale
//   tipos.ts       `Lectura`, `Denota`, y la decisión de que leer NUNCA falla
//   lexico.ts      el léxico VIVO, derivado de `Physics`
//   alias.ts       el PUENTE, que es conocimiento humano y por eso vive aparte
//
// Se re-exporta con `export *` y no con una lista a mano, por la misma razón que
// `@anima/physics`: una lista escrita a mano diverge del código en cuanto
// alguien agrega algo, y `tsc` avisa de las colisiones pero no de una lista
// desactualizada.
//
// Regla de la carpeta: nada de acá importa de `packages/` ni de `apps/`.
// Ver ii/README.md.

export * from './normalizar.js'
export * from './tipos.js'
export * from './lexico.js'
export * from './alias.js'
