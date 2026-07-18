# ADR 0036 — Inventar desde el propio fracaso

Fecha: 2026-07-18 · Estado: aceptada · Extiende el ADR 0018 (Ánima inventa
recetas) y el ADR 0022 (pedirle lo que no sabe); se apoya en la doctrina
recurso-vs-capacidad del ADR 0008.

## Contexto

El motor de invención existe de punta a punta (ADR 0018): el modelo propone una
receta cruda, `validateRecipe` filtra, y el mundo decide. Pero hasta hoy casi
todo lo que lo disparaba venía de **afuera de ella**:

- El **pedido del cuidador** de construir algo que su mundo no sabe hacer
  (ADR 0022, `inventForRequest`) — el disparador que más rinde.
- El **frío** sin nada que dé calor (`pursueWarmth` → `inventRecipe`).

Su único disparador interno era el frío. El reporte de la corrida lo marcó como
la segunda brecha más urgente, con todas las letras:

> «Sus propios problemas casi no le dan permiso de tener una idea. Un muro que
> no puede romper no le sugiere una herramienta mejor; un camino bloqueado no le
> sugiere nada. Hoy inventa por pedido ajeno mucho más que por necesidad
> propia.»

Y precisó qué construir: «disparadores desde sus propios fracasos — cuando una
estrategia queda prohibida por falta de CAPACIDAD (no de recurso), lo que falta
puede ser un objeto que todavía no existe».

## Decisión

**Un objetivo interno bloqueado por CAPACIDAD, después de agotar aprender una
conducta, se gana el permiso de proponer un objeto que todavía no existe.**

El lugar es exacto: la escalada del hambre (`pursueGoal` para
`GOAL_RESTORE_ENERGY`) ya distingue recurso de capacidad (ADR 0008) y ya escala
`crear-conducta → pedir-ayuda → suspender`. La invención entra **entre agotar la
conducta y rendirse a pedir ayuda**:

```
estrategias conocidas prohibidas
  └─ ¿bloqueo por recurso?  → sí → pedir ayuda (ninguna receta conjura materia)
                            → no → escalar:
       ├─ crear una conducta con lo que sé   (mientras queden intentos)
       └─ (conducta agotada) ANTES de pedir ayuda:
            └─ inventar un objeto  ←── nuevo (este ADR)
                 └─ si no hay con qué o ya gastó el crédito → pedir ayuda
```

### Por qué después de la conducta, no antes

La primera versión disparaba la invención ante *cualquier* bloqueo de capacidad,
y era demasiado ansiosa: un muro que se resuelve **aprendiendo a usar el martillo
que ya está tirado** no necesita un objeto nuevo, necesita una conducta. Ponerla
antes hacía que inventara un objeto cuando lo que le faltaba era una idea de
conducta.

El orden correcto lo dicta la honestidad: **primero lo que sé, después lo que no
existe**. Llegar a «pedir ayuda» por la vía de la capacidad significa que ya
intentó aprender una conducta con lo que tiene y sigue trabada por algo físico.
Recién ahí «lo que falta puede ser un objeto» deja de ser una corazonada y pasa
a ser la única hipótesis que queda. Es, palabra por palabra, el momento del
«ya probé todo lo que sé» que precede al pedido de ayuda.

### La vía del recurso queda afuera, a propósito

Un bloqueo por **recurso** (`blockedByMissingResource`, todas las estrategias
fallidas por `no-candidates`) no abre la invención: ahí no falta una idea, falta
materia, y ninguna receta la conjura (ADR 0008). El mismo principio por el que
el frío sin materiales tampoco inventa.

### Reusa el pipeline, no lo copia

`inventForObstacle` llama al mismo `InventionEngine.inventRecipe` que el frío y
las recetas por encargo: el mismo **crédito por objetivo** (`MAX_INVENTION_ATTEMPTS`,
ADR 0022), la misma **memoria de rechazos** que viaja al siguiente intento, la
misma **puerta del mundo** que valida. Si no hay materiales, `inventRecipe`
devuelve null y la escalada sigue con el pedido de ayuda — inventar es un intento
más, nunca un callejón. Los hechos que su cuerpo aprendió («la herramienta X no
puede dañar un Y») viajan en el enunciado del problema para hacer la idea
concreta, no como una condición para tenerla.

## Los límites que quedan, a propósito

- **Inventar el objeto no lo pone a usar.** Si el mundo acepta el `pico`, la
  receta queda —conocimiento suyo, persistente, visible para el cuidador y para
  las generaciones que hereden—, pero cerrar el lazo completo (fabricarlo y
  usarlo contra el muro en la misma corrida) pide una conducta nueva que lo
  fabrique. Con `maxSkillDevAttempts` mayor a 1, la conducta de después puede
  hacerlo, porque la receta ya existe cuando ese ciclo corre; con 1, el objeto
  queda inventado pero sin usar. El disparador es lo que este ADR entrega; el
  lazo cerrado es el paso siguiente.
- **Solo el hambre, por ahora.** El frío ya inventaba; el hambre es el segundo
  motivo que se gana el permiso. La seguridad (`pursueSafety`) sigue sin
  inventar: apartarse no es una capacidad que un objeto arregle — si no hay
  celda a donde ir, lo que falta es espacio, y eso lo arregla el cuidador.

## Consecuencias

- Su hambre bloqueada por fin le da permiso de tener una idea: el disparador
  interno que faltaba desde el ADR 0018.
- El orden `conducta → objeto → pedir ayuda` deja el pedido de ayuda como último
  recurso de verdad, no como la primera reacción a un muro.
- Verificado por `invent-from-failure.test.ts`: con el alimento detrás de un muro
  que su rama no denta y sin más conducta que aprender, propone un objeto al
  mundo **sin un solo mensaje del cuidador** en toda la corrida.
