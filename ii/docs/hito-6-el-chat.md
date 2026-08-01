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
| **1** | **Ninguna frase del corpus devuelve «nada»** con el proveedor apagado | una corrida, contando las que salen sin intención |
| **2** | **Con el proveedor COLGADO —30 s, o nunca— el p95 es el mismo** que apagado | dos corridas; la diferencia tiene que ser ruido, no una cola |
| **3** | **Con el proveedor CONTESTANDO, la cobertura SUBE** y el p95 no se mueve | tercera corrida; se cuentan las cláusulas que llegan a una meta |
| **4** | **p95 de mensaje a primer movimiento < 150 ms** en las tres | `msHastaPrimerMovimiento`, p50 y p95 |
| **5** | **El acuse aparece en el mismo frame que el mensaje** | se afirma por MECANISMO, no por cronómetro |
| **6** | **`consistenciaDelPrimerGesto ≥ 0.85`** con el proveedor apagado | primer gesto coherente con la conducta final / órdenes totales |

Y **la cobertura sin red no es un punto del criterio**: es una línea base. La
primera corrida del corpus la fija y el build falla si baja. El porqué está en el
ADR II-0024 § 2 — el `≥80%` original se eligió antes de tener el corpus.

### El 2 y el 3 son un PAR, y separarlos fue un error

La primera versión de esta tabla tenía cinco puntos y **el 3 no estaba**. El
agujero sólo se ve cuando se juntan dos de los otros:

> **Los cinco puntos se cumplían igual con el proveedor DESCONECTADO.** El punto
> 2 —«colgado da el mismo p95»— es trivialmente verde si el proveedor no existe.

O sea que el criterio medía que el modelo **no estorbe** y no medía que **sirva**.
Es un piso correcto y no es un hito. Ver la enmienda del
[ADR II-0024](decisions/II-0024-el-piso-del-chat-no-es-sin-llm-es-sin-espera.md).

### Y el «corpus de 200 frases» también se fue

Era la otra herencia del mundo sin modelo. Ese número medía **cobertura por
enumeración**, que es lo único que se puede hacer cuando el léxico escrito a mano
es el único lector.

Además su premisa era falsa: decía que las 200 salen «del historial de chat del
repo actual, que existe» y **el historial tiene nueve mensajes**, cuatro de ellos
briefings de un desarrollador. Lo que sí es verdad, y nadie lo había escrito, es
que **los tests de Ánima I son el corpus** (~187 frases).

**Ninguna se inventa, ni con modelo ni sin él.** Un corpus generado por un modelo
mide el lector contra frases que inventó otro modelo — peor que medirlo contra los
tests, que al menos los escribió una persona.

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
se dibuja sobre el corchete y el `U+036F` sobre el guión: la clase **se lee**
`[-]`.

**Y acá hay un número corregido, del lado que importa.** Este documento decía que
esa clase «engancha guiones y nada más». Es falso, y se midió barriendo los
65.536 puntos de código del BMP contra las dos formas:

```
  codepoints donde difieren: 0
  la cruda matchea «-»?  false
  la cruda matchea «[»?  false
```

**La regex cruda hace exactamente lo mismo que la escapada.** El motor lee las
dos marcas como los extremos del rango; el dibujo engaña al humano y no al
parser. Así que lo que el guardián defiende **no es un comportamiento distinto**:
es que **no se pueda revisar**. Quien lee ve `[-]`, tiene que adivinar que hay
dos marcas, no puede contarlas, y un diff que las cambie por otras dos no muestra
nada.

Con los seis NUL de `physics/src/plano.ts` era al revés —ésos **sí** cambiaban el
hash de todo plano—, y vale decir cuál es cuál: la regla es la misma y el daño
no. El guardián se amplió con esta segunda clase —una marca que **no viene detrás
de una letra**— y con una tercera, los invisibles que no son de control.

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

### Tramo E — los tres relojes y el criterio, corrido

El cronómetro **entra por parámetro**, porque `performance.` está prohibido en
`src/` y un paquete determinista que lee el reloj del sistema deja de dar el
mismo resultado dos veces. Es la misma solución que `perceive/src/bucle.ts` ya
usa para `ticksPerdidos`.

