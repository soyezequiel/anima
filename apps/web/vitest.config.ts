import { defineConfig } from 'vitest/config';

// Config separada de vite.config.ts: las pruebas de la capa de sesión no
// montan React ni Phaser, así que no necesitan el plugin de React (y evita
// mezclar los tipos de Vite 7 de la app con el Vite interno de Vitest 3).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
