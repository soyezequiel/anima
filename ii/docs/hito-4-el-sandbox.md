# Hito 4 — El sandbox, y el día que el contrato de tipos dejó de mentir

`@anima/skills` · **186 tests verdes**, typecheck limpio · los **seis** criterios
del documento de arquitectura, medidos uno por uno.

Lo que este hito construyó son cuatro piezas —la superficie, el combustible, el
aislamiento y el ejecutor— más quince habilidades escritas a mano en el mismo
TypeScript que después va a escribir el modelo. Y lo que este hito **midió** es
una sola cosa, la que justificaba hacerlo antes que la mente:

> **cuánto se había separado de la realidad un contrato de tipos mantenido a mano
> sin código que lo ejercite.**

La respuesta son veinte errores nuevos sobre un corpus de veintiocho borradores,
y ninguno de los veinte es una capacidad perdida.

---

## 1. El momento: los 28 borradores contra la superficie emitida del código real

Hasta este hito, `skill-api.d.ts` —el archivo que **es el prompt**, lo único que
el modelo ve de la API— se escribía a mano. Su propio encabezado decía que era
temporal. Ahora lo emite `tsc --declaration` de `src/tipos.ts` + `src/ctx.ts`,
que importan `@anima/physics`, `@anima/world` y `@anima/oracle`: las cualidades,
las celdas, las intenciones y los motivos **son los del mundo**, no una copia.

La medición es *apples-to-apples*: mismo corpus, mismos `tsconfig`, lo único que
cambia es el `.d.ts`. Está calibrada — con el archivo a mano reproduce **exacto**
el 64 de la línea base anterior.

| | errores | archivos con error | compilan limpio |
|---|---:|---:|---:|
| `.d.ts` **a mano** | 64 | 18 | 10 |
| `.d.ts` **emitido** | **84** | **25** | **3** |

**+20 errores. −7 borradores expresables.** Y el número está en
`tests/linea-base.json` con el porqué de cada uno, porque es un trinquete: baja
solo, y para subir hay que editarlo a mano y explicarlo.

### Los 20 errores nuevos son SEIS causas, y ninguna es una capacidad perdida

| sitios | archivos | causa | qué mentía la superficie a mano |
|---:|---:|---|---|
| 9 | 6 | `'wet'` no es cualidad de cuerpo | el agua es un campo de **celda**. Buscarla con `see()` buscaba un CUERPO por una cualidad que los cuerpos no tienen. Se busca con `qAt`, `recall` o `explore`, y la superficie tiene las tres |
| 4 | 3 | `SelfView.hunger` | **la física no tiene ninguna cualidad `hunger`**. Lo que duele es `stamina`, que es conservada y la drena el metabolismo |
| 3 | 3 | `recall()` toma `WhereCell` | un LUGAR no tiene `mass`, ni `charred`, ni `fuelEnergy`: tiene las cuatro cualidades de celda |
| 2 | 2 | `'stock'` no es cualidad | hueco ya anotado en la física (`EXTRACCION` usa `mass > 0` como stock restante). Antes typechequeaba y devolvía un número sin significado |
| 2 | 2 | `Clock.ticksToNightfall` | ADR II-0008: esperar es **ritmo**, no muestreo |
| 3 | 1 | el ejemplo canónico entra al corpus | ver abajo |

Las 9 llamadas a `apply()` con procesos que no existen (`afilar`, `cavar`,
`cubrir`, `ahumar`, `arrastrar`, `combustion`) **no son nuevas**: eran errores
contra `ProcessId` y ahora lo son contra `SeedProcessId`.

Los **7 borradores que dejaron de compilar** suman 12 errores entre todos, y los
12 son de esas mismas cuatro causas: `wet` (7), `stock` (2), `hunger` (2),
`ticksToNightfall` (1). **Ni uno es algo que el mundo pueda hacer y la superficie
ya no deje escribir.** Subir de 64 a 84 es el árbitro empezando a funcionar,
igual que cuando los roles tipados subieron 15 a propósito en el pase 3.

### Y dos bugs del propio arnés, que hacían que midiera menos de lo que decía

