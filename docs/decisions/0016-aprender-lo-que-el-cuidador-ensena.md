# 0016 — Aprender lo que el cuidador enseña

## Estado

Aceptada.

## Contexto

Ánima tenía un ciclo cerrado de desarrollo de habilidades que funcionaba
(proponer → validar → evaluar en mundos aislados → promover o archivar, con el
generador nunca de juez), y tenía un chat que un modelo real interpretaba bien.
Los dos sistemas no se tocaban en ningún punto. En una sesión real el cuidador
le enseñó a bailar, ella contestó «¡Ah, entonces ya aprendí un baile básico
contigo!» y al mensaje siguiente («baila») respondió que no sabía ejecutar ese
tipo de acción. No era un fallo aislado sino cuatro cortes en el mismo camino:

1. **El ciclo solo se disparaba con hambre.** `attemptSkillCreation` construía
   un contrato constante (`alcanzar-alimento-bloqueado`, criterios sobre comida)
   y solo se llegaba a él desde el objetivo `recuperar energía`. En toda la vida
   de la mascota, el único momento en que podía fabricar una habilidad era con
   el camino al alimento bloqueado.
2. **El chat tenía un catálogo cerrado de cinco acciones.** Lo que no encajaba
   en destruir/traer/comer/esperar/mover devolvía `unsupported`, que respondía
   «no sé ejecutar eso» y cortaba: sin objetivo, sin contrato, sin registro.
3. **Las enseñanzas no se guardaban.** `explanation` dejaba el texto en
   `pendingExplanation`, un campo que solo leía la interpretación de la señal de
   energía, y solo si la mascota aún no la entendía. Con la hipótesis de energía
   ya formada, la rama estaba muerta: todo lo que el cuidador enseñara se
   descartaba tras responder «gracias, eso me ayuda».
4. **La conversación no era memoria.** Las respuestas cálidas del modelo vivían
   en un buffer de 12 turnos usado solo como historial de prompt. Nada se
   convertía en hecho, hipótesis ni habilidad.

Además, los criterios que el evaluador sabía medir (`energyIncreased`,
`consumedKind`, `reachedAdjacentKind`, `maxTicks`, `maxIntents`) eran todos
sobre recursos: aunque un pedido hubiera llegado al ciclo, el juez determinista
no tenía con qué juzgar un baile, y jamás lo habría promovido.

## Decisión

Conectar el chat con el ciclo que ya existía, sin bajar la vara.

### El pedido desconocido abre el ciclo, no lo cierra

El catálogo de `interpret.command` gana dos acciones y deja de ser fijo:

- `run-skill`: ejecutar una habilidad ya aprendida, por nombre. El repertorio
  estable viaja en el prompt, así que lo que la mascota aprendió se le puede
  pedir.
- `learn-skill`: el cuidador pide una conducta física que la mascota no tiene
  pero que sus primitivas podrían componer.

`unsupported` sobrevive, pero acotado a lo que ningún encadenamiento de
primitivas logra (saltar, construir una casa). El prompt lleva la lista de
primitivas reales para que la frontera sea la del cuerpo de la mascota y no la
de una lista arbitraria. Lo que se rechaza queda como episodio `unmet-request`:
que no pueda no la exime de recordar lo que su cuidador quiso.

### Primero el contrato, después el intento

`learn-skill` no diseña nada: abre una petición cognitiva nueva,
`skill.contract`, que traduce la conversación (incluida la explicación del
cuidador) a un contrato evaluable — nombre, propósito, resultado esperado y
criterios. Recién con el contrato acordado nace un objetivo de origen
`learning`, que se persigue como cualquier otro y corre el mismo `developSkill`
de siempre.

Que el modelo proponga el contrato **no** es aprobarse a sí mismo: fija de
antemano la vara con la que otro lo va a medir, en un momento distinto del
diseño del programa, y el evaluador determinista sigue siendo el único que
decide si el programa la alcanza. La alternativa —criterios fijos en el
código— es exactamente el problema que este ADR cierra.

### Los criterios pasan por una puerta, como los programas

`validateSuccessCriteria` es al contrato lo que `validateSkillProgram` es al
programa: esquema estricto por tipo (cada criterio exige exactamente los campos
que el evaluador necesita), sin repetidos, y rechazo explícito de contratos que
solo acotan el costo (`maxTicks`/`maxIntents` a secas), que cualquier programa
inerte cumpliría. Sin esta puerta, «aprender» sería aprobar contra un contrato
vacío.

### Criterios de conducta

El evaluador aprende a medir lo que no es un recurso: `holdingKind`,
`minMoves`, `returnedToStart`, `netDisplacementAtLeast`, `visitedDistinctCells`
y `noDamageTaken`. Para eso `SkillRunReport` registra el recorrido del actor
muestreado por tick. Los movimientos bloqueados no cuentan como movimientos
hechos. Cuando un criterio de conducta falla, las observaciones incluyen la
medición (`moves-made:0`, `net-displacement:4`) para que la revisión no sea a
ciegas.

### Sala de práctica

`practice-room` es un mundo despejado con la mascota en el centro. Los mundos
reales de Ánima son estrechos (9×5, con un muro): sin un lugar con sitio para
moverse, una conducta bien diseñada fracasaría por falta de espacio. **No la
exime de funcionar en su mundo real**: las habilidades enseñadas se evalúan en
`PRACTICE_SCENARIOS` = sala de práctica + mundos reales, con el mismo umbral del
100 %. Una conducta que no funciona en su propio mundo no le sirve.

### Las enseñanzas se guardan

`explanation` deja de ser cortesía. Una petición nueva, `distill.knowledge`,
convierte lo que el cuidador dijo en un enunciado breve, general y autónomo, y
entra en memoria como **hipótesis, no como hecho**: el cuidador puede
equivocarse, y la mascota la confirmará o la descartará con su propia
experiencia. Si el modelo detecta que la enseñanza contradice lo observado
(confianza < 0.5), se anota igual pero sin sumarle evidencia a favor: que él lo
afirme no la vuelve cierta. La mascota responde diciendo **qué anotó**, y esas
hipótesis viajan a los prompts de diálogo y al contexto de diseño, así que
puede hablar de lo que le enseñaron y usarlo.

Con un proveedor que no entiende lenguaje (el mock), la enseñanza se guarda
literal y `skill.contract` falla explícitamente en vez de fingir comprensión:
el modo sin IA no simula aprendizaje abierto.

## Consecuencias

- El cuidador puede enseñar conductas nuevas y la mascota las adquiere de
  verdad: quedan en la biblioteca con nombre, versión, contrato e historial de
  evaluación, se pueden pedir para siempre y viajan en el legado a su sucesora,
  que las re-evalúa en su propio mundo.
- Aprender puede fallar, y falla en voz alta: la mascota dice con qué se chocó
  usando lo que midió el evaluador, y los fallos quedan como regresiones que un
  intento futuro deberá superar. Nunca dice que aprendió algo que no aprendió.
- Aprender cuesta: una petición desconocida dispara consultas al modelo y
  simulación en varios mundos. Es deliberado — es la diferencia entre aprender
  y contestar que sí.
- El contrato queda a la vista (evento `skill.contract.agreed`, panel de
  experimentos, y dicho en el chat antes de intentarlo): el cuidador ve la vara
  y puede corregirla reformulando.
- La necesidad interna (recuperar energía) conserva su contrato fijo en el
  código: nace del cuerpo de la mascota, no de una conversación. El nombre
  `alcanzar-alimento-bloqueado` queda reservado para que un contrato enseñado no
  pueda secuestrar la habilidad de sobrevivir.
