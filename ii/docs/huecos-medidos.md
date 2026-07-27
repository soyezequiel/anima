# Huecos medidos de `skill-api.d.ts`

No es opinión: es el conteo de errores de `tsc` sobre los 28 borradores que
escribieron los agentes al intentar expresar 20 capacidades contra la superficie
declarada en
[`../packages/skills/src/skill-api.d.ts`](../packages/skills/src/skill-api.d.ts).

Desde el Hito 4 ese archivo **se emite** de `src/tipos.ts` + `src/ctx.ts` con
`tsc --declaration`, así que ya no se puede quedar viejo: si la física suma una
cualidad, la superficie la tiene sin que nadie la copie.

Reproducible desde la raíz del repo:

```bash
node node_modules/typescript/bin/tsc -p ii/packages/skills/tsconfig.t0.json
```

(y lo mismo para `t1`, `t2`, `t3`, `t4`. La `t0` es el ejemplo canónico del
documento de arquitectura.) O de una vez, con el trinquete y el reporte al día:

```bash
pnpm --filter @anima/skills test tests/arnes.test.ts
```

Evidencia cruda: [`huecos-medidos-pase1.json`](huecos-medidos-pase1.json) y
[`huecos-medidos-pase2.json`](huecos-medidos-pase2.json).

---

## Las cuatro pasadas

| | Pase 1 | Pase 2 | Pase 3 | **Pase 4 — Hito 4** |
|---|---|---|---|---|
| | a mano | a mano | a mano | **EMITIDO del código real** |
| Errores de tipos | **112** | **71** | **64** | **84** |
| Borradores que fallan | 23 / 28 | 22 / 28 | **18 / 28** | 25 / 28 |
| Compilan limpio | 5 | 6 | **10** | 3 |

El pase 3 es el interesante: bajó siete errores netos, pero **quince de los 64
que quedan son nuevos** — existen solo porque los roles tipados (`RolesOf<P>`)
empezaron a rechazar llamadas malformadas que antes pasaban. Descontando eso,
el pase 3 eliminó 22 errores reales y **cuadruplicó** los borradores expresables
respecto del pase 1.

