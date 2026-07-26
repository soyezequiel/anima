# ADR 0086 — Lo que sabe hacer es un catálogo, y el plan es de ahora

Fecha: 2026-07-25 · Estado: aceptada

## Contexto

Ánima ya sabía moverse, buscar, recoger, soltar, colocar, consumir, usar
herramientas, fabricar, construir, interactuar y explorar. El problema nunca fue
que le faltaran acciones: era que esas acciones no estaban expuestas con un
contrato uniforme, y eso se pagaba en tres lugares.

**El vocabulario estaba escrito cinco veces.** `CommandInterpretation.action`
para el modelo, `GoalUserRequest.kind` para el chat, `SkillOp` para la DSL,
`CausalAction.metadata.kind` para el planificador y `ActionIntent` para el motor.
Cada conversión era un `switch` a mano. Agregar una capacidad significaba tocar
cinco archivos, y como no existía una lista canónica, el prompt que le dice al
modelo qué se puede pedir era una constante de 110 líneas que podía
desincronizarse del código sin que nada fallara.

**La ejecución era ciega en el medio.** Se compilaba un programa entero de la DSL
y lo único que volvía era «terminó» o «abortó con tal motivo». Entre la rama
`lastActionFailed` incrustada en el programa —que solo ve la última acción— y la
condición de la meta —que solo se mira al final— no había nada. Un paso podía
completarse sin haber ocurrido, y veinte ticks después ya no se sabía cuál había
mentido. `validateObservedStep` y `replanCausally` existían, estaban probadas, y
no las llamaba ninguna ruta de producción.

**Y aprender era el camino por omisión de todo lo raro.** Cuando el intérprete no
podía encajar una frase en su lista cerrada, la clasificaba `unsupported`, y eso
disparaba `developSkill`: hasta ocho versiones medidas en 2 escenarios × 20
semillas × 200 ticks, **síncronos en el hilo de la interfaz**, antes de que la
mascota moviera un pie. Peor: dentro de un pedido compuesto («conseguí madera y
hacé una fogata»), las partes `unsupported` se descartaban en silencio, y el
cuidador se quedaba esperando algo que nadie iba a intentar.

## Decisión

### Una capacidad es el contrato uniforme de todo lo que sabe hacer

`Capability` reúne las cinco caras en un objeto: identificador semántico,
parámetros tipados con validación de runtime, precondiciones y efectos en el
lenguaje del planificador causal, costo, riesgo, cómo se compila a la DSL, y
—lo que faltaba— **cómo se comprueba contra el mundo**. Ese predicado es del
álgebra cerrada de `goal-conditions`: la misma con la que se cierran las metas.

`verify` puede devolver `null`, y eso significa algo preciso: este paso no tiene
un predicado PROPIO que lo distinga del mundo alrededor. Romper «un árbol» es el
caso claro — con un bosque delante, «ya no hay árboles» no es lo que se pidió.
Declararlo es decir la verdad; inventar un predicado que se cumple solo sería
peor, porque el paso se saltearía sin ejecutarse.

`CapabilityRegistry` es el catálogo único. Es contra él que el intérprete hace
grounding, de él sale la lista de acciones del prompt, y por él pasa todo lo que
quiera actuar. **Una capacidad que no está registrada no existe**, y decir «no sé
hacer eso» con la lista en la mano es distinto de decirlo por omisión.

### Un plan es efímero y no es una habilidad

`Plan` existe para resolver el objetivo de AHORA: se compone de capacidades, se
ejecuta paso a paso, se recalcula con percepción fresca y **no se guarda por
haber funcionado una vez**. Es deliberadamente lo opuesto a `SkillDefinition`,
que se versiona, pasa por cuarenta mundos imaginados y sobrevive. Confundirlas
era lo que hacía que la primera acción útil tuviera que esperar a que naciera un
artefacto.

No se persiste: al restaurar, el objetivo sigue vivo y el plan se rearma. Es más
correcto que revivir un plan hecho para un mundo que ya no está.

### La ejecución mira lo que hizo

