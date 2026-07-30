# Continuar acá — traspaso del Hito 5

Este archivo existe para que **otra sesión, en otra cuenta, sin nada de la
conversación anterior**, pueda seguir sin volver a descubrir lo que ya se
descubrió. Lo que estaba en la memoria personal de la cuenta anterior se bajó
acá, porque la memoria es por cuenta y no viaja.

Última actualización: 2026-07-29, sobre el árbol de trabajo del tramo J (último
commit `07b9c66`, con cambios sin commitear encima).

---

## 0 · Lo primero que hay que leer, en este orden

1. Este archivo, entero.
2. [`ii/README.md`](../README.md) — el índice del remake y sus tres reglas.
3. [`docs/architecture/remake-anima-ii.md`](../../docs/architecture/remake-anima-ii.md)
   — la arquitectura. La sección del **Hito 5** (cerca de la línea 1452) es el
   criterio de corte del proyecto.
4. [`ii/docs/decisions/`](decisions/) — **13 ADRs propios**. Los que más pesan hoy:
   II-0001 (encender no es una acción), II-0007 (el tick es un parámetro),
   II-0008 (el tiempo va en segundos), II-0009 (el hambre mata), II-0010 (frotar
   no relaja), II-0011 (arder libera calor), II-0012 (el presupuesto del plan va
   en expansiones), II-0013 (el veneno se cobra al tragar).

---

## 1 · Dónde está el proyecto

**Nueve paquetes, 2382 tests verdes, nueve typechecks limpios, 70 huecos
`it.fails` anotados.** Cuarenta y un commits por delante de `main`, en la rama
`anima-2`. **Ninguno pusheado** — el usuario pushea solo. Si la sesión nueva es
en otra máquina, hay que pushear antes.

| paquete | qué es | tests |
|---|---|---:|
| `@anima/physics` | materia, 12 leyes, `admit()`, 4 procesos aplicables | 605 |
| `@anima/world` | el árbitro determinista, `stepWorld`, metabolismo, reloj | 496 |
| `@anima/oracle` | el dios perezoso, biomas, pozos, libro calórico | 268 |
| `@anima/skills` | el sandbox y las 15 innatas | 193 |
| `@anima/perceive` | LA COSTURA mundo↔habilidades, `Partida`, `ticksPerdidos` | 120 |
| `@anima/plan` | `SCHEMA_INDEX`, `goalGraph()`, `plan()` anytime | 294 (+1 todo) |
| `@anima/mind` | necesidades, creencias β, `opportunities()`, escalera D0–D5 | 292 |
| `@anima/juez` | el detector de secuencias de emergencia, **externo a propósito** | 114 |

Comandos: `pnpm ii:test` · `pnpm ii:typecheck` · bancos con `ANIMA_BANCO=1`.

---

## 2 · El Hito 5, criterio por criterio

Es el **criterio de corte**: si pasa, hay producto aunque el modelo nunca se
conecte; si no pasa, el plan se para acá y se revisa antes de gastar en la fragua.

| criterio | veredicto | número medido |
|---|---|---|
| proveedor apagado | **CUMPLE** | 0 llamadas a la red, 0 dependencias de runtime fuera de `ii/` |
| la cadena de la caña | **CUMPLE** | 7 eslabones; caña en el tick 35, pescado en la mano en el 96 |
| `ticksPerdidos === 0` | **CUMPLE** | 0 en 20.000 ticks, con reloj de pared (0,151 ms/tick contra 50) |
| p99 < 5 ms con 5000 cuerpos | **NO cumple — ACEPTADO por el usuario** | 33,90 ms (6,8×) · guarda verde en 45 ms |
| **sobrevive 20.000 ticks sola** | **NO CUMPLE** | escena del documento: muere en 3627 con **0 bocados**. Escena BUENA (leña seca, tanque lleno): muere en **5627** con **1 bocado** |
| emergencia: ≥4 de 10 en 20 partidas | **NO CUMPLE** | **0 de 9**, contra **1 de 9** del azar, sin umbrales tocados |

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

Contra `stepWorld`, con la escena buena: prendió en el tick 149, cocinó en el 251,
comió en el 257. Y **no alcanza**, por una cuenta que hay que decidir arriba:

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

