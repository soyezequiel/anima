# ADR 0042 — Una receta también tiene que tener sentido

Fecha: 2026-07-18 · Estado: aceptada · Cierra el hueco del ADR 0018 con el juez del ADR 0027

## Contexto

Una mascota inventó un **celular** hecho de **una rama y un pedernal**. Entró al
mundo sin que nada lo objetara, y con razón: la puerta determinista del ADR 0018
lo aprobó porque no había nada que objetar *de lo que ella sabe medir*.

- no creaba materia (2 ingredientes, 2 fragmentos al romperse),
- no giraba en círculos (`expandRecipeCost` bajaba hasta materia base),
- sus propiedades estaban en cota (`hardness: 0.92`, `durability: 5/5`),
- no era `pet`, `food` ni `tree`,
- hacía algo (era portable y rompible).

El primer diagnóstico fue el equivocado: *«un mundo primitivo no puede concebir
un celular»*. Eso habría sido prohibir el nombre, y prohibir nombres es
exactamente lo contrario de lo que quiere este proyecto — el catálogo del mundo
es **abierto**, la mascota bautiza lo que inventa, y el ADR 0031 existe para que
las cosas grandes se ganen bajando por sus partes.

El problema real es otro: **un celular sí se puede llegar a construir**. Lo que
no puede es costar dos objetos. Para hacerlo haría falta un procesador, memoria,
una pantalla, una carcasa — y cada una de esas su propia cadena hacia abajo,
hasta la materia prima. Ninguna de esas piezas existe hardcodeada, y no hace
falta que exista: se inventan, como todo lo demás.

Lo que falló no es que la cosa sea imposible. Es que **faltaban todos los pasos
del medio**, y ninguna comprobación determinista podía verlo, porque cada una
mira UN paso aislado y ese paso estaba perfectamente bien formado.

El ADR 0027 ya había encontrado este límite para las interacciones y le había
puesto nombre: *«que llevar agua exija un recipiente no lo sabe ningún esquema,
lo sabe el guardián del sentido de las cosas»*. Le dio un juez a las
interacciones; después las descomposiciones tuvieron el suyo. Las recetas
quedaron sin él por accidente cronológico —el 0018 es anterior al 0027— y el
código lo declaraba como diferencia deliberada:

> «La única diferencia estructural entre ambas es deliberada: las interacciones
> tienen un juez de coherencia (la IA Dios) y las recetas no.»

Era deliberada, pero ya no se sostiene: las recetas son la puerta que **más**
cambia el mundo de las tres, y era la única sin guardián.

## Decisión

**Toda receta inventada pasa por la IA Dios antes de tocar el mundo**, y su
pregunta es una sola:

> ¿Puede esto salir de estos materiales **en un solo paso**?

No *«¿esta cosa puede existir?»*. El juez no prohíbe el celular: **exige la
cadena que lo sostiene**. Un rechazo tiene que **nombrar las piezas que faltan**,
porque ese motivo viaja en `recipeRejections` hasta la próxima propuesta — y la
próxima idea nace de la respuesta anterior. El mecanismo para proponer el árbol
completo ya existe desde el ADR 0031 (`recipe-plan`); lo que faltaba era algo
que lo *exigiera* en vez de aceptar el atajo.

Las tres puertas que tocan la física comparten ahora la misma forma:

```
el modelo propone → la puerta determinista filtra → la IA Dios juzga → el mundo decide
```

1. **Se juzga cada receta, no el plan.** Un árbol entra hoja por hoja, y cada
   hoja se juzga al emitirse. Una receta se juzga por lo que ES, y en un árbol de
   cuatro capas las de abajo todavía no existían cuando el modelo las pensó.

2. **El juez ve lo que el mundo ya sabe hacer** (`knownRecipes`). Es lo único que
   separa un paso de un salto: `celular = procesador + pantalla` es honesto **si
   el procesador y la pantalla ya existen**, y es el mismo salto de siempre si
   no. El mismo nombre, el mismo producto, y veredictos opuestos según cuánta
   cadena haya recorrido — que es exactamente como debe ser.

