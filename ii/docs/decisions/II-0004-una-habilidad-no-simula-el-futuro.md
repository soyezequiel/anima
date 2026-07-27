# ADR II-0004 — Una habilidad no simula el futuro: lee la tasa

Fecha: 2026-07-26 · Estado: aceptado · Fija la frontera entre el Hito 4
(habilidades) y el Hito 5 (la mente).

## Contexto

El borrador [`t3/comer-ahora-o-esperar-la-coccion.ts`](../../packages/skills/borradores/t3/comer-ahora-o-esperar-la-coccion.ts)
quedó a un solo error: `Property 'project' does not exist on type 'Ctx'`.

La capacidad es honesta y buena: *«tengo hambre ahora; el pescado está crudo y se
está cocinando. ¿Me conviene comerlo ya, o esperar?»* Para contestarla, el modelo
pidió proyectar el estado del mundo hacia adelante.

Es el pedido más peligroso de los veinte, porque es el más razonable.

## Decisión

**No hay `ctx.project`. Una habilidad no puede simular el mundo.**

En su lugar, una lectura pura y mucho más chica:

```ts
/**
 * La tasa instantánea con la que las leyes están moviendo esa cualidad en ese
 * cuerpo, ahora. No simula: lee lo que el motor ya calculó este tick.
 * Cero si ninguna ley la está tocando.
 */
rateOf(b: BodyView, q: QualityId): number
```

Con eso, la capacidad se escribe entera y sin simular:

```ts
const falta   = 0.85 - ctx.q(pescado, 'digestibility')
const tasa    = ctx.rateOf(pescado, 'digestibility')
const esperar = tasa > 0 ? falta / tasa : Infinity   // ticks, si nada cambia
```

«Si nada cambia» es la clave: es una **extrapolación de primer orden**, no una
predicción. Si alguien apaga el fuego, la tasa cambia y la habilidad se entera al
tick siguiente, porque la vuelve a leer. Nunca queda con un futuro viejo en la
mano.

## Por qué así y no de otra forma

Se descartó **`ctx.project(ticks): PerceptionView`** por tres razones, y cada una
alcanzaría sola:

1. **Rompe el aislamiento.** Simular hacia adelante es correr las leyes, y las
   leyes viven en `@anima/process`. Una habilidad que proyecta necesita el motor
   adentro del sandbox. El modelo de amenaza declarado —«código tonto de un
   proveedor de confianza media»— aguanta un generador que emite intenciones; no
   aguanta uno que ejecuta la física.
2. **Rompe el presupuesto.** El tick tiene combustible contado. Proyectar 300
   ticks para decidir si esperar es correr el mundo 300 veces adentro de un tick.
   El principio 1 —el tick no tiene un solo `await`— sobrevive, pero por
   milímetros y sin margen.
3. **Rompe la frontera.** Deliberar sobre futuros es lo que hace `plan()`, en el
   Hito 5, con su presupuesto de 8 ms y su frontera guardada entre ticks. Si las
   habilidades también planifican, hay dos deliberadores con dos presupuestos y
   ninguna autoridad clara. El Hito 5 es el criterio de corte del proyecto: no se
   le puede vaciar el contenido desde el Hito 4.

Se descartó **`ctx.timeUntil(b, q, valor)`**, que es la misma cuenta ya hecha.
Suena más cómodo y esconde el supuesto: quien lo llama no ve que hay un «si nada
cambia» adentro. Con `rateOf`, la división la escribe la habilidad y el supuesto
queda a la vista, que es donde el juez lo puede castigar.

## Consecuencias

**Buenas**

- La frontera queda escrita: **la habilidad lee el presente, el planificador
  razona sobre el futuro.** Es una regla de una línea y decide todas las
  discusiones parecidas que vengan.
- `rateOf` es puro y barato: no simula, lee lo que el motor ya computó.
- Habilita una familia entera de conductas —esperar lo justo, sacar antes de que
  se pase, elegir el sitio donde algo se pudre más lento— sin agregar poder.

**A tener en cuenta**

- **La extrapolación lineal va a mentir**, porque las leyes no son lineales: la
  desnaturalización depende de la temperatura, que a su vez se está moviendo. La
  habilidad va a estimar de más o de menos. **Está bien**: es una criatura
  estimando, no un oráculo, y equivocarse por eso es buen material. Lo que no
  puede pasar es que se cuelgue esperando para siempre; de eso se ocupa el
  presupuesto de la habilidad, no la superficie.
- **`rateOf` filtra la existencia de leyes que la criatura no conoce.** Si una
  ley nueva empieza a mover una cualidad, la tasa lo delata sin que nadie se lo
  cuente. Es una fuente de descubrimiento gratis, y también un canal por el que
  se puede colar información que todavía no se ganó. Vale la pena mirarlo de
  nuevo cuando exista el registro epistemológico (ADR 0084 de Ánima I,
  inventariado para el Hito 10).
