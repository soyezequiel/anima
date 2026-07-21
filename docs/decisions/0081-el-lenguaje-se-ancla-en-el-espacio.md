# ADR 0081 — El lenguaje se ancla en el espacio

Fecha: 2026-07-21 · Estado: aceptada

## Contexto

Ante «cruzá el muro», el intérprete podía hablar de cruzar o abrir un ciclo de
aprendizaje, pero no expresar el resultado pedido. `interpret.command` recibía
los tipos visibles sin su disposición, el catálogo solo admitía direcciones y
los objetivos terminaban al acabar el programa, no al comprobar la geometría.

El defecto no era una falta de sinónimos para «muro»: lenguaje, mapa y criterio
de éxito no compartían una representación.

## Decisión

Los pedidos de ubicación entran como `spatial-relation`. El modelo elige una
relación medible (`opposite-side`, `near`, `far-from`) y una referencia por su
tipo; no elige coordenadas ni pasos.

Al aceptar el pedido, un _grounder_ determinista:

1. separa referencias contiguas para no mezclar dos objetos distintos;
2. elige la referencia visible pertinente;
3. resuelve la relación contra la posición y los bordes conocidos;
4. guarda la geometría en el objetivo.

La geometría se congela al aceptar. En especial, «el otro lado» conserva el
lado inicial: recalcularlo mientras la mascota camina haría que la meta cambiara
con ella.

La DSL incorpora `moveTo`, navegación a una celda fija con el mismo BFS y la
misma memoria espacial que `moveToward`. Si `opposite-side` no tiene ruta y la
referencia es rompible, abrir un hueco es una estrategia intermedia; no completa
el encargo. El objetivo se completa solamente cuando el predicado espacial se
cumple contra la posición real.

El contexto de diálogo incluye la celda propia y las posiciones visibles para
que el modelo pueda resolver referencias, pero esos textos no otorgan permiso
ni prueban el resultado.

## Consecuencias

«Cruzar» ya no es una habilidad abstracta ni un caso especial para `wall`.
Muros, ríos, cercos y cualquier conjunto contiguo se tratan con la misma
geometría. Acercarse y alejarse usan el mismo contrato.

Una ejecución terminada no alcanza para decir «Listo»: el verificador espacial
debe confirmar el estado final. Si la referencia es ambigua o no está visible,
el pedido requiere información en lugar de inventar una ubicación.