- Con una despensa de cocidos regalada, la misma mente **sobrevive los 20.000** con
  65 bocados y aliento final 1,4593. O sea: la conducta está, falta la aritmética.
- Con la escena del documento tal cual, el `plan()` sigue saliendo `gap`, y el motivo
  cambió de piso: **no hay una sola vara de madera de ese tamaño en el mundo**. El
  dios decreta 62 cuerpos sueltos en los 9 chunks de la parada y `stepWorld`
  materializa 0 (diagnóstico 7).
- Y si se le pone, **se ahoga**: la celda que `laOrilla()` llama seca mide `wet`
  0,6000 y la `moisture` de la yesca cruza el 0,45 de `HUMEDAD_QUE_APAGA` en el tick
  85, once antes de que el pescado llegue a la mano (diagnóstico 8).

---

## 3 · Cómo se trabaja acá — esto es lo que más importa

El usuario lo dijo así en la primera línea de la sesión anterior, y sostenerlo es
más importante que la velocidad.

- **Ningún hito se cumple sin su criterio verificable, escrito de antemano.** Tres
  criterios se pasaron y **no se ablandaron por cuenta propia**: se midieron, se
  presentaron las salidas y decidió el usuario. Si otro se pasa, hacer lo mismo.
- **Un hueco abierto se marca con `it.fails()` y el porqué MEDIDO al lado.** Nunca
  se debilita un test para dar verde. Hoy hay 70 anotados.
- **Los adversarios son la mitad del trabajo**, y hace falta uno **con el lente al
  revés**: el que busca cosas HONESTAS que el sistema rebota. Ese lente encontró
  que `comer` no se podía escribir — o sea que la criatura pescaba y no comía.
- **Verificá vos lo que reportan los agentes.** Ver la sección 5: van **catorce**
  números corregidos, y dos de ellos eran conclusiones enteras que estaban mal.
- **Un test de rendimiento adentro de la suite normal es un test flaky, y un test
  flaky es peor que ninguno: enseña a ignorar el rojo.** El patrón decidido es
  `const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'`: se imprime
  siempre, se afirma sólo midiendo en serio. Ver `world/tests/banco-el-tick.test.ts:165`.
  Y cuando se puede, mejor todavía: **afirmar el mecanismo en vez del reloj**
  (que la segunda mirada devuelva los mismos objetos prueba la caché sin
  cronómetro, y no depende de cuántos núcleos haya libres).
- **Se trabaja con workflows de agentes en paralelo sobre archivos disjuntos.** Se
  commitea cuando un tramo está verde y verificado, **sin pushear**.

---

## 4 · Decisiones tomadas — no volver a preguntarlas

- **El modelo escribe habilidades y nada más** (ADR II-0001): no toca física,
  motor, UI ni persistencia.
- **El tick es un parámetro de RENDIMIENTO y las tasas de las leyes son de
  RITMO** (ADR II-0007). Nunca se arregla uno moviendo el otro.
- **El tiempo del mundo va en segundos, no en ticks** (ADR II-0008): cocinar tarda
  lo mismo a 10, 20, 25, 50 o 100 Hz.
- **El presupuesto de `plan()` va en expansiones, no en milisegundos** (ADR
  II-0012). Es el mismo movimiento por tercera vez: lo que es RITMO va en unidades
  del mundo, lo que es RENDIMIENTO en unidades de la máquina.
- **El veneno se cobra al tragar** (ADR II-0013), decidido por el usuario.
- **El p99 que falla por ~7× está ACEPTADO.** Queda `it.fails` como aspiración y
  hay una guarda verde en 45 ms: aceptar un número no es dejar de vigilarlo. Ojo con
  este banco: corrido junto a los otros ocho paquetes llega a rozar los 45 ms por
  CONTENCIÓN. Si se pone rojo, **no aflojes el umbral**: aislalo o afirmá el
  mecanismo (sección 3).
- **La calibración de la aritmética de comer NO se toca sin el usuario.** `eficiencia`
  de la fricción y `STAMINA_POR_CALORIA` son las dos palancas que darían vuelta el
  signo del criterio (2), y moverlas sería ablandar el criterio por cuenta propia.
  Está medido y presentado; falta decidir.
- **La UI va DESPUÉS del Hito 5.** Se preguntó y el usuario eligió terminar el
  criterio de corte primero.

---

