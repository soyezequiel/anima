# ADR 0056 — El catálogo de sus obras

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Las obras (ADR 0032) son la única cosa del juego que **nunca viene de
fábrica**: el mundo nace con `blueprints: []` y el único camino a esa lista es
`validateBlueprint` en `step.ts`, alimentado por lo que la mascota imagina. Un
plano en una partida es, literalmente, una idea de arquitectura que tuvo ella.

Y no se veía en ninguna parte. Existían tres asomos, todos parciales:

- la silueta fantasma en el tablero, pero **solo mientras la está
  construyendo** (ADR 0049);
- el avance en el panel de objetivos («escuela: 0 de 5 puestos»), también solo
  durante el encargo;
- el catálogo de Objetos, que lista las **piezas** (`muro-aula`, `pizarron`)
  como objetos sueltos, sin decir en ningún lado que pertenecen a una obra ni
  cómo se disponen.

Terminado el encargo, la obra desaparecía de la pantalla. Lo más caro que
inventa —lo que hereda a sus descendientes— era lo único que no se podía
consultar.

## Decisión

Una pestaña **Obras**, con una tarjeta por plano aprendido.

### La forma se dibuja

Es la decisión que carga el panel. «Escuela» no significa nada como texto: hay
que ver que son cinco muros y un pizarrón puestos *así*. La tarjeta pinta la
grilla celda por celda, con el **mismo ícono** que cada bloque tiene en el
tablero y en la mochila (`ItemIcon` / `appearanceFor`), porque una pieza no
puede verse de dos maneras según dónde la mires.

El plano guarda desplazamientos relativos al ancla, que pueden ser negativos;
el view model los **normaliza** a una grilla que empieza en (0,0) y dice dónde
quedó el ancla, para que la pantalla pinte sin hacer cuentas. La celda del
ancla se marca con 🙂: es donde queda ella, y el hueco que el plano deja libre
a propósito para no tapiarse adentro.

### Cada pieza es una puerta

La tarjeta lista lo que el plano **lleva** (4 paredes, 1 pizarrón) y cada pieza
es tocable: lleva al catálogo de Objetos, abre su ficha y la resalta un
momento.

La primera versión ponía ahí una fila estática, «Sale de», con la materia bruta
de la obra entera (4 troncos, 1 arcilla, 1 fibra) calculada bajando el árbol de
recetas del ADR 0031. Decía el total, pero era un número sin camino: no dejaba
preguntar nada más. Y peor, contestaba a medias una pregunta que el catálogo ya
contesta entera — de qué está hecha una pared, qué hace, qué deja al romperse,
cuánta dureza tiene.

La regla que sale de acá: **cuando un dato ya vive bien explicado en otra
pantalla, llevar es mejor que repetir**. Repetirlo obliga a mantener dos
versiones de la misma verdad, y la copia siempre dice menos.

El salto tiene que terminar en la respuesta, no al lado: la ficha se abre, se
trae al centro y destella. Sin eso, saltar dejaba al cuidador en una lista de
25 objetos buscando a mano el que acababa de tocar.

Detalle de implementación que no es detalle: el foco es un **contador**, no un
booleano. Con un booleano, tocar dos veces la misma pieza no cambiaba el estado
y la ficha no volvía a moverse ni a destellar.

## Consecuencias

- Es lectura pura y derivada: `blueprintViews()` se arma de `world.blueprints`
  en cada cuadro. Nada nuevo que guardar.
- Sexta pestaña primaria. El rediseño había bajado de 7 a 4 a propósito, así
  que no es gratis — pero las obras son un concepto propio (cuatro ADRs solo
  para ellas) y meterlas dentro de Objetos las habría dejado tan escondidas
  como estaban. Si la fila de pestañas se vuelve un problema, el candidato a
  fusionarse es Obras dentro de Objetos, no al revés.
- El panel muestra las obras **heredadas** igual que las propias: una
  generación nace sabiendo levantar lo que imaginó su antecesora
  (`inheritWorldRules`), y ahora puede verlo.

## Lo que este panel deja a la vista

Escribirlo hizo evidentes dos cosas que ya estaban en el código y que conviene
anotar, aunque no se resuelvan acá:

1. **La obra es la única invención sin juez de IA Dios.** Recetas,
   interacciones y descomposiciones pasan por un juez; el plano solo enfrenta
   la puerta determinista de `validateBlueprint`. Sus piezas se juzgan de a
   una, la disposición no.
2. **El prompt le pide obras más chicas de las que el mundo acepta.** El texto
   de `recipe.propose` dice `offset ∈ {-1,0,1}` y «no más de ~6 bloques porque
   tenés que juntar la obra entera antes de colocarla». La validación real
   admite offsets de ±4 y hasta 24 bloques, y desde el ADR 0034 construye por
   tandas: no necesita cargar todo junto. El prompt quedó congelado en el mundo
   del ADR 0032.
