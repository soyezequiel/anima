# ADR 0039 — El mundo no espera: pensamiento en vuelo y medición de consultas

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Mientras el modelo real pensaba, el juego entero se congelaba. El loop de la
sesión encadenaba el próximo tick recién al terminar el actual, y el tick
actual hacía `await agent.think(...)`: una consulta a Codex (hasta 240 s de
timeout) detenía la física, el dibujo del mundo y la sensación de vida. El
peor caso era el desarrollo de habilidades, que encadena varias consultas
secuenciales dentro de un solo think.

Además no había ninguna medición: no se sabía cuánto tarda cada tipo de
consulta (`interpret.command`, `skill.propose`, …) ni cuál domina el tiempo
de pensar. Cualquier optimización siguiente sería a ciegas.

## Decisión

1. **El mundo no espera al modelo.** `stepOnce` corre el think en una carrera
   contra un timer 0: un pensamiento local (sin consulta al modelo — la enorme
   mayoría de los ticks) resuelve en microtareas, gana siempre y el tick se
   comporta como antes, determinista. Una consulta real pierde la carrera y el
   pensamiento queda **en vuelo** (`pendingThink`): los ticks siguientes
   avanzan la física sin acción de la mascota — piensa parada, no congelada —
   y la intención se aplica en el tick en que la respuesta llega. En pausa no
   hay próximo tick, así que el resultado se consume solo al llegar.

   Nunca hay dos pensamientos en vuelo: el agente no es reentrante. Y la
   intención puede llegar a un mundo que cambió mientras pensaba: el motor ya
   era la puerta (valida cada intención al aplicarla), así que una acción que
   dejó de tener sentido simplemente no ocurre — la calidad no se lava.

2. **Un stepOnce concurrente se suma al paso en vuelo en vez de perderse.**
   El candado booleano anterior descartaba el llamado y hacía perder ticks a
   los llamados manuales (y a los tests) que coincidían con un paso lento.
   Ahora `stepOnce` devuelve la promesa del paso en curso.

3. **Cada consulta al modelo queda medida.** El agente consulta a través de
   una envoltura que registra el evento Dev `ai.timing` con `kind`, `ms` y
   `ok`. Del lado del servidor, `/ai/complete` y `/ai/complete/stream` loguean
   `durationMs` y `promptChars` (el servidor no conoce el `kind`: solo viaja
   el prompt). Con esos datos se decide la próxima optimización — qué kinds
   dominan, cuánto pesa el arranque en frío de `codex exec`, si conviene
   adelgazar prompts.

## Consecuencias

- Pensar deja de ser tiempo muerto: el mundo (fuegos, cultivos, energía,
  animaciones) sigue andando y el chat sigue vivo mientras la consulta corre.
- El tiempo ahora fluye durante el pensamiento: la energía baja mientras
  piensa. Es deliberado — una criatura viva no detiene su cuerpo para pensar.
- La percepción con la que se pensó puede quedar vieja; el costo es una
  intención ocasionalmente rechazada por el motor, no una acción inválida.
- Los eventos que el agente emite a mitad de un pensamiento en vuelo se
  ingieren en los ticks pasivos: el panel Dev y el chat los muestran antes de
  que la intención llegue.
- Pendiente (fuera de este ADR): sacar el bucle de `developSkill` del think
  único, sesión Codex persistente para matar el arranque en frío, y recortes
  de prompt guiados por las mediciones de `ai.timing`.
