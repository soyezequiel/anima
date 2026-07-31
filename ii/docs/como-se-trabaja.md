# Cómo se trabaja en Ánima II

Lo que **no** cambia de un tramo al otro: el método, las decisiones ya tomadas,
y los números que hubo que corregir con la regla que dejó cada uno.

Vive aparte de [`continuar-aca.md`](continuar-aca.md) por una razón medida: ese
documento pasó de 260 a 523 líneas en dos días, y el que cierra un tramo lo leía
entero para actualizar treinta números. Partido, lee la mitad. Y esta parte se
lee UNA vez al empezar, no en cada tramo.

**Lo único que se le agrega tramo a tramo es la sección de los números
corregidos, y se agrega AL FINAL.** No hace falta releer el resto para eso.

---

## 2·bis · Cómo NO gastar horas de más

Los tramos pasaron de 2h21 a 7h33 y lo que creció no fue la dificultad: fue la
suite. Medido paquete por paquete, con `pnpm --filter @anima/X test`:

| paquete | tardaba | tarda |
|---|---:|---:|
| `@anima/juez` | 536 s | **139 s** |
| `@anima/mind` | 148 s | **41 s** |
| `@anima/world` | 81 s | 30 s |
| `@anima/perceive` | 43 s | 43 s |
| `@anima/plan` | 24 s | 24 s |
| `@anima/oracle` | 12 s | 12 s |
| `@anima/physics` · `@anima/skills` | 8 s | 8 s |

`pnpm ii:test` corre los paquetes **en serie**, así que la suite entera es la
SUMA: pasó de ~790 s a **287 s**.

> **Y la columna de la izquierda ya no se puede volver a medir.** Los dos números
> grandes se bajaron **sin acortar una sola corrida**: lo único que cambió es en
> cuántos ARCHIVOS está repartido el mismo trabajo, porque **la unidad de
> paralelismo de vitest es el archivo** y un archivo de 146 s ocupa un núcleo y
> deja quince mirando. Las tablas de salida se compararon renglón por renglón
> antes y después: la de `@anima/juez` sale idéntica, y en `@anima/mind` lo único
> que se mueve son los µs de los bancos, que se movían igual de una corrida a la
> otra. El mapa del corte está en `mind/tests/el-criterio.ts` y en el bloque «EL
> CONTROL, REPARTIDO ENTRE ARCHIVOS» de `juez/tests/azar.ts`.
>
> **De dónde salían los 536 s del juez, que no era donde se creía:** 510 de los
> 536 eran los DOS controles del azar (`tests/azar.ts`, 20 partidas × 20.000 ticks
> cada uno), y los corrían **dos archivos distintos**, o sea que el trabajo se
> hacía dos veces —la memoización es por módulo y vitest aísla el grafo por
> archivo—. El banco de la mente, que es el que uno sospecha, ya se acorta sin
> `ANIMA_BANCO=1` y sale por 24 s. **El control del azar no está gateado**: es la
> asimetría que quedó abierta, y ver el punto de abajo.

Tres reglas, y la primera vale más que las otras dos juntas:

1. **Un agente corre SÓLO el paquete que toca** (`pnpm --filter @anima/X test`)
   mientras trabaja. `pnpm ii:test` se corre UNA vez, al final, y lo corre quien
   cierra el tramo. Un agente de `@anima/plan` que corre la suite entera cuatro
   veces gasta 50 minutos para verificar 22 segundos de trabajo.
2. **Las corridas caras van detrás de `ANIMA_BANCO=1`.** `hito-5-la-emergencia`
   ya lo hace: sin la variable corre 3 partidas × 2.000 ticks y lo etiqueta como
   muestra; el veredicto del criterio sale de la corrida en serio, que es la
   única que se cita. Se imprime siempre, se afirma sólo midiendo en serio.
3. **Un tramo acotado no necesita adversario.** El aparato de cuatro fases
   —arreglar, medir, atacar, reparar— vale cuando hay una decisión de diseño
   adentro. Para un `if` que faltaba, alcanza con arreglar y medir. Las fases son
   barreras: el agente más lento traba a toda la fase siguiente.
