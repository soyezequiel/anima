# El loop del agente

## Contrato

```ts
agent.think(perception): Promise<ActionIntent | null>  // una intención por tick
agent.observe(events)                                   // retroalimentación del mundo
```

El agente **nunca** recibe el `WorldState`. El driver (`runAgentInWorld`)
percibe, pregunta, aplica al mundo y devuelve los eventos.

## Un paso de decisión

1. Procesar mensajes del usuario pendientes (peticiones → aceptar/negar;
   explicaciones → interpretación de señales; reactivación de objetivos
   suspendidos).
2. Procesar señales internas (energía baja ⇒ hipótesis + objetivo, con
   explicación del usuario o experiencia guiada).
3. Si hay habla pendiente, hablar (la conversación se intercala con la acción
   sin abandonar el objetivo).
4. Si hay una actividad en curso (ejecución de un programa de la DSL),
   continuarla localmente — sin consultar ningún modelo.
5. Si no, seleccionar objetivo (mayor prioridad+urgencia) y elegir estrategia.

## Jerarquía de estrategias (cuándo crear una skill)

1. Habilidad **estable** aplicable de la biblioteca.
2. Aproximación primitiva (composición inline de primitivas).
3. Solo cuando todas las estrategias conocidas están **prohibidas** por el
   controlador de progreso: crear una habilidad (ciclo cerrado).
4. Si el desarrollo fracasa: pedir ayuda al usuario.
5. Después: suspender el objetivo, con condición de reactivación registrada
   (nueva información del usuario o cambio del entorno).

Excepción registrada (ADR 0008): si todos los fallos fueron por
`no-candidates` —falta el **recurso**, no la **capacidad**— el agente salta
el paso 3 y va directo a pedir ayuda: fabricar una skill no crea comida.
Un objetivo suspendido se reactiva (con estrategias re-habilitadas) cuando el
recurso vuelve a estar visible o el usuario aporta información.

## Controlador externo de progreso

No depende de que el modelo "se dé cuenta". Por objetivo y estrategia registra
intentos, fallos y resultado; tras 2 fallos la estrategia queda **prohibida sin
modificaciones** (`strategy.forbidden`). La escalada
crear-skill → pedir-ayuda → suspender es determinista y con límites
(`maxSkillDevAttempts`, `maxVersionsPerDev`).

## Cuándo consulta al modelo (y cuándo no)

| Momento | Petición |
|---|---|
| Señal nueva sin interpretación | `interpret.signal` |
| Necesita una habilidad | `skill.propose` |
| Informe de fallos de una versión | `skill.revise` |
| Conversación significativa | `dialogue` |

La física, el movimiento, las colisiones y las habilidades conocidas corren
localmente. En la demo completa el "modelo" se consulta 3 veces en total; la
segunda vez que tiene hambre, **cero**.

## Quién interpreta el chat

Depende de si el proveedor entiende lenguaje (`ModelProvider.interpretsLanguage`):

- **Modelo real** (Codex): interpreta **todos** los mensajes con
  `interpret.command`, que los clasifica en el catálogo cerrado
  (órdenes ejecutables, `explanation`, `unsupported`, `not-command` → charla).
  El parser determinista queda como red de seguridad: si el modelo falla y el
  parser reconoce una orden clara, la mascota igual obedece y el evento
  `provider.error` lleva `recoveredWith: 'parser'`.
- **Proveedor determinista** (mock): manda el parser de regex; lo que no
  reconoce pasa igual por `interpret.command`/`dialogue` (el mock responde
  `not-command` y charla con reglas fijas). Sin claves, sin costos.

El modelo solo **traduce** texto a una intención estructurada: nunca decide si
obedecer. La clasificación y la respuesta siguen saliendo de
`evaluateUserRequest` (ver ADR 0013).

## Negativas

`evaluateUserRequest` clasifica cada petición en `accepted / cannot / will_not
/ not_now / needs_information`, con razón comprensible, coherencia con hechos
aprendidos y alternativa cuando existe.

Cuatro de las cinco son **hechos** y se deciden con código determinista. La
quinta, `will_not`, es un **juicio de valores** —"puedo, pero no quiero"— y con
un modelo real la repiensa ella con su situación concreta: cuántos árboles ve,
su energía, si hay comida a la vista. Con un solo árbol, talarlo es suicidio;
con tres, negarse es un capricho, y ninguna tabla distingue los dos casos.

El orden es **hechos → valores**: para cuando se consulta al modelo, el mundo
ya dijo que se puede, así que este camino no puede autorizar un imposible. Si
el juicio falla, la negativa determinista se mantiene. Ver ADR 0019.
