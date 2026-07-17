# ADR 0020 — Craftear es intentar: los desenlaces son del mundo

Fecha: 2026-07-16 · Estado: aceptada · Enmienda el ADR 0018

## Contexto

`resolveCraft` consumía los ingredientes y spawneaba `recipe.output` clonado
tal cual, siempre. `Recipe` declaraba un único `output` fijo, así que las
cuatro recetas del mundo producían el mismo arquetipo hasta el decimal: con los
ingredientes en la mano, el resultado ya estaba escrito.

Eso no es una simulación, es una fórmula. La visión pide lo contrario —
craftear tiene que admitir variación: calidad del producto, fallos, resultados
distintos entre intentos.

La tensión: el principio 1 del README dice que el motor es determinista y los
snapshots reproducibles. Y era literalmente cierto — `world.rng` existía en el
estado y viajaba en cada snapshot desde siempre, pero **ningún sistema lo
leía**. El mundo tenía un dado guardado y nunca lo tiraba.

## Decisión

**Tener los ingredientes da derecho al intento, no al producto.**

`Recipe` declara `outcomes: RecipeOutcome[]` — una lista de desenlaces con peso
relativo. `resolveCraft` tira `world.rng` y elige entre ellos. Cada desenlace
puede traer:

- `output`: el arquetipo que aparece. Ausente, el intento no produce nada.
- `quality: {min, max}`: un factor muestreado que escala los componentes
  graduables del producto.
- `spares`: lo que ese desenlace *no* gasta.

Que el dado sea el del mundo —y no `Math.random()`— es lo que sostiene el
principio 1: el estado del PRNG viaja en el snapshot, así que la corrida varía
entre intentos y se reproduce clavada con la misma semilla. **Dejó de ser
predecible sin dejar de ser reproducible**, que no es lo mismo.

Una receta de un solo desenlace sin `quality` es determinista. La forma vieja
del mundo sigue siendo expresable, ahora como el caso particular que era — y
así se leen los guardados anteriores (`normalizeRecipe`, en la frontera de
`restoreSnapshot`).

### La calidad gradúa qué tan bueno sale, no qué es

`scaleByQuality` toca `durability`, `hardness`, `tool.power` y
`heatSource.warmthPerTick`. Lo que deja afuera importa más:

- `hazard`, porque escalarlo haría que "mejor" quisiera decir "más peligroso".
  Arrimarse a una fogata mala quema igual que a una buena.
- `heatSource.range`, porque el alcance es la forma del fuego, no su calidad.
- `drops`, porque **la suerte decide qué tan bueno sale algo, nunca cuánta
  materia hay** (ADR 0008). Un objeto que sale mejor no puede devolver más
  madera de la que costó.

### Los pesos no son de ella

La mascota propone un `RecipeProposal`: un arquetipo único, su idea de *qué*
quiere construir. Los desenlaces —con qué fidelidad le sale— los deriva el
mundo del otro lado de `validateRecipe`.

El motivo es que **un peso es infalsificable**. La puerta del ADR 0018 puede
comprobar que una idea no crea materia, ni comida, ni poderes que el mundo no
tiene; no puede comprobar que "sale bien 9 de cada 10". Dejarle declarar sus
propios pesos sería dejarla inventarse la suerte: la versión probabilística de
aprobarse su propio examen.

Y como ningún desenlace derivado escala por encima de 1, el arquetipo que
propuso —ya limitado por las cotas del esquema— es el techo. Lo que la puerta
topea sigue topeado *después* de la tirada: la calidad no es la rendija por
donde colar una antorcha que caliente más que el máximo del mundo.

### Fallar no es un castigo

Un desenlace fallido que se lleva todo no se puede reintentar. Por eso
`spares`: el fuego que no prende quema el tronco pero deja el pedernal — una
piedra no se gasta porque la chispa no agarre. Se pierde el material, nunca la
posibilidad de volver a intentarlo.

Los dos oficios del mundo fallan distinto, y esa diferencia es la que hace que
la tirada signifique algo en vez de ser ruido parejo encima de todo:

| | qué varía | falla |
|---|---|---|
| encender (fogata, antorcha) | el calor, entre ~0.55× y ~1.15× | **sí, 10%** — conserva el pedernal |
| carpintear (silla, empalizada) | la durabilidad y la dureza | **no**: la madera ya está ahí |

## Consecuencias

- Medido sobre 200 intentos de las recetas reales: la fogata sale 185/200 con
  calor entre 0.17 y 0.34 (catálogo: 0.3); la silla sale 200/200 con
  durabilidad entre 4 y 7 (catálogo: 6).
- **Un test que craftea y afirma que el producto salió está midiendo la
  suerte.** Cuatro lo hacían sin saberlo (`crafting`, `cold`, `pain`,
  `cold-night-unlit`): pasaban porque el dado de su semilla caía bien, y se
  habrían roto en cuanto otro sistema consumiera tiradas antes que ellos.
  Ahora usan `withoutChance(recipe)`: que el mundo *permita* la cadena es una
  pregunta distinta de si la chispa agarró esta vez, y la segunda se prueba en
  sim-core, que es de quien es esa regla.
- El evaluador de skills todavía mide el éxito como booleano sobre semillas
  fijas. Con el crafteo variable, una skill que construye puede pasar o fallar
  por la tirada, y un veredicto binario lo lee como capacidad cuando es suerte.
  Medir el éxito como distribución pasa a ser la brecha más urgente.
- `resolveCraft` es el primer lector de `world.rng`. El día que los drops
  también tiren (la brecha que queda de este eje), consumirán del mismo dado y
  correrán la secuencia: es esperable, y por eso ninguna prueba debe depender
  de una tirada que no sea suya.
