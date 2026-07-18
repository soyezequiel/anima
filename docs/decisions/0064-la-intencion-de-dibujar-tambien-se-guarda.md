# ADR 0064 — La intención de dibujar también se guarda

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Después del ADR 0063 —que adelantó el dibujo de lo que tiene a la vista— el
cuidador recargó la página y siguió sin ver el sprite nuevo.

El estado real de su partida lo explicaba solo:

```
dibujados: []                       ← el mundo NO tenía ni un dibujo
recetas:   muro-escuela, pizarra-escuela   ← inventadas, sin cara
agente:    goals, progress, memory, events, places, structureSites
                                    ← NO estaba pendingGlyphs
```

`pendingGlyphs` era la única cola del agente que vivía **solo en memoria**. Se
llenaba en un instante muy preciso —cuando el mundo acepta una receta que ella
inventó— y ese instante no vuelve. Recargar la página la vaciaba, y con ella se
perdía para siempre la intención de dibujar esos tipos: nadie los volvía a
proponer nunca.

El ADR 0063 estaba bien y no alcanzaba: adelantó *cuándo* dibuja, pero la lista
de *qué* dibujar ya estaba vacía.

Hay un segundo caso con la misma forma: un mundo **heredado**. La sucesora nace
con las recetas que inventó su antecesora (`inheritWorldRules`), pero sin su
cola: hereda el conocimiento y no la deuda de dibujarlo.

## Decisión

**1. La cola se persiste** con el resto del estado del agente. Los guardados
viejos cargan como cola vacía, como todo lo demás que se agregó después.

**2. La cola se rearma al cargar**, desde el mundo: todo tipo producido por una
receta **inventada** que todavía no tiene dibujo vuelve a entrar.

Quién es «inventado» lo sabe la app y no el motor —la diferencia es estar o no
en `MVP_RECIPES`—, así que la app se lo pasa al agente
(`requestGlyphsFor`) en vez de que el agente lo adivine. Sin esa distinción
habría que elegir entre no dibujar nada o redibujar también la fogata y la
silla, que ya tienen su apariencia hecha a mano.

Las dos mitades son necesarias: la primera evita que se vuelva a perder, la
segunda recupera lo ya perdido.

## Consecuencias

- Una partida vieja recupera sus dibujos pendientes al abrirse. Verificado
  contra la partida real del cuidador: de cero dibujos a `muro-escuela` al
  recargar y `pizarra-escuela` medio minuto después.
- Un mundo heredado dibuja lo que su antecesora dejó sin cara.
- Rearmar mira el mundo y no la memoria: si un dibujo se aceptó, el tipo no
  vuelve a la cola. El estado del mundo manda sobre la intención guardada, que
  es la misma regla que ya usaba `drawSomethingNew` al saltear lo ya dibujado.

## Nota de método

El diagnóstico salió de leer el guardado en vivo antes de tocar el código. Las
dos pistas estaban ahí, juntas: `dibujados: []` decía que el problema era más
viejo que el ADR 0063, y la lista de claves del agente —sin `pendingGlyphs`—
decía exactamente por qué.
