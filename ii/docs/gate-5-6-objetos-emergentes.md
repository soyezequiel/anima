# Gate 5→6 — objetos emergentes dentro de una física fija

> **Nombre provisorio.** También se lo puede llamar «extensión técnica posterior
> al Hito 5». Se le puso número de puerta y no de hito para que quede dicho de
> entrada lo que es: **no reabre el Hito 5**, va después.

Este documento es el criterio de esa puerta. Vive al lado de los documentos de
hito y se lee junto con [`continuar-aca.md`](continuar-aca.md), que sigue siendo
la memoria operativa.

---

## 0 · Lo primero, porque es lo que más fácil se malinterpreta

**El Hito 5 termina con el alcance que tiene hoy.** Está aproximadamente al 80%
implementado y su criterio de cierre —los seis puntos del documento de
arquitectura, con su veredicto publicado de **3 que cumplen y 3 en rojo
aceptado**— **no se amplía con nada de lo que hay acá abajo**. Ni planos, ni
persistencia de catálogo, ni dispositivos autónomos, ni descriptor visual.

Lo único que el Hito 5 debe cuidar antes de cerrar es **una costura de
compatibilidad**, y está en la sección 6: el planificador y la mente no pueden
quedar atados de forma irreversible a un catálogo global imposible de
reemplazar. Si la costura ya existe, se documenta. Si falta, **es deuda del
gate, no motivo para rehacer el 80% ya hecho**.

El orden obligatorio del proyecto queda así:

```
terminar el Hito 5 actual
  → Gate técnico de objetos emergentes   ← este documento
    → Hitos 6–11
      → Hito 12 (UI presentable)
        → Hitos post-UI de física abierta (13–16)
```

Los hitos históricos **no se renumeran todavía**. El gate se numera 5→6 y no 5·bis
para no ensuciar la numeración que ya viajó a treinta documentos.

---

## 1 · Qué se decidió, y no se vuelve a preguntar

Trece decisiones de producto, tomadas por el usuario. Están acá para que ninguna
sesión nueva las reabra.

1. **Antes de la UI**, Ánima puede inventar objetos y habilidades **dentro de una
   física fija escrita por humanos**.
2. El caso de aceptación es **«fabricá una trampa para peces»**.
3. La trampa **no está precargada**.
4. Es un **dispositivo autónomo desplegado sobre un `Stock`**.
5. La criatura la puede dejar, alejarse, volver y **retirar la captura**.
6. Los peces **no se mueven físicamente** en esta primera versión.
7. La captura es **estado autoritativo almacenado**, no contención geométrica.
8. **No puede existir** un `kind`, receta, skill ni caso especial llamado
   `fish-trap`, `trampa-para-peces` ni equivalente en producción.
9. La **física genérica** de despliegue, retención e interacción con stocks la
   **escriben humanos**.
10. Ánima inventa **el plano, los materiales, la construcción y el uso**.
11. La **UI se construye después del Hito 11**.
12. Después de la UI empieza la ampliación de la física para acercarse a «crear
    cualquier objeto».
13. Las **skins generadas con IA quedan fuera de Ánima II 1.0**.

El punto 8 es el que hace que el caso valga como prueba. Un `kind` con ese nombre
convierte la demo en una tabla de recetas con otro disfraz, que es exactamente lo
que el remake existe para matar (ver `PROTECTED_KINDS` y `vocabulary.ts` en la
tabla «se tira» del documento de arquitectura).

---

## 2 · El modelo de planos: cinco piezas, y ninguna es las otras

**`BlueprintCandidate` no se inserta en `SCHEMA_INDEX`.** Ésa es la regla, y de
ella sale el resto. El detalle está en el
[ADR II-0015](decisions/II-0015-el-plano-no-es-el-esquema-de-construccion.md).

| pieza | qué es | quién la juzga |
|---|---|---|
| `BlueprintCandidate` | **propuesta no confiable**. Lo que sale de la fragua | cuarentena |
| `BlueprintDefinition` | estructura **canónica, inmutable y versionada**. **No contiene el sitio** | el juez, por su cuenta |
| `ConstructionSchema` | la **causalidad física**: procesos y leyes que llevan de la materia al efecto | el juez, por su cuenta |
| `BuildSkill` | construye **una revisión exacta** | el juez, por su cuenta |
| `UseSkill` | **usa la obra** y demuestra su función | el juez, por su cuenta |

