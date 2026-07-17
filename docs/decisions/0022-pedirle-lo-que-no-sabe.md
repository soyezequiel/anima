# ADR 0022 — Pedirle lo que no sabe es pedirle una idea

Fecha: 2026-07-16 · Estado: aceptada · Enmienda los ADR 0013 y 0018

## Contexto

El ADR 0018 le dio a la mascota el poder de inventar recetas, con una puerta que
las juzga. La puerta funciona. El poder casi no se usaba: `inventRecipe` se
llamaba desde un solo lugar —`pursueWarmth`, y solo si no conocía el fuego—, así
que **únicamente tenía ideas cuando tenía frío**. Ningún otro problema le daba
permiso de que se le ocurriera algo.

El caso que lo rompe estaba en una corrida real. El cuidador escribió «crea una
casa», y esto es lo que pasó:

1. El mundo no tiene receta de `casa`, así que el prompt de interpretación
   mandaba `unsupported` — le decía al modelo, literalmente, que «construir algo
   que no tiene receta» es tan imposible como volar.
2. `unsupported` deriva en aprender una CONDUCTA (ADR 0013), que es la respuesta
   correcta para «bailá un tango» y la equivocada para un pedido de FÍSICA.
3. El modelo escribió entonces una habilidad cuya propia descripción decía «no
   se puede construir ni crear objetos», con el criterio de éxito «termina
   llevando un martillo».
4. El evaluador la aprobó al 100% y la promovió a estable.

Le pidieron una casa y aprendió a agarrar un martillo. Nadie mintió: cada pieza
hizo lo que le tocaba con la información que tenía. El problema es que la
información era vieja — **el prompt declaraba imposible algo que dejó de serlo
el día del ADR 0018**, y la mascota terminó aprendiendo a fingir en vez de a
proponer.

## Decisión

**Pedirle construir algo que su mundo no sabe hacer es el disparador más natural
que existe para tener una idea.** No hace falta que tenga frío: alcanza con que
alguien le pida algo que todavía no sabe.

Tres cambios, uno por cada capa que lo impedía:

- **Interpretación** (enmienda el ADR 0013): `craft-item` deja de exigir que lo
  pedido figure en las recetas. Si figura, `recipeId` es su id; si no, es un id
  nuevo que nombra lo pedido. Que sepa hacerlo no es asunto del intérprete: su
  trabajo es clasificar la intención, y la intención es construir. Preguntar si
  existe la receta era lógica del agente filtrada al prompt, y fue exactamente
  la filtración que causó el desastre. `unsupported` queda para lo que ninguna
  primitiva logra (volar), no para lo que todavía no se le ocurrió.
- **Negativa**: `evaluateUserRequest` ya no responde «no sé cómo construir X.
  Solo puedo construir lo que mi mundo permite». Esa frase era falsa desde el
  ADR 0018. No saber la receta no es no poder: ahora acepta, y lo que dice es
  «todavía no sé construir X; déjame pensar si se me ocurre algo».
- **Agente**: antes de armar el programa de una petición, si le pidieron algo
  sin receta, propone. El mundo juzga la idea; si entra, el tick siguiente ya
  hay receta y construir vuelve a ser el programa de siempre.

### La idea lleva el nombre que usó el cuidador

`recipe.propose` acepta `wantedId`: el id (y tipo) que la receta debe tener.

Sin eso, el arco se rompe en silencio de la peor manera. El cuidador pide una
`casa`, el modelo bautiza su idea `refugio`, el mundo la acepta —y la petición
sigue sin encontrar receta de `casa`. Volvería a inventar, y otra vez, hasta
quedarse sin crédito sin entender nunca por qué, con el mundo llenándose de
sinónimos de lo mismo.

El prompt le pide traducir ese nombre a lo que sus materiales permitan de
verdad: no tiene que lograr la idea completa que evoca la palabra, sino lo más
honesto que se le parezca. Una casa suya va a ser unos troncos apilados, y está
bien: la puerta del ADR 0018 ya garantiza que no pueda declararse una mansión.

### El crédito se paga por problema, no por vida

`recipeAttempts` era un contador global que solo subía: gastados los tres
intentos, quedaba muda para siempre. Un tope global convierte el tercer invento
fallido en una condena — que un problema la haya derrotado no dice nada sobre el
próximo.

Ahora vive en `ProgressController` indexado por objetivo, igual que
`skillDevAttempts`, que ya resolvía este mismo problema para las habilidades. Lo
que **no** se repone son los rechazos (`recipeRejections`): un rechazo es una
lección sobre la física («no puedes inventar comida») y vale para toda idea
futura, venga del problema que venga.

## Consecuencias

- El arco del eje 3 se puede ver entero movido por una frase: «construí un
  castillo» → propone un castillo comestible (el atajo de siempre) → el mundo lo
  rechaza → corrige → el mundo acepta → lo construye. Antes ninguna frase del
  cuidador podía llegar a `proposeRecipe`.
- **Quedarse sin material dejó de ser un fracaso opaco.** Todos los abortos por
  `no-candidates` se aplastaban en «no encuentro el objeto», que tira a la
  basura lo único que el cuidador puede usar para ayudarla: ella SABE qué le
  falta y cuánto, porque se lo dice `missingIngredients` — la misma fuente con
  la que acepta o se niega. Ahora dice «me faltan 3 ramas y no veo más por acá».
  El bug era viejo, pero este ADR lo volvió urgente: con una receta que ella
  inventó, nadie más que ella sabe qué lleva, así que un fracaso mudo es
  irresoluble para el cuidador.
- **Queda en pie lo que el reporte pedía y esto no resuelve**: sus propios
  fracasos siguen sin darle permiso de tener ideas. El único disparador interno
  es el frío. Un muro que no puede romper todavía no le sugiere una herramienta
  mejor. Hoy inventa más por pedido ajeno que por necesidad propia.
- **La vara de las skills quedó peor parada, no mejor.** Que «crear una casa» se
  promoviera al 100% midiendo «llevar un martillo» no fue mala suerte: es que
  nada obliga al criterio a guardar relación con lo pedido. Sacarle a la
  interpretación los pedidos de física le quita a esa grieta un modo de
  aparecer, pero no la cierra.
- El prompt de la DSL enseñaba media lección sobre `held` —«para juntar VARIOS,
  filtrá con `held:false`»— y el modelo la generalizó a todas las búsquedas,
  incluida «conseguir una herramienta», donde es lo contrario de lo que hay que
  hacer: con el martillo en la mano, `held:false` no encuentra ninguno y el
  programa aborta con `no-candidates` reclamando lo que ya tiene. Ahora enseña
  las dos mitades y el patrón correcto, que es el que nuestro propio programa de
  `destroy-entity` ya usaba: buscar sin `held` y guardar el `pickup` detrás de
  un `branch if not holding`.
