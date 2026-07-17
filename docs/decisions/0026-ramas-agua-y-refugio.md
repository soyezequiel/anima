# ADR 0026 — Ramas que caen, agua y refugio

Fecha: 2026-07-17 · Estado: aceptada

## Contexto

El mundo necesitaba más mundo: entidades con consecuencias reales, no
decoración. Tres tensiones concretas lo pedían:

- **La madera era finita.** La mascota se niega a talar árboles que cree
  necesitar (`will_not`, ADR 0019) — y esa negativa, que está bien, dejaba los
  troncos del mapa como único suministro. Negarse tenía razón y no tenía
  salida.
- **Todos los caminos eran equivalentes.** Sin terreno, la única geografía era
  el muro: o pasás o lo rompés. No había nada que obligara a *rodear*.
- **La única respuesta al frío era el fuego**, que exige pedernal y acepta
  quemarse. No existía la respuesta serena: un lugar donde simplemente dejar
  de perder.

## Decisión

Tres entidades, cada una como DATOS más a lo sumo un sistema determinista
chico, siguiendo la línea de `foodSource`/`heatSource`/`hazard` (ADR 0015).
La IA no participa en ninguna: el mundo decide todo.

### Ramas que caen (`itemSource`)

Un componente genérico de productor periódico: `{ intervalTicks,
nextSpawnAtTick, output }`, donde `output` es un arquetipo completo, como los
`drops`. Su sistema (`runItemSourceSystem`) es espejo del de alimento —
misma celda libre adyacente en orden determinista, compartida en
`freeAdjacentCell` — pero con saturación **por tipo**: mientras la rama
anterior siga tirada a ≤2 del árbol, no cae otra. Recogerla es lo que hace
que vuelva a producir.

`foodSource` no se reescribió sobre esto a propósito: vive en los guardados
(un snapshot restaurado lo trae tal cual) y su saturación es distinta (por
comestible, no por tipo). Generalizar hacia atrás habría sido tocar la física
de los mundos viejos para ahorrar veinte líneas.

Los árboles del escenario sueltan una rama cada 350 ticks (primer brote en el
350, posterior al horizonte de 200 de toda evaluación de skill, y distinto
del 400 del alimento para no competir por celdas). La rama es la de siempre:
portátil, herramienta débil. **La madera se renueva sin talar** — la negativa
del ADR 0019 ahora tiene una salida que no es derribar la fuente de comida.

### Agua (`water`)

Una marca en celdas-entidad `water`: **no es sólida pero no se camina**.
Moverse adentro falla con motivo propio (`water`), distinguible de un muro.
Que no sea sólida importa: no tapa la línea de visión (el agua se ve por
encima) y no participa de `isBlocked` — su regla es solo para el caminante.
Como toda celda ocupada, nada brota sobre ella (drops, crafteos, frutos).

El único cambio fuera de datos + regla de movimiento es el lookahead voraz de
`moveToward` en skill-runtime: las celdas visiblemente mojadas (`wet` en la
percepción) cuentan como sólidos, así los programas rodean la orilla sin
gastar intentos fallidos contra ella. No hizo falta tocar nada más profundo
del intérprete.

En el mundo jugable es un estanque de dos celdas en el borde norte del lado
de la comida: da forma a los caminos sin cerrar ninguno y lejos del corredor
de la historia del hambre.

### Refugio (`shelter`)

`{ range }`: anula la pérdida de calor corporal de los agentes a distancia
Chebyshev ≤ range. **No calienta, no quema.** Es la contraparte serena de la
fogata, y la diferencia es de naturaleza, no de grado: el fuego *recupera*
calor arriesgando quemadura; el refugio solo *deja de perder*. Vive dentro de
`runTemperatureSystem` (la pérdida se anula, el calor de un fuego en rango
sigue sumando); no hay sistema nuevo.

Es craftable: receta del mundo (`SHELTER_RECIPE` en `MVP_RECIPES`, como la
fogata — no una receta inventada), de carpintería: siempre sale algo, sin
pedernal ni chispa, porque no hay nada que encender. Cuesta 3 troncos (más
madera que la fogata) y deja 2 al romperse: la materia no crece (ADR 0008).
No es sólido: se entra, no se choca — y no puede volverse un muro que atrape
al movimiento voraz.

En agent-core, `pursueWarmth` gana la estrategia `shelter-approach`: después
de las de fuego (acercarse a uno, construir uno) y **solo si ve un refugio**
— un refugio hipotético no es una estrategia, y ofrecerla en mundos sin
refugio retrasaría inventar o pedir ayuda un ciclo entero para nada. Se pega
(sin la distancia prudente del fuego, porque no quema) y se queda. Que
después pida ayuda igual es correcto: paró la sangría, pero "recuperar
calor" sigue pendiente — ahora lo pide a salvo en vez de congelándose.

### Dónde están

- `food-behind-wall` (el mundo jugable): estanque en (7,0)–(8,0), refugio ya
  construido a calidad de catálogo en el rincón del taller (0,6), y los tres
  árboles sueltan ramas. El refugio no defusa el segundo acto del frío: la
  mascota prefiere el fuego (recupera calor) y recién cae al refugio si no
  queda nada que arda. Es la red, no el segundo acto.
- `practice-room`: muestra de refugio en el borde, como la silla y la
  antorcha — una conducta enseñada sobre un refugio necesita uno donde
  practicarse.
- `cold-night`: refugio en el rincón opuesto al fuego, fuera del alcance
  inicial de la mascota: las dos respuestas al frío conviven en el mismo
  mapa.

## Lo que queda deliberadamente afuera

- **La sed no existe.** El agua no se bebe ni genera una señal interna. Otra
  necesidad del cuerpo es otro `energy` completo (señal, objetivo,
  estrategias, muerte propia) y este ADR es de terreno, no de metabolismo.
- **No se nada.** El agua es infranqueable y punto. Nadar sería un modo de
  movimiento nuevo en el motor y en la DSL por una sola entidad.
- **Sin agua en los escenarios fríos.** Son mapas de 9×5 donde cada celda
  cuenta y las evaluaciones de abrigo dependen de caminos precisos; el agua
  es del mapa grande, donde hay espacio para rodear.
- **`cold-night-unlit` sigue sin refugio**: su historia es construir el fuego
  entero (talar, juntar, encender), y un refugio regalado la acortaría.
- **Inventar refugios, tampoco.** `shelter` no entró al esquema de
  `validateRecipe`: lo que Ánima puede inventar sigue acotado a lo de antes.
  Si algún día se abre, es una línea en el esquema — y una decisión aparte.
- **La saturación por tipo** hace que un árbol nunca acumule ramas: es
  economía de suelo, no un contador de recursos. Quien quiera un arsenal de
  ramas tiene que ir a buscarlas árbol por árbol.

## Consecuencias

- Los guardados viejos no cambian: los tres componentes solo existen en
  mundos NUEVOS (los escenarios los construyen al crear), y la receta del
  refugio llega a las partidas restauradas por el merge de
  `adoptNewWorldRules`, como toda física nueva.
- `moveToward` ya no malgasta intentos contra el agua que ve; contra la que
  no ve (sin línea de visión), el fallo `water` del mundo sigue enseñando.
- Nueva voz: `agua` y `refugio` en el vocabulario; 🌊 y 🛖 en el dibujo.
- El informe del frío tiene ahora dos finales buenos: el fuego que devuelve
  el calor y el refugio que evita perderlo — y la mascota sabe usar los dos.
