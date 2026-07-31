> # ⚠ Corrección previa — leer antes que nada
>
> Este documento lo escribió un agente sintetizador. **Dos de sus filas citan
> borradores que no existen** (`secar-fibra-mojada` y
> `forjar-el-aparejo-que-falta`: cero archivos en `borradores/`), y una tercera
> —`volver-en-vez-de-re-explorar`, la **única** que el documento clasifica como
> `SALE_YA`— existe solamente porque el auditor la escribió después para
> verificar la afirmación. O sea: **el número titular del documento no tiene
> evidencia de compilador detrás.**
>
> Las cifras verificadas a mano, corriendo `tsc` sobre los cuatro carriles:
>
> | | |
> |---|---|
> | Errores de tipos totales | **112** |
> | Borradores escritos | 28 |
> | Borradores que fallan | **23** |
> | Compilan limpio | 5 |
>
> Y de esos 5: uno es el ejemplo del propio documento de arquitectura (que hubo
> que arreglar para que compilara), uno es la reconstrucción del auditor, y
> **tres son casos de control** que los agentes escribieron a propósito para
> mostrar qué subconjunto sí compila.
>
> **De las 20 capacidades propuestas, ninguna se escribió como habilidad
> completa que compile.** El reparto honesto no es 1 de 20: es 0 de 20.
>
> Eso no invalida el trabajo — lo hace más contundente. Las razones de los 112
> errores son reales, están medidas y son el resultado que importa. Lo que se
> corrige es el titular, no el hallazgo.
>
> — verificado a mano, no por agente.

---

# Qué puede aprender Ánima, y qué no

Veinte capacidades de la escalera más el ejemplo de referencia del propio documento. El casillero es el **corregido por el compilador**: donde el crítico y `tsc` no coincidieron, gana `tsc` y se dice en la fila.

| # | id | Tanda | Casillero final | Por qué |
|---|---|---|---|---|
| 1 | `volver-en-vez-de-re-explorar` | 1 | **SALE_YA** | Compila limpio y hace lo que dice: `recall` → `goTo(p.at)` → verificar con `see()` → contabilizar el fallo en `ctx.memory`. Única de las veinte que pasa el árbitro sin trucos. |
| 2 | `pescarConAparejo` (ejemplo del doc) | — | **SALE_YA con arreglo de 3 líneas** | No compilaba como está publicado: `see()[0]` es `BodyView\|undefined` bajo `noUncheckedIndexedAccess`. Tres errores en el ejemplo canónico que el modelo va a copiar. |
| 3 | `encender-solo-cuando-va-a-prender` | 1 | **FALTA_API** | Cuatro sitios de error, no tres: `SelfView` no es `BodyView` (falla en `can` **y en `apply`**), y `combustion` no es `ProcessId`. La criatura no puede frotar declarándose como el cuerpo que paga: sólo puede frotar omitiendo el rol. |
| 4 | `sacarlo-antes-de-que-se-queme` | 1 | **FALTA_API** *(el crítico dijo FALTA_MUNDO)* | `denaturesAt` no es `QualityId` y `ctx.wait` no existe. El compilador desempata: sin `denaturesAt` la habilidad se escribe fea y **hace** algo; sin `wait` no hay habilidad de ningún tipo, y `wait` tumba también a la #5. |
| 5 | `secar-fibra-mojada` | 1 | **FALTA_API** | Compila —y ése es el hallazgo—: compila **sólo** por `yield ctx.goTo(ctx.self.at)`, ir a donde ya estoy. La secuencia estrella del Hito 5 descansa sobre una deformidad no especificada. |
| 6 | `retirar-lo-suyo-del-alcance-del-fuego` | 2 | **FALTA_API** | Reconocer que algo arde **ya compila** (`temperature >= ignitionPoint && moisture < 0.45`). Lo que no compila es leer el campo térmico de una celda, leerse a sí misma, y distinguir «lo mío» de cualquier cosa portable. |
| 7 | `decidir-que-deja-atras` | 2 | **FALTA_API** | Cuatro errores, todos de superficie: `capacity`, `drop`, `stamina`, `atTick`. El orden multicriterio, la aritmética de viajes y el plan serializado compilan sin agregar nada. Está a cuatro líneas de `.d.ts`. |
| 8 | `comer-ahora-o-esperar-la-coccion` | 3 | **FALTA_API** | Doce errores. `ctx.eat` no existe (seis TS2339, uno por rama de decisión), `hunger`/`stamina` no existen, `project` no existe, `wait` no existe. Puede tasar la comida perfecto y no puede comerla. |
| 9 | `avisar-antes-de-gastarse` | 3 | **FALTA_API** | `Intent.commitment` **sí** typechequea (hallazgo a favor del documento). Faltan las dos mitades restantes: estimar el costo, y un canal de entrada — `say()` es de una sola vía y no hay `'vetoed'`. |
| 10 | `cortar-la-busqueda-cuando-cambia-la-urgencia` | 3 | **FALTA_API** | `until: (v: PerceptionView) => boolean` sólo puede hablar del paisaje: `v.self` y `v.need` fallan. El predicado de corte no alcanza al sujeto que se corta. |
| 11 | `forjar-el-aparejo-que-falta` | 1 | **FALTA_MUNDO** | Compila limpio y por eso es la más peligrosa: `UNION` declara tres roles y la caña son dos cuerpos, y no está dicho qué pone `StepResult.got` en un `join`. Sin handle no hay medición, y sin medición es una tabla de crafteo con `yield`. |
| 12 | `guarecerse-antes-de-tener-frio` | 2 | **FALTA_MUNDO** | El compilador ascendió a evidencia mecánica lo que el crítico dio como riesgo: `'sheltered'` es **TS2322**. Y aunque se agregaran `clock`, temperatura propia y `qAt`, `relaxesTo.target` es una constante: compilaría, correría y no vería cambiar el ambiente nunca. |
| 13 | `guardar-donde-menos-se-pudre` | 2 | **FALTA_MUNDO** | No hay estado de celda declarado en la física. `PlaceMemory` es `{at}`: se puede ordenar por cercanía y por nada más. Guardar es exactamente comparar sitios. |
| 14 | `jubilar-la-herramienta-gastada` | 2 | **FALTA_MUNDO** | Un solo error de tipos, y el problema es peor: **el mundo no gasta la herramienta**. `extraccion` no declara ni un `effect`, `Joint.strength` se escribe una vez y ninguna ley la re-deriva. La guarda `catch <= 0` no dispara jamás. |
| 15 | `dejar-marcas-que-ella-misma-lee` | 3 | **FALTA_MUNDO** | La versión honesta no compila; la degenerada sí, y el cuerpo puesto es decorativo: el significado vive en `ctx.memory`, que es del programa y no de la criatura. El único predicado que distingue una marca de una piedra es `charred >= 0.8`: el mundo como disco tiene capacidad de un bit. |
| 16 | `tapar-la-fogata-para-hacer-carbon` | 3 | **FALTA_MUNDO** | La técnica emblema. `ctx.q(fogata,'oxygen')` **typechequea y contesta otro número** (el del cuerpo; la ley 4 lee el de la celda). `'cubrir'` no es `ProcessId`, `covering` no está en la firma de `put`, `coveredBy` no está en `BodyView`. Compila entera y produce ceniza siempre. |
| 17 | `guardarle-algo-al-cuidador` | 4 | **FALTA_MUNDO** | Cuatro de los cinco errores parecen de API y no lo son: no hay a **quién** dárselo. El cuidador es texto que entra por `postMessage`, no un cuerpo. Y el motivo tampoco existe: `opportunities()` no tiene término para el otro. |
| 18 | `hacerse-ver-de-lejos` | 4 | **NECESITA_LEY** | `'smoke'` no es `QualityId` ni en `see()` ni en `q()`, `'ahumar'` no es `ProcessId`. Y una cualidad sin ley es inerte: la combustión no emite nada, y «se ve más lejos» es una afirmación sobre `@anima/perceive`, no sobre una habilidad. |
| 19 | `mover-lo-que-no-entra-en-las-manos` | 4 | **NECESITA_LEY** | Detectar el problema compila (`portable` es derivada): sabe que no puede y no puede hacer nada. Y hay una pared que no se arregla con cualidades: `QualityTest` es `{q, op, v}` escalar, así que **una corriente con rumbo no es expresable** por más entradas que se agreguen. |
| 20 | `poner-distancia-con-lo-que-la-persigue` | 4 | **NECESITA_LEY** | La pared está corrida respecto del crítico: percibir persecución y ponerse detrás del fuego **ya compilan** (mismo id, dos ticks, una resta; celda opuesta = `2·fuego − amenaza`). Falta depredador, daño y filo: ninguna de las once leyes transfiere daño entre cuerpos. |
| 21 | `techo-que-para-la-lluvia` | 4 | **NECESITA_LEY** | Seis errores, y lo más fuerte es lo que `tsc` **no** dijo: el ensamble de profundidad 3 compila con cero errores porque `MAX_ASSEMBLY_DEPTH=2` vive en el motor y no llega a la superficie. Lo único que se escribe bien es la falsación: puede demostrar que su techo no tapa, no construir uno que tape. |

