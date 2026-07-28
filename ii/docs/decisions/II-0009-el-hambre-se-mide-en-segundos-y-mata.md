# ADR II-0009 — El hambre se mide en segundos, y mata

Fecha: 2026-07-27 · Estado: aceptado · Termina la migración del
[ADR II-0008](II-0008-el-tiempo-del-mundo-se-mide-en-segundos.md) para la única
tasa que quedó afuera, y calibra el riesgo 4 del documento de arquitectura.

## Contexto

Tres cosas, que son la misma cosa mirada desde tres lados.

### (a) Vivir se cobra por muestra

El ADR II-0008 pasó todas las tasas del mundo a segundos y dejó una atrás.
`sistemaMetabolismo` (`world/src/step.ts:1552`) resta `COSTO_VIVIR` **por tick**,
sin pasar por `porPaso(…, d.dt)` — la conversión que `aplicarEfectos` sí hace
veinte líneas más arriba, en el mismo archivo. Medido en
`world/tests/el-tiempo-no-depende-del-tick.test.ts`, con su `it.fails` puesto:

| | 10 Hz | 20 Hz | 100 Hz |
|---|---|---|---|
| stamina que cuesta vivir diez segundos de mundo | 1,0 | 2,0 | **10,0** |

O sea que **la frecuencia calibra el hambre**. Subir el muestreo porque el render
se ve entrecortado hace que la criatura se quede sin fuerzas cinco veces antes.
Es exactamente lo que el ADR II-0007 prohíbe con todas las letras.

### (b) La calibración está floja, y está medida

El riesgo 4 pide «un test económico de 100 partidas de 20.000 ticks donde la
energía neta acumulada de la criatura tiene que ser **negativa sin trabajo**».
El test existe (`oracle/tests/presupuesto.test.ts`), corre a la escala pedida, y
da lo contrario, con el `it.fails` en la línea 610:

| por partida (1000 s de mundo) | ingreso | costo | neto |
|---|---|---|---|
| afortunada (dado perfecto, pozo al máximo) | 4042,3 | 243,6 | **+3798,7** |
| común (el arroyo de los otros tests) | 594,1 | 200,0 | **+394,1** |

El techo calórico **no** es lo que falla: 314 chunks cobrados en las doscientas
partidas, el más exprimido al 100,00% de su techo, ninguno por encima. Lo que
falla es la perilla: un chunk acuático da del orden de 1800 calorías y vivir los
1000 segundos cuesta 200. **Un solo chunk paga nueve vidas.**

El punto de equilibrio está medido: `COSTO_VIVIR` tendría que ser **3,8× más
caro** para hundir a la común y **20,2×** para hundir a la afortunada.

> **Corrección — ninguna de esas dos criaturas contesta el riesgo 4.** Las dos
> **trabajan**: pescan con una caña, y la común saca 98 piezas por partida. El
> criterio dice «sin trabajo», y hasta este tramo no lo medía nadie: el `it` que
> se llamaba así le daba una caña a la criatura. El test que sí lo mide está
> abajo, en las consecuencias, con su número.

### (c) Y no hay muerte

Con `stamina` en 0, `sistemaMetabolismo` hace `if (s <= 0) continue` y la
criatura se queda quieta para siempre: no puede caminar —`cobrarStamina`
devuelve `false` y sale un `'sin-fuerza'`— y no puede hacer nada más. El evento
`murio` sólo lo emite `eat`.

Entonces **«sobrevive 20.000 ticks sola», el criterio del Hito 5, hoy es
trivialmente verdadero**: mide que el proceso no se cuelgue, no que la criatura
resuelva su hambre. Una piedra lo cumple.

## Decisión

### 1. Vivir es una tasa por segundo. Caminar no es una tasa

```ts
/** Lo que cuesta estar vivo UN SEGUNDO DE MUNDO, hambre incluida. */
export const COSTO_VIVIR_POR_SEGUNDO = 1.0

/** Lo que cuesta entrar en UNA CELDA. No es una tasa: no se divide por nada. */
export const COSTO_POR_CELDA = 0.05
```

