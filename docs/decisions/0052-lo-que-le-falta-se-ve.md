# ADR 0052 — Lo que le falta se ve, no se adivina

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Los objetivos ocupaban seis líneas dentro de la pestaña Estado, entre la mochila
y la memoria. Cada uno mostraba dos cosas: el estado crudo del motor
(`suspended`) y la frase del objetivo. Nada más.

Eso dejaba al cuidador ciego justo donde más falta hacía verla:

1. **No se sabía qué estaba esperando.** Un objetivo suspendido dice «esperando
   material» y ahí termina. ¿Cuál material? ¿Cuánto? ¿Ya tiene la mitad? La
   respuesta existía —es la misma cuenta con la que ella se suspende y retoma
   sola (ADR 0046)— pero solo salía convertida en una **oración** para el chat.
   La pantalla no tenía los datos, así que no podía dibujar nada.

2. **No se sabía si podía resolverlo sola.** «Le falta un muro» y «le falta un
   muro **y no lo ve por ningún lado**» piden cosas distintas del cuidador: la
   primera no pide nada, la segunda pide que se lo traigan. Sin esa distinción
   uno mira la pantalla y no sabe si intervenir o esperar.

3. **La prioridad era invisible.** La lista salía en orden de creación. El
   agente elige por `priority + urgency` (`selectActive`), así que la pantalla
   contaba un orden que el motor no obedecía.

4. **Los suspendidos se contaban como terminados.** `StatusPanel` filtraba con
   `s === 'active' || s === 'pending'` — y `'pending'` **no existe** en
   `GoalStatus`. `'suspended'` caía del lado de "terminados", plegado dentro de
   un `<details>`. Los objetivos que esperan material, que son exactamente los
   que el cuidador puede destrabar, estaban escondidos.

Y una cuarta cosa, del lado del motor: la cuenta de «qué falta» estaba escrita
**tres veces** (`missingForCraft`, `missingKindsForRequest`,
`missingForStructure`), cada una con su propio criterio. Dos descontaban lo ya
levantado y una no. Era pedir que las tres contaran cosas distintas del mismo
objetivo.

## Decisión

**Una sola cuenta, en datos, y una pestaña propia para verla.**

### 1. `neededCountsFor`: la cuenta se escribe una vez

Las tres funciones ahora derivan de una sola (`agent.ts`), que devuelve
`{ kind, need, have }[]`. `need` es lo que falta **levantar** —no lo que pide el
plano entero—, así que un muro ya colocado deja de pedirse. Romper algo no se
acredita con lo que lleva encima: tener un tronco no tala el árbol.

### 2. `goalPlans(perception)`: la cuenta sale en datos, no en frase

Lectura pura, para la pantalla. Cada faltante viaja con dos cosas que la frase
no podía llevar:

- `visible` — hay uno suelto y levantable a la vista: **va sola**.
- `from` — de qué se saca rompiéndolo (`quarry`, `tree`): **va sola, con
  golpes**.
- ninguno de los dos: **no lo ve, alguien tiene que traérselo**.

Esa terna es lo único accionable de toda la pantalla, y es la que decide el
color del chip.

### 3. Pestaña Objetivos

Sale de adentro de Estado. Cada objetivo es una tarjeta con su **puesto en la
fila** (el `rank` real, calculado con el mismo orden que `selectActive`), su
avance si es una obra (`3 de 6 puestos`), y los faltantes **dibujados** con el
mismo ícono que tienen en el tablero y en la mochila.

«Suspendido» es **abierto**, no terminado.

## Consecuencias

- El view model de un objetivo pasa de 4 campos a 9. Es más superficie, pero
  toda derivada: `GameSession` no guarda nada nuevo, y la percepción se
  construye **una sola vez** por cuadro y la comparten las obras plantadas y los
  faltantes — así no pueden contradecirse dentro del mismo frame.
- La pantalla y el motor no pueden discrepar: lo que se dibuja es literalmente
  lo que el agente calcula para suspenderse.
- `StatusPanel` pierde su sección de objetivos. Deliberado: dos pantallas
  contando el mismo objetivo de dos maneras es peor que una sola.
- Unificar la cuenta cambió un caso de `reviveSuppliedRequests`: un encargo de
  «traé un tronco» con el tronco ya en la mano ahora cuenta como cumplido y
  revive, en vez de seguir esperando ver uno tirado. Es el comportamiento
  correcto; antes era un efecto de que esa rama no miraba el inventario.