4. **Un test caro va en un ARCHIVO, no en un `describe`.** Es la regla que salió de
   bajar la suite de ~790 s a 287: vitest paraleliza por archivo y nada más
   —`it.concurrent` adentro de un archivo NO es seguro acá, porque `decretoDe`
   memoiza por `(Physics, "cx:cy")` **sin la semilla**—. Un bloque de 100 s pegado
   a otros tres no se puede repartir después sin cortar el archivo, así que
   conviene que nazca aparte. Y si el archivo comparte un `Map` a nivel de módulo
   con un test final que lo imprime, cortarlo cuesta el doble: ver
   `mind/tests/el-cuadro.ts`, que es el precio de haberlo escrito así.

> **CERRADO en el tramo M: el control del azar YA está gateado**, y lo decidió el
> usuario. Corría 20 × 20.000 dos veces sin `ANIMA_BANCO=1` mientras el banco de la
> mente ya se acortaba a 3 × 2.000, y ésa era la asimetría. Medido antes y después:
> `pnpm --filter @anima/juez test` pasó de **167,6 s a 34,6 s** (4,8×) y sigue verde
> con la variable puesta (**685 s, 121 de 121**). Lo que cambió de la suite normal
> está escrito arriba de `PARTIDAS_DEL_CONTROL` en `juez/tests/azar.ts`: el veredicto
> sigue saliendo de la corrida en serio, `cuentan === []` se sigue afirmando siempre
> —si el azar firmara algo en tres partidas cortas, ese rojo está bien puesto— y lo
> único que quedó detrás del `env` es «el mundo puso más de 5 situaciones delante»,
> que es una propiedad de las veinte. Las tablas dejaron de tener el `/20` clavado.

> **Y CERRADO en el tramo Ñ: las DOS COHORTES del banco de la mente también se
> reparten.** La canónica (tanque 310) y el control del tanque lleno corrían
> secuenciales adentro de `hito-5-la-emergencia.test.ts` —40 partidas de 20.000
> ticks, ~13 de los ~17 minutos del banco caro— mientras las tandas del azar ya
> corrían en paralelo. Se les aplicó el mismo patrón, calcado: el corredor vive en
> `juez/tests/el-banco-de-la-mente.ts`, cinco tandas (`el-banco-tanda-N.test.ts`)
> se reparten las veinte semillas de a cuatro con sus dos tanques, y el guardado
> viaja por `node_modules/.azar/banco-<tanque>-<tope>/` con el mismo candado
> `mkdir` y el mismo borrado del `globalSetup`. Dos trampas de serializar que
> costaron su renglón: `semilla` es `bigint` (JSON lanza) y `vuelos` es un `Map`
> (JSON lo convierte en `{}` EN SILENCIO) — viajan como texto y como pares.
> Medido: `ANIMA_BANCO=1` pasó de **747,5 s a 310,9 s** (2,4×), exit 0, 126/126,
> y las 41 líneas de medición de las tablas son **idénticas renglón por renglón**
> entre las dos corridas. El cerco de la mente en `ataque-determinismo.test.ts`
> se puso rojo y obligó a escribir la decisión, que es exactamente su trabajo.

Y la asimetría que conviene tener presente antes de recortar de más: **los tramos
que más tardaron son los que encontraron las causas raíz** —la cocción, las
sueltas que no se materializaban— y **los cortos son los que produjeron los
números que después hubo que corregir**. Lo que hay que recortar es la
infraestructura, no la desconfianza.

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
- **La calibración de la aritmética de comer NO se toca sin el usuario**, y en el
  tramo M el usuario decidió. Las dos palancas que se le presentaron estaban las dos
  cerradas por un guardián (números 27 y 28 de la sección 5), así que lo que se movió
  fue una tercera: **`COSTO_VIVIR_POR_SEGUNDO` bajó de 1,0 a 0,34**, el centro de la
  ventana medida `(0,3100 ; 0,3637)`. Y en paralelo se decidió enseñarle al
  planificador **la escalera de la yesca**, que es lo que hace que un fuego se pague
  sin tocar ninguna constante. Ninguna de las dos alcanza sola: con el costo de vivir
  a 0,34 la criatura muere en el 6244 de 20.000 **con 0 bocados**, o sea que lo que
  falta sigue siendo COMER.
- **El umbral del criterio de emergencia es 4 de 9**, el absoluto, decidido por el
  usuario. El texto pide «4 de las 10» y la lista cerrada tiene nueve entradas; se
  eligió la lectura más exigente de las dos para no bajarle el piso al criterio de
  corte por haber perdido una entrada.