**1. El ejemplo canónico del documento de arquitectura no lo compilaba nadie.**
`00-pescar-con-aparejo.ts` vive suelto en `borradores/` y las tandas t1..t4
incluían `borradores/tN`. El test `el ejemplo canónico compila` preguntaba
`conError.has('00-…')` sobre un archivo que ningún `tsc` había mirado: estaba
**trivialmente verde**, que es la peor clase de verde. Ahora hay una
`tsconfig.t0.json`, se compila, y da tres errores:

```
37: Type '"wet"' is not assignable to type 'QualityId'.
40: Type '"wet"' is not assignable to type 'QualityId'.
44: Type '"wet"' is not assignable to type 'QualityId'.
```

Los tres son el mismo: el documento busca agua con `ctx.see([{ q: 'wet' }])`. **Se
deja rojo a propósito.** Repararlo acá sería arreglar la medición: lo que hay que
corregir es el documento. El test ahora afirma **exactamente esos tres errores**,
así que se pone rojo si aparece otro o si dejan de aparecer.

**2. El contador tomaba cualquier línea de `tsc`, y las tandas incluían `src`.**
Mientras `src/` era el `.d.ts` y nada más, eso daba igual. Con el ejecutor, el
combustible, el aislamiento y las quince innatas adentro, el número del trinquete
se habría movido porque alguien rompió un archivo de *runtime*. Dos cosas
contadas en el mismo número no son medibles ninguna de las dos. Ahora el arnés
cuenta **solo `borradores/`**, y hay un test que verifica que no se cuele nada
más.

```bash
pnpm --filter @anima/skills test tests/arnes.test.ts
```

---

## 2. El criterio del Hito 4, los seis, medidos

> «las quince corren dentro del presupuesto; un `while(true)` plantado se corta
> sin caer un frame; una recursión infinita también; una habilidad corrida dos
> veces da el mismo hash; una habilidad interrumpida por un guardado converge
> (test de continuidad); un programa mal tipado se rechaza en menos de 250 ms sin
> viaje.»

Todo esto vive en **`tests/hito-4-el-criterio.test.ts`**, que vuelve a medir en
cada corrida. El tick es de **50 ms** (20 Hz, ADR II-0007 / II-0008).

| | criterio | medido | |
|---|---|---|---|
| **a** | las quince corren dentro del presupuesto | peor paso **0,35 ms = 0,70%** del tick (tope 10%) | ✔ margen 14× |
| **b** | un `while(true)` plantado se corta sin caer un frame | **0,65 ms = 1,3%** del cuadro | ✔ |
| **c** | una recursión infinita también | **1,2 ms = 2,4%** del cuadro, con su fase | ✔ · con un número nuevo |
| **d** | corrida dos veces, el mismo hash | `6534ed50d8ef3c4c` en las dos, y otro si cambia | ✔ |
| **e** | interrumpida por un guardado, converge | llega, y gasta **5 de 8** reintentos en vez de 8 | ✔ |
| **f** | mal tipada, rechazada en <250 ms sin viaje | peor de seis: **19,6 ms** | ✔ margen 13× |

### (a) Las quince, instrumentadas de verdad y corridas por el ejecutor

Hasta este pase las quince se corrían con un *driver* de juguete que ni
instrumenta ni pone tanque: medía que **terminen**, no que entren en el
presupuesto. Ahora se leen del disco, pasan por el transformer de combustible, se
montan con `mount()` en el alcance sombreado y las avanza `SkillRun`. Es
exactamente el camino por el que va a entrar el código que escriba el modelo.

