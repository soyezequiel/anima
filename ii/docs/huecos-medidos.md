# Huecos medidos de `skill-api.d.ts`

No es opinión: es el conteo de errores de `tsc` sobre los 28 borradores que
escribieron los agentes al intentar expresar 20 capacidades contra la superficie
declarada en [`../packages/skills/src/skill-api.d.ts`](../packages/skills/src/skill-api.d.ts).

Reproducible desde la raíz del repo:

```bash
node node_modules/typescript/bin/tsc -p ii/packages/skills/tsconfig.t1.json
```

(y lo mismo para `t2`, `t3`, `t4`.)

| | |
|---|---|
| Errores de tipos totales | **112** |
| Borradores escritos | 28 |
| Borradores que fallan | **23** |
| Compilan limpio | 5 |

## Lo que falta, ordenado por cuántos borradores distintos lo piden

«Archivos» es la señal fuerte: una cosa que piden seis borradores distintos es
estructural. «Sitios» es cuántas veces aparece en total.

| # | Qué falta | Archivos | Sitios |
|---|---|---|---|
| 1 | `SelfView.stamina` | 8 | 8 |
| 2 | `SelfView no es BodyView` | 7 | 9 |
| 3 | `Ctx.qAt` | 6 | 8 |
| 4 | `Ctx.wait` | 5 | 5 |
| 5 | `Ctx.eat` | 3 | 8 |
| 6 | `SelfView.hunger` | 3 | 4 |
| 7 | `cualidad: sheltered` | 3 | 3 |
| 8 | `Ctx.clock` | 2 | 4 |
| 9 | `PlaceMemory.atTick` | 2 | 2 |
| 10 | `SelfView.capacity` | 2 | 2 |
| 11 | `Ctx.drop` | 2 | 2 |
| 12 | `PlaceMemory.what` | 2 | 2 |
| 13 | `Ctx.heard` | 2 | 2 |
| 14 | `put(): opción covering` | 2 | 2 |
| 15 | `cualidad: threat` | 2 | 2 |
| 16 | `proceso: afilar` | 2 | 2 |
| 17 | `Ctx.velocityOf` | 2 | 2 |
| 18 | `Ctx.behind` | 2 | 2 |
| 19 | `cualidad: raining` | 2 | 2 |
| 20 | `cualidad: covers` | 2 | 2 |
| 21 | `Ctx.place` | 2 | 2 |
| 22 | `proceso: cavar` | 2 | 2 |
| 23 | `PlaceMemory.q` | 1 | 2 |
| 24 | `Ctx.qualifies` | 1 | 2 |
| 25 | `PerceptionView.self` | 1 | 2 |
| 26 | `proceso: cubrir` | 1 | 2 |
| 27 | `cualidad: smoke` | 1 | 2 |
| 28 | `proceso: combustion` | 1 | 1 |
| 29 | `cualidad: denaturesAt` | 1 | 1 |
| 30 | `Ctx.mine` | 1 | 1 |
| 31 | `BodyView.joints` | 1 | 1 |
| 32 | `Ctx.mark` | 1 | 1 |
| 33 | `PlaceMemory.tag` | 1 | 1 |
| 34 | `PlaceMemory.tick` | 1 | 1 |
| 35 | `Ctx.estimate` | 1 | 1 |
| 36 | `Ctx.cost` | 1 | 1 |
| 37 | `otro: Parameter 'u' implicitly has an 'any' type.` | 1 | 1 |
| 38 | `PerceptionView.need` | 1 | 1 |
| 39 | `PerceptionView.wetAt` | 1 | 1 |
| 40 | `Ctx.abort` | 1 | 1 |
| 41 | `Ctx.project` | 1 | 1 |
| 42 | `BodyView.coveredBy` | 1 | 1 |
| 43 | `cualidad: presence` | 1 | 1 |
| 44 | `Ctx.give` | 1 | 1 |
| 45 | `Ctx.needs` | 1 | 1 |
| 46 | `Ctx.isNight` | 1 | 1 |
| 47 | `proceso: ahumar` | 1 | 1 |
| 48 | `Ctx.perceptionRadius` | 1 | 1 |
| 49 | `proceso: arrastrar` | 1 | 1 |
| 50 | `Ctx.drag` | 1 | 1 |
| 51 | `cualidad: buoyancy` | 1 | 1 |
| 52 | `cualidad: flow` | 1 | 1 |
