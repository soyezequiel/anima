# Hito 0 — Barrido térmico: existe la ventana, y existe la técnica

La auditoría del documento de arquitectura marcó esto como **lo primero que se
va a romper**:

> La tabla de `formFactor` (0.012 / 0.03 / 0.60 / 0.125) está escrita a mano por
> situación: es exactamente la «tabla de recetas disfrazada» que el doc acusa en
> las otras propuestas, pero en la ley 1. (…) la ventana entre «no cocina» (63) y
> «se quema» (280) tiene que seguir existiendo para 30 sustancias, no para dos.

Y pidió adelantar la calibración al Hito 0: *«si esa ventana no existe sin
números por caso, el modelo físico cambia ahí y no en el mes cinco.»*

```bash
node ii/packages/physics/banco/barrido-termico.mjs
```

Doce sustancias × tres fuegos × tres montajes × cuatro distancias. Sin motor:
son las ecuaciones del documento, evaluadas.

---

## Hallazgo 1 — La tabla no era una tabla

Las cuatro filas de `formFactor` son la **misma función** evaluada en cuatro
puntos:

```
formFactor(d, montaje) = exposicion(montaje) / (1 + d²)
```

| Montaje | d | Cuenta | Documento |
|---|---|---|---|
| piso | 2 | 0.06 / 5 | **0.012** ✔ |
| piso | 1 | 0.06 / 2 | **0.03** ✔ |
| contacto | 0 | 0.60 / 1 | **0.60** ✔ |
| parrilla | 1 | 0.25 / 2 | **0.125** ✔ |

Las cuatro, exactas. `exposicion` es cuánto de la superficie del cuerpo mira a la
fuente, y es una **enumeración cerrada de relaciones espaciales** —apoyado en el
piso, sostenido encima, en contacto con la brasa— no una fila por situación.

O sea que **la acusación de la auditoría era falsa**: la tabla era una función
con tres constantes de montaje que nadie había despejado. Queda corregido acá,
porque el error opuesto —tirar un modelo que estaba bien— también es caro.

## Hallazgo 2 — Y sin embargo el modelo estaba roto, por otra cosa

Con la función bien puesta, el barrido dio **12 de 12 sustancias con ventana de
cocción**. Pero el mejor sitio era el mismo para diez de las doce:
`hoguera/parrilla/d1`. Cocinar no habría sido una técnica: habría sido *«hacé el
fuego más grande que puedas y usá la parrilla»*.

La causa está en las fórmulas del propio documento. La ley 5 define:

```
cocción       r    = 0.010 · k / (0.2 + toughness)
evaporación   evap = 0.0006 · k                       con k = (T − denaturesAt)/100
```

Las dos proporcionales a la **misma** `k`. Entonces el agua perdida por unidad de
progreso de cocción es

```
evap / r  =  0.06 · (0.2 + toughness)
```

que **no depende de la temperatura**. Cocinar rápido y caliente cuesta
exactamente la misma agua que cocinar lento y tibio, así que más caliente es
siempre estrictamente mejor y no hay nada que decidir.

Es una degeneración matemática, no una opinión ni una perilla mal puesta. Y no se
ve leyendo el documento: se ve dividiendo las dos fórmulas.

## El arreglo: un exponente, y es física

Desnaturalizar una proteína y evaporar agua son **dos procesos distintos** y no
tienen por qué depender igual de la temperatura — tienen energías de activación
distintas, y la evaporación escala más rápido con el calor.

```js
evap = 0.0006 · k^2        // en vez de 0.0006 · k
```

Un solo número, aplicado a las doce sustancias por igual. La prueba de que el
arreglo es legítimo y no un ajuste: **no hace falta tocar ninguna sustancia en
particular.** Si hubiera que ajustar por sustancia, sería la tabla de recetas
otra vez.

## Resultado: la tensión que hacía falta

| | |
|---|---|
| Sustancias con al menos un sitio sensato | **12 / 12** |
| Imposibles de cocinar bien | 0 |
| Donde la elección no importa | 0 |
| **Óptimos distintos entre las doce** | **5** |

Y lo mejor no está en el conteo. Para **once de las doce**, el sitio de mejor
rendimiento **no es** el más rápido:

| sustancia | mejor rendimiento | ticks | rinde | más rápido | rinde |
|---|---|---|---|---|---|
| carne | hoguera/parrilla/d2 · 75° | 747 | 0.845 | hoguera/parrilla/d1 | 0.805 |
| pescado | hoguera/parrilla/d2 · 75° | 340 | 0.843 | hoguera/parrilla/d1 | 0.813 |
| tuberculo | fogata/parrilla/d1 · 90° | 1075 | 0.838 | hoguera/parrilla/d1 | 0.779 |
| raiz-dura | brasas/contacto/d0 · 159° | 278 | 0.782 | hoguera/parrilla/d1 | 0.776 |
| hongo | hoguera/piso/d1 · 51° | 1195 | 0.848 | hoguera/parrilla/d1 | 0.807 |
| hoja | brasas/parrilla/d1 · 45° | 1003 | 0.849 | fogata/parrilla/d1 | 0.837 |
| cuero | hoguera/parrilla/d2 · 75° | 1212 | 0.832 | hoguera/parrilla/d1 | 0.745 |

**Ésa es la decisión que hace que cocinar valga la pena aprenderlo: comer antes,
o comer mejor.** Con hambre urgente conviene el sitio rápido y perder un 6% de
rendimiento; con la panza a medias conviene el lento. El cuero es el caso
extremo: apurarse cuesta 10% de las calorías.

Y no es una regla que alguien escribió: sale de que la evaporación escala más
rápido que la cocción, sobre `calories = nutrition × mass × digestibility`, que
ya estaba en el documento.

Conecta directo con dos cosas que ya existen: la capacidad
`comer-ahora-o-esperar-la-coccion` de la escalera, y el `rateOf()` del
[ADR II-0004](decisions/II-0004-una-habilidad-no-simula-el-futuro.md), que es
exactamente la lectura que hace falta para tomar esa decisión sin simular.

## Lo que hay que cambiar en el documento

1. **La tabla de `formFactor` se reemplaza por la función**, con las tres
   constantes de montaje declaradas como lo que son: una enumeración cerrada de
   relaciones espaciales.
2. **La ley 5 lleva `evap ∝ k²`**, y el porqué queda escrito, porque es la
   diferencia entre que cocinar sea una técnica o una receta.
3. `toughness` pasa a ser lo que gobierna el tiempo de cocción, y hay que
   dárselo a las ~30 sustancias semilla del Hito 1.

## Lo que este barrido no prueba

Que el mundo entero esté calibrado. Prueba **una** ley contra **una** familia de
sustancias. Faltan la combustión encadenada, la humedad, la descomposición y la
oclusión nueva del [ADR II-0002](decisions/II-0002-la-ley-de-la-oclusion.md), y
sobre todo faltan sus **acoplamientos**, que es donde el riesgo 1 del proyecto
dice que se va el cronograma.

Pero el modo de trabajo queda probado: las leyes se pueden barrer **antes** de
tener motor, y una degeneración que no se ve leyendo aparece en una división.
