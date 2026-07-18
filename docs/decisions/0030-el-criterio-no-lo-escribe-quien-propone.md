# ADR 0030 — El criterio no lo escribe quien propone la skill

Fecha: 2026-07-17 · Estado: **aceptada** (2026-07-18: fases C+D+E implementadas)
· Cierra la deuda del ADR 0006/0012 que el ADR 0029 declara «fase 0
innegociable», paga la brecha que el ADR 0020 dejó marcada como la más urgente, y
bloquea al ADR 0029 entero.

> Colisión de numeración: el ADR 0029 reserva el 0030 para «skills en JS
> enjaulado». Si esto se acepta, aquel corrimiento pasa a 0031/0032/0033: la
> fase 0 aterriza primero, así que numera primero.

## Contexto

El ADR 0020 escribió, en sus consecuencias, la frase que este ADR viene a
tachar:

> «El evaluador de skills todavía mide el éxito como booleano sobre semillas
> fijas. […] un veredicto binario lo lee como capacidad cuando es suerte.
> **Medir el éxito como distribución pasa a ser la brecha más urgente.**»

El ADR 0023 la volvió a marcar tres ADRs después: *«la vara mide 3 semillas
fijas con veredicto binario […] eso lee suerte como capacidad. Es la brecha 2
del reporte y merece su propio cambio»*.

Se anotó dos veces y no se hizo ninguna. Entre 0021 y 0028 todo fue mundo:
identidad, visión, dolor, agua, refugio, interacciones, exploración. El
`skill-evaluator` tiene 467 líneas — el 3% del código — y carga con el 100% del
reclamo del producto: *«solo la adopta si supera las pruebas»*.

El ADR 0029 llegó a la misma pared desde el otro lado y dejó la pregunta
abierta: *«quién escribe el criterio […] es el problema abierto de verdad, y no
lo resuelve ninguna de las propuestas de acá»*.

La prueba, de la corrida real: `crear-casa` v2 se promovió con el 100% de éxito
y el criterio «termina llevando un objeto de tipo martillo».

## El diagnóstico: no es un problema, son tres

La vara falla por tres motivos independientes que se venían leyendo como uno.

| # | Defecto | Dónde | Por qué pasa |
|---|---|---|---|
| **1** | El criterio lo escribe el mismo que escribe la skill | `agent.ts:1353` + `skill.ts:75` | La puerta es **sintáctica**: mide que el criterio sea medible, nunca que sea *el* criterio |
| **2** | El laboratorio lee la tirada como incapacidad | `evaluate.ts:205` | La doctrina recurso-vs-capacidad (ADR 0008) se aplica al mundo real (ADR 0012) y **no al laboratorio** |
| **3** | Seis casos deciden una promoción | `evaluate.ts:232` + `promotion.ts:11` | 2 escenarios × 3 semillas fijas, umbral 100% |

## Decisión 1 — El criterio lo escribe el motivo; si no hay motivo, lo confirma el cuidador

**La regla ya se cumple en todo el código. Nunca se enunció, y por eso se
filtró por el único agujero.**

Hay exactamente dos contratos de skill escritos por el motor, y los dos nacen
de un motivo:

```ts
// agent.ts:2305 — frío
successCriteria: [{ type: 'temperatureIncreased' }, { type: 'noDamageTaken' }]
// agent.ts:2545 — hambre
successCriteria: [{ type: 'consumedKind', kind: 'food' }, { type: 'energyIncreased' }]
```

Ninguno admite trampa, y no es suerte: **un motivo es un estado medido de la
criatura**. Tener frío tiene firma objetiva en el mundo, así que la condición
de satisfacción se escribe sola. El criterio no lo elige nadie: lo dicta el
motivo que abrió el ciclo.

Y hay exactamente un contrato escrito por el modelo — el que nace de un pedido
del cuidador (`deriveLearningContract`, `agent.ts:1329`). Ese se falsea solo,
porque **un pedido son palabras**, y las palabras no tienen firma en el mundo.
`holdingKind: martillo` es un logro observable perfectamente válido. Solo que
no es *ese* logro.

