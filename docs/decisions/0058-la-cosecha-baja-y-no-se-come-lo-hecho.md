# ADR 0058 — La cosecha baja, y no se come lo hecho

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El cuidador avisa que la escuela no se termina. Estado real: plano de 5
`pared-aula` + 1 `pizarron`, cuatro paredes puestas, `pared-aula = 1x log`,
**cero troncos sueltos** en el mapa y **tres árboles** a la vista. Cien ticks
más tarde, los mismos tres árboles intactos.

Dos defectos, y el primero tapaba al segundo.

### 1. La cosecha se perdía un escalón más abajo

`fetchOrMakeOps` sabe tres formas de conseguir algo: recogerlo suelto,
fabricarlo si hay receta, o **cosecharlo** rompiendo lo que lo deja caer (ADR
0051). La tercera vive en `options.harvestSource`.

Cuando lo pedido tiene receta, recurre a `gatherAndCraftProgram` para sus
ingredientes. Esa llamada propagaba `searchFirst`, `recipes`, `rememberedWalk`
y `keepKinds`... y **no `harvestSource`**.

O sea: para conseguir un tronco, sabía talar. Para conseguir una *pared* —que
se hace con un tronco— ya no, porque la sub-receta viajaba ciega. Sin troncos
sueltos no había pared posible, rodeada de árboles. Lo que arriba era una
capacidad, un nivel más abajo era ceguera.

Es el mismo error de forma que el ADR 0031 arregló para el costo (el árbol se
derivaba entero) pero que quedó pendiente para las *capacidades*: no basta con
que la recursión sepa qué falta, tiene que llevarse consigo cómo conseguirlo.

### 2. Rompía lo hecho para sacar de qué está hecho

`harvestSourceFor` elige la fuente **más blanda** (menos golpes) y después la
más cercana. Al romperse, una `pared-aula` devuelve su tronco — así que figura
como fuente de troncos. Y una pared (dureza ~2) es mucho más blanda que un
árbol (dureza 5).

Con los datos de la partida real, las cuatro fuentes de tronco mejor rankeadas
eran **sus propias paredes ya colocadas**. Para conseguir el tronco de la
quinta pared, la elección era demoler una de las cuatro. Un círculo perfecto.

Lo mismo valía para el refugio (`shelter = 3x log`): romperlo devuelve tres
troncos, cuesta menos golpes que un árbol, y destruye justo lo que la mantiene
viva cuando tiene frío.

Este defecto **no se manifestaba** mientras el defecto 1 estuviera presente: la
cosecha nunca llegaba a consultarse a ese nivel. Se ve apenas se arregla el
primero.

## Decisión

**1. `harvestSource` viaja hacia abajo** en la recursión de sub-recetas, igual
que el resto del contexto.

**2. Nunca cosechar algo hecho de lo que se busca.** `isMadeFrom(product,
material, recipes)` sigue el árbol hacia abajo —una casa se hace de paredes,
que se hacen de tablas, que se hacen de troncos— y responde si romper eso sería
deshacer trabajo propio.

La regla es un invariante económico, no una heurística: **romper X para sacar
la materia de X siempre da saldo negativo**. Se recupera parte de lo que costó
y se pierde el X. Que además sea lo más blando —justamente porque está hecho,
no bruto— es lo que lo volvía la primera opción.

Vive en `sim-core` junto a las otras preguntas sobre recetas, y la usan los dos
lugares que la necesitan: el planificador al elegir qué romper
(`harvestSourceFor`) y la decisión de aceptar el encargo (`harvestableCount` en
`refusal.ts`). Sin lo segundo, prometía juntar cinco troncos porque veía cinco
paredes: prometer demoler para construir.

## Consecuencias

- Un encargo cuya materia base se cosecha ya no depende de que haya ejemplares
  sueltos: la cadena entera —talar, fabricar la pieza, colocarla— se compone.
- La mascota deja de tener a su propia obra, y a su refugio, como "recursos".
- Queda vivo un caso legítimo que la regla NO cubre: romper algo hecho de X
  para obtener un Y distinto que también deja (una pared que dejara tornillos).
  La regla solo mira la materia buscada, así que eso sigue permitido — es
  correcto: ahí no se está deshaciendo el trabajo, se está reciclando.

## Nota de método

Diagnostiqué el defecto 2 primero, leyendo los datos de la partida y ordenando
a mano las fuentes de tronco como lo haría el planificador. Era cierto que sus
paredes encabezaban ese orden — pero **no era lo que estaba pasando**: con el
defecto 1 vivo, esa función ni siquiera se consultaba. Lo confirmé recién al
escribir la prueba, que sin el arreglo 1 dejaba los árboles intactos.

Las dos pruebas de causa se corrieron revirtiendo cada arreglo por separado:
sin el 1, los tres árboles quedan en pie y la obra no avanza; sin el 2, el
refugio queda en cero.
