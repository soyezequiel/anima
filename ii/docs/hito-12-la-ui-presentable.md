# Hito 12 — La UI presentable

**Qué es, en una frase:** que el mapa sea la vista principal, que la criatura se
vea moverse, y que **ningún objeto quede sin dibujar por no tener arte**.

Va **después del Hito 11**. Se divide en 12A (el view model), 12B (la vertical
visible, nueve cosas) y 12C (los objetos emergentes en pantalla, siete estados).
**12A ya está cerrado** desde el gate 5→6.

---

## 0 · EL TRAMO 0: TRES MEDICIONES ANTES DE ESCRIBIR UNA LÍNEA DE UI

Este hito arranca distinto a los once anteriores, y hay que decir por qué antes
de leer los números.

**Los hitos 0–11 cerraban con un número. Éste cierra con «presentable».** Y
«presentable» no tiene definición todavía: **no hay estilo gráfico, paleta ni
distribución elegidos**, y el que los elige es el usuario. Eso no es una traba
administrativa — es que la mitad del criterio de este hito **no se puede escribir
antes**, que es exactamente al revés de cómo trabajó el proyecto hasta acá.

De ahí sale la forma del tramo 0: **medir, no construir**. Tres mediciones, y
ninguna dibuja un píxel. La regla que las justifica es la 1 del proyecto —*antes
de cambiar el mundo, probá combinar lo que ya hay*— que en este árbol ya se pagó
sola tres veces.

---

## 1 · M1 · QUÉ DE `apps/web` SIRVE, Y LA RESPUESTA TIENE TRES CAPAS

Ánima I tiene una UI viva: React 19 + **Phaser 3** + Vite + Playwright, en
`apps/web`. La pregunta del tramo no era «¿porteo?» sino **«¿la costura entre
`DeltaDeEscena` y ese renderer es un adaptador o un renderer nuevo?»**.

| capa de Ánima I | líneas | veredicto |
|---|---|---|
| `phaser/matter.ts` — paleta × patrón, glifos de 16×16 indexados a paleta | 435 | **el mecanismo se reusa entero; su mitad frágil se TIRA, y eso es una mejora** |
| `phaser/appearance.ts` — de rasgos a aspecto | 146 | **se reescribe**: la entrada cambia de raíz |
| `phaser/WorldScene.ts` — render puro que anima diferencias | 728 | **la forma se reusa**; el consumo cambia |
| `phaser/PhaserStage.tsx` — puente React↔Phaser, hover, arrastre | 371 | **se reusa casi tal cual**: es infraestructura, no dominio |

### El hallazgo: Ánima II le da a `matter.ts` los datos que Ánima I tenía que adivinar

`matter.ts` compone el dibujo con dos ejes, y es una buena idea:

> la PALETA la da el material, la FORMA la da el patrón — «polvo de piedra» =
> paleta de piedra + patrón de polvo, y nadie dibujó nunca ese objeto.

Pero en Ánima I esos dos ejes **se adivinan buscando palabras en el nombre**:
`paletteFor(kind, material)` recorre una tabla `MATERIAL_WORDS`. Existía porque
en Ánima I el material no era dato — el catálogo es abierto y la IA Dios bautiza
lo que inventa como quiera.

**En Ánima II eso no hace falta.** `RenderDescriptor` publica los dos ejes como
datos duros:

```ts
readonly forma: FormId              // vara, hebra, bloque… del catálogo cerrado
readonly materiales: SubstanceId[]  // en orden canónico y sin repetir
```

O sea que **la parte más frágil del renderer de Ánima I desaparece**, y los dos
ejes que `matter.ts` inventó pasan a estar alimentados por el mundo en vez de por
una heurística de nombres. Es el mejor reuso posible: se hereda la idea probada y
se tira la muleta.

### La diferencia estructural, que es lo que decide el trabajo

**El `GameView` de Ánima I mezcla dato y presentación.** Tiene `label`, `name`,
`stanceLabel`, y sus comentarios dicen «en voz humana» una docena de veces.

**La `Escena` de Ánima II prohíbe eso**, y no por prolijidad: el ADR II-0017 lo
fija porque los textos entrarían al `escenaHash` y **dos clientes con distinto
idioma dejarían de coincidir**, con lo que el E2E no podría comparar nada.

De ahí sale lo único grande que este hito tiene que construir desde cero:

> **falta una capa que en Ánima I no existe como capa** — la que convierte un
> `RenderDescriptor` (forma, materiales, partes, juntas, captura) en algo con
> nombre, color y silueta. Ahí vive TODO lo cosmético, y por eso está afuera del
> hash.

Ésa es la costura del Hito 12, y es donde va a estar el trabajo real.

---

## 2 · M2 · CUÁNTO DEL 12B YA ESTÁ RESUELTO ABAJO

Las nueve cosas de la vertical visible, medidas contra el árbol.

**Al escribir este tramo eran seis con motor, dos huecos y un adaptador. Hoy están
las nueve**: los dos huecos se cerraron —la actividad y el aliento en la escena
v2, el panel que los dibuja, y la mente conectada al bucle— y el adaptador de
IndexedDB existe y guarda de verdad.

Y **las specs están**: `apps/juego/e2e/`, doce tests en un navegador de verdad
(los nueve puntos más tres controles), en verde. Ver «Las nueve, en CI» al final.

| # | la cosa | estado | dónde |
|---|---|---|---|
| 1 | ver el mapa | **está** | `escenaDe(s, foco, radio)` |
| 2 | ver la criatura moviéndose | **está** | `actores` + `deltaEntre`, con `aplicarDelta(a, deltaEntre(a,b)) === b` afirmado por hash |
| 3 | ver **todos** los objetos del área visible | **está** | `descriptorDe` es total, y el HUD publica «a la vista»: el spec barre el mapa a click y encuentra exactamente ésos |
| 4 | escribir una orden en el chat | **está** | `apps/juego/src/ordenes.ts` + la caja de texto. Verificado en vivo |
| 5 | recibir acuse inmediato | **está** | verificado con el mundo EN PAUSA: «dale, voy» sale con el tick en 0 |
| 6 | observar progreso y acciones | **está** | `ActorEnEscena.haciendo`/`.esperando` (escena **v2**), el panel, y la mente conectada con `vivir`. Visto en vivo: «esperando 0,1 / 0,3 s» |
| 7 | inspeccionar la criatura | **está** | `ActorEnEscena.aliento` + el panel, verificado en vivo: 999/1000 y bajando |
| 8 | inspeccionar cuerpos y obras | **está** | click en el mapa → forma, materiales, piezas, estado y porte. El dato ya lo publicaba `RenderDescriptor`; **faltaba dónde hacer click** |
| 9 | cerrar y reabrir sin perder la sesión | **está** | `apps/juego/src/deposito-indexeddb.ts`. Verificado: recargar vuelve al tick guardado con lo que llevaba en la mano |

