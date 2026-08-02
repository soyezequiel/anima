# Hito 10 — Crónica y herencia

**Qué es, en una frase:** que cerrar la pestaña no cueste nada, y que la segunda
generación arranque sabiendo lo que aprendió la primera.

El plan pide `@anima/store` —journal append-only con snapshots por delta en
IndexedDB, fuera del tick— y cuatro verificables:

> replay de 20.000 ticks reproduce el hash exacto **y re-ejecuta las habilidades
> comparando la traza**; cerrar y reabrir la pestaña a mitad de una obra no
> pierde el mundo y la habilidad converge; una heredera arranca con la biblioteca
> completa y ninguna credencial regalada; **una segunda vida resuelve «pescá» en
> menos de 100 ms sin despertar la fragua**.

---

## 0 · Las siete mediciones que se hicieron ANTES de escribir el criterio

### M1 · `@anima/store` no existe, y no hay una sola línea de persistencia

```
paquetes de ii/ ... emergencia forge judge lang llm mind oracle perceive
                    physics plan skills world        (doce, ningún store)
```

`IndexedDB` aparece exactamente tres veces en todo `src/`, y ninguna la usa: dos
comentarios que dicen «lo que no aguanta el viaje por JSON no sirve para
IndexedDB», y **la lista de globals prohibidos del sandbox**. O sea que lo único
que el árbol sabe hoy de IndexedDB es que las habilidades no pueden tocarlo.

**Esto es el grueso de las dos semanas.** No es una pieza que falta: es un
paquete entero que no existe.

### M2 · El replay existe y está bien probado — pero replaya INTENCIONES, no habilidades

```ts
export interface JournalEntry<I> {
  readonly tick: number
  readonly seq: number
  readonly intent: I      // ← esto, y nada más
}
```

Una `Intent` es **lo que la habilidad ya produjo**. Replayarla salta la habilidad
entera: el generador no se vuelve a correr ni una vez. Así que la primera mitad
del verificable —«reproduce el hash exacto»— está cumplida desde el Hito 2, y la
segunda —«y re-ejecuta las habilidades comparando la traza»— **no tiene ni por
dónde empezar**.

Y hay que decir por qué la mitad que falta importa: un replay de intenciones
prueba que **el mundo** es determinista. No prueba nada sobre la habilidad. Una
habilidad que mira el reloj de pared, o que depende del orden de un `Map`, pasa
este replay sin despeinarse — porque nunca corre.

### M3 · El replay más largo del árbol es de 10.000 ticks, no de 20.000

`world/tests/hito-2-el-criterio.test.ts`, bloque (d). El verificable pide el
doble. No es un problema de diseño; es un número que hay que medir y no citar.

### M4 · La traza YA EXISTE, y ya se hashea

`TraceEntry` en `skills/src/ejecutor.ts`, con su comentario: *«la traza CRECE con
la corrida y no tiene tope, a propósito: es lo que hashea…»*.

**Lo que falta no es la traza.** Es que alguien corra la habilidad durante el
replay para tener una segunda traza con qué comparar.

### M5 · No hay herencia, ni legado, ni segunda vida. Cero líneas

`grep` de `herencia|heredera|legado|segunda vida|generacion` sobre todo `src/`:
ni una coincidencia real. Los siete ADRs de Ánima I que el inventario marca para
portar acá —0009, 0021, 0033, 0047, 0075, 0076, 0084— **no están portados**.

### M6 · Pero el vocabulario de «credencial no regalada» YA está

```ts
trust: 'borrador' | 'provisional' | 'estable'     // physics/src/process.ts
```

Y `provisional` ya existe como nivel de confianza de una habilidad, con su portón
escrito: *«una habilidad `provisional` entra con `reversible` y no puede quemar la
casa que la hospeda»*. O sea que «la heredera recibe testimonio, no hechos» (ADR
0009) tiene dónde apoyarse: **no hay que inventar el concepto, hay que usarlo**.

### M7 · EL CUARTO VERIFICABLE NO PUEDE FALLAR

Medido con la costura del Hito 9 puesta, en una **primera** vida, sin nada
guardado y sin herencia de ninguna clase:

```
─── «pescá algo», en una PRIMERA vida ───
  la meta que salió ......... holding(tag:carnoso)
  leerla costó .............. 0,83 ms
  hasta el primer paso ...... 1 tick · 3,12 ms de CÓMPUTO
  TOTAL ..................... 3,96 ms contra el techo de 100
  consultas a la fragua ..... 0
```

**25× de sobra, y cero consultas.** Así que *«una segunda vida resuelve pescá en
menos de 100 ms sin despertar la fragua»* es cierto hoy sin persistencia, sin
herencia y sin el hito.

Es la misma forma que el Hito 9 encontró en su M1, y por la misma causa: **el
número se eligió pensando en el caso frío —cuando la habilidad hay que
escribirla— y hoy todas las habilidades ya están escritas.** Un techo que sobra
25× no mide nada.

