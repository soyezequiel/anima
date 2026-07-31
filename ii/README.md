





# Ánima II

El remake. Vive acá, al lado del Ánima que anda, hasta que se lo gane.

> **¿Sesión nueva? Empezá por [`docs/continuar-aca.md`](docs/continuar-aca.md).**
> Es el traspaso: dónde está el Hito 5 criterio por criterio, cómo se trabaja
> acá, las decisiones ya tomadas, y los veinte números que ya se corrigieron
> —cinco de ellos conclusiones enteras que estaban mal y habían llegado a
> documentos—. Lo de abajo es el índice; eso es el estado.

- Arquitectura: [`docs/architecture/remake-anima-ii.md`](../docs/architecture/remake-anima-ii.md)
- Inventario de ADRs: [`ii/docs/inventario-adrs.md`](docs/inventario-adrs.md)

## Las tres reglas de esta carpeta

**1. Nada de acá importa de `packages/` ni de `apps/`.** Ni un `import` a
`@anima/sim-core`, `@anima/agent-core`, `@anima/skill-runtime`. Portar es
**copiar y adaptar**, no depender. Si dejás la dependencia viva, en tres meses el
remake es un refactor con esteroides y volvés a tener un `agent.ts` de 7.679
líneas con otro nombre.

La excepción, y es una sola: **`apps/api` se conserva y se comparte**. El puente
a Codex con `CODEX_HOME` por pubkey y la identidad Nostr no se reescriben.

**2. Ningún paquete determinista toca el reloj ni el azar del sistema.**
`Math.random`, `Date`, `performance`, `Intl`, `localeCompare` y `Math` trascendente
(`exp`, `pow`, `log`, `**`) están prohibidos por lint en `@anima/physics`,
`@anima/process` y `@anima/world`. `Math.exp` y `Math.pow` **no tienen precisión
especificada en ECMAScript**: dos navegadores pueden devolver el último bit
distinto y el replay diverge en el tick 400. Se reemplazan por tablas y
polinomios propios en punto fijo.

**3. Ningún hito se da por cumplido sin su criterio verificable.** Están escritos
uno por uno en el plan de construcción del documento de arquitectura, y varios
son criterios de **corte**: el Hito 0 puede matar la decisión del sandbox, y el
Hito 5 puede parar el proyecto entero. Están para eso.

## Estado

**Hitos 0 a 4 CERRADOS. El Hito 5 —la mente sin LLM, que es el criterio de corte
del proyecto— con tres de sus seis criterios cumplidos y los otros tres medidos y
publicados en rojo.**
El detalle, con los números y lo que falta, está en
[`docs/continuar-aca.md`](docs/continuar-aca.md).

| | |
|---|---|
| **nueve paquetes** | 2424 tests verdes (+1 `todo`) · nueve typechecks limpios · 68 `it.fails` anotados |
| [Traspaso del Hito 5](docs/continuar-aca.md) | **empezá por acá** |
| [Gate 5→6 · objetos emergentes](docs/gate-5-6-objetos-emergentes.md) | **lo que viene después del Hito 5, y antes del 6** |
| [Las diez secuencias](docs/hito-5-las-diez-secuencias.md) | el criterio de emergencia, cerrado antes de medirlo |
| [Inventario de ADRs](docs/inventario-adrs.md) | **86 de 86 triados** · 55 portar, 18 revisar, 10 obsoleto, 3 revertido |
| [Escalera de capacidades](docs/escalera-capacidades.md) | 20 capacidades, 28 borradores contra la API |
| [Huecos medidos](docs/huecos-medidos.md) | 4 pases: 112 → 71 → 64 (a mano) → **84** (emitido) |
| [Decisiones](docs/decisions/) | **21 ADRs propios** (II-0001 a II-0021) |

### El orden de acá en adelante

```
terminar el Hito 5 actual
  → Gate técnico de objetos emergentes   ← docs/gate-5-6-objetos-emergentes.md
    → Hitos 6–11
      → Hito 12 (UI presentable: el mapa es la vista principal)
        → Hitos post-UI de física abierta (13–16)
```

