# Prompt para cerrar el Hito 5

> **VENCIDO — EL HITO 5 YA CERRÓ (2026-07-30).** Este archivo queda como
> HISTORIA de cómo se lo encaró, y no hay que usarlo como plan de trabajo:
> manda [`continuar-aca.md`](continuar-aca.md). Lo que dice acá abajo quedó
> desactualizado en dos cosas grandes:
>
> - **la cuenta «van 4 de 6» sumaba el p99 aceptado a los que cumplen.** Son
>   **3 que cumplen y 3 en rojo aceptado**, y se cuentan separado;
> - **el plan que propone —enseñarle la escalera de la yesca a la mente— no podía
>   dar vuelta el criterio (5)**, y eso está medido: el fuego más barato del mundo
>   sale 645,5 de aliento y la corrida canónica arranca con 310. La escalera
>   abarata el fuego grande, no el primer fósforo.

Para pegarle a un agente nuevo, sin nada de la conversación anterior.
Última actualización: 2026-07-30, sobre el commit `a22e1ec`.

---

Seguimos con **Ánima II**, el remake que vive en `ii/` del repo `F:\proyectos\Anima`
(el Ánima I original sigue andando al lado, en `packages/` y `apps/`, y **no se
toca**).

## Antes de escribir una línea

Leé enteros, en este orden:

1. `ii/docs/continuar-aca.md` — el estado: qué se cumple, qué falta, qué está abierto.
2. `ii/docs/como-se-trabaja.md` — el método, las decisiones ya tomadas y los **30
   números que ya se corrigieron**, cada uno con la regla que dejó. Esto es lo más
   caro de las sesiones anteriores y lo que más fácil se pierde.
3. `docs/architecture/remake-anima-ii.md`, la sección del **Hito 5** (~línea 1452):
   es el criterio de corte del proyecto.

## Estado, verificado mirando el exit code

Rama `anima-2`, último commit **`a22e1ec`**, ~52 por delante de `main` y **ninguno
pusheado** — el usuario pushea solo, no pushees vos.

- `pnpm ii:test` → **0**, 2448 tests verdes (+1 skipped, +1 todo)
- `pnpm ii:typecheck` → **0**, nueve paquetes

## LO PRIMERO, y no arranques por otro lado

**`ANIMA_BANCO=1 pnpm --filter @anima/juez test` está ROJO: 1 test de 121.** No está
identificado cuál. Eso es el camino caro del juez —20 partidas × 20.000 ticks— y es
donde sale el veredicto del criterio de emergencia, así que **cualquier número que
publiques sobre ese criterio antes de repararlo no vale**.

La sospecha, para que tengas contra qué comparar (**no la des por buena, medila**):
el bloque (3) de `juez/tests/hito-5-la-emergencia.test.ts` afirma que el control con
el tanque lleno vive **más de 3×** lo que la canónica. Se medía 66,2% contra 18,2%
cuando las dos se morían; desde que bajó el costo de vivir, la del tanque lleno llega
viva (100%) y la canónica también estiró, así que el cociente pudo caer abajo de 3.
Si es eso, **no es un defecto y no se afloja el umbral**: es que el experimento perdió
resolución al cambiar el mundo, y hay que rediseñar cómo se mide la separación
—afirmando el mecanismo— o marcarlo con `it.fails` y el porqué medido al lado.

> **Y una trampa que acabo de comerme, para que no la repitas:** corrí eso con
> `... | grep ... ; echo "EXIT=${PIPESTATUS[0]}"` y publiqué «exit 0» leyendo el
> código del `echo`. **El exit code de una corrida de tests se mira sin pipe, o con
> `${PIPESTATUS[0]}` bien puesto y verificando que sea el del comando correcto.** Es
> el tercer «exit 0 sobre un árbol rojo» de este proyecto.

## El objetivo: los dos criterios que faltan

Van **4 de 6**. Cumplen: proveedor apagado, la cadena de la caña, `ticksPerdidos === 0`.
El p99 falla por ~7× y está **ACEPTADO por el usuario** (queda `it.fails` con guarda
verde en 45 ms — aceptar un número no es dejar de vigilarlo).

Faltan dos, **y son el mismo problema: la criatura no come.**

| criterio | dónde está hoy |
|---|---|
| sobrevive 20.000 ticks sola | muere en el **6244** con **0 bocados** (canónica, tanque 310) |
| emergencia ≥ **4 de 9** | **0 de 9** |

El umbral es **4 de 9, el absoluto**, decidido por el usuario. No lo re-discutas.

