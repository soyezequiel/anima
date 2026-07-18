# ADR 0035 — Obras grandes: caminar mientras construye

Fecha: 2026-07-17 · Estado: aceptada · Releva el footprint 3×3 del ADR 0032; se apoya en el ADR 0034 (obras por tandas)

## Contexto

El ADR 0032 dejó las obras atadas a un footprint de 3×3: se levantaban alrededor
de la mascota, sin que caminara entre bloque y bloque, porque `place` colocaba a
un paso de donde estaba parada (offset ±1). Lo dijo con todas las letras como su
límite: «lo grande de verdad necesita que camine mientras construye, y eso pide
mover-hacia-una-posición en la DSL». El ADR 0034 puso la primera mitad de esa
escalera —volver a un ancla— para levantar obras por tandas sin el tope de las
manos, pero seguía colocando todo alrededor de un único centro.

Este ADR pone la otra mitad: que la obra pueda ser más grande que el alrededor
inmediato de la mascota.

## Decisión

**Una obra ya no se levanta alrededor de la mascota, sino en el mundo: cada
bloque tiene una celda absoluta, y la mascota camina hasta su lado para ponerlo.**

### La primitiva que faltaba: colocar en una celda del mundo

Tres piezas nuevas en la DSL, todas sobre el ancla del ADR 0034:

- `markCell { from, dx, dy, store }`: guarda como ancla la celda a `(dx,dy)` de
  otra ancla. Con esto la obra deriva cada celda absoluta desde un ancla base
  (el punto donde arranca) más el offset del plano. Los offsets llegan hasta el
  footprint (±4 → 9×9), no ±1.
- `placeAt { kind, target }`: coloca un bloque en la celda absoluta que guarda un
  ancla, no a un paso de donde está parada. El mundo revalida lo de siempre
  (adyacente, vacía, dentro), así que la mascota camina hasta el lado primero.
- `blockAtCell { target, kind? }`: el `blockAt` del ADR 0034 pero sobre una celda
  absoluta. Mantiene la obra idempotente cuando las celdas están lejos.

Y un modo nuevo para `moveToward`: `avoidTarget`. Para colocar en una celda hay
que estar **adyacente, nunca encima** —pararse en ella la dejaría ocupada por el
propio cuerpo y la colocación fallaría—. `avoidTarget` trata la celda como un
obstáculo del pathfinding, así el camino termina a su lado; y si la mascota ya
está encima, se corre a un lado en vez de darse por llegada.

### El programa de una obra grande

1. **Recordar el ancla base** (`markAnchor`): la celda donde arranca fija el
   origen de la obra.
2. **Por tandas de a lo sumo `capacity` bloques** (ADR 0034): juntar los bloques
   de la tanda en un viaje, y después repartir de a uno: derivar la celda
   absoluta (`markCell`), caminar hasta su lado (`moveToward … avoidTarget`) y
   colocar ahí (`placeAt`).

Juntar la tanda antes de repartir es lo que rinde: buscar material mueve mucho a
la mascota, y traer de a uno multiplicaba los cruces del mapa.

### El plano crece

`validateBlueprint` deja de acotar los offsets a ±1: ahora llegan al footprint
(±4). El tope de bloques por obra sube de 8 a 24. Ya no se juzga por la capacidad
del inventario (eso cayó en el ADR 0034).

## Los límites que quedan, a propósito

- **Se puede tapiar el paso a sí misma.** Si al colocar rodea de sólidos una
  celda que todavía le falta, esa queda a medias: el mundo siendo honesto (ADR
  0032), no un crash. Quien propone la forma es responsable de un orden y una
  puerta que la dejen llegar a todo. El `blockAtCell` ayuda —una obra a medias se
  retoma— pero no elige el orden de colocación por ella.
- **El footprint es 9×9.** Alcanza para una muralla, una casa con patio, una
  torre — no para una ciudad. Subir el número es cambiar una constante, no un
  eje nuevo.
- **La obra sigue sin ser una entidad** (ADR 0032): es las paredes puestas donde
  van. No se «tiene» una casa; se está entre sus paredes.

## Consecuencias

- Obras más grandes que el alrededor de la mascota: una pared larga, un recinto,
  cosas que el footprint 3×3 hacía imposibles.
- La misma maquinaria levanta las chicas (una casa 3×3 es el caso donde todas las
  celdas quedan a un paso del ancla y la mascota casi no se mueve).
- La escalera del ADR 0032 quedó entera: recordar un punto (0034) y caminar hasta
  las celdas del mundo (0035). Lo que sigue —elegir el orden de colocación para
  no tapiarse, footprints aún mayores— es afinar, no cimentar.
