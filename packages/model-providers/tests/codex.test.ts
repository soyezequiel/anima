import { describe, expect, it } from 'vitest';
import { validateSkillProgram, validateSuccessCriteria } from '@anima/skill-runtime';
import type { CodexThought, CodexTransportInput } from '../src/index.js';
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

  /**
   * ADR 0013 revisado. El prompt de charla ordenaba literalmente «pide que
   * reformule la orden, porque este canal solo conversa», y el clasificador
   * mandaba todo pedido implícito a not-command. Entre las dos cosas, un
   * "tenés árboles para cortarlos" se contestaba con una explicación de la
   * interfaz — rompiendo el personaje y devolviéndole el trabajo al cuidador.
   */
  it('el prompt de charla no le hace explicar la interfaz ni pedir que reformulen', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(transportReturning('{"text":"voy"}', seen));
    await provider.complete({ kind: 'dialogue', topic: 'no lo veo', facts: [] });

    const prompt = seen[0]?.prompt ?? '';
    expect(prompt).toContain('Nunca hables de la interfaz');
    expect(prompt).not.toContain('pide que reformule la orden');
    expect(prompt).not.toContain('este canal solo');
  });

  it('el clasificador manda los pedidos implícitos a la acción, no a not-command', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({ action: 'destroy-entity', targetKind: 'tree', summary: '' }),
        seen,
      ),
    );
    await provider.complete({
      kind: 'interpret.command',
      text: 'tenés árboles para cortarlos y conseguir troncos',
      facts: ['ahora veo: tree'],
    });

    const prompt = seen[0]?.prompt ?? '';
    expect(prompt).toContain('Un pedido no deja de ser un pedido por estar dicho de costado');
    expect(prompt).toContain('Ante la duda entre not-command y una acción, elige la acción');
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
      required: [
        'action',
        'targetKind',
        'verb',
        'amount',
        'directions',
        'skillName',
        'recipeId',
        'summary',
        'name',
      ],
    });
    expect(seen[0]?.prompt).toContain('pegá un pasito rumbo al rincón noroeste');
    expect(seen[0]?.prompt).toContain('Mascota: Estoy junto al árbol.');
  });

  it('interpreta un bautismo como rename-pet con el nombre elegido', async () => {
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          action: 'rename-pet',
          name: ' Luna ',
          targetKind: '',
          amount: 0,
          directions: [],
          skillName: '',
          recipeId: '',
          summary: '',
        }),
      ),
    );
    const response = await provider.complete({
      kind: 'interpret.command',
      text: 'desde hoy te voy a llamar Luna, ¿te gusta?',
      facts: [],
    });
    expect(response).toEqual({
      kind: 'command.interpretation',
      command: { action: 'rename-pet', name: 'Luna' },
    });
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

  it('traduce una descripción del cuidador con el mismo sobre que las recetas', async () => {
    const seen: CodexTransportInput[] = [];
    const recipe = {
      id: 'glorb',
      output: { kind: 'glorb', components: { heatSource: { warmthPerTick: 0.5, range: 2 } } },
      ingredients: [{ kind: 'flint', count: 1 }],
    };
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({ recipeJson: JSON.stringify(recipe), rationale: 'da calor: heatSource' }),
        seen,
      ),
    );

    const response = await provider.complete({
      kind: 'entity.describe',
      description: 'un glorb es un mineral azul que da calor',
      knownKinds: ['log', 'flint'],
      existingRecipes: ['campfire (2x log + 1x flint)'],
    });

    // La receta viaja cruda: el mundo la valida, igual que en recipe.propose.
    expect(response).toEqual({ kind: 'recipe', recipe, rationale: 'da calor: heatSource' });
    // El prompt lleva la descripción, el catálogo de componentes con sus cotas
    // y lo que ya existe: los mismos límites que rigen para la mascota.
    expect(seen[0]?.kind).toBe('entity.describe');
    expect(seen[0]?.prompt).toContain('un glorb es un mineral azul que da calor');
    expect(seen[0]?.prompt).toContain('heatSource');
    expect(seen[0]?.prompt).toContain('No puedes inventar comida');
    expect(seen[0]?.prompt).toContain('- flint');
    expect(seen[0]?.prompt).toContain('campfire (2x log + 1x flint)');
    expect(seen[0]?.schema).toMatchObject({ required: ['recipeJson', 'rationale'] });
  });

  it('recipe.propose: un array de recetas viaja como árbol de crafteo (ADR 0031)', async () => {
    const plan = [
      {
        id: 'tabla',
        output: { kind: 'tabla', components: { portable: {} } },
        ingredients: [{ kind: 'log', count: 1 }],
      },
      {
        id: 'pared',
        output: { kind: 'pared', components: { portable: {}, collider: { solid: true } } },
        ingredients: [{ kind: 'tabla', count: 2 }],
      },
    ];
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ recipeJson: JSON.stringify(plan), rationale: 'partes' })),
    );
    const response = await provider.complete({
      kind: 'recipe.propose',
      problem: 'construir una pared',
      wantedId: 'pared',
      materials: ['log (lo veo)'],
      existingRecipes: [],
    });
    expect(response).toEqual({ kind: 'recipe-plan', recipes: plan, rationale: 'partes' });
  });

  it('recipe.propose: un objeto con blueprint viaja como obra (ADR 0032)', async () => {
    const obra = {
      recipes: [
        {
          id: 'pared',
          output: { kind: 'pared', components: { portable: {}, collider: { solid: true } } },
          ingredients: [{ kind: 'log', count: 1 }],
        },
      ],
      blueprint: {
        id: 'casa',
        placements: [{ kind: 'pared', offset: { x: 0, y: -1 } }],
      },
    };
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ recipeJson: JSON.stringify(obra), rationale: 'obra' })),
    );
    const response = await provider.complete({
      kind: 'recipe.propose',
      problem: 'construir una casa',
      wantedId: 'casa',
      materials: ['log (lo veo)'],
      existingRecipes: [],
    });
    expect(response).toEqual({
      kind: 'blueprint',
      blueprint: obra.blueprint,
      recipes: obra.recipes,
      rationale: 'obra',
    });
  });

  it('recipe.propose: una receta suelta sigue viajando como antes', async () => {
    const recipe = {
      id: 'brasero',
      output: { kind: 'brasero', components: { heatSource: { warmthPerTick: 0.5, range: 2 } } },
      ingredients: [{ kind: 'log', count: 2 }],
    };
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ recipeJson: JSON.stringify(recipe), rationale: 'calor' })),
    );
    const response = await provider.complete({
      kind: 'recipe.propose',
      problem: 'tengo frío',
      materials: ['log (lo veo)'],
      existingRecipes: [],
    });
    expect(response).toEqual({ kind: 'recipe', recipe, rationale: 'calor' });
  });

  it('interpreta una descripción de objeto como describe-entity', async () => {
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          action: 'describe-entity',
          targetKind: '',
          directions: [],
          summary: 'un glorb es un mineral azul que da calor',
        }),
      ),
    );
    const response = await provider.complete({
      kind: 'interpret.command',
      text: 'un glorb es un mineral azul que da calor',
      facts: [],
    });
    expect(response).toEqual({
      kind: 'command.interpretation',
      command: {
        action: 'describe-entity',
        description: 'un glorb es un mineral azul que da calor',
      },
    });

    // Con el summary vacío, vale el mensaje original: la descripción es de él.
    const emptySummary = new CodexModelProvider(
      transportReturning(
        JSON.stringify({ action: 'describe-entity', targetKind: '', directions: [], summary: '' }),
      ),
    );
    await expect(
      emptySummary.complete({
        kind: 'interpret.command',
        text: 'un glorb da calor',
        facts: [],
      }),
    ).resolves.toEqual({
      kind: 'command.interpretation',
      command: { action: 'describe-entity', description: 'un glorb da calor' },
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
      reason: 'evaluation-failed',
      problem: 'llegar hasta el alimento y consumirlo',
      successCriteria: ['consume un objeto de tipo food'],
      context: ['veo: hammer (herramienta, poder 3)'],
      previousProgram: [{ op: 'consume', target: 'food' }],
      failureObservations: ['no-damage-dealt:branch->wall'],
      attempt: 2,
    });
    expect(seen[0]?.prompt).toContain('no-damage-dealt:branch->wall');
    expect(seen[0]?.prompt).toContain('"consume"');
    expect(seen[0]?.prompt).toContain('llegar hasta el alimento y consumirlo');
    expect(seen[0]?.prompt).toContain('consume un objeto de tipo food');
  });

  it('la revisión lleva la historia de versiones y el resultado mundo por mundo', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ program: [{ op: 'wait' }], rationale: '' }), seen),
    );
    await provider.complete({
      kind: 'skill.revise',
      skillName: 'x',
      reason: 'evaluation-failed',
      problem: 'llegar hasta el alimento',
      successCriteria: ['su energía termina más alta'],
      context: [],
      previousProgram: [{ op: 'wait' }],
      failureObservations: ['criteria-failed:energyIncreased'],
      baseVersion: 2,
      caseResults: [
        { scenario: 'open-field', seed: 11, verdict: 'passed', observations: [] },
        {
          scenario: 'food-behind-wall',
          seed: 11,
          verdict: 'failed',
          observations: ['path-blocked:4'],
        },
        {
          scenario: 'cold-night',
          seed: 22,
          verdict: 'inconclusive',
          observations: ['craft-failed:attempt-failed'],
        },
      ],
      history: [
        {
          version: 1,
          rationale: 'ir directo',
          successRate: 0,
          failureObservations: ['aborted:no-candidates:muros'],
        },
        {
          version: 2,
          rationale: 'sin buscar muros',
          successRate: 0.5,
          failureObservations: ['criteria-failed:energyIncreased'],
        },
      ],
      attempt: 3,
      maxAttempts: 8,
    });
    const prompt = seen[0]?.prompt ?? '';
    expect(prompt).toContain('v1 (éxito 0%)');
    expect(prompt).toContain('v2 (éxito 50%)');
    expect(prompt).toContain('open-field: PASÓ en 1 mundo (semillas 11)');
    expect(prompt).toContain('food-behind-wall: FALLÓ en 1 mundo — path-blocked:4 (semillas 11)');
    // Un mundo que no dio se muestra como tal: si se leyera «FALLÓ», el modelo
    // gastaría el intento corrigiendo una tirada perdida (ADR 0030).
    expect(prompt).toContain('cold-night: SIN VEREDICTO');
    expect(prompt).not.toContain('cold-night: FALLÓ');
    expect(prompt).toContain('(v2, la mejor hasta ahora)');
    expect(prompt).toContain('Intento 3 de 8');
  });

  it('los mundos que fallan igual se agrupan: 20 semillas no son 20 renglones (ADR 0040)', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ program: [{ op: 'wait' }], rationale: '' }), seen),
    );
    await provider.complete({
      kind: 'skill.revise',
      skillName: 'x',
      reason: 'evaluation-failed',
      problem: 'llegar hasta el alimento',
      successCriteria: [],
      context: [],
      previousProgram: [{ op: 'wait' }],
      failureObservations: ['criteria-failed:consumedKind:food'],
      caseResults: Array.from({ length: 20 }, (_, i) => ({
        scenario: 'food-behind-wall',
        seed: 100 + i,
        verdict: 'failed' as const,
        observations: ['criteria-failed:consumedKind:food'],
      })),
      attempt: 2,
    });
    const prompt = seen[0]?.prompt ?? '';
    expect(prompt).toContain(
      'food-behind-wall: FALLÓ en 20 mundos — criteria-failed:consumedKind:food (semillas 100, 101, 102, …)',
    );
    // Una sola línea para los 20: el prompt no repite la misma evidencia.
    expect(prompt.match(/FALLÓ en/g)).toHaveLength(1);
  });
});

