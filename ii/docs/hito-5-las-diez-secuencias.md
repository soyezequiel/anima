# Hito 5 — Las secuencias del criterio de emergencia

Fecha: 2026-07-28 · Estado: **RE-DERIVADO DESPUÉS DEL ADVERSARIO**. Segunda
tanda. La primera lista de diez se congeló, se le tiró encima un adversario que
abrió el código constante por constante, y **quedaron seis**: cuatro de las diez
originales (una con el detector reescrito) y dos nuevas que sólo existen porque
el adversario encontró lo que encontró.

Este documento decide si el proyecto sigue, así que se escribe **antes** de que
exista la mente. Si la lista, los umbrales o los detectores se pudieran ajustar
después de ver qué hace la criatura, el criterio no mediría nada: mediría al que
lo escribió. Lo único que se puede tocar sin volver a correr todo es un **error
de detector** —uno que reimplemente una fórmula del motor en vez de llamarla—, y
esta tanda usó esa puerta exactamente una vez, en la secuencia 1, con el motivo
escrito.

**LO PRIMERO, PORQUE CAMBIA TODO LO DEMÁS:** hay seis y no diez, y el criterio
publicado pide «al menos 4 de las 10». Con seis, «4 de 6» es otro criterio. Eso
está en la sección 10 y hay que discutirlo antes de correr nada.

---

## 0 · Qué dice el criterio, y qué pasó en esta tanda

El documento de arquitectura
(`F:/proyectos/Anima/docs/architecture/remake-anima-ii.md`, línea ~1462) pide
diez secuencias objetivo que nadie implementó, un detector automático, veinte
partidas con semillas distintas y un piso de cuatro apariciones.

La tanda anterior escribió diez. El adversario tumbó nueve y dejó una. Yo
verifiqué veredicto por veredicto contra el código y contra los tests corridos
hoy: **seis de sus siete veredictos entregados se reproducen enteros**, uno se
reproduce a medias, y **dos secuencias que declaró caídas nunca vinieron con
fundamento** (sección 6). Además le encontré un error propio que cambia el signo
de un hallazgo suyo (sección 6.b): el mundo **sí** deja tirada una yesca que
sirve, y no es la que él buscó.

De ahí salen las seis de la sección 4, las seis caídas de la sección 5, y las
reglas nuevas de la sección 12.

---

## 1 · Las seis reglas que gobiernan la lista

Las tres primeras las dejó el adversario de la tanda cero. La cuarta la agregó la
tanda uno. La quinta y la sexta salen de esta.

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

---

## 2 · EL HALLAZGO CENTRAL: el techo de la fricción

Es de esta tanda, es del adversario, lo verifiqué entero y **mata cuatro
entradas de un saque**. Va antes de la lista porque la lista no se entiende sin
él.

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

### 2.2 · El techo, y qué queda del otro lado

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
está apoyado encima del fuego. Entonces:

| | número | cuenta |
|---|---|---|
| potencia máxima de una vara encendida | **214,4** | 18 · 0,7132 · 16,7 |
| lo más caliente que puede poner en contacto | **272,2 °C** | 15 + 1,2 · 214,4 |
| punto de ignición de la madera | **300 °C** | `sustancias.ts:393` |
| **falta** | **27,8 °C** | |

Con **madera dura** (`fuelEnergy` 21, `ignitionPoint` 340, `specificHeat` 1,6,
`sustancias.ts:449-464`) el techo es 0,661 kg, la potencia 231,8 y el contacto
**293,2 °C**: queda **6,8 °C corto** de prender una madera común. Con **hueso**
es imposible por dos motivos a la vez: `ignitionPoint` 500 y el `drive` tope en
`toward: 400` (`sustancias.ts:624-640`). Y no hay una cuarta: las únicas
sustancias sembradas que pasan el `rigidity >= 0,5` del rol `a` son madera
(0,70), madera dura (0,88) y hueso (0,92); pedernal y piedra pasan el umbral y no
tienen `fuelEnergy`.

Tampoco se suma: `entornoDe` toma **UNA** fuente, la de mayor potencia, y no la
suma de todas (`world/src/step.ts:1428-1436`). Y encadenar tampoco: el descuento
que da precalentar con una llama chica es de segundo orden y **la cadena sólo
empieza a pagar cuando el blanco pesa más de 0,798 kg**, o sea justo arriba del
techo. *(DERIVADO por mí de las dos fórmulas de arriba, no medido.)*

### 2.3 · La conclusión, en una línea

> **En ninguna partida decretada se puede encender un leño.**
> Lo único que arde es la vara que la criatura frota, y pesa como mucho 0,71 kg.
> Ningún cuerpo con `ignitionPoint` 300 se prende jamás por contacto con otro.