Es el mismo argumento del ADR 0020 sobre los pesos —*«un peso es
infalsificable […] dejarle declarar sus propios pesos sería dejarla inventarse
la suerte: la versión probabilística de aprobarse su propio examen»*— aplicado
un piso más arriba. **Dejarle declarar su propio criterio es la versión
semántica de lo mismo.** El ADR 0020 cerró la rendija de la suerte y dejó
abierta la del significado.

### El tercer camino: el legado lava el criterio

Hay un origen más, y es el que hace que esto no se pueda postergar. La
adopción de herencia (`agent.ts:439-447`) copia el criterio del ancestro tal
cual —`successCriteria: structuredClone(artifact.successCriteria)`— y lo manda
derecho a `evaluateAndApply` (`agent.ts:454`).

La sucesora **re-prueba la skill en su propio mundo, contra la vara de su
abuela**. Si esa vara decía «llevo un martillo», el error no se hereda: se
*lava*. Cada generación lo vuelve a certificar, y el linaje entero pasa a
descansar sobre un criterio que nadie miró nunca.

Y choca de frente con la visión, que promete que la sucesora *«puede leer,
cuestionar y verificar»* el legado. Hoy puede verificar el **programa** contra
el criterio. No puede cuestionar el **criterio**.

### La regla

1. **Skill de motivo** → el criterio lo deriva el motor del motivo. Autónoma,
   sin trampa posible, ya funciona. Se vuelve invariante enunciado, no
   coincidencia: un `SkillContract` con `motivation` de origen interno **no
   puede** traer criterios del modelo.
2. **Skill de pedido** → el criterio lo confirma el cuidador. El modelo lo
   propone (traducir sigue siendo su trabajo), pero no se promueve nada contra
   un criterio que una persona no miró.
3. **El criterio viaja con su origen.** `criterionSource: 'motive' |
   'caretaker'` en el artefacto y en el guardado. Al heredar: `motive` se
   re-deriva del motivo en el mundo de la heredera; `caretaker` viaja, y el
   informe de legado lo muestra; **ausente** —todo guardado anterior a este
   ADR— se re-confirma antes de promoverse. Es lo que vuelve literal el
   «cuestionar» de la visión.

### Por qué el cuidador y no otro modelo

Un segundo modelo que juzgue al primero mueve el problema, no lo cierra: sigue
sin haber nada del lado del mundo que ancle las palabras. El cuidador **es** el
ancla, y es el rol que la visión ya le da — *«acompaña, enseña y orienta»*. El
pedido fue suyo; el criterio de que se cumplió también.

### El diálogo ya existe, y ella ya dice el criterio en voz alta

```ts
// agent.ts:1322 — esto ya se renderiza en el chat, hoy
`Todavía no sé hacerlo, pero quiero aprenderlo. Para mí "${contract.name}" va a
 estar logrado cuando ${contract.successCriteria.map(describeCriterion).join(', y cuando ')}.`
```

`crear-casa` v2 anunció, palabra por palabra: *«para mí crear-casa va a estar
logrado cuando termina llevando un objeto de tipo martillo»*. **El bug estuvo
siempre a la vista en el chat.** Es un diálogo de confirmación que todavía no es
un diálogo.

Y el flujo para convertirlo tampoco hay que inventarlo: es el `pendingInvention`
del ADR 0024, exacto. Estado de espera (`agent.ts:210`), resuelto **antes de
cualquier consulta al modelo** (`agent.ts:1070-1083`), con `isAffirmativeReply`
/ `isNegativeReply` (`refusal.ts:377-390`) y una tarjeta en el chat
(`RecipeCard`). Su regla de diseño, escrita en `agent.ts:1067`, es literalmente
la que el criterio necesita:

> *«Una vista previa espera el sí o el no ANTES que cualquier modelo. […] nada
> entra al mundo por silencio ni por un "sí" viejo.»*

`pendingInvention` → `pendingContract`. `RecipeCard` → `ContractCard`. El «no»
del cuidador es información de primera: entra al reintento como contexto, igual
que hoy entra un rechazo de `validateRecipe`.

## Decisión 2 — El laboratorio distingue suerte de incapacidad

`runCase` (`evaluate.ts:205`) declara:

```ts
const passed = criteriaFailed.length === 0 && !violated && report.outcome === 'completed';
```

