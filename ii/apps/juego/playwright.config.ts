import { defineConfig } from '@playwright/test'

/**
 * ─── LAS NUEVE, EN UN NAVEGADOR DE VERDAD ─────────────────────────────────
 *
 * La vertical del Hito 12B tiene nueve puntos y todos se verificaron a mano
 * mientras se construían. **A mano no se repite en CI**, y ése es el único
 * motivo de este archivo: lo que sostiene «el hito está cerrado» tiene que poder
 * correr solo.
 *
 * ─── UN SOLO WORKER, Y NO ES PEREZA ────────────────────────────────────────
 *
 * Ánima I corre con tres y lo justifica al revés: allá el paralelismo hay que
 * limitarlo porque cada mundo cuesta CPU. Acá el problema es otro y es más
 * duro: **el mundo avanza con `requestAnimationFrame`**, o sea que una pestaña
 * que el navegador considera oculta NO avanza un solo tick. Con varios workers,
 * las pestañas de fondo se quedan clavadas y los specs que esperan movimiento
 * vencen sin que nada esté roto.
 *
 * Se descubrió a mano, mirando: el tick quedaba en 0 con `visibilityState:
 * 'hidden'` y todo lo demás sano.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5170',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5170',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