**Reparto:** SALE_YA 1/20 (5%) · FALTA_API 8/20 (40%) · FALTA_MUNDO 7/20 (35%) · NECESITA_LEY 4/20 (20%).

---

# El veredicto sobre la afirmación del documento

El documento dice: *«puede combinar cualquier cosa cuya física ya esté escrita»*.

**Es falsa como está enunciada, y es verdadera con una condición que el documento no menciona.** La condición, en la formulación más filosa que dio la evidencia (borrador `t3/tapar-la-fogata-para-hacer-carbon.ts`):

> Es **verdadera para las leyes que actúan sobre CUERPOS** y **falsa para las que actúan sobre CELDAS**.

Cuatro de las once leyes dependen del estado de la celda: la 1 (`termica`, relaja hacia `ambient`), la 3 (`combustion`, modulada por `oxygen` de la celda), la 4 (`transmutacion`, que lee `w.oxygenAt(b.at)`) y la 11 (`humedad`, donde `wet` es de la celda). **La superficie que ve el modelo tiene cero lecturas de celda.** `ctx.q()` exige un `BodyView` y `Cell` no tiene `id`. Diez de las veinte capacidades tropiezan con eso.

La afirmación no cae en el escalón cuatro. Cae en el cero: la tanda 1 se definió como «no asume NADA que no esté hoy en `skill-api.d.ts`», y **de sus cinco capacidades, una compila y hace lo que dice**. Dos no compilan, una compila y miente por aridad de roles, y una compila sólo por el truco de caminar en el lugar. La escalera se autodeclaró refutable en el escalón cero y se refutó ahí.

**Números, no adjetivos:**

| | Cuántas | Cuáles |
|---|---|---|
| Salen hoy, sin tocar una línea | **1 de 20 (5%)** | `volver-en-vez-de-re-explorar` |
| Necesitan mano humana **dentro del plan de 7-9 meses** | **16 de 20 (80%)** | los 8 de FALTA_API (superficie de `Ctx` y campos de `SelfView`/`PlaceMemory`/`BodyView`), los 7 de FALTA_MUNDO (cualidades de celda, desgaste, aridad de `UNION`, cuerpo del cuidador, ley de oclusión) y `techo-que-para-la-lluvia`, que es NECESITA_LEY pero cuyas cuatro piezas —oclusión, lluvia, `place`/`Blueprint`, profundidad 3— caen todas en hitos existentes |
| Fuera del alcance declarado | **3 de 20 (15%)** | `hacerse-ver-de-lejos` (humo como campo + ley de advección + canal de percepción propio), `mover-lo-que-no-entra-en-las-manos` (corriente vectorial: no cabe en `QualityId` por ser escalar), `poner-distancia-con-lo-que-la-persigue` (fauna con conducta = un segundo `decide()`, o sea un proyecto más grande que el remake) |

Y el hallazgo que cambia el modo de falla del sistema entero: **en 12 de las 20 hay una versión que pasa `tsc` y hace lo incorrecto**, con archivo que compila con cero errores como evidencia (`t1/encender-…::demostracionAridadDeApply`, `t1/sacarlo-…::esperarEsUnTruco`, `t2/26-lo-que-si-compila.ts`, `t3/99-lo-que-si-compila.ts`, `t4/escritor-lo-que-si-compila.ts`, más los borradores 11, 14, 19, 21). El argumento del documento —«el código generado se typechequea antes de que el mundo lo vea»— **no cubre la clase de error más probable del corpus**. El compilador ataja las palabras que faltan y deja pasar los programas que mienten.

---

# Lo que el compilador encontró y nadie había visto

Ordenado por cuántas capacidades bloquea cada hueco. Los tres primeros no estaban numerados.

### 1. Cero lecturas de celda — 10 de 20 capacidades

No existe `ctx.qAt(cell, q)`. `see()` devuelve cuerpos; `wet`, `oxygen` y la temperatura ambiente son de la celda. Bloquea a `guarecerse`, `retirar-lo-suyo`, `guardar-donde-menos-se-pudre`, `decidir-que-deja-atras`, `secar-fibra`, `comer`, `cortar-la-busqueda`, `tapar-la-fogata`, `techo` y `poner-distancia` (elegir terreno es elegir celdas, y `footing` sólo se lee de cuerpos).

Es además el hueco **silencioso**: en `tapar-la-fogata`, `ctx.q(fogata,'oxygen')` compila y devuelve el oxígeno del cuerpo. Dos números distintos, el mismo nombre, el mismo tipo. Nadie lo va a descubrir con el árbitro que tenemos.

### 2. La criatura no es un cuerpo para sí misma — 9 de 20

