import { defineConfig } from 'vite'

// El banco necesita `typescript` como dependencia del navegador, no como
// herramienta de build: la fragua lo va a cargar en la página igual que acá.
export default defineConfig({
  server: { port: 5180, strictPort: true },
  optimizeDeps: { include: ['typescript'] },
})
