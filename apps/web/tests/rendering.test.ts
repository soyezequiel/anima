import { describe, expect, it } from 'vitest';
import { kindLabel } from '@anima/shared';
import { appearanceFor, emojiFor, hexColor } from '../src/phaser/appearance.js';
import { GLYPH_SIZE, materialFor, paletteFor, parseGlyph, patternFor } from '../src/phaser/matter.js';
import { skillDevLine, skillDevPurpose } from '../src/components/thinking.js';
import { materialChildren } from '../src/components/MaterialTree.js';
import { goalTitle } from '../src/components/GoalsPanel.js';
import { MAPS } from '@anima/missions';
import type { ItemView } from '../src/session/view.js';

/**
 * Cómo se ve y cómo se llama una cosa. Dos reglas: el nombre interno nunca se
 * le muestra a quien juega, y un objeto se dibuja por lo que ES — que es lo
 * único que sirve para lo que Ánima inventa, cuyo nombre no está en ninguna
 * tabla nuestra.
 */

describe('los nombres se dicen en voz humana', () => {
  it('traduce los tipos del motor', () => {
    expect(kindLabel('log')).toBe('tronco');
    expect(kindLabel('flint')).toBe('pedernal');
    expect(kindLabel('campfire')).toBe('fogata');
    expect(kindLabel('tree')).toBe('árbol');
    expect(kindLabel('water')).toBe('agua');
    expect(kindLabel('shelter')).toBe('refugio');
  });

  it('lo que Ánima inventó ya viene con nombre: solo se limpian los guiones', () => {
    expect(kindLabel('hoguera-simple')).toBe('hoguera simple');
    expect(kindLabel('brasero')).toBe('brasero');
  });
});

describe('los gráficos se reutilizan por lo que la cosa es', () => {
  it('cada tipo conocido tiene el suyo, y el tronco se queda con el 🪵', () => {
    expect(emojiFor('log', {})).toBe('🪵');
    expect(emojiFor('tree', {})).toBe('🌳');
    expect(emojiFor('campfire', {})).toBe('🔥');
    // La rama no es un tronco: es una vara fina y ramificada, madera seca en
    // vez de leño grueso. Antes era 🌿 y parecía una planta, no madera.
    expect(emojiFor('branch', {})).toBe('🪾');
    expect(emojiFor('water', {})).toBe('🌊');
    expect(emojiFor('shelter', {})).toBe('🛖');
  });

  it('lo que Ánima inventa se dibuja como lo que es, sin estar en ninguna tabla', () => {
    // Una "hoguera-simple" con heatSource ES un fuego, aunque nadie la haya
    // escrito nunca: se reutiliza el gráfico de lo que ya existe.
    expect(emojiFor('hoguera-simple', { warm: true, dangerous: true })).toBe('🔥');
    expect(emojiFor('brasero-de-piedra', { warm: true })).toBe('🔥');
  });

  it('el nombre exacto manda sobre el rasgo', () => {
    // La fogata da calor Y quema, pero ya tiene su propio gráfico.
    expect(emojiFor('campfire', { warm: true, dangerous: true })).toBe('🔥');
    // Un árbol produce comida, pero es un árbol antes que una manzana.
    expect(emojiFor('tree', { growsFood: true })).toBe('🌳');
  });

  it('de lo más específico a lo más genérico: dar calor gana sobre dar comida', () => {
    expect(emojiFor('cosa-nueva', { warm: true, growsFood: true })).toBe('🔥');
    expect(emojiFor('cosa-nueva', { growsFood: true })).toBe('🌳');
  });

  it('solo se adivina por rasgos que digan cómo se ve, no qué hace', () => {
    // El cuchillo que inventó Ánima salía 🔨 porque es `tool`, y un martillo
    // y un cuchillo no se parecen en nada. Lo mismo `dangerous`: un cuchillo
    // es peligroso y no es un cactus. Ahora esos dos caen a materia.
    expect(emojiFor('cuchillo', { tool: true, dangerous: true, portable: true })).toBeUndefined();
    expect(emojiFor('lanza-de-hueso', { tool: true })).toBeUndefined();
    // Pero el martillo y el cactus de fábrica conservan el suyo por nombre.
    expect(emojiFor('hammer', { tool: true })).toBe('🔨');
    expect(emojiFor('cactus', { dangerous: true })).toBe('🌵');
  });

  it('lo que no se parece a nada no tiene gráfico: va al placeholder', () => {
    expect(emojiFor('cosa-rara', {})).toBeUndefined();
    expect(emojiFor('cosa-rara', { solid: true, portable: true })).toBeUndefined();
  });
});

