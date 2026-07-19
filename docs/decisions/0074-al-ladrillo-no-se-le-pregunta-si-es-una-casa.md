# ADR 0074 — Al ladrillo no se le pregunta si es una casa

Fecha: 2026-07-18 · Estado: aceptada · Corrige el alcance del ADR 0072

## Contexto

El ADR 0072 le agregó al juez de recetas una segunda pregunta: «¿esto es una
cosa, o es un lugar?». Funcionó — en la corrida siguiente le pidieron una cocina
y el juez la frenó con «una cocina no es una cosa, es un lugar», y ella se
corrigió sola:

> «Tenías razón: una cocina no es un bloque, es un lugar, así que te la propongo
> como obra. El fogón (2 piedras + pedernal) va al frente…»

Es exactamente lo que el ADR quería. Y entonces el juez rechazó el fogón:

> «No: eso no es una cosa, es un lugar. Le pusiste nombre de cocina a un solo
> bloque que arde, bloquea el paso y encima quema al tocarlo…»

Un fogón es una cosa. Es el caso de la fogata que el propio ADR 0072 escribió
como contraejemplo. Pero el juez lo miró suelto, sin saber que era un ladrillo de
la obra que ella acababa de proponer, y el nombre le sonó a cocina.

La obra se cayó entera —tumbar una pieza vacía el plan— y el cuidador terminó
con un objetivo `failed` y un «no sé qué construir». Peor que antes del ADR 0072,
que al menos le daba una cocina de un bloque.

La causa es de ubicación, no de criterio. El juez corre **por receta**, y las
piezas de una obra pasan por él una por una. Preguntarle a cada ladrillo si
debería ser una casa es preguntar mal.

Y el ADR 0032 ya tenía la respuesta escrita:

> El tipo de la respuesta ES la decisión, y la toma quien entiende qué es una
> casa — el modelo, no el intérprete ni el agente.

Cuando el modelo contesta con un plano, **ya contestó que lo pedido es un lugar**.
La pregunta está hecha y respondida antes de que el juez vea la primera pieza.

## Decisión

La segunda pregunta del ADR 0072 se hace **solo sobre lo pedido**, nunca sobre las
piezas de una obra.

El pedido al juez lleva `partOfWork`, que el agente pone cuando hay un plano
esperando (`pendingBlueprint !== null`). Con esa marca, el prompt vuelve a tener
una sola pregunta —la de siempre, si el paso es un paso— y se le dice por qué,
para que no lo deduzca del silencio: esto es una pieza de una obra ya decidida,
la obra es el lugar, y una pieza puede llamarse «fogón» o «mesada» y ser
exactamente lo que tiene que ser.

Se le agrega además que rechazar una pieza cuesta doble: se lleva puesta la obra
entera que la esperaba.

## Consecuencias

Vuelve a haber un solo lugar donde se decide objeto-vs-obra, que es donde el ADR
0032 lo había puesto: el tipo de la respuesta del modelo. El chequeo del ADR 0072
deja de ser una segunda opinión y pasa a ser lo que debía ser — una red para
cuando el modelo contesta «receta» sobre algo que es un lugar.

Queda un hueco conocido: si el modelo propone la obra pero una de sus piezas es
de verdad un lugar (una «cocina» dentro de la cocina), nadie la va a frenar. Es
el precio de no preguntar, y es barato: el plano ya obliga a que cada pieza vaya
en una celda, así que una pieza que fuera un lugar se notaría al levantarla.

La regresión vive en dos archivos, porque el agujero también era doble: el prompt
(`packages/model-providers/tests/codex.test.ts`) y **el cableado**
(`packages/agent-core/tests/pieza-de-obra.test.ts`), que es donde estaba el fallo
real — el prompt sabía distinguir los dos casos, pero nadie le decía cuál era.
