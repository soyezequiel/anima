# Hito 7 — El juez

**Qué es, en una frase:** decidir si una habilidad recién escrita **es estable o
tuvo suerte**, corriéndola en mundos que ella no vio.

Sin esto, el Hito 8 no tiene puerta: la fragua produce código y **nadie dice si
sirve**. «Compiló» no es «funciona», y «funcionó una vez» no es «funciona».

---

## 0 · Las cinco mediciones que se hicieron ANTES de escribir el criterio

Es la regla 1 del repo y acá dio vuelta dos puntos del criterio heredado. Ninguna
de estas cinco cosas es una opinión: cada una tiene el comando que la produjo.

### M1 · El dato de la ablación YA EXISTE, y lo escribieron para este hito

`skills/src/innatas/contrato.ts` tiene `precondiciones` con este comentario
textual: *«Candidatas a ablación, no verdades»*. Y su encabezado dice para qué se
escribió:

> Por qué existe como DATO y no sólo como comentario: el juez del Hito 7 hace
> **ablación de precondiciones**. Una precondición escrita en prosa dentro de un
> comentario no se puede ablacionar. Escrita acá, sí.

**Hay 17 contratos** sobre 20 archivos de innatas. O sea que el punto de la
ablación no arranca de cero: arranca con 17 sujetos y su vocabulario ya fijado
(`Predicado` = sujeto · cualidad · operador · valor).

### M2 · EL PUNTO DE LOS SELLOS ESTÁ EN ROJO, Y YA FALLÓ UNA VEZ EN SILENCIO

Es el hallazgo que más cambia el hito, así que va con la cadena entera.

El mecanismo existe: `SelloDeHabilidad` con `clase: 'construir' | 'usar'`, y
`realizaElPlano()` rechaza un plano sellado contra otra física. Y el encabezado
de `physics/src/physics.ts` explica la intención:

> una recalibración produce una `Physics` nueva con otra `version` en vez de
> mutar la vieja — que es lo que invalida los sellos de los procesos **sin que
> nadie se acuerde de invalidarlos**.

**El problema es que el sello no depende de los números: depende de un entero
escrito a mano.**

```
physics/src/process.ts:27    export const PHYSICS_VERSION = 1
physics/src/plano.ts:585     return `v|${String(version)}\n${p}\n--\n${j}`
```

Y ese entero **nunca se movió**, mientras la física sí:

| | |
|---|---|
| commits que tocaron `process.ts` | **4** |
| commits que cambiaron `PHYSICS_VERSION` | **1** — el que lo creó |
| `FRICCION.efficiency` (`process.ts:278`) | **0.35 → 0.85**, en el tramo N del Hito 5 |

O sea: **un `Process` sellado con eficiencia 0,35 y uno sellado con 0,85 tienen
el mismo sello.** La frase «sin que nadie se acuerde de invalidarlos» describe
exactamente lo que pasó — nadie se acordó, y no había quién avisara.

**Y el criterio pide más de lo que cualquiera de las dos cosas da.** Dice *«bajar
un número de la física invalida los sellos que dependen de ÉL»*. Eso no es un
entero global (invalida todo) ni un hash del catálogo entero (también invalida
todo): es **dependencia por número**. Un sello que sólo leyó `rigidity` no
debería morir porque cambió `heatCapacity`.

### M3 · EL NOMBRE `juez` YA ESTABA OCUPADO, Y POR OTRA COSA

**Al medir, `@anima/juez` no era el juez de este hito.** 126 tests,
`src/detector.ts` + `src/secuencias.ts`: era **el detector de secuencias de
emergencia** del criterio 6 del Hito 5. No juzga habilidades — mira una partida
y dice si la criatura resolvió el hambre sin que nadie se lo pidiera.

Y era el único paquete del remake con nombre en castellano: los otros nueve son
`physics`, `world`, `oracle`, `skills`, `perceive`, `plan`, `mind` y `lang`. El
documento de arquitectura llama al de este hito **`@anima/judge`**, así que tener
`judge` y `juez` conviviendo era una hora perdida garantizada para el que llegara
después.

> **RESUELTO en el tramo A: el viejo pasó a `@anima/emergencia`.** Lo decidió el
> usuario. Se eligió renombrar al viejo y no buscarle otro nombre al nuevo porque
> **el viejo era el mal nombrado**: su propia ficha lo llama «el detector de
> secuencias de emergencia», y `juez` describía lo que hace este hito. Salió
> barato porque la medición dijo que **nadie lo importa**: `@anima/juez` aparecía
> 18 veces y ninguna era un `import` — sólo comentarios, prosa y el `name` del
> `package.json`. Los scripts de la raíz filtran por glob (`./ii/**`), así que no
> hubo lista que actualizar. Verde antes y después: **126 de 126**.

### M4 · EL VOCABULARIO DEL VEREDICTO NO EXISTE — cero líneas

```
grep -rn "injuzgable|inconcluso|promover|promocion" ii/packages/*/src
→ UNA sola coincidencia, y es un comentario en explorar.ts
```

`injuzgable`, `inconcluso`, promoción, regresiones: **nada escrito**. Todo el
hito es paquete nuevo, sin deuda previa que respetar.

### M5 · NO HAY QUIEN CONSTRUYA UN MUNDO DESDE `src` — hay tres copias en tests

El banco del juez necesita **mundos estadificados** (con río, sin río, con stock
vacío, con el dispositivo roto). Hoy:

