# Hito 3 — El dios perezoso

> **LOS SEIS CRITERIOS PASAN, MEDIDOS.** Y el pase de integración encontró dos
> agujeros reales en el que más importaba, el (f): la garantía de resolubilidad
> no la llamaba nadie sobre un chunk de verdad, y cuando se la llamó resultó que
> **se activaba donde no sirve y no se activaba donde hace falta**.
>
> | Criterio del plan de construcción | | Medido |
> |---|---|---|
> | el mismo mundo en dos órdenes y con dos historias distintas → mismo hash | ✔ | 81 chunks × 3 órdenes + 686 decretos × 14 órdenes + 512 celdas de agua × 14 órdenes · **0 diferencias** |
> | escribir otra respuesta para una clave existente lanza | ✔ | 200 contradicciones intentadas, **200 `InvariantError`**, 0 renglones de más |
> | un hecho fino enmendado antes de interactuar cambia, y después no | ✔ | 100 arroyos: **50 cambian, 50 no**; y `witness(fina)` sella lo que `witness(gruesa)` no |
> | la fusión de dos lagos con testigo no contradice a ninguno | ✔ | **2 cuerpos lógicos, 1 región**, 7 celdas con dueño único, 0 descartes |
> | el río se agota y se repone | ✔ | 12 peces en **12 tiradas**, el pozo vacío no consume dado; 0 → 12 en 24 s de mundo |
> | ningún chunk acuático queda sin insumos para un aparejo en radio 2 | ✔ | **788 orillas de 4 semillas, 0 sin aparejo**, juzgado con `cumpleRol` de la física |
>
> `@anima/oracle`: **210 tests verdes** (167 de los tres agentes + 17 del criterio
> + 26 del ataque), typecheck limpio. `pnpm ii:test` entero en verde: **1072
> tests** (560 física + 297 mundo + 210 dios + 5 habilidades).
>
> Quedan **3 `it.fails`** con su porqué escrito al lado: el techo calórico que no
> lo lee nadie, la garantía que puede sembrar una hebra de agua, y `ask<T>` que
> castea sin mirar.

```bash
pnpm ii:typecheck && pnpm ii:test
pnpm --filter @anima/oracle test tests/hito-3-el-criterio.test.ts
pnpm --filter @anima/oracle test tests/ataque-al-dios.test.ts
```

---

## Qué se construyó

Nueve módulos, escritos por tres agentes en paralelo y unidos en un pase de
integración. En capas, de la pregunta hacia arriba:

| | |
|---|---|
| `pregunta.ts` | La pregunta, su clave canónica y el dado del dios. `DiosRng` y `WorldRng` son **tipos nominales distintos**, y eso lo verifica `tsc`. |
| `bioma.ts` | Ruido de valor **entero de punta a punta**, la tabla de nueve biomas y el techo calórico. La tabla se valida al cargar el módulo, no en un test. |
| `ley.ts` | `resolveChunk` puro, el terreno celda por celda, lo que hay tirado, y los stocks con **integración perezosa en segundos de mundo** (ADR II-0008). |
| `ledger.ts` | El libro con **dos granos de compromiso**, el invariante duro, el log append-only como narrativa y `verify()` por tick. |
| `compromiso.ts` | El agua en componentes conexas y **los tres casos de la fusión de lagos**, con dos capas: cuerpos lógicos y regiones hidrológicas. |
| `resolubilidad.ts` | La garantía de co-presencia en radio 2, **juzgada con `cumpleRol` de `@anima/physics`** y no con una tabla de recetas. |
| `extraccion.ts` | `draw` con el dado del **mundo**, `probabilidadDePicar` que no consume nada, y la frontera `ver agua → stock`. |
| `decreto.ts` | **El pase de integración**: la única función que llama a la garantía sobre un chunk de verdad. |
| `index.ts` | La puerta del paquete, con `export *`. |

### El pase de integración, que era el trabajo que faltaba

**1. `src/index.ts`, con `export *`.** El `exports` del `package.json` apuntaba a
un archivo que no existía: hasta este pase, `import '@anima/oracle'` fallaba. Se
escribe con `export *` y no con una lista curada a mano por la misma razón que en
`@anima/world` —una lista a mano diverge— y porque **`tsc` avisa de las
colisiones**. Con tres autores en paralelo eso no era hipotético: `ley.ts`
exporta `Suelta` (sustancia, celda, masa) y `resolubilidad.ts` tuvo que llamar
`SueltaSembrable` a lo suyo (sustancia, forma, masa, punto). La colisión era
invisible sin este archivo.