Y `Reloj.resumen()` devuelve **`undefined` sin muestras, no un resumen de
ceros**, por una trampa que este proyecto ya cobró: `ticksPerdidos` por omisión
no puede subir —su mitad interesante se mide contra un reloj que
`PartidaOptions` deja en `undefined`— así que su cero no dice «llegamos a
horario», dice **«nadie miró»**.

#### EL VEREDICTO, con `ANIMA_BANCO=1` · exit 0

```
── EL CORPUS: 77 frases ──
  orden-con-objeto  25 · respuesta-corta 12 · orden-simple 10 · pregunta 8
  referencia 7 · identidad 4 · temporal 4 · negativa 3 · compuesta 2 · condicional 2
  ── con faltas de ortografía: 27
  ── del historial de chat REAL: 5

(1) 77 frases · 0 sin respuesta
(4) acuse p50 0,031 ms · p95 0,088 ms · ventana del tick 50 ms

── MENSAJE → PRIMER MOVIMIENTO ──
  apagado          p50    0.05 ms   p95    1.52 ms   máx    2.97 ms
  colgado          p50    0.06 ms   p95    1.29 ms   máx    2.12 ms
  EN EL CAMINO     p50   20.07 ms   p95   21.22 ms   máx   21.93 ms   ← el control
```

**El control positivo es la tercera fila y va afirmado ANTES que la comparación.**
Un test que compara dos p95, los encuentra iguales y da verde es exactamente el
cero que sale de no tener qué medir. La corrida «en el camino» pone al proveedor
antes del acuse a propósito y tiene que dar peor; si no da peor, el arnés no ve
al proveedor y la comparación de al lado no vale nada.

Y el proveedor simulado quema **20 ms** contra los **900 de TTFT** que la tabla
del documento le da a uno real: el control es 45× más suave que la realidad.

#### Estado de los cinco puntos

| # | qué pide | estado |
|---|---|---|
| **1** | ninguna frase devuelve «nada» | **CUMPLE** sobre 77 · 0 sin respuesta |
| **2** | proveedor colgado = mismo p95 | **CUMPLE** con su control positivo (1,29 contra 1,52, y 21,22 el control) |
| **3** | p95 < 150 ms | **CUMPLE** con holgura de 100× |
| **4** | acuse en el mismo frame | **CUMPLE por mecanismo**: `leer` es sincrónica y el guardián de la regla 2 prohíbe `await` en todo `src/` |
| **5** | `consistenciaDelPrimerGesto ≥ 0,85` | **NO MEDIDO.** El acumulador existe (`Consistencia`), y nada lo alimenta |

**Lo que falta, dicho con el número:**

1. **123 frases** para llegar a 200. Las 77 que hay son las que las mediciones
   dejaron citadas con archivo y línea, o sea las verificables una por una. El
   resto es extracción, no invención — y el barrido que las iba a traer quedó
   cortado a mitad de camino.
2. **El punto 5 no está medido**, y no es un olvido: comparar el primer gesto con
   la conducta final pide correr la mente sobre ticks, y `@anima/lang` no depende
   de `@anima/mind` ni tiene por qué. El acumulador está escrito para que quien
   corra esa partida sólo tenga que llamarlo.

### Tramo F — por dónde entra el modelo, y el punto 3

El ADR II-0024 decía que el modelo entra por la confianza y que **«la puerta ya
existe»**. Existía como NÚMERO —`leer()` devuelve confianza desde el primer
tramo— y **no como hueco**: no había por dónde enchufar nada. Este tramo lo
construye, y de paso destapa que el criterio medía la mitad.

#### La forma se la dictan tres restricciones que no se negocian entre sí

1. **el acuse sale en el mismo frame**, así que `leer()` no puede esperar a nadie;
2. **la regla 2 prohíbe `await`/`async` en todo `src/`**, con guardián puesto;
3. **el proveedor no está en el camino del primer movimiento**.

