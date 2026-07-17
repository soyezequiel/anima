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
  barricade: 'empalizada',
  cactus: 'cactus',
  water: 'agua',
  shelter: 'refugio',
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
