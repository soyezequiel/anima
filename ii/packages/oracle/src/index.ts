// ─── @anima/oracle ───────────────────────────────────────────────────────────
//
// EL DIOS PEREZOSO. El mundo no existe hasta que alguien mira, y una vez que
// miró, el mundo no se desdice.
//
// Tres agentes escribieron este paquete en paralelo y esto es la puerta que los
// junta. `export *` y no una lista curada a mano, por la misma razón que la usa
// `@anima/world`: una lista de re-exportaciones mantenida a mano diverge de los
// módulos y nadie se entera hasta que algo que existe «no se puede importar» —el
// bug de `DSL_REFERENCE` de Ánima I con otra ropa.
//
// Y `export *` tiene acá una virtud que vale más que la comodidad: **si dos
// módulos exportan el mismo nombre, `tsc` lo dice**. Con tres autores en
// paralelo eso no es una hipótesis: `ley.ts` exporta `Suelta` (lo que el dios
// deja tirado: sustancia, celda y masa) y `resolubilidad.ts` tuvo que llamar
// `SueltaSembrable` a lo suyo (sustancia, forma, masa y punto) porque si no,
// este archivo no compilaba. La colisión era invisible sin él.
//
// El orden es el de las capas, de la pregunta hacia arriba: una pregunta no sabe
// qué es un bioma, un bioma no sabe qué es un chunk, el libro no sabe qué es el
// agua, y la extracción no sabe cómo se decretó nada de eso.

// ─── Nivel 0: qué se pregunta, y con qué dado ───────────────────────────────
//
// `Seed`, `Question`, `keyOf`, los dos dados nominales (`DiosRng` y `WorldRng`)
// y las formas de sacarle valores exactos al del dios.
export * from './pregunta.js'

// ─── Nivel 1: la ley ────────────────────────────────────────────────────────
//
// El campo de clima, la tabla de biomas y el decreto entero de un chunk, con los
// stocks de integración perezosa. Contesta el 99% de las preguntas en ~0 ms y es
// una función pura de `(seed, cx, cy)`.
export * from './bioma.js'
export * from './ley.js'

// ─── El libro: lo que se dijo una vez se sostiene ───────────────────────────
//
// El ledger con sus dos granos, y la granularidad del compromiso —el agua en
// componentes conexas, con los tres casos de la fusión de lagos—.
export * from './ledger.js'
export * from './compromiso.js'

// ─── Que el mundo decretado se pueda jugar, y sacarle algo ──────────────────
//
// La garantía de co-presencia en radio 2 (juzgada con `cumpleRol` de la física,
// no con una tabla de recetas) y la extracción, que es el único lugar del
// paquete donde se tira el dado del MUNDO.
export * from './resolubilidad.js'
export * from './extraccion.js'

// ─── La costura: decretar un chunk y dejarlo jugable ────────────────────────
//
// `decretarChunk` es la única función que llama a la garantía sobre un chunk de
// verdad. Sin ella, `resolveChunk` y `ensureSolvable` eran dos piezas correctas
// que no se llamaban, y el criterio (f) del Hito 3 estaba verificado sobre un
// chunk de test y no sobre el mundo. Va al final porque depende de las dos.
export * from './decreto.js'