`sistemaMetabolismo` pasa a restar `porPaso(COSTO_VIVIR_POR_SEGUNDO, d.dt)`, que
es la misma y única conversión entre el ritmo del mundo y el muestreo del tick.

**Los nombres viejos se borran, sin alias.** `presupuesto.test.ts:743` tiene un
guardián que lee el archivo con un regex sobre `export const COSTO_VIVIR = …` y
lanza «`COSTO_VIVIR` ya no está: el modelo económico de este test quedó viejo».
Que la renombrada haga saltar ese guardián no es un daño colateral: es el
guardián funcionando, y el motivo por el que no se deja un alias.

**Y `COSTO_PASO` no era una tasa.** El enunciado de que «las dos constantes son
tasas por muestra» es medio falso, y la medición está en el mismo archivo de
huecos: caminar diez celdas cuesta **exactamente** `10 × (COSTO_PASO +
COSTO_VIVIR)` a las cinco frecuencias admisibles. El precio por celda ya es
independiente de la frecuencia — sus unidades son stamina **por celda**, no por
segundo. Dividirlo por la frecuencia haría que el mismo viaje de diez celdas
saliera 5× más barato a 100 Hz que a 20, que es el mismo bug al revés.

Lo que sí se mide en muestras es la **velocidad**: `intencionCaminar` avanza una
celda por tick, así que la criatura camina a 20 celdas por segundo a 20 Hz y a
100 a 100 Hz. Eso es el hueco 2, es **locomoción y no metabolismo**, y cerrarlo
pide una velocidad en celdas por segundo con un resto sub-celda acumulado en el
actor — o sea un campo nuevo en `Actor`, o sea un hash nuevo. Merece su propio
ADR y no se decide acá.

### 2. `COSTO_VIVIR_POR_SEGUNDO = 1,0`, y la criatura llega con 500

Son **5×** lo de hoy (0,01 × 20 Hz = 0,20 por segundo). La ventana está medida
sobre las cien partidas comunes, no sobre el promedio:

| | por segundo |
|---|---|
| lo que rinde comiendo **crudo** la partida que MÁS comió | 0,766 |
| **el número elegido** | **1,000** |
| lo que rinde **cocinando** la partida que MENOS comió | 1,155 |

Adentro de esa ventana —y sólo adentro— pasan las dos cosas a la vez, en las
cien partidas y no en la mediana: **comer crudo da neto negativo y cocinar da
neto positivo.** La ventana entera mide 1,51× de ancho, así que el número no
tiene lugar para pasearse.

> **Corrección — esa ventana es un CONJUNTO VACÍO.** El borde de arriba se midió
> con un modelo en el que **cocinar era gratis**: la misma pieza con
> `digestibility` al techo y nada más, sin fuego, sin vara y sin precio. Cuando
> este ADR se escribió eso era inofensivo, porque el fuego duraba un tick y
> cocinar no se podía de ninguna manera. Desde el
> [ADR II-0011](II-0011-arder-libera-calor.md) el fuego dura, cocinar es una cosa
> que pasa de verdad y **tiene precio**: el más barato que además COCINA sale
> **659,86 de stamina**, despejado de la física en `oracle/tests/presupuesto.test.ts`
> (bloque 5) y medido corriendo el mundo en `perceive/tests/ataque-a-la-costura.test.ts`.
> Con ese precio adentro, los tres bordes quedan así:
>
> | | por segundo |
> |---|---|
> | borde de ABAJO: lo que rinde comiendo **crudo** la partida que MÁS comió | **0,766** |
> | borde de ARRIBA **si cocinar fuera gratis**, que es como se midió acá | 1,155 |
> | borde de ARRIBA **de verdad**, con el fuego adentro | **0,495** |
>
> `0,495 < 0,766`, o sea que **los dos bordes se cruzan**: para que cocinar
> alcance, vivir tendría que costar menos de lo que ya le alcanza al que come
> crudo. No existe ningún valor de `COSTO_VIVIR_POR_SEGUNDO` que cumpla las dos
> mitades — bajarlo hasta que cocinar salve apaga el motor de la historia, porque
> ahí comer crudo también salva.
>
> Y el borde de arriba **está cerrado por arriba y no se puede empujar**: para que
> el fuego entrara en la holgura de la partida más flaca (155,2) haría falta
> eficiencia **1,51** en el `poweredBy` de `friccion`, que es una máquina de
> movimiento perpetuo. Ni con eficiencia 1,00 entra: el fuego costaría 232,51. Y
> la masa de la vara tampoco se puede bajar, porque abajo de 0,47 kg el fuego
> enciende y **no cocina**.
>
> **Lo que sí queda en pie, medido, y es lo que este ADR afirma ahora:** el
> criterio del riesgo 4 se cumple (abajo, con su número), y **cocinar se paga
> solo**: con el fuego cobrado entero de un bolsillo solo, cocinar rinde **+33,3
> en la partida más flaca de las cien**, o sea 1,05× lo que costó. Es una MEJORA
> fuerte, no una condición de supervivencia. El test que lo afirma es
> `COCINAR CONVIENE EN LAS CIEN, aunque el fuego se pague entero de un bolsillo solo`.
>
> Se corrige en vez de borrarse por el mismo motivo que la otra corrección de este
> ADR: el argumento equivocado sigue vivo en la cabeza de quien lo lea. «El 1,0
> está adentro de una ventana angosta» es una frase que suena a rigor y que acá
> haría defender un intervalo que no tiene un solo punto adentro.

