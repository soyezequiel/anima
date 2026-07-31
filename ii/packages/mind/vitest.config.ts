// La única configuración de vitest de `@anima/mind`, y es de UNA cosa.
//
// `tests/el-cuadro-global.ts` borra el cuaderno en disco con el que los cinco
// pedazos de `hito-5-el-criterio` se pasan lo que midieron. Tiene que correr en el
// proceso principal y antes de que arranque cualquier worker, y `globalSetup` es el
// único gancho de vitest que garantiza las dos cosas. El porqué del cuaderno entero
// está en `tests/el-cuadro.ts`.
//
// Todo lo demás queda en lo que dice `ii/vitest.base.ts` A PROPÓSITO: el paralelismo por
// archivo, el pool de forks y el aislamiento de módulos son justamente lo que hace
// que partir un archivo sirva para algo.

import { defineConfig, mergeConfig } from 'vitest/config'

import base from '../../vitest.base.js'

// Se MEZCLA con la compartida y no la reemplaza: de allá viene la paciencia
// del arnés, que este archivo no tiene por qué volver a decidir.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      globalSetup: ['./tests/el-cuadro-global.ts'],
    },
  }),
)
