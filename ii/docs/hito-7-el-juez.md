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

### Tramo B — el guardián del sello (puntos 5 y 7)

*(en curso)*