/**
 * El aspecto completo lo deciden el tablero y el catálogo con la MISMA regla:
 * una cosa no puede verse de dos maneras según dónde la mires.
 */
describe('el aspecto de una cosa es uno solo', () => {
  it('lo que tiene emoji se dibuja con su emoji', () => {
    expect(appearanceFor('log', {})).toEqual({ as: 'emoji', emoji: '🪵' });
    expect(appearanceFor('hoguera-simple', { warm: true })).toEqual({ as: 'emoji', emoji: '🔥' });
  });

  it('el muro es el único bloque liso: es pared, no una cosa que se junte', () => {
    expect(appearanceFor('wall', { solid: true })).toMatchObject({ as: 'block' });
  });

  it('el color del bloque se lee igual en Phaser y en CSS', () => {
    expect(hexColor(0x64748b)).toBe('#64748b');
    // Sin ceros a la izquierda el color sería otro (#4f46e5 vs #4f46e).
    expect(hexColor(0x04f46e)).toBe('#04f46e');
  });
});

/**
 * Lo que Ánima inventa y no se parece a nada ya no cae a un cuadrado con el
 * nombre escrito adentro: se compone un dibujo con el material que delata su
 * nombre y la forma que delata su nombre. La regla que importa es que este
 * último escalón NO PUEDE fallar, porque abajo no hay nada.
 */
describe('lo que no tiene emoji se dibuja como materia', () => {
  it('nunca se queda sin dibujo, diga lo que diga el nombre', () => {
    for (const kind of ['cosa-rara', 'x', 'polvo de piedra', '???', 'a-b-c-d-e']) {
      expect(appearanceFor(kind, {})).toMatchObject({ as: 'matter' });
    }
  });

  it('el material sale del nombre: el polvo de piedra es gris piedra', () => {
    expect(paletteFor('polvo-de-piedra')).toEqual(paletteFor('roca'));
    expect(paletteFor('astilla-de-madera')).toEqual(paletteFor('tronco'));
    // Y no son la misma: piedra y madera no pueden verse igual.
    expect(paletteFor('polvo-de-piedra')).not.toEqual(paletteFor('astilla-de-madera'));
  });

  it('las tildes y los guiones no cambian el material', () => {
    expect(paletteFor('LÍQUIDO')).toEqual(paletteFor('liquido'));
    expect(paletteFor('polvo_de_piedra')).toEqual(paletteFor('polvo de piedra'));
  });

  it('la forma sale del nombre: el polvo es polvo aunque sea de otra cosa', () => {
    expect(patternFor('polvo-de-piedra')).toEqual(patternFor('polvo-de-hueso'));
    expect(patternFor('esquirla')).not.toEqual(patternFor('polvo'));
  });

  it('lo que dejó romper el pedernal se dibuja como lo que es', () => {
    // Los tres salen de la misma decomposición real (ADR 0037): son piedra,
    // y cada uno tiene su forma. Que los tres cayeran a la misma masa gris
    // sería no haber dibujado nada.
    expect(paletteFor('stone-dust')).toEqual(paletteFor('stone-chip'));
    expect(patternFor('stone-dust')).not.toEqual(patternFor('stone-chip'));
    expect(patternFor('stone-chip')).toEqual(patternFor('flint-shard'));
  });

  it('el cuchillo que inventó Ánima se dibuja como una hoja, no como un martillo', () => {
    const look = appearanceFor('cuchillo', { tool: true, dangerous: true, portable: true });
    expect(look).toMatchObject({ as: 'matter', glyph: patternFor('hacha') });
    // Y no como cualquier otro invento sin forma declarada.
    expect(patternFor('cuchillo')).not.toEqual(patternFor('chirimbolo'));
  });

  it('lo que no delata nada igual sale estable: mismo nombre, mismo aspecto', () => {
    // Si cambiara entre llamadas, el objeto mutaría de color al recargar.
    expect(appearanceFor('chirimbolo', {})).toEqual(appearanceFor('chirimbolo', {}));
    expect(paletteFor('chirimbolo')).not.toEqual(paletteFor('otra-cosa-rara'));
  });

  it('todos los patrones son grillas bien formadas', () => {
    // Un patrón mal escrito a mano rompería el dibujo en silencio.
    for (const kind of ['polvo', 'esquirla', 'barra', 'lamina', 'fibra', 'a', 'b', 'c']) {
      const glyph = patternFor(kind);
      expect(parseGlyph(glyph)).not.toBeNull();
    }
  });
});

