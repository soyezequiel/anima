/**
 * Cómo se llaman las cosas en voz humana. Los tipos del motor son
 * identificadores (`log`, `flint`), no nombres: "log" no significa nada para
 * quien juega.
 *
 * Vive aquí, y no en la UI ni en el agente, porque los dos lo necesitan y una
 * tabla duplicada se desincroniza: la mascota diría "me faltan 2 troncos"
 * mientras el dibujo rotula "log". Es el mismo objeto; tiene un solo nombre.
 */
const KIND_LABELS: Record<string, string> = {
  pet: 'mascota',
  food: 'alimento',
  wall: 'muro',
  branch: 'rama',
  hammer: 'martillo',
  tree: 'árbol',
  log: 'tronco',
  flint: 'pedernal',
  campfire: 'fogata',
  chair: 'silla',
  torch: 'antorcha',
  // El id sigue siendo `barricade` (viaja en partidas guardadas), pero desde
  // que se levanta con ladrillos "empalizada" era mentira: una empalizada es
  // de estacas.
  barricade: 'muralla',
  cactus: 'cactus',
  water: 'agua',
  shelter: 'refugio',
  stone: 'piedra',
  fiber: 'fibra',
  clay: 'arcilla',
  resin: 'resina',
  ore: 'mineral',
  rock: 'roca',
  bush: 'arbusto',
  pine: 'pino',
  vein: 'veta',
  // 'pico' a secas y no 'pico de piedra': la heurística de género mira la
  // última letra del nombre, y "de piedra" lo volvería "una pico".
  'stone-pick': 'pico',
  brick: 'ladrillo',
  'clay-pit': 'barrial',
};

/**
 * El nombre de un tipo. Lo que Ánima inventa (ADR 0018) no está en la tabla y
 * no hace falta que esté: el nombre se lo puso ella, y con los guiones
 * convertidos en espacios ya se lee («hoguera-simple» → «hoguera simple»).
 */
export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/-/g, ' ');
}

/**
 * Género gramatical adivinado por la terminación del nombre humano. Es una
 * heurística (vale también para lo que Ánima inventa, que no está en la
 * tabla): "silla" → femenino, "tronco" → masculino.
 */
export function isFeminineKind(kind: string): boolean {
  return /a$/.test(kindLabel(kind));
}

/** "un tronco", "una silla": artículo indeterminado según el género. */
export function kindWithArticle(kind: string): string {
  return `${isFeminineKind(kind) ? 'una' : 'un'} ${kindLabel(kind)}`;
}

/**
 * "1 tronco", "2 troncos", "2 pedernales": cantidad con el plural español.
 * Vive junto al vocabulario porque el plural depende del nombre humano, no
 * del identificador del motor.
 */
export function countedKindLabel(kind: string, amount: number): string {
  const name = kindLabel(kind);
  if (amount === 1) return `1 ${name}`;
  const plural = /[aeiouáéíóú]$/.test(name) ? `${name}s` : `${name}es`;
  return `${amount} ${plural}`;
}

/**
 * "un tronco", "un tronco o un pedernal": los tipos que está esperando, en voz
 * humana. La "o" y no la "y" es a propósito — con que aparezca uno cualquiera
 * ya vuelve a intentarlo.
 */
export function displayKindList(kinds: string[]): string {
  const names = kinds.map(kindWithArticle);
  if (names.length <= 1) return names[0] ?? 'lo que falta';
  return `${names.slice(0, -1).join(', ')} o ${names[names.length - 1]}`;
}