## 5 · Los dieciséis números corregidos, y la regla que dejó cada uno

Esto es lo más caro de las sesiones anteriores y lo que más fácil se pierde. **Tres
fueron conclusiones enteras que estaban mal y que ya habían viajado a
documentos.**

1. **«El fuego no se propaga»** — falso. La cuenta era correcta sobre piezas
   SUELTAS: la corteza más grande que un bioma siembra (0,5 kg) entrega 175,32 °C
   contra los 300 que pide la madera. Pero **dos cortezas atadas** pesan 1 kg y
   entregan **335,64**; el leño llegó a 933,83 °C en el mundo. Medido en
   `world/tests/el-fuego-no-se-propaga.test.ts`.
   → **REGLA: medir el catálogo no es medir el mundo.** Antes de aceptar «el mundo
   no permite X», probá X con `unir`, con varias piezas y con las quince innatas
   encadenadas. Y antes de cambiar el mundo para desbloquear algo, medí si ya está
   desbloqueado.
2. **«Pescó 199 veces y se murió de hambre»** — pescó UNA. El contador leía
   **despegues** de la habilidad, no aterrizajes: 199 despegues, 1 aterrizaje, 197
   rechazos. → **REGLA: no midas el proxy, medí la cosa.**
3. **«El mundo no permite fuego: el encendible más liviano pesa 1,0000 kg»** —
   era el arnés, que plantaba `cuerpo('vara', 'madera', 1)` a mano. Veinte
   semillas distintas dando el mismo número al cuarto decimal no es un sorteo. El
   dios decreta: **13 de 20 semillas con vara encendible, la más liviana 0,0610 kg**
   (el techo es 0,7132). Medido en `juez/tests/lo-que-el-mundo-si-siembra.test.ts`.
4. **«El azar firma 3 de 9»** — firma **1**. Las tres se midieron sobre una escena
   propia del control (10 sueltas de una tabla a mano, 4 peces regalados, mundo
   5×5 sin dios), donde las nueve daban situación 20/20. Eso no es la firma de un
   sorteo: es la de una escena inventada.
5. **«1 de 66 formas re-adivinadas»** — eran **54 de 66**: el número del adversario
   era cota inferior porque sólo veía los desacuerdos hacia `bloque`.
6. **«Faltan 5 ticks para los 20.000»** — encuadre engañoso: 1000 de tanque son
   exactamente 1000 segundos de vida a 1,0/s, o sea que había sobrevivido lo que
   traía puesto **sin comer nada**.
7. **Un ADR que exageraba**: II-0009 inventó «comer crudo negativo y cocinar
   positivo» mientras calibraba una constante, y resultó **un conjunto vacío**
   (0,495/s contra 0,766/s, los bordes se cruzan).
   → **REGLA: cuando un criterio falla, volvé al texto que lo pidió y no al
   documento intermedio que lo reformuló.** Un ADR que calibra una constante
   tiende a escribir, para justificarla, una promesa más ambiciosa que el criterio.
8. Y otros siete de menor porte: el techo de la fricción (29,4 → ~50 °C), «11.000
   de stamina, imposible» (la yesca de 0,2 kg cuesta 141 y entra), el efecto de un
   campo opcional sobre el hash, la atribución de un hash movido, «+3037 en la
   peor» (era la mejor), «60 s por kilo», y un encuadre de duty-cycle del 18%.

9. **«La espera ciega es lo que hace que un fuego alcance para un solo bocado»** —
   media verdad, y la media que faltaba es la que importa. La espera ERA ciega y se
   arregló (pasó de 300 ticks a 100, medido), y **el conteo de bocados no se movió:
   uno en veinte mil, antes y después**. El techo teórico subió de 1 pieza a 4 y el
   techo real siguió en 1.
   → **REGLA: un cuello de botella medido no es EL cuello de botella.** Antes de
   festejar una mejora, volvé a correr el criterio y mirá si el NÚMERO DEL CRITERIO
   se movió. Los 200 ticks de fuego recuperados son reales y no compraron nada.
10. **«El plan de ligar un fuego que existe son cinco pasos»** — hoy son siete, y no
   porque el planificador empeorara: el bloque que lo mide le corre **200 ticks de
   mente de verdad** a la escena antes de pedir el plan, y en esos 200 ticks la
   criatura ahora cocina y come. El plan que sale después es el de alguien que ya se
   comió el pescado.
   → **REGLA: un test que calienta la escena con `vivir()` está midiendo dos cosas.**
   Cuando cambie, preguntá primero si cambió el planificador o si cambió la escena.

