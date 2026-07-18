# ADR 0063 — Dibujar lo que tiene delante

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El cuidador avisa que los tipos nuevos tardan mucho en tener su dibujo: los
muros de la escuela se quedaban un rato largo con la apariencia genérica que la
pantalla compone sola.

La causa está en una decisión razonable de la quinta puerta. `drawSomethingNew`
—inventar el dibujo de un tipo que nadie dibujó— se consulta en un solo lugar
de `think`: cuando `selectActive()` no devuelve nada. El comentario dice por
qué:

> dibujar no cambia el mundo, así que solo ocupa los ticks que de otro modo se
> irían en no hacer nada. Nunca le quita un turno al hambre, al frío ni a lo
> que le pidió el cuidador.

El principio es correcto. El problema es cuándo se cumple: **construyendo una
escuela no hay un solo tick ocioso en cientos de turnos**. Y los tipos que
nacen ahí —`muro-de-aula`, `pizarron`— son exactamente los que el cuidador está
mirando levantarse.

Dicho de otro modo: la regla ordenaba los dibujos al revés de la atención. Lo
que más importa ver es lo que se está construyendo ahora, y era lo último en
dejar de ser un bloque genérico.

## Decisión

Un segundo momento para dibujar, antes de continuar la actividad en curso, con
dos condiciones que preservan el motivo original:

- **Que lo tenga a la vista o en la mano.** Si el tipo no está delante de ella,
  puede esperar al tick ocioso de siempre. Esto es lo que ata el gasto a la
  atención: se dibuja lo que se está mirando.
- **Que el cuerpo no esté en rojo.** El hambre y el frío críticos siguen
  mandando (ADR 0048).

Cuesta **un tick, una vez por tipo**, contra los cientos que dura una obra. El
camino viejo (los ticks ociosos) se queda igual para todo lo demás.

## Consecuencias

- Lo que construye toma su forma definitiva casi en el acto.
- El orden de la cola deja de ser puramente FIFO: se atiende primero lo visible.
  Los tipos que nadie ve conservan su turno en el orden en que entraron.
- Una obra larga paga unos pocos ticks extra —uno por cada tipo nuevo que
  aparezca— y a cambio se ve como es mientras se levanta.

## Nota de método

Tres intentos hasta tener una prueba que sirviera:

1. El glifo de prueba estaba mal formado: la grilla es de **16×16**, no 8×8, y
   con un alfabeto cerrado de índices `0-3`. El mundo lo rechazaba en la
   puerta, y la prueba fallaba por el dibujo, no por el momento.
2. Una prueba afirmaba «con el cuerpo en rojo no dibuja». Es falso y no es lo
   que se implementó: si además está OCIOSA, dibujar sigue estando bien —no hay
   nada mejor que hacer—. La guarda del cuerpo solo aplica a quitarle el turno
   a una actividad. Se reemplazó por la otra guarda, que sí es real: un tipo
   que no está a la vista no interrumpe nada.
3. La prueba principal medía si el dibujo aparecía «alguna vez», y pasaba
   **con y sin** el arreglo: en un mundo chico el encargo termina rápido y el
   camino ocioso también lo dibuja. Lo que había que medir era **cuándo** —si
   el encargo seguía abierto en ese momento—. Recién ahí la prueba distingue.
