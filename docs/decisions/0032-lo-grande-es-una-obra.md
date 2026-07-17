# ADR 0032 — Lo grande no es un objeto, es una obra

Fecha: 2026-07-17 · Estado: aceptada · Continúa el ADR 0031 (eje B del árbol de crafteo)

## Contexto

El ADR 0031 hizo que lo complejo se derivara de lo simple: una casa cuesta lo
que cuestan sus paredes, que cuestan sus tablas. Pero dejó el último eslabón sin
tocar, y lo dijo con todas las letras: construir una casa seguía haciendo `spawn`
de **una entidad `casa` de una sola celda** al lado de la mascota. El «bloque
casa» que el dueño criticó desde el principio.

Y el propio ADR 0031 dejó servida la pista de por qué eso está mal: si una casa
son 8 paredes, hacen falta 8 paredes **en las manos**, y el inventario tiene
capacidad 6. La casa no entra en los brazos. No es un bug de capacidad — es que
una casa no es algo que se sostiene. Es algo que se levanta, pieza por pieza, en
el suelo.

## Decisión

**Una casa deja de ser una entidad y pasa a ser lo que queda cuando pusiste las
paredes donde van.** No hay entidad `casa`: hay paredes, en un lugar, formando
una casa. La casa es una disposición en el espacio, no un objeto en una celda.

### La primitiva que faltaba: colocar

`place` (intención de sim-core): poner un bloque que se lleva encima en una celda
**adyacente, vacía y dentro del mapa**. Es la hermana de `drop` —que suelta a los
pies— pero con puntería: `drop` deja caer donde estás, `place` elige la celda. La
física es del mundo, como siempre: si la celda está ocupada o fuera de alcance, no
se coloca, y ese fallo es información.

### Un plano es un plan de colocaciones, no una receta

`Blueprint` (dato del mundo, hermano de `Recipe` e `Interaction`): un id y una
lista de `placements`, cada uno un `{ kind, offset }`. «Una casa son cuatro
paredes: una al norte, una al sur, una al este, y al oeste queda la puerta.» Vive
en `world.blueprints`, viaja en los snapshots, y una vez aprendido no se reinventa
— igual que las recetas y las interacciones.

Un plano **no produce ninguna entidad nueva**. Construirlo es colocar sus bloques.
Cuando están todos puestos, la obra está: no hay un `casa` que aparezca, porque la
casa ya está ahí, hecha de paredes.

### La puerta que juzga un plano

`validateBlueprint`, hermana de `validateRecipe`. Lo que comprueba:

1. **Los bloques se pueden conseguir**: cada `kind` es materia del mundo o algo
   que una receta sabe hacer (misma lógica que el ADR 0031 — `obtainableKinds` +
   `recipeProducing`). Un plano de paredes en un mundo que no sabe hacer paredes es
   un plano muerto.
2. **Solo bloques que se pueden levantar**: para colocar algo hay que llevarlo, y
   para llevarlo tiene que ser `portable`. La misma frontera que encontró el eje A.
3. **Tipos protegidos afuera**: no se coloca `pet`, `food` ni `tree` (ADR 0018).
4. **El footprint es alcanzable**: cada offset está a distancia Chebyshev 1 del
   ancla y ninguno es (0,0). Es la restricción del MVP y su límite honesto (abajo).
5. **Sin celdas repetidas**: dos bloques no van a la misma celda.
6. **Cabe en los brazos**: la obra se junta ENTERA antes de colocarse (abajo),
   así que un plano de más bloques de los que la mascota puede cargar es
   inconstruible. La puerta lo rechaza con el número — el mundo conoce la
   capacidad del que construye, y una obra que no le entra no es una obra
   posible. Esta regla nació de una corrida real: el modelo propuso una casa de
   7 paredes con capacidad 6, el mundo la aceptó, y el intento murió sin decir
   por qué. El costo honesto del eje A destapó el límite; esta regla lo hace
   cumplir.
