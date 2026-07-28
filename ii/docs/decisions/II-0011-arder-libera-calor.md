# ADR II-0011 — Arder libera calor, y la ley 1 se integra en forma cerrada

Fecha: 2026-07-27 · Estado: aceptado · Cierra el hueco «el fuego tendría que
sobrevivir a la mano que lo hizo» (`world/tests/el-fuego.test.ts`), el hueco
«`establishes: temperature>=400` vive cero ticks»
(`world/tests/ataque-2-al-fuego.test.ts` (b)) y el «diente de sierra» que el
[ADR II-0010](II-0010-frotar-no-relaja.md) dejó anotado y no midió.

El ADR II-0010 hizo que la criatura ENCIENDA por primera vez. Midiendo eso
apareció que el fuego **no dura**, y que la razón son dos cosas que se arreglan
juntas o no se arreglan.

---

## Contexto: dos hechos medidos, y el segundo es peor

### (1) La ley 1 era un Euler explícito INESTABLE

`leyTermica` movía la temperatura hacia el equilibrio proporcional al hueco:

```
t = T + (objetivo − T) · min(1, (H_PERDIDA_POR_SEGUNDO / hz) / heatCapacity)
```

Un cuerpo a 400 °C soltado al aire, **primer paso**:

| masa | heatCap | `r = (H/heatCap)/hz` a 20 Hz | a 20 Hz | a 100 Hz |
|---|---|---|---|---|
| 0,2 | 0,34 | **1,471 INESTABLE** | **15,00** | 286,76 |
| 0,5 | 0,85 | 0,588 | 173,53 | 354,71 |
| 1 | 1,70 | 0,294 | 286,76 | 377,35 |
| 5 | 8,50 | 0,059 | 377,35 | 395,47 |

*(La tabla está reproducida contra el motor en
`physics/tests/el-fuego-que-dura.test.ts`, criterio (b), donde el bloque «LA
TABLA VIEJA» reimplementa la línea borrada y da estos ocho números exactos.)*

Dos consecuencias, y la segunda es peor:

- el umbral de inestabilidad (`r > 1`) es **exactamente el régimen de la yesca**:
  los cuerpos livianos que se pueden encender son los que la ley no sabía
  integrar. El `min(1, …)` no era una precaución, era el síntoma;
- y **el mismo hecho físico daba 15,00 a 20 Hz y 286,76 a 100**, que es una
  violación directa del [ADR II-0008](II-0008-el-tiempo-del-mundo-se-mide-en-segundos.md)
  y no un redondeo.

El encabezado de `leyes.ts` decía que la integración era incremental *a
propósito* porque «la forma cerrada necesita exponenciales». Las dos mitades de
esa frase estaban mal: la exponencial existe en el paquete desde el
[ADR II-0006](II-0006-dos-escalas-magnitudes-y-tasas.md) (`fexp`, construida con
enteros para no depender de `Math`), y un tick de `d += r·(techo − d)` **no es la
misma curva muestreada**: la deforma, y con `r > 1` oscila.

### (2) `leyCombustion` consumía `fuelEnergy` y NO PRODUCÍA CALOR

Era esta línea, y el calor no aparecía en ningún lado:

```ts
if (arde) {
  cambios.fuelEnergy = ... l.fuelEnergy - porPaso(TASA_COMBUSTION, dt) * e.celda.oxygen
}
```

Arder es lo único exotérmico que hay en la naturaleza, y acá borraba combustible
gratis. Medido: uno, dos o tres leños de 1 kg puestos a 400 °C en la misma celda
colapsaban los tres a 15,00 °C en 39 ticks (2 segundos), y `charred` se quedaba
en 0,010 — no carbonizaban y no transmutaban nunca.

### Lo que eso rompía, todo medido

- `friccion` promete `establishes: ['temperature>=400']` y ese hecho **vivía un
  tick**: cierto en el paso 65, falso en el 66. Antes del ADR II-0010 era falso
  siempre; después era cierto un paso, que para un planificador es peor;
- la innata `frotar` devolvía `done(a)` con pico 302,82 °C y **un tick después
  del `return` la vara estaba a 20,64 °C**. El 14/15 de
  `perceive/tests/las-quince.test.ts` contaba un contrato que duraba 50 ms;
- cocinar sólo pasaba mientras la criatura frotaba: el pescado de la cadena
  llegaba a `digestibility` 0,513 contra el 0,85 que el banco hermano llama
  «cocido»;
