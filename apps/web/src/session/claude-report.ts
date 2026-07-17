import type { Recipe } from '@anima/sim-core';
import type { GameView } from './view.js';

/**
 * Reporte descargable pensado para pegarle a Claude Code: describe el estado
 * real de una corrida y las brechas entre el código actual y la visión del
 * producto (simulación de mundo con crafteo generativo validado de habilidades
 * y de objetos). Es texto plano deliberadamente: la evidencia viva (skills,
 * recetas, memoria) va arriba en prosa y abajo cruda en JSON, así el agente
 * que lo lee puede citar datos exactos sin correr el juego.
 */

export interface ClaudeReportInput {
  view: GameView;
  /** Recetas vivas del mundo (incluye las que Ánima inventó, ADR 0018). */
  recipes: Recipe[];
  /** Ids de las recetas base del MVP: lo que no está acá fue inventado. */
  baseRecipeIds: readonly string[];
  /** Semillas fijas con las que se evalúan las skills (GameSession). */
  evaluationSeeds: readonly number[];
  generatedAt: string;
}

export function claudeReportFileName(view: GameView, generatedAt: string): string {
  const stamp = generatedAt.slice(0, 16).replace(/[:T]/g, '-');
  return `anima-reporte-claude-${stamp}-t${view.tick}.md`;
}

function pct(value: number | null): string {
  return value === null ? 's/d' : `${Math.round(value * 100)}%`;
}

/**
 * Describe una receta por sus desenlaces: qué puede salir, con qué chance y
 * entre qué calidades. El reporte tiene que poder decir la verdad sobre un
 * mundo que ya no es un guion — si siguiera anunciando "resultado fijo",
 * mentiría sobre la brecha que él mismo señaló.
 */
function describeRecipe(recipe: Recipe, invented: boolean): string {
  const ingredients = recipe.ingredients.map((i) => `${i.count}× ${i.kind}`).join(' + ');
  const origin = invented ? 'inventada por Ánima' : 'base del mundo';
  const total = recipe.outcomes.reduce((sum, o) => sum + o.weight, 0);
  const outcomes = recipe.outcomes.map((outcome) => {
    const chance = total > 0 ? `${Math.round((outcome.weight / total) * 100)}%` : 's/d';
    if (!outcome.output) {
      const spared = (outcome.spares ?? []).map((s) => `${s.count}× ${s.kind}`).join(' + ');
      return `${chance} no sale nada${spared ? ` (conserva ${spared})` : ''}`;
    }
    const components = Object.keys(outcome.output.components).join(', ') || 'sin componentes';
    const quality = outcome.quality
      ? `, calidad ${outcome.quality.min}–${outcome.quality.max}`
      : '';
    return `${chance} 1× ${outcome.output.kind} (${components}${quality})`;
  });
  return `- \`${recipe.id}\` (${origin}): ${ingredients} → ${outcomes.join(' · ')}.`;
}