**2. `src/decreto.ts`, la costura que faltaba.** `resolveChunk` decía qué hay y
`ensureSolvable` decía qué falta, y **ninguno llamaba al otro**. El criterio (f)
estaba verificado sobre un `ChunkSembrable` de test, o sea sobre un chunk que el
mundo nunca va a ver. Escribir la llamada obligó a tomar tres decisiones que
nadie había tomado —quién elige la orilla, qué pasa si lo sembrado cae en el
agua, y de dónde sale el dado de la garantía— y destapó dos agujeros que solo
aparecen cuando la garantía corre sobre el mundo decretado.

---

## Los dos agujeros que encontró el pase, con los números

### El 88,8% de los chunks de agua no tiene dónde pararse

Medido sobre 3721 chunks de una semilla, por bioma:

| bioma | chunks | celdas de agua por chunk | nivel medio | enteramente inundados | con orilla adentro |
|---|---:|---:|---:|---:|---:|
| `agua-dulce` | 1479 | 254,3 de 256 | 848 | **1313 (88,8%)** | 166 |
| `pantano` | 170 | 200,6 | 596 | 44 | 126 |
| `bosque` | 338 | 2,8 | 139 | 0 | 40 |
| `pradera` | 1731 | 1,3 | 140 | 0 | 144 |

La causa está en `nivelDeAgua`, y es una sobrecorrección honesta: el acople del
nivel con el clima existe para reparar que *«el 44% de los chunks acuáticos
quedaba sin una sola celda mojada»*, y lo reparó **inundándolos**. El campo de
agua tiene el 98,6% de sus valores por debajo de 800 —deciles medidos:
[400,500) 24,5%, [500,600) 23,4%, [800,900) 1,4%, [900,1000) 0,03%— y el nivel de
un chunk acuático tiene **mediana 846** (p25 809, máx 933). O sea que el umbral
está arriba de casi toda la distribución.

Un chunk enteramente inundado **no es un error**: es el medio de un lago, y la
orilla está en el chunk de al lado. Lo que sí era un error es lo que la garantía
hacía con él.

### La garantía se activaba donde no sirve y no donde hace falta

El documento la dispara con `bioma.acuatico`. Con esa condición, medido:

- se activaba en los **1313 chunks inundados**, donde no hay dónde pararse ni de
  dónde levantar nada: sembraba la caña en el medio del lago (1357 sueltas
  cayeron en el agua en el primer barrido);
- **no** se activaba en los **429 chunks de `pradera` y `bosque` con orilla** de
  ese mismo barrido —un charco en una pradera es agua de la que se pesca—;
- **no** se activaba en la corona de chunks secos alrededor de cada lago, que es
  exactamente donde la criatura se para a pescar, porque el agua se corta en el
  borde del bioma y el chunk seco de al lado no es «acuático».

La reparación es una línea de diseño y no un parche: **la garantía la dispara el
agua, no el bioma**. La condición operativa es «hay una celda seca con agua
franca al lado», mirando también del otro lado del borde del chunk. Con eso,
sobre 6724 chunks de cuatro semillas: **788 orillas, de las cuales 547 (69%) no
son de bioma acuático**, y las 788 pasan el criterio.

---

## Los seis criterios, uno por uno

### (a) El mismo mundo en dos órdenes y con dos historias distintas

**El mundo.** 81 chunks decretados en tres órdenes —por filas, inverso y
barajado— con historias distintas entre medio:

| historia | qué pasa entre chunk y chunk |
|---|---|
| A | decreta 81 chunks lejanos, pregunta 81 novedades, vacía un stock 81 veces, el libro avanza de a 7 ticks |
| B | nada; el libro arranca en el tick 5000 |
| C | decreta **cada chunk dos veces**, que es lo que pasa cuando alguien va y vuelve |

**81 de 81 huellas idénticas.** La huella de un chunk incluye clima, bioma, las
256 celdas de `wet`, las 256 de `cover`, la orilla, TODO lo suelto con su celda y
su masa —lo del ruido y lo que puso la garantía— y el techo calórico.

