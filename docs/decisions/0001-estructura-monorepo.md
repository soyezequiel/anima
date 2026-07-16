# ADR 0001 — Ajustes a la estructura sugerida del monorepo

Fecha: 2026-07-16 · Estado: aceptada

## Contexto

La estructura sugerida incluía `packages/world-schema` y solo `apps/web` +
`apps/api`.

## Decisión

1. **`world-schema` se pliega en `sim-core` y `shared`**: los componentes del
   mundo son tipos TypeScript planos junto al motor que los interpreta, y la
   validación en runtime con Zod vive donde entran datos no confiables
   (`skill-runtime` para programas; el futuro `api` para payloads). Un paquete
   separado de esquemas sin consumidor real sería una abstracción prematura.
   Si la IA Dios (objetos creados por usuarios) lo justifica, se extraerá
   entonces.
2. **Se añade `apps/demo`**: el hito 1 exige una ejecución de terminal. Es una
   app real (consume todos los paquetes) y quedará como herramienta de
   diagnóstico cuando exista `apps/web`.
3. `apps/web` y `apps/api` se crearán en las Fases 6 y 8 respectivamente, no
   antes, para no cargar esqueletos vacíos.

## Consecuencias

Menos paquetes, dependencias más claras. Riesgo aceptado: si más adelante la
UI necesita tipos del mundo sin querer depender del motor, se evaluará separar
tipos puros (los tipos de `sim-core` no arrastran lógica, así que hoy no es
problema).
