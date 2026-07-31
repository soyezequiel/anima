# Hito 5 — Las secuencias del criterio de emergencia

Fecha: 2026-07-28 · Estado: **TERCERA TANDA — EL FUEGO SÍ SE PROPAGA**. La
primera lista de diez se congeló, un adversario la abrió constante por constante
y quedaron seis. Ese mismo día se midió lo que las seis daban por sabido, y **la
medición dio vuelta el hallazgo central**: la conclusión «en ninguna partida se
puede encender un leño» era correcta sobre PIEZAS SUELTAS y falsa sobre lo que la
criatura puede ATAR. Con eso vuelven dos entradas de las caídas y aparece una
nueva. **Hay nueve.**

Este documento decide si el proyecto sigue, así que se escribe **antes** de que
exista la mente. Si la lista, los umbrales o los detectores se pudieran ajustar
después de ver qué hace la criatura, el criterio no mediría nada: mediría al que
lo escribió. Lo único que se puede tocar sin volver a correr todo es un **error
de detector** —uno que reimplemente una fórmula del motor en vez de llamarla—, y
la segunda tanda usó esa puerta exactamente una vez, en la secuencia 1, con el
motivo escrito. Esta tercera no la usa: lo que cambió no es un detector, es el
mundo que se creía conocer.

> **Y UNA ACLARACIÓN DE ALCANCE, agregada el 2026-07-31.** Esta lista **no se
> amplía** con los objetos emergentes. El Hito 5 termina con el alcance que tiene
> —incluido este criterio de emergencia— y la trampa para peces, los planos, el
> registry y el descriptor visual son el
> [Gate 5→6](gate-5-6-objetos-emergentes.md), que va **después**. Agregarle
> secuencias a esta lista ahora sería mover el criterio de corte después de
> haberlo medido, que es exactamente lo que las siete reglas de la sección 1
> prohíben.

**LO PRIMERO, PORQUE CAMBIA TODO LO DEMÁS:** hay **nueve** y no seis. Con nueve,
el criterio publicado «al menos 4 de las 10» **vuelve a valer con el mismo
número**: el 4 absoluto y el 40% proporcional (3,6 → 4) caen en el mismo lugar,
así que la disyuntiva que la tanda anterior dejó abierta se disuelve sola. Está
en la sección 10, y ahí también está lo que falta para llegar a diez.

---

## 0 · Qué dice el criterio, y qué pasó en cada tanda

El documento de arquitectura
(`F:/proyectos/Anima/docs/architecture/remake-anima-ii.md`, línea ~1462) pide
diez secuencias objetivo que nadie implementó, un detector automático, veinte
partidas con semillas distintas y un piso de cuatro apariciones.

**Tanda uno.** Escribió diez. El adversario tumbó nueve y dejó una.

**Tanda dos.** Verifiqué veredicto por veredicto contra el código y contra los
tests: **seis de sus siete veredictos entregados se reproducen enteros**, uno se
reproduce a medias, y **dos secuencias que declaró caídas nunca vinieron con
fundamento** (sección 6). Además le encontré un error propio que cambia el signo
de un hallazgo suyo (sección 6.b): el mundo **sí** deja tirada una yesca que
sirve, y no es la que él buscó. Quedaron seis.

**Tanda tres, y es ésta.** El hallazgo central de la tanda dos —el techo de la
fricción, del que colgaban cuatro muertes— estaba **derivado y no medido**, y el
propio documento lo declaraba en §6.c. Se midió
(`ii/packages/world/tests/el-fuego-no-se-propaga.test.ts`, 7 tests en verde,
corrido para escribir esta sección). El techo de 0,7132 kg quedó confirmado. La
conclusión que colgaba de él —«el fuego no se propaga»— quedó **refutada**: sale
falsa en cuanto se le permite a la criatura atar dos cosas, que es exactamente el
movimiento del que trata el proyecto. Vuelven `el-leno-mas-pesado` (como entrada
8) y `la-piedra-primero-y-la-comida-encima` (como entrada 9), y aparece
`el-fardo-de-corteza` (entrada 7), que es la vieja `cadena-de-la-yesca` hecha con
la materia que el mundo sí siembra.

De ahí salen las nueve de la sección 4, las cuatro caídas que siguen caídas de la
sección 5, y la regla nueva —la más cara de las tres tandas— de la sección 12.

---

## 1 · Las siete reglas que gobiernan la lista

Las tres primeras las dejó el adversario de la tanda cero. La cuarta la agregó la
tanda uno. La quinta y la sexta salen de la dos. La séptima sale de la tres, y es
la que más caro salió de todas.

**REGLA 1 · EL DETECTOR LLAMA A LAS FUNCIONES EXPORTADAS DEL MOTOR.** Un detector
que transcribe una fórmula mide su propia copia. Esta tanda lo cobró: el detector
de `no-frotar-lo-que-no-alcanza` transcribía
`capacidadTermica × (ignitionPoint − temperature) / 0,35`, y **la transcripción
daba otro número que el mundo** — 1384,29 contra 1401,26 para una vara de 1 kg
(sección 5, veredicto 3). El documento anterior imprimía los dos números a tres
renglones de distancia y no se dio cuenta de que no eran el mismo.

Las funciones disponibles, verificadas exportadas hoy:

```ts
qualityOf(b: Body, q: QualityId, phys: Physics): number            // physics/src/body.ts:144
estaEnVentanaDeCoccion(b: Body, phys: Physics): boolean            // physics/src/leyes.ts:1023
temperaturaDeEquilibrio(potencia, distancia, montaje, ambiente?)   // physics/src/leyes.ts:142
formFactor(distancia: number, montaje: Montaje): number            // physics/src/leyes.ts:136
capacidadTermica(b: Body, phys: Physics): number                   // physics/src/leyes.ts:970
cumpleRol(b: Body, r: Role, phys: Physics): boolean                // physics/src/leyes.ts:1663
unir(a, b, binder, phys, id): Body | undefined                     // physics/src/leyes.ts:1701
shelteredDe(d: ConCuerpos, celda: CellKey): number                 // world/src/step.ts:1268
probabilidadDePicar(s, gear, phys, t): number                      // oracle/src/extraccion.ts:137
```

> **HUECOS DEL ARNÉS, declarados.** `montajeDe` (`world/src/step.ts:1419`),
> `celdaDe` (`:1320`), `entornoDe` (`:1436`) y `stockDe` (`:2385`) **no están
> exportadas** —verificado: ninguna aparece en `world/src/index.ts`—. Ningún
> detector puede preguntarle al motor «¿esto está en parrilla o en contacto?» ni
> «¿cuánto queda en el pozo?». Los detectores que lo necesitan leen
> `supportedBy` / `covering` del `WorldBody`, que es leer el estado del mundo y
> no copiar una fórmula, y así está dicho en cada uno. **No existe ninguna
> función exportada que devuelva el precio de encender un cuerpo**, y ése es el
> hueco que obligó a reescribir el detector de la secuencia 1.

**REGLA 2 · CADA SECUENCIA DECLARA QUÉ LA PAGA, CON NÚMERO Y FUENTE.** Sin
`stamina`, calorías, tiempo o supervivencia de por medio no es emergencia: es
coreografía, y el detector mide cero por construcción. Lo derivado va marcado
**DERIVADO, NO MEDIDO** con las constantes de las que sale.

**REGLA 3 · NADIE LA IMPLEMENTÓ.** Las quince innatas están en
`skills/src/innatas/`. Cada entrada dice a cuál se le parece y en qué línea se
corta. Esta tanda le agrega un filo: **tampoco vale si la mente que se va a
construir la tiene escrita en su diseño**. La escalera D0–D5 del documento de
arquitectura (`remake-anima-ii.md:770`) dice literal
`| **D0** | reflejo (tabla estática: dolor, caída, fuego encima) | 5 µs |`. Una
secuencia que es una fila de esa tabla no es emergencia: es el peldaño cero.

**REGLA 4 · LA SITUACIÓN TIENE QUE EXISTIR EN EL MUNDO DECRETADO.** No alcanza
con que compile en el arnés: el dios tiene que sembrarla. Un detector que no se
puede disparar porque el mundo nunca puso el problema delante mide cero, y ese
cero se lee como «la mente no lo descubrió». De ahí que **cada secuencia lleve su
contra-detector**: cuántas de las veinte partidas le pusieron el problema
delante. Si son cero, el resultado se reporta **no medida**, nunca como ausencia.

**REGLA 5 · UNA SECUENCIA NO PUEDE ESTAR MEDIDA CON UN CUERPO QUE EL MUNDO NO
SIEMBRA.** Es la Regla 4 mirada desde el banco en vez de desde la partida, y es
la que tumbó cuatro entradas de una vez. La tanda anterior citó como evidencia
mediciones hechas con un leño de 5 kg y con una yesca de `hoja-seca` de 1 kg. El
dios siembra madera hasta 3 kg y hoja seca **de 0,01 a 0,08 kg**
(`oracle/src/bioma.ts:359,400,419`). Una medición hecha con materia que no
existe describe una técnica que la criatura no puede ejecutar. **Antes de citar
un test, hay que mirar con qué masa está armado su banco.**

**REGLA 6 · SI LA CONDICIÓN DEL DETECTOR LA PUEDE PRODUCIR EL MOTOR SOLO, NO ES
UNA CONDUCTA.** También nueva, y también cobró una entrada entera.
`intencionCaminar` le **asigna sola** la relación de apoyo al que pisa un cuerpo
con `footing > 0` —`ponerCuerpo(d, { ...ahora, supportedBy: choque.body.id })`,
`world/src/step.ts:1707-1710`— y `moverActor` la **suelta sola**
—`const { supportedBy: _apoyo, covering: _tapa, ...suelto } = mio`, `:1600`—. O
sea que «apoyada sobre algo que arde, y después no» lo produce entero un bicho
que camina a la celda del fuego y se va. Antes de escribir un detector hay que
preguntarse qué escribe el motor sin que nadie piense.

**REGLA 7 · MEDIR EL CATÁLOGO NO ES MEDIR EL MUNDO, Y MEDIR LAS PIEZAS SUELTAS
TAMPOCO.** Es de esta tanda y falla en las dos direcciones a la vez. Barrer las
sustancias que un bioma siembra, una por una, con la masa máxima de cada una, NO
contesta qué puede hacer la criatura: **puede combinarlas**, y las cualidades
extensivas se suman. Un barrido así declaró imposible una técnica que sale con
dos piezas atadas (§2). Y del otro lado, barrer el catálogo **sin** mirar la
siembra inventa técnicas que no existen: la antorcha de grasa cruza los tres
umbrales, y `grasa` no la siembra ningún bioma (§2.4). La regla operativa, en dos
preguntas que hay que hacerse antes de escribir «no se puede»: **¿lo medí con lo
que la criatura puede ARMAR o sólo con lo que encuentra?** y **¿la materia con la
que lo medí la siembra alguien?**. La sección 12 la escribe entera, porque va a
volver a pasar.

---

## 2 · EL HALLAZGO CENTRAL: el techo de la fricción, y la puerta que el techo no cierra

El techo lo encontró el adversario en la tanda dos y **es cierto**: sigue clavado
donde estaba. Lo que era falso es lo que se dedujo de él. Va antes de la lista
porque la lista no se entiende sin él, y va reescrito porque la tanda dos lo
publicó como conclusión **derivada y no medida** —está confesado en §6.c— y
cuando se midió, la mitad de abajo se cayó.

Todo lo de esta sección está corrido, no estimado. La fuente es
`ii/packages/world/tests/el-fuego-no-se-propaga.test.ts` (7 tests, verde), y
donde algo sale de una cuenta y no del mundo dice **DERIVADO**.

### 2.1 · Lo que cuesta encender, con el modelo validado

`FRICCION` es un `drive` sobre `temperature`, `toward: 400`, `porSegundo: 120`,
pagado con `stamina` a eficiencia 0,35, y los dos roles piden `rigidity >= 0,5`
(`physics/src/process.ts:211-236`). A 20 Hz el empuje sube **6 °C por tick**, así
que la vara de madera cruza sus 300 °C en el paso 48, a los **303 °C** —clavado:
`expect(empujadoHasta).toBe(303)`, `world/tests/el-fuego.test.ts:219-220—`, y el
mundo cobra:

```
costo(m) = m · specificHeat · (303 − ambiente) / 0,35   +   segundos · 1,0
```

Para la madera (`specificHeat` 1,7, `sustancias.ts:410`) con ambiente 15 eso es
`1398,857 · m + 2,40`. **El modelo reproduce los cuatro valores que el motor mide,
a la cuarta cifra:**

| vara de madera | modelo | medido | fuente |
|---|---|---|---|
| 0,20 kg | 282,1714 | **282,1714** | `perceive/tests/ataque-a-la-costura.test.ts:1303` |
| 0,46 kg | 645,8743 | **645,8743** | `:1305` |
| 0,47 kg | 659,8629 | **659,8629** | `:1307` ← el `PRECIO_DEL_FUEGO` |
| 0,50 kg | 701,8286 | **701,8286** | `:1310` |

### 2.2 · El techo, que sigue en pie

El tanque de `stamina` topa en **1000** y **no se repone sola** — el catálogo lo
dice con todas las letras: «No relaja. Si la stamina volviera sola, el hambre
dejaría de doler» (`physics/src/quality.ts:189-196`). Comer es la única recarga, y
un pescado crudo de 2 kg devuelve 6,08.

**DERIVADO, NO MEDIDO** (de las constantes de arriba): con el tanque lleno, la
vara más pesada que se puede llevar a la ignición es

```
m_max = (1000 − 2,40) / 1398,857 = 0,7132 kg
```

El propio test lo corrobora por los dos lados: mide 0,2 / 0,4 / 0,5 / 0,55 / 0,6
y todas llegan, escribe «el techo … subió de 0,55 kg a algo más de 0,6»
(`el-fuego.test.ts:216-217`), y con 1 kg **no llega**: se queda con el tanque
vacío (`:231-233`).

Ahora la otra punta. `emitsPower = step(T ≥ ignitionPoint) · fuelEnergy · mass ·
16,7` (`quality.ts:406-427`, `EMISSION_PER_FUEL` en `:164`) y la ley 1 en régimen
es `T_eq = ambiente + potencia · EXPOSICION[montaje] / 0,5` con
`contacto = 0,6` (`leyes.ts:97-101,113,140-147`), o sea `15 + 1,2·P` para lo que
está apoyado encima del fuego.