`ctx.q(ctx.self, q)` es **TS2345: «Type 'SelfView' is missing the following properties from type 'BodyView': id, name»**. No es que a `SelfView` le falten campos (eso era el HUECO 5): es que no puede medirse con el mismo verbo con el que mide todo lo demás. Y no bloquea sólo la consulta: en `encender-solo-cuando-va-a-prender` el mismo error reaparece en `apply` (línea 147), o sea que **no puede frotar declarándose a sí misma como el cuerpo que paga la stamina**. La reparación es la más barata y la de mayor alcance de toda la escalera: `id` y `name` en `SelfView`, o un `ctx.me: BodyView`.

### 3. HUECO NUEVO — los nombres de rol no están tipados. Afecta al corpus entero

`can(p, roles)` y `apply(p, roles)` toman `Record<string, BodyView>`. Verificado mecánicamente en cuatro archivos independientes:

- `apply('friccion', {})` con cero roles sobre un proceso que declara tres: **cero errores**.
- `apply('friccion', {rolQueNoExiste: x})`: **cero errores**.
- `apply('extraccion', {gera, fuente})` con los dos roles mal escritos: **cero errores**.
- `apply('union', {techo, mundo, binder})`: **cero errores**.
- `apply('friccion', {stone, blank})` como sustituto de `afilar`: **cero errores**. El compilador ataja la palabra `'afilar'` y deja pasar el proceso equivocado con el nombre de rol correcto.

`ProcessId` es vocabulario cerrado y **sus roles son texto libre**: el vocabulario cierra sobre el proceso y se abre entero un carácter después. Es el error más obvio que va a cometer un modelo que escribe procesos de memoria, y el filtro barato de compilación del Hito 8 no lo atrapa. Se arregla con `RolesOf<P>` y no cuesta física.

### 4. HUECO NUEVO — no está dicho si `ctx` se refresca entre `yield`s

`Ctx` declara `readonly tick: number` y el generador retiene ese objeto durante 300 ticks. Si `ctx` es la vista congelada del tick de arranque, entonces `ctx.q(pieza,'temperature')` dentro de un bucle de vigilancia devuelve el mismo número para siempre, y `sacarlo-antes-de-que-se-queme` **compila, se sella, pasa al juez y no vigila nada**. Es el único hueco que no produce error de tipos y que aun así decide si media biblioteca hace algo.

### 5. HUECO NUEVO — el determinismo es un comentario, no un tipo

`Ctx` promete «no hay `Math.random` ni `Date` en el scope». Con `lib: ["ES2022"]`, `Math.random()`, `Date.now()` y `Math.sqrt` **compilan sin una queja** (verificado en `t4/poner-distancia-…`). La garantía fuerte de reproducibilidad del mundo cuelga hoy de un párrafo.

### 6. No hay forma de esperar — 4 de 20, y ocho de las once leyes

No hay ningún constructor de intención ociosa. El Hito 4 lista «esperar» entre las quince innatas y `Ctx` no lo tiene. El énfasis correcto no es «falta un reloj de espera»: **cocción, secado, descomposición, carbonizado y desnaturalización son leyes ambiente que corren por tick**. La criatura las provoca poniendo las cosas en situación y después no tiene con qué dejar que pase el tiempo. El sustituto que compila es hacerla caminar en el lugar.

### 7. Recalibración de los huecos que ya estaban anotados

**HUECO 8 (no hay forma de comer): escandaloso y barato.** Bloquea 2 de 20 (`comer-ahora-o-esperar`, `guardarle-algo-al-cuidador`) y se arregla con una línea: `eat(b: BodyView): Intent`. Pesa mucho menos de lo que su título sugiere. Lo grave no es que falte: es que **el documento lista «comer» y «esperar» entre las quince innatas del Hito 4 y `Ctx` no tiene ninguna de las dos**. Las dos listas nunca se cruzaron, y la lista de las quince innatas *es* la especificación de `Ctx`.

**HUECO 2 (sólo cuatro procesos aplicables): pesa 5 de 20, y su lista está mal.** Nombra siete ausentes —cortar, afilar, cavar, machacar, tejer, perforar, moler— y la evidencia sólo reclamó tres de ellos (`afilar`, `cavar`, y por extensión `arrastrar`, que no estaba en la lista). En cambio reclamó dos que el HUECO no menciona: **`cubrir`** y **`ahumar`**. Y `cubrir` no es un proceso que falte implementar: es una **relación espacial** que la ley 4 ya consume (`w.oxygenAt(b.at)`, con el comentario «baja si está tapado») sin que exista ley que la defina, cualidad que la exprese ni nada en `Ctx` que la consulte. El HUECO 2 sobreestima el catálogo de verbos y subestima el de relaciones.

### 8. El resto, por peso

- **`PlaceMemory` es `{at}`** (HUECO 6): bloquea 4, degrada 1. Sin `atTick` no hay caducidad de recuerdo, y todo el legado del Hito 10 arranca creyendo en montones que la ley 6 pudrió hace 20.000 ticks.
- **`BodyView` es `{id, at, name}`** (HUECO 4): bloquea 6. Faltan `joints`/`parts`, `supportedBy`, `coveredBy`, rumbo, y alguna marca de agente o de procedencia.
- **`StepResult` sin `why`**: un `'rejected'` no distingue manos llenas de «otro la sostiene» de «la vista caducó». Aparece en cinco borradores.
- **Reloj** (HUECO 11): bloquea 3 y **toda** conducta anticipatoria del juego.
- **`MAX_ASSEMBLY_DEPTH=2` no llega a la superficie**: la obra ilegal de profundidad 3 compila y el arnés la promueve.
- **HUECO 9 (soltar)**: `put(b, ctx.self.at)` tipa, pero `put(b, at, {onTopOf})` es **la misma firma** que apoyar-sobre-la-parrilla. Soltar y apoyar son el mismo verbo con un opcional distinto, y ninguna habilidad puede saber cuál de los dos hizo.

---

# Qué soporte tiene que existir antes, y en qué hito entra

### Hito 0 — antes de escribir el motor

| Qué | Por qué acá |
|---|---|
| **El arnés de compilación de la escalera**: los ~20 borradores como suite de `tsc` contra el `.d.ts` | Es lo que produjo este trabajo. Encontró un error en el ejemplo canónico del documento y quince huecos de superficie **cuatro meses antes** de que existiera una línea de motor. Cuesta días y ya se pagó |
| Barrido de la ley térmica con **diez** sustancias (corrección B del apéndice) | `sacarlo-antes-de-que-se-queme` es el test de la ventana 63-280 °C. Si la ventana no existe sin números por caso, el modelo físico cambia acá |

### Hito 1 — Materia y leyes (física y datos)