/**
 * El glifo que dibuja la IA Dios entra por acá. Es dato que no escribimos
 * nosotros, así que se revisa antes de llegar a la pantalla — y si no pasa, se
 * cae al patrón procedural en vez de romper.
 */
describe('el glifo de la IA Dios se acota antes de dibujarse', () => {
  const good = Array.from({ length: GLYPH_SIZE }, () => '1'.repeat(GLYPH_SIZE));

  it('acepta una grilla de la medida exacta con índices de paleta', () => {
    expect(parseGlyph(good)).toEqual(good);
  });

  it('rechaza lo que no es una grilla de 16x16 de índices', () => {
    expect(parseGlyph(null)).toBeNull();
    expect(parseGlyph('no soy una grilla')).toBeNull();
    expect(parseGlyph(good.slice(1))).toBeNull();
    expect(parseGlyph([...good.slice(1), '1'.repeat(GLYPH_SIZE + 1)])).toBeNull();
    // El 4 no es un índice: la paleta tiene tres tonos y el vacío.
    expect(parseGlyph([...good.slice(1), '4'.repeat(GLYPH_SIZE)])).toBeNull();
  });

  it('lo que dibujó la IA gana sobre el patrón procedural', () => {
    const look = appearanceFor('cosa-rara', {}, { glyph: good });
    expect(look).toMatchObject({ as: 'matter', glyph: good });
    // Pero el color sigue saliendo del material, no de la IA.
    expect((look as { palette: unknown }).palette).toEqual(paletteFor('cosa-rara'));
  });

  it('un glifo inválido no rompe: se cae al patrón procedural', () => {
    expect(appearanceFor('cosa-rara', {}, { glyph: ['basura'] })).toEqual(
      appearanceFor('cosa-rara', {}),
    );
  });

  it('el emoji sigue mandando sobre el glifo: lo dibujado a mano se ve mejor', () => {
    expect(appearanceFor('log', {}, { glyph: good })).toEqual({ as: 'emoji', emoji: '🪵' });
  });
});

/**
 * El color se hereda de la receta. El caso real: Ánima inventó un `cuchillo`
 * con `flint-shard` + `branch`, y "cuchillo" no dice de qué está hecho — sin
 * linaje salía de un color arbitrario en vez del de su materia.
 */
describe('de qué está hecho algo se sigue por sus recetas', () => {
  const lineage = new Map([
    ['cuchillo', 'flint-shard'],
    ['flint-shard', 'flint'],
    ['mango-tallado', 'branch'],
  ]);

  it('sigue la cadena hasta el primer nombre que delate un material', () => {
    expect(materialFor('cuchillo', lineage)).toBe('flint-shard');
    expect(materialFor('mango-tallado', lineage)).toBe('branch');
  });

  it('el cuchillo inventado sale color pedernal y no de un color cualquiera', () => {
    const material = materialFor('cuchillo', lineage);
    // Del pedernal, que es de lo que está hecho — no del gris de la piedra.
    // Son dos materiales distintos desde que la piedra existe por su cuenta, y
    // un cuchillo de pedernal es oscuro, no gris granito.
    expect(paletteFor('cuchillo', material)).toEqual(paletteFor('pedernal'));
    expect(paletteFor('cuchillo', material)).not.toEqual(paletteFor('piedra'));
    // Sin linaje caía al color por hash, que no es el de su materia.
    expect(paletteFor('cuchillo')).not.toEqual(paletteFor('pedernal'));
  });

  it('el nombre propio manda sobre lo heredado', () => {
    // Un hacha de piedra hecha con una rama primero es de piedra: lo dice.
    expect(paletteFor('hacha-de-piedra', 'branch')).toEqual(paletteFor('piedra'));
  });

  it('lo que no lleva a ningún material se queda sin él, sin colgarse', () => {
    expect(materialFor('chirimbolo', lineage)).toBeUndefined();
    // Una cadena circular no puede colgar el dibujo.
    const circular = new Map([
      ['a', 'b'],
      ['b', 'a'],
    ]);
    expect(materialFor('a', circular)).toBeUndefined();
  });
});

