# Hito 11 — Calibración y presupuestos como test

**Qué es, en una frase:** que el build se ponga rojo cuando un número empeora,
para que «rápido» siga siendo verdad dentro de seis meses.

El plan lo dice sin rodeos: *«Este hito no es opcional: es donde se paga el
precio de haber elegido emergencia sobre catálogo»*.

**Verificable del plan:** el build falla si cualquiera de esos números empeora
contra la línea base registrada; 100 partidas automatizadas de 20.000 ticks sin
violar ningún invariante económico y sin superar el techo de consultas. Y una
separación que no se negocia: **CI determinista, benchmark real y E2E de
navegador corren aparte**.

---

## 0 · Las nueve mediciones que se hicieron ANTES de escribir el criterio

### M1 · El CI existe, y SÍ corre la suite de Ánima II

`.github/workflows/ci.yml` corre `pnpm test`, que es `pnpm -r run test`, y
`ii/packages/*` está en el `pnpm-workspace.yaml`. O sea que los 3072 tests de
`ii/` ya corren en cada push.

**Pero corren todos en un solo job**, junto con el lint, el typecheck y los E2E
de Playwright, con `timeout-minutes: 20`. Eso es exactamente lo que el plan
prohíbe con nombre y apellido.

### M2 · EL MECANISMO DEL HITO YA EXISTE — en un solo lugar

`packages/skills/tests/linea-base.json`. Un número registrado en un archivo, un
test que lo lee y compara, y la regla escrita adentro del propio archivo:

> Para subir este numero hay que editarlo a mano y decir por que.

Eso **es** el Hito 11, funcionando, desde el Hito 4. Lo que este hito tiene que
hacer no es inventar el mecanismo: es **generalizarlo**.

### M3 · Y LA PROPORCIÓN ES LA MEDICIÓN MÁS ÚTIL DE LAS NUEVE

```
console.log en los tests de ii/ ........ 626
archivos de línea base ................. 1
tests que leen una línea base .......... 1
```

**Seiscientos veintiséis números medidos, y uno guardado.** Todo lo demás se
imprime en la consola y se olvida cuando el scroll pasa. Ése es el estado real
del proyecto y ésa es la deuda que este hito paga.

### M4 · Los tres relojes del Hito 6 tienen línea base EN PROSA, no en un guardián

El plan dice que tres relojes «ya tienen línea base» y los lista con sus
números: `msHastaPrimerMovimiento` p95 **1,35 ms**, `consistenciaDelPrimerGesto`
**1,00**, `msHastaAccionPertinente` **1 tick**.

Medido: esos números **están en el documento**, no en un archivo que un test
lea. `lang/tests/los-tres-relojes.test.ts` afirma cotas ESTRUCTURALES
—«lo pertinente no es más rápido que un tick»— y no compara contra ningún valor
registrado. O sea que hoy **un cambio que lleve el p95 de 1,35 a 90 ms no pone
nada rojo**: sigue por debajo del techo de 150 y nadie guarda el 1,35.

Son citas, no guardas. La diferencia es todo el hito.

### M5 · `TECHO_DE_CI` existe, y su propio comentario dice que no puede morder

```ts
export const TECHO_DE_CI = { fragua: { consultas: 40, … } }
```

Y al lado, escrito por quien lo puso: *«Un episodio de la fragua sale 1 consulta
y 32 milésimas […] con eso, `<= 40` es un margen de 40× que no se puede poner
rojo»*. El mecanismo del «techo de consultas» está; el número no aprieta.

### M6 · Los ciclos rentables YA son una puerta, y no hay que construirla

`physics/src/admit.ts` rechaza con motivo `ciclo-rentable`, con su argumento
escrito: *«todo ciclo rentable, o pasa por un aporte del dios […] o no es
rentable»*. El plan pide «detección de ciclos rentables como puerta» y la puerta
existe desde el Hito 1.

### M7 · Los invariantes económicos existen, y se verifican replayando

`oracle/src/presupuesto.ts` y `oracle/src/ledger.ts` tienen `verificar()`, que
rehace los totales replayando el diario y los compara contra el mapa vivo. El
plan pide «100 partidas sin violar ningún invariante económico»: el invariante
está, lo que falta son las cien partidas.

### M8 · Cuánto cuesta correr partidas largas, con el número del árbol

