// ─── LO ÚNICO QUE EL JUEGO TOMA DEL ENTORNO DE CONSTRUCCIÓN ────────────────
//
// Vite trae sus tipos en `vite/client`, pero el tsconfig de acá declara
// `"types": []` a propósito: en Ánima II el compilador es parte del arnés y un
// paquete de tipos globales entero mete mucho más de lo que se usa. Se declara
// lo justo, y así lo que el juego lee del entorno cabe en una pantalla.

interface ImportMetaEnv {
  /**
   * Raíz del depósito de sprites. Ausente vale el default de desarrollo
   * (`http://localhost:5190`); servido en un dominio va una ruta del mismo
   * origen, porque `localhost` sería el del visitante. Ver `main.ts`.
   */
  readonly VITE_DEPOSITO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