Lo que **sí** se puede prender de rebote es lo que enciende por debajo de 272 °C:
`hoja-seca` (180) y `corteza` (250). Y no sirve de nada, porque **para prender
una madera hacen falta 237,5 de potencia**, o sea 0,836 kg de hoja seca (se
siembra hasta **0,08**), 0,889 kg de corteza (hasta **0,5**) o 0,948 kg de junco
(hasta **0,4**). Todas las puertas del segundo eslabón están cerradas por un
factor de entre 2 y 10.

Esto liquida las entradas 2, 4, 6 y 7 de la lista anterior. La sección 5 las
despide una por una.

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

El margen entero del proyecto son **tres piezas**: hacen falta 73 para pagar un
fuego y la partida más flaca saca 76.

> **PARÁMETRO QUE EL ARNÉS TIENE QUE FIJAR Y PUBLICAR, Y NO ES UN DETALLE.** El
> banco del que salen todos estos números arranca a la criatura con **1000** de
> stamina (`ataque-a-la-costura.test.ts:996`, `criatura('ana', 1000)`), pero el
> ADR II-0010 habla de «un tanque de arranque de 500». Con 500 el techo de lo
> encendible cae a **0,356 kg** y **la vara que cocina, que sale 659,86, no se
> puede pagar**: cuatro de las seis secuencias de esta lista quedan sin
> situación. El tanque de arranque decide si el criterio se puede medir.

---

## 4 · Las seis que quedan

| # | secuencia | ángulo de decisión | estado |
|---|---|---|---|
| 1 | `no-frotar-lo-que-no-alcanza-a-encender` | negarse: presupuesto antes del acto | **detector reescrito** |
| 2 | `la-vara-mas-liviana-que-igual-cocina` | el umbral de abajo y el de arriba a la vez | **nueva** |
| 3 | `taparlo-con-lo-que-respira` | el fuego necesita aire, y tapar es un dial | **nueva** |
| 4 | `ponerle-punta-al-aparejo` | construir una herramienta compuesta | intacta |
| 5 | `comerla-en-el-pico-de-calorias` | detenerse en un máximo | intacta |
| 6 | `cocinar-el-lote-en-un-solo-fuego` | amortizar un costo fijo | intacta |

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

**NUEVA. Reemplaza a `el-leno-mas-pesado-que-pueda-levantar`, y pide exactamente
lo contrario.** La entrada anterior pedía juntar el combustible más pesado que se
pudiera levantar. Después del hallazgo de la sección 2 eso es una receta para
morirse: lo pesado no se enciende nunca. La decisión real que el mundo ofrece es
un umbral con dos lados, y los dos están medidos al centésimo de kilo.

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
**Y ojo con la ventana:** el fuego más barato que cocina dura **23,5 s** (§3), así
que el pico tiene que caer adentro de eso.

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
pieza pescada (`hito-5-la-pesca.test.ts`, corrido hoy: p 0,575 con el pozo lleno)
significa que el lote **hay que tenerlo antes de encender**. Que la ventana sea
angosta es lo que hace que la secuencia diga algo.

**DIFICULTAD: DIFÍCIL.** Pide postergar el hambre, que es exactamente lo que el
ADR II-0009 hizo doler.

---

## 5 · Las seis que se cayeron, con el motivo y la evidencia

No se borran. La lista de lo que se cayó y por qué vale tanto como la que quedó.

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
(`ataque-3-al-incendio.test.ts:201-224,277-283`), y por §2.3 **esos fuegos no
existen**. Regla 5.

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

### ✗ 2 · `el-leno-mas-pesado-que-pueda-levantar` — **NO HAY QUÉ PAGAR**

**Reproducido entero.** Por §2.3, **el leño no se enciende nunca**, así que
«entre 15 s y 150 s de fuego por pieza» describe una elección que el mundo no
ofrece. Peor: la secuencia pedía lo contrario de lo que conviene, y por eso la
reemplaza la nueva 2. Y el filtro `portable >= 1` era vacío: `PORTABLE_MAX_MASS`
es 8 (`quality.ts:144`) y lo más pesado que siembra el dios es piedra de 5 kg
(`bioma.ts:439`), así que la restricción del nombre —«que pueda levantar»— no ata
nunca.

### ✗ 3 · `no-frotar-lo-que-no-alcanza` — **NO SE CAE: SE LE CAMBIÓ EL DETECTOR**

El veredicto del adversario era contra el detector y **es correcto**: 1384,29
transcrito contra 1401,26 cobrado (`el-fuego.test.ts:196-233`). La secuencia
sobrevive con el detector reescrito. Está arriba, como entrada 1.

### ✗ 4 · `la-piedra-primero-y-la-comida-encima` — **LA MITAD ES IMPOSIBLE Y LA OTRA NO TIENE ALTERNATIVA PERDEDORA**