```
lang/tests/mundo.ts · mind/tests/mundo.ts · perceive/tests/mundo.ts
```

Tres arneses de test, ninguno exportado desde `src`. Y el juez del Hito 8 corre
**en producción**, no en un test: la fragua le pide un veredicto con el mundo
andando. Así que el constructor de mundos del banco es **código nuevo de `src`**,
y hay que mirar si las tres copias ya divergieron antes de elegir cuál se
promueve.

---

## 1 · El criterio, punto por punto

**Ningún punto se da por cumplido sin su número medido al lado, y ningún hueco se
tapa aflojando un test.** Los seis del documento de arquitectura, cada uno con
cómo se afirma.

| | qué se afirma | cómo se mide |
|---|---|---|
| **1** | una habilidad que **sólo funciona donde la corrigieron** no promueve | control positivo: se degrada una innata a propósito para que gane en UN mundo, y el juez la rechaza |
| **2** | una de pesca **se juzga en mundos con río** y nunca saca un 0% falso | el banco se deriva del **contrato**: si `precondiciones` pide agua, los mundos sin agua no cuentan como fracaso |
| **3** | un contrato **insintetizable** devuelve `injuzgable` y **no siembra regresiones** | dos afirmaciones: el veredicto, y que la tabla de regresiones quede **vacía** |
| **4** | una **precondición espuria se borra** por ablación | se le agrega una precondición falsa a una innata que ya pasa, y la ablación la encuentra |
| **5** | **bajar un número de la física invalida los sellos que dependen de él** | ver M2 — hoy está en rojo y el mecanismo actual no lo cumple |
| **6** | el juez evalúa **por separado**: plano · construcción · uso · utilidad | un `BuildSkill` verde con `UseSkill` rojo es un **resultado legítimo**, no un error del arnés |

**Los mundos adversos que el banco tiene que incluir**, del caso de aceptación, y
son ocho: stock vacío · ubicación incorrecta · materiales alternativos ·
dispositivo roto · dos dispositivos compitiendo · restauración a mitad del ciclo ·
mundos reservados · ausencia de nombres especiales.

Más **1/3 adversario** y el **cuarto reservado** (mundos que el juez nunca le
muestra a la fragua, para que no se pueda sobreajustar a su propio banco).

### Y el punto que el criterio heredado NO tiene, que la medición M2 obliga a agregar

> **7** · Cambiar un número de la física y **no** tocar `PHYSICS_VERSION` tiene
> que ponerse rojo. Hoy da verde, y ya pasó.

No es un punto nuevo por gusto: el punto 5 pide que el sello se invalide, y **sin
el 7 el 5 se puede cumplir sobre el papel** —el mecanismo existe— mientras en la
práctica nunca dispara.

---

## 2 · Las tres decisiones, tomadas por el usuario antes de escribir código

Las tres salieron de las mediciones de la sección 0 y **no se vuelven a
preguntar**.

### D1 · El paquete nuevo es `@anima/judge`, y el viejo pasó a `@anima/emergencia`

Se renombró al viejo en vez de buscarle otro nombre al nuevo porque **el mal
nombrado era el viejo**. Hecho en el tramo A. El detalle y el porqué del bajo
costo, en M3.

### D2 · El juez se prueba contra las 17 innatas más variantes degradadas a propósito

**No hay habilidades forjadas todavía** —la fragua es el Hito 8— así que los
sujetos son los que hay. Se degrada una innata para que gane en UN mundo y el
juez tiene que rechazarla: es el mismo patrón de control positivo que los Hitos 5
y 6 ya usan, y el que el propio Hito 8 pide («una habilidad degradada a propósito
entra en la cola»).

**La alternativa descartada:** adelantar un pedazo de fragua para tener sujetos
forjados de verdad. Mezcla dos hitos, y deja al juez sin poder juzgarse a sí
mismo contra un resultado conocido de antemano — que es lo único que distingue un
juez que funciona de uno que siempre dice que sí.

### D3 · El sello se arregla con un guardián, y la dependencia por número queda medida

De las tres formas, se eligió **la barata que ataja el fallo real**:

- **ELEGIDA · un guardián.** Un test que se pone rojo si el contenido de la
  física cambia sin que `PHYSICS_VERSION` suba. **Habría atrapado el
  0,35 → 0,85**, que es el fallo que de verdad ocurrió (M2). No cambia el piso ni
  invalida ningún hash guardado;
- **descartada por ahora · versión derivada.** `version` calculada del contenido.
  Automático y sin disciplina humana, pero toca `@anima/physics`, que es el piso,
  y mueve todo hash que la incluya;
- **descartada por ahora · dependencia por número.** Cada sello registra qué
  números leyó. Es lo único que cumple la frase literal del criterio —«los sellos
  que dependen de ÉL»— y es el más caro con diferencia.

**El punto 5 se declara cumplido con el guardián más el punto 7.** Si la
dependencia por número no entra, entra como **hueco con `it.fails` y el número al
lado** — no como criterio aflojado. Ninguna de las dos descartadas lo fue por
mala: se posponen.

---

## 3 · Los tramos

### Tramo A — el renombre · CERRADO

`@anima/juez` → `@anima/emergencia`, en commit aparte y antes de escribir una
línea del hito, para que el renombre no se mezcle con trabajo nuevo.

**Medido antes de mover nada:** 18 menciones, **ninguna un `import`**. Los
scripts de la raíz filtran por glob, así que no hubo lista que actualizar.
Verde antes y después: **126 de 126**, 17 archivos, 77,5 s.