export function buildClaudeReport(input: ClaudeReportInput): string {
  const { view, recipes, baseRecipeIds, evaluationSeeds, generatedAt } = input;
  const base = new Set(baseRecipeIds);
  const invented = recipes.filter((r) => !base.has(r.id));
  const stableSkills = view.skills.filter((s) => s.status === 'stable');

  const entityCounts = new Map<string, number>();
  for (const entity of view.entities) {
    entityCounts.set(entity.kind, (entityCounts.get(entity.kind) ?? 0) + 1);
  }
  const entitySummary =
    [...entityCounts].map(([kind, count]) => `${count}× ${kind}`).join(', ') || 'ninguna visible';

  const skillLines = view.skills.map((s) => {
    const failures = s.knownFailures.length
      ? ` Fallos conocidos: ${s.knownFailures.join('; ')}.`
      : '';
    return (
      `- **${s.name} v${s.version}** [${s.status}] — éxito en evaluación ${pct(s.lastEvaluationSuccessRate)}, ` +
      `corridas reales ${s.successfulRuns}/${s.totalRuns}. Criterios: ${s.successCriteria.join('; ')}.${failures}`
    );
  });

  const hypothesisLines = view.hypotheses.map(
    (h) => `- ${h.statement} (confianza ${h.confidence}, ${h.resolved})`,
  );

  // Memoria episódica (ADR 0033): lo que hizo y le pasó, con conteo. Los más
  // recientes primero, acotado — el detalle completo va en el JSON crudo.
  const episodeLines = [...view.episodes]
    .sort((a, b) => b.lastTick - a.lastTick)
    .slice(0, 15)
    .map((e) => {
      const count = e.occurrences > 1 ? `×${e.occurrences}, ` : '';
      return `- [${e.kind}] ${e.summary} (${count}tick ${e.lastTick})`;
    });

  const raw = {
    generatedAt,
    seed: view.seed,
    tick: view.tick,
    aiProvider: view.aiProvider,
    identity: view.identity,
    legacyCount: view.legacyCount,
    pet: view.pet,
    goals: view.goals,
    currentStrategy: view.currentStrategy,
    entities: view.entities,
    recipes,
    inventedRecipeIds: invented.map((r) => r.id),
    evaluationSeeds,
    skills: view.skills,
    regressions: view.regressions,
    experiments: view.experiments.slice(-60),
    facts: view.facts,
    hypotheses: view.hypotheses,
    episodes: view.episodes,
    devEvents: view.devEvents.slice(-80),
  };

  return `# Reporte de Ánima para Claude Code

Generado: ${generatedAt} · Semilla ${view.seed} · Tick ${view.tick} · ${view.identity.name} (generación ${view.identity.generation}) · Proveedor IA: ${view.aiProvider}

## Cómo usar este reporte

Este archivo lo genera la propia aplicación (botón 📥 del modo desarrollador) y
está pensado para que un agente de código (Claude Code) sepa **qué mejorar**.
Leé primero «Visión objetivo» y «Brechas contra la visión»; el resto es
evidencia de una corrida real (estado, habilidades, recetas, memoria) y al
final van los datos crudos en JSON. Las rutas son relativas a la raíz del
repositorio de Ánima.

## Visión objetivo (el norte del producto)

1. **Simulación de mundo**: un mundo con profundidad — más escenarios,
   materiales, clima, consecuencias — donde las cosas pasan por física propia
   y no por guion.
2. **Crafteo de habilidades generativo validado**: el modelo propone la
   habilidad y una puerta independiente decide si entra —
   \`validateSkillProgram\` (\`packages/skill-runtime/src/dsl.ts\`) comprueba la
   forma contra una DSL cerrada, y el evaluador la mide en mundos aislados.
3. **Crafteo de objetos generativo validado**: el modelo propone la receta y
   \`validateRecipe\` (\`packages/sim-core/src/recipe-validation.ts\`) comprueba
   que la idea sea coherente con la física — que no invente materia, comida ni
   poderes que el mundo no tiene. La mascota propone QUÉ construir; el mundo
   decide si es posible y con qué fidelidad le sale.

**El nombre importa**: esto se llamó «crafteo no determinista» y era el nombre
equivocado — nombraba el dado cuando lo que se quería era la propuesta. Son dos
ejes distintos y no conviene confundirlos:

- **Generativo validado** (lo que pide la visión): un generador no confiable
  propone, una puerta determinista del mundo decide. Es el principio 6 del
  README — «el generador propone, el evaluador independiente decide» —
  extendido de las habilidades a la física.
- **Estocástico reproducible** (mecánica de apoyo, ADR 0020): \`resolveCraft\`
  tira \`world.rng\` entre desenlaces ponderados. No genera nada: elige entre
  opciones que el mundo ya derivó. Dejó de ser predecible sin dejar de ser
  reproducible, que no es lo mismo que ser no determinista.

**Tensión a respetar**: el principio 1 del README («el mundo decide qué es
posible», motor determinista y snapshots reproducibles) no se rompe por ninguno
de los dos ejes. Lo que propone un modelo entra siempre por una puerta de
validación del mundo, nunca directo al estado. Y toda variación sale del **RNG
seedeado del mundo** (\`packages/shared/src/rng.ts\`): variable entre eventos y
corridas, pero reproducible con la misma semilla. Nunca \`Math.random()\` en el
motor.

## Estado de la corrida

- Mascota: ${view.pet ? `energía ${view.pet.energy.current.toFixed(1)}/${view.pet.energy.max}, salud ${view.pet.health.current}/${view.pet.health.max}, temperatura ${view.pet.temperature ? `${view.pet.temperature.current.toFixed(1)}/${view.pet.temperature.max}` : 'no siente frío'}, inventario: ${view.pet.inventory.map((i) => i.kind).join(', ') || 'vacío'}` : 'muerta o ausente'}
- Meta activa: ${view.currentGoal ? `«${view.currentGoal.description}» (${view.currentGoal.source})` : 'ninguna'}
- Estrategia actual: ${view.currentStrategy ?? 'ninguna'}
- Entidades visibles: ${entitySummary}
- Historia base completada: ${view.storyCompleted ? 'sí' : 'no'} · Legados acumulados: ${view.legacyCount}

## Recetas del mundo (${recipes.length} en total, ${invented.length} inventadas)

${recipes.map((r) => describeRecipe(r, !base.has(r.id))).join('\n') || '- (ninguna)'}

## Habilidades (${view.skills.length}, ${stableSkills.length} estables)

${skillLines.join('\n') || '- (todavía no creó ninguna)'}

Regresiones registradas: ${view.regressions.length}${view.regressions.length ? ` — ${view.regressions.map((r) => `${r.scenarioName} (semilla ${r.seed})`).join('; ')}` : ''}.

## Memoria

Hechos: ${view.facts.length ? view.facts.join(' · ') : '(ninguno)'}

Episodios (lo que hizo y le pasó):
${episodeLines.join('\n') || '- (ninguno todavía)'}

Hipótesis:
${hypothesisLines.join('\n') || '- (ninguna)'}

## Brechas contra la visión

### 1. Objetos: el eje funciona; inventa por encargo más que por necesidad

El eje 3 existe de punta a punta y funciona. \`inventRecipe\`
(\`packages/agent-core/src/agent.ts\`) le pide al proveedor un \`RecipeProposal\`
—un arquetipo, su idea de QUÉ construir—, la intención \`proposeRecipe\` viaja al
mundo, y \`resolveProposeRecipe\` (\`packages/sim-core/src/step.ts\`) la pasa por
\`validateRecipe\` antes de tocar \`world.recipes\`. El rechazo vuelve con motivo
y viaja al siguiente intento, así que corrige en vez de insistir. Los pesos los
deriva el mundo del otro lado de la puerta, nunca ella: un peso es
infalsificable (ADR 0020).

Tiene dos disparadores (ADR 0022): el frío sin fuego, y —el que más rinde— que
el cuidador le pida construir algo que su mundo no sabe hacer. Pedirle lo que no
sabe es pedirle una idea: la propuesta lleva el nombre que él usó, así que si el
mundo la acepta, lo que sigue es construirla. El crédito de
\`MAX_RECIPE_ATTEMPTS\` se cuenta por objetivo, no por vida.

Lo que falta es alcance, no puerta:

- **Sus propios problemas casi no le dan permiso de tener una idea.** El único
  disparador interno sigue siendo el frío. Un muro que no puede romper no le
  sugiere una herramienta mejor; un camino bloqueado no le sugiere nada. Hoy
  inventa por pedido ajeno mucho más que por necesidad propia.
- **Qué construir**: disparadores desde sus propios fracasos — cuando una
  estrategia queda prohibida por falta de CAPACIDAD (no de recurso), lo que
  falta puede ser un objeto que todavía no existe.

### 2. Habilidades: la puerta existe, el generador es un guion y la vara mide suerte

- \`validateSkillProgram\` + el evaluador aislado son la mitad validadora, y es
  buena: es el principio 6 del README y funciona.
- La mitad generativa casi no existe por defecto: \`MockModelProvider\` es
  determinista a propósito (ADR 0006), así que sin Codex la «propuesta» es un
  guion. El eje está validado pero apenas generado.
- Y la vara mide lo que no quiere medir: las skills se evalúan con semillas
  fijas \`[${evaluationSeeds.join(', ')}]\`
  (\`apps/web/src/session/GameSession.ts\` → \`packages/skill-evaluator/src/evaluate.ts\`)
  y el veredicto es binario. Con el crafteo variable (ADR 0020) una skill que
  construye puede pasar o fallar por la tirada, y un booleano lee eso como
  capacidad cuando es suerte.
- **Qué construir**: medir el éxito como distribución y no como booleano;
  muestrear semillas desde el RNG del mundo manteniendo las regresiones como
  casos fijos; variación real entre candidatas del mismo contrato.

### 3. La variación del mundo llegó al crafteo y ahí paró

Eje de apoyo, no el de la visión — pero la asimetría se nota:

- Los \`drops\` (talar el árbol, romper objetos) son listas fijas: el mundo
  nunca sorprende con lo que suelta. La calidad no los toca a propósito — la
  suerte decide qué tan bueno sale algo, nunca cuánta materia hay (ADR 0008),
  así que los drops probabilísticos son una decisión aparte y no una extensión
  de la tirada de crafteo.
- \`scaleByQuality\` (\`packages/sim-core/src/recipes.ts\`) deja fuera
  \`heatSource.range\` y \`hazard\`: hoy son forma, no calidad. Si el mundo
  quisiera fogatas que alcancen más lejos según cómo salieron, va ahí.
- **Qué construir**: drops probabilísticos con el mismo dado, y materiales con
  propiedades variables de origen (un tronco que ya viene mejor o peor).

### 4. El mundo es chico para llamarse simulación

- Todo ocurre en \`food-behind-wall\` (9×5) con ~4 tipos de entidad; el
  roadmap (\`docs/product/roadmap.md\`, sección 1) ya lista las carencias:
  un solo escenario, sin dolor, percepción solo por rango, sin agua/refugio.
- **Qué construir**: mapas más grandes con regiones, eventos del mundo
  (clima, ramas que caen — resuelve además el hallazgo abierto del ADR 0018:
  los troncos son inconseguibles porque se niega a talar), más señales
  internas y materiales con propiedades variables de origen.

## Prioridades sugeridas

1. Evaluación de skills con semillas muestreadas + métrica de éxito como
   distribución (sin perder las regresiones fijas). Con el crafteo variable, un
   veredicto booleano sobre 3 semillas lee la suerte como capacidad. Es ahora
   la brecha más urgente, y esta corrida trae la prueba de que la vara está
   rota más allá del azar: \`crear-casa\` v2 se promovió al 100% con el criterio
   «termina llevando un martillo», que no tiene nada que ver con una casa. Una
   skill que mide cualquier cosa siempre pasa.
2. Disparadores de invención desde sus propios fracasos: que una estrategia
   prohibida por falta de CAPACIDAD le sugiera que lo que falta es un objeto
   que todavía no existe. Hoy inventa por pedido del cuidador (ADR 0022) mucho
   más que por necesidad propia.
3. Drops probabilísticos y ramas caídas del árbol (desbloquea troncos: es el
   hallazgo abierto del ADR 0018 y lo que hace fracasar a \`conseguir-calor\`
   una versión tras otra).
4. Un segundo escenario jugable más grande que ejercite todo lo anterior.

## Datos crudos (JSON)

\`\`\`json
${JSON.stringify(raw, null, 2)}
\`\`\`
`;
}
