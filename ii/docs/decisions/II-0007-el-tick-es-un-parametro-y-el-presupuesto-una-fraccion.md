# ADR II-0007 — El tick es un parámetro, y su presupuesto es una fracción

Fecha: 2026-07-27 · Estado: aceptado · Reemplaza «30 Hz fijos» y el criterio
«5000 cuerpos a menos de 4 ms por tick» del plan de construcción.

## Contexto

El criterio (c) del Hito 2 decía **5000 cuerpos a menos de 4 ms por tick**. Se
midió: 39,66 ms. Se optimizó hasta **8,48 ms** —4,6×, verificado de forma
independiente, sin cambiar una sola conducta— y sigue sin cumplirse por 2,1×.

Lo que falta no es otra micro-optimización: el perfil quedó **plano**, ningún
renglón pasa del 13%, y el piso está en la representación (una cualidad se
resuelve preguntando a `state`, después a las partes, después a la sustancia).
Bajarlo pide un vector numérico por cuerpo recalculado solo cuando cambian las
partes, que es un rediseño y no una optimización.

Y hay algo anterior que la auditoría del documento ya había marcado y nadie
respondió:

> **30 Hz.** Se declara «fijos» sin un argumento. Con `friccion` a 6 °C/tick y
> `desnaturalización` de 300 ticks, la tasa de tick **es** la calibración;
> elegir 30 antes del Hito 1 es fijar una constante física por decreto.

Tenía razón, y explica por qué el número no tenía argumento: **estaba haciendo
dos trabajos a la vez.**

## Decisión

### 1. El tick es un parámetro, y su valor por omisión pasa a 20 Hz

No es una constante de la física. El mundo ya es agnóstico —en el código, «30 Hz»
solo aparece en dos comentarios— así que lo único que cambia es cada cuánto lo
llama el driver.

### 2. El presupuesto deja de ser milisegundos y pasa a ser una fracción

```
stepWorld ≤ 25% del presupuesto de tick
```

| Frecuencia | Presupuesto de tick | Techo del 25% | Medido | |
|---|---|---|---|---|
| 30 Hz | 33,3 ms | 8,33 ms | 8,48 ms | ✘ por un 2% |
| **20 Hz** | **50 ms** | **12,5 ms** | **8,48 ms** | ✔ margen 1,5× |

Una fracción sobrevive a que cambie la frecuencia; un número absoluto en
milisegundos solo significa algo contra un presupuesto que hay que acordarse. Es
la misma lección del [ADR II-0005](II-0005-el-presupuesto-se-mide-contra-el-tick.md),
aplicada un escalón más arriba.

El **25%** deja tres cuartos del cuadro para todo lo demás: percepción, mente,
deltas de render y chat. Si algún día `stepWorld` se los come, el número salta.

### 3. Y lo que de verdad vale de esta decisión: dos perillas, no una

| Perilla | Qué gobierna | Cuándo se toca |
|---|---|---|
| **Frecuencia del tick** | cuánto tiempo de CPU hay por paso | cuando el rendimiento no entra |
| **Tasas de las leyes** (`perTick`) | cuánto tarda algo en pasar, en reloj de pared | cuando el juego se siente lento o apurado |

**Nunca se arregla el ritmo del juego moviendo la frecuencia, ni el rendimiento
moviendo las tasas.** Que estuvieran mezcladas es la razón por la que «30 Hz» no
tenía argumento: no había forma de justificarlo sin decidir a la vez cuánto tarda
en cocinarse un pescado.

## La consecuencia, con los números

Las tasas de las doce leyes son **por tick**, así que bajar a 20 Hz alarga todo
en reloj de pared 1,5×:

| Lo que pasa | ticks | a 30 Hz | a 20 Hz |
|---|---|---|---|
| `friccion`: llevar la madera de 15 a 375 °C | 60 | 2,0 s | **3,0 s** |
| cocinar el pescado en la parrilla | 340 | 11,3 s | **17,0 s** |
| cocinar la carne | 747 | 24,9 s | **37,4 s** |
| cocinar el cuero (el más lento) | 1212 | 40,4 s | **60,6 s** |
| deshilachar | 40 | 1,3 s | 2,0 s |
| atar | 20 | 0,7 s | 1,0 s |
| una tirada de pesca | 30 | 1,0 s | 1,5 s |

**Un minuto de reloj para cocinar cuero es mucho**, y queda dicho. El usuario
aceptó explícitamente que las cosas duren más, así que se toma; pero si al
jugarlo se siente lento, **la reparación es subir las tasas de las leyes, no
volver a mover la frecuencia.** Para eso se separaron.

## Por qué así y no de otra forma

**Se descartó pagar el rediseño de la representación ahora.** Es la solución
técnicamente superior y sigue disponible, pero cuesta un hito entero y retrasa
todo lo que de verdad decide si el proyecto vive, que es la mente sin LLM del
Hito 5. Con 5000 cuerpos entrando en el presupuesto, no hay urgencia.

**Se descartó bajar el número de cuerpos del criterio.** Habría sido cambiar el
enunciado para que dé verde, que es la definición de decorar un criterio. Los
5000 se quedan, y son generosos: el mundo jugable va a tener cientos, no miles.
Hoy entran **~2358 en 4 ms** y **~7400 en los 12,5** del nuevo techo.

**Se descartó dejar 30 Hz y aceptar el 8,48 sin más.** Era lo más cómodo y deja
el criterio en rojo para siempre, que con el tiempo enseña a ignorar el rojo — la
misma razón por la que en este mismo tramo se sacó una aserción de rendimiento de
la suite normal por flaky.

## Consecuencias

**Buenas**

- El criterio (c) del Hito 2 se cumple, con margen medido y no con un umbral
  acomodado.
- El presupuesto pasa a ser portable: cuando el mundo corra en un worker del
  navegador con el render compitiendo, la fracción sigue significando lo mismo.
- Separar rendimiento de ritmo cierra una pregunta que la auditoría había dejado
  abierta desde el principio.

**A tener en cuenta**

- **Hay que re-medir cuando el mundo corra en el navegador.** El banco corre en
  Node y `paso()` mide 7,7 ms bajo vitest contra 5,9 ms en node suelto: un 30% es
  el arnés. El número que gobierna de verdad es el del worker.
- **El camino del mensaje se alarga.** El documento presupuestaba «un tick a
  30 Hz» como el único componente irreducible del p95: pasa de 33 a 50 ms, y el
  p95 de mensaje-a-movimiento de ~77 a ~94 ms. Sigue holgadamente bajo el
  objetivo de producto de 150 ms.
- **`snapshot.take` cuesta 22 ms** para 5000 cuerpos, más que el tick entero.
  Está fuera del tick, en el worker de fondo, pero a esa escala domina cualquier
  cadencia de checkpoint. Queda como el próximo número a mirar.
