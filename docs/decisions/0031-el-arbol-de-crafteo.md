# ADR 0031 — El árbol de crafteo: lo complejo se hace de lo simple

Fecha: 2026-07-17 · Estado: aceptada · Enmienda los ADR 0018 y 0022

## Contexto

En una corrida real el cuidador escribió «construi una ciudad», y Ánima
contestó:

> No pude completar eso: me faltan 3 troncos y 4 pedernales y no veo más por acá.

La frase tiene dos mentiras en un renglón, y ninguna es culpa del modelo:

1. **Una ciudad cuesta 7 objetos.** Lo mismo que una fogata, más o menos.
2. **Una ciudad es un objeto.** Si hubiera tenido los troncos y los pedernales,
   el resultado habría sido *peor* que el error: `resolveCraft` habría hecho
   `spawn` de una entidad `ciudad` de una celda, apoyada al lado de ella.

La puerta del ADR 0018 no tenía cómo atajarlo. Comprueba que una receta sea
coherente con la física —que no invente comida, ni materia, ni poderes que el
mundo no tiene— y `3 troncos + 4 pedernales → ciudad` **pasa todos esos
controles**. Es coherente. Es solo absurda, y la escala no estaba escrita en
ninguna regla: nadie había dicho nunca que una ciudad es más que una fogata.

La raíz es el tipo `Recipe`: lista de ingredientes → **un arquetipo**, en un
salto. Y los ingredientes que Ánima podía proponer salían únicamente de lo que
veía o llevaba encima (`invention.ts`), así que toda receta inventada era
forzosamente *materia cruda → cosa final*. La arquitectura no podía expresar
tronco → tabla → pared → casa. El modelo no eligió mal: no existía la forma de
decirlo.

Es el «bloque casa»: en vez de bloques con los que construir una casa, un ítem
casa. El pedido del dueño fue tener elementos básicos y componer lo complejo
con ellos.

## Decisión

**Una receta puede pedir lo que otra receta produce.** Lo complejo deja de
declararse y pasa a derivarse.

### El costo no se declara: se deriva

`expandRecipeCost` (sim-core) resuelve el árbol hasta la materia base y suma.
Nadie escribe lo que cuesta una casa: cuesta lo que cuestan sus paredes, que
cuestan lo que cuestan sus tablas. Es fuente de verdad única —el mundo la usa
para decidir, la mascota para explicar—, igual que `missingIngredients` desde
el ADR 0017: Ánima nunca puede decir «me falta X» y que el mundo opine distinto.

Una idea barata deja de ser barata por decreto: si la ciudad son ocho casas, la
ciudad cuesta ocho casas, le guste a quien la propuso o no.

### La puerta exige que la cadena toque el suelo

Dos controles nuevos, los dos deterministas:

- **Alcanzabilidad**: cada ingrediente tiene que ser materia que el mundo tiene
  (existe, la sueltan los `drops`, la produce un `itemSource`) o el producto de
  una receta que ya existe. Sin esto la puerta admitía `casa = 8 paredes` en un
  mundo sin paredes: una receta muerta, imposible de construir para siempre, que
  además le habría hecho creer a Ánima que ya sabía hacer una casa.
- **Sin ciclos**: si `pared` necesita `casa` y `casa` necesita `pared`, no hay
  materia base abajo. Un árbol que no toca el suelo no es un árbol. No alcanza
  con mirar los ingredientes de a uno —cada uno existe— : se ve siguiendo el
  árbol entero, y por eso la puerta corre `expandRecipeCost` con la receta
  nueva ya puesta.
- **Una cosa se hace de una sola manera**: no entran dos recetas que produzcan
  lo mismo. No es una verdad del universo, es lo que hace que el árbol tenga
  UNA lectura: con dos recetas de tabla, "de qué está hecha una tabla" tiene
  dos respuestas, el costo de una casa depende de cuál mire cada quien, y un
  ciclo puede esconderse detrás de la que nadie mira.
