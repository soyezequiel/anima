# ADR 0083 — Los objetivos son predicados del mundo

Fecha: 2026-07-21 · Estado: aceptada

## Contexto

Los objetivos guardaban `successCriteria` y `failureCriteria` como frases, pero
esas frases no se evaluaban. En el camino general de pedidos, una ejecución de
la DSL con `outcome: completed` cerraba el objetivo. Había correcciones locales
para obras y relaciones espaciales, señal de que «terminó el programa» y «el
mundo quedó como se pidió» eran conceptos distintos sin una frontera común.

La confusión permitía falsos éxitos: recoger otro individuo del mismo tipo,
terminar una navegación del lado incorrecto o agotar una secuencia de
colocación sin que el objeto quedara donde correspondía.

## Decisión

Cada objetivo puede persistir dos árboles declarativos: `successCondition` y
`failureCondition`. El álgebra es cerrada y componible con `all`, `any` y `not`.
Sus hojas describen estados medibles: inventario e identidad, presencia o
ausencia confirmada, distancia y posición, relación espacial anclada, métricas
del cuerpo, obra completa, existencia de una habilidad estable, contadores y
hechos emitidos por el motor.

El evaluador es puro y determinista. Recibe una `Perception` actual y evidencia
autoritativa producida por eventos del mundo. Devuelve tres estados:

- `met`: hay evidencia suficiente y el predicado es cierto;
- `unmet`: hay evidencia suficiente y es falso;
- `unknown`: la percepción parcial no autoriza una conclusión.

`unknown` es necesario: dejar de ver una entidad no prueba que fue destruida.
La ausencia solo se acredita cuando el motor emitió el evento correspondiente.
Así se conserva el límite del agente —no recibe `WorldState` completo— sin
convertir la ceguera en un hecho.

Las referencias pueden contener un id resuelto al aceptar el pedido o un
binding que se liga al individuo que el motor confirmó que fue recogido,
creado, colocado, consumido o destruido. Condiciones, bindings, ausencias,
hechos y contadores viven dentro del objetivo y atraviesan el guardado.

El fin de una actividad es solamente un dato de ejecución. Al agotarse la DSL,
el agente evalúa la condición con la percepción fresca:

- si el estado está cumplido, cierra el objetivo aunque la DSL haya abortado;
- si no está cumplido, emite `goal.outcome.unmet`, registra el diagnóstico y
  recompone el programa desde el mundo actual;
- tras repetir sin cambios una estrategia que no alcanza el estado, aplica el
  protocolo existente de prohibición y suspensión.

Los objetivos tienen además `mode: achievement | maintenance`. Un logro se
cierra al quedar verdadero. Un mantenimiento permanece activo mientras sea
válido; cuando deja de serlo vuelve a actuar. «Alejate del lobo» puede ser un
logro, mientras «mantenete lejos del lobo» es mantenimiento.

El modelo solo traduce lenguaje a intención estructurada: acción, referencias,
relación espacial, relación de colocación y si es mantenimiento. La condición
la deriva código determinista de esa intención. El modelo no recibe ninguna
salida con la que pueda declarar el objetivo cumplido.

## Consecuencias

«Traé el tronco» se acredita con el individuo solicitado en inventario; «cruzá
el muro», con la posición al otro lado del anclaje inicial; «dejá el martillo
junto a la fogata», con la distancia entre ambas entidades. Ninguna regla
conoce las palabras `tronco`, `muro`, `martillo`, `fogata` o `lobo`.

Los guardados anteriores siguen cargando con `mode: achievement`; una condición
ausente conserva el ciclo legado hasta que ese tipo de objetivo sea migrado.
Los motivos internos y el aprendizaje mantienen por ahora sus ciclos de
evidencia ya existentes, aunque sus nuevos objetivos también persisten
condiciones declarativas. La frontera crítica migrada en esta decisión son los
encargos físicos del usuario.

Una condición puede permanecer `unknown` legítimamente. Eso evita mentir, pero
también puede exigir nueva percepción o evidencia antes de cerrar. El
diagnóstico estructurado hace visible cuál de las dos cosas falta.
