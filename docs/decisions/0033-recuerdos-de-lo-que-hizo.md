# ADR 0033 — Recuerdos de lo que hizo: nacen del mundo y se cuentan solos

Fecha: 2026-07-17 · Estado: aceptada · Se apoya en los ADR 0009 y 0025

## Contexto

En una corrida real, Ánima rompió tres tramos de una pared con un martillo. El
cuidador le preguntó «¿por qué rompiste toda la pared?» y ella respondió:
«solo sé que el martillo puede dañar una pared; no puedo confirmar haber roto
toda la pared». No mentía — y ese es exactamente el problema.

Al golpear, `observe()` guardaba un hecho genérico («la herramienta hammer
puede dañar un wall») y olvidaba el lugar de lo destruido. Nada más. El mundo
registró los tres `entity.destroyed` con su autoría, pero ese saber nunca
cruzaba a la memoria del agente: aprendía la **regla**, no el **recuerdo**.
Como el contexto del diálogo (`dialogueFacts`) solo lleva hechos, hipótesis y
recuerdos del vínculo, el modelo respondía con lo único que tenía — la regla.

Era la misma asimetría en cuatro frentes: no podía contarlo (diálogo), no podía
contarlo con números («¿cuántas?»), no podía usarlo para decidir (el juicio de
destrucción ignoraba lo ya destruido), y su memoria episódica crecía sin techo
en una vida larga porque solo se consolidaba en los éxitos de meta.

## Decisión

**Los recuerdos de acción propia nacen exclusivamente de SimEvents observados
en `observe()`. El modelo jamás escribe memoria.** Es el principio de siempre
(«el mundo decide qué es posible») aplicado al pasado: el mundo también decide
qué pasó.

### 1. El kind `deed` y sus verbos

`observe()` registra un episodio `kind: 'deed'` cuando la mascota:

- destruye algo (`entity.destroyed` con `byId` propio): «rompí un wall con
  hammer» — el verbo sale de `DEED_VERBS` («talé» para árboles). Como
  `entity.destroyed` no trae la herramienta, se reconstruye del
  `entity.damaged` del mismo lote (el golpe fatal viaja justo antes).
- construye (`item.crafted`): «construí un torch».
- coloca (`item.placed`): «coloqué un wall».
- come (`item.consumed`): «comí un food».

Moverse, recoger y soltar NO dejan recuerdo: moverse no es una biografía.

### 2. El conteo es el dedupe: elegir el summary ES elegir la granularidad

No hay contador nuevo. `recordEpisode` ya fusiona por (kind, summary) exactos
incrementando `occurrences`, así que un summary **estable** —sin ids, sin
ticks, sin cantidades en el texto— hace que romper tres tramos produzca UN
recuerdo con `occurrences: 3`. Si alguna vez un summary incluye algo variable,
el conteo se rompe; los tests lo fijan.

### 3. Presupuesto propio en el diálogo

`deedMemories(4)` formatea los deeds más recientes como «hice: rompí un wall
con hammer (×3)» y entra en `dialogueFacts` con presupuesto propio: no compite
con el vínculo (`caretakerMemories`) ni con los hechos del mundo. Como
`dialogueFacts` alimenta también `interpret.command`, la pregunta se interpreta
ya con el recuerdo a la vista. El mock gana una rama determinista («¿qué
hiciste?» → repite el fact `hice: ...`): el mock no inventa memoria, repite la
que viaja en los hechos.

### 4. Los recuerdos pesan en las decisiones

- **Corto plazo**: `destructionFacts` suma «ya rompí N wall antes» al contexto
  de `judge.destruction`. Destruir «otro más» no es destruir el primero.
- **Largo plazo**: `retrieve()` (que existía sin callers) gana dos de
  producción — `recipe.propose` viaja con `priorExperience` (deeds y fracasos
  afines al problema) y el contexto de `skill.propose` anexa «experiencia
  previa: ...». La idea nueva no ignora la historia.

### 5. Compactación determinista, nada se borra

Cuando los episodios activos superan `COMPACT_MAX_ACTIVE` (60),
`MemoryStore.compact()` fusiona los viejos (edad > 500 ticks) y poco
importantes (< 0.7) en un episodio-resumen por kind («resumen de deed: 12
recuerdos distintos») cuyo `occurrences` es la suma agregada: el conteo degrada
con gracia a totales. Los originales quedan `archived`, auditables en el save.
Los kinds del vínculo (`caretaker`, `teaching`, `promise-kept`,
`caretaker-help`, `legacy-traits`, `skill-learned`) no se fusionan jamás.

Sin modelo en el camino de la memoria, a propósito: una capa de prosa con IA
podría sumarse después sin cambiar un solo conteo. Y `think()` consolida cada
100 ticks — antes solo se consolidaba al completar metas, y una vida sin
éxitos nunca limpiaba.

## Lo que NO cambia

- **El legado sigue siendo testimonio, no memoria (ADR 0009)**: los deeds no
  cruzan generaciones. La sucesora hereda saberes rebajados a hipótesis, no la
  biografía de su antecesora.
- **Cero cambios de esquema**: `deed` es solo un valor nuevo de `kind`;
  `MemoryData` y los saves `version: 1` cargan sin migración.
- **El determinismo del mock**: todo funciona sin IA real.

## Futuro explícito (fuera de este ADR)

Disparadores de invención por fracasos repetidos: un episodio `failure` con
`occurrences` alto es la señal natural de que lo que falta es un objeto que
todavía no existe (la brecha §1 del reporte). Merece su propia decisión.

## Consecuencias

- «¿Por qué rompiste toda la pared?» ahora tiene una respuesta con memoria:
  «rompí un wall con hammer (×3)» — que además revela que no fue *toda* la
  pared (7 tramos), sino un pasaje.
- El reporte para Claude muestra la sección «Episodios (lo que hizo y le
  pasó)» y expone `episodes` en el JSON crudo.
- La memoria episódica de una vida larga queda acotada sin perder totales.
