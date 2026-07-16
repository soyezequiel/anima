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
programa, resultado esperado, criterios de éxito evaluables, invariantes,
dependencias, versión padre, métricas, fallos conocidos, historial.

### Criterios de éxito

Sobre recursos: `energyIncreased`, `consumedKind`, `reachedAdjacentKind`,
`holdingKind`. Sobre conducta: `minMoves` (movimientos que el mundo aceptó; los
bloqueados no cuentan), `returnedToStart`, `netDisplacementAtLeast`,
`visitedDistinctCells`, `noDamageTaken`. Cotas de costo: `maxTicks`,
`maxIntents`. Los de conducta permiten juzgar habilidades que no consisten en
obtener nada —un baile, una ronda, una retirada—, que es lo que el cuidador
suele querer enseñar; para medirlos, `SkillRunReport` registra el recorrido del
actor muestreado por tick.

`validateSuccessCriteria` es al contrato lo que `validateSkillProgram` es al
programa: la única puerta para criterios de fuentes no confiables. Esquema
estricto por tipo, sin repetidos, y rechazo de contratos que solo acotan el
costo — un programa que no hace nada los cumpliría. Ver ADR 0016.

## Dos orígenes, un solo ciclo

- **Necesidad interna**: la mascota detecta que le falta una capacidad
  (todas sus estrategias conocidas quedaron prohibidas) y usa un contrato fijo
  en el código, porque nace de su cuerpo. Se evalúa en `MVP_SCENARIOS`.
- **Enseñanza del cuidador**: pide una conducta que ella no tiene
  (`learn-skill`). El modelo traduce la conversación a un contrato
  (`skill.contract`), el agente valida los criterios, y nace un objetivo de
  origen `learning`. Se evalúa en `PRACTICE_SCENARIOS` (sala de práctica +
  mundos reales): la sala existe porque sus mundos son estrechos, pero no la
  exime de funcionar donde vive.

Lo aprendido queda con nombre y se puede pedir después (`run-skill`): el
repertorio estable viaja en el prompt de interpretación, así que el catálogo
ejecutable no es fijo. Aprender puede fallar, y falla en voz alta.

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
`skill.used`. Además, la sesión conserva el snapshot del mundo previo a cada
ejecución de una skill estable: si la corrida falla por comportamiento (no
por falta de recursos, `no-candidates`), ese mundo exacto se registra como
caso de regresión de "mundo-real" (tope de 3 por habilidad, se descartan los
más antiguos). El evaluador reproduce esos snapshots junto a los escenarios de
laboratorio, así que ninguna versión futura puede promoverse sin superar
también los fallos que la realidad ya demostró. Ver ADR 0012.
