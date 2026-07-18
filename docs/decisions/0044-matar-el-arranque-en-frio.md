# ADR 0044 — Matar el arranque en frío: sesión persistente contra `codex app-server`

Fecha: 2026-07-18 · Estado: aceptada · Continúa la cadena de latencia de los ADR 0039/0040/0043

## Contexto

Cada consulta al modelo pagaba un arranque en frío completo: `codex exec`
spawnea un proceso nuevo, crea un directorio temporal, inicializa sesión y
recién entonces habla con el modelo. Medido con el mismo prompt trivial en la
misma máquina: **5353 ms por `codex exec` contra 3620 ms por un turno sobre un
proceso ya caliente** — ~1.7 s de peaje fijo en CADA pensamiento, antes de que
el modelo piense nada.

El backend ya hablaba el protocolo JSON-RPC de `codex app-server` (el mismo
que usa la extensión oficial) para leer los límites de uso; faltaba usarlo
para lo que más importa: las consultas.

## Decisión

**Una sesión `codex app-server` persistente por puente** (`CodexAppServer`,
`apps/api/src/codex-app-server.ts`): un solo proceso vivo por CODEX_HOME (por
identidad), al que cada consulta le pide

- `thread/start` efímero, en sandbox de solo lectura, sin persistencia de
  historial — una llamada local que no toca la red ni consume cuota. Un hilo
  NUEVO por consulta: los prompts de Ánima son autocontenidos y reusar un
  hilo acumularía contexto ajeno. Al terminar, `thread/delete`.
- `turn/start` con el prompt, el modelo, el nivel de razonamiento, el
  `outputSchema` (equivalente de `--output-schema`; los schemas de Ánima ya
  eran estrictos) y `summary: detailed` cuando hay pensamiento en vivo.
- La respuesta sale del item `agentMessage` y los titulares de razonamiento
  de los items `reasoning`, mapeados a los mismos `AiThoughtEvent` de
  siempre: el streaming SSE hacia el navegador no cambia.

**El app-server es un atajo, no la verdad.** Su protocolo es experimental
(verificado en vivo contra codex-cli 0.144.5), así que el puente degrada con
dos niveles:

- **Error de turno** (modelo no soportado, cuota, timeout del modelo): el
  proceso está sano. La consulta cae a `codex exec` — que ya sabe reintentar
  y recordar combinaciones no soportadas — y la próxima vuelve a intentar el
  atajo.
- **Error de transporte** (proceso muerto, handshake colgado, protocolo
  irreconocible): la sesión se descarta y el puente sigue con exec por el
  resto de su vida. Un reinicio de la API la reintenta.

Un logout descarta el proceso (las credenciales se cargan al arrancar); el
próximo uso lo respawnea con las nuevas.

## Consecuencias

- ~1.7 s menos por consulta en la medición de referencia — en cada
  interpretación de mensaje, cada versión del ciclo de habilidades, cada
  diálogo. El peaje fijo del datacenter local desaparece; queda solo el del
  modelo.
- Las pruebas hablan el protocolo contra un proceso fingido
  (`tests/codex-app-server.test.ts`); las pruebas de exec existentes no ven
  el atajo (inyectar `exec` lo desactiva salvo que la prueba traiga el suyo).
- Riesgo asumido: el protocolo puede cambiar de forma con futuras versiones
  del CLI. Por eso exec queda intacto como camino de verdad y la degradación
  es automática y silenciosa para la mascota (un `console.warn` en la API).
- El puente de Claude (`claude.ts`) no cambia: su CLI no ofrece un servidor
  persistente equivalente.