### Tramo B — el guardián del sello · CERRADO (puntos 5 y 7)

`physics/tests/el-sello-no-se-acuerda-solo.test.ts`, 5 tests.

**Primero se midió si el guardián hacía falta**, porque la respuesta barata era
«ya lo cubre `huella-de-conducta.test.ts`». **No lo cubre**, y la evidencia no es
un razonamiento: el commit `d825a69` —el que movió la eficiencia— tocó **20
archivos**, cuatro de ellos de `physics/tests`, y `huella-de-conducta` **no está
entre ellos**. El motivo es estructural: esa huella corre `paso()`, y `paso()` no
lee los números de un proceso — `leyes.ts` los menciona una sola vez y es para
transportarlos.

> **Y conviene decir la otra mitad, porque es la que sorprende: los tests SÍ
> atraparon el cambio.** Veinte archivos con números clavados se pusieron rojos y
> hubo que arreglarlos a mano. Lo único que sobrevivió callado fue **el sello**,
> que es justo la cosa que se inventó para esto.

**Qué quedó.** Los **591 números** de la física semilla, con su ruta y ordenados,
sellados en `el-sello-sellado.ts`. Si se mueve alguno, rojo, y **dice cuál**:

```
SE MOVIÓ UN NÚMERO DE LA FÍSICA Y «PHYSICS_VERSION» SIGUE EN 1.
MOVIDOS (1):
  processes.friccion.effects[0].poweredBy.efficiency: 0.84999999999999998 → 0.83999999999999997
```

Cuatro decisiones que valen su renglón:

1. **Números y nada más.** La prosa no entra. Este repo tiene encabezados
   enormes que cambian todo el tiempo, y un guardián que se pone rojo cuando
   alguien arregla una coma está desactivado en dos semanas.
2. **Los dos rojos dicen cosas distintas** —«no subiste la versión» contra
   «subiste la versión, falta re-sellar»— y los dos son rojos a propósito: toda
   recalibración pide un gesto humano deliberado.
3. **`toPrecision(17)`, no `String()`.** Un guardián que no distingue dos doubles
   distintos no ataja una recalibración fina.
4. **Las cualidades se indexan por `id`, no por posición.** Venían en un array y
   eran las únicas que se sellaban por orden: mover una fila en `quality.ts`
   habría dado un rojo falso. Hay un test que da vuelta las tres familias.

**Y hay un control positivo, que es la lección de M2 aplicada a este archivo.**
El guardián pasa hoy porque la física no cambió, o sea que **no prueba nada**
sobre si sabría atajar un cambio. El control mueve la eficiencia de vuelta a 0,35
—el número real que se movió sin que nadie lo notara— y afirma que el detector ve
**exactamente uno**.

**El hueco que la decisión D3 deja, con su número medido** (`it.fails` en el
mismo archivo):

| | |
|---|---|
| cualidades que los cuatro procesos semilla LEEN | **7** (`catch`, `flexibility`, `mass`, `reach`, `rigidity`, `stamina`, `tensile`) |
| números a los que su sello es SENSIBLE | **591** |
| de más | **84×** |

O sea que un sello de `friccion` —que sólo mira rigidez y aliento— muere porque
se movió la toxicidad del agua. Es el precio elegido a ojos abiertos: la
dependencia por número es la salida cara y espera al día que un sello
sobreviviente valga lo que cuesta.

### Tramo C — `@anima/judge` nace · CERRADO (punto 3, y la mitad del 6)

El paquete **once**. Depende de `physics`, `skills` y `world`; nadie depende de él.
10 tests, typecheck limpio.

#### M7 · `Verdict` ya estaba tomado TRES veces

`physics/src/admit.ts:280` (¿esta física es legal?), `skills/src/tipos.ts:367`
(¿esta intención salió?) y su copia en `skill-api.d.ts`. Un cuarto que quisiera
decir «¿esta habilidad es estable?» sería la clase de nombre que hace que alguien
importe el equivocado y **el tipo cierre igual**. Va en castellano, como todo
`@anima/lang`: **`Veredicto`**.

#### Los cuatro grados, y los dos que se confunden

`promueve` y `no-promueve` no necesitan defensa. Los otros dos parecen el mismo
«no sé» y son **responsabilidades distintas**:

| grado | qué pasó | culpa de |
|---|---|---|
| `injuzgable` | no se pudo ARMAR un mundo donde probarla | el **contrato** |
| `inconcluso` | se armaron, se corrieron, y el resultado no decide | el **banco** |

Manda sobre qué hacer después, que es para lo único que sirve un veredicto: un
`injuzgable` se arregla tocando el contrato y un `inconcluso` corriendo más
mundos. Y de ahí sale el punto 3: **un `injuzgable` no siembra regresiones**
porque nunca corrió nada.

#### M8 · ¿«insintetizable» es una categoría real? SÍ, y el motivo son los techos

Primero se volcaron los 17 contratos. **Las 17 son sintetizables**, o sea que las
innatas **no sirven de ejemplo** de `injuzgable` — el sujeto del punto 3 hay que
fabricarlo. Pero no se inventa: se apoya en un techo **medido** del catálogo.

| cualidad intensiva | techo real |
|---|---|
| `decay` | 0,14 |
| `toxicity` | 0,55 |
| `sharpness` | 0,85 |
| `rigidity` · `toughness` · `footing` | 0,98 |