- tapar la fogata para hacer residuo carbonoso —la técnica emblema del
  [ADR II-0002](II-0002-la-ley-de-la-oclusion.md)— era imposible;
- y la economía del [ADR II-0009](II-0009-el-hambre-se-mide-en-segundos-y-mata.md)
  era irrealizable: eligió `COSTO_VIVIR_POR_SEGUNDO = 1,0` para que comer crudo
  diera neto negativo y cocinar positivo, y cocinar no se podía.

---

## Decisión

> **Arder libera calor.** `fuelEnergy` se convierte en `temperature` en la ley 3,
> y la integración de la ley 1 se hace en **forma cerrada**.

Las dos van juntas y no en tramos separados: con el integrador inestable, el
calor nuevo oscilaría en vez de arder.

### 1 · La forma de la liberación

Lo quemado en un paso son unidades de `fuelEnergy · mass`; el calor que sale son
grados. La conversión tiene dos mitades, y la segunda es la que no se ve:

```
grados que esa energía pone   =  CALOR_POR_COMBUSTIBLE · quemado / heatCapacity
```

Dividido por `heatCapacity`, que es **la misma cuenta que `aplicarEfectos` hace
para el `poweredBy` de la fricción** (`world/src/step.ts`): subir un grado cuesta
más en un cuerpo grande.

Pero un cuerpo que arde no ACUMULA esos grados: los pierde al mismo tiempo, y la
ley 1 se los lleva a razón de `λ = H_PERDIDA_POR_SEGUNDO / heatCapacity` por
segundo. Lo que se sostiene es el cociente, y ahí la capacidad térmica **se
cancela**:

```
régimen = (CALOR · quemado/dt / heatCapacity) / (H_POR_SEGUNDO / heatCapacity)
        =  CALOR · quemado / porPaso(H_POR_SEGUNDO, dt)
```

No es que no importe: **importa dos veces y por eso desaparece**. Un tronco sube
menos grados por unidad de energía y a la vez los pierde más lento, y las dos
cosas se compensan exacto.

La ley 3 suma `régimen · acople`, con el MISMO `acople` que la ley 1 usó. La
razón es que la solución exacta de `T' = −λ(T − A) + P` es

```
T(t+dt) = A + (T − A)·e^(−λ·dt) + (P/λ)·(1 − e^(−λ·dt))
```

y la ley 1 pone los dos primeros sumandos. Sumadas, **el punto fijo es
`A + régimen` para cualquier `dt`** y la trayectoria entera es independiente de
la frecuencia. Medido: el desvío entre 10 y 100 Hz sobre cinco instantes de la
subida es **4,8e-13 relativo**.

#### Alternativas descartadas

- **sumar los grados como un empujón suelto** (`T += CALOR·quemado/cap`, sin el
  `acople`). Es el operador partido en dos, y la meseta pasa a depender de la
  frecuencia por un factor `1/(1 − λ·dt/2)`: para un leño de 1 kg, **37% de
  diferencia entre 10 y 100 Hz**. Descartada por el ADR II-0008;
- **que el cuerpo encendido sea su propia `fuente`** (sacar el
  `if (f.id === c.body.id) continue` de `entornoDe`, `world/src/step.ts`). Es lo
  que el `it.fails` viejo proponía como primer camino. No: un cuerpo que se
  calienta a sí mismo por la ley 1 no tiene punto fijo, se va al techo del rango.
  **`entornoDe` no se tocó** y sigue salteándose a sí mismo; el calor viene de la
  ley 3, no de ser su propio ambiente. Verificado: el criterio (a) mide una brasa
  suelta, sin ninguna fuente en el mundo;
- **que la ley 3 escriba la `temperature` de la CELDA** (el otro camino del
  `it.fails`). Toca `CellState`, el hash y el snapshot, y hace que el fuego viva
  en el terreno y no en la materia — con lo cual «quedarse sin combustible»
  dejaría de apagarlo. Es más caro y dice algo distinto;
- **una temperatura de llama por sustancia** (`T_llama = ambiente + C·fuelEnergy`).
  Es más barato y da fuegos más ricos —el carbón ardería más que la hojarasca—
  pero no es una conversión de energía: es un decreto, y no divide por
  `heatCapacity`. Además la temperatura bajaría con el combustible restante y el
  fuego se apagaría con la mitad del combustible adentro.

### 2 · Las constantes, y las tres cosas que las fijan

Hay **tres** números, y el tercero es el que nadie había mirado.

#### `COMBUSTIBLE_POR_SEGUNDO = 0,3`, y pasa a ser EXTENSIVO

