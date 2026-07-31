# Continuar acá — traspaso del Hito 5

Este archivo existe para que **otra sesión, en otra cuenta, sin nada de la
conversación anterior**, pueda seguir sin volver a descubrir lo que ya se
descubrió. Lo que estaba en la memoria personal de la cuenta anterior se bajó
acá, porque la memoria es por cuenta y no viaja.

Última actualización: **2026-07-31**, con los **tramos A, B, C, C·bis y D del
Gate 5→6** cerrados. El D: **`place` dejó de contestar `'no-implementado'`** y
pasó a significar otra cosa —despliega un CUERPO ya armado, no construye un plano
(ADR II-0022)—, con la tabla `WorldState.desplegados`, su ranura de guardado y su
entrada al hash. Van **8 de los 12 puntos** del gate CUMPLIENDO y 3 a medias. Y el D·bis le dio de comer: **un cuerpo desplegado con `catch > 0`
al lado de un pozo saca solo** —3 piezas en 20 s, sin una sola intención— y la
regla es una CUALIDAD DERIVADA, no un `kind`: ahí está el punto 12 cumplido por
la física. Y antes: la costura del catálogo llega hasta la mente —**la deuda 1 del
gate está pagada**—, una frontera armada con otro catálogo se descarta y se
replantea (ver el final de la sección 0·bis), **`BlueprintDefinition` existe** en
`@anima/physics` con `definirPlano()` de puerta, y el **C·bis midió `unir` antes
de diseñar la obra**: el mundo ya sabe construir un plano, y la medición encontró
cinco huecos en el plano recién escrito. Van **4 de los 12 puntos** del gate
cumpliendo y 3 a medias.

> **LA REGLA 1 SE PAGÓ SOLA OTRA VEZ, y es lo más útil del día.** Antes de
> diseñar un mecanismo de obra —proyecto con sitio, roles que se llenan, obra que
> se materializa— se midió si el mundo ya lo hacía. Lo hace: cada `union` es una
> acción suelta y cada paso intermedio es un cuerpo legal. Lo que sí encontró la
> medición son **cinco huecos en el `BlueprintDefinition` escrito esa misma
> mañana**, todos verdes porque ningún test había intentado construir nada. El
> detalle está en la sección «El tramo C·bis» de
> [`gate-5-6-objetos-emergentes.md`](gate-5-6-objetos-emergentes.md), y el que más
> se repite en este proyecto: **la cota que manda no es `MAX_PARTS`, es la
> HONDURA** — un árbol de cuatro piezas ya toca `MAX_ASSEMBLY_DEPTH`. Antes de eso, el gate decidido y escrito
(sección 0·bis, y el criterio entero en
[`gate-5-6-objetos-emergentes.md`](gate-5-6-objetos-emergentes.md)), y antes el
**tramo Ñ** (el ancla del fondo y el rumbo del `explore`: el punto 9 de la
sección 6, cerrado en dos mitades). El resultado que manda sigue siendo el
**punto 0 de la sección 6** —el Hito 5 cerró con 3 de 6 y 3 aceptados—, y el tramo
Ñ acercó la canónica al techo: muere en el 18.150 de 20.000, ya sin gastar nada en
pasearse.

---

## 0·bis · EL ORDEN DEL PROYECTO, decidido el 2026-07-31

Va acá arriba porque cambia qué hay que hacer después de este archivo, y porque
lo primero que va a querer hacer alguien que lea la sección 6 es meter todo lo
nuevo adentro del Hito 5. **No.**

```
terminar el Hito 5 actual
  → Gate técnico de objetos emergentes   ← gate-5-6-objetos-emergentes.md
    → Hitos 6–11
      → Hito 12 (UI presentable)
        → Hitos post-UI de física abierta (13–16)
```

**EL HITO 5 TERMINA CON SU ALCANCE ACTUAL.** Está ~80% implementado y su criterio
de cierre —los seis puntos, con 3 que cumplen y 3 en rojo aceptado— **no se
amplía**. No se le agregan planos, ni persistencia de catálogo, ni dispositivos
autónomos. **Nada de lo nuevo obliga a rehacer trabajo terminado**
([ADR II-0019](decisions/II-0019-el-gate-5-6-no-reabre-el-hito-5.md)).

**LO ÚNICO QUE EL HITO 5 TIENE QUE CUIDAR ES UNA COSTURA**, y está medida:

| mitad | estado | dónde |
|---|---|---|
| `plan()` acepta un catálogo inyectado | **YA ESTÁ**: `OpcionesDePlan.esquemas` reemplaza la tabla entera | `plan/src/regresion.ts:2133` |
| la mente se lo pasa | **NO**: llama `plan(g, v, presupuesto, e.frontera)` sin opciones | `mind/src/escalera.ts:1429` |
| la mente precalcula precios | **AL CARGAR EL MÓDULO**, desde `SCHEMA_INDEX` | `mind/src/oportunidades.ts` (`LO_QUE_CUESTA_ESTABLECER`) |

Lo que el Hito 5 tiene que hacer con esto: **nada, salvo no empeorarlo** — no
agregar lectores nuevos de `SCHEMA_INDEX` en tiempo de carga. Llevar la vista
hasta la mente es **deuda del gate**.

> ### CERRADO — tramo A del gate, 2026-07-31. La tabla de arriba ya no describe el árbol
>
> Se deja entera porque es el diagnóstico del que salió el trabajo. Hoy las tres
> filas están en verde y hay una cuarta que la tabla no tenía:
>
> | mitad | hoy |
> |---|---|
> | `plan()` acepta un catálogo | **`OpcionesDePlan.catalogo`**, una `PlannerCatalogView` con identidad, y `esquemas` queda como escotilla de laboratorio |
> | la mente se lo pasa | **SÍ**: `plan(g, v, presupuesto, e.frontera, { catalogo })`, y también a D3 |
> | la mente precalcula precios | **por `catalogEpoch`**, no al cargar (`mind/src/catalogo.ts`, `porEpoch`) |
> | **y eran CUATRO lectores, no uno** | tres desatados; el de `creencias.ts` lee el core **a propósito** y el porqué está escrito arriba de `delEsquema` |
>
> **Y ahora hay un guardián de texto en los dos paquetes** que se pone rojo si
> aparece un lector nuevo de `ESQUEMAS`/`SCHEMA_INDEX`. Es lo que faltaba: la
> deuda creció a cuatro sitios justamente porque agregar el quinto no rompía nada.
>
> **Y el tramo B cerró el cabo suelto:** `Frontera` lleva el `catalogEpoch` con el
> que se armó y `plan()` la descarta y replantea cuando no coincide. Sellar pasó a
> ser perezoso, que es lo que dejó que la escotilla de laboratorio entre por el
> mismo camino en vez de tener el suyo.

### Las trece decisiones de producto, que NO se vuelven a preguntar

1. Antes de la UI, Ánima inventa objetos y habilidades **dentro de una física
   fija escrita por humanos**.
2. El caso de aceptación es **«fabricá una trampa para peces»**.
3. La trampa **no está precargada**.
4. Es un **dispositivo autónomo desplegado sobre un `Stock`**.
5. Se la puede dejar, alejarse, volver y **retirar la captura**.
6. Los peces **no se mueven** en esta primera versión.
7. La captura es **estado autoritativo almacenado**, no contención geométrica.
8. **Ningún `kind`, receta, skill ni caso especial** llamado `fish-trap`,
   `trampa-para-peces` ni equivalente, en producción.
9. La **física genérica** de despliegue, retención e interacción con stocks la
   escriben humanos.
10. Ánima inventa **el plano, los materiales, la construcción y el uso**.
11. La **UI se construye después del Hito 11**.
12. Después de la UI se amplía la física hacia «crear cualquier objeto».
13. Las **skins con IA quedan fuera de Ánima II 1.0**.

Y la regla que reemplaza a la promesa vieja: **no se promete «cualquier cosa»**.
Se dice así: *Ánima puede crear cualquier artefacto cuya estructura,
construcción, uso y efectos puedan representarse y comprobarse con las
capacidades físicas disponibles en ese nivel.*

### Los cinco ADRs propios que salieron de esto