**Reproducido, y con un motivo mío que es más duro que el suyo.** La condición
(b) del detector —un cuerpo con `fuelEnergy > 0` apoyado sobre la fuente que
después cruza su `ignitionPoint`— es **insatisfacible** por §2.3.

Y la mitad (a) tampoco mide lo que decía. El documento la vendía como «la comida
en la parrilla y no en el piso», pero **el piso de la celda del fuego no es una
opción disponible**: `intencionPoner` rechaza con `'celda-ocupada'` cualquier
`put` sin `onTopOf` ni `covering` sobre una celda con un sólido
(`step.ts:1876-1883`). En la celda del fuego sólo existen `contacto` y
`parrilla`, y con el único fuego alcanzable el contacto da 184,6 °C con la vara
de 0,47 —debajo de los 260 de pirólisis del pescado (`sustancias.ts:83-85`)—, o
sea que **equivocarse no cuesta nada**. La decisión que la entrada quería medir
no existe con esta calibración.

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

### ✗ 6 · `reponer-el-leno-de-a-uno` — **EL NÚMERO ESTABA MAL, Y ENCIMA NO HAY PRIMER LEÑO**

**Reproducido entero, y la aritmética la rehice.** El documento decía que reponer
de a uno «compra los 250 s con cinco palitos». Es falso. Los 250,00 s están
medidos para **UN leño de 5 kg**, que es otra configuración
(`ataque-3-al-incendio.test.ts:452-460`: apilada 50,75 · suelta 49,95 · uno de
5 kg 250,00). Los leños **no arden en serie**: cada uno arde sus 50 s desde que
prende, y lo único que se corre es el arranque. Con la ventana que el propio
documento derivó —un leño de 1 kg baja de los 237,5 de potencia necesarios a los
12,6 s, de `COMBUSTIBLE_POR_SEGUNDO` 0,3 (`leyes.ts:340`)—, cinco leños
encadenados dan **50 + 4 × 12,6 ≈ 100 s**, no 250. Y es discusión igual, porque
por §2.3 el primer leño no se enciende nunca.

### ✗ 7 · `la-cadena-de-la-yesca` — **REGLA 5, EN LA ENTRADA QUE SE LLAMABA «LA QUE MÁS SE PARECE A INVENTAR ALGO»**

**Reproducido entero.** La cadena que mide `el-fuego.test.ts` usa
`cuerpo('yesca', 'hoja-seca', 1)` — **un kilo** de hojarasca. El dios siembra hoja
seca de 0,01 a 0,08 kg (`bioma.ts:359,400,419`), o sea entre doce y cien veces más
liviana, y **no la siembra en `agua-dulce` ni en `pantano`**, que son los dos
biomas del pescado. Para que una yesca prenda un leño hacen falta 0,836 kg de
hoja seca (§2.3). La secuencia es expresable; **lo que no existe es la materia con
la que se hace**.

Lo que sí quedó verificado a favor y se recicla en la entrada 3: la geometría es
legal —`put` acepta `onTopOf` y `covering` a la vez y valida que ambos estén en la
celda (`step.ts:1868-1889`)— y los dos umbrales 282,17 / 659,86 con factor 2,339×
están clavados de verdad.

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

*(Cómo llegué: `packages/perceive/tests/ataque-a-la-costura.test.ts`, bloque 8,
`it.fails('SIGUE ABIERTO · LA YESCA DEL CAMPAMENTO ES UN CUERPO QUE EL MUNDO NO
DEJA TIRADO')`. El repositorio **ya tenía declarado** el hueco de la hoja seca de
1 kg antes que el adversario, con su tabla y con la salida del junco escrita en el
comentario. La parte del hallazgo que es del adversario es el techo de la
fricción; la parte de la yesca ya estaba medida y él la leyó al revés.)*

### c · Lo que no medí y digo que no medí

- La rama del chunk vecino más fresco de `huir-del-dolor` (§5, ✗1). Plausible por
  las constantes, no corrida.
- Los 100 s de la cadena de cinco leños (§5, ✗6). Es aritmética mía sobre dos
  constantes medidas, no una medición.
- El techo de 0,7132 kg. Derivado del modelo validado contra cuatro puntos, no
  medido en un quinto punto.
- Qué pasa con un fuego **sin nada que lo tape**: el campamento del banco siempre
  tiene algo tapando la vara, y no escribí código para medir el caso desnudo. La
  entrada 3 está redactada como comparación entre coberturas, que es lo que sí
  está medido.

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

