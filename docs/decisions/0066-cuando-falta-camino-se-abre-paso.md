# ADR 0066 — Cuando lo que falta es camino, se abre paso

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El cuidador venía peleando con una escuela que no se terminaba. Tras varios
arreglos —que la obra saliera a buscar el material (ADR 0065), que la intención
sobreviviera a la recarga— seguía trabada, y al mirar el mapa entero apareció la
causa real:

```
mundo 13×7
muro: (5,0)(5,1)(5,2)(5,3)(5,4)(5,5)(5,6)   ← columna COMPLETA, sin abertura
ella:  lado izquierdo
madera: dos troncos y tres árboles, TODOS del lado derecho
```

Estaba **tapiada**. Toda la materia del mundo del otro lado de una pared sin
hueco. Podía reintentar y explorar para siempre: de su lado no había nada que
encontrar.

Y lo más frustrante: **ya sabía romper esa pared** —tenía la habilidad de
alcanzar comida bloqueada— pero atada a la comida, no a conseguir madera.

La raíz es que dos situaciones que desde afuera son opuestas, desde adentro de
su cabeza eran la misma: **«no hay»** y **«hay pero no llego»**. Las dos
llegaban como `no-candidates`, y `no-candidates` significa falta de recurso, que
por diseño (ADR 0008) no abre ninguna vía nueva —ninguna habilidad conjura un
tronco inexistente—. Correcto para «no hay»; una trampa para «no llego».

## Decisión

Antes de dar un `no-candidates` por «no hay», mirar si en realidad es «no
llego»: un obstáculo que la **encierra**.

`frontierBlocker` busca un sólido visible, rompible, que no sea de su propia
obra, y que tenga detrás una celda del mapa **donde nunca estuvo**. Esa última
condición es la que distingue una pared cualquiera de una frontera: si detrás
hay mundo sin pisar, lo que falta no es materia, es camino.

Si lo encuentra, corre `breakThroughProgram` —buscar la herramienta más fuerte
y golpear el obstáculo— como una actividad de propósito nuevo, `open-path`:

- **No cumple ni fracasa el encargo.** Abrirse paso es un rodeo, no la meta. El
  objetivo queda vivo; el próximo intento busca el material que antes no existía
  para ella, ahora del otro lado del hueco.
- **Se anuncia antes.** Romper algo no es una decisión silenciosa: «No encuentro
  X de este lado. Voy a abrirme paso por Y».
- **Se prohíbe si no cede.** Se registra como cualquier estrategia; dos
  fracasos y no se vuelve a intentar contra lo mismo. Si el muro es inmune, deja
  de golpear.

## Lo que NO es

No es aprender una habilidad. El pedido del cuidador incluía «si tiene que crear
habilidades que lo haga», y esa puerta sigue donde estaba (ADR 0008): se abre
cuando falta **capacidad** genuina —algo que no sabe hacer—. Abrirse paso no era
eso: ella ya sabía golpear un muro. Lo que faltaba no era una habilidad nueva
sino **reconocer cuándo aplicarla**. Enseñarle a distinguir «no hay» de «no
llego» resultó ser el todo del problema.

## Consecuencias

- Una obra tapiada deja de ser un callejón. Verificado en la partida real del
  cuidador: rompió el muro `(5,4)`, cruzó, trajo la madera y completó la obra,
  diciendo «Voy a abrirme paso por una roca» en el camino.
- El detector es conservador: exige ver el obstáculo, que sea rompible, y que
  esconda mundo sin pisar. Una pared con la que ya no gana nada (todo visitado
  del otro lado) no la tienta.
- No toca su propia obra (ADR 0058) ni golpea lo inmune (el veredicto del propio
  golpe lo corta).

## Nota de método

Dos trampas de medición, las mismas de siempre en esta veta:

1. La prueba de que «cruzó» miraba su posición FINAL —y vuelve al sitio de la
   obra a colocar, así que termina del lado de siempre—. Había que medir lo más
   lejos que LLEGÓ.
2. Al abrir el paso emitía un `strategy.failed` con el motivo en `null`: contaba
   una derrota que no ocurrió. El registro técnico es lo que se lee para
   entender qué pasó, así que un éxito disfrazado de fallo ahí es ruido. Ahora
   solo se emite cuando de verdad no cedió.
