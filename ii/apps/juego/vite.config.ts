import { defineConfig } from 'vite'

// El juego importa nueve paquetes del workspace en TypeScript crudo. Vite los
// resuelve por el `exports` de cada `package.json`, que apunta a `src/index.ts`:
// no hay build intermedio y no lo va a haber — el proyecto compila una sola vez,
// al final.
export default defineConfig({
  server: { port: 5170, strictPort: true },
})
