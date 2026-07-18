import { describe, expect, it } from 'vitest';
import { kindLabel } from '@anima/shared';
import { appearanceFor, emojiFor, hexColor } from '../src/phaser/appearance.js';
import { GLYPH_SIZE, materialFor, paletteFor, parseGlyph, patternFor } from '../src/phaser/matter.js';

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
 * linaje salía de un color arbitrario en vez de gris piedra.
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

  it('el cuchillo inventado sale gris piedra y no de un color cualquiera', () => {
    const material = materialFor('cuchillo', lineage);
    expect(paletteFor('cuchillo', material)).toEqual(paletteFor('piedra'));
    // Sin linaje caía al color por hash, que no es el de la piedra.
    expect(paletteFor('cuchillo')).not.toEqual(paletteFor('piedra'));
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
