# Hito 8 — La fragua, la escalera y el carril de mejora

**Qué es, en una frase:** que la criatura **escriba una habilidad que no tenía**,
con el mundo corriendo y sin perder un tick.

Es el primero donde el modelo produce **código que se ejecuta**. Hasta acá
proponía lecturas (Hito 6) y nada más.

---

## 0 · Las mediciones que se hicieron ANTES de escribir el criterio

### M1 · De la fragua no existe NADA — cero líneas

```
grep -rn "BlueprintCandidate|BuildSkill|UseSkill|Candidata" ii/packages/*/src
→ sólo menciones en comentarios de @anima/judge, ninguna definición
```

Es el hito más grande del plan (4-5 semanas) y arranca en blanco. Lo que **sí**
está y es suyo: el juez (Hito 7), que es quien dice si lo forjado sirve.

### M2 · LA PUERTA LOCAL ES ~140× MÁS BARATA QUE UN VIAJE, y ya estaba medido

El banco del Hito 0 (`skills/banco/typecheck.mjs`) se corrió de nuevo hoy:

| | medido | presupuesto |
|---|---|---|
| typecheck con **ranura fija** (`LanguageService`, la candidata siempre en el mismo path) | p50 **47 ms** · p95 **87 ms** | 90 / 250 ✔ |
| el mismo tibio **mal llamado** (`createProgram` por candidata) | +319 ms por candidata (2,9×) | — |
| **reparar y rechazar localmente** | **168 ms** | — |
| **un viaje al modelo** | **6 a 25 s** | — |

**Eso manda sobre toda la arquitectura**, y el banco lo dice con todas las
letras: *«el typecheck local es viable como puerta antes del viaje al modelo»*.
Y la segunda fila importa igual: **la forma de llamar a la API ES el
presupuesto** — el mismo trabajo, mal pedido, cuesta 10×.

### M3 · El cliente del proveedor YA ESTÁ ESCRITO, y fuera de `src/` a propósito

`lang/demo/proveedor.ts` habla con Claude, Codex y OpenAI. Vive en `demo/` porque
la **regla 2** prohíbe `await` en los `src/`. Este hito le da casa.

**Lo que migra a `@anima/llm` es el CLIENTE, no la frontera.** El patrón del Hito
6 —el paquete DESCRIBE la consulta y el llamador, que sí puede esperar, la
manda— es el mismo que necesita la fragua, y no se rehace.

### M4 · «HTTP con streaming» dejó de ser preferencia y es un número

El puente del Hito 6 mide **14 s y US$ 0,0158 por frase** con el CLI, de los
cuales **~10 s son arranque de proceso**: la sonda directa dio 4 s. El camino
HTTP no compra estilo, compra diez segundos.

### M5 · `ticksPerdidos` existe y tiene su definición escrita

`perceive/src/bucle.ts`, con el encabezado que dice por qué —*«un contador sin
definición no mide nada»*—. El criterio de este hito pide `ticksPerdidos === 0`
durante todo el episodio y **no hay que inventar el contador**.

---

## 1 · El criterio, punto por punto

Los del documento de arquitectura, con cómo se afirma cada uno.

| | qué se afirma | cómo se mide |
|---|---|---|
| **1** | dado el gap «conseguir alimento de un cuerpo de agua», **al menos una de dos candidatas compila sin reparación** | K=2 por viaje, con el typecheck de ranura fija |
| **2** | y **al menos una compila con reparación** | las reparaciones deterministas, sin volver al modelo |
| **3** | **matar la conexión a mitad de un parche** no deja el mundo inconsistente | `AbortController` + aplicación en frontera de tick |
| **4** | el episodio completo **no supera N consultas** | test de presupuesto en CI |
| **5** | **`ticksPerdidos === 0`** durante todo el episodio | el contador que ya existe |
| **6** | una habilidad **degradada a propósito** entra en la cola, se re-forja en el fondo y la ganadora **reemplaza sin perder un tick** | el carril de mejora |
| **7** | una candidata **peor no reemplaza nada** y queda archivada como regresión | el duelo contra la titular, en sus propios mundos |
| **8** | con la **cuota agotada**, la cola **no dispara ni una consulta** | el presupuesto como puerta, no como aviso |

**Y el juez del Hito 7 es quien contesta el 6 y el 7.** No hay que escribir un
segundo criterio de «mejor»: `juzgar()` ya da cuatro cargos y un grado, el banco
sale del contrato y el duelo es comparar dos dictámenes sobre **los mismos
mundos**.

### Lo que el caso de aceptación suma

La fragua deja de producir un archivo y produce **un paquete**:

```
BlueprintCandidate + BuildSkillCandidate + UseSkillCandidate
  + dependencias + capacidades publicadas
```

Con **cuarentena**, **reparaciones limitadas**, **máximo de consultas**,
**aplicación en frontera de tick**, **digest base esperado** y **rechazo si el
catálogo cambió**.

Y un lint más: **prohibido copiar constantes físicas dentro de las skills** — un
literal de calibración adentro de una habilidad es un sello que
`physicsVersion` no puede invalidar.

> **Ese lint tiene su hermano ya construido.** El guardián del sello (Hito 7,
> tramo B) sella los 591 números de la física y dice cuál se movió. Un literal
> copiado adentro de una skill es exactamente lo que ese guardián **no** puede
> ver, y por eso el lint va aparte.

### Y el punto que el criterio heredado NO tiene, que lo pidió el usuario

> **9** · Una candidata que falla **alimenta a la siguiente**, y la siguiente
> mejora **en los mundos que no le contaron**.

La pregunta que lo abrió: *«en caso de que el código sea malo, ¿eso entra como
contexto para el siguiente? Capaz que con un pequeño cambio se lo arregla, en
vez de crear una habilidad nueva desde cero»*.

**El criterio heredado sólo cubre la mitad barata.** Las «reparaciones
deterministas» arreglan lo que no compila —falta un tipo, sobra un import— y no
tocan el caso que importa: **compiló bien y no sirve**. Ahí, hoy, el plan
empieza de nuevo con una hoja en blanco.

#### El material ya existe, y es el juez

`Dictamen` no dice «no promueve» y listo. Dice cuatro cargos por separado, cada
uno con su `porque` **en castellano llano**, y las regresiones con el mundo:

```
construccion  no-promueve   SÓLO FUNCIONA DONDE LE CONVIENE
uso           promueve      1 de 1 promesas verificadas contra el mundo
regresión: sostener·al-borde·agua/bloque/0.05  (se esperaba que llegue)
```

Se escribió así para que un panel lo mostrara sin traducir. Resulta que también
sirve para lo otro.

#### LA TRAMPA, y el guardián ya estaba puesto

**Si se le cuentan todos los mundos donde falló, aprende los mundos y no la
habilidad.** Es decirle a alguien las preguntas del recuperatorio: aprueba y no
sabe más.

Y eso ya está atajado, aunque se haya construido por otro motivo: el juez reserva
**un cuarto de los mundos y nunca los muestra** (Hito 7, tramo D). El encabezado
lo dice con estas palabras: *«sin esto, una fragua que ve el banco puede ajustar
contra él y aprobar sin aprender»*.

#### DECIDIDO: se le cuenta el QUÉ y el PORQUÉ, no el DÓNDE

De los tres niveles posibles:

| nivel | qué se le pasa | por qué no |
|---|---|---|
| sólo el **qué** | «no sirve» | no alcanza para arreglar nada |
| **← el qué y el porqué** | «funciona sólo con la materia que practicaste» | **elegido** |
| el qué, el porqué y el **dónde** | el mundo exacto, con su materia | el más rápido y el que más lo hace copiar |

**Y los mundos reservados no entran nunca, en ningún nivel.**

#### Cómo se afirma, que es la parte que lo hace un criterio y no una idea

Comparando **dónde** mejoró:

> la segunda candidata tiene que mejorar en los mundos **reservados**, no sólo
> en los que le contaron.

Si mejora únicamente en los mundos que se le nombraron, **memorizó**, y eso es un
resultado distinto de «aprendió» — con el mismo verde por delante si nadie los
separa. Es la misma forma que el control positivo del `al-borde` del Hito 7: dos
series que desde afuera son idénticas y hay que partirlas por construcción.

---

## 2 · La decisión, tomada por el usuario antes de escribir código

### D1 · SIN LÍMITE, pero con contador

**Decidido, en dos pasos y el segundo dio vuelta al primero.**

Primero fueron **cuotas separadas** —un tanque para cada carril— y después el
usuario sacó los tanques: *«no quiero que tengan tanques, quiero que sea
ilimitado»*. **La criatura aprende todo lo que quiera.**