| ADR | qué fija |
|---|---|
| [II-0015](decisions/II-0015-el-plano-no-es-el-esquema-de-construccion.md) | `BlueprintCandidate` **no entra a `SCHEMA_INDEX`**; cinco piezas separadas |
| [II-0016](decisions/II-0016-un-dispositivo-desplegado-retiene-sobre-un-stock.md) | dispositivo desplegado sobre un stock; la captura es **estado**, no geometría |
| [II-0017](decisions/II-0017-el-descriptor-visual-no-es-fisica.md) | el descriptor visual es **vista derivada**, con `renderDescriptorHash` |
| [II-0018](decisions/II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md) | catálogo **core + biblioteca + overlay**, y `PlannerCatalogView` |
| [II-0019](decisions/II-0019-el-gate-5-6-no-reabre-el-hito-5.md) | el gate **no reabre** el Hito 5 |

---

## 0 · Lo primero que hay que leer, en este orden

1. Este archivo, entero. Es **el estado**: qué se cumple, qué falta y qué está
   abierto. Cambia en cada tramo.
2. **[`como-se-trabaja.md`](como-se-trabaja.md)** — el método, las decisiones ya
   tomadas, cómo no gastar horas de más, y los números corregidos con su regla.
   Eso **no** cambia de un tramo al otro: se lee UNA vez, al empezar. Están
   separados porque este archivo llegó a 523 líneas y se releía entero para
   actualizar treinta números.
3. [`ii/README.md`](../README.md) — el índice del remake y sus tres reglas.
4. [`docs/architecture/remake-anima-ii.md`](../../docs/architecture/remake-anima-ii.md)
   — la arquitectura. La sección del **Hito 5** (cerca de la línea 1452) es el
   criterio de corte del proyecto.
5. [`ii/docs/gate-5-6-objetos-emergentes.md`](gate-5-6-objetos-emergentes.md) —
   **qué viene después del Hito 5 y antes del 6**, con las trece decisiones de
   producto fijadas, el criterio de doce puntos y los contratos que los Hitos 0–4
   van a tener que revalidar. Se lee una vez, como `como-se-trabaja.md`.
6. [`ii/docs/decisions/`](decisions/) — **22 ADRs propios**. Los que más pesan hoy:
   II-0001 (encender no es una acción), II-0007 (el tick es un parámetro),
   II-0008 (el tiempo va en segundos), II-0009 (el hambre mata), II-0010 (frotar
   no relaja), II-0011 (arder libera calor), II-0012 (el presupuesto del plan va
   en expansiones), II-0013 (el veneno se cobra al tragar), **II-0014 (el decreto
   manda sobre la celda, y el mundo narra lo que el dios pone)**, y los cinco del
   gate: **II-0015 a II-0022** (ver la sección 0·bis), con II-0020 (la captura vive
   en una tabla del mundo) y II-0021 (el overlay de una partida sólo crece) ya
   decididos por el usuario.

---

## 1 · Dónde está el proyecto

**Nueve paquetes, 2597 tests verdes (+1 `skipped` en `world`, +1 `todo` en `plan`),
nueve typechecks limpios.** Corridos enteros al cerrar el tramo D del gate, mirando
el exit code: `pnpm ii:test` **0** y `pnpm ii:typecheck` **0**, y además
`ANIMA_BANCO=1 pnpm --filter @anima/juez test` **0** (126 de 126, en **311 s**: las
dos cohortes del banco de la mente se reparten en cinco tandas desde el tramo Ñ,
ver la sección 2 de `como-se-trabaja.md`). En la rama
`anima-2`, **ninguno pusheado** — el usuario pushea solo. Si la sesión nueva es en
otra máquina, hay que pushear antes.

> **Y el tramo M bajó una constante del mundo: `COSTO_VIVIR_POR_SEGUNDO` de 1,0 a
> 0,34.** Lo decidió el usuario con la ventana medida delante (sección 5·bis). Eso
> movió ~30 números clavados en cinco paquetes —ticks de muerte, el hash de la
> partida de 2000, el precio del fuego, la ventana del presupuesto— y todos están
> actualizados con el viejo anotado al lado. **Dos `it.fails` se dieron vuelta y hoy
> son `it`**: la contraprueba de la despensa y el diagnóstico 10.

> **Y HAY UN VERDE QUE NO ES EL DE `pnpm ii:test`.** `@anima/juez` tiene una
> aserción que sólo se evalúa con `ANIMA_BANCO=1`, y **estaba roja desde antes del
> tramo L** mientras el traspaso publicaba el veredicto de la emergencia como si
> nada (número 22 de la sección 5 de `como-se-trabaja.md`). Está reparada. La regla
> que dejó: **el veredicto de la emergencia se publica MIRANDO el exit code de
> `ANIMA_BANCO=1 pnpm --filter @anima/juez test`**, no el de la suite normal.

| paquete | qué es | tests |
|---|---|---:|
| `@anima/physics` | materia, 12 leyes, `admit()`, 4 procesos aplicables, **`BlueprintDefinition`** | 646 |
| `@anima/world` | el árbitro determinista, `stepWorld`, metabolismo, reloj, **las obras desplegadas que trabajan solas** | 604 (+1 skipped) |
| `@anima/oracle` | el dios perezoso, biomas, pozos, libro calórico | 270 |
| `@anima/skills` | el sandbox y las 15 innatas | 193 |
| `@anima/perceive` | LA COSTURA mundo↔habilidades, `Partida`, `ticksPerdidos` | 121 |
| `@anima/plan` | **el catálogo como vista**, `goalGraph()`, `plan()` anytime, la poda de lo ya hecho | 319 (+1 todo) |
| `@anima/mind` | necesidades, creencias β, `opportunities()`, escalera D0–D5, el portón de despegue | 318 |
| `@anima/juez` | el detector de secuencias de emergencia, **externo a propósito** | 126 |

Comandos: `pnpm ii:test` · `pnpm ii:typecheck` · bancos con `ANIMA_BANCO=1`.

> **OJO CON ESTA TABLA: llegó al tramo A con cinco números viejos y nadie lo
> notó.** Decía 2456 y el árbol daba 2479 ANTES de tocar nada — `physics` 605→607,
> `world` 550→561, `plan` 295→295, `mind` 302→307, `juez` 121→126—, o sea que
> venía arrastrando el conteo de dos tramos atrás. Los 27 que agregó este tramo
> (17 en `plan`, 10 en `mind`) son la única diferencia que este tramo explica.
> **Un conteo de tests es una medición y se re-mide, no se hereda.**

> **La suite tarda 287 s y no 790, y ni una corrida se acortó.** Se repartió el
> mismo trabajo en más ARCHIVOS, que es la única unidad que vitest paraleliza:
> `hito-5-el-criterio.test.ts` (146 s de los 148 de `@anima/mind`) quedó en siete
> pedazos con el cuadro «EL HITO 5, MEDIDO» saliendo entero igual, y los dos
> controles del azar de `@anima/juez` (510 s de 536, corridos DOS veces por dos
> archivos distintos) los corren cinco «tandas» en paralelo. Los cinco tests de
> las tandas son los +5 de la cuenta de arriba. Las tablas se compararon renglón
> por renglón antes y después. Ver la sección 2·bis de
> [`como-se-trabaja.md`](como-se-trabaja.md), que tiene además **lo que quedó
> abierto**: el control del azar sigue sin `ANIMA_BANCO=1`.

