# ADR II-0012 — El presupuesto del plan se mide en expansiones, no en milisegundos

Fecha: 2026-07-28 · Estado: aceptado · Reemplaza la firma
`plan(g, v, budgetMs: number)` y el presupuesto «8 ms» del peldaño D4 del
documento de arquitectura (`docs/architecture/remake-anima-ii.md`, líneas 774 y
834). Es el [ADR II-0008](II-0008-el-tiempo-del-mundo-se-mide-en-segundos.md)
aplicado a la mente: lo que es ritmo va en unidades del mundo, lo que es
rendimiento va en unidades de la máquina.

## Contexto

El documento le puso número al último peldaño de la escalera de decisión y le
puso firma a la función, y las dos cosas dicen milisegundos:

> | **D4** | `plan()` anytime sobre el grafo de procesos, frontera guardada entre ticks | 8 ms | |

```ts
export function plan(g: GoalNode, v: PerceptionView, budgetMs: number): PlanResult;
```

> Con el índice, `plan()` es una regresión ordinaria sobre un grafo con factor de
> ramificación acotado, y sí entra en 8 ms. Sin él, no entra en ningún
> presupuesto.

El párrafo tiene razón en lo que discute —el `SCHEMA_INDEX` es lo que acota la
ramificación, y sin él no hay presupuesto que alcance— y se equivoca en la
unidad. **`budgetMs` no se puede implementar adentro de `@anima/plan`**, y hay
dos razones que son independientes: aunque una se cayera, la otra sola alcanza.

**(a) Medirlo exige el reloj de la máquina.** Cortar a los 8 ms es leer
`performance.now()` adentro del bucle de expansión. La regla 2 lo prohíbe en
`src/` de todo paquete determinista, y no como estilo: el reloj es una entrada
que no está en la semilla.

**(b) Aunque se permitiera, el resultado dependería de la máquina.** Éste es el
que decide. `plan()` es *anytime*: cuando se le acaba el presupuesto devuelve
`parcial` con la frontera adentro, y el plan que sale depende de **dónde** cortó.
Con un corte por reloj, la misma partida con la misma semilla planifica distinto
en una laptop enchufada que en la misma laptop con el navegador cargado —no un
plan más lento, **otro plan**, con otros pasos— y de ahí para adelante las dos
partidas divergen. El determinismo del mundo se rompería por el planificador, que
es el último lugar donde uno lo iría a buscar: se depura la física, se depura el
punto fijo, se depura el orden de la percepción, y el bicho estaba en que la
máquina estaba ocupada.

## Decisión

**El presupuesto de `plan()` es un entero de EXPANSIONES.**

```ts
// packages/plan/src/tipos.ts
export const EXPANSIONES_POR_TICK = 64

// packages/plan/src/regresion.ts
export function plan(
  g: GoalNode,
  v: VistaDelPlan,
  presupuesto: number,      // ← expansiones, no milisegundos
  frontera?: Frontera,
  opciones?: OpcionesDePlan,
): PlanResult
```

Una expansión es sacar un nodo de la cola y mirarlo. El corte es **uniforme**: no
hay atajo antes del bucle, así que un presupuesto de cero devuelve `parcial`
incluso para una meta ya cumplida. Cuesta un test raro y compra que el número
signifique siempre lo mismo.

**El puente con los 8 ms de pared es un banco SEPARADO**, que mide cuántas
expansiones entran en 8 ms en esta máquina. Y la dirección del ajuste está fijada
de antemano, porque si no se negocia el día que moleste:

> Si el banco deja de cumplirlo, **se baja `EXPANSIONES_POR_TICK`**. Nunca se
> sube el presupuesto del peldaño: los 8 ms de D4 no son de D4, son un pedazo del
> tick que comparte con `stepWorld`, la percepción y el render.

