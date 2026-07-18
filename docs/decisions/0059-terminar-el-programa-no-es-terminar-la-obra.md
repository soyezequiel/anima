# ADR 0059 — Terminar el programa no es terminar la obra

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El cuidador avisa: *«intento hacer la escuela pero le faltó completarlo y
aparece como objetivo cumplido»*. Comprobado contra su partida guardada:

```
goals:  "petición del usuario: construi una escuela [completed]"
        "conseguir 5× muro de aula [completed]"
        "conseguir 1× pizarron [completed]"
        "levantar una escuela [completed]"
celdas: muro-de-aula@6,1: VACIO      ← agujero
        muro-de-aula@7,1: PUESTO
        muro-de-aula@8,1: VACIO      ← agujero
        muro-de-aula@6,2: PUESTO
        muro-de-aula@8,2: PUESTO
        pizarron@7,3:     PUESTO
```

Cuatro de seis celdas, y el encargo cerrado con un «Listo».

La causa es el encuentro de dos decisiones razonables:

1. **Colocar cada bloque está protegido** por «solo si de verdad lo tengo en la
   mano» y «solo si la celda sigue vacía» (ADR 0034). Si falta el bloque o la
   celda no se puede ocupar, esa celda **se saltea** en vez de abortar la obra.
   Es correcto: tirar el trabajo hecho por una pieza que no salió sería peor.

2. **El éxito de un encargo se medía como «el programa terminó sin abortar»**
   (`out.result.outcome === 'completed'`).

Juntas: si la obra se saltea celdas, el programa igual llega al final, y ese
final se leía como «cumplido». La palabra describía la **ejecución**, no el
**mundo**.

La cascada del ADR 0053 lo amplificaba: al completar el padre, sus pasos se
completaban también, así que el panel mostraba tres tildes verdes sobre una
escuela agujereada.

## Decisión

**Para las obras, el éxito se le pregunta al mundo.**

Antes de dar por cumplido un `craft-item` que es una obra, se comprueba si
quedan celdas pendientes (`pendingPlacements` contra el ancla). Si quedan, no
está cumplido.

Y no se marca como fracaso: se enruta por el **mismo camino que quedarse sin
material** (`no-candidates:obra-incompleta`), que ya sabe suspender con la
lista de lo que falta y despertar cuando aparezca (ADR 0046/0057). Fallar
cerraría el encargo para siempre; suspender lo deja retomable.

Los encargos que no son obras (traer, romper, consumir) no cambian: ahí no hay
celdas que revisar, y terminar el programa sí es haber cumplido.

## Consecuencias

- «Listo» vuelve a significar listo.
- Una obra que no se puede terminar deja de cerrarse sola: queda esperando, con
  su motivo, y el cuidador puede destrabarla.
- Riesgo aceptado: si la obra es imposible por el SITIO (una roca cayó sobre
  una celda) y no por material, la suspensión espera material que quizá ya
  tiene. Despertará y volverá a fallar. Es preferible a cerrar en falso, pero
  queda pendiente distinguir «me falta materia» de «no puedo ocupar esa celda»
  — y, en el segundo caso, replantear el sitio.

## Nota de método

Escribí cuatro versiones de la prueba antes de que reprodujera el fallo, y las
tres primeras pasaban **con y sin** el arreglo:

1. Material escaso y bloque no fabricable → el programa **aborta** (`fetchOps`
   termina en `selectTarget`, que aborta sin candidatos): entra por el camino
   viejo, nunca llega a «completado».
2. Bloque fabricable con receta que siempre falla → también aborta, apenas se
   acaban los troncos.
3. Assertions contra `plannedStructures` → el plan **desaparece** cuando el
   objetivo se cierra, así que «no falta nada» era justamente el síntoma del
   bug leído como si fuera salud. (Tercera vez en esta sesión que caigo en eso:
   medir contra el plan en vez de contra el mundo.)

La que sirvió: material de sobra y una **roca que cae sobre una celda** apenas
elegido el sitio, con la comprobación hecha sobre las entidades del mundo. Sin
el arreglo: `expected 'completed' not to be 'completed'`.
