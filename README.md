# Ánima

Mascota virtual autónoma que vive en un mundo 2D simulado. Comienza con
capacidades mínimas y aprende mediante experimentación: cuando sus habilidades
no alcanzan, crea nuevas, las prueba automáticamente en mundos aislados, y solo
las incorpora a su biblioteca si superan las pruebas.

> Nombre provisional. Los identificadores técnicos no dependen de la marca.

## Estado actual

**Fases 0–9 completadas**: la historia completa de aprendizaje funciona
headless (hito 1) y en el navegador (React + Phaser, chat, panel de
habilidades, experimentos, modo desarrollador, E2E con Playwright). La sesión
se autoguarda y sobrevive recargas; al morir, la mascota deja un informe de
legado y su sucesora hereda el conocimiento como testimonio verificable.
Con identidad Nostr (BAL desde el launcher o extensión NIP-07) el progreso se
sincroniza con el backend (`apps/api`, Fastify + SQLite): la clave privada
nunca sale del firmante y el servidor solo acepta desafíos firmados. El modo
invitado local sigue completo y sin cuentas.

Como mente real (opcional), el usuario puede conectar su **cuenta de Codex
(ChatGPT)** desde la propia interfaz («🧠 Conectar Codex»): la API local
orquesta el CLI de Codex (`codex login` / `codex exec` en sandbox de solo
lectura) y las credenciales nunca tocan Ánima. Verificado de punta a punta
con una cuenta real: el modelo propuso una habilidad, el evaluador rechazó
sus versiones débiles con regresiones, y su versión corregida fue promovida
y reutilizada sin nuevas consultas. Sin Codex, el mock determinista sigue
siendo la base: cero claves, cero costos.

```
energía baja -> hipótesis -> objetivo -> intento directo -> fallo ->
prohibición de repetir -> contrato de habilidad -> candidata v1 -> pruebas
automáticas -> v1 rechazada (queda como regresión) -> candidata v2 ->
v2 promovida a estable -> ejecución en el mundo real -> alimento alcanzado ->
energía recuperada -> conocimiento consolidado y explicable
```

## Requisitos

- Node.js >= 22
- pnpm >= 10
- CLI de Codex reciente en el `PATH` (solo para usar la cuenta de Codex)

## Inicio rápido

```bash
pnpm install
pnpm dev           # interfaz web en http://localhost:5173
pnpm demo          # el hito 1 en la terminal (semilla 5 por defecto)
pnpm demo 42       # otra semilla (cambia posiciones de herramientas)
pnpm test          # suite unitaria y de integración (125 pruebas actualmente)
pnpm test:e2e      # historia completa vía UI con Playwright (requiere
                   #   `pnpm exec playwright install chromium` una vez)
pnpm typecheck
pnpm lint
```

Parámetros útiles de la web: `?seed=42&speed=8` (semilla y velocidad),
`&autostart=0` (arranca en pausa), `&fresh=1` (ignora el guardado).

Para sincronizar con el backend: `pnpm --filter @anima/api start` (puerto
8787; el dev server de Vite proxya `/api`) y conecta tu identidad Nostr con
el botón «⚡ Conectar Nostr» (extensión NIP-07) o abriendo el juego desde el
launcher (BAL). Sin backend ni identidad, todo funciona en modo invitado.

No se necesita ninguna clave de API. Por defecto todo corre con
`MockModelProvider`, un proveedor determinista que simula un generador
imperfecto. La cuenta de Codex es opcional y el proyecto continúa funcionando
si el CLI no está instalado o la sesión deja de estar disponible.

## Probar la aplicación

### Modo local

```bash
pnpm install
pnpm dev
```

Abre <http://localhost:5173>. Este modo no necesita backend, cuenta ni clave:
el progreso se guarda en `localStorage` y la mascota usa el proveedor simulado.

### Backend, Nostr y sincronización

Con un solo comando (web + API en paralelo):

```bash
pnpm dev:full
```

O en dos terminales:

```bash
pnpm --filter @anima/api start
pnpm dev
```

Abre la web y pulsa «⚡ Conectar Nostr». La extensión NIP-07 firma un desafío
de un solo uso y el progreso pasa a sincronizarse con el backend. También se
admite BAL cuando la aplicación se abre desde un launcher compatible.

