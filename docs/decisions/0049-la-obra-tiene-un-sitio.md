# ADR 0049 — La obra tiene un sitio, y se ve antes de existir

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Una escuela quedó trabada para siempre en una partida real. El plano pedía 1
pizarrón + 5 muros; ella tenía **6 muros** (4 en la mano, 2 ya colocados) y
repetía cada cincuenta ticks:

> «No pude completar eso: no pude reunir 1 muro escuela para una escuela.»

Tres defectos encadenados, ninguno visible por separado:

1. **La cuenta de lo que falta miraba solo el inventario.** Con 2 muros ya
   levantados, el plano seguía pidiendo los 5: descontar el inventario era
   media cuenta. Decía «me falta 1» cuando le sobraba.

2. **El acopio exigía tener la obra entera en la mano.** El programa juntaba
   toda la tanda antes de colocar: 5 muros + 1 pizarrón = 6 objetos, que es
   exactamente la capacidad, sin lugar para el martillo con el que consigue el
   material. La condición «hasta tener 5 muros encima» **no se podía cumplir
   nunca**: la escuela era imposible por construcción.

3. **El ancla era «donde esté parada al arrancar».** Cada reanudación replantaba
   la obra en otro lugar, dejando bloques sueltos de intentos anteriores, y
   podía pedirle al mundo celdas ya ocupadas —que el motor rechazaba una por
   una, sin que ella entendiera por qué.

Y un cuarto, introducido al arreglar el ADR 0046: el reactivador de encargos
despertaba la obra al ver material del tipo que faltaba **sin exigir que fuera
recogible**, así que sus propios muros ya colocados contaban como «apareció
material». De ahí el mensaje idéntico en bucle.

## Decisión

1. **La obra se planta en un SITIO, elegido antes de empezar.** Se busca un
   ancla cercana desde la que todas las celdas del plano caigan dentro del mapa
   y sobre suelo que no estorbe. El sitio se guarda por objetivo y **persiste**:
   retomar una obra es seguir la misma, no empezar otra al lado.

2. **El sitio se revalida al llegar, y solo puede mudarse si no se puso nada.**
   La vista exige línea despejada (ADR 0025): una roca detrás de otra no estaba
   en el mapa que miró al elegir. Al acercarse aparece. Mientras no haya ningún
   bloque en el suelo, se elige otro claro; con un bloque puesto, el sitio es
   ese y lo que estorba se resuelve de otra forma. Sin esa condición, descubrir
   un obstáculo a mitad de obra dejaría media choza abandonada.

   La garantía honesta es **«no se superpone con nada que ella pueda ver»**, no
   «no se superpone con nada». Prometer lo segundo sería mentir sobre lo que
   una criatura con línea de visión puede saber.

3. **Lo ya levantado deja de pedirse.** Tanto el mensaje como el programa
   trabajan sobre las celdas que faltan, no sobre el plano entero.

4. **Se acopia dejando una ranura libre.** Las tandas son de `capacidad - 1`:
   llenar las manos de bloques deja sin lugar la herramienta con la que se
   consigue el material que falta.

5. **La obra se dibuja antes de existir.** El agente expone, celda por celda,
   qué bloque va en cada una y cuál ya está puesto; la pantalla lo pinta como
   siluetas translúcidas por debajo de todo lo real. Las pendientes llevan el
   emoji del bloque en transparente; las hechas, solo el contorno, para que la
   forma completa se lea. Es un plan, no una cosa: no participa de la física ni
   se puede tocar.

6. **Reactivar un encargo exige material RECOGIBLE.** `portable` no es un
   detalle: un bloque colocado deja de serlo (ADR 0034).

## Consecuencias

- Las obras se terminan. El caso que lo motivó —6 muros para un plano de 5—
  ahora avanza en vez de repetir un mensaje para siempre.
- El cuidador ve dónde va a quedar la construcción antes de que exista, y puede
  objetar el sitio antes de que ella gaste ticks en material.
- Una obra puede no arrancar si no hay claro donde levantarla en el radio de
  búsqueda. Es deliberado: mejor no empezar que desparramar bloques en celdas
  ocupadas.
- El sitio viaja en el guardado. Los guardados anteriores no lo traen y eligen
  uno la próxima vez que la obra se retome, como hacían siempre.
- Queda pendiente (fuera de este ADR): que pueda despejar el sitio —romper o
  correr lo que estorba— en vez de buscar otro claro. Hoy solo esquiva.
