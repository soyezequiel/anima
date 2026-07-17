# ADR 0029 — Código generado y agentes autores: dónde va JS, quién escribe, quién decide

Fecha: 2026-07-17 · Estado: **propuesta** (no aceptada) · Ejerce el ADR 0014, modifica el principio 2 del README, y depende de arreglar la vara del ADR 0006/0012

> Esta propuesta cubre varias decisiones a la vez porque solo tienen sentido
> juntas. Si se acepta, se parte en ADRs separados (ver «Cómo se aterriza»).
> Nada de lo que sigue está implementado.

## Contexto

Dos hechos de una corrida real de julio 2026 empujan esto:

1. **La DSL de skills se quedó chica, y se nota.** `recorrido-mapa` v1→v4 son
   cuatro intentos de expresar «recorré el mapa» en un lenguaje sin variables
   ni aritmética. Ninguna versión falló por falta de ideas: fallaron porque el
   idioma no daba. Y el arreglo final no lo encontró Ánima — lo agregamos a
   mano al lenguaje (`explore`/`sees`, ADR 0028). **Cada vez que la DSL no
   alcanza, la que aprende es la persona que la extiende, no la mascota.**
2. **La mente de la mascota es un mal autor.** Es un personaje: memoria
   parcial, personalidad, medio mapa sin ver, y encima le pedimos que hable en
   su voz. Que además escriba el artefacto correcto es mezclar dos trabajos
   que compiten por el mismo contexto.

El ADR 0014 ya dejó permitido el JS generado con jaula, con un orden de
preferencia y condiciones no negociables, pero nunca se ejerció: no había un
caso donde los datos genuinamente no alcanzaran. Ahora lo hay.

## La tesis: son dos ejes, no uno

La discusión «datos o código» se resuelve mal porque mezcla dos preguntas
independientes. Separarlas decide casi todo solo.

### Eje 1 — De qué lado de la puerta estás

- **Una skill propone.** Dice «quiero moverme a la derecha». El mundo contesta
  sí o no. Una skill mala pierde ticks: el radio de daño es el tiempo de la
  mascota. La puerta está río abajo, y sigue estando aunque la skill sea código.
- **Una interacción decide.** Dice «cuando pase esto, el mundo se vuelve
  aquello». Está del lado de la física. Una interacción mala **es** una física
  mala.

Código del lado del que propone es gratis. Código del lado del que decide
convierte el principio 1 («el mundo decide qué es posible») en «el código que
escribió el modelo decide qué es posible».

### Eje 2 — Quién escribe ≠ qué se escribe

La competencia del autor y la auditabilidad del artefacto son ortogonales — y
peor: **van en direcciones opuestas**. Un agente especializado escribe código
más sofisticado, con más ramas, y más ramas es más superficie que el juez no
miró. Mejorar el autor no rescata un artefacto inauditable.

De ahí que el agente autor sea buena idea *y* que no cambie el veredicto sobre
las interacciones.

### El mapa

```
                       ┌──────────────────┐
                       │      Ánima       │  el personaje: tiene la IDEA
                       └────────┬─────────┘
                                │
                       ┌────────▼─────────┐
                       │   Agente autor   │  NUEVO — traduce la idea
                       │   (traductor)    │  al artefacto correcto
                       └────────┬─────────┘
                                │
              ┌─────────────────┴──────────────────┐
              │                                    │
  ┌───────────▼─────────────┐          ┌───────────▼─────────────┐
  │ SKILL                   │          │ INTERACCIÓN / RECETA    │
  │ código JS enjaulado     │          │ datos declarativos      │
  │                         │          │                         │
  │ PROPONE: la puerta      │          │ ES una regla: ya está   │
  │ está río abajo          │          │ del otro lado           │
  └───────────┬─────────────┘          └───────────┬─────────────┘
              │                                    │
  ┌───────────▼─────────────┐          ┌───────────▼─────────────┐
  │ EVALUADOR               │          │ PUERTA   → la materia   │
  │ mundos aislados,        │          │ IA DIOS  → el sentido   │
  │ criterios, regresiones  │          │                         │
  │                         │          │ juzga UNA vez y corre   │
  │ (!) LA VARA, rota hoy   │          │ para siempre: por eso   │
  │     → la arregla fase 0 │          │ pide enunciado total    │
  └───────────┬─────────────┘          └───────────┬─────────────┘
              │                                    │
··············│····································│··················
              │       EL MUNDO · motor determinista│
  ┌───────────▼─────────────┐          ┌───────────▼─────────────┐
  │ resuelve cada intent,   │          │ world.interactions      │
  │ uno por tick            │          │ world.recipes           │
  │                         │          │                         │
  │ la skill queda AFUERA   │          │ la regla vive ADENTRO   │
  └─────────────────────────┘          └─────────────────────────┘
```