**La definición, la construcción y el uso se juzgan y se promueven por
separado.** Un plano correcto con un `BuildSkill` roto no promueve la
construcción; un `BuildSkill` que levanta la obra no acredita que la obra sirva.
**Construir algo no demuestra que funcione**, y ésa es la mitad del Hito 7 que
hoy no existe.

Que el `BlueprintDefinition` **no contenga el sitio** es lo que permite que una
misma definición se levante en dos lugares y que dos partidas compartan la
revisión sin compartir el mundo. El sitio es del **proyecto de obra**, y es el
ADR 0049 de Ánima I portado («la obra tiene un sitio, y se ve antes de existir»).

---

## 3 · El catálogo: tres capas, ningún `Map` global mutable

```
catálogo core inmutable          lo que viene con el juego
    + biblioteca adoptada        lo promovido, que sobrevive a la partida
      + overlay de la sesión     lo de esta partida, versionado y aislado
```

**No debe existir un `Map` global mutable compartido por partidas.** El detalle
está en el
[ADR II-0018](decisions/II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md).

El planificador recibe una vista explícita, con esta forma:

```ts
PlannerCatalogView {
  coreSchemas        // el catálogo inmutable
  buildCapabilities  // qué se sabe construir
  skillCapabilities  // qué se sabe usar
  catalogEpoch       // cambia cuando el catálogo cambia
  registryDigest     // el manifiesto exacto de lo registrado
}
```

**Una frontera creada con otro `catalogEpoch` se descarta y se replantea.** Es la
misma disciplina que el ADR II-0012 le puso al presupuesto anytime: una frontera
guardada es una promesa sobre un catálogo, y si el catálogo cambió, la promesa
venció. Reusarla daría planes que mezclan dos mundos de capacidades y son
irreproducibles.

---

## 4 · El criterio del gate: doce puntos, con un candidato fijo

Se demuestra **con un candidato de plano fijo** —el mismo archivo, sin proveedor—
para que el criterio corra en CI y no dependa de que el modelo tenga un buen día.

| # | qué hay que demostrar |
|---|---|
| 1 | `BlueprintDefinition` **canónico y versionado** |
| 2 | registro en un **overlay aislado por sesión** |
| 3 | **publicación de capacidades** al planificador |
| 4 | **ausencia de mutación global** de `SCHEMA_INDEX` |
| 5 | construcción **incremental e idempotente** |
| 6 | **separación entre construir y usar** |
| 7 | **dos partidas no se contaminan** |
| 8 | guardar y restaurar **conserva la revisión exacta** |
| 9 | un **cambio de física invalida** los sellos correspondientes |
| 10 | el **mismo journal produce el mismo mundo y el mismo catálogo** |
| 11 | existe un **descriptor visual procedural determinista** |
| 12 | **no hay nombres especiales** para la trampa en producción |

El punto 12 se verifica como se verifica hoy el test de emergencia del Hito 1:
grepeando el código de producción. Si la palabra está, el criterio falla, aunque
todo lo demás pase.

### Estado de los doce, medido el 2026-07-31 (tramo A)

| # | estado | dónde se mide |
|---|---|---|
| 1 `BlueprintDefinition` canónico | **no empezado** — el tipo no existe | — |
| 2 overlay aislado por sesión | **CUMPLE** | `plan/tests/el-catalogo-es-una-vista.test.ts`, bloque (2) |
| 3 publicación de capacidades | **CUMPLE** para esquemas; falta para planos | ídem, bloque (3) |
| 4 sin mutación global | **CUMPLE**, con guardián de texto en los DOS paquetes | ídem, bloque (4) + `mind/tests/el-catalogo-llega-a-la-mente.test.ts` |
| 5 construcción incremental | **no empezado** | — |
| 6 separar construir de usar | **la mitad**: `CatalogCapability.clase` los separa en el dato; nadie los juzga todavía | `plan/src/catalogo.ts` |
| 7 dos partidas no se contaminan | **CUMPLE** | `el-catalogo-es-una-vista`, bloque (7) |
| 8 guardar y restaurar | **no empezado**; `registryDigest` es la pieza que lo va a comparar | — |
| 9 cambio de física invalida sellos | **no empezado** | — |
| 10 mismo journal, mismo catálogo | **no empezado** | — |
| 11 descriptor visual | **no empezado** | — |
| 12 sin nombres especiales | **no aplica todavía**: no hay trampa | — |

