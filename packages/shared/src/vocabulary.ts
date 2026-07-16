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
  cactus: 'cactus',
};

/**
 * El nombre de un tipo. Lo que Ánima inventa (ADR 0018) no está en la tabla y
 * no hace falta que esté: el nombre se lo puso ella, y con los guiones
 * convertidos en espacios ya se lee («hoguera-simple» → «hoguera simple»).
 */
export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/-/g, ' ');
}
