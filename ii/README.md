# Ánima II

El remake. Vive acá, al lado del Ánima que anda, hasta que se lo gane.

- Arquitectura: [`docs/architecture/remake-anima-ii.md`](../docs/architecture/remake-anima-ii.md)
- Inventario de ADRs: [`ii/docs/inventario-adrs.md`](docs/inventario-adrs.md)

## Las tres reglas de esta carpeta

**1. Nada de acá importa de `packages/` ni de `apps/`.** Ni un `import` a
`@anima/sim-core`, `@anima/agent-core`, `@anima/skill-runtime`. Portar es
**copiar y adaptar**, no depender. Si dejás la dependencia viva, en tres meses el
remake es un refactor con esteroides y volvés a tener un `agent.ts` de 7.679
líneas con otro nombre.

La excepción, y es una sola: **`apps/api` se conserva y se comparte**. El puente
a Codex con `CODEX_HOME` por pubkey y la identidad Nostr no se reescriben.

**2. Ningún paquete determinista toca el reloj ni el azar del sistema.**
`Math.random`, `Date`, `performance`, `Intl`, `localeCompare` y `Math` trascendente
(`exp`, `pow`, `log`, `**`) están prohibidos por lint en `@anima/physics`,
`@anima/process` y `@anima/world`. `Math.exp` y `Math.pow` **no tienen precisión
especificada en ECMAScript**: dos navegadores pueden devolver el último bit
distinto y el replay diverge en el tick 400. Se reemplazan por tablas y
polinomios propios en punto fijo.

**3. Ningún hito se da por cumplido sin su criterio verificable.** Están escritos
uno por uno en el plan de construcción del documento de arquitectura, y varios
son criterios de **corte**: el Hito 0 puede matar la decisión del sandbox, y el
Hito 5 puede parar el proyecto entero. Están para eso.

## Estado

**Hito 0 casi cerrado, Hito 1 construido, y el Hito 4 desbloqueado.**

| | |
|---|---|
| [Inventario de ADRs](docs/inventario-adrs.md) | **86 de 86 triados** · 55 portar, 18 revisar, 10 obsoleto, 3 revertido |
| [Escalera de capacidades](docs/escalera-capacidades.md) | 20 capacidades, 28 borradores contra la API |
| [Huecos medidos](docs/huecos-medidos.md) | 3 pases: 112 → 71 → **64** errores · 5 → 6 → **10** expresables |
| [Decisiones](docs/decisions/) | 5 ADRs propios (II-0001 a II-0005) |

### Hito 0 — el banco

| Pieza | Criterio | Medido | |
|---|---|---|---|
| [typecheck](docs/hito-0-banco-de-latencia.md) | < 3000 ms en frío | 240 ms | ✔ |
| [barrido térmico](docs/hito-0-barrido-termico.md) | ventana para 10 sustancias | 12/12 | ✔ |
| [combustible](docs/hito-0-combustible.md) | ≤ 2% del tick (ADR II-0005) | **0.39%** | ✔ margen 5.1× |
| arranque de página en el navegador | — | — | pendiente |

### Hito 1 — `@anima/physics`

Existe y está verde: **353 tests**, typecheck limpio. Punto fijo determinista,
29 cualidades más 4 de celda, 30 sustancias semilla, cuerpos compuestos, los
cuatro procesos aplicables, las doce leyes y `admit()`.

Los tres ejemplos del usuario pasan **sin que aparezcan las palabras «carbón»,
«asar» ni «pescar»**, y el test de emergencia no menciona ninguna sustancia
semilla por nombre.

**Y tiene 34 huecos abiertos en la puerta**, marcados como `it.fails()` en
`tests/ataque-*.test.ts`. No están disimulados: son el resultado de tres
adversarios que tiraron 62 procesos contra `admit()`. Se agrupan en seis causas,
y la más profunda es que la regla de conservación compara el **número** de una
cualidad y no el **producto por masa** — así que mover «9 de nutrición» de un
trocito de 0.1 a un tronco de 100 multiplica la comida por 57.

**Cerrar esos 34 es el próximo trabajo, y va antes del Hito 2.**

## Comandos

```bash
pnpm ii:typecheck
```

```bash
pnpm ii:test
```

```bash
pnpm ii:banco
```

`ii:test` corre el **arnés de compilación**: los 28 borradores contra
`skill-api.d.ts` en cada build, con trinquete. La línea base solo puede bajar
sola; para que suba hay que editar `tests/linea-base.json` a mano y decir por
qué. Sin eso, el número deriva en silencio — que es exactamente el bug de
`DSL_REFERENCE` en Ánima I, una referencia mantenida a mano que divergió del
código y nadie se enteró hasta que el modelo no pudo colocar un bloque.

El Ánima I sigue funcionando igual que siempre: `pnpm dev`, `pnpm test`,
`pnpm demo`. Los dos árboles conviven hasta el Hito 5.
