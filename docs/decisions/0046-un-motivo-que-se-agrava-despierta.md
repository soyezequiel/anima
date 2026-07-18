# ADR 0046 — Un motivo que se agrava despierta lo que se abandonó

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Una partida observada de doce generaciones terminó con **once muertas de
hipotermia**. Los doce informes de legado tenían la misma firma:
`activeGoal: null` y `"recuperar calor"` en `unfinishedGoals`. No murieron
peleando y perdiendo: murieron **dormidas**, con el motivo vivo y ninguna meta
activa.

La cadena era esta:

1. El objetivo de calor agota sus estrategias y llega a `ask-help`.
2. La vez siguiente se suspende, con `reactivateWhen` = *"nueva información del
   usuario o algo que dé calor"*.
3. `reactivateWhen` era **texto libre que nadie leía**: se escribía en
   `GoalManager.suspend` y no había ningún parser que lo evaluara.
4. Existían exactamente dos reactivaciones en todo el código: **alimento nuevo
   visible** (solo hambre) y **el cuidador enseñando un hecho**.

Es decir: un objetivo de supervivencia suspendido solo podía despertarlo el
cuidador hablando. Que el frío empeorara no despertaba nada; que apareciera una
fogata, tampoco — el chequeo de "alimento nuevo" no tenía gemelo para el calor.

El ADR 0039 promete que *el mundo no espera*. El frío sí esperaba: esperaba al
cuidador. Y el ADR 0028 (buscar antes de rendirse) quedaba anulado por la vía de
los hechos, porque rendirse era definitivo.

## Decisión

1. **Suspendido no es cerrado.** Un objetivo del cuerpo suspendido se reactiva
   solo, sin intervención del cuidador, por dos caminos — y los dos son
   información NUEVA, no un reintento ciego:

   - **Alivio nuevo a la vista**: una entidad que resuelve el motivo y que no
     estaba entre las que ya había descartado al rendirse (una fogata o un
     refugio para el frío; un comestible para el hambre).
   - **El motivo se agravó**: la señal cayó al menos `WORSENED_MOTIVE_DROP`
     (10% del máximo) por debajo del valor que tenía al suspenderse. Que el
     cuerpo esté peor que cuando dijo "no puedo" es evidencia sobre el mundo:
     esperar no era una estrategia.

2. **El umbral no es cero, a propósito.** Reactivar en cada tick sería el bucle
   que el ADR 0028 prohíbe. Cada reactivación re-arma la marca en el valor
   nuevo, así que los reintentos se espacian solos: a lo sumo uno cada 10% de
   deterioro, y se aceleran a medida que el cuerpo se apaga.

3. **Revivir por deterioro devuelve UN intento de diseño de habilidad.** Sin
   esto, el objetivo revivía con el crédito ya gastado, corría las mismas
   estrategias, fallaba igual y volvía a pedir ayuda: reintentar lo mismo. Se
   devuelve uno solo y no se borra la cuenta, así que el techo se mantiene y el
   crédito se recupera al ritmo al que el motivo aprieta, no gratis.

4. **Reactivar limpia las estrategias prohibidas.** Lo que falló con 40% de
   calor no está condenado a fallar con 20%, y el mundo entretanto cambió.

5. **La regla vale para el hambre igual que para el frío.** El defecto era el
   mismo en las dos señales del cuerpo; que solo se manifestara en el frío es
   un accidente del mundo de prueba, no una diferencia de diseño.

Fuera de alcance: `reactivateWhen` sigue siendo una frase para la UI y el
informe de legado. Esta decisión no la convierte en condición evaluable — la
reemplaza por chequeos explícitos en el dueño de cada señal. Si algún día hay
muchos motivos, ahí sí conviene una condición estructurada.

## Consecuencias

- Una mascota puede morir de frío, pero ya no puede morir **dormida**: mientras
  el motivo siga vivo, el objetivo vuelve.
- El cuidador deja de ser el único despertador. Su palabra sigue reactivando
  (eso no cambió), pero ya no es la única vía.
- Aparece un modo de fallo nuevo y aceptado: reintentar una tarea imposible cada
  10% de deterioro gasta ticks y, con proveedor real, consultas. Es el precio de
  no rendirse, y está acotado por el umbral.
- El evento `goal.reactivated` distingue el motivo (`'apareció algo que da
  calor'` vs `'el motivo empeoró desde que se rindió'`), así que la próxima
  partida se puede auditar sin leer el código.
- Los tests de `cold.test.ts` fijan los cuatro casos: revive por deterioro,
  revive por alivio nuevo, NO revive por una caída menor al umbral, y al revivir
  recupera un intento de diseño cuando el bloqueo es de capacidad.