**Van 3 de 12 cumpliendo y 1 a medias**, y los tres que cumplen son exactamente
los que no dependen de que exista `BlueprintDefinition`. Lo que el tramo A cerró
es **la deuda 1** —la costura del catálogo hasta la mente, sección 6— y con eso
el planificador y la mente dejaron de estar atados a un singleton.

---

## 5 · Lo que ya existe y lo que falta, verificado contra el código

Medido sobre el árbol de la rama `anima-2`, leyendo las fuentes. Sirve para que
nadie planifique contra una superficie imaginada.

| pieza | estado hoy | dónde |
|---|---|---|
| `Blueprint` | **placeholder de dos campos**: `{ id, at }` | `skills/src/tipos.ts:308` |
| la intención `place` | **existe y el mundo la rechaza** con `'no-implementado'` | `world/src/step.ts:3059` |
| `SCHEMA_INDEX` | `ReadonlyMap` **constante de módulo**, derivada de `ESQUEMAS` | `plan/src/esquemas.ts:1475` |
| inyección en `plan()` | **la costura EXISTE**: `opciones.esquemas` reemplaza la tabla entera | `plan/src/regresion.ts:2133` |
| inyección desde la mente | **NO existe**: la escalera llama `plan(g, v, presupuesto, e.frontera)` sin opciones | `mind/src/escalera.ts:1429` |
| el precio de cada esquema en la mente | **se calcula al CARGAR el módulo** desde `SCHEMA_INDEX` | `mind/src/oportunidades.ts` (`LO_QUE_CUESTA_ESTABLECER`) |

> **CORRECCIÓN, re-medida contra el código el 2026-07-31: la mente no lee el
> catálogo global en UN sitio. Son CUATRO, en TRES archivos, y tres de los cuatro
> corren al CARGAR EL MÓDULO.** La fila de arriba nombraba sólo el precalculado de
> `oportunidades.ts` y con eso la deuda 1 parecía la mitad de lo que es. El barrido
> completo, `grep` de `SCHEMA_INDEX|ESQUEMAS` sobre los ocho `src/`:
>
> | sitio | qué lee | cuándo | qué pasa si el catálogo cambia |
> |---|---|---|---|
> | `mind/src/escalera.ts:204` `LO_QUE_SE_SABE_ESTABLECER` | recorre `ESQUEMAS` e interpreta cada `establishes` | **al cargar** | el veto de metas imposibles (`sinVocabulario`) juzga contra la tabla vieja |
> | `mind/src/escalera.ts:228` `HAY_ESTABLECIDAS_QUE_NO_SE_LEEN` | deriva del anterior | **al cargar** | el interruptor conservador se calcula una vez y no se recalcula |
> | `mind/src/oportunidades.ts:697` `LO_QUE_CUESTA_ESTABLECER` | recorre `SCHEMA_INDEX` con precios | **al cargar** | los precios son los del catálogo core, sin el overlay |
> | `mind/src/creencias.ts:239` `delEsquema('catch>0','binder','flexibility')` | busca en `ESQUEMAS` | **al cargar**, dentro del `const RASGOS` | nada: **lee el CORE, y está bien** — ver abajo |
>
> Y un quinto que NO es de carga y por eso va aparte: `oportunidades.ts:454`
> (`alientoDeConseguir`) hace `SCHEMA_INDEX.get(metaDe(tag))` por llamada. Ése se
> desata pasándole la vista; los tres primeros piden dejar de ser constantes de
> módulo.
>
> **`creencias.ts` NO es deuda, y decirlo ahorra un refactor caro.** El primer
> impulso es tratarlo como los otros tres, y sería un error: los cinco rasgos son
> las preguntas que la criatura le hace a un cuerpo, y sus umbrales salen del
> **core**, que es inmutable por definición. Un overlay AGREGA capacidades, no
> reemplaza filas —`esquemasDe` concatena, no pisa— así que la fila de `catch>0`
> que `delEsquema` busca no se puede ir. Y hacerlo seguir al epoch tendría un
> precio que nadie quiere pagar: `CUANTAS_FORMAS` y `SIN_CUERPO` se derivan de
> `RASGOS.length`, o sea que **las claves de contexto de la memoria de afordancias
> pasarían a depender del catálogo**, y todo lo aprendido antes de un registro
> quedaría en cubetas que ya no nombran nada. Lo único que cambia acá es de dónde
> lo lee: por la vista del core y no por la constante suelta, para que el guardián
> de «no hay una segunda puerta» pueda cubrir también `@anima/mind`.
>
> **Lo que NO cambió al re-medir, y es la buena noticia:** la costura de `plan()`
> es real. `esquemasPara()` —la única función que lee `SCHEMA_INDEX` adentro de
> `@anima/plan`— **no la usa nadie de producción, sólo un test**, y la regresión
> recorre `todos` (`opciones?.esquemas ?? ESQUEMAS`) de punta a punta. O sea que la
> inyección no tiene una segunda puerta por la que se cuele la tabla global.
| `Stock` | existe, con población, reposición y presupuesto calórico por chunk | `oracle/src/ley.ts`, `oracle/src/extraccion.ts` |
| el banco de peces | es una **proyección del `Stock`**, reescrita todos los ticks | `world/src/step.ts:3304` |
| sacar de un stock | `Yield.drawFromStock` con `into: 'hands' \| 'ground-adjacent'` | `physics/src/process.ts:75` |
| `extraccion` | roles `gear` y `source`. **No declara `actor`** | `physics/src/process.ts:365` |
| `catch` | cualidad **derivada** de `freeStrandEnds` y `sharpness` | `physics/src/quality.ts:317` |
| `inside` / `covering` | `inside` se evalúa como `covering !== undefined \|\| heldBy` | `world/src/step.ts:2381` |
| cotas del ensamble | `MAX_PARTS = 6`, `MAX_JOINTS = 8`, `MAX_ASSEMBLY_DEPTH = 3` | `physics/src/body.ts:24` |
| `physicsVersion` | existe y `admit()` invalida sellos contra ella | `physics/src/admit.ts:2094` |
| descriptor visual | **no existe nada**: cero apariciones de `renderDescriptor` en `ii/` | — |
| `catalogEpoch` / `registryDigest` / `PlannerCatalogView` | **no existen** | — |

