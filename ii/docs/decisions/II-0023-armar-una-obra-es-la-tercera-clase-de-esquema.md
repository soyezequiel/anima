# II-0023 — Armar una obra es la tercera clase de esquema, y su paso corre una habilidad

**Estado:** aceptado · **Decide:** el usuario, sobre el
[Gate 5→6](../gate-5-6-objetos-emergentes.md) · **Fecha:** 2026-07-31

Sale de una MEDICIÓN, y de una que el planificador escribió solo.

## El problema

El punto 3 del criterio del gate pide **«publicación de capacidades al
planificador»**. Cumplía para esquemas desde el tramo A —una fila entra por el
overlay y la regresión la consume igual que una del core— y **no cumplía para
planos**.

El tramo F intentó la forma obvia: publicar «esta obra se sabe construir» como un
`EsquemaDeProceso` con `via: 'union'` y los roles del plano adentro de
`roleHints`. El planificador la alcanzó, la expandió, y la rechazó:

> el esquema de «reach>=5» por «union» no nombra «binder» ni «a», que «union»
> necesita sí o sí

**Y tenía razón.** Un `EsquemaDeProceso` es **una aplicación de un proceso**, así
que sus `RoleName` son los de **ese** proceso: `binder`, `a`, `b`. Los roles de un
plano son los del plano —`brazo`, `cola`, `punta`— y armar la obra son **N−1
uniones encadenadas** cuyo orden decide la topología (medido en
`physics/tests/el-orden-de-las-uniones-realiza-el-plano.test.ts`).

**La salida fácil era una mentira medible:** publicar la fila igual, con los roles
de `union`. Diría que un solo `union` alcanza para llegar a cinco, la criatura
ataría dos cosas y se quedaría a mitad de camino **sin que nada se ponga rojo**.

## La decisión

### 1 · Existe `EsquemaDeObra`, y es la tercera clase

`ConstructionSchema` pasa de dos variantes a tres. La nueva lleva la **revisión**
del plano y `cuantos` —cuántos cuerpos hacen falta de cada rol— y sus `roleHints`
son los del plano.

**El core no tiene ni va a tener filas de esa clase.** Una obra es de una partida
y entra por el overlay, que es el ADR II-0018 dicho desde este lado.

### 2 · Su paso es UNO, y no le pide nada al mundo sino a una habilidad

`Step` gana `armar`, con la revisión y los roles ligados. Es el primer paso del
catálogo cuyo destinatario no es `stepWorld`.

**Por qué no son N−1 pasos `unir`**, que es lo primero que uno intenta: porque
cada `unir` produce un ensamble **nuevo** y el siguiente lo necesita como
argumento, y **no hay `Ref` que pueda nombrarlo**. `{k:'rinde'}` nombra el
rendimiento de un objetivo del grafo, no el de un paso intermedio, y `{k:'id'}`
pediría el id de un cuerpo que todavía no nació. Enumerar la secuencia obligaría a
inventar un `Ref` a un cuerpo futuro, que es exactamente el estado que la primera
decisión de `plan/src/tipos.ts` prohíbe.

Y hay una segunda razón, que es el ADR II-0015: **el orden de las uniones decide
la topología**, y encontrarlo es del `BuildSkill`. El plano declara la forma; quien
construye busca el orden. Un plan que fijara el orden estaría decidiendo por la
habilidad con la información de hace veinte ticks.

### 3 · `cuantos` sale de la forma del plano, no se declara

`unir(a, b, binder)` **consume el atador**, así que hace falta un cuerpo de atador
**por junta que lo nombre**. Un rol que sólo es pieza vale 1.

Y el caso de la caña sale solo, sin ningún campo aparte: cuando el `binder` de una
junta es uno de sus propios extremos, ese rol es pieza y atador a la vez —un solo
cuerpo, que sobrevive adentro de la obra con la punta suelta—. Medido:

| plano | cuantos | cuerpos |
|---|---|---|
| caña (2 piezas, 1 junta, binder = extremo) | `brazo` 1 · `hebra` 1 | **2** |
| 3 piezas, 2 juntas, atador compartido | `brazo` 1 · `cola` 1 · `punta` 1 · `atadura` 2 | **5** |

## Lo que queda afuera, medido antes de cerrarlo

**Un rol que necesita DOS cuerpos no se puede planificar.** La regresión liga UN
cuerpo por rol: `MarcoDePlan.roles` es `Record<RoleName, Ref>` y un `Ref` nombra un
cuerpo.

Medido con el plano de dos juntas y **tres hebras a la vista**: el plan salía
`cola=h1 · punta=h2 · atadura=h0` y no quedaba ninguna hebra libre para la segunda
atadura. **Verde**, y la criatura ataba una junta y se quedaba parada.

Se **rechaza** con el rol y el número adelante. De este lado se equivoca a
propósito: pierde planes que se podrían armar yendo a buscar la segunda atadura en
el medio, y no manda a nadie a un viaje que termina en una obra a medias. Es el
mismo criterio con el que `emitirMarco` rechaza cuando las manos no alcanzan.

Levantarlo pide `Record<RoleName, readonly Ref[]>`, y eso toca la búsqueda entera:
`candidatosPara`, el orden por rol más apretado, la frontera. Tiene su `it.fails`
con este número en `plan/tests/construir-y-usar-se-publican-aparte.test.ts`.

**Y del otro lado ya hay alguien.** La innata `construir` existe y `aHabilidad` la
llama. Lo que quedó de escribirla es una regla del PLANO que nadie había visto:

> un rol que ata su propia junta y además es pieza en otra **no se puede armar**.

Sale del mismo hecho medido: `unir` deja la cabeza del ensamble en el cuerpo
izquierdo, y cuando el atador es uno de los extremos no puede ir de izquierda, así
que la cabeza queda en el otro. Para atar su segunda junta ese rol tendría que ser
cabeza y no lo es; antes de la suya sí, pero entonces deja de estar suelto y su
propia junta lo necesita suelto.

Se rechaza en `definirPlano` con `atador-que-no-es-punta` y **no** en el
constructor: un plano que no se puede armar no tiene que llegar hasta ahí.

## Enlaces

- [ADR II-0015](II-0015-el-plano-no-es-el-esquema-de-construccion.md) — el plano no es el esquema de construcción
- [ADR II-0018](II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md) — el catálogo es core más overlay por sesión
- [ADR II-0022](II-0022-place-despliega-un-cuerpo-no-construye-un-plano.md) — `place` despliega un cuerpo ya armado
- [`../gate-5-6-objetos-emergentes.md`](../gate-5-6-objetos-emergentes.md) — el criterio de la puerta
