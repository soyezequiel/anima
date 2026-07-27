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

Esqueleto. No hay nada construido todavía.

El orden es: **inventario de ADRs** (que no está terminado: 27 de 86 filas
triadas) → **Hito 0**, el banco de latencia, que existe para no construir sobre
fe. Recién después empieza el Hito 1.

## Comandos

```bash
pnpm ii:typecheck
```

```bash
pnpm ii:test
```

El Ánima I sigue funcionando igual que siempre: `pnpm dev`, `pnpm test`,
`pnpm demo`. Los dos árboles conviven hasta el Hito 5.
