# ADR 0071 — El sitio de una obra tiene que ser alcanzable

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Le pidieron una cocina. Juntó el fogón y las tres encimeras —esa parte funcionó,
incluso fabricando por recetas encadenadas— y después colocó el fogón **sobre una
veta de mineral** y una encimera **sobre un muro**. Dos `cell-occupied`, un «la
acción no produjo el resultado esperado», y el objetivo `failed`.

La traza del motor:

```
17758  move left  → blocked (wall e3 en 5,1)
17759  move left  → blocked
17760  move left  → blocked
17761  place en (6,0) → cell-occupied      ← siguió como si hubiera llegado
17762  place en (5,1) → cell-occupied
```

El ADR 0049 ya había establecido que una obra tiene un SITIO, elegido antes de
empezar y libre de estorbos, y esa maquinaria funcionaba: `chooseStructureSite`
eligió (3,1), un claro donde la cocina entraba. El problema es que (3,1) estaba
del otro lado de un muro, y el caminante es greedy y ciego a obstáculos —a
propósito, ADR 0005—. Generó «izquierda, izquierda, izquierda», el muro rebotó
los tres pasos, y nadie miró si habían funcionado.

`buildStructureProgram` emitía la aproximación como `moveStep` pelados:

```ts
...(options.approach ?? []).map((dir) => ({ op: 'moveStep' as const, dir })),
{ op: 'markAnchor', store: BASE },
```

con `walkOps` a veinte líneas de distancia, que existe exactamente para esto:
envuelve cada paso en una comprobación y corta con `camino-bloqueado`.

Y el comentario encima de ese código declaraba la invariante que el código no
cumplía: «el ancla es el LUGAR de la obra, no donde ella estaba cuando se le
ocurrió empezar».

La escuela, pedida en la misma partida, salió bien. No por diseño: por suerte del
mapa, le tocó un sitio de su lado del muro.

## Decisión

Tres cambios, que son tres caras de la misma falla — **tratar una intención como
si fuera un hecho**.

**1. La aproximación se comprueba.** `walkOps` en vez de `moveStep` sueltos. El
primer paso rechazado corta el programa con `camino-bloqueado`. No llegar es un
final honesto; llegar a otro lado y construir ahí, no.

**2. Un sitio no es sitio si no se puede llegar.** `chooseStructureSite` filtra
los candidatos simulando el camino contra los sólidos que ve. No se agrega
pathfinding —el ADR 0005 sigue en pie— porque no hace falta inventarlo: alcanza
con **preguntarle antes al mismo caminante que después va a caminar**. Que sea el
mismo cálculo importa más que su calidad; validar con un criterio y caminar con
otro es precisamente cómo se elige un sitio inalcanzable.

**3. Sin sitio no se levanta nada.** La ausencia de sitio caía en «plantala donde
estés», que es el comportamiento que el ADR 0049 vino a eliminar y que sobrevivía
como respaldo silencioso. Ahora aborta con `sin-sitio` y lo dice: «no encuentro
un lugar despejado al que pueda llegar para levantarla». No tener dónde construir
es una respuesta legítima, y dicha con todas las letras es más útil que una obra
plantada en el primer lugar que tocó.

## Consecuencias

Puede negarse a construir donde antes «construía»: en un mapa cerrado, o con la
obra del otro lado de un muro, ahora dice que no puede en vez de tirar bloques
contra las piedras. Es una pérdida aparente de capacidad y una ganancia real de
honestidad — antes esos intentos tampoco levantaban nada, solo lo escondían
detrás de un mensaje genérico.

El criterio de alcance es «hasta donde sé»: mira los sólidos que VE, y la vista
exige línea despejada (ADR 0025). Un muro detrás de otro no está en el mapa que
miró, así que puede elegir un sitio que al acercarse resulte inalcanzable. Eso
ahora termina en `camino-bloqueado` y el sitio se revalida, que es el
comportamiento que el ADR 0049 ya preveía para el caso simétrico.

Queda sin resolver, a propósito, el caso del muro **rompible**: hoy descarta el
sitio en vez de abrirse paso, aunque la maquinaria para hacerlo existe (ADR 0066,
0067). Meter la obra en ese camino tiene bastante más superficie de riesgo y no
hacía falta para arreglar esto.

La regresión vive en `packages/agent-core/tests/sitio-alcanzable.test.ts`, con el
mapa partido en dos que reproduce el caso real: no exige que construya la cocina
—del otro lado del muro puede no llegar nunca— sino que **no tire bloques sobre
celdas que está viendo ocupadas**.