```
  ir                           peor paso  0.345 ms  (0.69% del tick) · 2 pasos
  unir                         peor paso  0.294 ms  (0.59% del tick) · 2 pasos
  explorar                     peor paso  0.257 ms  (0.51% del tick) · 1 paso
  juntar                       peor paso  0.224 ms  (0.45% del tick) · 5 pasos
  tantear                      peor paso  0.118 ms  (0.24% del tick) · 3 pasos
  huir-del-dolor               peor paso  0.099 ms  (0.20% del tick) · 2 pasos
  comer                        peor paso  0.099 ms  (0.20% del tick) · 2 pasos
  guarecerse                   peor paso  0.078 ms  (0.16% del tick) · 2 pasos
  sostener                     peor paso  0.075 ms  (0.15% del tick) · 4 pasos
  seguir-orden-de-movimiento   peor paso  0.064 ms  (0.13% del tick) · 2 pasos
  esperar                      peor paso  0.055 ms  (0.11% del tick) · 9 pasos
  poner                        peor paso  0.050 ms  (0.10% del tick) · 4 pasos
  deshilachar                  peor paso  0.046 ms  (0.09% del tick) · 3 pasos
  aplicar-proceso              peor paso  0.040 ms  (0.08% del tick) · 1 paso
  frotar                       peor paso  0.033 ms  (0.07% del tick) · 1 paso
```

- **Las quince a la vez**, cada una en su peor paso: **1,81 ms = 3,6% del tick.**
  Es la cota que el ADR II-0005 dejó anotada para vigilar («el margen es de hoy,
  con UNA habilidad»).
- **Ninguna se acerca a agotar el tanque**: el peor consumo es `explorar` con
  **277 de 200.000** unidades (0,14%). Una habilidad honesta mira diez cuerpos y
  cede; si alguna se acercara al tanque sería la señal de que está **simulando el
  futuro**, que es lo que el ADR II-0004 prohíbe.
- Ninguna suspendió, ninguna se rompió, y **ninguna toca un global prohibido**
  (verificado con el escáner sobre los 18 archivos).

#### El hallazgo que salió de montarlas de verdad: **un tanque por MÓDULO**

**Once de las quince murieron por `OutOfFuel` en la primera corrida real**, todas
en la primera llamada a un ayudante de `comun.js`.

El contador `__fuelLeft` es una variable del alcance de **cada** `mount()`, y eso
es lo que lo hace barato. El precio es que cada montaje tiene su propio tanque, y
el ejecutor recarga uno solo: en cuanto la habilidad llama a un ayudante que vive
en otro módulo, ese módulo arranca en cero y su primer `--__fuelLeft` lanza.

Desde afuera se ve como «la habilidad se pasó del presupuesto» — **el peor
diagnóstico posible, porque manda a optimizar código que no gastó nada**. El
síntoma real es inconfundible una vez que se sabe: el tanque que sí se recarga
reporta `spent: 1`.

Reparado con `unirCeldas(celdas)` en `combustible.ts`: una celda que recarga
todas con el mismo tanque y reporta el peor gasto. Se recarga el tanque **entero**
en cada una y no una fracción, porque la habilidad tiene UN presupuesto y no sabe
en cuántos módulos la empaquetaron: repartirlo haría que agregar un `import` la
ahogue. Lo que se pierde es una cota de un factor N, y se acepta porque N lo fija
quien empaqueta y no quien escribe. Hay un test que lo deja pinchado: con y sin
`unirCeldas`, el mismo código.

### (c) El número que faltaba: con el tanque de producción la mata la PILA

El ADR II-0005 conservó la instrumentación de las **entradas de función** —aunque
sacarlas no ahorraba nada medible (52,6% → 51,9%)— con este argumento: hace que
la recursión infinita muera por combustible y no por `RangeError`, o sea con
suspensión administrable en vez de con el stack reventado.

Es cierto, **y tiene una condición que nadie había medido: el tanque tiene que
ser más chico que la pila.**

| tanque | causa de muerte |
|---:|---|
| 1.000 | combustible |
| 5.000 | combustible |
| 10.000 | combustible |
| 20.000 | **pila** |
| 50.000 | **pila** |
| **200.000** (`FUEL_POR_PASO`) | **pila** |

La pila de V8 aguanta **~10.350 marcos** de una función instrumentada, y el tanque
de producción son 200.000 unidades: el `RangeError` gana por **19×**.

