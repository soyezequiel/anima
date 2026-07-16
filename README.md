# Ánima

Mascota virtual autónoma que vive en un mundo 2D simulado. Comienza con
capacidades mínimas y aprende mediante experimentación: cuando sus habilidades
no alcanzan, crea nuevas, las prueba automáticamente en mundos aislados, y solo
las incorpora a su biblioteca si superan las pruebas.

> Nombre provisional. Los identificadores técnicos no dependen de la marca.

## Estado actual

**Fases 0–8 completadas**: la historia completa de aprendizaje funciona
headless (hito 1) y en el navegador (React + Phaser, chat, panel de
habilidades, experimentos, modo desarrollador, E2E con Playwright). La sesión
se autoguarda y sobrevive recargas; al morir, la mascota deja un informe de
legado y su sucesora hereda el conocimiento como testimonio verificable.
Con identidad Nostr (BAL desde el launcher o extensión NIP-07) el progreso se
sincroniza con el backend (`apps/api`, Fastify + SQLite): la clave privada
nunca sale del firmante y el servidor solo acepta desafíos firmados. El modo
invitado local sigue completo y sin cuentas. Todo sin claves de IA.
El siguiente paso es la Fase 9 (proveedor real de IA, opcional y reemplazable).

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

## Inicio rápido

```bash
pnpm install
pnpm dev           # interfaz web en http://localhost:5173
pnpm demo          # el hito 1 en la terminal (semilla 5 por defecto)
pnpm demo 42       # otra semilla (cambia posiciones de herramientas)
pnpm test          # suite completa (87 pruebas)
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

No se necesita ninguna clave de API: todo corre con `MockModelProvider`,
un proveedor determinista que simula un generador imperfecto.

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
  model-providers/    interfaz neutral de modelos (Mock, Scripted, adaptador vacío)
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
