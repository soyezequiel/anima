# Hito 10 — Crónica y herencia

**Qué es, en una frase:** que cerrar la pestaña no cueste nada, y que la segunda
generación arranque sabiendo lo que aprendió la primera.

El plan pide `@anima/store` —journal append-only con snapshots por delta en
IndexedDB, fuera del tick— y cuatro verificables:

> replay de 20.000 ticks reproduce el hash exacto **y re-ejecuta las habilidades
> comparando la traza**; cerrar y reabrir la pestaña a mitad de una obra no
> pierde el mundo y la habilidad converge; una heredera arranca con la biblioteca
> completa y ninguna credencial regalada; **una segunda vida resuelve «pescá» en
> menos de 100 ms sin despertar la fragua**.

---

## 0 · Las siete mediciones que se hicieron ANTES de escribir el criterio

### M1 · `@anima/store` no existe, y no hay una sola línea de persistencia

```
paquetes de ii/ ... emergencia forge judge lang llm mind oracle perceive
                    physics plan skills world        (doce, ningún store)
```

`IndexedDB` aparece exactamente tres veces en todo `src/`, y ninguna la usa: dos
comentarios que dicen «lo que no aguanta el viaje por JSON no sirve para
IndexedDB», y **la lista de globals prohibidos del sandbox**. O sea que lo único
que el árbol sabe hoy de IndexedDB es que las habilidades no pueden tocarlo.

**Esto es el grueso de las dos semanas.** No es una pieza que falta: es un
paquete entero que no existe.

### M2 · El replay existe y está bien probado — pero replaya INTENCIONES, no habilidades

```ts
export interface JournalEntry<I> {
  readonly tick: number
  readonly seq: number
  readonly intent: I      // ← esto, y nada más
}
```

Una `Intent` es **lo que la habilidad ya produjo**. Replayarla salta la habilidad
entera: el generador no se vuelve a correr ni una vez. Así que la primera mitad
del verificable —«reproduce el hash exacto»— está cumplida desde el Hito 2, y la
segunda —«y re-ejecuta las habilidades comparando la traza»— **no tiene ni por
dónde empezar**.

Y hay que decir por qué la mitad que falta importa: un replay de intenciones
prueba que **el mundo** es determinista. No prueba nada sobre la habilidad. Una
habilidad que mira el reloj de pared, o que depende del orden de un `Map`, pasa
este replay sin despeinarse — porque nunca corre.

### M3 · El replay más largo del árbol es de 10.000 ticks, no de 20.000

`world/tests/hito-2-el-criterio.test.ts`, bloque (d). El verificable pide el
doble. No es un problema de diseño; es un número que hay que medir y no citar.

### M4 · La traza YA EXISTE, y ya se hashea

`TraceEntry` en `skills/src/ejecutor.ts`, con su comentario: *«la traza CRECE con
la corrida y no tiene tope, a propósito: es lo que hashea…»*.

**Lo que falta no es la traza.** Es que alguien corra la habilidad durante el
replay para tener una segunda traza con qué comparar.

### M5 · No hay herencia, ni legado, ni segunda vida. Cero líneas

`grep` de `herencia|heredera|legado|segunda vida|generacion` sobre todo `src/`:
ni una coincidencia real. Los siete ADRs de Ánima I que el inventario marca para
portar acá —0009, 0021, 0033, 0047, 0075, 0076, 0084— **no están portados**.

### M6 · Pero el vocabulario de «credencial no regalada» YA está

```ts
trust: 'borrador' | 'provisional' | 'estable'     // physics/src/process.ts
```

Y `provisional` ya existe como nivel de confianza de una habilidad, con su portón
escrito: *«una habilidad `provisional` entra con `reversible` y no puede quemar la
casa que la hospeda»*. O sea que «la heredera recibe testimonio, no hechos» (ADR
0009) tiene dónde apoyarse: **no hay que inventar el concepto, hay que usarlo**.

