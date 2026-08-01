// ═══ EL CONTROL DEL AZAR · TANDA 3 DE 5 ═══════════════════════════════════
//
// Corre las semillas 12 a 15 de las veinte de §10, para los DOS controles, y las
// deja guardadas en disco. No afirma nada sobre el mundo: es trabajo, no medición.
//
// ─── POR QUÉ ESTE ARCHIVO EXISTE, Y POR QUÉ SON CINCO IGUALES ──────────────
//
// Porque **la unidad de paralelismo de vitest es el archivo**. Los dos controles del
// azar son 40 partidas de 20.000 ticks y costaban 510 de los 536 s del paquete,
// corridas de a una adentro de un solo `it`. Repartidas de a ocho en cinco archivos
// corren a la vez y el paquete pasa a valer lo que vale una tanda.
//
// **No se acortó ni una partida ni un tick, y ningún número cambia**: cada partida
// del control es función pura de su semilla —dado propio, `Physics` nueva por
// llamada— y `resumir()` cuenta filas, así que ni el orden ni el proceso donde se
// corrió pueden mover una cifra. El porqué largo, con los números medidos, está en
// el bloque «EL CONTROL, REPARTIDO ENTRE ARCHIVOS» de `./azar.ts`.
//
// Quien consuma el control (`hito-5-la-emergencia`, `ataque-al-detector`) lee lo que
// estas tandas dejaron y espera lo que falte. Si se corre un consumidor SOLO, sin
// las tandas, corre las veinte él mismo: sale lento, no sale mal.

import { describe, expect, it } from 'vitest'

import { correrLaTanda, loQueLeToca } from './azar.js'

describe('el control del azar · tanda 3 de 5', () => {
  it('corre y guarda las semillas 12–15 de los dos controles', async () => {
    // 4 semillas × 2 controles cuando se mide en serio, y lo que sobre de la
    // muestra corta cuando no: por eso el esperado sale de `loQueLeToca` y no de un
    // 8 clavado. Lo que se afirma es que el trabajo se hizo; el veredicto de cada
    // partida lo leen y lo publican los consumidores.
    expect(await correrLaTanda(12, 4)).toBe(loQueLeToca(12, 4))
  }, 900_000)
})
