# ADR 0057 — Lugar para los ingredientes, y esperar lo que sí aparece

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Partida real. El cuidador avisa: *«hay arcilla en el mapa y el agente no logró
crear el pizarrón para la escuela»*. Estado exacto al mirarlo:

- Plano `escuela`: 5× `pared-aula` + 1× `pizarron`.
- Recetas: `pared-aula = 1x log`, `pizarron = 2x clay`.
- Mochila: capacidad **6**, llevando martillo + 4 paredes = **5 ocupadas**.
- En el suelo: **3 arcillas**, la más cercana a 4 pasos.
- Objetivo: `suspended`, «me quedé sin material a mitad del encargo»,
  esperando *«aparezca un pizarrón»*.

Dos defectos encadenados, y el segundo hacía permanente al primero.

### 1. «¿Hay lugar?» no es «¿queda alguna ranura?»

`buildStructureProgram` decidía descargar la obra con
`freeSlots > 0 ? [] : placeOps(...)`: descargá **solo si la mochila está
llena**. Le quedaba una ranura, así que no descargaba.

Pero una ranura no alcanzaba. Recoger un bloque cuesta una ranura;
**fabricarlo cuesta tantas como ingredientes lleve**, porque la receta los
consume de la mano y hay que tenerlos todos a la vez. El pizarrón pide dos
arcillas: con una ranura libre, la segunda no entraba nunca.

Tener lugar para una cosa cuando hace falta lugar para dos es exactamente igual
de inútil que no tener lugar. Pero como técnicamente «había lugar», el programa
tampoco se descargaba: quedaba en la peor de las dos posiciones.

Es la misma familia del defecto 2 del ADR 0049 (el acopio pedía más ranuras que
la capacidad), un piso más abajo: allá era la obra entera, acá es **una pieza**.

### 2. Esperaba algo que no aparece

Al suspenderse, guardaba como «materia que espera» lo que
`missingKindsForRequest` devuelve: los **bloques** del plano. O sea, esperaba
que *apareciera un pizarrón*.

Un pizarrón no aparece: se fabrica. `reviveSuppliedRequests` busca un ejemplar
suelto y portable de lo que falta, y nunca iba a haber uno. La arcilla estaba
ahí desde el principio y no contaba, porque nadie preguntaba por la arcilla.

Dormida para siempre, con el material a cuatro pasos.

## Decisión

**1. La cuenta de lugar mira lo que cuesta conseguir UNA pieza más.**

`slotsForOneMore` = el máximo, entre los bloques que faltan, de: 1 si se
recoge, o la suma de ingredientes si se fabrica. Se descarga cuando
`freeSlots < slotsForOneMore`.

Sigue siendo conservador: con espacio suficiente no descarga, porque los
bloques son sólidos y levantarlos antes de salir a buscar puede tapiarle el
camino a ella misma (la razón por la que la descarga era condicional).

**2. Lo que espera es materia ENCONTRABLE.**

`findableMaterialsFor` cambia cada tipo que se fabrica por sus ingredientes, y
así hasta tocar materia que exista en el mundo. Se usa en los dos lados de la
espera: al suspenderse (el texto y `suspensionMaterials`) y al revivir.

Ahora dice *«aparezca arcilla»*, que es verdad y es accionable — y despierta
sola cuando la hay.

## Consecuencias

- Las obras con piezas caras (varios ingredientes) dejan de ser imposibles con
  mochilas chicas. Antes el techo real no era la capacidad sino
  `capacidad − ingredientes_de_la_pieza_más_cara`, sin que nada lo dijera.
- El mensaje al cuidador mejora solo: pedirle arcilla es algo que puede hacer;
  pedirle un pizarrón, no.
- Riesgo aceptado: expandir a ingredientes puede revivir un encargo que vuelva
  a fallar por otro motivo, con un ciclo suspender/revivir. Es el mismo riesgo
  que ya existía al revivir por un bloque visible, y el arreglo 1 quita la
  causa que lo haría permanente acá.
- La expansión corta en `MAX_RECIPE_DEPTH`: un árbol que no toca el suelo deja
  de expandirse en vez de colgar.

## Nota de método

Las dos pruebas nuevas se escribieron primero **sin** reproducir el fallo: la
primera versión pasaba con y sin el arreglo, porque la mascota arrancaba con la
mochila vacía y el caso real empezaba con el martillo y cuatro paredes ya
encima. Recién al precargar el inventario el test falló como la partida.

Verificado revirtiendo cada arreglo por separado: sin el 1 se colocan **0**
bloques; sin el 2 el objetivo espera *«aparezca un pizarron»*.
