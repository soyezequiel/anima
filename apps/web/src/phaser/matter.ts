/**
 * De qué está hecha una cosa y qué forma tiene, cuando ningún emoji la explica.
 *
 * Antes, lo que Ánima inventaba y no se parecía a nada terminaba como un
 * cuadrado ámbar con el nombre escrito adentro. Eso no era un dibujo: era una
 * disculpa. Y no se arreglaba agregando entradas a una tabla, porque el
 * catálogo es abierto por diseño (`EntityKind = string`) y la IA Dios bautiza
 * lo que inventa como quiera.
 *
 * Acá se arma el dibujo componiendo dos ejes, que es lo que hace que un
 * catálogo infinito pueda verse coherente:
 *
 *   - la PALETA la da el material (piedra, madera, hueso...), y
 *   - la FORMA la da el patrón (polvo, esquirla, barra, lámina...).
 *
 * "polvo de piedra" = paleta de piedra + patrón de polvo. Nadie dibujó nunca
 * ese objeto y sin embargo sale gris y granulado.
 *
 * Los glifos son grillas de 16x16 donde cada carácter es un ÍNDICE de paleta,
 * no un color: `0` transparente, `1` base, `2` sombra, `3` luz. Esa indirección
 * es la que garantiza la coherencia — quien dibuje la forma (este módulo hoy,
 * la IA Dios mañana) elige volumen, jamás color, así que el polvo de piedra
 * sale color piedra aunque el dibujante quisiera otra cosa.
 */

// La medida la manda el mundo, no la pantalla: si la puerta de sim-core
// aceptara otra grilla y acá quedara un 16 escrito a mano, todo lo que entrara
// se vería roto sin que nada avisara.
export { GLYPH_SIZE } from '@anima/sim-core';
import { GLYPH_SIZE } from '@anima/sim-core';

/** Los tres tonos de un material. El índice `0` del glifo es transparente. */
export interface Palette {
  /** Índice `1`: el color liso del material. */
  base: string;
  /** Índice `2`: zonas en sombra, bordes de abajo. */
  shadow: string;
  /** Índice `3`: brillos, bordes de arriba. */
  light: string;
}

/** Un dibujo: `GLYPH_SIZE` filas de `GLYPH_SIZE` índices de paleta. */
export type Glyph = readonly string[];

/**
 * Elige de una lista que nunca está vacía. El tipo la exige no vacía para que
 * "no hay ninguno" sea imposible en vez de ser un caso a chequear.
 */
function pick<T>(list: readonly [T, ...T[]], seed: number): T {
  const index = seed % list.length;
  return index === 0 ? list[0] : (list[index] ?? list[0]);
}

const PALETTES = {
  piedra: { base: '#94a3b8', shadow: '#475569', light: '#cbd5e1' },
  madera: { base: '#b45309', shadow: '#7c2d12', light: '#f59e0b' },
  hueso: { base: '#e7e5e4', shadow: '#a8a29e', light: '#fafaf9' },
  metal: { base: '#9ca3af', shadow: '#4b5563', light: '#e5e7eb' },
  planta: { base: '#65a30d', shadow: '#3f6212', light: '#a3e635' },
  tierra: { base: '#a16207', shadow: '#713f12', light: '#ca8a04' },
  agua: { base: '#38bdf8', shadow: '#0369a1', light: '#7dd3fc' },
  fuego: { base: '#f97316', shadow: '#b91c1c', light: '#fde047' },
  cuero: { base: '#a8734a', shadow: '#6b4423', light: '#d4a373' },
  hielo: { base: '#a5f3fc', shadow: '#0e7490', light: '#ecfeff' },
  // Ámbar: la resina no es madera ni fuego, es lo pegajoso y translúcido
  // entre los dos.
  resina: { base: '#e0a112', shadow: '#8a5a08', light: '#fcd35e' },
  /**
   * El pedernal es piedra, pero no ES la piedra: es oscuro, casi negro, y se
   * parte en filos que brillan. Compartía la paleta gris de la piedra y —desde
   * que la piedra existe como materia propia— eso los volvía dos manchas
   * grises indistinguibles. El brillo alto es la fractura vidriosa: lo que lo
   * hace servir para la chispa se ve.
   */
  pedernal: { base: '#57534e', shadow: '#292524', light: '#d6d3d1' },
} satisfies Record<string, Palette>;