### Los dos huecos, y el primero ya venía anotado

El punto 6 **no es un descubrimiento de este tramo**: quien escribió `escena.ts`
lo dejó escrito con su precio al lado.

> `doing` y `esperando` tampoco, y eso sí es una decisión con precio: la barra de
> progreso de «observar progreso y acciones» (punto 6 de la vertical del Hito
> 12B) va a necesitarlos. Se dejan afuera hasta que exista quien los dibuje,
> porque publicarlos ahora fijaría su forma sin una sola medición de qué hace
> falta mostrar.

**Ese día llegó.** El punto 6 es quien los dibuja, así que la forma de `doing` se
decide ahora — con la pantalla delante, que era la condición.

El punto 7 es el mismo caso sin la nota: **sin el aliento no hay barra de vida**,
y el aliento vive en el mundo, no en la escena.

### El hueco 6, cerrado del lado del mundo

La escena pasa a **v2** y `ActorEnEscena` publica dos campos nuevos. Lo que decide
la forma es lo que se dejó afuera, y son tres cosas:

1. **el total no va.** Una barra necesita «lleva 0,6 de 1 s», y el 1 es
   `Process.completion.at`, que vive en el catálogo. Quien dibuja ya recibe la
   `Physics` entera, así que lo busca por id: copiarlo sería duplicar un número
   que puede quedar viejo. Y `completion` es **opcional** —`friccion` no la
   declara, porque frotar no termina, termina la criatura—, así que hay procesos
   que no tienen barra sino «en curso», y eso lo decide la pantalla;
2. **el nombre tampoco.** `Process.lexeme.nombre` es texto, y la regla 3 de
   `escena.ts` lo prohíbe: dos clientes con distinto idioma dejarían de coincidir
   y `escenaHash` no compararía nada. Viaja el `ProcessId`;
3. **el `seq` de la espera tampoco:** correlaciona la intención con su respuesta,
   o sea que es del protocolo de la mente y no del mundo visible.

Sí van los `RoleBinding` enteros —con nombre y no sólo el id— porque es lo que
permite resaltar en el mapa qué liana y qué vara está tocando la acción.

Y son **dos campos y no uno**, aunque para la pantalla sean la misma barra: nada
en el tipo garantiza que `doing` y `esperando` no coexistan, así que unificarlos
obligaría a elegir cuál gana, y ésa es una regla que el mundo no tiene.

#### El precio, medido antes de escribirlo

`haciendo.segundos` cambia en **cada tick**, y el delta manda los actores enteros
apoyado en el supuesto de que «casi nunca cambian». Eso deja de valer, así que se
midió: `banco-el-delta-de-actores`, una criatura, 400 ticks.

| escenario | actores en el delta | cuesta |
|---|---|---|
| mundo vivo | 2,2% → **26,2%** de los ticks | 47 bytes/tick |
| frotar sin parar (el techo) | 0,2% → **90,2%** de los ticks | **194 bytes/tick** = 3,9 kB/s a 20 Hz |

Contra el delta viejo eso es 3,6×, y **ese porcentaje no significa nada**: la base
es un mundo de tres cuerpos donde no cambia nada, o sea 79 bytes por tick. Una
razón sobre una base así mide cuán chico es el mundo de prueba. Lo que decide si
esto viaja por una red son los bytes, y 194 por tick los aguanta cualquiera.

El techo es 90% y no 100% **por una razón del mundo y no del protocolo**: a los
359 ticks la criatura se queda sin aliento y suelta las piedras — el banco lo
verifica leyendo `stamina` al final, y da 0. Para reponerlo hay que comer, así que
no existe la partida ocupada todo el tiempo.

### El hueco 7, y el banco que cambió la decisión

`ActorEnEscena.aliento` es `stamina` del cuerpo de la criatura. Va en el actor y
no en el `RenderDescriptor` por dos razones: el descriptor publica bandas y no
números —para que el hash no se mueva porque se evaporó una gota— y `qualityOf`
es total, así que en el descriptor sería un campo que dice cero en el 99% de los
cuerpos.

El máximo **no viaja**, igual que el total de la barra de progreso: el 1000 es el
`range` que `stamina` declara en el catálogo de cualidades, y no es decorativo —
comer se recorta contra él, que es por qué una criatura llena rechaza lo que una
flaca acepta.

**Y va en enteros, que es lo que el banco cambió.** La primera versión publicaba
la `stamina` cruda, con el argumento de que redondear es presentación. Una corrida
lo desarmó:

| | crudo | truncado |
|---|---|---|
| lo más largo que escribe | **18 caracteres** (`3999.9999999999995`) | 3 |
| actores en el delta (mundo vivo) | **100% de los ticks** | 27,5% |
| cuestan | 191 bytes/tick | **53 bytes/tick** |

El 100% es lo que decidió: el metabolismo drena aliento en **todos** los ticks, así
que con el número crudo la lista de actores viajaba siempre, y catorce de esos
decimales no se ven en ninguna barra. `stamina` va de 0 a 1000 — mil escalones
para una barra que mide cien píxeles.

El argumento contra redondear seguía siendo bueno, pero era contra que **cada
cliente** redondeara por su cuenta. Redondeando en la escena hay una sola verdad y
entra al hash como cualquier otra cosa. Es `Math.trunc` y no `Math.round` para que
un aliento de 0,4 nunca se muestre como 1: una criatura acabada no se ve viva.

### El panel, y lo que la pantalla NO recibe servido

`apps/juego/src/criatura.ts` arma lo que se muestra, y existe aparte del bucle
porque es lo único de la pantalla con decisiones adentro — así se prueba sin
navegador (9 tests). Las tres cosas que la escena no manda y él resuelve con la
`Physics` que ya tiene:

- **el máximo del aliento** (`range` de `stamina`, o sea 1000);
- **el total del proceso** (`completion.at`), y `undefined` cuando el proceso no
  declara final. `friccion` es ese caso, y entonces la barra se dibuja **rayada**
  en vez de llena: una barra al 100% diría «ya está» y frotar no termina;