describe('pensamiento en vivo (hook onThought)', () => {
  it('cuenta start, los eventos del transporte y el cierre done, con el mismo seq', async () => {
    const thoughts: CodexThought[] = [];
    const provider = new CodexModelProvider(
      async (input) => {
        input.onEvent?.({ type: 'reasoning', text: '**eligiendo saludo**' });
        input.onEvent?.({ type: 'answer', text: '{"text":"hola"}' });
        return '{"text":"hola"}';
      },
      { onThought: (thought) => thoughts.push(thought) },
    );
    await provider.complete({ kind: 'dialogue', topic: 't', facts: [] });
    expect(thoughts).toEqual([
      { seq: 1, kind: 'dialogue', event: 'start' },
      { seq: 1, kind: 'dialogue', event: 'reasoning', text: '**eligiendo saludo**' },
      { seq: 1, kind: 'dialogue', event: 'answer', text: '{"text":"hola"}' },
      { seq: 1, kind: 'dialogue', event: 'done' },
    ]);

    // La consulta siguiente estrena seq: el oyente puede distinguirlas.
    await provider.complete({ kind: 'dialogue', topic: 't2', facts: [] });
    expect(thoughts.at(-1)).toEqual({ seq: 2, kind: 'dialogue', event: 'done' });
  });

  it('una respuesta inservible cierra con error, no con done', async () => {
    const thoughts: CodexThought[] = [];
    const provider = new CodexModelProvider(async () => 'esto no es json', {
      onThought: (thought) => thoughts.push(thought),
    });
    await expect(provider.complete({ kind: 'dialogue', topic: 't', facts: [] })).rejects.toThrow(
      /JSON/,
    );
    expect(thoughts.at(-1)).toMatchObject({ seq: 1, kind: 'dialogue', event: 'error' });
    expect(thoughts.some((t) => t.event === 'done')).toBe(false);
  });

  it('sin oyente, el transporte no recibe onEvent', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(transportReturning('{"text":"hola"}', seen));
    await provider.complete({ kind: 'dialogue', topic: 't', facts: [] });
    expect(seen[0]?.onEvent).toBeUndefined();
  });
});