Era `TASA_COMBUSTION = 1`, intensivo: bajaba `fuelEnergy` (que es *por unidad de
masa*) una unidad por segundo. Eso decidía dos cosas mal a la vez:

- **cuánto dura un fuego**: todo lo hecho de madera ardía 18 segundos, una
  astilla igual que un tronco. Juntar leña no servía de nada;
- **a qué temperatura arde**: el régimen quedaba multiplicado por la masa, porque
  el combustible crece con ella y la pérdida al ambiente no. Una vara de 0,2 kg
  se habría sostenido a 132 °C —**por debajo de su propio punto de ignición**— y
  un leño de 8 kg habría saturado el rango en 2000 °C.

Extensivo, la llama se lleva `0,3` unidades de `fuelEnergy · mass` por segundo:
la meseta es la misma para todo lo que arde y lo que la masa decide es **cuánto
dura**, que es lo que uno espera de un fuego. Medido: 60 s por kilo de madera.

El valor sale de la primera cosa que hay que mirar: **la cocción más lenta del
catálogo es el cuero, 41 s medidos**. Un kilo de madera tiene 18 unidades y arde
60 s: alcanza para el peor caso con margen y no alcanza para dos. Un fuego que
durara una hora haría que nadie tuviera que juntar leña nunca.

#### `CALOR_POR_COMBUSTIBLE = 20000`

Es la segunda cosa: **a qué temperatura se estabiliza**. La meseta al aire es

```
T = T_AMBIENTE + CALOR · COMBUSTIBLE_POR_SEGUNDO · oxígeno / H_PERDIDA_POR_SEGUNDO
  = 15 + 600 · oxígeno
```

o sea **615,00 °C al aire libre**, y:

- está por encima del `pyrolysisAt` de la madera (280), que es lo que hace que
  `charred` suba y que la ley 4 pueda transmutar. También por encima del
  `ignitionPoint` de todo lo que arde, hueso (500) y carbón (420) incluidos —o
  sea que el carbón que sale de tapar el fuego vuelve a arder;
- **no quema lo que se le acerca**, y esto hay que decirlo porque es
  contraintuitivo: lo que calienta a los vecinos no es esta temperatura sino
  `emitsPower` (ADR II-0001), que sale del combustible que le queda. Un vecino en
  contacto con una fogata de 1 kg sigue equilibrando a 375 °C, igual que antes;
- y 615 es, no por casualidad, lo que equilibraría un cuerpo **expuesto por
  entero** a una fogata de un kilo: `15 + 300,6/H_PERDIDA` = 616. La llama está
  tan caliente como estar adentro de ella, que es la única lectura de este número
  que no necesita inventar nada.

#### `TASA_CARBONIZACION`: de 0,2 a 0,016 por segundo

Ésta es la que no estaba en el encargo y hay que declarar fuerte. Con 0,2 por
segundo, `charred` cruza los 0,8 que la ley 4 pide **en cuatro segundos**.
Mientras un fuego duraba un tick eso daba igual y nunca se había medido; ahora un
fuego dura un minuto, y con 0,2 **todo leño encendido se volvía ceniza a los
cuatro segundos** y los 56 segundos de combustible que le quedaban se tiraban.

0,016 pone la carbonización en la misma escala que el combustible: `charred`
cruza 0,8 a los **50 s** y un kilo de madera tiene 60 s de combustible, así que
el leño arde casi todo lo que puede antes de transmutar, y el cuero entra adentro
de UNA fogata. De paso arregla otra cosa rota por el mismo motivo: la comida
olvidada sobre las brasas se arruinaba en cuatro segundos, que no alcanza para ir
a buscarla.

#### La tercera cosa: la ventana de cocción de las doce

**El barrido no es un control.** `pnpm ii:barrido` no importa una sola línea del
motor —es un `.mjs` que reimplementa las ecuaciones, y lo clava mecánicamente
`physics/tests/ataque-2-al-barrido.test.ts`—, así que da la misma tabla con el
motor roto y con el motor arreglado.

La ventana se verificó **corriendo `paso()`**: para cada una de las doce
sustancias del Hito 0, 36 sitios (4 potencias × 3 distancias × 3 montajes), 20
segundos de mundo cada uno. Las doce tienen sitios donde se cocinan **y** sitios
donde se arruinan: si todo cocinara no habría decisión que tomar. Está en el
criterio (e).

### 3 · Por qué no es una máquina de movimiento perpetuo

