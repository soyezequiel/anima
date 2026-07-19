# ADR 0073 — Lo que escribe se lee de un vistazo

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Se midió lo que Ánima había escrito en una partida corta: seis mensajes suyos.

Tres de los seis eran **la misma oración**:

```
No encuentro una piedra, un tronco o una fibra de este lado. Voy a abrirme paso por un muro.
No encuentro una piedra, un tronco o una fibra de este lado. Voy a abrirme paso por un muro.
No encuentro una piedra, un tronco o una fibra de este lado. Voy a abrirme paso por una roca.
```

La mitad de todo lo que había dicho era un anuncio repetido, y hay que leer los
tres para descubrir que son uno. Se abre paso varias veces por encargo (ADR 0066,
0067) y anunciaba cada apertura con la misma frase.

El costo no era solo del chat. `reply` también hace `noteConversation`, así que
cada copia entraba en su memoria de conversación y viajaba al modelo como
historial del próximo diálogo: tres veces la misma línea ocupando el contexto con
el que piensa.

Otro de los seis medía **635 caracteres** —siete veces la mediana— y estaba
cortado a la mitad: era el veredicto del juez de recetas volcado tal cual al
chat. Ese veredicto se escribe PARA ELLA, con las piezas que le faltan, porque de
ahí nace su próxima idea. Al cuidador le estaban mostrando un diálogo interno del
que no tiene nada que hacer. (Y el ADR 0072, al pedirle al juez que nombrara las
piezas y su disposición, lo había empujado por encima del tope de 600 — así que
la cola se perdía también en la memoria de ella, que es donde sí servía.)

## Decisión

**No se repite sola.** Un mensaje idéntico al último que dijo, sin que el
cuidador haya hablado en el medio, no se emite.

La condición «sin que el cuidador haya hablado» no es un detalle de
implementación: sin ella, preguntarle dos veces lo mismo devolvería silencio la
segunda vez, y eso se lee como que se colgó — peor que repetirse. Repetirse
contestando está bien; repetirse sola es lo que cansa.

Vive en `reply`, que es el cuello por donde pasa todo lo que dice, así que calla
las tres cosas de una: el chat, su memoria de conversación y el historial que
viaja al modelo.

**Al cuidador, el titular.** El veto de una receta le llega en su primera frase.
El veredicto entero sigue completo donde sirve: en el registro técnico
(`recipe.judged`) y en el hecho que se guarda en su memoria. Y el juez ahora
tiene instrucción de arrancar por el veredicto en una frase corta —«es la única
que va a leer su cuidador»— y dejar el detalle para después; ya no se le pide que
describa la disposición de las piezas, que la decide ella al proponer el plano.

## Consecuencias

Se pierde saber que abrió tres pasos en vez de uno. Es información real y está en
el registro técnico; en el chat era ruido con forma de novedad.

La regla es sobre mensajes IDÉNTICOS, no parecidos. «Voy a abrirme paso por un
muro» y «…por una roca» son dos mensajes y salen los dos. Es deliberado: comparar
por parecido exige un umbral, y un umbral mal puesto se come cosas distintas.

No toca lo que escribe el modelo en el diálogo: eso ya varía solo. Lo que se
repetía era la narración determinista de sus propias decisiones.
