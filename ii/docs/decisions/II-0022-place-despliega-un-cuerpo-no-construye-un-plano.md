# II-0022 — `place` despliega un cuerpo ya armado, y no construye un plano

**Estado:** aceptado · **Decide:** el usuario, sobre el
[Gate 5→6](../gate-5-6-objetos-emergentes.md) · **Fecha:** 2026-07-31

Sale de una MEDICIÓN y no de una discusión: la del tramo C·bis, en
`physics/tests/lo-que-cuesta-armar-un-plano.test.ts`.

## El problema

La intención `place` existe desde el Hito 4 con la firma
`place(blueprint: string, at: Placement)` y el mundo la rechaza con
`'no-implementado'` (`world/src/step.ts`). La lectura natural de esa firma es
«levantá este plano acá»: el mundo recibe una revisión y produce la obra.

**El tramo C·bis midió que esa lectura no se sostiene.** Construir un plano son
N−1 uniones encadenadas: una obra de seis piezas son ONCE cuerpos y cinco
acciones, cada paso intermedio es un cuerpo legal que se puede soltar y retomar, y
la topología sale del ORDEN de las uniones y no de lo que el plano declara.

O sea que **cuando algo se puede desplegar, el plano ya se realizó** y lo que hay
en la mano es un cuerpo. Una intención que reciba una revisión llegaría tarde.

## La decisión

### 1 · `place` toma un CUERPO, no una revisión

Deja de hablar de planos. Significa **«esta obra que tengo queda funcionando
acá»**: despliegue, no construcción.

Construir sigue siendo lo que ya era y no necesita intención propia:
`aplicar(union)` encadenado. Que armar no tenga un verbo aparte es correcto y no
un olvido — un verbo nuevo tendría que justificar qué hace que `union` ya no haga.

**El precio, dicho y no escondido:** cambia la firma de la intención y la de
`Ctx.place`, que es superficie que el modelo lee. Se paga una vez, ahora, y no
después con habilidades escritas contra una firma que mentía.

### 2 · De qué plano salió la obra se anota en la TABLA DEL MUNDO

La misma tabla del [ADR II-0020](II-0020-la-captura-vive-en-una-tabla-del-mundo.md)
que guarda la captura guarda también la revisión del plano del que salió el
dispositivo. Lo pide el punto 8 del criterio —«guardar y restaurar conserva la
revisión exacta»— y lo necesita el juez para atribuir un resultado a un plano.

**Es el mismo razonamiento que ya se aplicó a la captura:** `Body` es el tipo de
la materia física y la procedencia no es una propiedad física. Y `Body` es
además el tipo que el modelo lee para escribir habilidades: cada campo que no es
materia es una cosa más que puede usar mal.

**La limitación honesta, y hay que decirla porque es real:** una obra que NO está
desplegada **no tiene dónde recordar su plano**. Una trampa armada y guardada en
un rincón es, para el sistema, un ensamble como cualquier otro; recién al
desplegarla se sabe de qué revisión salió. Si algún día eso duele —una obra
construida en una partida y heredada a otra, que es el Hito 10— la reparación no
es meterle un campo a `Body`: es que el proyecto de obra sobreviva a la
construcción.

## Lo que se descartó, y por qué

- **Que `place` construya de una.** Es más corto de escribir y contradice lo
  medido. Y esconder once cuerpos y cinco acciones adentro del motor le sacaría a
  la criatura lo que la hace interesante: quedarse a mitad de obra, saber qué le
  falta, e ir a buscarlo.
- **Dos intenciones, una para armar y otra para desplegar.** La de armar tendría
  que justificar qué hace que `aplicar(union)` no haga, y no hay respuesta.
- **La procedencia en el cuerpo construido.** Resuelve el caso de la obra
  guardada en un rincón, al precio que el ADR II-0020 ya rechazó una vez.
- **Deducir la procedencia de la forma.** Cero campos nuevos, y frágil de una
  manera callada: dos planos distintos pueden producir la misma forma, y ahí la
  atribución queda ambigua justo cuando el juez la necesita.

## Consecuencias

- **`Ctx.place` y la intención del mundo cambian de firma**, y el `Blueprint`
  placeholder de `skills/src/tipos.ts` (`{ id, at }`) se va con ellas.
- **`admit()`** sigue siendo la puerta del destino nuevo de `drawFromStock`.
- **Hito 2** revalida hash, snapshot y replay con la tabla adentro.
- **El `BuildSkill` tiene que hallar un ORDEN de uniones**, no ejecutar una lista
  de juntas: `unir` siempre ata la parte 0 con la primera del otro cuerpo, así que
  la forma se consigue eligiendo el orden. Está medido en el tramo C·bis.

## Enlaces

- [Gate 5→6](../gate-5-6-objetos-emergentes.md)
- [ADR II-0020](II-0020-la-captura-vive-en-una-tabla-del-mundo.md) — la tabla donde esto se anota
- [ADR II-0016](II-0016-un-dispositivo-desplegado-retiene-sobre-un-stock.md) — qué es un dispositivo desplegado
- [ADR II-0015](II-0015-el-plano-no-es-el-esquema-de-construccion.md) — las cinco piezas