/**
 * Qué palabras delatan un material. Se mira tanto el nombre en español (lo que
 * inventa Ánima) como en inglés (los tipos del motor), porque el mismo objeto
 * viaja con los dos vocabularios según de dónde venga.
 */
const MATERIAL_WORDS: [palette: Palette, words: string[]][] = [
  // El pedernal va ANTES que la piedra y sin compartirle palabras: es su
  // propio material, no un tono de aquella.
  [PALETTES.pedernal, ['pedernal', 'flint', 'silex', 'obsidiana', 'obsidian']],
  [PALETTES.piedra, ['piedra', 'roca', 'stone', 'rock', 'granito', 'pebble']],
  [PALETTES.madera, ['madera', 'wood', 'log', 'tronco', 'rama', 'branch', 'tabla', 'plank']],
  [PALETTES.hueso, ['hueso', 'bone', 'asta', 'colmillo', 'tusk', 'diente', 'tooth']],
  [PALETTES.metal, ['metal', 'hierro', 'iron', 'acero', 'steel', 'cobre', 'copper', 'bronce', 'mineral', 'ore', 'veta', 'vein']],
  [PALETTES.planta, ['planta', 'hoja', 'leaf', 'fibra', 'fiber', 'liana', 'pasto', 'grass']],
  [PALETTES.tierra, ['tierra', 'barro', 'mud', 'clay', 'arcilla', 'arena', 'sand', 'dirt', 'ladrillo', 'brick']],
  [PALETTES.agua, ['agua', 'water', 'liquido', 'jugo']],
  [PALETTES.fuego, ['fuego', 'fire', 'brasa', 'ember', 'llama', 'flame', 'ceniza', 'ash']],
  [PALETTES.cuero, ['cuero', 'leather', 'piel', 'hide', 'pellejo']],
  [PALETTES.hielo, ['hielo', 'ice', 'nieve', 'snow', 'escarcha']],
  [PALETTES.resina, ['resina', 'resin', 'savia', 'sap', 'ambar', 'amber', 'brea', 'tar']],
];

/**
 * Paletas para lo que no delata ningún material. No se calcula un color: se
 * elige de una lista corta y probada contra el verde del tablero, porque un
 * tono generado al azar puede caer justo encima del fondo y desaparecer.
 */
const STRANGE_PALETTES: readonly [Palette, ...Palette[]] = [
  { base: '#a78bfa', shadow: '#5b21b6', light: '#ddd6fe' },
  { base: '#f472b6', shadow: '#9d174d', light: '#fbcfe8' },
  { base: '#fbbf24', shadow: '#b45309', light: '#fde68a' },
  { base: '#22d3ee', shadow: '#0e7490', light: '#a5f3fc' },
  { base: '#fb7185', shadow: '#9f1239', light: '#fecdd3' },
  { base: '#c084fc', shadow: '#6b21a8', light: '#e9d5ff' },
];

/** Sin tildes y en minúscula: "Polvo de Piedra" y "polvo-de-piedra" son lo mismo. */
function normalize(value: string): string {
  // `NFD` parte la "é" en "e" + tilde suelta, y el rango borra esas tildes
  // sueltas. Van como clase de caracteres porque son invisibles sueltos.
  const DIACRITICS = /[̀-ͯ]/g;
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[-_]/g, ' ')
    .trim();
}

/**
 * FNV-1a de 32 bits. Solo hace falta que sea estable y esté bien repartido:
 * el mismo nombre tiene que dar siempre el mismo color, en cualquier máquina y
 * en cualquier sesión, o el objeto cambiaría de aspecto al recargar.
 */
