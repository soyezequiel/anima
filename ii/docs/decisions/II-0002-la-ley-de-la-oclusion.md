# ADR II-0002 — La ley de la oclusión, que ya estaba invocada sin escribir

Fecha: 2026-07-26 · Estado: aceptado · Agrega la ley 12 a las once del
documento de arquitectura.

## Contexto

`tapar-la-fogata-para-hacer-carbon` es la técnica emblema de toda la
arquitectura: la que demuestra que hacer carbón **no es una receta** sino algo
que la criatura puede descubrir. El documento la explica así:

> una fogata **tapada** da carbón y una al aire libre da ceniza — o sea, *hacer
> carbón es una técnica que la criatura puede descubrir*, no un caso especial.

Y la ley 4 la implementa leyendo `w.oxygenAt(b.at)`.

El problema es que **nadie escribió qué baja ese oxígeno**. La ley 4 lo consume,
la ley 3 lo consume, y ninguna ley lo produce ni lo reduce. Tapar la fogata no
tiene efecto declarado en ninguna parte. El borrador
[`t3/05-tapar-la-fogata.ts`](../../packages/skills/borradores/t3/05-tapar-la-fogata.ts)
quedó a un solo error —`put()` no acepta `covering`— y el error tapa un agujero
mucho más grande: aunque `covering` existiera, no pasaría nada.

Lo mismo bloquea `techo-que-para-la-lluvia` y el «reparo» de
`guarecerse-antes-de-tener-frio`, y explica por qué `'sheltered'` es el faltante
más pedido del pase 2 (3 borradores).

## Decisión

**Se escribe la ley 12, `oclusion`**, y es una ley general, no un caso especial.

> Un cuerpo colocado sobre una celda **reduce el intercambio de esa celda con el
> ambiente**, en proporción a cuánto la cubre y a qué tan permeable es el cuerpo.

Tres consecuencias, y las tres salen de la misma cuenta:

- baja el `oxygen` de la celda → la ley 3 arde peor y la ley 4 da residuo
  carbonoso en vez de mineral (**carbón**);
- baja el acoplamiento térmico con `ambient` de la ley 1 (**reparo**);
- baja el aporte de humedad del ambiente a la celda (**techo**).

La superficie que esto habilita:

```ts
// El cuerpo que ocluye se declara al colocarlo: es una relación espacial,
// no una propiedad del cuerpo.
put(b: BodyView, at: Cell, o?: { onTopOf?: BodyView; covering?: BodyView }): Intent

// Y se lee como cualidad de CELDA, con el mismo verbo que las otras.
export type CellQuality = 'wet' | 'oxygen' | 'temperature' | 'sheltered'
```

`sheltered` es **derivada**, no guardada: es la oclusión acumulada de la celda.
Y `permeability` entra al vector de cualidades de la sustancia, porque una malla
tapa distinto que una piedra — que es lo que hace que tejer valga la pena.

## Por qué así y no de otra forma

Se descartó **«si hay un cuerpo con `onTopOf` apuntando a éste, restale 0.5 al
`oxygenAt`»**. Es la tabla por situación disfrazada de ley, exactamente lo que el
documento le reprocha a las tres propuestas que sintetizó, y lo que la tabla de
`formFactor` ya hace mal dentro de la ley 1. Con esa forma, tapar con una hoja y
tapar con una losa dan lo mismo, y la criatura no tiene nada que descubrir.

Se descartó **`sheltered` como cualidad guardada del cuerpo** («esta cosa está
bajo techo»). Convierte una relación en una propiedad, y entonces hay que
mantenerla sincronizada cada vez que algo se mueve. Como cualidad derivada de la
celda se calcula al leerla y no puede quedar vieja.

Se descartó **meter la lluvia en el mismo ADR**. Es un fenómeno nuevo (Hito 2) y
mezclarlo escondería que la oclusión ya se necesita **sin** lluvia, para el
carbón.

## Consecuencias

**Buenas**

- La técnica emblema pasa de imposible a expresable, y por una ley general: lo
  mismo que hace carbón hace reparo y hace techo. Tres capacidades, una ley.
- `permeability` le da función real a la malla y al tejido, que hoy son formas
  sin consecuencia.
- Cierra la contradicción del documento consigo mismo: la ley 4 dejaba de leer
  un número que nadie escribía.

**A tener en cuenta**

- **Son doce leyes, no once**, y el documento dice «once» en varios lados. Cada
  ley nueva multiplica la superficie de calibración, que es el riesgo 1 del
  proyecto. Hay que actualizar el conteo y el presupuesto del Hito 1.
- **La oclusión es el camino más corto a un mundo sellado.** Si tapar es barato
  y no tiene contrapartida, la criatura tapa todo: apaga sus fuegos sin querer,
  se asfixia adentro de su refugio. La ley necesita que la oclusión también corte
  el ingreso de oxígeno que el fuego consume, y eso hay que calibrarlo con la
  misma disciplina que la ventana térmica.
- **`covering` no es `onTopOf`.** Uno apoya (ley 8, estructura, sostiene peso) y
  el otro tapa (ley 12, ocluye intercambio). La parrilla apoya sin tapar; la losa
  tapa sin apoyar nada. Confundirlos en la implementación haría que cocinar sobre
  la parrilla ahogue el fuego.
