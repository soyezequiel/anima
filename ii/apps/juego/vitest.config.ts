import { defineConfig } from 'vitest/config'

/**
 * VITEST NO MIRA `e2e/`, y hay que decirlo explícito.
 *
 * Los dos corredores buscan `*.spec.ts` y `*.test.ts` por omisión, así que sin
 * esto `pnpm test` levanta los specs de Playwright, no encuentra su runtime y
 * falla con un error que no habla de lo que pasa.
 *
 * La división es: `tests/` es vitest —lógica, sin navegador— y `e2e/` es
 * Playwright, con `pnpm test:e2e`.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
