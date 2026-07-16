import { describe, expect, it } from 'vitest';
import { validateSkillProgram, validateSuccessCriteria } from '@anima/skill-runtime';
import type { CodexTransportInput } from '../src/index.js';
import { CodexModelProvider, reachBlockedResourceProgram } from '../src/index.js';

function transportReturning(text: string, seen: CodexTransportInput[] = []) {
  return async (input: CodexTransportInput) => {
    seen.push(input);
    return text;
  };
}

describe('CodexModelProvider', () => {
  it('construye prompts con el catálogo de la DSL y el problema', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ program: [{ op: 'wait' }], rationale: 'x' }), seen),
    );
    await provider.complete({
      kind: 'skill.propose',
      skillName: 'alcanzar-alimento',
      problem: 'llegar al alimento bloqueado',
      context: ['veo: wall', 'veo: hammer (herramienta, poder 8)'],
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind).toBe('skill.propose');
    expect(seen[0]?.prompt).toContain('repeatWithLimit');
    expect(seen[0]?.prompt).toContain('llegar al alimento bloqueado');
    expect(seen[0]?.prompt).toContain('veo: hammer');
    expect(seen[0]?.schema).toMatchObject({ required: ['programJson', 'rationale'] });
  });

  it('parsea un programa devuelto como programJson (y este valida en la DSL)', async () => {
    const program = reachBlockedResourceProgram('strongestTool');
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({ programJson: JSON.stringify(program), rationale: 'usar la más fuerte' }),
      ),
    );
    const response = await provider.complete({
      kind: 'skill.propose',
      skillName: 'x',
      problem: 'p',
      context: [],
    });
    expect(response.kind).toBe('skill.program');
    if (response.kind === 'skill.program') {
      expect(validateSkillProgram(response.program).ok).toBe(true);
      expect(response.rationale).toBe('usar la más fuerte');
    }
  });

  it('tolera respuestas con vallas markdown', async () => {
    const provider = new CodexModelProvider(
      transportReturning('```json\n{"text": "hola cuidador"}\n```'),
    );
    const response = await provider.complete({ kind: 'dialogue', topic: 't', facts: [] });
    expect(response).toEqual({ kind: 'dialogue', text: 'hola cuidador' });
  });

  it('incluye el historial reciente en el prompt de diálogo', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(transportReturning('{"text":"lo intento"}', seen));
    await provider.complete({
      kind: 'dialogue',
      topic: 'hacelo igual',
      facts: ['llevo conmigo: hammer'],
      history: [
        { from: 'user', text: 'talá el árbol' },
        { from: 'pet', text: 'No quiero destruirlo.' },
      ],
    });

    expect(seen[0]?.prompt).toContain('Cuidador: talá el árbol');
    expect(seen[0]?.prompt).toContain('Mascota: No quiero destruirlo.');
    expect(seen[0]?.prompt).toContain('Mensaje de tu cuidador: hacelo igual');
  });

  it('interpreta una orden libre como una intención estructurada', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          action: 'move-direction',
          targetKind: '',
          directions: ['up', 'left'],
          summary: '',
        }),
        seen,
      ),
    );

    const response = await provider.complete({
      kind: 'interpret.command',
      text: 'pegá un pasito rumbo al rincón noroeste',
      facts: ['ahora veo: food, tree'],
      history: [{ from: 'pet', text: 'Estoy junto al árbol.' }],
    });

    expect(response).toEqual({
      kind: 'command.interpretation',
      command: { action: 'move-direction', directions: ['up', 'left'] },
    });
    expect(seen[0]?.schema).toMatchObject({
      required: ['action', 'targetKind', 'directions', 'skillName', 'summary'],
    });
    expect(seen[0]?.prompt).toContain('pegá un pasito rumbo al rincón noroeste');
    expect(seen[0]?.prompt).toContain('Mascota: Estoy junto al árbol.');
  });

  it('ofrece aprender lo que no sabe y ejecutar lo que ya aprendió', async () => {
    const seen: CodexTransportInput[] = [];
    const learn = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          action: 'learn-skill',
          targetKind: '',
          directions: [],
          skillName: '',
          summary: 'bailar moviéndose de lado a lado',
        }),
        seen,
      ),
    );
    await expect(
      learn.complete({
        kind: 'interpret.command',
        text: 'baila',
        facts: [],
        skills: [{ name: 'ronda', description: 'dar una vuelta' }],
      }),
    ).resolves.toEqual({
      kind: 'command.interpretation',
      command: { action: 'learn-skill', summary: 'bailar moviéndose de lado a lado' },
    });
    // El repertorio ya aprendido y el límite del cuerpo viajan en el prompt:
    // sin ellos el modelo no puede distinguir run-skill de learn-skill ni de
    // unsupported.
    expect(seen[0]?.prompt).toContain('ronda: dar una vuelta');
    expect(seen[0]?.prompt).toContain('NO puede: saltar');

    const run = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          action: 'run-skill',
          targetKind: '',
          directions: [],
          skillName: 'baile-basico',
          summary: '',
        }),
      ),
    );
    await expect(
      run.complete({ kind: 'interpret.command', text: 'baila', facts: [] }),
    ).resolves.toEqual({
      kind: 'command.interpretation',
      command: { action: 'run-skill', skillName: 'baile-basico' },
    });
  });

  it('el contrato llega sin el relleno del esquema y valida como criterios', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          name: 'baile-basico',
          purpose: 'bailar de lado a lado',
          expectedOutcome: 'termina donde empezó',
          // El esquema obliga a mandar kind y value siempre: aquí van vacíos.
          successCriteria: [
            { type: 'minMoves', kind: '', value: 4 },
            { type: 'returnedToStart', kind: '', value: 0 },
          ],
        }),
        seen,
      ),
    );

    const response = await provider.complete({
      kind: 'skill.contract',
      request: 'bailar',
      conversation: [{ from: 'user', text: 'movete de un lado a otro' }],
      facts: ['ahora veo: food'],
    });

    expect(response.kind).toBe('skill.contract');
    const criteria =
      response.kind === 'skill.contract' ? response.contract.successCriteria : undefined;
    // El relleno se fue: lo que queda pasa la puerta estricta del agente.
    expect(criteria).toEqual([{ type: 'minMoves', value: 4 }, { type: 'returnedToStart' }]);
    const validated = validateSuccessCriteria(criteria);
    expect(validated.ok).toBe(true);
    expect(seen[0]?.prompt).toContain('Cuidador: movete de un lado a otro');
  });

  it('destila una enseñanza a un enunciado guardable', async () => {
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({ statement: 'los troncos sirven para construir', confidence: 1.4 }),
      ),
    );

    await expect(
      provider.complete({
        kind: 'distill.knowledge',
        text: 'mirá, con eso se construye',
        conversation: [{ from: 'user', text: 'agarrá el tronco' }],
      }),
    ).resolves.toEqual({
      kind: 'knowledge',
      statement: 'los troncos sirven para construir',
      confidence: 1,
    });
  });

  it('rechaza JSON inválido o formas incorrectas con errores claros', async () => {
    const badJson = new CodexModelProvider(transportReturning('esto no es json'));
    await expect(badJson.complete({ kind: 'dialogue', topic: 't', facts: [] })).rejects.toThrow(
      'no es JSON válido',
    );

    const badShape = new CodexModelProvider(transportReturning('{"otra": "cosa"}'));
    await expect(
      badShape.complete({
        kind: 'interpret.signal',
        signal: 'energy-low',
      }),
    ).rejects.toThrow('hypothesis/confidence');

    const badCommand = new CodexModelProvider(
      transportReturning(
        '{"action":"move-direction","targetKind":"","directions":[],"summary":""}',
      ),
    );
    await expect(
      badCommand.complete({ kind: 'interpret.command', text: 'andá por ahí', facts: [] }),
    ).rejects.toThrow('direcciones válidas');
  });

  it('la confianza queda acotada a [0,1] y emite señales de ocupado', async () => {
    const busy: boolean[] = [];
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ hypothesis: 'h', confidence: 3.5 })),
      { onBusy: (b) => busy.push(b) },
    );
    const response = await provider.complete({ kind: 'interpret.signal', signal: 'energy-low' });
    if (response.kind === 'interpretation') {
      expect(response.confidence).toBe(1);
    }
    expect(busy).toEqual([true, false]);
    expect(provider.callCount('interpret.signal')).toBe(1);
  });

  it('la revisión incluye el programa previo y las observaciones', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ program: [{ op: 'wait' }], rationale: '' }), seen),
    );
    await provider.complete({
      kind: 'skill.revise',
      skillName: 'x',
      previousProgram: [{ op: 'consume', target: 'food' }],
      failureObservations: ['no-damage-dealt:branch->wall'],
      attempt: 2,
    });
    expect(seen[0]?.prompt).toContain('no-damage-dealt:branch->wall');
    expect(seen[0]?.prompt).toContain('"consume"');
  });
});