**El libro y el agua.** 1024 celdas de agua de 4 chunks, agregadas en tres
órdenes (derecho, inverso, barajado), en los ticks 0 / 4000 / 900, con 0 / 3 / 1
re-preguntas por cuerpo y sellando en órdenes distintos:

- huella del libro idéntica: `4bbbe1e3abd5b6e6`
- huella del agua idéntica: `07beb9a6049e6553`
- **y los tres logs distintos**, verificado comparando la secuencia
  `(clave, evento, tick)`: si los logs fueran iguales, el test no estaría
  probando lo que dice.

En el ataque, la versión larga: **686 decretos en 14 órdenes** (canónico +
inverso + 12 barajados deterministas) con otra historia entre medio, **0
diferencias**; y **512 celdas de agua en 14 órdenes → una sola huella**
(`53ece729d99b3118`).

### (b) Escribir otra respuesta para una clave existente lanza

- `establish` con otra respuesta lanza `InvariantError` con
  `reason = {k:'respuesta-distinta', key, previa, nueva}`. **Lanza también sin
  testigo**: cambiar de opinión tiene su propia puerta y se llama `amend`.
- La misma respuesta con las claves del objeto en otro orden **no** lanza y **no
  deja renglón**: la comparación es por forma canónica, no por texto de
  `JSON.stringify`.
- Barrido: **200 claves decididas, 200 intentos de contradecirlas, 200
  `InvariantError`, 200 renglones en el log** (ni uno de más).

### (c) Un hecho fino enmendado antes de interactuar cambia, y después no

La secuencia completa, que es el criterio en un test:

```
ask('mojarras') → witness('gruesa') = false → amend('truchas') = true
              → witness('fina') = true → amend('salmones') = false
```

y la respuesta sigue siendo `truchas`. La narrativa que queda en el libro —que es
el panel de auditoría del hito— es exactamente:

```
tick 0 decidido ley → tick 4021 enmendado oraculo → tick 4100 testigo oraculo
```

Barrido: **100 arroyos, 50 enmendados antes del testigo (cambian los 50) y 50
después (no cambia ninguno)**, 0 contradicciones, `verify()` limpio.

Y el otro lado: un hecho **grueso** lo sella mirarlo de lejos, y ahí el oráculo
ya llegó tarde. Ésa es la ventana, y existe por diseño.

### (d) La fusión de dos lagos con testigo no contradice a ninguno

Dos charcos de tres celdas, separados por una celda, y esa celda al final:

| caso | resultado medido |
|---|---|
| los dos con testigo | **2 cuerpos lógicos, 1 región**, `populationsOf` devuelve los dos, `mojarras` y `truchas` intactas, 7 celdas con dueño único, **0 eventos `descartado`** |
| uno con testigo | 1 cuerpo, hereda **id y respuesta del que se vio** aunque su ancla no sea la menor; el otro se descarta del libro |
| ninguno con testigo | 1 cuerpo con el id canónico (`0,0`), y **la misma huella** si el charco se arma al revés |

El caso de los dos con testigo es el que el documento llama difícil, y no se
resuelve con una concesión técnica: son **dos poblaciones compartiendo agua**,
que es lo que pasa de verdad — los peces de allá siguen siendo los de allá hasta
que naden.

### (e) El río se agota y se repone

Con una caña armada en el test (`unir(vara, undefined, hebra)`; nadie la llamó
caña) sobre un stock de capacidad 12 que repone medio pez por segundo:

- **se agota**: 12 extracciones dan 12 peces con **12 tiradas** del dado del
  mundo, y la 13ª sobre el pozo vacío devuelve `null` **sin tirar** (`tiro:
  false`);
- **se repone**: 0 → 1 pez a los 2 s, 5 a los 10 s, **lleno (12) a los 24 s**, y
  sigue en 12 a los 1000 s. **401 muestras monótonas**, ninguna por encima de la
  capacidad;
- **es perezosa**: mirarlo 398 veces o no mirarlo nunca da el mismo número, y
  preguntar 401 veces no mutó el stock;
- **un intento fallido no re-ancla la marca**: 4 intentos fallidos y el río
  igual tiene 2 peces al segundo 4. Re-anclar parece inofensivo y haría que el
  río se repusiera más lento cuanto más lo intentaran.

### (f) Ningún chunk desde donde se pesca queda sin insumos en radio 2