Un contrato que pida `toxicity >= 0.6` **no se puede juzgar**: no existe materia
tan venenosa. Son **15 cualidades intensivas** con techo por debajo de su rango
declarado.

> **Y la tabla excluye a propósito `temperature` y `oxygen`**, que en la sonda dan
> 0,000. No son techos del mundo: son del arnés — el cuerpo nace frío y `oxygen`
> es de la celda. Publicarlas habría vendido un límite de la medición como si
> fuera del catálogo. El filtro es mecánico: entra lo que alguna sustancia declara
> en su `perUnitMass`, más lo derivado de eso.

#### DOS ERRORES MÍOS QUE LA MEDICIÓN VOLTEÓ, y los dos valen más que el resultado

**1 · Di por sentado que `catch>0` sería insintetizable.** El razonamiento venía
de una frase real de `process.ts` —«sin punta libre no hay `catch`»— leída como
si hablara de todos los casos. Habla de la caña armada. `freeStrandEnds` le da
**dos puntas libres a toda parte flexible sin juntas**: una hebra suelta ya
engancha, y `catch>0` sale eligiendo `savia`.

**2 · La primera medición probó cada precondición POR SEPARADO** y publicó «8 de
8 se eligen». Está mal: `unir` pide `flexibility>=0.8` **y** `tensile>=0.3` sobre
**el mismo cuerpo**, y dos conjuntos no vacíos pueden no cruzarse. El sintetizador
hace la conjunción, y el resultado es el que justifica la corrección:

```
flexibility>=0.8 sola     savia
tensile>=0.3 sola         raiz-dura
LAS DOS JUNTAS            liana      ← una tercera que ninguna búsqueda individual devolvía
```

Si `liana` no existiera, `unir` sería injuzgable **y la primera medición habría
dicho que todo bien**.

#### Y dos cosas que se respetaron en vez de romper

- **`src/innatas/` no se re-exporta desde `@anima/skills`** y es deliberado: «la
  frontera entre la caja y lo que corre adentro de la caja» tiene que verse en
  los imports. Había una puerta lateral —`@anima/skills/innatas`— dejada abierta
  «para el día que alguien las necesite». Se entró por ahí.
- **El guardián de la regla 2 recorre subdirectorios.** El de `@anima/lang` no lo
  hacía y un `src/sub/` entero quedaba sin mirar. Y trae su control positivo, que
  es la lección del tramo B: un detector verde por no haber nada que encontrar no
  prueba que sepa encontrar.

#### Y UN GUARDIÁN QUE NO ESTABA PLANEADO, porque rompí el árbol en el tramo A

La suite entera encontró que **`@anima/oracle` estaba roja desde el renombre**, y
la causa es que **mi medición del tramo A estaba incompleta**. Dijo «18
menciones, ninguna un `import`» y con eso se declaró contenido. Pero
`presupuesto.test.ts` no importaba el paquete viejo: **le leía un archivo por
ruta relativa**.

```ts
const arnes = fileURLToPath(new URL('../../juez/tests/el-banco-de-la-mente.ts', …))
```

Ni `@anima/juez` ni `packages/juez/` aparecen ahí, así que las dos búsquedas
dieron limpio y el árbol quedó roto **dos commits**. Y había **nueve más en
comentarios**: no rompían nada, pero mandaban al que las leyera a un directorio
que ya no existe.

De ahí salió `judge/tests/las-rutas-cruzadas-existen.test.ts`: toda mención de
`<paquete>/src/…` o `<paquete>/tests/…` en cualquier fuente de `ii/packages/`,
**venga de código o de prosa**, tiene que apuntar a un archivo que exista.

**La prosa entra a propósito, y es lo que lo hace valer:** un comentario que dice
«esto está medido en tal archivo» es una afirmación verificable, y una que apunta
a la nada es peor que ninguna — manda a buscar una evidencia que no está donde
dice.

**En su primera corrida encontró tres rotas más, ajenas a este hito:**

| dónde | apuntaba a | era |
|---|---|---|
| `lang/tests/mundo.ts` | `plan/tests/los-esquemas-contra-el-mundo.ts` | le faltaba `.test` |
| `mind/tests/mundo.ts` | ídem | ídem |
| `perceive/tests/las-quince.test.ts` | `physics/src/data/cualidades.ts` | es `physics/src/quality.ts` |

Barre **368 fuentes y 500 rutas**.

#### El estado del árbol al cerrar el tramo

**2804 tests verdes** en diez paquetes (+1 `skipped`, +1 `todo`),
`pnpm ii:test` **exit 0**, `pnpm ii:typecheck` limpio.

> **Y una corrida intermedia dio un rojo en `@anima/world` que NO se reprodujo.**
> Corriendo el paquete solo: 631 verdes, cero fallas; y la suite entera dio exit 0
> dos veces seguidas después. Es un flake, y el repo ya tiene documentada esa
> clase —aserciones de reloj de pared bajo contención, en la sección 2·bis de
> `como-se-trabaja.md`—. **Queda anotado sin identificar**, que es lo honesto: no
> se pudo decir cuál era porque no volvió a aparecer.

### Tramo D — el banco de mundos · CERRADO (puntos 1 y 2)

`judge/src/banco.ts` + `el-banco-sale-del-contrato.test.ts`. El paquete pasa de
14 a **26 tests**.

#### M5 se quedó corta: son CINCO copias, y dos son idénticas

La cadena está escrita en los encabezados de las propias copias:

