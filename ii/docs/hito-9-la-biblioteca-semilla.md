# Hito 9 — La biblioteca semilla

**Qué es, en una frase:** que las historias del usuario corran **sin que la fragua
tenga que inventar nada**, porque lo que hace falta ya viene de fábrica.

El plan lo justifica todo en tiempo: *«el caso frío son 6-25 s… con biblioteca
semilla, la demo del pescado es caso caliente (80 ms)»*. Lo que compra es que la
primera vez que alguien pide pescar, no haya que esperar a un modelo.

---

## 0 · Las mediciones que se hicieron ANTES de escribir el criterio

### M1 · «La fragua no se despierta ni una vez» es HOY verde por omisión

```
grep "@anima/forge" en los package.json de ii/  →  NADIE depende de la fragua
```

La fragua **no está enchufada a nada**. Ni la mente ni el chat la importan, y
`aHabilidad` —el traductor de plan a habilidad— es un `switch` cerrado sobre las
innatas. O sea que «cero consultas de la fragua» es cierto hoy, sin biblioteca,
sin hito y sin escribir una línea.

**Ese verificable, tal como está, no puede fallar.** Es el mismo verde por
omisión que el Hito 8 cazó seis veces, y hay que decirlo antes de escribir el
test, no después.

### M2 · Hay 18 innatas, y el hito pide «40 a 60 habilidades»

```
ir · explorar · juntar · comer · unir · construir · usar · deshilachar
aplicarProceso · poner · sostener · frotar · tantear · huirDelDolor
guarecerse · esperar · seguirOrdenDeMovimiento · alAlcance
```

### M3 · EL «40 A 60» NO CORRESPONDE A ESTA ARQUITECTURA

El hito nombra doce capacidades. Contra lo que ya existe:

| lo que el hito pide | qué es en Ánima II |
|---|---|
| encender | **ya está**: `frotar` |
| atar | **ya está**: `unir` |
| deshilachar | **ya está** |
| recolectar | **ya está**: `juntar` |
| refugiarse | **ya está**: `guarecerse` |
| cargar | **ya está**: `sostener` |
| apilar | **ya está**: `poner` |
| asar · cocinar · secar | **no son habilidades: son PROCESOS y LEYES**, que `aplicarProceso` ya ejecuta |
| pescar | **no es una habilidad**: es `aplicarProceso('extraccion')` con una caña — la cadena que el Hito 5 ya corre |
| guardar | no existe, y no está claro que sea una habilidad |

**Siete de doce ya están, tres son datos de la física y una es una cadena de
plan.** En esta arquitectura una capacidad nueva casi nunca es una habilidad
nueva: es un **proceso** (dato de `@anima/physics`) o un **esquema** (dato de
`@anima/plan`) que las dieciocho innatas ya saben ejecutar.

> El «40 a 60» es un número de la propuesta original, escrito cuando una
> capacidad y una habilidad eran la misma cosa. Dejó de serlo en el Hito 4, y es
> el quinto caso del mismo patrón — un número que hay que volver a preguntar para
> qué estaba antes de reemplazarlo.

### M4 · De las tres historias, sólo UNA corre

El Hito 5 cerró con tres rojos aceptados, y su diagnóstico está escrito:

| historia | estado |
|---|---|
| **(c)** palo + hilo → caña, y pescar | **CORRE**: 7 eslabones en el plan, tira la caña en el tick 48, el pescado entra a la mano en el 108 |
| **(a)** palo quemado → carbón | **no**, detrás del rojo del fuego |
| **(b)** pescado crudo → asado | **no**, detrás del mismo |

*«Lo que la frena ahora es MATERIA, no aritmética»* — el cierre del Hito 5.

**Dos de las tres historias no están bloqueadas por falta de biblioteca: están
bloqueadas por una decisión de física que el usuario todavía no tomó** (el hueco
de 23,02 de potencia, primera entrada de `decisionesQueEsperan` en el tablero).

### M5 · El índice por efectos YA EXISTE

El caso de aceptación pide *«índice por efectos y no por nombres»*.
`SCHEMA_INDEX` de `@anima/plan` es exactamente eso: un
`Map<PredicateSignature, ConstructionSchema[]>`. Y el gate 5→6 ya lo preguntó y
lo cerró (su pregunta 3), con `conOverlay` y `catalogEpoch`.

**No hay que construirlo. Hay que decir que ya está.**

---

## 1 · Lo que las cinco mediciones dejan del hito

Tres de las cuatro cosas que el Hito 9 pedía **ya están o no aplican**:

- el índice por efectos **está** (M5);
- la separación core / biblioteca / sesión **está** (`coreSchemas` + overlay,
  gate 5→6);
- el «40 a 60» **no corresponde** (M3).

Y su verificable principal **no puede fallar** (M1).

Lo que queda, y es real:

> **La biblioteca semilla no es un montón de habilidades: es el CATÁLOGO DE
> PROCESOS Y ESQUEMAS lo bastante completo como para que las historias se
> planifiquen sin inventar nada** — y una forma de afirmarlo que pueda ponerse
> roja.

---

## 2 · El criterio, reescrito para que pueda fallar

