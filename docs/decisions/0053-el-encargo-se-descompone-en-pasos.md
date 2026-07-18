# ADR 0053 — El encargo se descompone en pasos que se ven

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

`Goal.parentGoalId` existía desde el principio y **nadie lo escribía ni lo
leía**: letra muerta. Mientras tanto, un encargo grande («construí una
escuela») era por dentro una secuencia real de pasos —juntar cinco muros,
juntar el pizarrón, levantar la obra— pero esa secuencia vivía escondida en el
programa de la actividad. El panel de objetivos (ADR 0052) mostraba QUÉ
faltaba, pero no la forma del trabajo: no se veía que «conseguir muros» es una
cosa que se termina y se tacha mientras «levantar la obra» todavía no empezó.

El pedido del cuidador fue directo: que para completar un objetivo pueda crear
sub-objetivos, y que se vean como hijos del padre.

## Decisión

**Los pasos de un encargo son objetivos de verdad, hijos del encargo — pero no
compiten con él.**

### 1. Qué se crea

Al ponerse a trabajar un `craft-item` (`startUserActivity`), la mascota planta
un hijo por cada materia que el plan pide (`conseguir 5× muro aula`, con
`step: { kind: 'gather', targetKind, need }`) y un remate (`levantar la
escuela` / `armar la tabla`, `step: { kind: 'assemble' }`). Idempotente: cada
reanudación repone solo los que falten — si una receta inventada a mitad de
camino agrega una materia, su paso aparece; los existentes no se duplican.

Se crean recién al trabajar y no al aceptar el pedido, porque la cuenta de qué
falta necesita percepción.

### 2. Qué NO son

- **No entran en la fila.** `selectActive()` salta a cualquier goal con
  `parentGoalId`. Quien trabaja es el programa del padre — un hijo elegido como
  objetivo propio intentaría perseguirse sin petición que cumplir. Por lo
  mismo, no reciben número de puesto en el panel.
- **No tienen cuenta propia.** Un paso de juntar se da por cumplido con la
  MISMA `neededCountsFor` del padre (la que suspende y retoma, ADR 0046/0052):
  cuando esa materia deja de faltar —la juntó, se la trajeron o ya está
  puesta— el paso se completa y emite `goal.step.completed` (evento propio:
  quien escucha `goal.completed` de encargos enteros no ve pasos intermedios).

### 3. Cierre en cascada

`GoalManager.complete/fail` arrastran a los hijos abiertos: la obra hecha da
por hechos sus pasos, y un pedido que fracasa no deja pasos huérfanos fingiendo
estar en marcha. Suspender **no** cascada: un paso no espera nada propio —
espera lo que el padre. Un paso cerrado no revive si después suelta el
material: para eso ya está la suspensión del encargo entero, con lista fresca.

### 4. En el panel

Los hijos viajan anidados dentro del `GoalView` del padre (`children`), como
filas con tilde: `✓` tachado al cumplirse, `·` pendiente con su chip de materia
vivo (mismos colores del ADR 0052). Cuando hay pasos, el padre **no** repite
sus chips: los pasos son la historia, y contar lo mismo dos veces en la misma
tarjeta es la clase de duplicación que este panel vino a eliminar.

### 5. Addenda: que la jerarquía se LEA

La primera versión mostraba los pasos, pero no se entendía de quién eran. Tres
defectos, todos de lectura:

- **El chip de materia flotaba.** Salía al mismo margen que la viñeta del paso,
  así que parecía un paso hermano más. Ahora la fila del paso es una grilla
  `viñeta | cuerpo`, y la materia vive en el cuerpo: cuelga debajo del título,
  alineada con él. El bloque entero lleva una espina vertical que lo ata al
  padre.
- **Los números se contradecían.** El paso decía «4» (lo que pide) y el chip
  «1×» (lo que falta). Dentro de un paso el chip ahora dice «falta 1 de 4»: las
  dos cifras en una sola frase que las relaciona.
- **El plural se armaba mal.** `countedKindLabel` pluraliza la última palabra
  («4 pared escuelas»); en español el compuesto lo hace en la cabeza («4
  paredes escuela»), y no hay forma de saber si la segunda palabra es
  sustantivo o adjetivo en un tipo que inventó una IA. Los pasos usan la
  notación `4× pared escuela`, que esquiva la gramática y se lee igual que los
  chips.

Y una lección de fondo: el título de un paso de juntar **se redacta en la
pantalla, no se lee del guardado**. La primera versión lo congelaba al crear el
paso, así que las partidas ya guardadas iban a mostrar el plural roto para
siempre. El guardado conserva su descripción para el registro; la pantalla dice
lo que es verdad ahora.

## Consecuencias

- Persisten gratis: son goals, y los goals ya se serializan. Un guardado viejo
  carga sin hijos y los repone al reanudar el encargo.
- `fetch-item`/`destroy-entity` no se descomponen: son un solo paso, y un hijo
  único idéntico al padre sería ruido.
- La jerarquía es de un nivel. Si algún día un paso necesita pasos propios
  (cadena de crafteo profunda, ADR 0031), la puerta queda abierta — el modelo
  ya lo permite, la creación no lo hace.
- `goal.created` ahora viaja con `parentGoalId` cuando es un hijo, por si el
  registro técnico quiere distinguirlos.
