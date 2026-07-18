# ADR 0061 — Modo creativo

Fecha: 2026-07-18 · Estado: aceptada

## Contexto

El cuerpo que se vacía es el motor de la autonomía de Ánima: el hambre y el
frío son lo que la hace moverse sin que nadie le pida nada (ADR 0008, 0017).
Está bien que así sea.

Pero convierte cualquier sesión larga de observación en una carrera. En esta
misma sesión de trabajo murió una generación de frío mientras se revisaban
paneles, y varias veces hubo que pausar el mundo para poder inspeccionar algo
sin que se muriera en el medio. Y cuando el cuidador quiere probar una obra
grande —una escuela son cientos de ticks de juntar, fabricar y colocar— el
cuerpo interrumpe todo el tiempo: el frío le gana al encargo (ADR 0048), y con
razón.

Pausar sirve para mirar, pero no para **jugar** mientras se experimenta.

## Decisión

Un **modo creativo**: mientras está encendido, energía, salud y calor se
mantienen al máximo.

**Repone, no desactiva.** El mundo sigue siendo el mundo: el desgaste ocurre,
los eventos de daño y de frío se emiten, y sus reflejos siguen funcionando
—apartarse del fuego sigue siendo una reacción real—. Lo que no llega a pasar
es que la carencia se acumule hasta volverse urgencia. Desactivar el desgaste
en el motor habría sido más invasivo y habría apagado también las reacciones.

**Se repone a los dos lados del paso del mundo.** Antes, porque el mundo emite
`pet.died` *dentro* de `stepWorld` y reponer después no lo desharía: llegando
al paso con el cuerpo lleno, un solo tick no alcanza para matarla. Después,
para que lo que perciba y piense el tick siguiente sea un cuerpo entero.

**El toggle va en la barra, no en Ajustes.** Cambia las reglas del mundo
mientras se juega: tiene que verse encendido de un vistazo, no a dos clics
adentro de un menú.

**Apagado por defecto**, y se guarda con la partida. Encenderlo de fábrica
volvería decorativa la mitad de sus conductas.

## Consecuencias

- Se puede observar, construir y experimentar sin cronómetro.
- Con el cuerpo lleno, los objetivos del cuerpo no nacen: lo que queda son los
  encargos y la curiosidad. Es la intención — pero también significa que en
  modo creativo **no se ve** la parte más autónoma de Ánima. Es un modo para
  mirar otra cosa, no un modo mejor.
- Límite conocido: un solo tick que quite más vida que el máximo la mataría
  igual. Con los peligros actuales (daño de 1 a 4 por tick contra 10 de salud)
  no puede pasar; si algún día existe algo más letal, habrá que decidir si el
  modo también debe blindar la muerte o solo el desgaste.

## Nota de método

La primera prueba del modo usaba un fuego en su propia celda, y **pasaba con y
sin el arreglo**: Ánima se aparta del fuego sola, así que sobrevivía de todos
modos. No probaba nada.

La que quedó usa el frío —que sí mata sin escapatoria— y corre el mismo
escenario **dos veces**, con el modo y sin él, exigiendo que muera en uno y
sobreviva en el otro. Una prueba que se valida a sí misma: si el modo dejara de
hacer efecto, falla sin necesidad de recordar revertir nada.
