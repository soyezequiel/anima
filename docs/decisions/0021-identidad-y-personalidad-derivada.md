# 0021 — Identidad con nombre y personalidad derivada de la historia

Fecha: 2026-07-16 · Estado: aceptada

## Contexto

Ánima aprendía, se negaba, inventaba y moría dejando legado, pero seguía
sintiéndose un caso de prueba: se llamaba "Ánima" para siempre, no tenía
carácter reconocible y, aunque guardaba lo que el cuidador le enseñaba
(ADR 0016), esos momentos no volvían a su voz — no podía decir "vos me
enseñaste que..." ni "me pusiste este nombre". Faltaba la capa emocional:
que la mascota sea un individuo que conoce a su cuidador.

La tentación obvia era pedirle la personalidad al modelo ("describí cómo es
esta mascota") o sortearla al nacer. Los dos caminos rompen principios del
proyecto: el modelo alucinaría un carácter sin relación con lo vivido (y
cambiaría de opinión entre consultas), y el azar produciría rasgos sin
historia que los respalde. En este repo los proveedores proponen y el código
determinista decide (ADR 0016, 0019); la personalidad no puede ser la
excepción justo cuando pretende ser lo más "verdadero" de la mascota.

## Decisión

### El nombre es del cuidador

El cuidador puede renombrar a la mascota desde el encabezado de la UI y por
chat ("te voy a llamar Luna"). En el catálogo de `interpret.command` entra la
acción `rename-pet` (con el nombre tal como lo escribió el cuidador); para el
proveedor determinista, un patrón del parser (`parseRename`) reconoce los
bautismos frecuentes ("te voy a llamar X", "tu nombre es X", "te llamás X")
sin fingir comprensión abierta — una pregunta ("¿cómo te llamás?") no captura
nombre y no es bautismo.

El nombre vive donde siempre vivió, en `PetIdentity` (persistida en el
guardado); el agente emite `pet.renamed` y la capa de sesión lo aplica y
guarda. El bautismo además queda como episodio ("mi cuidador me puso el
nombre Luna") y el nombre viaja en los hechos de diálogo (`me llamo Luna`),
así que la mascota lo usa en su habla con cualquier proveedor.

### La personalidad se deriva, no se decide

`derivePersonality` (en `agent-core`) es una función pura sobre lo que ya
persiste: los eventos del agente y los episodios/hipótesis de su memoria.
Misma historia ⇒ mismos rasgos, siempre. Seis rasgos posibles, cada uno con
su umbral fijo:

| rasgo | de qué historia sale | umbral |
|---|---|---|
| curiosa | hipótesis formuladas + señales investigadas + recetas propuestas | ≥ 3 |
| perseverante | estrategias fallidas y aun así experimentos intentados | ≥ 2 fallos y ≥ 1 intento |
| constructora | recetas aprendidas + construcciones aceptadas + fuegos construidos | ≥ 1 |
| precavida | veces que se lastimó (episodios de dolor + reflejos) | ≥ 1 |
| servicial | pedidos del cuidador cumplidos | ≥ 2 |
| testaruda | negativas por valores (`will_not`) | ≥ 2 |

Se muestran a lo sumo 4, ordenados por cuánta historia los respalda (empates
por orden fijo de declaración). Una recién nacida no tiene ninguno: la
personalidad se gana viviendo, y el panel lo dice ("todavía se está
formando") en lugar de inventar dos rasgos para cumplir una cuota. Los
umbrales son deliberadamente alcanzables en una vida corta: la historia del
MVP ya produce "perseverante" (dos fallos del camino directo y dos versiones
de la habilidad) sin tocar el evaluador ni el mundo.

**El modelo puede ponerles voz, nunca definirlos.** Los rasgos viajan al
prompt de diálogo como un hecho más ("mi historia dice que soy curiosa,
perseverante"): el modelo puede decir "ya me conocés, soy curiosa", pero si
afirmara un rasgo que la función no derivó, sería tan falso como cuando
afirma haber aprendido algo que el evaluador rechazó — y igual de inofensivo,
porque ningún estado se escribe desde el diálogo. No hay petición cognitiva
nueva: derivar es gratis y no consume consultas.

### Los recuerdos del vínculo vuelven a su voz

Los episodios que involucran al cuidador (enseñanzas, pedidos cumplidos, el
bautismo, la ayuda que llegó después de "¿Puedes ayudarme?" — episodio nuevo
`caretaker-help` — y lo que dejó la antecesora) entran en los hechos de
diálogo como "recuerdo que ..." con presupuesto fijo (los 3 más recientes,
como el resto de los hechos: nunca toda la memoria). Con el mock, la
referencia es enlatada pero honesta: ante "¿te acordás...?" repite un
recuerdo real que viaja en los hechos, y si no hay ninguno lo dice.

### Persistencia y sucesión sin formato nuevo

No hizo falta tocar `SessionSaveData`: el nombre ya persistía en la
identidad, y los rasgos y recuerdos se derivan de eventos y episodios que ya
viajaban en el guardado — un guardado viejo gana personalidad al cargarse,
gratis, como adoptó recetas y frío (patrón `adoptNewWorldRules`). Lo único
que se sincroniza al restaurar es el nombre del agente (`agent.setName`),
porque el agente se construye antes de leer la identidad guardada.

El informe de legado gana `traits` (opcional: los legados anteriores no lo
traen y se leen igual) y el testimonio lo lleva a la sucesora, que lo
registra como episodio ("mi antecesora Luna era curiosa, perseverante"). La
personalidad no se hereda — la sucesora deriva la suya de su propia vida —,
pero saber cómo era su antecesora es parte del testimonio, como el
conocimiento que igual debe verificar.

## Consecuencias

- La mascota tiene nombre propio elegido por su cuidador, que sobrevive a la
  recarga y aparece en su habla; el bautismo es un recuerdo.
- El panel Estado muestra los rasgos con su evidencia ("falló 2 veces y aun
  así intentó 4 experimentos nuevos"): el cuidador ve de dónde sale cada
  rasgo, igual que ve el contrato de una habilidad.
- Dos mascotas con vidas distintas tienen personalidades distintas por
  construcción, y la misma vida repetida (misma semilla, mismas órdenes) da
  la misma personalidad: probado con tests deterministas.
- Los umbrales son juicio de diseño, no verdad revelada: están en un solo
  lugar (`personality.ts`) y ajustarlos no toca ni el guardado ni el modelo.
- El mock sigue sin fingir: renombra por patrón, recuerda por hechos
  enlatados y no opina sobre carácter. Sin claves, la experiencia completa
  sigue funcionando.
