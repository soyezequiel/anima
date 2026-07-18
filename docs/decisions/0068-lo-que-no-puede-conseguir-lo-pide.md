# ADR 0068 — Lo que no puede conseguir, lo pide

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El ADR 0067 le enseñó a **decir** que no veía de dónde sacar la materia. El
cuidador pidió el paso siguiente, que es el que importa: que la **pida**.

Contar no es pedir. Y lo que contaba no era accionable:

> «no pude reunir 1 fogón de cocina y 3 encimeras para una cocina»

Un fogón y una encimera no se consiguen: **se fabrican**. El cuidador no tiene
cómo darle una encimera. Lo que sí puede traerle es la materia base — y para
eso necesita saber **cuál** y **cuánta**.

## Decisión

Al quedarse sin material, si hay materia que **no tiene forma de conseguir**,
la pide con cantidad:

> «No veo de dónde sacarlo por acá — ¿me conseguís 12 ramas? Lo retomo apenas
> lo tenga.»

Cuatro decisiones dentro de esa frase:

**1. Materia base, no piezas intermedias.** El árbol de recetas se baja hasta
el suelo (`expandRecipeCost`) y se descuenta lo que ya lleva encima. «3
encimeras» se vuelve «12 ramas»: la unidad en la que el cuidador puede ayudar.

**2. Solo lo que NO puede conseguir sola.** A la cocina le faltaban ramas,
fibra y pedernal. La fibra sale de un arbusto y el pedernal está tirado —esos
los junta ella—, pero nada da ramas. La primera versión exigía que **todo**
fuera imposible para pedir, y con eso no pedía nunca: alcanza con que una pieza
lo sea. Pedir de más también es ruido.

**3. Se agrega, no reemplaza.** El aviso conserva la explicación de siempre,
que incluye la cadena entera («2 paredes, 2 tablas, 1 tronco») — la respuesta a
«¿por qué tanto?». Lo que cambia es el cierre: donde había una promesa vaga
(«sigo apenas consiga lo que falta») ahora hay una pregunta concreta.

**4. No se repite.** Se vuelve a pedir cuando la lista **cambia** —porque
consiguió parte, o porque ahora falta otra cosa—. Repetir el mismo pedido en
cada reintento era el ruido que hacía que el aviso dejara de leerse.

## Además: el tope de aperturas se persiste

El tope de tres aperturas por encargo (ADR 0067) vivía solo en memoria. Un tope
que se olvida al recargar no es un tope: cinco recargas son cinco veces el
presupuesto de demolición. Ahora viaja en el guardado.

Es la **tercera** vez en esta veta que aparece el mismo defecto: estado en
memoria que la recarga borra (`pendingGlyphs` en el ADR 0064,
`suspensionMaterials` en el 0066, `pathOpenings` acá). El patrón a vigilar:
**si un dato gobierna una decisión futura, tiene que estar en el guardado.**

## Consecuencias

- El cuidador recibe una instrucción ejecutable en vez de un diagnóstico.
- Un mundo sin cierta materia deja de ser un misterio: se sabe qué traer.
- La cuenta descuenta lo que lleva encima, así que el pedido baja a medida que
  ella consigue partes.

## Nota de método

Dos veces caí en el mismo error dentro de esta misma tarea: **reemplazar en vez
de agregar**. La primera versión del pedido tiraba la explicación de la cadena
de recetas, y dos pruebas de crafteo lo cazaron —fijaban que el mensaje
explicara «2 paredes, 2 tablas, 1 tronco»—. Es exactamente la lección que el
ADR 0067 ya había dejado escrita, y volví a pisarla.

Y un diagnóstico que casi doy por bueno de más: en la partida real vi seis
aperturas de paso con un tope de tres, y estuve por declarar roto el tope. Antes
de tocarlo miré **sin editar ningún archivo**: cero aperturas nuevas. Las seis
eran de mis propias recargas del servidor de desarrollo, que reseteaban el
contador — lo que no invalidaba el tope, pero sí probaba que había que
persistirlo.