**Y ACÁ EL MODELO DEJA DE SER MODELO: está medido contra el mundo, fila por
fila** (`el-fuego-no-se-propaga.test.ts:121-180`, corrido hoy). Una vara ardiendo
y una madera de 0,2 kg apoyada encima:

```
  masa fuente │ potencia │ T_eq predicha │  T medida  │ ¿prende?
  ────────────┼──────────┼───────────────┼────────────┼─────────
       0,2000 │    60,12 │         87,14 │      86,13 │ no
       0,4000 │   120,24 │        159,29 │     158,08 │ no
       0,6000 │   180,36 │        231,43 │     230,18 │ no
       0,7132 │   214,39 │        272,27 │     270,99 │ no      ← el techo
       0,7900 │   237,47 │        299,97 │     298,67 │ no
       0,8000 │   240,48 │        303,58 │     901,17 │ SÍ
       1,0000 │   300,60 │        375,72 │     973,91 │ SÍ
       2,0000 │   601,20 │        736,44 │    1334,83 │ SÍ
```

Tres cosas que hay que leer de esa tabla y que ningún documento anterior tenía:

1. **La ley 1 en régimen explica lo que el mundo hace**, con un déficit de
   **1,01 / 1,21 / 1,25 / 1,28 °C** en las cuatro filas que no prenden. Es un
   déficit **absoluto y no proporcional** —crece con la asíntota, no con el
   porcentaje— así que a cualquier umbral hay que pedirle **1,3 °C de más**. Ese
   1,3 va a aparecer tres veces en esta sección.
2. **La primera masa que prende una madera pesa 0,8000 kg**, y el techo de lo
   encendible es 0,7132. La fuente tendría que pesar **0,7901 kg**, o sea un
   **10,8% más de lo que se puede encender frotando** (`:182-209`, corrido).
3. **La temperatura de la fuente no viaja: viaja su masa.** Una vara a 350 °C y
   una a 700 °C dejan al vecino en **194,1315 °C las dos**, al sexto decimal
   (`:100-119`). Lo único que la temperatura aporta es el `step` de estar
   prendida.

Con **madera dura** (`fuelEnergy` 21, `ignitionPoint` 340, `specificHeat` 1,6,
`sustancias.ts:449-464`) el techo es 0,661 kg, la potencia 231,8 y el contacto
**293,2 °C**: queda **6,8 °C corto**. Con **hueso** es imposible por dos motivos
a la vez: `ignitionPoint` 500 y el `drive` tope en `toward: 400`
(`sustancias.ts:624-640`). Y no hay una cuarta sustancia sembrada que pase el
`rigidity >= 0,5` del rol `a`: madera (0,70), madera dura (0,88) y hueso (0,92);
pedernal y piedra pasan el umbral y no tienen `fuelEnergy`.

Tampoco se suma por afuera: `entornoDe` toma **UNA** fuente, la de mayor
potencia, y no la suma de todas (`world/src/step.ts:1428-1436`). Dos fogatas al
lado de la misma vara valen lo que la más grande.

**Hasta acá, todo lo que la tanda dos escribió es cierto.** Lo que sigue es lo
que estaba mal.

### 2.3 · LO QUE ERA FALSO: el fuego SÍ SE PROPAGA, y lo que lo abre es `unir`

La tanda dos cerró la sección con esta línea:

> ~~En ninguna partida decretada se puede encender un leño. Ningún cuerpo con
> `ignitionPoint` 300 se prende jamás por contacto con otro.~~

Y con esta cuenta, que es la que hay que mirar con atención porque el error está
adentro: «para prender una madera hacen falta 237,5 de potencia, o sea 0,836 kg
de hoja seca (se siembra hasta 0,08), **0,889 kg de corteza (hasta 0,5)** o 0,948
kg de junco (hasta 0,4). Todas las puertas del segundo eslabón están cerradas por
un factor de entre 2 y 10».

**El factor de la corteza no es «entre 2 y 10»: es 1,78.** Y el error de fondo no
es aritmético — es que la frase «se siembra hasta 0,5» describe **una pieza**, y
la criatura no está obligada a usar una pieza. `union` es una de las quince
innatas, sus roles `a` y `b` **no piden nada** (`where: []`,
`physics/src/process.ts:259-260`), la masa de un ensamble es **extensiva** y
`MAX_PARTS` es **6** (`physics/src/body.ts:24`). Dos cortezas atadas son un
cuerpo de 1 kg, y un cuerpo de 1 kg de corteza entrega lo que uno de 0,5 no
entrega.

Medido (`el-fuego-no-se-propaga.test.ts:463-547`, corrido hoy):

```
  piezas │ masa del fardo │ potencia │ entrega │ ¿prende el leño?
  ───────┼────────────────┼──────────┼─────────┼─────────────────
       1 │           0,50 │   133,60 │  175,32 │ no
       2 │           1,00 │   267,20 │  335,64 │ SÍ
       3 │           1,50 │   400,80 │  495,96 │ SÍ
       4 │           2,00 │   534,40 │  656,28 │ SÍ
```

y **en el mundo, no en la fórmula**: con el fardo de dos piezas encendido y una
madera de 0,2 kg apoyada encima, la madera llegó a **933,83 °C** (`:529-546`, con
`expect(pico).toBeGreaterThanOrEqual(ign)` en verde).

**Y el primer eslabón ya alcanzaba.** La vara del techo entrega 272,27 °C
predichos y **270,99 medidos**, y la corteza enciende a **250**
(`sustancias.ts:473-497`). O sea que la cadena entera es:

> **FROTAR UNA VARA → PRENDER UN FARDO DE CORTEZA → CON EL FARDO, PRENDER EL
> LEÑO.** Sin tocar una constante, sin sembrar nada nuevo, y con habilidades que
> ya existen.

Los tres números que hay que tener a mano, **DERIVADOS** de las fórmulas de §2.1
y §2.2 con el déficit medido de 1,3 °C incluido:

| | número | cuenta |
|---|---|---|
| potencia que pide encender **corteza** por contacto | 195,83 | (250 − 15) / 1,2 |
| **la vara más liviana que prende un fardo** | **0,655 kg** | 196,90 / 300,6, con el 1,3 |
| el techo, que no se movió | 0,7132 kg | §2.2 |
| ⇒ **la ventana de la vara que arranca la cadena** | **58 gramos** | 0,655 … 0,7132 |
| lo que cuesta esa vara | **918,6** de stamina | 1398,857 · 0,655 + 2,40 |
| potencia que pide encender **madera** por contacto | 237,50 | (300 − 15) / 1,2 |
| **el fardo más liviano que prende un leño** | **0,893 kg** de corteza | 238,57 / 267,2, con el 1,3 |
| ⇒ piezas de corteza que hacen falta | **2 grandes, o hasta 6 chicas** | siembra 0,05–0,5; `MAX_PARTS` 6 |

**Y la materia está toda en la orilla del pescado.** En `agua-dulce`: corteza
peso 2, de 0,05 a 0,5 kg (`oracle/src/bioma.ts:298`); junco peso 6, de 0,05 a
0,4 (`:294`); madera peso 4, de 0,3 a 2,5 (`:295`). El junco **sirve de atadura
tal como se encuentra**: `flexibility` 0,80 contra el `>= 0,8` que pide el rol
`binder` y `tensile` 0,42 contra `>= 0,3` (`sustancias.ts:528-552` ·
`process.ts:254-258`). Y la corteza **nace seca**: `moisture` 0,30 contra el
`HUMEDAD_QUE_APAGA = 0,45` de la ley 3 (`leyes.ts:261`), así que no hay que
secarla antes.

**LA VENTANA DE 58 GRAMOS TAMBIÉN SE ATA.** Es la parte más linda del hallazgo y
es la misma llave. Sobre el rango de madera que siembra `agua-dulce` (0,3 a
2,5 kg) una ventana de 58 gramos es el **2,6%** de las piezas: encontrarla es
suerte. Pero `friccion` sólo le pide al rol `a` `rigidity >= 0,5`
(`process.ts:214`), la rigidez de un ensamble es el promedio pesado por masa
—verificado en el barrido de la antorcha, `el-fuego-no-se-propaga.test.ts:281-331`—
y madera con madera da **0,70**. O sea que dos varas de 0,35 kg atadas son una
vara de 0,70 kg que cae adentro de la ventana, cuesta 981,6 y pasa el rol.
*(DERIVADO.)* **La misma maniobra que hace el fardo hace la vara que enciende el
fardo.**

### 2.4 · La otra puerta, y por qué NO se abre: la antorcha de grasa

El mismo test encontró un segundo camino y hay que despacharlo acá para que nadie
lo resucite leyendo el archivo. La `grasa` tiene `fuelEnergy` 30 contra los 18 de
la madera, y lo único que la deja afuera de `friccion` es `rigidity` 0,1. Atada a
una vara, el ensamble promedia la rigidez y suma la potencia. Medido
(`:260-365`): **0,449 kg de madera + 0,2245 kg de grasa** dan rigidez 0,5000
clavada, cuestan 987,16 de los 1000, entregan **311,93 °C** contra los 300 que
pide la madera, y en el mundo el blanco llegó a **909,83 °C**. El barrido fino
(`:367-443`) encuentra **16 recetas** que cruzan los tres umbrales, la más holgada
0,46 + 0,21 con 2,12% de holgura.

**Y no sirve para nada, por la REGLA 5.** `grep -rn "'grasa'"` sobre
`ii/packages`, sin tests, devuelve **dos líneas, las dos del catálogo**
(`physics/src/data/sustancias.ts:710-711`). Ningún bioma la siembra, ningún
proceso la rinde. Es exactamente el mismo modo de falla que el de la yesca de
`hoja-seca` de 1 kg que tumbó cuatro entradas en la tanda dos, y aparece dos
secciones después de haberlo escrito. La antorcha es un objeto del catálogo, no
del mundo: **no entra en la lista y no se cita como evidencia de nada.**

### 2.5 · La conclusión, corregida

> **El techo de la fricción es real: nadie enciende frotando más de 0,7132 kg, y
> ninguna PIEZA SUELTA que ese techo prenda alcanza para prender un leño.**
>
> **Y el fuego se propaga igual, porque la criatura puede atar.** Un fardo de
> 0,893 kg de corteza —dos piezas grandes o hasta seis chicas, todas sembradas en
> la orilla del pescado— prende una madera: medido, 933,83 °C en el mundo.
>
> El precio de entrar en la cadena es **una vara de 0,655 a 0,7132 kg, o sea 918
> a 1000 de stamina: el tanque entero.** Lo que compra son los segundos de fuego
> que el leño trae: **50 s por kilo** para madera y para corteza, medido
> (`physics/tests/ataque-al-borde-del-fuego.test.ts:126-153`), lineal en la masa
> (`world/tests/ataque-3-al-incendio.test.ts:403-412`).

Esto devuelve a la lista las entradas 2 y 4 de la tanda anterior —como entradas 8
y 9— y convierte la vieja 7 en la entrada 7, hecha con la materia que existe. La
sección 5 lo cuenta caso por caso. Lo que **no** resucita es lo que nunca murió
por acá: hacer carbón sigue siendo una pérdida aritmética (§9.a) y la noche sigue
sin costar nada (§8.d).

---

## 3 · La economía que ordena la lista, corregida

`stamina` **es tiempo de vida**: 1,0 por segundo de mundo, tanque de 1000.

| magnitud | valor | fuente |
|---|---|---|
| costo de vivir | 1,0 de stamina por segundo | `world/src/step.ts:648` |
| techo del tanque | 1000, y no se repone sola | `physics/src/quality.ts:189-196` |
| caminar una celda | 0,05 | `world/src/step.ts:617` |
| comer | 1 stamina por caloría | `world/src/step.ts:673` |
| calorías | `nutrition · mass · digestibility` | `physics/src/quality.ts:342-352` |
| **el fuego que COCINA** | **659,8629** (vara de madera de 0,47 kg) | `ataque-a-la-costura.test.ts:1307` |
| el fuego que sólo enciende | 282,1714, y el pescado se queda en 0,3800 | `:1303` |
| factor entre los dos umbrales | 2,339× | `:1311` |
| **el techo de lo encendible** | **0,7132 kg** → 214,4 de potencia | DERIVADO, §2.2 |
| lo que paga cocinar una pieza de 2 kg | 9,12 | `oracle/tests/presupuesto.test.ts:549-552` |
| **piezas por fuego** | **73** (2 kg) · 145 (1 kg) | `presupuesto.test.ts:1557-1558` |
| lo que saca la partida común más flaca de cien | 76 piezas en 1000 s | `:1569-1570` |
| duración del fuego | `min(50, fuelEnergy/0,3)` s **por kilo** | `physics/tests/ataque-al-borde-del-fuego.test.ts:126-153` |
| y es lineal en la masa | 1·2·5·20·50 kg dan 1×·2×·5×·20×·50× | `world/tests/ataque-3-al-incendio.test.ts:403-412` |
| **⇒ lo que dura el fuego más barato que cocina** | **23,5 s** | 50 · 0,47, DERIVADO |
| un día de mundo | 200 s; un pozo exprimido se repone en un día | `world/src/reloj.ts:62` · `oracle/src/pesca.ts:107` |
| **la vara que arranca la cadena** | **0,655 a 0,7132 kg** → 918,6 a 1000 | DERIVADO, §2.3 |
| **el fardo que prende un leño** | **0,893 kg** de corteza, y encenderlo es gratis | DERIVADO, §2.3 |
| lo que dura un leño de 1,5 kg | **75 s** | 50 · 1,5, DERIVADO |

El margen entero del proyecto son **tres piezas**: hacen falta 73 para pagar un
fuego y la partida más flaca saca 76.

> **LO QUE CAMBIA LA CADENA, Y ES EL NÚMERO QUE ORDENA LAS TRES ENTRADAS NUEVAS.**
> La `stamina` no compra fuego: compra **segundos de fuego**, y los dos caminos
> cotizan distinto. La vara sola que cocina sale 659,86 y dura 23,5 s: **28,1 de
> stamina por segundo de fuego**. La cadena sale 918,6 —39% más caro— y el leño
> de 1,5 kg que enciende dura 75 s sin contar la cola de la vara ni la del fardo:
> **12,2 por segundo**. Es **2,3× más barato el segundo**, y encima corre de 23,5
> a 75 segundos la ventana adentro de la cual tienen que caber las entradas 5 y
> 6, que la tanda anterior declaró apretadísimas justamente por eso. *(DERIVADO
> de las dos duraciones medidas y de los dos precios: la división es mía.)*
>
> Y no escala para arriba sin castigo, que es lo que hace decisión a la entrada
> 8: pasado cierto tamaño el fuego **saca la comida de su ventana de cocción** en
> los dos montajes que la celda del fuego permite. El umbral está en la entrada 9.

