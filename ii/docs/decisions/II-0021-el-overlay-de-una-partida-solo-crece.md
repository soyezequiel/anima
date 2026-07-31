# II-0021 — El overlay de una partida sólo crece: revocar es entre partidas

**Estado:** aceptado · **Decide:** el usuario, sobre el
[Gate 5→6](../gate-5-6-objetos-emergentes.md) · **Fecha:** 2026-07-31

Refina el [ADR II-0018](II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md) y
contesta la pregunta 5 de la sección 10 del gate: **«¿qué invalida el
`catalogEpoch`, exactamente? Promover invalida; ¿revocar también?, ¿adoptar de una
herencia?»**

## El problema

La pregunta parecía ser sobre el `catalogEpoch` y no lo era. Desde el tramo A el
epoch **se deriva del contenido**, así que cualquier operación que cambie las
filas lo cambia sola: no hay una lista de «operaciones que invalidan» que alguien
pueda olvidarse de actualizar.

Lo que queda por decidir es lo de abajo: **¿qué operaciones existen?** Y en
concreto, **¿el overlay de una partida puede SACAR filas, o sólo agregar?**

Hoy `conOverlay` sólo agrega, y eso no fue una decisión — fue lo único que hacía
falta para el tramo A.

## La decisión

**Dentro de una partida, el catálogo sólo crece. Revocar existe, pero entre
partidas.**

- **promover** —adoptar algo a la biblioteca— agrega, y cambia el epoch;
- **heredar** —una vida nueva que arranca con lo que la anterior aprendió—
  agrega al armar la partida, y cambia el epoch;
- **revocar** —el juez baja de categoría algo que resultó malo— **no saca nada de
  la partida en curso**. La partida siguiente no lo trae.

## Por qué

**Porque nada que un plan esté usando puede desaparecerle abajo.** El tramo B ya
resolvió la mitad barata: una búsqueda a medio hacer se descarta sola cuando el
catálogo cambia, porque la frontera lleva su `catalogEpoch`. Pero la mitad cara es
otra: **un plan YA ADOPTADO, con pasos en vuelo**, cuyo esquema deja de existir a
mitad de camino. Eso pide un portón nuevo —qué hace la criatura cuando el paso 4
de 7 se quedó sin fila— y ése es trabajo aparte, con su propia decisión adentro.

Y hay una segunda razón, más silenciosa: **el núcleo nunca encoge, y de eso
depende un atajo que ya está tomado.** `creencias.ts` lee el core directamente
para sacar los umbrales de los cinco rasgos, y eso es correcto porque un overlay
agrega y no pisa. Si el overlay pudiera sacar, ese razonamiento se cae y las
claves de la memoria de afordancias vuelven a estar en discusión.

## Lo que se descartó, y por qué

- **Agregar y sacar en vivo.** Es más potente y abre el caso de los pasos en
  vuelo, que hoy no tiene respuesta. No se descartó por mala: se pospuso, y el día
  que se retome lo que hay que escribir primero es qué hace un plan cuyo esquema
  se evaporó.
- **Una lista explícita de «operaciones que invalidan el epoch».** Sería una
  segunda fuente de verdad al lado del contenido, y de las dos, la que se
  desactualiza es siempre la lista.

## Consecuencias

- **`conOverlay` sigue siendo lo que es**, y ahora por decisión y no por omisión.
- **No hace falta un portón de «plan huérfano»** para el gate. Cuando revocar en
  vivo entre, ese portón es su primer requisito.
- **El atajo de `creencias.ts` queda sostenido por escrito**, no por casualidad.
- **Heredar arma el overlay al empezar la partida**, no en el medio: es un caso
  de construcción, no de mutación.

## Enlaces

- [Gate 5→6](../gate-5-6-objetos-emergentes.md)
- [ADR II-0018](II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md) — el que esto refina
- [ADR II-0012](II-0012-el-presupuesto-del-plan-va-en-expansiones.md) — la disciplina que el tramo B le copió a la frontera
