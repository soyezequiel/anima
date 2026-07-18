# ADR 0038 — El GPS hacia el recurso: `gpsTo`

Fecha: 2026-07-18 · Estado: aceptada · Continúa la búsqueda antes de rendirse (ADR 0028) y la memoria de lugares (ADR 0025)

## Contexto

Llegar a donde hay un recurso exigía componer a mano tres operaciones —
`explore … until sees` + `findEntities` + `selectTarget` + `moveToward` — y
elegir bien el orden según lo que la mascota supiera en ese momento. Los
programas de fábrica ya lo hacían (ADR 0028), pero el modelo que propone
habilidades tenía que redescubrir el patrón cada vez, y la memoria de lugares
(ADR 0025) quedaba fuera de la DSL: solo los programas del agente podían usar
"me acuerdo de dónde había troncos" como rumbo; una habilidad propuesta, no.
El cuidador seguía haciendo de GPS en los casos que a los programas de fábrica
no les tocaban.

Las piezas del GPS ya existían sueltas: el BFS que rodea obstáculos
(`moveToward`), la exploración hacia lo menos visitado (`explore`), y la
memoria de lugares con su derecho a desmentir (`recall`/`forget`). Faltaba la
operación que las encadenara con el criterio correcto.

## Decisión

1. **La DSL gana `gpsTo`, el "llevame a donde hay X" en una operación.**
   `{"op":"gpsTo","kind":…,"maxSteps":1..50,"stopAtDistance"?:0..10,"store"?:…}`
   navega con tres rumbos en orden de certeza:
   - **A la vista**: si percibe un ejemplar del tipo, persigue el más cercano
     con el mismo BFS de `moveToward` (rodea muros y agua conocidos).
   - **Recordado**: si no lo ve pero la memoria de lugares recuerda dónde
     había uno, camina hasta ahí. Llegar al lado y no ver nada prueba que el
     recuerdo mentía: se descarta (`forget`) y se prueba el siguiente. Un
     camino bloqueado NO desmiente el recuerdo — solo lo posterga.
   - **Explorar**: sin vista ni recuerdo, avanza hacia lo menos visitado
     (el mismo paso de `explore`), esperando que la vista tome el control
     apenas el recurso aparezca.
   Al llegar, `store` guarda el ejemplar alcanzado, listo para
   `pickup`/`consume`/`useItem`. Si `maxSteps` se agota, `lastMoveBlocked`
   queda en true y el programa decide — el final honesto de siempre.

2. **La memoria de lugares entra al intérprete por una ventana, no entera.**
   `SkillExecution` acepta `places?: GpsPlaces` — solo `recall(kind)` y
   `forget(id)`. El agente pasa un adaptador sobre su `PlaceMemory`; el
   evaluador y las pruebas pueden pasar una de mentira o ninguna. Sin
   `places`, el GPS navega por vista y exploración igual.

3. **Sin omnisciencia.** El GPS no consulta el `WorldState`: los tres rumbos
   usan solo percepción y memorias propias (espacial y de lugares). Es la
   generalización de `rememberedFoodProgram`/`rememberedWalk` a cualquier
   `kind`, no un mapa del mundo regalado — coherente con ADR 0005/0025.

## Consecuencias

- "Andá a donde hay madera" es una operación, y el modelo la conoce: la
  referencia de la DSL en los prompts documenta `gpsTo` como el atajo que
  reemplaza al trío `explore`+`findEntities`+`moveToward`.
- La memoria de lugares por fin trabaja para las habilidades propuestas, no
  solo para los programas de fábrica — con el mismo contrato de honestidad:
  ir, no encontrar, y desmentir.
- Los guardados viejos no cambian: es una operación nueva que ningún programa
  existente usa, y `validateSkillProgram` la admite desde ahora.
- Costo acotado: `maxSteps ≤ 50` por viaje, dentro del presupuesto de
  intents de siempre (300).