```ts
// Cierra el HUECO 1: el catálogo de celda, que hoy no existe en ningún lado
export type CellQuality = 'wet' | 'oxygen' | 'temperature' | 'sheltered' | 'footing'

// Los dos bordes de la ventana térmica, leíbles con el mismo verbo
export type LawfulQuality = /* …14… */ | 'denaturesAt' | 'pyrolysisAt'

// Roles tipados por proceso — se declara con el catálogo, se emite al .d.ts
export type RolesOf<P extends ProcessId> =
  P extends 'friccion'    ? { a: BodyView; b: BodyView; actor: BodyView } :
  P extends 'union'       ? { binder: BodyView; a: BodyView; b?: BodyView } :
  P extends 'deshilachar' ? { source: BodyView; actor: BodyView } :
  P extends 'extraccion'  ? { gear: BodyView; source: BodyView; actor: BodyView } : never
```

- **Ley 12 — `oclusion`.** Cobertura por celda, consumida por la 1 (térmica), la 3 (combustión), la 4 (transmutación, que hoy la asume sin escribirla) y la 11 (humedad). Es la ley de mayor apalancamiento de todo el trabajo: destraba `tapar-la-fogata` (la técnica emblema), `techo-que-para-la-lluvia` y el «reparo» de `guarecerse`. **No es física nueva: es la ley que la ley 4 ya invoca.** La disciplina es no repararla con «si hay un cuerpo con `onTopOf` apuntando a éste, restale 0.5 al `oxygenAt`», que es la tabla por situación que el apéndice denuncia.
- **Decidir la aridad de `UNION`.** El documento se contradice: el criterio verificable del Hito 1 dice `union(vara, hebra)` con dos argumentos, contra una firma de tres roles. Con la aridad sin resolver, `forjar-el-aparejo` compila mintiendo.
- **Un `Effect` de desgaste en `extraccion`**, o `Joint.strength` re-derivada por tick de `tensile` y `cohesion`. Hoy el proceso no declara ni un efecto: sin esto, `jubilar-la-herramienta` es una guarda que nunca dispara.
- **`freeStrandEnds` como `DerivedQuality`** leíble. Hoy vive dentro de la fórmula de `catch`: cuando `catch` sale 0, la habilidad no puede distinguir «la hebra era corta» de «la até por los dos extremos».
- **`MAX_ASSEMBLY_DEPTH` de 2 a 3**, o declararlo consultable. Con 2 no hay parrilla-sobre-trípode ni travois ni techo, y hoy la violación **no produce error de tipos**.
- **Ambiente como función del tick** en `QualitySpec.relaxesTo` (hoy `'ambient' | number`, una constante). Sin esto, `guarecerse` compila, corre y no ve cambiar el ambiente nunca.

### Hito 2 — El mundo determinista

```ts
export interface Clock { readonly phase: 'dia' | 'noche'; readonly ticksToNightfall: number; readonly dayLength: number }
```

Día/noche del ADR 0085 portado (hoy «aparece en una enumeración al final de un párrafo y nunca más»), campo de celda materializado en `TypedArray`, y **la lluvia como fenómeno**, no como parámetro adversario del juez. Acá también se decide y se documenta si `goTo` a distancia cero cuesta un tick — porque hoy media biblioteca podría depender de eso.

### Hito 4 — Cuerpo, sandbox y las quince innatas

```ts
export interface Ctx {
  readonly me: BodyView              // o SelfView extends BodyView. 9 de 20 capacidades
  readonly clock: Clock              // HUECO 11
  qAt(at: Placement, q: CellQuality): number          // 10 de 20
  eat(b: BodyView): Intent                            // HUECO 8, y está en las quince innatas
  wait(ticks: number): Intent                         // «esperar» está en las quince innatas
  drop(b: BodyView): Intent                           // HUECO 9, y desambigua put()
  put(b: BodyView, at: Cell, o?: { onTopOf?: BodyView; covering?: BodyView }): Intent
  place(bp: Blueprint): Intent                        // ADR 0032
  can<P extends ProcessId>(p: P, roles: RolesOf<P>, o?: { ignoreArrangement?: boolean }): Verdict
  apply<P extends ProcessId>(p: P, roles: RolesOf<P>): Intent
  explore(o: { until: (v: PerceptionView) => boolean; abortWhen?: (v: PerceptionView) => boolean; maxTicks: number }): Intent
  goTo(t: BodyView | Cell, o?: { within?: number; maxTicks?: number }): Intent
}

export interface SelfView extends BodyView { readonly holding: readonly BodyView[]
  readonly capacity: number; readonly stamina: number; readonly hunger: number; readonly temperature: number }
export interface PlaceMemory { readonly at: Placement; readonly atTick: number
  readonly what?: BodyView; q(q: QualityId): number }
export interface BodyView { readonly id: string; readonly at: Placement; readonly name: string
  readonly mass: number; readonly parts: readonly BodyView[]; readonly joints: readonly JointView[]
  readonly supportedBy?: string; readonly coveredBy?: string; readonly burning: boolean }
export interface StepResult { readonly status: 'arrived'|'found'|'done'|'blocked'|'rejected'|'timeout'|'aborted'|'vetoed'
  readonly got: readonly BodyView[]; readonly why?: string }
```

Y dos decisiones que no son código: **el alcance de `ctx.memory`** (si es por habilidad, lo aprendido se pierde en cada hot-swap del carril de mejora; si es global, dos habilidades generadas colisionan de claves sin árbitro), y **si `ctx` se refresca entre `yield`s**, escrito en el `.d.ts` y verificado con un test.

### Hito 5 — La mente

`estimate(i: Intent): { ticks: number; stamina: number }` en `Ctx` —mudar a la superficie el `estimateTicks` que hoy vive en `opportunities()`— y `self: SelfView` en `PerceptionView`, sin lo cual `until` es un predicado sobre el paisaje y la capacidad pide cortar por lo que cambió adentro.

### Hito 6 — El chat

`heard(): readonly Utterance[]` con polaridad, y `'vetoed'` en `StepResult.status`. **Y el cuidador como cuerpo**: un `Body` con tag de agente y `Placement`, con presencia atada a la pestaña abierta. Es barato y es lo único que sostiene la mitad emotiva del producto; hoy el documento no le dedica un párrafo al avatar del jugador.

### Gate 5→6 — objetos emergentes dentro de una física fija

Entre el Hito 5 y el Hito 6, y **sin ampliar el criterio del Hito 5**. Lo que esta
escalera le aporta al gate son dos cosas medidas acá:

- **la superficie de INVOCACIÓN sigue sin medirse.** Es el punto 4 de la auditoría
  de completitud —«quién construye `args`»— y con planos emergentes se vuelve más
  grande: además de qué cuerpo llena un rol, ahora hay que decir **qué revisión de
  qué plano** se está construyendo. El gate lo cierra con `BuildSkill`, que
  construye **una revisión exacta**;
- **`place(bp: Blueprint)` está en la superficie desde el H4 y el mundo la
  rechaza** con `'no-implementado'`. El `Blueprint` de hoy son dos campos
  (`{ id, at }`). Reemplazarlo es trabajo del gate, y el `BlueprintDefinition`
  **no lleva el sitio adentro**.

