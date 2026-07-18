# ADR 0043 — La práctica en segundo plano: el ciclo de habilidades sale del think

Fecha: 2026-07-18 · Estado: aceptada · Continúa el pensamiento en vuelo (ADR 0039) y su presupuesto biológico (ADR 0040)

## Contexto

El ADR 0040 acotó el costo en cuerpo de un pensamiento en vuelo, pero el peor
pensamiento seguía siendo un monstruo: el ciclo de desarrollo de habilidades
(`developSkill`) encadena hasta 8 versiones —una consulta al modelo por
versión, con un `skill.propose` real medido en 148 s— DENTRO de un solo
`think`. Durante esos minutos la mente entera estaba afuera: no contestaba el
chat, no atendía otras señales, no podía ni renombrarse. El presupuesto del
0040 la protegía de morir, pero al precio de sostener el tiempo casi todo el
ciclo: minutos de mundo quieto.

Además, en los ticks pasivos de cualquier pensamiento en vuelo la mascota
quedaba literalmente inmóvil: parada dentro de un fuego, esperando la
respuesta del datacenter para apartarse.

## Decisión

1. **El ciclo de desarrollo corre en segundo plano.** `runSkillDevelopment`
   aplica la misma carrera contra timer 0 del ADR 0039, un nivel más adentro:
   con un proveedor local (mock) el ciclo resuelve en microtareas, gana la
   carrera y el veredicto vuelve en el mismo think — los tests siguen
   deterministas. Con un proveedor real pierde la carrera y queda como
   `skillDevRun` en vuelo: el think devuelve enseguida, ella sigue viviendo
   (chatea, se mueve, atiende otros objetivos), y un think posterior consume
   el veredicto (`consumeSkillDevVerdict`) retomando el objetivo que lo abrió
   — con percepción fresca y verificando que el objetivo siga activo, porque
   el mundo pudo resolverse solo mientras practicaba.

   Nunca hay dos prácticas a la vez (una mente alcanza), y los tres caminos
   que abren el ciclo (hambre bloqueada, frío, enseñanza del cuidador) esperan
   el veredicto en vez de abrir otro. Un fallo del proveedor se relanza en el
   think que lo consume: para la sesión es idéntico a un think fallido (misma
   cuenta de errores, misma pausa a los tres).

2. **La práctica tiene el mismo presupuesto biológico del ADR 0040.** La
   sesión mira `agent.skillDevInFlight`: mientras dura el crédito
   (`THINK_TICK_BUDGET`), la vida sigue entera; agotado, el tiempo se
   sostiene hasta el veredicto. Sin esta cota, sacar el ciclo del think
   habría reabierto la muerte por inanición que el 0040 cerró — la energía
   drenando durante minutos de práctica.

3. **Los reflejos no piensan.** En los ticks pasivos de un pensamiento en
   vuelo, la sesión le pide al agente `reflexIntent(percepción fresca)`: solo
   el reflejo de apartarse del daño (ADR 0041). Es seguro por construcción —
   no toca objetivos, actividad ni colas. La actividad en curso NO continúa
   desde afuera, a propósito: el think en vuelo la retomará con su propia
   percepción, y pisarla desde los ticks pasivos duplicaría pasos del
   programa y fabricaría fallos falsos que terminan como regresiones de uso
   real.

4. **El paso respira.** Cuando hay mente afuera, `runStep` cede una
   macrotarea (`setTimeout 0`) antes de avanzar: las carreras contra timer 0
   y las promesas del proveedor necesitan que el event loop avance. En el
   navegador cada tick ya nace de un timer y esto no cambia nada; protege a
   los bucles apretados de `stepOnce` (los tests), donde la cascada de
   microtareas puede matar de hambre a esos timers para siempre.

## Consecuencias

- Aprender deja de secuestrar la mente: durante una práctica de minutos ella
  contesta, camina, come si puede, y anuncia el resultado cuando llega.
- La promoción a la biblioteca ocurre DENTRO del ciclo (como siempre); lo que
  el veredicto consume es la vuelta al objetivo: estrenar la habilidad,
  completar o fallar la meta, contarlo en el chat.
- Los eventos del ciclo (`skill.created`, `skill.test.*`) van llegando al
  panel Dev en vivo, tick a tick, mientras practica.
- Mientras la práctica es para el objetivo seleccionado (p. ej. el hambre que
  la abrió), ese objetivo espera en null cada tick: no actúa para él, pero
  cualquier otro objetivo o pedido sigue vivo. Es deliberado y simple; si
  algún día molesta, el selector podría saltear objetivos con práctica en
  vuelo.
