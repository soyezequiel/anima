# ADR 0077 — Lo que construye puede cambiar por dónde se camina

Fecha: 2026-07-19 · Estado: aceptada

## Contexto

El primero de los mapas de prueba (ver [ADR 0080](0080-los-mapas-son-pruebas-de-aceptacion.md))
puso un río de borde a borde con toda la comida del otro lado, y le pidió a Ánima
que fabricara algo, lo pusiera sobre el agua y cruzara.

Ella hizo la parte difícil: inventó la receta, el juez la aprobó, la puerta la
aceptó, juntó los materiales y fabricó el objeto. Y ahí el mundo se terminaba.

Dos comprobaciones, escritas con años de distancia, se sumaban a un techo del
que no había salida:

1. **`resolveMove` rechazaba toda celda con agua**, mirara lo que mirara que
   hubiera encima.
2. **`resolvePlace` rechazaba toda celda con CUALQUIER entidad** —
   `entitiesAt(...).length > 0`— y el agua es una entidad. No se podía ni
   siquiera apoyar nada sobre el agua.

Juntas decían algo que ningún ADR había decidido nunca: **el terreno es
inmutable, y nada de lo que Ánima invente puede cambiar la forma de los
caminos.** Un mundo donde inventar no puede cambiar por dónde se camina es un
mundo donde inventar promete más de lo que da: se pueden imaginar herramientas,
abrigos y fogatas, pero la geografía es un techo contra el que solo se puede
chocar.

Y no había forma de descubrirlo desde adentro. La mascota podía fabricar una
balsa perfecta y quedarse parada al lado del río para siempre, sin ningún
mensaje que dijera por qué.

## Decisión

**Las cosas pueden ofrecer dónde pisar, y sobre el terreno se construye.**

### 1. `footing`: una propiedad, no un puente

Un componente nuevo, del mismo tamaño conceptual que `portable`: se tiene o no
se tiene. Una entidad con `footing` **se puede pisar**, y parada encima, el
terreno de abajo deja de importar.

No se llama «puente», ni «tabla», ni «balsa». Es una propiedad y cualquier cosa
puede tenerla; qué cosa la tiene, cómo se llama y de qué está hecha lo decide
quien la imagine. La puerta de recetas la admite como admite las demás
(`INVENTED_COMPONENT_BOUNDS`), y la IA Dios sigue juzgando si tiene sentido que
ESA cosa la ofrezca — una piedra sí, una llama no.

### 2. Un piso no es un muro

Tres consecuencias que van juntas, o la propiedad no serviría de nada:

- `impedimentAt` (la única fuente de verdad sobre qué se puede pisar, extraída
  en este mismo cambio de `resolveMove`) devuelve «se puede» si algo en la celda
  ofrece `footing`, aunque haya agua y aunque ese mismo objeto sea sólido.
- El invariante `no-solid-overlap` **ignora lo que ofrece dónde pisar**. Sin
  esta excepción, pararse sobre lo que uno construyó sería una violación del
  motor, y el evaluador de habilidades lo contaría como una falta.
- La percepción lo expone (`footing?: boolean`). Sin verlo, lo que ella misma
  construyó para abrirse paso le seguiría pareciendo un obstáculo.

### 3. Sobre el terreno se construye; sobre una cosa, no

`resolvePlace` ya no cuenta el agua como ocupante: lo que impide colocar es que
haya **otra cosa** ahí. El agua no ocupa el lugar de un objeto — es el suelo
(mojado) que hay debajo.

Que la comprobación anterior dijera «cualquier entidad» no era una decisión de
diseño sobre el terreno: era el terreno colándose en una regla que hablaba de
cosas.

## Consecuencias

Ánima puede cambiar la forma de su mundo, y eso es nuevo. En la corrida
siguiente el modelo usó `footing` sin que nadie se lo pidiera, y lo explicó él
mismo:

> «El componente footing hace que vos puedas pisarla sobre el agua de verdad;
> portable permite llevarla y collider no bloquea el paso. No pretende navegar:
> es una balsa honesta de una celda que vuelve caminable el agua.»

Lo que NO cambia, y es deliberado: `footing` no crea materia, no alimenta, no da
calor y no puede fabricarse sobre tipos protegidos. Inventar sigue dando
capacidades, no recursos (ADR 0008). Un piso sobre el agua cuesta exactamente lo
que cuesten sus materiales, y ponerlo mal —o gastar los troncos en uno que no
alcanza a cruzar— sigue siendo un error que el mundo cobra.

Queda un límite honesto: una obra de varios bloques (ADR 0032) todavía se planta
en un sitio de suelo firme (`structureSite`, ADR 0049/0071), así que **una
pasarela larga levantada como obra sigue sin poder plantarse sobre el río**. Se
puede cruzar poniendo piezas de a una; levantar un puente entero como obra, no.
Está anotado como limitación, no resuelto.

Las regresiones viven en `packages/sim-core/tests/footing.test.ts`, y ninguna
nombra un puente ni una misión: prueban la regla, no el caso.
