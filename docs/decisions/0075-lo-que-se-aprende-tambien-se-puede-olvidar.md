# ADR 0075 — Lo que se aprende también se puede olvidar

Fecha: 2026-07-19 · Estado: aceptada

## Contexto

Ánima tiene cinco puertas de invención —recetas (ADR 0031), interacciones (ADR
0027), planos (ADR 0032), descomposiciones y glifos— más una biblioteca de
habilidades. Todas comparten una virtud y un defecto.

La virtud: lo que entra es dato puro, validado por un esquema estricto, y vive
en el estado del mundo, así que viaja en los snapshots. Un mundo restaurado
sabe exactamente lo que sabía.

El defecto: **solo saben agregar**. El único punto de escritura es un `.push()`
en `step.ts`, y no había en todo el sistema una sola llamada que quitara un
elemento de ninguna de las seis listas. `archived`, en la biblioteca de
habilidades, es un tombstone del evaluador: la entrada se queda en el `Map` para
siempre y se sigue serializando.

Eso deja tres problemas que se acumulan con las horas de juego:

**El guardado crece y no baja.** El save es un blob JSON único bajo una sola
clave, con un tope de 1 MB en la API. Cada idea que la mascota tuvo alguna vez
—incluidas las ocho versiones que fallaron de una habilidad que nunca aprendió—
pesa ahí adentro para siempre.

**El catálogo se vuelve ilegible.** Después de un rato, «Inventados en runtime»
es una lista larga donde conviven los tres objetos que importan con veinte
tanteos. Mirar qué sabe hacer la mascota deja de ser posible justo cuando se
vuelve interesante.

**Una idea mala es permanente.** Si un modelo mete una receta que arruina el
árbol de crafteo, o una interacción que hace algo raro, no hay forma de sacarla
que no sea borrar la partida entera (`clearSession`). El cuidador puede *poner*
cosas en el mundo desde el modo creativo (ADR 0061) pero no puede sacarlas: un
poder que solo suma.

## Decisión

**Una poda del cuidador**, del mismo linaje que el modo creativo y la mochila
(ADR 0070): un poder de autor que cae sobre el mundo vivo.

Tres cosas que se eligieron a propósito.

### El arrastre se mira antes de tocar nada

La poda se hace en dos tiempos, y ese es todo el diseño:

1. `planPrune(world, ref)` **mira** y devuelve el arrastre completo, cerrado
   transitivamente. No muta nada.
2. `applyPrune(world, plan)` ejecuta ese plan, ya mirado.

El plan es dato puro y serializable. Por eso se puede mostrar, contar y
descartar sin haber tocado el mundo — y por eso cancelar no tiene que deshacer
nada: nunca llegó a hacerse. La confirmación dice «esto se lleva puestas 3
recetas y 12 objetos del mapa», que es una frase que solo se puede decir
habiendo calculado el arrastre de verdad.

Sin este paso, la alternativa era borrar de a uno a ciegas y dejar un mundo que
se contradice: recetas que piden materia que ya nadie hace, planos que colocan
un bloque que no existe.

### El único que arrastra es el tipo

Podar una receta, una interacción, un plano o una descomposición se lleva solo
eso: son reglas hoja, nadie se apoya en ellas. **Quitar la receta de la tabla no
borra las tablas que ya están hechas** — deja de saber hacer más, que es lo que
se pidió.

Un tipo es otra cosa, porque el tipo es de lo que hablan todas las demás reglas.
Su caída se propaga a todo lo que lo nombra: las recetas que lo producen y las
que lo piden de ingrediente, las interacciones que lo apuntan o que exigen
llevarlo, los planos que lo colocan, su descomposición, su dibujo y sus
ejemplares vivos.

**Y ahí se corta, a propósito.** El producto de una receta que cayó sobrevive
como tipo: sus ejemplares siguen en el mundo y siguen sirviendo para lo que
servían, y lo único que se perdió es saber hacer más. Encadenar hasta ahí
vaciaría medio mundo por quitar un ingrediente — justo lo que la confirmación
tiene que poder prometer que no pasa.

Un plano o una descomposición que nombra el tipo caído se va **entero**, aunque
nombre otras cosas además. Recortarle la parte afectada sería editarlo, y editar
a espaldas del cuidador es peor que borrar a la vista: un plano al que le falta
una pared ya no es el plano que aprobó.

### En las habilidades, la unidad es el nombre

La biblioteca guarda versiones, pero el cuidador no piensa en versiones.
«Olvidá abrigarse» no quiere decir «olvidá la v7 y dejá las seis que fallaron»:
los intentos anteriores **son** esa habilidad, y una historia sin su final es
basura, no memoria.

Una habilidad que **usa** a otra no sobrevive a su pieza: su programa la invoca
y sin ella no hace nada, así que se cae con ella, y eso se cierra
transitivamente. La ascendencia, en cambio, **no** arrastra: `parentVersionId`
es de dónde salió, no de qué depende. Una v3 funciona igual aunque se olvide la
v1 de la que nació; lo único que se pierde es saber de dónde venía, así que se
le corta el puntero y se la deja viva.

