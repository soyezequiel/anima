# Convergencia conversacional después del hito 12

Este documento es la fuente de verdad para el próximo tramo de producto. Empieza
al cerrar el hito 12 y termina cuando Ánima cumple, desde la aplicación real, la
promesa verificable de abajo. Hasta entonces, ampliar el catálogo de objetos no
es trabajo activo.

No reemplaza la arquitectura del remake ni los ADR. Los convierte en un orden de
implementación centrado en una experiencia de usuario completa.

## Promesa de producto

> El cuidador puede conversar con Ánima a lo largo de varios turnos, darle un
> encargo en lenguaje natural y verla perseguirlo hasta que el estado del mundo
> lo confirme. Ánima recuerda lo relevante después de cerrar y abrir la partida,
> interrumpe y retoma el encargo cuando aparece algo más urgente, y explica con
> honestidad qué está haciendo, qué recuerda y qué le falta.

La promesa se cumple **con las capacidades, procesos, habilidades y clases de
objeto que ya existan al empezar este tramo**. El modelo puede comprender una
frase, recuperar contexto o proponer una habilidad que opere sobre esa superficie;
no puede inventar materia ni ampliar las leyes del mundo para hacer posible el
encargo.

### Límites no negociables

- No se agregan tipos de objeto, sustancias, recetas con un tipo nuevo, procesos,
  cualidades, leyes físicas ni primitivas del motor.
- No se agrega una excepción por mapa, nombre de objeto o frase de la demo.
- El LLM traduce, resume y propone. `sim-core`/`world` decide los efectos; las
  condiciones declarativas deciden si el encargo terminó; el juez independiente
  decide si una habilidad puede promoverse.
- Un acuse, una burbuja, una tarjeta verde o una frase como «listo» no acreditan
  obediencia. Sólo cuentan el estado del mundo y los eventos autoritativos.
- El tick nunca espera una llamada de red, una destilación de memoria, la fragua
  ni el juez. La aplicación debe seguir simulando y mostrando progreso.
- El modo determinista sin proveedor sigue siendo una configuración soportada,
  no un doble de pruebas abandonado.

## Qué hay y qué falta conectar

El diagnóstico de partida no es «Ánima no sabe hacer nada». Ya hay planificación
dentro de un catálogo conocido, condiciones de objetivo, memoria acotada,
proveedores de lenguaje, evaluación y UI de actividad. La brecha es de
**continuidad e integración**:

- la conversación inmediata es una ventana pequeña y no constituye un historial
  durable que alimente todas las decisiones;
- los recuerdos existentes son útiles pero no conservan todavía la procedencia
  conversacional y el retrieval necesarios para continuar un vínculo;
- una entrada de la mente expresa una meta demasiado simple para representar un
  encargo multi-turno con partes, ligaduras, prioridad e interrupción;
- el proveedor, la fragua, el juez y el overlay/panel tienen piezas aisladas, pero
  no forman un recorrido único desde el mensaje de la app hasta el cambio del
  mundo y su explicación;
- los E2E actuales prueban sobre todo entrega, acuses y UI. Falta probar obediencia
  en el mundo, continuidad conversacional y restauración a mitad de un encargo.

La regla para implementar es **integrar antes de reemplazar**. Antes de crear un
subsistema nuevo, hay que comprobar si el contrato ya vive en `memory`,
`model-providers`, `agent-core`/`mind`, `plan`, `forge`, `judge`, `store` o la
sesión web y extender esa frontera.

## Arquitectura objetivo

```text
mensaje del cuidador
        │
        ├──► ConversationLog durable ──► acuse por AgentOutput
        │              │
        │              ├──► ventana reciente
        │              └──► destilación episódica + índice de retrieval
        │                                      │
        └──► comprensión rápida ────────────────┤
                       │                         │
                       └──► proveedor asíncrono ┘
                                  │ resultado correlacionado
                                  ▼ (sólo en frontera de tick)
                      Encargo durable / GoalGraph
                         │ prioridad · pausa · reanudación
                         ▼
                planner + catálogo de capacidades
                         │
                   Plan efímero
                         │
                         ├──► ejecución y verificación paso a paso
                         └──► gap de capacidad
                                   │
                                   └──► forge → judge, en segundo plano
                                        (sólo sobre recursos existentes)

eventos del mundo + transiciones del encargo
        ├──► memoria episódica y evidencia
        ├──► persistencia
        └──► AgentOutput: habla y progreso → una sola ruta de UI/overlay
```