## 10 · Cómo se mide, y el problema del umbral

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
3. **Y acá está el problema.** El criterio publicado dice «≥ 4 de las 10». **Hay
   seis.** «4 de 6» es un criterio mucho más duro que «4 de 10» y **nadie lo
   aprobó**. Las tres salidas, para que las decida quien corresponde y no yo:
   - **(i) mantener el 4 absoluto**: hay que sacar cuatro de seis, con dos de las
     seis colgando de un veredicto que el adversario no fundamentó (§6.a).
   - **(ii) mantener la proporción** (4/10 = 40%): serían **2,4 → 3 de 6**.
   - **(iii) no correr todavía** y abrir el mundo hasta que haya diez, que es la
     salida honesta si la respuesta importa. La sección 8 dice exactamente qué
     habría que abrir, y **la más barata de todas es exportar `montajeDe`,
     `celdaDe`, `entornoDe` y `stockDe`**, que resucita media entrada por
     función.

**Qué NO cuenta.**

- Un disparo en una partida donde la secuencia estaba **cableada** por el arnés.
  El detector corre sobre la crónica y el estado del mundo, **nunca sobre el
  código de la habilidad**.
- Un disparo cuyo contra-detector diga que el mundo regaló la situación. El
  informe reporta las tres cifras por secuencia: **apareció en N/20 · la
  situación existió en M/20 · no medida en 20−M**.
- Si `M = 0`, se reporta **no medida** y **no cuenta como ausencia**. Si quedan
  más de dos sin medir sobre seis, el resultado no es interpretable.

**Qué se publica pase lo que pase.** Las seis filas con sus tres cifras, la lista
de semillas, el tanque de arranque, `PHYSICS_VERSION` (`process.ts:27`) y el hash
de cada partida (`hashWorldState`).

---

## 11 · La predicción, escrita antes de correr

**Espero que aparezcan entre 1 y 3 de las 6.** Bajé la expectativa respecto de la
tanda anterior por un motivo concreto: se cayeron **las dos que eran fáciles**, y
lo que quedó son cuatro difíciles y dos medias.

| secuencia | predicción |
|---|---|
| 1 `no-frotar-lo-que-no-alcanza` | moneda al aire: pide comparar antes de actuar, que es lo que ninguna innata hace |
| 2 `la-vara-mas-liviana-que-igual-cocina` | **la más probable**: es cambiar la clave de orden, y el mundo castiga fuerte el error |
| 3 `taparlo-con-lo-que-respira` | no la espero: pide leer una cualidad que ninguna habilidad mira |
| 4 `ponerle-punta-al-aparejo` | no la espero: dos uniones encadenadas más una travesía entre biomas |
| 5 `comerla-en-el-pico` | no la espero: reconocer un máximo es más difícil que reconocer un umbral |
| 6 `cocinar-el-lote` | no la espero: pide postergar el hambre |

Y las lecturas del resultado, fijadas de antemano:

- **5 o 6** → el criterio era fácil y hay que decirlo, no festejarlo.
- **3 o 4** → la tesis vive con el umbral (i) o (ii) de §10, y hay que decir cuál
  se usó **antes** de mirar el resultado.
- **1 o 2** → no se cumple. Y si la que aparece es la 2 y ninguna otra, el
  resultado es sobre la arquitectura y no sobre el modelo: el salto entre «leer
  una cualidad» y «encadenar dos actos» no lo cruza nadie.
- **0** → el problema es la mente.
- **Más de dos «no medidas» sobre seis** → no es un resultado: es un mundo que no
  le puso el problema delante a la criatura.

---

## 12 · Qué tumbó el adversario y qué aprendimos

Nueve de diez, y ocho de las nueve por cosas que el autor de la lista podría
haber mirado y no miró. El saldo, en reglas:

**REGLA 5 · Una medición vale lo que vale el banco con el que está hecha.**
Cuatro entradas se apoyaban en tests armados con un leño de 5 kg y una yesca de
1 kg. El dios siembra hasta 3 kg de madera y **0,08 kg** de hoja seca. La regla
operativa: **antes de citar un test, abrir su `function elBanco` y mirar las
masas**. Y del otro lado, la misma regla salva: fue mirando el banco que
apareció el junco, que es lo que la orilla sí deja tirado.

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

**Y la que no es una regla sino un hallazgo, y es el más caro de todos:** el
mundo tal como está calibrado **no deja encender un leño**. Cuatro de las diez
secuencias, y la mitad de la narrativa del proyecto —juntar leña, reponerla,
encadenar la yesca hasta el tronco— describen un mundo que la física no permite.
No es un bug de una constante: es el techo del tanque de `stamina` contra el
`heatCapacity` de la madera, y las dos están donde tienen que estar. Lo que hay
adentro del techo es un fuego chico, corto y caro: **0,47 kg de vara, 659,86 de
stamina, 23,5 segundos**. Toda la técnica que la criatura puede inventar tiene
que caber ahí.

Eso no es una mala noticia para el criterio: es la primera vez que sabemos
exactamente cuál es el juego. Pero **es una noticia que hay que llevar arriba
antes de correr las veinte partidas**, porque si lo que se quería medir era una
criatura que aprende a mantener una fogata, la fogata no existe.