Las tres juntas dejan exactamente una salida: **este paquete no llama al modelo,
lo DESCRIBE.** `leer()` devuelve la lectura y, si la confianza quedó baja, una
`Consulta`: qué preguntaría, con qué vocabulario, con qué firmas para elegir y con
qué llave de caché. Qué se hace con eso es del llamador, que sí puede esperar.
Cuando la respuesta vuelve —un tick después, treinta segundos después, o nunca—
`revisar()` produce una lectura nueva.

**No es un patrón inventado para la ocasión.** Es el mismo que
`perceive/src/bucle.ts` usa para el reloj de pared: necesita saber si un tick
llegó tarde, que es tiempo del sistema, y **no lo llama, lo recibe**. La frontera
con el mundo asincrónico es el llamador, no el paquete.

#### Lo que el modelo puede contestar, y nada más

**Firmas de predicado, elegidas de una lista que va en la consulta.** No texto
libre: si contestara texto habría que volver a parsearlo, y el problema de
parsear castellano es justamente el que se está resolviendo — con el agravante de
que el segundo texto no lo escribió una persona.

Y aun así se validan una por una contra `interpretar`, que es el mismo lector que
usa la mente. Es el ADR II-0001 aplicado acá: **el modelo propone, el código local
dispone.**

#### EL PUNTO 3, medido

```
── COBERTURA DEL CORPUS ──
  sin proveedor .... 10/80 = 13%
  con proveedor .... 24/80 = 30%   (14 cláusulas las leyó el modelo)
```

El modelo simulado tiene una tabla de nueve pistas y es chico **a propósito**: no
está para ser bueno, está para que la corrida con proveedor exista y se pueda
comparar. Uno que acertara todo mediría el simulador, no el enganche.

Y lo que el modelo leyó **queda marcado** (`leidaPor: 'modelo'`). No es telemetría
de adorno: es la tentación que el propio ADR anota —con el modelo disponible, la
salida barata para cada frase que no se entiende es mandarla al modelo en vez de
arreglar el léxico—. Si esa columna crece, el léxico se está oxidando.

#### El invariante, con su control positivo

> **`revisar` nunca empeora una lectura.**

Si la respuesta no valida —llave vencida, firma ilegible, índice que no existe o
que ni es entero— devuelve **el mismo objeto**, para que quien llame pueda
comparar por identidad. Y no toca lo que el lector local sí supo leer: si la
lectura local llegó a una meta, esa meta la produjo el léxico de este mundo y vale
más que una propuesta de afuera.

Un invariante sin control positivo es una intención, así que hay un barrido que le
manda basura a propósito:

```
  77 frases × 4 clases de basura · 0 empeoradas
```

#### Y dos cosas que NO se consultan

- **`entendida`** — ya hay algo que hacer, y preguntar costaría plata para
  confirmar lo que se sabe.
- **`sin-camino`**, y es la decisión menos obvia: ahí el problema no es la lectura
  sino el mundo. Se entendió perfecto y ningún esquema lo establece, así que
  preguntarle al modelo cómo se dice no arregla nada. Eso es del Hito 8, que
  escribe la habilidad que falta.

#### Una corrección sobre el corpus, que estaba en la dirección equivocada

El tramo anterior decía «faltan 123 frases para las 200». **Ese número ya no
existe**: el 200 se fue con la enmienda. Lo que queda es terminar de extraer las
~110 frases reales que el barrido midió y este archivo todavía no transcribió — y
sigue sin poder inventarse ninguna.

### Tramo G — el portón que no estaba, y cinco números corregidos

Un adversario de 48 agentes —seis lentes, cada hallazgo pasado por un escéptico
antes de creerle— sobre el trabajo de los tramos A a F. Lo que sobrevivió.

#### El grande: `revisar` producía un estado que `leer` no puede producir

`revisar` tenía cuatro portones y le faltaban dos. Medido sobre el corpus:

```
  consultables 61 · coladas como «entendida» con una firma inalcanzable: 62
```

Los dos que faltaban:

1. **la firma tiene que ser una de las que se OFRECIERON.** El encabezado del
   archivo decía —y dice— que el modelo «contesta firmas elegidas de una lista
   que va en la consulta», y `Consulta.firmas` existe exactamente para eso.
   **Nadie lo hacía cumplir:** `interpretar` sólo dice que la firma es legible.
   `toxicity>=1` es legible, no se ofreció nunca, y entraba.