Antes de borrar nada se preguntó **qué protegía el límite**, que es la regla del
ADR II-0024. El plan lo dice con todas las letras:

> si no se diseña temprano, **la factura decide la arquitectura por vos**

Y hay un dato duro: **nadie sabe todavía cuánto sale un episodio de la fragua**.
El contador es cómo se averigua; sin él se averigua por el resumen de la tarjeta.

Así que se separaron dos cosas que parecían una: **el TOPE se fue, la MEDICIÓN
se quedó.** El techo existe **apagado**, y sólo lo enciende quien corre el test
de CI —«el episodio completo no supera N consultas»—, que es un guardián de
regresión: si un cambio lleva un episodio de 8 llamadas a 400, tiene que verse en
un test.

**`Infinity` y no `undefined`**, y no es un detalle de estilo: la aritmética es
la misma con techo y sin techo, así que **el camino que usa el juego es el mismo
que prueba CI** y no pueden divergir.

#### Y siguen siendo dos carriles, aunque ya no compitan

Ya no es para que uno no mate de hambre al otro —sin tope no hay hambre—. Es
porque **«gastamos 3000 milésimas» no dice nada y «la fragua gastó 2800 y el chat
200» sí**. Los dos consumidores tienen costos por operación muy distintos, y
sumarlos esconde justamente al que se fue de escala.

---

### Lo que la decisión de cuotas separadas decía, y se conserva porque explica el camino

Se descartaron las dos prioridades —«la fragua manda» y «el chat manda»— y las
dos tenían un argumento real:

- **la fragua manda:** el chat sabe degradarse (entiende 9% en vez de 30% y sigue
  contestando, que es el piso del ADR II-0024) y la fragua sin cuota **no hace
  nada**;
- **el chat manda:** protege lo que el usuario siente en el momento.

Cuotas separadas compra **predictibilidad** a cambio de plata ociosa cuando un
carril no usa la suya, y saca del medio el caso que más asusta: que un chat
activo deje a la criatura sin aprender nunca.

#### Y EL REPARTO NO SE ELIGE A DEDO

Es la regla que este repo ya pagó tres veces —el `80%`, el `200` y el `110` del
Hito 6—: **un número puesto antes de medir defiende otra cosa de la que parece**.

Así que el reparto entra como **parámetro con default documentado**, y lo que el
criterio afirma no es el número sino el invariante:

> **ningún carril pasa de lo suyo, y con su tanque en cero no dispara ni una
> consulta.**

Eso es verificable con cualquier reparto. La primera corrida de verdad fija la
línea base, igual que la cobertura del chat: *presupuestos, no mediciones*.

---

### Lo que la decisión reemplaza

*(el planteo original, que se conserva porque explica de dónde salió)*

### D1 · El presupuesto tiene DOS consumidores y la política de descarte no está decidida

Está anotado desde la tercera enmienda del [ADR II-0024](decisions/II-0024-el-piso-del-chat-no-es-sin-llm-es-sin-espera.md)
y es lo primero que este hito tiene que escribir.

El presupuesto por sesión se pensó **para la fragua**, que se usa poco. Desde el
Hito 6 el chat también consulta, se usa mucho más y **tiene otra urgencia**:

| | tarda | ¿puede esperar? |
|---|---|---|
| la fragua | 6-25 s (caso frío) | **sí** — la criatura sigue con lo que sabe |
| el chat | tiene que no hacer esperar | **no** — es el punto 2 del Hito 6 |

Con qué prioridad se descarta cuando los dos compiten por la misma cuota es una
decisión de producto, no una de implementación.

---

## 3 · Los tramos

### Tramo A — el contador de dos carriles · CERRADO

Nace `@anima/llm`. **Sin límite por decisión del usuario**, pero el contador
queda: el tope se fue, la medición no. `Infinity` y no `undefined` para que el
camino que usa el juego sea el mismo que prueba CI. 17 tests.

### Tramo B — LA PUERTA · CERRADO

Nace `@anima/forge` con `src/puerta.ts`: el typecheck de ranura fija que rechaza
una candidata **sin gastar una consulta**. 14 tests.

El orden lo mandó el número: **47 ms contra 6-25 s, ~140×**. Toda candidata pasa
por acá antes de que nadie abra la boca.

#### Se midió contra un corpus que YA EXISTÍA

No se inventó nada: `skills/borradores/` tiene **28 habilidades escritas a mano**
para medir si la API alcanzaba. Son candidatas de verdad, escritas por alguien
que intentaba que compilaran — que es lo que la fragua va a recibir del modelo.

```
28 borradores · compilan 3 · fallan 25 · 83 errores

TS2339   29   Property 'ticksToNightfall' does not exist on type 'Clock'
TS2322   22   Type '"wet"' is not assignable to type 'QualityId'
TS2345   20   Argument of type '"combustion"' is not assignable to 'SeedProcessId'
```

#### EL HALLAZGO: los tres errores más comunes son EL MISMO error

**86% de los errores son «inventó un nombre que la API no tiene»** — una
propiedad, una cualidad, un proceso. Tres vocabularios **cerrados** y un solo
modo de fallar.

Eso **cambia el diseño de las «diez reparaciones deterministas»** que el criterio
pide: no son diez reglas sueltas. La dominante es UNA sola —«ese nombre no
existe, acá está el catálogo»— aplicada a distintos catálogos. **Escribir diez
antes de esta medición habría repartido el esfuerzo al revés**, que es
exactamente el vicio del `80%`, el `200` y el `110` del Hito 6.

> Y la cuenta **no es la que decía la auditoría vieja**: `escalera-capacidades.md`
> dice 112 errores y hoy salen 83. No se copió el número, se corrió. Queda dicho
> que son dos y cuál es el de hoy.

#### EL GUARDIÁN DEL HITO 5 ME FRENÓ, Y TENÍA RAZÓN

`@anima/forge` nació con `typescript` en `dependencies`, y el criterio del Hito 5
dice que **ningún paquete de `ii/` depende en runtime de nada que no sea `ii/`**.
El guardián lo agarró en la suite entera.

**No se aflojó el test.** Su propio comentario ya había previsto el caso —*«
`typescript` y `vitest` son `devDependencies` y no entran acá»*— y el patrón
estaba resuelto en `@anima/skills`: `ApiTS = typeof import('typescript')` es un
import **de TIPO**, que TypeScript borra, y el objeto real lo pone quien llama.

Es la misma frontera que el Hito 6 fijó para el modelo: **el paquete describe, el
llamador provee.** `Puerta` ahora recibe la API de TypeScript por constructor.

> El precio: los tres enums (`ES2022`, `ESNext`, `Bundler`) quedan escritos como
> enteros, porque viven en el objeto que se recibe y `OPCIONES` es constante de
> módulo. **Van con su guardián**: un test los compara contra la API de verdad,
> para que no deriven en silencio si TypeScript los renumera.

### Tramo C — las reparaciones · CERRADO

`judge`… no: `forge/src/reparar.ts`. 7 tests más, 21 en el paquete.

#### De dónde sale el nombre correcto, con las dos fuentes MEDIDAS

**1. El mensaje de error: NO sirve.** De los 71 errores de esa clase, **cero**
traen «Did you mean». Se contó antes de descartarlo.

**2. El servicio: SÍ.** `getCompletionsAtPosition` en la posición del error
devuelve los nombres legales ahí — es lo mismo que le muestra a un editor:

```
ticksToNightfall  →  dayLength · phase · secondsToNightfall
```

Y la tercera que **no** se eligió: copiar los catálogos al lado de los de
`@anima/physics`. Es la duplicación que queda vieja en silencio, lo mismo que el
guardián del sello del Hito 7 existe para atajar. **El compilador no puede quedar
viejo respecto de sí mismo.**

#### EL EMBUDO, y corrige una afirmación mía del tramo B

Dije que el 86% era «un solo error con tres caras». **Esa lectura era mía y
estaba de más.** Medido escalón por escalón:

```
errores de la clase   71
con nombre extraído   66     ← 5 no son nombres: son formas de objeto
con candidatos        44
dentro del corte       7     ← sólo éstos son typos
```

#### «INVENTÓ UN NOMBRE» SON DOS COSAS, y sólo una se repara acá

| | ejemplo | ¿hay algo parecido? |
|---|---|---|
| **un typo** | `ticksToNightfall` → `secondsToNightfall` | sí, a 7 letras |
| **un concepto que el mundo no tiene** | `hunger` · `stock` · `smoke` · `threat` | **no, porque no existe la cosa** |