**Y la criatura arranca con la `stamina` a la mitad del techo del catálogo: 500
de 1000.** Es lo que ya usan `caminarDiezCeldas` y `vivirDiezSegundos`, deja la
mitad de arriba libre para que comer sirva desde el primer bocado —arrancar al
techo es tirar la primera comida— y hace que la resistencia al ayuno sea
exactamente la mitad del criterio.

**Qué mide el número, dicho explícitamente:**

- **`stamina` pasa a medirse en segundos de vida.** Mil de `stamina` son mil
  segundos de mundo. Un pescado crudo de 2 kg (`8 × 2 × 0,38` = 6,08) compra
  6 segundos; el mismo pescado cocinado (`8 × 2 × 0,95` = 15,2) compra 15.
- **Cuánto aguanta sin comer una criatura con la `stamina` de arranque:
  500 segundos de mundo**, o sea **10.000 ticks a 20 Hz**, o sea **la mitad
  exacta del criterio del Hito 5**. Medido en las cinco frecuencias admisibles:
  muere en el tick 5000 a 10 Hz, 10.000 a 20, 12.500 a 25, 25.001 a 50 y 50.001
  a 100 — 500,00 s a las tres primeras y 500,02 s a la peor, una dispersión de
  4·10⁻⁵ que es el residuo de punto flotante y nada más.
- **Cuántas veces tiene que comer en 20.000 ticks a 20 Hz.** Los 1000 segundos
  de la corrida cuestan 1000 de stamina y trae 500 puestos, así que tiene que
  sacarle al mundo **500: 83 pescados crudos de 2 kg, o 33 cocinados** — unos
  siete cocinados por día. Y para que el balance no dependa del tanque de
  arranque, que es el criterio del riesgo 4, el doble: **165 crudos o 66
  cocinados**.
