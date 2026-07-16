import { defineConfig } from 'vitest/config';

// Config exclusiva para sondas manuales contra servicios reales.
export default defineConfig({
  test: {
    include: ['probe-*.test.ts'],
  },
});
