import type { Recipe } from '@anima/sim-core';
import type { GameView } from './view.js';

/**
 * Reporte descargable pensado para pegarle a Claude Code: describe el estado
 * real de una corrida y las brechas entre el código actual y la visión del
 * producto (simulación de mundo con crafteo no determinista de habilidades y
 * de objetos). Es texto plano deliberadamente: la evidencia viva (skills,
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

function describeRecipe(recipe: Recipe, invented: boolean): string {
  const ingredients = recipe.ingredients.map((i) => `${i.count}× ${i.kind}`).join(' + ');
  const componentKeys = Object.keys(recipe.output.components).join(', ') || 'sin componentes';
  const origin = invented ? 'inventada por Ánima' : 'base del mundo';
  return `- \`${recipe.id}\` (${origin}): ${ingredients} → 1× ${recipe.output.kind} (${componentKeys}). Resultado fijo: siempre el mismo arquetipo.`;
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
2. **Crafteo de habilidades no determinista**: crear una habilidad debe poder
   salir distinto cada vez — resultados graduales, variación entre intentos —
   no un pipeline cuyo desenlace está fijado por la semilla.
3. **Crafteo de objetos no determinista**: craftear debe admitir variación —
   calidad del producto, fallos parciales, resultados alternativos — no un
   único arquetipo fijo por receta.

**Tensión a respetar**: el principio 1 del README («el mundo decide qué es
posible», motor determinista y snapshots reproducibles) no se rompe. El no
determinismo pedido debe salir del **RNG seedeado del mundo**
(\`packages/shared/src/rng.ts\`): variable entre eventos y corridas, pero
reproducible con la misma semilla. Nunca \`Math.random()\` en el motor.

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

Hipótesis:
${hypothesisLines.join('\n') || '- (ninguna)'}

## Brechas contra la visión

### 1. El crafteo de objetos es 100% determinista

- \`resolveCraft\` (\`packages/sim-core/src/step.ts\`) consume los ingredientes
  y spawnea \`recipe.output\` clonado tal cual, siempre: no hay tirada de
  éxito, ni calidad variable, ni resultados alternativos. \`Recipe\`
  (\`packages/sim-core/src/recipes.ts\`) declara un único \`output\` fijo.
- Los \`drops\` (talar el árbol, romper objetos) también son listas fijas: el
  mundo nunca sorprende con lo que suelta.
- Evidencia viva: las ${recipes.length} recetas de esta corrida producen
  siempre el mismo arquetipo.
- **Qué construir**: resultados ponderados por receta (lista de \`outcomes\`
  con pesos, resueltos con el RNG del mundo), calidad/durabilidad variable del
  producto, fallo parcial que consume solo parte de los ingredientes, y drops
  probabilísticos. La puerta \`validateRecipe\` (ADR 0018) debe validar los
  outcomes igual que hoy valida el output único.

### 2. El crafteo de habilidades es determinista de punta a punta

- Las skills se evalúan con semillas fijas \`[${evaluationSeeds.join(', ')}]\`
  (\`apps/web/src/session/GameSession.ts\` → \`packages/skill-evaluator/src/evaluate.ts\`):
  el mismo programa da siempre el mismo veredicto.
- \`MockModelProvider\` es determinista a propósito (ADR 0006): sin Codex, la
  «creación» de una skill es un guion.
- La promoción es binaria (pasa/no pasa): no hay habilidades que salgan
  mejores o peores, ni variación entre intentos de creación.
- **Qué construir**: muestrear semillas de evaluación desde el RNG del mundo
  (manteniendo las regresiones como casos fijos), medir éxito como
  distribución y no como booleano, atributos emergentes por skill (potencia,
  costo) que dependan de cómo salió la evaluación, y variación real entre
  candidatas del mismo contrato.

### 3. El mundo es chico para llamarse simulación

- Todo ocurre en \`food-behind-wall\` (9×5) con ~4 tipos de entidad; el
  roadmap (\`docs/product/roadmap.md\`, sección 1) ya lista las carencias:
  un solo escenario, sin dolor, percepción solo por rango, sin agua/refugio.
- **Qué construir**: mapas más grandes con regiones, eventos del mundo
  (clima, ramas que caen — resuelve además el hallazgo abierto del ADR 0018:
  los troncos son inconseguibles porque se niega a talar), más señales
  internas y materiales con propiedades variables de origen.

## Prioridades sugeridas

1. Outcomes ponderados en \`Recipe\` + tirada con el RNG del mundo en
   \`resolveCraft\` (es la brecha más directa contra la visión).
2. Calidad variable del producto crafteado (componentes escalados por la
   tirada) y su validación en \`validateRecipe\`.
3. Evaluación de skills con semillas muestreadas + métrica de éxito como
   distribución (sin perder las regresiones fijas).
4. Drops probabilísticos y ramas caídas del árbol (desbloquea troncos).
5. Un segundo escenario jugable más grande que ejercite todo lo anterior.

## Datos crudos (JSON)

\`\`\`json
${JSON.stringify(raw, null, 2)}
\`\`\`
`;
}