> **El tramo L, en un renglón.** Se cerró **el no-op con cara de progreso**: un
> paso que ya está cumplido contra la vista de hoy no se emite (`sinLoQueYaEstaHecho`
> en `plan/src/regresion.ts`, poda del PREFIJO de `plan.steps` y de `gap.nearest`) ni
> se despega (`salteaLoQueYaEstaHecho` en `mind/src/escalera.ts`). La definición que
> se eligió, y que es el aporte del tramo:
>
> > **un despegue AVANZA si el paso que despega todavía NO está cumplido contra la
> > vista de hoy.**
>
> Separa sin ningún umbral las dos series que desde afuera son idénticas: el
> `frotar` sobre una vara fría despega las cien veces que haga falta, y el `ir` a una
> celda no despega nunca. Las dos candidatas obvias —«cambió el estado relevante» y
> «la misma decisión no se repite N veces»— están descartadas por escrito en el
> encabezado de `regresion.ts`; la segunda apagaría el fuego.
>
> **Y NO MOVIÓ EL CRITERIO.** Es lo primero que hay que saber: el bucle ya estaba
> tapado por el cerrojo `mientrasTantoYaHecho` del tramo K bis, así que lo que la
> poda compró son **59 ticks** con tanque 310 (3743 → **3802**) y **273** con tanque
> 1000 (11.851 → **12.124**). Lo que sí arregla es la ATRIBUCIÓN y el resto del
> mundo: `ataque-al-reves` pasó de 297 `ir` + 297 `sostener` («la mitad exacta
> termina mal») a **1 `ir` + 297 `sostener`**, con la tasa de fracaso honesta de
> 99,66%; la cadena del documento pasó de 7 vuelos a 6; y los estados ilegales del
> banco del juez bajaron de 47.091 en 10 partidas a **31.833 en 7**.
>
> **El tramo K bis, en un renglón.** El tramo K logró que el mundo materialice lo
> que el dios decreta; el K bis logró que **lo materialice donde el dios dijo**. La
> celda de cada suelta es función pura de `(semilla, chunk, índice)` y al que
> estaba parado ahí se lo corre. Con eso se cerraron, juntos: el criterio del Hito
> 3 (los mismos dos puntos en dos órdenes daban dos hashes), el solapamiento del
> banco de peces (2 de 20 semillas → **0 de 20**) y la conservación, que estaba
> apagada de hecho en toda partida con dios (96 y 21 violaciones → **0 y 0**). Es
> el [ADR II-0014](decisions/II-0014-el-decreto-manda-sobre-la-celda.md).
>
> Y **el árbol que recibió el tramo K bis estaba rojo**, no verde como decía el
> traspaso: `mind/tests/banco-la-escalera.test.ts` tenía un `it.fails` cuyas tres
> aserciones pasaban. Ver el número 17 de la sección 5.

---

## 2 · El Hito 5, criterio por criterio

Es el **criterio de corte**: si pasa, hay producto aunque el modelo nunca se
conecte; si no pasa, el plan se para acá y se revisa antes de gastar en la fragua.

> **VEREDICTO, decidido por el usuario: CUMPLEN 3 DE 6, y el hito CIERRA con los
> otros tres en ROJO ACEPTADO**, cada uno con su `it.fails` y su causa medida.
> Cumplen el proveedor apagado, la cadena de la caña y `ticksPerdidos`. No cumplen
> el p99 (7,2×, aceptado en el tramo M), sobrevivir 20.000 ticks y la emergencia, y
> los dos últimos son **el mismo problema y no dos**: el fuego más barato del mundo
> sale 645,5 de aliento y la criatura arranca con 310. Ver el punto 0 de la sección 6.
>
> **Y ESO ÚLTIMO YA NO ES CIERTO (tramo N).** El fósforo más barato del mundo sale
> **244,65** y la criatura sigue arrancando con 310: **lo paga**. La pared
> aritmética se cayó al subir la eficiencia de `friccion` de 0,35 a 0,85, que fue
> la salida (c) y la eligió el usuario. Los dos criterios siguen en rojo y por otro
> motivo, que hay que leer aparte: **la corrida canónica sigue muriendo en el
> 18.150 con CERO bocados**, exactamente igual que antes. La aritmética dejó de
> estar en contra y la mente no cruza la puerta — el `plan()` contesta `gap` con
> `emitsPower<410&emitsPower>=253`, o sea que **falta MATERIA**: una vara del
> tamaño justo en una celda seca. Eso es del dios y del punto 1, no de una
> constante. Ver el punto 0 de la sección 6, reescrito.
>
> **OJO CON LA CUENTA, que ya viajó mal.** El traspaso anterior decía «van 4 de 6»
> sumando los tres que cumplen MÁS el p99 aceptado. Mezclar «cumple» con «no cumple
> pero está aceptado» en un solo número deja de distinguir justo lo que hay que
> distinguir el día que alguien retome esto. Son **3 que cumplen y 3 aceptados en
> rojo**, y se cuentan por separado.

Todos los números de esta tabla se corrieron el 2026-07-30 sobre el árbol del
tramo L, o sea **sobre el mundo que el dios decreta y ningún arnés planta**.

| criterio | veredicto | número medido |
|---|---|---|
| proveedor apagado | **CUMPLE** | 0 llamadas a la red, 0 dependencias de runtime fuera de `ii/` |
| la cadena de la caña | **CUMPLE** | 7 eslabones en el plan, **6 vuelos** contra el mundo (el `ir` al pozo lo poda el tramo L: ya estaba al lado): tira la caña en el tick **48**, el pescado entra a la mano en el **108** |
| `ticksPerdidos === 0` | **CUMPLE, con una condición escrita** | **0** en 20.000 ticks con reloj de pared (0,947 ms/tick contra una ventana de 50) — y la partida termina con **120 cuerpos**, o sea que no recorre mundo. Una que camina derecho llega a 23.353 cuerpos y a 74 ms/tick a los 10.000, o sea que cruza la ventana ADENTRO de los 20.000 |
| p99 < 5 ms con 5000 cuerpos | **NO cumple — ACEPTADO por el usuario** | **30,94 ms** (6,2×) corriendo `@anima/world` solo · **36,13 ms** (7,2×) en la corrida de los nueve paquetes, que es CONTENCIÓN y no regresión · guarda verde en 45 ms |
| **sobrevive 20.000 ticks sola** | **NO CUMPLE — ACEPTADO por el usuario. YA NO ES IMPOSIBLE (tramo N): el fósforo sale 244,65 contra un tanque de 310 y la criatura LO PAGA. Lo que la frena hoy es MATERIA, no aritmética — sigue muriendo en el 18.150 con 0 bocados y el `plan()` contesta `gap` de `emitsPower`. Ver el punto 0 de la sección 6** | lo de abajo es la medición con la eficiencia en 0,35: el fuego más barato del mundo sale **645,5** y la criatura arranca con **310**, y sin fuego no hay comida que pague: crudo no conviene NINGUNA de las seis sustancias con calorías que el dios decreta. Canónica (tanque 310): muere en el **18.150** de 20.000 con **0 bocados**, pegada al techo aritmético de quieta (18.235) — el ancla del fondo (punto 9) le sacó el paseo, así que ya no se muere de caminar: se muere del fósforo, puro (era el 6244, y antes el 3802). Con el tanque lleno: **LLEGA VIVA — y con 0 bocados**, o sea que aguanta sin comer y el criterio pide comer. Con el eslabón REGALADO: **LLEGA VIVA con 64 bocados** (era: come 68 y muere en el 12.847). Con tanque lleno + leña seca: **LLEGA VIVA habiendo cocinado y comido**, la primera vez en el proyecto |
| emergencia: ≥4 de 10 en 20 partidas | **NO CUMPLE — ACEPTADO por el usuario · 2 de 9 con el tanque lleno** | **0 de 9** contra **0 de 9** del azar, sin umbrales tocados, con el tanque de 310. **Con el tanque de 1000 son 2 de 9** y la corrida pasa a ser interpretable — ver el punto 2 de la sección 6, que se dio vuelta. Situación en la canónica: **8/20, 8/20 y 7/20** (con el ancla del punto 9; era 10/20, 10/20 y 8/20: la que espera al lado del pozo pisa menos situaciones de fuego) |

### Lo que falta para el criterio de sobrevivir YA NO ES EL `gap`: ES LA ARITMÉTICA

El `gap` de `emitsPower` está cerrado. La tabla barre los tres montajes × tres
distancias y saca dos filas de cocción (parrilla y contacto), y de las dos sólo la
del contacto se puede encender. Con eso **la criatura come por primera vez algo que
ella cocinó**, y la cadena entera sale de un solo `plan()`, 15 pasos:

```
ir → sostener → ir → sostener → unir     la caña
ir → aplicar                             el pescado
ir → sostener → ir → sostener → frotar   el fuego
poner → esperar → sostener               la cocción
```

Contra `stepWorld`, con la escena buena (tanque lleno + leña seca): prendió en el
tick **162**, cocinó en el **262**, comió en el **270**, y aun así muere en el
**5669**. Y **no alcanza**, por una cuenta que hay que decidir arriba:

```
lo que CUESTA un fuego   heatCapacity × ΔT / eficiencia = 0,68 × 285 / 0,35 = 553,71
                         (la yesca más chica que la fila admite, 0,3507 kg → 485,45)
lo que RINDE un bocado   pescado cocido de 2,887 kg → calories 20,38 → +19,84 de aliento
la razón                 ~25 a 1 EN CONTRA · el fuego devuelve el 3,7% de lo que cuesta
```

