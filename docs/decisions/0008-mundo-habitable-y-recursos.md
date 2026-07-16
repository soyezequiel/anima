# ADR 0008 — Mundo habitable y distinción recurso-vs-capacidad

Fecha: 2026-07-16 · Estado: aceptada

## Contexto

Al dejar correr la simulación en la UI más allá del hito, la mascota agotaba
la única comida del mundo, volvía a tener hambre, y su skill estable fallaba
por `no-candidates` (no había nada que encontrar). El protocolo de escalada
respondía fabricando otra versión de la skill — que pasaba las pruebas de
laboratorio (los escenarios de evaluación sí tienen comida) pero era inútil en
su mundo real. Terminaba muriendo de hambre con una biblioteca duplicada.

## Decisiones

1. **Fuente de alimento** (`foodSource` en sim-core): un árbol produce comida
   en una celda libre adyacente cada N ticks, sin acumular. Regla determinista
   del motor. El primer brote (tick 400) queda fuera del horizonte de
   cualquier evaluación (200 ticks), así que no altera los veredictos.
2. **Recurso ≠ capacidad**: si todas las estrategias prohibidas fallaron con
   `no-candidates`, crear una habilidad no ayuda. El agente salta directo a
   pedir ayuda y luego suspende (`blockedByMissingResource`). Cero consultas
   al modelo en ese camino.
3. **Reactivación por cambio del entorno**: un objetivo suspendido revive
   cuando vuelve a haber alimento visible (o cuando el usuario aporta
   información), con las estrategias re-habilitadas (`resetGoal`).
4. **No re-interpretar señales conocidas**: la interpretación de "energía
   baja" (consulta al modelo + hipótesis) ocurre solo si no existe ya una
   hipótesis o hecho sobre recuperar energía. Antes, cada ciclo de hambre
   duplicaba la hipótesis confirmada y consultaba al proveedor.

## Consecuencia observada

Corrida larga en navegador (>2300 ticks): la mascota completa ciclos de
hambre sucesivos reutilizando la misma skill estable, la biblioteca se
mantiene en v1 archivada + v2 estable, y el mundo es sostenible. La muerte
queda reservada a situaciones reales (sin recursos y sin ayuda), como pide la
visión del producto.
