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

**El Hito 0 está a mitad de camino y su criterio de corte se pasó.** Todavía no
hay motor, y a propósito: lo que hay es lo que se puede medir sin él.

| | |
|---|---|
| [Inventario de ADRs](docs/inventario-adrs.md) | **86 de 86 triados** · 55 portar, 18 revisar, 10 obsoleto, 3 revertido |
| [Escalera de capacidades](docs/escalera-capacidades.md) | 20 capacidades, 28 borradores contra la API |
| [Huecos medidos](docs/huecos-medidos.md) | 3 pases: 112 → 71 → **64** errores · 5 → 6 → **10** expresables |
| [Decisiones](docs/decisions/) | 4 ADRs propios (II-0001 a II-0004) |
| [Hito 0 · banco de latencia](docs/hito-0-banco-de-latencia.md) | typecheck en frío **240 ms** contra un corte de 3000 ✔ |

Lo que falta del Hito 0, y necesita código que no existe: el costo del
transformer de combustible, el arranque de página con el toolchain adentro del
navegador, y el barrido térmico de diez sustancias.

Después de eso, el Hito 1: `@anima/physics`.

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