**34 conceptos contra 7 typos.** La lista entera sale por consola:

```
abort · afilar · ahumar · arrastrar · behind · buoyancy · cavar · charred ·
combustion · cost · covers · cubrir · estimate · flow · fuelEnergy · give ·
heard · hunger · isNight · mass · mine · needs · perceptionRadius · presence ·
project · qualifies · raining · sheltered · smoke · stock · threat ·
velocityOf · wet · wetAt
```

Los conceptos **no se pueden reparar localmente por definición**: no hay «el
nombre correcto» cerca porque no hay nada cerca. Y son exactamente el material
del **punto 9** —la candidata que falla alimenta a la siguiente—: lo que hay que
contarle al modelo es que pidió una cosa que no existe.

> **El trabajo se reparte solo.** La puerta arregla los typos gratis; los
> conceptos inventados son lo que va al segundo intento. No hacen falta diez
> reparaciones: hacen falta una y un buen mensaje.

#### EL CORTE, que es lo que impide reparar mal

Un tercio del nombre, con piso de 2. Con un corte grande `'wet'` matchea
`'catch'` y la reparación **inventa una conducta distinta en vez de arreglar un
typo**. Tiene su test.

**Prefiere no reparar antes que reparar mal:** una candidata que no compila
cuesta 47 ms; una que compila y hace otra cosa cuesta un viaje al juez y un
veredicto equivocado.

Y el test que lo cuida por el otro lado: **`empeoraron === 0`**. Una reparación
que convierte un error en dos es peor que no reparar.

### Tramo D — el punto 9 · CERRADO (la mitad que no pide red)

`forge/src/encargo.ts`. 28 tests en el paquete.

**El tramo se partió en dos y esta es la mitad que se puede probar entera sin
red.** La otra —mudar el cliente y pasarlo a HTTP, que compra los 10 s de
arranque de proceso— va aparte, porque mezclar una decisión de diseño con una
mudanza esconde a las dos.

#### La frontera es la del Hito 6 y no se rehace

`@anima/lang` ya lo resolvió: el paquete **describe** la consulta como dato y el
llamador —que sí puede esperar— la manda. Su `Consulta` lleva adentro el
vocabulario del que el modelo puede elegir, y el porqué vale igual acá: *«el
catálogo es core más overlay por sesión; un prompt con una lista fija le
ofrecería al modelo metas que esta partida no puede alcanzar»*.

#### Lo que el segundo intento dice, y por qué no es «falló, probá de nuevo»

El tramo C midió que hay **dos clases de fallo y sólo una llega hasta acá**:

| clase | cuántas | quién la resuelve |
|---|---|---|
| un **typo** | 7 | la reparación, gratis. **No llega al modelo** |
| un **concepto que el mundo no tiene** | 34 | **esto** |

Así que el mensaje dice **qué pidió que no existe** —que es lo único que la
primera vuelta no podía saber— más lo que la puerta ya corrigió sola, para que no
lo vuelva a escribir igual.

Y **sólo los cargos que fallaron**: contarle los verdes le pide al modelo que
adivine cuál arreglar.

#### EL GUARDIÁN, y es estructural en vez de un filtro

La decisión era «el QUÉ y el PORQUÉ, no el DÓNDE». Al escribirlo apareció que eso
se puede garantizar **por construcción**:

> **`loQueFalloDe` recibe los CARGOS, no el dictamen.**

Un `Dictamen` trae `regresiones`, y ahí adentro está `semilla`, que **es el id
del mundo**. Si la función recibiera el dictamen entero, filtrar sería una
disciplina que alguien puede olvidar en el próximo cambio. **Pidiendo sólo los
cargos, el dato del mundo no entra al paquete.**

Es la misma forma que el `CanalDeHabla` del Hito 6 —que no tiene un solo import
para que no pueda tocar el tick— llevada a un tipo de argumento.

Su test le pasa un dictamen con las regresiones bien visibles y afirma que **ni
un pedazo de un id** (`al-borde`, `stock-vacio`, `agua/bloque`, `20260727`)
aparece en el texto. Y trae su control, porque si no pasaría por no haber ids en
ningún lado.

#### Un detalle que cambia el mensaje: los conceptos salen de DESPUÉS de reparar

Un typo que la puerta ya corrigió **no es un concepto que falte**, y mandarlo
confundiría al modelo con un problema que ya no existe. Medido en su test:
`ticksToNightfall` figura antes de reparar y no figura después.

### Tramo E — el contador come · CERRADO a medias, y se dice cuál

**La mudanza del cliente NO se hizo, y el porqué es una medición del intento.**

Se movió `lang/demo/proveedor.ts` a `@anima/llm/demo/` y ahí apareció el
problema: **el cliente importa `Consulta`, que es la forma del CHAT**. Con la
mudanza tal cual, `@anima/llm` pasaría a depender de `@anima/lang` — la flecha
al revés, y la fragua tiene otra forma (`Encargo`).

O sea que mudarlo bien **no es mover un archivo: es partirlo en dos**, el
transporte por un lado y la forma del chat por el otro. Son 398 líneas de código
de red que anda —es lo que corre `hablarle --claude`— y reescribirlas de apuro
es la mejor forma de romper lo único que hoy habla con un modelo. **Se devolvió
a su lugar.**

> **Y hay una decisión de producto adentro, que conviene ver antes:**
>
> | transporte | tarda | ¿pide credencial? |
> |---|---|---|
> | `claude` (CLI, hoy) | **14 s** | no — usa la sesión de la máquina |
> | `anthropic` (HTTP) | **~4 s** | **sí, `ANTHROPIC_API_KEY`** |
>
> Los diez segundos cuestan una clave.

#### Lo que SÍ entró: el contador dejó de estar en ayunas

El tramo A dejó un contador que **no alimentaba nadie**. Ahora el chat le
informa lo que gastó, y para eso hizo falta una pieza que faltaba:

**`deUsd(usd)`** — de lo que el proveedor cobra a lo que el contador guarda. Los
clientes informan en dólares con decimales (**US$ 0,0158 por frase**, medido) y
acá se guarda en **milésimas enteras**, porque un flotante acumulado a lo largo
de una sesión deriva: mil sumas de `0.0158` dan `15,800000000000226`.

Y **redondea para arriba**, que no es simetría:

> media milésima que se pierde en cada consulta se pierde mil veces en mil
> consultas, y **siempre para el mismo lado**. Un contador que subestima es peor
> que uno que sobreestima — el que subestima deja pasar el gasto que venía a
> medir.

Así que `0,0158` cuenta **16** y no 15, y la consulta más barata imaginable
cuenta 1 y nunca 0: algo que se pidió, se pidió.

> **Verificado hasta donde se puede sin gastar plata.** Con `--falso` el camino
> se recorre entero —el modelo contesta— pero **no cobra nada, así que no hay qué
> contar**, y eso es correcto. Ver el renglón en vivo pide una consulta paga.

### Tramo F — el cliente, partido en dos · CERRADO

El archivo de 398 líneas se partió por donde correspondía, y el corte lo eligió
la medición del tramo E, no una preferencia:

```
@anima/llm/demo/transporte    prompt (texto) → respuesta (texto). No sabe de nadie.
lang/demo/proveedor           `Consulta` → prompt, y texto → `RespuestaDelModelo`
forge (cuando toque)          `Encargo` → prompt, y texto → candidata
```

> **Un transporte que conoce la forma del que pregunta sirve para uno solo.**

Y lo que **no** cambió es la frontera del Hito 6: `@anima/lang` produce una
`Consulta` —un DATO— y el demo la manda. El paquete sigue sin poder esperar a
nadie, que es todo el punto del ADR II-0024.

#### Lo único que NO se pudo hacer genérico, y es interesante cuál

El modelo **falso**. Los otros tres transportes sólo mueven texto, pero uno de
mentira **tiene que conocer la forma del que pregunta para poder contestarle** —
sus nueve pistas mapean palabras a *firmas*, que son del chat.

Así que se quedó del lado del chat, y el transporte genérico devuelve
`undefined` cuando el transporte es `falso`. Quien quiera un modelo de mentira se
lo arma con su propia forma; la fragua va a necesitar el suyo.

#### Verificado antes y después, porque era el riesgo del tramo

Son 398 líneas de código de red **que anda**, y es lo único que hoy habla con un
modelo. El demo del chat se corrió antes y después y da lo mismo:

```
acuse        1.10 ms
  [0] entendida     modelo holding(tag:carnoso)  (era orientacion)
consulta     1 clausula(s) · llave 1499188753:3645494122
```

