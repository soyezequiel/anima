# II-0020 — La captura vive en una tabla del mundo, y el pozo entrega ahí por un tercer `into`

**Estado:** aceptado · **Decide:** el usuario, sobre el
[Gate 5→6](../gate-5-6-objetos-emergentes.md) · **Fecha:** 2026-07-31

Refina el [ADR II-0016](II-0016-un-dispositivo-desplegado-retiene-sobre-un-stock.md),
que declaró los cinco campos de estado de un dispositivo desplegado **sin decir
dónde viven**. Contesta las preguntas 1 y 2 de la sección 10 del gate.

## El problema

Un dispositivo desplegado retiene lo que sacó del pozo mientras nadie lo mira. Eso
es estado, y el estado del mundo entra al hash, al guardado y al replay. **La
forma de ese dato es lo caro de cambiar después**: un guardado viejo con la forma
equivocada es exactamente lo que el determinismo del mundo no perdona.

Y hay una trampa que no se ve hasta que hay DOS trampas. Con una sola, las tres
formas posibles se comportan idéntico: el pozo entrega, el dispositivo tiene. La
diferencia aparece recién cuando dos dispositivos compiten por el mismo `Stock`, y
para entonces ya hay guardados hechos con la forma que se eligió.

Las tres formas que estaban sobre la mesa:

| dónde | qué la hacía tentadora | qué la mataba |
|---|---|---|
| en el cuerpo del dispositivo | levantás la trampa y los peces se van con ella, gratis | `Body` es el tipo de la MATERIA —cualidades, partes, masa— y una captura no es ninguna de esas cosas |
| en el `Stock` | la pelea se resuelve donde está la pelea, en un solo lugar | `Stock` es del dios, y el dios existe para decir QUÉ HAY; lo que hizo un aparato que construyó la criatura es otra autoría |
| en una tabla del mundo | no le miente a ningún tipo | una cosa más que hay que meter a mano en el hash, el guardado y el replay |

## La decisión

**Dos mitades, y la segunda sale de la primera.**

### 1 · La captura vive en una tabla de `WorldState`, indexada por dispositivo

Un mapa nuevo al lado de `bodies` y `cells`, con la clave `BodyId` del cuerpo
desplegado. Los cinco campos del ADR II-0016 viven ahí, no en el `Body`.

**Por qué ésta y no las otras dos, en una frase: es la única que no obliga a
ningún tipo a decir algo que no es.** `Body` sigue siendo materia física y
`Stock` sigue siendo el inventario de lo que el dios decretó. Un dispositivo con
captura es una relación entre las dos cosas, y una relación entre dos tablas vive
en una tercera.

Y la competencia se resuelve **recorriendo la tabla en orden de id**, que es el
patrón que el mundo ya usa en todos lados. No es un detalle de estilo: el ataque
al determinismo del Hito 2 ya encontró una vez este mismo agujero con `seq`, y
resolver «quién saca primero» por orden de llegada es la forma exacta de que dos
réplicas del mismo mundo diverjan.

**El precio, dicho y no escondido: levantar la trampa NO se lleva la captura
gratis.** La entrada de la tabla tiene que seguir al cuerpo, y eso es una línea
que hay que escribir y un test que hay que tener. La forma que lo hacía gratis es
la que ensuciaba `Body`, y se prefirió pagar acá.

### 2 · El pozo entrega ahí por un TERCER VALOR de `into`

`Yield.drawFromStock` pasa de `into: 'hands' | 'ground-adjacent'` a tener un
destino más para el dispositivo.

**Por qué un valor y no un `Yield` nuevo:** es **el mismo hecho** —algo sale del
pozo— y lo único distinto es adónde va, que es literalmente para lo que existe
`into`. Un verbo aparte serían dos lugares describiendo el mismo evento, con la
conservación cobrándose en uno y teniendo que acordarse del otro.

Y tiene una ventaja mecánica que decide sola: **todo `switch` sobre `into` se pone
rojo al compilar**. Ningún consumidor se puede olvidar del caso nuevo en silencio,
que es justo la clase de error que este repo persigue por nombre.

`admit()` sigue siendo la puerta: el destino nuevo pasa por ahí o la conservación
deja de cobrarse.

## Lo que se descartó, y por qué

- **La captura en el cuerpo.** Meterle a `Body` un campo que no es físico lo
  ensucia para siempre, y `Body` es el tipo que el modelo va a leer cuando escriba
  habilidades. Peor: no ahorra el orden determinista —dos trampas sacando cada una
  por su lado igual necesitan un orden explícito— así que el trabajo no se evita,
  sólo se esconde.
- **La captura en el `Stock`.** Mezcla dos autorías en un tipo del dios. Y deja los
  peces en el río cuando levantás la trampa, que es al revés de lo intuitivo sin
  ganar nada a cambio.
- **La captura como cuerpos de verdad adentro de la trampa.** Es lo más físico y
  lo más en el espíritu del proyecto —la trampa pesaría más—, y está descartado
  por el gate mismo: `inside` hoy se evalúa como «tiene algo encima o lo sostiene
  alguien», y leerlo como contención sería inventar geometría que la física no
  modela. Vuelve a estar sobre la mesa en el Hito 14.
- **Un `Yield` nuevo para retener.** Hace crecer el vocabulario de la física por
  algo que no es física nueva.

## Consecuencias

- **Hito 2 · el hash, el guardado y el replay** suman la tabla, con orden
  determinista por id y consumo reproducible de RNG. Sigue valiendo sin excepción:
  mirar, pensar o renderizar nunca consume RNG.
- **Hito 3 · el presupuesto calórico** se revalida con extracción autónoma encima:
  un dispositivo que saca sin actor tiene la forma exacta de una bomba de materia
  (riesgo 4).
- **La entrada sigue al cuerpo.** Levantar, soltar y destruir un dispositivo
  tienen que mover o borrar su entrada, y eso pide su test — es el precio elegido.
- **`admit()`** valida el destino nuevo, o la conservación se apaga de hecho.
- **Y el costo por tick sigue sin medirse.** Si hay veinte dispositivos, el mundo
  los recorre a todos, todos los ticks. Es la pregunta 6 del gate y sigue abierta:
  se contesta midiendo, no decidiendo.

## Enlaces

- [Gate 5→6](../gate-5-6-objetos-emergentes.md) — el criterio de doce puntos
- [ADR II-0016](II-0016-un-dispositivo-desplegado-retiene-sobre-un-stock.md) — el que esto refina
- [ADR II-0014](II-0014-el-decreto-manda-sobre-la-celda.md) — la otra vez que el orden de resolución era el bug
