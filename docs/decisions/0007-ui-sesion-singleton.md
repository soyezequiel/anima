# ADR 0007 — Capa de sesión en la web: singleton, view model y configs separadas

Fecha: 2026-07-16 · Estado: aceptada

## GameSession como frontera única

Toda la lógica de "correr la simulación en el navegador" (loop con pausa y
velocidad, chat, reset por semilla) vive en `GameSession`, una clase sin React
ni Phaser que produce un `GameView` inmutable por tick. React se suscribe con
`useSyncExternalStore`; Phaser recibe el view y anima diferencias. Ninguno de
los dos toca `WorldState` ni el agente: la UI no puede duplicar reglas del
mundo. La sesión se prueba en Vitest sin navegador.

## Una sesión por carga de página (módulo, no useMemo)

`StrictMode` de React monta dos veces: crear la sesión en `useMemo` producía
dos sesiones (una con timer huérfano) y el cleanup de `useEffect` la
destruía definitivamente. La sesión se crea a nivel de módulo desde los
parámetros de la URL (`?seed&speed&autostart`), que además es lo que el E2E
necesita para ser determinista.

## vite.config.ts y vitest.config.ts separados

Vitest 3 empaqueta Vite 6 mientras la app usa Vite 7: mezclar
`@vitejs/plugin-react` (tipado contra Vite 7) dentro de la config de Vitest
rompía el typecheck. Las pruebas de la capa de sesión no montan React, así que
su config no necesita el plugin. Cuando Vitest 4 esté alineado con Vite 7 en
todo el monorepo, pueden unificarse.
