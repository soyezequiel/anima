# ADR 0009 — Persistencia local, informes de legado y sucesión

Fecha: 2026-07-16 · Estado: aceptada

## Almacenamiento clave-valor plano, no IndexedDB (por ahora)

El estado completo de una sesión (mundo + skills + regresiones + memoria +
objetivos + eventos del agente) pesa decenas de KB: `localStorage` detrás de
una interfaz `KeyValueStore` asíncrona es suficiente y trivial de probar
(`MemoryKeyValueStore`). La interfaz ya es asíncrona para que migrar a
IndexedDB o al backend (Fase 8) no cambie ningún consumidor.

## Qué se persiste y qué no

Se persiste: snapshot del mundo, biblioteca de skills, regresiones, memoria,
objetivos, controlador de progreso, historial de eventos del agente, identidad
(nombre/generación/linaje) y estado de UI (chat, color). **No** se persiste la
actividad en curso (una `SkillExecution` a medio ejecutar): al restaurar, el
agente replanifica desde su memoria y objetivos. Es más simple y más honesto:
una criatura que despierta retoma sus metas, no su músculo a mitad de paso.

## El legado es testimonio, no memoria

Al morir se genera un `LegacyReport` (causa con certeza, estado final, últimas
acciones, conocimiento, hipótesis abiertas, recomendaciones, advertencias,
proyectos inconclusos, mensaje, artefactos de skills estables). La sucesora
(generación+1, linaje enlazado por `ancestorId`) **no hereda hechos**:

- El conocimiento entra como hipótesis "según <antecesora>, ..." con
  confianza limitada (≤0.65). Puede confirmarlas con su propia evidencia
  (pasan a hechos) o verlas morir sin verificar.
- Las skills entran como candidatas experimentales y pasan por el mismo
  evaluador determinista antes de promoverse en su propio mundo.

Verificado en pruebas: una sucesora con testimonio + skill re-verificada
completa su primer ciclo de hambre con **cero** consultas al modelo.

## Muerte forzada como herramienta de desarrollo

`session.devKill()` (botón 💀 del panel Dev) colapsa energía y salud para
observar el flujo muerte→legado→sucesión sin esperar la inanición real. Es
la única mutación del mundo que la UI puede provocar, está confinada al modo
desarrollador y queda registrada en el log de eventos como `dev.kill`.