Lo que el ADR quería comprar con esa promesa no era el nombre del error: era que
el corte fuera **administrable**, o sea que llegara con su fase y no como «se
rompió». Eso se cumple, y ahora explícitamente — `ejecutor.ts` reconoce el
desborde de pila y lo reporta como `se fue de pila: hay una recursión sin fondo`,
con la fase adelante, igual que el `OutOfFuel`. Se mira la clase **y** el texto,
porque `RangeError` también lo tira `new Array(-1)` y el mensaje del desborde no
está especificado (V8, SpiderMonkey y JavaScriptCore dicen tres cosas distintas).

**El corte nunca se pierde; lo que se perdía era el diagnóstico.**

### (e) La continuidad, con número

El criterio del documento **no es comparar hashes**: es que el objetivo se
alcance y que repita poco. Se mide sobre `ir`, una innata de verdad, con el
escenario donde la diferencia se puede ver: la criatura choca contra algo
(`celda-ocupada` es el único motivo que **mejora** esperando, y por eso `ir`
reintenta) y se guarda a mitad de los reintentos.

```
  ir, interrumpida por un guardado en la fase "ir" con {"ir:p":3}:
    llega al objetivo en 1 pasos
    reintentos que gasta desde cero        : 8
    reintentos que gasta desde el guardado : 5   (los 3 de antes no se repiten)
```

Al lado está el contraste que le da sentido: la misma cuenta en una variable
**local** del generador guarda `{}` y repetiría todo. Una corutina suspendida no
se serializa en ningún motor de JS; lo único que sobrevive es `ctx.memory` y la
fase, y eso no es un defecto de esta implementación: es la única verdad
disponible.

### (f) El portón: escáner de determinismo + typecheck, sin salir de la máquina

Seis formas de estar mal tipado, una por clase de error que el corpus produjo, en
la **ranura fija** que es lo que la fragua del Hito 8 hace de verdad (un
`LanguageService` con la candidata siempre en el mismo *path*, del que solo
cambian el contenido y la versión).

```
  una cualidad que no existe                                19.3 ms
  un campo que la superficie no tiene                       16.5 ms
  un rol mal escrito                                        19.2 ms
  un rol que falta                                          19.0 ms
  un proceso que no existe                                  18.6 ms
  el índice sin guarda (el error más frecuente del corpus)   18.2 ms
```

**Peor: 19,6 ms contra un presupuesto de 250. Un viaje al modelo son 6.000 a
25.000 ms.** Y los seis errores **nombran el problema** (`QualityId`, `hunger`,
`gera`, `actor`, `afilar`, `undefined`), que es lo que hace que la reparación
determinista del Hito 8 sea posible.

Dos mitades más, porque una puerta que rechaza todo no mide nada:

- `Math.random() ** 2` **typechequea perfecto** —es JavaScript válido y tipado— y
  lo rechaza el **escáner**, con 2 hallazgos, en 18 ms. Por eso el escáner corre
  **antes** y no después.
- Una habilidad sana pasa: 0 errores de tipos y 0 hallazgos.

Y el banco del Hito 0 (`pnpm ii:banco`), que mide lo mismo sobre los **27
borradores de verdad** en vez de sobre seis programas armados a mano, sigue
pasando con la superficie emitida: **p50 18 ms, p95 34 ms, peor 137 ms**, todo
por debajo de los 250. Que el peor sea 7× el p50 vale anotarlo: el presupuesto
tiene margen de sobra pero **no es plano**, y quien lo vigile tiene que mirar el
p95 y el peor, no el promedio.

---

## 3. El ataque al aislamiento

`tests/ataque-al-sandbox.test.ts` — **27 tests**, y lo que se cuela está marcado
con `it.fails` y su porqué, no borrado.

### El modelo de amenaza, dicho antes de medir

El documento lo fija: *código tonto de un proveedor de confianza media, no un
adversario con exploits de motor*. La caja existe para que **equivocarse sea
imposible**, no para contener a alguien que quiere salirse.

### Hay TRES puertas, y confundirlas es cómo se declara segura una que no lo es

1. **el escáner** — sintaxis y métodos de prototipo (`**`, `localeCompare`,
   `toLocaleString`) que ninguna sombra puede tapar sin parchear los intrínsecos
   para todo el hilo, o sea sin romperle el motor al mundo;
