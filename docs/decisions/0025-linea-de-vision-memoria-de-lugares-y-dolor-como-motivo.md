# ADR 0025 — Línea de visión, memoria de lugares y el dolor como motivo

Fecha: 2026-07-16 · Estado: aceptada

## Contexto

La percepción veía a través de los muros: el rango (Chebyshev, ADR 0005) era
el único límite, así que un martillo tras un muro completo era tan "visible"
como uno al lado. Eso abarataba dos cosas que queríamos caras: la memoria (no
hacía falta recordar nada, todo estaba siempre a la vista) y el espacio (un
muro no ocultaba nada, solo estorbaba el paso).

A la vez, el dolor era SOLO un reflejo (un paso de escape, ADR 0017): una
mascota acorralada junto a un fuego se quedaba perdiendo salud hasta morir sin
que ninguna parte de su mente lo tratara como un problema a resolver.

## Decisión 1 — La vista exige línea despejada; el olfato y el calor, no

`buildPerception` traza una línea de Bresenham entre el observador y cada
entidad en rango: si alguna celda **intermedia** contiene un sólido, la
entidad no se ve. Los extremos no cuentan (un muro no se esconde detrás de su
propia celda), lo llevado encima y el propio cuerpo no se ven afectados, y el
algoritmo es entero y determinista.

**El tradeoff de la historia, decidido honestamente.** La historia del MVP
depende de que la mascota note la comida detrás del muro completo — ese es el
motivo entero. Con visión pura, la comida invisible convertía el problema en
"falta el recurso" (pedir ayuda, ADR 0008) y el ciclo de skills jamás se
abría; lo mismo pasaba con el fuego amurallado del test de frío ("falta
CAPACIDAD, no recurso"). En vez de debilitar esos tests o rediseñar el
escenario, la percepción gana un segundo canal: **lo comestible se huele y lo
que irradia calor se siente, a través de los sólidos, dentro del rango de
siempre**. No es un truco ad-hoc: el motor ya propaga el calor a través de los
muros (`runTemperatureSystem` solo mira distancia), así que sentir una fogata
tras un muro es coherente con la física que rige. La simplificación que sí
asumimos: el olfato entrega la posición exacta, no una dirección difusa.

Consecuencias visibles: herramientas, materiales, muros y árboles detrás de
sólidos dejan de percibirse (la memoria de lugares — decisión 2 — es quien
compensa), y los sólidos se tapan entre sí: tres árboles en fila son, desde
enfrente, un árbol. El test de juicio que contaba árboles pasó a disponerlos
en diagonal, porque su assert mide que ella cuenta lo que VE — y ahora ve
distinto.

## Decisión 2 — Memoria de lugares: recordar dónde estaba lo que importa

`PlaceMemory` (agent-core) guarda dónde vio por última vez **comestibles,
fuentes de calor y materiales portables**: `{entityId, kind, position,
lastSeenTick}` más las marcas de lo que era. Se alimenta en cada `think()`
desde la percepción — nunca del `WorldState` — con tope fijo de **24
entradas** (al superarlo se olvida lo visto hace más tiempo). Persiste en
`exportState()/importState()`; un guardado anterior se restaura sin recuerdos.

Las estrategias pueden apuntar a posiciones recordadas **solo cuando nada
adecuado está al alcance de los sentidos**: `comida-recordada:<id>` (hambre) y
`calor-recordado:<id>` (frío) caminan hasta el lugar con pasos generados al
planificar (`moveStep` + aborto en el primer paso que el mundo rechace — sin
pathfinding, ADR 0005) y al llegar buscan DE VERDAD con `findEntities`: la
memoria aporta el destino, actuar exige percibir. Si al llegar no hay nada, el
programa aborta con `no-candidates:remembered*`, el recuerdo **se invalida**
(`place.invalidated`) y el fallo alimenta al controlador de progreso con esa
razón — que es la honesta: hasta donde ella sabe, el recurso ya no existe.

La memoria también se corrige con lo que hizo su propio cuerpo (lo que ella
consumió, recogió o destruyó se olvida al observar el evento), pero nunca con
eventos ajenos: eso sería percepción gratis.

## Decisión 3 — El dolor como motivo: «ponerse a salvo»

El reflejo de dolor (un paso, ADR 0017) queda **exactamente igual**. Lo nuevo
es lo que pasa cuando el reflejo no alcanza: si la salud cae bajo el **50 %**
y un peligro conocido sigue al alcance, nace el objetivo `ponerse a salvo`
como cualquier señal del cuerpo — con `interpret.signal('health-low')` la
primera vez, igual que `temperature-low`, y soporte en el mock.

- **Prioridad 1.5** (+ urgencia ≥ 0.5 al cruzar el umbral): supera el máximo
  alcanzable por hambre (0.9+1), frío (0.95+1) y peticiones del usuario
  (1+0.8). Morirse ahora le gana a comer después.
- **Distancia segura = 2 (Chebyshev)**: la misma distancia prudente del fuego
  (calienta a 2, quema a 1). Exigir más pelearía contra calentarse, que
  ocurre exactamente a 2. Estar a ≥2 de todo peligro conocido ES estar a
  salvo: el daño del motor solo alcanza a los adyacentes, así que ahí la
  salud deja de bajar y el objetivo se completa.
- **Peligro conocido** = entidad (vista o recordada) cuyo tipo aparece en un
  hecho «estar pegado a un X hace daño». El conocimiento viene del cuerpo, no
  del motor: un peligro que nunca la lastimó no está en la lista.
- **Estrategia determinista**: elegir la celda libre más cercana a ≥2 de todo
  peligro y caminar hasta ella. Un plan que pisa un sólido visible o el
  peligro mismo se descarta al planificar (ya sabe que falla); lo que no ve
  lo dirá el mundo con `camino-bloqueado`. El éxito se mide con la percepción
  (¿quedó a salvo?), no con que el programa haya terminado prolijo.
- **Acorralada**: sin celda candidata viable, pide ayuda una vez y después
  suspende — la misma gramática de escalada que el frío (ADR 0008), pero
  **sin** el paso de crear una habilidad: apartarse no es una capacidad que
  falte, es espacio que no hay, y ninguna skill fabrica espacio.

**Evitar lo que duele, solo al planificar.** Los hechos de dolor se consultan
al generar programas (elegir la variante de camino que no TERMINA pegada a un
peligro, filtrar celdas de retirada): el intérprete de la DSL no se enteró de
nada y sigue igual de simple. `moveToward` dentro de un programa sigue
pudiendo pasar cerca de un fuego — para eso está el reflejo.

## Consecuencias

- La comida detrás del muro se sigue deseando (se huele) y la historia del
  MVP corre entera; los 15 E2E y las evaluaciones de skills pasan sin tocar.
- Un muro ahora esconde herramientas y materiales de verdad, y la mascota
  tiene con qué compensarlo: memoria. Ir a mirar donde recordaba algo — y a
  veces descubrir que ya no está — es conducta nueva observable.
- La mascota acorralada junto a un fuego ya no muere en silencio: se retira
  con un plan, o pide ayuda con la voz de siempre.
