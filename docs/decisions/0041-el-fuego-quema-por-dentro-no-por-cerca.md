# ADR 0041 — El fuego quema por dentro, no por cerca

Fecha: 2026-07-18 · Estado: aceptado · Reemplaza la regla de alcance de
`hazard` fijada en el ADR 0015 y la «distancia segura = 2» del ADR 0025.

## Contexto

Una corrida real (semilla 5, tick 980) terminó con Ánima muerta por heridas a
manos de una fogata que ella misma había construido. La cronología es de
manual:

- Meta activa: «recuperar calor». Estrategia: `build-fire:torch`.
- La antorcha pide 1 tronco + 1 pedernal. El único pedernal estaba en (1,0).
- Su fogata estaba en (2,0), a distancia Chebyshev 1 del pedernal.
- Cada tic que se acercaba al pedernal entraba en el rango de daño, se comía
  1 de salud, el reflejo la sacaba un paso, y al tic siguiente el plan la
  volvía a meter.

Ocho tics, ocho de daño, muerte. No fue una mala decisión repetida: fue el
mundo pidiéndole dos cosas incompatibles.

La incompatibilidad estaba escrita en los números desde el ADR 0017: la fogata
calentaba hasta distancia 2 y quemaba a distancia ≤1. El conjunto de celdas
donde se está en calor y a salvo a la vez era exactamente el anillo de
distancia 2 — un borde, no una zona. Y como el `heatSource` y el `hazard`
tiraban en direcciones opuestas con un tic de diferencia, cualquier ruido en
el plan (un ingrediente del otro lado del fuego, un objetivo que pasara cerca)
convertía ese borde en una oscilación mortal.

El reflejo (`painReflex`, ADR 0025) hacía su trabajo perfecto y no alcanzaba:
aparta un paso, no deja rastro, y el planificador vuelve a pedir el mismo
camino al tic siguiente. Reflejo y plan tiraban con la misma fuerza y el que
sangraba era el cuerpo.

## Decisión

**`hazard` daña solo a quien está en la MISMA celda.** Estar al lado del fuego
no cuesta salud: calienta y nada más.

- `runHazardSystem` (`packages/sim-core/src/step.ts`) compara posiciones por
  igualdad, no por distancia Chebyshev ≤ 1.
- `SAFE_DISTANCE` (`packages/agent-core/src/agent.ts`) pasa de 2 a 1: salirse
  de la celda ya es estar a salvo.
- El hecho que deja el dolor se llama ahora «estar encima de un X hace daño».
  La redacción vieja («estar pegado a…») se sigue reconociendo, para que una
  mascota que aprendió con el cuerpo anterior no se olvide del fuego porque
  cambió la física.
- El reflejo mide contra **todos** los peligros conocidos, no solo contra el
  que la quemó: salir de un fuego para caer en otro no es escapar.

## Por qué así y no de otra forma

Se descartó **subir la distancia segura a 3 y el alcance del calor a 4**: mueve
el problema sin resolverlo, porque el borde sigue siendo un borde y el mundo
es de 9×5 — a esa escala «alejarse tres celdas» es cruzar el mapa.

Se descartó **darle memoria al reflejo** (prohibir el destino tras N golpes).
Arregla el síntoma —la oscilación— y deja en pie la regla que la causa: seguiría
sin poder juntar un pedernal que está al lado de un fuego. Es una buena idea
igual, pero para otro problema (que un fracaso repetido se vuelva legible), no
para este.

Lo que se eligió es más chico y más honesto con la ficción: **arrimarse al
fuego es lo que hay que hacer, y el mundo dejó de castigarlo**. El castigo
queda para meterse adentro, que es una decisión y no un roce.

## Consecuencias

**Buenas**

- «En calor» y «a salvo» dejan de ser conjuntos disjuntos: al lado del fuego
  se cumplen las dos. La oscilación mortal es imposible por construcción, no
  por un parche en el planificador.
- Los recursos que quedan junto a un peligro vuelven a ser alcanzables.
- La regla se explica en una línea, que es la vara del principio 1 del README.

**A tener en cuenta**

- **Un `hazard` con `collider.solid` es inofensivo por construcción**: nadie
  puede entrar en su celda. Si alguna vez hace falta un peligro que además
  bloquee, va a necesitar otro componente (algo tipo `contactHazard`), no este.
  El cactus de `packages/sim-core/tests/hazard.test.ts` dejó de ser sólido por
  esto.
- **El objetivo «ponerse a salvo» (ADR 0025) casi se queda sin casos.** Si
  estar en peligro es estar dentro, salir es siempre un paso, y el reflejo
  alcanza en cuanto haya una celda libre. El objetivo —y con él `pursueSafety`,
  el pedido de ayuda y la escalada— solo nace ya acorralada dentro del fuego.
  La maquinaria se deja en pie porque ese caso existe y está cubierto, pero es
  un camino angosto; si con el tiempo no aparece ninguna corrida que lo use,
  conviene borrarlo antes que mantenerlo.
- El daño sigue sin graduarse por calidad (ADR 0020): pisar una fogata mala
  quema igual que una buena.
