# Hito 6 — el chat, que no espera al proveedor

**El criterio, escrito antes de la primera línea de código**, que es la regla 1
de [`como-se-trabaja.md`](como-se-trabaja.md). Lo que sigue es lo que hay que
demostrar; cómo se demuestra es de los tramos, y se escribe abajo a medida que
cada uno cierra.

---

## 0 · Lo primero, porque es lo que más fácil se malinterpreta

**El hito no es «un parser».** Es la primera vez que alguien de afuera le dice
algo a la criatura y la criatura hace. Todo lo demás —el trie, el difuso, el
léxico— es maquinaria para eso.

**Y el criterio no premia entender.** Premia **no hacer esperar**. La diferencia
la decidió el usuario antes de arrancar y está en el
[ADR II-0024](decisions/II-0024-el-piso-del-chat-no-es-sin-llm-es-sin-espera.md):
un porcentaje de comprensión se sube haciendo trampa de mil formas, y un p95 que
no se mueve cuando el proveedor tarda treinta segundos sólo se consigue de una.

Tres cosas que este hito **no** hace, dichas ahora para que nadie las busque:

1. **No llama a ningún modelo.** El carril L3/L4 es del Hito 8. Acá se construye
   el piso, y se construye de modo que el modelo pueda enchufarse después **sin
   entrar al camino del acuse ni del primer movimiento**.
2. **No decide qué hacer.** Eso es de `@anima/plan` y de la escalera de
   `@anima/mind`, que ya existen. Este hito produce el `GoalNode` y lo entrega.
3. **No dibuja nada.** El acuse es un dato en el canal de habla; pintarlo es del
   Hito 12.

---

## 1 · El criterio, en cinco puntos

Sale del documento de arquitectura (§ Hito 6) tal como quedó después del ADR
II-0024. Cada punto tiene su forma de medirse escrita al lado, porque un criterio
sin forma de medirse es una intención.

| # | Qué hay que demostrar | Cómo se mide |
|---|---|---|
| **1** | **Ninguna de las 200 frases devuelve «nada»** con el proveedor apagado: todas producen acuse y primer movimiento | corpus versionado × una corrida, contando las que salen sin intención |
| **2** | **Con el proveedor COLGADO —responde a los 30 s, o nunca— el p95 es el mismo** que con el proveedor apagado | dos corridas del mismo corpus; la diferencia tiene que ser ruido, no una cola |
| **3** | **p95 de mensaje a primer movimiento < 150 ms** en las dos corridas | `msHastaPrimerMovimiento`, p50 y p95 |
| **4** | **El acuse aparece en el mismo frame que el mensaje** | el acuse no cuesta un tick: se afirma por MECANISMO, no por cronómetro |
| **5** | **`consistenciaDelPrimerGesto ≥ 0.85`** con el proveedor apagado | primer gesto coherente con la conducta final / órdenes totales |

Y **la cobertura sin red no es un punto del criterio**: es una línea base. La
primera corrida del corpus la fija y el build falla si baja. El porqué está en el
ADR II-0024 § 2 — el `≥80%` original se eligió antes de tener el corpus.

### El punto 2 es el que hace el trabajo, y conviene decir por qué

Los puntos 1, 3, 4 y 5 ya estaban escritos antes del ADR y **los cuatro se
cumplen trivialmente si uno prohíbe el modelo**. El punto 2 es el único que sigue
significando algo cuando el modelo está permitido: es la afirmación de que el
proveedor **no está en el camino**, y no se puede satisfacer con un proveedor
rápido ni con una caché caliente.

**Su control positivo es obligatorio.** Un test que compara dos p95 y los
encuentra iguales tiene que probar primero que sabe verlos distintos: se corre
una tercera vez con el proveedor colgado **y en el camino crítico a propósito**,
y esa corrida tiene que dar un p95 peor. Sin eso, el punto 2 es un cero que sale
de que no había qué medir — el modo de falla número 20 de
[`como-se-trabaja.md`](como-se-trabaja.md).