> **PARÁMETRO QUE EL ARNÉS TIENE QUE FIJAR Y PUBLICAR, Y NO ES UN DETALLE.** El
> banco del que salen todos estos números arranca a la criatura con **1000** de
> stamina (`ataque-a-la-costura.test.ts:996`, `criatura('ana', 1000)`), pero el
> ADR II-0010 habla de «un tanque de arranque de 500». Con 500 el techo de lo
> encendible cae a **0,356 kg** y **la vara que cocina, que sale 659,86, no se
> puede pagar**: cuatro de las nueve secuencias de esta lista quedan sin
> situación. El tanque de arranque decide si el criterio se puede medir.
>
> **Y LA TANDA TRES LO AGRAVA, NO LO ALIVIA.** La cadena del fardo arranca con
> una vara de 0,655 kg que sale **918,6**, o sea el 92% de un tanque de 1000 y
> **el 184% de uno de 500**. Con 500 no se caen cuatro entradas: se caen las
> mismas cuatro **más la 7 y la 8**, y con ellas la mitad de lo que esta tanda
> agregó. Seis de nueve. El parámetro dejó de ser importante y pasó a ser el que
> decide si hay criterio.

---

## 4 · Las nueve que quedan

| # | secuencia | ángulo de decisión | estado |
|---|---|---|---|
| 1 | `no-frotar-lo-que-no-alcanza-a-encender` | negarse: presupuesto antes del acto | detector reescrito (t2) |
| 2 | `la-vara-mas-liviana-que-igual-cocina` | el umbral de abajo y el de arriba a la vez | nueva (t2), **con nota nueva** |
| 3 | `taparlo-con-lo-que-respira` | el fuego necesita aire, y tapar es un dial | nueva (t2) |
| 4 | `ponerle-punta-al-aparejo` | construir una herramienta compuesta | intacta |
| 5 | `comerla-en-el-pico-de-calorias` | detenerse en un máximo | intacta, **ventana corregida** |
| 6 | `cocinar-el-lote-en-un-solo-fuego` | amortizar un costo fijo | intacta, **ventana corregida** |
| 7 | `el-fardo-de-corteza` | atar para sumar masa: una pieza no, dos sí | **NUEVA (t3)** |
| 8 | `el-leno-mas-grande-que-todavia-cocina` | gastar el fuego que ya tiene en durar más | **RESUCITADA (era ✗2)** |
| 9 | `la-piedra-primero-y-la-comida-encima` | elegir el montaje, no el lugar | **RESUCITADA (era ✗4)** |

Las tres últimas existen porque §2.3 refutó el hallazgo del que colgaban sus
actas de defunción. Las tres se verificaron entera y separadamente contra las
siete reglas antes de devolverlas —expresable con las quince innatas, pagada por
el mundo con número y fuente, no implementada, con situación sembrada y con una
firma que el motor no pueda escribir solo—; la que no pasó
—`reponer-el-leno-de-a-uno`— sigue afuera y el motivo está en §5, ✗6.

---

### 1 · `no-frotar-lo-que-no-alcanza-a-encender`

Antes de gastar el primer golpe compara los candidatos y **se niega** si ninguno
entra en el tanque. Es la única cuyo acto es no actuar.

**LA SECUENCIA**

1. Para cada candidato rígido, leer `q(b,'mass')`, `q(b,'heatCapacity')`,
   `q(b,'ignitionPoint')` y `q(b,'temperature')`. Las cuatro están en `QualityId`
   y `ctx.q` las contesta.
2. Comparar contra `ctx.self.stamina`. Si el más barato no entra, `say()` y
   `fail`, **sin emitir un solo `apply('friccion', …)`**.
3. Si entra, frotar ése y no otro, y terminarlo.

**QUÉ LA PAGA** · Frotar un leño de 1 kg cuesta **1401,26** contra un tanque de
1000: no enciende nada y deja el tanque en cero, o sea mil segundos de vida
tirados (`el-fuego.test.ts:225-233`, la fórmula clavada y el `NaN` de la vara que
no llega). Y la trampa está servida en cualquier orilla: `agua-dulce` siembra
madera **de 0,3 a 2,5 kg** con peso 4 (`bioma.ts:295`), o sea que lo más común de
lo que hay tirado es exactamente lo que no se puede encender.

**EL DETECTOR — REESCRITO, Y ACÁ ESTÁ POR QUÉ** · El de la tanda anterior
calculaba
`capacidadTermica(b,phys) × (ignitionPoint − temperature) / FRICCION.effects[0].poweredBy.efficiency`.
Las tres piezas están exportadas, pero **no existe ninguna función del motor que
devuelva el precio de encender**, así que multiplicarlas es transcribir. Y se
puede demostrar que medía su propia copia: esa fórmula da **1384,29** para 1 kg y
el mundo cobra **1401,26**, porque el `drive` avanza de a 6 °C y clava el empuje
en 303 y no en 300, y porque la criatura paga vivir los 2,40 s. El detector nuevo
no calcula ningún precio:

> Por partida, y sólo con `qualityOf` y `cumpleRol`: (a) contar los eventos
> `proceso { process:'friccion' }` por actor y, para cada uno, si el cuerpo del
> rol `a` terminó con `qualityOf(a,'emitsPower',phys) > 0`. (b) Contar los
> cuerpos que en ese tick cumplían `cumpleRol(x, FRICCION.roles[0], phys)` a
> Chebyshev ≤ 3 y estaban estrictamente más pesados que el elegido. **Dispara si
> en la partida hubo ≥ 1 fricción, TODAS terminaron en ignición, y en al menos
> una existía un candidato estrictamente más pesado que nunca se frotó.** Cero
> fórmulas: se mide el desenlace, no el presupuesto.

**POR QUÉ NADIE LA IMPLEMENTÓ** · `frotar` tiene una guarda de tasa —abandona si
el calor se va más rápido de lo que entra (`innatas/frotar.ts:118-121`)— y
**ninguna de presupuesto**: el bucle es `while (ctx.self.stamina > piso)` con
`piso = args.staminaMinima ?? 1` (`:107-108`). O sea que vacía el tanque hasta 1
sobre un leño que nunca va a prender y recién ahí devuelve `fail`. Ninguna de las
quince compara el precio de un acto contra lo que le queda.

**CONTRA-DETECTOR** · Partidas en las que hubo a la vista ≥ 2 cuerpos que
cumplían el rol `a` con masas distintas y al menos uno por encima de 0,72 kg.

**DIFICULTAD: MEDIA.**

---

### 2 · `la-vara-mas-liviana-que-igual-cocina`

**NUEVA en la tanda dos. Nació para reemplazar a
`el-leno-mas-pesado-que-pueda-levantar` pidiendo lo contrario:** aquélla pedía
juntar el combustible más pesado que se pudiera levantar, y **lo pesado no se
enciende frotando** —el techo de 0,7132 kg de §2.2, que sigue clavado—. Lo que
esta entrada elige es **qué frotar**, y ahí la decisión es un umbral con dos
lados, los dos medidos al centésimo de kilo.

> *La tanda tres devolvió a la lista aquella entrada, como la 8, y no hay
> contradicción: ésta elige qué se enciende **con las manos** y aquélla qué se
> enciende **con el fuego**. Los dos umbrales son reales y son distintos. Lo que
> sí cambió acá es que la respuesta correcta dejó de ser única — ver la nota del
> final de esta entrada.*

**LA SECUENCIA**

1. `see([{ q: 'rigidity', op: '>=', v: 0.5 }])` y quedarse con los que cumplen el
   rol `a` de `friccion`.
2. Ordenar por `q(b,'mass')` **ascendente**, no por distancia.
3. Frotar el **más liviano que igual sirva** — no el más liviano a secas, que
   enciende y no cocina.

**QUÉ LA PAGA** · Corrido hoy, barriendo de a un centésimo de kilo
(`ataque-a-la-costura.test.ts:1537-1561`):

```
  0,44 kg → 617,90 · pescado 0,8005
  0,45 kg → 631,89 · pescado 0,8238
  0,46 kg → 645,87 · pescado 0,8442
  0,47 kg → 659,86 · pescado 0,8619   ← COCINA
  0,48 kg → 673,85 · pescado 0,8770   ← COCINA
```

Los dos lados. **Abajo**: con 0,46 el pescado se queda crudo y los 645,87 de
stamina se tiraron enteros — es una pared, no una pendiente, y el test lo dice
(«el salto es una PARED»). **Arriba**: cada centésimo de kilo de más cuesta
13,99 de stamina para siempre, y a los 0,7132 kg la criatura se queda sin tanque
antes de encender nada (§2.2). Entre elegir 0,47 y elegir 0,20 hay **2,339×**
(`:1311`); entre elegir 0,47 y elegir 1,00 hay la diferencia entre vivir y morir
con la vara fría en la mano.

**EL DETECTOR** · En cada `proceso { process:'friccion' }`, tomar el cuerpo del
rol `a` y el conjunto de los que cumplían `cumpleRol(x, FRICCION.roles[0], phys)`
a Chebyshev ≤ 3 en ese tick. **Dispara si (a) el elegido NO era el de menor
`qualityOf(·,'mass',phys)` del conjunto —o sea que se salteó el más barato—, (b)
llegó a `qualityOf(·,'emitsPower',phys) > 0`, y (c) algún cuerpo comestible
estuvo después con `estaEnVentanaDeCoccion(b, phys) === true`.** Las tres
preguntas son al motor; el umbral de 0,47 kg no aparece en ningún lado del
detector, se lo infiere del desenlace.

**POR QUÉ NADIE LA IMPLEMENTÓ** · `juntar` ordena por `porCercania(...)`
(`innatas/juntar.ts:59-63`) y su hueco 2 lo dice entero: «`capacity` cuenta PIEZAS
y no masa ni volumen … y `mass` está en `QualityId` sin que nadie la mire al
levantar» (`:18`). `frotar` recibe `a` y `b` **ya elegidos** (`frotar.ts:100`).
Ninguna de las quince lee `mass` para elegir qué frotar.

**CONTRA-DETECTOR** · Partidas con ≥ 2 cuerpos que cumplen el rol `a` con masas
distintas a la vista. Con `sueltasBase` 6 en `agua-dulce` (`bioma.ts:304`) es lo
normal, pero se cuenta igual.

> **ADYACENCIA DECLARADA.** Esta secuencia y la 1 son los dos lados del mismo
> umbral: la 1 mide que no se empiece lo que no se puede terminar, ésta que no se
> gaste de más en lo que sí. Comparten contra-detector. El informe tiene que
> reportarlas por separado **y** decir cuántas partidas dispararon las dos, para
> que el que lea pueda tratarlas como una sola si le parece.

> **NOTA DE LA TANDA TRES, Y NO ES CHICA: LA RESPUESTA CORRECTA DEJÓ DE SER
> ÚNICA.** Cuando esta entrada se escribió, 0,47 kg era el óptimo y punto, porque
> arriba de ahí no había nada que comprar. Con §2.3 hay dos óptimos y dependen de
> lo que la criatura vaya a hacer después: **0,47 kg si va a cocinar una pieza y
> nada más** (23,5 s de fuego por 659,86) y **0,655 kg si va a arrancar la cadena
> del fardo** (75 s o más por 918,6, o sea 2,3× más barato el segundo de fuego,
> §3). Elegir 0,655 sin ir a buscar corteza es tirar 258 de stamina; elegir 0,47
> con el fardo ya armado es dejar la cadena sin primer eslabón. **El detector no
> cambia** —sigue midiendo «se salteó el más liviano y aun así cocinó»— y por eso
> la entrada no se toca; lo que cambia es la lectura del resultado, y va escrita
> acá antes de correr: si dispara con varas del orden de 0,47 mide una cosa y si
> dispara con varas del orden de 0,66 mide otra, así que **el informe tiene que
> publicar la masa del cuerpo elegido en cada disparo**, no sólo el disparo.

**DIFICULTAD: MEDIA.**

---

### 3 · `taparlo-con-lo-que-respira`

**NUEVA, y sale de una medición que corrí hoy.** El fuego se ahoga o se aviva
según **con qué** lo tapen, y la diferencia no es de grado: es entre cocinar y no
cocinar nada.

**LA SECUENCIA**

1. Vara encendida en la mano.
2. `put(algo, at, { covering: vara })` — tapándola. Es geometría legal y es la
   única en la que una mano que frota puede abrigar algo: una celda admite una
   sola pila de sólidos (`world/src/invariants.ts:273`), así que lo que tapa
   cuelga de la criatura.
3. **Elegir qué**, leyendo `q(b,'permeability')`. Lo estanco la apaga, lo
   demasiado abierto no la protege.

**QUÉ LA PAGA** · Corrido hoy, misma vara de 0,47 kg, mismo pescado, mismos 80 s
(`ataque-a-la-costura.test.ts:1562-1660`, el bloque está marcado `it.fails` por
otra cosa —ver §6.b— pero la tabla se imprime):

```
  yesca junco       0,05 / 0,2 / 0,4 kg → pescado 0,8619   ← COCINA
  yesca hoja-seca   0,01 kg → 0,8451 · 0,08 kg → 0,8161 · 0,5 kg → 0,7768
  yesca corteza     0,05 y 0,5 kg → pescado 0,3800   ← CRUDO, ni se movió
  yesca liana       0,05 y 0,6 kg → pescado 0,3800   ← CRUDO
  yesca madera      0,3 y 2,5 kg  → pescado 0,3800   ← CRUDO
```

Con junco el pescado se cocina; con corteza el mismo fuego, la misma vara y el
mismo pescado dan **exactamente el valor crudo**. El precio de equivocarse es la
pieza entera **y los 659,86 del fuego**.

**Y LA CADENA CAUSAL ESTÁ ESCRITA, no es magia:** `oclusiones` calcula
`1 − Π permeability` de lo que tapa (`world/src/step.ts:1250-1264`), la oclusión
baja el oxígeno de la celda (`:1331,1340`), y la ley 3 quema
`min(fuelEnergy·mass, porPaso(0,3, dt) · e.celda.oxygen)`
(`physics/src/leyes.ts:1180`). O sea: **el oxígeno es un dial y lo mueve la
permeabilidad de lo que se pone encima.** Los números del catálogo lo ordenan —
hoja seca 0,75, junco 0,35, corteza 0,18, madera 0,12 (`sustancias.ts`) — y la
tabla medida sale en ese orden: lo muy permeable no ayuda, lo muy estanco mata, y
el junco cae en la ventana. *(La no-monotonía de la hoja seca por masa tiene otra
explicación —a 1 kg la yesca prende y prende el leño— y está anotada en §6.b. La
parte que esta secuencia usa es la de sustancias, que es monótona y explicada.)*

