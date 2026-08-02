# Hito 11 — Calibración y presupuestos como test

**Qué es, en una frase:** que el build se ponga rojo cuando un número empeora,
para que «rápido» siga siendo verdad dentro de seis meses.

El plan lo dice sin rodeos: *«Este hito no es opcional: es donde se paga el
precio de haber elegido emergencia sobre catálogo»*.

**Verificable del plan:** el build falla si cualquiera de esos números empeora
contra la línea base registrada; 100 partidas automatizadas de 20.000 ticks sin
violar ningún invariante económico y sin superar el techo de consultas. Y una
separación que no se negocia: **CI determinista, benchmark real y E2E de
navegador corren aparte**.

---

## 0 · Las nueve mediciones que se hicieron ANTES de escribir el criterio

### M1 · El CI existe, y SÍ corre la suite de Ánima II

`.github/workflows/ci.yml` corre `pnpm test`, que es `pnpm -r run test`, y
`ii/packages/*` está en el `pnpm-workspace.yaml`. O sea que los 3072 tests de
`ii/` ya corren en cada push.

**Pero corren todos en un solo job**, junto con el lint, el typecheck y los E2E
de Playwright, con `timeout-minutes: 20`. Eso es exactamente lo que el plan
prohíbe con nombre y apellido.

### M2 · EL MECANISMO DEL HITO YA EXISTE — en un solo lugar

`packages/skills/tests/linea-base.json`. Un número registrado en un archivo, un
test que lo lee y compara, y la regla escrita adentro del propio archivo:

> Para subir este numero hay que editarlo a mano y decir por que.

Eso **es** el Hito 11, funcionando, desde el Hito 4. Lo que este hito tiene que
hacer no es inventar el mecanismo: es **generalizarlo**.

### M3 · Y LA PROPORCIÓN ES LA MEDICIÓN MÁS ÚTIL DE LAS NUEVE

```
console.log en los tests de ii/ ........ 626
archivos de línea base ................. 1
tests que leen una línea base .......... 1
```

**Seiscientos veintiséis números medidos, y uno guardado.** Todo lo demás se
imprime en la consola y se olvida cuando el scroll pasa. Ése es el estado real
del proyecto y ésa es la deuda que este hito paga.

### M4 · Los tres relojes del Hito 6 tienen línea base EN PROSA, no en un guardián

El plan dice que tres relojes «ya tienen línea base» y los lista con sus
números: `msHastaPrimerMovimiento` p95 **1,35 ms**, `consistenciaDelPrimerGesto`
**1,00**, `msHastaAccionPertinente` **1 tick**.

Medido: esos números **están en el documento**, no en un archivo que un test
lea. `lang/tests/los-tres-relojes.test.ts` afirma cotas ESTRUCTURALES
—«lo pertinente no es más rápido que un tick»— y no compara contra ningún valor
registrado. O sea que hoy **un cambio que lleve el p95 de 1,35 a 90 ms no pone
nada rojo**: sigue por debajo del techo de 150 y nadie guarda el 1,35.

Son citas, no guardas. La diferencia es todo el hito.

### M5 · `TECHO_DE_CI` existe, y su propio comentario dice que no puede morder

```ts
export const TECHO_DE_CI = { fragua: { consultas: 40, … } }
```

Y al lado, escrito por quien lo puso: *«Un episodio de la fragua sale 1 consulta
y 32 milésimas […] con eso, `<= 40` es un margen de 40× que no se puede poner
rojo»*. El mecanismo del «techo de consultas» está; el número no aprieta.

### M6 · Los ciclos rentables YA son una puerta, y no hay que construirla

`physics/src/admit.ts` rechaza con motivo `ciclo-rentable`, con su argumento
escrito: *«todo ciclo rentable, o pasa por un aporte del dios […] o no es
rentable»*. El plan pide «detección de ciclos rentables como puerta» y la puerta
existe desde el Hito 1.

### M7 · Los invariantes económicos existen, y se verifican replayando

`oracle/src/presupuesto.ts` y `oracle/src/ledger.ts` tienen `verificar()`, que
rehace los totales replayando el diario y los compara contra el mapa vivo. El
plan pide «100 partidas sin violar ningún invariante económico»: el invariante
está, lo que falta son las cien partidas.

### M8 · Cuánto cuesta correr partidas largas, con el número del árbol

El banco caro —20 partidas— tarda **~311 s**. Cien partidas de 20.000 ticks son
del orden de **25 minutos**, o sea **más que el `timeout-minutes: 20` del CI
actual**. No entra donde está hoy, y ése es el argumento más concreto a favor de
la separación que el plan pide.