### Cuenta de Codex como proveedor de IA

1. Instala una versión reciente del CLI con
   `npm install --global @openai/codex` y comprueba que `codex --version`
   funciona desde la terminal.
2. Inicia la API y la web con los dos comandos anteriores.
3. Pulsa «🧠 Conectar Codex» en la interfaz.
4. Completa la autorización de ChatGPT en la pestaña que se abre.
5. Comprueba que el indicador cambia de «🤖 simulado» a «🧠 codex».

También puedes comprobar la sesión activa con `codex login status`. El botón
de la interfaz inicia el mismo flujo web de `codex login`.

La API solo orquesta `codex login` y ejecuciones efímeras de `codex exec` en
un directorio temporal con sandbox de solo lectura. Las credenciales siguen
gestionadas por el CLI en el equipo del usuario y no se guardan en Ánima. Para
volver al proveedor determinista, pulsa «usar simulado»; «Desconectar Codex»
(en ⚙ ajustes) cierra además la sesión de Codex en el servidor.

La cuenta de Codex es **por identidad**: si iniciaste sesión con tu identidad
Nostr, tu autorización de Codex queda en un `CODEX_HOME` propio
(`data/codex/<pubkey>`), de modo que cada usuario conecta su propia cuenta.
Sin identidad (modo invitado) se usa la sesión clásica de `~/.codex` de la
máquina. Solo puede haber una autorización de Codex en curso a la vez (el
callback local usa un puerto fijo); si otra cuenta está autorizando, vuelve a
intentarlo en unos segundos.

Variables opcionales del backend: `ANIMA_CODEX_MODEL` fija el modelo,
`ANIMA_CODEX_EFFORT` cambia el esfuerzo de razonamiento (por defecto, `low`)
y `ANIMA_CODEX_DIR` mueve la raíz de los `CODEX_HOME` por usuario (por
defecto, `data/codex`).

### Verificación automatizada

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm exec playwright install chromium  # solo la primera vez
pnpm test:e2e
```

Playwright levanta automáticamente la web y una API con base de datos en
memoria. Los E2E del proveedor Codex prueban el contrato usando un puente
controlado; no consumen la cuenta real del usuario.

## Estructura

```
apps/
  web/                interfaz (Vite + React + Phaser + Playwright E2E)
  api/                backend (Fastify + SQLite, identidad Nostr por desafío firmado)
  demo/               CLI del hito 1 y herramienta de diagnóstico
packages/
  persistence/        guardado local, informes de legado, sucesión y linaje
  shared/             utilidades: RNG con semilla, hashing estable, eventos
  sim-core/           motor headless determinista (entidades, sistemas, snapshots)
  skill-runtime/      DSL declarativa de habilidades + intérprete con límites
  skill-evaluator/    evaluación aislada, métricas, regresiones, promoción
  memory/             memoria de trabajo/episódica/semántica/hipótesis
  model-providers/    interfaz neutral (Mock, Scripted, Codex y fallback vacío)
  agent-core/         percepción, objetivos, progreso, ciclo de creación de skills
  test-scenarios/     mundos reproducibles para pruebas y evaluación
docs/
  product/            visión y alcance del MVP
  architecture/       arquitectura por subsistema
  decisions/          registros de decisiones (ADRs)
```

## Principios que no se rompen

1. **El mundo decide qué es posible**: la IA elige acciones; las consecuencias
   las determina el motor determinista.
2. **La mascota no modifica el núcleo**: la automodificación ocurre solo vía
   habilidades validadas y versionadas en una DSL cerrada.
3. **Las habilidades son verificables**: contrato, criterios, pruebas
   reproducibles, historial de versiones y regresiones.
4. **La IA no corre en cada frame**: solo en momentos cognitivos (señal nueva,
   creación de habilidad, reflexión, conversación).
5. **Funciona sin API real**: proveedores intercambiables; el mock es
   completamente determinista.
6. **El ciclo de habilidades está cerrado**: el generador propone, el evaluador
   independiente decide.

Ver [docs/architecture/overview.md](docs/architecture/overview.md) para el
detalle y [docs/decisions/](docs/decisions/) para las decisiones registradas.
