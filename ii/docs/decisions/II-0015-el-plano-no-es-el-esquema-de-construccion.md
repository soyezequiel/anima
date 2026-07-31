# II-0015 — El plano no es el esquema de construcción, y ninguno de los dos es la habilidad

**Estado:** aceptado · **Decide:** el usuario, sobre el
[Gate 5→6](../gate-5-6-objetos-emergentes.md) · **Fecha:** 2026-07-31

## El problema

El caso de aceptación decidido es **«fabricá una trampa para peces»**, con la
trampa sin precargar. Eso obliga a que algo que el modelo escribió termine
gobernando qué puede planificar la criatura — y el único lugar donde hoy vive esa
información es `SCHEMA_INDEX`, una `ReadonlyMap` constante de módulo
(`plan/src/esquemas.ts:1475`) derivada de una lista literal.

El atajo obvio es insertar lo que propone la fragua ahí adentro. **Ese atajo está
prohibido**, y no por prolijidad:

1. `SCHEMA_INDEX` se construye al cargar el módulo y lo leen tres paquetes; una
   inserción es una mutación global que dos partidas comparten;
2. una propuesta del modelo **no es confiable** y el índice no tiene dónde
   guardar esa diferencia — todo lo que está adentro es tratado como verdad por
   la regresión;
3. y sobre todo: **un plano, la causalidad que lo hace posible, la habilidad que
   lo construye y la habilidad que lo usa son cuatro afirmaciones distintas, con
   cuatro formas distintas de estar mal.** Meterlas en una sola fila obliga a
   aceptarlas o rechazarlas juntas, y el error más común de esta clase de sistema
   —construir algo que se levanta y no sirve— queda invisible por construcción.

## La decisión

**`BlueprintCandidate` no se inserta en `SCHEMA_INDEX`.** Se separan cinco piezas:

```
BlueprintCandidate   propuesta no confiable
BlueprintDefinition  estructura canónica, inmutable y versionada; NO contiene el sitio
ConstructionSchema   la causalidad física: procesos y leyes
BuildSkill           construye una revisión exacta
UseSkill             usa la obra y demuestra su función
```

**La definición, la construcción y el uso se juzgan y se promueven por
separado.** Cada una tiene su veredicto y su sello.

Dos consecuencias que valen la decisión entera:

- **construir algo no demuestra que funcione.** El `UseSkill` es el que acredita
  la función, contra el mundo, y un `BuildSkill` verde con `UseSkill` rojo es un
  resultado legítimo y frecuente, no un error del arnés;
- **la definición no lleva el sitio.** Por eso una misma revisión se puede
  levantar dos veces, en dos lugares, y dos partidas pueden compartir la
  definición sin compartir mundo. El sitio es del proyecto de obra — es el ADR
  0049 de Ánima I portado, y por eso la obra se puede retomar.

## Lo que se descartó, y por qué

- **Insertar el candidato en `SCHEMA_INDEX` con un flag `trust`.** Es lo que
  `Process` ya hace (`trust: 'borrador' | 'provisional' | 'estable'`) y funciona
  ahí porque un proceso es **una** afirmación. Un plano son cuatro, y un flag
  único las promueve juntas.
- **Un solo `BlueprintSkill` que construye y usa.** Es más corto de escribir y
  hace imposible el veredicto que más importa. La primera vez que una trampa se
  levante bien y no capture nada, el juez no va a tener dónde ponerlo.
- **Guardar el sitio adentro de la definición.** Ahorra un tipo y ata la revisión
  a un mundo: heredar el plano dejaría de tener sentido, y la herencia es el
  Hito 10.

## Consecuencias

- El Hito 7 (juez) evalúa **cinco cosas y no una**: plano, construcción, uso,
  utilidad y los mundos adversos. Está escrito en el plan de construcción.
- El Hito 8 (fragua) produce un paquete y no un archivo: candidato de plano +
  `BuildSkillCandidate` + `UseSkillCandidate` + dependencias + capacidades
  publicadas.
- El Hito 9 (biblioteca) indexa **por efectos y no por nombres**, y guarda pares
  build/use.
- `Blueprint` en `skills/src/tipos.ts:308` es hoy `{ id, at }` y la intención
  `place` la rechaza el mundo con `'no-implementado'` (`world/src/step.ts:3059`).
  El reemplazo de ese placeholder es trabajo del gate, y está anotado en los
  contratos a revalidar del Hito 4.

## Enlaces

- [Gate 5→6](../gate-5-6-objetos-emergentes.md)
- [ADR II-0018](II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md) — dónde se registra lo que esto separa
- ADR 0032 de Ánima I — lo grande es una obra, no un bloque
- ADR 0049 de Ánima I — la obra tiene un sitio
- ADR 0086 de Ánima I — lo que sabe hacer es un catálogo, y el plan es de ahora
