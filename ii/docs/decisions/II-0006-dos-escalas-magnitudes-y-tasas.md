# ADR II-0006 — Dos escalas: las magnitudes necesitan rango, las tasas necesitan resolución

Fecha: 2026-07-27 · Estado: aceptado · Corrige dos errores del contrato de tipos
con el que se construyó `@anima/physics` en el Hito 1.

## Contexto

El Hito 1 se construyó contra un contrato de tipos que escribí yo, sin medir. Dos
de sus decisiones resultaron equivocadas, y las dos las encontró el agente que
escribió `fixed.ts` mientras lo escribía. Quedaron anotadas como dudas y **no se
tocaron**, porque el contrato decía otra cosa. Es el momento de corregirlas.

### Error 1 — `FIXED_SCALE = 1000` no alcanza para las tasas

La ley 5 evapora a `0.0006 · k²`. Para `k = 0.27`, que es el caso del pescado
sobre la parrilla, eso vale **4.4 × 10⁻⁵**. En escala 1000, redondea a **cero**.

O sea: con el contrato como estaba, **el pescado no pierde agua nunca**, la
tensión «comer antes o comer mejor» que encontró el barrido térmico desaparece,
y cocinar vuelve a ser una receta. Hay un test en `fixed.test.ts` que lo muestra:
`fmul(fx(0.0006), fpow(fx(0.27), fx(2))) === 0`.

**Y subir la escala a 1e6 no es la respuesta**, que era lo obvio:

| Escala | Valor máximo representable en i32 | Resolución |
|---|---|---|
| 1e3 | 2.147.484 | 10⁻³ |
| 1e4 | 214.748 | 10⁻⁴ |
| 1e5 | 21.475 | 10⁻⁵ |
| **1e6** | **2.147** | 10⁻⁶ |

Con 1e6 el techo queda en **2147**, y las temperaturas del mundo lo rozan: la
`friccion` empuja hacia 400 °C, una hoguera pasa los 600, y cualquier cálculo
intermedio que multiplique dos temperaturas satura. Una sola escala no puede
servir a las dos cosas: **las magnitudes necesitan rango y las tasas necesitan
resolución**, y con i32 no hay margen para las dos a la vez.

### Error 2 — `heatCapacity` no es expresable

`heatCapacity = mass × specificHeat`, y `specificHeat` es un campo de
`Substance`. La gramática de `QualityExpr` que escribí no tiene **ningún nodo que
llegue hasta ahí**: tiene `own`, `sumParts`, `maxParts`, `geom` y `op`, y ninguno
alcanza una propiedad de la sustancia.

El agente lo resolvió como pudo —una función aparte, `heatCapacityOf()`, marcada
con `DERIVED_FROM_SUBSTANCE`— y avisó de la trampa: si alguien pregunta
`spec.derived !== undefined` en vez de `isDerived(q)`, `heatCapacity` se guarda y
queda vieja apenas el cuerpo pierda masa evaporando.

## Decisión

### 1. Dos tipos, dos escalas, y el compilador de por medio

```ts
/** Una MAGNITUD: temperatura, masa, nutrición. Necesita rango. */
export type Fixed = number & { readonly __fixed: unique symbol }
export const FIXED_SCALE = 1000        // hasta ±2.147.484, resolución 10⁻³

/** Una TASA por tick: cuánto cambia una magnitud en un tick. Necesita resolución. */
export type Rate = number & { readonly __rate: unique symbol }
export const RATE_SCALE = 1_000_000    // hasta ±2.147, resolución 10⁻⁶
```

Son **tipos nominales distintos**, así que sumar una tasa a una magnitud no
compila. Ésa es la mitad del valor de la decisión: el error que esto previene no
es de precisión, es de confundir una cosa con la otra, y ese error es silencioso.

Y el techo de ±2147 **por tick** no aprieta a nadie: ninguna de las doce leyes
mueve una cualidad más de unas pocas unidades por tick. Una tasa de 2147 por tick
llevaría cualquier cualidad de punta a punta de su rango en un solo paso, que es
precisamente lo que el mundo no debería poder hacer.

La conversión vive en un solo lugar y es explícita:

```ts
/** Aplica una tasa durante `ticks` a una magnitud. La única puerta entre escalas. */
export function aplicar(m: Fixed, r: Rate, ticks: number): Fixed
```

### 2. `QualityExpr` gana un nodo que llega a la sustancia

```ts
export type QualityExpr =
  | /* …los cinco de antes… */
  | { k: 'substance'; f: 'specificHeat' }   // ← nuevo
```

Con eso `heatCapacity` se declara como cualquier otra derivada
—`op('*', own('mass'), substance('specificHeat'))`— y desaparecen tanto
`DERIVED_FROM_SUBSTANCE` como la trampa de `isDerived()` contra
`spec.derived !== undefined`. Una sola forma de preguntar si algo es derivado.

## Por qué así y no de otra forma

**Se descartó subir `FIXED_SCALE` a 1e6 y listo.** Es la respuesta obvia y rompe
las temperaturas: el techo baja a 2147 y el mundo tiene fuegos de 600 °C cuyos
productos intermedios saturan. Habría cambiado un bug silencioso (el pescado no
se seca) por otro peor (el fuego se satura y nadie se entera hasta que una
partida diverge).

**Se descartó BigInt / i64.** Resuelve el rango de un saque y cuesta el
determinismo barato y la velocidad, que son las dos razones por las que se eligió
punto fijo en primer lugar.

**Se descartó dejar las tasas en punto flotante.** Las sumas y multiplicaciones
IEEE-754 **sí** están especificadas bit a bit, así que técnicamente sobreviviría
el replay. Pero mezclar dos representaciones en la misma ley es la clase de cosa
que aguanta seis meses y explota cuando alguien saca un `Math.round` de más.

**Se descartó una sola escala intermedia (1e4 o 1e5).** No alcanza para nada: con
1e5 la evaporación a `k = 0.05` sigue siendo cero, y el techo ya bajó a 21.475.
El problema no es elegir mejor el número: es que son dos requisitos opuestos.

## Consecuencias

**Buenas**

- La ley 5 se puede escribir de verdad, y con ella la tensión que el barrido
  térmico encontró — que es lo que hace que cocinar sea una técnica.
- El compilador impide confundir una magnitud con una tasa. Ese error es
  silencioso y caro; ahora no compila.
- `QualityExpr` vuelve a ser la única forma de declarar una derivada. Una sola
  puerta, una sola pregunta.

**A tener en cuenta**

- **Es una migración sobre código que ya funciona.** `fixed.ts`, `quality.ts`,
  `leyes.ts` y sus tests están escritos contra una escala sola. Los 502 tests
  tienen que seguir verdes después, y ésa es la prueba de que la migración salió
  bien.
- **El techo de ±2147 por tick hay que testearlo, no confiarlo.** Si alguna ley
  futura necesita una tasa mayor, la respuesta correcta es preguntarse por qué,
  no subir el techo.
- **Éste es el segundo contrato que escribí sin medir y salió mal en dos
  lugares.** La lección no es «revisar mejor los contratos»: es que un contrato
  de tipos escrito de un saque, sin código que lo ejercite, es una hipótesis. El
  Hito 1 lo ejercitó y devolvió dos correcciones — funcionó como tenía que
  funcionar.