`PlanExecutor` corre un paso, lee el veredicto del mundo y compara contra la
expectativa que la capacidad declaró. Tres desenlaces, y la letra chica importa:

- **el efecto está**: el paso queda hecho y sigue el siguiente;
- **el programa terminó y el efecto no está**: se replanifica con percepción
  fresca si queda presupuesto; si no, el paso queda `unverified` y el veredicto
  final se lo deja a la condición del objetivo, que es quien lo tiene;
- **el paso se rindió diciendo por qué**: ahí depende de qué clase de «no salió»
  sea, y **quién lo sabe es la capacidad, no el executor**. Un fracaso que dice
  que el mundo se movió (`retriable`) se arregla mirando de nuevo: llevarle al
  cuidador un «no pude recogerlo» con dos troncos nuevos a la vista sería
  rendirse antes de mirar. Un diagnóstico físico —objetivo inmune, herramienta
  débil, sin sitio— llega intacto al agente, que tiene maquinaria para atenderlo
  que replanificar se comería.

Un paso cuyo efecto ya es cierto se saltea sin gastar un tick, y la línea de base
de cada paso incluye lo que los pasos ANTERIORES del mismo plan prometieron: sin
eso, el segundo «recogé un tronco» de un plan nacía cumplido.

### Aprender vuelve a ser la excepción

`unsupported` ya no abre nada por su cuenta. La respuesta es qué no puede, qué sí
—enumerado desde el registro— y el ofrecimiento de aprenderlo. **El sí del
cuidador es la enseñanza explícita**, y recién ahí corre el ciclo con todas sus
garantías. En un pedido compuesto, la parte que no se pudo clasificar se dice en
voz alta y el resto sigue.

### La medición sale del hilo principal, y se reserva un cuarto de los mundos

`EvaluatorPort` vuelve inyectable dónde corre la evaluación: en el navegador la
atiende un worker (con caché por huella del artefacto y caída al proceso
principal si no está disponible), y en Node se resuelve en el acto. Las trazas de
los mundos imaginados vuelven una a una para que la UI las siga dibujando.

Y la grilla se reparte: los últimos mundos quedan **reservados**, se miden y
cuentan para promover, pero sus observaciones nunca vuelven al diseñador. Sin esa
reserva, ocho revisiones de «arreglá lo que falló ahí» producen una habilidad
ajustada a cuarenta mundos concretos en vez de una que funcione. Y una hija solo
se promueve con su madre si la madre de verdad la EJECUTÓ: `dependencies` mezcla
las piezas que nacieron con las que se llaman, y la diferencia quedaba estable
sin que un solo mundo la hubiera corrido.

## Consecuencias

- Un pedido común produce su primera acción en pocos ticks, sin crear nada.
- Un fallo real produce observación con nombre y replanificación, nunca una falsa
  finalización: si el encargo se da por cumplido, el mundo lo respalda.
- El prompt del intérprete se genera del código: si nace una capacidad aparece
  sola, si se borra deja de prometerse el mismo día.
- La validación deja de ser una sola: se separa lo que escribe un modelo
  (`untrusted`, con topes de tamaño y alcance) de lo que compila nuestro
  generador desde argumentos ya validados (`trusted`, misma forma sin los topes
  de entrada). Aplicar el tope de alcance a lo propio prohibía tender un puente
  largo, que es exactamente lo que un puente tiene que ser.
- Las habilidades existentes siguen funcionando, ahora como **macros**: una
  estable se ejecuta a través de la capacidad `skill.run`, y la de comida
  bloqueada se prefiere sobre la primitiva cuando existe.

## Alternativas descartadas

**Dejar que el modelo ejecute.** Traducir intención sí; ser el ejecutor de bajo
nivel, no. La DSL acotada, el veredicto del mundo y el evaluador independiente
son las garantías que hacen confiable a este sistema, y ninguna sobrevive a
llamadas libres.

**Replanificar ante cualquier fallo.** Se probó y se comía los diagnósticos: el
agente dejaba de suspender por falta de material, de pedir ayuda y de fabricar
una herramienta más fuerte, porque nunca llegaba a enterarse.