### M7 · EL CUARTO VERIFICABLE NO PUEDE FALLAR

Medido con la costura del Hito 9 puesta, en una **primera** vida, sin nada
guardado y sin herencia de ninguna clase:

```
─── «pescá algo», en una PRIMERA vida ───
  la meta que salió ......... holding(tag:carnoso)
  leerla costó .............. 0,83 ms
  hasta el primer paso ...... 1 tick · 3,12 ms de CÓMPUTO
  TOTAL ..................... 3,96 ms contra el techo de 100
  consultas a la fragua ..... 0
```

**25× de sobra, y cero consultas.** Así que *«una segunda vida resuelve pescá en
menos de 100 ms sin despertar la fragua»* es cierto hoy sin persistencia, sin
herencia y sin el hito.

Es la misma forma que el Hito 9 encontró en su M1, y por la misma causa: **el
número se eligió pensando en el caso frío —cuando la habilidad hay que
escribirla— y hoy todas las habilidades ya están escritas.** Un techo que sobra
25× no mide nada.

---

## 1 · Lo que las siete mediciones dejan del hito

Tres de los cuatro verificables son trabajo real y grande:

| verificable | qué falta de verdad |
|---|---|
| replay 20k + traza | la **mitad de la traza**, entera (M2, M4) |
| cerrar y reabrir la pestaña | **todo**: no hay persistencia (M1) |
| heredera con biblioteca completa | **todo**: no hay herencia (M5) — pero el vocabulario está (M6) |
| segunda vida < 100 ms | **nada**: ya se cumple 25× (M7) |

El cuarto hay que reescribirlo para que pueda fallar. Y la pregunta que lo
reescribe es la única que importa del hito:

> **¿QUÉ HACE UNA SEGUNDA VIDA QUE LA PRIMERA NO PODÍA?**
>
> Si la respuesta es «nada, sólo llega igual de rápido», la herencia no compró
> nada y el hito se cumple solo.

Y hay una respuesta medida esperando desde el Hito 5, escrita como hueco en
`mind/src/tipos.ts`:

> un replay desde el journal reconstruye el mundo y **NO las creencias**. La
> criatura revivida se acuerda de dónde estaban las cosas y no de si le
> rindieron.

Eso es lo que la herencia tiene que comprar, y se puede contar en ticks.

---

## 2 · El criterio, reescrito para que pueda fallar

| | qué se afirma | cómo se mide |
|---|---|---|
| **1** | el replay de **20.000 ticks** reproduce el hash exacto | hoy son 10.000 (M3); hay que correr el doble y medirlo |
| **2** | y **re-ejecuta las habilidades**, comparando la traza contra la de la corrida original | la traza ya existe y ya se hashea (M4); falta correr la habilidad |
| **3** | **EL CONTROL del 2**: una habilidad con una fuente de no-determinismo plantada **sí** rompe la comparación | sin esto, «las trazas coinciden» es cierto porque nadie las miró |
| **4** | cortar a mitad de una obra y volver a abrir **no pierde el mundo**, y la obra converge al mismo resultado | pide `@anima/store` (M1) |
| **5** | la heredera arranca con la biblioteca completa y **ninguna credencial regalada**: lo heredado entra `provisional` y se vuelve a ganar la vara en SU mundo | M6 |
| **6** | **la segunda vida llega al pescado en MENOS TICKS que la primera**, y el control: sin la herencia, la misma segunda vida tarda lo mismo que la primera | es lo único que distingue «heredó» de «arrancó de nuevo» |
| **7** | y en las dos, la fragua **no se despierta** — con el espía del Hito 9, no con un grep | reusa la costura que ya está medida |

### Por qué el punto 6 reemplaza al «< 100 ms»