- **el verbo en castellano** (`lexeme.nombre`). Si el proceso no está en el
  catálogo —la fragua da de alta procesos en vivo— muestra el id y no revienta.

La fracción va topada a 1: un proceso puede pasarse de su duración porque el corte
es al final del tick, y una barra fuera de su caja es un bug que se ve.

### Y lo que la verificación en vivo encontró: NADIE DECIDE NADA

El panel se cableó, se abrió el juego, y la criatura decía «quieta» — a ×16, mil
cuatrocientos ticks, siempre quieta. El aliento sí bajaba (999 → 902), así que el
cableado estaba bien.

**El mundo de `apps/juego/src/mundo.ts` no tiene mente conectada.** `Partida`
saca las intenciones de las habilidades en vuelo (`correr(skill, …)`) y ahí no hay
ninguna, así que la criatura respira y nada más. Sin alguien que decida, el punto 6
no se puede ver ni con el mejor panel — y ésa es la decisión que sigue: si la
criatura la mueve su mente, o si el jugador le ordena desde el chat.

Un detalle chico que salió de la misma mirada: el mundo escribía `stamina: 2000` y
`qualityOf` recorta contra el rango, así que **los otros mil nunca existieron**.
Corregido a 1000, que es lo que el mundo leía igual.

### El chat, y por qué la mente no se puede saltear

Uno esperaría que «traé un palo» se convierta en una intención y se la mande al
mundo. No: una frase se convierte en una **meta** —una firma de predicado— y
quien sabe convertir una meta en pasos es la escalera de la mente.

    frase → leer() → encargoDe() → drive de la Mente → habilidades → intents

Ordenar desde el chat **no evita la mente**: es la mente trabajando para vos en
vez de para sus propias necesidades. El bucle pasó de `partida.tick()` a
`vivir(partida, mentes, 1)`, que hace pensar antes del paso.

#### Tres cosas que la verificación encontró y ningún test tenía escritas

**1 · El drive compite, no reemplaza.** El primer test afirmaba «sin orden no hace
nada» y se puso rojo: con mente y sin ninguna orden, la criatura caminó nueve
celdas y levantó tres cosas en doscientos ticks. Entonces «hay una meta en curso»
no distingue obedecer de vivir, y el panel dice **de quién es la meta** —«fuego
(tuya)» contra «comida (suya)»— porque si no, el jugador cree que todo lo que ve
es consecuencia de lo que pidió.

**2 · Entiende bastante más de lo que sabe hacer.** «traé un palo» se lee perfecto
y sale como `holding(tag:fibroso)`, pero **ningún esquema de `@anima/plan`
establece esa firma**. Las metas con camino hasta el final son pocas: `emitsPower>0`
(fuego), `catch>0` (trampa) y la cocción. El acuse ya distinguía los dos casos —
*«dale, voy»* contra *«te entendí, pero no sé cómo hacerlo todavía»*— y la caja de
texto ahora lo dice de entrada en vez de dejar que el jugador lo descubra.

**3 · La cámara no seguía a la criatura.** No se había notado nunca porque hasta
hoy la criatura no se movía: el foco estaba clavado en la orilla. A los 241 ticks
ya estaba fuera del encuadre, y el síntoma era indirecto —lo que llevaba en la
mano perdía el nombre y salía el id crudo, porque el cuerpo dejaba de estar en la
escena—. El foco ahora la sigue, y cae en la orilla si la criatura ya no está.

#### El hueco que queda anotado

El panel llegó a mostrar `holding(tag:carnoso,toxicity<0.0528)` como meta en
curso. Esa firma lleva **un número calculado adentro**, así que el puente de
`alias.ts` no la puede nombrar por tabla y nunca va a poder. Traducirla pediría
leer el predicado y armar la frase, y hacerlo por prefijo sería adivinar — que es
justo lo que el guardián anti-adivinanza de este repo persigue. Queda a la vista y
feo a propósito: una firma cruda en pantalla es la señal de que falta una palabra.

### El punto 9, cerrado — y la decisión que no era obvia

`apps/juego/src/deposito-indexeddb.ts` implementa los cuatro métodos de
`Deposito`. Vive en la app y no en `packages/store` por la razón que ese paquete
ya daba: en node no existe `indexedDB`, y un paquete cuya única implementación no
se puede correr en la suite es un paquete que nadie prueba.

**Guarda texto, no objetos.** IndexedDB no serializa con JSON: usa el clon
estructurado, que sabe copiar un `Map`, un `Set` y un `Date`. Si guardara el
objeto vivo, este depósito aguantaría cosas que `enMemoria()` convierte en `{}` en
silencio — o sea **un guardado que anda en el navegador y se rompe en la suite**,
con el error apareciendo lejos de donde se cometió. Guardando texto los dos
cumplen exactamente el mismo contrato, y `loQueNoAguanta` sigue siendo la única
verdad sobre qué se puede guardar.

Eso se afirma: `tests/el-deposito-de-verdad.test.ts` corre **el mismo lote contra
los dos depósitos** (7 casos × 2), incluido el de un `Map` que se pierde igual en
los dos. Hasta este archivo nadie había comprobado que las dos implementaciones se
comportaran igual, que es lo único que hace verdadera la frase del paquete: *«la
lógica de qué se guarda es independiente de dónde se guarda»*.

Medido en vivo: **49 KB de texto**, tick 824, 145 cuerpos y las creencias. Recargar
la página vuelve al mismo tick con lo mismo en la mano.

#### Y el juego pasó a arrancar en pausa

El encabezado de `main.ts` ya decía que la velocidad 0 tenía que existir desde el
primer día —este proyecto perdió una generación por mirar el mundo mientras
corría— pero el juego igual arrancaba en ×1. Con la partida persistiendo sola cada
cinco segundos eso pasó de incómodo a peligroso: abrir la pestaña y olvidarse ya
no cuesta una sesión de mirar, **escribe lo que pasó**. Y hay salida de
emergencia, «empezar de cero», porque un guardado en mal estado se carga solo al
abrir y sin botón el jugador queda trabado para siempre.

### El punto 9 (lo que decía antes de cerrarse)

`store/src/deposito.ts` es una interfaz de cuatro métodos con `enMemoria()` para
la suite, y su propio encabezado dice qué falta:

> la de IndexedDB es un adaptador de veinte líneas que vive donde hay un navegador

Medido: **no existe todavía**. No hay una sola mención de `indexedDB` en `ii/`
fuera de los comentarios y de la lista de prohibidos del sandbox.

---

## 3 · M3 · EL VISOR SIRVE, Y NO COMO BANCO

`ii/docs/visor/partida.html` son 391 líneas de HTML sin servidor, sin framework y
sin dependencias, **generadas por `world/tests/emitir-visor.test.ts` en cada
corrida** — por eso no se puede pudrir. Es además **el primer consumidor real de
`deltaEntre`**, que es la mejor forma que hubo de saber si ese diseño servía.

**Como banco del render no sirve**: dibuja cuadrados a propósito y no corre el
mundo, lee una partida grabada.

**Lo que sí aporta son tres lecciones ya pagadas, y las tres son de producto.**
Salieron de que el usuario miró la primera versión y no entendió nada («la
mascota se movió muy rápido»). El número explica el porqué entero: la partida son
441 ticks y **toda la acción pasa en los primeros 65**.

1. **el mundo tiene que NARRAR lo que hace.** Ver moverse un círculo blanco no
   dice si levantó algo, si ató algo o si le rebotó una intención;
2. **hay que poder saltar lo que no pasa nada.** Un tick es «interesante» si tuvo
   eventos; los 400 ticks muertos se vuelven los seis en los que la obra pescó;
3. **hay que parar en cada hito**, para poder leer.

**Las tres valen para la UI de verdad**, y las tres son gratis de heredar porque
ya están implementadas contra la `Escena`.

---

## 4 · LO QUE SALE DE LAS TRES MEDICIONES

1. **La UI va en `ii/apps/`, no tocando `apps/web`.** Ya hay precedente
   (`banco-navegador`, con Vite) y el `pnpm-workspace.yaml` incluye `ii/apps/*`.
   Ánima I y II conviven; el reuso viaja como código copiado y adaptado, no como
   dependencia.
2. **Lo primero que hay que construir no es el mapa: es la capa de
   presentación** (`RenderDescriptor` → nombre + color + silueta). Es lo único
   que no existe en ningún lado y de lo que cuelga todo lo demás.
3. **El estilo se elige contra el primer mapa dibujado**, no antes. Es la única
   decisión de este hito que no puede salir de una medición, y elegirla contra un
   documento es cómo se eligen cosas que después no se sostienen.
4. **Phaser todavía no hace falta decidirlo.** La capa de presentación es lógica
   pura, se prueba sin navegador, y sirve igual con Phaser, con canvas 2D o con
   SVG.

---

## 5 · EL ESTILO, DECIDIDO POR EL USUARIO: **GLIFO PROCEDURAL**

Se le mostró un muestrario de seis objetos reales del mundo dibujados en tres
familias —glifo pixel, esquema de piezas y tinta—, **los tres derivados del mismo
`RenderDescriptor`**, y eligió el **glifo**: grilla de celdas con índices de
paleta, paleta por material y patrón por forma. Es la familia de Ánima I
(`phaser/matter.ts`), y es además el reuso más directo que había.

**Lo que la decisión NO es:** no es «copiar `matter.ts`». Su mecanismo se hereda;
su tabla de adivinar el material buscando palabras en el nombre se tira, porque
Ánima II publica `forma` y `materiales` como datos (ver M1).

### La contra que el usuario aceptó, y cómo se ataca

El muestrario la dejó a la vista: **el glifo APLANA LA ESTRUCTURA**. El fardo
mixto de 6 partes y 5 juntas se veía casi igual que una vara suelta. Y la
estructura es justo lo que hace única a Ánima II: la criatura ató seis cosas y el
jugador tiene que poder verlo.

**No es una limitación del pixel. Es una limitación de cómo Ánima I lo usaba**, y
las tres salidas son de este árbol:

1. **La grilla de 16×16 no es sagrada acá.** En Ánima I `GLYPH_SIZE` venía del
   mundo (`@anima/sim-core`) porque la IA Dios podía **dibujar glifos a mano** y
   había que fijar una medida común. **En Ánima II nadie dibuja glifos**: el
   descriptor es total y el dibujo es 100% procedural, así que la medida la elige
   el dibujante. Con 24×24 entran seis piezas distinguibles.
2. **El glifo se compone POR PARTES, no por objeto.** En Ánima I un glifo era una
   tabla por `kind`. Acá cada parte aporta su mini-patrón y el objeto es la
   composición de N. Con eso, contar piezas vuelve a ser posible dentro del pixel.
3. **Las juntas tienen sustancia.** `Joint.via` es un `SubstanceId`: un nudo se
   pinta del color del junco que lo ató. Es dato que ya está guardado y que
   ninguna UI leyó nunca.

**Y lo que el glifo compra, que era el otro lado de la balanza:** escala bien a
24 px, que es el tamaño real de un objeto en un mapa poblado. El esquema, que era
el más honesto a 64 px, ahí se convertía en un garabato.

### Lo que sigue abierto del estilo

- **la medida de la grilla** — se decide midiendo cuántas piezas se distinguen en
  16, 24 y 32, no a ojo;
- **la paleta del mundo** — fondo, celdas, agua, noche. El muestrario dibujó
  objetos sobre fondo neutro y no tocó el mapa;
- **la distribución de la pantalla** — mapa, chat e inspección conviviendo.

---

---

## 6 · LO CONSTRUIDO: el descriptor ampliado y `@anima/dibujo`

### 6·1 · El descriptor pasó a v2, y la razón no fue la UI

Antes de escribir un píxel se midió qué se podía dibujar con lo que el mundo
publica, y la respuesta fue **menos de lo necesario**. `RenderDescriptor` sumó
cinco claves, y cada una tapa un caso en el que dos cosas que hay que distinguir
daban **el mismo hash**:

| clave | lo que estaba roto |
|---|---|
| `estado` | un leño ardiendo y uno frío eran idénticos |
| `porte` | un guijarro y un peñasco de la misma piedra, también |
| `atadores` | `Joint.via` existía desde el Hito 1 y ninguna vista lo leyó nunca |
| `nucleo` | el color habría salido de `parts[0]` y contradicho a `nameOf` |
| `podrido` | ortogonal a la banda: un asado se pudre igual |

