# Planificación causal

Ánima conserva los programas de `skill-runtime` como lenguaje de ejecución,
pero ya no necesita confundir una secuencia de operaciones con una explicación
de por qué debería funcionar. `agent-core` incorpora una capa previa y general:

```
Perception + memoria espacial + catálogos validados
                         │
                         ▼
        estado inicial + acciones causales fundamentadas
                         │
       objetivo verificable ──► búsqueda con costo/riesgo/límites
                         │
                         ▼
                 plan causal validado
                         │
                         ▼
               programa DSL ──► intenciones
                                      │
                                      ▼
                              sim-core (veredicto)
                                      │
                         efecto/precondición falsos
                                      │
                                      └──► estado fresco + replanificación
```

## Representación

Un estado es un mapa de **fluentes contables** (`inventory:log`,
`present:e17`, `adjacent:e17`, etc.). El núcleo no conoce nombres especiales:
un fluente es una clave opaca, un valor y su procedencia epistemológica.

Cada `CausalAction` declara:

- precondiciones (`at-least`, `at-most`, `equal`);
- efectos (`increase`, `decrease`, `set`);
- costo y riesgo;
- autoridad (`world`, `code`, `memory`, `model`);
- conocimiento (`known` o `hypothetical`).

`deriveCausalWorldModel` fundamenta acciones desde datos que el mundo ya
validó:

- objetos portables → recoger;
- recetas → consumir ingredientes y crear uno de sus desenlaces;
- `drops`/descomposiciones + dureza/durabilidad + fuerza/herramienta → extraer;
- interacciones aprendidas → transformar objetivo o cosa sostenida;
- posición percibida/recordada → navegación.

Así, “tronco de árbol” no es una regla del planner. Es sólo una instancia de
`drops`, igual que cualquier transformación futura. Las herramientas tampoco
son una lista: se derivan del componente `tool.power` y de la misma fórmula que
expone el mundo.

## Estado inicial y objetivo

El estado inicial se deriva de `Perception`: inventario, entidades visibles,
distancias, propiedades observables y catálogos. La memoria espacial agrega
ubicaciones y recursos recordados como **hipótesis**, porque algo visto antes
puede haber desaparecido. Una ausencia fuera del campo visual queda
`unknown`, nunca se convierte en cero conocido.

`planCausalRequest` traduce sólo pedidos con una condición verificable que esta
capa entiende (por ahora adquisición, fabricación de objetos y destrucción).
Las obras conservan su condición geométrica propia y las formas no traducidas
devuelven `unsupported`; no se inventa un objetivo aproximado.

## Búsqueda y explosión combinatoria

`planCausally` realiza búsqueda uniforme informada sobre estados. Ordena por:

```
costo acumulado + riesgo × riskWeight + condiciones objetivo pendientes
```

Tiene límites configurables de profundidad, estados expandidos, costo y riesgo.
Además, cantidades mayores que el máximo relevante para cualquier
precondición/objetivo se consideran equivalentes al deduplicar estados. Esto
evita ramas infinitas como “buscar una unidad” repetida sin perder ninguna
capacidad útil.

Los efectos hipotéticos se excluyen por defecto. El llamador puede admitirlos
para construir un plan contingente (por ejemplo, explorar); el resultado queda
marcado `confidence: hypothetical` y el mundo todavía debe confirmarlo.

## Autoridad y LLM

`validateCausalAction` es la puerta de entrada. Rechaza, entre otras cosas:

- acciones sin efectos declarados;
- costos/riesgos inválidos;
- una acción de autoridad `model` etiquetada como `known`;
- una acción supuestamente conocida con efectos hipotéticos ocultos.

El LLM puede proponer una acción o interpretación con autoridad `model` y
estado `hypothetical`. No puede convertirla en física. Una receta,
descomposición o interacción sólo reaparece como `known` después de atravesar
los validadores deterministas de `sim-core` y formar parte del catálogo del
mundo.

La memoria semántica textual tampoco se parsea como leyes físicas. Sirve para
diálogo e hipótesis; la causalidad ejecutable nace de percepción y catálogos
tipados.

## Validación, ejecución y replanificación

`validateCausalPlan` reproduce una cadena desde el estado inicial y rechaza el
primer paso cuya precondición no se cumple; también comprueba que el estado
final alcance el objetivo. `causalPlanToSkillProgram` compila únicamente clases
conocidas a la DSL cerrada. Si encuentra metadatos que no sabe ejecutar,
devuelve `null` en vez de improvisar.

Durante la ejecución, cada operación vuelve a pasar por `sim-core`. Los
programas compilados abortan si una precondición práctica falla o el efecto no
ocurre. El bucle de objetivos ya recompone actividades desde una percepción
fresca; los eventos `causal.plan.created`, `causal.plan.revised` y
`causal.plan.rejected` hacen observable ese ciclo. Para consumidores directos,
`validateObservedStep` detecta precondición falsa/efecto ausente y
`replanCausally` descarta acciones demostradas fallidas antes de buscar otra
ruta.

## Archivos

- `agent-core/src/causal-planner.ts`: tipos, búsqueda, validación y replanning.
- `agent-core/src/causal-world-model.ts`: estado/acciones derivados del mundo.
- `agent-core/src/causal-program.ts`: compilación segura a `SkillProgram`.
- `agent-core/tests/causal-planner.test.ts`: cadenas de varios pasos,
  alternativas por costo, interacciones, hipótesis, rechazo y revisión.