- La partida común saca **98 piezas** en esos 1000 segundos. Crudas dan 594 y
  cocinadas 1485, contra un costo de 1000: **la partida mediana comiendo crudo
  termina en +96 y la peor en −38 —crudo es una moneda al aire— y cocinando
  llegan las cien, con entre 655 y 1415 de sobra.** La diferencia entre vivir y
  morirse es cocinar, y no está escrito en ningún lado: sale de `digestibility`.

  > **Corrección — «la diferencia entre vivir y morirse es cocinar» es falsa.**
  > Las 1485 cocinadas suponen que cocinar es gratis. Con el fuego cobrado —un
  > solo fuego por partida, 659,86 de encender, y la leña que hay que ir a juntar
  > medida sobre el mundo decretado— **91 de las 100 partidas comunes terminan
  > debiendo aunque cocinen todo lo que sacan**, y la más flaca debe 505,5. Es el
  > mismo 91 con leña gratis y con leña cobrada: la leña mueve el mínimo 0,9 de
  > stamina, así que **el problema no era la leña**. Cocinar sigue siendo lo mejor
  > que se puede hacer con la misma
  > materia —multiplica por **2,50×** lo que rinde, porque `digestibility` sube de
  > 0,38 a 0,95, y aun pagando el fuego entero deja **+33,3** en la partida más
  > flaca— pero eso es **una mejora que se paga sola, no una condición de
  > supervivencia**. Es una frase más chica y es la que está medida.
  >
  > Y lo que se pierde con ella conviene decirlo sin maquillar: **el fuego deja de
  > ser lo que salva.** Sigue valiendo por el carbón, la parrilla, secar y tres de
  > las diez secuencias de emergencia — pero eso es otra cosa que sobrevivir.
- **Y hay un número que hace que el 1,0 no parezca decretado.** A la frecuencia
  de referencia la criatura camina 20 celdas por segundo y cada celda cuesta
  0,05: **caminar cuesta exactamente 1,0 por segundo, lo mismo que vivir.**
  Andar sin parar duplica el gasto, y los 500 del arranque se van en 250
  segundos y 5000 celdas. Ninguna de las dos constantes se eligió mirando a la
  otra.

### 3. `stamina` 0 es la muerte. El actor se va, el cuerpo se queda

```
s ≤ 0  ⟹  la stamina queda en 0
          el actor sale de `actors`
          el cuerpo sigue en `bodies`, en su celda
          lo que tenía en la mano cae ahí mismo
          sale un `murio` con `por: 'hambre'`
```

- **El evento es barato.** `hashWorldState` hashea `tick, hz, nextId,
  hashPhysics, bodies, actors, cells`: los eventos no entran, así que sumar
  `'hambre'` a la unión `por: 'comido' | 'consumido'` no cuesta nada.
- **No lleva `by` ni `seq`, y está bien**: a este `murio` no lo causa ninguna
  intención. No reabre la discusión de correlacionar evento con intención.
- **Soltar lo que tenía en la mano no es opcional.** `invariants.ts:258` ya emite
  `referencia-colgada` cuando un `heldBy` nombra un actor que no está en el
  mapa. El invariante que hace falta ya estaba escrito antes que la muerte.
- **El journal no necesita nada nuevo.** Las intenciones posteriores del muerto
  se rechazan con `'actor-desconocido'`, que es un motivo que ya existe.
- **El cadáver es comida.** El cuerpo de la criatura es carne con `nutrition`, y
  queda donde cayó. La materia no se destruye y el bucle cierra solo: la que
  viene puede comerse a la que no llegó.
- **El legado no es de este ADR.** La mente no vive en `WorldState`. El mundo
  mata el cuerpo y emite el evento; qué hereda la próxima criatura lo decide la
  capa del legado, y lo único que este ADR le da es el disparador.

### 4. El reloj día/noche es DERIVADO, y el día dura 200 segundos

`WorldState` ya tiene `tick` y `hz` (`step.ts:161-184`). Los segundos absolutos
de mundo son `tick / hz`, así que **el `Clock` entero se deriva sin agregar un
solo campo al estado ni tocar el hash**:

```
ticksPorDia        = LARGO_DEL_DIA × hz          entero: los dos son enteros
tickDelDia         = tick % ticksPorDia
phase              = tickDelDia < ticksPorDia / 2 ? 'dia' : 'noche'
secondsToNightfall = max(0, ticksPorDia / 2 − tickDelDia) / hz
```

Todo entero hasta la última división —la misma disciplina de `sumarPaso`, que
acumula en micros enteros y divide una sola vez— y sin `Math` trascendente, así
que pasa el guardián de la regla 2 sin excepciones. `relojDe(state)` vive en un
archivo nuevo, `world/src/reloj.ts`, y devuelve la forma de `Clock` que declara
`skills/src/tipos.ts:255`. La dirección de dependencia lo permite y lo obliga:
`@anima/skills` depende de `@anima/world`, no al revés. Hasta hoy el único
proveedor de `Clock` era `skills/tests/mundito.ts:154`, que es un juguete.