/**
 * El renglón del ciclo de aprendizaje (ADR 0060). Es el texto que acompaña al
 * encabezado del pensamiento en vuelo, y los dos salen de relojes distintos:
 * el encabezado del pedido al modelo, el renglón de los eventos del ciclo. Por
 * eso cada fase tiene que decir SU momento sin ambigüedad — un renglón que
 * sobrevive a su ciclo termina contradiciendo al encabezado.
 */
describe('el renglón del ciclo cuenta en qué va', () => {
  const base = {
    skillName: 'alcanzar-alimento-bloqueado',
    purpose: 'llegar hasta el alimento aunque el camino esté bloqueado',
    version: 1,
    maxVersions: 8,
    attemptsDone: 0,
    casesTotal: 40,
    lastRate: null,
    bestRate: null,
  };

  it('nombra la habilidad en todas las fases, sin guiones', () => {
    for (const phase of ['designing', 'testing', 'revising', 'passed'] as const) {
      const line = skillDevLine({ ...base, phase });
      expect(line).toContain('«alcanzar alimento bloqueado»');
      expect(line).not.toContain('-');
    }
  });

  it('cada fase dice su momento: diseñar, probar, corregir, pasar', () => {
    expect(skillDevLine({ ...base, phase: 'designing' })).toContain('diseñando');
    expect(skillDevLine({ ...base, phase: 'testing' })).toContain('40 mundos imaginados');
    expect(skillDevLine({ ...base, phase: 'revising', lastRate: 0.5 })).toContain('logró 50%');
    expect(skillDevLine({ ...base, phase: 'revising', lastRate: 0.5 })).toContain('corrigiendo');
    expect(skillDevLine({ ...base, phase: 'passed', lastRate: 1 })).toContain('pasó con 100%');
  });

  it('el propósito se dice corto, y sin propósito no inventa nada', () => {
    expect(skillDevPurpose({ ...base, phase: 'designing' })).toBe(
      'para llegar hasta el alimento aunque el camino esté bloqueado',
    );
    expect(skillDevPurpose({ ...base, phase: 'designing', purpose: null })).toBeNull();
  });
});

/**
 * ADR 0069. El árbol de materiales, por niveles y a demanda.
 *
 * Lo único que el árbol CALCULA es cuánto hace falta a cada altura. El resto
 * —qué se abre, qué se dibuja— es interfaz. Esta cuenta merece prueba porque
 * equivocarla no se ve: el árbol queda igual de lindo y el cuidador junta de
 * menos.
 */
