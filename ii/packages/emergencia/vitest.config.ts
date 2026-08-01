// La única configuración de vitest de `@anima/emergencia`, y es de UNA cosa.
//
// `tests/el-azar-global.ts` borra lo que las cinco tandas del control del azar se
// pasan por disco. Tiene que correr en el proceso principal y antes de que arranque
// cualquier worker, y `globalSetup` es el único gancho de vitest que garantiza las
// dos cosas. El porqué del reparto entero está en el bloque «EL CONTROL, REPARTIDO
// ENTRE ARCHIVOS» de `tests/azar.ts`.
//
// Todo lo demás queda en lo que dice `ii/vitest.base.ts` A PROPÓSITO: el paralelismo por
// archivo, el pool de forks y el aislamiento de módulos son justamente lo que hace
// que repartir el control sirva para algo.

import { defineConfig, mergeConfig } from 'vitest/config'

import base from '../../vitest.base.js'

// Se MEZCLA con la compartida y no la reemplaza: de allá viene la paciencia
// del arnés, que este archivo no tiene por qué volver a decidir.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      globalSetup: ['./tests/el-azar-global.ts'],
    },
  }),
)