**El juez está escrito en el test**: arma los cuerpos con lo que quedó tirado a
distancia de Chebyshev ≤ 2 de la orilla, prueba cada uno solo y **todos los pares
atados con `unir`**, y pregunta con `cumpleRol(gear)` de `@anima/physics`. No usa
ni una función de `resolubilidad.ts`: un criterio que se calcula con el mismo
código que la garantía puede estar de acuerdo con ella por casualidad.

| | |
|---|---|
| chunks barridos | 6724 (4 semillas × 41 × 41) |
| con orilla | **788** |
| de esas, en bioma **no** acuático | **547 (69%)** |
| necesitaron siembra | 608 |
| **sin aparejo** | **0** |
| sembrados dentro del agua | 0 |
| sembrados fuera del radio 2 | 0 |
| tiempo | 961 ms |

Por semilla: `20260727` 375 orillas / 247 sembradas · `7` 251/215 · `999`
118/106 · `1` 44/40. Cada semilla aporta las suyas, para que el criterio no pase
por vacuidad en ninguna.

Además: **169 chunks decretados dos veces dan 169 huellas idénticas** (9 con
siembra), y los chunks sin orilla no reciben nada — 988 enteramente inundados
(la orilla es del vecino) y 318 sin agua cerca.

**Un hallazgo del barrido que hay que escribir**: el campo de clima tiene período
**64 chunks**, así que una ventana de 41×41 es más chica que un rasgo del mapa.
De ocho semillas muestreadas, **dos** (`0xbadbeef` y `2`) dan 1681 chunks **sin
una sola gota de agua**. En ésas el criterio (f) pasaría por vacuidad, y por eso
el test elige semillas con agua y lo dice.

---

## El ataque al dios

`tests/ataque-al-dios.test.ts`, 26 tests. No verifica el criterio: busca que el
dios se contradiga.

| ataque | resultado |
|---|---|
| la misma clave por dos caminos | `waterBodyKey` y `keyOf` coinciden; el segundo camino **no vuelve a llamar a la ley**; 281 preguntas vecinas → 281 claves distintas; los separadores `:` y `\|` no entran en un id |
| materializar en órdenes distintos | 686 decretos en 14 órdenes, 0 diferencias; 512 celdas de agua en 14 órdenes, 1 huella |
| resolver, olvidar, volver a resolver | 36 chunks olvidados del libro y vueltos a preguntar: **misma huella**; lo que enmendó el oráculo sí se pierde (y eso es información, no un bug); lo que tiene testigo no se puede olvidar |
| dos cuerpos de agua en la frontera de dos chunks | **16 filas con agua a los dos lados del borde, todas en el mismo cuerpo**; da igual qué chunk se explore primero; con testigo de un lado, el fusionado conserva id y respuesta de ese lado aunque su ancla no sea la menor |
| el dado del dios filtrándose al del mundo | decretar 500 chunks y armar el agua: **0 tiradas** del dado del mundo; 1000 estimaciones: **0 tiradas**; `draw`: exactamente 1; una criatura que duda 17 veces por tirada saca **exactamente lo mismo** que una que no duda; y los dos tipos no son intercambiables — lo verifica `tsc` con dos `@ts-expect-error` |
| el reloj de pared | 30 ms de espera activa entre dos preguntas: **el mismo número**; con `Date.now` y `performance.now` corridos **diez años**, ni la población ni el chunk se mueven; la reposición depende del **intervalo** de mundo y no del momento absoluto |
| la regla 2, sobre las fuentes | **9 fuentes barridas, 0 infracciones** (nada de `Math` trascendente, `Date`, `performance`, `Intl`, `localeCompare`, `**`, ni imports a `packages/`), y el detector tiene su propia carnada para probar que puede fallar |

### Los tres `it.fails`, que son deuda escrita en el arnés

**1. Nadie compara el stock contra el techo calórico.** `presupuestoCalorico` se
calcula, se guarda en el `ChunkFacts`… y no lo lee nadie. Medido: un chunk con
techo **1776 cal** entrega, en **una hora de mundo**, 1806 peces ≈ **5490 cal**,
o sea **3,1× el techo**, sin que nada se queje. Y falta una pieza para poder
cerrarlo, que es lo que lo hace un hueco de diseño y no un olvido: **`Stock` no
sabe de qué chunk es** y `draw` devuelve un `SubstanceId` **sin masa**, así que
hoy ni siquiera se puede *calcular* cuántas calorías entregó un chunk. Cerrarlo
pide tres cosas: que el stock nombre su chunk, que lo que sale tenga masa, y un
acumulado por chunk contra el que `draw` compare.