No hay tercera categoría. Pero el ADR 0008 ya dictaminó que **recurso ≠
capacidad**, y el ADR 0012 ya lo honra en el mundo real: un fallo por
`no-candidates` no se registra como regresión, porque *«la falta de recursos no
es un defecto de la habilidad»*. El laboratorio nunca recibió la doctrina.

Peor: el evaluador **ya calcula la distinción y la tira**. `deriveObservations`
(`evaluate.ts:145-158`) separa `craft-missing:` de `no-damage-dealt:` — y lo usa
solo para el informe, nunca para el veredicto.

Cada caso pasa a tener tres desenlaces:

| Desenlace | Qué significa | Cuenta |
|---|---|---|
| `passed` | cumplió los criterios | sí |
| `failed` | hizo lo incorrecto | sí, en contra |
| `inconclusive` | el mundo no dio | **no**: no entra al denominador |

### Alcance de `inconclusive`: la tirada sí, el recurso todavía no

Implementado cubre **solo la tirada perdida** (`attempt-failed`), que es el
agujero medido: el 27% de falsos rechazos de arriba. El eje del recurso
(`missing-ingredients`) queda afuera a propósito, y no por costo:

decidir si un ingrediente ausente es culpa del mundo o de ella exige saber si
el mundo lo tenía en algún lado y no fue a buscarlo — que es una capacidad, no
un recurso. Es un juicio distinto del de la tirada, que es limpio porque el
mundo ya lo declara. Además el eje del recurso ya tiene puerta río arriba: el
agente ni siquiera abre el ciclo cuando está `blockedByMissingResource`
(ADR 0008), y `practiceScenariosFor` filtra los escenarios a los que contienen
los `kind` del criterio. Meterlo acá sin pensarlo sería regalar aprobaciones a
skills que no juntan lo que necesitan.

## Decisión 3 — Dos ruidos, dos tratos opuestos

Acá está el error de encuadre que arrastran el ADR 0006 y el ADR 0029, y que
los deja contradiciéndose:

- El **ADR 0006** justifica el umbral 100%: la v1 defectuosa acierta ~83%
  «porque en algunos mundos el martillo queda más cerca que la rama», así que
  cualquier umbral menor la promovería.
- El **ADR 0020** pide éxito como distribución: con el crafteo variable, una
  skill correcta falla a veces por la tirada.

Los dos tienen razón, porque **hablan de ruidos distintos**:

| Ruido | Qué varía | Quién lo controla | Trato correcto |
|---|---|---|---|
| **Layout** | dónde cae el martillo, la rama, la comida | la semilla del escenario | **Exigir robustez**: una skill tiene que funcionar en todos los mundos |
| **Tirada** | si la chispa agarró, qué calidad salió | `world.rng` (ADR 0020) | **No juzgar, informar**: no es suya |

Y ya están en streams separados — nadie lo hizo a propósito, pero está:

```ts
// scenarios.ts:327 — el dado del mundo
const world = createWorld({ width: 13, height: 7, seed }, ...);  // world.rng = createRng(seed)
// scenarios.ts:328 — el terreno, stream derivado e independiente
const rng = createRng(seed * 7919 + 17);
```

### La consecuencia dura: tres muestras fallan en las dos direcciones

Hoy el camino del hambre corre 2 escenarios (`MVP_SCENARIOS = [openField,
foodBehindWall]`) × 3 semillas fijas `[11, 22, 33]` = **6 casos**, con umbral
100%. Con tres muestras por escenario, la vara se equivoca de los dos lados a
la vez:

- **Promueve a la mala.** Una skill que acierta el 83% —la v1 canónica del ADR
  0006, la que el ciclo entero existe para atrapar— pasa 3 de 3 con
  probabilidad **0.83³ = 57%**. El umbral del 100% sobre 3 muestras no es un
  filtro: es cara o cruz para exactamente la skill que tiene que atrapar. **La
  v1 se rechaza hoy porque `[11, 22, 33]` contiene un mundo malo, no porque la
  vara mida.** Es una propiedad de tres números escritos a mano, y viaja
  hardcodeada en nueve lugares: dos de producción
  (`GameSession.ts:66`, `milestone.ts:125`) y siete tests.