**Los tres huecos que definen el trabajo del gate**, y ninguno es «que el modelo
sea más listo»:

1. **La retención pasiva no existe.** `extraccion` no declara `actor`, pero
   `drawFromStock` sólo sabe entregar `into: 'hands' | 'ground-adjacent'`: lo que
   sale del pozo va a las manos de alguien o al piso de al lado. Un dispositivo
   que retiene lo capturado necesita un destino más, y **es física genérica que
   escriben humanos** (decisión 9).
2. **Nada corre sin una intención.** Los procesos avanzan porque un actor emitió
   `apply`. Un dispositivo desplegado tiene que progresar **sin nadie**, y eso
   pide estado en el mundo (desplegado, stock asociado, próximo intento, captura
   almacenada) con **orden determinista entre dispositivos** y consumo de RNG
   reproducible.
3. **La mente está atada al catálogo de módulo.** `plan()` ya acepta una tabla
   inyectada; la mente no se la pasa y además precalcula precios desde
   `SCHEMA_INDEX` en tiempo de carga. Es la deuda de la sección 6.

---

## 6 · La costura de compatibilidad, que es lo ÚNICO que toca el Hito 5

**Obligación, escrita como obligación y no como sugerencia:** el planificador y
la mente deben poder recibir en el futuro **una vista explícita del catálogo**.
No debe consolidarse una dependencia irreversible de un singleton global.

Estado medido, y son dos mitades con veredicto distinto:

- **`plan()` ya tiene la costura.** `OpcionesDePlan.esquemas` reemplaza la tabla
  entera y la regresión la propaga (`const todos = opciones?.esquemas ?? ESQUEMAS`).
  Está escrita para preguntas de laboratorio —«¿el orden cambia el plan?», «¿qué
  `gap` sale sin esta fila?»— y **eso alcanza como punto de entrada**: es entrada
  pública y hay guardas que la tratan como tal.
- **La mente NO la usa, y además precalcula.** `escalera.ts` llama a `plan()` sin
  opciones, y `oportunidades.ts` arma `LO_QUE_CUESTA_ESTABLECER` recorriendo
  `SCHEMA_INDEX` **al cargar el módulo**, con el comentario que lo justifica:
  «se calcula al cargar y no por tick porque `SCHEMA_INDEX` es una constante de
  `@anima/plan`». Esa frase deja de ser cierta el día que exista un overlay.

