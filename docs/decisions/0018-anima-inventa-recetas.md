# ADR 0018 — Ánima inventa recetas, y el mundo decide si son posibles

Fecha: 2026-07-16 · Estado: aceptada · Paso 3 del plan de crafteo

## Contexto

Hasta ahora las recetas las escribíamos nosotros. El paso 3 del roadmap era
que la mascota compusiera objetos nuevos con los componentes que ya existen,
"validados y evaluados como las skills". El pedido del dueño fue directo: que
Ánima pueda crear las recetas.

Es el poder más peligroso que se le puede dar. Si pudiera declarar cualquier
física, resolvería cualquier problema declarándolo resuelto: tengo hambre,
invento que la madera alimenta. Sería el equivalente físico de aprobarse su
propio examen — exactamente lo que el proyecto evita desde el ADR 0003 (el
generador nunca juzga sus propias skills) y el ADR 0016 (el contrato lo mide
otro).

## Decisión

**Proponer no es poder.** El mismo trato que con los programas y los
contratos, aplicado a la materia:

- El modelo propone (`recipe.propose`); la receta viaja **cruda**, sin tipar.
- El agente no la añade a nada: emite la intención `proposeRecipe`. El agente
  nunca toca el `WorldState`, tampoco para inventar.
- **El mundo valida y decide** (`validateRecipe` en sim-core, llamada desde
  `step.ts`). No hay ningún camino a `world.recipes` que se salte la puerta.
- Un rechazo lleva el motivo, se recuerda y viaja al siguiente intento: la
  mascota corrige en vez de insistir. Tope de 3 intentos.

### Qué comprueba la puerta

Lo que **no** juzga: si la receta es útil. Eso lo dirá el mundo cuando intente
usarla, y el evaluador cuando una habilidad la aproveche. Lo que juzga es si
es coherente con la física:

1. **Catálogo cerrado de componentes.** Lo que queda afuera importa más que lo
   que está adentro: `edible`, `nutrition` y `foodSource` no existen para una
   receta inventada. **La mascota no puede inventar comida.** Si pudiera, el
   hambre —el motor de toda su historia— se resolvería declarando que la
   madera alimenta. Tampoco `agent` (no crea criaturas), ni `energy`/`health`/
   `temperature` (son propiedades de un cuerpo vivo, no de un objeto).
2. **Inventar da capacidades, no recursos.** Es la misma línea del ADR 0008:
   fabricar una skill no crea comida; inventar una receta, tampoco. Puede
   inventar el fuego —eso es una capacidad aplicada a materiales que tiene—
   pero no la materia.
3. **No crea materia.** Algo no puede ser ingrediente de sí mismo (1 tronco →
   2 troncos sería duplicación), y no puede dejar al romperse más objetos de
   los que costó (construir y romper en bucle fabricaría troncos de la nada).
4. **No inventa poderes que su mundo no tiene.** Los valores van acotados:
   `tool.power ≤ 8` (el martillo, la mejor herramienta que existe),
   `hazard ≤ 3`, `heatSource.warmthPerTick ≤ 1`.
5. **Tipos protegidos**: `food`, `tree`, `pet` no se fabrican ni se dejan caer,
   con ningún nombre de receta.
6. **Higiene**: sin ingredientes no hay receta; algo sin componentes es
   decoración inerte y se rechaza; no se pisan recetas existentes; tope de
   `MAX_INVENTED_RECIPES` por mundo, porque inventar no puede ser spam.

### El mock inventa mal a propósito

Coherente con el ADR 0006 (el mock es deliberadamente imperfecto): su primer
impulso ante cualquier problema es **inventar comida** — el atajo. El mundo lo
rechaza, y solo entonces propone algo honesto: quemar troncos para dar calor.
La historia del rechazo que enseña se puede contar **sin claves de IA**.

### `zod` entra a sim-core

La puerta tiene que ser completa: los tipos de TypeScript no son garantías en
runtime cuando el dato viene de un modelo. Es el mismo uso que `skill-runtime`
le da a `zod` (`validateSkillProgram`), para el mismo problema.

## Consecuencias

- Ánima puede resolver problemas con objetos que nadie escribió, y el saber
  que existen queda en su memoria (`puedo construir X`) y viaja a su sucesora.
- La receta vive en el mundo (viaja en los snapshots); el saber que existe,
  en su memoria. Son cosas distintas a propósito.
- Inventar cuesta: una consulta al modelo por intento. Es deliberado, como
  aprender (ADR 0016).

## Hallazgo abierto: los troncos son inconseguibles

Verificando en el navegador apareció una tensión que no había previsto. El
árbol es talable (ADR 0015) y deja troncos, pero `evaluateUserRequest`
clasifica talarlo como `will_not`:

> **Tú:** tala el árbol
> **Ánima:** No quiero destruir árbol: creo que lo necesito para recuperar
> energía.

La negativa es **correcta y valiosa** —valora su fuente de comida por encima de
una orden, que es justo lo que el ADR 0008 quería— pero en el mundo jugable
deja los troncos fuera de alcance: la silla se puede pedir y nunca construir.
Las opciones (decisión de producto, no técnica):

1. Que el árbol produzca ramas caídas cada tanto: troncos sin matar la fuente.
2. Que la negativa sea revisable: insistir, o explicarle que hay otro árbol.
3. Que acepte talar si su energía está alta y ve comida suficiente.
4. Dejarlo: que los troncos solo existan en los mundos fríos, donde el árbol
   no es su única comida.

La 1 es la que más me convence: no discute su valor, le da otra vía.
