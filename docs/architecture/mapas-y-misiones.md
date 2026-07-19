# Mapas y misiones — pruebas de aceptación jugables

Tres mapas que existen para **romper** a Ánima por lugares distintos. Un mapa no
es contenido: es un caso de prueba que se juega, y un mapa que no se supera es
información, no un fracaso. Ver [ADR 0080](../decisions/0080-los-mapas-son-pruebas-de-aceptacion.md).

## Cómo se corren

```bash
pnpm mission vado                 # con el modelo real (Codex)
pnpm mission vado --mock          # sin IA: prueba el andamiaje, no la mente
pnpm mission brote --ticks 400 --hint "14:probá con algo que la contenga"
```

En el navegador: `?map=vado` (`vado`, `brote`, `vigia`). El planteo entra por el
chat y el panel de misión muestra cada condición con **su cuenta**, no una
etiqueta: `0/1 entidades nacida en la partida, colocada en el río`.

Cada corrida escribe un JSONL en `apps/missions/traces/` con qué vio, qué le
preguntó al modelo, qué contestó palabra por palabra, qué intención mandó al
mundo, qué validó el mundo con qué motivo, qué cambió y por qué el juez dio o no
por cumplido cada objetivo.

## Los tres mapas

| # | Mapa | Qué pone a prueba | Estado |
|---|---|---|---|
| 1 | **El vado** — un río de borde a borde, la comida del otro lado | Inventar una receta, crear un tipo que no existía, dotarlo de las propiedades que su función exige, colocarlo en una celda concreta y aprovechar el cambio | **Superado** sin ayuda |
| 2 | **El brote sediento** — el agua en una punta, un brote seco en la otra | Encadenar receta + dos interacciones inventadas + orden + transporte | 5/7 con una pista del cuidador |
| 3 | **La vigía** — una criatura aterida tras un farallón, material lejos | Explorar, fabricar, levantar una obra en una zona, inventar una habilidad, tratar con otra entidad | Bloqueado en la traducción del encargo |

## Cómo se verifica (y por qué no se puede hacer trampa)

El juez (`MissionTracker`) mira el `WorldState` y el registro de hechos del
motor. **Ningún objetivo mira `agent.spoke`**: si Ánima dijera «ya crucé»
estando de este lado, el renglón seguiría sin tildar.

El vocabulario habla de propiedades, zonas, caminos y hechos — nunca de la
solución:

- `path-open` usa `canStandAt`, **la misma función que aplica el motor al
  mover**. No pregunta por el objeto que abrió el paso: pregunta si el mundo
  cambió de forma. Cualquier mecanismo cuenta.
- `createdDuringRun` / `crafted` / `placed` / `kindIsNew` distinguen **lo hecho
  de lo encontrado**. Los tipos que ya existían —incluidos los que las recetas
  sembradas saben producir— no acreditan invención.
- «Algo que ya estaba terminó siendo algo que no existía» es la forma de exigir
  una **transformación** sin nombrarla: romper la entidad la hace desaparecer,
  no cambiar de tipo.
- `sequence` referencia objetivos por id y compara el tick en que cada uno se
  cumplió por primera vez: el orden causal se lee, no se declara.

Las regresiones del propio juez viven en `packages/missions/tests/`, e incluyen
el caso «lo que Ánima diga no mueve la aguja».

## Lo que estos mapas encontraron

Seis defectos generales, todos en el sistema y ninguno en los mapas:

1. **El terreno era inmutable.** Nada que Ánima inventara podía cambiar por
   dónde se camina, y `place` ni siquiera dejaba apoyar algo sobre el agua.
   → [ADR 0077](../decisions/0077-lo-que-construye-cambia-por-donde-se-camina.md): `footing`.
2. **Un encargo de varias partes perdía todas menos la primera** — y se daba por
   cumplido al terminarla. → [ADR 0078](../decisions/0078-el-encargo-se-dice-como-se-habla.md): `sequence` + `afterGoalId`.
3. **`place` era una primitiva sin puerta**: pedir «ponelo ahí» se desviaba a
   inventar una interacción para un verbo que el mundo ya sabía hacer.
   → misma ADR: `place-item` + la operación `markTarget` de la DSL.
4. **Un veto no sabía de qué forma hablaba**: el juez rechazó «puente como cosa»
   pidiendo que se propusiera como obra, y el veto guardado tumbó la obra.
   → [ADR 0079](../decisions/0079-un-veto-sabe-de-que-forma-hablaba.md).
5. **La regla de "qué se puede pisar" estaba escrita dos veces.** Ánima abrió el
   paso de verdad y se quedó del otro lado muriéndose de hambre, porque su
   propio mapa mental seguía diciendo «eso es agua».
   → `packages/skill-runtime/tests/pisar-lo-puesto.test.ts`.
6. **El juez de interacciones confundía la regla con el intento**: rechazó «con
   un balde se junta agua» porque en ese instante no tenía el balde — que era
   exactamente lo que la regla servía para poder usar.

Y una mejora que no vino de un mapa sino de mirar una corrida: un «no» del mundo
que es una **propiedad estable** (`not-portable`) ahora se vuelve un hecho
aprendido y una pregunta concreta, en vez de un «no pude» y 340 ticks de
silencio.

## Limitaciones que quedan

- ~~**Una obra no se planta sobre el agua.**~~ **Resuelto.** El veto no estaba
  en el motor: `resolvePlace` nunca contó el agua como ocupante y `impedimentAt`
  siempre dejó pisar lo que trae `footing`. Estaba en `siteFits`, la tercera
  copia de la regla «qué se puede pisar», que daba toda celda mojada por
  intransitable sin mirar la pieza que iba encima. Ahora el agua veta a la
  pieza que no ofrece piso y deja pasar a la que sí — y su espejo, `clearWalkTo`,
  dejó de creer que se cruza un río a nado. Regresión en
  `packages/agent-core/tests/obra-sobre-el-agua.test.ts`.
- **«Regar» no existe en este mundo.** Las interacciones no pueden dar comida ni
  calor (ADR 0018), así que ningún objetivo puede exigir que un brote quede
  *regado*: solo que cambie de estado. En una corrida Ánima resolvió el cambio
  **volcando** el brote en vez de regarlo, y el juez de coherencia lo aprobó con
  razón. La misión no pasó igual, pero por la cuenta de interacciones, no porque
  alguien detectara la sustitución.
- **Un sustantivo genérico se busca para siempre.** El Mapa 3 se traba porque la
  traducción produjo `fetch-item: "material"`, que no es un tipo de nada, y nadie
  la frena: se sale a recorrer el mapa buscando un objeto que no existe. Es el
  defecto que hay que atacar para desbloquearlo.
- **Los pasos de un encargo que no son órdenes** (una enseñanza, una charla) se
  caen de la fila, así que «te explico X y después hacé Y» dicho de un tirón
  pierde la mitad.
- **Alta varianza entre corridas.** El mismo mapa con la misma semilla se
  resuelve distinto según cómo bautice el modelo lo que va a construir: «balsa»
  (una cosa) llega al final; «puente» (una obra) toma un camino más caro. La
  semilla fija el mundo, no la mente.