---

## 1 · Lo que las siete mediciones dejan del hito

Tres de los cuatro verificables son trabajo real y grande:

| verificable | qué falta de verdad |
|---|---|
| replay 20k + traza | la **mitad de la traza**, entera (M2, M4) |
| cerrar y reabrir la pestaña | **todo**: no hay persistencia (M1) |
| heredera con biblioteca completa | **todo**: no hay herencia (M5) — pero el vocabulario está (M6) |
| segunda vida < 100 ms | **nada**: ya se cumple 25× (M7) |

El cuarto hay que reescribirlo para que pueda fallar. Y la pregunta que lo
reescribe es la única que importa del hito:

> **¿QUÉ HACE UNA SEGUNDA VIDA QUE LA PRIMERA NO PODÍA?**
>
> Si la respuesta es «nada, sólo llega igual de rápido», la herencia no compró
> nada y el hito se cumple solo.

Y hay una respuesta medida esperando desde el Hito 5, escrita como hueco en
`mind/src/tipos.ts`:

> un replay desde el journal reconstruye el mundo y **NO las creencias**. La
> criatura revivida se acuerda de dónde estaban las cosas y no de si le
> rindieron.

Eso es lo que la herencia tiene que comprar, y se puede contar en ticks.

---

## 2 · El criterio, reescrito para que pueda fallar

| | qué se afirma | cómo se mide |
|---|---|---|
| **1** | el replay de **20.000 ticks** reproduce el hash exacto | hoy son 10.000 (M3); hay que correr el doble y medirlo |
| **2** | y **re-ejecuta las habilidades**, comparando la traza contra la de la corrida original | la traza ya existe y ya se hashea (M4); falta correr la habilidad |
| **3** | **EL CONTROL del 2**: una habilidad con una fuente de no-determinismo plantada **sí** rompe la comparación | sin esto, «las trazas coinciden» es cierto porque nadie las miró |
| **4** | cortar a mitad de una obra y volver a abrir **no pierde el mundo**, y la obra converge al mismo resultado | pide `@anima/store` (M1) |
| **5** | la heredera arranca con la biblioteca completa y **ninguna credencial regalada**: lo heredado entra `provisional` y se vuelve a ganar la vara en SU mundo | M6 |
| **6** | **la segunda vida llega al pescado en MENOS TICKS que la primera**, y el control: sin la herencia, la misma segunda vida tarda lo mismo que la primera | es lo único que distingue «heredó» de «arrancó de nuevo» |
| **7** | y en las dos, la fragua **no se despierta** — con el espía del Hito 9, no con un grep | reusa la costura que ya está medida |

### Por qué el punto 6 reemplaza al «< 100 ms»

Porque el techo de 100 ms sobra 25× **sin el hito** (M7), y un verificable que ya
se cumple no puede decir si el trabajo sirvió. Lo que la herencia promete no es
velocidad de cómputo: es **no volver a aprender lo que ya se sabía**. Eso se
cuenta en ticks de mundo, contra la línea base que el Hito 5 ya midió —el pescado
entra a la mano en el tick **108**— y puede salir mal de la forma más útil: que
dé 108 igual, y entonces la herencia no compró nada.

El «< 100 ms» no se tira: queda como **guarda**, no como criterio. Que no
empeore es cierto y vale la pena vigilarlo; que se cumpla no demuestra nada.

### Y una advertencia sobre el punto 3

Es el control que sostiene el 2, y es fácil escribirlo mal. Plantar el
no-determinismo en un lugar que la habilidad no toca da verde y no controla nada
— es exactamente el error que el Hito 8 cometió con el manual viejo, corregido
sólo cuando el usuario preguntó por qué el control no mordía. La fuente plantada
tiene que estar **en el camino que la habilidad recorre**, y hay que demostrarlo
mostrando que la corrida sin plantar sí pasa.

---

## 3 · Lo que hay que construir

1. **`@anima/store`** — el paquete que no existe. Journal append-only con
   snapshots por delta, fuera del tick. Es el grueso de las dos semanas.
2. **El replay que corre la habilidad** — hoy replaya intenciones (M2). Necesita
   volver a montar la habilidad y comparar su traza contra la original.
3. **La herencia** — con lo heredado entrando `provisional` (M6) y las creencias
   viajando, que es el hueco que el Hito 5 dejó escrito.

Lo que **no** hay que construir: la traza (M4), el vocabulario de confianza (M6),
y el replay del mundo (M2, primera mitad — cumple desde el Hito 2).

---

## 4 · Lo que este hito NO decide

El plan agrega, en la suma del caso de aceptación, el **journal de catálogo** con
los cuatro gestos (promoción, activación, revocación y adopción) y las tres reglas
de aislamiento entre saves. Eso es una decisión de producto que todavía no se
tomó y que no se puede tomar midiendo: entra al criterio el día que se tome, con
su ADR, como pasó con el árbol de crafteo.
