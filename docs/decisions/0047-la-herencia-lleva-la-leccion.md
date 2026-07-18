# ADR 0047 — La herencia lleva la lección, no solo el saber

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

En una partida observada de doce generaciones, **once murieron de hipotermia**.
El informe de legado calculaba, para cada una:

```
recommendations: ["morí de frío: busca una fuente de calor antes de que el
                  cuerpo se enfríe del todo", ...]
unfinishedGoals: ["recuperar calor"]
```

…se lo mostraba **al cuidador** en la pantalla de muerte (`DeathOverlay`), y lo
**descartaba al heredar**. `testimonyFromLegacy` transmitía cuatro cosas —
`knowledge`, `skills`, `message`, `traits` — y ninguna de ellas era la lección.
La sucesora nacía sin saber de qué había muerto su antecesora.

El segundo agujero era el de las recetas. `recipe` no aparecía ni una vez en
`legacy.ts`: la sucesora heredaba la *creencia* «puedo construir un
muro-escuela» pero no la receta que la respalda. Como la receta la inventa un
modelo, cada generación la reinventaba con otro nombre:

```
gen 1 → wall-escuela      gen 1 → pared-escuela, muro-aula
gen 2 → muro-escuela      gen 3 → muro aula
```

Cuatro nombres para el mismo objeto en cuatro generaciones. Y una contradicción
visible en la partida: el panel decía que había heredado el saber mientras ella
respondía «todavía no sé construir una escuela» — las dos cosas eran ciertas.

## Decisión

1. **El testimonio lleva la causa de muerte, los proyectos inconclusos y las
   recomendaciones.** Los tres campos ya existían en el informe; ahora cruzan.

2. **Entran como MEMORIA, nunca como objetivo.** La sucesora no nace con
   «recuperar calor» en su lista de metas: nace **sabiendo** que su antecesora
   murió de frío con eso pendiente. Su vida la elige ella. Esto mantiene el
   principio del ADR 0009 —el testimonio no son recuerdos propios— y evita que
   una heredera nazca persiguiendo un fantasma en un mundo que quizá sea cálido.

3. **La muerte de la antecesora entra como episodio de tipo `failure`.** No es
   un detalle: `failure` es el tipo que `experienceContext` levanta al escribir
   el contrato de una habilidad. Así la lección aterriza donde se decide *cómo
   intentarlo*, en vez de quedar como color narrativo en el chat.

4. **Las recomendaciones entran como hipótesis «según X, …» con confianza 0.65**,
   el mismo techo que el resto de lo heredado. Es testimonio: puede confiar,
   dudar o verificar, y su antecesora pudo equivocarse.

5. **Las reglas de construcción del mundo se heredan, merge por id.** Recetas y
   planos viajan en el informe y se funden en el mundo de la sucesora sin
   reemplazar nada. Esto no es una excepción nueva: `adoptNewWorldRules` ya
   sostiene que *«las recetas son reglas del mundo, no progreso de la mascota»*
   y hace exactamente el mismo merge cuando el juego aprende física nueva. Lo
   que ella consiguió que su mundo aceptara —pasando por la puerta del ADR 0042
   y el juicio de la IA Dios— es física, y la física del linaje no se reinventa.

6. **Los legados viejos se leen igual.** `worldRecipes` y `worldBlueprints` son
   opcionales; un informe anterior a este ADR se adopta sin ellos, como ya pasa
   con `traits`.

## Consecuencias

- La cadena de muertes idénticas se corta por el lado de la información: la
  heredera arranca sabiendo qué mató a la anterior. Que le sirva depende de ella
  y del ADR 0046, que es el que le permite seguir intentándolo.
- Los nombres se estabilizan a lo largo del linaje: la segunda generación ya no
  reinventa `muro-escuela` como `muro-aula`.
- Desaparece la contradicción entre el panel de aprendizaje y lo que ella dice
  saber hacer.
- Contrapartida aceptada: el informe de legado crece (lleva las recetas del
  mundo). Es un snapshot de reglas, no de entidades, así que el tamaño lo
  gobierna cuánto inventó el linaje, no cuánto vivió.
- Riesgo conocido: si una generación consigue que el mundo acepte una receta
  mala, sus descendientes la heredan sin volver a juzgarla. Se aceptó porque la
  puerta del ADR 0042 ya la filtró una vez; si aparece deriva de calidad, el
  lugar de arreglarlo es re-juzgar al heredar, no dejar de heredar.
