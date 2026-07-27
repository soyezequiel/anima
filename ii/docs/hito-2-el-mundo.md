# Hito 2 — El mundo determinista

> **TRES DE LOS CUATRO CRITERIOS PASAN. EL DE RENDIMIENTO NO, Y LA CAUSA NO ESTÁ
> EN ESTE PAQUETE.**
>
> | Criterio del plan de construcción | | Medido |
> |---|---|---|
> | dos mundos gemelos con 10⁵ intenciones → mismo `hashWorld` | ✔ | 100 000 intenciones exactas, 11 checkpoints coincidentes |
> | restaurar a mitad reproduce el final exacto | ✔ | corte en el tick 500, restaurado desde la cadena de deltas |
> | 5000 cuerpos a menos de 4 ms por tick | ✘ | **37,98 ms** · 9,5× el techo · el 100% es `@anima/physics` |
> | el mismo hash en Chrome y en Firefox | ⏳ | no se puede correr desde Node; falta el arnés, y está descrito abajo |
>
> `@anima/world`: **258 tests verdes**, typecheck limpio, `pnpm ii:test` entero
> en verde (523 de física + 258 de mundo + 5 de habilidades).

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

### (c) 5000 cuerpos a menos de 4 ms por tick ✘ — **37,98 ms**

`pnpm --filter @anima/world banco`. Los números son de esta máquina y se vuelven
a correr; no se copian a mano a ningún comentario.

```
── EL TICK, con 5000 cuerpos ─────────────────────  techo del criterio: 4 ms
  stepWorld, tick completo .............. 37.98 ms   NO PASA (9.5× el techo)
  paso() de @anima/physics, solo ........ 38.65 ms   100.0% del tick
  lo que agrega @anima/world ............ por debajo del ruido (< 0.5 ms)

── DE DÓNDE SALE, adentro de paso() ───────────────────────────────
  UNA lectura de cuerpo (12 qualityOf) .. 6.43 ms   ya son 1.6× el techo, SOLA
  paso() la hace CINCO veces por cuerpo → ~32.13 ms de las 38.65 de las leyes

── FUERA DEL TICK (checkpoints y guardado, en el worker de fondo) ──
  hashWorldState sobre 5000 cuerpos ..... 6.56 ms
  snapshot.take sobre las ranuras ....... 19.65 ms

── EL ÍNDICE ESPACIAL DE grid.ts ──────────────────────────────────
  5000 mudanzas (el peor caso: se mueven todos) ... 2.11 ms  (421 ns c/u)
  5000 consultas bodiesAt ......................... 0.34 ms  ( 67 ns c/u)

── LA ESCALA A LA QUE EL MUNDO YA CORRE ───────────────────────────
  500 cuerpos ........................... 3.76 ms   PASA
  cuerpos que entran hoy en 4 ms ....... ~527
```

**La conclusión no es una sospecha, es una cuenta.** Una sola lectura de cuerpo
—las doce `qualityOf` que `leer()` arma— sobre los 5000 cuesta 6,43 ms, o sea
**1,6 veces el techo del tick entero, ella sola**. Y `paso()` la hace cinco veces
por cuerpo (`leyes.ts`, líneas 793, 796, 807, 814 y 821). Por lo tanto:

> **el techo de 4 ms es inalcanzable aunque `@anima/world` costara cero.**

Está clavado con un test —`expect(lectura).toBeGreaterThan(TECHO)`— para que el
día que deje de valer, el test se caiga y alguien vuelva a medir el tick entero:
puede que para entonces el criterio ya se cumpla.

El criterio se deja marcado con `it.fails` y **no con el umbral relajado a 50
ms**. Un criterio que se mueve para dar verde no es un criterio, es una
decoración; es además el idioma con el que la física dejó marcados los diez
huecos abiertos de `admit()`.

**Lo que este paquete sí controla, lo controla:** el mundo agrega menos de medio
milisegundo sobre la física, por debajo de la resolución del banco, contra un
presupuesto propio de 2 ms que es la mitad del techo entero.

**La reparación, y es de física:**

1. pasar **una** `Lectura` a través de las doce leyes en vez de recalcularla cinco
   veces. Sola, baja el tick de ~38 ms a ~13;
2. abaratar `qualityOf`, que es lo que decide el resto.

**Y hay un número accionable mientras tanto: hoy entran ~527 cuerpos en 4 ms.**
El mundo ya corre a 30 Hz a esa escala, que es de sobra para el Hito 3 y para la
demo del Hito 5 —una criatura, un río, un matorral—. Los 5000 son el techo de la
arquitectura, no el requisito de la próxima demo. Hay que decidir si la
reparación de física entra ahora o después del Hito 3, pero **no bloquea nada de
lo que sigue**.

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

## Lo que queda abierto

**1. El rendimiento, y es de `@anima/physics`.** Está arriba con los números y la
reparación. No bloquea el Hito 3.

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