- **La UI va DESPUÉS del Hito 5.** Se preguntó y el usuario eligió terminar el
  criterio de corte primero.

---

## 5 · Los treinta y seis números corregidos, y la regla que dejó cada uno

Esto es lo más caro de las sesiones anteriores y lo que más fácil se pierde. **Cinco
fueron conclusiones enteras que estaban mal y que ya habían viajado a
documentos.** Los del tramo K bis van del 17 al 20 y los del tramo L del 21 al 25,
al final.

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

### Los cuatro del tramo K bis, y tres son del mismo adversario

17. **«El grueso del tick pasó a D4: 95,0% donde antes era 0,1%»** — NO SE REPRODUCE, y
   es la más cara de las cuatro porque venía con tabla, con costo en microsegundos y
   con una conclusión de arquitectura encima («entran 9 criaturas donde el criterio
   pide 5000»). Corrida por mí sobre el árbol **tal como se recibió** —con `git stash`
   de mis dos archivos de `src/`, para medir exactamente el código que la produjo— la
   orilla da `D1 74,0% · D4 0,1%`, que es la fila «antes» al cuarto decimal. El costo
   real: **media 299 µs, p99 1714 µs, y D4 aporta el 0,1%**; entran **41 criaturas**
   pescando en la orilla (167 con el tick entero), no 9.
   Y hay un daño colateral que importa más que el número: como con esos valores las
   tres aserciones del `it.fails` PASABAN, el test daba «Expect test to fail» y
   **`@anima/mind` estaba ROJO en el traspaso**, que decía «exit 0, 2410 tests».
   → **REGLA: una tabla de dos filas donde la segunda dice «HOY» hay que volver a
   correrla antes de publicarla.** La primera fila es historia y no se puede
   verificar; la segunda es una medición y sí. Y su corolario, que este proyecto ya
   tenía escrito y volvió a costar caro: **el verde se corre entero y se corre al
   final**, no se deduce de los paquetes que uno tocó.
18. **«El criterio (4) `ticksPerdidos === 0` sigue reportado como CUMPLE y ya no vale»**
   — VERIFICADO, y la condición ya está escrita en el test y en la tabla. La partida
   del criterio termina con **109 cuerpos**: no recorre mundo, así que su cero es
   real y no es general. Una criatura que camina derecho deja 23.353 cuerpos a los
   10.000 ticks y el tick pasa a 74 ms contra una ventana de 50, o sea que cruza
   ADENTRO de los 20.000. El mecanismo —la población sólo sube, ningún cuerpo se
   retira jamás— está afirmado **sin cronómetro** en
   `world/tests/ataque-a-las-sueltas.test.ts`, bloque (4).
   → **REGLA: un cero medido es un cero DE ESA CORRIDA.** Antes de publicarlo como
   criterio, medí también la variable que lo hace verdadero (acá: cuántos cuerpos
   tenía el mundo) y publicala al lado.
19. **«La reparación de la celda ocupada no toca el criterio del Hito 3»** — falso, y lo
   decía el comentario de `abrirChunk`, no un agente. El hash del que habla el
   documento es `hashWorld` y los mismos dos puntos visitados en los dos órdenes daban
   `2f63c2f9eabd29b6` contra `a4fc2879124b0d36`. Reparado (ADR II-0014).
   → **REGLA (la misma del número 7, cobrada por segunda vez): volvé al texto que lo
   pidió.** Un comentario que declara el precio de su decisión y en el mismo párrafo
   explica por qué el precio no cuenta es exactamente donde hay que mirar.
20. **«Un control que da cero»**, mío y del adversario, las dos veces: el primero midió
   0 violaciones de conservación caminando al ESTE, donde esa semilla no tiene un solo
   pozo. El cero era de que no había qué medir.
   → **REGLA: un control que da cero hay que probarlo primero contra el caso
   positivo.** Está puesto en el propio test: el bloque 5 de
   `world/tests/ataque-a-las-sueltas.test.ts` corre la misma caminata con el guardián
   CIEGO a `decreta` y saca las 96 y las 21 de antes, para que el 0 y el 0 de al lado
   signifiquen algo.

### Los cinco del tramo L, y tres son de un archivo que nadie había corrido entero

