# ADR 0084 — Metacognición y registro epistemológico común

Fecha: 2026-07-21 · Estado: aceptada

## Contexto

Ánima distinguía parcialmente hechos e hipótesis en `@anima/memory`, pero esa
distinción se perdía al cruzar fronteras:

- el planificador usaba su propio `known | hypothetical | unknown`;
- el diálogo recibía una lista plana llamada `facts`, con prefijos escritos a
  mano para algunas hipótesis;
- percepción y memoria espacial sabían cuándo se vio algo, pero no expresaban
  cuándo ese dato dejaba de ser actual;
- no había una representación persistente de «falta este dato»;
- algunos juicios redactados por un modelo entraban por `addFact`, aunque un
  modelo no es una fuente de observación del mundo.

Esto hacía imposible responder de manera general cuatro preguntas distintas:
«¿qué sé?», «¿qué creo?», «¿qué no sé?» y «¿qué sabía pero puede haber
cambiado?».

## Decisión

`@anima/memory` incorpora un registro epistemológico serializable. Cada
`KnowledgeRecord` contiene:

- `content` y, cuando hace falta actualizar el mismo atributo, un `topic`
  estable;
- estado `observed | learned | inferred | hypothetical | refuted | unknown`;
- fuente tipada y evidencia a favor o en contra;
- confianza entre 0 y 1;
- tick y hora opcional de adquisición, más caducidad opcional por tick u hora;
- alcance `entity`, `type` o `general`;
- revisiones auditables;
- para lo desconocido, los datos faltantes y opciones `ask | observe |
experiment`.

La evaluación no aplasta estados:

- `refuted` significa que hay evidencia de que la afirmación es falsa;
- `unknown` significa que no hay evidencia suficiente;
- `stale` es un veredicto de consulta sobre un registro cuya caducidad pasó;
- `hypothetical` e `inferred` pueden orientar una exploración, pero no se
  presentan como conocimiento confirmado.

### Autoridad y revisión

Una observación de `world` o `perception` puede corregir una creencia previa y
la versión reemplazada queda en `revisions`. Una fuente débil agrega evidencia,
pero no reemplaza una observación directa.

Hay una puerta no negociable en `recordKnowledge`: cualquier entrada cuya
fuente sea `model` se guarda como `hypothetical`, aunque el llamador intente
marcarla como aprendida u observada. El LLM puede redactar, interpretar y
proponer; la promoción necesita evidencia externa. Los vetos semánticos de la
IA Dios dejan por eso de ser hechos permanentes.

### Integraciones

- **Percepción:** cada foto registra posición con alcance por entidad. La
  posición propia vence al siguiente tick; la de otras entidades vence después
  de 100 ticks. Ver de nuevo revisa el mismo `topic`. Recoger o destruir una
  entidad refuta que siga en la última posición.
- **Planificación:** los recuerdos espaciales vencidos o refutados no alimentan
  el modelo causal. Un plan encontrado queda como inferencia efímera. Si no hay
  plan demostrable, queda un registro `unknown` con los diagnósticos concretos
  y las alternativas de observar, preguntar o experimentar.
- **Diálogo:** además de los strings heredados, el proveedor recibe registros
  con estado, confianza, fuente, alcance, evidencia y dato faltante. El prompt
  obliga a distinguir conocimiento, creencia, falsedad, desconocimiento y
  desactualización, y a no completar huecos por plausibilidad.
- **Diagnóstico:** `assessKnowledge`, `explainKnowledge` y
  `diagnoseKnowledge` son fronteras comunes para consultar el veredicto y el
  porqué sin exponer razonamiento interno crudo.

### Persistencia y compatibilidad

`MemoryData.knowledge` es opcional al leer. Los guardados anteriores se migran
al cargar desde hechos e hipótesis; el siguiente guardado ya persiste el nuevo
registro. `factList` y `hypothesisList` se conservan como API de compatibilidad
mientras los consumidores antiguos se trasladan. No se sube `SAVE_VERSION`
porque la frontera normaliza el campo ausente sin perder datos.

## Consecuencias

- Ánima puede explicar la fuente y evidencia de una afirmación y reconocer
  cuándo no alcanzan.
- «No lo sé» ya no comparte representación con «sé que es falso».
- Los huecos de planificación son datos persistentes y accionables, no solo
  texto de telemetría.
- La memoria espacial deja de aportar ubicaciones eternamente actuales.
- Durante la transición hay duplicación deliberada entre hechos/hipótesis
  históricos y el registro nuevo. El registro epistemológico es la frontera
  general; las listas antiguas existen para no romper saves, UI y reglas ya
  probadas de una sola vez.
