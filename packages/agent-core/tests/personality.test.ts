import { describe, expect, it } from 'vitest';
import type { EpisodicMemory, Hypothesis } from '@anima/memory';
import type { AgentEvent } from '../src/index.js';
import { derivePersonality, parseRename, parseUserMessage } from '../src/index.js';

function event(type: AgentEvent['type'], data: Record<string, unknown> = {}): AgentEvent {
  return { type, tick: 1, data };
}

function episode(kind: string, occurrences = 1): EpisodicMemory {
  return {
    id: `ep-${kind}-${occurrences}`,
    kind,
    summary: `episodio de ${kind}`,
    tick: 1,
    lastTick: 1,
    occurrences,
    importance: 0.5,
    data: {},
    archived: false,
  };
}

function hypothesis(statement: string): Hypothesis {
  return {
    id: `hyp-${statement}`,
    statement,
    confidence: 0.5,
    positiveEvidence: 0,
    negativeEvidence: 0,
    updatedAtTick: 1,
    resolved: 'pending',
  };
}

describe('derivePersonality (rasgos emergentes deterministas)', () => {
  it('una recién nacida no tiene rasgos: la personalidad se gana viviendo', () => {
    expect(derivePersonality({ events: [], episodes: [], hypotheses: [] })).toEqual([]);
  });

  it('misma historia ⇒ mismos rasgos, en el mismo orden', () => {
    const input = {
      events: [
        event('strategy.failed'),
        event('strategy.failed'),
        event('skill.created'),
        event('skill.test.started'),
        event('recipe.proposed'),
        event('recipe.learned'),
      ],
      episodes: [episode('signal'), episode('pain', 2), episode('promise-kept', 3)],
      hypotheses: [hypothesis('consumir alimento recupera energía')],
    };
    const first = derivePersonality(structuredClone(input));
    const second = derivePersonality(structuredClone(input));
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(2);
  });

  it('perseverante: fallar dos veces y aun así intentar un experimento', () => {
    const traits = derivePersonality({
      events: [event('strategy.failed'), event('strategy.failed'), event('skill.created')],
      episodes: [],
      hypotheses: [],
    });
    expect(traits.map((t) => t.id)).toContain('perseverante');
    // Sin construcción ni dolor ni pedidos: los demás no aparecen porque sí.
    expect(traits.map((t) => t.id)).not.toContain('constructora');
    expect(traits.map((t) => t.id)).not.toContain('precavida');
  });

  it('cada rasgo respeta su umbral: por debajo no existe', () => {
    // Un solo fallo no es perseverancia; un solo pedido cumplido no es servicial.
    const traits = derivePersonality({
      events: [event('strategy.failed')],
      episodes: [episode('promise-kept', 1)],
      hypotheses: [hypothesis('una sola idea')],
    });
    expect(traits).toEqual([]);
  });

  it('devuelve a lo sumo 4 rasgos, ordenados por evidencia', () => {
    const traits = derivePersonality({
      events: [
        // perseverante (2 fallos + 1 intento = 3), testaruda (2), constructora (1)
        event('strategy.failed'),
        event('strategy.failed'),
        event('skill.created'),
        event('user.request.refused', { classification: 'will_not' }),
        event('user.request.refused', { classification: 'will_not' }),
        event('recipe.learned'),
      ],
      episodes: [
        // precavida (1), servicial (2)
        episode('pain', 1),
        episode('promise-kept', 2),
      ],
      hypotheses: [
        // curiosa (3 hipótesis)
        hypothesis('a'),
        hypothesis('b'),
        hypothesis('c'),
      ],
    });
    expect(traits).toHaveLength(4);
    for (let i = 1; i < traits.length; i++) {
      expect(traits[i - 1]!.score).toBeGreaterThanOrEqual(traits[i]!.score);
    }
    // La evidencia acompaña a cada rasgo: el panel dice de dónde sale.
    expect(traits.every((t) => t.evidence.length > 0)).toBe(true);
  });

  it('una negativa por hechos (cannot) no cuenta como testarudez', () => {
    const traits = derivePersonality({
      events: [
        event('user.request.refused', { classification: 'cannot' }),
        event('user.request.refused', { classification: 'needs_information' }),
        event('user.request.refused', { classification: 'will_not' }),
      ],
      episodes: [],
      hypotheses: [],
    });
    expect(traits.map((t) => t.id)).not.toContain('testaruda');
  });
});

describe('parseRename (bautismos por chat, sin modelo)', () => {
  it('reconoce las formas frecuentes y conserva el nombre elegido', () => {
    expect(parseRename('te voy a llamar Luna')).toBe('Luna');
    expect(parseRename('Te llamaré Sol')).toBe('Sol');
    expect(parseRename('tu nombre es Nube')).toBe('Nube');
    expect(parseRename('desde hoy te llamás Piedrita')).toBe('Piedrita');
    expect(parseRename('te bautizo como Coco')).toBe('Coco');
  });

  it('capitaliza y limpia comillas y puntuación final', () => {
    expect(parseRename('te voy a llamar "luna"!')).toBe('Luna');
    expect(parseRename('tu nombre es   Luna Negra.')).toBe('Luna Negra');
  });

  it('una pregunta por el nombre no es un bautismo', () => {
    expect(parseRename('¿cómo te llamás?')).toBeNull();
    expect(parseRename('como te llamas')).toBeNull();
    expect(parseRename('hola, ¿qué hacés?')).toBeNull();
  });

  it('parseUserMessage clasifica el bautismo antes que cualquier orden', () => {
    const parsed = parseUserMessage('te voy a llamar Luna');
    expect(parsed).toEqual({ kind: 'rename-pet', name: 'Luna', raw: 'te voy a llamar Luna' });
    // Y no confunde órdenes normales con bautismos.
    expect(parseUserMessage('trae la rama').kind).toBe('fetch-item');
  });
});