**2. La garantía siembra cualquier sustancia del catálogo.** Medido, lo que
sembró en 1681 chunks: `agua`, `savia`, `tendon`, `junco`, `liana`, `piel`,
`pluma`, `corteza`, `hongo`, `huevo`, `hueso`, `madera`, `madera-verde`,
`raiz-dura`. **Una hebra de agua tirada en la orilla**: `agua` tiene
`flexibility: 1`, así que `formaDeLoSuelto` la llama `hebra` y su `catch` es > 0.
No rompe ningún invariante; rompe la coherencia que el propio paquete verifica al
cargar para `scatter` («lo que está tirado tiene que ser de lo que el lugar está
hecho»). **No se puede cerrar restringiendo al bioma**: la mayoría de las orillas
están en chunks de `pradera` y `bosque`, cuyas sustancias no incluyen nada con
`flexibility ≥ 0.8`, y la garantía lanzaría. Lo más barato es excluir por tag
(`liquido`, y las partes de un animal vivo) y volver a medir las 788 orillas.

**3. `ask<T>` castea sin mirar.** Dos llamadores que pregunten la misma clave
esperando formas distintas compilan los dos, y el segundo recibe el objeto del
primero. Está anotado por el autor del ledger como decisión consciente —cerrarlo
ata el ledger a las formas de respuesta de otros módulos—; queda medido para que
la decisión se pueda revisar con el caso adelante.

---

## Lo que costó, medido

| | |
|---|---|
| `climaDe` | **1,25 µs** |
| `resolveChunk` | **48,3 µs** |
| `decretarChunk`, chunk sin orilla | **72,1 µs** |
| `decretarChunk`, chunk con orilla | **295 µs** |
| `decretarChunk`, chunk que necesitó siembra | **401 µs** |

El costo de la garantía es la búsqueda en el catálogo entero (30 sustancias × 2
formas × el cierre de armables), y **se paga una sola vez en la vida de cada
chunk**. Con el tick de 20 Hz del ADR II-0007 (50 ms), decretar un chunk con
orilla cuesta el **0,6% de un tick**, y pre-decretar un anillo de nueve cuesta
3,6 ms — el 7%. No se puede llamar por tick, y no hace falta: es idempotente y
puro, así que el pre-decreto en tiempo ocioso es seguro (la regla del CLAUDE.md:
*ningún trabajo de tiempo ocioso puede escribir estado que entre en `hashWorld`*,
y acá no hay estado que escribir).

---

## Lo que quedó abierto

1. **El nivel de agua de los biomas acuáticos.** Mediana 846 en un campo donde el
   1,4% de los valores pasa de 800: los lagos son enormes y sin orilla propia. Se
   puede jugar así —la orilla es del chunk vecino y la garantía ahora la
   cubre— pero conviene revisar la calibración con un criterio de forma («qué
   fracción del mapa es agua», medido: **40% de los chunks para la semilla del
   barrido**). No se tocó acá porque cambia todos los mapas de todas las partidas
   guardadas y merece su propia decisión.
2. **Una garantía por chunk, no por cuerpo de agua.** Un chunk con dos charcos en
   esquinas opuestas recibe una sola, en la primera orilla. Si el segundo charco
   queda sin aparejo a mano, ahí no se pesca aunque el chunk pase el criterio.
3. **`ensureSolvable` no mira el `wet` al elegir el punto**: elige con el dado y
   el decreto lo reubica a la celda seca más cercana dentro del radio. Funciona
   (0 sembrados en el agua sobre 608), pero la garantía y el decreto saben cosas
   distintas sobre el mismo chunk.
4. **El charco garantizado no lo ve el vecino.** Cuando un bioma acuático sale
   sin una gota, `terrainFor` le inunda la celda más baja, y ese arreglo es del
   chunk y no del campo: un chunk vecino que mire del otro lado del borde no lo
   ve. El error es en la dirección segura —se pierde una orilla, no se inventa— y
   está medido: con la calibración de hoy, **el charco garantizado no se activa
   ni una vez en 1649 chunks acuáticos**.
5. **No hay snapshot/restore del ledger.** `entries()` es serializable a
   propósito (por eso `canonicalize` lanza sobre lo que no se puede guardar) pero
   nadie escribió el cargador. Falta decidir si se guarda el log entero
   (narrativa completa, crece) o sólo el estado vivo (más chico, se pierde el
   panel de auditoría).