```
world/tests/mundo-minimo.ts
  → perceive/tests/mundo.ts
    → plan/tests/los-esquemas-contra-el-mundo.test.ts
      → mind/tests/mundo.ts
        → lang/tests/mundo.ts
```

Y las dos últimas son **idénticas byte a byte en el cuerpo**: cero líneas de
diferencia sin comentarios. Sólo cambian los encabezados.

**La copia es deliberada y la razón está escrita:**

> los `tests/` de un paquete no se exportan, así que compartirlo exigiría mover
> el arnés adentro de `src/`, o sea meterle al paquete **un módulo que sólo
> existe para los tests**.

**Esa razón no aplica al juez, y por eso su banco está en `src/`.** El juez no
arma mundos para sus tests: los arma para trabajar. Del Hito 8 en adelante la
fragua le pide un veredicto **con el mundo corriendo**.

> **Y queda un hallazgo aparte, sin tocar:** la objeción **venció**. Ahora existe
> un consumidor de producción, así que el armado ya podría vivir en
> `@anima/world/src` y las cinco copias colapsar ahí. No se hizo en este tramo
> porque churnear cinco paquetes adentro de otro trabajo es cómo se pierde la
> atribución de un rojo.

#### El punto 2, hecho verificable

> una de pesca se juzga en mundos con río y **nunca saca un 0% falso**

Un banco escrito a mano saca 0% falsos todo el tiempo: el que lo escribe no sabe
qué necesita la habilidad, le pone mundos donde no puede andar y los cuenta como
fracasos. **Si los mundos salen del contrato, eso no puede pasar por
construcción.**

Las cuatro clases, y cada una falla distinto:

| clase | qué le pone delante | qué prueba |
|---|---|---|
| `holgado` | materia que cumple con margen | que ande en su casa |
| `al-borde` | la que cumple por el pelo | que no dependa de un margen |
| `justo-abajo` | la que NO cumple por el pelo | **que sepa NO andar** |
| `sin-nada` | ninguna materia | que no invente |

7 de 17 contratos piden materia y sacan 4-5 mundos con **2-3 adversos**: entre
el 50% y el 60%, holgadamente por encima del 1/3 que pide el criterio. Los otros
10 sacan **un** mundo no adverso — devolver lista vacía haría que el juez leyera
«no se pudo armar» y dijera `injuzgable` sobre algo perfectamente juzgable.

#### EL PRIMER BANCO QUE ESTE ARCHIVO PRODUJO TENÍA UN ADVERSARIO FLOJO

Y se vio mirando la salida, no razonando. El `justo-abajo` de `frotar` era
`raiz/vara`:

```
frotar pide:  rigidity>=0.5 · moisture<0.45
raiz/vara  →  rigidity=0.400 · moisture=0.480      ← falla LAS DOS
```

**Un adversario que rompe dos precondiciones a la vez prueba menos de lo que
parece:** si la habilidad lo rechaza, no se sabe por cuál. Se cambió a buscar
uno **por precondición** —que falle ésa y sólo ésa—, que además es exactamente
la forma que va a pedir la ablación del punto 4.

```
frotar, ahora:  grano/vara → rigidity=0.350 (falla) · moisture=0.120 (cumple)
```

**Y la cobertura se mide, no se supone: 8 de 9.** La que no se puede aislar
queda nombrada — `frotar` / `moisture<0.45`: no hay materia mojada en el catálogo
que además sea bastante rígida. No es un error del banco, es que el mundo no
tiene con qué.

#### El cuarto reservado, y por qué no se sortea

Uno de cada cuatro, **empezando por el segundo**. Sin azar porque el banco tiene
que ser reproducible (regla 2) — un veredicto que no se repite no es un
veredicto— y empezando por el segundo porque arrancar por el primero reservaría
siempre el `holgado`, que es el que menos defiende: guardar el mundo fácil no
guarda nada.

Hay dos tests de determinismo: dos corridas dan el mismo banco id por id, y dar
vuelta el orden de las sustancias no lo mueve (lo compra el desempate por clave,
que con umbrales redondos hace falta seguido).

#### El árbol al cerrar

**2816 tests verdes**, `pnpm ii:test` exit 0, `pnpm ii:typecheck` limpio.

### Tramo E — la ablación · CERRADO (punto 4)

`judge/src/ablacion.ts` + `judge/src/escena.ts`. El paquete pasa de 26 a **33
tests**.

#### Las dos piezas ya estaban, y las dos se escribieron ANTICIPANDO esto

1. **El dato.** El encabezado de `contrato.ts`: *«el juez del Hito 7 hace ablación
   de precondiciones. Una precondición escrita en prosa dentro de un comentario
   no se puede ablacionar. Escrita acá, sí.»*
2. **El mundo.** El `justo-abajo` por precondición del tramo D. Ese aislamiento
   no era un lujo — sin él no se puede atribuir el resultado.

Y hasta el sujeto se ofreció solo. `sostener`, sobre su heurística de qué soltar:

> Es una heurística escrita a mano, o sea exactamente el tipo de decisión que
> **el juez del Hito 7 tendría que ablacionar**.

#### Los dos controles, sobre la misma habilidad y la misma máquina

`sostener` **chequea su precondición en código** —`if (ctx.q(args.que,'portable')
< 1) return fail(…)`— así que el control negativo tiene la respuesta conocida de
antemano. Y antes de ablacionar nada se mide que la habilidad **corra**, porque
si no todo lo demás mide aire:

```
holgado      tuberculo/vara/1     → llegó en 3 ticks
justo-abajo  tuberculo/vara/20    → falló en 1 tick     (20 kg: portable < 1)

portable>=1   la usa    · no llegó en ninguno de los mundos que la violan
moisture<0.9  ESPURIA   · LLEGÓ en agua/vara: no la estaba usando
```

El positivo se fabrica: `moisture<0.9` no aparece en una sola línea de
`sostener.ts`. La ablación la encuentra **y no marca la de verdad** — un
ablacionador que marca todo no ablaciona.

#### EL ERROR QUE ESTE TRAMO DEJÓ ESCRITO: sintetizar y ablacionar fallan en puntas OPUESTAS

Escribí un test esperando que `toxicity>=0.6` diera «NO SE PROBÓ», razonando que
el catálogo llega a 0,55 y por lo tanto no hay con qué. **Esa cuenta vale para
sintetizar, no para ablacionar.** Son la operación inversa:

| | busca materia que… | falla cuando… |
|---|---|---|
| sintetizar | **cumpla** el predicado | nadie llega — `toxicity>=0.6` |
| ablacionar | **lo viole** | nadie lo viola — `toxicity>=0` |

Un predicado imposible es el **más fácil** de ablacionar: lo viola el catálogo
entero. Los dos casos quedaron como tests y el error quedó escrito, porque es la
clase de simetría falsa que se cuela sola.

#### Y lo que NO se pudo probar se DICE

Una precondición sin mundo aislado sale **«NO SE PROBÓ»**, no «no espuria».
Declarar buena algo que nunca se corrió es el verde por omisión que este hito
viene encontrando en todos lados — el sello del tramo B, el guardián del C, el
detector del D. Acá se distingue por construcción.

#### El hueco medido que este tramo no puede cerrar

**El juez no puede invocar una habilidad sin saber sus argumentos.** `sostener`
pide `{ que: BodyView }`, `frotar` pide otra cosa, y no hay en el árbol ningún
esquema que lo diga: los args viven en el tipo de TypeScript, que en tiempo de
corrida no existe.

Así que los trae quien acusa (`Sujeto.argsDe`). **No es una comodidad de prueba:
es la frontera real del hito.** Del Hito 8 en adelante la fragua produce el
paquete entero y ahí los args son parte de lo forjado.

#### Y la escena es POBRE a propósito

Dos cuerpos: la criatura y el objetivo, a una celda. Un mundo con veinte cuerpos
alrededor le da a la habilidad veinte formas de acertar por accidente, y el
veredicto deja de hablar de ella. A una celda y no encima porque un `goTo` roto
pasaría desapercibido si ya estuviera donde tiene que estar.

#### El árbol al cerrar

**2823 tests verdes**, `pnpm ii:test` exit 0, `pnpm ii:typecheck` limpio.

### Tramo F — el veredicto · CERRADO (puntos 1 y 6)

`judge/src/juzgar.ts`. El paquete pasa de 33 a **47 tests**.

**Fue último a propósito.** Un juez que pone notas antes de tener con qué
medirlas siempre dice que sí.

#### Lo que arregla, y es lo que faltaba de verdad

Hasta acá el juez leía `outcome.ok`, que es **lo que la habilidad dice de sí
misma**. El cargo `uso` no le cree: agarra el `establece` del contrato —la
promesa, escrita como dato— y la verifica **contra el mundo que quedó**.

#### Los tres sujetos, y dos son mentirosos fabricados

Un juez que sólo acierta con la habilidad honesta no sirve.

```
── sostener (honesta) → INCONCLUSO ──
  plano         promueve     [4/4]  se sintetiza con carne/vara
  construccion  promueve     [4/4]  llegó en los 2 amables y se plantó en los 2 adversos
  uso           promueve     [4/4]  2 de 2 promesas verificadas contra el mundo
  utilidad      inconcluso          no hay contra qué

── mentirosa (dice que sí y no hace nada) → NO-PROMUEVE ──
  construccion  no-promueve  [3/4]  anduvo en 1 mundo(s) donde su contrato dice que no puede
  uso           no-promueve  [3/4]  DIJO QUE SÍ Y NO ES CIERTO: yo:holding>=1
  regresiones: sostener·justo-abajo·tuberculo/vara/20 (que NO llegue)

── sobreajustada (sólo con la materia que practicó) → NO-PROMUEVE ──
  construccion  no-promueve  [3/4]  SÓLO FUNCIONA DONDE LE CONVIENE
  uso           promueve     [3/4]  1 de 1 promesas verificadas contra el mundo
  regresiones: sostener·al-borde·agua/bloque/0.05 (que llegue)
```

**El punto 1 sale solo del cargo `construccion`** y no necesitó mecanismo
propio: la diferencia entre el mundo `holgado` y el `al-borde` ES la pregunta.
Y la sobreajustada muestra el punto 6 en acción: **`uso` verde con
`construccion` rojo** — tiene razón sobre lo que hizo, y no sirve igual.

#### `utilidad` sale `inconcluso`, y arrastra el dictamen entero

Es el primer productor de ese grado — hasta acá existía como palabra y no lo
devolvía nadie.

«Sirve» es una pregunta **con respecto a algo**, y ese algo es un objetivo. Hasta
el Hito 8 nadie le pide nada a una habilidad. Medirlo igual exigiría inventar un
criterio de utilidad acá adentro, que es lo que este hito viene evitando en cada
tramo.