7. **Higiene**: id único, al menos un bloque, tope absoluto de bloques por plano.

Lo que **no** juzga: si la casa es linda, ni si sirve. Juzga si es una obra
posible, no si es una buena obra.

### Quién decide si algo es objeto u obra: el modelo

La intención del cuidador sigue siendo `craft-item` («construí una casa» es
construir, ADR 0022). Al proponer cómo, el modelo contesta con lo que la cosa
**es**: una receta (un objeto), un árbol de recetas (un objeto de partes, ADR
0031), o un plano (una obra). El tipo de la respuesta ES la decisión, y la toma
quien entiende qué es una casa — el modelo, no el intérprete ni el agente. Es la
misma línea del ADR 0024: describir no es poder, pero clasificar la naturaleza de
una cosa es exactamente el trabajo del modelo.

Una respuesta de plano trae las dos cosas: las recetas de las piezas (las paredes,
las tablas) **y** el plano que las dispone. El agente entra las recetas primero
—de las hojas al tronco, ADR 0031—, después propone el plano, y recién entonces
construye: junta las paredes (que ahora sabe hacer) y las coloca donde el plano
dice.

### Construir la obra: juntar todo, después colocar

El programa de una obra tiene dos actos:

- **Juntar**: conseguir todos los bloques, con la maquinaria del eje A (los fabrica
  si sabe, los recoge si los ve). Termina con los bloques encima.
- **Colocar**: poner cada bloque en su celda alrededor de donde quedó parada. No
  se mueve entre colocaciones, así que las celdas —relativas a su posición— son
  estables mientras coloca. Un bloque por tick, y si una celda quedó ocupada, esa
  colocación falla y la obra queda a medias: **construir sigue siendo intentar**
  (ADR 0020), ahora también en el espacio.

Que junte todo antes de colocar es lo que ata el MVP a la capacidad del inventario:
una obra no puede pedir más bloques de los que entran en los brazos. Ese límite no
queda solo en la prosa — lo cierran cuatro capas: el modelo recibe su presupuesto
de bloques en el prompt, la puerta rechaza la obra que lo excede, el motivo del
rechazo viaja a la próxima idea (ADR 0018) para que proponga una casa más chica, y
si aun así una obra vieja no le entra, lo dice con el número en vez de un «no pude».

## Los límites del MVP, a propósito

- **El footprint es de 3×3**: la obra se levanta alrededor de la mascota, sin que
  ella camine entre bloque y bloque. Alcanza para un anillo de paredes con una
  puerta —una casa reconocible hecha de bloques, que es el salto que importa frente
  al «bloque casa»— pero no para un castillo de veinte celdas. Lo grande de verdad
  necesita que camine mientras construye, y eso pide mover-hacia-una-posición en la
  DSL, que hoy solo sabe perseguir entidades (ADR 0005). Es el eje siguiente.
- **La obra vive dentro del inventario**: como se junta entera antes de colocarse,
  no puede tener más bloques de los que la mascota carga (capacidad 6 hoy → hasta
  6 paredes, un anillo con puerta). Un castillo necesitaría juntar-y-colocar por
  tandas volviendo a un ancla, que es otra vez el mover-hacia-una-posición del eje
  siguiente. Hasta entonces, la casa es chica pero de verdad — bloques en el suelo.
- **Se puede tapiar sola**: si el plano la rodea de paredes sólidas, queda adentro.
  No es un crash, es el mundo siendo honesto — y un plano con puerta la deja salir.
  El modelo que propone la forma es responsable de dejarla; el mock deja una.
- **La obra no es una entidad**, así que no se puede «tener una casa» como se tiene
  un tronco: no se recoge, no se rompe de un golpe, no da un componente. Es un lugar,
  no una cosa. Eso es exactamente lo que se quería, y también lo que habrá que
  darle nombre el día que algo necesite preguntar «¿estoy dentro de una casa?».