El banco caro —20 partidas— tarda **~311 s**. Cien partidas de 20.000 ticks son
del orden de **25 minutos**, o sea **más que el `timeout-minutes: 20` del CI
actual**. No entra donde está hoy, y ése es el argumento más concreto a favor de
la separación que el plan pide.

### M9 · Y EL HITO YA TIENE SU PRIMER CASO REAL, ENCONTRADO HOY

`forge/tests/el-episodio.test.ts` mide `perdidosPorLaFragua` contra el **reloj de
pared**. Medido las dos formas:

```
el archivo solo .................................. 6 de 6 verdes
los 13 archivos del paquete, en paralelo ......... 1 rojo
```

Es un test cuyo resultado **depende de cuánta CPU haya libre**, sentado adentro
de la suite compartida. El plan advierte que esto *«ya pasó dos veces en este
proyecto»*; ésta es la tercera, y está en el árbol ahora mismo.

---

## 1 · Lo que las nueve mediciones dejan del hito

Tres de las cosas que el plan pide **ya están**: la puerta de ciclos rentables
(M6), los invariantes económicos (M7) y el mecanismo de línea base (M2).

Lo que falta es de otra clase, y M3 lo dice con dos números: **626 contra 1**.
No falta medir. Falta **guardar lo medido y compararlo**.

> El Hito 11 no es «medir más». Es convertir seiscientos veintiséis números que
> se imprimen en un puñado de números que se **defienden**.

Y falta la separación que M8 y M9 hacen urgente: hoy un test de reloj de pared
puede tumbar el build por la carga de la máquina, y las cien partidas no entran
en el job que existe.

---

## 2 · El criterio, en seis puntos

| | qué se afirma | cómo se mide |
|---|---|---|
| **1** | hay un **archivo de líneas base** que un test lee, con los relojes del Hito 6 adentro y su valor medido | hoy es 1 archivo con 1 número (M2, M3) |
| **2** | **EL CONTROL**: empeorando a mano cualquiera de esos números, el test se pone rojo y dice cuál | sin esto, un archivo de líneas base es decoración |
| **3** | y **subir una línea base exige editarla a mano**, con el porqué escrito — no se actualiza sola | es la regla que `linea-base.json` ya declara, generalizada |
| **4** | los tests que miden contra el **reloj de pared** están SEPARADOS de la suite determinista, y el caso de M9 está cerrado | corriendo la suite entera dos veces seguidas, cero rojos por carga |
| **5** | **cien partidas de 20.000 ticks** sin violar un invariante económico ni pasar el techo de consultas | fuera del job de CI (M8), con su tiempo medido |
| **6** | **EL CONTROL del 5**: una partida con un invariante roto a propósito **sí** se reporta | sin esto, «cien partidas limpias» es el cero por omisión más caro del proyecto |

### Por qué el punto 4 va antes que el 5

Porque el 5 es caro y el 4 es lo que hace que valga la pena correrlo. Una suite
donde un rojo puede venir de la carga de la máquina entrena a todo el mundo a
re-correr y seguir, y a partir de ahí ningún guardián protege nada. **El caso de
M9 está en el árbol hoy**, así que el punto 4 arranca con un rojo real que
cerrar, no con un ejemplo.

### Y lo que este criterio NO promete

El plan lista ocho números más en la suma del caso de aceptación —costo del
registry, crecimiento del planner, replay con promociones, dispositivos
autónomos, benchmark del proveedor, invalidación física, estabilidad
económica—. Varios de ésos **no tienen todavía a quién medir**: no hay
dispositivos autónomos corriendo solos ni promociones de verdad. Meterlos al
criterio haría que el hito no pueda cerrar por cosas que son de otros hitos.

Entran cuando exista lo que miden, con su número, como pasó con el reloj de lo
pertinente.

---

## 3 · Lo que hay que construir

1. **El archivo de líneas base y su lector**, generalizando el patrón que
   `skills/tests/linea-base.json` ya prueba.
2. **La separación de los tests de reloj de pared**, empezando por el rojo real
   de M9.
3. **Las cien partidas**, fuera del job de CI, con su control.

Lo que **no** hay que construir: la puerta de ciclos rentables (M6), los
invariantes económicos (M7), ni el techo de consultas (M5) — aunque a ése hay
que apretarle el número.
