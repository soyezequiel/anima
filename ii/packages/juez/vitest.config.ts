// La única configuración de vitest de `@anima/juez`, y es de UNA cosa.
//
// `tests/el-azar-global.ts` borra lo que las cinco tandas del control del azar se
// pasan por disco. Tiene que correr en el proceso principal y antes de que arranque
// cualquier worker, y `globalSetup` es el único gancho de vitest que garantiza las
// dos cosas. El porqué del reparto entero está en el bloque «EL CONTROL, REPARTIDO
// ENTRE ARCHIVOS» de `tests/azar.ts`.
//
// Todo lo demás queda en los valores por defecto A PROPÓSITO: el paralelismo por
// archivo, el pool de forks y el aislamiento de módulos son justamente lo que hace
// que repartir el control sirva para algo.

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: ['./tests/el-azar-global.ts'],
  },
})
