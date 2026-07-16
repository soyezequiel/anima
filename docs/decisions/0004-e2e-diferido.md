# ADR 0004 — Playwright diferido a la Fase 6; la historia E2E corre en Vitest

Fecha: 2026-07-16 · Estado: aceptada

## Contexto

El plan pedía configurar Playwright en la Fase 1, pero `apps/web` no existirá
hasta la Fase 6 y el primer hito es explícitamente headless.

## Decisión

- La prueba de extremo a extremo de la demo completa
  (`apps/demo/tests/milestone.test.ts`) se ejecuta con Vitest: recorre la
  historia entera sobre el motor real, el runtime real, el evaluador real y el
  agente real, sin mocks internos.
- `pnpm test:e2e` queda reservado; al crear `apps/web` se añadirá
  `@playwright/test` con una spec que reproduzca la misma historia a través de
  la UI (los browsers de Playwright se instalan recién entonces).

## Consecuencias

Sin dependencia pesada de navegadores en CI mientras no hay UI. El criterio de
aceptación "demo completa con prueba E2E" queda cubierto en su variante
headless y se ampliará a UI en la Fase 6.