### 1. Conversación y memoria

`ConversationLog` es append-only y durable. Cada turno lleva como mínimo
`turnId`, autor, texto, tick de recepción, `sessionId` y el `commissionId` o
`requestId` relacionado cuando exista. La ventana de trabajo sigue acotada; el
historial durable no se copia entero a cada prompt.

Sobre el log se mantienen tres capas distintas:

1. **Ventana reciente:** los últimos turnos necesarios para resolver elipsis,
   referencias y correcciones inmediatas.
2. **Memoria episódica conversacional:** resúmenes compactos de promesas,
   preferencias, enseñanzas, decisiones y resultados. Cada recuerdo conserva
   `sourceTurnIds`, procedencia, confianza y vigencia. Una frase del cuidador o
   del modelo nunca se promueve por sí sola a hecho del mundo.
3. **Retrieval:** consulta acotada formada por el mensaje actual, el encargo
   activo, las entidades referenciadas y la percepción. Devuelve pocos turnos,
   episodios y registros epistemológicos con su fuente. La coincidencia léxica
   determinista es el piso; embeddings o reordenamiento por LLM son una mejora
   posterior, no un requisito de este tramo.

Toda petición cognitiva relevante recibe el mismo `ConversationContext`: ventana
reciente, recuerdos recuperados, encargos activos y hechos perceptivos. No se
mantienen contextos incompatibles para `dialogue`, `interpret.command` y la
fragua.

### 2. Encargo durable basado en `GoalGraph`

Un mensaje aceptado crea un **encargo**, no una frase suelta ni un `Plan`. El
contrato mínimo es:

```ts
interface Commission {
  id: CommissionId;
  sourceTurnIds: TurnId[];
  originalText: string;
  graph: GoalGraph;
  status: 'interpreting' | 'ready' | 'active' | 'paused' |
          'blocked' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  interruptibility: 'safe-point' | 'immediate' | 'never';
  createdAtTick: number;
  updatedAtTick: number;
  blocker?: StructuredBlocker;
}
```

`GoalGraph` porta lo ya ganado por los ADR 0053, 0078, 0082, 0083 y 0085:
predicados de mundo, partes con orden parcial, referencias diferidas, condiciones
temporales y subobjetivos. Debe admitir correcciones multi-turno sin perder
identidad: «no ése, el otro tronco» revisa la ligadura del nodo pendiente y deja
traza; no crea silenciosamente otro encargo.

El grafo y sus transiciones persisten. El `Plan` no: es una hipótesis efímera
sobre el mundo actual y se reconstruye con percepción fresca después de una
pausa o restauración.

### 3. Comprensión asíncrona

La entrada se registra de inmediato y recibe un `requestId`. El camino rápido
puede producir una lectura fundamentada con el léxico/catálogo. Si la confianza
no alcanza, se solicita una lectura al proveedor sin bloquear el mundo.

La respuesta del proveedor incluye el `requestId`, la revisión del historial y
la firma de contexto contra la que se produjo. Se aplica sólo en una frontera de
tick y sólo si sigue vigente. Una corrección del usuario cancela o vuelve obsoleto
el resultado anterior mediante `AbortSignal`; una respuesta tardía jamás pisa un
encargo más nuevo.

El LLM devuelve una lectura o propuesta estructurada. Código determinista:

- resuelve referencias contra percepción y memoria;
- valida acciones contra el catálogo vivo;
- compila condiciones de éxito;
- decide aceptación o negativa con las reglas de hechos → valores;
- verifica el cumplimiento contra el mundo.

### 4. Prioridad, interrupción y reanudación

El scheduler arbitra entre reflejos, necesidades corporales, encargos explícitos,
mantenimientos y trabajo de fondo. La prioridad no reemplaza al `GoalGraph`: el
grafo dice qué depende de qué; el scheduler decide qué merece el próximo turno.

Reglas mínimas:

- una emergencia corporal puede pausar un encargo en un punto seguro y lo retoma
  cuando cede;
- «pará», «seguí», «esto es más importante» y «olvidá ese encargo» modifican un
  encargo identificado, no una variable global ambigua;
- una acción irreversible no se interrumpe a mitad de su aplicación al mundo;
- fragua, juez, destilación y charla de fondo tienen menor prioridad que actuar y
  nunca toman el turno corporal;
- cada transición emite motivo estructurado y es idempotente al restaurar.

### 5. Persistencia

El guardado incorpora con versión y migración:

- `ConversationLog` y cursor de compactación;
- episodios conversacionales y sus `sourceTurnIds`;
- encargos, `GoalGraph`, prioridad, estado, bloqueos y revisiones;
- identidad de solicitudes cognitivas pendientes y resultados ya aplicados;
- progreso durable de fragua/juez que pueda reanudarse o descartarse con
  seguridad.

No se serializan promesas en vuelo del proveedor, `AbortController`, handles de
worker ni planes hechos contra una percepción vieja. Al restaurar, esas tareas se
reconstruyen de forma idempotente desde el estado durable.

### 6. Un solo canal de habla y progreso

Toda salida visible del agente recorre un contrato común, por ejemplo
`AgentOutput` con variantes `speech`, `progress`, `question`, `warning` y
`completion`. Cada evento lleva `outputId`, tick, `commissionId`/`requestId` y
origen (`mind`, `planner`, `forge`, `judge`, `world`).

La burbuja, el historial de chat, el overlay de pensamiento y las tarjetas de
objetivo proyectan ese stream; no generan estados paralelos. `speech` es lo que
Ánima dice. `progress` explica algo verificable («buscando un segundo tronco»,
«encargo pausado por hambre», «candidata 1/2 en evaluación») y no se guarda como
si el personaje lo hubiera dicho.

## Contratos que se reutilizan y se amplían

| Componente existente | Se conserva | Ampliación necesaria |
| --- | --- | --- |
| `memory` / `MemoryStore` | trabajo, episodios, registro epistemológico y retrieval acotado | log conversacional durable, procedencia por turno, retrieval por encargo y round-trip completo |
| `model-providers` / `ModelProvider` | peticiones tipadas, mock/scripted, proveedor real y degradación | `ConversationContext` común, correlación, cancelación, respuesta asíncrona aplicable en frontera de tick |
| objetivos y condiciones de `agent-core`/`mind` | predicados, secuencias, referencias, temporalidad | `Commission` + `GoalGraph` durable, revisiones multi-turno, estados y prioridad explícitos |
| catálogo, planner y executor | capacidades conocidas, plan efímero, verificación por paso | aceptar un nodo del grafo, devolver bloqueos estructurados y replanificar al reanudar |
| `progress.ts` | intentos, prohibición y crédito por problema | progreso del encargo, causa de pausa/bloqueo y enlace estable a nodo/estrategia |
| `forge` | síntesis fuera del camino del tick | puerto de trabajo asíncrono desde la app; contrato limitado a capacidades sobre recursos existentes |
| `judge` | evaluación independiente, regresiones y cuarto reservado | job observable/cancelable, resultado correlacionado y retorno seguro a la mente/app |
| `store` / persistencia de sesión | snapshots, journal, migración y restauración | conversación, memoria recuperable, encargos y jobs durables con deduplicación |
| sesión web, chat y overlay/panel | entrada del usuario y superficies visuales | consumir `AgentOutput` y el estado de encargos; quitar acuses locales duplicados |
| misiones / E2E | evaluación por estado del mundo y trazas | escenarios multi-turno, recarga, interrupción y proveedor lento; nunca puntuar `spoke` |

Los nombres concretos pueden variar entre la rama del remake y el código portado.
La obligación es mantener estas fronteras y evitar un segundo almacén de memoria,
un segundo scheduler o una segunda interpretación del chat.

## Hitos implementables, en orden

Los códigos `C0`–`C6` evitan confundir este tramo con los hitos históricos del
remake. No se empieza el siguiente mientras el criterio del anterior no corre en
CI o en el arnés documentado.

### C0 — Línea base que falla por la razón correcta

- Escribir los escenarios E2E de este documento como misiones/fixtures sin una
  solución prevista.
- Capturar métricas iniciales: turnos usados como contexto, recuerdos recuperados,
  latencia a acuse/acción, pausas/reanudaciones y estado final del mundo.
- Trazar el recorrido real app → mente → proveedor/planner → mundo → UI y marcar
  cada adaptador todavía desconectado.

**Aceptación:** las pruebas distinguen «lo dijo» de «lo hizo», fallan hoy por una
brecha funcional identificada y siguen corriendo con proveedor scripted. Ningún
selector de UI constituye el oráculo del resultado físico.

### C1 — Conversación durable y salida unificada

- Introducir `ConversationLog` y `AgentOutput` en la frontera de sesión.
- Hacer que entrada, acuse, habla y progreso recorran una sola ruta.
- Persistir y restaurar el log sin duplicar turnos ni salidas.

