# ADR 0055 — Una habilidad hecha de habilidades

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

La DSL tenía `runSkill` desde el ADR 0003 y el intérprete lo implementaba
entero, con pila de marcos y tope de profundidad. Pero **el modelo nunca se
enteró de que existía**: `DSL_REFERENCE` no lo listaba —y decía «ninguna otra
existe»—, y ningún prompt le pasaba el inventario de la biblioteca. Sin saber
qué nombres hay, `runSkill` no sirve para nada.

Los únicos emisores eran dos rutas de TypeScript escritas a mano, ambas de un
solo op: invocación, no composición.

El costo: cada habilidad nueva se escribía desde cero. «Alcanzar alimento
bloqueado» reimplementaba, dentro de su programa, todo lo que ya sabía hacer
«buscar alimento» — y cuando buscar alimento mejoraba, la copia pegada adentro
de la otra no mejoraba con ella.

Además había tres cosas rotas esperando a que alguien compusiera:

1. **Las variables eran una sola bolsa global.** `SkillExecution` tenía un
   único `Map`, y `Frame` no declaraba ámbito. Una habilidad llamada que
   guardara en `objetivo` le pisaba el `objetivo` a quien la llamó, en
   silencio: un fallo de comportamiento, no un error. Con `runSkill` usado solo
   como programa de un op nunca se notó.
2. **`runSkill` apuntaba a un id congelado**, o sea a una VERSIÓN. Si la
   habilidad llamada mejoraba, quien la llamaba seguía usando la vieja.
3. **La validación no miraba las llamadas.** Un nombre inventado pasaba limpio,
   se guardaba en la biblioteca y recién moría en los cuarenta mundos del
   evaluador, con un mensaje que hablaba de un id interno que el modelo nunca
   vio.

Y `SkillDefinition.dependencies` existía, se persistía, y **nadie lo escribía
ni lo leía nunca**: un placeholder, como `parentGoalId` antes del ADR 0053.

## Decisión

Dos mitades: **componer** y **descomponer**.

### Componer

El modelo recibe el catálogo de lo que la mascota ya sabe hacer —nombre,
propósito, qué deja hecho, y si está `probada` o `a medio probar`— y puede
llamarlo con `{"op":"runSkill","skillName":"..."}`. Por **nombre**, no por id:
se resuelve tarde, a la mejor versión del momento, así que una madre mejora
cuando mejora su hija. El id sigue existiendo para las dos rutas de TypeScript
que quieren una versión congelada.

El catálogo excluye lo archivado, lo deprecado y **a la propia habilidad que se
está diseñando**: ofrecérsela sería invitar al ciclo que la validación después
rechaza.

### Descomponer

Ante un problema demasiado grande, el modelo puede no escribir el programa y
contestar en cambio: «creá antes estas piezas» (máximo 3). Cada pieza se diseña
como habilidad propia —un viaje al modelo cada una— y en la vuelta siguiente el
catálogo ya las lleva, así que la madre puede componerlas.

Solo se ofrece en el primer intento, con presupuesto de sobra, y **una pieza no
puede volver a partir el problema**: descomponer lo ya descompuesto no termina.

### La vara de una pieza es su madre

Decisión del cuidador, y la que sostiene el ADR 0030. Una sub-habilidad **no
declara criterios propios**: no hay motivo del cuerpo que diga cuándo está
«desbloqueado un camino», así que la vara tendría que escribirla el modelo — es
decir, el examinado escribiría su examen.

En cambio: la pieza nace `experimental` y se queda ahí. Su examen es que la
madre pase los cuarenta mundos **usándola**. Cuando la madre se promueve, sus
piezas se promueven en cascada (`markPromoted` baja por `dependencies`). Si la
madre no llega a ninguna parte, sus piezas se archivan con ella
(`archiveOrphans`) — salvo que otra habilidad viva ya las esté usando, en cuyo
caso no son huérfanas.

El precio: una pieza no se puede reutilizar con confianza propia hasta que
alguna madre la valide. Es el precio correcto — lo contrario es conocimiento
que nadie midió con aspecto de conocimiento probado.

### Lo que hubo que arreglar debajo

- **Ámbito de variables por llamada.** `Frame` lleva su `scope`. `branch` y
  `repeatWithLimit` heredan la referencia del padre (son el mismo programa);
  `runSkill` estrena una bolsa vacía.
- **Validación de llamadas.** `validateSkillProgram(raw, compose?)` comprueba
  que cada nombre exista y que no se cierre un ciclo, siguiendo la cadena en
  profundidad. Falla antes de gastar simulación, con el nombre que el modelo
  escribió.
- **`dependencies` poblado**, uniendo dos fuentes que no coinciden: las piezas
  que nacieron para ella y lo que su programa llama de verdad (el modelo puede
  pedir tres y usar dos, o componer con algo viejo que nadie le pidió).

## Consecuencias

- Una habilidad puede mejorar sin tocarse, porque mejoró una de sus piezas.
- El tope de profundidad del intérprete (`maxCallDepth: 3`) ahora es un límite
  real y no teórico. Con piezas que no pueden pedir piezas, el árbol no pasa de
  dos niveles, así que hay margen.
- Descomponer cuesta viajes al modelo: una descomposición de 3 piezas son 4
  consultas antes de la primera evaluación. Por eso se ofrece una sola vez y
  con tope.
- Queda en tensión con el ADR 0029, que propone reemplazar `runSkill` por
  delegación nativa (`yield* ctx.skill(...)`) si algún día las habilidades pasan
  a ser código generado. Esto no cierra esa puerta: la semántica que se fija acá
  —resolución tardía por nombre, ámbito por llamada, vara heredada de la madre—
  es la misma que necesitaría esa versión.