21. **«El control con el tanque lleno llega al 81,0% del presupuesto»** — sobre las
   VEINTE partidas es **66,2%**. El 81,0% era de las TRES de la muestra corta y se
   citó como si fuera el del banco; viajó al encabezado de
   `juez/tests/hito-5-la-emergencia.test.ts` y al traspaso. Medido con
   `ANIMA_BANCO=1`: 264.776 de 400.000 ticks.
   → **REGLA: un porcentaje de la muestra corta no se cita como el del banco.**
22. **`@anima/juez` estaba ROJO con `ANIMA_BANCO=1` y el traspaso lo publicaba como
   el veredicto del criterio.** La aserción era `vividos / presupuesto > 0,9`, salida
   de aquel 81,0%, y vive detrás de `if (!MIDIENDO_EN_SERIO) return`: la suite normal
   corre TRES partidas y nunca la evalúa. Medido sobre el árbol de HEAD, o sea ANTES
   del tramo L: **65,338%**. No era una regresión de la poda —con la poda da 66,194%,
   0,86 puntos mejor— y ya fallaba de antes. Es el segundo «exit 0 sobre un árbol
   rojo» del proyecto, después del número 17.
   → **REGLA: una aserción detrás de un `env` hay que correrla CON el `env` puesto
   antes de escribirla, y el veredicto de un criterio no se publica sin mirar el
   exit code de la corrida que lo produjo.**
23. **«El bucle del `ir` lo arregló `mientrasTantoYaHecho`»** — lo arreglan DOS capas
   y cada una sola se come el 99,6%. Ablación sobre la orilla del criterio, tanque
   310: las dos apagadas **6045** `ir` (murió en el 6171), sólo el cerrojo **2**
   (3743), sólo la poda de `@anima/plan` **22** (3686), las dos **1** (3802).
   → **REGLA: cuando dos arreglos tapan el mismo bug, apagá uno por vez antes de
   atribuir.** La atribución vivió un tramo entero en un comentario sin medirse.
24. **«El portón de despegue de la mente corta el bucle»** — en las corridas del
   criterio `EstadoDeLaEscalera.salteados` mide **CERO**: no dispara ni una vez,
   porque la poda de `@anima/plan` llega antes. Sirve para lo que la poda no ve (un
   paso que D0 devolvió a la cola, los pasos sueltos de D2/D3) y eso está probado en
   `mind/tests/el-no-op-con-cara-de-progreso.test.ts`, no en la partida.
   → **REGLA: un contador de telemetría en cero es un resultado y hay que
   publicarlo.** Sin él, «el portón sirve» se habría deducido de que la criatura
   vivió 59 ticks más.

25. **«Con el tanque lleno el juez sigue diciendo 0 de 9: multiplicar por cuatro el
   tiempo vivido no movió una sola fila»** — sobre las VEINTE partidas el control
   mide **2 de 9**: `no-frotar-lo-que-no-alcanza-a-encender` 4/20 (1ª vez en el tick
   45) y `comerla-en-el-pico-de-calorias` 4/20 (tick 181), y la corrida pasa de 6 sin
   medir a **3**, o sea de NO INTERPRETABLE a interpretable. El 0 de 9 publicado era
   de las TRES partidas de la muestra corta. **Y no lo trajo ningún arreglo**: se
   corrió el mismo banco sobre el árbol de HEAD y sobre el del tramo L y las dos
   tablas salen renglón por renglón idénticas. Es la conclusión más cara que se
   corrigió acá, porque decía que la muerte temprana no era la causa y **sí lo es en
   parte**: con un fuego encendido, dos de las nueve secuencias emergentes salen
   solas.
   → **REGLA: que el arnés ya imprima la conclusión correcta no sirve de nada si
   nadie corre el archivo entero.** Este banco venía imprimiendo «⇒ el tiempo vivido
   SÍ mueve la aguja» mientras el comentario de arriba decía lo contrario. Un
   veredicto se lee de la corrida, no del comentario que la describe.

### Los cinco del tramo M, y dos son míos