**`LARGO_DEL_DIA = 200`**, mitad luz y mitad noche, y el tick 0 es el amanecer.
El número sale de tres cosas y no de un gusto:

1. **Tiene que ser un entero de segundos**, para que `LARGO_DEL_DIA × hz` sea
   entero a las cinco frecuencias admisibles (10, 20, 25, 50, 100) y toda la
   cuenta del reloj se haga con enteros.
2. **La luz tiene que alcanzar para lo más lento que se puede hacer, más de una
   vez.** Lo más lento del catálogo semilla es cocinar el cuero: **41 segundos**,
   medidos y ya independientes de la frecuencia (41,00 s a 10 Hz y 41,19 s a 100,
   en `physics/tests/el-tiempo-en-segundos.test.ts:114`). Cien segundos de luz
   entran dos cueros y sobra para ir y volver. Con menos, el día sería una
   interrupción; con mucho más, la noche dejaría de ser una restricción.
3. **Tiene que dividir el criterio.** 20.000 ticks a 20 Hz son 1000 segundos, o
   sea **exactamente cinco días**. «Sobrevive 20.000 ticks sola» pasa a decirse
   **«sobrevive cinco días»**, que es una frase que una persona sostiene en la
   cabeza sin hacer una cuenta.

## Por qué así y no de otra forma

**Se descartó el extremo de abajo, 3,8× (0,77 por segundo).** Es el punto de
equilibrio de la partida común que más comió, y suena bien hasta que se lo mira
contra el criterio que tiene que servir: a 0,77 por segundo, una criatura con 500
de `stamina` que **no hace absolutamente nada** aguanta 649 segundos y una con el
tanque al techo aguanta 1299 — más que los 1000 del criterio. O sea que
«sobrevive 20.000 ticks sola» seguiría siendo verdad para una piedra. Un
equilibrio del acumulado no es un criterio de supervivencia: la criatura llega
con un tanque, y el tanque paga la diferencia.

**Se descartó el extremo de arriba, 20,2× (4,04 por segundo).** Es el equilibrio
de la criatura «afortunada», que no es una criatura: es un **dado cargado**
—`SUERTE_PERFECTA`, 66.486 piezas en 66.600 intentos— sobre un pozo puesto en
`CAPACIDAD_MAXIMA` y `PER_MILLE_MAXIMO`. Calibrar contra ella es calibrar contra
un adversario, no contra un jugador, y el precio está medido: a 4,04 por segundo
la criatura común se muere en el **tick ~5.800 comiendo crudo** y en el **~7.800
cocinando**, con el mismo mundo y la misma caña. El criterio del Hito 5 pasaría
de trivialmente cierto a **imposible**, que es la misma clase de error con el
signo cambiado.

**Se descartó dejar `COSTO_VIVIR` por tick y compensar al cambiar la
frecuencia.** Es la alternativa que el ADR II-0008 ya descartó para las otras
doce leyes, por la misma razón: la conversión tiene que estar en un solo lugar, y
ese lugar es `porPaso`.

**Se descartó hacer de `COSTO_PASO` una tasa por segundo.** Está arriba, en la
decisión 1, con la medición: sus unidades son stamina por celda. Volverla por
segundo haría que un viaje de diez celdas costara cinco veces menos a 100 Hz.

**Se descartó que en `stamina` 0 no pase nada** —lo de hoy—. Además de dejar el
criterio del Hito 5 sin contenido, un actor congelado no es gratis: se queda en
`actors`, sigue costando su vuelta del tick, y se queda con la caña en la mano
para siempre. Un mundo viejo se llena de estatuas sosteniendo herramientas que
nadie puede volver a usar.

**Se descartó el desmayo reversible**, y por UNA razón y no por dos: **no tiene
salida.** Con `stamina` 0 la criatura no puede actuar, así que no puede comer
para volver. Sería morirse con pasos de más. Vuelve a estar sobre la mesa el día
que exista alguien capaz de alimentar a otro.

