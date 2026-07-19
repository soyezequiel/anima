# ADR 0072 — El juez también pregunta si es una cosa

Fecha: 2026-07-18 · Estado: aceptada · Cierra un hueco del ADR 0032

## Contexto

Le pidieron una cocina y fabricó un objeto `cocina`: una entidad de una sola
celda, sólida, en (3,0). Dijo «Listo, ya está en su lugar». El glifo que propuso
para dibujarla lo confesó sin querer: «una cocina **de bloque**, un cuerpo macizo
y rectangular».

Es exactamente el «bloque casa» que el ADR 0032 se escribió para eliminar, y que
su contexto atribuye al dueño «desde el principio». Volvió por una puerta que
aquel ADR no cerró: la invención.

El ADR 0032 dice quién decide si algo es objeto u obra:

> El tipo de la respuesta ES la decisión, y la toma quien entiende qué es una
> casa — el modelo, no el intérprete ni el agente.

Y eso está bien. El problema es que **nadie le hacía la pregunta**. El prompt del
juez de recetas declaraba su alcance en una línea:

> Tu pregunta es una sola: ¿PUEDE ESTO SALIR DE ESTOS MATERIALES EN UN SOLO PASO?
> NO estás juzgando si la cosa puede existir.

Todo el juez es sobre granularidad de crafteo: si el paso es un paso o un salto
que se saltea los pisos del medio. Ni «obra», ni «plano», ni «lugar» aparecen en
ninguna parte.

Así que cuando se le preguntó si «1 encimera + 3 piedras + 1 pedernal → cocina»
era un paso honesto, contestó que sí — y **tenía razón**. Como paso de crafteo lo
es. Su veredicto quedó registrado: «Sí, esto es un solo paso honesto. Ya sabés
hacer la encimera, y apilar tres piedras encima para armar el hogar…».

«El modelo decide» era cierto solo en el sentido de que decidía su primer
impulso, sin que nadie lo interrogara.

## Decisión

El juez de recetas pasa a tener **dos** preguntas:

1. ¿Puede esto salir de estos materiales en un solo paso? (la de siempre)
2. ¿Esto es una cosa, o es un lugar?

Si es un lugar, se rechaza y se la manda a proponerlo como **obra**: las recetas
de sus piezas y el plano que las dispone en el suelo. Reusa el mecanismo de
rechazar-y-redirigir que el juez ya tenía para los saltos («NOMBRA las piezas
intermedias que le faltan»), y el bucle ya estaba: los rechazos vuelven en la
siguiente propuesta (`recipeRejections` → `rejections`) y la respuesta del modelo
admite `kind: 'blueprint'`.

### El criterio no es la portabilidad

La tentación era una regla mecánica: si lo que produce no se puede levantar, es
una obra. Es incorrecta, y la fogata lo demuestra — tampoco se lleva encima y aun
así es UNA cosa, un solo bulto, un solo gesto. Rechazar por no-portable habría
roto la fogata para arreglar la cocina.

El criterio que se le da es **si lo que nombró tiene PARTES que van en lugares
distintos**. Una casa son paredes puestas donde van; una cocina es una encimera,
un fogón y lo que haga falta, dispuestos en el espacio. Una fogata es un bulto.
Distinguir eso es un juicio sobre la naturaleza de la cosa, que es precisamente
lo que el ADR 0032 delega al modelo — solo que ahora se lo pregunta.

## Consecuencias

Un rechazo por «esto es un lugar» le cuesta un intento de invención, igual que un
rechazo por salto. A cambio, la próxima propuesta nace de esa respuesta y puede
venir como plano.

El riesgo es el simétrico: que empiece a declarar obras a cosas que son objetos y
no pueda fabricar nada de cierto tamaño. Por eso el criterio se escribe con su
contraejemplo dentro (la fogata) y no como una regla de tamaño ni de peso.

Esto no toca el mock: sus veredictos son deterministas y no leen el prompt. La
regresión vive en `packages/model-providers/tests/codex.test.ts` y fija las tres
cosas que no se pueden perder — que la segunda pregunta esté, que el rechazo
ofrezca la salida por obra, y que el contraejemplo de la fogata siga ahí.

Queda abierto lo que este ADR no arregla: las cocinas-objeto que ya existan en
mundos guardados siguen existiendo. No hay migración; se aprende de acá en
adelante.
