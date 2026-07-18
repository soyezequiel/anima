import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse } from '@anima/model-providers';
import { MockModelProvider, reachBlockedResourceProgram } from '@anima/model-providers';
import { RegressionStore } from '@anima/skill-evaluator';
import { SkillLibrary } from '@anima/skill-runtime';
import { foodBehindWall, MVP_SCENARIOS } from '@anima/test-scenarios';
import { AnimaAgent, runAgentInWorld } from '../src/index.js';

/**
 * El agujero del reporte real (t2): pedirle "alcanzar el alimento bloqueado" y
 * que proponga —una versión tras otra— pura navegación, porque el contexto que
 * recibía el diseñador aplanaba el muro a "veo: wall" y nunca decía que cierra
 * el paso ni que se rompe. Con el muro completo no hay rodeo: la única salida es
 * agarrar el martillo y romperlo. Este test custodia que esa verdad le llegue.
 */

/** Guionado por tipo, conservando cada petición para inspeccionar qué vio. */
class RecordingByKind extends MockModelProvider {
  override readonly interpretsLanguage = true;
  readonly seen: ModelRequest[] = [];
  constructor(private byKind: Partial<Record<ModelRequest['kind'], ModelResponse>>) {
    super();
  }
  override complete(request: ModelRequest): Promise<ModelResponse> {
    this.seen.push(request);
    const canned = this.byKind[request.kind];
    if (canned) {
      this.recordCall(request.kind);
      return Promise.resolve(canned);
    }
    return super.complete(request);
  }
}

describe('el diseñador de habilidades ve que el muro cierra el paso y se rompe', () => {
  it('ante el alimento amurallado, el contexto del skill.propose ofrece romper el muro con la herramienta', async () => {
    const provider = new RecordingByKind({
      // Que la propuesta ya sea la correcta detiene el ciclo en la v1: acá lo
      // que se mide es QUÉ vio el diseñador, no cuántas veces lo intentó.
      'skill.propose': {
        kind: 'skill.program',
        program: reachBlockedResourceProgram('strongestTool'),
        rationale: 'romper el muro con la herramienta fuerte',
      },
    });
    const { world, petId } = foodBehindWall.build(5);
    const agent = new AnimaAgent({
      petId,
      petName: 'Anima',
      provider,
      library: new SkillLibrary(),
      regressions: new RegressionStore(),
      evaluationScenarios: MVP_SCENARIOS,
      evaluationSeeds: [11, 22, 33],
      guidanceEnabled: true,
      now: () => '2026-07-18T00:00:00Z',
    });

    await runAgentInWorld(world, agent, { maxTicks: 40 });

    const proposal = provider.seen.find(
      (r): r is Extract<ModelRequest, { kind: 'skill.propose' }> => r.kind === 'skill.propose',
    );
    expect(proposal).toBeDefined();
    const context = proposal?.context ?? [];

    // La pista concreta: no hay rodeo, hay que romperlo, y con qué.
    const hint = context.find((line) => /romper/i.test(line));
    expect(hint).toBeDefined();
    expect(hint).toMatch(/wall/);
    expect(hint).toMatch(/hammer/);

    // Y el muro ya no es un "veo: wall" pelado: dice que cierra el paso y cede.
    expect(context.some((line) => /veo: wall .*cierra el paso.*se rompe/.test(line))).toBe(true);
  });
});