**Y una que me hice a mí mismo**, que vale igual: comparé un número contra
`ROL_A_DE_FRICCION`, que es una **función** que devuelve un `Role`, no un número.
Dio cero encendibles con 264 varas de madera a la vista.

**Y otra, del tramo J, que casi entró como arreglo:** pasarle `mirando` a la innata
`esperar` para que muestree con `rateOf` parecía gratis. No lo es: `rateOf` es la tasa
del tick PASADO, y en el primer tick de la cocción es CERO con razón —la comida
todavía se está calentando y no cruzó su `denaturesAt`—, así que la innata fallaba con
«lo que espero no está pasando» y **la criatura dejaba de cocinar del todo**
(`cocinoEn` volvía a −1). Se pasa sólo `hasta`.
→ **REGLA: una guarda correcta puede ser la pregunta equivocada en el primer tick.**

---

## 6 · Qué está abierto, en orden de importancia

1. **LA ARITMÉTICA DE LA COCCIÓN, Y HAY QUE DECIDIRLA ARRIBA** (sección 2). No es una
   ineficiencia: es el signo. Un fuego cuesta entre 485 y 554 de aliento, un bocado
   cocido devuelve 19,84, y no se puede comer crudo. Las palancas (a) y (b) son
   calibración y **no se tocan sin el usuario**; la (c) ya se hizo a medias y no
   alcanzó. La cuarta, que no es calibración, es **enseñarle al planificador a
   propagar el fuego** en vez de frotar dos palos cada vez.
2. **La emergencia mide 0 de 9** (0 de 8 contando: §10.2 pide ≥2 de las 20 con
   situación y que el azar no la firme), contra **1 de 9** del azar. La columna
   `situación` sí se mueve: tres filas con **8/20, 8/20 y 5/20** — el mundo le puso el
   problema delante y la mente no lo resolvió ni una vez. Las otras seis siguen sin
   situación, y las seis cuelgan de un cero duro: **0 fuegos en 20 partidas**.
3. **El umbral hay que rediscutirlo con el usuario.** El criterio publicado dice
   «≥4 de las 10» y la lista tiene **9** entradas, de las cuales el azar firma 1
   → el piso hay que cruzarlo sobre 8. Nadie aprobó «4 de 8» ni «4 de 9»:
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
7. **70 `it.fails`**, repartidos: mind 19, world 16, physics 13, juez 8, perceive 7,
   plan 5, oracle 1, skills 1. Cada uno tiene su porqué medido al lado.
8. **`explorar` sigue caminando un ciclo cerrado de 8 celdas** — la 1 de 15 innatas
   que no logra su contrato.

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

- Rama `anima-2`, **41 commits por delante de `main`, sin pushear**.
- El último commit es `07b9c66`, y el tramo J tiene **cambios sin commitear encima**
  (cuatro archivos de test nuevos y cuatro `src/` tocados: `world/src/step.ts`,
  `plan/src/tipos.ts`, `plan/src/regresion.ts`, `mind/src/mente.ts`).
- **Ánima I sigue vivo al lado** (`packages/`, `apps/`) y anda: 455 tests verdes.
  Los últimos tres commits son de ahí (el tacho, el martillo eterno, el 400 de
  Codex) y no tienen nada que ver con el remake.
- La regla 1 de `ii/`: **nada de `ii/` importa de `packages/` ni de `apps/`**. La
  única excepción es `apps/api`, que se comparte.

### El prompt para arrancar la sesión nueva

> Seguimos con Ánima II, el remake que vive en `ii/` del repo `F:\proyectos\Anima`
> (el Ánima I original sigue andando al lado, en `packages/` y `apps/`).
> Leé `ii/docs/continuar-aca.md` entero antes de hacer nada: es el traspaso, y trae
> el estado, el método, las decisiones tomadas y los dieciséis números que ya se
> corrigieron. Después seguí por donde dice la sección 6.
> Usá workflows con agentes en paralelo sobre archivos disjuntos. Commiteá cuando
> un tramo esté verde y verificado, sin pushear.
