import { appearanceFor, hexColor } from '../phaser/appearance.js';
import { GLYPH_SIZE, toneAt } from '../phaser/matter.js';
import type { EntityTraits } from '../session/view.js';

/**
 * El dibujo de una cosa en chico, con la MISMA regla que el tablero y el
 * catálogo (appearance.ts): una cosa no puede verse de dos maneras según dónde
 * la mires. Lo comparten el catálogo de items y la mochila del panel de estado.
 *
 * El glifo se dibuja como SVG y no como textura: acá no hay canvas ni Phaser,
 * y son un puñado de rectángulos que el navegador ya sabe pintar. La regla de
 * qué dibujar es la misma; cambia solo con qué se pinta.
 */
export function ItemIcon({
  kind,
  traits,
  glyph,
  material,
}: {
  kind: string;
  traits: EntityTraits;
  /** Lo que la IA Dios dibujó para este tipo, si es que dibujó algo. */
  glyph?: unknown;
  /** De qué está hecho, heredado de su receta. */
  material?: string | undefined;
}) {
  const look = appearanceFor(kind, traits, { glyph, material });
  if (look.as === 'emoji') {
    return (
      <span className="item-icon" aria-hidden="true">
        {look.emoji}
      </span>
    );
  }
  if (look.as === 'block') {
    return (
      <span
        className="item-icon item-icon-block"
        aria-hidden="true"
        style={{ background: hexColor(look.fill), borderColor: hexColor(look.stroke) }}
      />
    );
  }
  const cells = [];
  for (let y = 0; y < GLYPH_SIZE; y++) {
    for (let x = 0; x < GLYPH_SIZE; x++) {
      const color = toneAt(look.glyph, x, y, look.palette);
      if (!color) continue;
      cells.push(<rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={color} />);
    }
  }
  return (
    <span className="item-icon" aria-hidden="true">
      <svg
        viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`}
        width="20"
        height="20"
        shapeRendering="crispEdges"
        style={{ display: 'block' }}
      >
        {cells}
      </svg>
    </span>
  );
}