**Aceptación E2E:** tres intercambios, recarga y cuarto intercambio conservan
orden e identidad; el personaje recibe los turnos previos; una salida no aparece
dos veces; el mundo sigue avanzando mientras el proveedor scripted queda
pendiente.

### C2 — Memoria episódica conversacional y retrieval

- Destilar episodios con procedencia y política explícita de promoción.
- Recuperar por turno + encargo + entidades, con topes medidos.
- Incluir el mismo contexto en diálogo, interpretación y síntesis de capacidad.

**Aceptación E2E:** después de conversación irrelevante y recarga, «hacé lo que
te pedí con el otro» recupera el encargo y referente correctos. Ánima puede citar
qué recuerda y su fuente; una afirmación del cuidador no altera el mundo ni se
presenta como observación confirmada.

### C3 — Encargo durable y `GoalGraph`

- Reemplazar la meta simple de entrada por `Commission` + grafo.
- Portar secuencia, ligaduras diferidas, condiciones y criterios de éxito.
- Mantener `Plan` efímero y reconstruirlo al restaurar.

**Aceptación E2E:** «juntá dos troncos, dejá uno junto al fuego y guardá el otro»
crea un grafo observable y sólo completa cuando las cantidades, identidades y
posiciones del mundo lo prueban. Una recarga entre el primer y segundo tronco no
repite el primer paso ni pierde el encargo.

### C4 — Comprensión con proveedor, sin bloquear

- Conectar la app al proveedor real mediante la frontera asíncrona.
- Agregar correlación, cancelación, firma de contexto y aplicación en tick.
- Conservar camino rápido y proveedor mock/scripted.

**Aceptación E2E:** una frase fuera del camino rápido se entiende con proveedor;
durante la espera siguen tick, movimiento permitido y progreso; una corrección
posterior invalida la respuesta vieja; una caída del proveedor deja una pregunta
o bloqueo honesto, no un falso éxito.

### C5 — Prioridad, interrupción y continuidad

- Implementar scheduler de encargos y necesidades con puntos seguros.
- Exponer pausar, reanudar, repriorizar y cancelar por referencia.
- Persistir transiciones y motivos.

**Aceptación E2E:** a mitad del encargo de tres partes aparece hambre urgente;
Ánima anuncia la pausa, come, retoma el nodo pendiente y alcanza el estado final.
«Pará eso y vení acá; después seguí» interrumpe y reanuda sin repetir efectos ni
perder referencias, incluso con una recarga durante la pausa.

### C6 — Fragua, juez y overlay en el recorrido real

- Conectar los puertos existentes de fragua y juez como jobs de segundo plano.
- Limitar el contrato a habilidades que usen objetos, procesos y efectos ya
  admitidos; un gap de materia o física queda `unsupported`.
- Proyectar su progreso mediante `AgentOutput` y devolver el veredicto a la mente
  sin atajos de la UI.

**Aceptación E2E:** un encargo que requiere componer de forma nueva recursos
existentes dispara fragua → juez, mantiene vivo el mundo, muestra progreso y sólo
usa la habilidad si el juez la promueve. Un pedido que exige un tipo de objeto
nuevo se rechaza o queda bloqueado sin modificar catálogos, recetas ni física.

## Puerta de salida del tramo

La creación de objetos nuevos puede volver al roadmap sólo cuando, en la app y
no únicamente en paquetes aislados:

- pasan los E2E de C1–C6 con proveedor scripted y los que correspondan con el
  proveedor real;
- conversación, recuerdos y encargos sobreviven una recarga a mitad de trabajo;
- el personaje usa contexto multi-turno para decidir y no sólo para redactar;
- un encargo complejo termina por predicados del mundo, no por un evento de UI;
- prioridad e interrupción no pierden ni duplican acciones;
- proveedor, fragua y juez no bloquean ticks y su progreso llega por el canal
  común;
- el pedido fuera de catálogo no crea por accidente un objeto, receta, proceso o
  ley nueva.

## Trabajo posterior: creación de objetos nuevos

Queda deliberadamente fuera de C0–C6:

- describir una clase de objeto inexistente y añadirla al mundo;
- inventar recetas o procesos cuyo resultado sea un tipo nuevo;
- pedir al oráculo propiedades, cualidades o leyes para materia nueva;
- previsualizar, admitir, versionar y migrar esos objetos;
- diseñar UI de autoría o moderación de objetos.