#### Y una regla del repo que rompí al escribirlo

El `porFalso` quedó con **marcas combinantes crudas** en su regex de
normalización. El repo lo prohíbe con todas las letras —*«una marca combinante en
un archivo fuente va escrita como escape, nunca como byte crudo»*— y la razón es
la del Hito 6: **no se puede revisar lo que no se ve**. Corregido a
`[̀-ͯ]`, con cero marcas crudas verificadas.

### El transporte HTTP se DESCARTA, y la medición que lo justificaba era floja

**Decidido por el usuario: se usa la suscripción de Claude por el CLI, como en
Ánima I. No hay `ANTHROPIC_API_KEY`.**

Y antes de tacharlo se preguntó **a quién le dolían los diez segundos**, que es
la regla del ADR II-0024. La respuesta incomoda:

| quién | ¿le duelen los 14 s? |
|---|---|
| el **chat** | **no** — el modelo va por el carril lento y **nunca bloquea**. Es todo el ADR II-0024 |
| la **fragua** | **no** — el caso frío del plan presupuesta **6 a 25 s**, y 14 está adentro |

**«El HTTP compra diez segundos» estaba escrito como si fuera obvio que valían.**
No hay nadie a quien le duelan: el chat contesta en 1,3 ms por el carril rápido y
la criatura sigue con lo que sabe mientras la fragua piensa. Lo único que los 14 s
cambian es que **aprende más lento**, y eso no rompe ningún criterio.

> Queda anotado como el cuarto caso de la misma forma: **un número puesto antes
> de preguntar para qué servía.** Los otros tres fueron el `80%`, el `200` y el
> `110` del Hito 6.

Si algún día molestan, la salida que NO pide credencial es **no volver a pagar el
arranque**: mantener el proceso del CLI vivo entre consultas en vez de abrir uno
por pregunta. Es más caro de escribir y no hace falta hoy.

### Tramo G — el muñeco y el paquete · CERRADO (puntos 1, 2 y 9)

`forge/src/candidata.ts` + `forge/demo/falso.ts`. 37 tests en el paquete.

#### La línea corre entera, gratis y siempre igual

```
gap: conseguir alimento de un cuerpo de agua

esperarQuieta      compila-sola       —
esperarLaNoche     compila-reparada   ticksToNightfall → secondsToNightfall
comerSiHayHambre   no-se-pudo         hunger
```

Tres candidatas para los tres desenlaces que la línea sabe distinguir, y cada una
prueba un punto: la primera el **1** («al menos una compila sin reparación»), la
segunda el **2** («al menos una compila con reparación») y la tercera el **9**
(alimenta al segundo intento).

#### Por qué un muñeco, y la segunda razón es la que manda

**1. Probar la línea cuesta plata.** ~14 s y **US$ 0,0158** por candidata del
modelo de verdad, medidos en el Hito 6. La línea se prueba en cada cambio, para
siempre.

**2. Y el de verdad contesta distinto cada vez.** Un test que dice «funciona» un
día y «falla» al otro **sin que nadie tocara nada** dejó de ser un test. El Hito
6 lo midió en vivo: la misma frase le dio a Claude dos metas distintas.

Hay un test que afirma el determinismo, y otro que afirma que **las dos
candidatas dan desenlaces DISTINTOS** — un muñeco que devuelve siempre lo mismo
no prueba nada.

#### Los números del muñeco no se eligieron acá

`ticksToNightfall` es **el error más frecuente del corpus de 28 borradores, con
29 apariciones**, y `hunger` está en la lista de **34 conceptos que el mundo no
tiene** que midió el tramo C. El muñeco imita lo que el corpus mostró, no lo que
a alguien le pareció.

Y `K = 2` tampoco: está en la descripción del hito, y el motivo es económico —
**dos por el precio de un viaje**, porque lo caro es el viaje.

#### El paquete: tres piezas porque se rompen por separado

```
BlueprintCandidate + BuildSkillCandidate + UseSkillCandidate
```

El juez del Hito 7 ya sabe puntuarlas así —sus cargos son `plano ·
construccion · uso · utilidad`— y su encabezado tiene la frase que lo justifica:
*«construir algo no demuestra que funcione, y un `BuildSkill` verde con
`UseSkill` rojo es un resultado legítimo»*. **Un archivo suelto no se puede
puntuar así.**

**El plano NO se inventa acá:** `BlueprintDefinition` vive en `@anima/physics`
desde el gate 5→6, con su `revision` sellada, y la candidata lo lleva **tal
cual**. Dos formas del mismo plano es la duplicación que el guardián del sello
existe para atajar.

**Y el plano es OPCIONAL, que no es descuido:** las 17 innatas no tienen plano y
son habilidades igual. Exigirlo obligaría a inventar uno vacío, y un plano vacío
entra al catálogo y ocupa lugar.

> **El código viaja como TEXTO y no como función.** Entre que sale del modelo y
> que corre hay tres puertas —typecheck, reparación y sandbox— y ninguna puede
> trabajar sobre algo ya evaluado. Evaluarlo antes de revisarlo es exactamente lo
> que el sandbox del Hito 4 existe para impedir.

### Tramo H — la fragua entera, de punta a punta · CERRADO (punto 5, y el 9 entero)

`forge/src/episodio.ts` + `demo/hilo.ts` + `demo/arranque.mjs`. 46 tests en el
paquete.

#### El episodio corre, con el mundo corriendo

```
EL EPISODIO
  el mundo avanzó ....... 151.344 ticks
  TICKS PERDIDOS ........ 0
  la fragua tardó ....... 249 ms (5 ventanas)
  la frontera tardó ..... 20,9 ms (ventana 50)
  desenlaces ............ esperarQuieta=limpia · esperarLaNoche=reparada
```

Y la cadena que se junta es la de todos los tramos anteriores:

```
el encargo (D) → el muñeco (G) → la puerta (B) → la reparación (C)
              → montar (Hito 4) → el juez (Hito 7) → el encargo de la vuelta 2 (D)
```

#### EL HALLAZGO: cortar en rodajas NO alcanza

Es lo que decidió toda la arquitectura del tramo, y salió de medir antes de
escribir. Una ventana de tick a 20 Hz son **50 ms**:

| pieza | costo medido | ¿entra en la ventana? |
|---|---|---|
| el viaje al modelo | 6 a 25 s | **no**, por 120× |
| la puerta (`revisar`) | p50 56 ms · p95 105 | **no**, por poco y siempre |
| instrumentar + montar | p50 2,4 ms | sí |
| juzgar una habilidad | p50 2,9 ms | sí |
| un tick pelado | 0,02 ms | sí |

Con eso, la fragua entera corrida en el hilo del mundo:

```
de una sola vez ............ 10 ticks perdidos
en rodajas, una por hueco ...  7 ticks perdidos
en OTRO hilo ................  0
```

**La rodaja más fina que existe es una pasada por la puerta, y una sola pasada ya
vale una ventana entera.** No hay forma de repartirla, así que no hay forma de
que la fragua viva en el hilo del mundo. Lo que va afuera no se eligió: es la
tabla leída de arriba abajo.

#### Y lo que cruza la frontera es TEXTO, porque no queda otra

Una habilidad montada es un objeto con funciones adentro, y **las funciones no
pasan por un `postMessage`**: el clonado estructurado no las sabe copiar. Así que
montar y juzgar se hacen del lado del mundo —2,4 y 2,9 ms, entran— y lo que
vuelve del hilo es lo que ya era texto.

Cae bien con lo que el sandbox del Hito 4 pide: entre que sale del modelo y que
corre hay tres puertas, y ninguna puede trabajar sobre algo ya evaluado.

#### EL CONTROL, que es lo que le da sentido al cero

Un `ticksPerdidos === 0` no vale nada si nada podía moverlo. El mismo episodio se
corre dos veces, y el segundo es la prueba de que el contador se mueve **en esta
corrida, con esta partida y este reloj**:

```
con la fragua en otro hilo ....  0 ticks perdidos
con la fragua acá adentro .....  3 ticks perdidos en 40
```

Son 3 y no 10 porque el control del test corre las **dos** candidatas del viaje y
la sonda que encontró el hallazgo corría tres. El número que importa no es cuál
de los dos: es que **no es cero**.

#### El frío se paga DOS veces, y las dos hay que pagarlas antes

| | en frío | tibio |
|---|---|---|
| la puerta | 428 ms | 56 ms |
| instrumentar | ~55 ms | 2,4 ms |

