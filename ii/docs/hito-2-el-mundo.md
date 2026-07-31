# Hito 2 — El mundo determinista

> **TRES DE LOS CUATRO CRITERIOS PASAN. EL DE RENDIMIENTO NO, Y LA CAUSA NO ESTÁ
> EN ESTE PAQUETE.**
>
> | Criterio del plan de construcción | | Medido |
> |---|---|---|
> | dos mundos gemelos con 10⁵ intenciones → mismo `hashWorld` | ✔ | 100 000 intenciones exactas, 11 checkpoints coincidentes |
> | restaurar a mitad reproduce el final exacto | ✔ | corte en el tick 500, restaurado desde la cadena de deltas |
> | 5000 cuerpos a menos de 4 ms por tick | ✘ | **8,65 ms** · 2,2× el techo · era 39,8 · el 90% es `@anima/physics` |
> | el mismo hash en Chrome y en Firefox | ⏳ | no se puede correr desde Node; falta el arnés, y está descrito abajo |
>
> `@anima/world`: **258 tests verdes**, typecheck limpio, `pnpm ii:test` entero
> en verde: **811 tests** (548 de física + 258 de mundo + 5 de habilidades).
>
> El criterio (c) **NO se cumple**, y el número está verificado dos veces con dos
> arneses independientes. Lo que sí está verificado es que la optimización que lo
> bajó de 39,8 a 8,65 **no movió ninguna conducta**, y eso se probó corriendo la
> misma huella y la misma partida contra las fuentes anteriores. Ver
> [la verificación independiente](#la-verificación-independiente-de-c).

```bash
pnpm --filter @anima/world typecheck && pnpm --filter @anima/world test
pnpm --filter @anima/world banco     # los números de rendimiento, medidos
```

---

## Qué se construyó

Once módulos, escritos por tres agentes en paralelo y unidos en un pase de
integración. En capas, de la geometría hacia arriba:

| | |
|---|---|
| `cell.ts` | La geometría y el layout de campos. Las cualidades de celda **se derivan del catálogo** de `@anima/physics`, no se vuelven a escribir. |
| `chunk.ts` | 16×16 celdas, un `Int32Array` por campo, más el índice de cuerpos de esas 256 celdas. |
| `grid.ts` | Chunks materializados por demanda e índice espacial O(1) mantenido **incrementalmente**. |
| `intent.ts` | La forma de una intención, el compromiso que declara el mundo, y el orden total. |
| `step.ts` | `stepWorld` puro: intenciones primero, sistemas después. La ley 12 vive acá. |
| `invariants.ts` | Las cinco preguntas por tick, y la quinta es la que sostiene el producto. |
| `hash.ts` | `hashWorld`: FNV-1a de dos carriles sobre un flujo canónico de bytes. |
| `journal.ts` | La crónica append-only con cadena de hashes, y `replay`. |
| `snapshot.ts` | Snapshot por delta sobre el mundo visto como ranuras. |
| `mundo.ts` | **El puente**, escrito en el pase de integración. |
| `index.ts` | La puerta del paquete, con `export *`. |

### El pase de integración, que era el trabajo que faltaba

Los tres agentes entregaron tres cosas que **no se tocaban**, y eso tenía una
consecuencia concreta: el criterio del hito dice «mismo `hashWorld`» y estaba
verificado dos veces sobre dos cosas distintas —una huella escrita a mano sobre
el mundo de verdad, y `hashWorld` sobre un mundo de juguete de treinta líneas—.
Ninguna de las dos era la frase del documento.

**1. Una sola clave de celda.** `cell.ts` exportaba `cellKey(x, y)` con orden por
filas e `intent.ts` exportaba `cellKey(at)` con orden por columnas, las dos sobre
el mismo mundo de ±2²⁰ y con el mismo span: **dos formas canónicas de la misma
cosa en el mismo paquete**, que es la semilla exacta de una divergencia de hash.
Quedó la de `cell.ts`; `intent.ts` la importa. `WORLD_MIN`/`WORLD_MAX` ahora se
**derivan** de `CELL_LIMIT` en vez de estar escritos dos veces, y `enRango`
delega en `inWorld`. Consecuencia útil: las claves que `step.ts` pone en
`WorldState.cells` son las mismas que indexan el terreno de la grilla.

**2. `src/index.ts`.** Con `export *` y no con una lista curada a mano, por la
misma razón que `@anima/physics`: una lista a mano diverge. Y tiene una virtud
que acá vale más que la comodidad — **`tsc` avisa de las colisiones**. La
colisión de `cellKey` era invisible mientras el archivo no existiera; en cuanto
existió, no compilaba.

**3. `src/mundo.ts`, el puente.** Traduce el `WorldState` a lo que `hash.ts` y
`snapshot.ts` saben leer, sin agregar una sola regla de mundo:

- `hashWorldState(s)` — el hash del criterio, que es `hashWorld` sobre la forma
  canónica del estado y **no una cuenta paralela**. Dos hashes en el mismo
  paquete serían dos verdades sobre lo mismo.
- `hashPhysics(phys)` — el catálogo hasheado y **memorizado por identidad** en un
  `WeakMap`. Es correcto porque `conSustancia` construye una `Physics` nueva en
  vez de mutar la vieja, o sea que la identidad del objeto ya es la versión.
- `worldSlots(s)` / `restoreWorld(slots)` — el mundo como ranuras y el camino de
  vuelta. `restoreWorld` es **autosuficiente**: no recibe una `Physics` de
  afuera, porque si la recibiera el test de restaurar estaría reusando la
  variable viva del mundo que dice haber guardado, y una sustancia que la ley 4
  dio de alta a mitad de la partida entraría por la puerta de atrás.
- `pasoDelMundo` — `stepWorld` con la forma que `replay` espera, **y verifica el
  tick**: si el replay y el mundo se corren uno respecto del otro, el resultado
  no es un error sino un mundo coherente con un tick de menos.

---

## El criterio, uno por uno

### (a) Dos mundos gemelos con 10⁵ intenciones → mismo `hashWorld` ✔

`tests/hito-2-el-criterio.test.ts`. **10 000 ticks × 10 intenciones = 100 000
exactas**, sobre diez criaturas y seis cosas —suficiente contención para que dos
quieran el mismo palo—, con la mitad de las intenciones basura a propósito:
cuerpos que no existen, compromisos mal declarados, actores inventados. El
determinismo tiene que valer también para el camino del **rechazo**, que es el
que más ramas tiene y el que nadie mira.

El gemelo **no es una copia**: se arma con los cuerpos y los actores dados de
alta en el orden inverso. Coinciden tres cosas:

- la cadena de hashes de los dos journals (cada `append` hashea su intención, así
  que la cadena coincide solo si las 100 000 son bit a bit iguales);
- el `hashWorldState` de los dos mundos finales;
- **los once checkpoints**, uno por uno.

Los checkpoints no son adorno, y por qué está en (d).

Control negativo: dos semillas distintas dan mundos y cadenas distintas.
Y la otra mitad del determinismo, que no se ve correr: **el orden de llegada de
las intenciones del tick no cambia el hash**, verificado con veinte barajados del
mismo tick.

### (b) Restaurar un snapshot a mitad reproduce el final exacto ✔

Se restaura **desde la cadena de deltas**, no desde la variable en memoria: lo
que hay que probar es que lo guardado alcanza. Corte en el tick 500 de 1000,
`restoreAt` sobre la cadena, `restoreWorld`, y `replay` desde ahí hasta el final
con los checkpoints verificados en el camino. Mismo `hashWorldState` que la
corrida de una.

Y el delta cobra por lo que cambió: veinte ticks después de la base, el eslabón
tiene menos de la mitad de las ranuras de la base. Es la promesa entera del
snapshot por delta contra el `structuredClone` que crece con la partida.

### (c) 5000 cuerpos a menos de 4 ms por tick ✘ — **8,65 ms** (era 39,8)

`pnpm --filter @anima/world banco`. Los números son de esta máquina y se vuelven
a correr; no se copian a mano a ningún comentario.

```
── EL TICK, con 5000 cuerpos ─────────────────  techo del criterio: 4 ms
  stepWorld, tick completo .............. 8.65 ms   NO PASA (2.2× el techo)
  paso() de @anima/physics, solo ........ 7.79 ms   90.0% del tick
  lo que agrega @anima/world ............ 0.86 ms

── LA ESCALA A LA QUE EL MUNDO YA CORRE ───────────────────
  500 cuerpos ........................... 0.86 ms   PASA
  cuerpos que entran hoy en 4 ms ....... ~2311   (extrapolado; medido son ~2100)
```

> **El «cuerpos que entran» del banco es una extrapolación lineal**
> (`Math.round((4 / tick) × 5000)`), y el tick no es del todo lineal en la
> cantidad de cuerpos. Medido punto por punto —500, 1000, 2000, 3000, 4000,
> 5000— e interpolado entre los dos que rodean al techo, los que entran son
> **~2100**, no ~2311. La diferencia es del 10% y siempre para el mismo lado: la
> extrapolación da de más.

**El diagnóstico anterior era correcto y está reparado.** Decía que una sola
lectura de cuerpo costaba 6,43 ms —más que el tick entero permitido— y que
`paso()` la hacía cinco veces. Eso ya no es así:

| | antes | ahora |
|---|---:|---:|
| el tick completo, 5000 cuerpos | 39,66 ms | **8,65 ms** |
| `paso()` de `@anima/physics`, solo | 39,79 ms | **7,79 ms** |
| lecturas de cualidad por cuerpo y por tick | 77 | **13,6** |

Lo que se hizo, todo sin mover una conducta:

1. **la `Lectura` es perezosa y memoizada.** Armaba trece cualidades de golpe para
   que cada ley usara dos o tres. Ahora cada campo se calcula la primera vez que
   se lo pide y se recuerda. Está atada a UN cuerpo, y como los cuerpos son
   inmutables un valor memoizado no puede quedar viejo mientras su lectura viva;
2. **`paso()` no relee cuando la ley devolvió el mismo cuerpo.** No todo arde, no
   todo se pudre, casi nada transmuta: releía trece cualidades para obtener los
   trece números que ya tenía;
3. **`qualityOf` dejó de construir un `Set`** de detección de ciclos en cada
   llamada. Las veintiuna cualidades que se guardan no tienen ninguna derivada en
   juego y el `Set` se armaba cientos de miles de veces por tick para no usarse;
4. **el candado de conservación leía la masa seis veces** por cuerpo para obtener
   dos números. Ahora una por lado, y las cuentas que ninguna ley tocó se leen una
   vez en lugar de dos;
5. y un puñado de cosas chicas: la spec se busca una vez y no dos, `recortar` mira
   antes de construir, `tagsDe` se guarda junto al array de partes del que depende.

Que esto haya sido una **optimización y no una reescritura** no es una promesa del
que la hizo: hay una huella de conducta nueva
(`physics/tests/huella-de-conducta.test.ts`) que mezcla, sobre 240 cuerpos contra
28 entornos y doce ticks cada uno, el cuerpo resultante bit a bit, las leyes que
corrieron y las sustancias que la ley 4 dio de alta. **Vale 3705094564.**

Y esa huella la escribió el mismo que optimizó, o sea que por sí sola solo dice
«esto no se movió desde que la escribí». Lo que la convierte en prueba está en
[la verificación independiente](#la-verificación-independiente-de-c): **el mismo
número sale con las fuentes de física de 11b49ae**, anteriores a la primera línea
de la optimización.

**El banco tenía un error de medición, y salió a la luz al bajar la física.**
`msPorTick` avanzaba el mundo (`w = stepWorld(w).state`) mientras `msSoloLeyes`
corría siempre sobre los cuerpos del estado inicial, así que la resta le cobraba
al mundo la diferencia entre dos poblaciones de cuerpos. Mientras la física se
llevaba el 100% del tick la diferencia quedaba tapada por el ruido; con la física
cinco veces más barata, decía que el mundo costaba 2,1 ms. **Medido sobre el mismo
estado, el mundo cuesta 0,76 ms**, dentro de su presupuesto propio de 2 ms. El
banco ahora mide las dos cosas sobre un estado fijo.

**Lo que falta son 2,1×, y no es otra micro-optimización.** El perfil quedó
PLANO: ningún renglón pasa del 13%, y los grandes son irreducibles sin cambiar la
representación —las 13,6 lecturas de cualidad, los ~6 objetos nuevos por cuerpo y
por tick (los cuerpos son inmutables y cada ley devuelve uno nuevo), y una
búsqueda de sustancia en un `Map` por cada cualidad que no está en `state`.

> Mientras una cualidad se resuelva preguntando a `state`, después a las partes y
> después a la sustancia, el piso son ~1,2 µs por cuerpo.

Un cuerpo con sus 29 cualidades ya resueltas en un vector numérico —recalculado
solo cuando las partes cambian— borraría las tres cosas de una vez. Eso es un
cambio de representación y pide su propio ADR; no entra en «optimizar sin cambiar
una conducta».

El criterio se sigue dejando marcado con `it.fails` y **no con el umbral
relajado**. Un criterio que se mueve para dar verde no es un criterio, es una
decoración; es además el idioma con el que la física dejó marcados los diez huecos
abiertos de `admit()`.

**Y el número accionable se multiplicó por 4,3: hoy entran ~2100 cuerpos en 4 ms**,
contra ~485 antes. El mundo ya corre a 30 Hz a esa escala, que es de sobra para el
Hito 3 y para la demo del Hito 5 —una criatura, un río, un matorral—. Los 5000 son
el techo de la arquitectura, no el requisito de la próxima demo, y **no bloquean
nada de lo que sigue**.

### (d) El replay del journal reconstruye el estado exacto ✔

A dos escalas: 1000 ticks con once checkpoints, y **la del criterio, 10⁵
intenciones**, reproducida entera desde el journal contra el mundo corrido en
vivo. Más:

- el replay corre **todos** los ticks, también los que no tienen intención,
  verificado con un journal que tiene un hueco de cincuenta ticks. Las doce leyes
  corren solas: un replay que saltara del tick 100 al 140 no daría un hash
  distinto, daría un mundo **coherente y equivocado**;
- la crónica sobrevive al viaje por JSON y sigue reproduciendo.

**El control negativo salió rojo dos veces, y las dos veces enseñó algo.**

*Primera: el hash es del mundo y no de su narración.* Cambiar las intenciones del
tick 3 por esperas no movía nada, porque en ese tick las seis intenciones
sorteadas habían sido todas rechazadas: lo único que cambiaba eran los eventos.
Un control negativo tiene que perturbar el **estado**.

*Segunda: qué olvida este mundo y qué no.* La crónica del mundo de juguete había
encontrado que una intención vieja se borra —el calor se disipa, el agua se topa
contra cero— y concluido que comparar solo el hash final es una prueba débil. Es
cierto **para las magnitudes disipativas**. Acá se midió lo otro: una criatura
movida sigue movida a los 200 ticks, porque la posición no se disipa. Las dos
mitades juntas son la regla útil:

> Un control negativo sobre calor o humedad se apaga solo y hay que mirarlo con
> checkpoints. Uno sobre posición, existencia o inventario se sostiene.

Por eso (a) compara los once checkpoints y no el último. **Un motor con un bug de
determinismo puede divergir en el tick 400 y volver a converger para el 20 000, y
el hash final diría que todo está bien.**

### El cuarto criterio: el mismo hash en dos motores ⏳

**No se puede verificar desde Node**, que trae V8 y nada más. Lo que queda hecho:

- la **precondición**, y no es poco: `tests/ataque-determinismo.test.ts` lee los
  **once** fuentes del paquete —no tres— y falla ante `Math.random`, `Date`,
  `performance`, `Intl`, `localeCompare`, `**`, cualquier `Math` sin precisión
  especificada, o cualquier import de Ánima I. Con una lista blanca de lo
  permitido (`imul`, `floor`, `trunc`, `abs`, `min`, `max`) verificada por
  barrido, y con carnada para los doce patrones, porque un guardián que no se
  prueba a sí mismo puede estar leyendo el archivo equivocado y siempre dar
  verde;
- las **constantes que el navegador tiene que devolver**, clavadas con
  `toMatchInlineSnapshot`: el hash del mundo inicial, el de la física, el del
  mundo a los diez ticks y el de la cadena del journal. Son el mundo inicial y no
  el final de 10 000 ticks a propósito: un desacuerdo en el tick 0 es un bug de
  la forma canónica o del hash, y uno que aparece recién al final es de la
  aritmética de las leyes — poder distinguir los dos casos vale más que un solo
  número.

**Lo que falta, en concreto:** una página que importe `@anima/world`, arme la
partida de `hito-2-el-criterio.test.ts` con la misma semilla, corra los ticks e
imprima `hashWorldState(fin)` y `journal.chain`; abrirla en Chrome y en Firefox;
y si difieren, bisecar con los checkpoints que ya existen. El banco del Hito 0
(`pnpm ii:navegador`) ya levanta una página en `localhost:5180`: **la
infraestructura existe, falta la página.** Estimado: medio día.

---

## La verificación independiente de (c)

Un número de rendimiento que solo sabe producir el banco que lo diagnosticó no
está verificado: es la misma medición dos veces. Y una huella de conducta escrita
por el que optimizó solo dice «no se movió desde que la escribí».

Las dos cosas se rehicieron desde afuera, con código que no comparte una línea
con el banco: `world/tests/zz-remedicion.test.ts` (el tick) y
`world/tests/zz-partida-2000.test.ts` (la conducta a lo largo de una partida). Se
corren aparte, con `pnpm --filter @anima/world verificacion`, y por qué aparte
está más abajo.

### El número: confirmado, y el cambio de arnés no maquilló nada

El optimizador cambió el banco de medir un mundo que avanza a medir un estado
fijo. Eso podía ser una reparación honesta o una manera de elegir el número más
lindo, así que se midieron **las dos** con el mismo arnés independiente:

| | antes (11b49ae) | ahora | |
|---|---:|---:|---:|
| 5000 cuerpos, **estado fijo** (lo que el banco mide) | 42,16 ms | **8,62 ms** | 4,9× |
| 5000 cuerpos, **mundo que avanza** (lo que la partida hace) | 39,75 ms | **8,67 ms** | 4,6× |
| `paso()` solo | 39,14 ms | **7,63 ms** | 5,1× |
| lo que agrega `@anima/world` | 3,02 ms | **0,99 ms** | |

Las dos maneras coinciden dentro del 1%. **El cambio de arnés no movió el número:
lo hizo comparable.** El reporte del optimizador (39,66 → 8,5) es exacto.

### Lo que el corpus del banco no dice: un mundo heterogéneo cuesta ~20 ms

El banco mide 5000 varas de UNA parte, todas frías y todas iguales, que es el
camino más barato de `paso()`. Con un corpus de una a tres partes y temperaturas
a lo ancho de todo el rango útil —frío, ventana de cocción, pirólisis, ignición—:

| | antes | ahora | |
|---|---:|---:|---:|
| corpus variado, 5000 cuerpos, mundo que avanza | 55,87 ms | **19,93 ms** | 2,8× |

**Baja 2,8× y no 4,6×, y se queda en 20 ms.** La razón es que en ese corpus el
renglón que manda es otro y nadie lo tocó: cuando la ley 4 transmuta,
`conSustancia` **reconstruye la `Physics` entera** con `buildSeedPhysics`, una vez
por cuerpo que transmuta y por tick. La optimización trabajó sobre la lectura de
cualidades, que es lo que dominaba el corpus plano.

> «5000 cuerpos en 8,65 ms» es cierto para el corpus del banco. Para un mundo
> heterogéneo hoy son ~20 ms, y ahí el trabajo que falta no es la representación
> del cuerpo sino `conSustancia`.

### La conducta: no se movió, y eso está probado contra las fuentes viejas

Tres pruebas, las tres corriendo **el mismo archivo de test contra `body.ts`,
`leyes.ts` y `quality.ts` de 11b49ae** y contra los de ahora:

| | antes | ahora |
|---|---|---|
| huella de conducta de `paso()` (2880 pasos) | 3705094564 | **3705094564** |
| partida de 2000 ticks, hash final | `61d4b9588a81717d` | **`61d4b9588a81717d`** |
| los once checkpoints de esa partida | iguales | **iguales** |
| eventos / sustancias dadas de alta | 8004 / 30 | **8004 / 30** |
| huella del barrido de `fixed.ts` | 3391390248 | **3391390248** |

La partida no es un mundo quieto: ocho criaturas, dieciséis cosas, **cuatro
fogatas con algo apoyado encima**, celdas mojadas y celdas sin aire, y cuatro
intenciones por tick de las que la mitad son basura a propósito. La ley 4
transmuta y da de alta **cuatro sustancias** en el camino, o sea que la `Physics`
del mundo cambia a mitad de la partida — que es exactamente donde una memoización
por identidad de `Physics` se rompería. Los invariantes se revisan en **todos** los
ticks y no hay ni una violación de conservación.

### La caza de la caché mal invalidada

`physics/tests/zz-cache-mal-invalidada.test.ts`, 23 tests contra las cinco
memoizaciones que la optimización introdujo. Encontró **una sola diferencia de
conducta** en todo el trabajo:

> **`tagsDe` se quedó con los tags viejos si alguien muta el array de partes en
> su lugar.** Antes se recalculaban en cada llamada. Ahora se guardan en un
> `WeakMap` indexado por el array, así que agregarle una parte de carne a un
> cuerpo de piedra **por mutación** deja al cuerpo diciendo que no es orgánico.

No es alcanzable hoy y hay un barrido que lo sostiene: ninguna función del
paquete muta un array de partes que le dieron —toda operación construye uno
nuevo— y el test lo verifica corriendo las leyes sobre sesenta cuerpos contra tres
entornos y comparando la entrada bit a bit. Pero **convierte la inmutabilidad de
las partes de costumbre en invariante**: el día que alguien haga `parts.push` para
ahorrarse una copia, el cuerpo va a mentir sobre de qué está hecho y ningún test
de conservación lo va a ver.

Lo que **no** apareció, habiéndolo buscado:

| se buscó | resultado |
|---|---|
| un cuerpo que cambia de masa y se vuelve a leer | la lectura sigue a la masa nueva; 50 ticks de evaporación sin inventar nutrición |
| dos cuerpos distintos con el mismo id | nada se indexa por id |
| un cuerpo mutado después de leerlo | `qualityOf` no memoiza por cuerpo; `LecturaPerezosa` no sobrevive a su `paso()` |
| dos `Physics` con las mismas sustancias y distintos números | alternando mil veces, cada catálogo da lo suyo |
| **el resultado depende de qué cuerpo se leyó antes** | 200 cuerpos al derecho, al revés y salteado dan lo mismo cuerpo por cuerpo |
| el atajo del candado con una conservada DERIVADA | el guardia `conservadasSeGuardan` entra y el candado sigue cerrando |

El quinto es el que hacía falta y ningún test del árbol lo miraba: `sustanciaDe`
e `indiceDe` son memos de **una entrada en variables de módulo**, o sea estado
global mutable adentro del paquete que promete determinismo. Son puras, y «pura»
acá quiere decir exactamente eso: leer un cuerpo no puede depender de cuál se leyó
justo antes.

Y una sospecha que se cayó: `recortar` ahora mira antes de construir, y podía
haber cambiado qué pasa con una clave de estado presente-pero-`undefined`. No
cambia —las dos versiones la borran cuando el recorte dispara y las dos la
conservan cuando no— y además `exactOptionalPropertyTypes` hace que ese estado
**no se pueda escribir** en código tipado.

### Por qué los archivos de verificación corren aparte

`banco-el-tick.test.ts` afirma `expect(mundoSolo).toBeLessThan(2)` en
**milisegundos absolutos**, adentro de la corrida compartida de `pnpm ii:test`, y
su margen es de dos veces: con el árbol como estaba mide 0,74–1,10 ms contra un
presupuesto de 2. Agregarle a la corrida **un** archivo con trabajo de verdad lo
lleva a 3,3; agregarle los dos, a 6,8.

O sea que el banco se cae por que la máquina esté ocupada y no por que el mundo
haya engordado. **Es previo a esta verificación y previo a la optimización** —la
afirmación está igual en 11b49ae— y no se tocó: aflojarle el umbral a otro no es
trabajo del que verifica. Los dos archivos nuevos se corren con su propio comando
y `pnpm ii:test` queda como estaba.

Es la misma razón que el encabezado del banco ya daba para sí mismo, y vale la
pena volverla accionable: **un presupuesto de tiempo en milisegundos absolutos no
puede vivir adentro de una corrida paralela.** O el banco sale de `ii:test`, o esa
afirmación pasa a ser una fracción del tick.

## El ataque al propio determinismo

`tests/ataque-determinismo.test.ts`, 29 tests. Los tests de los tres agentes
prueban que el mundo **es** determinista; éste busca por dónde **dejaría** de
serlo. Son dos trabajos distintos: un test de determinismo escrito por quien
escribió el motor prueba lo que el autor pensó que podía fallar.

Encontró **un agujero real**, y tres cosas que ya estaban bien y ahora tienen
prueba de que lo están.

### El agujero: los empates se resolvían por orden de llegada

`stepWorld` decía —y el comentario lo decía muy bien— que dos intenciones del
mismo actor con el mismo `seq` **se rechazan las dos** en vez de desempatarse,
porque desempatarlas sería elegir con la estabilidad del `sort` del motor.

No era cierto. El empate se detectaba **al vuelo**, comparando cada intención con
la anterior, así que **la primera del par ya se había despachado** cuando
aparecía la segunda: se movía, gastaba `stamina`, y recién entonces las dos
salían «rechazadas». O sea que el mundo dependía de **cuál de las dos llegó antes
en el arreglo de entrada** — que es exactamente lo que decide la estabilidad del
`sort`, y el orden de llegada es el orden en que contestaron las mentes.

```
stepWorld(s, [A, A'])  →  hash 635a2e690376f196
stepWorld(s, [A', A])  →  hash 4894d7eb724d9dfe
```

Reparado con una pasada previa que marca los empates **antes de despachar nada**.
De paso arregla el caso de tres o más: antes, la del medio se rechazaba dos
veces.

### Los otros cinco vectores, todos con prueba

| | |
|---|---|
| **Map/Set en orden de inserción** | El hash no cambia si se inserta al revés — con claves de texto **y con claves numéricas**, que es el caso de `cells` y el camino menos transitado del hash. Un `Set` al que se le saca y se le vuelve a poner el mismo elemento —que lo manda al final— no cambia. Los chunks salen ordenados y no en orden de exploración. El catálogo de sustancias hashea igual venga en el orden de alta que venga. |
| **`Object.keys` y el orden de creación** | Dos vectores de cualidades armados en distinto orden hashean igual, **y las claves que parecen enteros saltan al principio**: `{b, 10, a, 2}` recorre `['2','10','b','a']`, o sea que el orden de inserción ni siquiera es consistente consigo mismo. Y una propiedad `undefined` hashea igual que la ausente, que es el criterio de sobrevivir al viaje por JSON. |
| **Punto flotante donde va punto fijo** | El terreno no puede guardar una fracción viva: `fx(0.1+0.2)` vuelve exactamente `0.3`. Poner y sacar cien veces devuelve el mismo hash. |
| **`Math` trascendente** | Los once fuentes, con carnada y lista blanca. Ver arriba. |
| **Snapshot que comparte referencia** | El paso del mundo no muta lo que le dan, verificado sobre 40 ticks. Un delta tomado hace veinte ticks sigue describiendo el mundo de hace veinte ticks. Y si alguien muta una ranura ya guardada, restaurar **lanza** en vez de mentir. |

---

## Lo que el arnés de invariantes encontró, y se reparó

El arnés del agente de `step.ts` corrió 1000 ticks con **dos** actores sin romper
un invariante. Con **diez** actores peleándose por seis cosas rompió tres, y los
tres eran bugs de verdad. Todos reparados, todos con la reparación en **un solo
lugar**.

**Tick 42 — un inventario que apunta a la nada.** La criatura A come algo que B
tenía en la mano —`aMano` alcanza con estar en una celda vecina, y comer no
pregunta de quién es—, el cuerpo se borra y el `holding` de B lo sigue nombrando.
Para el invariante, materia evaporada. Reparado en `sacarCuerpo`, que ahora saca
el cuerpo de **toda** mano, no solo de la de quien lo hizo desaparecer: hay tres
lugares que destruyen cuerpos y el que se olvide de limpiar no da error, deja un
fantasma.

**Un apoyo circular, y un `supportedBy` que sobrevivía a la mudanza.** Al caminar
sobre algo, la criatura se quedaba con `supportedBy` puesto **para siempre**: A
pisa a B, después B pisa a A, y las dos quedan apoyadas una en la otra. Y peor
que el ciclo: `montajeDe` lee `supportedBy` como `contacto`, así que **la
criatura cocinaría sobre una fogata desde el otro lado del mapa**. Reparado en
`moverActor`: mudarse suelta las relaciones espaciales en las dos direcciones.

**Tick 811 — la pila que quedaba flotando.** En una celda había una pila legal de
tres criaturas y la del medio se fue caminando. Con el borrado a secas, la de
arriba quedaba apoyada en nada: dos cosas sueltas en la misma celda que ninguna
intención pidió y que nadie podía deshacer. Reparado en `olvidar`, que ahora
**hereda el apoyo**: sacar un bloque del medio de una pila hace que lo de arriba
baje, no que quede flotando. La tapa **no** se hereda, y la asimetría es física:
apoyarse es contra lo que haya abajo y siempre hay algo; tapar es tapar *a algo*,
y si ese algo se fue, la losa no pasa a tapar la piedra que había debajo.

**Y el invariante mismo estaba mal.** Pedía que **cada par** de sólidos de una
celda estuviera relacionado, y eso es más estricto de lo que el mundo puede
cumplir: una pila de tres —la fogata, la parrilla sobre ella, el pescado sobre la
parrilla— tiene tres pares y dos relaciones, así que el par fogata-pescado salía
como solapamiento. **La parrilla del ADR II-0002 no habría pasado su propio
invariante.** La regla correcta es la de la pila: los sólidos de una celda tienen
que colgar todos de **una sola base**, y se cuentan las raíces. Sigue siendo
cierto que el mundo entero no cabe en una celda —N cuerpos sueltos son N raíces— y
ahora la parrilla existe de verdad.

Después de las cuatro reparaciones: **1000 ticks, diez actores, cero
violaciones.**

---

## Contratos que deben revalidarse por la extensión de objetos emergentes

**El Hito 2 sigue cerrado y ninguna medición de este documento cambia.** Lo que
sigue es lo que el [Gate 5→6](gate-5-6-objetos-emergentes.md) va a estirar, anotado
ahora para que la revalidación no se descubra a los golpes.

`WorldState`, **hashes**, **snapshots** y **replay** tienen que seguir cerrando con
**cuatro campos nuevos adentro**: **estado desplegado**, **stock asociado**,
**próximo intento** y **captura almacenada**
([ADR II-0016](decisions/II-0016-un-dispositivo-desplegado-retiene-sobre-un-stock.md)).

Y dos garantías más, que son las que este hito ya sabe defender:

- **orden determinista entre dispositivos.** Dos trampas sobre el mismo stock no
  se pueden resolver por orden de llegada. Es literalmente el agujero que el
  ataque al propio determinismo encontró con los empates de `seq`, y va a volver
  con otra cara;
- **consumo reproducible de RNG.** Y sin excepción: **mirar, pensar o renderizar
  nunca consume RNG** — lo tercero es nuevo y entra con el Hito 12.

## Lo que queda abierto

**1. El rendimiento, y es de `@anima/physics`.** Está arriba con los números y la
reparación. **El criterio (c) NO se cumple: 8,65 ms contra un techo de 4, faltan
2,2×.** No bloquea el Hito 3. Y hay dos frentes distintos, no uno:

- para el corpus plano, lo que queda es la **representación del cuerpo** —una
  cualidad se resuelve preguntando a `state`, después a las partes y después a la
  sustancia, y ese piso son ~1,2 µs por cuerpo. Pide su propio ADR;
- para un mundo **heterogéneo**, que hoy cuesta ~20 ms y no 8,65, lo que manda es
  otra cosa: **`conSustancia` reconstruye la `Physics` entera** cada vez que la
  ley 4 transmuta. Eso no es un cambio de representación, es una función que
  copia un catálogo de 30 sustancias para agregarle una. Es más barato de
  arreglar y nadie lo había visto porque el banco no lo ejercita.

**1-bis. `tagsDe` volvió obligatoria la inmutabilidad de las partes.** Está
memoizada en un `WeakMap` indexado por el array de partes, así que mutar ese array
en su lugar deja los tags viejos y el cuerpo miente sobre de qué está hecho. Hoy
nadie lo hace y hay un barrido que lo verifica, pero era una costumbre y ahora es
un invariante del que depende la corrección.

**1-ter. El banco no puede vivir adentro de `pnpm ii:test`.** Afirma un
presupuesto en milisegundos absolutos con margen de 2× dentro de una corrida
paralela, así que se cae cuando la máquina está ocupada. Hay que elegir: o el
banco sale de la corrida compartida, o esa afirmación pasa a ser una fracción del
tick. Es previo a la optimización.

**2. El segundo motor.** Falta la página; la infraestructura del Hito 0 ya está.

**3. `step.ts` no usa la grilla.** Es lo más grande que queda. `stepWorld`
resuelve «qué hay en esta celda» recorriendo los cuerpos (`estorbo`, O(cuerpos)
por consulta) mientras `grid.ts` contesta lo mismo en 67 ns y `forEachBodyNear`
cuesta el radio y no el mundo. Hoy no duele —el mundo agrega menos de medio
milisegundo sobre una física de 38— pero el día que la física baje, ese bucle
pasa a ser el costo, y es exactamente el `entitiesAt` que el Hito 2 vino a matar.
La clave de celda ya está unificada, así que el enchufe es mecánico.

**4. Dos representaciones de una celda, con dos precisiones.** `chunk.ts` guarda
el terreno en `Fixed` —enteros de milésimos— y `step.ts` guarda
`WorldState.cells` en `number` pelado. Hoy no se hablan. El día que se enchufen
—que es lo que el Hito 3 necesita, porque el oráculo escribe terreno— una celda
que valga 15,0004 en el paso del mundo va a valer 15,000 al pasar por el chunk.
Queda con `it.fails` y **con la pérdida medida: ≤ 0,0005 por celda y por tick**,
que es media milésima, la mitad de la escala de `Fixed`. De ese número sale si
hace falta migrar las leyes a punto fijo antes del Hito 3 o después.

**5. La ley 12 está en `step.ts` y no en la grilla.** `grid.ts` dejó el lugar
—`coverAt`, `addCover`, `shelteredAt`— y `step.ts` implementó la ley por su
cuenta, con `sheltered = 1 − Π permeabilidades`. Las dos son correctas y ninguna
usa la otra. Cuando (3) se resuelva, hay que quedarse con una.

**6. El reparo sale con el signo correcto y no con la curva correcta.** El ADR
II-0002 pide que ocluir baje el **acoplamiento** térmico con el ambiente, y
`H_PERDIDA` no es alcanzable desde `Entorno`: la única perilla que la física
expone a la ley 1 es la temperatura objetivo. Lo que se hace es acercar el
ambiente a lo que la celda ya tiene. Si el reparo se va a calibrar en serio, la
física tiene que exponer el acoplamiento.

**7. `place` (obras, ADR 0032) y el rendimiento `transmute` se rechazan con
motivo `no-implementado`** en vez de fingir. Una habilidad que los use se entera
hoy y no el día que alguien note que no pasaba nada.

**8. Las celdas no relajan, a propósito.** `CELL_QUALITIES` declara
`relaxesTo: {target: 'ambient'}` para `wet`, `oxygen` y `temperature`. «Ambient»
para una celda es el valor del terreno, el terreno es de la grilla, y el
reabastecimiento es del oráculo del Hito 3. Relajar hacia una constante secaría
los ríos en cien ticks.

**9. `pruneChunks` existe y no lo llama nadie.** Es explícito a propósito —si
corriera solo dentro del tick, **cuándo** corre pasaría a ser parte del estado—
pero alguien tiene que decidir cada cuánto se hace mantenimiento.

---

## Decisiones que conviene recordar

De los tres agentes y del pase de integración. Están enteras en los comentarios
del código; acá van las que se van a querer volver a discutir.

**Las cualidades de celda se derivan del catálogo, no se vuelven a escribir.**
`CELL_FIELDS` filtra `CELL_QUALITIES` de `@anima/physics` y agrega `cover` **al
final**, para que un campo propio nuevo nunca corra los índices de los del
catálogo en un snapshot ya guardado. Es el bug de `DSL_REFERENCE`: una lista
mantenida a mano diverge y nadie se entera.

**`sheltered` no se guarda: se guarda la causa (`cover`) y se calcula el efecto.**
Y `cover` **no tiene techo**, porque un tope rompe la simetría de poner y sacar:
con tope, tres capas saturan y sacar dos destapa del todo, o sea que el estado
pasaría a depender del **orden** en que se puso cada cosa. La saturación se hace
donde no duele, al leer.

**Leer no materializa, y «impecable» se calcula en vez de llevar una bandera
`sucio`.** Las dos juntas dan la propiedad que el Hito 3 necesita: mirar el mundo
no lo cambia, y dos partidas que exploraron en distinto orden tienen el mismo
hash. Una bandera diría que sí para un chunk que se escribió y se volvió a dejar
como estaba — el hash dependería de la historia y no del estado.

**Fuera del mundo se lanza, no se recorta.** Recortar teletransporta al borde y
nadie se entera.

**`stepWorld` devuelve `{state, events}` y no `SimEvent[]`,** que es la firma
literal del documento. Devolver solo los eventos obligaría a que alguien
reconstruya el estado aplicándolos, o sea a escribir una **segunda**
implementación de la misma transición — y dos implementaciones de la misma cuenta
divergen. Los eventos son la narración del tick, no su definición.

**El compromiso lo declara el mundo, y `apply` no está en la tabla a propósito:**
su compromiso es el del proceso, y duplicarlo sería una segunda copia mantenida a
mano. `revisarCompromiso` pregunta en tres pasos y en este orden: qué es esto, si
quien lo emitió dijo la verdad, y recién después si tiene permiso. Al revés, un
actor con permiso amplio nunca se enteraría de que declara mal sus intenciones.

**Comer es la única operación que hace subir una cuenta conservada, y por eso
emite un evento `convierte` que el invariante audita.** La eficiencia no es una
perilla: **es** `digestibility`, porque `calories = nutrition × mass ×
digestibility` y el techo es 0,95. Así **cocinar rinde más sin que nadie escriba
«cocinar rinde más»**.

**El hash tiene dos carriles.** Uno de 32 bits da una colisión ciega cada 4·10⁹
comparaciones, y en una prueba de equivalencia eso es un **falso negativo**: dos
mundos que ya divergieron se declaran iguales y el test pasa en verde. Con 20
partidas × 20 000 ticks del Hito 5 no es teórico. El segundo carril cuesta un
`Math.imul` por byte.

**El hash tiene lista blanca y lanza ante lo que no entiende.** La alternativa
era recorrer las claves propias de cualquier objeto, y con eso un `Date` —que no
tiene claves propias enumerables— hashea igual que `{}`: dos estados con fechas
distintas dan el mismo hash **en silencio**.

**El default del snapshot es el caro (`'hash'`, 19,65 ms) y no el barato
(`'identidad'`, ~8).** Los dos errores no son simétricos: con `'hash'` de más se
pagan 11 ms cada N ticks **fuera** del tick, donde nadie los espera; con
`'identidad'` de más el delta sale vacío, la partida se guarda mal en silencio y
el jugador se entera cuando carga y le falta media casa. **Un default que puede
perder datos en silencio no es un default, es una trampa.**

**Un delta guarda referencias, no copias** —copiarlas sería el `structuredClone`
que el archivo existe para no pagar—, así que **una ranura que entró a un delta
no se puede mutar nunca más**. Es un contrato que quien escriba mundos tiene que
conocer; `stepWorld` lo cumple porque es copia-al-escribir, y hay test.

**El LCG de los tests devuelve los bits ALTOS.** En un LCG de módulo 2³² el bit k
tiene período 2^(k+1), así que con `% 8` las semillas 1 y 2 producen la **misma**
sucesión corrida un lugar. Los dos agentes que escribieron generadores se
comieron el mismo bug y los dos lo descubrieron por un control negativo que
fallaba: no porque el mundo fuera insensible a la semilla, sino porque las dos
semillas eran la misma. **Un test de determinismo con un barrido degenerado
prueba muchísimo menos de lo que parece.**

**Una conducta al azar nunca completa un proceso.** `union` pide veinte ticks
seguidos con los mismos cuerpos en los mismos roles, y quien elige al azar cambia
de idea al segundo. Conviene tenerlo a la vista para el Hito 5: **la persistencia
va a ser un requisito duro del planificador, no una virtud.**

---

## Los 258 tests

| Archivo | | |
|---|---:|---|
| `hito-2-el-criterio.test.ts` | 16 | el criterio, sobre las piezas de verdad |
| `ataque-determinismo.test.ts` | 29 | los seis vectores contra el propio motor |
| `banco-el-tick.test.ts` | 3 | el rendimiento, medido |
| `step.test.ts` | 31 | el paso del mundo |
| `invariants.test.ts` | 26 | las cinco preguntas, cada una rota a propósito |
| `hash.test.ts` | 25 | la forma canónica |
| `grid.test.ts` | 22 | el índice espacial |
| `intent.test.ts` | 19 | el compromiso y el orden total |
| `cell.test.ts` | 18 | la geometría |
| `chunk.test.ts` / `snapshot.test.ts` | 17 + 17 | el terreno y el delta |
| `journal.test.ts` | 16 | la crónica |
| `paso-determinista.test.ts` | 6 | el criterio con huella local, del agente de `step` |
| `determinismo.test.ts` | 7 | el criterio sobre la grilla, del agente de `grid` |
| `cronica-el-criterio.test.ts` | 6 | el criterio sobre el mundo de juguete |

Los tres últimos verifican el criterio contra piezas **independientes** del
`hashWorldState` del paquete —una huella escrita a mano, la grilla sola, un mundo
de treinta líneas— y por eso se conservan enteros: si el criterio se verificara
solo con `hashWorld`, un bug en el hash haría pasar todo por la peor razón
posible, que es dos mundos distintos hasheando igual.

### Y los que corren aparte

```bash
pnpm --filter @anima/world verificacion
```

| Archivo | | |
|---|---:|---|
| `zz-remedicion.test.ts` | 3 | el tick re-medido desde afuera, con dos arneses y dos corpus |
| `zz-partida-2000.test.ts` | 2 | 2000 ticks hasheados, con los invariantes en todos los ticks |

No están en `pnpm test` por lo que dice [la verificación
independiente](#por-qué-los-archivos-de-verificación-corren-aparte): el
presupuesto en milisegundos absolutos del banco no sobrevive a que la corrida
compartida crezca.

En `@anima/physics`, `zz-cache-mal-invalidada.test.ts` (23 tests) sí corre con los
demás, y por eso la física pasó de 525 a **548**. El total de `pnpm ii:test` es de
**811 tests** — 548 de física, 258 de mundo y 5 de habilidades.