Y no hay salida por comerlo crudo: el pescado crudo trae `toxicity` 0,25 y la innata
`comer` tolera 0,2. **Cocinar es la única puerta a la comida que la escena ofrece.**

`STAMINA_POR_CALORIA = 1` y `COSTO_VIVIR_POR_SEGUNDO / hz = 0,05/tick`, o sea que el
tanque de 1000 SON exactamente los 20.000 ticks del criterio: **un fuego se come la
mitad del presupuesto de vida entero**, y para sobrevivir sin comer alcanza con estar
quieta. Lo que delata el signo es la no-monotonía, y está medida: **con seis manos en
vez de tres, la criatura enciende dos fuegos y se muere en el tick 365 en vez del
5627** — quince veces antes. Cuando un recurso EXTRA empeora el resultado, lo que
está mal es el signo de lo que ese recurso habilita.

**Las tres palancas, y las dos primeras son decisión del usuario porque son
calibración:**

- (a) `eficiencia` de la fricción, hoy **0,35** en `world/src/step.ts`. Para que un
  fuego se pague con un bocado haría falta ~0,0075: **47×**.
- (b) `STAMINA_POR_CALORIA`, hoy **1** en `world/src/step.ts:715`.
- (c) que un fuego sirva para MUCHOS bocados. **Se hizo la mitad y no alcanzó**: la
  espera dejó de ser ciega y pasó de 300 ticks a 100, o sea que le devuelve diez de
  los veinte segundos que el fuego dura. El bocado se adelantó del tick 457 al 257 y
  **el conteo de bocados no se movió: sigue siendo UNO en veinte mil**. El techo
  teórico de (c) es 20 s / 5 s = 4 piezas ≈ 81,5 de aliento contra 485: **6× negativo
  todavía**. O sea que (c) sola no da vuelta el signo y hay que decidir (a) o (b).
- Y lo que **NO** hay que hacer: mover `SEGUNDOS_DE_COCCION` (es RITMO del mundo, ADR
  II-0008) ni el piso de masa de la yesca (es el borde de abajo de la ventana de la
  ley 1).

La cuarta salida, que no es calibración: **no volver a pagar el `frotar`.** La ley 3
ya sabe propagar el fuego —dos cortezas atadas prenden un leño, medido en
`world/tests/el-fuego-no-se-propaga.test.ts`— y el planificador no lo sabe: para él
cada fuego nace de frotar dos palos.

### Las contrapruebas que aíslan el criterio

- **LA CONTRAPRUEBA DE LA DESPENSA SE DIO VUELTA, y hay que leerla al revés de
  como está publicada.** Decía: «con una despensa de cocidos regalada la misma mente
  sobrevive los 20.000 con 65 bocados y aliento final 1,4593; o sea que la conducta
  está y falta la aritmética». Sobre el mundo DECRETADO ya no: **come 68 y muere en
  el 12.847**, con 32 cocidos sin tocar que la ley 6 le pudrió hasta `toxicity`
  0,9921 (antes de la poda del tramo L: 66 y el 12.031 — la poda le compró 816
  ticks, un 6,8%, y no le alcanzó). La cuenta, y son dos renglones que se leen
  juntos:

  ```
  plantada   310 + 691,46 comidos − 1000 de vivir = +1,46  → llegaba
  decretada  310 + 690,08 comidos − 1000 de vivir = +0,08  → no llega
  ```

  Comió MÁS y llegó menos lejos, porque **en un mundo con cosas alrededor la mente
  CAMINA**: gasta 0,08242/tick contra 0,05 de sólo vivir, o sea 1,65×. Así que la
  frase «la conducta está, falta la aritmética» **ya no la sostiene ninguna corrida**,
  y eso cambia qué se decide arriba sobre las palancas (a) y (b): el criterio (2)
  falla incluso con el eslabón regalado.
- Con la escena del documento tal cual, el `plan()` sigue saliendo `gap`, y el motivo
  cambió de piso: **no hay una sola vara de madera de ese tamaño en el mundo**. Ya no
  es que el mundo no materialice —eso se cerró—: el dios decreta 62 cuerpos sueltos
  en los 9 chunks de la parada y a los 400 ticks hay 95 sueltas en el piso; lo que no
  hay es madera del tamaño que el plan pide (la única que el dios decreta pesa
  2,3280 kg contra las 0,40–0,48 que cierran la cadena).
- Y si se le pone, **se ahoga**: la celda que `laOrilla()` llama seca mide `wet`
  0,6000 y la `moisture` de la yesca cruza el 0,45 de `HUMEDAD_QUE_APAGA` en el tick
  85, once antes de que el pescado llegue a la mano (diagnóstico 8).

---

## 2·bis · El método, las decisiones y los números corregidos

Se mudaron a **[`como-se-trabaja.md`](como-se-trabaja.md)**, que es la parte que
no cambia de un tramo al otro: cómo se trabaja acá, las decisiones tomadas que no
hay que volver a preguntar, cómo no gastar horas de más, y los números corregidos
con su regla.

**Leelo una vez al empezar.** Y si en tu tramo aparece un número corregido,
agregalo AL FINAL de su sección allá — no hace falta releer nada para eso.

---

## 5·bis · LAS TRES DECISIONES DEL TRAMO M, tomadas por el usuario

Las tres cosas que el traspaso anterior dejó abiertas «porque son del usuario» se
decidieron. Van acá arriba porque cambian cómo se lee todo lo de abajo.

1. **LA ARITMÉTICA: las dos cosas a la vez.** Enseñarle al planificador **la
   escalera de la yesca** —que cierra la cuenta sin tocar ninguna constante— y
   además mover la calibración. De las dos palancas que se le presentaron, las dos
   estaban cerradas por un guardián (números 27 y 28 de la sección 5 de
   `como-se-trabaja.md`), así que la que se movió fue una tercera:
   **`COSTO_VIVIR_POR_SEGUNDO` bajó de 1,0 a 0,34**, el centro de la ventana medida
   `(0,3100 ; 0,3637)`.
2. **EL CONTROL DEL AZAR quedó gateado** detrás de `ANIMA_BANCO=1`. Medido antes y
   después: `@anima/juez` pasó de **167,6 s a 34,6 s** y sigue verde con la variable
   (**685 s, 121 de 121**).
3. **EL UMBRAL DE LA EMERGENCIA es 4 DE 9**, el absoluto y no la proporción. Está
   escrito en el encabezado de `juez/tests/hito-5-la-emergencia.test.ts` y en el
   cuadro que ese archivo publica.

### Lo que la escalera de la yesca permite y lo que todavía no construye

Medido en `world/tests/la-escalera-de-la-yesca.test.ts` (7 bloques):

- `friccion` pide `rigidity >= 0.5` en los dos palos, así que **la yesca no se
  frota**: se PRENDE. En la corrida actual cuesta 707/kg contra 1384/kg de la
  madera.
- una vara de 0,5 kg frotada (**692,1** de aliento, el único gasto) prende 1 kg de
  yesca en el tick 3; esa yesca entrega 356 °C y prende un **leño de 8 kg** en el
  tick 61, que frotado habría costado 11.074;
- ese leño arde 402 s y cocina **42 piezas** con la comida en el piso a UNA celda
  —sobre la parrilla la quema, porque entrega 1217 °C—: **+160,9 de neto**, y es un
  piso porque se cocinó de a una pieza;
- la SUMA BRUTA de esa materia aparece en **6 de 20 semillas** en los 9 chunks del
  arranque, con la yesca en piezas de unos 77 g y la madera más grande en 2,9 kg;
- pero `union` aplana las partes y `MAX_PARTS = 6`: las seis yesquitas más grandes
  suman sólo **0,416–0,450 kg**, así que **el kilo de yesca no se puede construir**.
- **Y de ahí NO se sigue que no haya escalera: el fardo tenía que ser MIXTO**, y lo
  hay en **8 de 20 semillas** (número 33 de la sección 5 de `como-se-trabaja.md`).
  Las dos mitades de la cuenta se compran por separado —la potencia se SUMA sobre
  las partes y el punto de ignición se PROMEDIA por masa—, así que la yesca baja el
  punto de ignición y la corteza trae la masa. Corrido en el mundo:
  **4×hoja-seca + 2×corteza = 6 partes, 1,214 kg**, armado con `unir`; una vara de
  0,6213 kg lo prende en el tick 22 y el fardo prende el leño de 2,904 kg decretado
  en el tick 13. Frotar ese leño habría salido **4020,0** contra **860,1**.
