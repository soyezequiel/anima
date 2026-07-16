# ADR 0017 — El frío como motivo y el crafteo

Fecha: 2026-07-16 · Estado: aceptada · Completa el paso 2 del plan de crafteo

## Contexto

El ADR 0015 dejó el frío en el motor pero sin nadie que lo sintiera: la
temperatura bajaba y la mascota no reaccionaba. Y las recetas (ADR 0016 del
paso anterior… ver `roadmap.md` §0) existían en el mundo sin que el agente
pudiera pedirlas ni quererlas. Este ADR cierra las dos puntas.

## Decisiones

### El frío es del cuerpo, no de la conversación

Siguiendo la línea que fija el ADR 0016 —«la necesidad interna conserva su
contrato fijo en el código: nace del cuerpo de la mascota, no de una
conversación»— el frío va por el camino del hambre y **no** por `learn-skill`:

- `processColdSignal` interpreta `temperature-low` con `interpret.signal`,
  igual que el hambre, y crea el objetivo `recuperar calor` (prioridad 0.95:
  por encima del hambre, porque congelarse mata más rápido).
- Si el proveedor falla, el objetivo nace igual: el cuerpo no espera a que el
  modelo conteste.
- `SKILL_GET_WARM` = `conseguir-calor` es un nombre reservado, como
  `alcanzar-alimento-bloqueado`: un contrato enseñado no puede secuestrar la
  habilidad de no morirse de frío.

### Fabricar abrigo sí es una salida legítima (a diferencia del alimento)

El ADR 0008 dice que si todo falla por falta de **recurso** no tiene sentido
fabricar una habilidad: ninguna skill crea comida. Con el fuego es distinto:
**sí puede construirlo** si tiene ingredientes. Por eso `pursueWarmth` solo
escala a pedir-ayuda cuando además no hay ninguna receta que produzca calor.

### Ninguna vara imposible

Una habilidad de abrigo solo se puede juzgar en mundos con `temperature`: en
uno templado, `temperatureIncreased` es inalcanzable y la habilidad se
rechazaría siempre, por buena que fuera. `AgentConfig.warmthScenarios` los
inyecta (`COLD_SCENARIOS`); **sin ellos la mascota no intenta aprender y pide
ayuda**. Mejor no aprender que aprender contra una vara que nadie puede pasar.

### Lo que el evaluador aprendió a medir

`temperatureIncreased` y `craftedKind`, con `SkillRunReport.temperatureDelta`.
Cuando construir falla, las observaciones dicen qué ingrediente faltó
(`craft-missing:flint x1`): el fallo es una instrucción para la revisión, no
un "no se pudo".

### Huecos de la DSL que encontraron las pruebas

- **`held` en `findEntities`**: la búsqueda incluye lo que ya lleva encima y
  `nearest` ordena lo sostenido a distancia 0, así que buscar el segundo
  tronco devolvía **siempre** el que tenía en la mano. Ninguna habilidad podía
  juntar dos objetos del mismo tipo.
- **`stopAtDistance` en `moveToward`**: se detenía pegada, siempre. El fuego
  calienta a 2 y quema a 1: sin esto, la única aproximación expresable era la
  que se quema. Por defecto 1 — idéntico al comportamiento anterior, porque
  `isAdjacent` ya era `chebyshev <= 1`.
- **`warm` en `findEntities`**: busca por lo que irradia calor, no por tipo.
  La mascota percibe que algo da calor; no sabe que se llama "fogata".

### La negativa dice qué falta

`evaluateUserRequest` usa `missingIngredients()` **del motor**: la misma
función con la que el mundo decide. La mascota no puede decir "me falta X" y
que el mundo opine distinto. Si ve el ingrediente que falta lo dice, en vez de
prometer ir a buscarlo: eso es otra petición, y el cuidador puede pedirla.

## Lo que queda deliberadamente sin hacer

- **El mundo jugable sigue sin frío** (`food-behind-wall` no da `temperature`),
  así que todo este camino está dormido en la partida real y vivo en las
  pruebas. Encenderlo es un cambio de una línea el día que la historia del
  frío quiera contarse en la UI.
- **La aproximación primitiva ya sabe pararse a distancia 2** (`stopAtDistance`
  en `WARMTH_APPROACH_PROGRAM`): es un reflejo prudente incorporado, no
  conocimiento adquirido. La versión rica —acercarse ingenuamente, quemarse,
  que el evaluador rechace esa v1 y que la v2 corrija la distancia— es la misma
  forma que la historia rama-vs-martillo y está a mano: basta quitarle el
  `stopAtDistance` a la aproximación y dejar que el ciclo la corrija. No se
  hizo ahora porque el mock no sabe proponer abrigo (ADR 0006: es
  deliberadamente imperfecto y solo sabe de comida), y sin eso la historia solo
  existiría con una cuenta de IA real.
- **Que la mascota junte los ingredientes sola** para construir la fogata: hoy
  `craft-item` construye con lo que ya lleva. Talar, juntar y construir en una
  sola habilidad es exactamente lo que el ciclo debería aprender, y el escenario
  `cold-night-unlit` ya está listo para juzgarlo.