**Qué hace el Hito 5 con esto: nada, salvo no empeorarlo.** No hay que refactorizar
la mente para cerrar el hito. Lo que hay que evitar es agregar **más** lectores de
`SCHEMA_INDEX` en tiempo de carga, porque cada uno es otro sitio que el gate va a
tener que desatar.

**Qué hace el gate con esto:** convertir esa costura en `PlannerCatalogView`,
llevarla hasta la mente, y volver el precalculado una función del `catalogEpoch`
en vez de una constante de módulo. Es la deuda 1 del gate y está estimada abajo.

### HECHO — tramo A, 2026-07-31. La deuda 1 está pagada

Verde y verificado: `pnpm ii:test` **exit 0** (2506 tests, +1 skipped, +1 todo) y
`pnpm ii:typecheck` **exit 0**. Lo que quedó:

| pieza | dónde |
|---|---|
| `PlannerCatalogView`, `CatalogCapability`, `catalogoDe`, `conOverlay`, `esquemasDe` | `plan/src/catalogo.ts` (nuevo) |
| `plan()` resuelve el catálogo en UN solo lugar; `CATALOGO_CORE` es el default | `plan/src/regresion.ts` |
| `MenteOptions.catalogo`, por omisión `CATALOGO_CORE` | `mind/src/tipos.ts` |
| la escalera se lo pasa a `plan()` y a D3 | `mind/src/escalera.ts` |
| los tres precalculados de la mente siguen al `catalogEpoch` | `mind/src/catalogo.ts` (`porEpoch`) |

**Tres cosas que este tramo decidió y no estaban en el documento:**

1. **`catalogEpoch` se deriva del CONTENIDO, no es un contador.** Un contador
   pone a dos sesiones distintas en el epoch 1 con catálogos que no tienen nada
   que ver, y el día que un estado guardado cruce de una a la otra la comparación
   dice «es el mismo catálogo». Se pierde poder decir cuál de dos es más nuevo, y
   ningún punto del criterio lo pide.
2. **El digest es CANÓNICO: no depende del orden de las filas ni del de las
   claves de un `roleHints`.** No es estética: está medido que barajar la tabla no
   cambia el plan (`plan/tests/ataque-determinismo.test.ts`), así que dos
   catálogos que planifican igual tienen que tener la misma identidad — si no, un
   epoch distinto tiraría fronteras válidas y la criatura re-planificaría de gusto.
3. **La pregunta 3 —«¿el overlay se indexa por firma o por capacidad?»— sigue
   abierta y no se contestó de costado.** La vista publica LISTAS, que es lo que
   la regresión consume hoy. El único que necesita buscar por firma exacta es
   `alientoDeConseguir`, y su índice se arma en `@anima/mind`, no en el
   planificador, justamente para no fijar la respuesta sin medirla.

### HECHO — tramo B, 2026-07-31. La frontera vencida

Era el cabo suelto del tramo A, y ya no lo es. `Frontera` lleva adentro el
`catalogEpoch` con el que se armó, y `plan()` la **descarta y replantea desde
cero** cuando no coincide. Es la misma disciplina del ADR II-0012 aplicada al
catálogo: una frontera guardada es una promesa sobre una tabla, y si la tabla
cambió, la promesa venció.

Por qué el epoch va en la frontera y no como argumento de `plan()`: es un dato
**de la frontera**. Quien la guarda no tiene por qué acordarse aparte de con qué
se armó, y si se lo dejara al que llama, el día que se olvide no se entera nadie.

**Y sellar pasó a ser PEREZOSO, que es lo que dejó un solo camino adentro de
`plan()`.** Con sello ansioso, envolver la escotilla de laboratorio
(`opciones.esquemas`) en una vista le cobraba el hash de la tabla entera a cada
corrida del banco, y la salida barata era no envolverla — o sea, un segundo
camino, que es lo que este gate vino a sacar. Perezoso, la lista pelada entra por
la misma puerta y no paga nada hasta que alguien le pregunte la identidad.

Lo que hace observable el descarte es `expansiones`, que acumula a través de los
cortes: una frontera retomada sigue contando, una descartada arranca de cero. Y
las dos mitades están afirmadas —que con el mismo catálogo SE RETOMA es tan
importante como que con otro se tire: un descarte demasiado celoso apagaría el
anytime entero y lo único que se movería es el reloj.