> **Corrección.** La primera versión de este ADR daba una segunda razón —«pide un
> campo nuevo en `Actor`, y el hash de **todos** los mundos cambia, incluidos
> aquellos en los que nadie se desmaya nunca»— y **es falsa**. `hashWorld` saltea
> las claves de valor `undefined` y cuenta las claves DESPUÉS de filtrarlas
> (`hash.ts:270-285`), con este comentario adelante: «un `{ a: 1, b: undefined }`
> tiene que hashear IGUAL que `{ a: 1 }` porque eso es lo que queda después de
> guardar la partida en JSON y volver a cargarla». O sea que **un campo OPCIONAL
> no mueve el hash de ningún mundo que no lo use**, y está verificado en
> `tests/espera.test.ts` con el campo `Actor.esperando`, que este mismo tramo
> agregó sin mover un bit.
>
> Se corrige en vez de borrarse porque el argumento equivocado sigue vivo en la
> cabeza de quien lo lea: «agregar un campo cuesta el hash» es una regla que
> parece prudente y que acá haría descartar diseños correctos. La regla verdadera
> es más chica: cuesta el hash el campo que se ESCRIBE, no el que se declara.

**Se descartó la deuda, o `stamina` negativa.** El catálogo declara
`range: [0, 1000]` y `conserved: true` (`physics/src/quality.ts:190-195`): lo
negativo no es representable, y hacerlo representable cambiaría el contrato de
una cualidad que leen otras diez cosas para modelar una idea que la muerte ya
modela mejor.

**Se descartó borrar también el cuerpo.** Destruye materia, que es lo contrario
de todo el proyecto, y encima tira la comida.

**Se descartó guardar el reloj en `WorldState`.** Un reloj guardado es una
segunda copia del tick, y dos copias del mismo hecho se desincronizan — es la
historia de `DSL_REFERENCE` en Ánima I y la razón por la que `presupuesto.test.ts`
tiene un guardián sobre tres constantes copiadas a mano. Un reloj derivado no
puede desincronizarse porque no hay de qué. Y las cuentas cierran del mismo lado:
guardarlo costaría tres campos en el estado, tres en el hash y tres en cada delta
de cada tick, **para no agregar un solo bit de información**; derivarlo cuesta
cero y sale ya hasheado, porque `tick` y `hz` están adentro del hash desde el
ADR II-0008.

## Consecuencias

**Buenas**

- El hambre deja de depender de la frecuencia: diez segundos de mundo cuestan
  10,0 de `stamina` a 10, 20, 25, 50 y 100 Hz. Se cierra el `it.fails` de
  `el-tiempo-no-depende-del-tick.test.ts:674`, y la promesa del ADR II-0007
  queda cumplida para lo único que de verdad mueve la historia.
- **El criterio del Hito 5 pasa a medir algo.** Una criatura que no hace
  absolutamente nada se muere en el tick 10.000 de los 20.000, y una que camina
  sin parar en el 5000. Sobrevivir obliga a la cadena entera del primer criterio:
  deshilachar, atar, ir al río, pescar — y a repetirla. *(Y la que camina buscando
  comida tirada muere entre el 5508 y el 7719, o sea que queda entre las dos: ver
  la tabla del riesgo 4 más abajo.)*
- **Cocinar deja de ser decoración.** Es la diferencia entre 594 y 1485 contra un
  costo de 1000, y nadie tuvo que escribir «cocinar rinde más»: sale de que
  `digestibility` sube de 0,38 a 0,95, que es 2,50×. *(El 2,50× es lo que sigue en
  pie. Que esa diferencia sea la que salva no: ver la corrección de arriba.)*