26. **«La razón costo/devuelve del fuego es PLANA a cualquier escala, así que no hay
   tamaño de fuego que cierre la cuenta»** — la medición es correcta y la conclusión
   sólo vale para lo que ese barrido hace: **cada fila de esa tabla enciende SU fuego
   frotando**. Por eso es plana —el costo va con la masa y lo que el fuego cocina
   también— y por eso deja de serlo cuando el numerador se paga UNA vez. Medido en
   `world/tests/la-escalera-de-la-yesca.test.ts`: una vara de 0,5 kg frotada (692,1)
   prende 1 kg de yesca, la yesca prende un leño de 8 kg que frotado habría costado
   11.074, el leño arde 402 s y cocina 42 piezas → **neto +160,9**, y es un piso
   porque se cocinó de a una pieza.
   → **REGLA: cuando todas las filas de un barrido dan lo mismo, mirá qué está FIJO
   en todas las filas.** Lo que no varía es lo que hay que atacar, y no está en la
   columna que uno barrió.
27. **«`STAMINA_POR_CALORIA` es una de las dos palancas de calibración»** — tiene
   techo, y es de **1,0526×** (+5,3%) contra el 1,62× que haría falta. El invariante
   de conservación exige `acreditado <= gastado` en el `convierte` de comer, y la
   razón entre esos dos números **ES la digestibilidad** (tope 0,95). Medido con
   control positivo en `world/tests/el-techo-de-stamina-por-caloria.test.ts`: 110
   sobre 100 dispara `conversion-sin-respaldo`, 95 sobre 100 no. La palanca gemela
   —el `nutrition` del catálogo— sí se puede girar, porque está en los DOS lados de
   la cuenta y no mueve la razón.
   → **REGLA: antes de ofrecer una constante como palanca, medí contra qué guardián
   choca.** Las dos palancas «de calibración» de la cocción estaban cerradas por el
   mismo tipo de regla: no inventar energía.
28. **«La ventana de `COSTO_VIVIR_POR_SEGUNDO` es (0 ; 0,364)»** — tiene un SEGUNDO
   borde y estaba sin escribir: **0,310**, que sale de otro criterio del Hito 5
   (abajo de ahí, el tanque de arranque de 310 alcanza para los 20.000 ticks
   **quieta**, y el criterio (2) se cumpliría sin comer una sola vez). La ventana es
   `(0,3100 ; 0,3637)`, de 1,17× de ancho, y está publicada en el bloque «LA VENTANA
   ENTERA» de `oracle/tests/presupuesto.test.ts`.
   → **REGLA: una ventana con un borde medido y el otro supuesto no es una ventana.**
   Un cero de borde hay que ganárselo igual que cualquier otro número.
29. **MÍO, y del peor tipo: le advertí al usuario que bajar `COSTO_VIVIR_POR_SEGUNDO`
   rompería «comer crudo negativo»**, citando la ventana `0,766–1,155` del comentario
   de `world/src/step.ts`. Esa ventana estaba **VENCIDA desde el ADR II-0013**: con el
   veneno cobrado al tragar, comer crudo pasó a ser un EGRESO y su borde cayó a
   −0,488/s, o sea que ningún precio positivo de vivir lo salva. El propio arnés lo
   decía en la línea que yo no leí: «camino 2 · **ABIERTO desde el ADR II-0013**».
   → **REGLA: el comentario que justifica una constante envejece con cada ADR que
   toca su modelo.** Antes de citarlo como vigente, corré el arnés que lo mide. Es la
   tercera vez que este proyecto cobra la misma regla (números 7 y 19).
30. **«Bajar el costo de vivir 2,94× tiene que estirar la vida 2,94×»** — la estira
   **1,64×**: la criatura pasa de morir en el 3802 a morir en el **6244** de 20.000,
   con 0 bocados. El motivo lo dice el propio diagnóstico del arnés: gasta
   **0,04918/tick contra 0,017 de sólo estar viva**, o sea 2,89×, y la diferencia son
   las patas. `COSTO_POR_CELDA` no se movió, así que al abaratar vivir, **caminar
   pasó a ser el 65% del gasto**.
   → **REGLA: cuando bajás un término de una suma, el que manda pasa a ser otro.**
   Remedí la COMPOSICIÓN del gasto y no sólo el total, o la próxima palanca se elige
   contra el término que ya no decide.