2. **el typecheck contra el `.d.ts` emitido** — resultó ser **todo el capítulo de
   mutación**;
3. **las sombras y el alcance cerrado de `mount()`** — lo que queda.

### Lo que rebota

| ataque | qué pasa |
|---|---|
| `Math.random()`, `new Date()`, `Date.now()` | `ForbiddenError`, y el mensaje manda a `ctx.rng` / `ctx.tick` |
| `globalThis`, `process.env`, `performance.now()` | `ForbiddenError` con el reemplazo adentro |
| `fetch`, `setTimeout`, `console.log`, `localStorage` | `ForbiddenError` con el reemplazo adentro |
| `new Function('return 1')()` | `ForbiddenError`: no se fabrica código nuevo |
| `import * as fs from 'node:fs'` | `la habilidad importa "node:fs", que no existe adentro del sandbox` |
| `import('node:fs')` | **dos puertas**: `instrument()` emite CommonJS y TypeScript reescribe `import(x)` a `Promise.resolve().then(() => require(x))`, así que muere en la sombra de `Promise`; y **debajo** está el `require` del sandbox. El test verifica las dos, la de hoy por su mensaje y la de mañana quitándole la sombra a `Promise` para ver qué queda |
| `ctx.memory = {…}` | lanza: `installSkillState` la define sin `writable` y el sandbox corre en `"use strict"` |
| `yield { __anima: 'suspension' }` | **no** se toma por una suspensión: `isSuspension` compara por identidad, así que nadie se fabrica una para saltearse `maxStalls` |
| `yield null` / `yield undefined` | `rota`, con «cedió algo que no es una intención» |
| `while(true)` adentro de un `finally` | cede, y a las N suspensiones el ejecutor la declara **trabada** |
| dos habilidades sobre el mismo `ctx` | lanza en vez de pisar: compartirían `ctx.memory` |
| declarar `reversible` un `eat` | lo rechaza **el mundo**, que recalcula el compromiso. El ejecutor **no** lo corrige, y eso es lo correcto: si lo corrigiera, el mundo dejaría de ser el árbitro |

### Lo que se cuela — seis `it.fails`, cada uno con su reparación

**1. `(function(){}).constructor` sale al alcance global.** Declarado en `mount()`
desde el primer día. Cerrarlo pide congelar `Function.prototype` para todo el hilo
—donde también corre el mundo— o un intérprete propio, que es la decisión que el
documento tomó al revés cuando descartó QuickJS por el costo del cruce de
frontera. Se acepta porque nadie lo escribe por distracción. **El día que se
ejecuten habilidades compartidas entre usuarios, esto deja de ser aceptable.**

**2. Mutar `at` mueve al cuerpo y a la criatura, sin emitir ninguna intención.**
`b.at.x = 999` teletransporta una piedra y `ctx.self.at.y = 777` mueve a la
criatura, sin pasar por `stepWorld`. **El typecheck lo rebota** —`Cell` es
`readonly x/y` en `@anima/world`, y ese `readonly` sale del código real— pero el
sandbox no: la vista de percepción comparte la referencia de la celda con el
mundo, porque clonar una celda por cuerpo y por tick es el gasto que el Hito 2 se
pasó cuatro semanas sacando. **Importa igual aunque el compilador lo ataje**: por
la puerta 2 pasa todo lo que el modelo escribe, pero no lo que se carga de un
guardado ni un camino futuro sin tipos. *Una defensa que vive en una sola puerta
es una defensa con horario.*

**3. El estado de MÓDULO sobrevive a la corrida, y `save()` no lo ve.** «La única
sede de estado que sobrevive es `ctx.memory`» es verdad para las variables
**locales** de la habilidad, y falsa para las de nivel superior del módulo:
`mount()` lo evalúa una vez y sus `let` viven mientras viva el montaje. Es la peor
forma de esta clase de bug — **no** viaja en `save()` y **sí** sobrevive dentro de
una sesión: las dos mitades de lo contrario de lo que hace falta. Reparación
barata y verificable: **que el escáner rechace toda declaración mutable de nivel
superior** en el módulo de una habilidad.