**Lo que más importa de esto no es el campo, es dónde quedó el umbral.**
`estadoVisibleDe` vive en `@anima/physics` y tiene DOS lectores: `nameOf`, que lo
traduce a castellano con género, y el descriptor, que lo publica para el dibujo.
Si la pantalla hubiera tenido umbrales propios, algún día iba a decir «ardiendo»
sobre algo que el nombre llama «chamuscado», **y las dos habrían tenido razón**.
Es el mismo movimiento que el catálogo del gate: una fuente, dos lectores.

Y las dos bandas son BANDAS y no números por una razón de hash: una cualidad
continua haría que `renderDescriptorHash` cambiara en cada tick en que el fuego
sube un grado, y ese hash existe para detectar que **se dibuja distinto**, no que
la temperatura se movió — eso ya lo mide `worldHash`.

### 6·2 · El paquete: tres ejes, porque dos no alcanzaban

`@anima/dibujo` es el único paquete de `ii/` con derecho a hablar de colores.
Toma `(SubstanceId, Physics)` y devuelve familia, paleta y trama.

**El plan eran dos ejes** —el tono lo da el material, la silueta la forma—, que
es lo que Ánima I inventó y funciona. La medición lo tumbó: `formaDeLoSuelto`
reparte las treinta sustancias en **bloque 21 · hebra 7 · vara 2**, así que la
silueta casi no discrimina. Con nueve familias y tres siluetas, **26 de 30
sustancias quedaban idénticas a alguna otra**, y las colisiones caían justo sobre
las decisiones que el juego quiere que duelan.

El tercer eje es la TRAMA, de `rigidity` y `tensile`. No es decoración: son las
dos cualidades con las que la criatura decide —una vara frota si
`rigidity >= 0.5`, una hebra ata si tiene `tensile`—, así que mostrarlas es
mostrar lo que hay que saber para elegir. Medido: **de 4 aspectos únicos sobre 30
se pasó a 21**, y los 15 que colisionan son benignos (las carnes entre sí, los
verdes húmedos entre sí, savia con grasa).

### 6·3 · Las tres cosas que el tramo dejó escritas, y valen más que el código

**1 · Un corte va en un HUECO, nunca encima de un dato.** La primera versión puso
los cortes de la trama en números redondos —0,25 y 0,55— y los dos cayeron JUSTO
sobre valores del catálogo: `tensile` 0,55 es el de `madera` **y** el de `piel`.
Con el corte ahí, madera no se separaba de madera-dura ni piel de tendón: los
cuatro quedaban del mismo lado. **El corte existía y no cortaba nada.** Los
cuatro cortes de hoy caen en huecos medidos, y por eso una recalibración que
mueva una cualidad un punto no da vuelta ninguna clasificación.

**2 · Una familia se llama por su ASPECTO, no por una de sus sustancias.** Las
familias se llamaban `piedra`, `madera`, `carne`, `agua`… y el guardián del punto
(b) se disparó solo: **no hay forma de que un guardián distinga `Familia =
'piedra'` de un `if (id === 'piedra')`**. Se renombraron a `gris`, `pardo`,
`rosa`, `azul`, `tizon`, `ocre`, `verde`, `tostado`, `ambar`. Es mejor por diseño
—la familia `pardo` tiene adentro corteza y hoja-seca, no sólo madera— y de paso
el guardián volvió a poder morder.

**3 · El criterio no es «las treinta se ven distintas».** Eso sería mentira y
además no hace falta: entre carne y pescado nadie elige mirando, se elige por
`nutrition`. El criterio es más chico y se sostiene: **los ocho pares que el
juego obliga a distinguir se distinguen**, cada uno con su porqué escrito en el
test, y los que quedan iguales **se imprimen contados**. Un límite que no se
publica es un límite que alguien descubre tarde.

### 6·4 · La composición: el glifo se puede contar

**Medido, con la grilla en 24 y las seis formas.** Cuántas celdas de 576 se
mueven cuando una obra pasa de N piezas a N+1:

| forma | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 |
|---|---:|---:|---:|---:|---:|
| vara | 156 | 96 | 168 | 176 | **80** |
| hebra | 108 | 57 | 106 | 105 | **40** |
| filete | 172 | 78 | 384 | 286 | **40** |
| malla | 216 | 72 | 288 | 192 | **48** |
| bloque | 345 | 160 | 487 | 319 | **88** |
| grano | 96 | 120 | 216 | 216 | **120** |

El peor caso es **40 contra un umbral de 30**, y el umbral no es una aspiración:
es lo que la reparación compró. Con el layout anterior el peor era **16**.

**Y el umbral no se afloja nunca.** Está escrito en el encabezado del test:
bajarlo sería volver exactamente al bug que lo motivó.

### 6·5 · Los dos bugs del layout, que eran distintos

**El primero lo encontró un adversario y era de diseño.** Si el layout de N=5 es
el de N=6 menos una baldosa, lo único que cambia entre cinco y seis **es esa
baldosa** — 16 píxeles de 576, un 2,8%. La reparación es que la última fila vaya
CENTRADA: pasar de cinco a seis corre las de abajo en vez de rellenar un hueco.

**El segundo lo encontró el test y era mío.** La tabla de posiciones estaba
escrita en tercios de grilla y los lados en mitades: **cajas de 12 celdas puestas
cada 8**. Las piezas se montaban unas sobre otras y el solape tapaba justo lo que
cambia — el salto de dos a tres movía 24 celdas en la hebra. Hoy el lado se elige
primero y las esquinas salen de él, así que **el solape es imposible por
construcción** en vez de ser algo que hay que revisar.

Los dos daban el mismo síntoma —«no se puede contar»— por causas distintas, y es
la razón por la que el test mide el RESULTADO y no la tabla.

### 6·6 · Y el patrón dejó de ser un dato

El adversario midió algo peor que un bug: **el invariante que tenía que cazarlo
iba a dar verde**. Comparaba los patrones de 24×24 contra `SLENDERNESS`, y a esa
escala todo cumple — pero un cuerpo compuesto **nunca dibuja a 24**: con dos
piezas dibuja a 12 y con cinco a 8. Al reducir, la regla «es tinta si alguna
celda lo es» engorda los trazos finos, y la hebra terminaba con razón 3,56 contra
4,00 de la vara: **menos esbelta que la vara**, al revés de lo que la física
declara.

La salida no fue reducir mejor: fue **no reducir**. Un patrón dejó de ser una
grilla guardada y pasó a ser una función de `(ancho, alto, trama)`, así que cada
pieza se dibuja directo a la medida que le toca. Medido a las tres escalas que se
usan de verdad:

