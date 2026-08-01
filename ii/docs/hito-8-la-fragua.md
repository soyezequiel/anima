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

### Tramo G — el modelo de mentira de la fragua, y el paquete de candidatas

*(lo que sigue)*. El tramo F dejó dicho cuál es la pieza que falta: **el falso es
lo único que no se puede hacer genérico**, porque tiene que conocer la forma del
que pregunta. La fragua necesita el suyo, y con él los puntos 1 y 2 del criterio
—«al menos una de dos candidatas compila»— se pueden probar **sin gastar un
centavo**.