Ver [`gate-5-6-objetos-emergentes.md`](gate-5-6-objetos-emergentes.md).

### Hito 12 — la UI presentable

**El mapa es la vista principal**, la criatura se mueve visiblemente, y todo objeto
del área visible aparece. Lo que esta escalera aporta: **ningún objeto puede quedar
sin dibujar por no tener arte**. El descriptor visual es procedural, determinista y
derivado del estado ([ADR II-0017](decisions/II-0017-el-descriptor-visual-no-es-fisica.md)).

### Diferido, con nombre (post-UI, Hitos 13–16)

`'smoke'` como campo extensivo con `poweredBy` desde `fuelEnergy` + ley de advección; corriente como campo vectorial (no cabe en `QualityId`); fauna como cuerpos con conducta + ley de daño + `afilar`. **Esto hay que decírselo al usuario antes de empezar**, igual que el techo del requisito 1: las tres son cosas que va a pedir el primer día.

**Y ahora tienen hito.** La corriente y la fauna son el **Hito 16**; la geometría
que haría falta para que una trampa contenga de verdad es el **Hito 14**, después
de un spike. **La primera trampa no depende de ninguno de los dos**: su captura es
estado autoritativo, no contención geométrica.

---

# Cambios al plan de construcción

**Hito 0 — se agranda a 2 semanas.** Suma el arnés de compilación de la escalera y el barrido térmico de diez sustancias. *Motivo:* este trabajo encontró tres errores en el ejemplo publicado del documento y quince huecos de superficie usando nada más que `tsc` contra un `.d.ts`. Institucionalizarlo cuesta días y adelanta cuatro meses todo lo que está en la sección anterior.

**Hito 1 — de 4-6 a 6-8 semanas.** Suma: catálogo de cualidades de celda (cierra el HUECO 1, que el propio apéndice admite abierto), ley 12 de oclusión, `denaturesAt`/`pyrolysisAt` leíbles, desgaste en `extraccion`, `RolesOf<P>`, aridad de `UNION` decidida, `MAX_ASSEMBLY_DEPTH` a 3. *Motivo:* diez capacidades bloqueadas por celda, cuatro por relaciones espaciales, y el test verificable del propio hito (`union(vara, hebra)`) contradice la firma que publica.

**Hito 2 — de 2-3 a 3-4 semanas.** Suma día/noche (ADR 0085) y lluvia como fenómeno. *Motivo:* `guarecerse-antes-de-tener-frio` demostró que **toda** conducta anticipatoria del juego cuelga de tres lecturas, y que sin ambiente variable la habilidad compila y es ciega. La lluvia aparece hoy una sola vez en el documento y es adversario de cuatro capacidades.

**Hito 4 — se parte en dos.**
- **H4a — el cuerpo y la superficie (2-3 semanas).** `Ctx` completo con `me`, `qAt`, `eat`, `wait`, `drop`, `clock`, `place`, roles tipados, `why`, `abortWhen`. Las quince innatas. *Motivo:* la lista de las quince innatas del documento (que incluye «comer» y «esperar») nunca se cruzó con `Ctx`, que no tiene ninguna de las dos. La lista de las quince **es** la especificación de la API y hay que tratarla así.
- **H4b — el `.d.ts` emitido y el arnés como test (1 semana).** El `.d.ts` sale de `tsc --declaration` y la escalera entera vuelve a compilar contra él en CI. *Motivo:* el `.d.ts` a mano es exactamente el bug de `DSL_REFERENCE` que el propio archivo denuncia.

**Hito 5 — cambia el criterio de emergencia, que es el criterio de corte del proyecto.** De las diez secuencias objetivo, las cinco que el documento nombra se reparten así: *tapar la fogata para hacer carbón* es FALTA_MUNDO (celda + oclusión), *secar la fibra antes de atar* depende de `wait`, *guardar el asado porque dura más* depende de `qAt`, *romper el ensamble para recuperar la vara* es el HUECO 10 y ningún proceso lo produce. **Cuatro de las cinco secuencias con las que se decide si la tesis vive son hoy inexpresables**, y un detector automático que las busca va a medir cero por construcción. La lista de diez hay que re-derivarla de la escalera, con la regla: sólo entra una secuencia que compile en el arnés del H0.

**Hito 6 — suma el cuerpo del cuidador y el canal de entrada.** *Motivo:* `avisar-antes-de-gastarse` mostró que `say()` es de una sola vía y que «sigue salvo que le digan que no» no es implementable; `guardarle-algo-al-cuidador` mostró que agregar cuatro métodos no arregla nada porque no hay a quién dárselo.

**Hito 7 — el juez suma una clase de banco: mundos donde la premisa de la habilidad es falsa.** *Motivo:* 12 de 20 tienen una versión que pasa `tsc` y hace lo incorrecto. El juez es el único que puede atraparlas, y sólo si el banco incluye el mundo donde la herramienta se gasta, el mundo donde llueve, el mundo con dos cuerpos que se llaman igual y el mundo donde el stock se agotó con la herramienta sana. Suma también **ablación del predicado `name`**: `see([]).find(b => b.name === 'cuidador')` compila hoy y es `PROTECTED_KINDS` renacido adentro de una habilidad.

**Hito 8 — la fragua suma tres lints del sandbox.** Prohibir `b.name === '…'` como predicado; prohibir `Math.random`/`Date`/`Math` trascendente en el código generado (hoy compilan pese al comentario); y detectar constantes de calibración cableadas (0.45, 63, 280, 0.3) para que `physicsVersion` pueda invalidarlas — hoy invalida sellos de procesos y no toca los literales que el modelo escribió.

**Hito 9 — deja de ser una lista de verbos.** Ver la sección siguiente.

**Hito 11 — suma un invariante económico nuevo:** ninguna habilidad promovida puede contener un literal numérico en el rango de las perillas de la física. *Motivo:* el test estrella del Hito 1 —«una sustancia nueva del oráculo se comporta sin fila propia»— **sigue pasando en la física y se cae en la habilidad**, y nadie lo va a notar porque el test mide el motor.

**Y el plan gana cuatro cosas más, decididas el 2026-07-31** (ver el
[Gate 5→6](gate-5-6-objetos-emergentes.md)): un **gate técnico entre el Hito 5 y
el 6** para objetos emergentes; el **Hito 12 de UI después del Hito 11**, partido
en 12A/12B/12C; los **Hitos 13 a 16** de física abierta, después de la UI; y la
regla de que **el Hito 5 termina con su alcance actual** — el gate no lo reabre.

---

# Pruebas de aceptación

Una por capacidad de las tandas 1 y 2. Todas tienen control negativo, porque un test que no puede fallar no es un test.

