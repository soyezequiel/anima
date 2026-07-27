# ADR II-0005 — El presupuesto se mide contra el tick, no contra sí mismo

Fecha: 2026-07-27 · Estado: aceptado · Reemplaza el criterio de corte del
combustible fijado en el plan de construcción del documento de arquitectura.

## Contexto

El plan de construcción declaró, antes de escribir una línea:

> si el transformer de combustible cuesta más del 15% de overhead, el plan del
> sandbox cambia **acá** y no después de construirle encima.

Se midió ([`hito-0-combustible.md`](../hito-0-combustible.md)) y **se pasó**, en
las dos cargas y en todas las variantes:

| Carga | Variante | Overhead |
|---|---|---|
| cómputo apretado | `__fuel()` como llamada | 33% |
| cómputo apretado | comprobación en línea | 22% |
| generador que cede el tick | en línea | 52% |
| generador que cede el tick | solo bucles | 52% |

Tres corridas, varianza menor a un punto. El mejor caso medido es 22%.

Y sin embargo, los mismos números en absoluto:

```
la habilidad computa           0.254 ms
con el combustible puesto      0.388 ms
                               ─────────
overhead                       0.134 ms

presupuesto del tick a 30 Hz     33 ms
```

**0.134 de 33.** Cuatro décimas de un uno por ciento.

## Decisión

**El criterio de corte pasa de ser una razón a ser un presupuesto absoluto
contra el tick.**

| | Viejo | Nuevo |
|---|---|---|
| Qué mide | cuánto más lento se pone el código instrumentado | cuánto del tick se come |
| Umbral | ≤ 15% de overhead | **overhead ≤ 2% del tick (0.66 ms)** |
| Segundo umbral | — | **cómputo de habilidad instrumentado ≤ 10% del tick (3.3 ms)** |
| Medido hoy | 22–52% ✘ | **0.41% y 1.18%** ✔ |
| Margen | — | 4.9× y 8.5× |

Dos umbrales y no uno, porque la razón vieja estaba tratando de vigilar dos
cosas a la vez y no vigilaba bien ninguna: que la instrumentación no salga cara,
y que el cómputo de las habilidades no se coma el cuadro. Separadas, cada una
falla cuando tiene que fallar.

Se conservan dos hallazgos del banco como **requisitos**, no como sugerencias:

- **La inyección va en línea**, no como llamada a función. Es 1.5× gratis
  (33% → 22%), y la única razón por la que estaba como llamada era que se veía
  más prolijo.
- **Se instrumentan también las entradas de función.** Sacarlas no ahorra nada
  medible (52.6% → 51.9%) y hace que la recursión infinita muera por
  `RangeError` en vez de por combustible, o sea sin suspensión reanudable.

## Por qué así y no de otra forma

**Se descartó dejar el criterio como estaba y cambiar el diseño del sandbox.**
Es lo que la regla pedía literalmente, y habría sido tirar un diseño que
funciona —corta el bucle infinito en 0.33 ms, corta la recursión, agrega 11% al
tamaño del código— por un número que no describe ningún problema del producto.
El costo real es invisible: 0.134 ms en un cuadro de 33.

**Se descartó contar de a bloques** (mirar el contador cada N vueltas en vez de
cada vuelta). Es la optimización obvia y probablemente funcione, pero pierde
precisión en el corte y agrega una perilla nueva. Con 4.9× de margen no hace
falta pagar complejidad por velocidad que no se ve. Queda anotada por si algún
día el margen se achica.

**Y lo importante: la regla se cambió con el usuario, no por mi cuenta.** El
criterio se escribió antes justamente para que no se pudiera negociar después.
Renegociarlo solo habría sido el mismo vicio que la arquitectura le prohíbe a
Ánima: el que propone decidiendo si su propuesta pasa. La medición y el análisis
son míos; la decisión es del usuario, y quedó registrada acá para que se pueda
discutir con lo que se sabía en el momento.

## Consecuencias

**Buenas**

- El Hito 4 se desbloquea. El transformer sigue como está y su versión de
  producción se escribe con lo que aprendió el banco.
- Los umbrales nuevos son **absolutos**, así que dicen algo del producto:
  «esto no se ve en pantalla». Una razón sobre un número chico no dice nada, y
  esa es la lección que hay que llevarse.
- El banco pasa a ser un test de regresión útil: si mañana una habilidad
  empieza a computar 5 ms, el segundo umbral salta. El viejo no habría saltado,
  porque la razón se habría mantenido igual.

**A tener en cuenta**

- **El margen es de hoy, con una habilidad.** Con varias habilidades vivas, más
  cuerpos a la vista y percepciones más grandes, el cómputo sube. Los 3.3 ms del
  segundo umbral son el número a vigilar, y el banco tiene que correr en CI
  desde que exista el ejecutor.
- **La medición es en Node, no en el navegador.** El JIT de V8 es el mismo, pero
  el presupuesto de tick compite con el render. Hay que rehacerla en el Hito 2,
  cuando el mundo corra en su worker.
- **Cambiar un criterio de corte sienta precedente.** Éste se cambió porque
  medía la magnitud equivocada y se demostró con números. No es licencia para
  ablandar el próximo que moleste: si el criterio mide lo correcto y no se
  cumple, se cumple el criterio.