31. **«El control con el tanque lleno vive más de 3× lo que la canónica»** — esa
   guarda dejó de ser exigente para pasar a ser **matemáticamente imposible** cuando
   bajó el costo de vivir. Medido con `ANIMA_BANCO=1`: la canónica vive
   **151.537/400.000 ticks = 37,884%** y muere en las 20 partidas; el tanque lleno
   vive **365.510/400.000 = 91,377%** y muere en 5. El cociente es **2,412×**, y aun
   un control perfecto censurado en el 100% sólo podría dar **2,640×**. No se bajó
   el 3: el bloque ahora afirma el mecanismo pareado por semilla —mismas veinte
   semillas, sin duplicados, y una ventana de observación posterior a cada muerte
   canónica—, que dio **20 de 20**. El juez sigue moviéndose de **0 de 9 a 2 de 9**.
   Verificado mirando el exit code de la corrida seria: **121/121, exit 0**.
   → **REGLA: un control censurado puede perder resolución aunque ambos grupos
   mejoren.** Antes de bajar un cociente histórico, calculá su máximo posible dentro
   del horizonte; si el umbral ya es inalcanzable, afirmá el mecanismo que el
   experimento necesitaba. Y si la intervención también cambia la política —acá el
   aliento altera la energía que ve D3 desde el tick cero— no publiques causalidad
   pura: «LA MUERTE» queda como nombre operativo de la casilla, no como prueba.

32. **«El dios pone la materia de la escalera en 6 de 20 semillas; sólo falta
   encontrar atador para unir unas 13 yesquitas»** — la suma bruta sí da 6/20, pero
   el cuerpo supuesto no existe bajo las cotas actuales. `union` aplana el ensamble,
   `MAX_PARTS` vale 6 y la séptima pieza se rechaza: las seis piezas más grandes de
   yesca suman apenas **0,449; 0,423; 0,416; 0,417; 0,450 y 0,424 kg**, contra el
   kilo que recién prende madera. El atador directo
   (`flexibility >= 0,8 && tensile >= 0,3`) además aparece en **1 de esas 6
   semillas**: seis juncos en 20260730; las otras cinco tienen cero en los nueve
   chunks del arranque. En esa única semilla, cuatro atadores recién entran a radio
   Chebyshev 16, el quinto a 29 y el sexto a 31; harían falta siete para armar top6
   de yesca y top3 de madera. Medido y afirmado con `unir` real en los bloques 6 y 7
   de `world/tests/la-escalera-de-la-yesca.test.ts`.
   → **REGLA: sumar inventario no prueba construibilidad.** Antes de llamar
   «disponible» a una materia repartida, ejecutá la ley que debe ensamblarla contra
   sus cotas, contá también los consumibles y publicá la distancia que cuesta
   conseguirlos.
   → **Y la conclusión que sacó está corregida en el 33: el fardo no era de una
   sola sustancia.** La regla de arriba sigue valiendo entera.

33. **«Todavía no hay una escalera construible con el inventario decretado»** — la
   hay, y en 8 de 20 semillas. El error fue buscar el cuerpo de UNA sustancia: como
   el kilo de yesca no entra en seis partes, se dio por cerrada la puerta. Pero las
   dos mitades de la cuenta se compran por separado, y eso es lo que un fardo MIXTO
   aprovecha:
   - lo que un cuerpo encendido ENTREGA sale de `fuelEnergy · masa` sumado sobre las
     partes (`emitsPower` es extensiva), o sea que la corteza —piezas de 0,45 kg
     contra 0,077 de la yesca— es la que trae la masa;
   - lo que hace falta para PRENDERLO es su `ignitionPoint`, y en un cuerpo de varias
     partes sale **promediado por masa** (medido exacto: 4 hojas secas de 180 más 2
     cortezas de 250 dan 232,47);
   - así que la yesca baja el punto de ignición y la corteza sube la potencia, y el
     fardo entra en seis partes.

   Medido y corrido en el mundo (semilla 20260730,
   `world/tests/la-escalera-construible.test.ts`): **4×hoja-seca + 2×corteza = 6
   partes, 1,214 kg**, armado con `unir` de verdad; una vara de **0,6213 kg** lo
   prende en el tick 22 y el fardo prende el **leño de 2,904 kg** decretado en el
   tick 13. Frotar ese leño habría costado **4020,0** contra los **860,1** que se
   pagaron: **4,67× más barato**. Lo que frena la escalera no es `MAX_PARTS`: son los
   atadores, que aparecen en **7 de 20** semillas (junco×15, liana×117 — la liana no
   estaba en la medición anterior, que miró sólo seis semillas) y alcanzan para armar
   el fardo en **2 de 20**.
   → **REGLA: cuando una cota bloquea un cuerpo, probá la MEZCLA antes de declarar
   la puerta cerrada.** Si las cualidades que la receta necesita se agregan distinto
   —una por suma y otra por promedio—, hay combinaciones que ninguna sustancia sola
   alcanza.