> **Consecuencia, y hay que decirla:** con `utilidad` en `inconcluso`, **nada
> promueve todavía**. El juez está completo para RECHAZAR y no para APROBAR — y
> lo dice en vez de disimularlo. Los dos mentirosos se caen igual, que es lo que
> el criterio pide.

### Tramo G — los ocho mundos adversos, medidos · 3 de 8

`los-ocho-mundos-adversos.test.ts`. El paquete pasa de 47 a **55 tests**.

**Este tramo es una MEDICIÓN antes que ocho mundos**, y el porqué es que al
medirlos aparecieron tres cosas que la lista no dejaba ver:

```
✓ mundos reservados                el cuarto reservado del banco, tramo D
✓ ausencia de nombres especiales   world/tests/sin-nombres-especiales.test.ts
✓ materiales alternativos          la clase `alternativo`, nueva en este tramo
⊘ dispositivo roto                 el mundo no sabe qué es «roto»
· stock vacío                      habla de un dispositivo sobre un pozo
· ubicación incorrecta             habla de dónde se desplegó
· dos dispositivos compitiendo     dos `Desplegado` sobre el mismo pozo
· restauración a mitad del ciclo   guardar y cargar con la obra a medio ciclo
```

**1 · Dos ya estaban, y no en este paquete.** Contarlos como pendientes es la
otra cara del verde por omisión. Y no se afirman: se **verifican** — el guardián
de nombres especiales se lee del disco, porque uno que se borró deja el renglón
en verde si sólo se mira el nombre.

**2 · Uno no se puede escribir.** El mundo no tiene estado «roto», ni cualidad de
integridad, ni nada que `stepWorld` mire. **No es un mundo que falta, es una
capacidad.** Hay un test que barre el catálogo buscando `integr|roto|broken|
damag|wear|desgast` y afirma **cero** — el día que alguien agregue una, ese rojo
es el disparador para escribir el mundo.

**3 · Los cuatro que quedan piden otro SUJETO, no otro mundo.** Hablan de un
dispositivo desplegado sobre un pozo, y el sujeto del juez hoy es una habilidad
con un objetivo delante. La razón está medida, no opinada: `escena.ts` arma dos
cuerpos, `cells: new Map()` y **sin dios**, y hay un test que lo lee del archivo.
Meterlos sin cambiar el sujeto daría cuatro mundos que no juzgan a nadie.

> `usar` es el puente al caso de aceptación —precondición `catch>0`, establece
> que la obra quede puesta— y su banco hoy son 5 mundos de materia suelta, sin un
> pozo a la vista.

#### Lo que sí entró: materiales alternativos

Es el único de los ocho que cabe en el sujeto actual. **Otra sustancia que cumple
lo mismo**, y no es adversa: la habilidad tiene que andar. Es el mundo que
discrimina a la que se aprendió el material en vez de la propiedad.

| contrato | holgado | alternativo |
|---|---|---|
| `juntar` · `sostener` | tuberculo | tendon |
| `comer` | grasa | medula |
| `unir` | liana | piel |
| `deshilachar` | tendon | cuero |
| `frotar` | pedernal | piedra |
| `usar` | tendon | savia |

Con su aserción de que la sustancia es **de verdad otra** en los 7 — sin eso la
clase sería el mismo mundo con otro nombre. El adverso baja de 50% a 40% y sigue
holgadamente arriba del 1/3.

### Tramo H — el segundo sujeto: un dispositivo desplegado · CERRADO

`judge/src/dispositivo.ts`. El paquete pasa de 55 a **70 tests**.

Es el sujeto del caso de aceptación —**un aparejo que trabaja solo**— y el que
destraba los cuatro mundos que el tramo G no podía escribir.

#### Lo que este sujeto compra: `utilidad` deja de ser `inconcluso`

Para una habilidad, «sirve» era una pregunta sin con-respecto-a-qué. Para un
dispositivo hay una respuesta y es un número: **`desplegados.get(id).captura`**.

```
── aparejo → PROMUEVE ──
  plano         promueve  [5/5]  catch = 0.150
  construccion  promueve  [5/5]  quedó desplegado en los 4 mundos donde se lo puso sobre el pozo
  uso           promueve  [5/5]  se quedó quieto en los 2 mundos donde no hay nada que sacar
  utilidad      promueve  [5/5]  sacó 3 pieza(s) en 400 ticks, sola
```

**Es lo primero del proyecto que PROMUEVE.** Con una habilidad como sujeto nada
podía: `utilidad` salía `inconcluso` y el dictamen toma la peor nota.

Y no hay contrato acá. Un dispositivo no habla: lo único que promete lo dice su
geometría —`catch > 0`, derivada de las puntas sueltas— y el juez lo lee del
cuerpo. Es el punto 12 del gate: si declarara lo que hace, habría dónde escribir
«trampa».

#### TRES ERRORES QUE LOS TESTS AGARRARON, y los tres eran míos

**1 · Vaciar un pozo de la forma obvia NO HACE NADA.** `stockDe` busca el stock
vivo y **si no lo encuentra cae al DECRETO**, y `dios.stocks` está vacío hasta
que alguien lo toca —medido: sigue en cero después de tres ticks—. Mapear esa
lista poniendo `amount: 0` recorre un array vacío. El aparejo sacó **3 piezas de
un pozo supuestamente agotado** y el test lo agarró.