Y borra de verdad, no archiva. `archived` es el tombstone del evaluador —«se
probó y no llegó»—, y esa distinción es conocimiento que vale guardar. Esto es
otra cosa: el cuidador dice que no quiere saber más nada. Dejarlo como tombstone
lo haría reaparecer en cada listado que mire estados y lo seguiría cargando en
el guardado, que es el problema que se vino a resolver.

## La excepción: constancia de lo de fábrica

Hay una función que existe para deshacer justo esto. `adoptNewWorldRules`
vuelve a sembrar `MVP_RECIPES` en cada carga, y con razón: **las recetas base
son física del juego, no progreso de la mascota**, así que cuando el juego
aprende una regla nueva una partida vieja también la recibe. Su trabajo es
exactamente «si falta, ponela».

Eso choca de frente con la poda: quitar la fogata duraba hasta la próxima
recarga, porque la función siguiente la encontraba faltando y la reponía. No es
una hipótesis — se vio en vivo, con el catálogo volviendo de 19 objetos a 22.

Por eso se guarda `ui.prunedRules`: los ids de reglas que el cuidador podó a
propósito, para que la siembra los saltee. Es la única excepción a «borra de
verdad, no dejes tombstone», y se la banca porque son un puñado de strings de
ids del CÓDIGO, no artefactos con peso. Vive en `ui` y no en el snapshot porque
es una decisión del cuidador, del mismo linaje que la mochila (ADR 0070).

Dos consecuencias del orden y del alcance:

**Se lee antes de sembrar.** En `applySave`, `prunedRules` se carga *antes* de
llamar a `adoptNewWorldRules`. Al revés, la función no sabría todavía qué
saltear y resucitaría lo podado igual.

**Muere con el mundo que se podó.** La limpia `buildFreshRuntime`, que es el
único lugar donde nace un mundo — y nacen por dos caminos, reiniciar y morirse.
A diferencia del color o la mochila, la poda no es una preferencia sobre cómo
jugar: es una decisión sobre *este* mundo, y un mundo nuevo nace con toda su
física.

Eso incluye lo que la antecesora había inventado: una generación nueva hereda
todo lo que su antecesora consiguió que el mundo admitiera (ADR 0047), aunque
el cuidador se lo hubiera quitado a la anterior. Se eligió así por coherencia
con la línea de arriba —podar no es prohibir, vale para el mundo donde se
hizo— y porque la alternativa dejaba una asimetría rara: lo de fábrica volvía
en la vida siguiente y lo inventado no.

## Lo que no se poda

`pet`, `food` y `tree` — el mismo `PROTECTED_KINDS` que ya usaba la puerta de
recetas para no dejar fabricar mascotas. Sin `pet` no hay a quién cuidar; sin
`food` ni `tree` el mundo deja de tener con qué resolver el hambre, que es el
problema del que sale todo lo demás. El intento no tira un error: devuelve un
plan bloqueado con el motivo, porque la UI necesita poder decirlo.

## Consecuencias

**No hace falta subir `SAVE_VERSION`.** Un mundo podado es un mundo con menos
cosas en las mismas listas: la forma del save no cambia. Un guardado viejo se lee
igual y un guardado podado se lee en una versión anterior del código sin
problema.

**La poda pendiente no se guarda.** Vive en `GameSession.pendingPrune` y no
viaja al save: una pregunta a medio contestar no es estado de la partida.
Recargar en el medio de una confirmación la descarta, que es lo correcto.

**Al confirmar se aplica el plan guardado, no uno recalculado.** Lo que el
cuidador aprobó es la lista que leyó. Si el mundo cambió entre el plan y la
confirmación —la mascota siguió jugando—, lo que sobrevivió se queda: mejor
podar de menos que podar algo que nadie vio en la lista.

**Los ejemplares se sacan también de las mochilas.** `inventory.items` guarda
ids, y es la única referencia entre entidades que existe en todo el motor. Un id
que ya no resuelve a nada es un objeto fantasma que la mascota cree llevar.

**La mascota puede volver a inventar lo que se le quitó.** No hay lista negra:
si la necesidad que produjo esa receta sigue ahí, la puerta de invención la va a
volver a proponer y el mundo la va a volver a admitir. Es coherente con que las
puertas decidan por criterio y no por historial — pero significa que podar no es
prohibir, y el cuidador que quiera que algo no vuelva va a tener que quitarle
también el motivo.

**Esto es la fase 1.** Vive dentro de la partida: se poda lo que este mundo
sabe. Un catálogo compartido entre generaciones —con claves KV propias, del tipo
`catalog:recipe:<id>`, que sobreviva a la muerte de la mascota— es la fase 2, y
va a necesitar separar el catálogo del estado de partida. La API ya lo soporta
sin cambios: es un KV genérico con `GET /data` para listar.