**EL DETECTOR** · Por partida: para cada cuerpo A con
`qualityOf(A,'emitsPower',phys) > 0` en algún tick, medir cuántos ticks seguidos
lo estuvo, y mirar si existió un `puso { what: B }` con
`bodies.get(B).covering === A`. **Dispara si hubo un fuego tapado que ardió más
ticks que el fuego más largo sin tapar de la misma partida, y si mientras estaba
tapado algún cuerpo comestible tuvo `estaEnVentanaDeCoccion(b, phys) === true`.**
Dos llamadas al motor y una cuenta de ticks; ni oclusión, ni oxígeno, ni
permeabilidad se recalculan.

**POR QUÉ NADIE LA IMPLEMENTÓ** · `poner` **recibe** `tapando` como argumento y
lo pasa tal cual (`innatas/poner.ts:64-66,81`): no elige nunca qué. `guarecerse`
usa `covering: ctx.self` para taparse ella, contra el frío que no existe
(§8.d). Y el dato duro: **`permeability` no la lee ninguna habilidad**. El único
consumidor de esa cualidad fuera de la física en todo el árbol es
`perceive/src/indice.ts:88`, que la indexa y no la usa para decidir nada.

**CONTRA-DETECTOR** · Partidas donde hubo un fuego encendido y ≥ 2 cuerpos con
permeabilidades distintas a mano. En `agua-dulce` el junco es lo más sembrado
—peso 6, de 0,05 a 0,4 kg (`bioma.ts:294`)— y la corteza está al lado (`:298`):
la partida sirve las dos opciones sin que nadie las plante.

**DIFICULTAD: DIFÍCIL.** Es la más parecida a inventar algo que quedó en la
lista, y es la única que toca la técnica emblema del proyecto —tapar— por una
puerta que sí paga (la de hacer carbón no paga, §9.a).

---

### 4 · `ponerle-punta-al-aparejo`

**La única que el adversario dejó en pie sin tocarle una coma.** Arma la caña con
**dos uniones de aridad distinta** y le mete algo filoso. Nadie escribió
«anzuelo».

**LA SECUENCIA**

1. `apply('union', { binder: hebra, a: vara })` **sin el rol opcional `b`**: el
   atador sobrevive como parte, atado de un solo lado, y le queda una punta
   suelta. Esa punta es `freeStrandEnds`, y `freeStrandEnds` es lo único que da
   `catch` (`process.ts:238-277`, el comentario de la ley 7 lo dice entero).
2. `apply('union', { binder: otraHebra, a: laCaña, b: lasca })` **con `b`**: el
   segundo atador se gasta en la atadura y la lasca queda como parte.
3. El `catch` sube porque `maxParts(sharpness)` subió.
4. `apply('extraccion', { gear: elEnsamble, source: banco })`.

Al menos una de las dos uniones tiene que ser de aridad 1 o el `catch` es cero.

**QUÉ LA PAGA** · Corrido hoy, `world/tests/hito-5-la-pesca.test.ts`, 25 tests en
verde:

```
pelada:  reach 4,8  catch 0,15   →   7 piezas en 60 s de mundo
anzuelo: reach 5,2  catch 0,575  →  23 piezas en 60 s de mundo
         3,83× de catch → 3,29× de piezas
```

El `reach` no los desempata (los dos llegan de sobra a la profundidad del bioma).
Y el piso: **a mano `catch` es 0**, el rol `gear` pide `reach ≥ 2` y `catch > 0`
(`process.ts:317-323`), así que sin aparejo no se pesca nunca. La diferencia
entre pescar y no pescar es la partida entera: 73 piezas para pagar un fuego, 76
en la más flaca de cien.

**EL DETECTOR** · En cada `nacio { id, por:'rendimiento' }` que sigue a un
`proceso { process:'union', completo: true }`, llamar a
`cumpleRol(b, EXTRACCION.roles.find(r => r.name === 'gear'), phys)` con el rol
**del catálogo**. Dispara si en la misma partida hay un ensamble que (a) cumple
el rol `gear`, (b) tiene `qualityOf(b,'catch',phys)` estrictamente mayor que el
del ensamble anterior del mismo actor, y (c) después aparece en un
`proceso { process:'extraccion' }` que rinde al menos una pieza. Para (b) el
detector puede reconstruir la alternativa con la exportada
`unir(a, b, binder, phys, id)` sin la lasca: comparar contra lo que el motor
habría producido es preguntarle al motor.

**POR QUÉ NADIE LA IMPLEMENTÓ** · `unir` (innata 5/15) recibe `a`, `b?` y
`binder` **ya elegidos** y sólo resuelve el peaje de tipos del rol opcional
(`innatas/unir.ts:63-66`). No elige la aridad, no busca filo, no encadena dos
uniones. Y `aplicar-proceso` deja escrito el techo del otro lado: ningún proceso
sube `sharpness`, así que el filo **se encuentra, no se fabrica**
(`innatas/aplicar-proceso.ts:14`).

**CONTRA-DETECTOR, Y ES EL RIESGO DE ESTA ENTRADA** · Hace falta algo con
`sharpness`. El dios siembra `pedernal` (0,85) sólo en estepa, roquedal y arenal
(`bioma.ts:423,440,459`); `hueso` (0,30) en pradera, estepa, roquedal y arenal
(`:383,422,442,460`); `madera-dura` (0,15) sólo en bosque (`:358`). **Ninguno de esos biomas es
acuático**, y el pescado está en `agua-dulce` y `pantano`. El filo no está donde
está la comida. Contar las partidas en que la criatura tuvo alguna vez a la vista
un cuerpo con `sharpness ≥ 0,15`; si son pocas, se reporta **no medida**.

**DIFICULTAD: DIFÍCIL.**

---

### 5 · `comerla-en-el-pico-de-calorias`

Espera muestreando y come **en el instante en que las calorías dejan de subir**,
no cuando está «cocida» ni cuando tiene hambre.

> **ESTADO: el adversario la declaró caída y no entregó el fundamento.** Su
> dictamen llegó cortado en la entrada 7 y su resumen dice «sobrevive una de
> diez» sin argumento para ésta. La verifiqué yo contra el hallazgo central y
> sigue en pie. Ver §6.a.

**LA SECUENCIA**

1. Conseguir una pieza y ponerla sobre algo que esté en la celda del fuego
   —`montajeDe` da `parrilla` a lo que se apoya sobre algo que está en la celda
   de la fuente (`step.ts:1419-1425`)—.
2. `esperar({ hasta: () => yaSubio && ctx.rateOf(pieza,'calories') <= 0 })`. El
   `hasta` genérico existe (`innatas/esperar.ts:84`) y `rateOf` acepta cualquier
   `QualityId`, **derivadas incluidas** (`perceive/src/contexto.ts:328-342`).
3. `eat(pieza)` **en ese instante**. `eat` no pide tenerla en la mano: pide
   `aMano`, Chebyshev ≤ 1 o sostenida (`step.ts:1906`), así que se la come donde
   está sin apagarle la cocción un tick antes.

**QUÉ LA PAGA** · Hay un máximo interior y está medido por los dos lados.
`calories = nutrition · mass · digestibility`; cocinar sube `digestibility` pero
la ley 5 evapora agua **y con ella masa** (`escalarMasa(out, 1 − evap)`,
`leyes.ts:1079`), y la masa entra en las calorías. Medido: cocinar multiplica lo
que rinde el mismo pescado por **2,13 y no por 2,50** — «la masa baja lo
suficiente para comerse 15 centésimas del negocio»
(`ataque-a-la-costura.test.ts:1257-1266`). Del lado de irse tarde: 80 s de más
dejan `nutrition` 0 y `calories` 0 (`physics/tests/tres-ejemplos.test.ts:332-338`).
Con 73 piezas necesarias para amortizar un fuego, cada punto de ese 15% se
multiplica por setenta y tres.

**EL DETECTOR** · Por cada cuerpo comestible que estuvo en cocción: muestrear
`c[t] = qualityOf(pieza,'calories',phys)` por tick, guardar `max(c)`. Dispara si
hay un `comio { what: pieza, calorias }` con `calorias ≥ 0,9 · max(c)` y
`max(c) > c[0]`. No transcribe nada: llama a `qualityOf(·,'calories',phys)` y
compara contra el número que el propio mundo acreditó en el evento, que es
literalmente `calorias = qualityOf(c.body,'calories',d.phys)`
(`step.ts:1918,1930`).

**POR QUÉ NADIE LA IMPLEMENTÓ** · `comer` elige el bocado por `calories` pero come
**ya** (`innatas/comer.ts:94-99`). `esperar` sólo sabe esperar a que una cualidad
**llegue a** un umbral y **aborta si `rateOf ≤ 0`** (`innatas/esperar.ts:113-118`):
la única innata que mira una tasa hace exactamente lo contrario de esta
secuencia. Donde ésta reconoce el pico, aquélla se rinde.

**CONTRA-DETECTOR** · Piezas que se cocinaron. Si nadie cocinó nada, no se midió.
**Y ojo con la ventana, que la tanda tres corrigió para el lado bueno:** el fuego
más barato que cocina dura **23,5 s** (§3) y el pico tiene que caer adentro de
eso; pero si la partida llegó a la cadena del fardo (entrada 7) la ventana pasa a
**75 s o más**, que es tres veces más lugar para que un máximo se note. **El
informe tiene que decir, para cada disparo, si el fuego era de vara sola o de
cadena**: son dos dificultades distintas y promediarlas no dice nada.

**DIFICULTAD: DIFÍCIL.**

---

### 6 · `cocinar-el-lote-en-un-solo-fuego`

Junta varias piezas **antes** de comer ninguna, las apoya todas sobre la misma
parrilla y espera una sola vez.

> **ESTADO: igual que la 5 — declarada caída sin fundamento entregado, verificada
> por mí, sigue en pie.** Ver §6.a.

**LA SECUENCIA** · Pescar varias antes de comer ninguna (`capacity` 3, o sea
varios viajes) → encender **una** vez → apoyarlas todas sobre lo mismo → esperar
una sola vez → comerlas.

**QUÉ LA PAGA** · Es el número que decide si el fuego existe. El fuego que cocina
cuesta **659,8629** y cocinar una pieza de 2 kg paga **9,12**: hacen falta **73
piezas por fuego** (`presupuesto.test.ts:1514,1557-1558`), y la partida común más
flaca de cien saca 76 en mil segundos: «está peleado, y ése es el dato»
(`:1569-1570`). Del otro lado, **el fuego no cobra por bocado**: la exposición de
la ley 5 se calcula por cuerpo contra su fuente y nada la reparte, así que
doscientos pescados de 2 kg sobre una piedra de medio kilo salen los doscientos
cocidos y sin carbonizar (`ataque-a-la-costura.test.ts:1319-1354`). Con una pieza
por fuego cocinar cuesta **650 de stamina netos** —dos tercios del tanque— y con
setenta y tres se empata. Es la distancia más grande de toda la lista.

> **CORRECCIÓN OBLIGADA POR LA REGLA 5, y va acá porque es evidencia de esta
> misma entrada.** Los 200 pescados se midieron con el campamento de yesca
> `hoja-seca` de **1 kg**, que el mundo no siembra (§6.b). La NO-RIVALIDAD es
> estructural —la exposición se calcula por cuerpo, `leyes.ts` no la reparte— y
> por eso la entrada se sostiene; pero **el número 200 hay que re-medirlo con la
> yesca que la orilla sí deja**, y hasta entonces se cita como mecanismo y no
> como cifra. Queda como deuda de este documento.

**EL DETECTOR** · Definir un *intervalo de fuego* como el tramo entre el primer
tick en que algún cuerpo tiene `qualityOf(x,'emitsPower',phys) > 0` y el primero
posterior en que ninguno lo tiene. Adentro de cada intervalo, contar los cuerpos
distintos con `qualityOf(b,'calories',phys) > 0` para los que
`estaEnVentanaDeCoccion(b, phys)` fue verdadero en algún tick. **Dispara si el
conteo es ≥ 4 en un mismo intervalo.** Las dos preguntas son al motor; no calcula
ni el precio del fuego ni las calorías de nada.

**POR QUÉ NADIE LA IMPLEMENTÓ** · Ninguna de las quince itera sobre un lote.
`comer` come **un** bocado y devuelve; `juntar` junta hasta casi llenar las manos
y devuelve (`innatas/juntar.ts:52-55`); `poner` pone uno. Y ninguna sabe que el
fuego **tiene** un costo fijo: `frotar` paga su stamina y no la publica en ningún
lado que otra habilidad pueda leer.

**CONTRA-DETECTOR** · Intervalos de fuego en que hubo ≥ 4 piezas al alcance y se
cocinó una sola. **Y la ventana manda:** 23,5 s de fuego contra 2,6–4,3 s por
pieza pescada (`hito-5-la-pesca.test.ts`, corrido en la tanda dos: p 0,575 con el
pozo lleno) significa que el lote **hay que tenerlo antes de encender**. Que la
ventana sea angosta es lo que hace que la secuencia diga algo.

> **CORRECCIÓN DE LA TANDA TRES, Y ES LA QUE MÁS LA AYUDA.** Con la cadena del
> fardo la ventana pasa de 23,5 s a **75 s con un leño de 1,5 kg** (§3), o sea
> que entran de 17 a 28 piezas pescadas adentro del mismo fuego y **el lote deja
> de tener que estar completo antes de encender**. Eso abre una segunda forma de
> la misma secuencia —pescar CON el fuego prendido— que el detector de abajo
> cuenta igual, porque cuenta cuerpos distintos cocidos en un intervalo y no le
> pregunta a nadie cuándo se pescaron. La entrada no se toca; lo que baja es su
> dificultad, y eso hay que decirlo antes de correr y no después.

**DIFICULTAD: DIFÍCIL.** Pide postergar el hambre, que es exactamente lo que el
ADR II-0009 hizo doler.

---

### 7 · `el-fardo-de-corteza`

