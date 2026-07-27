# Hito 0 — Combustible: el criterio se pasó, y el criterio estaba mal

> **RESUELTO.** El usuario decidió cambiar la regla, y quedó registrada en el
> [ADR II-0005](decisions/II-0005-el-presupuesto-se-mide-contra-el-tick.md): el
> presupuesto se mide **contra el tick**, no contra sí mismo.
>
> | | Viejo | Nuevo | Medido |
> |---|---|---|---|
> | Costo de instrumentar | ≤ 15% de overhead | **≤ 2% del tick** (0.66 ms) | **0.39%** ✔ margen 5.1× |
> | Cómputo de habilidad | — | **≤ 10% del tick** (3.3 ms) | **1.15%** ✔ margen 8.7× |
>
> El banco ahora sale 0. **El Hito 4 está desbloqueado.** El resto de este
> documento es cómo se llegó ahí, y se conserva entero porque el número viejo
> explica por qué el nuevo es el correcto.

---

El plan de construcción declaraba, escrito de antemano:

> si el transformer de combustible cuesta más del 15% de overhead, el plan del
> sandbox cambia **acá** y no después de construirle encima.

```bash
node ii/packages/skills/banco/combustible.mjs
```

**Se pasó, en las dos cargas y en todas las variantes.**

---

## Los números

| Carga | Variante | Overhead |
|---|---|---|
| **Peor caso** — cómputo apretado sin ceder | `__fuel()` como llamada | **33%** |
| | comprobación en línea | **22%** |
| **Realista** — generador que cede el tick | en línea, bucles + funciones | **52%** |
| | en línea, **solo bucles** | **52%** |

Reproducible: tres corridas dan 33.1 / 33.3 / 34.3 y 21.8 / 22.1 / 22.3. La
varianza es menor a un punto.

**El mejor caso medido es 22%. El criterio es 15%.**

## Lo que funciona, para que quede dicho

El transformer **hace su trabajo**:

- `while (true) { n++ }` con 50.000 de combustible se corta en **0.33 ms**.
- La recursión infinita también se corta, por el punto de inyección en la
  entrada de función.
- La instrumentación agrega **11%** al tamaño del código, que es despreciable.

O sea: el problema no es que no sirva. Es que cuesta.

## Tres cosas que aprendió el banco

**1. La llamada es el costo, no el contador.** Pasar de `__fuel()` a la
comprobación desnuda `if (--__fuelLeft < 0) __fuelOut()` baja de 33% a 22%. Un
tercio del costo era la llamada a función. Si se sigue adelante con este diseño,
tiene que ser en línea.

**2. Sacar la instrumentación de las funciones no ahorra nada** (52.6% → 51.9%).
La intuición decía que instrumentar solo los bucles sería más barato; es falso,
porque el costo está en los bucles internos, que es donde se ejecuta el 99% de
las inyecciones. Y sacarla cuesta caro en otra moneda: la recursión infinita
pasaría a morir por `RangeError` en vez de por combustible, o sea sin
suspensión reanudable. **No conviene: no ahorra y empeora.**

**3. La primera medición dio −20% y era mentira.** Con corridas de 0.077 ms el
ruido del timer dominaba, y la variante instrumentada salía *más rápida* que el
código crudo — que es imposible. Con corridas de milisegundos y las variantes
intercaladas en cada ronda, el número se estabilizó. Queda anotado porque es el
modo de falla típico de este tipo de banco, y porque una medición que dice lo
que uno quiere oír merece más desconfianza, no menos.

## La decisión, que no fue mía

El criterio estaba incumplido y eso es un hecho. Pero había una lectura que
había que poner sobre la mesa antes de tirar el diseño:

**el 15% estaba medido sobre el código de la habilidad, no sobre el tick.**

En la carga realista, la habilidad computa 0.254 ms y con combustible pasa a
0.388 ms: **+0.13 ms**. El presupuesto del tick a 30 Hz es de 33 ms, y el
documento le da 1.5 ms a `stepWorld`. Un séptimo de milisegundo de overhead no
se ve en ningún lado.

Se presentaron tres salidas:

| Salida | Qué implica |
|---|---|
| **Aceptar el costo** | El overhead relativo es alto pero el absoluto es 0.13 ms. Se cambia el criterio a un presupuesto contra el tick y se sigue. Requiere admitir que el criterio original medía lo que no importaba. |
| **Bajar el costo** | Contar de a bloques en vez de por iteración: descontar N cada N vueltas. Baja la frecuencia de la comprobación a costa de precisión en el corte, que no importa porque el presupuesto es un tope y no una factura. Nunca se midió. |
| **Cambiar el diseño** | Volver a evaluar el sandbox, que es lo que el criterio pedía literalmente. |

**El usuario eligió la primera.** Queda en el
[ADR II-0005](decisions/II-0005-el-presupuesto-se-mide-contra-el-tick.md), con
dos umbrales absolutos en vez de una razón, y con los dos hallazgos del banco
convertidos en requisitos: la inyección va **en línea** (1.5× gratis) y se
instrumentan **también las entradas de función** (sacarlas no ahorra nada y
rompe el corte de la recursión).

Lo que **no** hice fue mover el poste yo. El criterio se escribió antes
justamente para que no se pudiera negociar después, y negociarlo por mi cuenta
habría sido exactamente el vicio que la arquitectura le reprocha a un modelo que
se convence solo: el que propone decidiendo si su propuesta pasa. La medición y
el análisis son míos; la decisión no.

**Y queda dicho para la próxima:** éste se cambió porque medía la magnitud
equivocada y se demostró con números. No es licencia para ablandar el siguiente
criterio que moleste. Si mide lo correcto y no se cumple, se cumple el criterio.

## Lo que falta del Hito 0

Con esto, dos de las tres piezas pendientes están medidas:

| | |
|---|---|
| [typecheck](hito-0-banco-de-latencia.md) | ✔ 240 ms en frío contra un corte de 3000 |
| [barrido térmico](hito-0-barrido-termico.md) | ✔ 12/12 con ventana, y aparecio la tension que hacia falta |
| **combustible** | ✘ **22–52% contra un corte de 15%** |
| arranque de página con el toolchain en el navegador | pendiente |

El arranque de página es el único que queda, y necesita medir la descarga y el
parseo de `typescript` dentro de un navegador de verdad.