**4. `abort()` la declara terminada, pero el generador no se cerró.** `abort()`
usa `gen.return()` para que corran los `finally`, que es lo correcto. Pero un
`yield` adentro de un `finally` **secuestra el `return`**: la especificación dice
que el generador se reanuda y `return()` devuelve `{ done: false }`. Como la
inyección de combustible **es** un `yield`, cualquier `finally` con un bucle
suficientemente largo lo consigue sin proponérselo. Medido: `g.return(x)` da
`{ value: SUSPENSION, done: false }`. El ejecutor no mira `done`, así que
**reporta `terminada` sobre una corutina viva**, y el `finally` que soltaba lo que
tenía en la mano no corrió. Reparación: mirar el `done`, insistir un número
acotado de veces, y si no cierra, `gen.throw()`. Cinco líneas — **hoy el informe
miente, que es peor que fallar**.

**5. `yield 42` viaja al mundo como si fuera una intención.** El ejecutor
comprueba `null`/`undefined` y la identidad de la suspensión, y nada más. Un
número llega a `stepWorld`, que lo rechaza — pero el rechazo nombra al **mundo** y
no a la habilidad, y el informe del juez lo cuenta como «el mundo rechazó», que es
el diagnóstico equivocado en el archivo equivocado. Reparación: dos líneas en
`SkillRun.step`, con el mismo mensaje que ya existe para `null`.

**6. Una habilidad puede firmar una intención con el `by` de OTRO actor.**
`SkillRun.step()` devuelve lo cedido verbatim: no estampa `by` ni `seq`. Una
habilidad puede emitir `{ k: 'eat', by: 'el-cuidador', … }` y `stepWorld` lo va a
atender —busca `d.actors.get(i.by)` y si ese actor existe, actúa—. **No hay forma
de que el mundo lo note**: le llega un array plano de intenciones y no sabe de qué
corrida salió cada una. Y no es solo suplantación: es **la puerta de atrás de la
cuarentena**, porque los permisos se comparan contra el actor que firma, así que
firmando con otro `by` se saltean juntos el ADR II-0003 y el portón de
confirmación. Reparación, y va en este paquete porque es el único que sabe de
quién es la corrida: `SkillRun` recibe el `ActorId` dueño y `step()` devuelve
`{ ...cedido, by: dueño, seq: n++ }`.

**De los seis, el 6 es el que hay que cerrar antes del Hito 5**, y el 3 y el 4
antes del juez del Hito 7 — el 3 porque una habilidad que se acuerda de la vida
anterior arruina la comparación entre dos versiones, y el 4 porque un informe que
miente sobre si una habilidad terminó envenena la grilla entera.

---

## 3·bis. Contratos que deben revalidarse por la extensión de objetos emergentes

**El Hito 4 sigue cerrado y sus seis criterios siguen medidos.** Lo que hay que
**planificar** para el [Gate 5→6](gate-5-6-objetos-emergentes.md):

- **reemplazo del `Blueprint` placeholder.** Hoy es `{ id, at }` en
  `skills/src/tipos.ts`, y la intención `place` la rechaza el mundo con
  `'no-implementado'`. El `BlueprintDefinition` que lo reemplaza es **canónico,
  inmutable, versionado y NO lleva el sitio adentro**
  ([ADR II-0015](decisions/II-0015-el-plano-no-es-el-esquema-de-construccion.md));
- **construcción o colocación por slots**, con **revisión exacta** e
  **idempotencia** (ADR 0034 de Ánima I, ya portado a este hito);
- **`BuildSkill` y `UseSkill` como piezas separadas**: construir algo no demuestra
  que funcione, y el juez los evalúa aparte;
- **percepción con datos autoritativos**: lo que la criatura ve de un dispositivo
  sale del estado del mundo, no de una lectura geométrica.

**Y una advertencia que vale más que las cuatro:** `covering` e `inside` **no son
contención física**. El `arrangement` `inside` se evalúa hoy como «tiene algo
encima o lo sostiene alguien» (`world/src/step.ts`). Leerlo como contención sería
inventar geometría que la física no modela — y la geometría autoritativa es el
Hito 14, después de un spike.