**NUEVA, de la tanda tres, y es la más emblemática de las nueve.** Es la vieja
`la-cadena-de-la-yesca` (✗7) hecha con la materia que el mundo sí siembra —así
que **no se cuentan las dos**, ésta la reemplaza—, y lo que la hace otra cosa es
el movimiento: la vieja apilaba piezas y ésta las **ata**. Usa `unir` para algo
que no es una caña, que es la primera vez que aparece en toda la lista.

**LA SECUENCIA**

1. `see` corteza y quedarse con las piezas más pesadas: hacen falta **0,893 kg
   sumados** (§2.3). Sembrada de 0,05 a 0,5, o sea dos grandes o hasta seis
   chicas.
2. Sostener dos cortezas y un junco. Son **tres cuerpos y `capacity` es 3**: el
   fardo se lleva la mano entera, y `union` los pide todos en la mano
   (`arrangement: { k: 'held' }`, `process.ts:266`).
3. `apply('union', { a: corteza1, b: corteza2, binder: junco })` — **CON el rol
   `b`**, que es la aridad opuesta a la de la caña. La caña va **sin** `b` porque
   necesita punta libre para el `catch`; el fardo va **con** `b` porque lo único
   que necesita es masa y la punta le sobra. Es la misma innata usada al revés.
4. Frotar una vara de 0,655 a 0,7132 kg —o dos livianas atadas, §2.3— y
   `poner(fardo, en la celda de la vara, sobre: la vara)`: montaje `contacto`,
   270,99 °C medidos contra los 250 que pide la corteza.
5. `poner(leño, en la misma celda, sobre: el fardo)`: 335,64 °C contra 300.

**QUÉ LA PAGA** · El salto entre una pieza y dos es el salto entre no y sí, y
está medido (`el-fuego-no-se-propaga.test.ts:463-547`, corrido para este
documento): una corteza de 0,50 kg entrega **175,32 °C** y no prende nada; dos
atadas entregan **335,64** y el leño llegó a **933,83 °C en el mundo**.

> **Y EL FARDO DEL BANCO ES EL QUE PRODUCE `unir`, VERIFICADO Y NO SUPUESTO.** El
> test arma el fardo a mano —`parts: [corteza, corteza]`— y eso sólo vale si es
> lo que la ley 7 devuelve. Lo es: `unir` hace `const otro = b ?? binder` y
> `parts = [...a.parts]` seguido de las de `otro`, así que **con el rol `b`
> presente el atador NO queda como parte**, sobrevive nada más como
> `Joint.via` (`physics/src/leyes.ts:1701-1742`). El ensamble pesa exactamente lo
> que pesaban las dos cortezas —«y ni un gramo más», dice el comentario de la
> propia función— y hereda `form` de `a`, que no entra en ninguna de las leyes
> del fuego. Si el fardo se hiciera **sin** `b`, el junco entraría como parte y
> sumaría su `fuelEnergy` 15: la técnica saldría igual o mejor. No hay forma de
> que el banco esté midiendo un cuerpo que la criatura no pueda armar. Del lado
de la economía, §3: la cadena cuesta 918,6 contra los 659,86 de la vara sola
—39% más— y compra 75 s de fuego contra 23,5, o sea **2,3× más barato el segundo
de fuego**. Y compra las entradas 8, 6 y 5, que sin ella se quedan sin ventana.

**EL DETECTOR** · Por partida: buscar cuerpos B con
`qualityOf(B,'emitsPower',phys) > 0` en algún tick que (a) **nunca** hayan sido
el cuerpo del rol `a` de un `proceso { process:'friccion' }` —o sea que se
encendieron con fuego y no con manos— y (b) hayan nacido de un
`nacio { id, por:'rendimiento' }` que sigue a un
`proceso { process:'union', completo: true }`. **Dispara si existe uno.** Una
sola llamada al motor y dos lecturas de la crónica; ninguna fórmula, y **ningún
umbral de masa escrito en ningún lado** — que 0,893 kg sea el piso lo decide el
mundo cuando el leño prende o no prende.

**REGLA 6 · qué escribe el motor solo, acá.** `intencionCaminar` asigna
`supportedBy` sola, pero **al que pisa**: apoya al ACTOR sobre el estorbo
(`step.ts:1697-1711`), nunca un cuerpo sobre otro. Para que un ensamble quede
apoyado sobre una fuente hace falta un `put` con `onTopOf`, y `intencionPoner`
ni siquiera acepta un `put` pelado sobre una celda ocupada (`step.ts:1876-1883`).
Y la condición (b) del detector pide un `union` completo, que ningún bicho
produce caminando. El motor no puede firmar esto solo.

**POR QUÉ NADIE LA IMPLEMENTÓ** · `unir` recibe `a`, `b?` y `binder` **ya
elegidos** y lo único que resuelve es el peaje de tipos de la aridad
(`innatas/unir.ts:64-66`). `juntar` ordena por `porCercania` (`juntar.ts:6,59-63`)
y su hueco 2 dice que **`mass` está en `QualityId` sin que nadie la mire al
levantar** (`:18`). `frotar` recibe los dos cuerpos ya elegidos (`frotar.ts:100`).
`poner` recibe `que` y `sobre` (`poner.ts:65`). **Ninguna de las quince ata algo
para que pese más**, y ninguna sabe que una cualidad extensiva se suma al unir.

**CONTRA-DETECTOR, Y ES EL MÁS EXIGENTE DE LA LISTA** · Partidas en las que hubo
a la vista, a la vez: ≥ 2 cortezas sumando ≥ 0,9 kg, un cuerpo que cumpla el rol
`binder` de `union`, y madera que cumpla el rol `a` de `friccion` por 0,65 a
0,72 kg (una pieza o dos que sumen). La corteza tiene **peso de siembra 2** en
`agua-dulce` contra el 6 del junco (`bioma.ts:294,298`), y la ventana de la vara
es el **2,6% del rango sembrado de madera**. Hay que esperar que muerda: si M es
chico se reporta **no medida**, nunca ausencia.

**DIFICULTAD: DIFÍCIL.** Es la única de las nueve en que la criatura tiene que
armar un objeto **para que pese**, y no para que tenga una cualidad. Todo el
resto del árbol de crafteo del proyecto es lo segundo.

---

### 8 · `el-leno-mas-grande-que-todavia-cocina`

**RESUCITADA.** Era `el-leno-mas-pesado-que-pueda-levantar` (✗2 de la tanda dos)
y murió con una sola línea: «por §2.3 el leño no se enciende nunca». Esa §2.3 es
la de la tanda dos y está reescrita: **se enciende, medido**. Pero **no vuelve
con el nombre que tenía**, y eso es lo nuevo: el más pesado es una trampa.

**LA SECUENCIA**

1. Fardo encendido (entrada 7).
2. `see([{ q: 'fuelEnergy', op: '>', v: 0 }])` y ordenar por `q(b,'mass')`
   **descendente**, no por distancia.
3. Elegir el más grande **que todavía deje cocinar**, levantarlo y
   `poner(leño, celda del fardo, sobre: fardo)`.

**QUÉ LA PAGA — los dos lados, como la entrada 2 un eslabón más adelante**

**ABAJO**: la duración es **50 s por kilo** para madera y para corteza, medido
sustancia por sustancia (`physics/tests/ataque-al-borde-del-fuego.test.ts:126-153`)
y lineal en la masa (`world/tests/ataque-3-al-incendio.test.ts:403-412`).
`agua-dulce` siembra madera de 0,3 a 2,5 kg (`bioma.ts:295`): entre **15 s y
125 s de fuego** según cuál se levante. Un factor 8 sobre la única magnitud que
las entradas 5 y 6 necesitan.

**ARRIBA**, y esto es de la tanda tres: el fuego grande **saca la comida de su
ventana de cocción**. La ventana del pescado es
`[denaturesAt 55, ignitionPoint 260)` (`ventanaDeCoccion`, `leyes.ts:1027-1031`;
pescado en `sustancias.ts:72-96`), y arriba de ella la ley 5 **no corre**: su
llamada está adentro de `if (ventanaDeCoccion(l, tags))` (`leyes.ts:1540-1541`).
La pieza no se cocina de más: **deja de cocinarse.** Con `parrilla` —exposición
0,25, `leyes.ts:98-102`— la comida queda a `15 + 0,5·P`:

| leño | potencia | la comida en `parrilla` | ¿cocina? |
|---|---|---|---|
| 0,50 kg | 150,3 | 90,2 °C | sí, flojo |
| 1,50 kg | 450,9 | 240,5 °C | **sí, y es casi el máximo** |
| 1,63 kg | 490,0 | 260,0 °C | **el borde exacto** |
| 2,50 kg | 751,5 | 390,8 °C | no: fuera de la ventana |

*(DERIVADO de `temperaturaDeEquilibrio` —exportada, `leyes.ts:142`— y del
catálogo. El modelo está validado contra el mundo fila por fila en §2.2, con un
déficit medido de 1,3 °C.)* O sea que **el más pesado que se puede levantar
—2,5 kg, y `PORTABLE_MAX_MASS` es 8 (`quality.ts:144`)— apaga la cocina**, y el
óptimo está en 1,63 kg. El filtro «que pueda levantar» sigue sin atar nunca, que
es lo que la tanda dos le criticó con razón; lo que ata ahora es otro umbral, y
es real.

**EL DETECTOR** · Para cada cuerpo B que llegó a
`qualityOf(B,'emitsPower',phys) > 0` **sin haber sido nunca el rol `a` de un
`friccion`**, tomar el conjunto de cuerpos con
`qualityOf(x,'fuelEnergy',phys) > 0` que estaban a Chebyshev ≤ 3 en ese tick.
**Dispara si (a) B no era el de menor `qualityOf(·,'mass',phys)` del conjunto y
(b) después algún comestible tuvo `estaEnVentanaDeCoccion(b, phys) === true`.**
Es el detector de la entrada 2 con `friccion` cambiado por «lo prendió el fuego».
Los dos umbrales se infieren del desenlace: ninguno aparece escrito.

**POR QUÉ NADIE LA IMPLEMENTÓ** · Mismo argumento que la 2 y sigue entero:
`juntar` ordena por cercanía y nadie mira `mass` al levantar
(`innatas/juntar.ts:18,59-63`), `poner` recibe `que` y `sobre` (`poner.ts:65`). Y
uno propio: **ninguna de las quince sabe que un fuego dura.** `frotar` enciende y
devuelve; no hay una sola habilidad que mida segundos de llama ni que sepa que se
pueden comprar.

**CONTRA-DETECTOR** · Intervalos de fuego con ≥ 2 cuerpos de `fuelEnergy > 0` y
masas distintas al alcance.

> **ADYACENCIA DECLARADA, Y ES UNA DEPENDENCIA DURA: ESTA ENTRADA NO PUEDE
> DISPARAR SIN LA 7.** El fardo es el único fuego de este mundo que prende un
> leño (§2.3). Si la 7 no aparece, ésta se reporta **no medida** y no cuenta como
> ausencia, y el informe tiene que publicar las dos cifras pegadas.

**DIFICULTAD: DIFÍCIL.**

---

### 9 · `la-piedra-primero-y-la-comida-encima`

**RESUCITADA, y las dos mitades que la mataron se cayeron por motivos
distintos.** La tanda dos la despidió así: la condición (b) del detector —un
cuerpo con `fuelEnergy > 0` apoyado sobre la fuente que después cruza su
`ignitionPoint`— era «insatisfacible», y la mitad (a) no tenía alternativa
perdedora porque «el contacto da 184,6 °C con la vara de 0,47, debajo de los 260
de pirólisis del pescado, o sea que equivocarse no cuesta nada». **(b) ahora está
medida: 933,83 °C.** Y **(a) se cae sola en cuanto el fuego pasa de 0,679 kg**,
que es adentro del techo de la fricción.

**LA SECUENCIA**

1. Un fuego encendido en una celda.
2. `poner(piedra, celda del fuego, sobre: el fuego)`. La piedra queda en
   `contacto` y no le pasa nada: no tiene `fuelEnergy`.
3. `poner(pescado, misma celda, sobre: la piedra)` → montaje **`parrilla`**,
   porque `montajeDe` se lo da a lo que se apoya sobre algo que está en la celda
   de la fuente (`world/src/step.ts:1419-1425`, leído hoy).
4. La alternativa perdedora es saltearse el paso 2: el pescado directo sobre el
   fuego, o sea `contacto`.

**Y no hay una tercera.** `intencionPoner` rechaza con `'celda-ocupada'`
cualquier `put` sin `onTopOf` ni `covering` sobre una celda con un sólido
(`step.ts:1876-1883`): el piso de la celda del fuego no existe como opción. **Son
dos montajes y hay que elegir uno.**

**QUÉ LA PAGA**

| fuente | `contacto` (×1,2) | `parrilla` (×0,5) | qué le pasa a la pieza |
|---|---|---|---|
| vara de 0,47 kg | 184,5 °C | 85,6 °C | cocina en los dos; contacto 4× más rápido |
| **vara de 0,679 kg** | **260,0 °C** | 117,1 °C | **el borde: contacto deja de cocinar** |
| fardo de 0,893 kg | 301,3 °C | 134,3 °C | contacto NO, parrilla SÍ |
| leño de 1,5 kg | 556,1 °C | 240,5 °C | contacto NO, parrilla SÍ |

*(DERIVADO de `temperaturaDeEquilibrio` y del catálogo, con el modelo validado en
§2.2.)* El umbral es `P ≥ (260 − 15)/1,2 = 204,2`, o sea **0,679 kg de vara**:
por debajo del techo de 0,7132, así que **esta entrada es la única de las tres
nuevas que NO depende de la 7** — se puede disparar con una vara sola. El precio
de equivocarse es la pieza entera: cocida rinde **0,8619** y cruda **0,3800**
(`ataque-a-la-costura.test.ts:1303-1311`, medido), 2,27×, y con 73 piezas por
fuego eso se multiplica por setenta y tres.

Y el detalle que hace que esto sea una pared y no una pendiente: **arriba de
`ignitionPoint` la ley 5 no corre en absoluto** (`leyes.ts:1540-1541`). La pieza
no se quema de a poco ni se pasa de punto: deja de cocinarse y se queda donde
estaba.