Los 55 ms del montaje se encontraron por accidente: **la frontera del primer
episodio dio 56,1 ms y la del segundo 6,1**, con la misma línea de código. Con
una ventana de 50, *la primera habilidad que se instale en la vida de una partida
se lleva un tick puesto* — y midiendo la del segundo no se ve nunca.

No hay nada que cortar: el costo es de adentro de TypeScript. Lo que sí se elige
es **cuándo** se paga, y hay un momento en que es gratis: antes de que el bucle
arranque. Eso es `tibiarElMontaje()`, y el hilo hace lo mismo con la puerta.

> Es la quinta vez en este hito que un verde salía de no haber corrido la mitad
> interesante. Acá la mitad interesante era *la primera vez*.

### La puerta compilaba contra el DOM

Salió de medir otra cosa. El tramo H preguntó cuánto cuesta la puerta contra una
ventana y el número no cerraba: **p50 109 ms**, cuando el banco del Hito 0 mide
**46** para la misma ranura fija, en la misma máquina y sobre el mismo corpus.

La diferencia eran dos líneas que el banco tenía desde el principio —con el
comentario puesto, *«sin DOM, como los paquetes deterministas de ii/»*— y que al
escribir la puerta no se copiaron:

```ts
lib: ['lib.es2022.d.ts'],
types: [],
```

Sin ellas TypeScript carga la librería por omisión, que incluye el DOM, y se
auto-agrega todos los `@types/*` de `node_modules`. Medido con la puerta tal como
estaba:

```
con fetch          COMPILA
con document       COMPILA
con setTimeout     COMPILA
con localStorage   COMPILA
con process        COMPILA
```

**Las cinco están en `FORBIDDEN_GLOBALS`.** No es un agujero de seguridad —el
`shadowScope()` de `mount()` las tapa por alcance léxico y la habilidad revienta
al llamarlas— pero **la puerta existe para rechazar sin gastar**, y una candidata
que pide `fetch` se iba entera al montaje y al juez para morir allá.

Y hay una razón más, que es la del Hito 6: **la `.d.ts` contra la que se compila
ES el prompt**. Un `lib` de más es una API que el modelo puede usar y que el mundo
no tiene.

| | antes | después |
|---|---|---|
| p50 / p95 sobre 27 borradores | 109 / 229 ms | **56 / 105 ms** |
| de 40 globals prohibidos, rechaza | — | **31** |
| borradores rechazados | 24 de 27 | **24 de 27** |

La última fila es el control que importa: **el cambio no movió qué borrador
falla**, así que las cuentas del tramo C —el 86%, los 34 conceptos, los 7 typos—
siguen en pie sin volver a sacarlas.

Los 9 que la puerta no puede tapar son globals **del lenguaje**, no del
navegador: `Date`, `Intl`, `Promise`, `Function`, `globalThis`,
`SharedArrayBuffer`, `Atomics`, `WeakRef`, `FinalizationRegistry`. Ningún `lib`
los saca. A ésos los caza `scanDeterminism` de `aislamiento.ts`, que lee el árbol
en vez de preguntarle a la librería — y **hoy la fragua no lo llama**. Queda
anotado con el número al lado: son 9 de 40.

### El punto 9, con la mitad cara: compiló y NO SIRVE

Hasta el tramo G el punto 9 sólo cubría lo barato —lo que no compila—. Lo que el
usuario pidió era lo otro: *«en caso de que el código sea malo, o sea, que no haga
lo que debería hacer»*. Eso necesita al juez, y el juez necesita que la candidata
**publique lo que promete**.

Por eso `Candidata` ganó `contrato`, que son las «capacidades publicadas» del caso
de aceptación. Sin él, `bancoDe` no tiene de dónde sacar los mundos y todo el
veredicto sale `injuzgable` — hablaría del arnés y no de la habilidad.

Con él, el muñeco puede armar el caso que el tramo G no podía: una candidata que
**compila limpia, sin una sola reparación**, y que el juez baja igual:

```
── esperarQuieta → NO-PROMUEVE ──
  plano         promueve     se sintetiza con carne/vara
  construccion  no-promueve  anduvo en 2 mundo(s) donde su propio contrato dice que no puede
  uso           no-promueve  DIJO QUE SÍ Y NO ES CIERTO: yo:holding>=1
  utilidad      inconcluso   no hay contra qué: nadie le pide nada a una habilidad todavía
```

Y eso entra al encargo de la vuelta 2, en castellano llano y **sin un solo id de
mundo**:

```
— Intento 2. Lo que pasó con el anterior —

Y esto lo corregí solo, para que no lo vuelvas a escribir igual:
  ticksToNightfall → secondsToNightfall

Compiló, pero al probarla:
  construccion: anduvo en 2 mundo(s) donde su propio contrato dice que no puede
  uso: DIJO QUE SÍ Y NO ES CIERTO: yo:holding>=1
```

El guardián de la trampa —*si se le cuentan los mundos donde falló, aprende los
mundos y no la habilidad*— sigue siendo la firma de `loQueFalloDe`, que recibe los
cargos y nunca el dictamen. Hay un test que recorre las regresiones del dictamen y
exige que **ninguna semilla aparezca en el texto**.

### La plomería del hilo, dicha porque cuesta explicarla dos veces

`ii/` no tiene paso de compilación: los `package.json` apuntan `exports` directo
al `.ts` y quien resuelve las extensiones es vitest. Node 24 borra los tipos solo,
pero **no reescribe `./x.js` a `./x.ts`**, y todo el repositorio importa con `.js`
porque es lo que pide `moduleResolution` de bundler.

O sea que un `new Worker(algo.ts)` muere en el primer import. `demo/arranque.mjs`
es el gancho que falta: diez líneas de `registerHooks` que devuelven el `.ts`
cuando existe al lado del `.js` pedido. **En el navegador no hace falta**: el
bundler ya resuelve.

---

## Los cinco que faltaban — etapas 1 a 6

Después del tramo H quedaban los puntos **3, 4, 6, 7 y 8**, más el lint del caso
de aceptación. Se abrieron con un barrido de **diez agentes**: cinco midiendo un
punto cada uno y cinco adversarios buscando por dónde el criterio propuesto podía
dar verde sin que el mecanismo funcionara.

**Los cinco adversarios tumbaron los cinco criterios.** `elCriterioAguanta:
false`, cinco de cinco. Y el diagnóstico coincidía:

> **No son cinco puntos. Son tres mecanismos que no existen, y encima de ellos
> los cinco puntos.**

| lo que no existía | lo que bloqueaba |
|---|---|
| **`instalar`** — ningún camino de escritura de la fragua al mundo | 3, 6, 7 |
| **la costura `Encargo` → `Candidata`** — nada llamaba al modelo | 4, 8 |
| **la cola** — cero líneas en todo `ii/` | 6, 8 |

Y dos hallazgos verificados a mano, no tomados de los agentes:

- **ninguna habilidad puede salir `promueve`. Nunca.**
- **el mundo del juez arrancaba con una violación**, y no era de la fragua.

### Etapa 1 — el registro y la instalación · puntos 3, 6, 7

Medido antes de escribir nada: la frontera del tramo H entera —instrumentar,
montar, juzgar— dejaba el mundo con **el mismo `hashWorldState`**. No había una
sola escritura, así que un test que dijera «cortar a mitad no rompe nada» salía
verde por no haber nada que romper.

#### Una habilidad forjada SÍ cambia el mundo, y encontró el enganche que faltaba

```
holding  0 → 1
hash     901678e3300afcd4 → 17312250b1d751bd
outcome  { ok: true, got: { id: 'palito' } }    en 3 ticks
```

Pero la primera corrida murió así:

```
{ k: 'rota', why: 'se le acabó el combustible…', error: { budget: 0 } }
```

Las quince innatas son funciones planas y no tienen celda; una forjada pasa por
`instrument()` y **nace con el tanque en cero**. `VueloOptions.cell` ya existía
desde el Hito 4 y **nadie la había cruzado desde este lado**. Por eso `Instalada`
lleva la celda: sin ella, una instalación produce una habilidad que muere en su
primer paso y **parece culpa de la habilidad**.

#### Instalar son DOS escrituras, y la inconsistencia no es del mundo

La habilidad montada y la capacidad publicada. Una capacidad publicada sin
habilidad detrás es **un plan que la criatura no puede ejecutar**.

`revisarEstado` no la puede ver, y hay que decirlo con el número: `hashWorldState`
hashea tick, hz, nextId, física, cuerpos, actores, celdas, desplegados y dios.
**Las habilidades no son estado del mundo.** El invariante es propio.

