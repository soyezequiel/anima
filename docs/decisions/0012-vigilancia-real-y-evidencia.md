# ADR 0012 — Vigilancia en uso real, evidencia semántica y muerte por heridas

Fecha: 2026-07-16 · Estado: aceptada

Cierra la deuda inmediata detectada al terminar las 9 fases.

## Atribución semántica de evidencia (cierra la limitación del ADR 0011)

La evidencia de comer solo puede respaldar una hipótesis cuyo enunciado hable
de comer (`consum|comer|comida|aliment` + `energ`). Si la interpretación de la
señal fue otra cosa ("dormir recupera energía"), esa hipótesis conserva solo
su evidencia inicial y queda pendiente; la mascota crea su propia hipótesis
canónica **por observación directa** al comer y ver subir su energía, y esa es
la que se confirma con las comidas. Consecuencia epistemológica deliberada:
una interpretación equivocada ya no puede "confirmarse" con evidencia ajena,
y la mascota necesita dos comidas para convencerse por sí sola (frente a una
cuando alguien se lo explicó — la explicación cuenta como evidencia).

Es un emparejamiento léxico, no comprensión semántica real: suficiente
mientras las hipótesis son enunciados de una frase. Si el catálogo de
hipótesis crece, el siguiente paso son hipótesis estructuradas
(acción → efecto) en lugar de texto libre.

## Fallos en uso real → regresiones con snapshot

`RegressionCase` admite ahora un origen "mundo-real": el snapshot embebido del
mundo tal como estaba justo antes de que la skill estable empezara a
ejecutarse. La sesión (driver del mundo real) guarda ese snapshot al ver
`strategy.selected` de una skill estable y, si llega `strategy.failed`, lo
registra vía `addRealWorldCase` — **salvo** cuando la razón contiene
`no-candidates`: la falta de recursos no es un defecto de la habilidad
(doctrina recurso-vs-capacidad del ADR 0008). Tope de 3 casos por habilidad,
descartando los más antiguos.

El evaluador reproduce esos snapshots con `restoreSnapshot` junto a los
escenarios de laboratorio: la promoción exige superar también lo que la
realidad ya demostró que falla. Los casos viajan en el guardado (incluida la
nube) porque `RegressionData` ya se serializa completa.

## Muerte por heridas

Componente `hazard { damagePerTick }` + sistema que daña a los agentes
adyacentes. La salud puede agotarse sin pasar por el hambre: la causa de
muerte es `injuries`, con sus propias recomendaciones en el informe de legado
("aléjate primero y entiende después"). El escenario canónico del MVP no
incluye peligros para no alterar la historia base; quedan disponibles para
los mundos que vengan.

## Ergonomía

`pnpm dev:full` levanta web + API en paralelo (la causa nº 1 de "no se pudo
conectar Codex" era la API apagada); la AiBar ahora dice exactamente qué
falló (API apagada, CLI ausente, login sin URL, autorización expirada); y CI
en GitHub Actions corre lint + typecheck + suite completa + E2E (los E2E de
Codex usan intercepción: jamás tocan una cuenta real).