- **Rechaza a la buena.** `CAMPFIRE_RECIPE` —la receta que llevan
  `coldNight` y `coldNightUnlit`, los escenarios con los que se evalúa
  `SKILL_GET_WARM`— tiene desenlaces `7 buena / 2 pobre / 1 falla`
  (`scenarios.ts:32-37`). Una skill de frío **correcta** falla un caso el 10%
  de las veces por la chispa. Pasa 3 de 3 con probabilidad `0.9³ = 73%`:
  **se rechaza sola 1 de cada 4 veces, sin haber hecho nada mal.** No es
  hipotético y no es el mock: es el mundo tirando su dado, exactamente como el
  ADR 0020 quiso.

El mismo número —n=3— es demasiado chico para atrapar a la mala y demasiado
chico para perdonar a la buena. Con semillas muestreadas y n=20: `0.83²⁰ =
2.4%`. Recién ahí el umbral significa algo — y con la chispa perdida fuera del
denominador, el 27% de falsos rechazos se va a cero.

### La regla

- **Layout**: semillas muestreadas del RNG del mundo, n ≈ 20 por escenario. El
  umbral 100% del ADR 0006 **se conserva** — sobre 20 mundos, no sobre 3.
- **Tirada**: el veredicto corre con el dado real, y lo absorbe el desenlace
  `inconclusive` de la decisión 2. **No** con `withoutChance`.

  La tentación era usarlo (`scenarios.ts:203`, ya existe, el ADR 0020 ya lo usa
  para esto en cuatro tests). Es un error: `withoutChance` hace el mundo más
  amable que la realidad, y esconde justo lo que el ADR 0020 dice que importa
  —*«se pierde el material, nunca la posibilidad de volver a intentarlo»*—.
  **Reintentar tras una chispa fallida es parte de la habilidad.** Un mundo sin
  dado nunca pregunta si reintenta, así que promovería a la que se rinde.

  La línea la traza la decisión 2, no el dado:

  | La chispa falló y… | Desenlace | Por qué |
  |---|---|---|
  | le sobraban ticks y pedernal, y se rindió | `failed` | tenía con qué y no lo usó: es capacidad |
  | reintentó hasta quedarse sin pedernal | `inconclusive` | el mundo no dio: es recurso (ADR 0008) |

  `withoutChance` se queda como **diagnóstico** —¿la estrategia funciona cuando
  el dado acompaña?— para el informe de fallo. Nunca como puerta.
- **De dónde salen**: se **derivan** de la semilla de la partida
  (`sampleSeeds`), no se tiran de `world.rng`. Si el evaluador consumiera el
  dado del mundo, el futuro de la partida dependería de cuánto pensó la
  mascota. Este stream es suyo: el mismo mundo da siempre la misma grilla.

### Adenda (implementación) — la grilla estable sale más barata que muestrear de nuevo

La primera versión de este ADR pedía muestrear semillas **por evaluación**, y
de ahí derivaba dos tareas: re-correr la baseline sobre el set nuevo, y topear
las regresiones que iban a multiplicarse. Al implementarlo, la grilla derivada
de la semilla del mundo —estable entre versiones de la misma skill— resultó
estrictamente mejor, **y las dos tareas desaparecen**:

- **Baseline**: `promotion.ts:47` compara `successRate` entre versiones. Con la
  grilla estable, v1 y v2 se midieron sobre los mismos mundos: la comparación
  es válida sin re-correr nada. (Y con `successThreshold: 1` el chequeo está
  dormido igual: si `successRate < 1` el umbral ya rechazó.)
- **Tope de regresiones**: no hace falta. `RegressionStore.add`
  (`regressions.ts:49`) ya deduplica por `skill+escenario+semilla`, y la grilla
  no cambia entre versiones, así que no hay crecimiento que topear.
- **Lo que sí queda igual que antes**: las regresiones de laboratorio siguen
  siendo redundantes —`evaluate.ts:238` las descarta porque su
  `escenario:semilla` ya está en la grilla— pero eso no es un defecto. La
  garantía viene de que la grilla es estable, no del store; y el store sigue
  ganándose el lugar por dos motivos: es lo que **se le muestra al cuidador**
  («estos son los mundos donde la v1 se rompió») y es donde viven las
  regresiones de **mundo real** con snapshot (ADR 0012), que sí agregan casos
  porque su `scenarioName` es `mundo-real` y nunca colisiona con la grilla.

