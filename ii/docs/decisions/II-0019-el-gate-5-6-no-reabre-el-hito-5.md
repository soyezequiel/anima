# II-0019 — Los objetos emergentes son una puerta entre el Hito 5 y el 6, no una ampliación del Hito 5

**Estado:** aceptado · **Decide:** el usuario · **Fecha:** 2026-07-31

## El problema

El caso de aceptación decidido —«fabricá una trampa para peces», sin trampa
precargada— toca casi todo: planos, catálogo, persistencia, juez, fragua,
dispositivos autónomos y representación visual.

El movimiento tentador es meterlo en el Hito 5, porque el Hito 5 es el criterio de
corte del proyecto y «si la tesis vive, que viva del todo». **Ese movimiento
cuesta el Hito 5 entero.** Está aproximadamente al 80% implementado, con seis
criterios medidos y publicados —tres que cumplen y tres en rojo aceptado, cada uno
con su `it.fails` y su causa medida— y ampliarle el alcance ahora significa:

1. que el criterio de corte deje de ser comparable con lo que ya se midió;
2. que trabajo terminado se tenga que rehacer contra un contrato nuevo;
3. y que el hito que existe para **decidir si el proyecto sigue** pase a depender
   de un sistema que todavía no se diseñó.

## La decisión

**Los objetos emergentes son un gate técnico obligatorio, después del Hito 5 y
antes del Hito 6.** Se lo llama **Gate 5→6** (o «extensión técnica posterior al
Hito 5»), y su criterio vive en
[`gate-5-6-objetos-emergentes.md`](../gate-5-6-objetos-emergentes.md).

El orden queda:

```
terminar el Hito 5 actual
  → Gate técnico de objetos emergentes
    → Hitos 6–11
      → Hito 12 (UI)
        → Hitos post-UI de física abierta (13–16)
```

Cinco reglas, y las cinco existen para proteger trabajo hecho:

1. **El Hito 5 termina con su alcance actual.** No se le agregan planos,
   persistencia de catálogo ni dispositivos autónomos al criterio de cierre.
2. **No se rehace lo ya implementado.** El gate es una extensión posterior al
   núcleo del Hito 5, no una reapertura del 80%.
3. **Los Hitos 0–4 siguen cerrados históricamente.** Sus mediciones no se borran
   ni se re-presentan como trabajo inconcluso; lo que se agrega es una lista de
   **contratos a revalidar**, que es otra cosa.
4. **Los hitos históricos no se renumeran todavía.** Por eso el gate lleva número
   de puerta y no de hito.
5. **Lo único que el Hito 5 debe preservar es una costura de compatibilidad**: el
   planificador y la mente no pueden quedar arquitectónicamente atados a un
   catálogo global imposible de reemplazar. Está medida: `plan()` ya la tiene
   (`OpcionesDePlan.esquemas`), la mente no. **La mitad que falta es deuda del
   gate, no motivo para reiniciar el Hito 5.**

## Lo que se descartó, y por qué

- **Ampliar el criterio del Hito 5.** Cuesta el criterio de corte, que es la única
  pieza del plan que puede parar el proyecto a tiempo. Un criterio de corte que se
  agranda cada vez que aparece una idea buena no corta nada.
- **Hacer los objetos emergentes después del Hito 11, junto con la UI.** Deja la
  UI dibujando un mundo donde lo emergente todavía no existe, y obliga a rehacer
  el view model apenas exista.
- **Hacerlo como parte del Hito 8 (fragua).** La fragua **produce** candidatos; el
  gate es lo que hace que un candidato tenga dónde vivir. Sin registry, la fragua
  escribe en el aire.
- **Numerarlo «Hito 5·bis».** Invita a leerlo como continuación del 5, que es
  exactamente lo que esta decisión evita.

## Consecuencias

- El plan de construcción del documento de arquitectura gana el gate entre el
  Hito 5 y el Hito 6, y los Hitos 6 a 11 ganan lo que el caso de aceptación les
  exige.
- Aparecen el Hito 12 (UI, con subhitos A/B/C) y los Hitos 13 a 16 (procesos
  propuestos, geometría, objetos físicos abiertos, fauna).
- Los documentos de los Hitos 0 a 4 ganan una sección «contratos que deben
  revalidarse por la extensión de objetos emergentes», con puntero al gate.
- El pronóstico de **7–9 meses queda como histórico**: no incluía UI, objetos
  emergentes, dispositivos autónomos, geometría, procesos nuevos ni fauna.

## Enlaces

- [Gate 5→6](../gate-5-6-objetos-emergentes.md)
- [`continuar-aca.md`](../continuar-aca.md) — la memoria operativa
- [ADR II-0018](II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md) — la costura que el Hito 5 tiene que preservar