Lo que el mapa hace visible: **la columna izquierda nunca entra al mundo**. Una
skill vive afuera y empuja un intent por tick contra una puerta que la revisa
cada vez — por eso puede ser código sin que nadie pierda garantías. La columna
derecha **cruza una sola vez y se queda**: es la regla. Código ahí es física
generada, y ya no hay puerta río abajo que la revise.

Y la asimetría de los validadores es la que decide todo: el evaluador es
empírico (mide conducta, aguanta código), el juez es semántico (lee un
enunciado, necesita que sea total).

### El corolario, en tabla

| Capa | Qué es | Espacio | Forma | Por qué |
|---|---|---|---|---|
| **Skills** — decidir qué hacer | Propuesta | Todo algoritmo posible → infinito | **JS enjaulado** | La DSL siempre queda chica; y hay evaluador que respalda |
| **Interacciones / recetas** — transiciones | Regla del mundo | ~12 conceptos → finito | **Datos** | El juez necesita totalidad, y no hay vara que lo respalde |
| **Comportamientos de objetos** (`onTick`) | Regla del mundo | Procesos → infinito | **JS enjaulado**, fase 2 | Es el blanco real del ADR 0014; pide su propia vara |
| **Componentes** — qué es una cosa | Vocabulario del motor | Catálogo cerrado | **Datos** | Un componente que ningún sistema lee es inerte |

## Propuesta 1 — El agente autor (traductor)

Hoy el mismo modelo, en la voz de la mascota, tiene la idea *y* escribe el
artefacto. Se separan:

1. **Ánima tiene la idea.** En su voz, desde su memoria y su percepción, con su
   personalidad. Es lo único que la historia necesita que sea suyo — y sigue
   siendo suyo: *querer* acostarse en la cama es la parte que la hace ella.
2. **Un agente autor traduce la idea al artefacto.** Sin roleplay, con la API
   entera en el prompt, sin memoria contaminada. Produce receta, interacción o
   skill según el caso.
3. **La puerta determinista** filtra la materia (sin cambios).
4. **La IA Dios** juzga el sentido (sin cambios).

**Precedente**: el ADR 0024 ya hace exactamente esto para las recetas — el
cuidador describe, un modelo traduce, la puerta juzga. Esto lo generaliza.

**Por qué primero**: es la única pieza que mejora lo que ya existe sin
infraestructura nueva, y se puede medir contra la corrida actual (¿sube la tasa
de aciertos de `recipe.propose` / `skill.propose`?). Si no mejora nada, el resto
de la propuesta merece más escrutinio.

**Costo narrativo a vigilar**: si el agente autor decide *qué* construir y no
solo *cómo*, Ánima dejó de inventar. La frontera es dura: la idea (qué, por
qué, con qué nombre) es de ella; el artefacto (la forma correcta) es del
traductor.

## Propuesta 2 — Skills en JS enjaulado

### El contrato: generadores

El encaje con el motor es casi exacto y no es casualidad. Hoy `SkillExecution`
hace `next(perception)` → intención → el mundo la resuelve → `observe(events)`.
Eso **es** el protocolo de un generador de JS:

```js
// Lo que el agente autor escribe. Percibe, cede intenciones, el mundo decide.
function* recorrerMapaBuscando(ctx, query) {
  const visitadas = new Set();
  while (ctx.stepsLeft() > 0) {
    const visto = ctx.perceive().visibleEntities.find((e) => matches(e, query));
    if (visto) return visto;                       // lo encontró: termina
    const dir = dirMenosVisitada(ctx.perceive(), visitadas);  // SU algoritmo
    const res = yield { type: 'move', dir };       // ← esto cuesta UN tick
    if (!res.success) visitadas.add(celdaBloqueada(dir));
  }
}
```

Cada `yield` es un tick: el mundo sigue siendo el único que ejecuta física.
Solo cambia quién decide el próximo paso. Y la composición se vuelve
delegación nativa, sin `runSkill`:

```js
function* acostarseEnCama(ctx) {
  const cama = yield* ctx.skill('recorrer-mapa-buscando', { kind: 'cama' });
  yield* ctx.skill('ir-hacia', cama, { stopAt: 1 });
  yield { type: 'interact', interactionId: 'acostarse-cama', targetId: cama.id };
}
```

`explore`, `sees`, `moveToward`, los `branch` anidados — toda la DSL que fuimos
agregando op por op desaparece dentro de código que el modelo escribe solo, en
el intento 1.

**Ventaja lateral**: el contrato se escribe en TypeScript de verdad. Los tipos
`Perception` y `ActionIntent` del motor van al prompt tal cual, sin traducirlos
a una gramática inventada que hay que mantener sincronizada a mano.

### La jaula (condiciones del ADR 0014, con nombres propios)

1. **Intérprete**: QuickJS-wasm (`quickjs-emscripten`). Corre igual en el
   navegador y en el evaluador. Nunca `eval` ni `Function` sobre el contexto real.
2. **Determinismo**: contexto sin `Date`, sin `Math.random`, sin red, sin DOM,
   sin `import`. El azar entra por `ctx.rng()`, que es el RNG seedeado del mundo
   (`packages/shared/src/rng.ts`). Mismo estado + misma semilla ⇒ mismo
   resultado. Sin esto mueren las regresiones, los snapshots y el multijugador
   futuro.
3. **Presupuesto**: fuel por instrucciones (interrupt handler) y tope de
   memoria — el mismo espíritu que `maxPureOpsPerTick` / `maxIntents` de hoy.
4. **Membrana**: solo JSON cruza. La skill nunca toca `WorldState`, igual que hoy.
5. **Validación estática barata** (antes de gastar un tick): parsear el AST,
   prohibir `eval`/`Function`/`import`/`globalThis`, tope de tamaño. No prueba
   nada semántico — para eso está el evaluador.
6. **Evaluación previa sin cambios**: mundos aislados, criterios, regresiones.
   Es lo que hace tolerable que el análisis estático ya no pueda decir tanto.

### Sobre la idea de la clase `Anima`

Se adopta la **ergonomía**, no la **mecánica**.

- **Sí**: el prompt le muestra al agente autor algo que se lee como
  `class Anima { *recorrerMapa() {…} *talarArbol() {…} }` — un archivo que es
  «la mente de la mascota» y que crece. Es few-shot perfecto, y el legado se
  vuelve literal: la sucesora hereda la clase.
- **No**: `this` mutable compartido entre skills. Si `talarArbol()` depende de
  que `buscarHerramienta()` haya dejado algo en `this.herramienta`, ya no se
  puede probar una skill en un mundo aislado ni versionarla sola (¿v3 de una
  rompe a las otras cuatro?). El evaluador vive de que cada skill sea una
  unidad juzgable.
- **La síntesis**: cada skill es una función pura de firma fija, validada,
  guardada, versionada y evaluada por separado; el host las ensambla para
  mostrarlas como clase. La memoria persistente no es `this.loQueSea` sino
  `ctx.memory` — objeto serializable que viaja en el snapshot y que el
  evaluador puede resetear.

