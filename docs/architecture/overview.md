# Arquitectura — visión general

## Diagrama de dependencias

```
                 ┌───────────┐
                 │  shared   │  RNG, hashing, Vec2, eventos estructurados
                 └─────▲─────┘
                       │
                 ┌─────┴─────┐
                 │ sim-core  │  motor headless determinista + percepción
                 └─────▲─────┘
          ┌────────────┼────────────────┐
   ┌──────┴──────┐ ┌───┴───────────┐ ┌──┴──────────────┐
   │skill-runtime│ │ test-scenarios│ │    (memory)     │
   └──────▲──────┘ └───────▲───────┘ └──────▲──────────┘
          │                │                │
   ┌──────┴─────────┐      │                │
   │ skill-evaluator│      │                │
   └──────▲─────────┘      │                │
          │        ┌───────┴───┐            │
          ├────────┤model-prov.│            │
          │        └───────▲───┘            │
   ┌──────┴────────────────┴────────────────┴──┐
   │                agent-core                 │
   └──────▲────────────────────────────────────┘
          │
   ┌─────────────────────────────────┐
   │ apps/demo · apps/web · apps/api │
   └─────────────────────────────────┘
```

Regla de oro: las dependencias apuntan siempre "hacia abajo". Nada en
`sim-core` conoce skills, agentes ni modelos. Nada en `skill-runtime` conoce
al agente. El agente nunca toca el `WorldState`: recibe `Perception` y
devuelve `ActionIntent`.

## sim-core (el mundo decide)

- Estado plano serializable (`WorldState`): entidades con componentes de datos
  (Position, Collider, Energy, Health, Strength, Hardness, Durability,
  Nutrition, Inventory, Tool, Edible, Portable, Agent, Dead).
- Paso fijo: `stepWorld(world, intents)` procesa intenciones ordenadas por id
  de actor y luego los sistemas (energía, muerte). Mismo estado + semilla +
  acciones ⇒ mismo resultado (probado con fast-check y hash FNV-1a estable).
- Regla explícita de herramientas:
  `effectivePower = strength + toolPower; damage = max(0, effectivePower - hardness)`.
  Las herramientas se desgastan al usarse aunque no causen daño.
- Snapshots: clon profundo serializable, restauración probada a mitad de corrida.
- Invariantes (`checkInvariants`): sin solapamiento de sólidos, posiciones en
  rango, inventarios consistentes, energía en rango. El evaluador las verifica
  en cada tick de los mundos de prueba.
- Percepción (`buildPerception`): la vista limitada que recibe el agente
  (rango sensorial, propiedades observables, items en mano). Distancia
  Manhattan (ver ADR 0005).

## skill-runtime (autommodificación acotada)

Ver [skills.md](skills.md). DSL declarativa cerrada validada con Zod;
intérprete incremental por ticks con límites duros (ops puras por tick y
totales, intents totales, profundidad de llamadas, repeticiones con límite
obligatorio). Sin JS arbitrario, sin acceso al motor/DOM/red.

## skill-evaluator (el juez independiente)

Ejecuta candidatas en mundos aislados construidos por fábricas de escenarios ×
semillas ± regresiones históricas. Mide (éxito, ticks, intents, energía, daño,
violaciones), deriva observaciones de fallo estructuradas
(`no-damage-dealt:branch->wall`), decide promoción (umbral, invariantes, no
empeorar el baseline, superar regresiones) y archiva las rechazadas.

## agent-core (la mente)

Ver [agent-loop.md](agent-loop.md). Percepción → señales → objetivos
estructurados → jerarquía de estrategias → controlador externo de progreso →
ciclo cerrado de desarrollo de skills → memoria y explicaciones. Consultas al
modelo solo en momentos cognitivos.

## model-providers (modelos intercambiables)

Interfaz neutral `ModelProvider.complete(ModelRequest): ModelResponse` con
peticiones tipadas (`skill.propose`, `skill.revise`, `interpret.signal`,
`dialogue`). Implementaciones: `MockModelProvider` (determinista, imperfecto
por diseño), `ScriptedModelProvider` (replay), `CodexModelProvider` (adaptador
web hacia el puente local de `apps/api`) y `UnconfiguredModelProvider`
(fallback explícito). El proveedor Codex usa la sesión del CLI del usuario;
el backend ejecuta `codex exec` de forma efímera, en sandbox de solo lectura,
y nunca lee ni persiste las credenciales. Cada identidad Nostr autenticada
tiene su propio `CODEX_HOME` (`data/codex/<pubkey>`), así que cada usuario
conecta su propia cuenta de Codex; el invitado usa el `~/.codex` de la
máquina. Los límites de uso de la cuenta (`GET /ai/limits`) se leen con el
protocolo JSON-RPC de `codex app-server` (`account/rateLimits/read`), sin
consumir cuota. Ver [ADR 0011](../decisions/0011-proveedor-codex.md).

## Observabilidad

Todo es evento estructurado (`{type, tick, data}`): eventos del mundo
(`action.resolved`, `entity.destroyed`, `pet.died`...) y del agente
(`goal.created`, `skill.test.failed`, `skill.promoted`,
`user.request.refused`...). La UI, la demo y las pruebas consumen los mismos
eventos.
