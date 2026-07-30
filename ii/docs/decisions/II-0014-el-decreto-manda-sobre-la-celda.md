# II-0014 — El decreto manda sobre la celda, y el mundo narra lo que el dios pone

**Estado:** aceptado · **Decide:** el reparador del tramo K, con las dos salidas
medidas y el criterio publicado como árbitro · **Fecha:** 2026-07-30

## El problema

El tramo K hizo lo que faltaba desde el Hito 3: que `stepWorld` **materialice** las
`sueltas` del decreto y no sólo el banco de peces. Antes de eso el dios decretaba
90 cuerpos alrededor de la criatura y el mundo ponía 0, y de ahí colgaban casi
todas las paredes del Hito 5 —una orilla sin leña, dos arneses que plantaban la
escena a mano, seis secuencias de emergencia con la causa «EL MUNDO»—.

La materialización trajo tres agujeros, y los tres los encontró un adversario con
la salida corrida al lado.

### 1 · La celda final de una piedra sembrada dependía del camino

`abrirChunk` resolvía el choque «el decreto puso algo donde ya hay algo» con
`celdaLibreCerca`, o sea **preguntándole al mundo**. Eso ata la posición de una
piedra que el dios sembró a dónde estaba parada la criatura cuando el chunk se
abrió, y **rompe el criterio publicado del Hito 3**
(`docs/architecture/remake-anima-ii.md`):

> el mismo mundo explorado en dos órdenes **y con dos historias distintas entre
> medio** produce el mismo hash

Medido, con los mismos dos puntos visitados en los dos órdenes —los dos abren los
mismos 9 chunks y materializan las mismas 90 sueltas, y la criatura se normaliza a
la misma celda antes de hashear—:

```
sólo en [C,B] .... suelta:2:0:0@34,6
sólo en [B,C] .... suelta:2:0:0@35,6
hash [C,B] ....... 2f63c2f9eabd29b6
hash [B,C] ....... a4fc2879124b0d36
```

El comentario de `abrirChunk` declaraba el precio y después lo despachaba diciendo
que el criterio «es sobre el DECRETO —que no se mueve— y no sobre el mundo». Eso
reescribe el criterio más chico de lo publicado: el hash del que habla el documento
es `hashWorld`, la única función de hash que el paquete tiene. Es el movimiento que
la sección 5 del traspaso ya cobró una vez (regla: *volvé al texto que lo pidió y no
al documento intermedio que lo reformuló*).

### 2 · El banco de peces se materializaba encima de lo que hubiera

`materializarLoDecretado` pone el banco con `ponerCuerpo`, que no le pregunta a
`estorbo` —el guardián de la ley 8 que sí aplican `goTo`, `put` y `drop`—. Sobre
veinte semillas eso dejaba **2 partidas con `solidos-solapados`** entre el pozo y
una suelta (`pozo:6:0` con `suelta:6:0:3`, `pozo:7:1` con `suelta:7:1:4`), y sobre
las mismas veinte, en el tick 1, el banco encima de la criatura recién nacida.

### 3 · El mundo creaba y perdía materia sin narrarlo

Materializar sube `mass`, `nutrition` y `fuelEnergy` sin que ningún evento lo
respalde, así que `revisarConservacion` acusa `conservada-aumento`: **96 violaciones
en 400 ticks de caminata** (32 aperturas × 3 cuentas) y **21** cuando lo único que
materializa son los pozos que se reponen. Ésa es la razón entera por la que
`Partida` usa las cinco preguntas de `revisarEstado` y no las seis de
`revisarInvariantes`: la sexta gritaría en toda partida con dios, que son todas las
que importan, y con ella apagada el mundo no puede distinguir una materialización
legítima de una bomba de materia.

Y en el otro sentido: cuando ningún rumbo tenía lugar, la suelta **no entraba** y el
chunk quedaba anotado igual —o sea, se perdía para siempre— y el tick narraba
`["gasto"]` y nada más. El 0,13% que eso mide sólo se podía conseguir comparando el
mundo contra el decreto desde afuera.

## La decisión

### (a) La celda de una suelta es función pura del decreto

`celdaDelDecreto` recorre la celda decretada y después los ocho rumbos en orden
fijo, preguntando por las celdas que **el decreto** ya comprometió —el banco de
peces del chunk, las sueltas anteriores, y el banco del chunk vecino cuando el
rumbo cruza el borde—. **No mira `d.bodies` ni una vez.**

Que el banco entre en esa cuenta cierra el agujero 2 sin enseñarle nada al banco:
alcanza con que las sueltas sepan que esa celda es de él.

### (b) Cuando alguien está parado ahí, se corre el que estaba

Es el caso que ninguna función pura resuelve sola. `correrAlQueEstaba` lo manda al
primer rumbo libre que no sea la celda que cede ni ninguna otra del decreto,
soltando las relaciones espaciales con `olvidar` —para que la pila que tenía encima
baje un escalón en vez de quedar flotando— y llevándose lo que tuviera en la mano.