---

## 2 · La suma del caso de aceptación

Del documento de arquitectura, y es lo que hace que el hito valga:

> El chat tiene que **transformar «fabricá una trampa para peces» en un objetivo
> funcional sin nombrar la solución**: el resultado se expresa como **captura
> autónoma y recuperable**, no como un objeto con nombre. Y tiene que **informar
> qué falta** distinguiendo las cuatro clases —plano, habilidad, proceso o
> física— y **mostrar progreso sin detener el cuerpo**.

Tres exigencias, y la primera engancha directo con el Gate 5→6 que acaba de
cerrar:

- **(a) sin nombrar la solución.** «Trampa para peces» tiene que salir del
  parseo como un predicado sobre CUALIDADES —algo con `catch > 0` que se pueda
  recuperar— y no como un identificador. El punto 12 del gate ya prohíbe que
  exista un `kind` llamado `trampa-para-peces` en producción, y su guardián barre
  los `src/` de todos los paquetes: **`@anima/lang` nace adentro de ese barrido**.
- **(b) las cuatro clases de lo que falta.** `plan()` ya devuelve
  `{k:'gap', missing, nearest, why}`. Falta la clasificación: si lo que falta es
  un **plano**, una **habilidad**, un **proceso** o un número de la **física**.
  Son cuatro respuestas distintas para el cuidador y hoy son una sola.
- **(c) progreso sin detener el cuerpo.** El `nearest` del gap ya existe y es
  todo `reversible`: la criatura arranca con eso mientras el resto se resuelve.
  Lo que falta es que lo NARRE.

---

## 3 · Los tres relojes

El documento de arquitectura los nombra y este hito los instrumenta. Son tres y
miden cosas distintas; confundirlos es el error que el documento ya advierte
(«los números lindos eran todos del caso caliente, y la demo es el caso frío»).

| reloj | qué mide | presupuesto |
|---|---|---|
| `msHastaPrimerMovimiento` | del mensaje al primer cambio visible en el mundo | **p95 < 150 ms** |
| `msHastaAccionPertinente` | del mensaje a la primera acción que va al grano | frío: segundos, y se muestra como progreso honesto |
| `consistenciaDelPrimerGesto` | primer gesto coherente con la conducta final / órdenes | **≥ 0,85** |

El tercero es el que decide si preposicionarse funciona o parece estupidez. Si
baja de 0,85, **la especulación se apaga hasta que suba**; es la única defensa
medible que el documento le pone a la apuesta de moverse antes de entender del
todo.

---

## 4 · Lo que se mide ANTES de diseñar

Regla 1 de este proyecto, y en el Gate 5→6 pagó tres veces. Antes de escribir el
parser hay cinco cosas que no se pueden suponer, y las cinco se midieron con
agentes en paralelo antes del primer tramo:

1. **qué contiene de verdad el léxico vivo** — cuántas sustancias, con qué
   sinónimos, y **cuántas palabras de una frase real no están en ninguna parte**;
2. **qué acepta la costura** — `Lectura` y `goalGraph` ya existen en
   `@anima/plan` esperando a este hito, y `Predicado` tiene un poder expresivo
   concreto que decide qué frases se pueden siquiera representar;
3. **cuánto de «`resolveReference` portado casi tal cual» es mentira** — el
   original filtra por `kind`, que Ánima II prohíbe, y usa `localeCompare`, que
   la regla 2 prohíbe;
4. **si los 150 ms están holgados o al filo** — con `plan()` y `stepWorld`
   cronometrados de verdad, no con la tabla del documento;
5. **de dónde salen las 200 frases** — el documento dice que se sacan «del
   historial de chat del repo actual, que existe», y eso es una afirmación
   empírica que hay que verificar antes de presupuestar el corpus.

Los resultados se escriben abajo, en la sección de tramos, con la salida que los
produjo.