- lo que frena la escalera es **el atador**: aparece en 7 de 20 semillas (junco×15,
  liana×117) y alcanza para armar el fardo en **2 de 20**.

### Y lo que la calibración compró, que es menos de lo que parece

Bajar el costo de vivir 2,94× estiró la vida **1,64×**: la criatura pasa de morir en
el 3802 a morir en el **6244** de 20.000, **con 0 bocados**. El diagnóstico del
propio arnés dice por qué: gasta **0,04918/tick contra 0,017 de sólo estar viva**, o
sea 2,89×, **y la diferencia son las patas**. `COSTO_POR_CELDA` no se tocó, así que
al abaratar vivir, caminar pasó a ser el 65% del gasto (número 30 de la sección 5).

**Las dos mitades se necesitan y ninguna alcanza sola.** Con vivir a 0,34, para
llegar a los 20.000 gastando 0,04918/tick hacen falta ~983 de aliento y arranca con
310: le faltan ~673, que son 34 bocados cocidos. Un fuego de la escalera da 42. La
cuenta energética cerraría con ese fuego; antes de enseñárselo a la mente hay que
hallar una cadena de cuerpos que respete `MAX_PARTS`, o llevar al usuario la
decisión sobre la cota del mundo.

---

## 6 · Qué está abierto, en orden de importancia

0. **REABIERTO Y MOVIDO (tramo N): LA PARED ARITMÉTICA SE CAYÓ, Y LO QUE QUEDA ES
   MATERIA.** Todo lo que sigue en este punto describe el mundo con la eficiencia
   de `friccion` en **0,35**, y hoy está en **0,85**. Se deja entero porque el
   razonamiento sigue valiendo y porque las tres salidas descartadas lo siguen
   estando por los mismos motivos; lo que cambió son los números y cuál se eligió.

   **LO QUE PASÓ, en cuatro renglones:**

   | lo medido | con 0,35 | con 0,85 |
   |---|---|---|
   | el fósforo más barato del mundo | 645,50 | **244,65** (de `madera-dura`) |
   | con qué arranca la criatura | 310 | 310 |
   | ¿lo puede pagar? (SOLVENCIA, `C < T`) | **NO**, por 2,08× | **SÍ**, con 44,20 de margen |
   | ¿un fuego se paga con lo que cocina? (`G > C`) | NO, por 1,24× | **SÍ**, 1,96× |

   **Y LA CORRIDA CANÓNICA NO SE MOVIÓ UN TICK: sigue muriendo en el 18.150 con
   CERO bocados.** Ésa es la noticia importante del tramo y hay que leerla junta
   con la de arriba: la aritmética dejó de estar en contra y la mente **no cruza
   la puerta**. El `plan()` sigue contestando `gap` con
   `emitsPower<410&emitsPower>=253` — le falta un cuerpo del tamaño justo en una
   celda seca. **Lo que bloquea el criterio (5) hoy es MATERIA, y es el punto 1
   de esta misma lista** (la escalera, el atador y de dónde siembra el dios).

   La cuenta entera, con su método y sus seis bloques, está en
   `world/tests/la-cuenta-de-los-veinte-mil.test.ts`, y el porqué del 0,85 —con la
   ventana entera y el techo que le pone el guardián de la conservación— en el
   encabezado de `FRICCION` (`physics/src/process.ts`).

   **LO QUE ESA CALIBRACIÓN SE LLEVÓ PUESTO, dicho porque son deudas y no
   detalles:**
   - el **control negativo del leño** de `plan/tests/los-esquemas-contra-el-mundo`
     dejó de controlar y quedó en `it.fails`: con el tanque lleno que el arnés
     regala, el leño de 1 kg llega a 455,89 °C. Lo arregla una vara más pesada en
     el arnés (el borde está en 1,30 kg);
   - la **meseta de la vara** de `world/tests/el-tiempo-no-depende-del-tick` dejó
     de coincidir a nueve decimales entre las cuatro frecuencias: se corren 2,33 °C
     (0,38%), porque la criatura ahora sigue frotando en el segundo 12 y el `drive`
     le tira la vara encendida hacia abajo. Lo arreglaría una escena donde la mano
     SUELTE la vara después de encenderla;
   - la **estrategia de leña** volvió a ser decorativa en `oracle/presupuesto`: el
     fuego sostenido pasó de deber en 19 de 100 a dar positivo en las cien. Era el
     aporte del tramo M.

   Y UNA COPIA VIVA: `EFICIENCIA_DE_FROTAR = 0.35` en `mind/tests/el-criterio.ts`
   no se enteró del cambio. Nadie la usa hoy —`2b-las-paredes` dejó de importarla y
   lee el proceso— pero el que la importe se va a comer un mundo que no existe.

   ---

   **LO QUE SIGUE ES EL PUNTO 0 ANTERIOR, con la eficiencia en 0,35.**

   **DECIDIDO POR EL USUARIO: EL HITO 5 CIERRA CON EL CRITERIO (5) Y EL (6) EN
   ROJO ACEPTADO.** De las cuatro salidas que se le presentaron eligió la cuarta —
   aceptarlo y marcarlo—, después de que la primera se implementara, se midiera y no
   cerrara. **Ningún umbral se movió.** Los dos criterios quedan con `it.fails` y la
   causa medida al lado:
   `mind/tests/hito-5-el-criterio-2a-la-cadena.test.ts` y
   `juez/tests/hito-5-la-emergencia.test.ts`. Lo que sigue es el porqué, que es lo
   que hay que leer antes de volver a tocar esto.

   **LA CORRIDA CANÓNICA NO PUEDE ENCENDER NADA.** Es una imposibilidad aritmética
   y está medida entera, en tres renglones que se leen juntos
   (`world/tests/hay-comida-sin-fuego.test.ts` y `world/tests/la-escalera-construible.test.ts`):

   | lo medido | número |
   |---|---|
   | comida cruda que paga, en lo que el dios decreta | **ninguna**, en las 20 semillas |
   | lo más barato que se puede encender en el mundo | **645,5** de aliento (vara de 0,4663 kg, para prender una hoja a 180 °C) |
   | con qué arranca la criatura del criterio | **310** |

   O sea: comer pide cocinar, cocinar pide fuego, y el fuego más barato del mundo
   sale **2,08× el tanque entero** de la corrida canónica. **Ningún trabajo sobre el
   planificador ni sobre la mente puede dar vuelta el criterio (5) con el tanque de
   310**, y la escalera del punto 1 tampoco: la escalera abarata el fuego GRANDE
   (4020 → 860), no el primer fósforo, que es el que no se paga. El piso es
   irreducible porque sale de lo más fácil de prender que hay en el catálogo
   (`hoja`, 180 °C) y de que frotar cuesta proporcional a la masa.

   **Las salidas, y ninguna es «aflojar el criterio»:**
   - **(a) que el dios siembre comida que pague cruda — ELEGIDA POR EL USUARIO,
     IMPLEMENTADA, MEDIDA Y REVERTIDA: NO CIERRA.** El catálogo tiene tres
     sustancias que pagan crudas —huevo, médula y grasa— y el dios no siembra
     ninguna (número 34 de la sección 5). Se probó la regla «todo bioma que nombra
     `carne` suelta `grasa`», y choca de frente con un invariante que el proyecto ya
     tenía afirmado en `oracle/tests/presupuesto.test.ts`: **«SIN TRABAJO la energía
     neta acumulada es NEGATIVA, en las cien»** (el criterio del riesgo 4, reforzado
     por el ADR II-0013). Los dos extremos, medidos:

     | grasa sembrada | neto del carroñero (tiene que ser < 0) | aliento crudo por celda (tiene que ser > 0,05) |
     |---|---|---|
     | peso 2–3, 0,4–2,0 kg | **+5746** ✗ | 0,161 ✓ (11 de 20 semillas) |
     | peso 1, 0,07–0,26 kg | **+12,9** (el borde) | **0,00827** ✗ (0 de 20) |

     O sea que en el borde donde no trabajar deja de pagar, lo crudo rinde **6×
     menos** de lo que cuesta caminar hasta él. **La ventana está vacía**, y el
     motivo es estructural y no de calibración: **la mente y el carroñero ingenuo
     levantan LA MISMA grasa.** Ser selectivo ahorra el veneno, no agrega comida, así
     que el guardián acota exactamente la cantidad de la que la mente depende.

     Y dos efectos de borde que aparecieron y hay que tener en cuenta si alguien
     vuelve por acá:
     - **`grasa` es también combustible de primera** («lo único que es comida Y
       combustible», dice su ficha), así que sembrarla mueve además la economía de
       la leña: el fuego «sostenido» pasó de 19 partidas de 100 en rojo a 8/13/16
       según la calibración;
     - **las tres sustancias que pagan crudas tienen el tag `carnoso`**, y
       `especiesDe` (`oracle/src/pesca.ts`) decide con ese tag qué vive en un cuerpo
       de agua. Sembrar cualquiera de las tres en un bioma con una gota hace que un
       charco entregue trozos de grasa. No se esquiva eligiendo otra: pediría que
       `especiesDe` distinga un animal de una PARTE de un animal.
   - **(a·bis) LA QUE LA MEDICIÓN SUGIERE, y no estaba en la lista.** Que la comida
     cruda exista pero **no esté tirada**: que haya que trabajarla. Es lo que los
     nombres del catálogo ya insinúan —`huevo` pide un nido y `medula` pide partir
     el hueso—. Con eso el invariante del riesgo 4 se sostiene POR CONSTRUCCIÓN
     (el carroñero come lo que está tirado, y esto no lo está) y la criatura tiene
     una puerta a la comida que no es el fuego. Cuesta más: es una técnica, no una
     fila en la tabla de biomas.
   - **(b) subir el tanque de arranque.** Con 1000 el piso se paga (quedan 354,5) y
     la escalera del punto 1 pasa a valer mucho: un fuego de 2,9 kg sale 860 en vez
     de 4020. Es exactamente la corrida «control» que ya mide 2 de 9 en el juez.
   - **(c) bajar el precio de frotar** (`eficiencia`, hoy 0,35). Es calibración pura
     y estaba descartada por el guardián de la conservación; hay que re-medir la
     ventana antes de proponer un número. **← ÉSTA SE ELIGIÓ Y SE HIZO en el tramo
     N: 0,35 → 0,85. La ventana se re-midió y el guardián no la descartaba, la
     acotaba en 1,00. Ver arriba.**
   - **(d) aceptarlo y marcarlo.** El criterio (5) queda con `it.fails` y el porqué
     medido al lado, igual que el p99.

   **ELEGIDA: la (d).** El Hito 5 cierra con **3 de 6 cumpliendo y 3 en rojo
   aceptado**, cada uno con su causa medida. Las salidas (a·bis), (b) y (c) quedan disponibles el día que
   alguien quiera dar vuelta el criterio; ninguna se descartó por mala, se
   pospusieron. Y aceptar un número no es dejar de vigilarlo: las guardas verdes de
   los dos `it.fails` siguen corriendo, igual que con el p99.