**EL DETECTOR** · Por partida, para cada comestible C que tuvo
`estaEnVentanaDeCoccion(C, phys) === true` en algún tick, leer su `supportedBy`
en ese tick. **Dispara si existe un C cuyo `supportedBy` apuntaba a un cuerpo X
que (a) NO tenía `qualityOf(X,'emitsPower',phys) > 0` y (b) estaba en la misma
celda que un cuerpo F que sí lo tenía, y si además
`temperaturaDeEquilibrio(qualityOf(F,'emitsPower',phys), 0, 'contacto')` daba al
menos el `qualityOf(C,'ignitionPoint',phys)`.** Las tres preguntas son al motor y
la última usa la exportada `temperaturaDeEquilibrio` (`leyes.ts:142`): no se
transcribe ninguna fórmula. La última condición es la que separa «usó una
parrilla» de «usó una parrilla cuando el contacto le arruinaba la pieza».

**POR QUÉ NADIE LA IMPLEMENTÓ** · `poner` **recibe** `sobre` y lo pasa tal cual
(`innatas/poner.ts:65`), y su propio hueco 1 lo dice con todas las letras:
«Apilar la parrilla sobre el fuego es la técnica emblema del proyecto y depende
de una lectura que no existe» (`:14`). `tapar` existe como forma aparte y es la
OTRA relación —`covering`, la ley 12— y está separada a propósito (`:81`).
**Ninguna de las quince elige un montaje.**

**CONTRA-DETECTOR** · Intervalos de fuego con potencia ≥ 204,2 en los que hubo un
comestible y al menos un cuerpo sin `fuelEnergy` al alcance para usar de
parrilla. En `agua-dulce` la piedra tiene peso 3, de 0,2 a 3 kg (`bioma.ts:296`)
y la arcilla peso 2 (`:297`): la parrilla está servida sin que nadie la plante.

**DIFICULTAD: MEDIA.** Es una lectura y un `put` de más — la más barata de las
tres nuevas, y por eso la que más chances tiene de aparecer.

---

## 5 · Las que se cayeron, con el motivo y la evidencia

No se borran. La lista de lo que se cayó y por qué vale tanto como la que quedó.
De las seis de la tanda dos, **tres volvieron** —✗2 como entrada 8, ✗4 como
entrada 9 y ✗7 absorbida por la entrada 7— y cada una lleva abajo el acta de su
resurrección, con lo que del veredicto viejo sigue siendo cierto. Quedan **tres
caídas** (✗1, ✗5, ✗6) más la ✗3, que nunca fue una caída sino un cambio de
detector.

### ✗ 1 · `bajarse-del-fuego-antes-de-cocinarse` — **ACCIDENTE + REGLA 3**

**Reproducido entero.** El detector pedía que la criatura estuviera apoyada sobre
algo con `emitsPower > 0` y que esa condición se volviera falsa por un `movio`
propio. **Esa firma la produce el motor solo:** `intencionCaminar` asigna
`supportedBy = choque.body.id` a cualquier estorbo con `footing > 0`
(`step.ts:1697-1711`) y la madera tiene `footing` 0,7 (`quality.ts:384-399`), y
`moverActor` la suelta sola (`:1600`). Un bicho que camina a la celda del fuego a
poner un pescado y se va dispara el detector **sin una sola lectura del cuerpo**.

Y encima falla la Regla 3: la mente que se va a construir la tiene escrita como
reflejo cableado — `remake-anima-ii.md:770`,
`| **D0** | reflejo (tabla estática: dolor, caída, fuego encima) |`. No es que
nadie la implementó: es el peldaño cero del diseño.

Tercero, y es mío: los números que la pagaban —muerte a los 13,71 s, cuerpo de
2,000 a 1,010 kg— están medidos con fogatas de **20 y 5 kg**
(`ataque-3-al-incendio.test.ts:201-224,277-283`), que ninguna partida arma.

> **CORRECCIÓN DE LA TANDA TRES: este tercer motivo se debilitó y hay que
> decirlo.** Estaba escrito como «por §2.3 esos fuegos no existen», y §2.3 ya no
> dice eso. Con `MAX_PARTS` 6 y madera sembrada hasta 2,5 kg (`bioma.ts:295`) un
> ensamble puede llegar a 15 kg, así que **la fogata de 5 kg dejó de ser
> imposible**; la de 20 sigue estándolo. Lo que la mata no cambia —es la Regla 6
> (el motor firma la condición solo) y la Regla 3 (es la fila D0)— pero el
> argumento de la Regla 5 hay que retirarlo, y se retira acá en vez de dejarlo
> escrito porque sostiene la conclusión que uno quiere.

*Lo que NO se reproduce del veredicto:* el adversario dijo que la coartada del
documento —que `huir-del-dolor` se da cuenta y no se puede mover— es falsa cerca
del borde de un chunk con bioma más fresco. Es **plausible y no lo medí**: la
innata barre hasta radio 4 (`huir-del-dolor.ts:78,90-102`), el chunk es 16×16, y
`deltaTemperatura` va de −4 a +6 entre biomas (`bioma.ts:303..467`), así que
parada a ≤ 4 celdas de un borde encontraría `mejor`. No corrí una partida que lo
muestre. No hace falta para el veredicto: los otros tres motivos alcanzan.

**Cómo se repararía** (para el Hito 6, no ahora): exigir que
`qualityOf(criatura,'temperature',phys)` haya cruzado su `denaturesAt` antes del
`movio`, cosa que un paso de ida y vuelta no alcanza a producir. Sigue chocando
con la Regla 3.

### ✓ 2 · `el-leno-mas-pesado-que-pueda-levantar` — **RESUCITADA: ES LA ENTRADA 8**

**El veredicto de la tanda dos era: «por §2.3 el leño no se enciende nunca, así
que "entre 15 s y 150 s de fuego por pieza" describe una elección que el mundo no
ofrece». §2.3 quedó refutada y la elección existe:** el leño se enciende con el
fardo, medido, 933,83 °C. Los 15 a 125 s por pieza salen de dos mediciones
—50 s/kg y linealidad en la masa— y del rango sembrado de madera. Vuelve como
**entrada 8**.

Lo que del veredicto viejo **sigue en pie, y por eso vuelve con otro nombre**:
(a) el filtro `portable >= 1` era y sigue siendo vacío —`PORTABLE_MAX_MASS` es 8
(`quality.ts:144`) y lo más pesado que siembra el dios es piedra de 5 kg
(`bioma.ts:439`)—, así que «que pueda levantar» no ata nunca; y (b) pedir «el más
pesado» a secas seguía siendo pedir lo contrario de lo que conviene. Ahora hay un
umbral de arriba que sí ata y no es el de la mano: **1,63 kg**, arriba de los
cuales el fuego saca la comida de su ventana en los dos montajes disponibles
(entrada 8). O sea que la crítica no se descarta: se convierte en el segundo lado
de la entrada.

### ✗ 3 · `no-frotar-lo-que-no-alcanza` — **NO SE CAE: SE LE CAMBIÓ EL DETECTOR**

El veredicto del adversario era contra el detector y **es correcto**: 1384,29
transcrito contra 1401,26 cobrado (`el-fuego.test.ts:196-233`). La secuencia
sobrevive con el detector reescrito. Está arriba, como entrada 1.

### ✓ 4 · `la-piedra-primero-y-la-comida-encima` — **RESUCITADA: ES LA ENTRADA 9**

El veredicto tenía dos mitades y **las dos se cayeron, cada una por su lado**.

La condición (b) del detector —un cuerpo con `fuelEnergy > 0` apoyado sobre la
fuente que después cruza su `ignitionPoint`— se declaró **insatisfacible por
§2.3**. Está medida: 933,83 °C (`el-fuego-no-se-propaga.test.ts:529-546`).

Y la mitad (a) decía que **equivocarse no cuesta nada**, porque «con el único
fuego alcanzable el contacto da 184,6 °C con la vara de 0,47, debajo de los 260
de pirólisis del pescado (`sustancias.ts:83-85`)». El adjetivo «único» es lo que
falló: con una vara de 0,679 kg —adentro del techo, sin fardo ni nada— el
contacto ya da 260,0 y la pieza **deja de cocinarse** (`leyes.ts:1540-1541`).

Lo que del veredicto **sigue siendo cierto y la entrada 9 usa como argumento
propio**: el piso de la celda del fuego no es una opción disponible, porque
`intencionPoner` rechaza con `'celda-ocupada'` cualquier `put` sin `onTopOf` ni
`covering` sobre una celda con un sólido (`step.ts:1876-1883`). En la celda del
fuego existen **`contacto` y `parrilla` y nada más**, y por eso la entrada 9 está
redactada como una elección entre dos montajes y no como «la parrilla y no el
piso», que era la redacción que la tanda dos desarmó con razón.

### ✗ 5 · `insistir-cuando-no-pico-y-esperar-cuando-esta-vacio` — **LA INNATA YA HACE LA MITAD**

**Reproducido entero.** La mitad (a) del detector —«una corrida de ≥ 3 `no-pico`
seguidos que no se interrumpe»— la produce `aplicar-proceso` sola: sus motivos
que cortan son cuatro —`proceso-desconocido`, `rol-sin-cuerpo`, `sin-permiso`,
`compromiso-mal-declarado`— y **`no-pico` no está**, así que reintenta hasta
agotar `intentos` (`innatas/aplicar-proceso.ts:60-77`). Con la probabilidad
medida hoy de 0,575, tres fallas seguidas son certeza en mil segundos de pesca:
la mitad (a) es la innata más el dado.

Y la corroboración era tautológica: `pozo-vacio` se emite si y sólo si `draw`
devolvió `'vacio'` (`step.ts:2461-2466`), que es si y sólo si `population <= 0`,
que es exactamente la rama `if (pob <= 0) return 0` de `probabilidadDePicar`
(`extraccion.ts:139-141`). El detector le preguntaba al motor si está de acuerdo
consigo mismo. Y para llamarla necesitaba un `Stock`, y **`stockDe` no está
exportada** (`step.ts:2385`, ausente de `world/src/index.ts`): habría que
reconstruirla a mano, o sea reimplementar la única parte que nadie declaró hueco.

### ✗ 6 · `reponer-el-leno-de-a-uno` — **SIGUE AFUERA, PERO AHORA POR UN SOLO MOTIVO, Y ES DERIVADO**

Tenía dos motivos y **uno se cayó**. El que se cayó es el segundo: «por §2.3 el
primer leño no se enciende nunca». Se enciende.

El que queda es la aritmética, y sigue en pie: el documento de la tanda uno decía
que reponer de a uno «compra los 250 s con cinco palitos», y es falso. Los
250,00 s están medidos para **UN leño de 5 kg**, que es otra configuración
(`ataque-3-al-incendio.test.ts:452-460`: apilada 50,75 · suelta 49,95 · uno de
5 kg 250,00). Los leños **no arden en serie**: cada uno arde sus 50 s desde que
prende, y lo único que se corre es el arranque. Con la ventana que el propio
documento derivó —un leño de 1 kg baja de los 237,5 de potencia necesarios a los
12,6 s, de `COMBUSTIBLE_POR_SEGUNDO` 0,3 (`leyes.ts:340`)—, cinco leños
encadenados dan **50 + 4 × 12,6 ≈ 100 s**, no 250.

> **POR QUÉ NO LA DEVUELVO IGUAL, Y ES LA DECISIÓN MÁS INCÓMODA DE ESTA TANDA.**
> Cien segundos contra cincuenta **sería** algo que pagar: es el doble de
> ventana, que es lo que las entradas 5 y 6 necesitan. Pero ese 100 es
> **aritmética mía sobre dos constantes**, está declarado como no medido en §6.c
> desde la tanda dos, y **la tanda tres existe justamente porque alguien publicó
> como conclusión algo derivado y no medido**. Devolver esta entrada apoyada en
> el mismo tipo de número sería no haber aprendido nada. Queda afuera hasta que
> alguien mida qué hace una serie de leños repuestos, y esa medición es
> **exactamente lo que falta para llegar a diez** (§10).

### ✓ 7 · `la-cadena-de-la-yesca` — **RESUCITADA CON OTRA MATERIA: ES LA ENTRADA 7**

**El veredicto de la tanda dos era correcto sobre la yesca que se citaba y falso
sobre la conclusión que sacaba.** La cadena que medía `el-fuego.test.ts` usa
`cuerpo('yesca', 'hoja-seca', 1)` —**un kilo** de hojarasca—, y el dios siembra
hoja seca de 0,01 a 0,08 kg (`bioma.ts:359,400,419`), o sea entre doce y cien
veces más liviana, y **no la siembra en `agua-dulce` ni en `pantano`**, que son
los dos biomas del pescado. Todo eso sigue siendo cierto y la hoja seca sigue sin
servir.

Lo que no se sigue es la conclusión: «la secuencia es expresable, lo que no
existe es la materia con la que se hace». **La materia existe y es la corteza**,
sembrada en `agua-dulce` con peso 2 de 0,05 a 0,5 kg (`bioma.ts:298`) — con la
condición de **atar dos**, que es la parte que nadie preguntó (§2.3, y la Regla 7
que salió de acá). Vuelve como **entrada 7**, con nombre nuevo porque el
movimiento es otro: no es apilar yesca, es fabricar una yesca que pese.

Y lo que ya estaba verificado a favor se recicla igual en la entrada 3: la
geometría es legal —`put` acepta `onTopOf` y `covering` a la vez y valida que
ambos estén en la celda (`step.ts:1868-1889`)— y los dos umbrales 282,17 / 659,86
con factor 2,339× están clavados de verdad.

---

## 6 · Los veredictos que NO se pudieron aplicar, y el error del adversario

### a · Dos secuencias declaradas caídas sin fundamento entregado

El dictamen del adversario llegó **cortado en la entrada 7**, a mitad de una cita
de `bioma.ts`. Su resumen afirma «sobrevive una de diez: la 8», pero **para
`comerla-en-el-pico-de-calorias` y `cocinar-el-lote-en-un-solo-fuego` no hay una
sola línea de argumento**. Las verifiqué yo contra el hallazgo central:

- las dos necesitan **un fuego que cocine**, y ése existe (659,8629, medido);
- las dos necesitan **algo comestible**, y el pescado está sembrado donde está el
  fuego;
- las dos tienen detector que sólo llama a `qualityOf` y `estaEnVentanaDeCoccion`,
  las dos exportadas;
- ninguna innata las hace (`comer` come ya; `esperar` aborta cuando la tasa cae).

**No se aplican los veredictos.** Quedan en la lista, con las dos correcciones que
sí les encontré (la ventana de 23,5 s del fuego real, y que los 200 pescados están
medidos con la yesca que no existe). Si alguien tiene el argumento que faltó, se
reabren.

### b · El error del adversario: **el mundo sí deja tirada una yesca que sirve**

