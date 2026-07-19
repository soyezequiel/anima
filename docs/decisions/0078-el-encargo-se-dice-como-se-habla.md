# ADR 0078 — El encargo se dice como se habla

Fecha: 2026-07-19 · Estado: aceptada

## Contexto

Un cuidador escribió esto, que es como habla cualquiera:

> «Fabricá algo que te aguante el peso, ponelo sobre el agua y cruzá.»

La traducción lo convirtió en `craft-item: balsa`. Nada más. Las otras dos
cláusulas se perdieron, y lo peor no fue que no las hiciera: fue que en el tick
27, con la balsa recién fabricada en la mano, el objetivo se dio por
**completado**. Ánima había cumplido el encargo, según ella. El río seguía ahí.

Dos defectos distintos, encontrados en la misma frase:

1. **`interpret.command` devolvía UNA acción.** Un mensaje con tres verbos
   entraba entero y salía convertido en el primero. No había forma de expresar
   «esto son tres cosas».

2. **`place` era una primitiva sin puerta.** El mundo sabía colocar objetos
   desde el ADR 0032, pero el único camino hacia ahí era levantar una obra con
   un plano. Un pedido de colocar no tenía a dónde ir, así que la traducción lo
   mandó a `interact-entity` — la puerta de los verbos que hay que inventar. Y
   ahí Ánima inventó, con toda lógica, una interacción para un verbo que su
   mundo ya sabía hacer: «meterse debajo del agua y quedar sumergida». El juez
   la aprobó, la puerta la aceptó, y el motor la rechazó al ejecutarla
   (`target-not-mountable`). Tres sistemas trabajando bien sobre una pregunta
   mal hecha.

## Decisión

### 1. Un encargo puede tener partes, y van en orden

`CommandInterpretation` admite `{ action: 'sequence', steps: [...] }`: la lista
de órdenes simples que el mensaje contenía, en el orden en que se dijeron. No
anida — un plan de planes sería un lenguaje, y para eso ya están las
habilidades.

Cada parte nace como un **objetivo de verdad**, hermano de los otros, y espera
su turno: `Goal.afterGoalId` apunta al que tiene que cerrarse antes.

- No es `parentGoalId`. Un hijo (ADR 0053) es un paso interno que trabaja el
  programa del padre; esto son encargos completos puestos en fila, cada uno con
  su propio trabajo.
- Espera a que el anterior se **cierre**, no a que triunfe. El cuidador pidió
  tres cosas, no una condicionada a otra: si la primera fracasa, la segunda se
  intenta igual.
- Se decide sobre **todas** al recibirlas, no solo sobre la primera: si la
  tercera parte es algo que no puede o no quiere, el cuidador se entera ahora y
  no dentro de cincuenta ticks. La respuesta, en cambio, sale junta — contestar
  tres veces a un mensaje es hablarle encima.

### 2. Colocar es un pedido, no un verbo a inventar

`place-item` entra al catálogo de órdenes: «poné la tabla sobre el agua», con
`targetKind` (qué) y `onKind` (dónde, nombrado por lo que hay ahí). Su programa
usa la primitiva `place` que el mundo ya tenía.

Para escribirlo hizo falta una operación nueva en la DSL: **`markTarget`**,
que guarda como ancla la celda de algo que VE. Hasta acá lo único anclable era
la propia posición (`markAnchor`) o un desplazamiento desde ella (`markCell`),
así que «poner algo EN aquel lugar» no se podía expresar — solo «poner algo a
dos pasos de donde estoy».

### 3. La puerta no guarda promesas rotas

`validateInteraction` rechaza las posturas `on-top`/`underneath` contra el agua.
El motor ya las rechazaba al ejecutarlas; aceptarlas al proponerlas era guardar
una regla que se aprende, se celebra y falla la primera vez que se usa.

Una puerta que acepta lo inejecutable es tan defectuosa como una que rechaza lo
posible. La guarda del motor se queda igual, porque una regla puede llegar por
otros caminos (un guardado viejo, un legado): son dos mitades de la misma
defensa, y hay una prueba para cada una.

## Consecuencias

La frase del principio ahora se lee como tres órdenes encadenadas, y la del
medio encuentra su camino sin inventar nada:

```
sequence
  ├─ craft-item: balsa
  ├─ place-item: balsa sobre agua   (afterGoalId → la anterior)
  └─ …
```

Nada de esto es específico de un río. «Traé dos troncos y hacé una fogata»,
«comé algo y después seguí», «apoyá el ladrillo contra la roca» son la misma
capacidad. El mapa fue el que la hizo falta, no el que la define.

Lo que sigue faltando: los pasos que no son órdenes ejecutables (una enseñanza,
una charla) se caen de la fila. Mezclar en la misma cola un objetivo con una
explicación haría esperar a la parte siguiente por algo que nunca «se cierra».
Es una decisión, pero deja fuera un «te explico X y después hacé Y» dicho de un
tirón.

Regresiones: `packages/agent-core/tests/encargo-en-partes.test.ts` (el orden y
la fila), `packages/model-providers/tests/codex.test.ts` (la lectura de las
partes) y `packages/sim-core/tests/footing.test.ts` (la puerta de posturas).
