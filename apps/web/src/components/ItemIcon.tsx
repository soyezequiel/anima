import { appearanceFor, hexColor } from '../phaser/appearance.js';
import type { EntityTraits } from '../session/view.js';

/**
 * El dibujo de una cosa en chico, con la MISMA regla que el tablero y el
 * catálogo (appearance.ts): una cosa no puede verse de dos maneras según dónde
 * la mires. Lo comparten el catálogo de items y la mochila del panel de estado.
 */
export function ItemIcon({ kind, traits }: { kind: string; traits: EntityTraits }) {
  const look = appearanceFor(kind, traits);
  if (look.as === 'emoji') {
    return (
      <span className="item-icon" aria-hidden="true">
        {look.emoji}
      </span>
    );
  }
  return (
    <span
      className="item-icon item-icon-block"
      aria-hidden="true"
      style={{ background: hexColor(look.fill), borderColor: hexColor(look.stroke) }}
    />
  );
}