- **EL CRITERIO DEL RIESGO 4 SE CUMPLE, y ahora está medido por un test que mide
  eso.** *(Este punto lo agrega la corrección: el ADR original lo daba por cerrado
  con la partida común, que trabaja.)* Cien partidas de 20.000 ticks con una
  criatura que **no extrae nada** —sin caña, sin pozo, sin fuego y sin cocinar—,
  que camina y levanta lo que el mundo dejó tirado, que ve el anillo entero de una
  y nunca se equivoca de pieza:

  | sin trabajo, por partida (1000 s) | mínimo | mediana | máximo |
  |---|---|---|---|
  | piezas levantadas | 1580 | 2472,5 | 2978 |
  | ingreso, contra 1000 que cuesta SÓLO vivir | 104,3 | 434,8 | **529,2** |
  | **NETO** | −1803,1 | −1435,4 | **−1321,8** |
  | tick en el que se muere | 5508 | 7085,5 | 7719 |

  Las cien negativas, y por lejos: **aunque no se le cobrara una sola celda**, lo
  que junta en toda la partida (529,2 en el mejor caso) no llega a pagar lo que
  cuesta estar vivo. Y se muere **antes** que el que se queda quieto —a las 20
  celdas por segundo de hoy, caminar cuesta 1,0 por segundo, exactamente lo mismo
  que vivir, así que buscar comida tirada duplica el gasto y lo que encuentra no
  lo paga—. **El dios no es una fuente infinita: caminar de chunk en chunk
  comiendo lo que hay tirado no alcanza.**

  Y el techo calórico aguantó al mismo tiempo, sin tocarlo: **314 chunks cobrados
  en las doscientas partidas, el más exprimido al 100,00% de su techo, ninguno por
  encima.** Queda anotado que lo suelto **no pasa por `LibroCalorico`** —nadie se
  lo cobra a ningún chunk— y cuánto es eso: el carroñero se lleva por esa puerta
  el **0,063%** del presupuesto calórico de todo lo que barrió.
- La mitad común del riesgo 4 se cierra **medida**, y sin tocar el techo
  calórico, que ya funcionaba.
- `stamina` se vuelve legible de un vistazo: son segundos de vida. Cualquiera
  puede leer «este pescado da 15» y saber qué significa.
- El reloj día/noche aparece **sin agregar un campo al estado ni mover la forma
  del hash**, y `clock.secondsToNightfall` deja de ser un juguete:
  `innatas/esperar.ts:156` y `innatas/guarecerse.ts:114` ya lo leen y hasta hoy
  sólo tenían quien se los contestara en un test.

**A tener en cuenta**

- **La ventana es angosta: (0,766 ; 1,155), 1,51× de ancho.** Si alguien
  recalibra `digestibility`, la masa de una pieza o el pozo, la ventana se cierra
  y el 1,0 deja de servir. Por eso el criterio verificable que acompaña a este
  ADR **afirma la ventana y no el número**: neto crudo negativo en las 100
  partidas comunes y neto cocinado positivo en las 100. Un test que afirmara
  `COSTO_VIVIR_POR_SEGUNDO === 1` mediría su propia copia.

  > **Corrección — no es angosta: no existe.** Está arriba, con los tres bordes y
  > el porqué. Lo que el criterio verificable afirma ahora no es un intervalo sino
  > **dos hechos**: que sin trabajo el neto es negativo en las cien (el criterio
  > del riesgo 4, tabla de arriba) y que cocinar se paga solo (+33,3 en la más
  > flaca). Lo único que sobrevive del enunciado viejo es su última frase, y sigue
  > valiendo: un test que afirmara `COSTO_VIVIR_POR_SEGUNDO === 1` mediría su
  > propia copia, así que ninguno lo hace.
  >
  > **Y esto no es ablandar la vara**, que es lo que va a parecer dentro de tres
  > meses. La vara es la del documento de arquitectura —«la energía neta acumulada
  > de la criatura tiene que ser **negativa sin trabajo**»— y se cumple, y se
  > cumple más fuerte que antes: la criatura que no trabaja no llega ni a la mitad
  > de la partida. Lo que se corrige es una afirmación **distinta y más fuerte**
  > que este ADR inventó mientras calibraba una perilla, y que la aritmética del
  > fuego dejó sin conjunto solución. Las tres afirmaciones que sostienen la
  > imposibilidad viven como `it` verdes y no como `it.fails`, a propósito: un
  > `it.fails` que nadie va a cerrar es ruido, y una imposibilidad afirmada es un
  > guardián que se pone rojo el día que alguien mueva una constante y los bordes
  > se descrucen.