## Propuesta 3 — Interacciones y recetas siguen siendo datos

Se consideró hacerlas código (escrito por el agente autor, juzgado por el
Dios) y se rechaza. Los tres motivos, del más débil al más fuerte:

1. **El espacio es finito.** «Qué le puede hacer un cuerpo a un objeto» son
   ~12 conceptos: dónde te parás, qué llevás, en qué se convierte. Lo que el
   ADR 0027 dejó afuera (empujar, a distancia, estados sostenidos,
   contenedores) son cuatro más. Es una escalera finita, no una cinta sin fin.
   Las skills necesitan Turing-completitud; las interacciones necesitan
   vocabulario.
2. **El juez necesita un enunciado total.** Se juzga UNA vez, y la regla corre
   para siempre, en mundos que nadie previó. Con datos, lo que se juzgó **es**
   lo que corre. Con código, el juez aprueba un *espacio* de comportamientos
   habiendo visto las ramas que se le ocurrieron.
3. **El decisivo: las skills pueden pagar el código porque tienen evaluador;
   las interacciones no tienen vara.** Una skill se prueba en mundos aislados
   contra criterios antes de promoverse — si al juez se le escapa algo, la
   evidencia empírica lo agarra. Una interacción no tiene contra qué medirse:
   es una regla, no una conducta con objetivo. ¿Cuál sería el criterio de
   «juntar-agua»? ¿«El balde quedó lleno»? Eso es repetir el efecto, no
   juzgarlo. **Interacción-código = juez parcial sin respaldo empírico**: el
   único lugar del sistema donde el generador quedaría sin puerta efectiva.

Y un costo de ingeniería que no es menor: una interacción vive en
`world.interactions`, viaja en los snapshots y la aplica `resolveInteract`. Si
fuera código, `stepWorld` —hoy una función pura y sincrónica sobre datos— pasa
a depender de una instancia de sandbox; restaurar un guardado implica
re-instanciar el sandbox de cada interacción que el mundo conoce; el
determinismo del mundo pasa a depender del determinismo del sandbox; y el
evaluador, que corre miles de mundos aislados, instancia sandboxes por mundo.
Con las skills nada de esto pasa: el sandbox corre solo cuando la mascota
piensa. Es de ella, no del mundo.

**A cambio**: si el malestar es que dos efectos es poco (y es un malestar
legítimo), se sube la escalera entera de una vez — `push`, `spawn-adjacent`,
`consume-held`, estados sostenidos con duración. Una tarde de trabajo, el juez
sigue funcionando igual, y cierra el tema.

## Fase 0, innegociable — arreglar la vara antes

El reporte de la corrida marca como prioridad #1 que **la evaluación de skills
está rota**, y trae la prueba: `crear-casa` v2 se promovió al 100% con el
criterio «termina llevando un martillo», que no tiene nada que ver con una
casa. Una skill que mide cualquier cosa siempre pasa. Sumado a que el veredicto
es booleano sobre 3 semillas fijas `[11, 22, 33]`, con crafteo variable (ADR
0020) el evaluador lee la suerte como capacidad.

**Esto bloquea todo lo demás.** El argumento entero para dar JS a las skills es
«el evaluador respalda lo que el análisis estático ya no puede decir». Si la
vara está rota, JS no es más libertad: es más superficie sin medir. Darle a un
generador más potencia mientras su juez independiente no funciona es exactamente
lo que el principio 6 existe para impedir.

Lo mínimo antes de la primera línea de JS generado:

- Semillas muestreadas del RNG del mundo, con las regresiones como casos fijos.
- Éxito como distribución, no booleano.
- **Quién escribe el criterio**: hoy lo escribe el mismo que escribe la skill,
  y por eso «llevar un martillo» pasa por «hacer una casa». Es el problema
  abierto de verdad, y no lo resuelve ninguna de las propuestas de acá.