`fuelEnergy` es **CONSERVADA** (`CONSERVED` de `quality.ts`) y `conservar()`
cierra cada paso: ninguna ley puede subirla. La ley 3 sólo resta, y lo que resta
está acotado por lo que hay:

```ts
const quemado = Math.min(l.fuelEnergy * l.mass, porPaso(COMBUSTIBLE_POR_SEGUNDO, dt) * e.celda.oxygen)
```

**El lazo termina porque el combustible es un stock finito que sólo se gasta.**
Cuando `quemado` llega a cero no hay calor, el cuerpo se enfría, cae por debajo
de su `ignitionPoint` y deja de arder. No hay ningún contador de segundos que lo
corte: se corta solo.

Y hay dos vías distintas de apagarse, las dos medidas:

- **quedarse sin combustible** — el carbón, que no se piroliza (`pyrolysisAt`
  fuera de alcance) y por lo tanto no puede transmutar: 1 kg arde 106,67 s, que
  es exactamente `32 / 0,3`;
- **transmutar** — la madera, que a los 50 s cruza `charred` 0,8 y la ley 4 la
  convierte en ceniza (`fuelEnergy` 0) o en residuo carbonoso, según el aire.

El criterio (g) mide el total conservado en **todos** los pasos de seis cuerpos
distintos durante 200 segundos: 24 000 pasos, **0 subidas**.

### 4 · La integración de la ley 1

```
d(t+dt) = techo + (d − techo)·e^(−r·dt)
```

es independiente de la frecuencia **por construcción**, porque componer dos pasos
multiplica los exponentes y `e^(−r·n·dt)` sólo mira el tiempo total. Lo que la
ley necesita es la fracción del hueco que se cierra, `1 − e^(−r·dt)`, y eso es
una función nueva de `fixed.ts`: **`fraccionQueSeCierra`**.

El `min(1, …)` de la ley 1 **se borró**, no se relajó: `1 − e^(−x)` nunca llega a
1, así que no hay nada que topar.

#### Por qué una función nueva y no `1 − unfx(fexp(fx(−x)))`

Por dos cosas, y cada una sola ya alcanzaría:

1. **la entrada**. Un `Fixed` tiene resolución 10⁻³ y este exponente es chico: un
   leño de 8 kg a 100 Hz tiene `x = 0,00735`, y redondeado a 0,007 el decaimiento
   se corre un **4,8%**. Aplicado cien veces por segundo eso no es un redondeo,
   es otra ley térmica — y el desvío **depende de la frecuencia** (a 10 Hz el
   mismo cuerpo se corre 0,7%), que es lo que el ADR II-0008 prohíbe;
2. **la resta**. `e^(−x)` para `x` chico vale casi 1, así que `1 − e^(−x)` es una
   resta de números parecidos y se come las cifras significativas. La cuenta hay
   que hacerla sin restar, y por eso el `x` sale factorizado afuera de la serie.

Medido, con los mismos testigos: el camino con `fexp` se va **más de 1e-3
relativo**; `fraccionQueSeCierra` se queda en **6,6e-10**. Los dos números están
en `fixed.test.ts`, y el segundo test es la CARNADA: si alguien «simplifica» la
función a `1 − unfx(fexp(...))`, ese test deja de fallar y el de arriba se cae.

#### Por qué en doubles, que es la parte discutible

`fraccionQueSeCierra` es **la única función de `fixed.ts` que trabaja en
doubles**, y hay que justificarlo: lo que ese módulo evita es `Math.exp`, que
ECMAScript **no especifica**; `+ − × ÷` **sí** están especificados bit a bit, así
que un polinomio evaluado con ellos es tan determinista como uno entero. Y acá
encima es más preciso (53 bits de mantisa contra los 24 de la escala interna).

`fexp` no se toca y sigue en enteros: devuelve un `Fixed`, o sea un valor que
tiene que caer exacto en la grilla de i32, y su contrato es ése. Son dos
funciones con dos contratos, no dos copias de una — y hay un test que **las clava
juntas** donde las dos pueden hablar (`x ≥ 0,5`, donde la resolución de `Fixed`
alcanza), que es el mismo patrón con el que `leyes.test.ts` clava
`capacidadTermica` contra la declaración del catálogo.

#### El costo, medido

Esto corre una vez por cuerpo y por tick, y el tick ya está afuera de su
presupuesto (9,6 ms contra 4 para 5000 cuerpos), así que el número importa:

| implementación | por llamada | para 5000 cuerpos y un tick |
|---|---|---|
| `Math.min(1, r)` (lo que estaba) | 0,73 ns | 0,004 ms |
| con `expS` y la escala 2²⁴ | **191 ns** | **0,95 ms** |
| en doubles, rama de la serie (`x < 0,5`) | **18,2 ns** | 0,09 ms |
| en doubles, rama con reducción (`x ≥ 0,5`) | **24,8 ns** | 0,12 ms |

La versión entera costaba **un cuarto del presupuesto de tick entero** para una
sola de las doce leyes. La de doubles cuesta el 2%. Ése es el camino rápido, y es
por qué la función está escrita como está.

*(El tick completo se midió antes y después: 8,67 ms contra 8,69 ms de mínimo en
`pnpm --filter @anima/world tick`, con una dispersión de ±25% entre corridas que
tapa por completo la diferencia. El número de la tabla es el aislado, que es el
único que se puede afirmar.)*

---

## Los siete criterios verificables

Escritos antes de tocar el código, medidos en
`physics/tests/el-fuego-que-dura.test.ts` salvo donde se indique.

| | criterio | medido |
|---|---|---|
| a | un leño de 1 kg arde N s y se apaga solo, N igual a 10/20/25/50/100 Hz | **50,00 s** a las cinco (± un tick). El carbón de 1 kg: 106,67 s |
| b | la meseta es la misma a las cinco frecuencias | **615,0000 °C** a las cinco. La trayectoria entera: desvío 4,8e-13 |
| c | `charred` llega a 0,8 y la ley 4 transmuta; tapado da carbonoso | ceniza a los 50,00 s al aire, tizón a los 50,00 s tapado; tapar rinde **4,67×** la materia y lo que sale vuelve a arder |
| d | el pescado llega a `digestibility ≥ 0,85` sin que nadie lo frote | **0,85 a los 3,50 s**, termina en 0,9500 (antes: 0,513) |
| e | la ventana de cocción de las doce sigue existiendo, contra el MOTOR | las doce, con sitios que cocinan y sitios que arruinan |
| f | `friccion` cumple su `establishes` por más de un tick | **49 s** arriba de 400 °C; la innata `frotar` deja la vara a 615 °C diez segundos después del `done` (antes: 20,64) |
| g | el `fuelEnergy` total nunca sube | 24 000 pasos, 6 cuerpos, **0 subidas** |

### Y una tabla que conviene tener a mano

Lo que la reparación hace con el mundo, todo medido:

| hecho | antes | ahora |
|---|---|---|
| brasa de madera 0,2 kg a 700 °C, al aire | cae debajo de 300 en **1 tick** (0,05 s) | arde **12,05 s** |
| ídem 8 kg, lo más pesado que se puede levantar | 1,20 s | **50,05 s** |
| ídem 1 kg / 3 kg | — | 50,05 s / 50,05 s |
| ídem carbón 2,5 kg | — | **más de 200 s** |
| `friccion` llega a 375 °C | 3,00 s | **2,40 s** (a los 2,375 prende y el resto lo pone la llama) |
| lo que cuesta encender una vara de 0,2 kg | 352,71 de `stamina` | **282,17** (se paga hasta la ignición, no hasta 375) |
| el pescado de la cadena | 0,513 | **0,9456** en 12 s |
| en 200 pasos frotando, la vara arde | 36 pasos (18%), con **3 derrumbes** | **153 de 200 (77%)**, con **0** |

*(Los guiones son honestos: son casos que el banco viejo no medía, y no se
inventa un número «antes» para llenar la celda. Los dos que sí están —el tick de
la vara de 0,2 kg y el 1,20 s de la de 8— salen del `it.fails` que este ADR
cerró, en `world/tests/el-fuego.test.ts`. El 77% y no 100% es porque la vara de
0,2 kg se queda sin combustible a los 12,05 s y los 200 pasos son 10 s de mundo
más los 2,4 que tarda en prender.)*

---

## Las carnadas, revertidas a mano

Cada reparación tiene tests que se caen si se la revierte, y se revirtieron **a
mano** para verificarlo. Los dos experimentos, con el árbol entero corriendo:

**Revertir la forma cerrada** (`acopleTermico` vuelve a
`Math.min(1, porPaso(H, dt) / cap)`) → **8 tests rojos**:

- `physics/el-fuego-que-dura` (b) «615,00 °C a las cinco» y «la trayectoria
  entera coincide»;