## Cómo se aterriza

| Fase | Qué | Toca | Costo | Estado |
|---|---|---|---|---|
| **A** | Tercer desenlace `inconclusive`: la chispa perdida no cuenta, rendirse sí | `evaluate.ts`, `promotion.ts` | Bajo | **hecha** |
| **B** | Grilla derivada de la semilla del mundo, n=20 | `seeds.ts`, `GameSession.ts`, `milestone.ts` | Bajo | **hecha** |
| **C** | Invariante: contrato de motivo ⇒ criterio del motor. `criterionSource: 'motive'` en los dos contratos del motor; `SkillContract.criterionSource` obligatorio | `agent.ts` (frío/hambre), `skill-dev.ts`, `skill.ts` | Bajo | **hecha** |
| **D** | `pendingContract`: el cuidador confirma el criterio (mismo portón que `pendingInvention`, resuelto antes de cualquier modelo). El diálogo ya lo dice en voz alta; la confirmación viaja por chat («sí»/«no») y el panel de experimentos muestra `contract-preview` | `agent.ts`, `events.ts`, `GameSession.ts`, `view.ts`, `ExperimentsPanel.tsx` | Medio | **hecha** (falta el pulido del `ContractCard` en el chat) |
| **E** | `criterionSource` viaja en el artefacto, el legado y el guardado; el legado `motive` se re-certifica solo, el `caretaker`/ausente NO se promueve sin re-confirmar | `skill.ts`, `agent.ts:439`, `GameSession.ts` | Bajo | **hecha** |
| **F** | Re-correr la historia: que la v1 del ADR 0006 caiga por medida, no por suerte | tests, E2E | Bajo | **A+B verificadas** |

A y B son independientes de C, D y E: se pueden hacer en cualquier orden. **F
es la que dice si funcionó.**

### Lo implementado en C+D (2026-07-18)

- **`CriterionSource = 'motive' | 'caretaker'`** (`skill-runtime/skill.ts`) viaja
  en `SkillDefinition`, `NewSkillInput` y `SkillContract`. `addExperimental` lo
  hereda de la versión padre: revisar el programa no cambia quién escribió la vara.
- **El portón de confirmación** (`agent.ts`): `startLearning` ya no crea el
  objetivo — deriva el contrato, lo deja en `pendingContract`, emite
  `skill.contract.preview` y dice el criterio en voz alta pidiendo el sí. El
  siguiente mensaje se resuelve como el de `pendingInvention`, **antes de
  cualquier consulta al modelo**: «sí» → `confirmLearningContract` abre el ciclo;
  «no» → lo deja como propuesta y pide una vara mejor. Los motivos internos
  (energía, frío, seguridad) siguen sin pedir permiso: su vara la escribe el
  motor, no un modelo.
### Lo implementado en E (2026-07-18)

- **El origen persiste solo**: la biblioteca se serializa entera
  (`SkillLibrary.serialize`), así que `criterionSource` viaja en el guardado sin
  código de migración — un save anterior al ADR lo trae ausente, que es
  exactamente «anterior al ADR» y dispara la re-confirmación.
- **`adoptLegacy` parte por origen**: `motive` se re-evalúa y promueve sola (su
  vara es una constante del motor, re-derivable, sin trampa); `caretaker` y
  ausente se adoptan **experimentales y sin promover**, con un evento
  `skill.inherited.unconfirmed`, un episodio y un aviso en el chat. Así el legado
  deja de lavar una vara que nadie miró.
- **La re-confirmación reusa la fase D**: una conducta heredada sin confirmar no
  es estable, así que re-enseñarla vuelve a pasar por el portón de
  `pendingContract` y promueve una versión con criterio confirmado. No hizo falta
  una cola de confirmaciones al nacer.

### Lo que queda (menor)

- El «no» del cuidador a un contrato todavía no re-alimenta el reintento con el
  criterio rechazado como contexto: hoy lo deja como propuesta y pide una vara
  mejor de cero.

### Lo que F midió sobre A+B (semilla 5, `pnpm demo`)

