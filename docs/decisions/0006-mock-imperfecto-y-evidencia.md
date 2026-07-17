# ADR 0006 — Mock imperfecto por diseño y evidencia inicial de hipótesis

Fecha: 2026-07-16 · Estado: aceptada

## MockModelProvider propone primero una versión defectuosa

La v1 de "alcanzar-alimento-bloqueado" elige la herramienta **más cercana**;
solo al recibir el informe `no-damage-dealt:*` propone elegir la **más
poderosa**. Esto simula un generador imperfecto y garantiza que la demo
ejercite el ciclo completo rechazo→regresión→corrección→promoción.

Hallazgo registrado: la v1 no falla en todas las semillas (≈83% de éxito),
porque en algunos mundos el martillo queda más cerca que la rama. Es el
comportamiento correcto: demuestra por qué el evaluador usa múltiples semillas
y por qué el umbral de promoción es 100%.

## La explicación/demostración inicial cuenta como evidencia

La confianza de hipótesis usa suavizado de Laplace `(pos+1)/(pos+neg+2)`.
Con solo 2 evidencias empíricas (consumo observado + energía que sube) la
confianza llega a 0.75 < umbral 0.8. Decisión: la explicación del usuario o la
demostración guiada se registra como primera evidencia positiva (es
información real a favor). Con 3 evidencias la confianza llega a 0.8 y la
consolidación la convierte en conocimiento. Alternativa descartada: bajar el
umbral (debilitaría todas las confirmaciones futuras).

## Adenda (2026-07-17): la imperfección tiene interruptor, y el default es que esté encendida

Las «respuestas tontas» del mock se pueden apagar desde los ajustes de la UI
(`MockModelProvider.setImperfect`). El interruptor está siempre a la vista —
con Codex encendido queda deshabilitado y dice por qué, en vez de esconderse:
una opción que solo aparece cuando ya sabías dónde buscarla no existe. La
preferencia es del cuidador y se guarda con la sesión, así que sobrevive a ir
y volver de Codex. Apagadas, el mock propone directamente la idea corregida:
la herramienta más capaz a la primera, la hoguera sin pasar por el atajo de
inventar comida. Es un modo de observación — ver el mundo sin el desvío del
error — y una forma de comparar en vivo qué aporta el ciclo de corrección.

Lo que NO cambia: el default es imperfecto, porque los tests del ciclo
fallar→rechazar→corregir→promover dependen de que el primer intento se
equivoque, y porque ese arco ES la historia del producto. Y las negativas
honestas (no traducir descripciones, no derivar contratos, no juzgar la
lógica de una interacción) no tienen interruptor: fingir comprensión no es un
modo, es el agujero que este ADR cierra.