Porque el techo de 100 ms sobra 25× **sin el hito** (M7), y un verificable que ya
se cumple no puede decir si el trabajo sirvió. Lo que la herencia promete no es
velocidad de cómputo: es **no volver a aprender lo que ya se sabía**. Eso se
cuenta en ticks de mundo, contra la línea base que el Hito 5 ya midió —el pescado
entra a la mano en el tick **108**— y puede salir mal de la forma más útil: que
dé 108 igual, y entonces la herencia no compró nada.

El «< 100 ms» no se tira: queda como **guarda**, no como criterio. Que no
empeore es cierto y vale la pena vigilarlo; que se cumpla no demuestra nada.

### Y una advertencia sobre el punto 3

Es el control que sostiene el 2, y es fácil escribirlo mal. Plantar el
no-determinismo en un lugar que la habilidad no toca da verde y no controla nada
— es exactamente el error que el Hito 8 cometió con el manual viejo, corregido
sólo cuando el usuario preguntó por qué el control no mordía. La fuente plantada
tiene que estar **en el camino que la habilidad recorre**, y hay que demostrarlo
mostrando que la corrida sin plantar sí pasa.

---

## 2 bis · Lo que se construyó, y lo que apareció al construirlo

### Puntos 1, 2 y 3 — CUMPLEN

| | |
|---|---|
| **1** | 20.000 ticks, 80.000 intenciones, 21 checkpoints. Correrla: **741 ms**. Replayarla: **502 ms** |
| | Su control: sacándole **una** intención del medio, el replay corta — y corta **adentro** (tick 300), no en el tick 0 |
| **2** | `Partida.anotarVuelos` + `compararVuelos`. La historia de la caña, dos veces: **14 vuelos, cero divergencias** |
| **3** | **El control que muerde**, y es el punto entero del hito |

El control del punto 3, medido:

```
hash del mundo, corrida 1 ... 2fbe8bea86d9848f
hash del mundo, corrida 2 ... 2fbe8bea86d9848f
¿el hash lo vio? ............ NO. Son idénticos
traza, corrida 1 ............ e7e5eab6d04a51f0
traza, corrida 2 ............ 81bf1a2f44b98767
¿la traza lo vio? ........... SÍ
```

Una habilidad con una fuente de no-determinismo adentro deja el mundo **bit por
bit idéntico** y la traza distinta. Eso es exactamente lo que M2 decía que el
replay del journal no puede ver, y ahora se ve.

> El primer control que escribí cortaba en el tick 0 — o sea **antes de entrar
> al bucle**. Probaba que el primer hash se compara y nada más. Corregido: ahora
> el journal arranca igual y se le saca una intención del medio, así que los
> primeros checkpoints tienen que pasar y el corte tiene que caer adentro. El
> test lo exige con un número.

### Punto 4 — CUMPLE

`@anima/store`, el paquete que no existía. **Es el primer paquete de `ii/` donde
`await` es legal**, con su guardián propio diciéndolo en voz alta: la regla 2
protege al *tick*, y guardar no pasa por el tick.

```
cortado en el tick ..... 60
hash antes ............. igual
hash después ........... igual
la restaurada pescó .... 48 ticks después del corte, o sea en el 108
```

**108 es exactamente el tick de la corrida sin cortar.** La obra converge, y no
porque el vuelo sobreviva —no sobrevive, ADR 0009— sino porque la criatura
restaurada vuelve a planificar y llega al mismo lugar.

### Punto 6 — DESBLOQUEADO Y MEDIDO, y da NEGATIVO

El hueco de abajo se cerró (ver la sección siguiente), así que el punto 6 se
pudo medir por primera vez:

```
lo que la primera aprendió .... agua|mc--e → carnoso, 1 éxito
primera vida .................. pescó en el tick 108
segunda CON herencia .......... 108
segunda SIN herencia .......... 108
¿la herencia compró ticks? .... NO: llega igual
```

**La herencia no compra un solo tick**, y el criterio decía exactamente que
podía salir así: *«puede salir mal de la forma más útil: que dé 108 igual, y
entonces la herencia no compró nada»*.