`instalar` calcula las dos mitades enteras y las asigna juntas — entre esas dos
líneas no hay `await` ni puede haberlo (regla 2). El control positivo es un
`RegistroIngenuo` escrito a propósito para poder cortarlo:

```
ingenuo, cortado:  capacidad-sin-habilidad:agarrarLoQueVeo
ingenuo, entero:   []            ← o sea que el rojo es EL CORTE
```

#### El techo del catálogo, medido y no escondido

`ConstructionSchema` tiene **tres** formas y ninguna es «una habilidad que
establece X»: `proceso` pide un `ProcessId` de una enumeración cerrada, `ley` pide
un `LeyId` de las doce, `obra` pide un `BlueprintDefinition`.

O sea que una candidata **con plano** se publica, y una habilidad suelta **no**.
Se instala, se vuela y el mundo cambia, pero el planificador no la puede elegir.
Eso no es una incoherencia del registro; se cuenta aparte en `sinPublicar`, para
que el techo sea un número visible.

### Etapa 2 — la costura · puntos 4 y 8

Los dos estaban **inafirmables** por la misma razón, con tres hechos medidos:

```
un episodio gastaba .................... 0 consultas
Presupuesto, llamadores fuera de su test  0
@anima/forge importando @anima/llm ...... 0 líneas
```

#### El espía cuenta del lado de afuera

Un adversario lo dijo así: *«la cuenta la declara el contado»*. Si el número lo
reporta el mismo objeto que hace las consultas, el test verifica un campo y no un
hecho. El que cuenta **envuelve** al modelo y lleva su propio registro.

#### N no se elige: se mide

```
un episodio = 1 consulta y 32 milésimas
```

Un viaje alcanza: de las dos candidatas, una compila limpia y la otra compila
reparada. El test afirma el número **exacto**, no un `<= 40` con margen de 40×.

Su control: con un modelo que **nunca acierta** —dos candidatas irreparables— el
episodio gasta las tres vueltas. La primera versión del control devolvía `LIMPIA`
y una rota, y el episodio cortaba en la vuelta 1: **el control «nunca acierta»
acertaba.** Medido: 1 consulta donde se esperaban 3.

#### Una puerta, no un aviso — y la diferencia está en el tipo

`pedirPermiso` devuelve un `Viaje` **o no lo devuelve**. Quien recibe un
`no-preguntes` no tiene con qué preguntar aunque quiera.

Las dos ramas de `puedo()` se ejercitan por separado: con `consultas: 0` sale
`sin-consultas` y con `consultas: Infinity, milesimas: 0` sale `sin-plata`. Sin la
segunda, la puerta de la plata no se toca nunca.

Y el control que le da sentido a los dos ceros: el mismo episodio, el mismo
espía, el mismo muñeco, cambiando **una** cosa —el presupuesto— da 1 llamada.

#### El punto 9 cierra del todo: el muñeco MIRA el encargo

Hasta acá el `Encargo` de la vuelta 2 se armaba y **nadie lo leía**.

```
vuelta 2: hunger,threat  →  agarrarLoQueVeo, esperarQuieta
```

No es inteligencia: es un `if` sobre `conceptosQueNoExisten`. Y es lo que hay que
poder afirmar — que la respuesta **depende** del encargo.

### Etapas 3 y 4 — la cola y el duelo · puntos 6 y 7

#### El hallazgo que definió la regla

```
sostener → inconcluso        frotar → no-promueve
  plano         promueve       plano         promueve
  construccion  promueve       construccion  no-promueve
  uso           promueve       uso           inconcluso
  utilidad      INCONCLUSO     utilidad      INCONCLUSO
```

`utilidad` sale `inconcluso` **siempre** y `elPeor()` toma el peor cargo. Lo mejor
que puede sacar una habilidad es `inconcluso`.

**Un duelo que compare el grado global no puede tener ganador jamás**, y «una
candidata peor no reemplaza nada» pasaría perfecto con un duelo que no reemplaza
nunca. Por eso compara **cargo por cargo**, con la regla:

> **domina o no reemplaza** — mejor o igual en todos, estrictamente mejor en al
> menos uno.

El **empate** no reemplaza porque reemplazar sin ganar nada es puro movimiento.
**Ganar uno y perder otro** tampoco, y es la más importante: cambiar un rojo por
otro rojo no es mejorar. Es un orden **parcial** a propósito — uno total obligaría
a elegir cuánto vale cada cargo, que es el número puesto a dedo que este
repositorio viene sacando.

El desempate dentro de un cargo son los mundos aprobados. Un adversario pidió
exactamente el par que lo obliga: **mismo grado en los cuatro cargos, distintos
aprobados**. Con sólo el grado, ese par empata.

#### La degradada que probé primero NO se degradó

El intento obvio era sacarle el `goTo` a `sostener`, y el duelo dio **empate en
los cuatro cargos**. Medido: el objetivo de la escena del juez nace a **una**
celda y `take` funciona desde ahí. El encabezado de la escena dice que el objetivo
nace al lado *«para que un `goTo` que no funciona no pase desapercibido»* — **y a
una celda igual pasa desapercibido.** Queda anotado donde se midió.

#### La cola, y su disparador es 1 de 4

`degradada`, con su definición adentro del criterio. Los otros tres —`gap nuevo`,
`costo alto`, `capacidad prometida y no usada`— piden telemetría de partida que no
existe, y escribirlos hoy sería escribir tres ramas que nada ejercita.

El orden de los grados **entra por parámetro**: `@anima/judge` depende de
`@anima/world` y `@anima/perceive`, así que importarlo haría que la fragua
necesite el mundo para escribir código. Mismo patrón que `ApiTS` en la puerta.

#### Los cuatro controles del punto 6

```
6a  la degradada entra     ← la MISMA sin degradar NO entra, y una que mejoró tampoco
6b  se re-forja al fondo   ← el mundo avanzó 159.978 ticks mientras tanto
6c  la ganadora reemplaza  ← la perdedora NO, y la titular queda
6d  sin perder un tick     ← 0 con la fragua afuera, 6–8 de 40 adentro
```

El control de (6d) vive **en ese archivo** y no en otro, que es lo que un
adversario marcó del tramo H: un cero cuyo control sostiene otra `Partida` en otro
archivo es otra vez el cero estructural.

```
K = 6 · forjadas 6 · el mundo avanzó 159.978 ticks · perdidos por la fragua 0
el reemplazo entero: 3,7 ms de una ventana de 50
```

#### `Regresion` no sirve para «archivada como regresión»

Guarda un fallo **por mundo**, con su semilla adentro, y lo que hace falta es una
candidata perdedora entera. Son dos cosas distintas con el mismo nombre en
castellano. Lo que se archiva es el código y el porqué —que sale de los cargos—
así que **la semilla del mundo no entra**.

### Etapa 5 — el corte a mitad · punto 3

#### Qué es «medio parche», que no estaba escrito

Dos candidatos: **(a)** a mitad del viaje o de la forja, afuera del hilo del
mundo; **(b)** entre las dos escrituras de una instalación. Sólo (b) puede
producir una inconsistencia, y la etapa 1 la cerró por construcción.

#### Mi primera versión del corte no cortaba nada

Era un `for` sincrónico que miraba una bandera entre candidatas, con este
razonamiento escrito al lado: *«el hilo procesa los mensajes de a uno, así que el
`cortá` entra cuando el bucle cede el turno»*. **Falso**: un handler sincrónico no
cede el turno nunca.

```
antes:    forjadas 6 de 6 · sin forjar 0     ← verde, y sin cortar nada
después:  forjadas 1 de 6 · sin forjar 5
```

Sexto verde por omisión del hito, y **éste lo escribí yo**. Lo arregla una línea
—ceder el turno entre candidatas— y el test lo afirma con `sinForjar > 0`, que era
el renglón que faltaba.

#### Nadie se enteraba cuando el par se moría

El llamador escuchaba `message` y nada más; el `exit` del worker llegaba y no lo
leía nadie. *«No deja el mundo inconsistente»* se cumplía por la peor de las
razones: **el episodio no terminaba nunca**. Un mundo que sigue girando esperando
una respuesta que no va a llegar no es un mundo consistente, es un mundo colgado —
y `revisarEstado` no puede ver eso. Con las dos escuchas, matar el hilo termina el
episodio en **20 ms**.

#### El mundo del juez nacía ilegal, y no era de la fragua

```
{ k: 'cualidad-fuera-de-rango', body: 'acusada-cuerpo', q: 'stamina', v: 5000 }
stamina que devuelve qualityOf: 1000
```

