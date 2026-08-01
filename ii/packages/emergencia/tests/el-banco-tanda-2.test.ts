// ═══ EL BANCO DE LA MENTE · TANDA 2 DE 5 ═════════════════════════════════════
//
// Corre las semillas 8 a 11 de las veinte de §10, para las DOS cohortes —la
// canónica (tanque 310) y el control del tanque lleno (1000)—, y las deja
// guardadas en disco. No afirma nada sobre el mundo: es trabajo, no medición.
//
// Son cinco archivos iguales porque **la unidad de paralelismo de vitest es el
// archivo**: es el mismo reparto que las tandas del control del azar
// (`el-azar-tanda-N.test.ts`), aplicado a las cohortes que quedaban secuenciales
// adentro de `hito-5-la-emergencia.test.ts`. El porqué entero, con la prueba de
// que repartir no puede mover un número, está en `el-banco-de-la-mente.ts`.

import { describe, expect, it } from 'vitest'

import { correrLaTandaDelBanco, loQueLeTocaDelBanco } from './el-banco-de-la-mente.js'

describe('el banco de la mente · tanda 2 de 5', () => {
  it('corre y guarda las semillas 8–11 de las dos cohortes', async () => {
    expect(await correrLaTandaDelBanco(8, 4)).toBe(loQueLeTocaDelBanco(8, 4))
  }, 900_000)
})