1. **RE-MEDIDO (tramo N·bis): EL ATADOR NO ES LA COTA. EL HUECO SON 23,02 DE
   POTENCIA.** Todo lo que sigue en este punto es anterior y hay que leerlo con
   esto adelante. La medición entera está en
   `world/tests/del-fosforo-al-fuego-que-cocina.test.ts`, cinco bloques.

   **QUÉ HACE FALTA, exacto.** El mejor fósforo que un tanque de 310 paga es
   **0,5067 kg de `madera-dura`**, entrega 177,71 contra los 253 de la ventana de
   cocción y calienta a lo que tenga encima hasta **228,25 °C**. De todo el
   catálogo, la sustancia que entra abajo de ese techo y más rinde es `hoja-seca`
   (283,90 por kilo): **0,8912 kg de hoja-seca en UN cuerpo cocinan**. No hace
   falta una escalera de tres escalones ni nada exótico — hace falta ese cuerpo.

   **POR QUÉ `unir` ES OBLIGATORIO, y es el mecanismo que faltaba escrito.** La
   potencia **no se suma entre cuerpos**: una fuente, dos y cuatro debajo del mismo
   objetivo le entregan el MISMO pico (197,79 °C), y la misma masa en UN cuerpo da
   746,15. `montajeDe` calcula la exposición por cuerpo contra la fuente que más lo
   calienta y nada acumula entre fuentes. Así que apilar no sirve y `unir` no es
   una comodidad: es lo único que hace que la potencia sume.

   **Y AUN ASÍ EL ATADOR NO ES LA COTA.** Con la búsqueda mixta completa sobre las
   veinte semillas son **0/20**, y las dos escaseces caen en semillas distintas:

   | | potencia | atadores |
   |---|---|---|
   | las tres mejores (16, 17, 19) | 222–239 | **0** |
   | las tres con más atadores (3, 8, 18) | 115–123 | 36, 31, 33 |
   | la única con las dos cosas (semilla 2) | **229,98** | de sobra |

   O sea que el hueco real son **23,02 de potencia (un 9%)** y no «2 de 20 semillas
   tienen atadores». Darle juncos a todo el mundo no cerraría nada.

   Y la mezcla importa: las mejores son `5×hoja-seca + 1×corteza`. La corteza sola
   no se prende —ignición 250 contra 228,25— y adentro de la mezcla sí, porque
   `unir` promedia la ignición por masa y suma la potencia.

   **LAS TRES PALANCAS, y las tres son del mundo:**
   - **(a) `MAX_PARTS` de 6 a 16** — cierra en 8/20 con las piezas que ya hay. Es
     una constante de `@anima/physics` y toca `unir` en todo el mundo;
   - **(b) un fósforo más caliente** — le faltan **2,61 de aliento** para prender
     `medula`, que es el número más chico de los tres. **Y NO CIERRA**, medido: con
     ese fósforo el mejor cuerpo armable no se mueve ni un decimal (239,36 antes y
     después). Está afirmado en el test para que nadie pague por nada;
   - **(c) piezas más gordas** — cada `hoja-seca` tendría que pesar 0,1485 kg y hoy
     vienen de ~0,077. Es del oráculo, no de la ley, y no toca `unir`.

   Quedan la (a) y la (c), y son decisión del usuario.

   ---

   **LO QUE SIGUE ES EL PUNTO 1 ANTERIOR.**

   **LA ESCALERA CONSTRUIBLE EXISTE; LO QUE FALTA ES EL ATADOR Y ENSEÑARLA.** El
   fardo mixto entra en `MAX_PARTS` y está corrido en el mundo (número 33): 8 de 20
   semillas tienen un fardo legal que prende el leño más grande decretado, pero sólo
   **2 de 20** tienen atadores suficientes para armarlo —`unir` gasta uno por unión y
   un fardo de seis partes gasta cinco—. Eso también es del dios, no de la ley.
   Cuando el punto 0 se decida, el plan necesita tres capacidades generales:
   - **juntar masa** con `union` repetida, respetando partes, manos y un atador por
     unión, **y mezclando sustancias**: la yesca sola nunca alcanza;
   - **que un fuego prenda otro** mediante las leyes térmica y de combustión, sin
     inventar una segunda fricción;
   - **elegir dónde va la comida**: sobre la parrilla un leño de 8 kg entrega
     1217 °C y quema el pescado; a una celda en el piso, 159 °C y lo cocina. Hoy el
     plan pone la comida pegada al fuego siempre.
