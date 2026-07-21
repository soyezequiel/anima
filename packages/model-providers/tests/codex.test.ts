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
  it('interpreta la referencia semántica sin inventar una identidad del mundo', async () => {
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          action: 'fetch-item',
          targetKind: 'log',
          targetSelector: {
            kind: 'log',
            definiteness: 'specific',
            reference: 'other',
            relation: 'none',
            anchorKind: '',
          },
        }),
      ),
    );

    await expect(
      provider.complete({ kind: 'interpret.command', text: 'traé el otro tronco', facts: [] }),
    ).resolves.toMatchObject({
      kind: 'command.interpretation',
      command: {
        action: 'fetch-item',
        targetKind: 'log',
        targetSelector: { definiteness: 'specific', reference: 'other' },
      },
    });
  });

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
    expect(seen[0]?.schema).toMatchObject({
      required: ['programJson', 'rationale', 'altProgramJson', 'altRationale'],
    });
  });

  // El validador de esquemas de salida exige que `required` nombre TODAS las
  // propiedades: una sola afuera y la consulta muere antes de que el modelo
  // conteste. Pasó de verdad — `skill.propose` falló 5 de 5 veces con
  // "Missing 'programJson'", y era la vía de escape de la mascota cuando se
  // traba. Este test es el que no deja que vuelva a pasar en silencio.
  it('todo esquema nombra en required cada una de sus propiedades', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ programJson: '[]', rationale: 'x' }), seen),
    );
    await provider.complete({
      kind: 'skill.propose',
      skillName: 'x',
      problem: 'p',
      context: [],
      mayDecompose: true,
    });
    const schema = seen[0]?.schema as { properties: object; required: string[] };
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
  });

  // El otro lado del mismo contrato: si todas las propiedades son
  // obligatorias, «no aplica» se dice con "" y hay que leerlo como ausencia.
  it('un campo vacío es una ausencia, no un JSON roto', async () => {
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          programJson: '',
          rationale: 'es muy grande para un programa solo',
          altProgramJson: '',
          altRationale: '',
          subSkillsJson: JSON.stringify([
            { name: 'llegar-al-rio', purpose: 'acercarse', expectedOutcome: 'estar al lado' },
          ]),
        }),
      ),
    );
    const response = await provider.complete({
      kind: 'skill.propose',
      skillName: 'x',
      problem: 'p',
      context: [],
      mayDecompose: true,
    });
    expect(response.kind).toBe('skill.decomposition');
    if (response.kind === 'skill.decomposition') {
      expect(response.parts.map((p) => p.name)).toEqual(['llegar-al-rio']);
    }
  });

  it('una alternativa vacía no se confunde con una alternativa rota', async () => {
    const program = reachBlockedResourceProgram('strongestTool');
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          programJson: JSON.stringify(program),
          rationale: 'la única idea',
          altProgramJson: '',
          altRationale: '',
        }),
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
      expect(response.alternate).toBeUndefined();
    }
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

  it('el dialogo recibe estados epistemologicos y obliga a reconocer huecos', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(transportReturning('{"text":"no lo sé"}', seen));
    await provider.complete({
      kind: 'dialogue',
      topic: '¿dónde está el agua?',
      facts: [],
      knowledge: [
        {
          id: 'know-1',
          content: 'ubicación actual del agua',
          state: 'unknown',
          confidence: 1,
          source: 'system: dato faltante',
          evidence: [],
          scope: 'tipo:water',
          missingData: ['una observación actual del agua'],
        },
      ],
    });

    const prompt = seen[0]?.prompt ?? '';
    expect(prompt).toContain('[know-1] unknown');
    expect(prompt).toContain('No completes huecos por plausibilidad');
    expect(prompt).toContain('refuted significa que la afirmación es falsa');
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

  it('la señal del cuerpo se describe como se siente, no como se llama adentro', async () => {
    // "energy-low" viajaba crudo al prompt y volvía dentro del hecho aprendido:
    // «Si busco y consumo comida cuando siento energy-low…» quedaba escrito en
    // el chat, en el panel de aprendizaje y en el informe de legado.
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(
        '{"hypothesis":"consumir alimento recupera energía","confidence":0.6}',
        seen,
      ),
    );
    await provider.complete({ kind: 'interpret.signal', signal: 'energy-low' });

    const prompt = seen[0]?.prompt ?? '';
    expect(prompt).toContain('te estás quedando sin fuerzas');
    expect(prompt).not.toContain('energy-low');
    // Y se le exige un enunciado general, no un plan en primera persona.
    expect(prompt).toContain('general y\nverificable');
    expect(prompt).toContain('NO escribas un plan en primera persona');
  });

  /**
   * ADR 0051: una consulta puede traer dos estrategias. El viaje al modelo se
   * paga una vez; la segunda idea cuesta solo sus tokens de salida.
   */
  it('el diseño invita una segunda estrategia y el parse la trae como alternate', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          programJson: '[{"op":"wait","ticks":2}]',
          rationale: 'acercarse',
          altProgramJson: '[{"op":"explore","maxSteps":10}]',
          altRationale: 'buscar primero',
        }),
        seen,
      ),
    );
    const response = await provider.complete({
      kind: 'skill.propose',
      skillName: 'conseguir-calor',
      problem: 'entrar en calor',
      context: [],
      successCriteria: [],
    });

    expect(seen[0]?.prompt).toContain('SEGUNDA estrategia');
    expect(response).toMatchObject({
      kind: 'skill.program',
      program: [{ op: 'wait', ticks: 2 }],
      alternate: { program: [{ op: 'explore', maxSteps: 10 }], rationale: 'buscar primero' },
    });
  });

  it('una alternativa ilegible se descarta sin tirar la principal', async () => {
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          programJson: '[{"op":"wait","ticks":2}]',
          rationale: 'ok',
          altProgramJson: 'esto no es json',
        }),
      ),
    );
    const response = await provider.complete({
      kind: 'skill.revise',
      skillName: 'conseguir-calor',
      problem: 'entrar en calor',
      reason: 'evaluation-failed',
      successCriteria: [],
      context: [],
      previousProgram: [],
      failureObservations: [],
      attempt: 2,
    });

    // El regalo roto se queda en la caja; el viaje ya lo justificó la principal.
    expect(response).toMatchObject({ kind: 'skill.program', program: [{ op: 'wait', ticks: 2 }] });
    expect('alternate' in response).toBe(false);
  });

  /**
   * El motivo de un veto no es decoración: se dice en el chat, queda como hecho
   * en su memoria, viaja en el legado y vuelve al modelo en el próximo intento
   * de invención. Se lo cortaba a 240 caracteres a lo bruto, y el cuidador leía
   * frases partidas al medio ("Con eso el paso se so") justo donde el prompt
   * pide lo más útil: qué piezas intermedias le faltan.
   */
  it('el motivo del juicio entra entero cuando es largo pero razonable', async () => {
    const reason =
      'Un tronco solo no es un muro: es un poste. Te falta el piso del medio. ' +
      'Bajá un escalón: primero tabla (1x log), y después varias tablas atadas o ' +
      'pegadas — probá muro-aula con 3x tabla + 1x fiber, o 2x tabla + 1x resin. ' +
      'Con eso el paso se sostiene y la obra deja de saltarse capas.';
    expect(reason.length).toBeGreaterThan(240);

    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ willing: false, reason })),
    );
    const response = await provider.complete({
      kind: 'recipe.judge',
      problem: 'me pidieron una escuela',
      outputKind: 'muro-aula',
      ingredientsSummary: ['1x log'],
      effectsSummary: ['es sólido'],
      knownRecipes: [],
      facts: [],
      depthBudget: 3,
    });

    // Entero: la parte accionable sobrevive.
    expect(response).toMatchObject({ kind: 'judgement', willing: false });
    expect(response.kind === 'judgement' && response.reason).toContain('3x tabla + 1x fiber');
    expect(response.kind === 'judgement' && response.reason).toContain('deja de saltarse capas');
  });

  it('un motivo desmedido se corta en una palabra entera, no por la mitad', async () => {
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({ willing: false, reason: `${'palabra '.repeat(200)}final` }),
      ),
    );
    const response = await provider.complete({
      kind: 'decomposition.judge',
      targetKind: 'flint',
      dropsSummary: [],
      facts: [],
    });

    const reason = response.kind === 'judgement' ? response.reason : '';
    expect(reason.length).toBeLessThanOrEqual(601);
    // Termina en «…», no en media palabra: una frase que termina se lee como
    // una idea; una cortada al medio se lee como un error del programa.
    expect(reason.endsWith('…')).toBe(true);
    expect(reason).not.toMatch(/pala…$/);
  });

  it('un encargo de varias partes se lee como varias órdenes en orden', async () => {
    const empty = {
      targetKind: '',
      verb: '',
      amount: 0,
      directions: [],
      skillName: '',
      recipeId: '',
      onKind: '',
      summary: '',
      name: '',
      steps: [],
    };
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          ...empty,
          action: 'sequence',
          steps: [
            { ...empty, action: 'craft-item', recipeId: 'tabla' },
            { ...empty, action: 'place-item', targetKind: 'tabla', onKind: 'agua' },
            { ...empty, action: 'move-direction', directions: ['right'] },
          ],
        }),
      ),
    );
    const response = await provider.complete({
      kind: 'interpret.command',
      text: 'hacé una tabla, ponela sobre el agua y cruzá',
      facts: [],
    });
    expect(response).toEqual({
      kind: 'command.interpretation',
      command: {
        action: 'sequence',
        steps: [
          { action: 'craft-item', recipeId: 'tabla' },
          { action: 'place-item', targetKind: 'tabla', onKind: 'agua' },
          { action: 'move-direction', directions: ['right'] },
        ],
      },
    });
  });

  it('un encargo con una sola parte legible es una orden, no una secuencia', async () => {
    const empty = {
      targetKind: '',
      verb: '',
      amount: 0,
      directions: [],
      skillName: '',
      recipeId: '',
      onKind: '',
      summary: '',
      name: '',
      steps: [],
    };
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          ...empty,
          action: 'sequence',
          steps: [
            { ...empty, action: 'craft-item', recipeId: 'tabla' },
            // Un paso ilegible se cae solo: no tumba el encargo entero.
            { ...empty, action: 'fetch-item', targetKind: '' },
          ],
        }),
      ),
    );
    const response = await provider.complete({
      kind: 'interpret.command',
      text: 'hacé una tabla',
      facts: [],
    });
    expect(response).toEqual({
      kind: 'command.interpretation',
      command: { action: 'craft-item', recipeId: 'tabla' },
    });
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
        'targetSelector',
        'verb',
        'amount',
        'directions',
        'relation',
        'maintenance',
        'skillName',
        'recipeId',
        'onKind',
        'placement',
        'summary',
        'name',
        'steps',
      ],
    });
    expect(seen[0]?.prompt).toContain('pegá un pasito rumbo al rincón noroeste');
    expect(seen[0]?.prompt).toContain('Mascota: Estoy junto al árbol.');
  });

  it('interpreta cruzar una referencia como una meta espacial, no como una habilidad', async () => {
    const provider = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          action: 'spatial-relation',
          relation: 'opposite-side',
          targetKind: 'wall',
          verb: '',
          amount: 0,
          directions: [],
          skillName: '',
          recipeId: '',
          onKind: '',
          summary: '',
          name: '',
          steps: [],
        }),
      ),
    );

    await expect(
      provider.complete({
        kind: 'interpret.command',
        text: 'cruzá el muro',
        facts: ['estoy en la celda (2,3)', 'posición visible de wall: (5,0), (5,1)'],
      }),
    ).resolves.toEqual({
      kind: 'command.interpretation',
      command: { action: 'spatial-relation', relation: 'opposite-side', targetKind: 'wall' },
    });
  });

  it('distingue mantener una relación y colocar junto a un referente', async () => {
    const maintenance = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          action: 'spatial-relation',
          relation: 'far-from',
          targetKind: 'wolf',
          maintenance: true,
        }),
      ),
    );
    await expect(
      maintenance.complete({
        kind: 'interpret.command',
        text: 'mantenete lejos del lobo',
        facts: ['posición visible de wolf: (5,5)'],
      }),
    ).resolves.toEqual({
      kind: 'command.interpretation',
      command: {
        action: 'spatial-relation',
        relation: 'far-from',
        targetKind: 'wolf',
        maintenance: true,
      },
    });

    const placement = new CodexModelProvider(
      transportReturning(
        JSON.stringify({
          action: 'place-item',
          targetKind: 'hammer',
          onKind: 'campfire',
          placement: 'near',
        }),
      ),
    );
    await expect(
      placement.complete({
        kind: 'interpret.command',
        text: 'dejá el martillo junto a la fogata',
        facts: ['ahora veo: hammer, campfire'],
      }),
    ).resolves.toEqual({
      kind: 'command.interpretation',
      command: {
        action: 'place-item',
        targetKind: 'hammer',
        onKind: 'campfire',
        placement: 'near',
      },
    });
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
      transportReturning(
        JSON.stringify({ recipeJson: JSON.stringify(recipe), rationale: 'calor' }),
      ),
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

  /**
   * El juez de recetas también pregunta si la cosa es una COSA (ADR 0072).
   *
   * El caso real: le pidieron una cocina y fabricó un objeto `cocina` de una
   * celda. El juez había aprobado la receta —y con razón: «1 encimera + 3
   * piedras + 1 pedernal» es un paso de crafteo honesto—, pero su prompt decía
   * literalmente «tu pregunta es una sola» y esa pregunta era la granularidad.
   * Nadie le preguntó nunca si una cocina es una cosa o un lugar, así que el
   * «bloque casa» que el ADR 0032 vino a eliminar volvió por la invención.
   */
  it('el juez de recetas pregunta si es una cosa o un lugar, no solo si es un paso', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ willing: true, reason: 'ok' }), seen),
    );
    await provider.complete({
      kind: 'recipe.judge',
      problem: 'me pidieron una cocina',
      outputKind: 'cocina',
      ingredientsSummary: ['1x encimera', '3x stone'],
      effectsSummary: ['es sólido'],
      knownRecipes: [],
      facts: [],
      depthBudget: 3,
    });

    const prompt = seen[0]?.prompt ?? '';
    expect(prompt).toContain('¿ESTO ES UNA COSA, O ES UN LUGAR?');
    // Y le da la salida: rechazar un lugar tiene que mandarla a proponer OBRA,
    // no dejarla sin camino después del veto.
    expect(prompt).toContain('OBRA');
    // El criterio no puede ser «no se puede cargar»: la fogata tampoco se lleva
    // encima y es una cosa. Si el prompt pierde ese matiz, empieza a declarar
    // obras a los objetos.
    expect(prompt).toContain('fogata');
  });

  /**
   * …pero NO se la pregunta sobre las piezas de una obra (ADR 0074).
   *
   * El caso real: le pidieron una cocina, el juez le dijo «es un lugar, no una
   * cosa», ella se corrigió sola y propuso la obra — y entonces el juez rechazó
   * el FOGÓN, una de sus piezas, por la misma razón. Un fogón es una cosa: es
   * el caso de la fogata. La obra se cayó entera y el cuidador no recibió nada.
   *
   * El tipo de la respuesta ya ES la decisión (ADR 0032): con un plano esperando,
   * el modelo ya contestó que lo pedido es un lugar. Repetirle la pregunta a cada
   * ladrillo es preguntarle si un ladrillo debería ser una casa.
   */
  it('no le pregunta si es un lugar cuando juzga una PIEZA de una obra', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ willing: true, reason: 'ok' }), seen),
    );
    await provider.complete({
      kind: 'recipe.judge',
      problem: 'me pidieron una cocina',
      outputKind: 'cooking-hearth',
      ingredientsSummary: ['2x stone', '1x flint'],
      effectsSummary: ['es sólido', 'da calor'],
      knownRecipes: [],
      facts: [],
      depthBudget: 3,
      partOfWork: true,
    });

    const prompt = seen[0]?.prompt ?? '';
    expect(prompt).not.toContain('¿ESTO ES UNA COSA, O ES UN LUGAR?');
    expect(prompt).toContain('Tu pregunta es una sola');
    // Y se le dice por qué, para que no lo deduzca del silencio.
    expect(prompt).toContain('PIEZA');
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

describe('el juez de interacciones juzga la regla, no el intento', () => {
  it('le dice explícitamente que no rechace por lo que todavía no tiene encima', async () => {
    const seen: CodexTransportInput[] = [];
    const provider = new CodexModelProvider(
      transportReturning(JSON.stringify({ willing: true, reason: 'ok' }), seen),
    );
    await provider.complete({
      kind: 'interaction.judge',
      interactionId: 'juntar-agua',
      description: 'juntar agua con el recipiente',
      stance: 'beside',
      targetKind: 'agua',
      effectsSummary: ['el recipiente se vuelve recipiente-lleno'],
      requiresHeld: 'recipiente',
      facts: ['llevo encima: nada'],
    });

    const prompt = seen[0]?.prompt ?? '';
    // Una regla vale siempre o no vale nunca: el inventario de este instante no
    // puede vetarla, porque es justo lo que la regla sirve para conseguir.
    expect(prompt).toContain('Juzgás una REGLA, no un intento');
    expect(prompt).toContain('lo comprueba el mundo cada vez');
    expect(prompt).toContain('CONTEXTO, no condición');
  });
});
