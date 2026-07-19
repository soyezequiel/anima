# Bitácora de los intentos reales

Corridas con el modelo real (Codex, `codex-cli 0.144.5`), semilla 1. Cada línea
salió de la traza JSONL de esa corrida, no de la memoria de nadie. Las trazas
completas se regeneran con `pnpm mission <mapa>`; no se versionan porque son
7 MB de salida de máquina.

## Mapa 1 — El vado

| # | Resultado | Qué pasó | Qué se arregló después |
|---|---|---|---|
| 1 | 1/5 | Interpretó el encargo entero como `craft-item: balsa`. Inventó la receta, juntó, fabricó — y en el **tick 27 dio el encargo por completado** con el río intacto. Las cláusulas «ponelo sobre el agua» y «cruzá» se perdieron en la traducción. | Encargo en partes (`sequence` + `afterGoalId`), ADR 0078 |
| 2 | 1/5 | Ahora sí leyó tres partes. El modelo usó `footing` por decisión propia: «hace que vos puedas pisarla sobre el agua de verdad». Pero «ponelo sobre el agua» se desvió a inventar una interacción, y ella imaginó *meterse debajo del agua*; el juez la aprobó, la puerta la aceptó y el motor la rechazó al ejecutarla. | `place-item` + `markTarget`; la puerta rechaza posturas imposibles sobre el agua |
| 3 | 0/5 | Bautizó la idea «puente». El juez: «un puente es una obra, no una cosa — proponelo como OBRA». El modelo obedeció y mandó el plano **dos veces**; el veto guardado contra el nombre tumbó las dos. | Veto con forma, ADR 0079 |
| 4 | 1/5 | Pasó el veto, fabricó la balsa, y el `place-item` se fue 50 ticks a buscar un tipo llamado `unknown`: el objetivo no copiaba `onKind`. | Copiar `onKind` al objetivo + abortar en voz alta si falta el qué o el dónde |
| 5 | **3/5** | Fabricó, **colocó sobre el río** y el paso **se abrió de verdad** (tick 28, verificado con la física del motor). Y se quedó del lado de acá muriéndose de hambre: su propio BFS seguía contando esa celda como agua. | La regla de qué se puede pisar, unificada también del lado del agente |
| 6 | 0/5 | Camino «obra»: el veto ya no la frena, pero tres piezas no salían del material del mapa. Pidió ayuda sola: «¿me conseguís 4 ramas?». | Más materia en el taller: el mapa no elige el camino por ella |
| 7 | **✅ 5/5** | tick 14 inventó y fabricó la balsa · tick 24 la colocó en (7,6) · tick 24 el paso se abrió · **tick 171 pisó (7,6)** y tick 172 salió a (8,6). Cruzó empujada por su hambre, usando el paso que ella misma construyó. Orden causal verificado. | — |

Receta que inventó en la corrida 7, tal cual entró al mundo:

```json
{"id":"balsa","output":{"kind":"balsa","components":{
  "footing":{},"portable":{},"durability":{"current":18,"max":18},"hardness":{"value":3}}},
 "ingredients":[{"kind":"tronco","count":3},{"kind":"fibra","count":2}]}
```

Nadie escribió «balsa» en ninguna parte del código. El nombre, los materiales y
la elección de `footing` son suyos.

## Mapa 2 — El brote sediento

| # | Resultado | Qué pasó | Qué se arregló después |
|---|---|---|---|
| 1 | 0/7 | `fetch-item: agua` → `pickup: not-portable` → «no pude recoger el objeto» → **340 ticks de silencio**. Un «no» que era física se trató como un tropiezo. | El motivo del mundo se vuelve hecho aprendido y pregunta concreta |
| 2 | 0/7 | Mismo arranque, pero ahora: «Una agua no se puede levantar con las manos… decime con qué la junto y lo intento». | (se contestó con una pista) |
| 3 | 2/7 | Con la pista, descompuso en tres partes e inventó y fabricó el recipiente. El juez vetó la regla de juntar agua **porque en ese instante no tenía el recipiente encima** — el objeto que la regla servía para poder usar. | El juez juzga la regla, no el intento |
| 4 | 3/7 | Dos interacciones aprendidas, el llenado **ejecutado** (tick 39). «Volcarla en el brote» se tradujo como *colocar* agua. | `place-item` es para objetos que se levantan y se apoyan; lo que se derrama es interacción |
| 5 | **5/7** | Cuatro interacciones aprendidas. Y un hallazgo: en vez de regar el brote, inventó **volcarlo** — el juez lo aprobó (es coherente) y eso lo transformó. La misión no pasó igual, por la cuenta de interacciones ejecutadas. | — (ver limitaciones) |

## Mapa 3 — La vigía

| # | Resultado | Qué pasó |
|---|---|---|
| 1 | 0/6 | La traducción produjo `fetch-item: "material"` — un sustantivo genérico que no es tipo de nada. Nadie la frenó: 500 ticks recorriendo el mapa en busca de un objeto que no existe, con dos «¿me conseguís 1 material?» por el medio. |

Es el defecto que hay que atacar para desbloquearlo: **no se sale a buscar un
sustantivo genérico**. Un tipo que existe pero no se ve se busca (ADR 0054); uno
que no es un tipo se pregunta.
