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

Los recuerdos de acción propia (`kind: 'deed'`, ADR 0033) nacen solo de
SimEvents observados en `observe()`: romper, talar, construir, colocar y comer
dejan recuerdo ("rompí un wall con hammer"); moverse no. El summary estable
hace que el dedupe cuente: tres paredes rotas son un recuerdo con
`occurrences: 3`. Estos recuerdos viajan al diálogo (`deedMemories`), al juicio
de destrucción y —vía `retrieve`— a las propuestas de recetas y habilidades.

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
- Se ejecuta al completar metas y, desde el ADR 0033, cada 100 ticks.

## Compactación (`compact(tick)`, ADR 0033)
Cuando los episodios activos superan 60, los viejos (>500 ticks) y poco
importantes (<0.7) se fusionan en un episodio-resumen por kind cuyo
`occurrences` es la suma agregada: el conteo degrada con gracia a totales.
Nada se borra — los originales quedan archivados y auditables. Los recuerdos
del vínculo (`caretaker`, `teaching`, `promise-kept`, `caretaker-help`,
`legacy-traits`, `skill-learned`) no se fusionan jamás. Determinista a
propósito: el modelo nunca escribe memoria.

## Recuperación (`retrieve(query, limit)`)
Coincidencia de términos con límite estricto: nunca se cargan todos los
recuerdos en un contexto. Desde el ADR 0033 alimenta las propuestas: los deeds
y fracasos afines al problema viajan como `priorExperience` en `recipe.propose`
y como «experiencia previa» en el contexto de `skill.propose`.

## Separación de registros
Los eventos técnicos (`agent.events`, eventos del mundo) son telemetría de
depuración; la memoria narrativa de la mascota es este almacén. No se mezclan:
la UI puede mostrar ambos, pero la mascota "recuerda" solo su memoria.
