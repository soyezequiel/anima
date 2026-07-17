import type { EpisodicMemory, Hypothesis } from '@anima/memory';
import type { AgentEvent } from './events.js';

/**
 * Rasgos de personalidad emergentes. No son un atributo que se sortea al
 * nacer ni una opinión del modelo: se DERIVAN de forma determinista de la
 * historia real de la mascota (sus eventos y episodios, que ya persisten).
 * El modelo puede ponerles voz en el diálogo — recibe los rasgos como hechos —
 * pero jamás los define: misma historia, mismos rasgos. Ver ADR 0021.
 */
export interface PersonalityTrait {
  id: 'curiosa' | 'perseverante' | 'constructora' | 'precavida' | 'servicial' | 'testaruda';
  /** El rasgo en voz humana (adjetivo femenino: la mascota es "ella"). */
  label: string;
  /** De dónde sale: los conteos que lo justifican, en una frase. */
  evidence: string;
  /** Cuánta historia lo respalda; ordena los rasgos entre sí. */
  score: number;
}

export interface PersonalityInput {
  events: AgentEvent[];
  episodes: EpisodicMemory[];
  hypotheses: Hypothesis[];
}

const MAX_TRAITS = 4;

/** Suma las ocurrencias de los episodios de un tipo (los repetidos se fusionan). */
function episodeCount(episodes: EpisodicMemory[], kind: string): number {
  return episodes
    .filter((episode) => episode.kind === kind)
    .reduce((sum, episode) => sum + episode.occurrences, 0);
}

function countEvents(events: AgentEvent[], type: AgentEvent['type']): number {
  return events.filter((event) => event.type === type).length;
}

/**
 * Deriva 0–4 rasgos de la historia. Es una función pura: mismos eventos y
 * episodios ⇒ mismos rasgos, siempre. Una recién nacida no tiene ninguno —
 * la personalidad se gana viviendo, no se asigna.
 *
 * Cada rasgo tiene un umbral fijo (documentado en el ADR 0021): por debajo no
 * existe, por encima aparece con la evidencia que lo respalda. Se devuelven a
 * lo sumo `MAX_TRAITS`, ordenados por cuánta historia los sostiene.
 */
export function derivePersonality(input: PersonalityInput): PersonalityTrait[] {
  const { events, episodes, hypotheses } = input;

  const hypothesesFormed = hypotheses.length;
  const signalsWondered = episodeCount(episodes, 'signal');
  const recipesProposed = countEvents(events, 'recipe.proposed');
  const recipesLearned = countEvents(events, 'recipe.learned');
  const craftsAccepted = events.filter(
    (event) =>
      event.type === 'user.request.accepted' &&
      (event.data.request as { kind?: string } | undefined)?.kind === 'craft-item',
  ).length;
  const buildStrategies = events.filter(
    (event) =>
      event.type === 'strategy.selected' &&
      String(event.data.strategy ?? '').startsWith('build-fire:'),
  ).length;
  const painSuffered = episodeCount(episodes, 'pain') + countEvents(events, 'pain.reflex');
  const strategyFailures = countEvents(events, 'strategy.failed');
  const skillAttempts =
    countEvents(events, 'skill.created') + countEvents(events, 'skill.test.started');
  const promisesKept = episodeCount(episodes, 'promise-kept');
  const refusalsByValues = events.filter(
    (event) =>
      event.type === 'user.request.refused' && event.data.classification === 'will_not',
  ).length;

  const candidates: { trait: PersonalityTrait; qualifies: boolean }[] = [
    {
      trait: {
        id: 'curiosa',
        label: 'curiosa',
        evidence: `se hizo ${hypothesesFormed} hipótesis del mundo y propuso ${recipesProposed} invento(s)`,
        score: hypothesesFormed + signalsWondered + recipesProposed,
      },
      qualifies: hypothesesFormed + signalsWondered + recipesProposed >= 3,
    },
    {
      trait: {
        id: 'perseverante',
        label: 'perseverante',
        evidence: `falló ${strategyFailures} veces y aun así intentó ${skillAttempts} experimento(s) nuevos`,
        score: strategyFailures + skillAttempts,
      },
      qualifies: strategyFailures >= 2 && skillAttempts >= 1,
    },
    {
      trait: {
        id: 'constructora',
        label: 'constructora',
        evidence: `construyó o aprendió a construir ${recipesLearned + craftsAccepted + buildStrategies} vez/veces`,
        score: recipesLearned + craftsAccepted + buildStrategies,
      },
      qualifies: recipesLearned + craftsAccepted + buildStrategies >= 1,
    },
    {
      trait: {
        id: 'precavida',
        label: 'precavida',
        evidence: `se lastimó ${painSuffered} vez/veces y aprendió a apartarse de lo que daña`,
        score: painSuffered,
      },
      qualifies: painSuffered >= 1,
    },
    {
      trait: {
        id: 'servicial',
        label: 'servicial',
        evidence: `cumplió ${promisesKept} pedidos de su cuidador`,
        score: promisesKept,
      },
      qualifies: promisesKept >= 2,
    },
    {
      trait: {
        id: 'testaruda',
        label: 'testaruda',
        evidence: `se negó ${refusalsByValues} veces a hacer algo con lo que no estaba de acuerdo`,
        score: refusalsByValues,
      },
      qualifies: refusalsByValues >= 2,
    },
  ];

  // El orden de declaración desempata: con el mismo puntaje, gana el rasgo
  // que aparece antes en la lista. Nada aquí depende de azar ni de un modelo.
  return candidates
    .filter((candidate) => candidate.qualifies)
    .map((candidate) => candidate.trait)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_TRAITS);
}