```
lado 24   hebra 6,00   vara 4,00
lado 12   hebra 6,00   vara 4,00
lado  8   hebra 8,00   vara 4,00
```

### 6·7 · El muestrario, que es lo que el usuario mira

`ii/docs/visor/glifos.html`, generado por `dibujo/tests/emitir-muestrario.test.ts`
**en cada corrida**, por el mismo motivo que el visor de la partida: un archivo
que se genera a mano queda viejo el día que alguien cambia una paleta. Cada
figura sale de un `RenderDescriptor` real pasado por `glifoDe`; ninguna la dibujó
nadie.

El test no afirma nada sobre cómo se ve —eso lo cierra el usuario mirando— pero
sí que cada muestra **tenga tinta**: un muestrario en blanco es un archivo
perfectamente válido que no sirve para nada.

### 6·8 · La medida de la grilla: 24, y ahora está medido

**La grilla buena es la más chica que conserva las tres cosas que el dibujo
promete**, y son tres porque «cambia al agregar una pieza» resultó no servir:

| grilla | celdas | esbeltez | volumen | contar |
|---|---:|:---:|:---:|:---:|
| 4×4 | 16 | ✘ | ✘ | ✔ |
| 12×12 | 144 | ✘ | ✔ | ✔ |
| 16×16 | 256 | ✘ | ✔ | ✔ |
| **24×24** | 576 | **✔** | **✔** | **✔** |
| 32×32 | 1024 | ✔ | ✔ | ✔ |

**El banco original no hacía falta.** El diseño adversarial pedía rasterizar,
componer sobre el fondo, reducir con dos filtros, clasificar con 1-NN y correr
seis controles, y todo eso existía para contestar *«¿la grilla fina sobrevive a
la reducción?»*. Esa pregunta se murió cuando los patrones dejaron de ser
bitmaps: hoy nada se reduce. Dejarlo habría sido pagar por una respuesta que ya
no se necesita.

> ### LA PRIMERA MÉTRICA NO SERVÍA, Y LO DIJO SU PROPIO CONTROL
>
> Vale escribirlo porque es el modo de falla que este árbol persigue. La primera
> versión medía «qué fracción de la tinta cambia al pasar de N a N+1» y la tabla
> salía preciosa: 17% a 12, 17% a 16, 17% a 24, 21% a 32 — *«sirven las cuatro,
> la más chica es 12»*.
>
> **El control negativo la mató: a grilla 4 también da 17%.** Y tenía que dar,
> porque el layout escala con la grilla, así que la fracción es invariante al
> tamaño POR CONSTRUCCIÓN. Un número que da lo mismo de 4 a 32 no puede elegir
> entre 4 y 32.
>
> El error era de pregunta, no de aritmética: **que el dibujo CAMBIE al agregar
> una pieza no es que el dibujo SE ENTIENDA**. Lo primero se conserva al
> achicar; lo segundo no.

### 6·9 · El fondo, y el contraste como línea base

`src/mundo.ts`. Tres suelos que salen de lo que la escena publica, y el criterio
de cada uno es el de una ley: **mojado** es `wet >= 0.45`, que es
`HUMEDAD_QUE_APAGA` de la ley 3 —o sea que el suelo se ve mojado exactamente
donde apaga un fuego—, y **bajo techo** es la oclusión de la ley 12.

`oxygen` y `temperature` no pintan el suelo a propósito: una celda caliente no se
ve distinta, se ve el FUEGO que la calienta, y ese fuego es un cuerpo con su
propio glifo. Pintar las dos cosas sería contarlo dos veces.

**La noche es una mezcla lineal en sRGB**, sin corrección de gamma. No es lo
correcto en teoría de color y es lo correcto acá: la regla 2 prohíbe la
trascendente, y un fondo que no coincide entre clientes rompe la comparación del
E2E.

La tabla de 54 pares —nueve familias × tres suelos × dos fases— da un peor caso
de **54**, que es `tizon` contra el suelo seco de día.

> **Y el piso se subió de 20 a 50 apenas se vio ese número.** Un piso de 20 con
> un peor caso de 54 **no es un guardián**: deja empeorar 2,7× antes de decir
> nada, y el día que alguien retoque una paleta y el pedernal se pierda de noche
> va a estar en verde. Es el mecanismo de `skills/tests/linea-base.json` desde el
> Hito 4, con su regla: **para bajar este número hay que editarlo a mano y decir
> por qué**.

### 6·10 · Los sprites del modelo, adelantados a pedido del usuario

**Esto contradice la decisión de producto 13** —«las skins con IA quedan fuera de
Ánima II 1.0»— y el usuario lo decidió con eso a la vista el 2026-08-02. No es un
rediseño: el ADR II-0017 ya exigía que las skins **nunca puedan bloquear el
render**, que es exactamente el comportamiento pedido. Lo que cambió es el
*cuándo*.

**La diferencia de fondo con Ánima I**: allá el sprite se cachea por `kind`, un
nombre que la IA Dios inventó. Acá no hay nombres, así que la identidad visual se
construye, y se construye **sin el estado**:

```
forma × sustancia × la medida a la que se dibuja       540 claves como techo
```

Si el estado entrara en la clave, cada grado de temperatura sería un sprite nuevo
y el modelo dibujaría el mismo leño cien veces. Medido: una escena de doce
cuerpos pide **24 dibujos**, y ese número chico es todo el argumento a favor de
cachear PIEZAS y no objetos — por objeto sería combinatorio.

**Las reglas que hacen que esto sea seguro**, cada una con su test:

| regla | por qué |
|---|---|
| `dameYa` es SÍNCRONO | si pudiera devolver una promesa, dibujar un cuadro esperaría a la red |
| lo procedural es el PISO, no el plan B | el sprite puede tardar, fallar o no llegar nunca |
| un sprite **no mueve ningún hash** | dos jugadores, uno con dibujos y otro sin, comparan igual |
| la medida entra en la clave | reducir rompe la esbeltez, y está medido |
| la puerta corre en las DOS puntas | si el servidor validara distinto, un dibujo rompería en la pantalla de otro |

> **Y lo mejor que se hereda de Ánima I no es código: es que el modelo entrega
> ÍNDICES DE PALETA y no colores.** Por eso la puerta puede ser tan corta — el
> peor sprite posible sigue siendo del color de su material. Un modelo no puede
> pintar una piedra de rosa aunque quiera. La coherencia no se valida: es
> imposible romperla.

