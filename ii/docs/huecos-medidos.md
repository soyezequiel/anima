# Huecos medidos de `skill-api.d.ts`

No es opinión: es el conteo de errores de `tsc` sobre los 28 borradores que
escribieron los agentes al intentar expresar 20 capacidades contra la superficie
declarada en
[`../packages/skills/src/skill-api.d.ts`](../packages/skills/src/skill-api.d.ts).

Reproducible desde la raíz del repo:

```bash
node node_modules/typescript/bin/tsc -p ii/packages/skills/tsconfig.t1.json
```

(y lo mismo para `t2`, `t3`, `t4`.)

Evidencia cruda: [`huecos-medidos-pase1.json`](huecos-medidos-pase1.json) y
[`huecos-medidos-pase2.json`](huecos-medidos-pase2.json).

---

## Las dos pasadas

| | Pase 1 | Pase 2 | Δ |
|---|---|---|---|
| Errores de tipos | **112** | **71** | **−41 (−37%)** |
| Borradores que fallan | 23 / 28 | 22 / 28 | **−1** |
| Compilan limpio | 5 | 6 | +1 |

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

---

## Lo que falta hoy, ordenado por cuántos borradores distintos lo piden

Estado tras el pase 2. «Archivos» es la señal fuerte: algo que piden varios
borradores distintos es estructural; «sitios» es cuántas veces aparece en total.

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
