// @anima/physics — el único vocabulario cerrado del sistema, y es física, no objetos.
//
//   fixed.ts       aritmética en punto fijo i32 (no `Math.exp`, no `Math.pow`)
//   quality.ts     el catálogo CERRADO: 4 conservadas, 17 con ley, 8 derivadas
//   substance.ts   `Substance` — abierta, sin tabla de transiciones
//   body.ts        `Body`, `Part`, `Joint` — un cuerpo no tiene `kind`
//   process.ts     los CUATRO procesos aplicables (ADR II-0001)
//   physics.ts     el mundo entero como dato
//   leyes.ts       EL MOTOR: las leyes que corren solas, sin verbo
//   admit.ts       LA PUERTA: las cinco reglas
//   data/          las treinta sustancias semilla
//
// Se re-exporta con `export *` y no con una lista escrita a mano a propósito.
// Una lista a mano diverge del código en cuanto alguien agrega algo y no la
// actualiza — que es exactamente el bug de `DSL_REFERENCE` de Ánima I, una
// referencia mantenida a mano que se separó de la verdad y nadie se enteró hasta
// que el modelo no pudo colocar un bloque. `tsc` avisa de las colisiones; una
// lista desactualizada no avisa de nada.
//
// Regla de la carpeta: nada de acá importa de `packages/` ni de `apps/`. Ver
// ii/README.md.

export * from './fixed.js'
export * from './quality.js'
export * from './substance.js'
export * from './body.js'
export * from './process.js'
export * from './physics.js'
export * from './leyes.js'
export * from './admit.js'
export * from './plano.js'
export * from './data/sustancias.js'