**2 · Y con el stock vivo en cero seguía sacando UNA, y estaba bien.** El pozo
repone `perMillePorSegundo = 225`, o sea **4,5 individuos en los 20 segundos** de
la corrida: el aparejo pescó uno que apareció de verdad.

> **Un pozo que se repuebla no está vacío**, y medir «vacío» sin congelar la
> reposición mide la tasa de reposición en vez del dispositivo. La corrección no
> fue aflojar la aserción a «saca menos»: fue construir bien el mundo
> —`amount: 0` **y** `perMillePorSegundo: 0`— y dejar el cero.

**3 · El cargo `construccion` castigaba al aparejo por un mundo diseñado para
estar mal.** Miraba los cinco mundos y sacaba «se cayó del despliegue» con los
cinco comportándose como debían. Medido: en `ubicacion-incorrecta` el mundo **no
registra el `Desplegado`** —no se puede dejar un aparejo en tierra seca— y eso es
el resultado correcto de ESE mundo. Ahora mira sólo donde se lo puso sobre el
pozo, y quien cobra el otro caso es `uso`.

#### Los dos controles que no son adversos

`dos-compitiendo` y `restauracion-a-mitad` no esperan un fracaso: son controles
de que **el mundo no se rompe**.

| control | medido |
|---|---|
| dos aparejos sobre el mismo pozo | uno solo saca 3 · dos juntos sacan **3 entre los dos** — se reparten, no se duplican |
| cortar el ciclo, copiar el estado y seguir | **3 y 3**: idéntico |

El primero es el que más importa: si dos aparejos sacaran cada uno lo que saca
uno, el pozo sería una fuente infinita y la economía entera se cae.

#### El octavo: «dispositivo roto» parecía imposible y no lo era

El usuario dijo: *«en este mundo no habrá dispositivos rotos»*. Antes de sacar un
punto del criterio se aplicó la regla del ADR II-0024 —**preguntar para qué
estaba**— y la medición dio vuelta la premisa.

**El mundo ya rompe dispositivos, y nadie lo programó.** La ley 4 le escribe
`flexibility: 0.02` al residuo de lo que arde (`leyes.ts:1499`), y
`freeStrandEnds` —lo único que da `catch`— sólo cuenta partes con `>= 0.80`.
Medido, con el umbral exacto:

```
hebra con flexibility 0.80   →  catch 0.150
hebra con flexibility 0.79   →  catch 0.000   ← dejó de pescar
hebra con flexibility 0.02   →  catch 0.000   ← lo que la ley 4 le pone a lo quemado
```

Así que no era «no existe»: era «no lo modelamos como mecánica», **y el mundo lo
produce igual, por el fuego**. Con la medición delante el usuario eligió
agregarlo, y salió en diez líneas porque el mecanismo ya estaba en la física.

> **Y MI PRIMERA SONDA DIJO LO CONTRARIO.** Corrió el aparejo al fuego, bajo el
> agua y a la intemperie, y `catch` quedó clavado en 0,150 en los tres. Era falso,
> y lo delató **el control que le puse a la propia sonda**: `charred 0` después de
> 60 s a 800 °C, o sea que `paso()` no había corrido ni una ley. La sonda estaba
> verde por no hacer nada — la tercera vez en este hito que un control positivo
> salva la conclusión.

El número de lo quemado **no se eligió acá**: se copia de la ley, y hay un
guardián que lee `leyes.ts` y se pone rojo si se mueve.

**Los ocho: 8 de 8.**

---

## 4 · ESTADO: el criterio CIERRA, la descripción NO

Es el mismo patrón que el Hito 6, y por eso se busca a propósito.

### Los siete puntos del criterio

| punto | estado | dónde |
|---|---|---|
| 1 · la sobreajustada no promueve | **cumple** | tramo F |
| 2 · el banco sale del contrato | **cumple** | tramo D |
| 3 · `injuzgable` sin regresiones | **cumple** | tramos C y F |
| 4 · ablación | **cumple** | tramo E |
| 5 · el sello se invalida | **cumple** | tramo B |
| 6 · los cuatro cargos por separado | **cumple** | tramo F |
| 7 · la física no cambia sin la versión | **cumple** | tramo B |

**2837 tests verdes**, `pnpm ii:test` exit 0, `pnpm ii:typecheck` limpio.

### Lo que la DESCRIPCIÓN nombra y todavía no está — cuatro cosas

1. **«mundos estadificados».** Sigue faltando en general, aunque el tramo H
   trajo el primero de verdad: `restauracion-a-mitad` **agarra el ciclo por la
   mitad**, copia el estado entero y sigue. Los otros —media obra armada, algo a
   medio arder— no están.
2. ~~Los ocho mundos adversos del caso de aceptación~~ — **CERRADO: 8 de 8**
   (tramos G y H).
3. **«regresiones con snapshot real».** Se guarda el **id del mundo** (y la
   semilla, en las de dispositivo), no un snapshot. Como el banco es determinista
   el id lo rearma exacto —discutiblemente mejor que un snapshot, que se puede
   quedar viejo— pero **no es lo que dice la descripción**.
4. **El panel del juez** («se puede mostrar»). No existe.

### Y los dos huecos medidos que quedan abiertos

| hueco | número |
|---|---|
| el sello depende de 591 números y los procesos leen **7** | 84× de más · `it.fails` en `physics` |
| el juez no sabe los args de una habilidad | los trae quien acusa; la fragua los produce desde el H8 |

