// ─── @anima/perceive ─────────────────────────────────────────────────────────
//
// LA COSTURA entre `@anima/world` y `@anima/skills`.
//
// Los dos paquetes existían y estaban verdes, y entre ellos no había nada:
// nadie construía un `Ctx` en producción, `BodyView`/`SelfView`/`PerceptionView`
// no tenían productor, `stepWorld` devolvía `{state, events}` y una habilidad
// esperaba un `StepResult`, `explore` estaba partido en dos mitades y ninguna
// entera, y no había bucle de reloj. La única implementación de la superficie
// era `skills/tests/mundito.ts`, declarado juguete en su propio encabezado.
//
// Cinco piezas y ninguna más:
//
//   indice     el índice de UN tick, compartido por todas las criaturas: de celda
//              a cuerpos, el mapa de oclusión y la celda que ven las leyes. Es lo
//              que hace que `see()` no sea O(cuerpos del mundo).
//   vista      `BodyView` / `SelfView` proyectados desde `WorldState`. Congela el
//              `Placement` del mundo, que es lo que cierra el agujero 2 del
//              ataque al sandbox sin clonar una celda por cuerpo y por tick.
//   contexto   el `WorldCtx` de producción, con `tick`, `clock` y `self` como
//              GETTERS: la vista se refresca EN SU LUGAR, que es el contrato que
//              `skills/src/ejecutor.ts` escribió y nadie cumplía.
//   puente     evento → `StepResult`. La correlación la hace `desenlaceDe` del
//              mundo; la traducción a las seis categorías de la MENTE es de acá.
//   vuelo      la REPETICIÓN: `goTo` hasta llegar, `explore` evaluando `until`
//              con la vista nueva de cada tick, `apply` hasta que el proceso
//              complete. Es la costura más grande que el Hito 4 dejó abierta.
//   bucle      el reloj, con `ticksPerdidos` y su definición escrita.
//
// Regla 1 de `ii/`: nada de acá importa de `packages/` ni de `apps/`. Los cuatro
// paquetes de los que sale todo —`@anima/physics`, `@anima/world`,
// `@anima/oracle`, `@anima/skills`— son todos de `ii/packages/`.

export { IndiceDelTick, RADIO_DE_PERCEPCION, type CeldaVista } from './indice.js'
export { Proyeccion } from './vista.js'
export {
  Contexto,
  CAMPO_UNTIL,
  untilDe,
  type ContextoOptions,
  type Until,
} from './contexto.js'
export { resultado, traducir, type Estado } from './puente.js'
export {
  LibroDeLugares,
  CUANTOS_LUGARES,
  dondeEsta,
} from './lugares.js'
export {
  Vuelo,
  HOLGURA_DE_VIAJE,
  PISO_DE_VIAJE,
  MARGEN_DE_PROCESO,
  MARGEN_DE_ESPERA,
  type VueloOptions,
} from './vuelo.js'
export { Partida, type Informe, type PartidaOptions, type RelojDePared } from './bucle.js'
export {
  compararVuelos,
  comoSeLee,
  hashTrace,
  porQueDivergen,
  type Divergencia,
  type VueloAnotado,
} from './reejecucion.js'
