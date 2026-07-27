// @anima/physics — el único vocabulario cerrado del sistema, y es física, no objetos.
//
// Vacío a propósito. Se llena en el Hito 1, y no antes del Hito 0: si el banco
// de latencia dice que el transformer de combustible cuesta más del 15% o que
// `ts.createProgram` en frío pasa de 3 s, el plan del sandbox cambia ahí, y
// parte de lo que se escriba acá cambia con él.
//
// Lo que va a vivir en este paquete (ver docs/architecture/remake-anima-ii.md,
// «El mundo: materia, propiedades y procesos»):
//
//   quality.ts    QualitySpec, QualityExpr — 4 conservadas, 14 con ley, 8 derivadas
//   substance.ts  Substance — abierta, sin tabla de transiciones
//   body.ts       Body, Part, Joint — un cuerpo no tiene `kind`
//   fixed.ts      aritmética en punto fijo i32 (no `Math.exp`, no `Math.pow`)
//
// Regla de la carpeta: nada de acá importa de `packages/`. Ver ii/README.md.

export {}