Y está medido que los dos se tocan: **con el tanque lleno el control del azar saca
2 de 9** —dos secuencias que nadie implementó, las dos de fuego y comida—. Un fuego
que se pague hace aparecer parte del criterio 6 solo.

## El trabajo: la escalera de la yesca

Está **medida y verde** en `world/tests/la-escalera-de-la-yesca.test.ts` (5 bloques).
Lo que el mundo permite, y el planificador no sabe:

- `friccion` pide `rigidity >= 0.5` en los dos palos, así que **la yesca no se frota**:
  se PRENDE. Cuesta 771/kg contra 1457/kg de la madera;
- una vara de 0,5 kg frotada (**692,1** de aliento, el único gasto) prende 1 kg de
  yesca; la yesca entrega 356 °C y prende un **leño de 8 kg** que frotado habría
  costado 11.074;
- ese leño arde 402 s y cocina **42 piezas** con la comida en el piso **a UNA celda**
  —sobre la parrilla la quema, porque le entrega 1217 °C—: **+160,9 de neto**, y es un
  piso porque se cocinó de a una pieza;
- el dios pone esa materia en **6 de 20 semillas** en los 9 chunks del arranque, con
  la yesca en piezas de **77 g** (13 para el kilo) y la madera más grande en 2,9 kg.

Las tres cosas que hay que enseñarle, y ninguna es una constante:

1. **Juntar masa** — ~13 piezas de yesca atadas con `union`. **Falta contestar si hay
   atador cerca** (`flexibility >= 0.8` y `tensile >= 0.3`): nadie lo midió.
2. **Elegir dónde va la comida** — hoy el plan la pone pegada al fuego siempre.
3. **Que un fuego prende otro fuego**, en vez de que cada fuego nazca de frotar.

Con vivir a 0,34, llegar a los 20.000 pide unos **34 bocados cocidos** y un fuego de
la escalera da 42. La cuenta cierra el día que la mente sepa encender por escalones.

## Lo que NO tenés que hacer

- **No toques constantes del mundo sin el usuario.** `COSTO_VIVIR_POR_SEGUNDO` está
  en 0,34, que es el centro de una ventana medida `(0,3100 ; 0,3637)` con dos bordes
  que vienen de criterios distintos. `STAMINA_POR_CALORIA` tiene techo 1,0526 por el
  invariante de conservación y la eficiencia de la fricción pediría >1 (movimiento
  perpetuo). Las tres están medidas: no hay perilla que girar.
- **`COSTO_POR_CELDA` (0,05) es hoy el término que manda** —caminar es el 65% del
  gasto— y **tampoco se toca sin el usuario**: está trabado con el hueco de la
  locomoción (la velocidad es una celda por TICK, o sea 20 celdas/s a 20 Hz). Son el
  mismo número mal puesto y arreglar uno solo mueve la economía sin arreglar la física.
- **Ningún criterio se ablanda por cuenta propia.** Ya pasó cuatro veces que un
  criterio falló: se midió, se presentó la salida y decidió el usuario. Hacé lo mismo.
- **Nunca debilites un test para dar verde.** Un hueco va con `it.fails()` y el porqué
  MEDIDO al lado. Y un `it.fails` que PASA deja el paquete rojo: convertilo en `it`.

## Cómo se trabaja

- Un agente corre **sólo su paquete** (`pnpm --filter @anima/X test`). `pnpm ii:test`
  UNA vez, al final, y lo corre quien cierra el tramo.
- Las corridas caras van detrás de `ANIMA_BANCO=1`: se imprime siempre, se afirma sólo
  midiendo en serio.
- **Verificá lo que reportan los agentes.** Van 30 números corregidos y cinco eran
  conclusiones enteras que ya habían viajado a documentos.
- Workflows con agentes en paralelo sobre **archivos disjuntos**. Un tramo acotado no
  necesita adversario.
- **Commiteá cuando el tramo esté verde y verificado, SIN PUSHEAR.**
- Ojo con los bucles largos: un `it` que bloquea el hilo más de 60 s rompe el canal de
  vitest y da **tests verdes con exit 1** («Timeout calling onTaskUpdate»). Se cede el
  hilo con `await respirar()` cada tanto — hay ejemplos en `juez/tests/`.

## Por dónde empezar

1. Identificá y reparás el rojo de `ANIMA_BANCO=1` en `@anima/juez`.
2. Medí si hay atador a la vista en las semillas donde está la materia de la escalera.
3. Enseñale la escalera al planificador y a la mente.
4. Re-medí los dos criterios y **presentá los números crudos**, sin ajustar umbrales.