La aritmética de eso, con lo medido por el
[ADR II-0007](II-0007-el-tick-es-un-parametro-y-el-presupuesto-una-fraccion.md):
a 20 Hz el tick son 50 ms y `stepWorld` mide 8,48 ms. Los 8 ms de D4 son otro
16%. Entre las dos cosas se va **un tercio del cuadro**, y D4 es de una criatura.
(De paso: los 8 ms se presupuestaron cuando el documento declaraba 30 Hz fijos,
o sea el 24% de un tick de 33,3 ms. Hoy valen menos fracción por haber bajado la
frecuencia, no por haber mejorado nada.)

### Que es exactamente el movimiento del ADR II-0008

| | Unidad del mundo | Unidad de la máquina | Quién las une |
|---|---|---|---|
| Tiempo (II-0008) | `Duracion` en segundos | ms por tick | `dt`, y el banco del tick |
| Plan (este ADR) | expansiones | ms por `plan()` | el banco del plan |

En los dos casos el código determinista **sólo ve la unidad del mundo**, el
reloj de pared vive afuera en un banco, y la conversión se ajusta bajando lo que
el mundo consume — nunca subiendo lo que la máquina promete. El
[ADR II-0007](II-0007-el-tick-es-un-parametro-y-el-presupuesto-una-fraccion.md)
lo dijo para las dos perillas: *nunca se arregla el ritmo moviendo la frecuencia,
ni el rendimiento moviendo las tasas.* Acá es lo mismo con otros nombres.

### La regla la hace cumplir un test, no una convención

`packages/plan/tests/la-regresion.test.ts` lee `readdirSync(src/)` y corre la
lista de prohibidos sobre cada fuente. Entre ellos:

```ts
[/\bperformance\./, 'el presupuesto se mide en expansiones, no en milisegundos (ADR II-0012)'],
```

El día que alguien vuelva a intentar `budgetMs`, el test le dice por qué no y
dónde está escrito. Un ADR que nadie relee no defiende nada.

## Por qué así y no de otra forma

**Se descartó el presupuesto en milisegundos con `performance.now()`.** Es lo que
el documento pedía literalmente y es lo que rompe el determinismo, por (b) de
arriba. No es un problema de pureza: es que el bug resultante es irreproducible
por construcción —depende de la carga de la máquina en el momento— y por lo tanto
no se puede escribir el test que lo agarra.

**Se descartó que el llamador mida los ms y pase «expansiones estimadas».** Es la
salida tentadora: el driver, que sí puede tocar el reloj, mide cuánto le sobra
del tick y convierte. No funciona, y no por un detalle: **la conversión depende
del problema, no de la máquina.** Una expansión que resuelve un rol contra 80
cuerpos a la vista y una que resuelve los tres roles de `friccion` contra 625
cuestan distinto —el banco de las referencias mide `donde` en 1971 ns con 80
cuerpos y 13 621 ns con 625, corrido hoy— así que el llamador tendría que saber
qué tan caro va a ser un plan que todavía no armó. Y si se equivoca, el corte
vuelve a caer en otro lado y volvemos a (b) con un paso intermedio.

**Se descartó no tener presupuesto** y dejar que `plan()` corra hasta terminar.
Con la tabla de esquemas de hoy y `PROFUNDIDAD_MAXIMA = 4` la búsqueda termina
sola y rápido —la pesca cuesta **6 expansiones**, fijado en
`la-regresion.test.ts:285`, y el `gap` por ciclo cierra en menos de 20—
así que hoy no se notaría. Pero la tabla la va a escribir la fragua en el
Hito 8: el día que haya treinta esquemas y ramificación de verdad, el peldaño
que se come el tick sin techo es éste, y el síntoma va a ser «el juego se
congela a veces», que es el peor síntoma posible para depurar. El presupuesto
tiene que existir desde antes de hacer falta, porque es lo que hace que la
frontera guardada entre ticks —el *anytime*— tenga sentido.

## Consecuencias

**Buenas**

- El plan es **reproducible**: misma semilla, mismo plan, en cualquier máquina y
  con cualquier carga. Es lo único que hace que un replay del mundo con una
  criatura que piensa signifique algo.