---

## 5 · Los tramos

Se llenan a medida que cierran. Un tramo entra acá **con su medición**, no con su
descripción.

### Tramo A — el esqueleto y la normalización

`ii/packages/lang/` nace con su guardián de la regla 2 **escrito antes que su
primer módulo**, y con una advertencia que los otros nueve paquetes no
necesitaban: éste es el único que manipula texto, así que `toLocaleLowerCase` y
`Intl.Segmenter` son tentaciones reales. Los dos caen adentro del patrón que ya
prohibía `Intl`; lo que hizo falta fue ampliarlo a `toLocale` a secas y ponerle
control negativo a `toLowerCase`, `normalize` y la comparación con `<`.

**Y salió un bug en el primer archivo, de la familia que este proyecto ya
conocía.** La regex que le saca los acentos a una palabra se escribió con las
marcas combinantes **crudas**:

```
const MARCAS = /[̀-ͯ]/g
```

Una marca combinante se pinta encima del carácter anterior, así que el `U+0300`
se dibuja sobre el corchete y el `U+036F` sobre el guión: la clase se lee `[-]`,
una regex que engancha guiones y nada más. `tsc` la acepta y los tests dan verde
mientras nadie le pase un acento.

Es la misma enfermedad que los seis NUL de `physics/src/plano.ts` y **peor en un
sentido**: el NUL al menos hacía que `grep` contestara «Binary file matches». Éste
no avisa nada. El guardián de bytes invisibles de
`world/tests/sin-nombres-especiales.test.ts` se amplió con la segunda clase —una
marca combinante que **no viene detrás de una letra**—, que distingue el bug de
un `río` o una `caña` legítimos mirando el carácter de antes y nada más.

Medido: **629 tests en `@anima/world`** (eran 627+1 skipped), verde, o sea que
ningún `src/` de los diez paquetes tenía una marca montada sobre puntuación.

### Tramo B — el léxico vivo, y el tamaño real del agujero

**«Vivo» quiere decir que no hay ninguna lista de palabras adentro.** Las
palabras salen de `Physics` —los `lexeme` de las 30 sustancias y de los 4
procesos— así que una sustancia que el oráculo invente entra al léxico sin que
nadie toque el paquete. Hay un test que lo prueba inventando una.

**Y de eso sale el número que decide el hito.** Once frases reales de castellano,
contadas palabra por palabra:

```
  fabricá una trampa para peces  mundo 0/5   con puente 3/5
  traé un palo                   mundo 1/3   con puente 2/3
  andá al río                    mundo 0/3   con puente 1/3
  no comas eso                   mundo 0/3   con puente 0/3
  hacé fuego                     mundo 0/2   con puente 2/2
  juntá leña                     mundo 1/2   con puente 2/2
  pescá algo                     mundo 0/2   con puente 1/2
  asá el pescado                 mundo 1/3   con puente 2/3
  dejá de caminar                mundo 0/3   con puente 1/3
  conseguí comida                mundo 0/2   con puente 2/2
  atá la vara con la hebra       mundo 0/6   con puente 2/6

  SÓLO EL MUNDO ...... 3/34 = 9%
  CON EL PUENTE ...... 18/34 = 53%
  el puente son 19 filas (6 metas + 13 verbos)
  contra 101 entradas que el mundo trae solo
```

**El mundo entiende el 9% de lo que una persona escribe.** Diecinueve filas
escritas a mano lo llevan al 53%. Ésa es la tabla de alias de composición que el
documento de arquitectura mandó presupuestar, y ahora tiene tamaño.

Vive en su propio archivo (`src/alias.ts`) **para que se pueda contar**. La regla
de qué entra es una sola: lo que el mundo no puede nombrar solo. `palo` no está,
porque ya es sinónimo de `madera` en la física.

#### Los dos números corregidos, y los dos son del lado exigente

