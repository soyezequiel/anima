# ADR 0079 — Un veto sabe de qué forma hablaba

Fecha: 2026-07-19 · Estado: aceptada · Corrige el alcance del ADR 0042

## Contexto

En una partida real del mapa «El vado», Ánima le pidió al modelo una receta de
puente. El juez (ADR 0042) la rechazó, y el rechazo era bueno:

> «No: un puente es una obra, no una cosa. Proponelo como OBRA, con un plano y
> recetas para las piezas que vas a colocar por separado.»

El modelo obedeció. Contestó dos veces con un `blueprint`: el plano del puente y
la receta del tramo que se coloca. Exactamente lo que se le había pedido.

Y las dos veces el agente lo tumbó sin mirarlo, con este motivo:

```
recipe.rejected  { source: 'memory',
  reason: 'no tiene sentido construir puente: un puente es una obra, no una cosa…' }
```

El veto se guardaba contra el NOMBRE —`no tiene sentido construir puente`— y
nada más. Cuando la corrección volvió con el mismo nombre, la memoria del
rechazo bloqueó **la corrección que ese mismo rechazo había pedido**. Ánima
quedó girando en el lugar hasta quedarse sin crédito, y le dijo al cuidador «no
sé qué construir» habiendo tenido la respuesta correcta en la mano dos veces.

La causa es de alcance, no de criterio. El ADR 0074 ya había establecido que al
juez se le pregunta algo **distinto** según lo que tenga delante: de una cosa
suelta puede decir «eso es una obra»; de una pieza de obra, esa objeción no
tiene sentido. Si la pregunta depende de la forma, la respuesta también — y el
veto es una respuesta.

## Decisión

**El veto se guarda con la forma que se juzgó.** Dos hechos hermanos:

```
no tiene sentido construir <tipo> como cosa: <motivo>
no tiene sentido construir <tipo> como pieza de una obra: <motivo>
```

Ninguno es prefijo del otro, así que buscar uno nunca encuentra al otro por
accidente — que era exactamente la forma del error.

Al juzgar, se busca el veto **de la forma que se está proponiendo**. Un «no» a
la cosa suelta deja intacto el camino de la obra, y viceversa.

Se sigue reconociendo el formato viejo (`no tiene sentido construir <tipo>:`)
como veto de cosa suelta: un guardado anterior no debería perder lo que ya había
aprendido, y en la forma vieja solo podía haberse juzgado una cosa.

## Consecuencias

Un rechazo vuelve a ser lo que debía ser: información sobre un camino, no una
condena sobre un nombre. «Puente» puede estar vetado como objeto y seguir siendo
construible como obra, que es justo lo que el juez quería decir.

Lo que no cambia: el veto sigue siendo persistente, sigue viajando en la memoria
y en el legado, y sigue ahorrando la consulta. Lo que se acotó es su alcance, no
su fuerza.

La regresión vive en `packages/agent-core/tests/recipe-judge.test.ts`, y prueba
la propiedad que faltaba —que los dos vetos son hermanos independientes— y no el
puente, que fue solo el mensajero.
