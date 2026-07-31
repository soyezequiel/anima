# II-0018 — El catálogo es core inmutable más overlay por sesión, y el planificador recibe una vista

**Estado:** aceptado · **Decide:** el usuario, sobre el
[Gate 5→6](../gate-5-6-objetos-emergentes.md) · **Fecha:** 2026-07-31

## El problema

Hoy lo que la criatura sabe hacer vive en **una constante de módulo**:

```ts
export const SCHEMA_INDEX: ReadonlyMap<PredicateSignature, readonly ConstructionSchema[]> =
  construirIndice(ESQUEMAS)                        // plan/src/esquemas.ts:1475
```

Eso es correcto mientras el catálogo lo escriban humanos y no cambie nunca en
vivo. Deja de serlo el día que la fragua registre algo: **un `Map` de módulo lo
comparten todas las partidas del proceso**, y dos sesiones abiertas se
contaminarían sin que nada lo note.

El estado medido, que es lo que decide el alcance del trabajo:

- **`plan()` ya tiene la costura.** `OpcionesDePlan.esquemas` reemplaza la tabla
  entera y la regresión la propaga: `const todos = opciones?.esquemas ?? ESQUEMAS`
  (`plan/src/regresion.ts:2133`). Está escrita para preguntas de laboratorio, pero
  es entrada pública y hay guardas que la tratan como tal.
- **La mente no la usa.** `escalera.ts:1429` llama `plan(g, v, presupuesto, e.frontera)`,
  sin opciones.
- **Y además precalcula.** `mind/src/oportunidades.ts` arma `LO_QUE_CUESTA_ESTABLECER`
  recorriendo `SCHEMA_INDEX` **al cargar el módulo**, y el comentario lo dice:
  «se calcula al cargar y no por tick porque `SCHEMA_INDEX` es una constante de
  `@anima/plan`». Esa frase deja de ser cierta con overlay.

## La decisión

**Tres capas, sin ningún `Map` global mutable compartido por partidas:**

```
catálogo core inmutable        lo que viene con el juego
  + biblioteca adoptada        lo promovido, que sobrevive a la partida
    + overlay de la sesión     lo de esta partida, versionado y aislado
```

**El planificador recibe una vista explícita:**

```ts
PlannerCatalogView {
  coreSchemas
  buildCapabilities
  skillCapabilities
  catalogEpoch
  registryDigest
}
```

**Una frontera creada con otro `catalogEpoch` se descarta y se replantea.** Es la
misma disciplina del ADR II-0012: una frontera guardada es una promesa sobre un
catálogo, y si el catálogo cambió la promesa venció. Reusarla daría planes que
mezclan dos mundos de capacidades, y son irreproducibles — que es peor que ser
lentos.

**Obligación de compatibilidad, y es lo único que toca al Hito 5:** el
planificador y la mente deben poder recibir en el futuro esa vista. **No debe
consolidarse una dependencia irreversible de un singleton global.** Concretamente:
no se agregan lectores nuevos de `SCHEMA_INDEX` en tiempo de carga. Cerrar el
Hito 5 **no** exige refactorizar la mente; llevar la vista hasta ella es deuda del
gate.

## Lo que se descartó, y por qué

- **Mutar `SCHEMA_INDEX` con un `Map` mutable.** Es el punto 4 del criterio del
  gate escrito al revés: dos partidas se contaminan y el bug aparece como un plan
  que sale distinto según qué pestaña se abrió primero.
- **Un registry global con namespace por sesión.** Sigue siendo un solo objeto
  vivo, con el mismo modo de falla y una clave más para equivocarse.
- **Copiar el catálogo entero por partida.** Correcto y caro: el core es
  inmutable justamente para poder compartirse sin copiar.
- **Invalidar la frontera por cualquier cambio del mundo.** Demasiado: la frontera
  sobrevive a que el paisaje cambie —`plan()` resuelve los `Ref` contra la vista
  de cada expansión—. Lo que la mata es que cambie **el catálogo**, que es otra
  cosa.

## Consecuencias

- El criterio del gate mide esto en cuatro de sus doce puntos: overlay aislado
  (2), publicación de capacidades (3), sin mutación global (4) y dos partidas no
  se contaminan (7).
- El Hito 8 aplica los parches **en frontera de tick**, contra un **digest base
  esperado**, y **rechaza si el catálogo cambió**.
- El Hito 10 guarda un **journal de catálogo** con el **manifiesto exacto del
  registry**, y la herencia entra como **provisional** con **revalidación
  perezosa**.
- El Hito 11 mide **el costo del registry** y **el crecimiento del planner**: el
  precalculado de la mente existe porque parsear firmas por candidato y por tick
  era caro, y con overlay hay que re-medirlo.

## Enlaces

- [Gate 5→6](../gate-5-6-objetos-emergentes.md)
- [ADR II-0012](II-0012-el-presupuesto-del-plan-se-mide-en-expansiones.md) — de dónde sale la frontera que acá se invalida
- [ADR II-0015](II-0015-el-plano-no-es-el-esquema-de-construccion.md) — qué se registra en el overlay
- ADR 0076 de Ánima I — el catálogo es del cuidador, y sobrevive al mundo
- ADR 0086 de Ánima I — lo que sabe hacer es un catálogo, y el plan es de ahora