| | qué se afirma | cómo se mide |
|---|---|---|
| **1** | la historia **(c)** —pescar— se planifica **de punta a punta sin un solo `gap`** | el planificador emite la cadena entera y `falta()` no reporta nada |
| **2** | y el reloj del primer movimiento **no se mueve** contra la línea base del Hito 6 | `msHastaAccionPertinente`, contra el p95 < 150 ms ya medido |
| **3** | **EL CONTROL**: sacándole al catálogo el esquema que la historia usa, la misma corrida **sí reporta un gap** | sin esto, «no hay gaps» es el verde por omisión de M1 con otra cara |
| **4** | la fragua **no se despierta**, y se afirma con un ESPÍA sobre la costura, no con un grep | y con su control: forzando un gap, el espía **sí** cuenta una consulta |
| **5** | la biblioteca **no trae la trampa reservada** | el caso de aceptación lo exige con todas las letras: si viniera de fábrica dejaría de medir nada |

### Por qué el punto 3 es el que sostiene todo

Los puntos 1, 2 y 4 se cumplen hoy **sin hacer nada**, porque nada de esto está
enchufado. El 3 y su gemelo del 4 son los únicos que distinguen «la biblioteca
alcanza» de «nadie preguntó».

Es la misma forma que el Hito 8 usó seis veces: **por cada cero, un control que
lo hace subir.**

### Y las historias (a) y (b) NO entran en este criterio

No porque no importen, sino porque **están bloqueadas por otra cosa**: la
decisión de física del hueco de potencia. Meterlas acá haría que el Hito 9 no
pueda cerrar por una razón que no es suya, y taparía de quién es el trabajo.

Quedan nombradas, con su bloqueante escrito, y vuelven al criterio el día que la
decisión se tome.

---

## 3 · Lo que se construyó

Tres cosas, y son poco código porque casi todo ya estaba.

### 1 · El espía de la costura

`MenteOptions.costura` (`mind/src/tipos.ts`) y **una línea** en `escalera.ts`,
adentro del `case 'gap'`. Ese `case` es el lugar exacto que el contrato de
`PlanResult` viene nombrando desde el gate 5→6:

> El Hito 8 lee esto y le pide a la fragua un proceso nuevo.

Nadie lo leía. Ahora quien quiera escuchar recibe un `PedidoALaFragua` —qué
firma faltó, para qué meta, en qué tick, y el porqué del planificador— y **no
espera respuesta**: no hay un `await` en `src/`, así que la mente describe el
pedido y quien puede esperar lo manda. Es la frontera del ADR II-0024, la misma
que el Hito 6 y el tramo H del Hito 8.

Lo que el pedido NO trae es el vocabulario (`seSabeNombrar` del `Encargo`),
porque **la mente no ve la física**. Inventárselo sería adivinar, y el Hito 8 ya
pagó ese error por el otro lado.

### 2 · La corrida de la historia (c), con el catálogo entero

`mind/tests/hito-9-la-biblioteca-semilla.test.ts`, sobre el mismo arnés del
Hito 5 (`correr`, que ahora acepta que le cambien el catálogo y la costura).

### 3 · La ablación

`catalogoDe(ESQUEMAS.filter(...))`, y **cuál esquema se saca no fue obvio**:

- **La ablación obvia no sirve.** Sacar el esquema de la META
  —`holding(tag:carnoso)` por `extraccion`— hace que `sinVocabulario` vete la
  meta de antemano: la criatura no la intenta nunca, no hay `gap`, y el control
  diría «el espía no anda» cuando lo que pasó es que nadie pidió nada.
- **El que sirve es el del medio**: `catch>0` por `union`, el puente que
  convierte una vara en caña. La meta sigue teniendo vocabulario, la mente
  planifica, y se estrella contra un sub-objetivo que nadie sabe cumplir.

---

## 4 · Lo que se midió, y cómo cambió el punto 4

| | con el catálogo entero | **sin el puente `catch>0`** |
|---|---|---|
| primer movimiento | tick **0** | tick 0 |
| pescado en la mano | tick **108** | **nunca** |
| eslabones | ir · sostener · ir · sostener · **unir** · ir · aplicar(extraccion) ×2 | se queda dando vueltas |
| consultas a la fragua **para la caña** | **0** | **2**, y las dos nombran `catch>0` |

### El punto 4 salía verde por el corte, no por la biblioteca

La primera versión del test cortaba la corrida en cuanto el pescado llegaba y
afirmaba «cero consultas». Verde. Dejándola correr los 300 ticks:

```
consultas a la fragua en 300 ticks ...... 22
todas por el mismo hueco ................ emitsPower<410 & emitsPower>=253
y todas para la misma meta .............. holding(tag:carnoso,toxicity<0.0528)
```

**Ninguna es de la historia (c).** Las 22 son de la historia (b) —comer el
pescado sin envenenarse, que pide cocinarlo, que pide fuego— y el fuego es el
rojo aceptado del Hito 5, que espera una decisión de física del usuario.

Así que el punto 4 quedó afirmado como se puede afirmar de verdad: **cero
consultas PARA LA META DE LA HISTORIA (c)**, con las otras contadas, nombradas e
impresas al lado, y con un `expect` que se pone rojo si alguna vez aparece ahí un
hueco que no sea el fuego. Un `toBe(0)` que necesitaba el corte para ser cierto
habría sido el séptimo verde por omisión del proyecto.

> Y de yapa: es la primera medición de **cada cuánto despertaría a la fragua un
> mundo de verdad** — 22 pedidos en 300 ticks, todos por lo mismo. Eso es dato
> para el Hito 10, no para éste.

---

## 5 · Lo que NO hubo que construir

El índice por efectos (`SCHEMA_INDEX`), la separación core / biblioteca / sesión
(`coreSchemas` + overlay, gate 5→6), y las cuarenta habilidades (M3).
