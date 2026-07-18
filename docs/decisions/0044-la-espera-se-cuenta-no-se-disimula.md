# ADR 0044 — La espera se cuenta, no se disimula: sueños, progreso y reloj mientras piensa

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Con un proveedor real, pensar es lento (ADR 0039) y acotado en cuerpo (ADR
0040): tras 20 ticks el mundo se sostiene hasta que la respuesta llegue. El
peor caso es el ciclo de desarrollo de habilidades — hasta 8 versiones, cada
una con su consulta — que podía ser 20+ minutos de mundo quieto con tres
puntitos parpadeando. El cuidador no tenía forma de distinguir "está pensando
algo grande" de "se colgó", y lo más interesante que hace la mascota (imaginar
mundos, probarse en ellos, corregirse) era exactamente lo más invisible.

## Decisión

Cuatro piezas, todas de observación — ninguna cambia la simulación:

1. **El ciclo de desarrollo se cuenta en vivo.** `skill.requested` lleva ahora
   `maxVersions`, y la sesión deriva de los eventos del ciclo un estado
   efímero (`GameView.skillDev`): versión en curso, intento N de M, cuántos
   mundos prueban, tasa de la última versión. La burbuja de "pensando" del
   tablero y la del chat lo muestran ("la v3 logró 35% · corrigiendo").

2. **Los sueños se ven.** El evaluador acepta un oyente (`onCase`) que recibe
   la traza de cada caso: la escenografía inicial del mundo imaginado y el
   camino recorrido. La sesión guarda las últimas (efímeras, no se guardan) y
   un visor en el tablero las reproduce en miniatura mientras piensa, con el
   veredicto real (✓/✗) al final. Nada se inventa: es la evaluación que corrió.

3. **La detención del tiempo se dice.** Cuando el presupuesto biológico se
   agota, el tablero se desatura y un cartel lo nombra ("el mundo espera su
   mente") con un reloj vivo y, cuando hay historial (`ai.timing` de la
   sesión), cuánto suele tardar una consulta de ese tipo. Sub-segundo (el
   mock) no promete nada: "~0:00" es ruido.

4. **El cuerpo piensa.** Mientras hay una consulta en vuelo, la mascota se
   balancea despacio y su mirada se va hacia arriba. Puro dibujo en Phaser;
   la física no se entera.

5. **La espera invita.** Pasados unos segundos, bajo el "pensando" del chat
   rota una pista de qué mirar mientras tanto (el árbol de crafteo, sus
   habilidades, su memoria), y el input avisa que escribir sigue valiendo: el
   mensaje queda encolado y lo lee al volver. Invitaciones a lo que ya existe,
   no contenido nuevo.

## Consecuencias

- La espera larga dejó de ser tiempo muerto: el momento más lento (desarrollar
  una habilidad) es ahora el más legible — se ve qué versión va, cómo le fue y
  qué está soñando.
- Un mundo sostenido ya no se confunde con un cuelgue: está dicho, medido y
  con expectativa.
- El costo es un hook opcional en el evaluador y estado efímero en la sesión:
  con el mock (tests) todo resuelve igual y nada de esto persiste.
- Pendiente natural: cuando el desarrollo salga del think único (ADR 0039/0043),
  estas mismas piezas contarán cada tramo por separado sin cambios.
