// ─── @anima/world ────────────────────────────────────────────────────────────
//
// EL MUNDO DETERMINISTA. El árbitro: dice qué es posible y no negocia.
//
// El paquete lo escribieron tres agentes en paralelo y esto es la puerta que los
// junta. `export *` y no una lista curada a mano, por la misma razón que
// `CELL_FIELDS` sale del catálogo en vez de estar escrita: una lista de
// re-exportaciones mantenida a mano diverge de los módulos y nadie se entera
// hasta que algo que existe «no se puede importar».
//
// Y `export *` tiene una virtud que acá vale más que la comodidad: **si dos
// módulos exportan el mismo nombre, `tsc` lo dice**. Cuando este archivo se
// escribió había una colisión real —`cellKey` estaba en `cell.ts` con orden por
// filas y en `intent.ts` con orden por columnas, las dos sobre el mismo mundo de
// ±2²⁰— o sea DOS formas canónicas de la misma cosa en el mismo paquete, que es
// la semilla exacta de una divergencia de hash. Sin este archivo la colisión era
// invisible; con él, no compilaba. Quedó la de `cell.ts`.
//
// El orden de abajo es el de las capas, de la geometría hacia arriba: una celda
// no sabe qué es un chunk, un chunk no sabe qué es la grilla, la grilla no sabe
// qué es una intención, y el hash no sabe qué es un mundo.

// ─── La geometría y el terreno ──────────────────────────────────────────────
export * from './cell.js'
export * from './chunk.js'
export * from './grid.js'

// ─── Lo que entra al mundo desde afuera, y el paso ──────────────────────────
export * from './intent.js'
export * from './step.js'
export * from './invariants.js'
// El descriptor visual: vista DERIVADA del estado, sin cosmética adentro. Punto
// 11 del Gate 5→6 y ADR II-0017. Sale del paquete porque lo consume la UI del
// Hito 12 y el E2E, que comparan su hash contra el del mundo.
export * from './descriptor.js'
// El día y la noche. Va después del paso porque se DERIVA de él: `relojDe` no
// lee más que el `tick` y el `hz` que `step.ts` declara (ADR II-0009).
export * from './reloj.js'

// ─── La crónica: el hash, el journal y el snapshot por delta ────────────────
export * from './hash.js'
export * from './journal.js'
export * from './snapshot.js'

// ─── La costura con el dios ─────────────────────────────────────────────────
//
// Va antes del puente porque `mundo.ts` y `step.ts` la usan. Es la ÚNICA puerta
// del paquete hacia `@anima/oracle`: el resto del mundo no importa el dios.
export * from './dios.js'

// ─── El puente entre el paso del mundo y la crónica ─────────────────────────
export * from './mundo.js'