3. **El juez sabe cuánto árbol cabe** (`depthBudget = MAX_RECIPE_DEPTH`). Pedirle
   seis pisos a un mundo que admite cuatro es mandarla contra una pared. Cuando
   la idea excede el tope, la respuesta honesta es *«esto te excede POR AHORA»*,
   no *«es imposible»*.

4. **La puerta determinista corre primero, y sin `obtainable`.** Si la idea ya es
   imposible, no vale la pena molestar al Dios (el mismo orden que las otras dos
   puertas). Se la llama sin la lista de materia a propósito: el agente solo
   percibe su entorno, y juzgar con SU lista rechazaría ideas por ingredientes
   que existen tres celdas más allá. Sin ese argumento, la puerta local es un
   **subconjunto estricto** de la del mundo — lo que rechaza aquí lo rechazaría
   allá igual, así que no puede perderse ninguna idea viable.

5. **El veto se aprende y persiste.** Igual que con las interacciones: queda como
   hecho (`no tiene sentido construir celular: ...`), viaja en su memoria y en el
   legado, y lo vetado no se re-inventa ni en otra sesión.

6. **Corregir no cuesta un tick.** Cuando la puerta o el Dios rechazan una idea,
   la mascota vuelve a pensar dentro del mismo turno. El rechazo vino de sus
   propios filtros, no del mundo: no hubo acto que gastar. El tope de intentos
   (`MAX_INVENTION_ATTEMPTS`) es lo que impide que esto gire.

7. **Sin juez no entra nada.** Un proveedor caído deja el mundo como estaba — el
   mismo lado seguro que las otras dos puertas. Pero el plan se conserva y no se
   le cobra el intento: fue un fallo de infraestructura, no una mala idea.

## Alcance deliberado

**Los planos (ADR 0032) no se juzgan.** Sus piezas ya pasaron por el juez una por
una; lo que queda es la forma, no el sentido.

**Las recetas que describe el cuidador (ADR 0024) tampoco.** Ahí ya hay un juez, y
es humano: ve la vista previa y confirma. Poner al Dios a vetar lo que una
persona acaba de aprobar invertiría el ADR 0024. Describir sigue sin ser poder
—`validateRecipe` corre igual— pero el sentido de lo que describe una persona lo
cuida esa persona.

## Lo que queda abierto

El tope de profundidad. `MAX_RECIPE_DEPTH = 4` y `MAX_PLAN_RECIPES = 4`
alcanzan para una cadena corta (`celular ← procesador ← silicio ← arena`), pero
un árbol ancho —procesador, memoria, pantalla y carcasa, cada uno con lo suyo—
no entra en un solo plan de 4 recetas, y `MAX_INVENTED_RECIPES = 12` es el techo
del mundo entero. Una cadena larga se construye entonces a lo largo de varias
sesiones de invención, no de una. Si en la práctica se ve que las ideas
ambiciosas mueren siempre contra ese tope en vez de contra el juez, el número a
mirar es `MAX_PLAN_RECIPES` antes que `MAX_RECIPE_DEPTH`.

## Consecuencias

- Inventar cuesta una consulta más por receta. Es el precio de que el catálogo no
  se ensucie: rechazar cuesta un intento, aprobar un salto le regala una cadena
  entera que nunca recorrió.
- El proveedor simulado **aprueba siempre**, y es la única asimetría con las otras
  dos puertas. A ellas les rechaza también el `propose` —sin comprensión abierta
  la puerta entera no existe, y no existir es coherente—, pero recetas sí propone
  (ADR 0006). Negarle el juicio dejaría media máquina en pie y la otra media
  muerta: ninguna receta entraría jamás en un mundo simulado, y lo que se estaría
  probando no sería la invención sino su ausencia. Responde como
  `judge.destruction`: un veredicto fijo, no un juicio, y el fijo es `true`
  porque el statu quo de las recetas era entrar sin juez.
- Un mundo viejo puede tener recetas absurdas ya aprendidas. No se migran: son
  parte de su historia, y borrarlas sería reescribirla.
