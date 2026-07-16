# ADR 0005 — Percepción construida en sim-core; distancia Manhattan

Fecha: 2026-07-16 · Estado: aceptada

## Contexto

La percepción es conceptualmente del agente, pero construirla exige consultar
el estado del mundo, y tanto `skill-runtime` como `agent-core` la necesitan.

## Decisión

1. `buildPerception(world, agentId)` vive en `sim-core` como "vista limitada
   del mundo". El agente y el runtime solo consumen el tipo `Perception`;
   ninguno toca `WorldState`. Evita duplicar la construcción o crear una
   dependencia agente→runtime.
2. `PerceivedEntity.distance` usa **Manhattan** (pasos reales en una grilla de
   4 direcciones), mientras la **adyacencia** de interacción usa Chebyshev
   (incluye diagonales). Motivo práctico observado en pruebas: con Chebyshev,
   las cinco secciones de un muro vertical empatan en distancia y `nearest`
   elige una esquina arbitraria; con Manhattan, la sección realmente
   interpuesta en el camino es la más cercana, que es lo que "cerca" significa
   para un agente que camina en 4 direcciones.

## Consecuencias

El movimiento greedy sin pathfinding sigue siendo deliberadamente tonto (se
bloquea ante muros): eso es parte de la historia del MVP. Un pathfinding real
podría ser una habilidad aprendible futura, no un regalo del motor.