El adversario escribió: «El único sustituto local, la corteza, enciende a 250 y
ardiendo a su máximo de 0,5 kg da contacto 175,3 °C: otra pared». **Corrí la
medición y es falso.** Con la misma vara de 0,47 kg
(`ataque-a-la-costura.test.ts:1562-1660`, ejecutado hoy):

```
  yesca junco  0,05 / 0,2 / 0,4 kg → pescado 0,8619  ← COCINA, en todo el rango
  yesca corteza    0,05 y 0,5 kg   → pescado 0,3800  ← crudo
```

**El junco es lo más sembrado de la orilla** —peso 6, de 0,05 a 0,4 kg, en
`agua-dulce` y en `pantano` (`bioma.ts:294,314`)— y con él la técnica funciona
con la materia que el mundo deja tirada de verdad. El precio no se mueve: con
junco de 0,05 kg la vara más barata que cocina sigue siendo la de 0,47 y sigue
saliendo **659,8629**.

O sea que la conclusión correcta no es «no hay yesca» sino la que quedó en la
entrada 3: **hay yesca, y la elección de con qué tapar es la secuencia**. El
adversario buscó la yesca por el lado de encenderla y no la encontró; lo que el
mundo paga es taparla, que es otra cosa.

> **POSDATA DE LA TANDA TRES, Y ES LA MÁS INCÓMODA DEL DOCUMENTO.** La frase
> exacta del adversario que se refuta acá es: «El único sustituto local, la
> corteza, enciende a 250 y ardiendo a su máximo de 0,5 kg da contacto 175,3 °C:
> **otra pared**». Los 175,3 son correctos —el test los mide, 175,32— y la
> conclusión es doblemente falsa: la corteza no sólo sirve de yesca por el lado
> de taparla, **es la materia de la cadena entera** en cuanto se atan dos (§2.3).
> El adversario la despachó, la tanda dos lo copió, y la tanda tres la encontró
> midiendo lo mismo con un nudo en el medio. **La misma sustancia, el mismo
> número, tres lecturas.** Es el mejor caso testigo de la Regla 7 que hay en este
> documento y por eso queda escrito acá y no sólo en §12.

*(Cómo llegué: `packages/perceive/tests/ataque-a-la-costura.test.ts`, bloque 8,
`it.fails('SIGUE ABIERTO · LA YESCA DEL CAMPAMENTO ES UN CUERPO QUE EL MUNDO NO
DEJA TIRADO')`. El repositorio **ya tenía declarado** el hueco de la hoja seca de
1 kg antes que el adversario, con su tabla y con la salida del junco escrita en el
comentario. La parte del hallazgo que es del adversario es el techo de la
fricción; la parte de la yesca ya estaba medida y él la leyó al revés.)*

### c · Lo que no medí y digo que no medí

De la tanda dos, y sigue igual:

- La rama del chunk vecino más fresco de `huir-del-dolor` (§5, ✗1). Plausible por
  las constantes, no corrida.
- Los 100 s de la cadena de cinco leños (§5, ✗6). Es aritmética sobre dos
  constantes medidas, no una medición. **Es lo único que separa a la lista de
  llegar a diez** (§10).
- Qué pasa con un fuego **sin nada que lo tape**: el campamento del banco siempre
  tiene algo tapando la vara, y no se escribió código para medir el caso desnudo.
  La entrada 3 está redactada como comparación entre coberturas, que es lo que sí
  está medido.

De la tanda dos, y **ya no**: el techo de 0,7132 kg estaba declarado acá como
derivado. La tabla de §2.2 lo mide por los dos lados —0,7132 no prende, 0,79
tampoco, 0,80 sí— y el modelo del que salía queda validado contra el mundo fila
por fila. Sale de esta lista.

Nuevo de la tanda tres:

- **El primer eslabón está medido como asíntota, no corrido contra corteza.** Lo
  que el test corre en el mundo es el segundo (fardo → leño, 933,83 °C). Que la
  vara prenda el fardo sale de comparar los 270,99 °C medidos con los 250 del
  catálogo. El margen es de 21 °C sobre un déficit medido de 1,3, así que lo doy
  por firme, pero **no es la misma clase de evidencia** y por eso está acá.
- **Cuánto tarda el fardo en prender el leño.** El test reporta el pico de 2000
  ticks y no el tick de ignición, y el fardo mínimo arde 44,6 s (DERIVADO de los
  50 s/kg). Que 44,6 alcancen es plausible —la ley 1 relaja a razón de
  `H_PERDIDA_POR_SEGUNDO / heatCapacity` (`leyes.ts:983-995`) y da del orden de
  un segundo— pero **no lo medí**, y si no alcanzara la entrada 7 se caería
  entera.
- **La vara armada con dos varas.** Que la rigidez de un ensamble sea el promedio
  pesado está medido en el barrido de la antorcha; que dos maderas de 0,35 kg
  den una fuente de 0,70 que pase el rol y entre en el tanque es aritmética mía
  sobre eso. No lo corrí.
- **Las dos tablas de montaje** de las entradas 8 y 9 (contacto / parrilla contra
  la ventana del pescado). Salen de `temperaturaDeEquilibrio`, que está
  exportada, y del catálogo. El modelo está validado; los ocho números, no.

---

## 7 · Al borde de la lista, y por qué no entraron

- **`armar-el-aparejo-con-materia-que-nadie-previo`** (hueso + tendón, junco,
  pluma). Paga lo mismo que la 4 y **dispara el mismo detector**: misma maniobra,
  otra materia. Que funcione con dos linajes está medido aparte
  (`physics/tests/tres-ejemplos.test.ts:375-399`).
- **`la-hebra-mas-pesada-que-la-vara`.** `freeStrandEnds` ancla una punta sólo si
  la otra parte pesa igual o más (`physics/src/body.ts:439-465`), así que una
  hebra **más pesada** que el palo conserva las dos puntas y duplica el `catch`.
  Es expresable, paga, y nadie lo implementó. **Queda afuera a propósito: es casi
  seguro un error de la regla de anclaje, y un criterio que se congela no puede
  depender de un bug** — el día que alguien lo arregle, la secuencia se vuelve
  inexpresable y el criterio cambiaría en silencio. Sigue afuera aunque falten
  entradas: llenar la lista con un bug sería peor que reportar que faltan.
- **`la-ventana-de-masa-de-la-hoja-seca`.** La tabla del bloque 8 es
  no-monótona en la masa de la yesca (0,01 → 0,8451 · 0,08 → 0,8161 · 0,5 →
  0,7768 · 1,00 → 0,9500) y el salto de 1 kg tiene explicación —a esa masa la
  yesca prende y prende el leño—, pero el tramo del medio **no la tiene**, y el
  propio test lo declara: «hay una pregunta de física atrás que ningún ADR
  contestó». Misma regla que la anterior.
- **`la-antorcha-de-grasa`.** Cruza los tres umbrales, está medida, el blanco
  llegó a 909,83 °C en el mundo y hay **16 recetas** que la sacan. Y `grasa` no la
  siembra ningún bioma ni la rinde ningún proceso: existe sólo en el catálogo
  (§2.4). Es la Regla 5 en la misma tanda que escribió la Regla 7, y se deja
  anotada acá para que nadie la resucite leyendo el test sin leer esta línea.

---

## 8 · Las que no entraron porque el mundo no las permite

Es la lista de trabajo del Hito 6 en adelante.

**a · `romper-el-ensamble-para-recuperar-la-vara`** (una de las cinco
publicadas). La maquinaria existe —`partir(d, b, 'joint')`, `step.ts:2518-2534`—
y **ningún proceso semilla declara ese yield**: `DESHILACHAR` usa `'grain'`
(`process.ts:298`) y `apply` toma `SeedProcessId`, la unión cerrada de los cuatro
(`skills/src/tipos.ts:107`). No hay forma de invocarlo.

**b · afilar, cortar, cavar, machacar, tejer, perforar, moler.** `sharpness` está
en el catálogo y **ningún proceso la sube** (`innatas/aplicar-proceso.ts:14`). El
filo se encuentra o no se tiene. Sin afilar no hay lanza.

**c · construir un refugio.** `place(bp: Blueprint)` existe en la superficie
(`ctx.ts:136`), `stepWorld` lo rechaza con `'no-implementado'` (`step.ts:306`) y
**no hay ninguna forma de obtener un `Blueprint`**. Las dos puntas faltan.

**d · toda la conducta anticipatoria de la noche.** El reloj existe y **no lo lee
nadie** fuera de `@anima/skills`. Ninguna de las doce leyes mira `phase`, la
noche no baja la temperatura ni cambia el metabolismo, y no existe morir de frío
—los cuatro motivos son `comido`, `consumido`, `hambre` y `quemado`
(`step.ts:439-443`)—. Y `faltaParaLaNoche` y `esperarLaNoche` **ya están
escritas** (`innatas/guarecerse.ts:113-115`). Está implementada y vale cero.

**e · «el lugar más seco del mapa es el que está al lado del fuego».**
`WorldState.cells` **no se escribe nunca adentro de `stepWorld`**: el único
`cells.set` de `@anima/world/src` es el cargador de snapshots (`mundo.ts:265`).
Un fuego no seca, no calienta ni moja su celda. Lo único que el calor seca es el
**cuerpo**, por la ley 11.

**f · buscar algo que no esté a la vista.** `intencionExplorar` elige el rumbo con
`OCHO_RUMBOS[(tick + huella(actorId)) % 8]` y **la suma de los ocho rumbos es
(0,0)**: cada ocho ticks vuelve al punto de partida. Es el único `it.fails` que
dejan las quince (`perceive/tests/las-quince.test.ts:332-367`). Consecuencia dura:
**`volver-en-vez-de-re-explorar` no es una secuencia**, porque su alternativa es
un no-op.

**g · distinguir «no hay» de «no sé» sobre un pozo.** El stock **no se puede
leer**: `stock` no está en `QualityId` y el catálogo es cerrado a propósito
(`process.ts:325-330`). Y `stockDe` no está exportada. Lo único legible es el
motivo del rechazo, que es lo que la vieja entrada 5 usaba antes de caerse.

**h · usar un proceso que invente el oráculo.** `apply` toma `SeedProcessId`
—unión cerrada— mientras `ProcessId` de la física es `string` abierto.

**i · cualquier cosa que sea un reflejo.** `Ctx` no tiene prioridad, ni `abort`,
ni forma de que una habilidad se dispare sola.

---

## 9 · Las que no entraron porque no las paga nada

**a · `tapar-la-fogata-para-hacer-carbon` — la técnica emblema del proyecto, y es
una pérdida.** Todo el camino funciona: `covering` ocluye, la oclusión baja el
oxígeno por debajo de `OXIGENO_QUE_HACE_CENIZA = 0,35` (`leyes.ts:272`), y la ley
4 devuelve residuo `carbonoso` (`leyes.ts:1374-1376`). Lo que no cierra es la
aritmética: del residuo sobrevive **0,28 de la masa** con el combustible
concentrado **×1,6** (`leyes.ts:399,404`), o sea `0,448` como mucho, y el
comentario de la propia ley dice que llega con el 83% adentro, o sea **0,372**.
**Hacer carbón quema el 63% del combustible para producir un combustible con el
punto de ignición más alto** (420 contra 300, `leyes.ts:408`). DERIVADO DE LAS
CONSTANTES, NO MEDIDO. Y no se salva por el otro lado: el `carbon` del catálogo
arde 106,7 s por kilo, medido, pero **ningún bioma lo siembra**.
*(La otra puerta de tapar —la que sí paga— es la entrada 3 de la lista: tapar no
para hacer carbón sino para regular el oxígeno de la llama.)*

> **QUÉ LE HIZO LA TANDA TRES, Y ES MENOS DE LO QUE PARECE.** El punto de
> ignición de 420 dejó de ser una pared: un fardo de tres piezas entrega
> **495,96 °C**, medido (`el-fuego-no-se-propaga.test.ts:463-547`), así que el
> carbón que se produzca **se puede volver a encender**. Pero ése nunca fue el
> motivo de la muerte: el motivo es que del residuo sobrevive 0,448 de la energía
> como mucho, y eso no lo tocó nadie. La entrada **sigue afuera**. Lo que sí
> corresponde decir es que su acta de defunción está marcada **DERIVADA, NO
> MEDIDA** desde la tanda uno, igual que la de ✗6 y por lo tanto de la misma
> clase que la conclusión que esta tanda tuvo que dar vuelta: es la **segunda
> candidata a reabrirse** si alguien la mide, detrás de ✗6.

**b · `secar-la-fibra-mojada-antes-de-atar` y `secar-antes-de-frotar`.** La
puerta existe y es dura —`HUMEDAD_QUE_APAGA = 0,45`, y la ley 3 no piroliza ni
arde sin `seca` (`leyes.ts:261,1167-1170`); cuatro fibrosas nacen en o arriba del
umbral—. Y aun así se cae: **el calor seca solo**. Medido: una vara con
`moisture` 1,00 baja de 0,45 en el paso 53 (2,65 s) nada más que por estar siendo
frotada (`world/tests/ataque-2-al-fuego.test.ts:532-565`), y el test lo dice con
todas las letras: «la habilidad es más pesimista que la física». La puerta de la
humedad se abre sola: no hay técnica que aprender.

**c · `jubilar-la-herramienta-gastada` (T2.4).** Las herramientas **no se
gastan**. `JointView.strength` lo escribe `unir` una sola vez (`leyes.ts:1729`) y
no lo mueve ninguna ley (`grep strength` sobre `world/src`: cero).

**d · `descartar-lo-toxico`.** `grep toxicity` sobre `@anima/world/src` devuelve
**cero**. Dos leyes la mueven y nada la lee. Y `comer` ya filtra por ella
(`innatas/comer.ts:85-86`): una habilidad pagando un costo que el mundo no cobra.

**e · `guarecerse-antes-de-tener-frio` (T2.1).** Ver 8.d: no hay frío ni lluvia.

---

## 10 · Cómo se mide, y el umbral que dejó de ser un problema

**El banco.** Veinte partidas con semillas distintas, fijadas ahora:
`20260728n + k` para `k = 0..19`. Si alguna resulta no resoluble se reemplaza en
orden por `20260728n + 20 + j` y **el reemplazo se anota acá con su motivo**.
Cada partida dura **20.000 ticks a 20 Hz = 1000 segundos de mundo**, la misma
ventana con la que está medida la economía. Una criatura, `capacity` 3, y **el
tanque de arranque escrito y publicado** — ver el recuadro de §3: con 500 no se
puede medir nada.

