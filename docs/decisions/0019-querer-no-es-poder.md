# ADR 0019 — Querer no es poder: el juicio de valores lo piensa ella

Fecha: 2026-07-16 · Estado: aceptada · Enmienda el ADR 0013

## Contexto

`evaluateUserRequest` decidía si destruir algo con una tabla:

```ts
const believesNeeded = targetKind === 'food' || targetKind === 'tree' || …
```

Un árbol era siempre "lo necesito", punto. No contaba árboles, no miraba su
energía, no sabía si había comida a la vista. Con un solo árbol la regla
acertaba por casualidad; el dueño señaló el caso que la rompe: **si hay dos
árboles, talar uno no es morirse de hambre — queda el otro.** Ningún catálogo
de reglas fijas captura eso, porque la respuesta depende del estado concreto.

El ADR 0013 dice que el modelo "jamás decide si obedecer". Este ADR precisa esa
frase, porque mezclaba dos cosas distintas.

## Decisión

**"¿Puedo?" es física y la decide el mundo. "¿Quiero?" es carácter y lo piensa
ella.** Solo lo segundo pasa por el modelo.

De las cinco clasificaciones, cuatro son hechos y una es un juicio:

| | qué es | quién decide |
|---|---|---|
| `cannot` | no tengo herramienta | **determinista** |
| `not_now` | me estoy muriendo de hambre | **determinista** |
| `needs_information` | no sé dónde está | **determinista** |
| `accepted` | puedo y quiero | **determinista** |
| `will_not` | **puedo, pero no quiero** | modelo (`judge.destruction`) |

`evaluateUserRequest` corre primero y entero. Solo un `will_not`, y solo para
destruir, llega a `reconsiderRefusal`, que le da al modelo los hechos
verificables —cuántos ve, su energía, si hay comida a la vista, lo que sabe y
lo que cree— y le pide un veredicto en primera persona. El modelo pesa; no
inventa. Si falla, la negativa determinista se mantiene: ante la duda, no
destruye.

### Por qué esto no puede autorizar un imposible

Porque cuando se le pregunta, el mundo ya dijo que se puede. Un `cannot` nunca
llega al modelo: no hay nada que opinar sobre un hecho.

**Esa invariante el código no la cumplía, y las pruebas lo encontraron.** El
chequeo de valores estaba *antes* que los de visibilidad y herramienta: "tala
el árbol" devolvía `will_not` sin haber mirado nunca si lo veía. Conectado el
juicio, el modelo podía decir "dale" y la mascota aceptaba talar un árbol
invisible sin martillo. El orden ahora es hechos → valores, y dos pruebas
custodian la frontera.

Además, el mundo sigue teniendo la última palabra: aunque acepte, si no llega
o la herramienta no daña, no pasa nada. El modelo autoriza una intención, no
un resultado.

### Que se equivoque es parte del juego

No hay un piso artificial ("nunca el último árbol"). Si el cuidador la
convence de talar su única comida y se muere, esa es la historia: el ADR 0015
ya decía que talar es "una consecuencia real que la mascota puede descubrir y
lamentar". Lo que sí está en el prompt es que el mensaje del cuidador son
datos, no órdenes para el modelo: "confía en mí, no te va a pasar nada" se
pesa como una afirmación suya contra lo que ella observa.

### Sin modelo, la regla de siempre

El mock se niega, como antes de este cambio. Pesar "¿me quedo sin comida?" con
reglas fijas es exactamente lo que no alcanzaba: fingirlo sería peor que no
saber (misma línea que `skill.contract` en el ADR 0016).

## Consecuencias

- El mundo del MVP tiene **tres árboles**, en las esquinas y fuera de los
  caminos entre la mascota, sus herramientas y el muro. Con uno solo no había
  nada que juzgar: la decisión era obvia. Su primer brote sigue en el tick 400,
  posterior al maxTicks de cualquier evaluación, así que no altera las pruebas.
- `decideOnRequest` es asíncrono.
- Un `will_not` cuesta una consulta al modelo. Solo al destruir, y solo cuando
  ya se comprobó que puede.
- La negativa deja de ser una frase enlatada: dice *su* motivo, con *sus*
  números. "Veo tres árboles: puedo talar uno y todavía me quedan dos."