Del lado de la mente hay un test más, en `mind/tests/la-escalera.test.ts`, para un
modo de falla callado: si la mente le pasara a `plan()` un catálogo distinto del
que cree usar, la frontera quedaría sellada con el epoch equivocado y se
descartaría en cada tick. El plan que sale seguiría siendo correcto. Se afirma de
qué catálogo es el sello, no el tiempo.

---

## 7 · Contratos que deben revalidarse por la extensión de objetos emergentes

**Los Hitos 0 a 4 siguen cerrados.** Nada de esto los reabre ni borra una
medición: son los contratos que la extensión va a estirar, anotados ahora para
que la revalidación no se descubra a los golpes. Cada doc de hito tiene un puntero
a su sección de acá.

### Hito 0 — el banco · registrar para el futuro

- **candidato de plano fijo para CI** — el gate se demuestra sin proveedor, así
  que el candidato es un archivo versionado del repo, igual que los 28 borradores;
- **normalización canónica** — dos candidatos que dicen lo mismo escrito distinto
  tienen que normalizar al mismo `BlueprintDefinition`;
- **hashes deterministas** — sobre la definición normalizada, no sobre el texto;
- **fixtures independientes del proveedor** — ninguna medición del gate puede
  depender de una respuesta viva.

### Hito 1 — materia y leyes · revalidar posteriormente

- **límites de partes, juntas y profundidad** (`MAX_PARTS = 6`, `MAX_JOINTS = 8`,
  `MAX_ASSEMBLY_DEPTH = 3`): una obra de varias piezas los va a tocar, y ya hay
  medición de que el fardo mixto vive pegado al borde de `MAX_PARTS`;
- **cualidades derivadas**: lo que una obra «hace» tiene que salir de cualidades
  derivadas, no de una fila por objeto;
- **affordance genérica de retención o captura pasiva**: hoy `catch` es una
  cualidad de aparejo y la extracción la ejerce alguien. Falta la forma genérica
  de «esto retiene solo»;
- **rechazo de soluciones que dependan del nombre del objeto**: el control es el
  del Hito 1 —los ejemplos pasan sin que aparezca la palabra— aplicado al plano.

**No se agrega todavía geometría, ni aberturas, ni peces físicos.** Eso es el
Hito 14 y el 16.

### Hito 2 — el mundo determinista · revalidar posteriormente

`WorldState`, hashes, snapshots y replay tienen que seguir cerrando **con el
estado nuevo adentro**:

- **estado desplegado**, **stock asociado**, **próximo intento** y **captura
  almacenada**;
- **orden determinista entre dispositivos** —dos trampas sobre el mismo stock no
  pueden resolverse por orden de llegada, que es el agujero que el ataque al
  determinismo del Hito 2 ya encontró una vez con `seq`—;
- **consumo reproducible de RNG**.

Y la regla que no se negocia: **mirar, pensar o renderizar nunca consume RNG.**

### Hito 3 — el dios perezoso · revalidar

- **stock** y **reposición** con la extracción autónoma encima;
- **presupuesto calórico** por chunk: un dispositivo que saca sin actor es
  exactamente la forma que tendría una bomba de materia (riesgo 4 del documento
  de arquitectura);
- **competencia entre dispositivos sobre el mismo stock**.

### Hito 4 — cuerpo, sandbox y las innatas · planificar

- **reemplazo del `Blueprint` placeholder** (`{ id, at }`);
- **construcción o colocación por slots**;
- **revisión exacta** e **idempotencia** (ADR 0034 de Ánima I, ya portado);
- **`BuildSkill`** y **`UseSkill`** como piezas separadas;
- **percepción con datos autoritativos**: lo que la criatura ve de un dispositivo
  sale del estado del mundo, no de una lectura geométrica.

**No interpretar `covering` ni `inside` como contención física.** Hoy `inside` se
evalúa como «tiene algo encima o lo sostiene alguien», y leerlo como contención
sería inventar geometría que la física no modela.

---

## 8 · Pruebas

### CI determinista

Sin proveedor, con mundos y semillas fijos: candidato fijo · overlay ·
construcción · uso · replay · invalidación · descriptor · aislamiento entre
sesiones.

### Benchmark real

**Propuesta inicial, marcada como pendiente de línea base.** Ninguno de estos
números está medido; son el diseño del experimento, no su resultado.

