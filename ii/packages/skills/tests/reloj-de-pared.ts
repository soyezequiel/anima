// ─── LA PUERTA DEL RELOJ DE PARED — Hito 11 · punto 4 ───────────────────────
//
// El porqué entero —por qué un flag nuevo y no `ANIMA_BANCO`, y por qué el
// número no se afloja sino que se muda— está escrito UNA sola vez, en
// `ii/packages/forge/tests/reloj-de-pared.ts`. Acá va sólo la puerta.
//
// Es una COPIA y no un import a propósito: ningún paquete de `ii/` depende de
// otro para sus tests, y dos constantes no justifican estrenar esa dependencia.
// Que las copias no se separen con el tiempo lo vigila
// `forge/tests/los-relojes-que-quedan.test.ts`, que compara las líneas
// `export const` de todas ellas y exige que sean idénticas.
//
//     ANIMA_RELOJ=1 pnpm ii:test     afirma los números de reloj
//     pnpm ii:test                   la suite determinista

/** ¿Estamos midiendo contra el reloj de pared? `ANIMA_RELOJ=1` lo enciende. */
export const CONTRA_EL_RELOJ = process.env['ANIMA_RELOJ'] === '1'

/** Lo que se imprime cuando el número no se afirma, para que el cero no sea mudo. */
export const NO_SE_AFIRMA = '(no se afirma acá: mide contra el reloj de pared · ANIMA_RELOJ=1)'
