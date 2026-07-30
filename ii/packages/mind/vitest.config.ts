// La única configuración de vitest de `@anima/mind`, y es de UNA cosa.
//
// `tests/el-cuadro-global.ts` borra el cuaderno en disco con el que los cinco
// pedazos de `hito-5-el-criterio` se pasan lo que midieron. Tiene que correr en el
// proceso principal y antes de que arranque cualquier worker, y `globalSetup` es el
// único gancho de vitest que garantiza las dos cosas. El porqué del cuaderno entero
// está en `tests/el-cuadro.ts`.
//
// Todo lo demás queda en los valores por defecto A PROPÓSITO: el paralelismo por
// archivo, el pool de forks y el aislamiento de módulos son justamente lo que hace
// que partir un archivo sirva para algo.

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: ['./tests/el-cuadro-global.ts'],
  },
})
