# Continuar acá — traspaso del Hito 5

Este archivo existe para que **otra sesión, en otra cuenta, sin nada de la
conversación anterior**, pueda seguir sin volver a descubrir lo que ya se
descubrió. Lo que estaba en la memoria personal de la cuenta anterior se bajó
acá, porque la memoria es por cuenta y no viaja.

Última actualización: 2026-07-30, sobre el árbol de trabajo del **tramo L** (el
no-op con cara de progreso: último commit `c03800c`, con cambios sin commitear
encima).

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
5. [`ii/docs/decisions/`](decisions/) — **14 ADRs propios**. Los que más pesan hoy:
   II-0001 (encender no es una acción), II-0007 (el tick es un parámetro),
   II-0008 (el tiempo va en segundos), II-0009 (el hambre mata), II-0010 (frotar
   no relaja), II-0011 (arder libera calor), II-0012 (el presupuesto del plan va
   en expansiones), II-0013 (el veneno se cobra al tragar), **II-0014 (el decreto
   manda sobre la celda, y el mundo narra lo que el dios pone)**.

---

## 1 · Dónde está el proyecto

**Nueve paquetes, 2431 tests verdes (+1 `skipped` en `world`, +1 `todo` en `plan`),
nueve typechecks limpios, 68 huecos `it.fails` anotados.** Corridos enteros al cerrar
el tramo L, mirando el exit code: `pnpm ii:test` **0** y `pnpm ii:typecheck` **0**, y
además `ANIMA_BANCO=1 pnpm --filter @anima/juez test` **0** (116 de 116). En la rama `anima-2`, **ninguno pusheado** — el
usuario pushea solo. Si la sesión nueva es en otra máquina, hay que pushear antes.

> **Y HAY UN VERDE QUE NO ES EL DE `pnpm ii:test`.** `@anima/juez` tiene una
> aserción que sólo se evalúa con `ANIMA_BANCO=1`, y **estaba roja desde antes del
> tramo L** mientras el traspaso publicaba el veredicto de la emergencia como si
> nada (número 22 de la sección 5 de `como-se-trabaja.md`). Está reparada. La regla
> que dejó: **el veredicto de la emergencia se publica MIRANDO el exit code de
> `ANIMA_BANCO=1 pnpm --filter @anima/juez test`**, no el de la suite normal.

| paquete | qué es | tests |
|---|---|---:|
| `@anima/physics` | materia, 12 leyes, `admit()`, 4 procesos aplicables | 605 |
| `@anima/world` | el árbitro determinista, `stepWorld`, metabolismo, reloj | 533 (+1 skipped) |
| `@anima/oracle` | el dios perezoso, biomas, pozos, libro calórico | 268 |
| `@anima/skills` | el sandbox y las 15 innatas | 193 |
| `@anima/perceive` | LA COSTURA mundo↔habilidades, `Partida`, `ticksPerdidos` | 120 |
| `@anima/plan` | `SCHEMA_INDEX`, `goalGraph()`, `plan()` anytime, **la poda de lo ya hecho** | 295 (+1 todo) |
| `@anima/mind` | necesidades, creencias β, `opportunities()`, escalera D0–D5, **el portón de despegue** | 301 |
| `@anima/juez` | el detector de secuencias de emergencia, **externo a propósito** | 116 |

Comandos: `pnpm ii:test` · `pnpm ii:typecheck` · bancos con `ANIMA_BANCO=1`.

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

Todos los números de esta tabla se corrieron el 2026-07-30 sobre el árbol del
tramo L, o sea **sobre el mundo que el dios decreta y ningún arnés planta**.

