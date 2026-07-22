# ADR 0085 — El tiempo y las condiciones envuelven al encargo

Fecha: 2026-07-22 · Estado: aceptada

## Contexto

Los pedidos del cuidador podían decir QUÉ hacer, pero no CUÁNDO: «esperá hasta
que amanezca», «cuando tengas dos troncos construí la fogata», «quedate acá diez
segundos», «si aparece un lobo alejate», «antes de cruzar agarrá el martillo»,
«después de comer traé el otro tronco». Cada frase mezcla la acción con una
relación temporal o condicional distinta —inicio, mantenimiento, fin, duración,
plazo, ventana, disparador— y no había forma general de representarlas.

Existían piezas sueltas que las rozaban: `mode: maintenance` (un estado que se
sostiene), `afterGoalId` (encargos hermanos en fila), el contador `ticks` de la
espera, y el álgebra de condiciones de [ADR 0083](0083-los-objetivos-son-predicados-del-mundo.md).
Pero no había reloj de día y noche, ni condición de inicio que suspendiera un
objetivo hasta que el mundo la cumpliera, ni plazo que lo hiciera fracasar.

El mundo se rige por ticks deterministas, no por milisegundos: un temporizador
externo rompería la reproducción y el guardado.

## Decisión

El tiempo y la condición son un **eje ortogonal al verbo**: una envoltura que se
puede poner sobre cualquier encargo sin que el encargo sepa de ella. Se
representa como dato (`GoalTemporal`), no como la frase, y se compone sobre el
estado meta «de fondo» del pedido de forma determinista.

**El reloj es del mundo y se deriva del tick.** `WorldClock` (día/noche en ticks)
es configuración del mundo: la hora se calcula desde `world.tick`, así que viaja
en los snapshots y dos sesiones con la misma semilla ven el mismo cielo. Un
mundo sin reloj es de día siempre. La percepción expone `timeOfDay` como un
hecho más, igual que la energía.

**El álgebra de condiciones gana tres hojas temporales**, verificables como las
demás: `time-of-day` (hora del día), `world-tick` (umbral de tick absoluto, la
base de los plazos) y `elapsed` (ticks desde que el objetivo se activó, la base
de las duraciones). El tick y la hora se leen de la percepción, que siempre los
trae; así una condición temporal nunca queda «sin reloj».

**Un `Trigger` es el vocabulario mínimo de «cuándo»**: hora del día, aparición o
ausencia de algo, tener cierta cantidad, un umbral del cuerpo. El modelo elige un
disparador; código determinista lo traduce a la condición que el mundo verifica.

La envoltura tiene cuatro ejes y se compila así:

- **inicio** (`startWhen`): se vuelve la `activation` del objetivo. Mientras no se
  cumpla, el objetivo espera **suspendido** y no compite por el turno; cada tick,
  `settleActivations` revisa el disparador y, apenas da `met`, lo despierta y fija
  el tick de arranque. Solo un `met` real despierta: un disparador que aún no se
  puede observar deja seguir durmiendo; uno que nunca ocurre, dormido para
  siempre.
- **fin** (`until`) y **duración** (`durationTicks`): le dan al objetivo un final
  propio. En un pedido sin trabajo (esperar) ESE es el final; en uno con trabajo,
  abren una segunda vía de cierre además de cumplir el encargo. Un objetivo con
  final propio es `achievement` aunque se lo haya pedido como mantenimiento.
- **plazo** (`deadlineTicks`): se vuelve una `failureCondition` sobre el tick
  absoluto. `settleDeclarativeGoals` la evalúa también sobre objetivos suspendidos,
  así un encargo que nunca llegó a arrancar igual fracasa cuando su plazo vence.

El «antes/después» entre acciones NO es envoltura temporal: «antes de A hacé B» es
la secuencia `[B, A]`, y se resuelve ordenando pasos con `afterGoalId` (ADR 0078).
La envoltura queda para relaciones con el reloj y con estados del mundo.

Las duraciones y plazos llegan del modelo en SEGUNDOS (como los dice el cuidador)
y se traducen a ticks en la frontera con `TICKS_PER_SECOND`, para que todo el
resto del sistema razone en la única unidad de tiempo del mundo.

## Consecuencias

Los seis ejemplos se representan sin ninguna regla que conozca sus palabras: la
espera hasta el amanecer se cierra con `time-of-day`; el objetivo que espera dos
troncos duerme y despierta con `holding`; los diez segundos se cuentan con
`elapsed`; el lobo dispara `entity-appears`; el plazo vence con `world-tick`; el
«antes/después» viaja como secuencia.

Todo persiste sin subir `SAVE_VERSION`: `activation`, `activatedAtTick` y la
envoltura viajan dentro del objetivo (que ya se serializa entero), y el reloj
dentro del mundo. Una espera guardada a mitad de camino se restaura y despierta
igual cuando el mundo cumple su condición.

El reloj, los eventos y la verificación son deterministas; el modelo solo elige
la envoltura y el disparador. Sin temporizadores externos: el único tiempo es el
tick.