Por qué, medido: la primera vida aprende **una** cosa —que el agua rinde
carnoso— y ese casillero **ya arrancaba con instinto a favor** (`a=1,5 b=0,5`).
Un éxito sobre un prior que ya apuntaba al río no cambia a dónde va la criatura,
porque ya iba. La herencia sólo puede comprar ticks cuando lo aprendido
CONTRADICE al instinto, y para eso hace falta que la criatura se equivoque
primero — que es justo lo que la asimetría de abajo no deja anotar.

El test lleva su control de que la comparación es justa: **sin herencia, la
segunda vida reproduce exactamente a la primera** (108 = 108). Sin eso, «llega
igual» no distinguiría «la herencia no sirve» de «las dos ramas no eran el mismo
experimento».

### El hueco que lo bloqueaba, cerrado

Estaba escrito desde el Hito 5

El guardado de creencias funciona y está probado con su control (no duplica el
instinto: `a` da `instinto + 2` y no `2·instinto + 2`). Pero **vuelca cero**
después de sesenta ticks de vida real, y no es un bug del volcado:

> `AffordanceMemory` tiene `observe(ctx, rinde, ok)` y acá **no se lo llama
> nunca** […] una criatura que pesca sesenta veces sigue informando `n = 0`.
> — `mind/src/mente.ts`, desde el Hito 5, con su `it.fails`

**La mente nunca le devolvía evidencia a las creencias.** La reparación es la que
ese mismo comentario pedía: `Opportunity.deDonde` lleva el casillero
—`opportunities()` ya lo tenía en la mano, porque llama a `belief(ctx, tag)` para
calcular la `p`— y la escalera se lo guarda en `deDondeSalio` mientras sostiene
la meta.

**Dónde se anota costó una medición.** El primer intento anotaba en
`aterrizar(e, true)` y daba **cero logros en 200 ticks**. La causa ya estaba
escrita en el Hito 5: el vuelo que de verdad saca el pescado aterriza con
`ok:false`, porque la mente lo interrumpe en el mismo tick en que la meta se
cumple. Se anota donde no se puede leer mal: **cuando D1 ve que el MUNDO dice que
la meta está cumplida**. No se le cree al `outcome` de la habilidad, se le cree
al estado — la misma regla con la que el Hito 5 arregló su contador de pescas.

**Sólo se anota el éxito, y es una decisión.** Lo simétrico sería anotar un
fracaso cada vez que una meta se abandona, y no es simétrico: se abandona por
razones que no dicen nada del lugar —apareció algo mejor, se acabó el aliento—.
Contarlas todas como «el río no rinde» enseñaría lo contrario de lo que pasó, y
con volumen. El costo va dicho: **hoy las creencias sólo pueden subir**, así que
la criatura no se puede desengañar de un lugar que dejó de rendir. Ese caso llega
cuando un pozo se agota, y ahí hay con qué medirlo.

> Y de paso el `it.fails` que pinchaba el hueco tenía un número viejo: se llamaba
> «pesca **doce** veces y sigue diciendo n=0», y hoy son **dos** — medido también
> sobre el árbol sin la reparación. Un `it.fails` esconde cuál de sus líneas
> falla, así que el 12 se quedó escrito mientras el mundo cambiaba abajo.

---

### Punto 5 — la mitad del conocimiento CUMPLE; la de la biblioteca no tiene qué medir

El ADR 0009 desarma «ninguna credencial regalada» en dos: el conocimiento entra
como hipótesis con confianza limitada, y las habilidades entran como candidatas
que vuelven a ganarse la vara.

**Y el número del ADR no se puede usar.** Pide confianza heredada `≤0,65`.
Medido sobre esta arquitectura:

```
filas de instinto de fábrica ................ 5
medias ...................................... 0,2500 y 0,7500
las que YA pasan el tope de 0,65 ............ 4 de 5
```