1. **«El mundo conoce 1 de 12 verbos» → conoce CERO.** El acierto que se había
   medido (`atá` → el proceso `union`) dependía de desconjugar el voseo quitando
   el acento y agregando una `r`. Ese paso **no se da**, y se descartó midiendo:
   la misma receta produce `comasr`, `caminarr` y un `hacer` que no es proceso —
   acierta 1 y ensucia 11. Sin él, `atá` normalizado da `ata` y el lexema del
   mundo es `atar`. No son iguales.
2. **«Cobertura 15%» → 9%.** La diferencia son dos palabras: `con`, que el
   barrido anterior contó como acierto contra un adjetivo, y `peces`, que exige
   pasar de plural a singular. **Los plurales no están resueltos**, y eso es
   trabajo del tramo siguiente, no del léxico.

Y el segundo corregido destapó un error en el puente que se estaba por escribir:
la fila de `atar` decía «`ata` ya está en el léxico derivado» y no estaba, por la
misma confusión entre la forma que una persona escribe y el lexema que el mundo
publica. Lo atajó el test antes del commit.

#### La línea que más importa del archivo

```ts
{ dice: ['trampa', 'aparejo', 'red', 'atrapar'],
  denota: { k: 'meta', firma: 'catch>0' } },
```

**«Trampa» no se traduce a un objeto con nombre: se traduce a la cualidad que
hace que algo atrape.** Es exactamente lo que el caso de aceptación pide, y es lo
que el punto 12 del Gate 5→6 volvió posible: no existe ni puede existir un `kind`
llamado `trampa-para-peces`, así que no hay adónde apuntar salvo a la física. Un
test recorre las 120 claves del léxico y exige que ninguna nombre la solución.

Medido: `@anima/lang` **14 tests verdes**, typecheck limpio.

### Tramo C — leer, y el contrato raro que hace al punto 1

`leer(texto, opciones)` **siempre devuelve una `Lectura` con al menos una
cláusula.** No tiene rama vacía, no tira, no devuelve `undefined`.

La forma barata de cumplir el punto 1 del criterio sería un `if` al final que
rellena. Acá no es un `if`: **el tipo no tiene variante vacía** y los cuatro
grados son respuestas. La regla del documento —«corte a los 25 ms: no existe
rama que devuelva "nada"»— quedó escrita como tipo y no como intención.

| grado | qué quiere decir | qué se hace con eso |
|---|---|---|
| `entendida` | hay predicado y el catálogo sabe establecerlo | va a `plan()` como meta |
| `sin-camino` | se entendió y ningún esquema lo establece | se acusa y se dice qué falta |
| `orientacion` | se entendió hacia dónde mirar, no a qué estado llegar | gesto reversible |
| `no-entendida` | ni eso | se pregunta, y el cuerpo sigue con lo suyo |

Corridas las diecinueve frases del corpus —las once de la medición, las cuatro
del historial de chat real, y cuatro bordes (la vacía, la de espacios, tres
palabras inventadas y los signos solos)—:

```
  fabricá una trampa para peces      entendida     catch>0
  traé un palo                       sin-camino    holding(tag:fibroso)
  andá al río                        orientacion   —
  hacé fuego                         entendida     emitsPower>0
  pescá algo                         entendida     holding(tag:carnoso)
  asá el pescado                     entendida     holding(tag:carnoso,digestibility>=0.85,…)
  atá la vara con la hebra           orientacion   reach>=2
  construi una ahoguera              entendida     emitsPower>0
  rompe el muro y levanta 5 piedras  no-entendida  —
  (vacía)                            no-entendida  —
```

**Y hay un test que exige que los cuatro grados aparezcan**, porque «nunca
devuelve nada» lo cumpliría igual un lector que contesta `no-entendida` a todo.

#### Las dos firmas que el puente NO puede inventar, y se dicen