2. **LA EMERGENCIA SE DIO VUELTA, Y ES LO MÁS IMPORTANTE QUE SALIÓ DEL TRAMO L.**
   La corrida canónica (tanque 310) sigue midiendo **0 de 9** contra **0 de 9** del
   azar, con `situación` **10/20, 10/20 y 8/20** en tres filas y 0/20 en las otras
   seis; el juez la declara **NO INTERPRETABLE** (6 sin medir sobre 9). Pero el
   CONTROL con el tanque lleno, que hasta hoy se citaba como «0 de 9, o sea que no es
   la muerte», mide **2 DE 9**:

   | secuencia | apareció | situación | 1ª vez |
   |---|---|---|---|
   | `no-frotar-lo-que-no-alcanza-a-encender` | **4/20** | 10/20 | t=45 |
   | `comerla-en-el-pico-de-calorias` | **4/20** | 4/20 | t=181 |

   Con el tanque lleno la criatura **prende fuego y come**, y con eso aparecen dos de
   las nueve secuencias que nadie implementó; la corrida además pasa de **6 sin
   medir a 3**, o sea de NO INTERPRETABLE a interpretable. El «0 de 9 con el tanque
   lleno» que estaba publicado era de las **TRES** partidas de la muestra corta, no
   de las veinte (número 25 de la sección 5 de `como-se-trabaja.md`). **Verificado en
   dos corridas —árbol de HEAD y árbol del tramo L— renglón por renglón idénticas:
   no lo trajo la poda, es lo que este banco siempre midió y nadie había leído.**

   Lo que eso quiere decir para el proyecto: **lo que separa a la mente de la
   emergencia es el punto 1 de esta lista y no otra cosa.** Dale un fuego que se
   pague y dos de las nueve salen solas.

   Y lo que sí movió el tramo L en este banco: el presupuesto vivido bajó de 20,5% a
   **18,2%** (el que deja de dar un paso ya dado camina antes) y los estados ilegales
   bajaron de **47.091 en 10 partidas a 31.833 en 7**, con `solidos-solapados` sin
   encabezar ninguna.
3. ~~El umbral hay que rediscutirlo con el usuario.~~ **CERRADO: es 4 de 9**, el
   absoluto (sección 5·bis). El texto pide «4 de las 10» y la lista tiene nueve; se
   eligió la lectura más exigente para no bajarle el piso al criterio de corte por
   haber perdido una entrada.
3·bis. **`COSTO_POR_CELDA` es el que manda ahora y nadie lo miró.** Con vivir a 0,34,
   caminar es el 65% del gasto de la criatura del criterio (0,04918/tick contra
   0,017). El 0,05 por celda se eligió cuando vivir costaba 1,0 —«a la frecuencia de
   referencia caminar cuesta lo mismo que vivir», dice su comentario— y esa frase ya
   no es cierta: hoy caminar cuesta 2,94× lo que vivir. No se tocó porque el usuario
   no lo decidió, y hay una segunda razón para no apurarlo: **el hueco de la
   locomoción** (`world/tests/el-tiempo-no-depende-del-tick.test.ts`, hueco 2) dice
   que la velocidad es una celda por TICK, o sea 20 celdas por segundo a 20 Hz. El
   costo por celda y la velocidad por celda son el mismo número mal puesto, y
   arreglar uno solo mueve la economía sin arreglar la física.
4. **La promesa de un `establishes` se VENCE y nadie lo sabe.** Medido: el pescado
   cocido cumple `toxicity <= 0,05` a los 15 y a los 30 s, ya no a los 60, y a los
   300 s cruza el 0,2 que `comer` tolera — o sea que **la criatura se niega a comer lo
   que ella misma cocinó**. Es la ley 6 volviendo con la humedad que la ley 11 le trae
   de la celda (la «seca» mide `wet` 0,6). Hay `it.fails` con la tabla en
   `mind/tests/ataque-a-la-parrilla.test.ts`. Las dos salidas: vida útil en la
   CREENCIA, o que el plan de cocinar termine en `comer` y no en `sostener`.
5. **El mundo no le pide NADA al que hace de parrilla**: 10 g de hoja con `solid = 0`
   sostienen 2 kg de pescado y `revisarEstado` no dice una palabra. Es la ley 8 sin
   una línea que compare peso con nada. `it.fails` en
   `perceive/tests/la-parrilla-se-arma.test.ts`. El día que se cierre, la parrilla es
   lo primero que se rompe.
6. **Cocinar no es un proceso** y el planificador lo sufre: `ConstructionSchema.via`
   es un `ProcessId` y sólo hay cuatro procesos. Secar (ley 11), carbonizar (ley 4)
   y cocinar (ley 5) tienen todos la forma «poné esto acá y esperá». La variante
   `EsquemaDeLey` ya está y anda —dos filas de cocción, barridas de los tres
   montajes— pero `via` sigue siendo un `ProcessId` para los esquemas de proceso.
7. **La sexta pregunta del arnés sigue apagada en `Partida`, pero por UN camino de
   tres y ya no es de la crónica.** El evento `decreta` cerró la apertura de chunks y
   la reposición de pozos; lo que queda es la extracción: **`nutrition` 3310,72 →
   3319,15 en el tick de la pesca**, con la masa cuadrando al bit. No es materia de
   más, es que el banco proyecta el stock con `stock.yields` y `draw` puede entregar
   otra sustancia, y las dos no valen lo mismo por kilo. Declararlo con un `decreta`
   sería taparlo. Es de `dios.ts` + `@anima/oracle` y pide su ADR de modelo.
   `it.fails` con la medición nueva en `perceive/tests/ataque-a-la-costura.test.ts`.
8. **68 `it.fails`**, repartidos: mind 21, world 15, physics 13, perceive 7, juez 5,
   plan 5, oracle 1, skills 1. Cada uno tiene su porqué medido al lado.
9. ~~`explorar` sigue caminando un ciclo cerrado de 8 celdas~~ **CERRADO en dos
   mitades, mente primero y mundo después** (número 35 de la sección 5 de
   `como-se-trabaja.md`, que tiene la historia entera con el intento revertido en
   el medio). El ancla del fondo vive en `mind/src/escalera.ts` (`hayAncla` +
   `yaDeambulePor`: deambular es UNA herramienta por meta, no un bucle) y el rumbo
   del mundo dura 16 ticks y sale de los bits altos de una avalancha. Lo que
   compró, todo medido: `explorar` cierra su contrato (44 celdas de distancia y 96
   distintas en 100 ticks, era 3 y 8; **15 de 15 innatas**), la escena buena con
   tres manos **cumple el criterio (2) por primera vez con la cadena de verdad**,
   la pendiente del gasto cayó de 2,89× a 1,02× el vivir, y el piso de D1 volvió
   (69,4% → 85,9%). Y el banco caro del juez se corrió entero con la conducta
   nueva y dio **exit 0, 121/121, SIN re-clavar nada** — sus tests afirmaban
   mecanismos y no números sueltos—: la canónica sube de 37,9% a **52,2%** del
   presupuesto (muere en el 18.150, pegada al techo de quieta de 18.235: ya no se
   muere de caminar, se muere del fósforo), el control del tanque lleno sube de
   91,4% a **100%**, y el veredicto de la emergencia queda igual: **0 de 9 contra
   2 de 9**, con la situación canónica en 8/20, 8/20 y 7/20.

### Lo que se cerró en el tramo L, para que nadie lo vuelva a buscar

- **El no-op con cara de progreso.** `plan()` poda el PREFIJO ya cumplido de
  `plan.steps` y de `gap.nearest` (`sinLoQueYaEstaHecho` en `plan/src/regresion.ts`),
  y la escalera saltea en el MISMO tick los pasos ya dados antes de despegarlos
  (`salteaLoQueYaEstaHecho` en `mind/src/escalera.ts`, contador
  `EstadoDeLaEscalera.salteados`). Sólo el prefijo, y ése es el argumento de
  corrección: «ya está hecho» es una afirmación sobre un ESTADO y el único que el
  planificador conoce es el de hoy; el segundo paso se ejecuta contra un mundo que
  todavía no existe. De las 15 innatas, cinco tienen salida temprana en el tick cero
  (`ir`, `sostener`, `frotar`, `esperar`, `explorar`) y sólo dos se pueden dar por
  hechas sin simular: `ir` y `sostener`. Las otras trece contestan `false` a
  propósito, **y eso es lo que salva perseverar**.
- **La atribución del bucle, medida por ablación** (número 23 de la sección 5 de
  `como-se-trabaja.md`): las dos capas apagadas dan 6045 `ir`, sólo el cerrojo 2,
  sólo la poda 22, las dos 1. Son redundantes en esta escena y ninguna sobra.
- **`salteados` mide CERO en las corridas del criterio**, y está publicado: el portón
  de la mente no dispara ahí porque la poda llega antes. Lo que cubre —un paso que D0
  devolvió a la cola, los pasos sueltos de D2/D3— está probado en
  `mind/tests/el-no-op-con-cara-de-progreso.test.ts`, que son las DOS mitades del
  criterio: (1) cortar el bucle y (2) perseverar el proceso. Un arreglo que pase sólo
  una de las dos es el arreglo equivocado.
