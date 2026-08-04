import { defineConfig } from 'vite'

// El juego importa nueve paquetes del workspace en TypeScript crudo. Vite los
// resuelve por el `exports` de cada `package.json`, que apunta a `src/index.ts`:
// no hay build intermedio y no lo va a haber — el proyecto compila una sola vez,
// al final.
//
// `base` sale del entorno porque el juego vive en dos lugares: solo en la raíz
// (desarrollo) y colgado de `/v2/` cuando comparte dominio con Ánima I. Es lo
// que hace que los assets se pidan con el prefijo correcto, y el `index.html`
// usa `%BASE_URL%` por lo mismo. Sin esto, un juego servido en `/v2/` pide su
// JavaScript a `/assets/...` y se lo termina contestando Ánima I.
export default defineConfig({
  base: process.env['ANIMA_BASE'] ?? '/',
  server: { port: 5170, strictPort: true },
})