export function hashKind(kind: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < kind.length; i++) {
    hash ^= kind.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** El material que delata un nombre, si es que delata alguno. */
function materialNamedBy(kind: string): Palette | undefined {
  const name = normalize(kind);
  for (const [palette, words] of MATERIAL_WORDS) {
    if (words.some((word) => name.includes(word))) return palette;
  }
  return undefined;
}

/**
 * Qué produce cada receta a partir de qué: producto → primer ingrediente.
 * Es la cadena por la que se hereda el color.
 */
export type Lineage = ReadonlyMap<string, string>;

/**
 * Hasta dónde se sigue la cadena hacia atrás. Mismo tope que `MAX_RECIPE_DEPTH`
 * en el motor: si a los cuatro saltos nadie dijo de qué está hecho, no lo va a
 * decir, y una cadena circular no puede colgar el dibujo.
 */
const MAX_LINEAGE_DEPTH = 4;

/**
 * De qué está hecha una cosa, siguiendo las recetas hacia atrás.
 *
 * Ánima inventó un `cuchillo` con `flint-shard` + `branch`. El nombre
 * "cuchillo" no dice de qué está hecho, así que sin esto salía de un color
 * arbitrario. Siguiendo la receta se llega al pedernal y sale gris piedra.
 *
 * Se toma el PRIMER ingrediente, no todos: en un cuchillo la hoja manda sobre
 * el mango, y lo que define a un objeto suele ser su material principal. Si
 * algún día hicieran falta dos colores —hoja gris, mango marrón— el glifo
 * tiene índices libres y esto no habría que rehacerlo.
 */
export function materialFor(kind: string, lineage: Lineage): string | undefined {
  let current: string | undefined = kind;
  for (let step = 0; step < MAX_LINEAGE_DEPTH && current; step++) {
    if (materialNamedBy(current)) return current;
    current = lineage.get(current);
  }
  return undefined;
}

/**
 * La paleta de una cosa: por lo que diga su propio nombre, si no por el
 * material que heredó de su receta, y si nada de eso, una elegida por hash —
 * arbitraria pero constante.
 *
 * El nombre propio gana sobre el linaje a propósito: un "hacha de piedra"
 * hecha con una rama primero es de piedra, porque lo dice.
 */
export function paletteFor(kind: string, material?: string): Palette {
  return (
    materialNamedBy(kind) ??
    (material ? materialNamedBy(material) : undefined) ??
    // El hash va sobre el nombre propio: si fuera sobre el material heredado,
    // cambiar una receta le cambiaría el color a lo que no tiene material.
    pick(STRANGE_PALETTES, hashKind(kind))
  );
}

const POLVO: Glyph = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000003333000000',
  '0000013333100000',
  '0000113333110000',
  '0001111111111000',
  '0002211111122000',
  '0000222222220000',
  '0000000000000000',
];

const ESQUIRLA: Glyph = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000330000000',
  '0000003311000000',
  '0000033111200000',
  '0000331111220000',
  '0003311111220000',
  '0033111111122000',
  '0033111111122000',
  '0003111111122000',
  '0000311111220000',
  '0000031112200000',
  '0000001122000000',
  '0000000000000000',
  '0000000000000000',
];

const BARRA: Glyph = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0033333333333300',
  '0031111111111300',
  '0011111111111100',
  '0021111111111200',
  '0022222222222200',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
];

const LAMINA: Glyph = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000003333000',
  '0000000331111300',
  '0000033111111300',
  '0003311111111100',
  '0033111111111100',
  '0031111111111000',
  '0021111111120000',
  '0002111112200000',
  '0000222220000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
];

/**
 * La hoja con mango: cuchillo, hacha, lanza, punta. Es la forma que faltaba
 * cuando Ánima inventó su primer cuchillo — hasta entonces todo lo que cortaba
 * caía en el 🔨 de la tabla de rasgos, que es lo que no queremos.
 */
const HOJA: Glyph = [
  '0000000000000000',
  '0000000330000000',
  '0000003113000000',
  '0000031111300000',
  '0000031111200000',
  '0000031111200000',
  '0000031111200000',
  '0000031111200000',
  '0000031111200000',
  '0000022222200000',
  '0000002112000000',
  '0000002112000000',
  '0000002112000000',
  '0000002222000000',
  '0000000000000000',
  '0000000000000000',
];

const FIBRA: Glyph = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0003300330033000',
  '0001100110011000',
  '0001100110011000',
  '0001100110011000',
  '0001100110011000',
  '0001100110011000',
  '0001100110011000',
  '0002200220022000',
  '0002200220022000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
];

