# ADR II-0008 — El tiempo del mundo se mide en segundos, no en ticks

Fecha: 2026-07-27 · Estado: aceptado · Completa el
[ADR II-0007](II-0007-el-tick-es-un-parametro-y-el-presupuesto-una-fraccion.md),
que separó las dos perillas pero dejó las tasas atadas al tick.

## Contexto

El ADR II-0007 declaró que son **dos perillas y no una**: la frecuencia del tick
gobierna el rendimiento, las tasas de las leyes gobiernan el ritmo. Y después
midió esto:

| | 30 Hz | 20 Hz |
|---|---|---|
| cocinar el cuero | 40,4 s | **60,6 s** |

O sea que la separación estaba **escrita pero no construida**. Mientras
`Effect.perTick` sea por tick y `completion.at` cuente ticks, mover la frecuencia
sigue moviendo el ritmo del juego, y las dos perillas siguen siendo una sola con
dos nombres.

## Decisión

**El tiempo del mundo se expresa en segundos. El tick es cómo se muestrea, no
qué tan rápido pasan las cosas.**

```ts
/** Una tasa POR SEGUNDO de mundo. No sabe que existe el tick. */
export type Rate = number & { readonly __rate: unique symbol }

/** Una duración en segundos de mundo. */
export type Duracion = number & { readonly __duracion: unique symbol }

/** El paso de tiempo de un tick, en segundos. Lo fija el mundo, no la física. */
export type Dt = number & { readonly __dt: unique symbol }
```

- `Effect.perTick` pasa a ser `porSegundo`.
- `completion.at` pasa de contar ticks a ser una `Duracion` en segundos.
- `QualitySpec.relaxesTo.perTick` pasa a `porSegundo`.
- `paso(body, entorno, phys, dt)` recibe el paso de tiempo y aplica `tasa · dt`.
- Un proceso en curso acumula **segundos transcurridos**, no ticks.

Cambiar la frecuencia pasa a cambiar **con qué finura se muestrea** el mismo
mundo. Cocinar el cuero tarda 40 segundos a 20 Hz, a 30 Hz y a 10 Hz.

### La frecuencia deja de ser libre: `dt` tiene que ser exacto

`dt = 1/Hz` se multiplica en cada aplicación de cada ley. Si no es exactamente
representable en punto fijo, el error se acumula tick a tick y el replay diverge.

| Hz | `dt` | en escala 10⁶ | |
|---|---|---|---|
| 10 | 0,1 | 100000 | **exacto** |
| 15 | 0,0666… | 66666,67 | periódico |
| **20** | **0,05** | **50000** | **exacto** |
| 24 | 0,04166… | 41666,67 | periódico |
| 25 | 0,04 | 40000 | **exacto** |
| **30** | **0,0333…** | **33333,33** | **periódico** |
| 50 | 0,02 | 20000 | **exacto** |
| 60 | 0,01666… | 16666,67 | periódico |

**Los 30 Hz que el documento declaraba «fijos» no dan un `dt` exacto.** La
frecuencia que la auditoría marcó como decretada sin argumento habría roto el
determinismo el día que el tiempo se hiciera explícito — que es hoy. Los 20 Hz
del ADR II-0007 sí lo dan, y ésa es una justificación que no teníamos cuando se
eligieron.

**Las frecuencias admisibles son las que dividen 10⁶ exactamente**: 10, 20, 25,
50, 100… El mundo tiene que **rechazar** una frecuencia que no cumpla, no
redondearla en silencio.

### El `dt` entra en la identidad del mundo

Dos mundos con la misma semilla y distinta frecuencia **no** producen la misma
traza: muestrean la misma física con distinta finura, y eso es correcto y
esperado. Pero entonces la frecuencia es parte de lo que hay que reproducir:
va **en el journal**, junto a la semilla, y cargar un guardado con otra
frecuencia es un error explícito y no una divergencia silenciosa.

## Por qué así y no de otra forma

**Se descartó dejar las tasas por tick y compensar al cambiar la frecuencia**
(multiplicar todas las tasas por `30/20` al pasar de 30 a 20 Hz). Funciona una
vez y es una trampa: la próxima persona que toque la frecuencia tiene que
acordarse de reescalar treinta constantes, y el día que se olvide el juego cambia
de ritmo sin que ningún test lo diga. La conversión tiene que estar en **un solo
lugar**, y ese lugar es el motor.

**Se descartó `dt` en punto flotante.** Sobreviviría el replay —IEEE-754 está
especificado bit a bit para `*`— pero es la puerta por la que después entra un
`dt` variable, y un `dt` variable mata el determinismo de raíz. Fijo y exacto, o
nada.

**Se descartó que las habilidades vean segundos.** `ctx.tick` sigue siendo el
contador de pasos del mundo, porque una habilidad necesita saber *cuántas veces
la llamaron*, no cuánto tiempo pasó. Lo que sí cambia es `ctx.wait(ticks)`, que
pasa a `ctx.wait(segundos)`: esperar es un concepto de ritmo, no de muestreo.

## Consecuencias

**Buenas**

- Las dos perillas del ADR II-0007 dejan de ser una promesa y pasan a ser código.
  Cocinar tarda lo que tarda.
- La frecuencia se vuelve lo que tenía que ser desde el principio: una perilla de
  rendimiento, que se puede subir en una máquina rápida y bajar en un teléfono
  **sin tocar el juego**.
- Aparece una restricción dura y verificable —`dt` exacto— donde antes había un
  número decretado. Es un test, no una convención.
- La resolución del punto fijo se afloja: una tasa por segundo es veinte veces
  más grande que la misma por tick, así que las tres constantes que el ADR II-0006
  dejó anotadas como «cero en escala 1000» dejan de estar al borde.

**A tener en cuenta**

- **Es una migración sobre 817 tests verdes.** La prueba de que salió bien es que
  sigan verdes y que la huella de conducta no se mueva **a la frecuencia de
  referencia**. A otra frecuencia la huella cambia, y tiene que cambiar.
- **El error de integración crece al bajar la frecuencia.** A 10 Hz cada paso
  aplica el doble de cambio que a 20, y las leyes no son lineales. Hay que medir
  cuánto se separan las trayectorias entre frecuencias admisibles y decidir un
  rango soportado, en vez de prometer que cualquiera anda.
- **`admit()` razona sobre `perTick × ticks`** en varias reglas de presupuesto.
  Todas esas cuentas pasan a ser `porSegundo × duración`, y la aritmética tiene
  que seguir dando lo mismo o los 62 huecos cerrados se reabren.
