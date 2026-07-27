# ADR II-0001 — Encender no es una acción, es una consecuencia

Fecha: 2026-07-26 · Estado: aceptado

## Contexto

El borrador [`t1/encender-solo-cuando-va-a-prender.ts`](../../packages/skills/borradores/t1/encender-solo-cuando-va-a-prender.ts)
quedó a un solo error de compilar, y el error es:

```
Argument of type '"combustion"' is not assignable to parameter of type 'ProcessId'.
```

O sea: un modelo escribiendo una habilidad quiso hacer `ctx.apply('combustion', …)`.
Es la reacción natural — «quiero que esto arda, entonces le aplico combustión» —
y es exactamente la que hay que negar.

El documento de arquitectura enumera once leyes juntas y no separa las que la
criatura **invoca** de las que **corren solas** (HUECO 2). De las once, solo
cuatro traen `roles` + `arrangement` + `effects`: `friccion`, `union`,
`deshilachar` y `extraccion`. Las otras siete son ambiente.

## Decisión

**`combustion` NO entra a `ProcessId`, y no se agrega ninguna primitiva para
encender.**

La criatura puede subir la temperatura de un cuerpo (`friccion`, que sí es
aplicable y le cuesta `stamina`). Que ese cuerpo **prenda** lo decide la ley 3,
cuando `temperature ≥ ignitionPoint` y `moisture` está por debajo del umbral.

Lo que sí puede hacer, y ya compila hoy sin agregar nada, es **saber si va a
prender antes de gastarse**: las tres cualidades que gobiernan la ignición
—`temperature`, `ignitionPoint`, `moisture`— están las tres en `QualityId` y se
leen con `ctx.q()`. La habilidad mira la rama mojada, calcula que no va a
llegar, y no frota. Eso es la capacidad entera del borrador, y no necesitaba
`apply('combustion')` nunca.

## Por qué así y no de otra forma

Se descartó **agregar `combustion` como proceso aplicable con un rol `fuel`**.
Es una línea de código y rompe el principio 2 de la arquitectura: proponer no es
poder. Si `apply('combustion', {fuel: rama})` existe, la criatura **ordena un
desenlace** en vez de **disponer las causas**, y el mundo pasa de árbitro a
ejecutor. Es la misma clase de error que el ADR 0020 de Ánima I cerró para el
crafteo: tener los ingredientes da derecho al intento, no al producto.

Se descartó **un `ctx.wouldIgnite(b): boolean`**. Suena inofensivo y es peor que
`apply`: mete un pedacito de la ley 3 dentro de la superficie, así que el día que
se recalibre el umbral de humedad hay dos lugares que saber. La criatura tiene
las tres magnitudes; que haga la cuenta.

## Consecuencias

**Buenas**

- El repertorio de verbos no crece. Cada proceso aplicable nuevo es superficie
  que hay que documentar, versionar y meter en el prompt.
- La distinción «lo que hago» / «lo que pasa» queda escrita y es enseñable: la
  criatura **prepara condiciones**, el mundo **resuelve**. Es la tesis del
  producto convertida en tipo.
- Encender se vuelve una **técnica** —secar primero, elegir la vara rígida,
  gastar la stamina cuando conviene— y no una llamada. Que es justamente lo que
  el usuario quiere que pueda aprender.

**A tener en cuenta**

- **La separación ambiente/aplicable hay que escribirla en la física, no solo
  acá.** Hoy `AmbientLawId` y `ProcessId` son dos uniones en el `.d.ts` que
  nadie deriva del catálogo. Cuando exista `@anima/process`, `ProcessId` tiene
  que emitirse de las leyes que declaran `roles`, y `AmbientLawId` de las que no.
  Si se mantienen a mano, divergen, y ya sabemos cómo termina eso.
- **Queda un modo de falla nuevo:** una habilidad puede frotar para siempre una
  rama que nunca va a prender porque leyó mal el umbral. El mundo no la va a
  frenar: la va a dejar sin `stamina`. Está bien que así sea, y es trabajo del
  juez, no de la superficie.