### M9 · Y EL HITO YA TIENE SU PRIMER CASO REAL, ENCONTRADO HOY

`forge/tests/el-episodio.test.ts` mide `perdidosPorLaFragua` contra el **reloj de
pared**. Medido las dos formas:

```
el archivo solo .................................. 6 de 6 verdes
los 13 archivos del paquete, en paralelo ......... 1 rojo
```

Es un test cuyo resultado **depende de cuánta CPU haya libre**, sentado adentro
de la suite compartida. El plan advierte que esto *«ya pasó dos veces en este
proyecto»*; ésta es la tercera, y está en el árbol ahora mismo.

---

## 1 · Lo que las nueve mediciones dejan del hito

Tres de las cosas que el plan pide **ya están**: la puerta de ciclos rentables
(M6), los invariantes económicos (M7) y el mecanismo de línea base (M2).

Lo que falta es de otra clase, y M3 lo dice con dos números: **626 contra 1**.
No falta medir. Falta **guardar lo medido y compararlo**.

> El Hito 11 no es «medir más». Es convertir seiscientos veintiséis números que
> se imprimen en un puñado de números que se **defienden**.

Y falta la separación que M8 y M9 hacen urgente: hoy un test de reloj de pared
puede tumbar el build por la carga de la máquina, y las cien partidas no entran
en el job que existe.

---

## 2 · El criterio, en seis puntos

| | qué se afirma | cómo se mide |
|---|---|---|
| **1** | hay un **archivo de líneas base** que un test lee, con los relojes del Hito 6 adentro y su valor medido | hoy es 1 archivo con 1 número (M2, M3) |
| **2** | **EL CONTROL**: empeorando a mano cualquiera de esos números, el test se pone rojo y dice cuál | sin esto, un archivo de líneas base es decoración |
| **3** | y **subir una línea base exige editarla a mano**, con el porqué escrito — no se actualiza sola | es la regla que `linea-base.json` ya declara, generalizada |
| **4** | los tests que miden contra el **reloj de pared** están SEPARADOS de la suite determinista, y el caso de M9 está cerrado | corriendo la suite entera dos veces seguidas, cero rojos por carga |
| **5** | **cien partidas de 20.000 ticks** sin violar un invariante económico ni pasar el techo de consultas | fuera del job de CI (M8), con su tiempo medido |
| **6** | **EL CONTROL del 5**: una partida con un invariante roto a propósito **sí** se reporta | sin esto, «cien partidas limpias» es el cero por omisión más caro del proyecto |

### Por qué el punto 4 va antes que el 5

Porque el 5 es caro y el 4 es lo que hace que valga la pena correrlo. Una suite
donde un rojo puede venir de la carga de la máquina entrena a todo el mundo a
re-correr y seguir, y a partir de ahí ningún guardián protege nada. **El caso de
M9 está en el árbol hoy**, así que el punto 4 arranca con un rojo real que
cerrar, no con un ejemplo.

### Y lo que este criterio NO promete

El plan lista ocho números más en la suma del caso de aceptación —costo del
registry, crecimiento del planner, replay con promociones, dispositivos
autónomos, benchmark del proveedor, invalidación física, estabilidad
económica—. Varios de ésos **no tienen todavía a quién medir**: no hay
dispositivos autónomos corriendo solos ni promociones de verdad. Meterlos al
criterio haría que el hito no pueda cerrar por cosas que son de otros hitos.

Entran cuando exista lo que miden, con su número, como pasó con el reloj de lo
pertinente.

---

## 2 bis · Lo construido: puntos 1, 2 y 3

De **1 archivo de línea base** a **3**, y de **1 número defendido** a **6**.

| dónde | qué defiende |
|---|---|
| `skills/tests/linea-base.json` | los 84 errores del corpus (existía desde el Hito 4) |
| `emergencia/tests/linea-base.json` | **los tres hashes del banco canónico** |
| `lang/tests/linea-base.json` | `consistenciaDelPrimerGesto` y `ticksHastaLoPertinente` (3 órdenes) |

### El hash del banco es el que más costó y el que menos defendido estaba

En el Hito 10 se tocó el corazón de la mente **dos veces**, y la única forma que
había de saber que la conducta no se había movido fue abrir la salida de una
corrida vieja y **compararla a ojo**. Los 3032 tests daban verde con la conducta
movida o sin mover: ninguno miraba el hash.

