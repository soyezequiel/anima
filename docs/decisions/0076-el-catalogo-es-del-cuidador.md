# ADR 0076 — El catálogo es del cuidador

Fecha: 2026-07-19 · Estado: aceptada

## Contexto

El ADR 0075 le dio al cuidador la poda: por fin podía sacar cosas. Pero
mirando cómo quedaba apareció la pregunta de al lado, y era más grande —
**reiniciar tiraba todo**.

Hasta acá, todo lo que un mundo sabía vivía dentro del guardado de esa partida:
las cinco puertas de invención en `WorldState`, las habilidades en la
`SkillLibrary`, y las dos cosas dentro del mismo blob bajo la clave `save`.
Cambiar de semilla para probar otro mundo significaba tirar cada receta
inventada y cada conducta aprendida. Lo único que cruzaba de un mundo a otro
era el legado de una mascota muerta (ADR 0047), y solo hacia su sucesora
inmediata.

Eso hacía que experimentar costara caro justo donde el juego se pone
interesante. Un cuidador que quiere ver cómo se comporta lo mismo que enseñó en
un mapa distinto tenía que elegir entre el mapa nuevo y lo enseñado.

## Decisión

**Un catálogo del cuidador**: lo aprendido, guardado FUERA de toda partida.

Es la biblioteca del cuidador, no la memoria de la mascota. Esa distinción es
la que manda sobre todo lo demás.

### Seis claves, no una y no cincuenta

`catalog:recipes`, `catalog:interactions`, `catalog:blueprints`,
`catalog:decompositions`, `catalog:glyphs`, `catalog:skills`.

Una sola clave con todo repetiría el problema que ya aprieta al guardado: el
backend corta en 1 MB por valor. Seis claves son seis márgenes en vez de uno, y
además hacen que quitar una receta reescriba solo las recetas — la biblioteca
de habilidades no se toca por podar un objeto.

Una clave por elemento (`catalog:recipe:<id>`) era la otra opción y da CRUD más
fino, pero leer el catálogo entero costaría una petición por receta: el arranque
de la sesión pasaría de una ráfaga de seis a una de cincuenta. La API ya sirve
las dos formas sin cambios (es un KV genérico), así que esto se puede revisar
sin tocar el servidor.

### Qué entra: lo aprendido, no lo que trae el código

Se excluyen las recetas de `MVP_RECIPES`. Una receta de fábrica ya la pone el
escenario en cada mundo nuevo; guardarla la **congelaría** en la versión de hoy,
y el día que el juego la cambie las partidas nuevas seguirían recibiendo la
vieja. Es el mismo razonamiento con el que el ADR 0070 decide no copiar el 6 de
la mochila.

De las habilidades entran **solo las estables**, el mismo corte que hace
`buildLegacyReport`. Un intento que no pasó sus pruebas no es conocimiento;
propagarlo a todos los mundos futuros llenaría el catálogo de ruido que nunca
funcionó.

### Solo suma; sacar es un acto explícito

Publicar el catálogo une lo que este mundo aprendió con lo que ya había, y
nunca quita. Sin esa regla, abrir una partida vieja —anterior a un invento— y
guardar borraría del catálogo lo que otra partida había aportado.

Quitar es siempre deliberado: podar (ADR 0075) o vaciar el catálogo entero.
**La poda tiene que llegar hasta acá**, o duraría hasta el próximo mundo: el
catálogo lo volvería a sembrar, que es exactamente el mismo error que ya cometía
la siembra de reglas de fábrica.

Las habilidades se unen por **nombre** y no por id: dos mundos que aprenden
"abrigarse" por su cuenta producen ids distintos para la misma conducta, y
guardar las dos dejaría al mundo siguiente adoptando duplicados que compiten
entre sí. Gana la de mejor tasa medida, y a igualdad la versión más alta — el
mismo criterio que ya usa `findProvisional`.

### Las reglas se copian; las conductas se vuelven a rendir

Un mundo nuevo recibe las recetas, interacciones, planos, descomposiciones y
dibujos del catálogo por merge de id: lo que el escenario ya puso manda.

Las habilidades **no se copian**. Entran por `adoptCatalogSkills`, que usa la
misma maquinaria que el legado: toda conducta que llega de afuera se inserta
como `experimental` y tiene que volver a demostrarse acá. Y el criterio decide
cómo (ADR 0030) — el de un motivo se re-evalúa solo y se promueve solo; el de un
pedido, o el ausente de un artefacto viejo, espera que el cuidador confirme la
vara, porque promoverlo re-certificaría contra algo que nadie de este mundo
miró y el error se lavaría mundo tras mundo.

El catálogo guarda lo aprendido, no una licencia para saltearse el examen.

Para no duplicar esa lógica, el bloque de adopción de `adoptLegacy` se extrajo a
`adoptSkillArtifacts` y ahora lo comparten los dos caminos. El origen cambia el
relato —de quién vino, qué mensaje dejó—, nunca el trato.

## El interruptor

Reiniciar conserva por defecto. La casilla **«empezar de cero»** ignora el
catálogo para ese mundo, y existe porque ver cómo se las arregla una mascota sin
nada heredado es una de las cosas más interesantes que el juego ofrece: sin la
casilla, el catálogo se la comería para siempre.

Es del **gesto**, no un ajuste que quede puesto: se lee en el submit del
formulario de semilla y vuelve a apagarse. Vivir con el catálogo es lo normal;
arrancar sin él es la excepción que se pide en el momento.

Y no borra nada. Ignorar el catálogo y tirarlo son decisiones distintas, y la
segunda tiene su propio camino (`forgetCatalog`).

## Consecuencias

**El guardado no cambia de versión.** El catálogo vive en claves propias; el
`SessionSaveData` queda igual. Una partida guardada por una versión anterior se
lee sin tocar nada, simplemente con el catálogo vacío.

**Un catálogo roto no impide jugar.** Cada clave ilegible o ausente se lee como
vacía, nunca como error. Es una comodidad: si se corrompe, se pierde lo
guardado, pero la partida arranca igual.

**Se lee una vez y vive en memoria.** `reset` sale del submit de un formulario
y no puede esperar una lectura de red, así que el catálogo se carga al crear la
sesión y se mantiene. Se republica pegado a cada guardado, para que lo aprendido
y la partida queden firmes juntos.

**Nacer cuesta.** Un mundo nuevo con habilidades en el catálogo las re-evalúa en
cuarenta mundos imaginados antes del primer tick. Es el mismo costo que ya tenía
la sucesión de una mascota muerta, pero ahora se paga también al reiniciar —
sobre un catálogo grande, reiniciar va a dejar de ser instantáneo.

**La sucesión sigue por el legado.** `createSuccessor` no lee el catálogo: ya
hereda de su antecesora, y sumarle el catálogo adoptaría las mismas conductas
dos veces. Los dos caminos coexisten porque cuentan cosas distintas — el legado
es de quién viene, el catálogo es lo que el cuidador quiso guardar.

**Y `prunedRules` sigue haciendo falta.** El catálogo no guarda las recetas de
fábrica, así que la constancia del ADR 0075 sigue siendo la única defensa contra
que la siembra de `MVP_RECIPES` resucite lo podado dentro de una misma partida.
Son dos mecanismos para dos orígenes distintos, no uno redundante.