**T1.1 · `encender-solo-cuando-va-a-prender`.** Dos mundos gemelos, varas idénticas salvo `moisture` 0.10 vs 0.60. *Pasa si:* en A frota y `stamina` cae ≥ 40; en B `stamina` cae < 5 y hay un `say()` con motivo. *Control semántico (el del Hito 1, versión habilidad):* tercer mundo con una sustancia **nueva del oráculo**, tag `organico`, `ignitionPoint` distinto y `moisture` 0.50 — la decisión tiene que salir bien sin que la habilidad tenga `0.45` adentro. *Falla hoy:* no compila (4 sitios).

**T1.2 · `forjar-el-aparejo-que-falta`.** La **misma habilidad, sin cambiar una línea**, tiene que producir `catch > 0` con vara+hebra y con hueso+tendón (el par que el Hito 1 ya exige del motor). *Control:* binder con `tensile` bajo → la habilidad mide `catch == 0` y reintenta con otro binder, y **no** camina al río. *Falla hoy:* el test no se puede ni escribir, porque no está definido qué pone `StepResult.got` en un `join` y no hay handle del ensamble. Que el test sea inescribible **es** el resultado.

**T1.3 · `volver-en-vez-de-re-explorar`.** Dos episodios de hambre en el mismo mundo. *Pasa si:* el segundo consume < 30% de los ticks del primero y llama a `explore` cero veces. *Control:* mover el recurso entre episodios → tiene que re-explorar, no plantarse. *Segundo control (el que hoy falla):* agotar el stock sin cambiar la celda mojada → tiene que desistir, no pescar en un pozo vacío.

**T1.4 · `sacarlo-antes-de-que-se-queme`.** Barrido de diez sustancias con `denaturesAt` distintos. *Pasa si:* `digestibility ≥ 0.85` y `charred < 0.2` en ≥ 8 de 10. *Control anti-cableo:* el test grepea la habilidad y falla si contiene un literal numérico entre 50 y 400. *Control de vigilancia:* apagar el fuego a mitad → tiene que reportar `fail`, no retirar algo peor que crudo.

**T1.5 · `secar-fibra-mojada`.** *Pasa si:* entre dos iteraciones del bucle de espera avanza **al menos un tick del mundo** (contador del mundo, no del generador) y `moisture` baja monótona. *Control que hace al test valioso:* la misma habilidad escrita con `yield ctx.goTo(ctx.self.at)` como espera tiene que **FALLAR** el test. Si pasa, el truco quedó consagrado por costumbre. *Segundo control:* con la fogata a `emitsPower = 300` a dos celdas, la fibra no puede cruzar su `ignitionPoint` — hoy la quema y reporta `done`.

**T2.1 · `guarecerse-antes-de-tener-frio`.** *Pasa si:* la maniobra arranca N ticks antes del anochecer **y N escala cuando se cambia `dayLength`**. Si al duplicar el día sigue arrancando en el mismo tick absoluto, el largo del día está cableado adentro. *Control:* primera noche de la partida sin fuego previo → la anticipación no puede consumir la reserva de stamina que la ley 10 va a necesitar; `admit()` no tiene nada que objetar acá, así que lo tiene que atrapar este test.

**T2.2 · `retirar-lo-suyo-del-alcance-del-fuego`.** Mundo con pescado sobre parrilla a `d=1` **y** fibra en las brasas. *Pasa si:* retira la fibra y **no** retira el pescado. Es el test que hoy falla siempre, porque la única señal disponible —la temperatura subiendo— significa las dos cosas y `BodyView` no expone `supportedBy`. *Control:* la retirada no puede depositar la fibra en agua ni sobre brasas.

**T2.3 · `guardar-donde-menos-se-pudre`.** Dos depósitos: uno seco y caliente (al lado del fuego), otro fresco y húmedo. *Pasa si:* elige el que minimiza `decay` **integrado a 2000 ticks**, no el que minimiza humedad instantánea. Es exactamente la trampa que la evidencia encontró: el lugar más seco del mapa es el que está al lado del fuego. *Control:* recuerdo de 4000 ticks de antigüedad → tiene que desconfiar (requiere `atTick`).

**T2.4 · `jubilar-la-herramienta-gastada`.** Mundo donde la atadura se afloja por ley. *Pasa si:* deja de insistir en ≤ 8 intentos después de que `catch` cae. *Control decisivo, y hoy imposible:* mundo con el stock agotado y la herramienta **sana** → **no** la jubila. Distinguir «no pica», «no hay» y «se rompió» es el mismo colapso de causas que el apéndice le reprocha al Beta. *Control anti-trampa:* el test falla si la habilidad lee `'stock'` — hoy `ctx.q(agua,'stock')` compila y le dice cuántos peces quedan.

**T2.5 · `decidir-que-deja-atras`.** Montón de cinco cuerpos, capacidad 2, destino a 30 celdas. *Pasa si:* el orden de acarreo lleva primero lo que desbloquea el siguiente paso y llega con `stamina > 0`. *Control:* con stamina inicial baja hace **un** viaje, declara la pérdida por `say()` y suelta en una celda que evaluó, en vez de quedarse seca a mitad de camino. *Control de legado:* segunda vida con un acopio de 20.000 ticks de antigüedad → no puede creerle.

**T·superficie (no es de una capacidad, es del sistema).** Corpus de 20 llamadas malformadas a `apply`/`can` —roles faltantes, roles de más, nombres mal escritos, proceso equivocado con roles correctos. *Pasa si:* `tsc` rechaza las 20. **Hoy rechaza 0.**

**T·compila-y-miente.** Para cada habilidad de la biblioteca semilla: correrla en el mundo donde su premisa es falsa. *Pasa si:* devuelve `fail(why)`, no `done()`. Hoy 12 de 20 pasarían tipos y mentirían.

---

# La biblioteca semilla del Hito 9, especificada

El documento pide «cuarenta a sesenta habilidades» y da doce palabras: *pescar, encender, asar, atar, deshilachar, recolectar, refugiarse, cocinar, secar, guardar, cargar, apilar*. **Eso es una lista de verbos, y la evidencia dice que el verbo es la parte barata**: la habilidad de frotar es de cinco líneas y la capacidad es el `if` que la precede. La biblioteca semilla tiene que ser un catálogo de **decisiones**, no de acciones — las acciones ya son las quince innatas del Hito 4.

Cuarenta y ocho habilidades en ocho familias de seis. `✔` = escribible con la superficie reparada de H4a. `◐` = necesita algo del H1 ampliado (celda, oclusión, desgaste). `✚` = diferida, no entra a la semilla.

**Fuego (6)** — `encender-por-friccion` ✔ · `encender-solo-cuando-va-a-prender` ✔ · `alimentar-el-fuego-antes-de-que-baje` ✔ · `apagar-lo-que-no-quiero-que-arda` ◐ · `mover-la-fogata-lejos-de-lo-mio` ✔ · `hacer-carbon-tapando` ◐

**Alimento (6)** — `pescar-con-aparejo` ✔ · `cocinar-en-la-ventana-termica` ✔ · `comer-ahora-o-esperar-la-coccion` ✔ · `elegir-la-pieza-por-calorias-netas` ✔ · `descartar-lo-toxico` ✔ · `racionar-cuando-queda-poco` ✔