---

## 4. Lo que quedó abierto, y no es del sandbox

Estos son huecos del **mundo** y de la **superficie**, encontrados escribiendo las
quince y anotados en sus contratos (`51 huecos`, ninguna habilidad con cero). Los
que hay que mirar antes del Hito 5:

- **`explore` está partido en dos y ninguna mitad está entera.** El `Intent` del
  mundo es `{ k: 'explore', maxTicks }` y nada más: **la clausura `until` no
  cruza**, y `stepWorld` no produce jamás `'found'` ni `'timeout'`. Quien evalúa
  `until` y quien repite tiene que ser el ejecutor. Es la costura más grande que
  este hito deja abierta, y es la razón por la que el ejemplo canónico del
  documento no lo puede satisfacer nadie todavía.
- **`toxicity` no la cobra nadie.** El comentario de `ctx.eat` dice «cuánto
  enferma (`toxicity`)» y `grep toxicity` sobre `@anima/world/src` da **cero**.
  Comer algo podrido es hoy exactamente igual de bueno que comerlo fresco a
  igualdad de calorías. O se implementa o el comentario miente.
- **Falso verde de unidades.** `explore.maxTicks` va en TICKS y
  `clock.secondsToNightfall` en SEGUNDOS, y
  `ctx.explore({ until, maxTicks: ctx.clock.secondsToNightfall })` compila con
  **cero errores**. A 20 Hz explora veinte veces menos de lo que se quería. Es la
  misma clase de bug que el ADR II-0006 cerró en la física con tipos nominales; la
  superficie que escribe el modelo, que es la que menos margen tiene, no tiene
  nada. Reparación: `Segundos` y `Ticks` nominales, con `ctx.hz` como única
  puerta.
- **`ctx.self`, `ctx.tick` y `ctx.clock` son PROPIEDADES, no métodos**, y la API
  no dice si se refrescan. Un generador recibe `ctx` una vez; `see()` y `q()` se
  releen porque son métodos, `self` no. **Cinco de las quince fallan** si la vista
  queda congelada. El ejecutor llegó a lo mismo por el otro lado y lo escribió
  como contrato en prosa sobre `WorldCtx` — o sea que la lectura correcta vive en
  un comentario que el modelo no lee. Reparación: `ctx.self()`, y la firma lo dice
  sola.
- **`recall` sin `remember`**, y **no hay forma de pedir celdas**: `qAt` exige que
  uno le dé la celda. `guarecerse` termina barriendo 80 llamadas a `qAt` por un
  radio de 4 para contestar lo que un predicado contestaría de una.
- **No hay dolor.** Ninguna de las 29 cualidades es `pain`/`health`/`damage`, y
  ninguno de los 20 `Motivo` habla de daño. «Huir del dolor» es hoy «huir del
  calor». Y falta la otra mitad estructural: un reflejo tiene que poder
  **interrumpir** lo que corre, y `Ctx` no tiene prioridad ni `abort`.
- **Canal símplex**: `ctx.say` sale y nada entra. Un modelo escribiendo «hacé lo
  que te pida el cuidador» va a escribir `ctx.heard()` y comerse un TS2339.
- **No se puede leer `establishes` ni `where` de un proceso.** `SEED_ROLE_NAMES`
  publica los nombres de rol y nada más: se sabe **qué** roles pide, no **qué** les
  pide ni **para qué** sirve. Y `establishes` es exactamente la llave con la que el
  Hito 7 indexa la biblioteca.

---

## Cómo se vuelve a correr todo

```bash
pnpm ii:typecheck
pnpm ii:test

# el momento del hito, solo:
pnpm --filter @anima/skills test tests/arnes.test.ts

# los seis criterios, con sus números:
pnpm --filter @anima/skills test tests/hito-4-el-criterio.test.ts

# el ataque:
pnpm --filter @anima/skills test tests/ataque-al-sandbox.test.ts

# y el .d.ts, que se emite y no se transcribe:
pnpm --filter @anima/skills emitir-api
```
