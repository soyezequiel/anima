# ADR 0060 — El renglón del ciclo no sobrevive al ciclo

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El cuidador manda una captura y una pregunta que se contesta sola:

> «corrigiendo una habilidad que falló · 0:52
>  ¡«alcanzar alimento bloqueado» v1 pasó con 100%!»
>
> ¿cómo va a corregir una habilidad que pasó el 100% de las veces?

No va. Las dos frases son ciertas por separado y describen **momentos
distintos**, mostrados como si fueran uno.

La tarjeta junta dos fuentes que corren en relojes diferentes:

- **El encabezado** sale del pedido al modelo que está en vuelo
  (`currentThought`), que el proveedor actualiza por su cuenta.
- **El renglón** sale de `skillDev`, un estado que se arma con los eventos del
  ciclo (`skill.requested`, `skill.created`, `skill.test.*`, `skill.promoted`).

Y `skillDev` **no se limpiaba nunca al terminar bien**. Un ciclo que promovía
dejaba su `phase: 'passed'` colgado para siempre. Cuando arrancaba el ciclo
siguiente, su encabezado —«corrigiendo una habilidad que falló»— aparecía junto
al «¡pasó con 100%!» del ciclo anterior.

Lo llamativo es que el caso hermano ya estaba resuelto: `skill.dev.plateau` sí
limpia, con un comentario que dice exactamente por qué —«dejarlo en
"corrigiendo" para siempre contaría un trabajo que ya no corre»—. El mismo
razonamiento valía para el final feliz, y se pasó por alto.

**No es un defecto de conducta.** Ánima nunca corrigió una habilidad aprobada:
`skill.test.passed` solo se emite cuando el veredicto es `promoted`, e
inmediatamente después el ciclo termina. Lo que falló fue el relato.

## Decisión

`skillDev` se limpia al promoverse, igual que en la meseta.

El renglón cuenta **lo que está pasando**; un ciclo cerrado ya no está pasando.
El logro no se pierde: el registro permanente vive en la tarjeta de hito del
chat y en el panel de Aprendizaje, los dos derivados de los eventos, que sí son
historia.

## Consecuencias

- Una tarjeta de pensamiento en vuelo ya no puede contradecirse a sí misma:
  mientras no haya ciclo, solo se ve el encabezado.
- Se perdió el instante de «¡pasó!» en el globo. Es irrelevante en la práctica:
  el globo solo se dibuja mientras hay una consulta en vuelo, y al promoverse
  el ciclo termina y el globo desaparece de todos modos.

## Nota de método

Una prueba existente afirmaba justo lo contrario: que al terminar la historia
`skillDev` siguiera ahí con `phase: 'passed'`. Estaba fijando el estado colgado
que causaba el defecto — un caso de prueba que documentaba el bug como si fuera
el contrato.

Al reescribirla intenté muestrear el progreso *durante* el ciclo, y no se puede:
con el proveedor simulado el ciclo entero ocurre dentro de un `stepOnce`, así
que las fases intermedias nunca son observables entre ticks. Por eso la prueba
vieja miraba el final — era lo único visible.

La cobertura se movió a donde el texto de verdad vive: pruebas unitarias de
`skillDevLine` y `skillDevPurpose`, que no tenían ninguna, cubriendo las cuatro
fases.