34. **«Cocinar es la única puerta a la comida que la escena ofrece»** — la frase es
   del DECRETO y estaba escrita como si fuera del MUNDO, y la diferencia decide qué
   se puede cambiar sin tocar una constante. La cuenta que la mente usa (`mordidaDe`)
   no compara `toxicity` contra un umbral, compara un neto, y como `calories` es
   extensiva la masa sale de factor común: **comer crudo conviene o no por SUSTANCIA**
   (`calorías/kg > toxicidad · 25`), y lo único que la masa decide es cuánto se gana o
   se pierde. Barrido el catálogo entero
   (`world/tests/hay-comida-sin-fuego.test.ts`): de las 15 sustancias con calorías
   hay **tres que sí pagan crudas —huevo (5,5 contra 2,5), médula (9,9 contra 1,25) y
   grasa (15,4 contra 1,25)—** y el dios **no siembra ninguna de las tres** en los
   nueve chunks del arranque; lo que decreta con calorías es grano, hoja, molusco,
   pescado, raíz-dura y tubérculo, y las seis dan negativo. El grano es el que menos
   pierde: −0,03, con el veneno llevándose 2,56× lo que las calorías acreditan.
   → **REGLA: antes de aceptar una premisa del proyecto, fijate si es del catálogo o
   del decreto.** Las dos se enuncian igual («el mundo no tiene X») y sólo una se
   arregla sin discutir constantes.

35. **«`explorar` camina un ciclo cerrado de 8 celdas; arreglarlo es de una línea»** —
   la reparación es de una línea y ANDA, y aun así **se revirtió**, porque lo que
   destapó vale más que ella. Van tres cosas.

   **(1) La reparación obvia repite el bug con otra cara.** El hueco pedía «que el
   rumbo tenga PERSISTENCIA», y escrito de la forma directa —
   `huellaDeTexto(`${id}#${bloque}`) % 8`— **vuelve a sumar (0,0)**: FNV-1a termina
   en `h = (h ^ c) · primo`, así que cambiar sólo el último carácter por los dígitos
   0..7 deja los tres bits BAJOS recorriendo una permutación de 0..7, y ocho bloques
   consecutivos dan otra vez los ocho rumbos. Se barrieron 403 actores antes de
   escribir una línea de `src` y se vio en que **los 403 daban el mismo número**.
   → **REGLA: los bits bajos de un hash sobre sufijos consecutivos no son azar, son
   una cuenta.** Si vas a usar un hash como dado, revolvé y leé los bits altos —y
   barré la población antes de creerle, que una dispersión de cero se ve a simple
   vista.

   **(2) Con la avalancha y un rumbo que dura 16 ticks, anda:** de 3 celdas de
   distancia y **8 distintas** en 100 ticks a **44 y 96**. Y sólo movió el TERCERO
   de los cuatro hashes del Hito 2 —el estado tras diez ticks—, que es la firma
   correcta: cambió la conducta, no el mundo inicial, ni el catálogo, ni las
   intenciones.

   **(3) Y ROMPE DOS LOGROS, así que se revirtió.** En `@anima/mind`: el
   diagnóstico 10 —«con el tanque lleno y leña seca cocina, come y llega viva a los
   20.000»— pasa a **morir en el tick 9482**, y la contraprueba del eslabón regalado
   pasa a morir en el **18.971**; más cuatro clavados. Y **no es que explorar se haya
   encarecido**: `intencionExplorar` cobra `COSTO_POR_CELDA` lo mismo dando vueltas
   que caminando derecho. Lo que aparece es **el viaje de vuelta** — la criatura se
   va lejos y tiene que volver a su pozo y a su fuego: `ir(pozo:-12:-3)` se repite
   **31 veces** donde la guarda permite menos de 10.
   → **REGLA: un bug que «no hace nada» puede estar sosteniendo un resultado.** El
   ciclo cerrado no era gratis: era un ANCLA que mantenía a la criatura al lado de
   sus cosas. Antes de arreglar algo que parece inerte, preguntate qué se apoya en
   que no funcione. Y el arreglo de verdad no es del mundo: es que la mente no
   explore cuando tiene una meta al alcance.

   **(4) RESUELTO EN DOS MITADES, mente primero y mundo después.** El ancla es hoy
   una decisión de la escalera (`hayAncla` + el cerrojo `yaDeambulePor` en
   `mind/src/escalera.ts`): con comida o un fuego a la vista y sin meta en curso,
   el fondo espera; con meta en curso deambula UNA vez por meta —es la herramienta
   que desbloquea un gap— y si esa vuelta no cambió la respuesta, espera. El
   cerrojo se limpia cuando un paso de plan aterriza bien (el mundo se movió), y
   NO con los aterrizajes de fondo: el esperar anclado aterriza bien cada 8 ticks
   y limpiarlo con eso re-armaría el paseo. **Sin el cerrojo el ancla no salvaba
   nada, medido: el diagnóstico 10 moría en el 9482 igual**, porque después del
   primer bocado la meta vive casi siempre.

   Con las dos mitades puestas, lo que se movió (todo medido, `mind` 307/307):
   - el diagnóstico 10 y la contraprueba del eslabón regalado **vuelven a llegar
     vivas**, y la escena buena con tres manos pasa de morir en el 5744 a
     **cumplir el criterio (2)** con 116,7 de aliento de sobra — la primera vez
     con la cadena de verdad. La no-monotonía de las manos quedó más cruda:
     viva contra muerta en el 361;
   - la pendiente del gasto cayó de 2,89× a **1,02×** el costo de vivir (el
     paseo ERA el 65% del gasto), y el piso de D1 del banco de la escalera pasó
     de 69,4% —un `it.fails` que nadie ablandó— a **85,9%**;
   - `explorar` cierra su contrato: 44 celdas de distancia y 96 distintas en
     100 ticks (era 3 y 8), y las 15 innatas quedan 15/15;
   - y el diag 7 cambió de signo: caminar derecho TRAE madera a la vista (2
     sueltas en el piso a los 400 ticks donde antes quedaba 0).