- **`andá al río` sale como `orientacion`.** `Predicado` no puede hablar del
  lugar: se probó con `wet>=0.9`, `at.x>=8` y `distance<=1`, y los tres dan
  `interpretar → undefined`. La respuesta honesta no es inventar un predicado
  —sería una meta que el planificador persigue de verdad— sino decir que se
  entendió hacia dónde mirar.
- **`traé un palo` sale como `sin-camino`**, con esta frase: «entendí
  `holding(tag:fibroso)` y ningún esquema conocido lo establece». Es la
  diferencia entre avisar y mandar a alguien a un viaje que no termina.

#### El guardián que impide que el puente mienta

Todas las firmas —las escritas en `alias.ts` y las que `componer()` arma en
vivo— pasan por `interpretar` de `@anima/plan`, que es el mismo lector que usa
la mente. Sin eso, la tabla puede apuntar a cualquier cosa y nada se pone rojo
hasta que una criatura sale a perseguir un predicado inexistente.

#### Tres cosas que los tests dieron vuelta

1. **`ahoguera` estaba en la tabla de alias.** Con la falta de ortografía
   adentro, «construi una ahoguera» y «construí una hoguera» daban **la misma
   confianza**: el emparejamiento difuso, que existe justamente para eso, no se
   estaba ejerciendo en el único caso que lo justifica. Sacada, la frase mal
   escrita baja de 0,67 a **0,57** y el difuso se la gana.
2. **El atajo de la meta no podía ser global.** «Atá la vara con la hebra» tiene
   `hebra` adentro, que el puente mapea a `freeStrandEnds>=1`, así que el atajo
   contestaba «conseguí una punta suelta» cuando lo que se pidió es que ATE las
   dos cosas. La regla que quedó: el atajo vale para los verbos de **conseguir**
   —donde lo que se nombra es lo que se quiere— y no para los de **transformar**,
   donde lo que se nombra es con qué.
3. **`palo` da `fibroso`, no `vegetal`.** La primera versión del test afirmaba
   `vegetal` copiándolo de un informe en vez de mirarlo salir: `tagDe` elige el
   tag más específico contándolo del catálogo, y `fibroso` cubre menos
   sustancias.

Medido: `@anima/lang` **28 tests**, y la suite entera **2726** (eran 2698),
typecheck limpio en los diez paquetes.

### Tramo D — la costura soldada, y las cuatro clases de lo que falta

Antes de este tramo, medido: **cero llamadas a `goalGraph` en producción** y **un
solo sitio** que construía un `GoalNode` —un literal de una línea en
`mind/src/escalera.ts:1452`, con `after: []` y sin `binds`—. O sea que el
planificador sabía leer un `binds` y la mente nunca le mandaba uno: la costura
estaba partida en dos y las dos mitades ya estaban escritas.

**Corrido de punta a punta contra la escena canónica del Hito 5**, sin ninguna
intención escrita a mano:

```
── DE LA FRASE AL PLAN ──
  hacé fuego                     1 nodo(s)  ir·sostener·deshilachar·frotar
  pescá algo                     1 nodo(s)  ir·sostener·ir·sostener·unir·ir·aplicar
  conseguí comida                1 nodo(s)  ir·sostener·ir·sostener·unir·ir·aplicar
  fabricá una trampa para peces  1 nodo(s)  sostener·ir·sostener·unir
  construi una ahoguera          1 nodo(s)  ir·sostener·deshilachar·frotar
  andá al río                    0 nodo(s)  — «ir» no lleva a un estado del mundo que yo sepa nombrar
  traé un palo                   1 nodo(s)  — holding(tag:fibroso)
  xyzzy plugh                    0 nodo(s)  — no reconocí ningún pedido en esa parte
```

**«Fabricá una trampa para peces» es cuatro pasos que nadie escribió**, y la
palabra «trampa» no aparece en ninguno: el plan lo armó la regresión sobre
`catch>0`. Y «construi una ahoguera», mal escrita, da exactamente el mismo plan
que «hacé fuego».

#### El `bindeaSlot` no se adivina nunca

