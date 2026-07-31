// ─── @anima/plan ─────────────────────────────────────────────────────────────
//
// DE OBJETIVO A SUB-OBJETIVOS. El requisito 6, que ninguna de las tres
// propuestas del corpus tenía y que el repo de Ánima I sí tiene (ADR 0053, 0082,
// 0083, 0085): tirarlo sin reemplazo era una regresión, así que acá está.
//
// Cinco módulos:
//
//   predicado    parsear e interpretar un `establishes`, y decidir si el mundo lo
//                cumple. Llama a `evalQuality`/`qualityOf` del motor en vez de
//                transcribir la fórmula, que es la regla que dejó el adversario
//                de las secuencias de emergencia.
//   referencias  resolver un `Ref` contra la vista de HOY. Vive acá y no en la
//                mente porque el planificador también necesita saber si lo que
//                pide existe («veo un matorral fibroso a 2 celdas ✓»), y dos
//                implementaciones de la misma resolución divergen.
//   esquemas     `SCHEMA_INDEX`: qué proceso establece qué, escrito a mano porque
//                no se puede derivar, y VERIFICADO contra el mundo real porque un
//                esquema sin verificar es una tabla de recetas con pasos de más.
//   objetivos    `goalGraph()`: descomposición conjuntiva, orden parcial y
//                ligaduras diferidas.
//   regresion    `plan()` anytime: encadenado hacia atrás sobre el índice, con
//                frontera guardada entre ticks y `gap` cuando no hay camino.
//
// Regla 1 de `ii/`: nada de acá importa de `packages/` ni de `apps/`.

export type {
  Comparador,
  ConstructionSchema,
  EsquemaComun,
  EsquemaDeLey,
  EsquemaDeProceso,
  Frontera,
  GoalId,
  GoalNode,
  MarcoDePlan,
  MarcoPor,
  NodoAbierto,
  OpcionesDePlan,
  PedidoDeRol,
  PlanResult,
  Predicado,
  PredicateSignature,
  RamaMuerta,
  Ref,
  RoleName,
  Step,
  VistaDelPlan,
} from './tipos.js'
export { EXPANSIONES_POR_TICK, PROFUNDIDAD_MAXIMA } from './tipos.js'

export { firmaDe, implica, interpretar, cumple, cumpleCuerpo, textoDe } from './predicado.js'
export { resolver, resolverCuerpo, resolverTodos, type Resuelto, type Rindes } from './referencias.js'
export {
  AGUA_FRANCA,
  FIRMA_DE_LO_COCIDO,
  POTENCIA_QUE_COCINA_LO_CARNOSO,
  SEGUNDOS_DE_COCCION,
  SCHEMA_INDEX,
  ESQUEMAS,
  claveDeVia,
  esquemasPara,
  procesoDe,
} from './esquemas.js'
// El catálogo como VISTA, que es la puerta del Gate 5→6: core inmutable más el
// overlay de la sesión, con identidad. Sale del paquete porque lo que tiene que
// dejar de leer `SCHEMA_INDEX` es `@anima/mind`, y para eso necesita con qué.
export {
  CATALOGO_CORE,
  capacidadDe,
  catalogoDe,
  conOverlay,
  esquemasDe,
  pedidosDelPlano,
  type CatalogCapability,
  type PlannerCatalogView,
  type Publicada,
} from './catalogo.js'
// El catálogo de una partida SALE DE LA CRÓNICA (punto 10 del gate): una sola
// lista append-only con dos lectores, `stepWorld` para el mundo y `catalogoHasta`
// para el catálogo. Sale del paquete porque quien tiene el journal en la mano es
// `@anima/mind`, que está arriba de los dos.
export {
  catalogoDeLaCronica,
  catalogoHasta,
  esRegistro,
  registrar,
  sinRegistros,
  type RegistroDeCatalogo,
  type RenglonDeCronica,
} from './cronica.js'
export { goalGraph, orden, type Lectura } from './objetivos.js'
// `pasoYaEstaHecho` sale del paquete a propósito, y no es un detalle interno que
// se escapó: la mente necesita hacerse LA MISMA pregunta en el momento de
// despegar —un plan de hace veinte ticks puede tener el frente ya cumplido sin
// que nadie lo haya planificado así— y dos escrituras de «este paso ya está
// dado» divergirían el día que se agregue un `Step`. Ver el bloque
// `sinLoQueYaEstaHecho` de `regresion.ts` para el porqué medido.
export { pasoYaEstaHecho, plan } from './regresion.js'
