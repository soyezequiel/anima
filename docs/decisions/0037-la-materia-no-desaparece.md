# ADR 0037 — La materia no desaparece

Fecha: 2026-07-18 · Estado: aceptada · Extiende el ADR 0015 (drops), el ADR 0031
(el árbol de crafteo) y el ADR 0027 (interacciones inventadas y la IA Dios); se
apoya en la doctrina recurso-vs-capacidad del ADR 0008.

## Contexto

Del chat de una partida real:

> **Cuidador:** pica piedra
> **Ánima:** Voy a intentar destruir ese pedernal.
> **Ánima:** Listo, destruí el pedernal.
> **Cuidador:** y dónde está las partes picadas?
> **Ánima:** ¡Rompí el pedernal con el martillo, pero no veo los fragmentos por
> ahora! ¿Dónde crees que se fueron?

No se fueron a ningún lado: nunca existieron. El motor de destrucción
(`resolveUseItem`) hacía exactamente lo que le pedía el componente `drops` del
ADR 0015 — y si la entidad no lo declaraba, borraba la entidad y listo:

```ts
const drops = target.components.drops ?? [];   // pedernal: [] → nada
removeEntity(world, target.id);                // desaparece
```

El árbol funcionaba porque alguien le escribió `drops` a mano. El pedernal no,
las paredes tampoco, y **nada de lo crafteado**: una silla hecha de tres troncos
volvía a la nada al romperse. El agujero tenía dos mitades distintas:

1. **Lo crafteado.** El mundo SÍ sabe de qué está hecha una silla —lo dice la
   receta que la produjo— y aun así lo olvidaba al construirla. Devolverlo no
   requiere imaginación ninguna: requiere no tirar el dato.
2. **La materia base.** Un pedernal sembrado por el escenario no tiene receta de
   la cual derivar nada. En qué se deshace no lo sabe el código, y hardcodear
   "esquirla" por cada objeto del mundo es la clase de tabla que envejece mal y
   que además no alcanza a lo que Ánima invente mañana con otro nombre.

## Decisión

**Romper algo transforma la materia; no la borra.** De dónde sale la respuesta
depende de si el mundo ya la tiene:

**a) Lo crafteado la deriva, no la imagina.** Al craftear, el producto nace con
`drops` = la materia que realmente se consumió. Desarmarlo devuelve lo que
costó, y "cuánto se recupera" deja de ser un número a elegir: es lo que entró.
Si la receta declara sus propios `drops`, esa decisión deliberada manda (una
silla que deja menos de lo que costó sigue siendo expresable); el cambio es que
el default deja de ser *nada* y pasa a ser *todo lo que costó*.

**b) La materia base abre la cuarta puerta de invención.** En qué se deshace un
pedernal lo decide la **IA Dios en tiempo de ejecución**, por el mismo camino de
tres puertas del ADR 0027: el modelo propone (`decomposition.propose`), una
puerta determinista filtra (`validateDecomposition`), y el juez de coherencia
aprueba o veta (`decomposition.judge`). Lo aprobado queda en
`world.decompositions` —estado del mundo, viaja en los snapshots— y **no se
vuelve a imaginar**, ni en esta sesión ni en un mundo restaurado.

### Dónde vive la conservación

Es la pregunta que decidió la forma. Para lo crafteado la acota la receta: no
puede devolver más de lo que costó. Para la materia base **no hay receta que la
acote**, y ahí se eligió deliberadamente **el juicio y no un tope numérico**:

- La puerta determinista sigue prohibiendo lo que el ADR 0008 protege —ningún
  fragmento puede ser `food`, `tree` ni `pet`— y prohíbe que algo deje varios de
  sí mismo, que es una fábrica de materia sin disfraz.
- Pero "un pedernal deja dos esquirlas, no diez troncos" no lo sabe ningún
  esquema: sabe de tipos y de cotas, no de qué está hecho el mundo. Lo sabe el
  guardián del sentido de las cosas. El prompt del juez lo dice con todas las
  letras: *los fragmentos salen DEL objeto, y romper empobrece*.

Un tope numérico habría sido más barato y habría fallado en la dirección
equivocada: dejaría pasar "1 pedernal → 3 tablas" (poca cantidad, materia
imposible) y frenaría "1 tronco → 4 astillas" (mucha cantidad, materia honesta).

### Un veto no prohíbe el acto

Diferencia deliberada con las interacciones: si el Dios veta unos fragmentos,
eso significa **"romperlo no deja eso"**, no *"no se puede romper"*. El golpe
sigue su curso y la cosa se rompe sin dejar nada —exactamente como se comportaba
el mundo antes—, y el veto se recuerda para no volver a imaginarlo. Suspender el
objetivo convertiría una idea fallida sobre la materia en una prohibición sobre
el acto, que es un poder que este juez no tiene por qué tener.

## Consecuencias

- El motor no cambió de naturaleza: `resolveUseItem` sigue soltando `drops` y
  sigue sin dejar nada cuando no hay ninguno. Lo que cambió es **quién sabe la
  regla** — la entidad, o el mundo que la aprendió. Sin descomposición aprendida,
  el comportamiento viejo queda intacto, ahora como último recurso y no como
  único.
- `Perception` expone `decompositions` (reuso sin gastar consultas) y
  `leavesRemains` en cada entidad percibida: lo que ya declara qué deja no
  necesita que nadie lo imagine.
- Los fragmentos que una descomposición define son materia real del mundo:
  entran en `obtainableKinds`, así que pueden ser ingrediente de una idea futura
  y el árbol del ADR 0031 los ve.
- Imaginar cuesta una propuesta y un juicio, **una sola vez por tipo**. El
  crédito de intentos es el mismo del pipeline (`MAX_INVENTION_ATTEMPTS`).
- El proveedor simulado no inventa descomposiciones ni las juzga, como no
  inventa interacciones (ADR 0006): sin comprensión abierta no hay juez, y sin
  juez no entra nada. El lado seguro del error es que la materia no aparezca.

## Alternativas descartadas

- **Hardcodear los `drops` de cada objeto del escenario.** Resuelve el pedernal
  y ninguno de los objetos que Ánima invente mañana. Es la tabla que el ADR 0027
  ya decidió no escribir.
- **Un tope numérico de conservación para la materia base.** Más barato, y
  equivocado en las dos direcciones (ver arriba).
- **Reusar las interacciones (`transform-target`).** Son 1→1 por diseño y su
  puerta niega `drops` a propósito, justamente para que una transformación no
  pueda dejar deuda de materia que cobrar al romperse. Romper es 1→N: es otra
  cosa, y merecía su propia puerta.
- **Devolver una fracción de lo crafteado.** "Todo lo que costó" es más simple
  de explicar, no fabrica materia, y el costo de desarmar ya lo pone el mundo:
  hay que romperlo, y romper gasta herramienta.
