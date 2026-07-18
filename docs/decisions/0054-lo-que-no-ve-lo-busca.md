# ADR 0054 — Lo que no ve, lo busca

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

La generación 3 murió de frío **parada**.

En una partida real repitió tres veces, con cien ticks entre medio:

> «Tengo frío y no veo nada que dé calor. ¿Puedes ayudarme?»

Después suspendió «recuperar calor» con el motivo *sin estrategias viables tras
pedir ayuda*, y esperó. El calor bajó de 20 a 0 y se murió. En el mapa había un
refugio y tres pedernales.

La causa es la intersección de dos decisiones que por separado están bien:

1. **La vista exige línea despejada** (ADR 0025). Un refugio a diez celdas
   detrás de un muro no está en la percepción: para ella, no existe.
2. **Todas las estrategias del cuerpo arrancan con `findEntities` sobre lo
   visible.** `WARMTH_APPROACH_PROGRAM`, `SHELTER_APPROACH_PROGRAM`,
   `DIRECT_APPROACH_PROGRAM`: las tres preguntan «¿qué veo?» y abortan con
   `no-candidates` si la respuesta es nada. La única excepción era el recuerdo
   (`calor-recordado`, `comida-recordada`), que solo sirve para lo que ya vio
   alguna vez.

Resultado: «no lo veo» era **el final del camino**. Nunca daba un paso para
mirar. Y la escalada que venía después —pedir ayuda, suspender— es correcta
para un mundo donde el recurso no existe, pero se estaba aplicando a un mundo
donde el recurso existía y estaba a diez celdas.

El mismo agujero estaba en la comida, con la misma forma exacta.

## Decisión

**Después de pedir ayuda y antes de rendirse, sale a buscar.**

Tres programas nuevos (`SEEK_FOOD_PROGRAM`, `SEEK_WARMTH_PROGRAM`,
`SEEK_SHELTER_PROGRAM`), cada uno un `explore` con `until: sees(query)`
—recorre lo menos visitado hasta VER lo que busca— seguido de la aproximación
de siempre. Si el `explore` se agota sin encontrar, el programa sigue y la
aproximación aborta por `no-candidates`: buscar y no encontrar es una respuesta
honesta, y es una que solo se puede dar **después de haber buscado**.

### Dónde va, y por qué ahí

Va **después** de `ask-help`, condicionado a `progress.helpRequestedFor(goal)`.
Esto no es un detalle de implementación: fue el primer intento y estaba mal.

Poner la búsqueda antes del aviso retrasa que el cuidador se entere —de 12
ticks a más de 40— y eso rompió 17 pruebas que pinchaban, con razón, el momento
del aviso. Que el cuidador sepa temprano que la mascota está en problemas es
información valiosa, y caminar cuesta energía que un cuerpo en rojo no tiene de
sobra.

Lo que había que reemplazar no era el aviso. Era **el callejón sin salida que
venía después**.

## Consecuencias

- Rendirse ahora tarda más (hasta 40 pasos por búsqueda). El helper
  `suspendUntilGivenUp` de las pruebas de frío subió su presupuesto de 30 a 300
  ticks. La suspensión sigue llegando: buscar no es un bucle eterno, y hay una
  prueba que lo fija.
- La secuencia completa del frío queda: skill utilizable → acercarse a lo
  visible → construir fuego → recuerdo → inventar → **pedir ayuda** →
  **buscar calor** → **buscar techo** → suspender.
- El costo es energía gastada caminando en un mundo donde de verdad no hay
  nada. Es un costo que se paga una vez por objetivo (los rótulos quedan
  prohibidos al fallar) y compra el caso contrario: un mundo donde sí había, y
  ella no lo sabía.
- No toca la exploración de los encargos (`gatherAndCraftProgram` ya exploraba
  con `searchFirst`): esa vía nunca tuvo el agujero.