describe('el árbol de materiales cuenta por rama', () => {
  const catalogo = (
    recetas: Record<string, { kind: string; count: number }[]>,
  ): Map<string, ItemView> =>
    new Map(
      Object.entries(recetas).map(([kind, ingredientes]) => [
        kind,
        {
          kind,
          name: kind,
          ingredients: ingredientes.map((i) => ({
            kind: i.kind,
            count: i.count,
            label: `${i.count} ${i.kind}`,
          })),
        } as ItemView,
      ]),
    );

  it('multiplica por toda la rama, no por la receta suelta', () => {
    // 3 encimeras → 6 tablas → 12 ramas: la cocina real del cuidador.
    const byKind = catalogo({
      encimera: [{ kind: 'tabla', count: 2 }],
      tabla: [
        { kind: 'rama', count: 2 },
        { kind: 'fibra', count: 1 },
      ],
      rama: [],
      fibra: [],
    });

    const nivel1 = materialChildren('encimera', 3, byKind);
    expect(nivel1).toEqual([{ kind: 'tabla', count: 6, raw: false, circular: false }]);

    const nivel2 = materialChildren('tabla', nivel1[0]!.count, byKind, ['encimera']);
    expect(nivel2).toEqual([
      { kind: 'rama', count: 12, raw: true, circular: false },
      { kind: 'fibra', count: 6, raw: true, circular: false },
    ]);
  });

  it('marca la materia prima: ahí el árbol toca el suelo', () => {
    const byKind = catalogo({ tabla: [{ kind: 'rama', count: 2 }], rama: [] });
    expect(materialChildren('tabla', 1, byKind)[0]).toMatchObject({ kind: 'rama', raw: true });
    // Y una materia prima no tiene hijos: no hay nada más abajo.
    expect(materialChildren('rama', 1, byKind)).toEqual([]);
  });

  it('marca los círculos en vez de perseguirlos para siempre', () => {
    // Una receta que vuelve sobre sí misma (ADR 0031 las admite).
    const byKind = catalogo({
      ladrillo: [{ kind: 'polvo', count: 2 }],
      polvo: [{ kind: 'ladrillo', count: 1 }],
    });
    const hijos = materialChildren('polvo', 2, byKind, ['ladrillo']);
    expect(hijos[0]).toMatchObject({ kind: 'ladrillo', circular: true });
  });

  it('un tipo que el catálogo no conoce se trata como materia prima', () => {
    expect(materialChildren('desconocido', 1, new Map())).toEqual([]);
  });
});

/**
 * El título de un objetivo tiene que caber en un renglón. El de una misión
 * nace siendo el briefing completo, y la tarjeta «Ahora» —que está fija arriba
 * de todo— lo pintaba entero: diez renglones que empujaban la pestaña de abajo
 * fuera de la pantalla.
 */
describe('el título de un objetivo cabe en un renglón', () => {
  it('deja intactos los objetivos que ya son cortos', () => {
    expect(goalTitle('recuperar calor')).toBe('recuperar calor');
    expect(goalTitle('armar un puente')).toBe('armar un puente');
  });

  it('sigue sacando el prefijo con el que el motor marca los encargos', () => {
    expect(goalTitle('petición del usuario: crea una cocina')).toBe('crea una cocina');
  });

  it('corta un briefing largo por su primera oración', () => {
    const briefing =
      'Este río es mucho más ancho que el otro: cuatro pasos de agua de punta a punta. ' +
      'La comida está del otro lado. Con una sola tabla no llegás ni a la mitad.';
    expect(goalTitle(briefing)).toBe(
      'Este río es mucho más ancho que el otro: cuatro pasos de agua de punta a punta.',
    );
  });

  it('si la primera oración no entra, corta por una pausa de la propia frase', () => {
    // El caso del cauce: la primera oración mide 105, y cortar por palabra
    // dejaba un «y tampoco…» colgado. La coma cierra una idea completa.
    const cauce =
      'Este río es mucho más ancho que el otro: cuatro pasos de agua de punta a punta, ' +
      'y tampoco se puede nadar. La comida está del otro lado.';
    expect(goalTitle(cauce)).toBe(
      'Este río es mucho más ancho que el otro: cuatro pasos de agua de punta a punta',
    );
  });

  it('sin ninguna pausa, corta por la última palabra que cabe', () => {
    const corrido = `${'palabra '.repeat(30)}final.`;
    const title = goalTitle(corrido);
    expect(title.length).toBeLessThanOrEqual(91);
    expect(title.endsWith('…')).toBe(true);
    // No parte una palabra al medio.
    expect(title.slice(0, -1).trimEnd().endsWith('palabra')).toBe(true);
  });

  it('no deja un título en blanco cuando la primera «oración» es un punto suelto', () => {
    const raro = `. ${'x'.repeat(200)}`;
    expect(goalTitle(raro).length).toBeGreaterThan(10);
  });

  it('achica los briefings REALES de los cuatro mapas a un renglón', () => {
    // No son textos de laboratorio: son los enunciados que de verdad se
    // vuelven descripción de objetivo y terminan en la tarjeta «Ahora».
    for (const map of MAPS) {
      const title = goalTitle(map.mission.briefing);
      expect(title.length, `«${map.name}» sigue siendo largo: ${title}`).toBeLessThanOrEqual(91);
      expect(title.length).toBeGreaterThan(20);
    }
  });
});
