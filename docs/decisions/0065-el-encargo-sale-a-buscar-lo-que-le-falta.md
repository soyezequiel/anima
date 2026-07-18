# ADR 0065 — El encargo sale a buscar lo que le falta

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El cuidador pide que, si a la escuela le falta un muro, lo resuelva **sola**.

Estado real de su partida al mirarlo:

```
ella:            (0, 0)          ← la esquina del mapa
troncos sueltos: (11,2), (8,5)   ← existen, lejos, fuera de su vista
receta:          muro-aula = 1x log
encargo:         [suspended] «aparezca un tronco»
```

El material existía. Ella sabía exactamente qué necesitaba. Y estaba quieta.

La causa es el criterio para despertar. `reviveSuppliedRequests` reactivaba un
encargo dormido con una sola condición: que lo que falta esté **a la vista y
levantable**. Ese filtro nació bien —evitaba un bucle suspender/revivir cuando
lo que veía eran sus propios muros ya colocados (ADR 0046)— pero deja una
trampa cerrada:

- para ver el tronco tiene que moverse,
- y para moverse tiene que despertar el encargo,
- y el encargo solo despierta si ya ve el tronco.

En la partida real los troncos aparecieron **después** de que se rindiera
(cayeron de algo que rompió), lejos. Nadie iba a traérselos, y ella no iba a ir.

Es el mismo patrón que el ADR 0054 —«lo que no ve, lo busca»— que se resolvió
para el cuerpo (comida, calor, refugio) y quedó pendiente para los encargos.

## Decisión

Dos caminos nuevos para despertar, además del que ya existía:

1. **Lo RECUERDA.** Si la memoria de lugares tiene ese material, despierta y va.
   Sin esto la memoria de lugares era adorno justo cuando más sirve: el
   programa del encargo ya sabe caminar hasta lo recordado (`rememberedWalk`).

2. **Vuelve a intentarlo cada tanto** (120 ticks). El programa del encargo
   explora hasta cincuenta pasos antes de darse por vencido, así que reintentar
   no es repetir: es **salir a buscar de nuevo**, con el mapa que ya caminó.

Rendirse para siempre por no haber encontrado algo una vez es lo que la dejaba
con la obra a medias.

## Lo que NO cambia

**Falta de recurso no abre el ciclo de habilidades**, y es a propósito (ADR
0008): ninguna habilidad conjura un tronco que no existe. El pedido del
cuidador incluía «si tiene que crear habilidades que lo haga», y esa puerta ya
está abierta donde corresponde — cuando lo que falta es **capacidad** (camino
bloqueado, algo demasiado duro), la escalada a diseñar una habilidad ya
funciona. Lo que fallaba acá no era capacidad ni idea: era que no salía a
mirar.

## Consecuencias

- Una obra a medias deja de ser un estado terminal silencioso.
- El costo es acotado: un reintento cada 120 ticks, y cada uno explora como
  máximo cincuenta pasos. Con material inexistente vuelve a dormirse.
- El motivo del despertar queda registrado y se distingue en los tres casos
  («apareció el material», «recordó dónde había», «vuelve a salir a buscar»).

## Nota de método

El primer intento de prueba **no reproducía nada**: puse la madera lejos desde
el arranque, y ella la encontró sola —el programa explora antes de rendirse— y
terminó la obra sin ayuda del arreglo. La prueba pasaba con y sin él.

La diferencia estaba en el orden de los hechos: en la partida real **primero se
rindió** (no había un solo tronco) y **después** apareció el material. La
prueba que sirve reproduce esa secuencia: mundo pelado → se suspende de verdad
→ recién ahí cae la madera, lejos y fuera de vista.

Y una trampa propia: medí «cuánto caminó» con su posición FINAL, cuando vuelve
al sitio de la obra a colocar. Había que medir lo más lejos que llegó.