Ese trabajo tendrá su propia promesa y su propia puerta: conservación de materia,
`admit()`, resolubilidad, procedencia, rollback y misiones que distingan crear de
encontrar. No debe colarse como «caso especial» para hacer pasar un E2E de este
tramo.

## Cómo iniciar con Claude Code

Claude Code debe ejecutarse desde la raíz del **checkout principal de Ánima**, no
desde un worktree auxiliar. Antes de editar, debe situar allí su directorio de
trabajo, confirmar con `git rev-parse --show-toplevel` que ésa es la raíz que se
quiere modificar y leer primero
`docs/product/convergencia-conversacional.md`.

### Contexto que hay que darle

Pedirle que lea, en este orden:

1. `docs/product/convergencia-conversacional.md` completo;
2. [visión](vision.md) y [roadmap](roadmap.md);
3. las secciones «La mente», «Qué se conserva» y «Plan de construcción» de
   [Ánima II — Cuerpo, Materia y Vara](../architecture/remake-anima-ii.md);
4. [loop del agente](../architecture/agent-loop.md),
   [memoria](../architecture/memory.md),
   [persistencia](../architecture/persistence.md) y
   [mapas y misiones](../architecture/mapas-y-misiones.md);
5. ADR 0078, 0080, 0082, 0083, 0084, 0085 y 0086.

Después debe inspeccionar los contratos reales de la rama y escribir un mapa
breve `contrato existente → cambio mínimo`. La prosa de arquitectura orienta; el
tipo compilado manda sobre un nombre desactualizado.

### Primera fase a implementar

El único alcance autorizado para esta primera ejecución es **C0 y luego C1**.
Al completar C1 hay que detenerse: no iniciar C2–C6 ni implementar retrieval,
`GoalGraph`, scheduler, forge, judge o creación de objetos. La primera entrega
útil es el historial durable atravesando la sesión completa y un único stream de
salida; debe conservar el proveedor mock/scripted determinista y mantener el tick
no bloqueante. Es la base observable sobre la que se podrán probar las demás
capacidades en ejecuciones posteriores.

### Comandos de validación documentados

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm exec playwright install chromium  # sólo la primera vez
pnpm test:e2e
pnpm mission vado --mock               # arnés sin proveedor real
```

Durante C0 conviene agregar una misión específica de convergencia en vez de
reutilizar `vado`, pero debe ejecutarse por el mismo runner y puntuar hechos del
mundo.

### Reglas para no desviarse

- En esta ejecución, implementar sólo C0 y C1, un hito por vez, y detenerse al
  cumplir C1.
- No crear objetos, recetas, procesos, cualidades, física ni soluciones por mapa.
- No convertir al LLM en autoridad de efectos, aceptación o cumplimiento.
- No bloquear el tick con red, memoria, fragua, juez o persistencia.
- No persistir planes efímeros ni handles de runtime; sí encargos y evidencia.
- No dar por terminado un flujo porque cambió la UI: comprobar el mundo.
- Mantener el mock/scripted y los presupuestos de llamadas como contratos.
- Reutilizar puertos existentes; toda abstracción nueva debe eliminar una ruta
  paralela, no sumar otra.

### Instrucción inicial lista para pegar

> Ejecutate desde la raíz del checkout principal de Ánima, no desde un worktree
> auxiliar. Confirmá esa raíz con `git rev-parse --show-toplevel` y, antes de
> editar, leé completo `docs/product/convergencia-conversacional.md`; después
> leé los demás documentos y ADR indicados en «Cómo iniciar con Claude Code»,
> inspeccioná los contratos reales de sesión, mente, memoria, persistencia y UI,
> y escribí un mapa breve de integración. Implementá exclusivamente C0 y C1, en
> ese orden, y detenete al cumplir C1. Agregá primero un E2E/fixture que demuestre
> que tres turnos, una recarga y un cuarto turno conservan orden e identidad, que
> el contexto previo llega al personaje y que una salida no se duplica. Luego
> implementá el mínimo `ConversationLog` durable y un único `AgentOutput` para
> entrada, acuse, habla y progreso. No inicies C2–C6 ni avances retrieval,
> `GoalGraph`, scheduler, forge, judge o creación de objetos. Conservá el modo
> mock/scripted como camino determinista soportado y asegurá que el tick nunca
> espere al proveedor, la persistencia ni otro trabajo asíncrono. Validá con
> `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm test:e2e`, y reportá los
> predicados observables, no sólo los cambios de UI.