**El pase 4 es de otra especie, y por eso la columna dice de dónde sale cada
número.** Los tres primeros comparan una superficie escrita a mano contra sí
misma; el cuarto la reemplaza por la que **emite `tsc --declaration` del código
real** — el que importa `@anima/physics`, `@anima/world` y `@anima/oracle`. Sube
20 y pierde 7 borradores expresables, y **ninguno de los 20 es una capacidad
perdida**: son sitios donde la superficie a mano dejaba escribir algo que el
mundo no puede hacer. El desglose completo, con las seis causas y los dos bugs
que el propio arnés tenía, está en
[`hito-4-el-sandbox.md`](hito-4-el-sandbox.md#1-el-momento-los-28-borradores-contra-la-superficie-emitida-del-código-real)
y el porqué de cada uno viaja con el trinquete, en
[`tests/linea-base.json`](../packages/skills/tests/linea-base.json).

Desde el pase 4 el corpus se compila con **cinco** tandas y no cuatro: la `t0` es
el ejemplo canónico del documento de arquitectura, que vive suelto en
`borradores/` y que hasta entonces **no compilaba nadie**.

### La evidencia de que el árbitro estaba apagado

Un agente había escrito `t4/escritor-lo-que-si-compila.ts` con el propósito
explícito de demostrar qué subconjunto **sí** compila. Compilaba limpio. Con
`RolesOf<P>`:

```
escritor-lo-que-si-compila.ts(36,41): error TS2353: 'techo' does not exist in
  type '{ binder: BodyView; a: BodyView; b?: BodyView; }'.
escritor-lo-que-si-compila.ts(49,43): error TS2353: 'stone' does not exist in
  type '{ a: BodyView; b: BodyView; actor: BodyView; }'.
```

El archivo escrito para probar que algo funciona estaba pasando **roles
inventados** a procesos reales, y el compilador lo bendecía. Con
`roles: Record<string, BodyView>`, de veinte llamadas malformadas se rechazaban
cero.

Ésa es la razón por la que un pase que **sube** los errores puede valer más que
uno que los baja.

---

## Lo que hizo cada pase

### Pase 2 — cinco reparaciones mecánicas

El pase 2 agregó **cinco reparaciones y nada más**, elegidas por cuántos
borradores distintos las pedían:

| # | Reparación | Borradores que la pedían | Después |
|---|---|---|---|
| 1 | `SelfView extends BodyView` | 7 (9 sitios) | **0** |
| 2 | `SelfView.stamina` / `.hunger` | 8 | **0** |
| 3 | `Ctx.qAt` + `CellQuality` | 6 (8 sitios) | **0** |
| 4 | `Ctx.eat` | 3 (8 sitios) | **0** |
| 5 | `Ctx.wait` | 5 | **0** |

Las cinco desaparecieron enteras de la lista de faltantes. La reparación
funcionó exactamente como se predijo.

## Y sin embargo: −41 errores compró **un** borrador

Ése es el resultado que importa, y es contraintuitivo. Se eliminó el 37% de los
errores y la cantidad de habilidades expresables pasó de 5 a 6.

La razón es la forma de la distribución: los errores no estaban concentrados en
pocos borradores, estaban **repartidos**. Cada borrador necesita varias cosas
distintas, y alcanza con que le falte una.

| Cosas distintas que le faltan | Borradores |
|---|---|
| 1 | **7** |
| 2 | 2 |
| 3 | 3 |
| 4 | 6 |
| 5 | 3 |
| 6 | 1 |

**Siete borradores están a una sola cosa de compilar.** Ésa es la buena noticia
del pase 2, y no se ve en el conteo de errores.

## Los siete bloqueos individuales, y por qué la segunda ronda es más cara

| Borrador | Lo único que le falta | Qué clase de problema es |
|---|---|---|
| `encender-solo-cuando-va-a-prender` | `'combustion'` no es `ProcessId` | **Decisión de diseño no tomada.** ¿Encender es algo que se HACE o algo que PASA? Hoy la criatura puede frotar (`friccion`) pero no puede prender: la ignición es ley ambiente. Es el HUECO 2 con nombre propio |
| `sacarlo-antes-de-que-se-queme` | `'denaturesAt'` no es `QualityId` | **Catálogo de física.** Es propiedad de la sustancia, no cualidad del cuerpo. Sin ella no se puede leer el borde de la ventana de cocción, que es de lo que trata la capacidad |
| `21-guarecerse-antes-de-tener-frio` | `Ctx.clock` | **Portar el ADR 0085.** Día/noche existe en Ánima I y el documento lo menciona una vez, al final de un párrafo |
| `22-retirar-lo-suyo-del-fuego` | `Ctx.mine` | **Concepto que no existe.** «Lo mío» no está en ningún lado del documento: ni autoría, ni pertenencia, ni cosas que ella hizo |
| `24-jubilar-la-herramienta-gastada` | `BodyView.joints` | **Profundidad de percepción** (HUECO 4). Y detrás hay algo peor: el mundo no gasta la herramienta, así que la guarda no dispararía igual |
| `05-tapar-la-fogata` | `put(covering:)` | **Ley 12, `oclusion`, que no está escrita.** No es superficie: es física que la ley 4 ya invoca sin declarar |
| `comer-ahora-o-esperar-la-coccion` | `Ctx.project` | **Primitiva de la mente, no del mundo.** Proyectar un estado futuro es lo que hace el planificador; que una habilidad lo pida cruza la frontera Hito 4 / Hito 5 |

**La conclusión del pase 2.** La primera ronda de reparaciones era mecánica:
agregar métodos que faltaban. La segunda no lo es. De los siete bloqueos, uno es
una ley que hay que escribir, uno es un concepto que no existe, uno es una
pregunta de diseño que el documento nunca contestó, y uno cruza la frontera
entre dos hitos. **Ninguno se arregla agregando una firma.**

O sea que el techo del requisito 1 no estaba en el tamaño de `Ctx`, como parecía
después del pase 1. Estaba una capa más abajo.

### Pase 3 — las decisiones, tomadas

Los siete bloqueos se resolvieron **decidiendo**, no agregando firmas. Cada uno
tiene su ADR en [`decisions/`](decisions/):

| Bloqueo | Decisión | Resultado |
|---|---|---|
| `apply('combustion')` | [II-0001](decisions/II-0001-encender-no-es-una-accion.md) — encender es una consecuencia, no una acción | **no se agregó nada**; la habilidad ya podía leer las tres cualidades y decidir |
| `put(covering:)` | [II-0002](decisions/II-0002-la-ley-de-la-oclusion.md) — se escribe la ley 12, `oclusion` | `covering`, `sheltered`, `coveredBy`, `permeability` |
| `ctx.mine` | [II-0003](decisions/II-0003-no-es-lo-mio-es-lo-que-hice.md) — autoría, no propiedad | `BodyView.madeByMe` |
| `ctx.project` | [II-0004](decisions/II-0004-una-habilidad-no-simula-el-futuro.md) — la habilidad lee el presente | `rateOf()`, que no simula |

Más los mecánicos con ADR de Ánima I detrás: `clock` (0085), `place` (0032),
`capacity` (0070), `drop`, los campos de `PlaceMemory`, `denaturesAt` y
`pyrolysisAt`, y `PerceptionView.self`.

Y de yapa, una contradicción del documento resuelta: la **aridad de `union`**.
Su criterio verificable del Hito 1 dice `union(vara, hebra)` —dos cuerpos—
contra un `Process` de tres roles. Se resolvió con `b` opcional: atar `a` con
`binder` a un segundo cuerpo, o atarle `binder` a `a` y nada más. **La caña es
el segundo caso**, y por eso le queda una punta de hebra libre — que es de donde
sale `catch` vía `freeStrandEnds`. Con `b` obligatorio, la caña no existe.

---

## Lo que falta hoy, ordenado por cuántos borradores distintos lo piden

Estado tras el **pase 2**, conservado como referencia de la progresión. El estado
actual, regenerado en cada corrida del arnés, vive en
[`huecos-medidos-actual.json`](huecos-medidos-actual.json).

«Archivos» es la señal fuerte: algo que piden varios borradores distintos es
estructural; «sitios» es cuántas veces aparece en total.

| # | Qué falta | Archivos | Sitios |
|---|---|---|---|
| 1 | cualidad: `sheltered` (ley 12, `oclusion`) | 3 | 3 |
| 2 | `Ctx.clock` | 2 | 4 |
| 3 | `PlaceMemory.atTick` | 2 | 2 |
| 4 | `SelfView.capacity` | 2 | 2 |
| 5 | `Ctx.drop` | 2 | 2 |
| 6 | `PlaceMemory.what` | 2 | 2 |
| 7 | `Ctx.heard` (canal de vuelta del cuidador) | 2 | 2 |
| 8 | `put()`: opción `covering` | 2 | 2 |
| 9 | cualidad: `threat` | 2 | 2 |
| 10 | proceso: `afilar` | 2 | 2 |
| 11 | `Ctx.velocityOf` | 2 | 2 |
| 12 | `Ctx.behind` | 2 | 2 |
| 13 | cualidad: `raining` | 2 | 2 |
| 14 | cualidad: `covers` | 2 | 2 |
| 15 | `Ctx.place` (ADR 0032, `Blueprint`) | 2 | 2 |
| 16 | proceso: `cavar` | 2 | 2 |
| 17 | `PlaceMemory.q` | 1 | 2 |
| 18 | `Ctx.qualifies` | 1 | 2 |
| 19 | `PerceptionView.self` | 1 | 2 |
| 20 | proceso: `cubrir` | 1 | 2 |
| 21 | cualidad: `smoke` | 1 | 2 |
| 22 | proceso: `combustion` (como aplicable) | 1 | 1 |
| 23 | cualidad: `denaturesAt` | 1 | 1 |
| 24 | `Ctx.mine` | 1 | 1 |
| 25 | `BodyView.joints` | 1 | 1 |
| 26 | `Ctx.mark` | 1 | 1 |
| 27 | `PlaceMemory.tag` | 1 | 1 |
| 28 | `PlaceMemory.tick` | 1 | 1 |
| 29 | `Ctx.estimate` | 1 | 1 |
| 30 | `Ctx.cost` | 1 | 1 |
| 31 | `PerceptionView.need` | 1 | 1 |
| 32 | `PerceptionView.wetAt` | 1 | 1 |
| 33 | `Ctx.abort` | 1 | 1 |
| 34 | `Ctx.project` | 1 | 1 |
| 35 | `BodyView.coveredBy` | 1 | 1 |
| 36 | cualidad: `presence` (el cuidador como cuerpo) | 1 | 1 |
| 37 | `Ctx.give` | 1 | 1 |
| 38 | `Ctx.needs` | 1 | 1 |
| 39 | `Ctx.isNight` | 1 | 1 |
| 40 | proceso: `ahumar` | 1 | 1 |
| 41 | `Ctx.perceptionRadius` | 1 | 1 |
| 42 | proceso: `arrastrar` | 1 | 1 |
| 43 | `Ctx.drag` | 1 | 1 |
| 44 | cualidad: `buoyancy` | 1 | 1 |
| 45 | cualidad: `flow` | 1 | 1 |

## Lo que NO se reparó a propósito

`sheltered`, `raining`, `covers`, `smoke`, `threat`, `buoyancy`, `flow` y los
procesos `cubrir`, `cavar`, `afilar`, `ahumar` y `arrastrar` **no se agregaron**.

Cada uno de ésos es un hueco de **física**, no de superficie. Agregarlos al
`.d.ts` haría compilar borradores que después producirían la conducta
equivocada en silencio — que es exactamente el modo de falla que este ejercicio
existe para no crear. Un `'sheltered'` que typechequea y siempre vale 0 es peor
que un error de compilación.

La disciplina, escrita para que no se pierda: **la superficie solo puede
declarar lo que alguna ley pone en el mundo.**