- **La aserción del control del juez, que estaba roja detrás de `ANIMA_BANCO=1`.**
  Ver los números 22 y 31. El primer mecanismo que la reemplazó —«el control vive
  más de 3× lo que la canónica»— perdió resolución al bajar el costo de vivir:
  37,884% contra 91,377%, o sea 2,412×, y con el horizonte censurado ni un control
  perfecto podía pasar de 2,640×. No se bajó el 3. Ahora se afirma el mecanismo
  pareado: mismas veinte semillas, sin duplicados, y el tanque lleno abre una
  ventana de observación posterior a cada muerte canónica (**20 de 20**). El juez
  no retrocede y en la medición sigue dando **2 de 9 contra 0**. Verificado con
  `ANIMA_BANCO=1`: 121/121, exit 0.

### Lo que se cerró en el tramo K bis, para que nadie lo vuelva a buscar

- **El determinismo del mundo materializado.** `abrirChunk` le preguntaba al MUNDO
  dónde había lugar y ahora le pregunta al DECRETO (`celdaDelDecreto`), y al que está
  parado en la celda decretada se lo corre (`correrAlQueEstaba`). Los mismos dos
  puntos en los dos órdenes daban `2f63c2f9eabd29b6` contra `a4fc2879124b0d36` y ahora
  dan el mismo hash. ADR II-0014.
- **El banco de peces ya no se materializa encima de nadie.** No se le enseñó a
  esquivar: `abrirChunk` le reserva su celda a las sueltas, y al que esté parado ahí lo
  corre. `solidos-solapados` sobre veinte semillas: **2/20 → 0/20**. Consecuencia
  visible, y está afirmada: **una criatura no puede quedarse parada encima del banco**;
  el mundo la corre una celda y pescar sigue andando (`aMano` es Chebyshev ≤ 1).
- **La conservación dejó de estar apagada de hecho.** Dos eventos nuevos, los dos
  `Narracion`: `decreta` (cuánto puso el dios, por tick y por cuenta conservada) y
  `perdida` (la pieza decretada que no entró en ningún lado). 96 y 21 violaciones en
  400 ticks de caminata → **0 y 0**, con el control ciego al lado que sigue dando 96 y
  21 para que el cero signifique algo.
- **`SIN_FIRMA` es ahora un registro con tipo** —`{ [K in Narracion['k']]: true }`—,
  así que agregar una `Narracion` sin declararla ahí **no compila**. La lista de `||`
  que había habría firmado los dos eventos nuevos con la intención que estuviera
  despachándose, o sea el mundo culpando a la criatura de que el dios sembró un chunk.

### Y tres cosas que se cerraron en el tramo J, para que nadie las vuelva a buscar

- **La fuente se elige por CALOR ENTREGADO y no por potencia.** `entornoDe`
  (`world/src/step.ts`) ordenaba por `emitsPower`, que es la mitad de la cuenta que la
  ley 1 hace dos líneas después. Dos bugs medidos morían de eso: un fuego más grande a
  SESENTA celdas le robaba el único hueco de `Fuente` a la brasa que la comida tenía
  debajo (el pescado se quedaba en `digestibility` 0,3800, o sea CRUDO, sin radio a
  partir del cual dejara de pasar), y el empate entre dos fuegos iguales lo decidía el
  ABECEDARIO del id —la misma escena cocinaba o no según cómo se llamaran los
  cuerpos—. Se ordena por `potencia · formFactor(distancia, montaje)`: no hace falta
  ningún radio de corte porque el `(1 + d²)` ya lo pone, y el desempate por id queda
  para el empate de verdad. Medido en
  `world/tests/la-fuente-se-elige-por-calor.test.ts`. **Movió el hash de la partida de
  2000 ticks** (`a15c8d9dad1a6180` → `18ad7fce912cdee3`, 11.190 → 11.192 eventos, y se
  separa en el PRIMER checkpoint), con la bisección escrita al lado.
  Y cerró de paso un `it.fails` de `perceive`: la comida apoyada sobre un leño
  ardiendo ahora SÍ lo siente (pasó de 232,22 °C a 944,45 y termina en
  `residuo-mineral-de-pescado`). La parrilla de madera es **peor** de lo que se había
  medido, y lo único que la mantiene afuera del plan es el `roleHint`
  `ignitionPoint > 507` de la fila.
- **La espera del plan sabe qué está esperando.** `Step.esperar` gana `mirando`, con
  el `Ref` del sujeto y los `QualityTest` del `establishes` de la fila despejados con
  `interpretar`; `mente.ts` arma el cierre `hasta`. La espera pasó de gastar la cota
  entera (300 ticks) a cortar cuando la comida está lista (100). Dos detalles que
  cuestan una tarde si no están escritos: se mira `e.establishes` y **no**
  `m.establece` —la meta puede ser más floja que la fila y con la meta la comida salía
  del fuego a `digestibility` 0,8212—, y **no** se pasa `mirando` a la innata (ver la
  regla nueva al final de la sección 5).
- **Un archivo de tests con 80 s de bucle sincrónico rompe el worker de vitest** con
  `Timeout calling "onTaskUpdate"`: birpc le pone 60 s de vencimiento al aviso de cada
  test y un `for` largo no deja correr ni el temporizador ni la lectura del socket;
  cuando suelta el hilo, Node corre la fase de temporizadores antes que la de poll y
  el vencimiento gana la carrera aunque la respuesta ya esté en la cola. Salían **los
  291 tests en verde y `exit 1`**, que es la peor clase de rojo. Se arregla con un
  `beforeEach` de raíz que haga `await new Promise(r => setTimeout(r, 0))` — una
  macrotarea de verdad; un `await` sobre una promesa resuelta es una microtarea y no
  drena la fase de poll. Está puesto en `mind/tests/hito-5-el-criterio.test.ts`.
- **Y el banco de `un goTo contra un wait` pasó a `MIDIENDO_EN_SERIO`.** Comparaba
  TRES perfiles de reloj de pared entre sí y se dio vuelta en una corrida de la suite
  completa: los deltas son de 1,7 a 2,8 ms y en la misma máquina cargada llegaron a
  +2,84 contra +2,59. No se aflojó ningún umbral y no se borró el caso: se afirma
  siempre el MECANISMO —con `wait` ningún cuerpo se mueve, con `goTo` se mueven todos,
  que es lo que la resta quiere decir— y la comparación de relojes queda con
  `ANIMA_BANCO=1`, igual que las otras tres de ese archivo.

---

## 7 · Lo práctico

- Rama `anima-2`, **sin pushear**.
- El tramo N no tocó una sola línea de `src`: son **dos archivos de test nuevos** en
  `@anima/world` (`hay-comida-sin-fuego.test.ts` y `la-escalera-construible.test.ts`)
  y los documentos. Y **borró uno**: `la-escalera-bajo-max-parts.diagnostico.test.ts`,
  un diagnóstico temporal que tardaba **664 s de bucle sincrónico** y rompía el canal
  de vitest con `Timeout calling "onTaskUpdate"` —la trampa que ya está escrita al
  final de la sección 2 de `como-se-trabaja.md`—. Lo que ese diagnóstico halló está
  medido de nuevo, acotado y verde: `@anima/world` pasó de **671 s a 44 s**.
- **Ánima I sigue vivo al lado** (`packages/`, `apps/`) y anda: 455 tests verdes.
  Los últimos tres commits son de ahí (el tacho, el martillo eterno, el 400 de
  Codex) y no tienen nada que ver con el remake.
- La regla 1 de `ii/`: **nada de `ii/` importa de `packages/` ni de `apps/`**. La
  única excepción es `apps/api`, que se comparte.

### El prompt para arrancar la sesión nueva

> Seguimos con Ánima II, el remake que vive en `ii/` del repo `F:\proyectos\Anima`
> (el Ánima I original sigue andando al lado, en `packages/` y `apps/`).
> Leé `ii/docs/continuar-aca.md` entero antes de hacer nada: es el traspaso, y trae
> el estado, el método, las decisiones tomadas y los veinte números que ya se
> corrigieron. **La sección 0·bis manda sobre el orden del trabajo**: el Hito 5
> termina con el alcance que tiene, y lo que sigue es el Gate 5→6
> (`ii/docs/gate-5-6-objetos-emergentes.md`). Lo que quede abierto del Hito 5 está
> en la sección 6.
> Usá workflows con agentes en paralelo sobre archivos disjuntos. Commiteá cuando
> un tramo esté verde y verificado, sin pushear.