- `physics/huella-de-conducta`;
- `world/ataque-2-al-fuego` (a) CARNADA «la meseta es exactamente el régimen»;
- `world/el-fuego` «el fuego le SOBREVIVE a la mano»;
- `world/el-tiempo-no-depende-del-tick` **«la saturación del acople SE TERMINÓ»**,
  que es la carnada específica: el canto de piedra vuelve a valer 15,00 a 10 Hz;
- `world/hito-2-el-criterio` y `world/partida-de-2000-ticks`.

**Revertir la liberación de calor** (borrar el `cambios.temperature` de la ley 3)
→ **10 tests rojos**, entre ellos los criterios (a), (b), (c), (d) y (f) enteros,
`el-empuje-no-se-relaja` «la vara llega ANTES porque en el camino PRENDE» y «la
que SÍ arde no vuelve», y la huella de conducta.

Y una carnada que no es de la reparación sino de **cómo** se hizo:
`fixed.test.ts`, «el camino que NO se tomó falla el mismo test por seis
órdenes» — si alguien «simplifica» `fraccionQueSeCierra` a
`1 − unfx(fexp(fx(−x)))`, ese test deja de fallar y el de precisión se cae.

---

## Consecuencias

### Lo que cambia de conducta, y sus huellas

Tres huellas se movieron **a mano y con el porqué al lado**, que es lo que el
encabezado de cada una pide:

- `physics/tests/huella-de-conducta.test.ts`: 3705094564 → **2564253564**;
- `world/tests/partida-de-2000-ticks.test.ts`: `adea782a5cd4274d` →
  **`19db371807b7fb35`**, con sus once checkpoints. Los eventos pasaron de 9187 a
  9190 y las sustancias de 30 a 31 — son las tres transmutaciones de más que la
  ley 4 alcanzó a hacer ahora que el fuego dura. Las violaciones NO se movieron
  (97), o sea que el guion de intenciones es el mismo y ninguna se aceptó o
  rechazó distinto: lo que cambió fue la física y no la puerta;
- `world/tests/hito-2-el-criterio.test.ts`: sólo el TERCERO de los cuatro
  snapshots (el estado tras diez ticks). El mundo inicial, `hashPhysics` y la
  cadena del journal **no se movieron**, y eso es información: las tres
  constantes que cambiaron viven en `leyes.ts` y no en el catálogo.

`propiedades.test.ts` (la huella de `fixed.ts`) **no se movió**: la función nueva
tiene su propia huella, aparte, para no tocar la que cruza máquinas.

### Lo que hay que saber que existe ahora

- **frotar una vara encendida la enfría.** Un `drive` empuja hacia su `toward`
  desde los dos lados, y `friccion` apunta a 400: con la vara a 615 °C, seguir
  frotando la baja hacia 400 y encima se paga. Medido: la meseta con la mano
  puesta es `615 + Δ − Δ/acople`, o sea 614,33 a 10 Hz y 611,49 a 100. Es
  correcto y es raro; queda anotado porque va a aparecer en una crónica;
- **un fuego cuesta menos de lo que costaba**: la mano paga hasta la ignición y
  no hasta los 375, así que el techo de lo que se puede encender con un tanque de
  1000 subió de 0,55 kg a algo más de 0,6;
- **tapar el fuego ahora tiene un rendimiento cuantificable**: el residuo
  carbonoso se lleva el 28% de la masa con el combustible concentrado 1,6×, o sea
  que conserva el 45% de la energía que quedaba; el mineral se lleva el 6% y cero
  combustible.

### Lo que sigue abierto

- **la economía del ADR II-0009 sigue sin cerrar**, y ahora se sabe por cuánto:
  cocinar un pescado de 1 kg vale +1,06 de `stamina` (o +3,76 en el mejor caso) y
  encender la vara más barata cuesta 282,17. Hacen falta 266 bocados por fuego.
  El `it.fails` de `world/tests/ataque-2-al-fuego.test.ts` (e) sigue rojo con los
  números actualizados. Es del ADR II-0009 y no de éste;
- **la meseta no depende de la sustancia**: todo lo que arde arde a 615 °C, y lo
  que la materia decide es cuánto dura. El carbón debería arder más que la
  hojarasca. Haría falta que el calor por unidad de combustible saliera de la
  sustancia, y eso es otro barrido;
- **el `min(1, …)` que se borró de la ley 1 no era el único**: `aplicarEfectos`
  del mundo sigue siendo Euler explícito para los `drive`, y eso es lo que hace
  que la meseta con la mano puesta dependa de la frecuencia. Es chico y está
  medido; cerrarlo es tocar la forma de `Effect`.
