# ADR 0040 — Pensar cuesta ticks, no segundos: presupuesto biológico del pensamiento en vuelo

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El ADR 0039 hizo que el mundo no espere al modelo: un pensamiento que consulta
al proveedor real queda en vuelo y la física sigue andando — la energía baja
mientras piensa, deliberadamente. Pero la aritmética de una corrida real
demostró que esa decisión, sin cota, es una sentencia de muerte:

- Una vida en `food-behind-wall` son 300 ticks sin comer (energía 15, drenaje
  0.05). A velocidad 1 (4 ticks/s), **75 segundos de reloj**.
- Con el proveedor `claude`, un solo `skill.propose` midió **148 s**
  (`ai.timing`), y la `skill.revise` siguiente quedó en vuelo hasta la muerte.
  El ciclo de `developSkill` (hasta 8 versiones dentro de UN think) puede
  costar 20+ minutos de quietud absoluta.

La mascota murió de inanición en el tick 309 sin haber podido terminar la
segunda versión de su primera habilidad. No fue mala suerte: con esos números
no puede ganar nunca. La latencia del datacenter se estaba cobrando en cuerpo.

Además el cambio de 3 semillas fijas a 20 muestreadas (ADR 0030) multiplicó
los casos de evaluación (2 escenarios × 20 semillas), y el prompt de
`skill.revise` listaba los 40+ mundos uno por uno — casi todos repitiendo el
mismo fallo — inflando una consulta que ya competía contra el hambre.

## Decisión

1. **Cada pensamiento en vuelo tiene un presupuesto biológico**:
   `THINK_TICK_BUDGET = 20` ticks (GameSession), contando el tick que lo
   lanzó. Mientras el presupuesto dura, todo sigue como en el ADR 0039: la
   física avanza y ella piensa parada. Agotado el presupuesto, **la
   simulación se sostiene** — el tick no avanza — hasta que la respuesta
   llegue. La UI, el chat y la ingestión de eventos del agente siguen vivos
   durante la espera: se congela el tiempo del mundo, no el juego.

   No es una pausa de la física ni un metabolismo selectivo: es la misma
   detención del tiempo que el botón de pausa del cuidador, aplicada sola
   mientras la mente está afuera. Ningún tick que ocurre es deshonesto; lo
   que se acota es cuántos ticks puede costar una consulta cuya duración
   depende de la infraestructura y no de la mascota. Pensar sigue costando
   cuerpo — hasta 20 ticks es un costo real — pero un costo que la
   simulación decide, no la cola de un datacenter.

2. **El prompt de `skill.revise` agrupa los mundos**: en lugar de listar los
   40+ casos uno por uno, se agrupan por escenario + veredicto +
   observaciones con semillas de ejemplo («food-behind-wall: FALLÓ en 20
   mundos — …»). La evidencia es la misma; la consulta es más corta y la
   respuesta llega antes.

## Consecuencias

- La latencia del proveedor ya no puede matar de hambre: el ciclo entero de
  desarrollo de habilidades (una consulta por versión, todas dentro de un
  think) cuesta como mucho el presupuesto de ese think, no minutos de drenaje.
- Con el mock nada cambia: resuelve en microtareas, gana la carrera del tick
  y nunca entra en vuelo (los tests siguen deterministas).
- Durante una consulta larga, el mundo visible se queda quieto tras ~5 s de
  velocidad 1. Es el costo elegido: mejor un mundo que espera con ella que un
  mundo que la entierra por pensar.
- El presupuesto vale por pensamiento, no por consulta individual: un think
  que encadena varias consultas (developSkill) comparte los 20 ticks. Si el
  desarrollo sale del think único (pendiente del ADR 0039), cada tramo
  tendrá su propio presupuesto y esta cota se vuelve aún menos visible.
