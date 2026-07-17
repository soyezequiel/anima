# ADR 0024 — IA Dios: el cuidador describe, el mundo decide, y nada entra sin un sí

Fecha: 2026-07-16 · Estado: aceptada · Extiende la puerta del ADR 0018

## Contexto

Desde el ADR 0018 la mascota inventa recetas: el modelo propone, y el mundo
valida con una puerta de física (`validateRecipe`) que nadie puede saltarse.
El pedido nuevo es darle ese poder también al cuidador: describir un objeto en
lenguaje natural («un glorb es un mineral azul que da calor») y que se vuelva
una receta real de su mundo.

La tentación era darle al cuidador un camino privilegiado — es el dueño del
juego, ¿no puede crear lo que quiera? No. El hambre, el frío y la escasez son
el motor de toda la historia de la mascota; un cuidador que puede declarar
comida infinita o un martillo de poder 100 los apaga con una frase. El poder
peligroso es el mismo que el del ADR 0018, y la respuesta también.

## Decisión

**Describir no es poder, ni siquiera para el cuidador.** El flujo reusa la
puerta de invención entera, con una diferencia deliberada: la confirmación.

1. **Un momento cognitivo nuevo, `entity.describe`.** El modelo traduce la
   descripción libre a una receta. La receta viaja **cruda** (serializada como
   `recipeJson`, el mismo sobre que `programJson`: los validadores de esquemas
   de salida rechazan objetos abiertos), y el prompt lleva el mismo catálogo de
   componentes y cotas que `recipe.propose`: decirlo no reemplaza a la
   validación, pero evita gastar consultas en imposibles.

2. **La interpretación distingue describir de construir y de enseñar.** El
   catálogo de `interpret.command` gana `describe-entity`: definir un objeto
   nuevo no es `craft-item` (fabricar algo ya nombrado) ni `explanation`
   (enseñar cómo funciona lo que ya existe). Solo un modelo real la produce:
   el parser determinista no la conoce, así que el mock jamás dispara este
   flujo por accidente.

3. **La misma puerta juzga, dos veces.** La traducción pasa por
   `validateRecipe` contra las recetas vigentes. Si el mundo la rechaza, la
   respuesta honesta es el motivo del rechazo, en el chat: el cuidador no
   puede crear comida, criaturas ni herramientas sobradas, exactamente igual
   que la mascota. Si la acepta, todavía no entró: la entrada real ocurre
   después, por la intención `proposeRecipe` de siempre, y `step.ts` vuelve a
   validar. No existe camino a `world.recipes` que se salte esa puerta; la
   validación previa solo decide si vale la pena preguntar.

4. **Nada entra al mundo sin confirmación.** Antes del sí, la mascota muestra
   una vista previa en el chat (evento `recipe.preview` → tarjeta: nombre
   humano, ingredientes y qué HACE, con el dibujo derivado de los rasgos igual
   que en `appearance.ts`) y pregunta «¿Lo hago parte de mi mundo?». ¿Por qué
   confirmar, si la mascota inventa sola sin preguntar? Porque el costo recae
   en quien no describió: la receta ocupa uno de los `MAX_INVENTED_RECIPES`
   del mundo y es permanente (viaja en los snapshots). La mascota paga sus
   inventos con sus propios intentos; el cuidador crea ley física para otra.
   La traducción además puede no ser lo que él quiso decir — la vista previa
   es su única oportunidad de verlo antes de que sea irreversible.

5. **La confirmación es del cuidador, no del modelo.** El sí/no se resuelve
   con un parser determinista ANTES de consultar nada («dale» aquí es una
   confirmación, no una continuación). Cualquier otro mensaje descarta la
   vista previa: nada entra por silencio ni por un «sí» viejo. La vista previa
   tampoco persiste: una confirmación no puede sobrevivir a la sesión en la
   que se mostró lo que confirmaba.

6. **Sin claves de IA, el flujo degrada con honestidad.** El mock no traduce
   descripciones (como no deriva contratos, ADR 0006): fingirlo con reglas
   produciría objetos que no son lo que el cuidador describió. Si el proveedor
   falla, la mascota lo explica en el chat y el mundo queda como estaba.

### La vista previa muestra el mejor desenlace

Las recetas tienen desenlaces con peso y calidad (ADR 0020), y una inventada
recibe siempre el reparto estándar (6/3/1). La tarjeta muestra el **arquetipo**
— el desenlace de más peso, vía `recipeProduct` — porque es lo que la mascota
*intenta* construir, no lo que cada tirada promete. Rediseñar la tarjeta para
mostrar los tres desenlaces sería rediseñar el sistema de desenlaces desde la
UI; queda fuera a propósito.

## Consecuencias

- El cuidador puede poblar el mundo con objetos que nadie programó, pero solo
  dentro de la misma física que rige a la mascota: capacidades, no recursos.
- La receta confirmada vive en `world.recipes`, viaja en los snapshots y es
  construible de inmediato («hacé un glorb») por el camino de siempre.
- Inventar por descripción cuesta una consulta al modelo (la traducción); la
  confirmación no cuesta ninguna.
- La tarjeta reusa la regla de dibujo por rasgos: un objeto descrito se ve
  como lo que hace, no hace falta registrar su nombre en ninguna tabla.
