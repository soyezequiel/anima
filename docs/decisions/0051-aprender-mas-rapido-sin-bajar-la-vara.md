# ADR 0051 — Aprender más rápido sin bajar la vara

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El ciclo de desarrollo de habilidades hace hasta **8 consultas secuenciales** al
modelo real, y cada una cuesta **~1:13 de reloj** mientras el mundo sigue
andando y el cuerpo gastándose. En la partida observada, `conseguir-calor`
necesitó 3 versiones con el calor cayendo de 11 a 0: la mascota murió esperando
sus propias iteraciones.

La estructura de costos es asimétrica y no se estaba explotando:

- **La consulta es carísima**: arranque del proveedor + razonamiento del modelo
  + tokens de salida. El razonamiento y el arranque dominan.
- **La evaluación es gratis**: los mundos imaginados corren locales, en
  milisegundos, decenas de casos por versión.

Es decir: el cuello de botella son los **viajes**, no las ideas ni las pruebas.
Y el ciclo pagaba un viaje entero por cada idea.

## Decisión

Dos palancas. Ninguna toca al evaluador, que es donde vive la calidad
(ADR 0020/0030): la vara de promoción sigue en 100%, los mismos mundos, las
mismas regresiones.

### 1. Dos estrategias por consulta

`skill.propose` y `skill.revise` invitan al modelo a incluir una **segunda
estrategia de verdad distinta** (`altProgramJson`), opcional. El viaje se paga
una vez; la segunda idea cuesta solo sus tokens de salida. Ambas se validan y
se miden; cada una consume un intento del presupuesto — **el presupuesto no
cambia, los viajes sí**: en el mejor caso, la mitad.

Reglas de la alternativa:

- **Es un regalo, no un contrato.** Si no viene, no pasa nada. Si viene rota o
  repetida, se descarta en silencio — la retroalimentación de forma y de
  repetición la gobierna la propuesta PRINCIPAL, como siempre. Tirar una
  principal buena por una alternativa rota sería pagar el viaje dos veces.
- **Distinta de verdad.** El prompt lo exige: la misma idea con otros números
  muere en los mismos mundos, y el chequeo de repetidos ya la rechazaría.
- Si la alternativa es la que pasa, gana la alternativa. El evaluador no sabe
  cuál era cuál, y así debe ser.

### 2. Corte por meseta

Si ya hay una versión que funciona en la mayoría de los mundos
(`keepMin: 0.6`, alineado con el umbral provisional del ADR 0050) y
**`patience: 2` versiones seguidas no mejoraron estrictamente la mejor tasa**,
el ciclo corta en vez de gastar los viajes restantes.

- Cortar no es rendirse: la mejor versión queda **provisional** (ADR 0050) y el
  objetivo puede reabrir el ciclo — con la historia entera cargada (ADR 0028) —
  cuando el motivo vuelva a apretar.
- **Sin nada decente en la mano, la meseta no corta.** Con 0% no hay nada que
  conservar: cortar ahí sería rendirse de verdad, y eso sigue prohibido.
- La mejora exigida es **estricta**: empatar a la mejor no es avanzar.
- Se anuncia (`skill.dev.plateau`, tarjeta ámbar «Dejo de pulirla por ahora»):
  la espera se cuenta, no se disimula (ADR 0045).

### Aritmética del caso observado

`conseguir-calor` tardó 3 viajes (~3:40). Con las dos palancas, el mismo
resultado cuesta 1–2 viajes (~1:15–2:30) — y si el modelo se estanca en 95%,
el corte por meseta lo deja de pagar después de dos intentos sin mejora, con
la provisional ya cubriendo el frío desde el primer viaje decente.

## Consecuencias

- Menos tiempo entre "tengo frío" y "tengo algo que hacer al respecto", sin
  cambiar qué se considera probado.
- El modelo puede ignorar la invitación (una sola estrategia) y todo funciona
  exactamente como antes; el mock y los proveedores guionados no cambian.
- Riesgo aceptado: una alternativa de relleno gasta un intento del presupuesto
  en algo mediocre. Se mitiga en el prompt («si solo hay una idea buena, omite
  los campos») y lo acota el chequeo de repetidos.
- Riesgo aceptado: el corte por meseta puede dejar una habilidad en 95% que un
  noveno intento habría llevado a 100%. Es reversible por diseño — el ciclo se
  reabre con la historia — y lo compra el tiempo de vida que ahorra.
- De paso se arregló que las tarjetas «provisional» no aparecían en el feed:
  solo se mostraban los finales limpios (aprobada/rechazada). Las decisiones a
  medias también se cuentan.