**El depósito** es `ii/apps/sprites`: cuatro rutas, cero dependencias fuera de
`node:`, y **primero gana** — una clave dibujada no se pisa. Las alternativas
suenan mejores y ninguna lo es todavía: «el último gana» deja que dos jugadores
cambien el mundo turnándose, «el mejor gana» pide un criterio de calidad
automático que no existe (si se pudiera medir que un dibujo es lindo, no haría
falta un modelo para hacerlo), y «el más votado» pide un producto que no existe.

> **LO QUE EL DEPÓSITO NO HACE, Y ES UNA DECISIÓN Y NO UN OLVIDO:** no autentica,
> no modera y no borra. Con cuatro índices y una grilla de 24 el espacio de lo
> ofensivo es chico pero **no vacío**, y hoy la única defensa es que un dibujo
> entra una sola vez por clave. Antes de abrir esto a internet hace falta al
> menos saber quién mandó cada uno y poder sacar uno.

### 6·11 · El banco del cuadro: el dibujo NO es el problema

La pregunta más cara de las abiertas, y ningún banco de este proyecto la había
hecho: el Hito 0 midió el arranque del navegador y el costo del tick, pero **el
dibujo no existía**. Con el p99 del tick en 30,94 ms sobre una ventana de 50, si
pintar un cuadro costara 20 ms el juego no correría.

```
cuerpos   ms/cuadro   cuadros por tick de 50 ms
      0        2,94       17
     10        3,10       16
     50        3,43       15
    200        4,60       11
```

**Y el reparto es lo que hay que recordar:** 225 celdas de suelo salen 2,98 ms y
los 50 cuerpos que van encima suman 0,36 — **siete microsegundos por cuerpo**. El
suelo se lleva el 89%, así que **el costo del dibujo no escala con lo que pasa en
el mundo, escala con el área visible**. El día que haya que optimizar, el número
es el RADIO.

Un dato contraintuitivo del mismo banco: un glifo de 6 piezas sale más barato que
uno de 1 (14,7 µs contra 29,1). Con una pieza el lado es 24 —576 celdas—; con
seis, cada una mide 8 y son 384. **Un objeto complejo dibuja menos área que uno
simple.**

> **Y el guardián de relojes del Hito 11 atajó dos veces, con razón las dos.**
> Primero exigió que agregar una copia de la puerta fuera deliberado —se subió
> `copiasDeLaPuerta` de 5 a 6 con el porqué—; después rechazó el control del
> banco, que comparaba dos tiempos. La línea base ya decía qué hacer: *donde haya
> una afirmación estructural que pruebe lo mismo, va ésa y no la puerta*. Lo que
> el control quería verificar no era que tardara más, **era que dibujara**: hoy
> cuenta píxeles pintados y afirma la relación exacta (81 celdas × 28² px).

### 6·12 · La app: `ii/apps/juego`

El consumidor que faltaba. Todo `@anima/dibujo` se había construido y medido
**sin uno solo**: el mapa se emitía desde un test, los sprites nunca se pedían de
verdad y a `surtir` no lo llamaba nadie.

Dos cosas que la app tiene que hacer bien y están escritas en su encabezado:

1. **el tick y el cuadro son cosas distintas.** El mundo avanza a 20 Hz pase lo
   que pase con la pantalla; el navegador dibuja cuando puede. Un bucle que los
   mezcle hace que la partida dependa de la placa de video;
2. **`surtir` corre fuera del tick**, entre cuadros, nunca entre el `tick()` y el
   dibujo.

**Y la velocidad 0 está desde el primer día, a propósito**: una pestaña abierta
avanza la partida real, y este proyecto ya perdió una generación por mirar el
mundo mientras corría. La pausa no es una comodidad que se agrega después.

Medido en el navegador, con el mundo corriendo de verdad:

| | |
|---|---|
| cuadro | **3,5 – 4,2 ms** (el banco en node decía 3,10) |
| ticks perdidos | **0** |
| cuerpos en la partida | 73 |
| errores de consola | ninguno |

Con la pausa puesta el tick no se mueve y **la pantalla sigue dibujando**, que es
lo correcto: el mundo quieto se puede mirar.

### 6·13 · Cuando los sprites no se entendían, y las tres causas

El usuario miró el mapa con los dibujos de Codex puestos y dijo dos cosas: que
una rama parecía «un pedazo de mierda literal» y que **el personaje parecía una
roca**. Las dos eran ciertas y ninguna era culpa del modelo.

**1 · SE PEDÍA UN MATERIAL, NO UNA COSA.** El encargo decía *«una PIEZA de madera
en forma de vara, cuatro veces más larga que ancha»* y el modelo dibujaba
exactamente eso: una barra de cinco filas sobre veinticuatro. Y estaba bien
dibujada — el problema es que **«un pedazo de madera» no restringe ninguna
silueta**, y a 24 píxeles la silueta es casi todo el reconocimiento. «Una rama
seca» sí la restringe: es larga, torcida, se rompió de una punta.

De ahí sale también el tamaño: nadie dibuja una rama ocupando el 17% del cuadro.
Una PIEZA sí, porque una pieza es el recorte de algo más grande y **un recorte no
tiene tamaño natural**.

**2 · LOS NÚMEROS ERAN LA CAUSA DEL RUIDO.** El prompt mandaba `rigidez 0.70` y
le pedía al modelo decidir la textura con eso. Una escala abstracta sin referente
visual obliga a inventar un mapeo, y el prompt lo empujaba hacia la textura — que
a 24 píxeles **es ruido**. Ahora viajan como palabras dibujables: «se quiebra en
planos», «se le ve la fibra», «el borde brilla».

**3 · LA CRIATURA RECIBÍA EL PEOR PROMPT DE LOS 540.** `partirClave` le daba
`forma: 'criatura'`, la tabla de formas no la tenía, y el encargo salía con «la
forma *criatura* es una pieza suelta». Eso explica la roca mejor que cualquier
teoría sobre la clave.

> **Y un cuarto que apareció mirando:** una vara de medio kilo **tapaba a la
> criatura entera**, porque el mapa pintaba de mayor a menor porte y la criatura
> —60 kg— iba primero. El agente ahora va último.

### 6·14 · La criatura viene con el juego