| criterio | veredicto | número medido |
|---|---|---|
| proveedor apagado | **CUMPLE** | 0 llamadas a la red, 0 dependencias de runtime fuera de `ii/` |
| la cadena de la caña | **CUMPLE** | 7 eslabones en el plan, **6 vuelos** contra el mundo (el `ir` al pozo lo poda el tramo L: ya estaba al lado): tira la caña en el tick **48**, el pescado entra a la mano en el **108** |
| `ticksPerdidos === 0` | **CUMPLE, con una condición escrita** | **0** en 20.000 ticks con reloj de pared (0,947 ms/tick contra una ventana de 50) — y la partida termina con **120 cuerpos**, o sea que no recorre mundo. Una que camina derecho llega a 23.353 cuerpos y a 74 ms/tick a los 10.000, o sea que cruza la ventana ADENTRO de los 20.000 |
| p99 < 5 ms con 5000 cuerpos | **NO cumple — ACEPTADO por el usuario** | **30,94 ms** (6,2×) corriendo `@anima/world` solo · **36,13 ms** (7,2×) en la corrida de los nueve paquetes, que es CONTENCIÓN y no regresión · guarda verde en 45 ms |
| **sobrevive 20.000 ticks sola** | **NO CUMPLE** | muere en el **3802** de 20.000 con **0 bocados**. Con el tanque lleno: muere en el **12.124**, también con 0 bocados. Con el eslabón REGALADO (despensa de cocidos): come 68 y muere en el **12.847** |
| emergencia: ≥4 de 10 en 20 partidas | **NO CUMPLE con el tanque canónico · 2 de 9 con el tanque lleno** | **0 de 9** contra **0 de 9** del azar, sin umbrales tocados, con el tanque de 310. **Con el tanque de 1000 son 2 de 9** y la corrida pasa a ser interpretable — ver el punto 2 de la sección 6, que se dio vuelta. Situación en la canónica: **10/20, 10/20 y 8/20** |

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

## 6 · Qué está abierto, en orden de importancia

1. **LA ARITMÉTICA DE LA COCCIÓN, Y HAY QUE DECIDIRLA ARRIBA** (sección 2). No es una
   ineficiencia: es el signo. Un fuego cuesta entre 485 y 554 de aliento, un bocado
   cocido devuelve 19,84, y no se puede comer crudo. Las palancas (a) y (b) son
   calibración y **no se tocan sin el usuario**; la (c) ya se hizo a medias y no
   alcanzó. La cuarta, que no es calibración, es **enseñarle al planificador a
   propagar el fuego** en vez de frotar dos palos cada vez.
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
3. **El umbral hay que rediscutirlo con el usuario.** El criterio publicado dice
   «≥4 de las 10» y la lista tiene **9** entradas, de las cuales el azar firma 0
   → el piso hay que cruzarlo sobre 9. Nadie aprobó «4 de 9»:
   **no lo ajustes por tu cuenta**, presentá el número crudo.
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
9. **`explorar` sigue caminando un ciclo cerrado de 8 celdas** — la 1 de 15 innatas
   que no logra su contrato.

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
  Ver el número 22. Ahora se afirma el MECANISMO —el control vive más de 3× lo que la
  canónica, y el juez se mueve en la dirección que tiene que moverse— en vez de un
  umbral inventado. Y al correrlo apareció el número 25, que es el hallazgo más caro
  del tramo: **el control mide 2 de 9, no 0** (punto 2 de la sección 6).

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
- El último commit es `c03800c`, y encima hay **cambios sin commitear** del tramo L:
  `plan/src/regresion.ts` (+ `plan/src/index.ts` para exportar `pasoYaEstaHecho`),
  `mind/src/escalera.ts`, un archivo de test nuevo
  (`mind/tests/el-no-op-con-cara-de-progreso.test.ts`) y cuatro tests tocados
  (`plan/tests/ataque-al-plan.test.ts`, `mind/tests/ataque-al-reves.test.ts`,
  `mind/tests/la-mente.test.ts`, `mind/tests/hito-5-el-criterio.test.ts`,
  `juez/tests/hito-5-la-emergencia.test.ts`).
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
> corrigieron. Después seguí por donde dice la sección 6.
> Usá workflows con agentes en paralelo sobre archivos disjuntos. Commiteá cuando
> un tramo esté verde y verificado, sin pushear.
