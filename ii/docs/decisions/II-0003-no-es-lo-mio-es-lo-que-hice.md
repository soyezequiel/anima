# ADR II-0003 — No es «lo mío», es «lo que hice»

Fecha: 2026-07-26 · Estado: aceptado

## Contexto

El borrador [`t2/22-retirar-lo-suyo-del-fuego.ts`](../../packages/skills/borradores/t2/22-retirar-lo-suyo-del-fuego.ts)
quedó a un solo error: `Property 'mine' does not exist on type 'Ctx'`.

La capacidad es «sacar lo suyo del alcance del fuego antes de que se arruine», y
para eso el modelo pidió un predicado que distinga sus cosas de cualquier cosa
portable que ande tirada. El concepto no está en ningún lado del documento de
arquitectura: ni pertenencia, ni autoría, ni obras.

En Ánima I **sí** está, y en dos ADRs que el inventario marca `portar`: el 0033
(«recuerdos de lo que hizo») y el 0056 («el catálogo de sus obras»).

## Decisión

**No se agrega `ctx.mine`. Se agrega autoría, no propiedad.**

```ts
export interface BodyView {
  readonly id: string
  readonly at: Placement
  readonly name: string
  /** Lo hizo ella, o es descendiente de algo que hizo ella. */
  readonly madeByMe: boolean
}
```

Sale de `Provenance`, que ya existe en el modelo de datos de la arquitectura
—`Substance` y `Process` lo tienen— y que acá se extiende a `Body`. No es un
campo nuevo que haya que mantener: es un dato que el mundo ya escribe cuando un
`Yield` produce un cuerpo, propagado por `join` y por `split`.

La distinción con «propiedad» no es filosófica, es operativa:

| | Propiedad (`mine`) | Autoría (`madeByMe`) |
|---|---|---|
| Qué afirma | esto me pertenece | esto existe porque yo lo hice |
| Quién lo decide | una regla social que no existe | el mundo, al crear el cuerpo |
| Con dos criaturas | hay que arbitrar disputas | no hay nada que arbitrar |
| Qué pasa si lo agarra otro | conflicto | sigue siendo cierto |

## Por qué así y no de otra forma

Se descartó **`ctx.mine(b): boolean` como propiedad**. Requiere inventar un
régimen de pertenencia —cómo se adquiere, cómo se pierde, qué pasa cuando el
cuidador le da algo— y nada de eso está en el producto. Es una capa social entera
metida por la ventana para resolver un `if`.

Se descartó **marcar «lo mío» en `ctx.memory`**. Es lo que el borrador de
`dejar-marcas` terminó haciendo, y el análisis lo pescó: el significado queda del
lado del programa, no del mundo. Una habilidad nueva no puede leer lo que otra
recordó, y al morir la criatura se pierde. La autoría en el cuerpo viaja con el
legado, que es donde tiene que estar.

Se descartó **derivarlo del inventario** («mío es lo que tengo en la mano»).
Colapsa justamente el caso de la capacidad: lo que se está quemando **no** lo
tiene en la mano.

## Consecuencias

**Buenas**

- `retirar-lo-suyo-del-fuego` pasa a expresable, y con la semántica correcta:
  rescata el aparejo que construyó, no la rama que el mundo dejó ahí.
- Conecta con el catálogo de obras (ADR 0056 de Ánima I) sin duplicar nada: el
  catálogo es la vista agregada de lo mismo.
- Da material emocional gratis. «Se le quemó lo que había hecho» es una historia;
  «se le quemó un objeto de su inventario» no.

**A tener en cuenta**

- **`madeByMe` es de la criatura, no del linaje.** Una heredera que recibe la
  biblioteca **no** hereda la autoría de las obras de su madre: para ella son
  cosas del mundo que encontró hechas. Es la decisión correcta y hay que
  escribirla, porque la contraria —heredar autoría— sería igual de defendible y
  cambia el tono del producto entero.
- **Propagar autoría por `split` puede sorprender.** Si rompe su caña y recupera
  la vara, la vara sigue siendo «suya» aunque nunca la haya fabricado. Se acepta:
  la alternativa es perder la marca cada vez que algo se descompone.
- **No hay antónimo.** No existe «esto es de otro». El día que haya dos
  criaturas, esta decisión no alcanza y hay que volver acá.
