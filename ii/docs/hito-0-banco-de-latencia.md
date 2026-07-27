# Hito 0 — Banco de latencia: el typecheck

El plan de construcción declara un criterio de corte **escrito de antemano**:

> si `ts.createProgram` en frío pasa de 3 s, el plan del sandbox cambia **acá** y
> no después de construirle encima.

Y el camino del mensaje presupuesta, para el caso frío del Hito 8:

| Etapa | p50 | p95 |
|---|---|---|
| 12 · typecheck incremental (`Program` tibio) | 90 ms | 250 ms |
| 12' · typecheck en frío (crear `Program`) | 600 ms | 2.5 s |

Reproducible desde la raíz del repo:

```bash
node ii/packages/skills/banco/typecheck.mjs
```

Sale con código 0 si el plan sigue en pie, 1 si hay que revisarlo.

---

## Veredicto: **el plan del sandbox sobrevive, y con margen**

Medido sobre los 27 borradores de la escalera, contra `skill-api.d.ts`:

| | Medido | Presupuesto | |
|---|---|---|---|
| **Frío** — crear el `Program` | **240 ms** | 600 ms p50 · 2.5 s p95 | ✔ |
| **Frío** — criterio de corte | 240 ms | **3000 ms** | ✔ **12× de margen** |
| **Tibio ingenuo** — reusar `Program`, todos los diagnósticos | 78 ms p50 · 94 ms p95 | 90 / 250 ms | ✔ |
| **Tibio dirigido** — diagnósticos solo del archivo nuevo | 78 ms p50 · 92 ms p95 | 90 / 250 ms | ✔ |
| **Ranura fija** — `LanguageService`, mismo path, cambia el contenido | **30 ms p50 · 53 ms p95** | 90 / 250 ms | ✔ **3×** |

**Reparar y rechazar localmente cuesta 30 ms. Un viaje al modelo son 6 a 25 s.**
La relación es de 1 a 500, y ésa es la que justifica toda la arquitectura de la
fragua: el typecheck local como puerta antes del viaje es correcto, y por
márgenes que no están ni cerca del filo.

## Los dos hallazgos, que no son los números

### 1. `lib` y `types` **son** el presupuesto

La primera corrida del banco daba **674 ms en frío y 440 ms tibio** — cinco veces
por encima del presupuesto. No era el algoritmo: era que `OPCIONES` no fijaba
`lib` ni `types`, así que TypeScript cargaba `lib.dom.d.ts`, `lib.webworker`,
`lib.scripthost` y los **132 archivos** de `@types/node`.

| | Frío | Tibio p50 |
|---|---|---|
| Con DOM + `@types/node` | 674 ms | 440 ms |
| Con `lib: ['es2022']`, `types: []` | **240 ms** | **78 ms** |
| | **2.8×** | **5.6×** |

La habilidad generada no tiene DOM, no tiene red, no tiene `node:fs`. Un
`tsconfig` que se los ofrece no solo es incorrecto —le muestra al modelo una
superficie que no existe— sino que **cuesta más que cualquier optimización que
uno se ponga a hacer después.** Es una línea de configuración y es 5.6×.

Va como regla del Hito 8: *el `tsconfig` de la fragua se declara explícito, con
`lib` mínimo y `types: []`, y se testea que lo siga siendo.*

### 2. Reusar el `Program` no alcanza: hay que no mover los archivos raíz

`ts.createProgram(..., oldProgram)` con un archivo raíz **distinto** en cada
vuelta cuesta 78 ms. La misma operación con una **ranura fija** —el candidato
siempre en el mismo path, cambiando contenido y versión— cuesta 30 ms.

La razón es que cambiar la lista de archivos raíz invalida la reutilización de
estructura. Y el detalle que lo delata: pedir **todos** los diagnósticos contra
pedir **solo los del archivo nuevo** dio la misma cifra (78 vs 78, 1.0×). El
costo nunca estuvo en chequear de más; estuvo en reconstruir el programa.

O sea: la optimización obvia (chequear menos) no rinde nada, y la no obvia (no
mover los archivos) rinde 3×. Conviene saberlo antes de escribir la fragua, no
después.

## Lo que este banco NO mide

La otra mitad del Hito 0 sigue pendiente, y es la que puede matar el plan:

- **El costo del transformer de combustible.** El criterio de corte dice que si
  pasa del 15% de overhead, el plan del sandbox cambia. Requiere escribir el
  transformer.
- **El arranque de página completo**, con el toolchain de TypeScript adentro del
  navegador. Este banco corre en Node, donde `typescript` ya está en disco. En el
  navegador hay que bajarlo, y `typescript` pesa varios MB.
- **El barrido térmico de diez sustancias** (corrección B de la auditoría): si no
  existe una ventana de cocción estable sin números por caso, el modelo físico
  cambia acá y no en el mes cinco.

Los tres necesitan código que todavía no existe. Éste no lo necesitaba, y por eso
se hizo primero.