- El corte es **testeable**, y está testeado con el `toEqual` entero: cortar de a
  1, 2, 3, 5 y 64 expansiones y seguir da **el mismo objeto** que una corrida
  sola, `expansiones` incluido. Con un corte por reloj ese test no se puede ni
  escribir.
- El número se puede razonar sin correr nada: 6 expansiones para la pesca contra
  64 de presupuesto es un margen de 10×, y se ve leyendo.

**A tener en cuenta — y ésta es la incómoda**

- **Un entero de expansiones NO es una garantía de tiempo.** Una máquina lenta va
  a tardar más de 8 ms haciendo las 64, y el mundo va a seguir siendo
  determinista **perdiendo ticks**. Ésa es la moneda con la que se compra el
  determinismo y hay que decirla en voz alta: el mundo elige llegar tarde antes
  que llegar distinto. La reparación cuando pase no es cortar por reloj, es bajar
  `EXPANSIONES_POR_TICK` —lo que cambia la partida para todos por igual, y queda
  en el journal como cambia la frecuencia— o hacer la expansión más barata.
- **Bajar la constante cambia el juego, no sólo el rendimiento.** Con menos
  presupuesto por tick, un plan largo tarda más ticks de mundo en salir y la
  criatura se queda un rato más en D5. Es una perilla de ritmo disfrazada de
  perilla de rendimiento, y por eso `EXPANSIONES_POR_TICK` tiene que viajar en el
  journal junto a la semilla y a la frecuencia, por el mismo argumento del
  ADR II-0008: cargar un guardado con otro presupuesto es un error explícito, no
  una divergencia silenciosa. **Eso todavía no está implementado.**
- **El costo de una expansión no es plano**, y se sabe por dónde se va: la
  resolución de referencias sobre la vista saturada. Del banco de las referencias
  (corrido hoy, mínimo de 7 rondas de 10 000): `donde` cuesta 1971 ns con 80
  cuerpos y 13 621 ns con 625; `id` cuesta 364 y 2813 ns. Contra una cuota
  derivada de 125 µs por expansión (8 ms ÷ 64), tres `donde` sobre la vista peor
  se comen un tercio de la expansión. El día que el banco del plan no dé, ahí hay
  que mirar primero.

## Lo que falta medir

**HUECO 1 · el 64 no está medido, y hay que decirlo.** El comentario de
`EXPANSIONES_POR_TICK` afirma que «el número sale del banco, no de la intuición».
Hoy es falso: **no existe ningún banco de `plan()`**. Los únicos bancos del repo
son `perceive/tests/banco-la-vista.test.ts`,
`plan/tests/banco-las-referencias.test.ts`,
`world/tests/banco-el-tick.test.ts` y
`world/tests/banco-el-camino-de-intenciones.test.ts`, y ninguno mide una
expansión. Lo único que existe hoy es la cota **derivada** de 125 µs por
expansión —que es una división, no una medición— y el costo de resolver una
referencia, que es un pedazo de una expansión y no la expansión.

El banco que falta tiene que medir, y hasta que lo haga el 64 es un número
plausible y nada más:

1. ms por expansión en el **peor** caso, no en el promedio: la que resuelve los
   tres roles de `friccion` sobre la vista saturada de 625 cuerpos.
2. cuántas expansiones entran en 8 ms con ese peor caso, y no con la pesca.
3. p99 y peor, no p50 — la lección del Hito 4, donde el peor caso era 7× el p50.
4. **en el worker del navegador**, no sólo en Node: el ADR II-0007 dejó anotado
   que el arnés de vitest agrega ~30% y que el número que gobierna es el del
   worker.

**HUECO 2 · el costo del fuego no está fijado por ninguna aserción.** La pesca
tiene su `expect(r.expansiones).toBe(6)`; el fuego con un leño pesado no tiene
equivalente, así que su costo puede cambiar sin que nada se ponga rojo. Es el
otro escenario real que existe, y merece el mismo candado.