El rango declarado es `[0, 1000]` y la física **satura**: la criatura nunca tuvo
5000. Los 5000 no compraban nada y a cambio dejaban una violación permanente en
todo mundo del juez — así que un test del punto 3 escrito como `violaciones === 0`
**nacía rojo** por algo ajeno, y el que lo viera lo iba a ablandar. Arreglado en el
origen.

### Etapa 6 — el lint de constantes físicas

#### La medición lo redefinió entero

Tal como el caso de aceptación lo escribe, **no se puede implementar**:

```
de 27 borradores, cuántos contienen el VALOR de la constante:
  MAX_ASSEMBLY_DEPTH      3        26      ← es un tres
  MIN_ENVELOPE_SAMPLES    2        24
  MAX_EFFICIENCY          1        23
  ENVELOPE_SLACK          0.5      13
  HUMEDAD_QUE_APAGA       0.45      4
  T_AMBIENTE              15        0
```

**Rechaza 26 de 27 borradores**, porque `1`, `2`, `3` y `0,5` son números.

Pero la cola es oro:

```
t1  const HUMEDAD_QUE_APAGA = 0.45 // ley 11    ← con NOMBRE Y TODO
t2  ctx.q(b,'moisture') < 0.45  (×3)            ← el valor pelado
t3  const OXI_UMBRAL = 0.35                     ← copia renombrada
t4  const puedoCorrer = aliento > 0.35          ← FALSO POSITIVO
```

**El `0,45` sólo es una constante física cuando está al lado de `moisture`.** Por
eso son dos reglas: el **nombre** (cero falsos positivos posibles) y el **valor
junto a su cualidad**, en la misma línea. Hay un test que afirma que
`aliento > 0.35` **no** se marca, con nombre y apellido: un lint que marca de más
no lo lee nadie.

La tabla de qué cualidad calibra cada constante no existe en la física, así que va
declarada en el lint — **con un guardián** que verifica que cada nombre siga
existiendo y con el mismo valor. Y los comentarios no son código: un borrador
tiene la línea `// a mano su compuerta con el literal HUMEDAD_QUE_APAGA`, que es
alguien **explicando** el problema y no cometiéndolo.

### Un test mío medía la máquina y no la fragua

`ticksPerdidos === 0` pasaba corriendo `forge` solo y fallaba con `pnpm ii:test`
—doce paquetes peleándose 16 núcleos—: dio **1**. El contador se cuenta contra un
reloj de **pared**, así que un núcleo ocupado le come una ventana al hilo del
mundo aunque la fragua esté afuera.

**No se ablandó el criterio: se midió la cantidad correcta.** Lo que los puntos 5
y 6 afirman es que *la fragua no cuesta ticks*, y eso es una **diferencia** contra
la línea base de la misma corrida. Si la máquina pierde uno en los dos tramos, el
delta es 0; si la fragua costara ticks, el delta subiría — y el control lo
demuestra: adentro del hilo el delta es 6 a 8.

> Y un guardián del repo me agarró de paso: metí un **espacio de ancho cero** en
> un comentario para esquivar el cierre de un bloque. Es exactamente lo que la
> regla prohíbe —un carácter invisible va como escape, nunca como byte crudo— y
> `world/tests/sin-nombres-especiales.test.ts` lo vio.

---

## El estado del criterio

| | qué se afirma | dónde |
|---|---|---|
| **1** | al menos una de dos compila sin reparación | `la-linea-entera.test.ts` |
| **2** | y al menos una compila con reparación | `la-linea-entera.test.ts` |
| **3** | matar la conexión a mitad no deja el mundo inconsistente | `el-corte-a-mitad.test.ts` |
| **4** | el episodio no supera N consultas · **N = 1, medido** | `la-costura.test.ts` |
| **5** | `ticksPerdidos === 0` durante todo el episodio | `el-episodio.test.ts` |
| **6** | la degradada entra, se re-forja al fondo y la ganadora reemplaza | `el-carril-de-mejora.test.ts` |
| **7** | una candidata peor no reemplaza nada y queda archivada | `judge/tests/el-duelo.test.ts` |
| **8** | con la cuota agotada, ni una consulta | `la-costura.test.ts` |
| **9** | lo que falló alimenta al siguiente, las dos mitades | `la-costura.test.ts` + `el-episodio.test.ts` |
| **+** | el lint de constantes físicas | `el-lint-de-constantes.test.ts` |

### Lo que queda anotado y NO está hecho

- **La mente no puede elegir una habilidad forjada.** `aHabilidad` es un `switch`
  cerrado sobre las quince innatas. Se puede volar con `Partida.volar` —está
  medido— pero el planificador no la nombra. Es el trabajo de los hitos 10 y 11.
- **El catálogo no tiene fila para una habilidad suelta.** Ver el techo de la
  etapa 1: `sinPublicar` lo cuenta.
- **Tres de los cuatro disparadores de la cola** piden telemetría de partida que
  todavía no existe.
- **La escena del juez no caza un `goTo` roto**, porque el objetivo nace a una
  celda y `take` llega igual.
- **`utilidad` sale `inconcluso` siempre**, y por eso ningún dictamen puede salir
  `promueve`. El propio juez lo dice: *«no hay contra qué… hasta que haya
  objetivos»*.

---

## Los puntos 1 y 2, contra el modelo de verdad

Se corrieron contra **Claude Haiku por el CLI de la suscripción**, que es el
transporte que el usuario eligió. `forge/demo/con-el-modelo.ts`.

### El punto 1 cumple con creces

Cinco viajes de K=2 con el gap del criterio:

```
10 candidatas · limpias 10 · reparadas 0 · rotas 0 · US$ 0,3767
```

### El punto 2 no podía pasar, y el motivo importa

**La IA dejó de equivocarse.** No porque la reparación falle —el corpus y el
muñeco la prueban— sino porque su premisa se cayó: el criterio suponía que el
modelo escribe código que hay que reparar, y con la superficie delante no lo
hace.

Los 24 de 27 borradores que no compilaban **se escribieron sin la API en el
prompt**. El corpus medía un mundo que ya no existe.

### Cómo se forzó, y es un caso REAL

La idea la puso el usuario: *«si la IA lo hace bien, podríamos forzar un error»*.

No pidiéndole que escriba mal —eso mediría si obedece— sino **dándole un manual
con un nombre viejo**: se le manda `ticksToNightfall` donde la API de verdad dice
`secondsToNightfall`. El modelo escribe bien contra el manual que le dimos, la
puerta compila contra el de verdad, y la diferencia es exactamente el typo que la
reparación arregla.

**Y es lo que pasa el día que la API cambia y el prompt queda viejo.**

#### El primer intento del control NO controló nada

Corrió con el gap del criterio —pescar— y dio **6 de 6 limpias igual**. Obvio una
vez visto: `secondsToNightfall` es el reloj, y pescar no mira el reloj. Se
corrompió un nombre que ese pedido no usa nunca.

El nombre salía del corpus (29 apariciones, el error más frecuente) pero esa
frecuencia era sobre 28 borradores de todo tipo, no sobre ése. **Un control que
corrompe algo que el sujeto no toca no controla nada.**

Con un pedido que no se puede escribir sin mirar el reloj —«ponerse a cubierto
antes de que caiga la noche»—:

```
refugioOportunista    limpia
refugioEstrategico    reparada    ticksToNightfall → secondsToNightfall
constructor           rota        liana, madera
vagabundo             reparada    ticksToNightfall → secondsToNightfall (×2)

4 candidatas · limpias 1 · reparadas 2 · rotas 1 · US$ 0,1604
```

> **Se dice con todas las letras:** el punto 1 se afirma con el gap del criterio;
> el punto 2 se afirma con **otro gap y un manual envejecido a propósito**, porque
> con el del criterio el modelo no falla. Lo que queda probado es lo que el punto
> quería saber —*la reparación arregla salida real de un modelo sin volver a
> preguntarle*— y no la letra del enunciado.

Y de yapa, el punto 9 se disparó solo contra material real: `constructor` usó las
palabras del vocabulario (`liana`, `madera`) como si fueran nombres de la API, y
la vuelta 2 se las cuenta.

## Tres cosas que sólo se encontraron pagando

### 1 · El encargo no era un prompt

Se le mandó el encargo pelado —167 caracteres— y **no escribió una línea de
código**. Leyó «escribí una habilidad» como una tarea de Claude Code:

```
Necesito ver la habilidad que escribiste. Déjame explorar el proyecto.
<function_calls><name>Glob</name>…
¿Dónde escribiste esa habilidad? ¿En qué archivo está?

candidatas parseadas: 0 · US$ 0,008
```

Faltaban las tres cosas que un prompt tiene y una nota no: el **marco**, la
**superficie** y la **forma de la respuesta**. Lo incómodo es que `puerta.ts` ya
lo decía hace seis tramos —*«la superficie contra la que se compila ES el
prompt»*— y nadie la había puesto adentro.

### 2 · El molde sin import da código sin import

Con la superficie puesta, las dos candidatas salieron `rota` por lo mismo:

```
2304: Cannot find name 'Ctx' / 'Intent' / 'Outcome' / 'StepResult'
```

**El modelo copia el molde exacto.** Escribió `yield ctx.goTo(...)` y
`ctx.see([...])` bien; le faltaba la línea de arriba, y la línea de arriba es
responsabilidad del que da el molde.

### 3 · La regex del nombre cortaba en la primera eñe

```
export function* pescarConCaña   →   nombre leído: "pescarConCa"
```

Y un nombre cortado no es un nombre feo: `mount()` busca esa clave en los exports
y no la encuentra, así que la habilidad **compila, pasa la puerta y falla tres
pasos más adelante**. El prompt de este repositorio está en castellano, o sea que
las eñes no son el caso raro: son el esperado.

## Dos números del plan que dejaron de ser ciertos

| | escrito | medido ahora |
|---|---|---|
| costo por candidata | US$ 0,0158 | **US$ 0,038** (2,4×) |
| un viaje al modelo | 6 a 25 s | **46 a 111 s** |

Los dos por lo mismo: el prompt ahora lleva **24 KB de API** adentro. No rompe
ningún criterio —el chat no espera al modelo y la fragua vive en otro hilo— pero
son números del plan que ya no son los de la realidad, y el tramo H presupuestó
con ellos.

---

## El punto 9, la mitad que faltaba — y el resultado es NEGATIVO

   > Una candidata que falla alimenta a la siguiente, y la siguiente mejora **en
   > los mundos que no le contaron**.

Corrido contra Claude, dos vueltas de K=2 (`forge/demo/el-punto-9.ts`):

```
── VUELTA 1 ──
  agarrar            mostrados 2/4 · reservados 1/1
  levantarMaterial   mostrados 2/4 · reservados 1/1

la que peor anduvo: agarrar
  construccion: dijo que sí en 2 mundo(s) donde no había nada que levantar

guardián: 5 ids de mundo en el banco · 0 aparecen en el encargo ✔

── VUELTA 2 ──
  coger              mostrados 2/4 · reservados 0/1
  buscarYCoger       mostrados 2/4 · reservados 0/1

¿mejoró en los mundos que NO le contaron?  NO      US$ 0,1463
```

### Lo que SÍ quedó probado

- **el juez corre habilidades forjadas** (ver abajo, hubo que arreglarlo);
- **el guardián de la trampa aguanta contra material real**: 5 ids de mundo en el
  banco, **0 aparecen** en el encargo de la vuelta 2.

### Y por qué la pregunta NO se puede contestar con este banco

El banco de `CONTRATO_SOSTENER` tiene **5 mundos, de los cuales 1 es reservado**
(`i % 4 === 1`). O sea que «mejoró en los reservados» se decide con **un solo
mundo**: el resultado `1/1 → 0/1` es una moneda, no una señal.

**Ninguna cantidad de plata arregla eso.** Con un mundo reservado no se puede
distinguir aprender de tener suerte, y correrlo diez veces sólo daría diez
monedas. Lo que hace falta es un banco más grande — y eso es una decisión de
producto sobre el juez, no un ajuste del prompt.

> Así que el punto 9 queda **a medias, con la causa medida**: la primera mitad
> cumple y está probada contra material real; la segunda **no es medible con el
> banco que hay**. Poner verde acá sería exactamente el verde por omisión que
> este hito viene cazando, con la diferencia de que este ya lo vimos.

## El juez no podía juzgar una habilidad forjada

Salió al correr lo de arriba: la candidata compiló, se montó, y el juez explotó.

```
OutOfFuel: se agotaron 0 unidades adentro de una función común
  at until (…)          ← el callback de `ctx.explore`
  at correrEn (ablacion.ts:101)
```

`correrEn` volaba **sin celda**. Para las quince innatas está bien —son funciones
planas, sin instrumentar, sin tanque— pero una habilidad que salió del modelo pasa
por `instrument()` y **nace con el tanque en cero**.

Es la **misma ranura** que `Partida.volar` ya tenía y que la fragua cruzó en su
registro (etapa 1). El juez tenía el agujero gemelo y no se veía **porque nunca
había juzgado algo forjado**.

`Sujeto.cell` es opcional, así que sin celda el comportamiento es exactamente el
de antes: las quince innatas y los 92 tests del Hito 7 no se enteran.

---

## El banco del juez, agrandado

Lo pidió el usuario para destrabar la segunda mitad del punto 9. **Dos cosas
estaban mal, y la segunda era peor que la primera.**

### Lo medido antes de tocar nada

```
mundos por contrato   5, igual con 1 precondición que con 3
materia disponible    540 candidatos (30 sustancias × 6 formas × 3 masas) — se usaban 3
costo                 0,77 ms por mundo
el reservado          SIEMPRE `al-borde`, en sostener, frotar y comer
```

### El reservado era una clase escondida, no una muestra

La reserva era `i % 4 === 1` sobre una lista **ordenada por clase**, así que con
cinco mundos caía siempre en el índice 1. La fragua veía cuatro clases enteras y
de la quinta, nada.

Eso no es reservar un cuarto: es esconder una clase. Una habilidad que sólo falla
al borde del umbral quedaba invisible en la devolución.

### Lo que hay ahora

| | antes | ahora |
|---|---|---|
| mundos | 5 | **18** |
| adversos | 2 (40%) | **6 (33,3%)** |
| mostrados | 4 | **14** |
| reservados | 1, siempre `al-borde` | **4, uno por clase** |
| costo | 3,8 ms | ~14 ms (ventana: 50) |

`POR_CLASE = 4` sale de dos cosas: el tiempo —0,77 ms por mundo contra una
ventana de tick de 50— y que **cuatro es lo mínimo para que la reserva de un
cuarto rinda un representante por clase**.

### El 1/3 adverso lo rompí, y el guardián lo agarró

El primer intento dio **5 adversos de 17 = 29,4%**, contra el criterio del Hito 7
que exige un tercio. No se tocó el test: se corrigió el banco, y el número dejó de
elegirse — se **deriva** de la exigencia. Con `a` amables y `sin-nada` aportando
uno, los `justo-abajo` tienen que ser al menos `a/2 − 1`.

### Y el banco grande CAZA MÁS

La habilidad sobreajustada del Hito 7 —la que sólo funciona donde la
corrigieron— dejaba **una** regresión. Ahora deja cuatro:

```
regresiones por clase: holgado, holgado, al-borde, al-borde
```

Con un solo `holgado` en el banco, y siendo ése justamente el que ella tiene
aprendido, **aprobaba en su casa**. Con cuatro, no.

### Tres tests se endurecieron, ninguno se ablandó

- «el reservado no es `holgado`» → **toda clase con más de un mundo aporta un
  reservado, y el primero del banco no se reserva nunca**;
- «`regresiones[0]` contiene al-borde» → **más de una regresión, la clase que caza
  el sobreajuste está entre ellas, y toda regresión nombra un mundo del banco de
  verdad**;
- el 1/3 quedó igual, y es el que atajó mi error.

### El punto 9, re-medido con el banco grande

```
VUELTA 1  agarrarLevantable      mostrados 9/14 · reservados 3/4
          irBuscandoLevantable   mostrados 5/14 · reservados 1/4

guardián: 18 ids de mundo en el banco · 0 aparecen en el encargo ✔

VUELTA 2  agarrar                mostrados 5/14 · reservados 1/4

¿mejoró en los mundos que NO le contaron?  no
```

**Ahora la pregunta se puede contestar, y la respuesta sigue siendo que no.** La
diferencia con la corrida anterior es toda: `3/4` contra `1/4` entre dos
candidatas de la misma vuelta es una señal, no una moneda. El banco discrimina.

Lo que queda del punto 9 dejó de ser «no se puede medir» y pasó a ser **«la
devolución no alcanza»**: lo único que se le dice al modelo es *«no llegó en 12
mundos donde sí había»*, que no le dice qué arreglar. Eso sí es un problema de la
fragua, y se puede trabajar.