- **La otra mitad del riesgo 4 sigue abierta, y este ADR no la declara cerrada.**
  La afortunada termina en **+2787,5 en la peor de sus cien partidas** aun a 1,0
  por segundo, y en +3037,6 en la mejor: ni la más flaca se acerca a cero.
  *(Corregido contra la medición. La primera versión decía «+3037 en la peor», y
  ese número es el de la MEJOR: el rango 4036,9–4043,2 que citaba es el del
  ingreso crudo a secas, no el del ingreso menos la caminata, así que al restarle
  sólo el costo de vivir las celdas quedaban contadas cero veces — y la partida
  que más camina paga 249,6 de stamina que ese rango no ve. La conclusión no
  cambia y el número medido queda anotado adentro del `it.fails`.)* El `it.fails` de
  `presupuesto.test.ts:610` se parte en dos: la común cierra, la afortunada sigue
  abierta con su «POR QUÉ SIGUE ABIERTO» reescrito, porque lo que le falta **no
  es la perilla del metabolismo**. Es que en ese modelo **viajar no cuesta
  tiempo**: la afortunada camina hasta 4992 celdas entre orillas y `t` no avanza
  ni un segundo. A 20 Hz esas celdas son 250 de los 1000 segundos de la partida
  —un cuarto de su tiempo de pesca, más 250 de costo de vivir—, y cobrarlas es
  el hueco 2, no éste.
- **Caminar sigue midiéndose en ticks**, y ahora se puede decir con un número:
  con los 500 del arranque la criatura recorre **3334 celdas a 10 Hz y 8334 a 100**,
  2,5× de diferencia, porque el precio por celda es fijo pero el tiempo por celda
  no. La mitad (a) del problema queda cerrada para vivir y abierta para andar, y
  su `it.fails` se queda solo en ese archivo, que es exactamente donde tiene que
  estar hasta que exista el ADR de la locomoción.
- **Es la primera muerte del mundo.** Toca cosas que nunca vieron irse a un
  actor: `snapshot`, el journal, los deltas por ranura y, más adelante, el
  legado. El detector ya existe (`referencia-colgada`), así que un error va a
  salir como una infracción de invariante y no como un cuerpo invisible — pero
  hay que correr los invariantes en la partida larga y no sólo en los tests
  chicos.
- **Esto mueve la huella de conducta, y es un cambio de CONDUCTA, no de forma.**
  Al revés que el ADR II-0008, acá **no hay forma vieja que mapear de vuelta**:
  1,0 por segundo no es 0,01 por tick a ninguna frecuencia. La prueba de que
  salió bien no es que la huella no se mueva —se tiene que mover— sino que se
  mueva **por el motivo declarado**: `vivirDiezSegundos` pasa de `0,01 × hz × 10`
  a 10,0 en las cinco frecuencias, y ese único cambio explica todo el resto. Hay
  que decirlo fuerte para que nadie pierda una tarde buscando el mapeo.
- **`LARGO_DEL_DIA` y `COSTO_VIVIR_POR_SEGUNDO` no entran en ningún hash.**
  `hashPhysics` cubre el catálogo de la física; las constantes de `@anima/world`
  viajan con el build. Un guardado replayado contra otro build calibra distinto y
  el hash del tick 0 coincide igual. No es un problema que abra este ADR, pero
  este ADR suma dos constantes a esa pila y conviene que quede escrito.
- **`'consumido'` sigue declarado y sin emisor.** Esta decisión agrega `'hambre'`
  y no arregla ese motivo muerto; queda anotado para que la unión no se llene de
  valores que nadie emite.
- `world/src/reloj.ts` hace **12 fuentes** en el paquete. El guardián de la
  regla 2 (`ataque-determinismo.test.ts:294-343`) las lee del directorio, así que
  el archivo nuevo entra solo — pero su `toBeGreaterThanOrEqual(11)` hay que
  subirlo a 12, o deja de contar.