Una recién nacida **ya está más segura que el tope**. Aplicarlo dejaría a la
heredera peor que si no hubiera heredado nada. Es el tercer número de la
propuesta original que dejó de corresponder, después del «40 a 60 habilidades»
del Hito 9 y del «< 100 ms» de este mismo hito.

Se reemplaza por dos garantías que **sí se pueden poner rojas**:

| | medido |
|---|---|
| la heredera nunca queda más segura que su antecesora | 0,8889 contra 0,9286 |
| el testimonio vale menos que verlo uno mismo | 0,8889 contra 0,9286 |
| **el control**: restaurar NO descuenta — la misma criatura que vuelve se acuerda entera | 0,9286 = 0,9286 |

El control es el que hace que lo demás signifique algo: sin él, «heredar
descuenta» no diría si el descuento es del heredar o de pasar por un archivo.
**Acordarse y que te cuenten son dos operaciones distintas y sólo una descuenta**
— que es la frase con la que el ADR abre: *«El legado es testimonio, no
memoria»*.

`PESO_DEL_TESTIMONIO = 0,5`, y de dónde sale va dicho: es el peso más grande que
todavía deja «lo vi yo» estrictamente por encima de «me lo contaron». **No sale
de una medición.** Lo que sí está medido es cuán poco margen hay: una vida entera
produce **una sola observación**, así que con peso 1 lo que le contaron pesaría
exactamente lo mismo que todo lo que vivió.

**La mitad de la biblioteca no se implementa, y por qué:** medido en el Hito 9 y
sin cambios, **ninguna partida registra una sola capacidad**. Guardar la
biblioteca hoy sería guardar una lista vacía, y afirmar «la heredera arrancó con
la biblioteca completa» sería el verde por omisión más caro que quedaba: cierto
porque no hay nada. El vocabulario para que entre `provisional` ya está (M6);
falta el gesto, no el concepto.

### Punto 7 — CUMPLE, reusando el espía del Hito 9

```
primera vida · por la caña ... 0 de 22 consultas
heredera     · por la caña ... 0 de 22 consultas
y lo demás son ............... emitsPower<410 & emitsPower>=253
```

Se afirma como en el Hito 9 y por la misma razón: **contando las consultas para
la meta de la historia, no el total**. El total no es cero y nunca lo fue —son
las 22 de cocinar sin fuego, el rojo aceptado del Hito 5— y un `toBe(0)` sobre el
total habría necesitado cortar la corrida para ser cierto, que es exactamente el
error que el Hito 9 cazó.

Con su guarda: **el espía contó 22**, así que las dos listas vacías no son el
cero de «nadie miró».

---

## 3 · Lo que queda por construir

1. **La mitad de la biblioteca del punto 5** — el día que una partida promueva
   algo. Hoy no hay qué heredar y afirmarlo sería un verde por omisión.
2. **El adaptador de IndexedDB** — veinte líneas contra la interfaz `Deposito`,
   y no se puede correr en la suite: node no tiene IndexedDB. Necesita el arnés
   de navegador que el Hito 2 ya tiene anotado como pendiente.

Y lo que este hito deja abierto **para el usuario, no para el que siga**: hoy las
creencias sólo pueden subir. La criatura no se puede desengañar de un lugar que
dejó de rendir, porque no se anota el fracaso — y por eso la herencia no compra
ticks (punto 6). Cuál abandono ES evidencia en contra tiene respuesta medible y
todavía sin medir.

Lo que **no** hubo que construir: la traza (M4), el vocabulario de confianza (M6),
y el replay del mundo (M2, primera mitad — cumplía desde el Hito 2).

---

## 4 · Lo que este hito NO decide

El plan agrega, en la suma del caso de aceptación, el **journal de catálogo** con
los cuatro gestos (promoción, activación, revocación y adopción) y las tres reglas
de aislamiento entre saves. Eso es una decisión de producto que todavía no se
tomó y que no se puede tomar midiendo: entra al criterio el día que se tome, con
su ADR, como pasó con el árbol de crafteo.