36. **«De los 30,9 ms del p99, 20,3 son las criaturas moviéndose: la copia de
   `bodies`/`actors`/`cells` de `abrir`, el reordenamiento de `cerrar`, un objeto
   nuevo por cuerpo tocado»** — falso, y por 10×. Medido por ablación, cortando el
   recorrido de leyes con una variable de entorno y volviendo a correr el mismo
   barrido (p50): completo 9,60 / 21,65; sin `paso()` 0,57 / 2,48; sin leyes ni
   entorno 0,38 / 2,23. O sea que **`paso()` es el 89–94% del tick** y todo lo
   demás junto —las tres copias, el camino de intenciones entero, `cerrar`— son
   2,2 ms de 21,6. El párrafo viejo mandaba a optimizar justo lo que no se puede
   ganar: las copias de mapas no bajarían el p99 ni un 10%.
   → **REGLA: una atribución de costo es una MEDICIÓN, no una lectura del código.**
   Restar dos corridas (con y sin la parte sospechada) cuesta diez minutos y es la
   única forma de saber. Un párrafo que reparte milisegundos por inspección tiene
   la misma pinta que uno medido y puede estar diez veces mal.

   Y de perseguir ese número salieron dos cosas más, las dos escritas donde
   corresponde: **cambian 5000 de 5000 cuerpos los 120 ticks** —no es un defecto,
   es que el banco mide el TRANSITORIO: los cuerpos relajan hacia el ambiente y
   una piedra tarda 59 ticks en quedarse quieta de verdad—, y **`conCualidad`
   devolvía un `Body` nuevo aunque escribiera el valor que ya estaba**, con lo
   cual un mundo en equilibrio se recreaba entero cada tick y todos los atajos por
   identidad del motor (`r.body !== c.body`, `yaMirados`, `tagsDe`) quedaban en
   cero sin que nada se pusiera rojo. Reparado con una guarda exacta y afirmado en
   `physics/tests/el-cuerpo-quieto-sigue-siendo-el-mismo.test.ts`.

**Y lo que el adversario SÍ acertó y está reparado o escrito:** el determinismo (19),
el solapamiento del banco contra una suelta (2 de 20 → 0 de 20), la conservación
apagada (96 y 21 → 0 y 0), la pérdida muda de una suelta (ahora hay evento
`perdida`), la condición del criterio (4) (18), y la contraprueba de la despensa, que
se dio vuelta de verdad: **come 68 y muere en el 12.847** (66 y 12.031 antes del tramo L).

---