No se le pide a nadie, y las tres razones se acumulan: es **una** clave contra
539, el jugador la mira el 100% del tiempo, y —medido— **se le pidió a Codex con
el prompt bueno, tardó 4 minutos 55 y la puerta lo rechazó**.

Lo que la saca de ser un terrón no es el color ni la textura: son **los huecos**.
El cuello entre la cabeza y el torso, el aire entre cada brazo y el costado, el
hueco entre las piernas. Un bulto con patas pintadas encima sigue siendo un
bulto — los huecos tienen que ser `0` de verdad.

Pasa por la misma puerta que todo lo demás, y hay un test que lo afirma: **un
dibujo de fábrica mal hecho sería peor que uno del modelo**, porque nadie lo
estaría mirando con desconfianza.

> **Una convención que conviene saber que es una convención:** «de pie y de
> frente» **no sale de la física**. El mapa es cenital. Es lo que hacen Ánima I y
> casi todo el género, y cambiarlo después cuesta invalidar el caché compartido.

### 6·15 · La puerta subió, y el motivo incomoda

**La barra de cinco filas que motivó todo esto había pasado la validación.** Un
prompt que exige ocupar 20×20 y una puerta que se conforma con 12 celdas
encendidas es exactamente cómo se llega ahí: la exigencia estaba escrita donde no
se verifica.

Cuatro reglas nuevas, todas deterministas y baratas, y cada una caza un defecto
que se vio de verdad:

| regla | qué caza |
|---|---|
| caja ≥ 5/6 del lado | la figura chica rodeada de vacío: una mota, no una cosa |
| una sola isla de tinta | los pedazos flotando, que se leen como suciedad |
| **ningún `3` toca el vacío** | el sprite iluminado al revés que los 21 procedurales |
| sombra ≤ 50% (62% en criatura y hebra) | la mitad pintada que no es volumen |

La tercera es la que más cambia el resultado y no es gusto: es la regla que
`contornear()` **ya ejecuta** en el motor. Un sprite con el borde superior
iluminado convive mal con las 21 sustancias que se dibujan procedurales.

Y el límite de sombra depende de la forma porque se midió: **una figura con
brazos y piernas de cuatro celdas es casi todo contorno**. Con un techo único de
50% el dibujo del personaje se rechazaba por 52%, y era un dibujo correcto.

### 6·16 · Lo que falta

- **la distribución de la pantalla** — mapa, chat e inspección conviviendo;
- **el mapa entero**, que es dibujar la `Escena` y no un cuerpo suelto;
- las nueve cosas del 12B como specs de Playwright, antes de tocar un píxel de
  la app.

---

### Cómo se verifica un hito que no tiene números

- **las nueve cosas del 12B se escriben como nueve specs de Playwright ANTES de
  tocar un píxel.** Es el mismo método de siempre —criterio verificable escrito
  primero— y en UI el spec es lo único que reemplaza al número;
- **los siete estados del 12C se prueban SIN navegador**, contra
  `renderDescriptorHash`. Es dato derivado, es test común, y es barato;
- **lo visual no lo cierra ningún test.** Se cierra mirando, y lo mira el
  usuario.

**Y dos trampas que este proyecto ya cobró**, las dos aplicables de lleno acá:
los gestos **no** se verifican con eventos sintéticos (va Playwright de verdad), y
**verificar en vivo hace correr el mundo** — velocidad 0 antes de cualquier
verificación larga, que ya murió una generación así.

---

## 4 · LAS NUEVE, EN CI

`apps/juego/e2e/`, con `pnpm --filter @anima/juego test:e2e`. Un `test` por punto
de la vertical, con el mismo nombre y en el mismo orden que la tabla del tramo 2,
más tres controles. **12 en verde.**

Lo que agregan sobre los tests de vitest no es lógica —eso está probado y más
barato en `tests/`— sino que **el cable llega**: que el dato que la escena publica
termina en un nodo que el jugador puede leer. Los tres huecos de este hito tenían
el motor escrito y no tenían pantalla, y ningún test de unidad podía verlo.

### Un worker, y no es pereza

Ánima I corre con tres y lo justifica al revés (allá el paralelismo hay que
limitarlo porque cada mundo cuesta CPU). Acá el problema es más duro: **el mundo
avanza con `requestAnimationFrame`**, o sea que una pestaña que el navegador
considera oculta no avanza un solo tick. Con varios workers, las pestañas de fondo
quedan clavadas y los specs que esperan movimiento vencen sin que nada esté roto.

Se descubrió a mano, mirando: el tick en 0, `visibilityState: 'hidden'` y todo lo
demás sano.

### Los tres tests que estuvieron mal, y lo que enseñó cada uno

**El punto 6 encontró un bug de verdad.** `antesDelTick` salía temprano si la
mente ya perseguía la meta pedida, y entonces `#ultimaPuesta` quedaba vacía: el
panel mostraba «fuego (suya)» aunque vos acabaras de pedir fuego. No es un borde
raro —pedirle algo que ya estaba por hacer es lo más normal— y era invisible desde
adentro, porque la mente hacía lo correcto: lo que estaba mal era **quién se
llevaba el crédito**.

Después el mismo spec falló por una razón que no era un bug: esperaba al tick 60
para mirar, y medido con un banco aparte, la orden vive del tick 0 al ~80 y ahí el
encargo se da por cumplido. `emitsPower>0` es un predicado EXISTENCIAL y con algo
así a la vista ya está satisfecho — lo mismo que el Hito 6 dejó escrito. De ahí
salió el control **6b**: que cuando la orden termina, la criatura diga «listo».

**El punto 3 estuvo mal tres veces, y sólo una era del código.** Pedía «más de 2
formas distintas» y encontraba 2, porque el catálogo tiene seis formas y media
orilla es «vara». Después juntó forma y material y seguía dando 2 — y ahí sí:
**el dios siembra hasta trece cuerpos en una misma celda** y el panel mostraba
sólo el de arriba. Después pidió «más de 20 cuerpos» y encontró 3, con el HUD
marcando 73: tampoco era un bug, el área visible tiene 3 y los otros 70 están
fuera del radio.

La lección, que es la del propio punto: **pedir una cantidad era inventar un
número**. Lo que había que hacer era preguntarle al juego cuántos hay. Hoy el HUD
publica «a la vista» y el spec afirma que barrer el mapa a click encuentra
exactamente ésos — que es lo que «ver todos los objetos» quiere decir.