| parámetro | valor propuesto |
|---|---|
| episodios | 30 |
| mundos reservados | 10 |
| intentos por mundo | 3 |
| rondas máximas | 3 |
| consultas máximas | 6 |
| tiempo máximo | 120 s |
| costo máximo por episodio | US$ 1 (provisional) |
| éxito mínimo | 21/30 (provisional) |
| pisos duros | ningún mundo con 0/3 · cero violaciones de invariantes |

**No se permiten reintentos ilimitados**, y CI determinista, benchmark real y E2E
de navegador se separan: mezclarlos es cómo un banco de 500 s termina adentro de
la suite y nadie la corre más.

### E2E de navegador

Proveedor controlado o respuesta grabada · mensaje en ticks definidos · mismo
journal · comparar `worldHash`, `registryDigest` y `renderDescriptorHash` ·
comprobar movimiento visible · comprobar **todos** los objetos del área visible ·
fallback visual obligatorio.

---

## 9 · Presupuesto

**Los 7–9 meses del documento de arquitectura se conservan como pronóstico
histórico y nada más.** No incluían: UI, objetos emergentes, dispositivos
autónomos, geometría, procesos físicos nuevos ni fauna materializada.

Las cifras se clasifican en tres, y la clase va escrita al lado del número:

| clase | qué significa |
|---|---|
| **medición existente** | se corrió, tiene arnés y exit code |
| **ROM con confianza** | orden de magnitud, con la confianza declarada |
| **desconocido pendiente de spike** | no hay base para dar un número |

**No se calcula un total nuevo sin base.** Las referencias ROM **no son
aditivas** —se solapan entre sí y con hitos que ya están planificados—:

| trabajo | ROM | confianza |
|---|---|---|
| aparejo activo | 3–7 días | alta |
| dispositivo autónomo | 5–9 semanas | media-baja |
| vertical registry/build/replay | 6–9 semanas | media-baja |
| promoción, persistencia y herencia completas | 15–24 semanas, con solapamiento en H7–H10 | baja |
| fauna y geometría completa | 4–8 meses | muy baja |

---

## 10 · Lo que sigue sin saberse

1. **¿Dónde vive la captura?** Estado autoritativo, sí — ¿en el cuerpo del
   dispositivo, en el `Stock`, o en una tabla del mundo indexada por dispositivo?
   Las tres cierran el hash; sólo una hace fácil la competencia entre dos
   dispositivos sobre el mismo stock.
2. **¿Qué destino nuevo admite `drawFromStock`?** Un tercer valor del `into`
   actual, o un `Yield` nuevo. Toca `admit()`, y `admit()` es la puerta.
3. **¿El overlay se indexa por firma, como `SCHEMA_INDEX`, o por capacidad?** El
   punto 3 del criterio dice «publicación de capacidades», y el índice de hoy es
   por firma exacta de predicado.
4. **¿Cuánto cuesta `PlannerCatalogView` por tick?** El precalculado de la mente
   existe porque parsear ocho firmas por candidato y por tick era caro. Con
   overlay hay que re-medirlo, y es punto del Hito 11.
5. **¿Qué invalida el `catalogEpoch`, exactamente?** Promover invalida; ¿revocar
   también?, ¿adoptar de una herencia?
6. **El costo de un dispositivo autónomo por tick.** Cero medición: si hay veinte
   trampas desplegadas, el mundo las recorre todas.

---

## Enlaces

- [`continuar-aca.md`](continuar-aca.md) — la memoria operativa
- [ADR II-0015](decisions/II-0015-el-plano-no-es-el-esquema-de-construccion.md) — el plano no es el esquema de construcción
- [ADR II-0016](decisions/II-0016-un-dispositivo-desplegado-retiene-sobre-un-stock.md) — un dispositivo desplegado retiene sobre un stock
- [ADR II-0017](decisions/II-0017-el-descriptor-visual-no-es-fisica.md) — el descriptor visual no es física
- [ADR II-0018](decisions/II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md) — el catálogo es core más overlay por sesión
- [ADR II-0019](decisions/II-0019-el-gate-5-6-no-reabre-el-hito-5.md) — el Gate 5→6 no reabre el Hito 5
- [`../../docs/architecture/remake-anima-ii.md`](../../docs/architecture/remake-anima-ii.md) — el plan de construcción entero
