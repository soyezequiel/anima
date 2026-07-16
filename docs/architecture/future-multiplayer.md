# Multijugador futuro (interfaces previstas, no implementado)

## Qué habrá

Mascotas en mapas compartidos: hablar, intercambiar objetos, enseñarse
habilidades, construir, cooperar, competir, confianza/desconfianza, cultura.

## Decisiones de diseño ya tomadas que lo habilitan

- **Intenciones, no mutaciones**: el agente ya emite `ActionIntent` y el mundo
  decide (`stepWorld`). En multijugador, el servidor autoritativo ejecuta el
  mismo `sim-core` headless; los clientes envían intenciones. Autoridad del
  servidor sobre posiciones, inventarios, daño, recursos, intercambios,
  física y eventos compartidos.
- **Paso fijo determinista + snapshots**: permite reconciliación y replays.
- **Skills como artefactos versionados**: `SkillDefinition` es un dato
  serializable con contrato y pruebas. Transferir una skill = enviar el
  artefacto; la receptora la **re-evalúa en sus propios mundos aislados**
  antes de promoverla (su fuerza/herramientas pueden diferir).
- **Eventos estructurados**: la sincronización parcial de eventos ya tiene el
  formato correcto.

## Qué falta decidir (cuando toque)

Protocolo de transporte, particionado de mapas, percepción entre mascotas
(el `buildPerception` actual ya filtra por rango), permisos de enseñanza y
economía de intercambios.