**Herramienta (6)** — `forjar-el-aparejo-que-falta` ◐ · `verificar-el-aparejo-antes-de-usarlo` ◐ · `jubilar-la-herramienta-gastada` ◐ · `elegir-binder-por-tensile-y-humedad` ✔ · `reparar-la-atadura-floja` ◐ · `romper-el-ensamble-para-recuperar-la-vara` ✚ (HUECO 10)

**Materia (6)** — `deshilachar-lo-fibroso` ✔ · `secar-fibra-mojada` ✔ · `mantener-seco-lo-que-tiene-que-durar` ◐ · `elegir-vara-por-rigidez-y-largo` ✔ · `separar-lo-mojado-de-lo-seco` ◐ · `juntar-de-a-dos-porque-son-dos-manos` ✔

**Lugar y memoria (6)** — `volver-en-vez-de-re-explorar` ✔ *(sale hoy)* · `guardar-donde-menos-se-pudre` ◐ · `desmentir-el-recuerdo-viejo` ✔ · `marcar-el-limite-de-lo-explorado` ◐ · `recordar-donde-rindio-y-cuanto` ✔ · `elegir-piso-firme-antes-de-soltar` ◐

**Cuerpo y presupuesto (6)** — `descansar-antes-de-gastarse` ✔ · `no-empezar-lo-que-no-puedo-terminar` ✔ · `cortar-la-busqueda-cuando-cambia-la-urgencia` ✔ · `guarecerse-antes-de-tener-frio` ◐ · `retirar-lo-suyo-del-alcance-del-fuego` ◐ · `no-pararse-donde-me-caliento` ◐

**Transporte (6)** — `decidir-que-deja-atras` ✔ · `hacer-dos-viajes-en-vez-de-uno` ✔ · `soltar-para-poder-tomar` ✔ · `acopiar-cerca-de-donde-se-usa` ✔ · `llevar-primero-lo-que-desbloquea` ✔ · `abandonar-avisando` ✔

**Cuidador (6)** — `seguir-orden-de-movimiento` ✔ · `traer-lo-que-pidieron` ✔ · `avisar-que-no-puedo-y-por-que` ✔ · `mostrar-lo-que-me-falta` ✔ (ADR 0052) · `avisar-antes-de-gastarse` ✔ (necesita `estimate` del H5) · `guardarle-algo-al-cuidador` ✚

**Cuenta: 48. Escribibles con H1 ampliado + H4a: 45. Diferidas: 3.**

Cuatro reglas de la biblioteca semilla, todas salidas de la evidencia:

1. **Ninguna semilla lleva un literal de calibración adentro.** El lint del H8 la rechaza. Motivo: cada habilidad generada se lleva hoy una copia de la perilla (0.45, 63, 280, 0.3), y `physicsVersion` invalida sellos, no literales.
2. **Ninguna semilla usa `b.name` como predicado.** Motivo: `name === 'cuidador'` compila y es la tabla de kinds renacida donde ningún validador la ve.
3. **Toda semilla se escribe primero en el arnés del H0 y sólo después contra el motor.** Motivo: es el único árbitro que existe antes del Hito 2, y ya demostró que funciona.
4. **El orden de escritura es el de prerrequisitos, no el de familias**: primero las 14 marcadas ✔ que sólo dependen de H4a, porque son las que validan la superficie antes de que la física ampliada esté calibrada.

---

# Lo que sigue sin saberse

Once preguntas que ni el crítico ni el compilador pudieron responder. La mayoría necesita **mundo**, o sea el Hito 2.

1. **¿`ctx` se refresca entre `yield`s?** Si es la vista congelada del tick de arranque, toda habilidad con bucle de vigilancia compila, se sella, pasa el juez y es un no-op. No produce error de tipos y no hay forma de descubrirlo sin motor. *Se responde en:* H2/H4a, y hay que escribirlo en el `.d.ts` antes.
2. **¿`goTo` a distancia cero cuesta un tick?** De eso depende si `secar-fibra-mojada` seca algo o quema combustible del transformer hasta que el ejecutor la corta. *H2.*
3. **¿Existe la ventana de cocción entre 63 y 280 °C para diez sustancias, o sólo para dos?** Si no existe sin números por caso, `sacarlo-antes-de-que-se-queme` falla siempre y el problema es de la ley 1, no del modelo. *H0/H1.*
4. **¿Un `BodyView` capturado hace 300 ticks caduca?** Y qué devuelve `q()` sobre un cuerpo que ya no está donde se lo vio. `ctx.q()` está tipado `number`, no `number | undefined`: la superficie no tiene forma de decir «ese cuerpo ya no existe». *H2/H4a.*
5. **¿Cuánto vale un tick?** 30 Hz está fijado sin justificación y, con `friccion` a 6 °C/tick y desnaturalización a ~300 ticks, **la tasa de tick es la calibración**. *H0.*
6. **¿La emergencia emerge?** Con la lista de diez secuencias corregida —cuatro de las cinco publicadas son hoy inexpresables— nadie sabe cuántas van a aparecer en 20 partidas. Es el criterio de corte del proyecto y hoy mide un espacio vacío. *H5.*
7. **¿Puede el juez atrapar «compila y miente»?** Requiere mundos adversarios que hoy no existen: donde la herramienta se gasta, donde llueve, donde el stock se agotó con el aparejo sano. Sin ellos, `fingirArrastre` y `apilarYCreerQueTapa` promueven. *H7.*
8. **¿Puede la criatura distinguir «no hay» de «no sé»?** El Beta por (contexto, tag) colapsa dos causas del fracaso en un posterior, y `jubilar-la-herramienta` necesita justamente esa distinción. Ninguna evidencia de este trabajo la toca. *H5.*
9. **¿Qué le cuesta a la calibración agregar la ley 12 de oclusión?** El apéndice ya dice que once leyes acopladas son el mayor riesgo de cronograma. Doce es más. Y la oclusión se vuelve contra la criatura por dos lados: tapa el sol y no seca la fibra; baja el oxígeno y pudre el fuego que protegía. *H1/H11.*
10. **¿Cuántas de las 45 semillas escribe bien el modelo?** El corpus de la escalera es la única muestra que existe, y la escribimos nosotros, no el modelo. Lo único medido: **1 de 20 capacidades salió sin tocar nada**. *H8.*
11. **¿Con `ctx.memory` por habilidad o global?** No es una medición, es una decisión, y decide si el carril de mejora tira a la basura lo aprendido en cada hot-swap. Hay que tomarla antes de que la fragua escriba la primera habilidad.

**Lo único que este trabajo puede afirmar sin mundo, y lo afirma con cuatro archivos que compilan:** el techo del requisito 1 no está en la inteligencia del modelo ni en el catálogo de once leyes. Está en el tamaño de `Ctx` y en las cuatro leyes que leen la celda. Eso el documento no lo dice, y ahora hay evidencia.