**Qué cuenta como aparición.**

1. Una secuencia **aparece en una partida** si su detector dispara al menos una
   vez. Dentro de una partida no se cuenta más de una vez.
2. Una secuencia **cuenta como aparecida** si apareció en **≥ 2 de las 20**. Una
   sola aparición es indistinguible de una casualidad de semilla.
3. **El umbral: EL PROBLEMA DE LA TANDA DOS SE DISOLVIÓ, Y HAY QUE DECIRLO CON
   TODAS LAS LETRAS.** La tanda dos dejó abierta una disyuntiva incómoda: con
   seis secuencias, el 4 absoluto del criterio publicado y el 40% proporcional
   daban números distintos —4 contra 3— y había que elegir cuál, sabiendo que
   elegir después de mirar el resultado invalidaba la medición. **Con nueve, las
   dos lecturas dan el mismo número:**
   - **el 4 absoluto** del criterio publicado: **4**;
   - **la proporción** 4/10 = 40% aplicada a nueve: 3,6 → **4**.

   Así que **el criterio publicado «al menos 4» vuelve a valer tal cual, y no hay
   nada que decidir antes de correr.** No es «4 de 10» restaurado letra por letra
   —son nueve y 4/9 es 44,4%, un pelo más duro que 40%— pero es el mismo número
   entero por los dos caminos, que es exactamente lo que la tanda dos no tenía.
   La opción (iii) de la tanda dos —no correr hasta que haya diez— queda
   igualmente disponible y ahora está **a una medición de distancia**: ver abajo.

**LO QUE FALTA PARA LLEGAR A DIEZ, Y NO ES ABRIR EL MUNDO.** La tanda dos decía
que llegar a diez pedía tocar el motor (exportar `montajeDe`, `celdaDe`,
`entornoDe`, `stockDe`; §8). Ya no. **La décima está adentro del mundo tal como
está y lo único que le falta es que alguien la mida**: es `reponer-el-leno-de-a-uno`
(§5, ✗6), que quedó afuera porque su único motivo de muerte sobreviviente es
aritmética derivada —«cinco leños encadenados dan ≈ 100 s y no 250»— y esta tanda
existe justamente por haber publicado una conclusión derivada como si fuera
medida. Un test que corra una serie de leños repuestos contra `stepWorld` y
reporte los segundos de fuego cierra la lista en diez o la deja en nueve **con
fundamento**, que es lo que hoy no tiene. Detrás viene
`tapar-la-fogata-para-hacer-carbon` (§9.a), en la misma condición.

**Qué NO cuenta.**

- Un disparo en una partida donde la secuencia estaba **cableada** por el arnés.
  El detector corre sobre la crónica y el estado del mundo, **nunca sobre el
  código de la habilidad**.
- Un disparo cuyo contra-detector diga que el mundo regaló la situación. El
  informe reporta las tres cifras por secuencia: **apareció en N/20 · la
  situación existió en M/20 · no medida en 20−M**.
- Si `M = 0`, se reporta **no medida** y **no cuenta como ausencia**. Si quedan
  más de tres sin medir sobre nueve, el resultado no es interpretable.

> **EL RIESGO NUEVO, Y HAY QUE MIRARLO ANTES DE CORRER: TRES ENTRADAS CUELGAN DE
> UN HILO.** Las entradas 7 y 8 no pueden disparar si la criatura no arma el
> fardo, y la 6 y la 5 cambian de dificultad según lo haya armado o no. El
> contra-detector de la 7 es el más exigente de la lista —pide corteza, atadura y
> una vara adentro de una ventana que es el 2,6% del rango sembrado, todo a la
> vez—. **Si la 7 sale «no medida», la 8 sale «no medida» por definición y no como
> ausencia**, y el informe tiene que publicar las dos pegadas. Con nueve entradas
> y el piso en tres «no medidas», dos de esas tres se pueden ir juntas por el
> mismo motivo: es el modo de falla más probable de todo el banco.

**Qué se publica pase lo que pase.** Las nueve filas con sus tres cifras, la masa
del cuerpo elegido en cada disparo de las entradas 2 y 8, si el fuego de cada
disparo era de vara sola o de cadena, la lista de semillas, el tanque de arranque,
`PHYSICS_VERSION` (`process.ts:27`) y el hash de cada partida
(`hashWorldState`).

---

## 11 · La predicción, escrita antes de correr

**Espero que aparezcan entre 2 y 4 de las 9.** Subí la expectativa un punto
respecto de la tanda dos y no dos: las tres entradas nuevas son difíciles y dos
de ellas cuelgan de la 7, así que lo que sumaron es sobre todo denominador. La
que mueve la aguja es la 9, que es media y no depende de nada.

| secuencia | predicción |
|---|---|
| 1 `no-frotar-lo-que-no-alcanza` | moneda al aire: pide comparar antes de actuar, que es lo que ninguna innata hace |
| 2 `la-vara-mas-liviana-que-igual-cocina` | **la más probable**: es cambiar la clave de orden, y el mundo castiga fuerte el error |
| 3 `taparlo-con-lo-que-respira` | no la espero: pide leer una cualidad que ninguna habilidad mira |
| 4 `ponerle-punta-al-aparejo` | no la espero: dos uniones encadenadas más una travesía entre biomas |
| 5 `comerla-en-el-pico` | no la espero: reconocer un máximo es más difícil que reconocer un umbral, aunque la ventana de 75 s la ayuda |
| 6 `cocinar-el-lote` | no la espero, pero **menos que antes**: con 75 s de fuego el lote ya no tiene que estar completo antes de encender |
| 7 `el-fardo-de-corteza` | **la menos probable de las nueve**, y no por la mente: por el contra-detector. Espero que salga «no medida» |
| 8 `el-leno-mas-grande-que-todavia-cocina` | no la espero: cuelga entera de la 7 |
| 9 `la-piedra-primero-y-la-comida-encima` | **la segunda más probable**: una lectura y un `put` de más, y no depende de la 7 |

Y las lecturas del resultado, fijadas de antemano:

- **7 a 9** → el criterio era fácil y hay que decirlo, no festejarlo.
- **4 a 6** → se cumple, y con el umbral de §10 que ya no hay que elegir.
- **2 o 3** → no se cumple. Y si las que aparecen son la 2 y la 9 y ninguna otra,
  el resultado es sobre la arquitectura y no sobre el modelo: son las dos que se
  resuelven con **una lectura y un acto**, y el salto a «encadenar dos actos» no
  lo cruzaría nadie.
- **0 o 1** → el problema es la mente.
- **Más de tres «no medidas» sobre nueve** → no es un resultado: es un mundo que
  no le puso el problema delante a la criatura. **Y si dos de esas son la 7 y la
  8, es un resultado sobre el contra-detector de la 7 y no sobre la criatura**
  (§10).
- **La 8 sin la 7** es imposible por construcción. Si pasa, el detector está
  roto y hay que parar todo.

---

## 12 · Qué tumbó cada tanda, y qué aprendimos

La tanda dos tumbó nueve de diez, y ocho de las nueve por cosas que el autor de
la lista podría haber mirado y no miró. La tanda tres **devolvió tres de esas
nueve**, y no porque el adversario se hubiera equivocado en los detalles —sus
veredictos de detalle se reprodujeron casi enteros— sino porque el hallazgo del
que colgaban estaba **derivado y no medido**, y cuando se midió salió al revés.
El saldo, en reglas:

**REGLA 5 · Una medición vale lo que vale el banco con el que está hecha.**
Cuatro entradas se apoyaban en tests armados con un leño de 5 kg y una yesca de
1 kg. El dios siembra hasta 3 kg de madera y **0,08 kg** de hoja seca. La regla
operativa: **antes de citar un test, abrir su `function elBanco` y mirar las
masas**. Y del otro lado, la misma regla salva: fue mirando el banco que
apareció el junco, que es lo que la orilla sí deja tirado.

> **Y LA COBRÓ LA TANDA SIGUIENTE, EN EL MISMO ARCHIVO QUE LA ESCRIBIÓ.** El test
> que refutó el hallazgo central encontró dos puertas. La segunda es la antorcha
> de grasa: 16 recetas, medida, 909,83 °C en el mundo, y `grasa` no la siembra
> nadie —existe en dos líneas del catálogo y en ninguna otra parte del árbol
> (§2.4)—. Escribir una regla no vacuna contra ella. La única defensa es
> operativa: **grepear la sustancia contra `bioma.ts` antes de escribir la
> conclusión, no después.**

**REGLA 6 · Antes de escribir un detector, preguntarse qué escribe el motor
solo.** `intencionCaminar` asigna relaciones espaciales y `moverActor` las
suelta. La condición «apoyada sobre algo que arde, y después no» la produce
entera un bicho que pasa caminando. La regla operativa: **para cada condición
del detector, buscar en `step.ts` quién más la puede escribir**.

**REGLA 3, con filo nuevo · Tampoco vale si la mente ya la tiene diseñada.** «Se
baja del fuego» es la fila D0 de la escalera de decisión
(`remake-anima-ii.md:770`). El criterio dice «que nadie diseñó», y una tabla de
reflejos es un diseño. La regla operativa: **grepear el documento de arquitectura
por la conducta antes de meterla en la lista**.

**REGLA 7 · MEDIR EL CATÁLOGO NO ES MEDIR EL MUNDO. Es la más cara de las tres
tandas y va escrita con todas las letras, porque va a volver a pasar.**

La tanda dos publicó esto, en negrita, adentro de un blockquote, como conclusión
de la sección que ordenaba la lista entera:

> ~~En ninguna partida decretada se puede encender un leño. Ningún cuerpo con
> `ignitionPoint` 300 se prende jamás por contacto con otro.~~

Mató cuatro entradas y se llevó puesta media narrativa del proyecto. **Es falsa.**

Y lo interesante no es que sea falsa: es **cómo** se sacó, porque el método era
impecable. Se recorrió el catálogo sustancia por sustancia, se le puso a cada una
**la masa más grande que un bioma le siembra**, se calculó lo que entrega y se
comparó contra lo que la madera pide. Salió esto: «para prender una madera hacen
falta 237,5 de potencia, o sea 0,836 kg de hoja seca (se siembra hasta 0,08),
0,889 kg de corteza (hasta 0,5) o 0,948 kg de junco (hasta 0,4). **Todas las
puertas del segundo eslabón están cerradas por un factor de entre 2 y 10.**»

Cada número de esa frase es correcto. La frase entera es falsa, por dos motivos
que hay que separar:

1. **El factor de la corteza no es «entre 2 y 10»: es 1,78.** Un rango se escribe
   con el peor caso y el mejor, y acá el mejor quedó adentro del rango sin que
   nadie lo mirara a los ojos. **Cuando un barrido tiene una fila mucho mejor que
   las otras, esa fila es el hallazgo y no un punto del rango.**
2. **Y el barrido entero medía PIEZAS SUELTAS.** «Se siembra hasta 0,5» describe
   una pieza. La criatura no está obligada a usar una pieza: `union` es una de
   las quince innatas, sus roles `a` y `b` no piden nada, la masa de un ensamble
   es **extensiva**, y `MAX_PARTS` es 6. Contra un déficit de 1,78×, seis partes
   son de sobra. **La puerta no estaba cerrada por un factor de 2: estaba abierta
   con un nudo.**

> **UNA CONCLUSIÓN SACADA DE LAS PIEZAS QUE UN BIOMA SIEMBRA IGNORA QUE LA
> CRIATURA PUEDE COMBINARLAS, Y COMBINAR ES LA MITAD DEL JUEGO.**

Esa es la regla, y hay que verla en su peor luz para que quede. **Combinar no es
una mecánica más de este mundo: es de lo que trata el proyecto.** La ley 7 está
escrita para «hacer la caña sin que nadie escriba caña» —lo dice su propio
comentario, `physics/src/process.ts:238-253`—. La entrada 4 de esta misma lista es
una secuencia entera sobre encadenar **dos** uniones. Y a tres secciones de
distancia el documento declaraba imposible algo que sale con **una**. No fue un
descuido de un dato: fue mirar el mundo como un inventario en vez de como un
espacio de combinaciones, en un documento cuya tesis es que la criatura va a
combinar.

**Y falla en las dos direcciones**, que es lo que la hace regla y no anécdota. En
la otra dirección está la antorcha (§2.4): barrer el catálogo **sin** mirar la
siembra inventa técnicas que no existen, con la misma prolijidad y el mismo
número de decimales. Un barrido del catálogo puede errar por defecto —declarar
imposible lo que se ata— y por exceso —declarar posible lo que nadie siembra—, y
en esta tanda hizo las dos cosas en el mismo archivo.

**La regla operativa son dos preguntas, y hay que hacérselas antes de escribir
«no se puede», no después:**

- **¿Lo medí con lo que la criatura puede ARMAR, o sólo con lo que encuentra?**
  Para cada cualidad extensiva —`mass`, `heatCapacity`, `emitsPower`— la
  respuesta del mundo es «hasta seis veces más de lo que creés».
- **¿La materia con la que lo medí la siembra alguien?** Un `grep` contra
  `oracle/src/bioma.ts` cuesta diez segundos y es la diferencia entre una
  medición y un espejismo.

**Y la sub-regla de método, que es la que hizo falta esta tanda y no estaba
escrita:** el hallazgo que mató cuatro entradas venía marcado *DERIVADO, NO
MEDIDO* por su propio autor, en §6.c, y se publicó igual como conclusión en
negrita. Lo que se propone, y es asimétrico a propósito: **lo que MATA una
entrada del criterio de corte hay que medirlo; lo que la salva se puede
derivar.** Una derivación equivocada que salva una entrada la hace aparecer como
«no medida» y se nota al correr. Una derivación equivocada que la mata la borra
del documento y no se entera nadie — que es exactamente lo que pasó durante una
tanda entera.

**Qué sobrevive del hallazgo viejo, porque no todo era falso.** El techo de la
fricción es real y ahora está medido: nadie enciende frotando más de **0,7132 kg**,
y ninguna pieza suelta que ese techo prenda alcanza para prender un leño. El
fuego sigue siendo caro —**918,6 de stamina, o sea el tanque entero**, para
arrancar la cadena— y sigue siendo chico. La frase que hay que corregir es la
última: no es que «toda la técnica que la criatura puede inventar tiene que caber
adentro del techo». **Lo que tiene que caber adentro del techo es el primer
eslabón.** De ahí para adelante el mundo la deja crecer, y esa distinción es toda
la diferencia entre un mundo donde hay algo que inventar y uno donde no.
