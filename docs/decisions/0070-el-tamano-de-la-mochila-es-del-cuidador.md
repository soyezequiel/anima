# ADR 0070 — El tamaño de la mochila es del cuidador

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

Ánima siempre tuvo un tope de cosas en mano. Vive en el componente de
inventario (`inventory: { items, capacity }`), lo fija `spawnPet` en 6 y lo hace
cumplir `resolvePickup`: con las manos llenas, levantar se rechaza con
`inventory-full`. El número tiene un motivo escrito — una fogata son 3 objetos
en mano más la herramienta que ya lleva, y con 4 juntar ingredientes era estar
soltando cosas todo el tiempo.

El problema no era que faltara la mecánica: era que el número estaba enterrado
en el escenario y **no se veía por ningún lado**. Desde afuera, una mascota que
no levanta un tronco porque no le entra y una que no lo levanta porque no lo
encuentra se comportan igual: se quedan sin hacer lo que se les pidió. El panel
decía «lleva: 4× tabla de ramas» sin decir de cuántas, así que ni siquiera
mirando el inventario se podía deducir cuál de los dos problemas era.

Y para un cuidador que quiere experimentar —¿se las arregla con dos manos?, ¿qué
inventa cuando no le entra lo que necesita?— el único camino era editar
`scenarios.ts` y reiniciar el mundo.

## Decisión

**Una perilla del cuidador**, del mismo linaje que el modo creativo (ADR 0061):
un número que se mueve en Ajustes y cae sobre la mascota viva.

Tres consecuencias que se eligieron a propósito:

**Es del cuidador, no de la mascota.** Sobrevive al guardado, a la muerte y al
reinicio, como el color. La mascota nueva nace con la mochila que se dejó
puesta, no con la del escenario.

**Guarda `null` mientras nadie la toca.** El 6 es del escenario y tiene su
razón; copiarlo a la sesión lo duplicaría, y el día que el escenario cambie de
idea las partidas guardadas seguirían arrastrando el número viejo sin que nadie
lo haya pedido. Ausente significa «las que le dio el mundo».

**Achicar no le tira nada al piso.** Si venía cargada por encima del tope nuevo,
se queda con lo que lleva y deja de poder levantar más hasta que baje sola.
Soltar en su nombre inventaría un montón de objetos en el suelo que ella no
decidió soltar, en un lugar que nadie eligió, y podría romperle el objetivo en
curso. El motor ya se comporta así —compara `items.length >= capacity`—, así que
el exceso se drena solo a medida que fabrica o coloca.

Los topes son 1 y 20. Abajo de 4 fabricar se vuelve un ir y venir, y se permite
igual: estrangular la mochila a propósito es una forma legítima de mirar cómo se
las arregla. Arriba de 20 deja de ser una restricción y el mundo pierde el
problema.

## Y el número se ve

La capacidad viaja al view model (`pet.inventoryCapacity`) y el panel «Ahora»
pasa a decir **«lleva 4/6:»** en vez de «lleva:». Es la mitad más barata de esta
decisión y probablemente la más útil: distingue «no lo junté» de «no me entra»,
que son dos problemas distintos —uno lo arregla el mundo, el otro lo arregla el
cuidador desde Ajustes—.

## Consecuencias

La perilla escribe sobre el componente del motor, no sobre una copia: todo lo
que ya razonaba con la capacidad sigue funcionando sin enterarse. Llega a la
mascota por `perception.self.inventoryCapacity`, y de ahí a la explicación de
«tengo las manos llenas» (`agent.ts`), a las negativas (`refusal.ts`), al reparto
de tandas de obra (`programs.ts`, ADR 0034) y al presupuesto de bloques de una
invención (`invention.ts`).

Quedan dos respaldos `?? 6` escritos a mano —en `programs.ts` y en `codex.ts`—
para cuando el valor no llega. Hoy siempre llega, así que no cambian nada; pero
son un 6 que ya no es EL 6, y si algún día ese camino se corta van a mentir en
silencio.

Un guardado viejo no tiene el campo: se lee como «las del mundo», que es lo que
esas partidas tuvieron siempre.
