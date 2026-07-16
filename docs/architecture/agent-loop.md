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

## Negativas

`evaluateUserRequest` clasifica cada petición en `accepted / cannot / will_not
/ not_now / needs_information`, con razón comprensible, coherencia con hechos
aprendidos (no destruye lo que cree necesitar) y alternativa cuando existe.
