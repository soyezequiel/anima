# ADR 0080 — Los mapas son pruebas de aceptación, no niveles

Fecha: 2026-07-19 · Estado: aceptada

## Contexto

Ánima tenía un mundo: `foodBehindWall`, cableado en una línea de `GameSession`.
Alcanzaba para la historia del MVP —hambre, muro, primera habilidad— y para
evaluar habilidades en mundos imaginados. Lo que no había era ninguna forma de
preguntarle al sistema **si sus capacidades emergentes funcionan de verdad**.

La pregunta importa porque el sistema promete mucho: inventar recetas,
interacciones, obras, descomposiciones y habilidades en tiempo de ejecución. Con
un solo mundo y un solo guion, esa promesa se verifica leyendo el chat — que es
exactamente donde no hay que verificarla, porque el chat es lo que ella DICE.

## Decisión

**Tres mapas con misión, que existen para romper el sistema por lugares
distintos.** Un mapa no es contenido: es un caso de prueba que se juega.

### 1. Una misión son condiciones, no un guion

`Mission` tiene dos cosas y nada más entre ellas:

- Un **planteo** en castellano, que entra por el chat normal
  (`receiveUserMessage`). No hay canal privilegiado que le meta el objetivo en
  la cabeza: si el encargo no se entiende por la misma vía por la que se
  entiende «traé un tronco», el problema es del sistema y tiene que verse.
- Un conjunto de **objetivos verificables** contra el `WorldState` y el
  registro de hechos del motor.

Lo que NO hay: una solución prevista, un tipo de objeto esperado, una receta
reservada, ni ninguna rama de código que mire el id del mapa.

### 2. El vocabulario de objetivos no puede nombrar la solución

`entity-exists`, `entity-in-zone`, `no-entity`, `agent-in-zone`, `path-open`,
`rule-learned`, `event-happened`, `sequence`, `all`, `any`. Hablan de
propiedades, zonas, caminos y hechos ocurridos.

Dos elecciones que sostienen todo lo demás:

- **`path-open` usa `canStandAt`**, la misma función que aplica el motor al
  mover. No pregunta por el objeto que abrió el paso: pregunta si el mundo
  cambió de forma. Cualquier mecanismo que lo logre cuenta, y ninguno está
  privilegiado.
- **La consulta distingue lo hecho de lo encontrado.** `createdDuringRun`,
  `crafted`, `placed` y `kindIsNew` se apoyan en lo que el `MissionTracker`
  anotó al empezar y en los eventos del motor. Sin eso, «creó un objeto» sería
  indistinguible de «encontró un objeto», y la mitad de lo que estos mapas
  miden es justamente esa diferencia.

Los tipos que ya existían al empezar —incluidos **los que las recetas sembradas
saben producir**— no cuentan como invención. Un mundo que ya sabía hacer sillas
no acredita una silla como idea nueva.

### 3. Transformar no es destruir

Varios objetivos preguntan por «algo que ya estaba y terminó siendo algo que no
existía» (`createdDuringRun: false` + `kindIsNew: true`). Es la forma de exigir
una transformación sin nombrarla: romper la entidad vacía el `no-entity` pero no
satisface esto, porque lo roto no cambia de tipo, desaparece.

### 4. Lo que se dice no cuenta

Ningún objetivo mira `agent.spoke`. Se admiten en cambio los hechos del agente
que son veredictos de código determinista (`skill.promoted` sale del evaluador,
no de su boca). El juez no distingue fuentes: distingue **hechos de
afirmaciones**.

### 5. Todo intento deja traza

`apps/missions` corre un mapa con el modelo real y escribe un JSONL con qué
vio, qué le preguntó al modelo, qué contestó palabra por palabra, qué intención
mandó al mundo, qué validó el mundo con qué motivo, qué cambió y por qué el juez
dio o no por cumplido cada objetivo.

Es la herramienta de trabajo del ciclo *implementar → mirar dónde falla →
arreglar la causa general*. Los cinco defectos que encontraron estos mapas
(ADR 0077, 0078, 0079 y los dos de navegación) salieron de leer esas trazas, no
de suponer.

## Consecuencias

Los mapas son duros a propósito y **no se garantiza que se puedan superar**. Un
mapa que no se supera es información: dice qué le falta al sistema. Cuando la
respuesta fue «le falta una capacidad general», se agregó la capacidad (nunca la
solución). Cuando fue «le falta este mapa», se dejó anotado.

`GameSession` acepta un mapa (`?map=vado`) y el mundo de siempre sigue siendo el
de siempre cuando no se pide ninguno: **la vida no es un nivel**. Un mapa
distinto es un mundo distinto, así que arranca de cero — mezclar el guardado de
una partida con la geografía de otra dejaría a la mascota parada dentro de un
río.
