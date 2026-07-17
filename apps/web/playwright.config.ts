import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  /**
   * Estas pruebas no esperan por la red: esperan a que una simulación avance,
   * y avanzar cuesta CPU (la mascota piensa, y evaluar una skill corre mundos
   * aislados enteros). Con el paralelismo por defecto los navegadores se
   * quitan CPU entre sí, los ticks tardan más en tiempo real y los timeouts
   * vencen sin que nada esté roto: la suite fallaba en un spec distinto cada
   * corrida. Tres workers dejan aire para que cada mundo avance.
   */
  workers: 3,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @anima/api start',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: true,
      timeout: 60_000,
      env: { ANIMA_DB: ':memory:', PORT: '8787' },
    },
  ],
});
