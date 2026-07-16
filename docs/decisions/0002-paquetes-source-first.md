# ADR 0002 — Paquetes source-first sin paso de build

Fecha: 2026-07-16 · Estado: aceptada

## Contexto

Monorepo TypeScript interno: ningún paquete se publica a npm.

## Decisión

Los `exports` de cada paquete apuntan directamente a `./src/index.ts`.
Vitest, tsx y (más adelante) Vite consumen TypeScript fuente sin compilación
intermedia. `pnpm build` ejecuta hoy el typecheck del workspace; cuando exista
`apps/web`, `build` producirá el bundle de la aplicación (Vite compila las
fuentes de los paquetes directamente).

## Consecuencias

- Sin `dist/` ni referencias de proyecto que mantener; el feedback es inmediato.
- `verbatimModuleSyntax` + `moduleResolution: bundler` + imports con extensión
  `.js` mantienen compatibilidad si en el futuro hace falta emitir.
- Si algún paquete debe publicarse o consumirse desde Node puro, se le añadirá
  entonces un build con `tsc` y `exports` duales.
