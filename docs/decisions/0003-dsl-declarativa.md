# ADR 0003 — DSL declarativa validada, no JavaScript generado

Fecha: 2026-07-16 · Estado: aceptada (requisito del producto; aquí se fijan
los detalles de implementación)

## Decisión

- Programas = JSON contra esquemas Zod `strict` (propiedades extra ⇒ rechazo).
- Lista cerrada de 14 operaciones y 8 condiciones; `discriminatedUnion` hace
  imposible una operación desconocida.
- Límites en validación (≤200 ops, profundidad ≤6, repetición 1..50
  obligatoria) y en ejecución (presupuestos de ops puras por tick y totales,
  intents máximos, profundidad de `runSkill`, cancelación por timeout).
- El intérprete es incremental (`next()/observe()`): una intención por tick de
  mundo, para integrarse al loop del agente sin bloquear la simulación.
- Cuando el presupuesto de ops puras de un tick se agota, el intérprete cede el
  tick con un `wait` implícito en lugar de abortar: los programas legítimos con
  mucho control de flujo sobreviven y el presupuesto total sigue acotando.

## Alternativas descartadas

- JS en sandbox (Worker + SES): potencia innecesaria para el MVP y superficie
  de ataque/rendimiento mucho mayor. Puede reevaluarse post-MVP.
- Árbol de comportamiento clásico: equivalente en poder, pero la forma
  secuencia+branch+repeat es más legible para proponentes LLM y para la UI.
