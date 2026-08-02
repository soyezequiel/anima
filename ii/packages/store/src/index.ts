// ─── @anima/store ────────────────────────────────────────────────────────────
//
// GUARDAR Y VOLVER. El Hito 10, punto 4: cerrar la pestaña a mitad de una obra
// y reabrirla sin perder el mundo, con la habilidad convergiendo al mismo
// resultado.
//
//   deposito   dónde se guarda. Una interfaz de cuatro métodos y una
//              implementación en memoria; IndexedDB es un adaptador de afuera.
//   guardar    QUÉ se guarda —el mundo, las creencias— y qué NO: la actividad
//              en vuelo, que no se serializa y se replanifica al cargar.
//
// Es el primer paquete de `ii/` donde `await` es legal, y el porqué está entero
// en el encabezado de `deposito.ts`: la regla 2 protege al TICK, y guardar no
// pasa por el tick.

export { enMemoria, loQueNoAguanta, type Deposito } from './deposito.js'
export {
  cargar,
  claveDe,
  comoSeGuarda,
  comoSeRestaura,
  guardar,
  VERSION_DEL_GUARDADO,
  type Guardado,
} from './guardar.js'