- **Lo que no se puede levantar no es ingrediente**: construir deja lo hecho en
  el suelo y los ingredientes salen del inventario, así que una pieza sin
  `portable` no se puede ensamblar por más que exista la receta que la hace.
  Esta regla es la que convierte a las piezas intermedias en bloques que se
  llevan en la mano — la ontología de Minecraft, que era el pedido original.

### Inventar es proponer un plan, y el plan entra de abajo hacia arriba

`recipe.propose` devuelve un plan (`recipe-plan`), no una receta. El agente lo
ordena topológicamente —de las hojas al tronco— y emite **una receta por tick**,
cada una por la misma puerta de siempre. Una respuesta vieja de un solo elemento
se lee como un plan de uno: la forma anterior sigue siendo expresable, como el
caso particular que era.

Nada de esto le da poder nuevo al agente: sigue sin tocar `world.recipes`, sigue
proponiendo de a una, y la puerta sigue siendo la ley. Lo único que cambia es
que ahora puede tener una idea que necesita otra idea abajo.

Que una receta del plan entre y la de arriba se caiga no se deshace: aprender a
hacer paredes es conocimiento aunque la casa no salga. Nada se revierte.

### Construir resuelve el árbol

`gatherAndCraftProgram` deja de ser «juntar del suelo y craftear». Si le falta
una pieza que **sabe hacer**, la hace: el programa se compone recursivamente y
la recursión termina en la materia base. Lo que está tirado en el suelo se
prefiere a fabricarlo — recoger una tabla es más barato que partir un tronco—,
y eso lo decide el mundo en tiempo de ejecución (`branch` sobre `sees`), no el
planificador al generar el programa.

### Los dados se multiplican, así que hay margen para reintentar

Construir es intentar (ADR 0020) y una idea nueva falla 1 de cada 10 veces. En
una receta suelta eso es un mal rato; en un árbol es otra cosa: el castillo del
mock son siete tiradas —cuatro tablas, dos paredes y él mismo— y siete tiradas
salen todas bien menos de la mitad de las veces. La primera corrida con el
árbol lo mostró en el acto: la pared falló, se llevó las dos tablas y la obra
entera murió con cuatro troncos todavía en el suelo.

Dos cambios, los dos en el programa y ninguno en el dado:

- **El bucle de una pieza que hay que FABRICAR admite el doble de vueltas.**
  Recoger no falla; construir sí. Cuando sale bien no cuesta nada, porque
  `until: canCraft` corta apenas alcanza.
- **Recoger lo hecho solo si salió** (`branch` sobre `sees`). Sin esto, un
  intento fallido mandaba a la mascota a buscar una tabla que no existía y la
  obra abortaba con «no lo encuentro», que además es mentira: no es que no lo
  encuentra, es que esta vez no le salió.

Perder la tirada sigue costando el material. Lo que ya no cuesta es la obra.

## Lo que esto NO arregla, a propósito

**La escala sigue sin juez.** Si el modelo propone «ciudad = 3 troncos» en un
solo salto, la puerta la sigue aceptando: es coherente con la física. Ninguna
regla determinista sabe lo que *debería* costar una ciudad, y meterle un número
a mano sería inventar una vara falsa. Lo que cambia es que descomponer ya es
expresable y es la forma natural que el protocolo pide, y que cuando descompone,
el costo que sale es real.

Y el costo real destapa el límite siguiente. Si una casa son 8 paredes, Ánima
necesita 8 paredes **en las manos**, y su inventario tiene capacidad 6. La casa
no le entra en los brazos. Eso no es un bug: es la pista de que lo grande no es
un objeto que se sostiene, es una obra que se levanta pieza por pieza en el
suelo — el eje B, que va en el ADR 0032 (`place` y las estructuras como plan de
colocaciones). Este ADR es el que hace que ese límite se vea, y que se vea con
un número honesto en vez de con una mentira barata.
