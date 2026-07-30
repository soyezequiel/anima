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

| paquete | tarda |
|---|---:|
| `@anima/juez` | 488 s |
| `@anima/mind` | 101 s |
| `@anima/world` | 81 s |
| `@anima/perceive` | 40 s |
| `@anima/plan` | 22 s |
| `@anima/oracle` | 13 s |
| `@anima/physics` · `@anima/skills` | 9 s |

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
- **La calibración de la aritmética de comer NO se toca sin el usuario.** `eficiencia`
  de la fricción y `STAMINA_POR_CALORIA` son las dos palancas que darían vuelta el
  signo del criterio (2), y moverlas sería ablandar el criterio por cuenta propia.
  Está medido y presentado; falta decidir.
- **La UI va DESPUÉS del Hito 5.** Se preguntó y el usuario eligió terminar el
  criterio de corte primero.

---

## 5 · Los veinte números corregidos, y la regla que dejó cada uno

Esto es lo más caro de las sesiones anteriores y lo que más fácil se pierde. **Cinco
fueron conclusiones enteras que estaban mal y que ya habían viajado a
documentos.** Los cuatro últimos son del tramo K bis y están al final, del 17 al 20.

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

**Y lo que el adversario SÍ acertó y está reparado o escrito:** el determinismo (19),
el solapamiento del banco contra una suelta (2 de 20 → 0 de 20), la conservación
apagada (96 y 21 → 0 y 0), la pérdida muda de una suelta (ahora hay evento
`perdida`), la condición del criterio (4) (18), y la contraprueba de la despensa, que
se dio vuelta de verdad: **come 66 y muere en el 12.031**.

---
