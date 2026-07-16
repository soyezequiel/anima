# ADR 0015 — Frío, árbol talable y drops declarativos

Fecha: 2026-07-16 · Estado: aceptada

## Contexto

El mundo solo tenía dos señales internas (energía, salud) y un motivo (el
hambre). Para que el crafteo tenga sentido —"construí una fogata"— hace falta
un problema que la fogata resuelva y materiales con los que construirla. Este
es el paso 1 del plan de crafteo: primero el motivo (frío) y los materiales
(troncos); la fogata crafteada es el paso 2.

## Decisión

Tres piezas en `sim-core`, todas declarativas y deterministas:

- **`temperature`** (en el agente): calor corporal que decae cada tick
  (`lossPerTick`); en cero, la salud decae y la muerte es por `hypothermia`
  (con sus recomendaciones de legado). Eventos `temperature.low` (al cruzar
  el umbral 0.35, igual que la energía) y `temperature.depleted`. Los mundos
  sin el componente no cambian en nada.
- **`heatSource`** (en fogatas y similares): irradia `warmthPerTick` a los
  agentes a distancia Chebyshev ≤ `range`. Una fogata con `hazard` además
  quema al que se pega: la distancia correcta (cerca pero no encima) es una
  regla del mundo que se puede descubrir, no un tutorial.
- **`drops`** (en cualquier entidad destruible): lista de arquetipos
  `{ kind, components }` que aparecen al destruirla, en su celda y las
  adyacentes libres, en orden determinista. Cada drop se clona
  (`structuredClone`), así que compartir el arquetipo es seguro.

El árbol del escenario pasa a ser **talable**: dureza 5 (la rama no lo daña,
el martillo sí) y 3 troncos como drops. Talarlo destruye la fuente de
alimento: una consecuencia real, no un castigo scripteado.

## Qué queda explícitamente para el paso 2 (fogata)

- El **agente** todavía no reacciona a `temperature.low`. Enseñarle a querer
  calor en un mundo donde aún no puede fabricar fuego solo produce la
  escalada pedir-ayuda→suspender→morir. La interpretación de la señal, el
  objetivo "recuperar calor" y la estrategia de acercarse al fuego llegan
  junto con el crafteo.
- Por lo mismo, el **mundo jugable** (food-behind-wall) aún no da frío a la
  mascota, y `cold-night` no está en `MVP_SCENARIOS`. El escenario existe y
  está probado a nivel motor; entra a las evaluaciones cuando el agente sepa
  qué hacer con él.
- La primitiva `craft` con recetas e ingredientes.

## Consecuencias

- Nueva causa de muerte (`hypothermia`) en el informe de legado.
- `Perception` expone `self.temperature` y `warmth` en entidades percibidas:
  el agente tendrá lo necesario para razonar sobre el calor sin ver el
  `WorldState`.
- Los objetos sin arte propio (el tronco, y cualquier cosa futura) se dibujan
  como un cuadrado con su nombre (ver ADR 0014): ningún kind nuevo requiere
  tocar la UI.