**El Gate 5→6 no reabre el Hito 5** ([ADR II-0019](docs/decisions/II-0019-el-gate-5-6-no-reabre-el-hito-5.md)):
el Hito 5 está ~80% implementado y termina con su alcance actual. Lo único que
tiene que preservar es **una costura de compatibilidad** — el planificador y la
mente no pueden quedar atados a un catálogo global imposible de reemplazar. El
caso de aceptación del gate es **«fabricá una trampa para peces»**, sin trampa
precargada y **sin ningún nombre especial en producción**.

**Los Hitos 0 a 4 siguen cerrados.** Lo que ganan es una sección de *contratos que
deben revalidarse por la extensión de objetos emergentes*, que vive en la sección
7 del documento del gate. Ninguna medición se borra.

### Hito 0 — el banco · las cuatro piezas medidas, ninguna mató el plan

| Pieza | Criterio | Medido | |
|---|---|---|---|
| [typecheck](docs/hito-0-banco-de-latencia.md) | < 3000 ms en frío | 240 ms | ✔ |
| [barrido térmico](docs/hito-0-barrido-termico.md) | ventana para 10 sustancias | 12/12 | ✔ |
| [combustible](docs/hito-0-combustible.md) | ≤ 2% del tick (ADR II-0005) | **0.39%** | ✔ margen 5.1× |
| [arranque en el navegador](docs/hito-0-arranque-navegador.md) | typecheck tibio ≤ 250 ms | **6 ms** | ✔ margen 30× |

### El tiempo del mundo se mide en segundos · [ADR II-0008](docs/decisions/II-0008-el-tiempo-del-mundo-se-mide-en-segundos.md)

Las **dos perillas** del ADR II-0007 dejaron de ser una promesa. `Effect.porSegundo`,
`completion.at` en segundos, `QualitySpec.relaxesTo.porSegundo`, `paso(b, e, phys, dt)`
y un proceso en curso que acumula **segundos** y no ticks.

| | 10 Hz | 20 Hz | 25 Hz | 50 Hz | 100 Hz |
|---|---|---|---|---|---|
| la madera llega a 375 °C | 1,40 s | 1,40 s | 1,40 s | 1,38 s | 1,38 s |
| cocinar el pescado | 10,30 s | 10,40 s | 10,44 s | 10,46 s | 10,48 s |
| cocinar la carne | 18,10 s | 18,15 s | 18,20 s | 18,24 s | 18,25 s |
| **cocinar el cuero** | **41,00 s** | **41,10 s** | **41,12 s** | **41,16 s** | **41,19 s** |
| carbonizar del todo | 8,00 s | 8,00 s | 8,00 s | 8,00 s | 8,00 s |

Peor desvío contra la frecuencia de referencia: **1,43%**, y es error de
integración, no de calibración. El rango soportado son esas cinco: las que dan un
`dt = 1/Hz` exacto en la escala de las tasas. **Los 30 Hz que el documento
declaraba «fijos» no lo dan**, y el mundo los RECHAZA en vez de redondearlos.

La frecuencia entra en el hash del mundo y en la crónica junto a la semilla:
cargar un guardado con otra es un error explícito y no una divergencia
silenciosa. Y la conducta a 20 Hz **no se movió ni un bit**: la huella de
`paso()` sigue en `3705094564`, y la partida de 2000 ticks reproduce su hash
viejo exacto en cuanto se le mapea de vuelta la FORMA (`hz`, la actividad en
segundos y las tasas del catálogo).

```bash
pnpm --filter @anima/physics test tests/el-tiempo-en-segundos.test.ts
pnpm --filter @anima/world   test tests/la-frecuencia.test.ts
```

### Hito 1 — `@anima/physics`

Existe y está verde: **560 tests**, typecheck limpio. Punto fijo determinista,
29 cualidades más 4 de celda, 30 sustancias semilla, cuerpos compuestos, los
cuatro procesos aplicables, las doce leyes y `admit()`.

Los tres ejemplos del usuario pasan **sin que aparezcan las palabras «carbón»,
«asar» ni «pescar»**, y el test de emergencia no menciona ninguna sustancia
semilla por nombre.