La alternativa era **descartar la suelta**, y no sirve: entonces su EXISTENCIA
depende del camino, que es la misma dependencia con otro disfraz.

Lo que se paga, dicho entero: **la celda de quien estaba parado ahí sí depende del
mundo.** No es lo mismo y por eso se elige así — la posición de la criatura ya
depende de su historia por definición (caminó), mientras que la de una piedra que el
dios sembró no dependía de nada y el tramo K la había atado al camino.

Consecuencia visible, y está afirmada en un test: **una criatura no puede quedarse
parada encima del banco de peces.** El mundo la corre una celda. Pescar sigue
funcionando —`aMano` es Chebyshev ≤ 1— y lo que se rompe es una escena de arnés que
era ilegal desde siempre (`plan/tests/el-pozo-y-la-mano.test.ts`, la fila
`sin cellHints|en el agua`).

### (c) Dos eventos nuevos, los dos `Narracion`

- **`{ k: 'decreta', q, cuanto }`** — lo que el dios puso en este tick, sumado por
  cuenta conservada. Uno por tick y por cuenta, igual que `gasto` y por lo mismo:
  abrir un chunk son ~10 cuerpos y reponer bancos toca hasta nueve pozos por actor.
  QUIÉN entró ya se puede decir sin evento (los ids son función del lugar y
  `EstadoDelDios.sembrados` dice qué chunks se abrieron); CUÁNTA materia entró no se
  podía decir de ninguna forma.
- **`{ k: 'perdida', id, en }`** — la pieza decretada que el mundo no pudo poner en
  ningún lado.

`revisarConservacion` suma lo decretado al techo, junto con lo que `convierte`
acredita. Son dos permisos distintos y se leen distinto: `convierte` mueve una
cuenta a otra dentro del mundo y por eso pide `acreditado ≤ gastado`; `decreta` trae
materia de afuera, porque el mundo es perezoso y el chunk que nadie visitó todavía
no existe. Contra el decreto no hay nada que comparar, así que lo único que el
invariante puede exigir es que el mundo lo DIGA.

Ninguno de los dos lleva firma: el chunk se abre antes de que se despache una sola
intención, y ponerle una obligaría a elegir a cuál de los actores que tienen ese
chunk en su vecindad culpar. El registro `SIN_FIRMA` de `world/src/step.ts` es un
`{ [K in Narracion['k']]: true }`, o sea que **agregar una `Narracion` sin
declararla ahí no compila** — la lista de `||` que había antes habría firmado estos
dos con la intención que estuviera despachándose.

## Lo que se midió después

| | antes | después |
|---|---|---|
| dos órdenes, dos historias | `2f63c2f9eabd29b6` ≠ `a4fc2879124b0d36` | **el mismo hash** |
| `solidos-solapados`, 20 semillas × 120 ticks | 2 de 20 | **0 de 20** |
| conservación, 400 ticks al este | 96 violaciones | **0** (el control ciego a `decreta` sigue dando 96) |
| conservación, 400 ticks al norte, sólo pozos | 21 violaciones | **0** (ciego: 21) |
| la suelta que no entra | `["gasto"]` | **`{k:'perdida', id, en}`** |

## Lo que NO cierra, y por qué

La sexta pregunta **sigue apagada en `Partida`**, y el motivo cambió de dueño. De los
tres caminos por los que el dios creaba materia sin declararla quedó uno, y ya no es
un problema de crónica:

```
t=30   nutrition 3310,72 → 3319,15
```

Es la extracción. La masa cuadra al bit —no hay una sola violación de `mass`—, así
que no es materia de más: es que `cuerpoDePozo` proyecta el stock con
`stock.yields` y `draw` puede entregar otra sustancia, y las dos no valen lo mismo
por kilo. **Declararlo con un `decreta` sería taparlo**: el evento diría «el dios
puso 8,43 de nutrición» cuando lo que pasó es que el banco mentía sobre lo que tenía
adentro. Lo que hace falta es que el banco proyecte lo que de verdad va a salir, o
que la pieza salga con la sustancia que el banco declara — y eso es `dios.ts` +
`@anima/oracle`, una decisión de modelo, y pide su propio ADR.

El `it.fails` con la medición nueva vive en
`perceive/tests/ataque-a-la-costura.test.ts`.

## Alternativas descartadas

1. **Apilar con `supportedBy`.** Es legal y es la peor: una pila que ninguna
   intención pidió es una relación espacial fabricada, y la ley 12 la LEE — dos
   cortezas apiladas por accidente tapan la de abajo del oxígeno.
2. **Descartar la segunda.** Segura para el conteo y mala para el diagnóstico: el
   propio juez mide que en algunas partidas la descartada era el encendible más
   liviano.
3. **Bajar el criterio del Hito 3 en el documento.** Requiere la firma del usuario y
   no hizo falta: el criterio publicado se cumple.
4. **Que el banco deje de ser un sólido.** Saca la clase entera de problema, y es un
   cambio de física con radio de explosión grande. Queda anotada por si el empujón
   al que se para encima del banco resulta molesto de jugar.