## Cómo se aterriza

| Fase | Qué | Bloquea a | Costo |
|---|---|---|---|
| **0** | Arreglar la vara (semillas muestreadas, distribución, el problema del criterio) | Todo | Medio |
| **1** | Agente autor (traductor) | — | Bajo |
| **2** | Prototipo de jaula: `JsSkillExecution` con la misma interfaz `next()/observe()`, QuickJS detrás, una skill escrita a mano «como si fuera el modelo», pasando por el evaluador completo. **Sin tocar prompts.** | 3 | Medio |
| **3** | Convivencia: la DSL vieja sigue corriendo, las skills nuevas nacen en JS. Los prompts de Codex cambian acá | — | Medio |
| **4** | Vocabulario de interacciones completo (opcional, independiente) | — | Bajo |
| **5** | `onTick` de objetos en JS (fuego que se propaga). Pide inventar su propia vara primero | — | Alto |

Si se acepta, se parte en: **ADR 0029** (agente autor), **ADR 0030** (skills en
JS enjaulado), **ADR 0031** (vocabulario de interacciones). La fase 0 no es un
ADR: es deuda del ADR 0006/0012 que ya está registrada como prioridad.

## Qué cambia en los principios del README

El **principio 2** dice hoy: *«La mascota no modifica el núcleo: la
automodificación ocurre solo vía habilidades validadas y versionadas en una DSL
cerrada»*. Pasaría a: *«…vía habilidades validadas y versionadas, ejecutadas en
una jaula determinista sin acceso al núcleo»*. La garantía real nunca fue la
DSL — era el aislamiento y la validación. La DSL era el medio.

Los principios **1** (el mundo decide), **3** (verificables), **4** (la IA no
corre en cada frame), **5** (funciona sin API real) y **6** (el generador
propone, el evaluador decide) no se tocan. Si alguna fase los rozara, la fase
está mal diseñada.

## Riesgos, y qué mataría la propuesta

- **Latencia por tick en el navegador.** Es la medición central de la fase 2.
  Si instanciar/reanudar QuickJS por tick no entra en el presupuesto de un
  juego que stepea en vivo, la propuesta 2 se cae entera. Mitigación posible:
  un contexto por skill viva, reusado entre ticks.
- **Tamaño del wasm** en el bundle web (~1MB comprimido, a confirmar).
- **Determinismo del sandbox**: QuickJS es determinista en principio, pero hay
  que verificar que nada del GC o del orden de iteración se filtre a la
  conducta observable. Un test de determinismo dedicado, como los que ya
  existen para el mundo.
- **Compatibilidad de guardados**: hoy una skill viaja como JSON inerte; pasaría
  a viajar como fuente que se re-interpreta. Cada versión del sandbox es una
  promesa de compatibilidad hacia atrás.
- **Que la fase 0 no se pueda resolver.** Si el problema de «quién escribe el
  criterio» no tiene respuesta buena, entonces no hay que darle JS a las
  skills: hay que arreglar el evaluador y punto.

## Lo que queda deliberadamente afuera

- **Interacciones, recetas y componentes en código.** Ver propuesta 3. No es
  conservadurismo: es que ahí la puerta y el juez son lo que permite que Ánima
  invente *sin supervisión humana*, y ninguna de las dos sobrevive al código.
- **`this` mutable / estado compartido entre skills.** Mata la evaluabilidad,
  que es la joya del proyecto.
- **Que el agente autor decida QUÉ hacer.** Traduce ideas; no las tiene. Si las
  tuviera, Ánima dejó de ser el personaje.
- **Otros lenguajes.** Python (Pyodide) pesa ~10MB y arranca lento — malo para
  un juego que stepea por tick en el browser. Lua enjaula fácil pero los
  modelos lo escriben notablemente peor que JS, y el contrato tipado sería más
  pobre. La ventaja de JS no es solo el corpus de entrenamiento: es que el
  contrato **son los tipos reales del motor**.