El Hito 1 devolvió dos correcciones al contrato de tipos, y las dos están
aplicadas ([ADR II-0006](docs/decisions/II-0006-dos-escalas-magnitudes-y-tasas.md)):
**`Fixed` a escala 1000 para las magnitudes y `Rate` a escala 1e6 para las
tasas**, tipos nominales distintos —sumar una tasa a una magnitud no compila, y
eso lo verifica `tsc`— con `aplicar()` como única puerta entre las dos; y el nodo
`{ k: 'substance' }` en `QualityExpr`, con el que `heatCapacity` se declara como
cualquier otra derivada y queda **una sola forma de preguntar si algo se guarda**.

> **Contratos a revalidar por la extensión de objetos emergentes** (el Hito 1
> sigue cerrado; esto es lo que la extensión va a estirar): límites de partes,
> juntas y profundidad (`MAX_PARTS = 6`, `MAX_JOINTS = 8`,
> `MAX_ASSEMBLY_DEPTH = 3`) · cualidades derivadas · **affordance genérica de
> retención o captura pasiva**, que hoy no existe · rechazo de soluciones que
> dependan del nombre del objeto. **Todavía no se agrega geometría, ni aberturas,
> ni peces físicos.** Ver la sección 7 del
> [Gate 5→6](docs/gate-5-6-objetos-emergentes.md#7--contratos-que-deben-revalidarse-por-la-extensión-de-objetos-emergentes).

### Hito 2 — `@anima/world` · [`docs/hito-2-el-mundo.md`](docs/hito-2-el-mundo.md)

Existe y está verde: **276 tests** más 5 de verificación que corren aparte
(`pnpm --filter @anima/world verificacion`), typecheck limpio. Grilla en chunks con índice
O(1) por celda, `stepWorld` puro, invariantes por tick, journal append-only,
snapshot por delta y `hashWorld`.

| Criterio | | Medido |
|---|---|---|
| dos mundos gemelos con 10⁵ intenciones → mismo `hashWorld` | ✔ | 100 000 intenciones, 11 checkpoints |
| restaurar a mitad reproduce el final exacto | ✔ | desde la cadena de deltas, no de memoria |
| 5000 cuerpos a menos de 4 ms por tick | ✘ | **8,65 ms** · era 39,8 · el 90% es `paso()` de física |
| el mismo hash en Chrome y en Firefox | ⏳ | falta la página; la precondición está verificada |

El de rendimiento **todavía no se cumple, pero bajó 4,6 veces**: de 39,8 ms a
8,65. El diagnóstico anterior era correcto y está reparado — `leer()` armaba trece
cualidades de golpe y `paso()` lo hacía cinco veces por cuerpo, para que cada ley
usara dos o tres. La lectura es ahora **perezosa y memoizada**, `paso()` no relee
cuando la ley devolvió el mismo cuerpo, y `qualityOf` dejó de construir un `Set`
por llamada: de **77 lecturas de cualidad por cuerpo y por tick quedan 13,6**.

Que no se haya movido ninguna conducta **está verificado desde afuera**: la huella
de `paso()` (3705094564) y el hash de una partida de 2000 ticks
(`61d4b9588a81717d`, con sus once checkpoints) dan **exactamente lo mismo con las
fuentes de física anteriores a la optimización**. El hash de la partida pasó
después a `4d431de7cdd1fe94` con el ADR II-0008 —la frecuencia entró en el
estado y la actividad pasó a contarse en segundos— y que eso fue un cambio de
FORMA y no de conducta está verificado mapeando las tres formas de vuelta: la
partida vuelve a dar `61d4b9588a81717d` con sus once checkpoints exactos. La caza de la caché mal
invalidada —23 tests contra las cinco memoizaciones nuevas— encontró **una sola**
diferencia: `tagsDe` se queda con los tags viejos si alguien muta el array de
partes en su lugar, cosa que hoy nadie hace y que ahora tiene barrido propio.

Los dos números de arriba son de ESE momento y no del árbol de hoy: cada ADR que
cambia una conducta los mueve a mano y con el porqué al lado. La cadena completa
vive en los propios tests (`physics/tests/huella-de-conducta.test.ts` y
`world/tests/partida-de-2000-ticks.test.ts`), que es donde hay que mirarla para
bisecar; hoy valen 2564253564 y `19db371807b7fb35`, después del ADR II-0011.

Lo que falta son **2,2×**, y son dos frentes distintos: para el corpus del banco,
la representación del cuerpo (y eso pide su propio ADR); para un mundo
**heterogéneo** —que hoy cuesta ~20 ms y no 8,65— lo que manda es que
`conSustancia` reconstruye la `Physics` entera cada vez que la ley 4 transmuta.
Hoy entran **~2100 cuerpos en 4 ms** (eran ~485), de sobra para el Hito 3 y para
la demo del Hito 5.

El ataque al propio determinismo encontró **un agujero real**: los empates de
`seq` se detectaban al vuelo, así que la primera del par ya había actuado cuando
aparecía la segunda — el mundo dependía del orden de llegada. Reparado. Y el
arnés de invariantes con diez actores encontró tres bugs de bookkeeping espacial
más un invariante mal escrito: pedía apoyo **entre pares** en vez de **una pila
por celda**, o sea que la parrilla del ADR II-0002 no habría pasado su propio
invariante.

```bash
pnpm --filter @anima/world banco   # los números de rendimiento, medidos
```

### Hito 3 — `@anima/oracle` · [`docs/hito-3-el-dios.md`](docs/hito-3-el-dios.md)

El dios perezoso: **239 tests verdes**, typecheck limpio, y `pnpm ii:test` entero
en **1101**. Los **seis** criterios pasan, medidos.

| Criterio | | Medido |
|---|---|---|
| dos órdenes y dos historias distintas → el mismo hash | ✔ | 686 decretos en 14 órdenes · **0 diferencias** |
| otra respuesta para una clave existente lanza | ✔ | 200 intentos, **200 `InvariantError`** |
| enmendado antes de interactuar cambia, después no | ✔ | 100 arroyos: **50 cambian, 50 no** |
| la fusión de dos lagos con testigo no contradice a ninguno | ✔ | **2 cuerpos lógicos, 1 región**, 0 descartes |
| el río se agota y se repone | ✔ | 12 peces en **12 tiradas**; 0 → 12 en 24 s de mundo |
| ningún chunk acuático sin insumos en radio 2 | ✔ | **788 orillas, 0 sin aparejo** |

El pase de integración escribió `index.ts` —sin él el paquete no se podía
importar— y **`decreto.ts`, la costura que faltaba**: `resolveChunk` decía qué
hay, `ensureSolvable` decía qué falta, y ninguno llamaba al otro, así que el
criterio (f) estaba verificado sobre un chunk de test y no sobre el mundo.

Llamarla destapó dos agujeros que sólo aparecen sobre el mundo decretado: el
**88,8% de los chunks de `agua-dulce` está enteramente inundado** —el nivel de
agua acuático tiene mediana 846 en un campo donde el 1,4% de los valores pasa de
800— y la garantía, disparada por `bioma.acuatico`, se activaba justo ahí (donde
no hay dónde pararse) y **no** en los chunks de pradera y bosque con orilla ni en
la corona seca alrededor de cada lago, que es donde se pesca. Ahora **la dispara
el agua y no el bioma**, y mira del otro lado del borde del chunk: de las 788
orillas medidas, **547 (69%) no son de bioma acuático**.

```bash
pnpm --filter @anima/oracle test tests/ataque-al-dios.test.ts
```

#### El riesgo 4, cerrado: **el techo calórico se cobra** · [`presupuesto.ts`](packages/oracle/src/presupuesto.ts)

`caloricBudget` era una función pura de la semilla que **no leía nadie**: el
riesgo 4 del documento («el dios es el agujero de la conservación») hecho código
muerto. Faltaban tres piezas y están las tres — el stock nombra su chunk, lo que
sale tiene masa, y hay un acumulado por chunk contra el que `draw` compara antes
de entregar. `MundoConDado.calorias` es **obligatorio**, así que la puerta la
cierra `tsc`: no se puede escribir una extracción sin decir contra qué
presupuesto se cobra.

| | antes | ahora |
|---|---|---|
| un pozo, una hora de mundo, chunk de techo 1776 cal | 5490 cal · **3,1× el techo** | 1775,36 cal · **1,00×** |
| lo que siembra la garantía en 1681 chunks | `agua`, `savia`, `pluma`, `piel`, `tendon`… | sólo lo que **algún bioma deja tirado** |

La garantía dejaba hebras de agua atadas a una vara. No hizo falta una lista de
tags prohibidos: la lista de qué puede haber tirado **ya existía** y es la tabla
de biomas (`CANTERA_DEL_MUNDO` = la unión de las `siembra`). El agua no está ahí
por la misma razón por la que `scatter` nunca la deja tirada. Y lo de cada lugar
**desempata** entre las candidatas empatadas, sin restringir. Las 788 orillas
siguen cerrando.

Quedan **2 `it.fails`**, cada uno con su porqué al lado:

- **`MISMA CLAVE, DOS TIPOS`** — `ask<T>` castea el camino cacheado; cerrarlo ata
  el ledger a las formas de respuesta de los otros módulos. Decisión consciente
  del autor del ledger, anotada con el caso adelante.
- **la energía neta sin trabajo** — ver abajo.

#### El test económico · 100 partidas × 20.000 ticks · **corre, y el criterio NO pasa**

El documento pide «100 partidas de 20.000 ticks donde la energía neta acumulada
de la criatura tiene que ser **negativa sin trabajo**». Corre a esa escala (1000 s
de mundo por partida a 20 Hz, dos variantes de las cien, 4,5 s de reloj) y **da
positiva en las doscientas**.

| por partida | ingreso | costo | neto |
|---|---:|---:|---:|
| **afortunada** (dado perfecto, el pozo máximo que el paquete deja escribir) | 4042,3 | 243,6 | **+3798,7** |
| **común** (dado de verdad, el arroyo de los demás tests) | 594,1 | 200,0 | **+394,1** |

**Y lo que falla no es el techo**: en las 200 partidas ningún chunk pasó su
presupuesto —314 chunks cobrados, el más exprimido al **100,00%** de su techo— y
el techo se recalcula desde la semilla para juzgarlo, no se le pregunta al libro.
Lo que falla es la calibración, y se ve en una división: un chunk acuático da del
orden de 1800 calorías y vivir los 1000 segundos cuesta 200, o sea que **un solo
chunk paga nueve vidas**. El punto de equilibrio está medido: `COSTO_VIVIR`
tendría que ser **3,8× más caro** para la criatura común y **20,2×** para la
afortunada. Es una perilla de diseño y pide un ADR; elegir el número adentro de
un test sería calibrar el mundo desde el arnés.

```bash
pnpm --filter @anima/oracle test tests/presupuesto.test.ts
```

### Hito 4 — `@anima/skills` · [`docs/hito-4-el-sandbox.md`](docs/hito-4-el-sandbox.md)

El sandbox: **186 tests verdes**, typecheck limpio, y los **seis** criterios
medidos. Superficie emitida, transformer de combustible, aislamiento con sombras
y escáner, ejecutor de generadores, y quince habilidades innatas escritas a mano
en el mismo TypeScript que va a escribir el modelo.

**El momento que este hito existía para tener: `skill-api.d.ts` dejó de
escribirse a mano.** Ahora lo emite `tsc --declaration` del código real, que
importa `@anima/physics`, `@anima/world` y `@anima/oracle`. Los 28 borradores
vueltos a correr contra esa superficie miden **cuánto se había separado de la
realidad un contrato de tipos mantenido a mano**:

| | errores | archivos con error | compilan limpio |
|---|---:|---:|---:|
| `.d.ts` **a mano** | 64 | 18 | 10 |
| `.d.ts` **emitido** | **84** | **25** | **3** |

**+20, y ninguno es una capacidad perdida**: 9 sitios donde `'wet'` buscaba un
CUERPO por una cualidad de CELDA, 4 de un `hunger` que la física no tiene, 3 de
`recall()` filtrando lugares por la masa de un lugar, 2 de `'stock'`, 2 de contar
ticks donde el mundo cuenta segundos. Cada uno es una mentira que la superficie a
mano sostenía. Y el **ejemplo canónico del documento de arquitectura no compila**:
busca agua con `see()`. Se deja rojo — lo que hay que corregir es el documento.

| Criterio | | Medido |
|---|---|---|
| las quince corren dentro del presupuesto | ✔ | peor paso **0,35 ms = 0,70%** del tick · margen 14× |
| un `while(true)` plantado se corta sin caer un frame | ✔ | **0,65 ms = 1,3%** del cuadro |
| una recursión infinita también | ✔ | **1,2 ms**, con su fase · y con un número nuevo |
| corrida dos veces, el mismo hash | ✔ | `6534ed50d8ef3c4c`, y otro si cambia |
| interrumpida por un guardado, converge | ✔ | llega, y gasta **5 de 8** reintentos en vez de 8 |
| mal tipada, rechazada en <250 ms sin viaje | ✔ | peor de seis: **19,6 ms** · margen 13× |

Dos hallazgos que sólo aparecen corriendo:

- **Once de las quince morían por combustible** en la primera llamada a un
  ayudante: el contador vive en el alcance de cada `mount()`, así que **cada
  módulo tiene su tanque** y el ejecutor recarga uno solo. Desde afuera se ve
  como «se pasó del presupuesto», que manda a optimizar código que no gastó nada.
  Reparado con `unirCeldas`.
- **Con el tanque de producción, la recursión infinita la mata la PILA y no el
  combustible**: V8 aguanta ~10.350 marcos instrumentados y el tanque son 200.000
  unidades, o sea 19×. El corte no se pierde nunca; lo que se perdía era el
  diagnóstico, y ahora el ejecutor lo nombra.

El [ataque al sandbox](docs/hito-4-el-sandbox.md#3-el-ataque-al-aislamiento) son
**27 tests**, y **seis se cuelan** —cada uno con `it.fails` y su reparación—. El
peor: una habilidad puede firmar una intención con el `by` de otro actor, porque
el ejecutor no estampa autoría. Es la puerta de atrás de la cuarentena y hay que
cerrarla antes del Hito 5.

```bash
pnpm --filter @anima/skills test tests/hito-4-el-criterio.test.ts
pnpm --filter @anima/skills test tests/ataque-al-sandbox.test.ts
```

### La puerta, cerrada · [`docs/la-puerta.md`](docs/la-puerta.md)

Siete adversarios tiraron **132 procesos** contra `admit()` en dos vueltas y
dejaron **72 huecos** marcados con `it.fails()` en `tests/ataque*.test.ts`.
**Están cerrados 62**; los 10 que quedan llevan escrito, cada uno al lado de su
prueba, qué haría falta para cerrarlos.

| | huecos | cerrados | abiertos |
|---|---:|---:|---:|
| 1ª vuelta · 3 adversarios, 62 procesos | 39 | 33 | 6 |
| 2ª vuelta · 4 adversarios, 70 procesos | 33 | 29 | 4 |

La segunda vuelta trajo un adversario nuevo, con el lente al revés: en vez de
buscar lo que la puerta deja pasar, buscó procesos **honestos que la puerta
rebota**. Encontró seis, y el peor era que **`comer` no se podía escribir** —o
sea que la criatura pescaba y no comía—, porque `nutrition` y `stamina` son las
dos conservadas y la regla 1 solo sabía sumar la misma cuenta.

Las causas raíz, y en negrita las dos más profundas:

| Causa | Reparación |
|---|---|
| la regla 2 solo miraba `drive` | `couple` y `transfer` pasan por la regla 2 |
| `transfer` miraba presencia, no cantidad | la cota del rol es el techo de lo que se mueve |
| **intensiva contra extensiva** | se compara `q · masa`; sin cota de masa, se rechaza por indecidible |
| se podía escribir una cualidad derivada | `cualidad-derivada` también sobre procesos |
| se acreditaba sin consumir ni terminar | un `transfer` sin `completion` corre `perTick × ∞` |
| los metadatos no se miraban | id, nombre, radio, compuerta, `trust`, y promesas |
| toda cuenta era por efecto y nunca en total | presupuesto **acumulado**: lo que entra una vez no paga N veces |
| las cotas del rol se tomaban por invariantes | `techoEfectivo` y `pisoParaDireccion` |
| lo que escribe quien propone decidía si la regla miraba | nombres de rol, espacios, unicode, `provenance` y `establishes` dejaron de ser la llave |
| `inverse` no se leía | el techo de un acople inverso es el **espejo** del piso de lo seguido |
| **no había conversión entre dos cuentas conservadas** | un `poweredBy` sobre otra conservada es una conversión, y `comer` entra |

**Y los cuatro procesos semilla siguen entrando sin una sola razón en contra**,
que es la otra mitad del trabajo: una puerta que rechaza todo es trivialmente
segura y completamente inútil. Las dos formas de equivocarse no son simétricas —
dejar pasar de más se endurece después; no dejar construir mata el juego, y lo
mata en silencio.


### Hito 2 — `@anima/world`  ·  [`docs/hito-2-el-mundo.md`](docs/hito-2-el-mundo.md)

Grilla en chunks con terreno en `TypedArray`, indice O(1) por celda mantenido
incrementalmente, `stepWorld` puro, invariantes por tick, journal append-only,
snapshot por delta y `hashWorld` estable.

| Criterio | |
|---|---|
| dos mundos gemelos con 10⁵ intenciones → mismo `hashWorld` | ✔ |
| restaurar un snapshot a mitad reproduce el final exacto | ✔ |
| el replay del journal reconstruye el estado exacto | ✔ |
| `stepWorld` ≤ 25% del tick, 5000 cuerpos ([II-0007](docs/decisions/II-0007-el-tick-es-un-parametro-y-el-presupuesto-una-fraccion.md)) | ✔ **17,6%** |
| el mismo hash en dos motores de JS | pendiente |

El tick bajo de **39,66 a 8,48 ms** (4,6x) sin mover la huella de conducta, y
lo verifico un agente independiente que re-midio con codigo propio, midio
tambien el codigo viejo, y corrio una partida de 2000 ticks con la ley 4 dando
de alta sustancias a mitad de camino — que es donde una memoizacion mal
invalidada se romperia. Hash final identico.

**El criterio viejo eran 4 ms absolutos y no se alcanzo.** El ADR II-0007 lo
reemplazo por una fraccion del tick y bajo la frecuencia a 20 Hz. Lo que vale
de esa decision son **dos perillas y no una**: la frecuencia gobierna el
rendimiento, las tasas de las leyes gobiernan el ritmo. Nunca se arregla uno
moviendo el otro. El ADR II-0008 lo construyó: ver arriba, con los números
medidos a las cinco frecuencias admisibles.

## Comandos

```bash
pnpm ii:typecheck
```

```bash
pnpm ii:test
```

Y los cuatro bancos del Hito 0, que se pueden volver a correr cuando se quiera —
todos salen 0 si el plan sigue en pie:

```bash
pnpm ii:banco
```

```bash
pnpm ii:combustible
```

```bash
pnpm ii:barrido
```

```bash
pnpm ii:navegador
```

El último levanta una página en <http://localhost:5180> y mide ahí mismo.

`ii:test` corre el **arnés de compilación**: los 28 borradores contra
`skill-api.d.ts` en cada build, con trinquete. La línea base solo puede bajar
sola; para que suba hay que editar `tests/linea-base.json` a mano y decir por
qué. Sin eso, el número deriva en silencio — que es exactamente el bug de
`DSL_REFERENCE` en Ánima I, una referencia mantenida a mano que divergió del
código y nadie se enteró hasta que el modelo no pudo colocar un bloque.

El Ánima I sigue funcionando igual que siempre: `pnpm dev`, `pnpm test`,
`pnpm demo`. Los dos árboles conviven hasta el Hito 5.
