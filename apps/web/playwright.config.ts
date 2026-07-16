import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
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