---

# Apéndice — auditoría de completitud

Leí `F:\proyectos\Anima\docs\architecture\remake-anima-ii.md`, `F:\proyectos\Anima\ii\packages\skills\src\skill-api.d.ts` y los 20 borradores. Corrí `npx tsc -p tsconfig.t1.json`. Cinco respuestas.

1. LA CAPACIDAD CLASIFICADA CON OPTIMISMO: `volver-en-vez-de-re-explorar`, la única SALE_YA.

Primero, lo material: no existe. En `F:\proyectos\Anima\ii\packages\skills\borradores\` no hay archivo para ella, ni para `secar-fibra-mojada` (#5), ni para `forjar-el-aparejo-que-falta` (#11). Grep en todo `ii/`: cero. O sea que el único número positivo del trabajo —«1 de 20, 5%», el que titula el veredicto— es la única fila sin evidencia, y dos de los borradores que el informe cita como prueba de «compila y miente» (el 11) tampoco existen.

Lo reconstruí literal, según la propia fila («recall → goTo(p.at) → verificar con see() → contabilizar el fallo»): `F:\proyectos\Anima\ii\packages\skills\borradores\t1\volver-en-vez-de-re-explorar.ts`. Compila limpio, la fila acierta en tipos. Y falla sus propios dos controles de T1.3. `recall` filtra por `'wet'`, que es cualidad de CELDA: si el recurso se movió o el stock se agotó y el pozo sigue mojado, `see()` devuelve el agua igual y la habilidad devuelve `done`. No re-explora y no desiste: se planta. Lo único que la salvaría es `q(agua,'stock')`, y T2.4 declara que leer `'stock'` es trampa y hace fallar el test. El informe exige desistir por una lectura que él mismo prohíbe, en dos pruebas que nunca se cruzaron. Sumado a que `PlaceMemory` no tiene `atTick` (el propio informe dice «bloquea 4, degrada 1» — esa 1 es ésta), el casillero honesto es FALTA_API. El reparto real es 0 de 20.

2. EL CAMBIO AL PLAN QUE ES GUSTO Y NO EVIDENCIA: la biblioteca semilla de 48 en ocho familias de seis.

Cuarenta y ocho es 8×6, y la simetría es la razón. Veintiocho de las 48 nunca tocaron un compilador; las marcas ✔/◐ son juicio a ojo del mismo tipo que el informe le reprocha al crítico, y se contradicen con sus propias filas: `cortar-la-busqueda-cuando-cambia-la-urgencia` va ✔ («escribible con H4a») cuando su reparación —`self` en `PerceptionView`— el informe la manda al Hito 5; `avisar-antes-de-gastarse` va ✔ y en el mismo renglón admite que necesita H5, y además el canal de vuelta que manda al H6; `comer-ahora-o-esperar` va ✔ y su fila pide `project`, que no está en la lista de H4a. Y el detalle que delata que la sección no se pensó como plan: el informe agranda H0, H1, H2 y parte H4 en dos, y a Hito 9 —el único hito cuyo alcance acaba de redefinir de doce palabras a 48 habilidades especificadas— le deja las 2 semanas intactas. (Menor, misma familia: el «barrido de diez sustancias» aparece cuatro veces como si fuera un resultado; diez no salió de ninguna medición.)

3. LA PRUEBA QUE NO PUEDE FALLAR: T1.5, `secar-fibra-mojada`.

«Pasa si entre dos iteraciones del bucle de espera avanza al menos un tick del mundo». El generador sólo se reanuda porque el ejecutor procesó el `Intent` que se le hizo `yield`: el tick avanzó por construcción del ejecutor, para cualquier habilidad que haga `yield` de cualquier cosa. El criterio mide el ejecutor, no la habilidad. Y la segunda mitad —«`moisture` baja monótona»— mide la ley 11. Peor: el control declarado dice que la versión con `yield ctx.goTo(ctx.self.at)` tiene que FALLAR, y esa versión también hace `yield` y también avanza el tick. El criterio y su control se contradicen. Como está escrita, T1.5 pasa siempre, incluido el caso que fue puesta a atrapar.

4. LO QUE FALTA Y NO SE MENCIONA EN NINGÚN LADO: quién construye `args`.

`skill-api.d.ts:279` declara `Skill<A> = (ctx: Ctx, args: A) => …` con `A` libre. Los borradores reciben el cuerpo correcto ya en la mano: `args: { con: BodyView }`, `args: { pieza: BodyView }`. Nada —ni los once huecos, ni los cuatro nuevos, ni las once preguntas abiertas, ni una sola de las pruebas de aceptación— dice quién arma ese objeto, cómo una habilidad declara qué cuerpo necesita para que la mente sin LLM lo pueda llenar, qué pasa cuando ningún cuerpo califica, ni qué hace la mente con el `BodyView` que devuelve `done(got?)`. La escalera midió la superficie de ESCRITURA y jamás la de INVOCACIÓN, que es exactamente la costura entre el Hito 4 y el Hito 5 — y el Hito 5 es el criterio de corte del proyecto. La conclusión final del informe («el techo está en el tamaño de `Ctx` y en las cuatro leyes de celda») se afirma sobre una medición que no tocó el lado donde la habilidad se elige y se parametriza. Puede ser cierta y no está probada: las veinte capacidades se juzgaron con el problema difícil ya resuelto por el enunciado.

5. LAS TRES CORRECCIONES DE MAYOR IMPACTO.

Primera: corregir el número titular a 0 de 20 y adoptar la regla que el propio trabajo demuestra pero no aplicó — ninguna fila del casillero sin archivo committeado y salida de `tsc` pegada. Tres de veintiuna no lo tienen, y son la única positiva y dos de las que sostienen el hallazgo de «compila y miente». Sin eso, el arnés del H0 que el informe propone institucionalizar nace con el mismo bug que denuncia en `DSL_REFERENCE`.

Segunda: resolver las dos contradicciones internas antes de que se conviertan en tests: la de `'stock'` (T1.3 exige desistir por una lectura que T2.4 prohíbe) y la de T1.5 (control contra criterio). La primera no es un error de redacción: es la pregunta 8 —«no hay» contra «no sé»— con forma de API, y pide algo que no está en la lista de H4a, un modo de anotar «vine y no había» que no sea el ledger del dios (`PlaceMemory.atTick` más resultado de visita contabilizado). Ese es el destrabe barato que el informe no vio, al lado de `ctx.me` y `qAt`.

Tercera: tirar las 48 y quedarse con las 14 que el propio informe marca dependientes sólo de H4a, con el binding de `args` especificado antes de escribir la primera. Y ponerle a H9 una estimación real. Una biblioteca semilla cuyo criterio de entrada es «compila en el arnés del H0» no puede tener 28 miembros que nunca pasaron por el arnés: es la regla 3 de la propia sección, incumplida por la sección misma.