Ahora lo mira uno, con su control. La guarda va dentro de
`hito-5-la-emergencia.test.ts` y no en un archivo aparte por costo: `canonico()`
memoiza el banco, y un archivo nuevo de vitest corre en otro worker — o sea que
volvería a jugar las partidas de 20.000 ticks.

### Y uno de los tres relojes NO puede entrar

`msHastaPrimerMovimiento` mide **milisegundos de cómputo**, así que su valor
depende de cuánta CPU haya libre. Defenderlo desde la suite determinista haría
que un rojo pueda venir de la carga de la máquina — que es el punto 4 de este
mismo hito, y que ya está pasando. Queda dicho **adentro del archivo de línea
base**, en un campo `queNOentraAca`, para el que lo abra sin leer esto.

Los otros dos sí son deterministas: uno es una fracción de decisiones y el otro
se cuenta en ticks de mundo.

### El detector del punto 3 se detectaba a sí mismo

La primera versión buscaba la palabra `writeFileSync` en los fuentes del paquete
y acusaba **al archivo que la define**, porque el nombre está adentro de su propia
expresión. Busca la LLAMADA —`writeFileSync(`— y por eso no puede volver a
pasar: después del nombre viene una barra invertida y no un paréntesis.

## 2 ter · El punto 4 — no era un test, eran ocho archivos

Medido antes de tocar nada, sobre todo `ii/packages/*/tests`:

```
archivos que tocan el reloj de pared Y afirman sobre él ... 8
paquetes involucrados .................................... 6
```

El rojo que conocíamos era **uno** de esos ocho. Arreglar el que falla hoy y no
mirar los otros siete habría sido arreglar el síntoma; arreglar los ocho de una
es una barrida por seis paquetes que nadie puede revisar.

### La puerta

`forge/tests/reloj.ts` — tres líneas y un encabezado. `ANIMA_RELOJ=1` enciende las
aserciones de reloj; sin él **el número se sigue imprimiendo** y se afirma lo
estructural, que es cierto con la máquina cargada o libre.

> **El número no se afloja: se muda.** En la suite determinista se imprime con un
> `(no se afirma acá…)` al lado, para que nadie lo lea como si no existiera.

Y un flag propio, no `ANIMA_BANCO`: ése dice *«esto sale caro»* (20 semillas,
311 s) y éste dice *«esto mide contra el reloj»*. El episodio de la fragua tarda
8 segundos —es barato— y aun así su número no se puede afirmar en una máquina
cargada. Conflatirlos haría que apagar el caro apague también al del reloj.

### Y la deuda se congela en vez de esconderse

`forge/tests/los-relojes-que-quedan.test.ts` cuenta los que quedan y compara
contra una línea base que **sólo puede bajar**. Es el mecanismo de los puntos 1
a 3 aplicado a una deuda: no obliga a arreglar todo hoy, y no deja que crezca
mañana. Un archivo nuevo con una aserción de reloj sin la puerta lo pone rojo.

```
antes ... 8 archivos, 6 paquetes
ahora ... 6 archivos — los 3 de @anima/forge pasaron por la puerta
```

> **La lista la escribió el detector, no la mano.** La primera versión de ese
> campo la escribí yo leyendo un `grep` y decía 5 archivos, dos de ellos
> equivocados. Un número de línea base que sale de la intuición es exactamente lo
> que este hito vino a eliminar — y me lo hice a mí mismo en el mismo archivo
> donde lo estaba prohibiendo.

---

## 3 · Lo que queda por construir

1. **Más números al archivo**: quedan 620 y pico imprimiéndose. Los que entraron
   son los que más costaba defender, no todos los que hay.

Lo que **no** hay que construir: la puerta de ciclos rentables (M6), los
invariantes económicos (M7), ni el techo de consultas (M5) — aunque a ése hay
que apretarle el número.

---

## 4 · El 2026-08-02: los puntos 4, 5 y 6, y las cuatro cosas que la medición dio vuelta

Los tres que quedaban se cerraron el mismo día, y ninguno salió como estaba
escrito acá arriba. Va lo que cambió, con el número que lo cambió.

### 4.1 · «bajar los 6 relojes» — eran 16, y la lista de 6 estaba mal

El punto 2 de la lista de arriba decía «están contados, nombrados y congelados:
`perceive` ×3, `skills` ×1, `world` ×2». **Los seis estaban mal, en las dos
direcciones a la vez.** El detector contaba ARCHIVOS con dos expresiones de
texto —«toca el reloj» y «afirma algo que se llama como un tiempo»—:

- **acusaba de más.** `perceive/ataque-a-la-costura` entraba por
  `expect(aSesenta, '…10 ms tarde…').toBe(20)`: los «ms» están en el MENSAJE y el
  número sale de un reloj FALSO, `() => 60`. Y `perceive/ataque-2-al-sellado`, que
  sí mide contra el reloj, **ya estaba detrás de `ANIMA_BANCO`** — el detector
  conocía una sola de las dos puertas del árbol;
- **se perdía de menos.** En ese mismo archivo, `expect(pared).toBeLessThan(2000)`
  sí es el reloj de pared y no lo contaba, porque la variable no se llama `ms`.

El detector nuevo sigue el número desde la lectura hasta el `expect`, y le costó
**cinco correcciones, todas encontradas por su propio control**. La peor:

> En JavaScript el `.` de una expresión regular **no matchea `\r`**. Sobre un
> archivo con fines de línea de Windows —y el árbol tiene las dos clases
> mezcladas— `=\s*(.*)$` no matchea nunca y el detector devolvía cero manchadas
> sin fallar en ningún lado. No daba cero: daba un número plausible.

Con las cinco puestas: **16 aserciones en 9 archivos**. Se bajaron 13. Quedan 3,
las tres RAZONES entre dos mediciones de la misma corrida, con su porqué escrito
en `forge/tests/linea-base.json`.

Y una de las 16 estaba en `forge/tests/el-episodio.test.ts` — **el paquete donde
vive la puerta**, que la versión vieja daba por limpio.

### 4.2 · «un job que corra `ANIMA_RELOJ=1`» — la puerta sola no alcanzaba

Abrirla con `ANIMA_RELOJ=1 pnpm ii:test` da **rojo**:

```
expected 1.0979866 to be less than 1
```

Es el tick con el dios adentro contra su techo de 1 ms. Con
`--no-file-parallelism` el mismo árbol en la misma máquina pasa 633 de 633. O sea
que **serializar es parte de la puerta y no un detalle del job**: sin eso, abrirla
habría dado un rojo permanente que nadie iba a poder distinguir de una regresión.
De ahí sale `pnpm ii:reloj`, y el workflow `.github/workflows/reloj.yml`, aparte
del que bloquea los PR porque un runner compartido es por definición una máquina
ocupada.

### 4.3 · El techo de consultas era 145 veces más chico que lo que pasa

Este documento citaba «22 consultas en una partida» del Hito 9 y el techo se
escribió en 40. Medido acá, con el observador `costura` sobre partidas enteras:

```
semilla 20260728 → 3204 consultas en 17955 ticks · 2 huecos distintos
semilla 20260729 → 3243 consultas en 18114 ticks · 2 huecos distintos
semilla 20260730 → 3258 consultas en 18170 ticks · 2 huecos distintos
```

**Y 3198 de las 3204 son el MISMO hueco**: `emitsPower<410&emitsPower>=253`, el
fuego que cocina. La mente choca contra la misma pared cada cinco o seis ticks y
vuelve a preguntar, porque nada recuerda que ya preguntó.

Por eso el techo no es un total —un total sería un techo sobre cuántos ticks
vivió la criatura— sino dos números que sí pueden explotar: **huecos DISTINTOS**
(4 contra 2 medidos) y **consultas POR TICK** (0,25 contra 0,179). Los dos se
cruzan con un cambio de conducta chico y verosímil.

### 4.4 · La violación que aparece en cada partida, y que NO la encontró este hito

El punto 5 se topó con esto:

```
1868 × inventario-inconsistente   en 2000 ticks
  { actor: 'ana', body: 'ana-cuerpo', por: 'se lleva a sí misma' }
```

La criatura se agarra a sí misma en el tick 133 y no se suelta más. **Y ya estaba
encontrado**: el mecanismo entero, con sus dos reparaciones posibles, está en el
`it.fails` de `emergencia/tests/hito-5-la-emergencia.test.ts` («Y ESE MUNDO **NO**
ERA LEGAL») y en `mind/tests/ataque-a-la-mente.test.ts` §3. Sigue abierto porque
la reparación que corresponde —la guarda en `intencionTomar`, que arregla las
quince habilidades y las que escriba el modelo, y no sólo `juntar`— **mueve el
motor y por lo tanto pide la decisión del usuario**.

Lo que este hito agrega son dos cosas y ninguna es el hallazgo: el número sobre
CIEN partidas en vez de veinte, y que el punto 5 se afirma sobre las tres clases
que el criterio nombra —`conservada-aumento`, `conservada-evaporada`,
`conversion-sin-respaldo`— y **publica la estructural aparte, contada**, en vez de
dejarla adentro de una cuenta más grande. Que es exactamente lo que este hito
persigue.
