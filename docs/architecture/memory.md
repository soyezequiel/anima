# Memoria

Capas implementadas en `@anima/memory` (`MemoryStore`):

## Memoria de trabajo
Pequeña y acotada: objetivo actual, últimos resultados (≤8), conversación
inmediata (≤12). Nunca crece sin límite.

## Episódica
Eventos significativos con `kind`, resumen, importancia y ocurrencias. Los
episodios repetidos (mismo kind+resumen) se fusionan incrementando
`occurrences` — la mascota recuerda "choqué contra el muro (×3)", no tres
entradas.

## Hipótesis
Creencias no confirmadas con confianza, evidencia positiva/negativa y estado
(`pending | confirmed | discarded`). La confianza usa suavizado de Laplace:
`(pos+1)/(pos+neg+2)` — ni la primera evidencia da certeza, ni un fallo la
destruye.

Aquí entra **lo que enseña el cuidador**: una lección se destila a un enunciado
autónomo (`distill.knowledge`) y se guarda como hipótesis, nunca como hecho —
el cuidador puede equivocarse, y la mascota la confirma o la descarta con su
propia experiencia. Si la enseñanza contradice lo observado, se anota igual pero
sin sumarle evidencia a favor. Las hipótesis vigentes viajan a los prompts de
diálogo y al contexto de diseño de habilidades: si no pudiera nombrar lo que le
enseñaron, para el cuidador sería indistinguible de no haberlo aprendido. Ver
ADR 0016.

## Semántica
Conocimiento consolidado ("consumir alimento recupera energía", "la rama no
puede dañar el muro"). Los hechos contradichos repetidamente quedan
invalidados.

## Consolidación (`consolidate(tick)`)
- Hipótesis con confianza ≥0.8 y ≥2 evidencias ⇒ hecho semántico.
- Hipótesis con confianza ≤0.2 y ≥2 contraevidencias ⇒ descartada.
- Episodios viejos (>2000 ticks) y poco importantes (<0.3) ⇒ archivo.
- Informa hechos invalidados y episodios fusionados.

## Recuperación (`retrieve(query, limit)`)
Coincidencia de términos con límite estricto: nunca se cargan todos los
recuerdos en un contexto. (Cuando llegue el modelo real, esto alimenta el
prompt con un presupuesto fijo.)

## Separación de registros
Los eventos técnicos (`agent.events`, eventos del mundo) son telemetría de
depuración; la memoria narrativa de la mascota es este almacén. No se mezclan:
la UI puede mostrar ambos, pero la mascota "recuerda" solo su memoria.