6. **`WorldState` de `@anima/world` no tiene `rng`**, así que `draw` todavía no
   se puede llamar desde el mundo. El molde del `WorldRng` está en los helpers de
   dos tests; el `as` tiene que vivir en un solo lugar del mundo, donde se
   construya el dado.
7. **`CELDAS_DE_LADO` está duplicado** entre `@anima/oracle` (16) y
   `@anima/world` (`CHUNK_SIZE`). Hoy coinciden y el orden por filas también, y
   nada lo verifica desde afuera. Lo más barato: un test en `@anima/world` —que
   sí puede importar el oráculo— con `expect(CELDAS_DE_LADO).toBe(CHUNK_SIZE)`.
8. **Dos formas de decir «suelta»** conviven en el paquete (`Suelta` de `ley.ts`
   con índice local, `SueltaSembrable` de `resolubilidad.ts` con punto y forma) y
   `formaDeLoSuelto` adivina la forma porque lo decretado no la publica. Cuando
   la siembra publique su forma, esa función se borra.
9. **Hallazgo sobre la física, que no es de este paquete**:
   `DESHILACHAR.establishes` promete `flexibility>=0.8` y eso no es cierto —
   partir a favor del grano escala la masa y `flexibility` es intensiva, así que
   la hebra de corteza sigue en 0.7. Afecta al planificador del Hito 4, que va a
   volver por ese `establishes` y no va a encontrar lo prometido.

---

## Decisiones que vale la pena recordar

**La garantía la dispara el agua, no el bioma.** Es la decisión de este pase, y
sale de medir: con `bioma.acuatico` la garantía se activaba en 1313 chunks donde
no hay dónde pararse y se saltaba 429 donde sí se pesca. La frase del documento
—«al decretar un chunk con bioma acuático»— era una aproximación a la frase que
importa: **donde se pueda pescar tiene que haber con qué armar el aparejo**.

**La orilla se mira del otro lado del borde.** El agua se corta donde se corta el
bioma, así que la orilla de un lago es casi siempre una frontera entre dos
chunks. Mirar sólo hacia adentro dejaba la garantía ciega justo en el caso
normal. Cuesta hasta cuatro `climaDe` memoizados y 64 muestras de ruido por
chunk, y no rompe la pureza: sigue siendo función de `(seed, cx, cy)`.

**El dado de la garantía sale de una sal de dominio, no del dado del chunk.** El
dado de `resolveChunk` ya se consumió adentro (256 tiradas de jitter y tres por
cosa tirada); continuarlo desde afuera obligaría a escribir en `decreto.ts`
cuántas veces tira `ley.ts`, que es la clase de conocimiento duplicado que se
pudre. `rngFor(pregunta, seed ^ SAL_RESOLUBILIDAD)` usa el mismo recurso que ya
usa el clima.

**Nada de lo que siembra la garantía cae en el agua.** Es la misma regla que ya
cumplía `scatter`, y la reubicación a la celda seca más cercana **no consume
dado**: si consumiera, la cantidad de tiradas dependería del agua y mover el
nivel de un río movería todo lo demás del chunk.

**La huella del libro no incluye los ticks.** El criterio dice «dos órdenes y dos
historias distintas»; explorar en otro orden decide las mismas cosas en otros
ticks. Si el tick entrara en la huella, el criterio sería falso por construcción
y no mediría nada. Los ticks son historia; las respuestas son mundo.

**En la fusión sin testigo, la respuesta del perdedor se descarta en vez de
mudarse.** La respuesta de la ley es función de la CLAVE: la respuesta de `w:5,5`
mudada a `w:0,0` no es la que la ley daría para `w:0,0`, y dos partidas que
exploraron en distinto orden terminarían con respuestas distintas para la misma
clave. Descartar es gratis porque el dios es perezoso: se vuelve a preguntar.

**El criterio no se juzga con el código que lo cumple.** El aparejo del criterio
(f) se arma en el test con `unir` y se juzga con `cumpleRol`, sin tocar
`resolubilidad.ts`. Un criterio que se calcula con la misma función que la
garantía puede estar de acuerdo con ella por casualidad — y la falla que la
garantía existe para tapar es silenciosa, así que la casualidad no se notaría.