/**
 * Las tres masas son el caso por defecto: algo compacto sin forma declarada.
 * Son tres y no una para que dos inventos distintos no salgan mellizos; cuál
 * te toca lo decide el hash del nombre.
 */
const MASA_REDONDA: Glyph = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000003333000000',
  '0000333333330000',
  '0003331111112000',
  '0033311111112200',
  '0331111111111220',
  '0311111111111220',
  '0311111111112220',
  '0331111111122200',
  '0031111111222000',
  '0003111112220000',
  '0000222222200000',
  '0000000000000000',
  '0000000000000000',
];

const MASA_ANGULOSA: Glyph = [
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000333333000000',
  '0003331111330000',
  '0033111111113000',
  '0031111111111200',
  '0311111111111220',
  '0311111111111220',
  '0331111111111200',
  '0031111111122000',
  '0002211112200000',
  '0000222220000000',
  '0000000000000000',
  '0000000000000000',
];

const MASA_ALTA: Glyph = [
  '0000000000000000',
  '0000000000000000',
  '0000033333000000',
  '0000333111300000',
  '0003311111120000',
  '0003111111120000',
  '0003111111120000',
  '0003111111120000',
  '0003111111120000',
  '0003111111220000',
  '0003111112220000',
  '0002211122200000',
  '0000222220000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
];

const MASAS: readonly [Glyph, ...Glyph[]] = [MASA_REDONDA, MASA_ANGULOSA, MASA_ALTA];

/**
 * Qué palabras delatan una forma. Igual que con el material, se leen los dos
 * vocabularios. Lo que no cae en ninguna es una masa.
 */
const FORM_WORDS: [glyph: Glyph, words: string[]][] = [
  [POLVO, ['polvo', 'dust', 'ceniza', 'ash', 'arena', 'sand', 'harina', 'grano']],
  // El pedernal entra acá y no en las masas: no es un canto rodado, es una
  // lasca con filo. La forma cuenta lo mismo que el color.
  [ESQUIRLA, ['esquirla', 'shard', 'astilla', 'splinter', 'fragmento', 'lasca', 'chip', 'pedernal', 'flint']],
  [BARRA, ['barra', 'bar', 'vara', 'rod', 'palo', 'stick', 'lingote', 'ingot', 'eje', 'ladrillo', 'brick']],
  [LAMINA, ['lamina', 'sheet', 'placa', 'plate', 'tabla', 'plank', 'plancha', 'loseta']],
  [FIBRA, ['fibra', 'fiber', 'cuerda', 'rope', 'hilo', 'thread', 'soga', 'trenza']],
  [HOJA, ['cuchillo', 'knife', 'hoja', 'blade', 'filo', 'daga', 'hacha', 'axe', 'lanza', 'pico', 'pick']],
];

/** La forma de una cosa: por lo que diga su nombre, y si no dice nada, una masa. */
export function patternFor(kind: string): Glyph {
  const name = normalize(kind);
  for (const [glyph, words] of FORM_WORDS) {
    if (words.some((word) => name.includes(word))) return glyph;
  }
  return pick(MASAS, hashKind(kind));
}

/**
 * Acota un glifo que viene de afuera. La IA Dios propone la forma y esto la
 * revisa antes de que llegue a la pantalla, igual que `validateDecomposition`
 * revisa lo que propone para romper: medida exacta y solo índices de paleta,
 * porque acá entra dato que no escribimos nosotros.
 */
export function parseGlyph(value: unknown): Glyph | null {
  if (!Array.isArray(value) || value.length !== GLYPH_SIZE) return null;
  for (const row of value) {
    if (typeof row !== 'string' || row.length !== GLYPH_SIZE) return null;
    if (!/^[0-3]+$/.test(row)) return null;
  }
  return value as Glyph;
}

/**
 * El color de una casilla del glifo, o `null` si está vacía. Lo usan los dos
 * renderers: el tablero pinta una textura y el catálogo pinta rectángulos SVG,
 * pero de qué color es cada casilla se decide en un solo lugar.
 */
export function toneAt(glyph: Glyph, x: number, y: number, palette: Palette): string | null {
  const index = glyph[y]?.charAt(x);
  if (index === '1') return palette.base;
  if (index === '2') return palette.shadow;
  if (index === '3') return palette.light;
  return null;
}
