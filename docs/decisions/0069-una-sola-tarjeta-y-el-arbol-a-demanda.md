# ADR 0069 — Una sola tarjeta, y el árbol a demanda

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Dos pedidos del cuidador que resultaron ser el mismo problema visto desde dos
lados: **la respuesta estaba en otra pantalla**.

1. El panel «Ahora» de la barra tenía su propio resumen del objetivo —la
   descripción y poco más— mientras la pestaña Objetivos mostraba el mismo
   objetivo con su avance, sus pasos y su materia. Dos versiones del mismo
   hecho, y la que estaba siempre a la vista era la pobre.

2. Ver «me faltan 3 encimeras» no explica **por qué** está trabada. La razón
   estaba dos niveles más abajo: las encimeras salen de tablas, las tablas de
   ramas, y ramas no hay. Eso no se veía en ninguna parte.

## Decisión

### Una sola tarjeta

`GoalCard` se exporta y la barra de arriba renderiza **exactamente** esa. Un
objetivo se cuenta de una sola manera, esté donde esté mirando el cuidador.

### El árbol, por niveles y a demanda

Cada materia que falta abre su árbol: nivel 0 es lo que la obra pide, nivel 1
con qué se hace eso, y así hacia abajo.

**No se calcula entero, nunca.** La cadena no tiene final garantizado —una
receta puede apoyarse en otra indefinidamente, y hasta dar vueltas (ADR 0031)—
así que cada rama se resuelve cuando alguien la abre. Lo que se dibuja es
siempre lo que se está mirando.

**Las cuentas se multiplican por la rama entera.** 3 encimeras → 6 tablas → 12
ramas. Mostrar la receta de *una* tabla en el nivel de abajo haría que el
cuidador junte de menos, y el error no se vería: el árbol quedaría igual de
prolijo. Es la única cuenta del árbol, y por eso vive en una función aparte con
sus propias pruebas.

**Cada nodo lleva al catálogo.** Tocar un material salta a Objetos, abre su
ficha y la resalta (ADR 0056) — y esa ficha trae **su propio árbol**, así que se
puede seguir bajando sin volver atrás.

Se corta en dos sitios: un tipo que ya está en su propia rama se marca «vuelve
sobre sí misma» en vez de repetirse para siempre, y a partir de doce niveles se
avisa «sigue más abajo».

### La expansión vive fuera de los componentes

Lo que está desplegado es del **cuidador**, no del componente. Se guarda en el
tope de la aplicación (`useExpansion`) y baja como una dependencia explícita.

No es purismo: el panel se redibuja con cada tick del mundo y sus piezas se
montan y desmontan al ritmo de lo que la mascota hace —una lista de materia que
queda vacía un instante desmonta su fila—. Con el estado adentro, **medido: el
árbol se cerraba solo a los 1,6 segundos de abrirlo**. En un panel que respira
con la simulación, un `useState` local no es memoria.

La identidad de cada nodo es su **rama entera**, no su tipo: el mismo material
colgando de dos sitios distintos son dos nodos, y abrir uno no abre el otro.

## Consecuencias

- «Por qué no puede» pasa a ser navegable en vez de deducible.
- El catálogo se recorre a sí mismo: desde cualquier ficha se sigue bajando.
- El costo de dibujar es proporcional a lo abierto, no al tamaño del árbol.

## Nota de método

El fallo del estado que se perdía no lo vi leyendo el código: la primera prueba
en vivo pareció funcionar, y el clic siguiente falló porque el árbol ya se había
cerrado. Antes de tocar nada, medí cuántos nodos sobrevivían cada segundo —
`[1, 0, 0, 0, 0]`— y ahí el problema quedó nombrado.

Y una medición mal hecha propia: verifiqué que la ficha se resaltara con una
referencia al nodo del DOM tomada **antes** del salto, que para entonces ya
estaba desprendida. Dio «no se resalta» y el resaltado funcionaba. Al consultar
el DOM de nuevo apareció la clase. Guardar un nodo y preguntarle después es
medir el pasado.