2. **el grado se GRADÚA, no se asigna.** Escribía `grado: 'entendida'` a secas,
   sin preguntarle a `sabeElCatalogo` — que es justo el portón que `graduar()`
   usa en el camino local para separar `entendida` de `sin-camino`.

El segundo es el que rompe el invariante del archivo, y de una forma que el
barrido de basura **no podía ver**: sus cuatro clases mueren todas en
`interpretar`. Lo que se cuela es una firma **válida y fuera de lugar**, que es
exactamente lo que un modelo alucina. Un modelo no escribe `no-es-una-firma`,
escribe algo que parece.

El barrido ahora tiene **seis** clases y su control positivo:

```
  77 frases × 6 clases de basura · 0 coladas
  sin los portones nuevos se colarían 62 cláusulas
```

#### Los guardianes que no guardaban

- **El de la regla 2 no bajaba a subdirectorios.** `readdirSync(SRC)` de un solo
  nivel. Se plantó `src/sub/malo.ts` con `Math.random`, `Date.now`,
  `performance.now`, `localeCompare`, `Math.sqrt`, `2 ** 3` y `async/await`
  adentro: **verde**. Y en esta base las subcarpetas de `src/` son costumbre
  (`physics/src/data/`, `skills/src/innatas/`).
- **El de bytes invisibles veía dos clases y hay diez.** Se le agregaron los ocho
  que no son de control —ZWSP, ZWNJ, ZWJ, LRM, RLM, WJ, BOM y el espacio duro— y
  **encontró dos infracciones reales en el acto**, una de ellas deliciosa:

  > `physics/src/admit.ts:2409` es un comentario que explica un ataque de
  > caracteres invisibles —un id de proceso con un espacio de ancho cero pegado—
  > **demostrándolo con un espacio de ancho cero de verdad**. El lector tenía que
  > creerle. Ahora el escape va escrito.

  La otra era mía, en `objetivos.ts`.

#### Y el número corregido que más duele, porque era una explicación entera

El tramo A publicó que la regex de acentos escrita con las marcas crudas «se lee
`[-]`, una regex que engancha guiones y nada más». **Es falso.** Medido barriendo
los 65.536 puntos de código del BMP contra las dos formas:

```
  codepoints donde difieren: 0
  la cruda matchea «-»?  false
  la cruda matchea «[»?  false
```

**La cruda hace exactamente lo mismo que la escapada.** El motor lee las dos
marcas como los extremos del rango; el dibujo engaña al humano y no al parser.

La regla sobrevive entera y su razón cambia: lo que el guardián defiende **no es
un comportamiento distinto**, es que **no se pueda revisar**. Quien lee ve `[-]`,
tiene que adivinar que hay dos marcas, no puede contarlas, y un diff que las
cambie por otras dos no muestra nada. Con los seis NUL de `plano.ts` era al revés
—ésos **sí** cambiaban el hash de todo plano— y vale decir cuál es cuál.

#### Los otros cuatro

- **`cubiertas()` sobrecontaba.** Sumaba `e.palabras` en cada índice, así que una
  palabra que dos entradas se disputan contaba dos veces: «algo de comer» daba
  **6 sobre 3 palabras, 200% de cobertura**. Los números publicados no se mueven
  —ninguna de las once frases tiene el caso— pero eran correctos **de
  casualidad**, y el comentario vendía la casualidad como propiedad del léxico.
- **El título de un test decía 15% y su propia salida decía 9%.**
- **Tres encabezados de `src/` seguían publicando «15% de cobertura» y «el mundo
  conoce UNO de doce verbos»**, los dos ya corregidos a 9% y cero desde el tramo B.
- **El corpus imprimía «FALTAN PARA 200»** y ese número se fue con la enmienda.

Medido: `@anima/lang` **54 tests**, `ANIMA_BANCO=1` exit 0, `@anima/world` **631**
(eran 629), suite entera **2757**, typecheck limpio en los diez paquetes.
