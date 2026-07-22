# Tiempo y condiciones: pedidos temporales del cuidador

Cómo Ánima entiende «esperá hasta que amanezca», «cuando tengas dos troncos
construí la fogata», «quedate acá diez segundos», «si aparece un lobo alejate»,
«antes de cruzar agarrá el martillo» y «después de comer traé el otro tronco» —
sin conocer ninguna de esas frases. Decisión: [ADR 0085](../decisions/0085-el-tiempo-y-las-condiciones-envuelven-al-encargo.md).
Se apoya en el álgebra de condiciones de [ADR 0083](../decisions/0083-los-objetivos-son-predicados-del-mundo.md).

## Principio

El tiempo y la condición son un **eje ortogonal al verbo**. «Traé el tronco» y
«traé el tronco cuando amanezca» son el mismo trabajo con una envoltura distinta.
Por eso la envoltura vive aparte, como dato estructurado, y se **compila** sobre
el estado meta de fondo del pedido. El modelo interpreta la frase; el reloj, los
eventos y la verificación son **deterministas**. No hay temporizadores externos:
el único tiempo es el `tick` del mundo.

## Las piezas

### 1. El reloj del mundo (`sim-core/clock.ts`)

`WorldClock { dayTicks, nightTicks, offset? }` es **configuración del mundo**, no
estado mutable aparte. La hora se **deriva** de `world.tick`:

```
timeOfDay(world) = phaseTick(clock, tick) < dayTicks ? 'day' : 'night'
```

- Viaja en los snapshots (está en `WorldState`), así un guardado restaura la hora
  exacta sin persistir nada más, y dos sesiones con la misma semilla ven lo mismo.
- Un mundo **sin** reloj es de día siempre: los escenarios previos quedan intactos.
- La `Perception` expone `timeOfDay` como un hecho más, igual que la energía.
- `TICKS_PER_SECOND` traduce segundos (como los dice el cuidador) a ticks.

### 2. Tres hojas temporales en el álgebra (`agent-core/goal-conditions.ts`)

Se suman a las condiciones verificables existentes, con la misma evaluación pura
y tri-estado (`met` / `unmet` / `unknown`):

| Hoja | Qué mide | De dónde |
|------|----------|----------|
| `time-of-day` | hora del día (día/noche) | `perception.timeOfDay` |
| `world-tick` | umbral de tick absoluto (**plazos**) | `perception.tick` |
| `elapsed` | ticks desde la activación (**duraciones**) | `perception.tick − activatedAtTick` |

El tick y la hora se leen de la percepción, que siempre los trae: una condición
temporal nunca queda «sin reloj». `elapsed` es `unknown` mientras el objetivo no
haya arrancado — nunca miente «ya pasaron 0».

### 3. Los disparadores (`Trigger`)

El vocabulario mínimo de «cuándo», cerrado y observable. `conditionForTrigger`
lo traduce a la condición que el mundo verifica:

| `Trigger` | Condición | Ejemplo |
|-----------|-----------|---------|
| `time-of-day` | `time-of-day` | «hasta que amanezca» |
| `entity-appears` | `entity-present present:true` | «si aparece un lobo» |
| `entity-gone` | `entity-present present:false` | «hasta que se aleje» |
| `holding` | `holding count:n` | «cuando tengas dos troncos» |
| `stat` | `self-stat` | «cuando tengas hambre» |

### 4. La envoltura (`GoalTemporal`) y su compilación

```ts
interface GoalTemporal {
  startWhen?: Trigger      // inicio: suspende hasta cumplirse
  until?: Trigger          // fin: da por terminado el objetivo
  durationTicks?: number   // duración: se sostiene N ticks desde que arranca
  deadlineTicks?: number   // plazo: fracasa si no cerró a tiempo
}
```

`compileTemporalGoal` la compone sobre el `baseSuccess` del pedido (determinista,
pura):

- **`startWhen`** → `goal.activation`. No toca la finalización.
- **`until` / `durationTicks`** → dan un final propio. En un pedido sin trabajo
  (esperar) ESE es el fin (se ancla la posición: esperar es esperar *acá*); en uno
  con trabajo, abren una segunda vía de cierre (`any(encargo, condición)`). Un
  objetivo con final propio es `achievement` aunque se pidiera como mantenimiento.
- **`deadlineTicks`** → `goal.failureCondition` sobre `world-tick` (tick de
  aceptación + plazo).

### 5. El ciclo de vida (`agent-core/agent.ts`)

- **Suspensión**: al crear el objetivo, si su `activation` no se cumple todavía,
  nace **suspendido** con motivo `AWAIT_CONDITION_REASON` y no compite por el turno.
- **Despertar** (`settleActivations`, cada tick, antes de elegir objetivo): evalúa
  la `activation`; con `met`, activa el objetivo y fija `activatedAtTick`. Solo un
  `met` real despierta.
- **Cierre** (`settleDeclarativeGoals`): la `successCondition` compilada cierra el
  objetivo; la `failureCondition` lo hace fracasar — **también estando suspendido**,
  así un encargo que nunca arrancó igual vence su plazo (`goal.failed`).

Todo se mide con `conditionContext`, un único armador de contexto que reúne lo
acotado al objetivo (bindings, ausencias, hechos, contadores, `activatedAtTick`) y
lo del mundo (percepción, planos, biblioteca), para que ninguna condición se
evalúe sin reloj según desde qué camino se la llame.

## Los seis ejemplos, mapeados

| Frase | Acción | Envoltura |
|-------|--------|-----------|
| «esperá hasta que amanezca» | `wait-here` | `until: time-of-day day` |
| «cuando tengas dos troncos, construí la fogata» | `craft-item` | `startWhen: holding log ×2` |
| «quedate acá diez segundos» | `wait-here` | `durationTicks` (10 s → ticks) |
| «antes de cruzar, agarrá el martillo» | `sequence` `[fetch, cross]` | — (orden, no tiempo) |
| «si aparece un lobo, alejate» | `spatial-relation far-from` | `startWhen: entity-appears wolf` |
| «después de comer, traé el otro tronco» | `sequence` o `startWhen: stat energy` | según se diga |

«Antes de A hacé B» **no** es envoltura temporal: es la secuencia `[B, A]`, que se
ordena con `afterGoalId` (ADR 0078). La envoltura queda para el reloj y los estados.

## Interpretación por el modelo (`model-providers/codex.ts`)

El esquema de comando lleva un objeto `temporal` con `startWhen`/`until`
(disparadores) y `durationSeconds`/`deadlineSeconds`. Es un eje aparte del verbo:
el modelo elige la envoltura y el disparador; `codex.ts` los lee, y `agent.ts` los
traduce a ticks en la frontera. El parser determinista de respaldo no produce
envolturas — es la red de seguridad, no el intérprete.

## Persistencia

Sin subir `SAVE_VERSION`: `activation`, `activatedAtTick` y `userRequest.temporal`
viajan dentro del objetivo (que ya se serializa entero), y el reloj dentro del
mundo. Una espera guardada a mitad de camino se restaura y despierta igual cuando
el mundo cumple su condición.

## Cómo extender

- **Otra hora** (atardecer, mediodía): ampliar `TimeOfDay` y `timeOfDay()`; la hoja
  `time-of-day` la toma sola.
- **Otro disparador**: sumar una variante a `Trigger` y su caso en
  `conditionForTrigger` (+ su lectura en `codex.ts`). El ciclo de vida no cambia.
- **Otra relación temporal**: sumar un campo a `GoalTemporal` y su composición en
  `compileTemporalGoal`. Nada fuera de esa función necesita enterarse.