El campo **no se valida en ninguna parte**, ni por tipos ni por nombre, y falla
de dos formas opuestas. Medido sobre la meta de asar, con una fogata a la vista:

| qué se pasó | qué salió |
|---|---|
| `slot: 'comida'` (el correcto) | plan de **5 pasos** |
| sin `binds` | plan de **12 pasos**: vuelve a pescar de cero |
| `slot: 'este-rol-no-existe'` | **idéntico byte a byte** al de sin `binds` |
| `slot: 'fuego'` | plan **verde de 10 pasos** poniendo la comida encima del pescado |

El primero vale siete pasos. El tercero se evapora en silencio. El cuarto sale
verde pidiendo un disparate. **Así que este paquete sólo liga cuando el par
(firma, slot) está en una tabla escrita a mano y medida.** Perder una ligadura
cuesta siete pasos; poner la equivocada manda a la criatura a hacer algo absurdo
con cara de éxito.

#### Y una cláusula NEGADA no se convierte en objetivo

`GoalNode` no tiene signo. Convertir «no hagas fuego» en la meta `emitsPower>0`
mandaría a la criatura a hacer exactamente lo que le prohibieron. Se descarta
diciéndolo: *«lo que me pediste que NO haga lo entendí, pero todavía no sé
guardarme una prohibición»*. Es lo único honesto que se puede hacer hoy — una
restricción es otra cosa que un objetivo y este sistema no tiene dónde ponerla.

#### Las cuatro clases, distinguiéndose

```
── QUÉ FALTA ──
  holding(tag:liquido)   proceso    «no hay ninguna ley en este mundo que lleve a eso»
  emitsPower>0           habilidad  «sé cómo se hace, pero acá y ahora no me dan las cosas»
  jointCount>=3          plano      «sé atar cosas, pero no sé qué forma tiene lo que me pedís»
  magnetismo>=1          fisica     «eso no existe en este mundo: no sé ni cómo se llamaría»
```

El orden de las preguntas va **de abajo hacia arriba**: primero si la materia
existe, después si hay ley, después si alguien sabe correrla, y al final si falta
la forma. Al revés daría respuestas prolijas y falsas —«te falta un plano» cuando
lo que falta es una sustancia que el mundo no tiene—, que es la peor de las
cuatro porque manda al cuidador a intentar algo imposible.

**Tres rojos lo corrigieron, y los tres eran míos:**

1. **`jointCount` no es una `QualityId`.** Es una función de la forma del cuerpo,
   y el catálogo cerrado de `quality.ts` no la tiene. La primera versión la
   pasaba con un `as QualityId` y el portón de la física la clasificaba como
   `fisica` — la respuesta que le dice al cuidador que no hay nada que hacer.
2. **Para las firmas de la forma, «¿hay una ley que establezca ESTA firma?» es la
   pregunta equivocada.** `union` declara `freeStrandEnds>=1`, `reach>=2` y
   `catch>0`, y **no declara `jointCount`** — así que la respuesta salía «no hay
   ninguna ley que dé esa forma», que es falsa: atar es exactamente hacer juntas.
   La pregunta correcta es **¿existe alguna ley que ensamble?**
3. **`holding(tag:liquido)` es `proceso`, no `habilidad`.** El agua existe y es
   líquida, así que la materia está; lo que no hay es ninguna ley que la ponga en
   una mano. Decir «falta que alguien escriba el cómo» mandaría al cuidador a
   esperar a la fragua por algo que la fragua no puede resolver.

Y un cuarto que era del arnés y también tenía razón: **«pescá algo» daba `gap`
porque el pozo estaba en tierra seca.** El esquema de `extraccion` lleva
`cellHints: { source: [wet >= AGUA_FRANCA] }`, o sea que un pozo sin agua no es
un pozo del que se pueda pescar.

Medido: `@anima/lang` **37 tests**, suite entera **2735**, typecheck limpio en los
diez paquetes.
