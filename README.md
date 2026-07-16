# Ánima

Mascota virtual autónoma que vive en un mundo 2D simulado. Comienza con
capacidades mínimas y aprende mediante experimentación: cuando sus habilidades
no alcanzan, crea nuevas, las prueba automáticamente en mundos aislados, y solo
las incorpora a su biblioteca si superan las pruebas.

> Nombre provisional. Los identificadores técnicos no dependen de la marca.

## Estado actual

**Hito 1 completado**: la historia completa de aprendizaje funciona headless,
sin navegador, sin claves de IA y con una prueba automatizada de extremo a
extremo. La interfaz web (Fase 6) es el siguiente paso.

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
pnpm demo          # ejecuta el hito 1 en la terminal (semilla 5 por defecto)
pnpm demo 42       # otra semilla (cambia posiciones de herramientas)
pnpm test          # suite completa (80 pruebas)
pnpm typecheck
pnpm lint
```

No se necesita ninguna clave de API: todo corre con `MockModelProvider`,
un proveedor determinista que simula un generador imperfecto.

## Estructura

```
apps/
  demo/               CLI del hito 1 (la app web llega en Fase 6)
packages/
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
