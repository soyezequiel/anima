# Habilidades

## DSL declarativa (lista cerrada)

Operaciones: `findEntities`, `selectTarget`, `moveToward`, `moveStep`,
`pickup`, `drop`, `consume`, `useItem`, `wait`, `speak`, `branch`,
`repeatWithLimit`, `runSkill`, `abort`.

Condiciones: `always`, `lastMoveBlocked`, `lastActionFailed`, `entityGone`,
`isAdjacent`, `holding`, `energyBelow`, `not`.

Validación con Zod (esquemas `strict`: propiedades extra rechazadas) más
límites estructurales: ≤200 operaciones, profundidad ≤6, repeticiones 1..50
obligatorias. `validateSkillProgram` es la única puerta de entrada para
programas de fuentes no confiables (modelos, backend, archivos).

## Intérprete con presupuestos

`SkillExecution.next(perception)` devuelve una intención por tick;
`observe(events)` procesa el resultado. Límites duros: 200 ops puras por tick
(cede el tick con `wait` implícito), 5000 totales, 300 intents, profundidad de
`runSkill` ≤3, cancelación por timeout del driver. Sin acceso a DOM, red,
motor ni almacenamiento: el programa solo ve la percepción y emite intenciones
que el mundo puede rechazar.

## Contrato de una habilidad

`SkillDefinition`: id, nombre, versión, estado (`experimental | stable |
deprecated | archived`), descripción, **motivación** (por qué se creó),
programa, resultado esperado, criterios de éxito evaluables
(`consumedKind`, `energyIncreased`, ...), invariantes, dependencias, versión
padre, métricas, fallos conocidos, historial.

## Ciclo cerrado (implementado en `agent-core/skill-dev.ts`)

```
detectar necesidad ──> definir contrato ──> proponer candidata (modelo)
        ▲                                        │ validación DSL
        │                                        ▼
   corregir (modelo   <── informe de fallos <── evaluar en mundos aislados
   con observaciones)                            (escenarios × semillas × regresiones)
        │                                        │
        └── nueva versión                        ▼
                                        promover / rechazar (juez determinista)
                                                 │ rechazo ⇒ archivar + regresiones
```

Reglas de promoción: 100% de casos (umbral configurable), cero violaciones de
invariantes, superar todas las regresiones históricas, no empeorar a la
versión anterior. El generador nunca es juez: la evaluación es código
determinista.

## Telemetría en uso real

Cada uso real actualiza `metrics.totalRuns/successfulRuns` y emite
`skill.used`. Pendiente (Fase 7+): convertir automáticamente fallos en uso
real en nuevos casos de regresión con snapshot del mundo real.