```
alcanzar-alimento-bloqueado v1 [archived] éxito medido: 88%
alcanzar-alimento-bloqueado v2 [stable]   éxito medido: 100%
Regresiones: 5 mundos (semillas 418770650, 867604572, 728436657, 1876637989, 535839839)
```

El ADR 0006 había medido **a mano** que la v1 acertaba «≈83%», y de ahí dedujo
que el umbral tenía que ser 100%. Ahora **la vara lo dice sola**: 88% sobre 40
casos, cayendo en los 5 mundos donde la rama queda más cerca que el martillo.
El número que justificaba el diseño pasó de ser una nota al pie a ser una
medición del sistema.

Y el costo del ×7 no aparece: la corrida entera tarda **1,97 s** contra los
~1,4 s de antes. La suite completa (435 tests) queda en verde sin tocar la
historia.

Dos cosas abaratan esto y conviene saberlas antes de empezar: `PromotionPolicy`
**ya es inyectable** (`promotion.ts:32`) y ningún sitio de producción le pasa
nada, así que el umbral es un parámetro y no una cirugía; y `evaluateSkill` /
`applyEvaluation` tienen **un solo call site de producción cada uno**
(`skill-dev.ts:68` y `:77`), así que la superficie real de A y B es mucho más
chica de lo que el ×7 de casos sugiere.

## Qué se rompe, a propósito

Lo que efectivamente se rompió al hacer A+B fue **un solo test**
(`claude-report.test.ts:48`, que fijaba `[11, 22, 33]`), reescrito contra la
propiedad —la grilla se deriva de la semilla y es reproducible— en vez de
contra los números. Los tests que afirman «se promovió» siguieron valiendo
solos, que es la señal de que medían lo correcto.

Lo demás cambió de forma sin romperse, y conviene tenerlo a la vista:

- **`EvaluationCaseResult.passed` → `verdict`.** Reemplazarlo en vez de agregar
  un campo al lado fue deliberado: obliga al compilador a encontrar a los
  cuatro lectores y a que cada uno decida qué hace con el tercer estado. Los
  encontró.
- **El prompt de revisión** (`codex.ts:565`, el `caseResults` del ADR 0023) ya
  no dice `PASÓ`/`FALLÓ` sino que muestra `SIN VEREDICTO` y aclara que ahí no
  hay nada que corregir. Es un cambio de contrato con el generador, no solo con
  el juez: antes le pedíamos que arreglara la suerte.
- **`evaluator.test.ts:111-112`** (`expect(a.cases).toEqual(b.cases)`): el test
  de determinismo **siguió pasando**, que era la condición. Derivar la grilla
  —en vez de tirarla de `world.rng`— es lo que lo sostiene.
- **Costo**: `pnpm demo` pasó de ~1,4 s a 1,97 s con 40 casos en vez de 6. El
  ×7 de casos no se traduce en ×7 de tiempo ni se acerca a molestar.

Y lo que falta:

- **`crear-casa` v2 deja de promoverse.** Es el criterio de aceptación del ADR
  entero, y lo cierran C+D+E, no A+B.

## Consecuencia sobre el ADR 0029

Con la vara midiendo, su argumento central —*«las skills pueden pagar el código
porque tienen evaluador»*— pasa a ser cierto, que hoy no lo es. Su fase 0 queda
cerrada y sus fases 1–5 se desbloquean.

Y su pregunta abierta queda contestada con un alcance más chico del que
temía: no había que inventar quién escribe el criterio. Había que **enunciar la
regla que el código ya cumplía en dos de tres caminos**, y tapar el tercero con
la única fuente de significado que hay del lado de afuera del modelo — la
persona que hizo el pedido.

## Lo que este ADR no toca

- **Quién escribe el *programa*.** Sigue siendo el modelo, con o sin agente
  autor (ADR 0029, propuesta 1). Acá solo se decide quién escribe la vara.
- **Los criterios narrativos de los objetivos** (`Goal.successCriteria`,
  `string[]`, p. ej. `agent.ts:868`). Son para el relato y la UI; no promueven
  nada. Comparten nombre con los criterios medidos y no son lo mismo.
- **El umbral 100%.** Se conserva tal cual lo fijó el ADR 0006. Lo que cambia
  es sobre cuánta evidencia se aplica.
